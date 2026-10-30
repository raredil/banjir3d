import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "./style.css";
import validation from "../../data/validation.json";
import { renderCatalog, renderValidation } from "./catalog";
import { applyStatic, lang, setLang } from "./i18n";
import type { MapPage } from "./map";
import type { Catalog, DataCheck, Manifest } from "./types";
import { fetchJson } from "./util";

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
  app.scrollTo(0, 0);
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
window.addEventListener("hashchange", route);
route();
