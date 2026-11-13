# What "bagus", "terbaik", "tidak boleh salah" mean for Banjir3D (owner 2026-11-13)

The owner's general words, turned into checks that can be passed or failed. Every release is held to these. Linked from CLAUDE.md and BLUEPRINT.

## 1. Benar (correct science)
| Means | Check |
|---|---|
| Every number on screen comes from the run or from a named file | Conclusion, KPIs and AI file are built only from run results, `data/*.json` and `data/methods/*`; tests in `web/src/sim/conclusion.test.ts`, `ai-context.test.ts` |
| Methods text = code | Methods page states the values the code uses (α, n, CN, thresholds); changes go to both in the same commit |
| Validation rules cannot flatter the model | Report hits on land only, with a random baseline and skill (`verification/observed/compare.py`, test `test_compare.py`); old figures replaced, not kept beside new ones |
| No hidden tuning | Any setting that differs from the physical value (pumps off, drain sink 0) is labelled with why, in the app and the AI file |
| Water balance closes | Mass error below 1e-6 on every run (shown in Neraca air) |
| Same inputs give the same numbers at every drawing size | 30 m and 10/5/2/1 m identical (ADR 0018/0019) |
| Uncertainty is stated next to the result | Conclusion "Seberapa bisa dipercaya" line with the three-flood scores |

## 2. Bisa dipertanggungjawabkan (defensible at an international forum)
| Means | Check |
|---|---|
| Methods cited to primary sources, each citation used for what the source actually says | references.json entries with DOI/URL; no citation added only to look rigorous |
| Data newest available, dated | Data page and AI file list year of each dataset |
| Reproducible | Every run exports JSON provenance (inputs, versions, totals); validation runs in a public Action with released outputs |
| Limits written before the reader asks | Methods §9, Validation page, AI file sections F–G |

## 3. Bisa dipahami (understandable by a non-specialist)
| Means | Check |
|---|---|
| Plain summary first, research text folded | Conclusion card |
| Body-scale words for depth (mata kaki, lutut, pinggang) | Conclusion summary |
| Every switch and layer says what it does and whether it is tested | "?" help, tags, layer roles |
| Another AI can explain the app without guessing | `banjir3d-konteks-ai.md` + "Salin untuk AI" |

## 4. Cepat dan tidak rusak (fast, no errors)
| Means | Check |
|---|---|
| A 4–5 km box at 30 m finishes in under a minute on a laptop CPU, faster with WebGPU | `verification/audit.cjs` (cloud CPU: 48 s for 12 h) |
| No error in the browser console during load, run, playback, export | audit script prints errors (must be empty) |
| Cards never cover the map centre; conclusion resizable and closable | screenshot review at 1440 × 900 and 390 × 844 |
| Every failure shows a copyable message | ADR 0015 error bar |

## 5. Keren (looks professional)
CORE §9 self-review on every visual change; one blue dashboard style; no default looks.
