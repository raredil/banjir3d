// Flood engine v2, CPU reference. 2D local-inertial shallow-water scheme (Bates et al. 2010; theta = 1 as SFINCS and LISFLOOD-FP ACC)
// on a masked grid, with per-cell Manning n, rain turned into runoff per cell with the NRCS curve number, upstream river
// inflow at points, a fixed sea level on sea cells and transmissive (zero-gradient) outflow wherever the run area ends.
// Optional: building porosity for fine runs on a coarser compute grid (see EngineGrid.phi), rain that differs between zones (observed events) and a drainage sink (city drains, calibrated on observed floods).
// The WebGPU solver (gpu.ts) implements exactly these steps in float32; tests compare the two (verification/gpu-parity).

export const G = 9.81;

export type EngineGrid = {
  nx: number; ny: number; dx: number;
  z: Float64Array; // bed elevation (m)
  n: Float64Array; // Manning n per cell (s m^-1/3)
  active: Uint8Array; // 1 = simulated, 0 = outside the run area (water that reaches it leaves the model)
  cn?: Float64Array; // NRCS curve number per cell (no infiltration if absent)
  sea?: Uint8Array; // 1 = sea cell, held at the sea level
  zone?: Uint16Array; // rain zone per cell (rates set per zone in FloodEngine.rates); absent = one rate everywhere
  drain?: Float64Array; // drainage capacity per cell (m/s): surface water up to this rate leaves through the city drains
  h0?: Float64Array; // initial depth (m): base flow in carved channels up to the water surface the DEM recorded
  // Building porosity (dual-grid fine runs, Sanders et al. 2008; Sanders and Schubert 2019): share of the cell that is open
  // ground (stores water), open share of the east / south face (conveys water) and the cell area whose rain reaches this
  // cell's open ground (roof runoff of nearly closed cells is handed to open neighbours), all in units of the cell (1 = no buildings)
  phi?: ArrayLike<number>; psiX?: ArrayLike<number>; psiY?: ArrayLike<number>; rainW?: ArrayLike<number>;
};
// hMin: depth below which a face carries no flow; 0.001 m is the LISFLOOD-FP default, so thin runoff sheets still drain
export type EngineOptions = { alpha?: number; dtMax?: number; hMin?: number; seaLevel?: number; inflowCells?: number[] };
export type EngineTotals = { rain: number; infiltration: number; inflow: number; outflow: number; sea: number; drain: number }; // m3

/** NRCS curve-number direct runoff (mm) for cumulative rain p (mm), retention s (mm), initial abstraction 0.2 s. */
export const scsRunoff = (p: number, s: number) => (p > 0.2 * s ? ((p - 0.2 * s) * (p - 0.2 * s)) / (p + 0.8 * s) : 0);
/** Potential retention S (mm) from a curve number. */
export const retention = (cn: number) => (cn >= 100 ? 0 : 25400 / cn - 254);

export class FloodEngine {
  readonly g: EngineGrid;
  h: Float64Array; // depth on the open ground of the cell (m)
  hMax: Float64Array;
  private qx: Float64Array; // east face of each cell (m2/s per metre of open face, + east)
  private qy: Float64Array; // south face of each cell (+ south)
  private qxN: Float64Array;
  private qyN: Float64Array;
  private bnd: Float64Array; // transmissive outflow per cell, summed over its open sides (m3/s)
  private scale: Float64Array;
  private readonly s: Float64Array | null; // retention per cell (mm)
  private readonly open: [Uint8Array, Uint8Array, Uint8Array, Uint8Array]; // N, S, W, E side of the cell is open
  private readonly phi: Float64Array; // open (storage) share per cell, at least PHI_MIN
  private readonly px: Float64Array; // open share of the east face (0 when the face does not connect two active cells)
  private readonly py: Float64Array; // open share of the south face
  private readonly rw: Float64Array; // rain-collecting area per cell (cell areas)
  private readonly cfl: Uint8Array; // 1 = the cell can exchange water with a neighbour (cells sealed by buildings do not limit the time step)
  readonly porous: boolean;
  t = 0;
  rainMm = 0; // cumulative gross rain (mm) since t = 0
  rate = 0; // current rain rate (mm/h), set by the caller
  rates: number[] = []; // current rain rate per zone (mm/h) when the grid has zones
  private zMm: Float64Array; // cumulative rain per zone (mm)
  private z0: Float64Array;
  inflows: number[] = []; // current discharge (m3/s) of each inflow cell, set by the caller
  readonly totals: EngineTotals = { rain: 0, infiltration: 0, inflow: 0, outflow: 0, sea: 0, drain: 0 };
  readonly alpha: number;
  readonly dtMax: number;
  readonly hMin: number;
  readonly seaLevel: number;
  readonly inflowCells: number[];
  private depthMax = 0;
  private readonly area: number;

  constructor(g: EngineGrid, o: EngineOptions = {}) {
    this.g = g;
    const N = g.nx * g.ny;
    this.h = new Float64Array(N); this.hMax = new Float64Array(N);
    this.qx = new Float64Array(N); this.qy = new Float64Array(N); this.qxN = new Float64Array(N); this.qyN = new Float64Array(N);
    this.bnd = new Float64Array(N); this.scale = new Float64Array(N);
    this.alpha = o.alpha ?? 0.5; this.dtMax = o.dtMax ?? 15; this.hMin = o.hMin ?? 0.001; this.seaLevel = o.seaLevel ?? 0;
    this.inflowCells = o.inflowCells ?? [];
    this.area = g.dx * g.dx;
    this.s = g.cn ? Float64Array.from(g.cn, retention) : null;
    let nz = 0;
    if (g.zone) for (let c = 0; c < N; c++) nz = Math.max(nz, g.zone[c] + 1);
    this.zMm = new Float64Array(nz); this.z0 = new Float64Array(nz);
    const { nx, ny, active } = g;
    const isOpen = (i: number, j: number) => i < 0 || j < 0 || i >= nx || j >= ny || !active[j * nx + i];
    this.open = [new Uint8Array(N), new Uint8Array(N), new Uint8Array(N), new Uint8Array(N)];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const c = j * nx + i;
      if (!active[c]) continue;
      this.open[0][c] = +isOpen(i, j - 1); this.open[1][c] = +isOpen(i, j + 1);
      this.open[2][c] = +isOpen(i - 1, j); this.open[3][c] = +isOpen(i + 1, j);
    }
    const por = porosityArrays(g);
    this.phi = por.phi; this.px = por.px; this.py = por.py; this.rw = por.rw; this.cfl = por.cfl; this.porous = !!g.phi;
    if (g.sea) for (let c = 0; c < N; c++) if (g.sea[c] && active[c]) this.h[c] = Math.max(0, this.seaLevel - g.z[c]);
    if (g.h0) for (let c = 0; c < N; c++) if (active[c] && !g.sea?.[c]) this.h[c] = Math.max(this.h[c], g.h0[c]);
    this.initial = this.volume();
    for (let c = 0; c < N; c++) if (this.cfl[c] && this.h[c] > this.depthMax) this.depthMax = this.h[c];
  }
  private readonly initial: number;

  volume(): number {
    let v = 0;
    for (let c = 0; c < this.h.length; c++) if (this.g.active[c]) v += this.h[c] * this.phi[c];
    return v * this.area;
  }
  /** (initial + rain + inflow - infiltration - outflow - sea - drain - stored) / (initial + rain + inflow). */
  massError(): number {
    const T = this.totals, inn = this.initial + T.rain + T.inflow;
    return inn > 0 ? (inn - T.infiltration - T.outflow - T.sea - T.drain - this.volume()) / inn : 0;
  }
  dtNow(): number {
    return this.depthMax <= this.hMin ? this.dtMax : Math.min(this.dtMax, (this.alpha * this.g.dx) / Math.sqrt(G * this.depthMax));
  }

  step(): number {
    const { nx, ny, dx, z, n, active, sea, zone, drain } = this.g;
    const { h, qx, qy, qxN, qyN, bnd, scale, hMin, phi, px, py, rw, cfl } = this;
    const dt = this.dtNow(), A = this.area, gdt = G * dt, gdtDx = gdt / dx;
    const N = nx * ny;
    // 1. face fluxes per metre of open face (both cells active), momentum equation of Bates et al. (2010) with semi-implicit
    //    friction; written out inline (no helper call per face) because this loop dominates the run time
    for (let j = 0; j < ny; j++) {
      const row = j * nx, lastRow = j === ny - 1;
      for (let i = 0; i < nx; i++) {
        const c = row + i;
        qxN[c] = 0; qyN[c] = 0;
        if (!active[c]) continue;
        const zc = z[c], hc = h[c], etaC = zc + hc;
        if (i < nx - 1 && px[c] > 0) {
          const r = c + 1, zr = z[r], etaR = zr + h[r];
          const hf = (etaC > etaR ? etaC : etaR) - (zc > zr ? zc : zr);
          if (hf > hMin) {
            let qt = qy[c] + qy[r];
            if (j > 0) qt += qy[c - nx] + qy[r - nx];
            qt *= 0.25;
            const q0 = qx[c], nn = 0.5 * (n[c] + n[r]);
            const q = (q0 - hf * gdtDx * (etaR - etaC)) / (1 + (gdt * nn * nn * Math.sqrt(q0 * q0 + qt * qt)) / (hf * hf * Math.cbrt(hf)));
            const qm = hf * Math.sqrt(G * hf);
            qxN[c] = q > qm ? qm : q < -qm ? -qm : q;
          }
        }
        if (!lastRow && py[c] > 0) {
          const r = c + nx, zr = z[r], etaR = zr + h[r];
          const hf = (etaC > etaR ? etaC : etaR) - (zc > zr ? zc : zr);
          if (hf > hMin) {
            let qt = qx[c] + qx[r];
            if (i > 0) qt += qx[c - 1] + qx[r - 1];
            qt *= 0.25;
            const q0 = qy[c], nn = 0.5 * (n[c] + n[r]);
            const q = (q0 - hf * gdtDx * (etaR - etaC)) / (1 + (gdt * nn * nn * Math.sqrt(q0 * q0 + qt * qt)) / (hf * hf * Math.cbrt(hf)));
            const qm = hf * Math.sqrt(G * hf);
            qyN[c] = q > qm ? qm : q < -qm ? -qm : q;
          }
        }
      }
    }
    // 2. transmissive outflow on open sides: the discharge arriving at the opposite face if it points outward, capped at
    //    critical flow; 3. limiter: no cell gives away more water than it holds (open-face shares turn unit fluxes into volumes)
    const [oN, oS, oW, oE] = this.open;
    for (let c = 0; c < N; c++) {
      bnd[c] = 0; scale[c] = 1;
      if (!active[c]) continue;
      const hc = h[c];
      let b = 0;
      if (hc > hMin && (oN[c] | oS[c] | oW[c] | oE[c])) {
        const qc = hc * Math.sqrt(G * hc);
        if (oE[c] && !oW[c]) b += Math.min(qc, Math.max(0, qxN[c - 1]));
        if (oW[c] && !oE[c]) b += Math.min(qc, Math.max(0, -qxN[c]));
        if (oS[c] && !oN[c]) b += Math.min(qc, Math.max(0, qyN[c - nx]));
        if (oN[c] && !oS[c]) b += Math.min(qc, Math.max(0, -qyN[c]));
        b *= dx * phi[c];
        bnd[c] = b;
      }
      let o = b;
      if (qxN[c] > 0) o += qxN[c] * px[c] * dx;
      if (c % nx > 0 && qxN[c - 1] < 0) o -= qxN[c - 1] * px[c - 1] * dx;
      if (qyN[c] > 0) o += qyN[c] * py[c] * dx;
      if (c >= nx && qyN[c - nx] < 0) o -= qyN[c - nx] * py[c - nx] * dx;
      const v = o * dt, vol = hc * phi[c] * A;
      if (v > vol && v > 0) scale[c] = vol / v;
    }
    for (let c = 0; c < N; c++) {
      if (qxN[c] > 0) qxN[c] *= scale[c]; else if (qxN[c] < 0) qxN[c] *= scale[c + 1];
      if (qyN[c] > 0) qyN[c] *= scale[c]; else if (qyN[c] < 0) qyN[c] *= scale[c + nx];
      bnd[c] *= scale[c];
    }
    // 4. depth update with runoff (curve number), drains, inflow and the sea level
    const P0 = this.rainMm, P1 = P0 + (this.rate * dt) / 3600;
    const z0 = this.z0, zm = this.zMm;
    for (let k = 0; k < zm.length; k++) { z0[k] = zm[k]; zm[k] += ((this.rates[k] ?? 0) * dt) / 3600; }
    const sRet = this.s, raining = zone ? true : P1 > P0;
    let hm = 0, out = 0, rainV = 0, effV = 0, seaV = 0, drV = 0;
    for (let j = 0; j < ny; j++) for (let i = 0, c = j * nx; i < nx; i++, c++) {
      if (!active[c]) continue;
      let div = -qxN[c] * px[c] - qyN[c] * py[c];
      if (i > 0) div += qxN[c - 1] * px[c - 1];
      if (j > 0) div += qyN[c - nx] * py[c - nx];
      const ph = phi[c];
      let hn = h[c] + (dt * div) / (dx * ph) - (bnd[c] * dt) / (A * ph);
      if (raining) {
        const p0 = zone ? z0[zone[c]] : P0, p1 = zone ? zm[zone[c]] : P1;
        if (p1 > p0) {
          const w = rw[c], gross = ((p1 - p0) / 1000) * w;
          const eff = sRet ? ((scsRunoff(p1, sRet[c]) - scsRunoff(p0, sRet[c])) / 1000) * w : gross;
          hn += eff / ph; rainV += gross; effV += eff;
        }
      }
      if (hn < 0) hn = 0;
      if (drain && drain[c] > 0) { const d = Math.min(hn, drain[c] * dt); hn -= d; drV += d * ph; }
      out += bnd[c] * dt;
      if (sea && sea[c]) { const fix = Math.max(0, this.seaLevel - z[c]); seaV += (hn - fix) * ph; hn = fix; }
      h[c] = hn;
      if (hn > this.hMax[c]) this.hMax[c] = hn;
      if (hn > hm && cfl[c]) hm = hn;
    }
    let inV = 0;
    for (let k = 0; k < this.inflowCells.length; k++) {
      const c = this.inflowCells[k], v = (this.inflows[k] ?? 0) * dt;
      if (v <= 0 || !active[c]) continue;
      h[c] += v / (A * phi[c]); inV += v;
      if (h[c] > this.hMax[c]) this.hMax[c] = h[c];
      if (h[c] > hm && cfl[c]) hm = h[c];
    }
    this.totals.rain += rainV * A; this.totals.infiltration += (rainV - effV) * A;
    this.totals.inflow += inV; this.totals.outflow += out; this.totals.sea += seaV * A; this.totals.drain += drV * A;
    this.rainMm = P1;
    this.depthMax = hm;
    this.qx = qxN; this.qxN = qx; this.qy = qyN; this.qyN = qy;
    this.t += dt;
    return dt;
  }
}

export const PHI_MIN = 0.02; // storage share floor: a cell almost covered by roofs still stores a little water (no division by zero)

/** Porosity per cell for the engines (CPU and GPU): storage share, face shares (0 where a face does not join two active
 *  cells), rain-collecting area and whether the cell takes part in the time-step limit. Without porosity: all ones. */
export function porosityArrays(g: EngineGrid) {
  const { nx, ny, active } = g, N = nx * ny;
  const phi = new Float64Array(N), px = new Float64Array(N), py = new Float64Array(N), rw = new Float64Array(N), cfl = new Uint8Array(N);
  for (let c = 0; c < N; c++) {
    phi[c] = g.phi ? Math.max(PHI_MIN, Math.min(1, g.phi[c])) : 1;
    rw[c] = g.rainW ? g.rainW[c] : 1;
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = j * nx + i;
    if (!active[c]) continue;
    // a face never conveys more than the open share of either cell it joins (keeps the explicit update stable: the flux into
    // a cell is divided by its storage share)
    if (i < nx - 1 && active[c + 1]) px[c] = Math.min(g.psiX ? g.psiX[c] : 1, phi[c], phi[c + 1]);
    if (j < ny - 1 && active[c + nx]) py[c] = Math.min(g.psiY ? g.psiY[c] : 1, phi[c], phi[c + nx]);
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = j * nx + i;
    if (!active[c]) continue;
    const anyFace = px[c] > 0 || py[c] > 0 || (i > 0 && px[c - 1] > 0) || (j > 0 && py[c - nx] > 0) || i === 0 || j === 0 || i === nx - 1 || j === ny - 1
      || !active[c - 1] || !active[c + 1] || !active[c - nx] || !active[c + nx];
    cfl[c] = +anyFace;
  }
  return { phi, px, py, rw, cfl };
}
