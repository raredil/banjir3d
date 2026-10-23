export type Dataset = {
  id: string; name: string; theme: string; role: string; provider: string; version: string; temporal?: string;
  doi: string | null; url: string; resolution: string; crs?: string; vertical_datum?: string | null;
  licence: { id: string; url?: string; redistributable: string; non_commercial?: boolean; share_alike?: boolean; attribution?: string };
  access: { method: string; endpoint?: string; auth?: string; probe?: string };
  citation: { text: string; bibtex: string };
  status: "verified" | "single-source" | "unverified"; checked: string; notes?: string; in_region_pack?: boolean;
};
export type Catalog = { catalog_version: string; updated: string; datasets: Dataset[] };

export type OutputRec = { file: string; bytes: number; sha256: string; [k: string]: unknown };
export type LayerRec = {
  dataset: string; status: "ok" | "failed"; version?: string; accessed: string; error?: string;
  sources?: unknown[]; steps?: unknown[]; outputs?: OutputRec[]; display?: OutputRec[];
};
export type Manifest = {
  region_id: string; created: string; catalog_version: string; licences: string[]; output_licence: string;
  attribution: string[]; software: Record<string, string | null>; layers: LayerRec[];
};
export type VerifyReport = { checked: string; datasets: { id: string; url_status: number | string; doi_registered?: boolean }[]; facts: Record<string, unknown> };
