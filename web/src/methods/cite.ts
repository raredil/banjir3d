// Harvard (Cite Them Right) citations and a small Markdown subset for the Methods page. Pure functions, unit-tested.
// Text syntax: [@a] or [@a; @b] = parenthetical, @a = narrative, "## " heading, 4-space indent = equation line.
import { esc } from "../util";

export type Ref = {
  key: string; type: "article" | "book" | "report" | "dataset" | "standard" | "web"; authors: string[]; org?: boolean; short?: string; etal?: boolean;
  year: number | string; title: string; journal?: string; volume?: string; issue?: string; pages?: string; series?: string;
  place?: string; publisher?: string; isbn?: string; doi?: string; url?: string; accessed?: string;
};

const surname = (a: string) => a.split(",")[0].trim();
const yearOf = (r: Ref) => (r.year === "n.d." ? "no date" : String(r.year));

/** Author part of an in-text citation: up to three surnames, four or more = first surname et al. */
export function citeAuthors(r: Ref): string {
  if (r.org) return r.short ?? r.authors[0];
  const s = r.authors.map(surname);
  if (s.length >= 4 || r.etal) return `${s[0]} et al.`;
  return s.length === 1 ? s[0] : `${s.slice(0, -1).join(", ")} and ${s[s.length - 1]}`;
}
export const citeParen = (rs: Ref[]) => `(${rs.map((r) => `${citeAuthors(r)}, ${yearOf(r)}`).join("; ")})`;
export const citeNarrative = (r: Ref) => `${citeAuthors(r)} (${yearOf(r)})`;

const link = (r: Ref) => (r.doi ? `https://doi.org/${r.doi}` : r.url ?? "");
/** Author list for the reference list: "A, B and C"; organisations as written. */
const listAuthors = (r: Ref) => {
  const a = r.authors.slice();
  if (r.etal) a.push("et al.");
  return a.length === 1 ? a[0] : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;
};

/** One reference-list entry as [plain text, HTML]. Titles of books, reports and datasets in italics, journal names in italics. */
export function refEntry(r: Ref): { text: string; html: string } {
  const head = `${listAuthors(r)} (${yearOf(r)})`;
  let mid: string, midH: string;
  if (r.type === "article") {
    const vol = [r.volume, r.issue ? `(${r.issue})` : ""].join("");
    const tail = [vol, r.pages ? (/^[A-Z]?\d+$/.test(r.pages) ? r.pages : `pp. ${r.pages}`) : ""].filter(Boolean).join(", ");
    mid = `'${r.title}', ${r.journal}${tail ? ", " + tail : ""}.`;
    midH = `‘${esc(r.title)}’, <i>${esc(r.journal ?? "")}</i>${tail ? ", " + esc(tail) : ""}.`;
  } else {
    const kind = r.type === "dataset" ? " [Dataset]" : r.type === "web" ? " [Online]" : "";
    const pub = [r.series, r.place && r.publisher ? `${r.place}: ${r.publisher}` : r.publisher].filter(Boolean).join(". ");
    mid = `${r.title}${kind}.${pub ? " " + pub + "." : ""}`;
    midH = `<i>${esc(r.title)}</i>${kind}.${pub ? " " + esc(pub) + "." : ""}`;
  }
  const url = link(r);
  const acc = r.accessed ? ` (Accessed: ${r.accessed})` : "";
  const text = `${head} ${mid}${url ? ` Available at: ${url}${acc}.` : ""}`;
  const html = `${esc(head)} ${midH}${url ? ` Available at: <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>${esc(acc)}.` : ""}`;
  return { text, html };
}

/** Sort keys for the reference list: first author surname (ignoring "de", "van"), then year. */
export const sortRefs = (rs: Ref[]) =>
  rs.slice().sort((a, b) => {
    const k = (r: Ref) => surname(r.authors[0]).replace(/^(de|van|von)\s+/i, "").toLowerCase();
    return k(a).localeCompare(k(b)) || String(a.year).localeCompare(String(b.year));
  });

const CITE = /\[(@[\w-]+(?:\s*;\s*@[\w-]+)*)\]|@([a-z][a-z0-9]*)/g;

/** Keys cited in a text. */
export function citedKeys(md: string): string[] {
  const out = new Set<string>();
  for (const m of md.matchAll(CITE)) (m[1] ? m[1].split(";").map((s) => s.trim().slice(1)) : [m[2]]).forEach((k) => out.add(k));
  return [...out];
}

/** Replace citation markers with Harvard citations (HTML: a link to the reference-list entry). Unknown keys throw. */
function cite(text: string, refs: Map<string, Ref>, html: boolean): string {
  return text.replace(CITE, (_all, group: string | undefined, one: string | undefined) => {
    const keys = group ? group.split(";").map((s) => s.trim().slice(1)) : [one!];
    const rs = keys.map((k) => refs.get(k));
    if (rs.some((r) => !r)) throw new Error(`unknown citation key in ${keys.join(",")}`);
    const c = group ? citeParen(rs as Ref[]) : citeNarrative(rs[0]!);
    return html ? `<a class="incite" href="#ref-${keys[0]}">${esc(c)}</a>` : c;
  });
}

export type Block = { kind: "h1" | "h2" | "p" | "eq"; text: string };

/** Split the Markdown subset into blocks. */
export function parseBlocks(md: string): Block[] {
  const out: Block[] = [];
  for (const chunk of md.replace(/\r/g, "").split(/\n\s*\n/)) {
    const c = chunk.replace(/\s+$/, "");
    if (!c.trim()) continue;
    if (c.startsWith("# ")) out.push({ kind: "h1", text: c.slice(2).trim() });
    else if (c.startsWith("## ")) out.push({ kind: "h2", text: c.slice(3).trim() });
    else if (c.startsWith("    ")) out.push({ kind: "eq", text: c.split("\n").map((l) => l.slice(4)).join("\n") });
    else out.push({ kind: "p", text: c.split("\n").map((l) => l.trim()).join(" ") });
  }
  return out;
}

/** Render blocks to HTML (all text escaped; only citation links are generated markup). */
export function renderHtml(blocks: Block[], refs: Map<string, Ref>): string {
  return blocks.map((b) => {
    if (b.kind === "eq") return `<pre class="eq">${esc(b.text)}</pre>`;
    const inner = cite(esc(b.text), refs, true);
    return b.kind === "p" ? `<p>${inner}</p>` : `<${b.kind}>${inner}</${b.kind}>`;
  }).join("\n");
}

/** Plain Markdown with citations written out and a reference list, for download. */
export function renderMarkdown(blocks: Block[], refs: Map<string, Ref>, list: Ref[]): string {
  const body = blocks.map((b) => (b.kind === "h1" ? `# ${b.text}` : b.kind === "h2" ? `## ${b.text}` : b.kind === "eq" ? b.text.split("\n").map((l) => "    " + l).join("\n") : cite(b.text, refs, false)));
  return `${body.join("\n\n")}\n\n## References\n\n${sortRefs(list).map((r) => refEntry(r).text).join("\n\n")}\n`;
}

/** BibTeX for the reference list. */
export function toBibtex(list: Ref[]): string {
  const type = { article: "article", book: "book", report: "techreport", dataset: "misc", standard: "misc", web: "misc" } as const;
  const f = (k: string, v: string | undefined) => (v ? `  ${k} = {${v}},\n` : "");
  return sortRefs(list).map((r) => {
    const author = r.org ? `{${r.authors[0]}}` : r.authors.join(" and ") + (r.etal ? " and others" : "");
    return `@${type[r.type]}{${r.key},\n${f("author", author)}${f("title", `{${r.title}}`)}${f("journal", r.journal)}${f("volume", r.volume)}${f("number", r.issue)}${f("pages", r.pages?.replace("–", "--"))}${f(r.type === "report" ? "institution" : "publisher", r.publisher)}${f("address", r.place)}${f("series", r.series)}${f("isbn", r.isbn)}${f("year", r.year === "n.d." ? undefined : String(r.year))}${f("doi", r.doi)}${f("url", r.doi ? undefined : r.url)}${f("urldate", r.accessed)}}\n`;
  }).join("\n");
}
