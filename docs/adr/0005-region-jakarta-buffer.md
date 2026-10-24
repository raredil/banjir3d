# ADR 0005 — Main region = mainland DKI Jakarta + 10 km buffer
Date: 2026-10-24 · Status: accepted (owner correction to A6)

**Decision.** The main simulation region is the five mainland cities of DKI Jakarta (Jakarta Barat, Pusat, Selatan, Timur, Utara), dissolved and buffered **10,000 m** outward. Kabupaten Administrasi Kepulauan Seribu is excluded completely. Land and sea inside the buffer are kept, including parts of Tangerang/Tangerang Selatan (Banten) and Bekasi/Depok/Bogor (Jawa Barat). This replaces the Jabodetabek box (106.35–107.35 E, 5.90–6.85 S). The 10 × 10 km Kampung Melayu–Manggarai sample (A7) stays, for 3D look tests only.

**How.** `pipeline/make_domain.py jakarta` → `data/regions/jakarta_domain.geojson` (feature `domain` = buffer, feature `admin` = DKI outline). Boundaries: geoBoundaries gbOpen IDN ADM2 (source BPS / WFP / OCHA ROAP 2020, CC BY 3.0 IGO); file SHA-256 stored in the GeoJSON. Buffer computed in UTM 48S (EPSG:32748), 32 segments per quarter circle. Result: DKI mainland 643 km², domain 2,129 km², bbox 106.595–107.064 E, 5.998–6.462 S. Rasters are built on the bbox (rectangle); vectors are clipped to the domain; the simulation masks cells outside the domain.

**Consequences.**
- DEMNAS needs 6 of the 25 uploaded sheets (1209-41, -42, -43, -44, -51, -53); the other 19 stay in the private release, unused.
- The upper Ciliwung/Cisadane/Bekasi catchments (Bogor, Puncak) are outside the domain. Water arriving from upstream must enter as **river inflow boundary conditions** (gauge or upstream-model discharge, e.g. Katulampa/Depok) — to be designed in Phase 2. Rain falling inside the domain is simulated directly.
- The north buffer reaches ~10 km into Jakarta Bay: room for a tide boundary.
- Region pack and web map now use region id `jakarta`.
