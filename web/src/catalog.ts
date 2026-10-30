import { t } from "./i18n";
import type { Catalog, DataCheck, Dataset, Manifest, VerifyReport } from "./types";
import { esc, fmtBytes, safeUrl } from "./util";

const REPO = "https://github.com/raredil/banjir3d";
const THEMES = ["terrain", "subsidence", "bathymetry", "land-cover", "water-bodies", "buildings", "population", "admin", "rain", "imagery", "observed-flood", "river-inflow", "sea-level"];

type Ctx = { catalog: Catalog; manifest: Manifest | null; verify: VerifyReport | null; dataCheck?: DataCheck | null; releaseTag: string | null; focus?: string };

function badge(cls: string, text: string) {
  return `<span class="badge ${esc(cls)}">${esc(text)}</span>`;
}

function card(d: Dataset, ctx: Ctx): string {
  const rec = ctx.manifest?.layers.find((l) => l.dataset === d.id);
  const v = ctx.verify?.datasets.find((x) => x.id === d.id);
  const lic = d.licence;
  const flags = [lic.non_commercial ? "NC" : "", lic.share_alike ? "SA" : "", lic.redistributable === "no" ? "no redistribution" : lic.redistributable === "unknown" ? "redistribution unknown" : ""].filter(Boolean);
  const files = [...(rec?.outputs ?? []), ...(rec?.display ?? [])];
  const dl = (f: string) => (ctx.releaseTag ? `${REPO}/releases/download/${encodeURIComponent(ctx.releaseTag)}/${encodeURIComponent(f)}` : "#");
  return `
  <article class="ds-card" id="ds-${esc(d.id)}">
    <header>
      <h3>${esc(d.name)}</h3>
      <div class="badges">${badge(`role-${d.role}`, d.role)}${badge(`st-${d.status}`, d.status)}${rec ? badge(`pack-${rec.status}`, `${t("pack.built")}: ${rec.status === "ok" ? t("status.ok") : t("status.failed")}`) : ""}</div>
    </header>
    <dl class="facts">
      <dt>Provider</dt><dd>${esc(d.provider)}</dd>
      <dt>Version</dt><dd>${esc(rec?.version ?? d.version)}${d.temporal ? ` · ${esc(d.temporal)}` : ""}</dd>
      <dt>Resolution</dt><dd>${esc(d.resolution)}${d.vertical_datum ? ` · ${esc(d.vertical_datum)}` : ""}${d.crs ? ` · ${esc(d.crs)}` : ""}</dd>
      <dt>Licence</dt><dd>${lic.url ? `<a href="${safeUrl(lic.url)}" target="_blank" rel="noopener noreferrer">${esc(lic.id)}</a>` : esc(lic.id)}${flags.length ? ` ${flags.map((f) => badge("flag", f)).join("")}` : ""}</dd>
      <dt>DOI</dt><dd>${d.doi ? `<a class="mono" href="https://doi.org/${esc(d.doi)}" target="_blank" rel="noopener noreferrer">${esc(d.doi)}</a>${v?.doi_registered === false ? ` ${badge("warn", "DOI not resolved")}` : v?.doi_registered ? ` ${badge("ok", "DOI ✓")}` : ""}` : "–"}</dd>
      <dt>Access</dt><dd>${esc(d.access.method)}${d.access.endpoint ? `<br><span class="mono small">${esc(d.access.endpoint)}</span>` : ""}</dd>
      <dt>Landing page</dt><dd><a href="${safeUrl(d.url)}" target="_blank" rel="noopener noreferrer">${esc(d.url)}</a>${v ? ` ${badge(v.url_status === 200 ? "ok" : "warn", `HTTP ${v.url_status}`)}` : ""}</dd>
      <dt>Checked</dt><dd>${esc(d.checked)}${d.access.probe ? ` · ${esc(d.access.probe)}` : ""}</dd>
    </dl>
    ${d.notes ? `<p class="notes">${esc(d.notes)}</p>` : ""}
    ${rec?.status === "failed" ? `<p class="notes warn">Region pack error: ${esc(rec.error)}</p>` : ""}
    ${files.length ? `<details class="files"><summary>${t("cat.files")} (${files.length})</summary><table><thead><tr><th>File</th><th>Size</th><th>SHA-256</th></tr></thead><tbody>
      ${files.map((f) => `<tr><td><a href="${esc(dl(f.file))}">${esc(f.file)}</a></td><td>${fmtBytes(f.bytes)}</td><td class="mono small" title="${esc(f.sha256)}">${esc(f.sha256.slice(0, 16))}…</td></tr>`).join("")}
      </tbody></table></details>` : ""}
    <div class="cite">
      <p>${esc(d.citation.text)}</p>
      <button class="chip copy" type="button" data-bib="${esc(d.id)}">${t("cat.copy")}</button>
    </div>
  </article>`;
}

export function renderCatalog(root: HTMLElement, ctx: Ctx) {
  const ds = ctx.catalog.datasets;
  const count = (s: string) => ds.filter((d) => d.status === s).length;
  const m = ctx.manifest;
  root.innerHTML = `
  <section class="catalog-page">
    <div class="cat-head">
      <div>
        <h1>${t("cat.title")}</h1>
        <p class="lead">${t("cat.lead")}</p>
      </div>
      <div class="stats">
        <div class="stat"><b>${ds.length}</b><span>${t("cat.datasets")}</span></div>
        <div class="stat st-verified"><b>${count("verified")}</b><span>verified</span></div>
        <div class="stat st-single-source"><b>${count("single-source")}</b><span>single-source</span></div>
        <div class="stat st-unverified"><b>${count("unverified")}</b><span>unverified</span></div>
      </div>
    </div>
    <div class="cat-meta">
      <div><span class="k">Catalog</span> <span class="mono">v${esc(ctx.catalog.catalog_version)} · ${esc(ctx.catalog.updated)}</span></div>
      ${m ? `<div><span class="k">${t("pack.built")}</span> <a class="mono" href="${REPO}/releases/tag/${encodeURIComponent(ctx.releaseTag ?? "")}">${esc(ctx.releaseTag ?? "")}</a> · <span class="mono">${esc(m.created)}</span>${m.software.action_run ? ` · <a href="${safeUrl(m.software.action_run)}">Action run</a>` : ""}</div>
      <div><span class="k">${t("cat.outlicence")}</span> <b>${esc(m.output_licence)}</b> <span class="small">(${m.licences.map(esc).join(" · ")})</span></div>` : `<div class="warn">${t("cat.nopack")}</div>`}
      ${ctx.verify ? `<div><span class="k">${t("cat.auto")}</span> <span class="mono">${esc(ctx.verify.checked)}</span></div>` : ""}
      ${ctx.dataCheck?.checks?.length ? `<div class="data-checks"><span class="k">${t("cat.checks")}</span><ul>${ctx.dataCheck.checks.map((c) =>
        `<li>${badge(c.pass ? "ok" : "pack-failed", t(c.pass ? "cat.checks.pass" : "cat.checks.fail"))} ${esc(c.what)}: <span class="mono">${esc(c.value)}</span>${c.limit ? ` <span class="small">(${esc(c.limit)})</span>` : ""}</li>`).join("")}</ul></div>` : ""}
      <div><a class="chip" href="meta/REFERENCES.bib" download>${t("cat.bib")}</a></div>
    </div>
    ${THEMES.filter((th) => ds.some((d) => d.theme === th)).map((th) => `
      <h2 class="theme">${esc(th.replace("-", " "))}</h2>
      <div class="cards">${ds.filter((d) => d.theme === th).map((d) => card(d, ctx)).join("")}</div>`).join("")}
  </section>`;

  root.querySelectorAll<HTMLButtonElement>("[data-bib]").forEach((b) =>
    b.addEventListener("click", async () => {
      const d = ds.find((x) => x.id === b.dataset.bib);
      if (!d) return;
      try {
        await navigator.clipboard.writeText(d.citation.bibtex);
        b.textContent = t("cat.copied");
        setTimeout(() => (b.textContent = t("cat.copy")), 1500);
      } catch {
        /* clipboard blocked */
      }
    }));
  if (ctx.focus) {
    const el = root.querySelector(`#ds-${CSS.escape(ctx.focus)}`);
    el?.classList.add("focus");
    el?.scrollIntoView({ block: "start" });
  }
}
