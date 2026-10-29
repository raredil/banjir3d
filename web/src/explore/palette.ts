// Depth colours for the flood overlay: transparent when dry, light to dark blue with depth. Pure, unit-tested.
const STOPS: [number, number, number, number, number][] = [
  [0.03, 215, 230, 244, 0.45],
  [0.25, 158, 202, 225, 0.78],
  [0.5, 66, 146, 198, 0.88],
  [1, 33, 113, 181, 0.92],
  [2, 8, 48, 107, 0.95],
];
export const WET_MIN = 0.03; // m

export function depthRgba(d: number): [number, number, number, number] {
  if (!(d >= WET_MIN)) return [0, 0, 0, 0];
  if (d >= STOPS[STOPS.length - 1][0]) { const s = STOPS[STOPS.length - 1]; return [s[1], s[2], s[3], s[4]]; }
  for (let k = 1; k < STOPS.length; k++) {
    if (d <= STOPS[k][0]) {
      const a = STOPS[k - 1], b = STOPS[k], f = (d - a[0]) / (b[0] - a[0]);
      return [a[1] + f * (b[1] - a[1]), a[2] + f * (b[2] - a[2]), a[3] + f * (b[3] - a[3]), a[4] + f * (b[4] - a[4])];
    }
  }
  return [0, 0, 0, 0];
}

export function paintDepth(depth: Float32Array, out: Uint8ClampedArray) {
  for (let c = 0; c < depth.length; c++) {
    const [r, g, b, a] = depthRgba(depth[c]);
    const k = c * 4;
    out[k] = r; out[k + 1] = g; out[k + 2] = b; out[k + 3] = Math.round(a * 255);
  }
}
