/** Escape text for safe insertion into HTML (all remote/catalog text goes through this). */
export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Only allow http(s) links from data files. */
export function safeUrl(url: unknown): string {
  try {
    const u = new URL(String(url));
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : "#";
  } catch {
    return "#";
  }
}

export function fmtBytes(n: number): string {
  if (!Number.isFinite(n)) return "–";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

/** WGS84 → UTM (Krüger series, mm accuracy within the zone). Returns easting, northing (southern false northing applied). */
export function toUtm(lon: number, lat: number, zone = Math.floor((lon + 180) / 6) + 1) {
  const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996;
  const n = f / (2 - f);
  const A = (a / (1 + n)) * (1 + n * n / 4 + n ** 4 / 64);
  const al = [n / 2 - (2 / 3) * n * n + (5 / 16) * n ** 3, (13 / 48) * n * n - (3 / 5) * n ** 3, (61 / 240) * n ** 3];
  const phi = (lat * Math.PI) / 180;
  const lam = ((lon - (zone * 6 - 183)) * Math.PI) / 180;
  const e2 = 2 * f - f * f;
  const e = Math.sqrt(e2);
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - e * Math.atanh(e * Math.sin(phi)));
  const xi = Math.atan2(t, Math.cos(lam));
  const eta = Math.atanh(Math.sin(lam) / Math.sqrt(1 + t * t));
  let x = eta, y = xi;
  for (let j = 1; j <= 3; j++) {
    x += al[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
    y += al[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
  }
  const easting = 500000 + k0 * A * x;
  const northing = k0 * A * y + (lat < 0 ? 10000000 : 0);
  return { zone, hemisphere: lat < 0 ? "S" : "N", easting, northing };
}

// Sharp rasters. Data grids (land cover, water occurrence, population) always show their cells as sharp squares. The
// 10 m Sentinel-2 image is smoothed only while a source pixel spans at most about one screen pixel; from SHARP_IMAGERY_Z
// on (10 m = 2+ screen pixels) it is drawn with nearest-neighbour, so zooming in shows the real 10 m pixels instead of blur.
export const SHARP_IMAGERY_Z = 15;
export const MAX_ZOOM = 18; // beyond this no layer holds more detail (buildings z14, imagery 10 m, terrain 30 m)
export function rasterResampling(imagery: boolean, zoom: number): "linear" | "nearest" {
  return imagery && zoom < SHARP_IMAGERY_Z ? "linear" : "nearest";
}

/** UTM → WGS84 (Krüger series, inverse of toUtm). */
export function fromUtm(easting: number, northing: number, zone: number, south: boolean) {
  const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996;
  const n = f / (2 - f);
  const A = (a / (1 + n)) * (1 + n * n / 4 + n ** 4 / 64);
  const be = [n / 2 - (2 / 3) * n * n + (37 / 96) * n ** 3, (1 / 48) * n * n + (1 / 15) * n ** 3, (17 / 480) * n ** 3];
  const de = [2 * n - (2 / 3) * n * n - 2 * n ** 3, (7 / 3) * n * n - (8 / 5) * n ** 3, (56 / 15) * n ** 3];
  const xi = (northing - (south ? 10000000 : 0)) / (k0 * A), eta = (easting - 500000) / (k0 * A);
  let xp = xi, ep = eta;
  for (let j = 1; j <= 3; j++) {
    xp -= be[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
    ep -= be[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
  }
  const chi = Math.asin(Math.sin(xp) / Math.cosh(ep));
  let phi = chi;
  for (let j = 1; j <= 3; j++) phi += de[j - 1] * Math.sin(2 * j * chi);
  const lam = Math.atan2(Math.sinh(ep), Math.cos(xp));
  return { lon: zone * 6 - 183 + (lam * 180) / Math.PI, lat: (phi * 180) / Math.PI };
}
