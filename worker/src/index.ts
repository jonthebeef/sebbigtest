export interface Env {
  RATE_KV: KVNamespace;
  PARENT_KV: KVNamespace;
  ANTHROPIC_API_KEY: string;
  ALLOWED_ORIGIN: string;
  DAILY_USD_CAP: string;
}

export default {
  async fetch(req: Request, _env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/api/health") {
      return Response.json({ ok: true });
    }
    return new Response("Not found", { status: 404 });
  },
};
