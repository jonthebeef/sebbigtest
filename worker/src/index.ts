import { checkModel, checkAndIncrementIp, checkGlobalCap, recordSpend } from "./policy";
import { callAnthropic, estimateCostUSD } from "./anthropic";

export interface Env {
  RATE_KV: KVNamespace;
  PARENT_KV: KVNamespace;
  ANTHROPIC_API_KEY: string;
  ALLOWED_ORIGIN: string;
  DAILY_USD_CAP: string;
}

const MAX_INPUT_CHARS = 16_000;
const MAX_OUTPUT_TOKENS = 1_000;

function allowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGIN.split(",").map(s => s.trim()).filter(Boolean);
}

function cors(env: Env, requestOrigin?: string | null): HeadersInit {
  const list = allowedOrigins(env);
  const match = requestOrigin && list.includes(requestOrigin) ? requestOrigin : list[0];
  return {
    "access-control-allow-origin": match,
    "vary": "Origin",
    "access-control-allow-methods": "POST, GET, OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}

function originAllowed(env: Env, origin: string | null): boolean {
  if (!origin) return true;
  return allowedOrigins(env).includes(origin);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env, req.headers.get("origin")) });
    if (url.pathname === "/api/health") return Response.json({ ok: true }, { headers: cors(env, req.headers.get("origin")) });

    if (url.pathname === "/api/grade" && req.method === "POST") {
      const origin = req.headers.get("origin");
      if (!originAllowed(env, origin)) return new Response("Forbidden origin", { status: 403 });

      let body: { model: string; system: string; user: string; maxTokens?: number };
      try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400, headers: cors(env, req.headers.get("origin")) }); }

      const m = checkModel(body.model);
      if (!m.ok) return new Response(m.reason, { status: 400, headers: cors(env, req.headers.get("origin")) });
      if ((body.system?.length ?? 0) + (body.user?.length ?? 0) > MAX_INPUT_CHARS)
        return new Response("Input too long", { status: 413, headers: cors(env, req.headers.get("origin")) });

      const maxTok = Math.min(body.maxTokens ?? 500, MAX_OUTPUT_TOKENS);
      const ip = req.headers.get("CF-Connecting-IP") ?? "unknown";

      const g = await checkGlobalCap(env);
      if (!g.ok) return new Response(g.reason, { status: 503, headers: cors(env, req.headers.get("origin")) });
      const r = await checkAndIncrementIp(env, ip, maxTok);
      if (!r.ok) return new Response(r.reason, { status: 429, headers: cors(env, req.headers.get("origin")) });

      try {
        const result = await callAnthropic(env.ANTHROPIC_API_KEY, body.model, body.system ?? "", body.user ?? "", maxTok);
        await recordSpend(env, estimateCostUSD(body.model, result.inputTokens, result.outputTokens));
        return Response.json({ text: result.text, inputTokens: result.inputTokens, outputTokens: result.outputTokens }, { headers: cors(env, req.headers.get("origin")) });
      } catch (e) {
        return new Response(`Upstream error: ${(e as Error).message}`, { status: 502, headers: cors(env, req.headers.get("origin")) });
      }
    }

    if (url.pathname === "/api/sync" && req.method === "POST") {
      const ip = req.headers.get("CF-Connecting-IP") ?? "unknown";
      const writeKey = `sync:wr:${ip}:${Math.floor(Date.now() / 3_600_000)}`;
      const count = Number((await env.RATE_KV.get(writeKey)) ?? 0);
      if (count >= 6) return new Response("Too many writes", { status: 429, headers: cors(env, req.headers.get("origin")) });
      let body: { code?: string; snapshot?: unknown };
      try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400, headers: cors(env, req.headers.get("origin")) }); }
      if (!body.code || !/^[a-z0-9]{4}-[a-z0-9]{4}$/.test(body.code))
        return new Response("Bad code", { status: 400, headers: cors(env, req.headers.get("origin")) });
      if (!body.snapshot || typeof body.snapshot !== "object")
        return new Response("Bad snapshot", { status: 400, headers: cors(env, req.headers.get("origin")) });
      const text = JSON.stringify(body.snapshot);
      if (text.length > 200_000) return new Response("Snapshot too large", { status: 413, headers: cors(env, req.headers.get("origin")) });
      await env.PARENT_KV.put(`p:${body.code}`, text, { expirationTtl: 86_400 * 30 });
      await env.RATE_KV.put(writeKey, String(count + 1), { expirationTtl: 3600 });
      return new Response(null, { status: 204, headers: cors(env, req.headers.get("origin")) });
    }

    const m = url.pathname.match(/^\/api\/parent\/([a-z0-9]{4}-[a-z0-9]{4})$/);
    if (m && req.method === "GET") {
      const ip = req.headers.get("CF-Connecting-IP") ?? "unknown";
      const readKey = `sync:rd:${ip}:${Math.floor(Date.now() / 60_000)}`;
      const rc = Number((await env.RATE_KV.get(readKey)) ?? 0);
      if (rc >= 30) return new Response("Too many reads", { status: 429, headers: cors(env, req.headers.get("origin")) });
      await env.RATE_KV.put(readKey, String(rc + 1), { expirationTtl: 60 });
      const stored = await env.PARENT_KV.get(`p:${m[1]}`);
      if (!stored) return new Response("Not found", { status: 404, headers: cors(env, req.headers.get("origin")) });
      return new Response(stored, { status: 200, headers: { ...cors(env, req.headers.get("origin")), "content-type": "application/json" } });
    }

    return new Response("Not found", { status: 404, headers: cors(env, req.headers.get("origin")) });
  },
};
