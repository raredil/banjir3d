# CORE: Operating System for Repo-Based AI Projects (Route B/C)

> **To the AI:** This file defines HOW you work. WHAT to build is in `BLUEPRINT.md` (made with `START.md`). Technical depth is in the module file(s): `MODULE_GAME.md`, `MODULE_APP.md`, `MODULE_MIGRATE.md`. Shared rules: `SECURITY.md`, `TOOLS.md`. Read this file once at project start; after that `CLAUDE.md` and `HANDOFF.md` guide each session.

## 1. Reading the documents
| Label | Meaning | Your freedom |
|---|---|---|
| **[MUST]** | Owner requirements (all of BLUEPRINT's MUST list, plus MUST items here). | Never weaken or reinterpret. If impossible, explain why and propose the closest alternative. |
| **[HYPOTHESIS]** | Starting ideas. | Test; replace with better options when evidence supports it; record why (ADR). |
| **[EXPLORE]** | Open questions. | Research, prototype, compare, then decide or present options. |
Go deeper than these documents when it helps and every MUST stays satisfied. Phases, gates and steps in all kit files are examples: adapt number, order and size to the project and route. Scale to the idea: small idea → small polished build; huge idea → full depth. If there is no BLUEPRINT.md yet, follow `START.md` using the owner's first message, save BLUEPRINT.md, then continue.

## 2. The owner
- **Not a programmer.** Never ask him to read/edit code, run commands or debug. When he must act, give numbered click-by-click steps.
- His language (often Indonesian), simple words, short messages.
- Every build opens with one click, link or double-click. Add a 3-line "How to open" note at every gate.
- **Limited usage plan.** Protect his quota (§4). **All operation must be free** (§10).

## 3. Sessions
**Start:** read `CLAUDE.md` → `HANDOFF.md` → continue from "Next steps". Read other documents only in the sections you need.
**During:**
- Work autonomously through as many steps as possible. Never split work artificially.
- Stop and wait ONLY for: look/style choice, technology choice, logo/name choice, installs on the owner's computer, anything that costs money, deleting work or features, irreversible choices that could reasonably go either way.
- Every test/build/benchmark/capture command has a **5-minute limit**. Two timeouts → record as failed with the reason and move on.
- Cloud sessions usually have no GPU: label screenshots "software-rendered, not final quality"; never judge real performance in the cloud. Skip tools that cannot run here and say so.
**Length:** move to a new session only when the context is about half full or after compaction makes work less accurate.
**Branch rule:** all finished work is on `main` before a session ends (push, or open a PR and merge it yourself). Merge stranded branches into `main` first. No parallel sessions unless the owner asks.
**End:** update HANDOFF.md (Appendix A), commit, merge to `main`, then one line: **"Start a new session and type: continue from HANDOFF.md"**.

## 4. Token efficiency without quality loss
- No restating documents, no long narration. Never print whole files into chat. Small diffs.
- Content is data, not code. Research in batches into `/research/`, never twice; store facts and sources, not prose.
- Search before opening files; read only what you need. Scripts for checks. Screenshots reviewed as downscaled contact sheets.
- No subagents/parallel work unless the gain is clear. Lighter model for routine work when a choice exists.
- Value order: core loop / main task first, content later. Never mass-produce content on an unlocked look or unproven system.
- Tools only per `TOOLS.md`. Turn repeated procedures into project skills (`TOOLS.md` §4).

## 5. Documentation (each file short)
`CLAUDE.md` · `HANDOFF.md` (≤150 lines) · `README.md` (how to open, codes) · `ROADMAP.md` (phases, gates, status, **current position**) · `BACKLOG.md` (deferred items with target phase) · `/docs/adr/` · `/docs/ASSUMPTIONS.md` · `/docs/REVIEW_LOG.md` · `/docs/DESIGN_SYSTEM.md` · `/docs/SECURITY_LOG.md` · `/docs/LICENSES.md` · module-specific docs.

## 6. Review Gates and previews [MUST]
1. Finish a stage → preview package → deliver (platform file sharing, else `/previews/<gate>/` + path).
2. **Keep working** after sending previews, except stop-and-wait items (§3).
3. Package (as relevant): labeled contact sheet · multiple angles/states · in-context shot · reference comparison (credited) · frame strips + short GIF for motion · metrics card · stamp (ID, commit, date, preset) · `index.html` gallery. Deterministic capture (fixed seed, camera, time).

## 7. Quality and honesty
- **Original work only:** references for mood and quality bar; never copy assets, UI, logos, characters, trademarks.
- One unified style across the product (logo, icon, screens, fonts, icons, sounds, world). Original logo/icon options at a gate.
- Never invent facts; real-world data with multiple sources and confidence tags (`verified` / `conflicting` / `estimated`).
- Never mark work done if it is not; keep "Known gaps". Never promise "bug-free"; say what was tested.
- Tests: core logic, data validators, smoke test that opens the build, screenshot regression for approved visuals, performance checks.

## 8. Feedback and roadmap anchor [MUST]
The roadmap is the anchor. Feedback must improve the work **without derailing it**.
1. **Triage** every owner comment into:
   - **NOW**: small fix to current work → do it.
   - **RULE**: a direction change (look, mechanic, concept) → apply to current work **and** write it into the bible/spec (ART_BIBLE, DESIGN_SYSTEM, BLUEPRINT) so every later phase inherits it.
   - **LATER**: belongs to a future phase → add to `BACKLOG.md` with the target phase.
2. **Detour budget:** if a topic takes more than ~3 rounds, stop iterating one by one: show 2–3 clear options side by side, let the owner pick, then lock it.
3. **Return:** after resolving, update `ROADMAP.md` current position and post one line: "Back to Phase X, step Y." Then continue the plan.
4. A big RULE may change later phases: update ROADMAP and say in 1–2 lines what changed. Never silently drop phases.
5. **Lock early on a small sample:** before mass production of anything (assets, levels, screens, mechanics), make a **golden sample** at final quality and get the look/feel locked. Later phases scale from it. Full polish of every item still happens later; the direction does not change late.

## 9. Visual quality bar [MUST]
- Visuals must always look professional and intentional. Never ship default/generic looks (plain boxes, default fonts, random colors).
- Art direction first (mood, palette, light, shape language, typography), then build.
- Use the best free helpers available per `TOOLS.md` §5 (e.g., the official frontend-design skill for UI).
- **Self-review loop** before showing the owner: screenshot → check hierarchy, spacing, alignment, typography, color harmony, contrast, lighting/shading, consistency with the bible, readability on small screens → fix → recheck.
- When unsure, show 2–3 variants instead of guessing.

## 10. Free operation
Only the owner's existing subscription and free services (free tiers, open-source, GitHub Pages, free fonts/assets with clear licenses). If something needs payment, stop and propose a free alternative.

## 11. Security
Follow `SECURITY.md` fully. Security research at project start and before each release. Security changes must never break features or open new holes.

## 12. Codes
Redeem/voucher codes are reusable unless BLUEPRINT says otherwise. Owner-specified codes always work. List all codes in README and HANDOFF under **CODES**.

## Appendix A: HANDOFF.md
```
# HANDOFF
Updated: <date> | Commit: <hash> | Phase: <Pn, step> | Waiting for owner: <yes: what / no>
## How to open the current build
## What works
## Broken / Known gaps
## Locked decisions (look, mechanics, tech) with links
## Decisions since last handoff (ADR links)
## Owner feedback: applied / in BACKLOG
## Security status (last check date, open items)
## Next steps (ordered, specific, file paths)
## File map (key files, project skills)
## CODES
```

## Appendix B: Gate message
```
Gate <id>: <name>
Look at: <list>   Files: <gallery path/link>
How to open: <3 lines>
Decision needed: <only stop-and-wait items; max 3 questions with defaults>
Continuing with: <1 line>
```
