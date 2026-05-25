import { describe, it, expect, vi } from "vitest";
import worker from "../src/index";
import { makeEnv } from "./helpers";

describe("POST /api/grade", () => {
  it("rejects bad model with 400", async () => {
    const env = makeEnv();
    const req = new Request("https://example.com/api/grade", {
      method: "POST",
      headers: { "content-type": "application/json", origin: env.ALLOWED_ORIGIN, "CF-Connecting-IP": "1.1.1.1" },
      body: JSON.stringify({ model: "claude-opus-4-7", system: "x", user: "y", maxTokens: 100 }),
    });
    expect((await worker.fetch(req, env)).status).toBe(400);
  });

  it("rejects bad origin with 403", async () => {
    const env = makeEnv({ ALLOWED_ORIGIN: "https://other.example" });
    const req = new Request("https://example.com/api/grade", {
      method: "POST",
      headers: { origin: "https://attacker.example", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-haiku-4-5", system: "x", user: "y", maxTokens: 100 }),
    });
    expect((await worker.fetch(req, env)).status).toBe(403);
  });

  it("forwards on happy path", async () => {
    const env = makeEnv();
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(
      JSON.stringify({ content: [{ type: "text", text: "graded!" }], usage: { input_tokens: 100, output_tokens: 50 } }),
      { status: 200 }
    ));
    const req = new Request("https://example.com/api/grade", {
      method: "POST",
      headers: { origin: env.ALLOWED_ORIGIN, "content-type": "application/json", "CF-Connecting-IP": "1.2.3.4" },
      body: JSON.stringify({ model: "claude-haiku-4-5", system: "you are a grader", user: "grade this", maxTokens: 200 }),
    });
    const resp = await worker.fetch(req, env);
    expect(resp.status).toBe(200);
    expect((await resp.json() as { text: string }).text).toBe("graded!");
    spy.mockRestore();
  });
});
