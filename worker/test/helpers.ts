import type { Env } from "../src/index";

export function makeEnv(overrides: Partial<Env> = {}): Env {
  const store = new Map<string, string>();
  const kv = {
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => void store.set(k, v),
    delete: async (k: string) => void store.delete(k),
    list: async () => ({ keys: [], list_complete: true, cursor: "" }),
    getWithMetadata: async () => ({ value: null, metadata: null }),
  } as unknown as KVNamespace;
  return {
    RATE_KV: kv,
    PARENT_KV: kv,
    ANTHROPIC_API_KEY: "test-key",
    ALLOWED_ORIGIN: "https://seb-revision.pages.dev",
    DAILY_USD_CAP: "5.00",
    ...overrides,
  };
}
