import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "./style.css";
import { renderCatalog } from "./catalog";
import { applyStatic, lang, setLang } from "./i18n";
import type { Catalog, Manifest, VerifyReport } from "./types";
import { fetchJson } from "./util";

const REGION = "jabodetabek";
const DATA = `data/${REGION}`;
const app = document.querySelector<HTMLElement>("#app")!;
let current: { remove(): void } | null = null;

const state = (async () => {
  const [catalog, regions, manifest, verify, release] = await Promise.all([
    fetchJson<Catalog>("meta/catalog.json"),
    fetchJson<Record<string, { bbox: number[]; name: string }>>("meta/regions.json"),
    fetchJson<Manifest>(`${DATA}/manifest.json`),
    fetchJson<VerifyReport>(`${DATA}/verify-report.json`),
    fetchJson<{ tag: string }>(`${DATA}/release.json`),
  ]);
  return { catalog: catalog!, region: regions![REGION], manifest, verify, releaseTag: release?.tag ?? null };
})();

async function route() {
  const [path, query] = (location.hash.replace(/^#\//, "") || "map").split("?");
  document.querySelectorAll<HTMLAnchorElement>("[data-route]").forEach((a) => a.classList.toggle("active", a.dataset.route === path));
  const s = await state;
  current?.remove();
  current = null;
  if (path === "catalog") {
    document.body.dataset.page = "catalog";
    renderCatalog(app, { ...s, focus: new URLSearchParams(query).get("d") ?? undefined });
    if (!query) window.scrollTo(0, 0);
  } else {
    document.body.dataset.page = "map";
    const { renderMap } = await import("./map");
    current = await renderMap(app, { region: s.region, manifest: s.manifest, catalog: s.catalog, dataBase: DATA, at: new URLSearchParams(query).get("at") });
  }
}

function applyTheme(theme: string | null) {
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

try {
  applyTheme(localStorage.getItem("b3d.theme"));
} catch {
  /* ignore */
}
document.querySelector("#theme-toggle")!.addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === "dark"
    : matchMedia("(prefers-color-scheme: dark)").matches;
  const next = dark ? "light" : "dark";
  applyTheme(next);
  try {
    localStorage.setItem("b3d.theme", next);
  } catch {
    /* ignore */
  }
});
const langBtn = document.querySelector<HTMLButtonElement>("#lang-toggle")!;
const syncLang = () => {
  langBtn.textContent = lang === "id" ? "ID" : "EN";
  applyStatic();
};
langBtn.addEventListener("click", () => {
  setLang(lang === "id" ? "en" : "id");
  syncLang();
  route();
});
syncLang();
window.addEventListener("hashchange", route);
route();
