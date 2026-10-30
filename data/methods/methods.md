# Methods of the Banjir3D flood engine (version 2)

This text describes only what the running system does. Every number the engine uses is either read from a named dataset or fixed by a cited method; the user sets only external forcing (rain, sea level and simulated time).

## 1. Model domain and grid

The model grid is the FABDEM V1-2 bare-earth terrain [@hawker2022] reprojected to WGS 84 / UTM zone 48S at 30 m, covering mainland DKI Jakarta plus a 10 km buffer (about 52 × 51 km, 2.98 million cells). Cells outside the buffer polygon are inactive, and a run can also use a user-drawn box or blocks of 2 × 2 or 3 × 3 cells (60 m or 90 m) for faster runs.

## 2. Hydrodynamics

The engine solves the two-dimensional shallow water equations in the local inertial form of @bates2010, the scheme used by LISFLOOD-FP and, without advection, by SFINCS [@leijnse2021; @vanormondt2025]. The momentum equation for the unit-width discharge q in each direction is the following.

    ∂q/∂t + g h ∂η/∂x + g n² q |q| / h^(7/3) = 0

Here h is depth, η = z + h the water level, g gravity and n Manning's coefficient; friction is treated semi-implicitly and the face depth is the difference between the higher water level and the higher bed of the two cells, as in @bates2010. The local inertial form is accurate for the low-Froude flow typical of urban floodplains and loses accuracy near critical flow [@dealmeida2013], so face discharge is capped at the critical value h√(gh).

The time step follows the Courant condition Δt = α Δx / √(g h_max) with α = 0.5 and an upper limit of 15 s. Mass is conserved by updating depth from the net face fluxes, and a limiter scales outgoing fluxes so that no cell gives away more water than it holds. A face carries flow only when its depth exceeds 0.001 m, the default threshold of LISFLOOD-FP, so thin runoff sheets still drain.

## 3. Terrain conditioning with mapped rivers

OpenStreetMap river and canal polygons and river, canal and stream centre lines (snapshot of October 2026) are rasterised onto the grid. Each channel cell takes the lowest terrain value within one cell, which is the water surface the DEM recorded, and along each centre line a one-dimensional morphological opening over five cells (150 m) removes humps narrower than that window, such as bridges, culverts and road embankments that a DEM keeps as dams. No depth is added below the recorded water surface, because no open dataset gives channel bathymetry; the channel volume below that surface is taken as already filled by base flow at the start of an event.

## 4. Land cover, roughness and infiltration

Land cover is the Esri / Impact Observatory 10 m annual map of the newest available year, 2024 at build time. Each 30 m cell receives the area-weighted Manning n of its nine 10 m pixels, using HEC-RAS land-classification values after @chow1959 [@hecras2d]; built-up land uses n = 0.15, an effective roughness that represents buildings removed from the bare-earth DEM, an approach @beretta2018 found about as accurate as explicit building geometry.

Rain becomes runoff through the NRCS curve number method [@nrcs1986]. For cumulative rain P and retention S = 25400/CN − 254 (mm), direct runoff is Q = (P − 0.2S)² / (P + 0.8S) for P > 0.2S and zero otherwise; each step adds the increase of Q to the cell, so the rest of the rain infiltrates. Curve numbers come from TR-55 tables for each land-cover class and hydrologic soil group, built-up pixels count as impervious (CN 98) and a cell takes the area-weighted value of its pixels, which is the TR-55 composite curve number for mixed cells.

The hydrologic soil group is derived from SoilGrids 2.0 sand and clay contents averaged over 0–100 cm [@poggio2021], using the texture criteria of the NRCS soil-group chapter [@nrcs2009] that also underlie the global HYSOGs250m map [@ross2018]. In the Jakarta region the result is 83 % group D and 17 % group C, consistent with the clay-rich soils of the area. Antecedent moisture is the average condition (AMC II) of the method.

## 5. Inflow from upstream catchments

Flow directions are computed on the Copernicus GLO-90 DEM over 106.35–107.35° E and 5.95–7.00° S, which holds every catchment draining into the region. Mapped rivers and streams of the whole area (Overture Maps base theme, from OpenStreetMap) are lowered by 20 m before routing so that the D8 directions follow the mapped network on flat land, and canals are left out because they cross catchment divides. For every stream cell draining at least 1 km² the engine stores upstream area, area-mean curve number, mean slope and longest flow length.

When a run starts, the engine finds every stream that crosses into the run area and computes its inflow hydrograph from the same rain applied over its catchment. Runoff depth follows the curve number method, the lag time follows the NRCS watershed lag equation [@nrcs2010] and the discharge follows the NRCS dimensionless unit hydrograph [@nrcs2007], integrated over 5-minute steps so that the runoff volume is kept exactly. Catchment area that lies inside the run area, or that was already counted at an upstream entry, is removed so that no rain is counted twice.

## 6. Rain and sea level

The design-storm option distributes a 24-hour rain total R24 over the chosen duration with the Mononobe intensity–duration relation used in Indonesian practice [@maitsa2021] and the alternating block method [@chow1988]. The 1 January 2020 preset uses 377 mm in 24 hours, the daily total recorded at Halim Perdanakusuma [@lubis2022]; users can also type hourly depths.

Sea cells, defined as water pixels at or below 0.5 m connected to the open sea, are held at the chosen sea level throughout a run. Water reaching any other edge of the run area leaves through a transmissive boundary that passes the discharge arriving at the adjacent face, capped at critical flow.

## 7. Display and export

The map shows depth per pixel by interpolating the water level bilinearly from the surrounding wet cells and subtracting the terrain interpolated in the same way, the water-level downscaling used for SFINCS results [@leijnse2021]. This gives smooth water edges that follow the ground without inventing water where all surrounding cells are dry, and colours follow the depth classes 0.05, 0.15, 0.5, 1 and 2 m. Depth exports are GeoTIFF files in EPSG:32748 with the model values unchanged, together with a JSON record of all inputs, data versions, inflows and the water balance.

## 8. Verification

The WebGPU solver gives the same maximum depths as the CPU reference on real terrain to within 0.003 m, and both close the water balance to within 10⁻⁷ of the inflow. The scheme reproduces the analytical flood wave of @hunter2005 within 3 % of the inflow depth and matched SFINCS 2.4.0 on the same grid, rain and roughness with an RMSE of 0.06 m in maximum depth. These tests check the numerics and say nothing about agreement with real floods.

## 9. Limitations

City drains, pumps and sea walls are not represented because no open dataset describes them, so results overstate flooding from local rain and, above a sea level of about 0.5 m, along the coast. The terrain dates from 2011–2015 while parts of Jakarta subside by several centimetres per year [@abidin2011], and channel cross-sections below the recorded water surface are missing.

Upstream rain is spatially uniform and equal to the scenario rain, and a lumped unit hydrograph for the largest catchment (the Cisadane, about 1,100 km²) is a simplification of its response. The engine has not yet been compared with observed flood extents or depths; that comparison, and the calibration of an effective drainage capacity against it, are the next steps, and until then results describe scenarios rather than predictions.
