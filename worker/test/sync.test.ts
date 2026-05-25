import { describe, it, expect } from "vitest";
import worker from "../src/index";
import { makeEnv } from "./helpers";

describe("sync + parent", () => {
  it("rejects sync without code", async () => {
    const env = makeEnv();
    const req = new Request("https://example.com/api/sync", {
      method: "POST",
      headers: { "content-type": "application/json", origin: env.ALLOWED_ORIGIN, "CF-Connecting-IP": "1.1.1.1" },
      body: JSON.stringify({ snapshot: {} }),
    });
    expect((await worker.fetch(req, env)).status).toBe(400);
  });

  it("stores and retrieves a snapshot", async () => {
    const env = makeEnv();
    const code = "abcd-1234";
    const r1 = await worker.fetch(new Request("https://example.com/api/sync", {
      method: "POST",
      headers: { "content-type": "application/json", origin: env.ALLOWED_ORIGIN, "CF-Connecting-IP": "1.1.1.1" },
      body: JSON.stringify({ code, snapshot: { displayName: "Seb" } }),
    }), env);
    expect(r1.status).toBe(204);
    const r2 = await worker.fetch(new Request(`https://example.com/api/parent/${code}`, {
      headers: { "CF-Connecting-IP": "2.2.2.2" },
    }), env);
    expect(r2.status).toBe(200);
    const body = await r2.json() as { displayName: string };
    expect(body.displayName).toBe("Seb");
  });

  it("404 for unknown code", async () => {
    expect((await worker.fetch(new Request("https://example.com/api/parent/nope-nope", {
      headers: { "CF-Connecting-IP": "2.2.2.2" }
    }), makeEnv())).status).toBe(404);
  });
});
