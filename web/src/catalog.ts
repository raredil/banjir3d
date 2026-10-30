import use from "../../data/catalog-use.json";
import { lang, t, type Key } from "./i18n";
import type { Catalog, DataCheck, Dataset, Manifest } from "./types";
import { esc, safeUrl } from "./util";

const REPO = "https://github.com/raredil/banjir3d";
type Use = { use: string[]; id: string; en: string };
const USE = use as unknown as Record<string, Use>;
const ORDER = ["engine", "map", "validation", "planned"];
type Ctx = { catalog: Catalog; manifest: Manifest | null; dataCheck?: DataCheck | null; releaseTag: string | null; engine?: Record<string, unknown> | null; focus?: string };

function card(d: Dataset, ctx: Ctx): string {
  const u = USE[d.id] ?? { use: ["planned"], id: "", en: "" };
  const rec = ctx.manifest?.layers.find((l) => l.dataset === d.id);
  const lic = d.licence;
  return `<article class="ds card" id="ds-${esc(d.id)}" data-use="${u.use.join(" ")}">
    <div class="ds-top"><div><h2>${esc(d.name)}</h2><div class="prov">${esc(d.provider)}</div></div>
      <div class="row">${u.use.map((x) => `<span class="pill ${x === "engine" ? "blue" : x === "planned" ? "" : "ok"}">${t(`data.use.${x}` as Key)}</span>`).join("")}</div></div>
    <p class="use">${esc(u[lang])}</p>
    <dl>
      <dt>${t("data.version")}</dt><dd>${esc(rec?.version ?? d.version)}${d.temporal ? ` · ${esc(d.temporal)}` : ""}</dd>
      <dt>${t("data.res")}</dt><dd>${esc(d.resolution)}</dd>
      <dt>${t("data.licence")}</dt><dd>${lic.url ? `<a href="${safeUrl(lic.url)}" target="_blank" rel="noopener noreferrer">${esc(lic.id)}</a>` : esc(lic.id)}</dd>
      ${d.doi ? `<dt>DOI</dt><dd><a class="mono" href="https://doi.org/${esc(d.doi)}" target="_blank" rel="noopener noreferrer">${esc(d.doi)}</a></dd>` : ""}
    </dl>
    <details><summary>${t("data.more")}</summary>
      <p>${esc(d.citation.text)}</p>
      ${d.notes ? `<p>${esc(d.notes)}</p>` : ""}
      <p>Access: ${esc(d.access.method)}${d.access.endpoint ? ` · <span class="mono">${esc(d.access.endpoint)}</span>` : ""} · checked ${esc(d.checked)} · <a href="${safeUrl(d.url)}" target="_blank" rel="noopener noreferrer">${t("source")}</a></p>
      <button class="btn small" type="button" data-bib="${esc(d.id)}">${t("data.copy")}</button>
    </details>
  </article>`;
}

export function renderCatalog(root: HTMLElement, ctx: Ctx) {
  const ds = [...ctx.catalog.datasets].sort((a, b) => ORDER.indexOf((USE[a.id]?.use ?? ["planned"])[0]) - ORDER.indexOf((USE[b.id]?.use ?? ["planned"])[0]));
  const eng = ctx.engine as { created?: string; output?: { sha256?: string }; soil?: { source?: string } } | null | undefined;
  root.innerHTML = `<div class="doc">
    <div class="doc-head"><h1>${t("data.title")}</h1><p>${t("data.lead")}</p></div>
    <div class="card" style="padding:14px 16px;margin-bottom:16px">
      <dl class="stat-list">
        <dt>${t("data.pack")}</dt><dd>${ctx.releaseTag ? `<a href="${REPO}/releases/tag/${encodeURIComponent(ctx.releaseTag)}">${esc(ctx.releaseTag)}</a>` : "–"} · ${esc(ctx.manifest?.created.slice(0, 10) ?? "")}</dd>
        <dt>${t("data.engine")}</dt><dd>${eng ? `${esc(eng.created ?? "")} · ${esc(eng.soil?.source ?? "")} · sha256 ${esc((eng.output?.sha256 ?? "").slice(0, 12))}…` : "–"}</dd>
        ${ctx.manifest ? `<dt>Output licence</dt><dd>${esc(ctx.manifest.output_licence)}</dd>` : ""}
      </dl>
      ${ctx.dataCheck?.checks?.length ? `<details><summary>${t("data.checks")}: ${ctx.dataCheck.checks.filter((c) => c.pass).length}/${ctx.dataCheck.checks.length} ${t("data.pass")}</summary><ul class="legend">${ctx.dataCheck.checks.map((c) => `<li><span class="pill ${c.pass ? "ok" : "warn"}">${t(c.pass ? "data.pass" : "data.fail")}</span> ${esc(c.what)}: <span class="mono">${esc(c.value)}</span></li>`).join("")}</ul></details>` : ""}
      <p><a class="btn small" href="meta/REFERENCES.bib" download>${t("data.bib")}</a></p>
    </div>
    <div class="filters seg" style="display:inline-flex">${["all", ...ORDER].map((f, i) => `<button type="button" data-f="${f}" class="${i ? "" : "on"}">${f === "all" ? t("data.all") : t(`data.use.${f}` as Key)}</button>`).join("")}</div>
    <div class="grid-cards">${ds.map((d) => card(d, ctx)).join("")}</div>
  </div>`;
  root.querySelectorAll<HTMLButtonElement>("[data-f]").forEach((b) => b.addEventListener("click", () => {
    root.querySelectorAll("[data-f]").forEach((x) => x.classList.toggle("on", x === b));
    root.querySelectorAll<HTMLElement>(".ds").forEach((c) => (c.hidden = b.dataset.f !== "all" && !(c.dataset.use ?? "").split(" ").includes(b.dataset.f!)));
  }));
  root.querySelectorAll<HTMLButtonElement>("[data-bib]").forEach((b) => b.addEventListener("click", async () => {
    const d = ds.find((x) => x.id === b.dataset.bib);
    if (!d) return;
    try { await navigator.clipboard.writeText(d.citation.bibtex); b.textContent = t("data.copied"); setTimeout(() => (b.textContent = t("data.copy")), 1500); } catch { /* blocked */ }
  }));
  if (ctx.focus) { const el = root.querySelector<HTMLDetailsElement>(`#ds-${CSS.escape(ctx.focus)}`); el?.scrollIntoView({ block: "start" }); el?.querySelector("details")?.setAttribute("open", ""); }
}

const STATUS: Record<string, [string, string]> = { pass: ["lolos", "pass"], partial: ["berjalan", "in progress"], fail: ["gagal", "fail"], todo: ["belum", "to do"] };
export function renderValidation(root: HTMLElement, v: { tests: { id: string; status: string; file: string; id_txt: string; en_txt: string; metrics: string[][] }[] }) {
  root.innerHTML = `<div class="doc"><div class="doc-head"><h1>${t("va.title")}</h1><p>${t("va.lead")}</p></div>
    <div class="grid-cards">${v.tests.map((x) => `<article class="ds card"><div class="ds-top"><h2>${esc((lang === "id" ? x.id_txt : x.en_txt).split(":")[0])}</h2>
      <span class="pill ${x.status === "pass" ? "ok" : "warn"}">${(STATUS[x.status] ?? STATUS.todo)[lang === "id" ? 0 : 1]}</span></div>
      <p class="use">${esc((lang === "id" ? x.id_txt : x.en_txt).split(":").slice(1).join(":").trim())}</p>
      ${x.metrics.length ? `<dl>${x.metrics.map(([a, b]) => `<dt>${esc(a)}</dt><dd class="mono">${esc(b)}</dd>`).join("")}</dl>` : ""}
      ${x.file ? `<p class="prov"><a href="${REPO}/blob/main/${esc(x.file)}" target="_blank" rel="noopener noreferrer">${esc(x.file)}</a></p>` : ""}</article>`).join("")}</div></div>`;
}
