const PRICES: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
};

export function estimateCostUSD(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICES[model];
  if (!p) return 0;
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

export interface AnthropicResult { text: string; inputTokens: number; outputTokens: number; }

export async function callAnthropic(apiKey: string, model: string, system: string, user: string, maxTokens: number): Promise<AnthropicResult> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
  });
  if (!resp.ok) throw new Error(`Anthropic ${resp.status}: ${await resp.text()}`);
  const json = await resp.json() as { content: { type: string; text: string }[]; usage: { input_tokens: number; output_tokens: number } };
  const text = json.content.filter(c => c.type === "text").map(c => c.text).join("");
  return { text, inputTokens: json.usage.input_tokens, outputTokens: json.usage.output_tokens };
}
