import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "./style.css";
import validation from "../../data/validation.json";
import { renderCatalog, renderValidation } from "./catalog";
import { applyStatic, lang, setLang, t } from "./i18n";
import type { MapPage } from "./map";
import type { Catalog, DataCheck, Manifest } from "./types";
import { esc, fetchJson } from "./util";

const REGION = "jakarta";
const DATA = `data/${REGION}`;
const app = document.querySelector<HTMLElement>("#app")!;
const doc = document.createElement("div");
app.append(doc);
let mapPage: Promise<MapPage> | null = null;

const state = (async () => {
  const [catalog, regions, manifest, release, dataCheck, engine] = await Promise.all([
    fetchJson<Catalog>("meta/catalog.json"),
    fetchJson<Record<string, { bbox: number[]; name: string; domain?: string }>>("meta/regions.json"),
    fetchJson<Manifest>(`${DATA}/manifest.json`),
    fetchJson<{ tag: string }>(`${DATA}/release.json`),
    fetchJson<DataCheck>(`${DATA}/data-check.json`),
    fetchJson<Record<string, unknown>>(`${DATA}/engine_${REGION}.json`),
  ]);
  return { catalog: catalog!, region: regions![REGION], manifest, dataCheck, engine, releaseTag: release?.tag ?? null };
})();

// Something on the page failed (a file did not load, a script error): a bar at the top says so, with the error text to copy and
// a reload button. Files missing right after a site update (old page, new file names) reload the page once by themselves.
const RELOADED = "banjir3d.reloaded";
let bar: HTMLElement | null = null;
function showError(e: unknown) {
  const m = String((e as Error)?.message ?? (e as { reason?: unknown })?.reason ?? e ?? "");
  const missing = /dynamically imported module|Importing a module script failed|error loading dynamically|preload/i.test(m);
  let last = 0;
  try { last = Number(sessionStorage.getItem(RELOADED)) || 0; } catch { /* storage blocked */ }
  if (missing && Date.now() - last > 60_000) {
    try { sessionStorage.setItem(RELOADED, String(Date.now())); } catch { /* storage blocked */ }
    location.reload();
    return;
  }
  bar?.remove();
  bar = document.createElement("div");
  bar.className = "err-bar"; bar.setAttribute("role", "alert");
  bar.innerHTML = `<b>${esc(t("err.title"))}</b> <span>${esc(m.slice(0, 300))}</span>
    <button class="btn small" type="button" data-e="copy">${esc(t("err.copy"))}</button><button class="btn small primary" type="button" data-e="reload">${esc(t("err.reload"))}</button><button class="btn small" type="button" data-e="x" aria-label="close">×</button>`;
  const detail = `Banjir3D ${import.meta.env.VITE_GIT_SHA ?? ""} ${location.href}\n${m}\n${(e as Error)?.stack ?? ""}\n${navigator.userAgent}`;
  bar.addEventListener("click", async (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>("[data-e]");
    if (!b) return;
    if (b.dataset.e === "reload") location.reload();
    else if (b.dataset.e === "x") { bar?.remove(); bar = null; }
    else { try { await navigator.clipboard.writeText(detail); b.textContent = "✓"; } catch { b.textContent = "✗"; } }
  });
  document.body.append(bar);
}
window.addEventListener("unhandledrejection", (ev) => showError(ev.reason));
window.addEventListener("error", (ev) => { if (ev.error || (ev.filename && ev.filename.startsWith(location.origin))) showError(ev.error ?? ev.message); });

async function ensureMap(at: string | null) {
  if (!mapPage) {
    mapPage = (async () => {
      const s = await state;
      const { createMapPage } = await import("./map");
      const page = await createMapPage(app, { regionId: REGION, region: s.region, manifest: s.manifest, catalog: s.catalog, dataBase: DATA, at });
      const { mountSim } = await import("./sim/panel");
      mountSim(page, { packUrl: `${DATA}/engine_${REGION}.bin.gz`, regionBbox: s.region.bbox, releaseTag: s.releaseTag });
      return page;
    })();
    mapPage.catch(() => { mapPage = null; }); // a failed load is tried again on the next visit instead of staying broken
  }
  return mapPage;
}

async function route() {
  const [path, query] = (location.hash.replace(/^#\//, "") || "map").split("?");
  const q = new URLSearchParams(query);
  document.querySelectorAll<HTMLAnchorElement>("[data-route]").forEach((a) => a.classList.toggle("active", a.dataset.route === (path === "catalog" ? "data" : path)));
  const s = await state;
  const isMap = path === "map" || path === "sim" || !["data", "catalog", "methods", "validation"].includes(path);
  document.body.dataset.page = isMap ? "map" : "doc";
  doc.hidden = isMap;
  if (isMap) {
    const page = await ensureMap(q.get("at"));
    page.el.hidden = false;
    page.setTab(path === "sim" ? "sim" : "layers");
    page.map.resize();
    return;
  }
  if (mapPage) (await mapPage).el.hidden = true; // kept alive: a finished simulation stays when you come back
  if (path === "data" || path === "catalog") renderCatalog(doc, { ...s, focus: q.get("d") ?? undefined });
  else if (path === "validation") renderValidation(doc, validation);
  else {
    const { renderMethods } = await import("./methods/page");
    renderMethods(doc);
  }
  const focus = path === "data" || path === "catalog" ? q.get("d") : null;
  const el = focus ? doc.querySelector<HTMLElement>(`#ds-${CSS.escape(focus)}`) : null;
  if (el) { // "Sumber" link from a map layer: open that dataset's card, scroll to it and mark it
    el.querySelector("details")?.setAttribute("open", "");
    el.classList.add("hit");
    requestAnimationFrame(() => el.scrollIntoView({ block: "start", behavior: "smooth" }));
  } else app.scrollTo(0, 0);
}

function applyTheme(theme: string | null) {
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}
try { applyTheme(localStorage.getItem("b3d.theme")); } catch { /* ignore */ }
document.querySelector("#theme-toggle")!.addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  const next = dark ? "light" : "dark";
  applyTheme(next);
  try { localStorage.setItem("b3d.theme", next); } catch { /* ignore */ }
});
const langBtn = document.querySelector<HTMLButtonElement>("#lang-toggle")!;
langBtn.textContent = lang === "id" ? "ID" : "EN";
applyStatic();
langBtn.addEventListener("click", () => { setLang(lang === "id" ? "en" : "id"); location.reload(); }); // full re-render in the new language
window.addEventListener("hashchange", () => { route().catch(showError); });
route().catch(showError);
