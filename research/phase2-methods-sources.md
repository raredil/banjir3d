# Phase 2 methods: verified sources (2026-10-29, Claude Code web search)
Facts used by the Methods page (`data/methods/`). Confidence: **verified** = DOI/volume/pages confirmed by two independent listings; **verified-1** = one listing; **book** = textbook, no DOI.
Network note: doi.org, crossref, arxiv, publisher sites are blocked from the cloud session (DNS); facts come from web search summaries. Recheck DOIs in a GitHub Action if needed.

| Key | Fact | Confidence |
|---|---|---|
| bates2010 | Bates, Horritt, Fewtrell (2010) J. Hydrol. 387(1–2) 33–45, doi:10.1016/j.jhydrol.2010.03.027. Local-inertial scheme, explicit, CFL dt = alpha dx / sqrt(g h_max). | verified |
| dealmeida2012 | de Almeida, Bates, Freer, Souvignet (2012) WRR 48, W05528, doi:10.1029/2011WR011570. Theta-weighted flux to fix instability in low-friction areas. | verified |
| dealmeida2013 | de Almeida, Bates (2013) WRR 49(8) 4833–4844, doi:10.1002/wrcr.20366. Applicability limits of local inertial; Test case: non-breaking wave over horizontal plane, analytical solution from Hunter et al. (2005). | verified |
| hunter2005 | Hunter, Horritt, Bates, Wilson, Werner (2005) Adv. Water Resour. 28, 975–991, doi:10.1016/j.advwatres.2005.03.007. Analytical solution h(x,t) = [-(7/3) n² u² (x − u t)]^(3/7), boundary h(0,t) = [(7/3) n² u³ t]^(3/7) (derived again here from the friction-dominated momentum equation; matches a 2025 secondary source). | verified (citation); formula re-derived |
| leijnse2021 | Leijnse, van Ormondt, Nederhoff, van Dongeren (2021) Coastal Eng. 163, 103796, doi:10.1016/j.coastaleng.2020.103796. SFINCS, compound flooding; advection needed only for shocks (dam break, broken waves). | verified |
| vanormondt2025 | van Ormondt, Leijnse, de Goede, Nederhoff, van Dongeren (2025) GMD 18, 843–861, doi:10.5194/gmd-18-843-2025. Subgrid corrections for linear inertial equations, SFINCS 2.1.1. | verified |
| sfincs-docs | SFINCS docs: huthresh default 0.05 m (range 0.001–0.1); theta default 1.0 (range 0.8–1.0) in v2.3.x; alpha default differs by version (0.5 in v2.3.1, 0.75 in v2.0.1). Our parity run set alpha = 0.5 explicitly. | verified-1 |
| hawker2022 | FABDEM: Hawker et al. (2022) ERL 17, 024016, doi:10.1088/1748-9326/ac4d4f (catalog, Phase 0). | verified (Phase 0) |
| zanaga2022 | ESA WorldCover 2021 v200, doi:10.5281/zenodo.7254221, CC BY 4.0, 11 classes. | verified |
| neelz2013 | Néelz, Pender (2013) Benchmarking the latest generation of 2D hydraulic modelling packages, Report SC120002, Environment Agency, Bristol. gov.uk publication page. 19 packages. | verified |
| hecras-lc | HEC-RAS 2D manual, land classification table: Developed High Intensity (NLCD 24) n = 0.12–0.20; values after Chow (1959); note: for appreciable depths, shallow overland flow values are much higher. URL hec.usace.army.mil/confluence/rasdocs/rmum/6.6/land-classification-layers | verified-1 |
| chow1959 | Chow (1959) Open-Channel Hydraulics, McGraw-Hill. | book |
| chow1988 | Chow, Maidment, Mays (1988) Applied Hydrology, McGraw-Hill, ISBN 0-07-010810-2. Alternating block method (design storms chapter). | book |
| arcement1989 | Arcement, Schneider (1989) USGS WSP 2339, pubs.usgs.gov/wsp/2339/report.pdf | verified (Phase 2 table) |
| beretta2018 | Beretta, Ravazzani, Maiorano, Mancini (2018) Geosciences 8(2) 77, mdpi.com/2076-3263/8/2/77 | verified (Phase 2 table) |
| lubis2022 | Lubis et al. (2022) GRL 49(22), doi:10.1029/2022GL101513. 1 Jan 2020: up to 377 mm/day at Halim Perdanakusuma, highest since 1866. Authors: Lubis S.W., Hagos S., Hermawan E., Respati M.R., Ridho A., Risyanto, Paski J.A.I., Muhammad F.R., Siswanto, Ratri D.N., Setiawan S., Permana D.S. Article number e2022GL101513 not confirmed. | verified (DOI) |
| maitsa2021 | Maitsa, Kuntoro, Septiadi (2021) Jurnal Teknik Sipil ITB 28(2) 163–172, doi:10.5614/jts.2021.28.2.5. Kemayoran/Citeko: rain mostly < 4 h, largest share in the first 2 h; ABM and modified Mononobe differ from observed intensities by > 14 % on average; Mononobe higher than observed at Kemayoran. | verified-1 |
| sni2415 | SNI 2415:2016 Tata cara perhitungan debit banjir rencana (BSN). Whether the standard itself prescribes Mononobe is NOT verified (text not reachable); methods text only says maitsa2021 compared Mononobe with the SNI procedure. Mononobe I = (R24/24)(24/t)^(2/3). | standard, cited by maitsa2021 |
| abidin2011 | Abidin et al. (2011) Nat. Hazards 59(3) 1753–1771, doi:10.1007/s11069-011-9866-9. Jakarta subsidence. | verified |
| stephens2014 | Stephens, Schumann, Bates (2014) Hydrol. Process. 28(18) 4928–4937, doi:10.1002/hyp.9979 (online 2013). Binary pattern measures (CSI) not consistent across flood sizes. | verified |
| toro2001 | Toro (2001) Shock-Capturing Methods for Free-Surface Shallow Flows, Wiley. Transmissive boundary conditions. | book |

Not usable (could not verify DOI): Hall (2015) direct rainfall paper.
