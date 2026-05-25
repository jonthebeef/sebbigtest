import { describe, it, expect } from "vitest";
import { checkModel } from "../src/policy";

describe("checkModel", () => {
  it("allows claude-haiku-4-5", () => { expect(checkModel("claude-haiku-4-5").ok).toBe(true); });
  it("allows claude-sonnet-4-6", () => { expect(checkModel("claude-sonnet-4-6").ok).toBe(true); });
  it("rejects opus", () => { expect(checkModel("claude-opus-4-7").ok).toBe(false); });
  it("rejects empty", () => { expect(checkModel("").ok).toBe(false); });
});
