// Copy repository metadata (catalog, references, regions, DEMNAS tile grid) into public/meta for the build.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const data = join(here, "..", "..", "data");
const dest = join(here, "..", "public", "meta");
mkdirSync(dest, { recursive: true });
for (const f of ["catalog.json", "REFERENCES.bib", "regions.json", "demnas/jabodetabek_tiles.geojson"]) {
  copyFileSync(join(data, f), join(dest, f.split("/").pop()));
}
console.log("copied metadata to public/meta");
