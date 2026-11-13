// One Markdown file with everything another AI needs to explain Banjir3D (owner 2026-11-13): plain-language guide (docs/ai/panduan-id.md),
// what each map layer does (data/layer-roles.json), validation figures (data/skill.json), the full Methods text
// (data/methods/methods.md, same as the Methods page) and the reference list. Built from the repository files, so it cannot drift
// from the app: src/ai-context.test.ts fails when public/banjir3d-konteks-ai.md is not regenerated (npm run ai-context).
import guide from "../../docs/ai/panduan-id.md?raw";
import methods from "../../data/methods/methods.md?raw";
import refsData from "../../data/methods/references.json";
import roles from "../../data/layer-roles.json";
import skill from "../../data/skill.json";
import calibration from "../../data/engine/calibration.json";
import { citeAuthors, refEntry, sortRefs, type Ref } from "./methods/cite";
import { LAYERS } from "./layers";

const REFS = new Map((refsData.references as Ref[]).map((r) => [r.key, r]));
type Sk = { events: { id: string; hit: number; random: number; hitCell?: number; randomCell?: number; n?: number; obsMedianM: number; modelMedianM: number; dkiKm2: number; reportedKm2: number | null; pumpsOnHit?: number; pumpsOnDkiKm2?: number; wetHit?: number; wetDkiKm2?: number }[]; resolution?: string };

/** [@a; @b] -> (A, 2010; B, 2011); @a -> A (2010); same rules as the Methods page. */
export function plainCitations(text: string): string {
  const year = (r: Ref) => (r.year === "n.d." ? "no date" : String(r.year));
  return text
    .replace(/\[(@[\w-]+(?:;\s*@[\w-]+)*)\]/g, (_, g: string) => `(${g.split(/;\s*/).map((k) => { const r = REFS.get(k.slice(1)); return r ? `${citeAuthors(r)}, ${year(r)}` : k; }).join("; ")})`)
    .replace(/(^|[\s(])@([a-z]+\d{4}[a-z]?)/g, (m, pre: string, k: string) => { const r = REFS.get(k); return r ? `${pre}${citeAuthors(r)} (${year(r)})` : m; });
}

const pct = (v: number | undefined) => (v === undefined || v === null ? "–" : `${Math.round(v * 100)} %`);
function skillTable(s: Sk): string {
  if (!s.events.length) return "_Angka uji sedang diperbarui (aturan skor baru 13 November 2026); lihat halaman Validasi di aplikasi._";
  const rows = s.events.map((e) => `| ${e.id} | ${e.n ?? "–"} | ${pct(e.hit)} | ${pct(e.random)} | ${pct(e.hitCell)} | ${pct(e.randomCell)} | ${Math.round(e.obsMedianM * 100)} cm | ${Math.round(e.modelMedianM * 100)} cm | ${e.dkiKm2.toFixed(0)} km²${e.reportedKm2 ? ` (dilaporkan ${e.reportedKm2} km²)` : ""} |`);
  const pumps = s.events.filter((e) => e.pumpsOnHit !== undefined).map((e) => `${e.id}: kena ${pct(e.hit)} → ${pct(e.pumpsOnHit)}, luas DKI ${e.dkiKm2.toFixed(0)} → ${e.pumpsOnDkiKm2?.toFixed(0)} km²`);
  const wet = s.events.filter((e) => e.wetHit !== undefined).map((e) => `${e.id}: kena ${pct(e.hit)} → ${pct(e.wetHit)}, luas DKI ${e.dkiKm2.toFixed(0)} → ${e.wetDkiKm2?.toFixed(0)} km²`);
  return ["| Banjir | Laporan | Kena (±270 m) | Acak (±270 m) | Kena (kotak sama) | Acak (kotak sama) | Kedalaman laporan (median) | Kedalaman model (median) | Luas tergenang DKI model |", "|---|---|---|---|---|---|---|---|---|", ...rows,
    "", "Pengaturan yang diuji: kotak 90 m, hujan GPM IMERG, pompa mati, serapan saluran kecil 0, tanah normal, penurunan tanah sampai tanggal banjir.",
    ...(pumps.length ? ["", `Dengan pompa menyala: ${pumps.join("; ")}.`] : []),
    ...(wet.length ? ["", `Dengan tanah basah (AMC III): ${wet.join("; ")}.`] : []),
    ...(s.resolution ? ["", s.resolution] : [])].join("\n");
}

export function buildAiContext(stamp: { built: string; commit: string }): string {
  const layers = LAYERS.map((l) => { const r = (roles.layers as Record<string, { use: keyof typeof roles.tags; id: string }>)[l.id]; return `| ${l.name.id} | ${r ? roles.tags[r.use].id : "–"} | ${r?.id ?? ""} |`; });
  const refs = sortRefs([...REFS.values()]).map((r) => `- ${refEntry(r).text}`);
  return [
    "# Banjir3D: file konteks untuk AI",
    "",
    `Dibuat dari repositori Banjir3D pada ${stamp.built} (commit ${stamp.commit}). Aplikasi: https://raredil.github.io/banjir3d/ · Kode: https://github.com/raredil/banjir3d`,
    "",
    "Cara pakai: tempelkan seluruh file ini ke percakapan AI, lalu tempelkan teks dari tombol \"Salin untuk AI\" di kartu Kesimpulan aplikasi, lalu bertanyalah.",
    "",
    guide.replace("{{SKILL}}", skillTable(skill as Sk)).trim(),
    "",
    "## I. Peta di aplikasi dan gunanya",
    "",
    "| Peta | Guna | Keterangan |",
    "|---|---|---|",
    ...layers,
    "",
    "## J. Nilai tetap yang dipakai model",
    "",
    `- Ambang tergenang 0,15 m; warna peta mulai 0,05 m; laporan dianggap \"kena\" bila model ≥ 0,10 m di daratan.`,
    `- Kekasaran Manning: kawasan terbangun 0,15; alur sungai/saluran 0,035; nilai kelas lain dari tabel HEC-RAS menurut Chow (1959).`,
    `- Curve Number kawasan terbangun 98 (kedap air); kelas lain dari tabel TR-55; kelompok tanah 83 % D, 17 % C.`,
    `- Serapan saluran kecil bawaan ${calibration.drain_mm_h} mm/jam; pompa bawaan ${calibration.pumps_default ? "menyala" : "mati"}; saluran mikro Jakarta Selatan (data ukuran DSDA) bawaan ${(calibration as { micro_default?: boolean }).micro_default ? "menyala" : "mati"}.`,
    "- Langkah waktu: faktor Courant 0,7, paling lama 15 detik; aliran hanya lewat sisi kotak yang airnya lebih dari 1 mm.",
    "",
    "## K. Metode ilmiah lengkap (sama dengan halaman Metode di aplikasi, bahasa Inggris)",
    "",
    plainCitations(methods.replace(/^# .*\n/, "")).replace(/^## /gm, "### ").trim(),
    "",
    "## L. Daftar pustaka",
    "",
    ...refs,
    "",
  ].join("\n");
}
