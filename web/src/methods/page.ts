import md from "../../../data/methods/methods.md?raw";
import data from "../../../data/methods/references.json";
import { lang, t } from "../i18n";
import { parseBlocks, refEntry, renderHtml, renderMarkdown, sortRefs, toBibtex, type Ref } from "./cite";

const REFS = data.references as Ref[];
const BY_KEY = new Map(REFS.map((r) => [r.key, r]));

const download = (name: string, text: string, type: string) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

export function renderMethods(root: HTMLElement) {
  const blocks = parseBlocks(md);
  const list = sortRefs(REFS);
  root.innerHTML = `
    <div class="doc">
      <article class="card prose">
        ${lang === "id" ? `<div class="note">${t("me.lang")}</div>` : ""}
        <div class="row" style="margin-bottom:12px"><button class="btn small" id="me-md" type="button">${t("me.md")}</button><button class="btn small" id="me-bib" type="button">${t("me.bib")}</button></div>
        ${renderHtml(blocks, BY_KEY)}
        <h2>References</h2>
        <ol class="refs">${list.map((r) => `<li id="ref-${r.key}">${refEntry(r).html}</li>`).join("")}</ol>
        <p class="help">${t("me.note")}</p>
      </article>
    </div>`;
  root.querySelector("#me-md")!.addEventListener("click", () => download("METHODS.md", renderMarkdown(blocks, BY_KEY, list), "text/markdown"));
  root.querySelector("#me-bib")!.addEventListener("click", () => download("METHODS-REFERENCES.bib", toBibtex(list), "application/x-bibtex"));
}
