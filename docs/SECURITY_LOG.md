# Security log
| Date | Source | Finding | Action |
|---|---|---|---|
| 2026-10-23 | npm audit (web, 66 packages) | 0 vulnerabilities | latest versions pinned in package.json + lockfile |
| 2026-10-23 | pip-audit (pipeline/requirements.txt) | No known vulnerabilities | pinned; pip-audit in CI |
| 2026-10-23 | Design review | Static site, no backend, no login, no secrets; CSP `default-src 'self'` + OpenFreeMap only; all catalog/manifest text HTML-escaped (`esc`), links limited to http(s) (`safeUrl`) | tests in `web/src/util.test.ts` |
| 2026-10-23 | Workflows | Actions pinned by commit SHA; `persist-credentials: false`; least-privilege `permissions` per job (write only for release publishing / Pages) | — |
| 2026-10-23 | DEMNAS | Unknown redistribution terms → private draft release only (ADR 0002) | owner to confirm licence |
Dependabot added 2026-10-23 (npm, pip, actions; monthly). Open items: full CVE/advisory check of the stack before the first release gate.
