// Explore engine v0: 2D local-inertial shallow-water solver (Bates et al. 2010, the LISFLOOD-FP "ACC" equations).
// Pure TypeScript on typed arrays so it runs in a Web Worker, in Node tests, and later as the reference for a WebGPU port.
// Theta weighting after de Almeida et al. (2012). Checked against SFINCS on the sample and against the Hunter et al. (2005) analytical
// wave (verification/). Exploratory only: not validated against observed floods (BLUEPRINT 4.1). Do not use for quantitative claims.

export const G = 9.81;

export type Edge = "n" | "s" | "e" | "w";
export type Grid = { nx: number; ny: number; dx: number; dy: number; z: Float64Array };

export type SolverOptions = {
  manning?: number; // n, s m^-1/3 (uniform, used when no field is given)
  manningField?: Float64Array; // n per cell; the face value is the mean of its two cells (as in SFINCS)
  theta?: number; // flux averaging weight (de Almeida et al. 2012 suggest 0.7 for low friction); SFINCS default 1.0 = no smoothing, as Bates et al. (2010)
  alpha?: number; // CFL factor; SFINCS default 0.5
  dtMax?: number; // s
  hMin?: number; // m, wet/dry threshold; SFINCS 'huthresh' default 0.05
  openEdges?: Edge[]; // edges where water may leave (transmissive, zero-gradient flux); the others are walls
  inflowCells?: number[]; // cell indices that receive the river inflow
};

export type Totals = { rain: number; drain: number; inflow: number; outflow: number }; // m3

export class LocalInertial {
  readonly nx: number;
  readonly ny: number;
  readonly dx: number;
  readonly dy: number;
  readonly z: Float64Array;
  h: Float64Array;
  private qx: Float64Array; // flux per unit width across the east face of cell (i,j), + = east
  private qy: Float64Array; // across the south face of cell (i,j), + = south (increasing j)
  private qxN: Float64Array;
  private qyN: Float64Array;
  private qe: Record<Edge, Float64Array>; // outward flux per unit width through each open edge (m2/s)
  private out: Float64Array;
  t = 0;
  rain = 0; // m/s
  drain = 0; // m/s
  inflow = 0; // m3/s in total
  readonly totals: Totals = { rain: 0, drain: 0, inflow: 0, outflow: 0 };
  readonly manning: number;
  readonly manningField: Float64Array | null;
  readonly theta: number;
  readonly alpha: number;
  readonly dtMax: number;
  readonly hMin: number;
  readonly openEdges: Edge[];
  readonly inflowCells: number[];
  private hMaxNow = 0;
  private readonly initialVolume: number;

  constructor(grid: Grid, o: SolverOptions = {}, h0?: Float64Array) {
    this.nx = grid.nx; this.ny = grid.ny; this.dx = grid.dx; this.dy = grid.dy; this.z = grid.z;
    const n = grid.nx * grid.ny;
    this.h = h0 ? Float64Array.from(h0) : new Float64Array(n);
    this.qx = new Float64Array(n); this.qy = new Float64Array(n);
    this.qxN = new Float64Array(n); this.qyN = new Float64Array(n);
    this.qe = { n: new Float64Array(grid.nx), s: new Float64Array(grid.nx), w: new Float64Array(grid.ny), e: new Float64Array(grid.ny) };
    this.out = new Float64Array(n);
    // Defaults follow SFINCS (theta 1.0, alpha 0.5, huthresh 0.05 m): with these the solver reproduces SFINCS on the sample, see verification/explore-vs-sfincs.
    this.manning = o.manning ?? 0.05; this.theta = o.theta ?? 1.0; this.alpha = o.alpha ?? 0.5;
    this.dtMax = o.dtMax ?? 15; this.hMin = o.hMin ?? 0.05;
    this.openEdges = o.openEdges ?? [];
    this.inflowCells = o.inflowCells ?? [];
    this.manningField = o.manningField ?? null;
    this.initialVolume = this.volume();
    for (let c = 0; c < n; c++) if (this.h[c] > this.hMaxNow) this.hMaxNow = this.h[c];
  }

  /** Water volume stored in the domain (m3). */
  volume(): number {
    let s = 0;
    for (let c = 0; c < this.h.length; c++) s += this.h[c];
    return s * this.dx * this.dy;
  }

  /** (initial + in - out - stored) / total in, a relative mass error. */
  massError(): number {
    const inn = this.initialVolume + this.totals.rain + this.totals.inflow;
    const outv = this.totals.outflow + this.totals.drain + this.volume();
    return inn > 0 ? (inn - outv) / inn : 0;
  }

  /** CFL time step from the deepest water. */
  dtNow(): number {
    if (this.hMaxNow <= this.hMin) return this.dtMax;
    return Math.min(this.dtMax, (this.alpha * Math.min(this.dx, this.dy)) / Math.sqrt(G * this.hMaxNow));
  }

  /** Advance one step, return its length (s). */
  step(): number {
    const { nx, ny, dx, dy, z, h, qx, qy, qxN, qyN, qe, out } = this;
    const dt = this.dtNow();
    const nField = this.manningField;
    const n2u = this.manning * this.manning;
    const th = this.theta, hMin = this.hMin;

    // 1. new fluxes from old fluxes and old depths
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const c = j * nx + i, r = c + 1;
        const etaL = z[c] + h[c], etaR = z[r] + h[r];
        const hf = Math.max(etaL, etaR) - Math.max(z[c], z[r]);
        if (hf <= hMin) { qxN[c] = 0; continue; }
        const qL = i > 0 ? qx[c - 1] : 0, qR = i < nx - 2 ? qx[c + 1] : 0;
        let qt = 0;
        if (j > 0) qt += qy[c - nx] + qy[r - nx];
        if (j < ny - 1) qt += qy[c] + qy[r];
        qt *= 0.25;
        const q0 = qx[c];
        const num = th * q0 + 0.5 * (1 - th) * (qL + qR) - (G * hf * dt * (etaR - etaL)) / dx;
        const nn = nField ? 0.5 * (nField[c] + nField[r]) : 0, n2 = nField ? nn * nn : n2u;
        const den = 1 + (G * dt * n2 * Math.sqrt(q0 * q0 + qt * qt)) / (hf * hf * Math.cbrt(hf));
        let q = num / den;
        const qmax = hf * Math.sqrt(G * hf);
        if (q > qmax) q = qmax; else if (q < -qmax) q = -qmax;
        qxN[c] = q;
      }
      qxN[j * nx + nx - 1] = 0;
    }
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx; i++) {
        const c = j * nx + i, r = c + nx;
        const etaL = z[c] + h[c], etaR = z[r] + h[r];
        const hf = Math.max(etaL, etaR) - Math.max(z[c], z[r]);
        if (hf <= hMin) { qyN[c] = 0; continue; }
        const qL = j > 0 ? qy[c - nx] : 0, qR = j < ny - 2 ? qy[c + nx] : 0;
        let qt = 0;
        if (i > 0) qt += qx[c - 1] + qx[r - 1];
        if (i < nx - 1) qt += qx[c] + qx[r];
        qt *= 0.25;
        const q0 = qy[c];
        const num = th * q0 + 0.5 * (1 - th) * (qL + qR) - (G * hf * dt * (etaR - etaL)) / dy;
        const nn = nField ? 0.5 * (nField[c] + nField[r]) : 0, n2 = nField ? nn * nn : n2u;
        const den = 1 + (G * dt * n2 * Math.sqrt(q0 * q0 + qt * qt)) / (hf * hf * Math.cbrt(hf));
        let q = num / den;
        const qmax = hf * Math.sqrt(G * hf);
        if (q > qmax) q = qmax; else if (q < -qmax) q = -qmax;
        qyN[c] = q;
      }
    }
    for (let i = 0; i < nx; i++) qyN[(ny - 1) * nx + i] = 0;
    // Open edges: transmissive (zero-gradient) condition, the outward discharge equals the discharge across the adjacent
    // interior face when that one points outward (no water enters from outside), capped at critical flow of the edge cell.
    const open = this.openEdges;
    for (const k of ["n", "s", "w", "e"] as Edge[]) qe[k].fill(0);
    const cap = (q: number, c: number) => (q > 0 && h[c] > hMin ? Math.min(q, h[c] * Math.sqrt(G * h[c])) : 0);
    if (ny > 1) {
      if (open.includes("n")) for (let i = 0; i < nx; i++) qe.n[i] = cap(-qyN[i], i);
      if (open.includes("s")) for (let i = 0; i < nx; i++) qe.s[i] = cap(qyN[(ny - 2) * nx + i], (ny - 1) * nx + i);
    }
    if (nx > 1) {
      if (open.includes("w")) for (let j = 0; j < ny; j++) qe.w[j] = cap(-qxN[j * nx], j * nx);
      if (open.includes("e")) for (let j = 0; j < ny; j++) qe.e[j] = cap(qxN[j * nx + nx - 2], j * nx + nx - 1);
    }

    // 2. limiter: a cell cannot give away more water than it holds
    out.fill(0);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const c = j * nx + i, q = qxN[c];
        if (q > 0) out[c] += q / dx; else if (q < 0) out[c + 1] -= q / dx;
      }
    }
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx; i++) {
        const c = j * nx + i, q = qyN[c];
        if (q > 0) out[c] += q / dy; else if (q < 0) out[c + nx] -= q / dy;
      }
    }
    for (let i = 0; i < nx; i++) { out[i] += qe.n[i] / dy; out[(ny - 1) * nx + i] += qe.s[i] / dy; }
    for (let j = 0; j < ny; j++) { out[j * nx] += qe.w[j] / dx; out[j * nx + nx - 1] += qe.e[j] / dx; }
    for (let c = 0; c < out.length; c++) {
      const o = out[c] * dt;
      out[c] = o > h[c] && o > 0 ? h[c] / o : 1; // now holds the donor scale factor
    }
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const c = j * nx + i, q = qxN[c];
        if (q > 0) qxN[c] = q * out[c]; else if (q < 0) qxN[c] = q * out[c + 1];
      }
    }
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx; i++) {
        const c = j * nx + i, q = qyN[c];
        if (q > 0) qyN[c] = q * out[c]; else if (q < 0) qyN[c] = q * out[c + nx];
      }
    }
    for (let i = 0; i < nx; i++) { qe.n[i] *= out[i]; qe.s[i] *= out[(ny - 1) * nx + i]; }
    for (let j = 0; j < ny; j++) { qe.w[j] *= out[j * nx]; qe.e[j] *= out[j * nx + nx - 1]; }

    // 3. depth update with sources and sinks
    const rainD = this.rain * dt, drainD = this.drain * dt;
    const inCount = this.inflowCells.length;
    const inD = inCount ? (this.inflow * dt) / (inCount * dx * dy) : 0;
    let hMax = 0, drained = 0, outflowQ = 0;
    for (let i = 0; i < nx; i++) outflowQ += (qe.n[i] + qe.s[i]) * dx;
    for (let j = 0; j < ny; j++) outflowQ += (qe.w[j] + qe.e[j]) * dy;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const c = j * nx + i;
        let dh = 0;
        if (i > 0) dh += qxN[c - 1];
        if (i < nx - 1) dh -= qxN[c];
        dh /= dx;
        let dv = 0;
        if (j > 0) dv += qyN[c - nx];
        if (j < ny - 1) dv -= qyN[c];
        dh += dv / dy;
        if (j === 0) dh -= qe.n[i] / dy;
        if (j === ny - 1) dh -= qe.s[i] / dy;
        if (i === 0) dh -= qe.w[j] / dx;
        if (i === nx - 1) dh -= qe.e[j] / dx;
        let hn = h[c] + dt * dh + rainD;
        if (hn < 0) hn = 0;
        if (drainD > 0 && hn > 0) { const d = hn < drainD ? hn : drainD; hn -= d; drained += d; }
        h[c] = hn;
        if (hn > hMax) hMax = hn;
      }
    }
    if (inD > 0) for (const c of this.inflowCells) { h[c] += inD; if (h[c] > hMax) hMax = h[c]; }
    this.totals.rain += rainD * nx * ny * dx * dy;
    this.totals.drain += drained * dx * dy;
    this.totals.inflow += this.inflow * dt;
    this.totals.outflow += outflowQ * dt;
    this.hMaxNow = hMax;
    this.qx = qxN; this.qxN = qx;
    this.qy = qyN; this.qyN = qy;
    this.t += dt;
    return dt;
  }
}
