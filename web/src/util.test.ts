import { describe, expect, it } from "vitest";
import { SHARP_IMAGERY_Z, esc, fmtBytes, rasterResampling, safeUrl, toUtm } from "./util";

describe("util", () => {
  it("escapes html", () => {
    expect(esc(`<img src=x onerror="a">'`)).toBe("&lt;img src=x onerror=&quot;a&quot;&gt;&#39;");
  });
  it("rejects non-http urls", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("#");
    expect(safeUrl("https://doi.org/10.1/x")).toBe("https://doi.org/10.1/x");
  });
  it("formats bytes", () => {
    expect(fmtBytes(1536)).toBe("1.5 KB");
  });
  it("UTM 48S for Monas matches pyproj (EPSG:32748)", () => {
    // pyproj: Transformer EPSG:4326 -> EPSG:32748 for (106.8272, -6.1754) = (702183.322, 9317059.383)
    const u = toUtm(106.8272, -6.1754);
    expect(u.zone).toBe(48);
    expect(u.hemisphere).toBe("S");
    expect(Math.abs(u.easting - 702183.322)).toBeLessThan(0.01);
    expect(Math.abs(u.northing - 9317059.383)).toBeLessThan(0.01);
  });
  it("never smooths data grids, and shows imagery pixels sharp once zoomed past their resolution", () => {
    expect(rasterResampling(false, 8)).toBe("nearest");
    expect(rasterResampling(true, 12)).toBe("linear");
    expect(rasterResampling(true, SHARP_IMAGERY_Z)).toBe("nearest");
  });
});
