// Flood depth on the map as a WebGL custom layer. The model gives one depth per 30 m (or coarser) cell. On screen every pixel
// takes the water surface (terrain + depth) interpolated bilinearly from the wet cells around it and subtracts the land surface
// there (landGround in pack.ts, interpolated bilinearly: a river, canal or drain cell takes the level of its banks, ADR 0018):
// water inside a channel up to its banks is the river and is not drawn, water above the banks is, so rivers no longer show as a
// staircase of 30 m squares, and water edges follow the ground smoothly. No water is invented where all surrounding cells are
// dry. This is the water-surface downscaling used for SFINCS output (Leijnse et al. 2021; HydroMT-SFINCS downscale_floodmap),
// done here on the model's own terrain grid. Fine cells (10-1 m) use the same rule and leave building footprints dry, so the
// same flood looks the same at every cell size. Colours: depth classes of BLUEPRINT §8.
import { MercatorCoordinate, type CustomLayerInterface, type CustomRenderMethodInput, type Map as MlMap } from "maplibre-gl";
import { fromUtm } from "../util";
import { bilinearAt, landGround, type FineGrid } from "../engine/pack";

export const CLASSES = [0.05, 0.15, 0.5, 1.0, 2.0]; // m, lower bounds
export const CLASS_COLORS = ["#c6dbef", "#9ecae1", "#4292c6", "#2166ac", "#0b3d7a", "#08214a"]; // below first = transparent
export type FloodGeom = { nx: number; ny: number; dx: number; zone: number; x0: number; y0: number; z: Float32Array; mask: Uint8Array; channel?: Uint8Array; fine?: FineGrid }; // mask 1 = draw
// fine (10-1 m cells): the water surface of the compute cells minus the land surface (landGround, bilinear, the same at every
// cell size), no water on building footprints (drawn near 2 m, fine.draw). Only the compute-cell depth changes per frame.

const VS = `#version 300 es
in vec2 a_pos; in vec2 a_uv; uniform mat4 u_m; out vec2 v_uv;
void main() { v_uv = a_uv; gl_Position = u_m * vec4(a_pos, 0.0, 1.0); }`;
const FS = `#version 300 es
precision highp float; precision highp sampler2D;
in vec2 v_uv; uniform sampler2D u_d; uniform sampler2D u_z; uniform vec2 u_n; uniform float u_min; uniform vec4 u_c[6]; uniform float u_k[5]; uniform float u_a;
uniform int u_fine; uniform sampler2D u_b; uniform sampler2D u_g;
out vec4 o;
// land surface at x (in cells of t, from the NW corner): plain bilinear of channel ch of t (landGround), clamped at the edges
float groundAt(sampler2D t, int ch, vec2 x) {
  ivec2 nb = textureSize(t, 0);
  vec2 u = clamp(x - 0.5, vec2(0.0), vec2(nb - 1));
  ivec2 a = min(ivec2(floor(u)), max(nb - 2, ivec2(0))); vec2 f = clamp(u - vec2(a), 0.0, 1.0);
  ivec2 b = min(a + 1, nb - 1);
  float z00 = texelFetch(t, a, 0)[ch], z10 = texelFetch(t, ivec2(b.x, a.y), 0)[ch], z01 = texelFetch(t, ivec2(a.x, b.y), 0)[ch], z11 = texelFetch(t, b, 0)[ch];
  return mix(mix(z00, z10, f.x), mix(z01, z11, f.x), f.y);
}
void main() {
  vec2 p = v_uv * u_n - 0.5; vec2 f = fract(p); ivec2 b = ivec2(floor(p));
  float ws = 0.0, wt = 0.0;
  for (int k = 0; k < 4; k++) {
    ivec2 q = clamp(b + ivec2(k & 1, k >> 1), ivec2(0), ivec2(u_n) - 1);
    float w = ((k & 1) == 1 ? f.x : 1.0 - f.x) * ((k >> 1) == 1 ? f.y : 1.0 - f.y);
    float d = texelFetch(u_d, q, 0).r; float z = texelFetch(u_z, q, 0).r;
    if (d > u_min) { ws += w * (z + d); wt += w; }
  }
  if (wt < 1e-4) discard;
  float h;
  if (u_fine == 1) {
    ivec2 nb = textureSize(u_b, 0);
    if (texelFetch(u_b, clamp(ivec2(floor(v_uv * vec2(nb))), ivec2(0), nb - 1), 0).r > 0.5) discard;
    h = ws / wt - groundAt(u_g, 0, v_uv * vec2(textureSize(u_g, 0)));
  } else h = ws / wt - groundAt(u_z, 1, v_uv * u_n);
  if (h < u_k[0]) discard;
  int c = 0;
  for (int k = 1; k < 5; k++) if (h >= u_k[k]) c = k;
  o = vec4(u_c[c].rgb * u_a, u_a);
}`;

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

export class FloodLayer implements CustomLayerInterface {
  readonly id = "flood";
  readonly type = "custom" as const;
  readonly renderingMode = "2d" as const;
  private prog: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private tex: { d: WebGLTexture | null; z: WebGLTexture | null; b: WebGLTexture | null; g: WebGLTexture | null } = { d: null, z: null, b: null, g: null };
  private count = 0;
  private pending: Float32Array | null = null;
  opacity = 0.85;
  private map: MlMap | null = null;
  constructor(private g: FloodGeom) {}

  /** Depth per cell (row 0 = north), cells outside the mask are hidden. null clears. */
  setDepth(d: Float32Array | null) {
    if (d) { const m = this.g.mask; const c = new Float32Array(d.length); for (let i = 0; i < d.length; i++) c[i] = m[i] ? d[i] : 0; this.pending = c; }
    else this.pending = new Float32Array(this.g.nx * this.g.ny);
    this.map?.triggerRepaint();
  }

  onAdd(map: MlMap, gl: WebGL2RenderingContext) {
    this.map = map;
    const sh = (t: number, s: string) => { const o = gl.createShader(t)!; gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o) ?? "shader"); return o; };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
    this.prog = p;
    // 32 x 32 mesh: vertex positions are the exact Web Mercator positions of UTM grid points, so the UTM grid lands where it belongs
    const { nx, ny, dx, zone, x0, y0 } = this.g, M = 32, pos: number[] = [], idx: number[] = [];
    for (let j = 0; j <= M; j++) for (let i = 0; i <= M; i++) {
      const u = i / M, v = j / M, ll = fromUtm(x0 + u * nx * dx, y0 - v * ny * dx, zone, true);
      const m = MercatorCoordinate.fromLngLat([ll.lon, ll.lat]);
      pos.push(m.x, m.y, u, v);
    }
    for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) { const a = j * (M + 1) + i; idx.push(a, a + 1, a + M + 1, a + 1, a + M + 2, a + M + 1); }
    this.count = idx.length;
    this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW);
    const ap = gl.getAttribLocation(p, "a_pos"), au = gl.getAttribLocation(p, "a_uv");
    gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(au); gl.vertexAttribPointer(au, 2, gl.FLOAT, false, 16, 8);
    gl.bindVertexArray(null);
    const mk = (data: ArrayBufferView, w = nx, h = ny, fmt: "r32f" | "rg32f" | "r8" = "r32f") => {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      if (fmt === "r8") gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, w, h, 0, gl.RED, gl.UNSIGNED_BYTE, data);
      else if (fmt === "rg32f") gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, w, h, 0, gl.RG, gl.FLOAT, data);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, w, h, 0, gl.RED, gl.FLOAT, data);
      return t;
    };
    // model ground (for the water surface) and the land surface (channels at bank level) of the run grid
    const zc = new Float32Array(nx * ny * 2), lg = landGround(nx, ny, this.g.z, this.g.channel ?? new Uint8Array(nx * ny));
    for (let c = 0; c < nx * ny; c++) { zc[2 * c] = this.g.z[c]; zc[2 * c + 1] = lg[c]; }
    this.tex.z = mk(zc, nx, ny, "rg32f");
    this.tex.d = mk(this.pending ?? new Float32Array(nx * ny));
    const fg = this.g.fine;
    if (fg) {
      // buildings (fine cells, 0/255) and the land surface of the 30 m cells; uploaded once
      const bd = fg.draw ?? fg;
      this.tex.b = mk(Uint8Array.from(bd.building, (v) => v * 255), bd.nx, bd.ny, "r8");
      this.tex.g = mk(landGround(fg.base.nx, fg.base.ny, fg.base.z, fg.base.channel), fg.base.nx, fg.base.ny);
    } else { this.tex.b = mk(new Uint8Array(1), 1, 1, "r8"); this.tex.g = mk(new Float32Array(1), 1, 1); }
    this.pending = null;
  }

  render(gl: WebGL2RenderingContext, args: CustomRenderMethodInput) {
    if (!this.prog || !this.vao) return;
    const { nx, ny } = this.g;
    if (this.pending) {
      gl.bindTexture(gl.TEXTURE_2D, this.tex.d);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, nx, ny, gl.RED, gl.FLOAT, this.pending);
      this.pending = null;
    }
    const p = this.prog;
    gl.useProgram(p);
    gl.uniformMatrix4fv(gl.getUniformLocation(p, "u_m"), false, args.defaultProjectionData.mainMatrix as Float32Array);
    gl.uniform2f(gl.getUniformLocation(p, "u_n"), nx, ny);
    gl.uniform1f(gl.getUniformLocation(p, "u_min"), 0.01);
    gl.uniform1f(gl.getUniformLocation(p, "u_a"), this.opacity);
    gl.uniform1fv(gl.getUniformLocation(p, "u_k"), CLASSES);
    gl.uniform4fv(gl.getUniformLocation(p, "u_c"), CLASS_COLORS.flatMap((c) => [...hex(c), 1]));
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex.d); gl.uniform1i(gl.getUniformLocation(p, "u_d"), 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tex.z); gl.uniform1i(gl.getUniformLocation(p, "u_z"), 1);
    const fg = this.g.fine;
    gl.uniform1i(gl.getUniformLocation(p, "u_fine"), fg ? 1 : 0);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.tex.b); gl.uniform1i(gl.getUniformLocation(p, "u_b"), 2);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.tex.g); gl.uniform1i(gl.getUniformLocation(p, "u_g"), 3);
    gl.activeTexture(gl.TEXTURE0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(this.vao);
    gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
  }

  onRemove(_m: MlMap, gl: WebGL2RenderingContext) {
    if (this.tex.d) gl.deleteTexture(this.tex.d);
    for (const t of [this.tex.z, this.tex.b, this.tex.g]) if (t) gl.deleteTexture(t);
    if (this.prog) gl.deleteProgram(this.prog);
    this.map = null;
  }
}

/** The same depth rule on the CPU at any resolution (for PNG/GeoTIFF/HTML exports): returns depth per output pixel. */
export function downscale(g: { nx: number; ny: number; channel?: Uint8Array }, z: Float32Array, d: Float32Array, mask: Uint8Array, f: number): Float32Array {
  const W = g.nx * f, H = g.ny * f, out = new Float32Array(W * H);
  const lg = landGround(g.nx, g.ny, z, g.channel ?? new Uint8Array(g.nx * g.ny));
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
    const px = (X + 0.5) / f - 0.5, py = (Y + 0.5) / f - 0.5;
    const bx = Math.floor(px), by = Math.floor(py), fx = px - bx, fy = py - by;
    let ws = 0, wt = 0;
    for (let k = 0; k < 4; k++) {
      const i = Math.min(g.nx - 1, Math.max(0, bx + (k & 1))), j = Math.min(g.ny - 1, Math.max(0, by + (k >> 1)));
      const w = (k & 1 ? fx : 1 - fx) * (k >> 1 ? fy : 1 - fy), c = j * g.nx + i;
      const dd = mask[c] ? d[c] : 0;
      if (dd > 0.01) { ws += w * (z[c] + dd); wt += w; }
    }
    out[Y * W + X] = wt < 1e-4 ? 0 : Math.max(0, ws / wt - bilinearAt(g.nx, g.ny, lg, (X + 0.5) / f, (Y + 0.5) / f));
  }
  return out;
}

/** Dual-grid result on its fine cells (CPU version of the map shader, for exports): ground, depth and draw mask per fine cell. */
export function fineResult(g: FloodGeom, d: Float32Array): { grid: FloodGeom; depth: Float32Array } {
  const fg = g.fine!, W = fg.nx, H = fg.ny, s = fg.s, z = new Float32Array(W * H), depth = new Float32Array(W * H), mask = new Uint8Array(W * H);
  const lg = landGround(fg.base.nx, fg.base.ny, fg.base.z, fg.base.channel);
  for (let J = 0; J < H; J++) {
    const py = (J + 0.5) / s - 0.5, by = Math.floor(py), fy = py - by;
    for (let I = 0; I < W; I++) {
      const F = J * W + I, zf = bilinearAt(fg.base.nx, fg.base.ny, lg, (I + 0.5) / fg.r, (J + 0.5) / fg.r);
      z[F] = zf;
      const own = Math.floor(J / s) * g.nx + Math.floor(I / s);
      if (fg.building[F] || !g.mask[own]) continue;
      mask[F] = 1;
      const px = (I + 0.5) / s - 0.5, bx = Math.floor(px), fx = px - bx;
      let ws = 0, wt = 0;
      for (let k = 0; k < 4; k++) {
        const i = Math.min(g.nx - 1, Math.max(0, bx + (k & 1))), j = Math.min(g.ny - 1, Math.max(0, by + (k >> 1))), c = j * g.nx + i;
        const w = (k & 1 ? fx : 1 - fx) * (k >> 1 ? fy : 1 - fy), dd = g.mask[c] ? d[c] : 0;
        if (dd > 0.01) { ws += w * (g.z[c] + dd); wt += w; }
      }
      if (wt >= 1e-4) depth[F] = Math.max(0, ws / wt - zf);
    }
  }
  return { grid: { nx: W, ny: H, dx: fg.dx, zone: g.zone, x0: g.x0, y0: g.y0, z, mask }, depth };
}
