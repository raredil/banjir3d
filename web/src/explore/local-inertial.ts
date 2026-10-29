// Explore engine v0: 2D local-inertial shallow-water solver (Bates et al. 2010, the LISFLOOD-FP "ACC" equations).
// Pure TypeScript on typed arrays so it runs in a Web Worker, in Node tests, and later as the reference for a WebGPU port.
// Exploratory only: not yet verified against the EA benchmarks or SFINCS (BLUEPRINT 4.1). Do not use for quantitative claims.

export const G = 9.81;

export type Grid = { nx: number; ny: number; dx: number; dy: number; z: Float64Array };

export type SolverOptions = {
  manning?: number; // n, s m^-1/3 (uniform)
  theta?: number; // flux averaging weight, 0.7 in Bates et al. 2010
  alpha?: number; // CFL factor
  dtMax?: number; // s
  hMin?: number; // m, wet/dry threshold
  openNorth?: boolean; // normal-flow outflow through the north edge (row 0)
  outflowSlope?: number; // slope used for the north-edge normal flow
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
  private qn: Float64Array; // outward flux through the north edge, row 0
  private out: Float64Array;
  t = 0;
  rain = 0; // m/s
  drain = 0; // m/s
  inflow = 0; // m3/s in total
  readonly totals: Totals = { rain: 0, drain: 0, inflow: 0, outflow: 0 };
  readonly manning: number;
  readonly theta: number;
  readonly alpha: number;
  readonly dtMax: number;
  readonly hMin: number;
  readonly openNorth: boolean;
  readonly outflowSlope: number;
  readonly inflowCells: number[];
  private hMaxNow = 0;
  private readonly initialVolume: number;

  constructor(grid: Grid, o: SolverOptions = {}, h0?: Float64Array) {
    this.nx = grid.nx; this.ny = grid.ny; this.dx = grid.dx; this.dy = grid.dy; this.z = grid.z;
    const n = grid.nx * grid.ny;
    this.h = h0 ? Float64Array.from(h0) : new Float64Array(n);
    this.qx = new Float64Array(n); this.qy = new Float64Array(n);
    this.qxN = new Float64Array(n); this.qyN = new Float64Array(n);
    this.qn = new Float64Array(grid.nx); this.out = new Float64Array(n);
    this.manning = o.manning ?? 0.05; this.theta = o.theta ?? 0.7; this.alpha = o.alpha ?? 0.7;
    this.dtMax = o.dtMax ?? 15; this.hMin = o.hMin ?? 0.001;
    this.openNorth = o.openNorth ?? false; this.outflowSlope = o.outflowSlope ?? 0.001;
    this.inflowCells = o.inflowCells ?? [];
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
    const { nx, ny, dx, dy, z, h, qx, qy, qxN, qyN, qn, out } = this;
    const dt = this.dtNow();
    const n2 = this.manning * this.manning;
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
        const den = 1 + (G * dt * n2 * Math.sqrt(q0 * q0 + qt * qt)) / (hf * hf * Math.cbrt(hf));
        let q = num / den;
        const qmax = hf * Math.sqrt(G * hf);
        if (q > qmax) q = qmax; else if (q < -qmax) q = -qmax;
        qyN[c] = q;
      }
    }
    for (let i = 0; i < nx; i++) qyN[(ny - 1) * nx + i] = 0;
    if (this.openNorth) {
      const k = Math.sqrt(this.outflowSlope) / this.manning;
      for (let i = 0; i < nx; i++) qn[i] = h[i] > hMin ? k * Math.pow(h[i], 5 / 3) : 0;
    } else qn.fill(0);

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
    for (let i = 0; i < nx; i++) out[i] += qn[i] / dy;
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
    for (let i = 0; i < nx; i++) qn[i] *= out[i];

    // 3. depth update with sources and sinks
    const rainD = this.rain * dt, drainD = this.drain * dt;
    const inCount = this.inflowCells.length;
    const inD = inCount ? (this.inflow * dt) / (inCount * dx * dy) : 0;
    let hMax = 0, drained = 0, outflowQ = 0;
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
        if (j === 0) { dh -= qn[i] / dy; outflowQ += qn[i]; }
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
    this.totals.outflow += outflowQ * dx * dt;
    this.hMaxNow = hMax;
    this.qx = qxN; this.qxN = qx;
    this.qy = qyN; this.qyN = qy;
    this.t += dt;
    return dt;
  }
}
