// npm run ai-context: writes public/banjir3d-konteks-ai.md (served with the site) from the repository files.
import { writeFileSync } from "node:fs";
import { buildAiContext } from "../src/ai-context";
writeFileSync(new URL("../public/banjir3d-konteks-ai.md", import.meta.url), buildAiContext({ built: process.env.AI_STAMP ?? new Date().toISOString().slice(0, 10), commit: process.env.AI_COMMIT ?? "lihat git log" }));
