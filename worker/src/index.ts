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

function cors(env: Env): HeadersInit {
  return {
    "access-control-allow-origin": env.ALLOWED_ORIGIN,
    "access-control-allow-methods": "POST, GET, OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env) });
    if (url.pathname === "/api/health") return Response.json({ ok: true }, { headers: cors(env) });

    if (url.pathname === "/api/grade" && req.method === "POST") {
      const origin = req.headers.get("origin");
      if (origin && origin !== env.ALLOWED_ORIGIN) return new Response("Forbidden origin", { status: 403 });

      let body: { model: string; system: string; user: string; maxTokens?: number };
      try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400, headers: cors(env) }); }

      const m = checkModel(body.model);
      if (!m.ok) return new Response(m.reason, { status: 400, headers: cors(env) });
      if ((body.system?.length ?? 0) + (body.user?.length ?? 0) > MAX_INPUT_CHARS)
        return new Response("Input too long", { status: 413, headers: cors(env) });

      const maxTok = Math.min(body.maxTokens ?? 500, MAX_OUTPUT_TOKENS);
      const ip = req.headers.get("CF-Connecting-IP") ?? "unknown";

      const g = await checkGlobalCap(env);
      if (!g.ok) return new Response(g.reason, { status: 503, headers: cors(env) });
      const r = await checkAndIncrementIp(env, ip, maxTok);
      if (!r.ok) return new Response(r.reason, { status: 429, headers: cors(env) });

      try {
        const result = await callAnthropic(env.ANTHROPIC_API_KEY, body.model, body.system ?? "", body.user ?? "", maxTok);
        await recordSpend(env, estimateCostUSD(body.model, result.inputTokens, result.outputTokens));
        return Response.json({ text: result.text, inputTokens: result.inputTokens, outputTokens: result.outputTokens }, { headers: cors(env) });
      } catch (e) {
        return new Response(`Upstream error: ${(e as Error).message}`, { status: 502, headers: cors(env) });
      }
    }

    return new Response("Not found", { status: 404, headers: cors(env) });
  },
};
