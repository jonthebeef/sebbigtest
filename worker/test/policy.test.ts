import { describe, it, expect } from "vitest";
import { checkModel, checkAndIncrementIp, checkGlobalCap, recordSpend } from "../src/policy";
import { makeEnv } from "./helpers";

describe("checkModel", () => {
  it("allows claude-haiku-4-5", () => { expect(checkModel("claude-haiku-4-5").ok).toBe(true); });
  it("allows claude-sonnet-4-6", () => { expect(checkModel("claude-sonnet-4-6").ok).toBe(true); });
  it("rejects opus", () => { expect(checkModel("claude-opus-4-7").ok).toBe(false); });
  it("rejects empty", () => { expect(checkModel("").ok).toBe(false); });
});

describe("checkAndIncrementIp", () => {
  it("allows first 60/hr", async () => {
    const env = makeEnv();
    for (let i = 0; i < 60; i++) expect((await checkAndIncrementIp(env, "1.2.3.4", 0)).ok).toBe(true);
  });
  it("rejects 61st", async () => {
    const env = makeEnv();
    for (let i = 0; i < 60; i++) await checkAndIncrementIp(env, "1.2.3.4", 0);
    expect((await checkAndIncrementIp(env, "1.2.3.4", 0)).ok).toBe(false);
  });
  it("rejects when daily token cap exceeded", async () => {
    const env = makeEnv();
    expect((await checkAndIncrementIp(env, "1.2.3.4", 29_500)).ok).toBe(true);
    expect((await checkAndIncrementIp(env, "1.2.3.4", 1_000)).ok).toBe(false);
  });
  it("separates IPs", async () => {
    const env = makeEnv();
    for (let i = 0; i < 60; i++) await checkAndIncrementIp(env, "1.2.3.4", 0);
    expect((await checkAndIncrementIp(env, "5.6.7.8", 0)).ok).toBe(true);
  });
});

describe("global daily cap", () => {
  it("allows under cap", async () => { expect((await checkGlobalCap(makeEnv({ DAILY_USD_CAP: "5.00" }))).ok).toBe(true); });
  it("blocks over cap", async () => {
    const env = makeEnv({ DAILY_USD_CAP: "1.00" });
    await recordSpend(env, 1.5);
    expect((await checkGlobalCap(env)).ok).toBe(false);
  });
});
