// Open ground sealed off by building cells (no open path to the box edge or a channel) at each fine cell size.
// From web/: npx vite-node ../verification/fine-consistency/pockets.ts <engine_pack.bin.gz> <buildings.pmtiles> [box] [r list]
import { readFileSync, openSync, readSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { buildFineRun, parsePack, sealedPockets } from "../../web/src/engine/pack";
import { buildingMask } from "../../web/src/sim/buildings";
const [packF, pmF, boxS, rs] = process.argv.slice(2);
const raw = gunzipSync(readFileSync(packF));
const p = parsePack(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
const box = (boxS || "106.8575,-6.2295,106.8665,-6.2205").split(",").map(Number);
const fd = openSync(pmF, "r");
const src = { getKey: () => pmF, getBytes: async (o: number, l: number) => { const b = Buffer.alloc(l); readSync(fd, b, 0, l, o); return { data: b.buffer.slice(b.byteOffset, b.byteOffset + l) }; } };
for (const r of (rs || "3,6,15,30").split(",").map(Number)) {
  const g0 = buildFineRun(p, box, r);
  const m = await buildingMask(src as never, g0);
  const g = buildFineRun(p, box, r, undefined, m.mask);
  const sealed = sealedPockets(g.nx, g.ny, g.building!, g.channel);
  let open = 0, s = 0;
  for (let c = 0; c < sealed.length; c++) if (!g.building![c]) { open++; s += sealed[c]; }
  console.log(JSON.stringify({ cellM: 30 / r, buildingShare: +(m.cells / m.mask.length).toFixed(3), sealedShareOfOpen: +(s / open).toFixed(3) }));
}
