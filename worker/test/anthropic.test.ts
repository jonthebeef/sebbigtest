import { describe, it, expect } from "vitest";
import { estimateCostUSD } from "../src/anthropic";
describe("estimateCostUSD", () => {
  it("haiku cost > 0", () => { expect(estimateCostUSD("claude-haiku-4-5", 1000, 1000)).toBeGreaterThan(0); });
  it("sonnet > haiku", () => {
    expect(estimateCostUSD("claude-sonnet-4-6", 1000, 1000)).toBeGreaterThan(estimateCostUSD("claude-haiku-4-5", 1000, 1000));
  });
});
