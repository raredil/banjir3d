import { addProtocol, setWorkerUrl } from "maplibre-gl";
// MapLibre 6 resolves its worker next to its own module; after bundling we point it at Vite's worker chunk.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { Protocol } from "pmtiles";

let done = false;
/** Register the pmtiles:// protocol and the worker once, for every page that draws a map. */
export function ensurePmtiles() {
  if (done) return;
  setWorkerUrl(new URL(workerUrl, location.href).href);
  addProtocol("pmtiles", new Protocol().tile);
  done = true;
}
