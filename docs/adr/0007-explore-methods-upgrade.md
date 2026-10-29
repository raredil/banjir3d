# ADR 0007: Explore engine v1, documented inputs and a citable Methods page

Status: accepted (2026-10-29). Partly supersedes ADR 0006 (boundaries, rain, presets, roughness range).

## Context
Owner (2026-10-29): the tool must be defensible at an international seminar; methods need full text with Harvard citations and links to peer-reviewed sources; methods should be improved where possible; he wants to draw his own simulation box. Audit of the chat-session code found: arbitrary rain presets (50/100/150 mm/h) and a 20 mm/h drainage default; an open north edge with an arbitrary fixed slope 0.0005 and uniform n even when the n field was used; a wrong comment (theta attributed to Bates 2010, it is de Almeida et al. 2012); built-up low/high n "assumed".

## Decision
- Boundaries: each edge open or closed. Open = transmissive (zero-gradient) outflow, capped at critical flow, no inflow from outside; no slope parameter. Default open on all four edges; the SFINCS check case uses closed walls.
- Rain: (a) design storm from R24 with the Mononobe relation and hourly alternating blocks (Chow et al. 1988); (b) typed hourly depths (validated, 0–500 mm, ≤ 72 h); (c) constant intensity. Default = 1 Jan 2020 event, 377 mm/day at Halim (Lubis et al. 2022), 24 h, 30 h simulated. Presets: only this event and the SFINCS check case. Drainage default 0 (no open source for sewer capacity).
- Roughness: built-up low/high now 0.12/0.20 = HEC-RAS 2D range for Developed, High Intensity (was 0.10/0.20 assumed). Table v0.2.0.
- Verification: new analytical test (Hunter et al. 2005) in the unit tests and `verification/analytical-wave/`.
- Area: user can draw a box inside the region pack bbox; grids above 160,000 cells are block-averaged (k × k) to keep runs interactive; deep link `#/sample?box=W,S,E,N`.
- Flooded-area statistic uses 0.15 m (BLUEPRINT 8 class bound, above the 0.05 m wet/dry limit), not 0.1 m.
- Methods page `#/methods`: text in `data/methods/methods.md`, references in `data/methods/references.json` (content is data), Harvard (Cite Them Right) rendering, downloads METHODS.md and .bib; tests fail if a citation has no reference, a reference is not cited, or a non-book reference has no DOI/URL. Facts and their checks: `research/phase2-methods-sources.md`.

## Not done (BACKLOG)
Infiltration, canal burning, tide, clickable inflow point, EA benchmarks, observed-event validation, hourly rain of 1 Jan 2020 from IMERG, reading the SNI 2415:2016 text itself.
