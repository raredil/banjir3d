// "Why does it flood here?" (owner 2026-11-18, complaint 7; review 04 §2.D): per-place facts COMPUTED from the run, so the conclusion can
// explain a place without anyone inventing a reason. A place is a kecamatan (when the exposure pack is loaded) or else a connected
// patch of flooded land. For the largest flooded places it measures:
// - how much lower the flooded ground lies than the land around it (within RADIUS_M), from the run terrain (subsidence applied);
// - riverShare: the share of the flooded land that lies within NEAR_M of a channel whose PEAK water surface rose above that land's
//   ground: there the water most likely came over the river bank; elsewhere it is rain that ran off and gathered in low ground;
// - how much the ground sank between the terrain epoch and the run date (subsidence), when known.
// Pure function, unit-tested (places.test.ts).

export const RADIUS_M = 450, NEAR_M = 300;

export type PlaceGrid = {
  nx: number; ny: number; dx: number;
  z: ArrayLike<number>; // ground (channel cells: bed)
  channel: ArrayLike<number>;
  land: ArrayLike<number>; // > 0: land that counts for flooded area (active, not sea, not channel, not building)
  max: ArrayLike<number>; // maximum depth over the run (m)
};
export type PlaceOpts = {
  floodM: number;
  groupOf?: (c: number) => number; // kecamatan id (> 0) of a cell, 0 = none; without it places are connected flooded patches
  nameOf?: (g: number) => string | null;
  loweredM?: (c: number) => number; // ground lowering by subsidence from the terrain epoch to the run date (m)
  lonLat: (c: number) => { lon: number; lat: number };
  top?: number;
  minCells?: number;
};
export type Place = {
  name: string | null; lon: number; lat: number; areaKm2: number;
  depthP90: number; // 90th percentile of the maximum depth over the flooded cells of the place
  reliefM: number | null; // mean ground of the flooded cells minus mean ground of the dry land around them (negative = lower)
  riverShare: number; // 0..1, see the header
  nearShare: number; // 0..1, flooded land within NEAR_M of any channel
  loweredM: number | null; // mean subsidence lowering of the flooded cells (m)
};

const pctl = (v: number[], q: number) => { if (!v.length) return 0; const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))]; };

/** Distance (cells, 8-neighbour steps) to and index of the nearest channel cell, up to maxD cells; -1 beyond. */
function nearestChannel(g: PlaceGrid, maxD: number) {
  const N = g.nx * g.ny, dist = new Int16Array(N).fill(-1), src = new Int32Array(N).fill(-1);
  let q: number[] = [];
  for (let c = 0; c < N; c++) if (g.channel[c]) { dist[c] = 0; src[c] = c; q.push(c); }
  for (let d = 1; d <= maxD && q.length; d++) {
    const nq: number[] = [];
    for (const c of q) {
      const i = c % g.nx, j = (c - i) / g.nx;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= g.nx || jj >= g.ny) continue;
        const k = jj * g.nx + ii;
        if (dist[k] >= 0) continue;
        dist[k] = d; src[k] = src[c]; nq.push(k);
      }
    }
    q = nq;
  }
  return { dist, src };
}

export function floodPlaces(g: PlaceGrid, o: PlaceOpts): Place[] {
  const N = g.nx * g.ny, wet = new Uint8Array(N);
  for (let c = 0; c < N; c++) wet[c] = +(g.land[c] > 0 && g.max[c] > o.floodM);
  // groups: kecamatan or connected flooded patches (8-neighbour)
  const grp = new Int32Array(N);
  if (o.groupOf) for (let c = 0; c < N; c++) grp[c] = wet[c] ? o.groupOf(c) : 0;
  else {
    let id = 0;
    for (let c = 0; c < N; c++) {
      if (!wet[c] || grp[c]) continue;
      grp[c] = ++id;
      const st = [c];
      while (st.length) {
        const k = st.pop()!, i = k % g.nx, j = (k - i) / g.nx;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const ii = i + di, jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= g.nx || jj >= g.ny) continue;
          const m = jj * g.nx + ii;
          if (wet[m] && !grp[m]) { grp[m] = id; st.push(m); }
        }
      }
    }
  }
  const cells = new Map<number, number[]>();
  for (let c = 0; c < N; c++) if (grp[c] > 0) { const a = cells.get(grp[c]); if (a) a.push(c); else cells.set(grp[c], [c]); }
  const order = [...cells.entries()].filter(([, v]) => v.length >= (o.minCells ?? 3)).sort((a, b) => b[1].length - a[1].length).slice(0, o.top ?? 3);
  if (!order.length) return [];
  const R = Math.max(1, Math.round(RADIUS_M / g.dx)), NEAR = Math.max(1, Math.round(NEAR_M / g.dx));
  const nc = nearestChannel(g, NEAR);
  const a = (g.dx * g.dx) / 1e6;
  return order.map(([id, cs]) => {
    // dry land around the flooded cells of this place (within R cells), for the relief
    const ring = new Set<number>();
    let zw = 0;
    for (const c of cs) {
      zw += g.z[c];
      const i = c % g.nx, j = (c - i) / g.nx;
      for (let dj = -R; dj <= R; dj += Math.max(1, Math.floor(R / 3))) for (let di = -R; di <= R; di += Math.max(1, Math.floor(R / 3))) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= g.nx || jj >= g.ny) continue;
        const m = jj * g.nx + ii;
        if (g.land[m] > 0 && !wet[m]) ring.add(m);
      }
    }
    let zr = 0;
    ring.forEach((m) => (zr += g.z[m]));
    let river = 0, near = 0;
    for (const c of cs) {
      const s = nc.src[c];
      if (s < 0) continue;
      near++;
      if (g.z[s] + g.max[s] > g.z[c] + o.floodM) river++;
    }
    const depths = cs.map((c) => g.max[c]), p90 = pctl(depths, 0.9);
    let rep = cs[0];
    for (const c of cs) if (Math.abs(g.max[c] - p90) < Math.abs(g.max[rep] - p90)) rep = c;
    const ll = o.lonLat(rep);
    return {
      name: o.groupOf && o.nameOf ? o.nameOf(id) : null, lon: ll.lon, lat: ll.lat, areaKm2: cs.length * a, depthP90: p90,
      reliefM: ring.size ? zw / cs.length - zr / ring.size : null, riverShare: river / cs.length, nearShare: near / cs.length,
      loweredM: o.loweredM ? (cs.reduce((s2, c) => s2 + o.loweredM!(c), 0) / cs.length) : null,
    };
  });
}
