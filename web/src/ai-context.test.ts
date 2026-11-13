import { describe, expect, it } from "vitest";
import { buildAiContext, plainCitations } from "./ai-context";

describe("AI context file", () => {
  it("turns citations into plain text", () => {
    expect(plainCitations("as in [@bates2010; @hawker2022] and @chow1959 says")).toBe("as in (Bates, Horritt and Fewtrell, 2010; Hawker et al., 2022) and Chow (1959) says");
  });
  it("public/banjir3d-konteks-ai.md is up to date (run npm run ai-context)", () => {
    const f = Object.values(import.meta.glob<string>("../public/banjir3d-konteks-ai.md", { query: "?raw", import: "default", eager: true }))[0];
    const stamp = /pada (\S+) \(commit ([^)]+)\)/.exec(f)!;
    expect(f).toBe(buildAiContext({ built: stamp[1], commit: stamp[2] }));
    expect(f).not.toMatch(/\[@|\{\{/);
  });
});
