import type { Env } from "./index";

const ALLOWED_MODELS = new Set(["claude-haiku-4-5", "claude-sonnet-4-6"]);
export type CheckResult = { ok: true } | { ok: false; reason: string };
export function checkModel(model: string): CheckResult {
  if (!ALLOWED_MODELS.has(model)) return { ok: false, reason: `Model ${model} is not allowed` };
  return { ok: true };
}

const REQ_PER_HOUR = 60;
const TOKENS_PER_DAY = 30_000;

export async function checkAndIncrementIp(env: Env, ip: string, tokensCharged: number): Promise<CheckResult> {
  const hourKey = `rl:hr:${ip}:${Math.floor(Date.now() / 3_600_000)}`;
  const dayKey = `rl:day:${ip}:${Math.floor(Date.now() / 86_400_000)}`;
  const [hourStr, dayStr] = await Promise.all([env.RATE_KV.get(hourKey), env.RATE_KV.get(dayKey)]);
  const hourCount = Number(hourStr ?? 0);
  const dayTokens = Number(dayStr ?? 0);
  if (hourCount >= REQ_PER_HOUR) return { ok: false, reason: "Hourly request limit reached" };
  if (dayTokens + tokensCharged > TOKENS_PER_DAY) return { ok: false, reason: "Daily token cap reached" };
  await Promise.all([
    env.RATE_KV.put(hourKey, String(hourCount + 1), { expirationTtl: 3600 }),
    env.RATE_KV.put(dayKey, String(dayTokens + tokensCharged), { expirationTtl: 86_400 }),
  ]);
  return { ok: true };
}

function globalKey() { return `spend:${Math.floor(Date.now() / 86_400_000)}`; }
export async function checkGlobalCap(env: Env): Promise<CheckResult> {
  const cap = Number(env.DAILY_USD_CAP);
  const spent = Number((await env.RATE_KV.get(globalKey())) ?? 0);
  if (spent >= cap) return { ok: false, reason: "Daily budget exhausted" };
  return { ok: true };
}
export async function recordSpend(env: Env, usd: number): Promise<void> {
  const key = globalKey();
  const current = Number((await env.RATE_KV.get(key)) ?? 0);
  await env.RATE_KV.put(key, String(current + usd), { expirationTtl: 86_400 });
}
