// Flood engine v2 on WebGPU: the same steps as solver.ts (CPU reference), one compute pass per step stage, float32.
// Verified against the CPU solver on real terrain (verification/gpu-parity). Runs in a worker; no GPU readback per step:
// the time step is computed on the GPU from the deepest water (CFL) and the CPU only reads state between batches.
import type { EngineGrid } from "./solver";

const WG = 256;
// WebGPU flag values (spec constants), written out so the module also type-checks where the globals are not declared
const BU = { MAP_READ: 1, COPY_SRC: 4, COPY_DST: 8, UNIFORM: 64, STORAGE: 128 } as const;
const COMPUTE_STAGE = 4, MAP_READ_MODE = 1;
const SHADER = /* wgsl */ `
struct P { nx: u32, ny: u32, nIn: u32, nBlk: u32, dx: f32, hMin: f32, alpha: f32, dtMax: f32, seaLevel: f32, tEnd: f32, blockS: f32, inDt: f32, nWg: u32, inSteps: u32, inOff: u32, pad1: u32 };
struct S { dt: f32, t: f32, p0: f32, p1: f32, dmax: atomic<u32>, rain: f32, infil: f32, outflow: f32, sea: f32, inflow: f32, pad0: f32, pad1: f32 };
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read_write> st: S;
@group(0) @binding(2) var<storage, read> cell: array<vec4<f32>>;     // z, Manning n, NRCS retention S (mm, < 0 none), flags (bits)
@group(0) @binding(3) var<storage, read_write> hh: array<vec2<f32>>;  // depth, max depth
@group(0) @binding(4) var<storage, read> q: array<vec2<f32>>;         // old fluxes: east face, south face (m2/s)
@group(0) @binding(5) var<storage, read_write> qn: array<vec2<f32>>;  // new fluxes
@group(0) @binding(6) var<storage, read_write> bs: array<vec2<f32>>;  // open-side outflow (m3/s), limiter scale
@group(0) @binding(7) var<storage, read_write> aux: array<f32>;       // [rain block depths (mm)] [inflow cells (bits)] [inflow m3/s, nIn x inSteps] [per-workgroup sums x4]
const G = 9.81;
var<workgroup> red: array<vec4<f32>, ${WG}>;
// flags: bit0 active, bit1 sea, bit2 N open, bit3 S open, bit4 W open, bit5 E open
fn fl(c: u32) -> u32 { return bitcast<u32>(cell[c].w); }
fn z(c: u32) -> f32 { return cell[c].x; }

fn cumRain(t: f32) -> f32 {
  var s = 0.0;
  for (var k = 0u; k < p.nBlk; k++) {
    let a = f32(k) * p.blockS;
    if (t <= a) { break; }
    s += aux[k] * min(1.0, (t - a) / p.blockS);
  }
  return s;
}
fn scs(pp: f32, s: f32) -> f32 { if (pp > 0.2 * s) { let a = pp - 0.2 * s; return a * a / (pp + 0.8 * s); } return 0.0; }
fn partBase() -> u32 { return p.inOff + p.nIn + p.nIn * p.inSteps; }

@compute @workgroup_size(1) fn begin() {
  let d = bitcast<f32>(atomicLoad(&st.dmax));
  var dt = p.dtMax;
  if (d > p.hMin) { dt = min(p.dtMax, p.alpha * p.dx / sqrt(G * d)); }
  if (st.t >= p.tEnd) { dt = 0.0; }
  st.dt = dt;
  st.p0 = cumRain(st.t);
  st.p1 = cumRain(st.t + dt);
  atomicStore(&st.dmax, 0u);
}

fn face(c: u32, r: u32, q0: f32, qt: f32, dt: f32) -> f32 {
  let zc = z(c); let zr = z(r);
  let etaL = zc + hh[c].x; let etaR = zr + hh[r].x;
  let hf = max(etaL, etaR) - max(zc, zr);
  if (hf <= p.hMin) { return 0.0; }
  let nn = 0.5 * (cell[c].y + cell[r].y);
  let qv = (q0 - G * hf * dt * (etaR - etaL) / p.dx) / (1.0 + G * dt * nn * nn * sqrt(q0 * q0 + qt * qt) / (hf * hf * pow(hf, 1.0 / 3.0)));
  let qm = hf * sqrt(G * hf);
  return clamp(qv, -qm, qm);
}

@compute @workgroup_size(${WG}) fn flux(@builtin(global_invocation_id) gid: vec3<u32>) {
  let c = gid.x;
  if (c >= p.nx * p.ny) { return; }
  let i = c % p.nx; let j = c / p.nx; let dt = st.dt;
  var a = vec2<f32>(0.0);
  if ((fl(c) & 1u) != 0u) {
    if (i < p.nx - 1u && (fl(c + 1u) & 1u) != 0u) {
      var qt = q[c].y + q[c + 1u].y;
      if (j > 0u) { qt += q[c - p.nx].y + q[c + 1u - p.nx].y; }
      a.x = face(c, c + 1u, q[c].x, 0.25 * qt, dt);
    }
    if (j < p.ny - 1u && (fl(c + p.nx) & 1u) != 0u) {
      var qt = q[c].x + q[c + p.nx].x;
      if (i > 0u) { qt += q[c - 1u].x + q[c - 1u + p.nx].x; }
      a.y = face(c, c + p.nx, q[c].y, 0.25 * qt, dt);
    }
  }
  qn[c] = a;
}

@compute @workgroup_size(${WG}) fn limit(@builtin(global_invocation_id) gid: vec3<u32>) {
  let c = gid.x;
  if (c >= p.nx * p.ny) { return; }
  let f = fl(c); let dt = st.dt; let hc = hh[c].x; let i = c % p.nx;
  if ((f & 1u) == 0u) { bs[c] = vec2<f32>(0.0, 1.0); return; }
  var b = 0.0;
  if (hc > p.hMin) {
    let qc = hc * sqrt(G * hc);
    let oN = (f & 4u) != 0u; let oS = (f & 8u) != 0u; let oW = (f & 16u) != 0u; let oE = (f & 32u) != 0u;
    if (oE && !oW) { b += min(qc, max(0.0, qn[c - 1u].x)); }
    if (oW && !oE) { b += min(qc, max(0.0, -qn[c].x)); }
    if (oS && !oN) { b += min(qc, max(0.0, qn[c - p.nx].y)); }
    if (oN && !oS) { b += min(qc, max(0.0, -qn[c].y)); }
  }
  b *= p.dx;
  var o = b;
  if (qn[c].x > 0.0) { o += qn[c].x * p.dx; }
  if (i > 0u && qn[c - 1u].x < 0.0) { o -= qn[c - 1u].x * p.dx; }
  if (qn[c].y > 0.0) { o += qn[c].y * p.dx; }
  if (c >= p.nx && qn[c - p.nx].y < 0.0) { o -= qn[c - p.nx].y * p.dx; }
  let v = o * dt; let a = hc * p.dx * p.dx;
  var s = 1.0;
  if (v > a && v > 0.0) { s = a / v; }
  bs[c] = vec2<f32>(b, s);
}

@compute @workgroup_size(${WG}) fn apply(@builtin(global_invocation_id) gid: vec3<u32>) {
  let c = gid.x;
  if (c >= p.nx * p.ny) { return; }
  var a = qn[c];
  if (a.x > 0.0) { a.x *= bs[c].y; } else if (a.x < 0.0) { a.x *= bs[c + 1u].y; }
  if (a.y > 0.0) { a.y *= bs[c].y; } else if (a.y < 0.0) { a.y *= bs[c + p.nx].y; }
  qn[c] = a;
}

@compute @workgroup_size(${WG}) fn depth(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_index) li: u32, @builtin(workgroup_id) wg: vec3<u32>) {
  let c = gid.x;
  var acc = vec4<f32>(0.0);
  if (c < p.nx * p.ny && (fl(c) & 1u) != 0u) {
    let dt = st.dt; let i = c % p.nx; let k = cell[c];
    var div = -qn[c].x - qn[c].y;
    if (i > 0u) { div += qn[c - 1u].x; }
    if (c >= p.nx) { div += qn[c - p.nx].y; }
    let gross = (st.p1 - st.p0) / 1000.0;
    var eff = gross;
    if (k.z >= 0.0) { eff = (scs(st.p1, k.z) - scs(st.p0, k.z)) / 1000.0; }
    let area = p.dx * p.dx;
    let b = bs[c].x * bs[c].y;
    var hn = max(hh[c].x + dt * div / p.dx - b * dt / area + eff, 0.0);
    var sv = 0.0;
    if ((fl(c) & 2u) != 0u) { let fix = max(0.0, p.seaLevel - k.x); sv = hn - fix; hn = fix; }
    hh[c] = vec2<f32>(hn, max(hh[c].y, hn));
    atomicMax(&st.dmax, bitcast<u32>(hn));
    acc = vec4<f32>(gross, eff, b * dt / area, sv);
  }
  red[li] = acc;
  workgroupBarrier();
  for (var s = ${WG / 2}u; s > 0u; s = s >> 1u) {
    if (li < s) { red[li] = red[li] + red[li + s]; }
    workgroupBarrier();
  }
  if (li == 0u) { let w = partBase() + wg.x * 4u; aux[w] = red[0].x; aux[w + 1u] = red[0].y; aux[w + 2u] = red[0].z; aux[w + 3u] = red[0].w; }
}

@compute @workgroup_size(1) fn finish() {
  let dt = st.dt;
  if (dt <= 0.0) { return; }
  let area = p.dx * p.dx;
  var r = 0.0; var e = 0.0; var o = 0.0; var s = 0.0;
  let pb = partBase();
  for (var w = 0u; w < p.nWg; w++) { r += aux[pb + w * 4u]; e += aux[pb + w * 4u + 1u]; o += aux[pb + w * 4u + 2u]; s += aux[pb + w * 4u + 3u]; }
  st.rain += r * area; st.infil += (r - e) * area; st.outflow += o * area; st.sea += s * area;
  let k = min(p.inSteps - 1u, u32(st.t / p.inDt));
  var vin = 0.0;
  for (var m = 0u; m < p.nIn; m++) {
    let v = aux[p.inOff + p.nIn + m * p.inSteps + k] * dt;
    if (v > 0.0) {
      let c = bitcast<u32>(aux[p.inOff + m]);
      let hn = hh[c].x + v / area;
      hh[c] = vec2<f32>(hn, max(hh[c].y, hn));
      atomicMax(&st.dmax, bitcast<u32>(hn));
      vin += v;
    }
  }
  st.inflow += vin;
  st.t = st.t + dt;
}
`;

export type GpuInputs = {
  grid: EngineGrid; seaLevel: number; hMin: number; alpha: number; dtMax: number; tEnd: number;
  rain: { blockSeconds: number; mm: number[] }; inflowCells: number[]; inflowQ: Float64Array[]; inflowDt: number;
};
export type GpuState = { t: number; dt: number; totals: { rain: number; infiltration: number; outflow: number; sea: number; inflow: number } };

export class GpuEngine {
  private constructor(
    private dev: GPUDevice, private pipes: Record<string, GPUComputePipeline>, private groups: GPUBindGroup[],
    private bufs: Record<string, GPUBuffer>, readonly N: number, private nWg: number, private initialVolume: number, private area: number,
  ) {}
  static async create(inp: GpuInputs): Promise<GpuEngine | null> {
    const ad = await navigator.gpu?.requestAdapter({ powerPreference: "high-performance" });
    if (!ad) return null;
    const N = inp.grid.nx * inp.grid.ny;
    const need = N * 16;
    if (need > ad.limits.maxStorageBufferBindingSize) return null;
    const dev = await ad.requestDevice({ requiredLimits: { maxStorageBufferBindingSize: Math.max(need, 128 << 20), maxBufferSize: Math.max(need, 256 << 20) } });
    const g = inp.grid, nWg = Math.ceil(N / WG);
    const S = BU.STORAGE, D = BU.COPY_DST, C = BU.COPY_SRC;
    const buf = (data: ArrayBufferView | number, usage = S | D) => {
      const size = Math.max(16, Math.ceil((typeof data === "number" ? data : data.byteLength) / 4) * 4);
      const b = dev.createBuffer({ size, usage });
      if (typeof data !== "number") dev.queue.writeBuffer(b, 0, data.buffer, data.byteOffset, data.byteLength);
      return b;
    };
    const flags = new Uint32Array(N), { nx, ny, active, sea } = g;
    const off = (i: number, j: number) => i < 0 || j < 0 || i >= nx || j >= ny || !active[j * nx + i];
    const h0 = new Float32Array(N);
    let dmax = 0, vol = 0;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const c = j * nx + i;
      if (!active[c]) continue;
      flags[c] = 1 | (sea?.[c] ? 2 : 0) | (off(i, j - 1) ? 4 : 0) | (off(i, j + 1) ? 8 : 0) | (off(i - 1, j) ? 16 : 0) | (off(i + 1, j) ? 32 : 0);
      if (sea?.[c]) { h0[c] = Math.max(0, inp.seaLevel - g.z[c]); dmax = Math.max(dmax, h0[c]); vol += h0[c]; }
    }
    const cellData = new Float32Array(N * 4), cu = new Uint32Array(cellData.buffer);
    for (let c = 0; c < N; c++) {
      cellData[c * 4] = g.z[c]; cellData[c * 4 + 1] = g.n[c];
      cellData[c * 4 + 2] = g.cn ? (g.cn[c] >= 100 ? 0 : 25400 / g.cn[c] - 254) : -1;
      cu[c * 4 + 3] = flags[c];
    }
    const inSteps = Math.max(1, inp.inflowQ[0]?.length ?? 1), nIn = inp.inflowCells.length, nBlk = inp.rain.mm.length;
    const aux = new Float32Array(nBlk + nIn + nIn * inSteps + nWg * 4), au = new Uint32Array(aux.buffer);
    aux.set(inp.rain.mm, 0);
    inp.inflowCells.forEach((c, m) => { au[nBlk + m] = c; });
    inp.inflowQ.forEach((q, m) => aux.set(Float32Array.from(q), nBlk + nIn + m * inSteps));
    const pb = new ArrayBuffer(64), pu = new Uint32Array(pb), pf = new Float32Array(pb);
    pu[0] = nx; pu[1] = ny; pu[2] = nIn; pu[3] = nBlk;
    pf[4] = g.dx; pf[5] = inp.hMin; pf[6] = inp.alpha; pf[7] = inp.dtMax; pf[8] = inp.seaLevel; pf[9] = inp.tEnd; pf[10] = inp.rain.blockSeconds; pf[11] = inp.inflowDt;
    pu[12] = nWg; pu[13] = inSteps; pu[14] = nBlk;
    const st = new ArrayBuffer(48);
    new Uint32Array(st)[4] = new Uint32Array(Float32Array.of(dmax).buffer)[0];
    const hh = new Float32Array(N * 2);
    for (let c = 0; c < N; c++) { hh[2 * c] = h0[c]; hh[2 * c + 1] = h0[c]; }
    const bufs: Record<string, GPUBuffer> = {
      p: buf(new Uint8Array(pb), BU.UNIFORM | D), st: buf(new Uint8Array(st), S | D | C), cell: buf(cellData),
      hh: buf(hh, S | D | C), qa: buf(N * 8), qb: buf(N * 8), bs: buf(N * 8), aux: buf(aux),
    };
    const mod = dev.createShaderModule({ code: SHADER });
    const layout = dev.createBindGroupLayout({
      entries: Array.from({ length: 8 }, (_, b) => ({
        binding: b, visibility: COMPUTE_STAGE,
        buffer: { type: b === 0 ? "uniform" : b === 2 || b === 4 ? "read-only-storage" : "storage" } as GPUBufferBindingLayout,
      })),
    });
    const pl = dev.createPipelineLayout({ bindGroupLayouts: [layout] });
    const pipes: Record<string, GPUComputePipeline> = {};
    for (const e of ["begin", "flux", "limit", "apply", "depth", "finish"]) pipes[e] = await dev.createComputePipelineAsync({ layout: pl, compute: { module: mod, entryPoint: e } });
    // two bind groups swap old and new fluxes on alternate steps
    const group = (qo: string, qn: string) => dev.createBindGroup({
      layout, entries: ["p", "st", "cell", "hh", qo, qn, "bs", "aux"].map((k, b) => ({ binding: b, resource: { buffer: bufs[k] } })),
    });
    const groups = [group("qa", "qb"), group("qb", "qa")];
    return new GpuEngine(dev, pipes, groups, bufs, N, nWg, vol * g.dx * g.dx, g.dx * g.dx);
  }
  private parity = 0;
  /** Encode n time steps and submit them. */
  steps(n: number) {
    const enc = this.dev.createCommandEncoder();
    for (let s = 0; s < n; s++) {
      const pass = enc.beginComputePass();
      pass.setBindGroup(0, this.groups[this.parity]);
      for (const [e, w] of [["begin", 1], ["flux", this.nWg], ["limit", this.nWg], ["apply", this.nWg], ["depth", this.nWg], ["finish", 1]] as const) {
        pass.setPipeline(this.pipes[e]);
        pass.dispatchWorkgroups(w);
      }
      pass.end();
      this.parity ^= 1;
    }
    this.dev.queue.submit([enc.finish()]);
  }
  private async read(name: string, bytes: number): Promise<ArrayBuffer> {
    const rb = this.dev.createBuffer({ size: bytes, usage: BU.MAP_READ | BU.COPY_DST });
    const enc = this.dev.createCommandEncoder();
    enc.copyBufferToBuffer(this.bufs[name], 0, rb, 0, bytes);
    this.dev.queue.submit([enc.finish()]);
    await rb.mapAsync(MAP_READ_MODE);
    const out = rb.getMappedRange().slice(0);
    rb.destroy();
    return out;
  }
  async state(): Promise<GpuState> {
    const f = new Float32Array(await this.read("st", 48));
    return { dt: f[0], t: f[1], totals: { rain: f[5], infiltration: f[6], outflow: f[7], sea: f[8], inflow: f[9] } };
  }
  /** Depth and max depth, interleaved per cell. */
  depths = async () => new Float32Array(await this.read("hh", this.N * 8));
  /** Relative mass error from the GPU totals and the stored volume (float32 sums: expect about 1e-5). */
  async massError(active: Uint8Array): Promise<number> {
    const [s, h] = [await this.state(), await this.depths()];
    let v = 0;
    for (let c = 0; c < active.length; c++) if (active[c]) v += h[2 * c];
    const T = s.totals, inn = this.initialVolume + T.rain + T.inflow;
    return inn > 0 ? (inn - T.infiltration - T.outflow - T.sea - v * this.area) / inn : 0;
  }
  destroy() { for (const b of Object.values(this.bufs)) b.destroy(); this.dev.destroy(); }
}
