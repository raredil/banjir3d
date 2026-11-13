import { describe, expect, it } from "vitest";
import roles from "../../data/layer-roles.json";
import { LAYERS } from "./layers";

describe("layer roles", () => {
  it("every map layer says what it is used for", () => {
    const r = roles.layers as Record<string, { use: string; id: string; en: string }>;
    for (const l of LAYERS) {
      expect(r[l.id], l.id).toBeTruthy();
      expect(Object.keys(roles.tags)).toContain(r[l.id].use);
      expect(r[l.id].id.length).toBeGreaterThan(10);
    }
  });
});
