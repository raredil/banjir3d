import { describe, expect, it } from "vitest";
import md from "../../../data/methods/methods.md?raw";
import data from "../../../data/methods/references.json";
import { citeAuthors, citeNarrative, citeParen, citedKeys, parseBlocks, refEntry, renderHtml, renderMarkdown, toBibtex, type Ref } from "./cite";

const REFS = data.references as Ref[];
const BY = new Map(REFS.map((r) => [r.key, r]));

describe("Harvard citations", () => {
  it("lists up to three authors and uses et al. from four", () => {
    expect(citeAuthors(BY.get("chow1959")!)).toBe("Chow");
    expect(citeAuthors(BY.get("dealmeida2013")!)).toBe("de Almeida and Bates");
    expect(citeAuthors(BY.get("bates2010")!)).toBe("Bates, Horritt and Fewtrell");
    expect(citeAuthors(BY.get("leijnse2021")!)).toBe("Leijnse et al.");
    expect(citeParen([BY.get("bates2010")!, BY.get("leijnse2021")!])).toBe("(Bates, Horritt and Fewtrell, 2010; Leijnse et al., 2021)");
    expect(citeNarrative(BY.get("hecras2d")!)).toBe("USACE HEC (no date)");
  });
  it("formats a journal article with volume, issue, pages and DOI link", () => {
    expect(refEntry(BY.get("bates2010")!).text).toBe(
      "Bates, P.D., Horritt, M.S. and Fewtrell, T.J. (2010) 'A simple inertial formulation of the shallow water equations for efficient two-dimensional flood inundation modelling', Journal of Hydrology, 387(1–2), pp. 33–45. Available at: https://doi.org/10.1016/j.jhydrol.2010.03.027.");
  });
});

describe("Methods text and reference list", () => {
  const keys = citedKeys(md);
  it("cites only references that exist", () => {
    expect(keys.filter((k) => !BY.has(k))).toEqual([]);
  });
  it("lists only references that are cited", () => {
    expect(REFS.map((r) => r.key).filter((k) => !keys.includes(k))).toEqual([]);
  });
  it("gives every non-book reference a DOI or URL, and unique in-text labels", () => {
    expect(REFS.filter((r) => r.type !== "book" && r.type !== "standard" && !r.doi && !r.url).map((r) => r.key)).toEqual([]);
    const labels = REFS.map((r) => citeNarrative(r));
    expect(new Set(labels).size).toBe(labels.length);
  });
  it("renders without unresolved markers and escapes text", () => {
    const blocks = parseBlocks(md);
    const html = renderHtml(blocks, BY);
    expect(html).not.toMatch(/\[@|(^|\s)@[a-z]/);
    expect(renderMarkdown(blocks, BY, REFS)).toContain("## References");
    expect(renderHtml(parseBlocks("a <b> [@chow1959]"), BY)).toBe('<p>a &lt;b&gt; <a class="incite" href="#ref-chow1959">(Chow, 1959)</a></p>');
    expect(() => renderHtml(parseBlocks("[@nope2000]"), BY)).toThrow();
  });
  it("keeps paragraphs whole: each starts with a capital letter, ends with a full stop and has at least two sentences", () => {
    const paras = parseBlocks(md).filter((b) => b.kind === "p");
    expect(paras.length).toBeGreaterThan(15);
    for (const p of paras) {
      expect(p.text).toMatch(/^[A-Z]/);
      expect(p.text).toMatch(/\.$/);
      expect(p.text.split(/\.\s+(?=[A-Z])/).length).toBeGreaterThanOrEqual(2);
    }
  });
  it("exports BibTeX with one entry per reference", () => {
    expect(toBibtex(REFS).match(/^@/gm)).toHaveLength(REFS.length);
  });
});
