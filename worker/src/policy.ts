const ALLOWED_MODELS = new Set(["claude-haiku-4-5", "claude-sonnet-4-6"]);
export type CheckResult = { ok: true } | { ok: false; reason: string };
export function checkModel(model: string): CheckResult {
  if (!ALLOWED_MODELS.has(model)) return { ok: false, reason: `Model ${model} is not allowed` };
  return { ok: true };
}
