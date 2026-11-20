// Return-period design rain for DKI Jakarta (pipeline/design_rain.py -> data/rain/design_rain_jakarta.json): R24 per return period from
// daily satellite rain (CHIRPS 1981-2025, or GPM IMERG 2001-2025 when CHIRPS is not reachable) (median over the 5 km cells inside DKI, distribution with the better Kolmogorov-Smirnov fit).
// Loaded only when the file exists (made by the design-rain Action); without it the option is hidden.
const FILES = import.meta.glob<unknown>("../../../data/rain/design_rain_jakarta.json", { import: "default", eager: true });

type Row = { median: number; min: number; max: number; areaMean: number };
type Doc = { product?: string; cell_km?: number; years: number[]; n_years: number; n_cells: number; chosen: "gumbel" | "lp3"; periods: number[]; R24: Record<"gumbel" | "lp3", Record<string, Row>>;
  gaugeCheck?: { n_station_years?: number; ratio_median?: number; stations?: unknown[] } | null };
const EMPTY: Doc = { years: [0, 0], n_years: 0, n_cells: 0, chosen: "gumbel", periods: [], R24: { gumbel: {}, lp3: {} }, gaugeCheck: null };
const d = (Object.values(FILES)[0] as Doc | undefined) ?? EMPTY;

export const RP = {
  product: d.product ?? "CHIRPS v2.0",
  cellKm: d.cell_km ?? 5,
  years: d.years as [number, number],
  nYears: d.n_years,
  cells: d.n_cells,
  dist: d.chosen,
  gaugeRatio: d.gaugeCheck?.ratio_median ?? null,
  gaugeN: d.gaugeCheck?.n_station_years ?? 0,
  gaugeStations: d.gaugeCheck?.stations?.length ?? 0,
};

/** R24 (mm/day, rounded to 5 mm like the rain slider) for each return period in years. */
export const RP_OPTIONS: { years: number; mm: number; min: number; max: number }[] = d.periods.map((T) => {
  const r = d.R24[d.chosen][String(T)];
  return { years: T, mm: Math.round(r.median / 5) * 5, min: r.min, max: r.max };
});

/** The return period whose design rain this is (24 h storm of exactly that total), or null. */
export const returnPeriodOf = (mm: number, hours: number): number | null => (hours === 24 ? RP_OPTIONS.find((o) => o.mm === mm)?.years ?? null : null);
