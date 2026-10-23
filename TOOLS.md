# TOOLS: Skills, plugins, MCP servers and efficiency tools

> Used by `START.md` and `CORE.md`. Rule: **evidence over hype**. Claims like "70x fewer tokens" or "1000% better" are marketing until measured on this project.

## 1. Adoption rule
A tool is adopted only if all are true:
1. It solves a real problem in **this** project (size, language, workflow).
2. It is free and works in the environment (cloud session, chat, owner's device).
3. It passes `SECURITY.md` §5.
4. A quick before/after test on this project shows a gain (tokens, quality or speed) **without** loss in accuracy.
Record the decision, test result, source, version and license in an ADR. Remove tools that stop helping. Every installed tool also costs context tokens (its instructions and tool list), so fewer is better.

## 2. Free built-in savings (always use; biggest gain for small/medium projects)
- `CLAUDE.md` + `HANDOFF.md`: new sessions read a short summary, not the whole history.
- Targeted reading: search first, read only needed parts of files.
- Small edits (diffs) instead of rewriting files. Claude Code's edit tool already replaces only the changed text.
- Data-driven content, scripts for checks, contact sheets for screenshots.
- Session discipline (`CORE.md` §3) and model choice (lighter model for routine work when available).
- Write **project skills** for repeated procedures (§4).

## 3. Candidate tools (checked Oct 2026; re-check before use)
| Tool | What it does | Real gain | Hidden costs / risks |
|---|---|---|---|
| **Code knowledge graph** (e.g., Graphify `safishamsi/graphify`, code-review-graph) | Builds a map of files, functions and links; the agent queries it instead of reading many files. | Large on big codebases queried often (reports say useful from ~500+ files). | Build time and tokens up front; **graph goes stale** when code changes (wrong answers if not rebuilt); can miss links; little or negative gain on small projects. Rule: rebuild at session start, and always confirm with the real file before editing. |
| **Semantic code tools** (e.g., Serena `oraios/serena`, MCP) | Finds and edits code by symbol (function/class) using language servers, without reading whole files. | Good on large code in supported languages. | Setup on the machine; adds many tool definitions (context cost); weaker for HTML/CSS/data files; edits still need tests. |
| **Output compression** (e.g., Headroom `chopratejas/headroom`) | Compresses long tool outputs/logs; keeps originals retrievable. | Reported roughly 47–92% on output-heavy work. | Extra layer to set up; detail may hide inside compressed text, so fetch the original before decisions. |
| **Terse-reply skill** (e.g., Caveman `JuliusBrussee/caveman`) | Makes the agent answer very briefly. | About 65% fewer **output** tokens. | Does not reduce input tokens; very short replies can confuse a non-programmer. Use only for internal work, never for owner messages. |
| **Anthropic frontend-design skill** (`anthropics/skills`) | Pushes distinctive, non-generic UI design. | Better visual quality. | Official source; low risk. Recommended for any UI. |
| **Vercel agent skills** (`vercel-labs/agent-skills`) | UI audit (accessibility, performance, UX rules), React patterns. | Quality checks. | Only for web/React projects. |
| **UI/UX Pro Max** (`nextlevelbuilder/ui-ux-pro-max-skill`) | Database of styles, palettes, font pairs. | Faster style exploration. | Community skill: review before use. |
| **AccessLint** (`accesslint/claude-marketplace`) | Accessibility and contrast audits. | Quality checks. | Community: review before use. |

None of these is required. For most of the owner's projects (single-file to medium size), §2 gives most of the savings with zero risk. Consider graph/semantic tools only when a project grows large.

## 4. Self-made project skills (create them during work)
When a procedure repeats 2+ times (e.g., "capture previews and build a contact sheet", "add a batch of 10 vehicles", "run the release security checklist"), write it as a project skill so future sessions follow it without re-thinking:
- Location in repos using Claude Code: `.claude/skills/<name>/SKILL.md` (short description + exact steps + scripts in the same folder).
- Keep each skill small and specific. Test it once. List it in HANDOFF "File map".
- In chat builds (Route A), keep the same steps as a short "Recipes" section in the HANDOFF block.

## 5. Visual quality helpers (free)
- Official frontend-design skill for UI; the module's art bible for in-game visuals.
- A **self-review loop**: render → screenshot → check against the checklist in `CORE.md` §9 → fix → compare again.
- Free fonts (e.g., Google Fonts) and free assets only with a clear license; log them.
