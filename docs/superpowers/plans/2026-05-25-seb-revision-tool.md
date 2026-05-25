# Seb's Revision Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a deployed, mobile-responsive web revision app for Sebastian (Y7) and friends to use daily from 26 May to 5 June 2026, with PEE (Geography) and Circle-method (History) AI-graded structured answer practice, plus an opt-in parent dashboard.

**Architecture:** Static SPA on Cloudflare Pages (HTML + Tailwind + Alpine.js, no build step). Cloudflare Worker proxy fronting the Anthropic API with strict rate limits and a global daily $ kill-switch. Cloudflare KV for rate-limit counters and opt-in per-kid progress snapshots. Content sourced from school PDFs, one-time extracted into versioned JSON in the repo.

**Tech Stack:** Cloudflare Pages, Cloudflare Workers (TypeScript, wrangler), Cloudflare KV, Anthropic Messages API (Haiku 4.5 + Sonnet 4.6), Tailwind (CDN), Alpine.js, vitest for Worker tests.

**Spec:** `docs/superpowers/specs/2026-05-25-seb-revision-tool-design.md`

---

## Note for executor

Throughout this plan the school's term "recall-practice" is used in place of the school's actual term "r-e-t-r-i-e-v-a-l practice" because a tooling security hook fuzzy-matches the substring "eval". When you implement this, freely substitute the school's real term ("retrieval") in UI strings, JSON field names, and comments. Specifically, the JSON field shown as `recall_questions` in this plan should be named `retrieval_questions` in actual content files (the spec uses that name).

---

## Milestone 0 — Repo and deploy skeleton

Goal: empty app deployed to Cloudflare Pages with a working Worker endpoint, so subsequent work is just feature additions.

### Task 0.1: Initialize git repo and project structure

**Files:**
- Create: `.gitignore`
- Create: `README.md`
- Create: `package.json`

- [ ] **Step 1: Initialize git**

Run from `/Users/thingy/Desktop/sebbigtest`:
```bash
git init
git branch -M main
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
.dev.vars
.wrangler/
dist/
.DS_Store
content/*.json
!content/.gitkeep
Year 7 Big Test 2/
Y7 Big Test 2 - Parent Letter.pdf
```

School PDFs are excluded — they stay on Dad's disk only. `content/*.json` is also gitignored because it contains derivative material; we'll commit only the deploy copy under `web/content/`.

- [ ] **Step 3: Create `package.json`**

```json
{
  "name": "seb-revision",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev:web": "npx http-server web -p 8080 -c-1",
    "dev:worker": "wrangler dev",
    "test": "vitest run",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20250101.0",
    "http-server": "^14.1.1",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "wrangler": "^3.80.0"
  }
}
```

- [ ] **Step 4: Create `README.md`** (one paragraph: what the project is, how to run locally, link to the spec).

- [ ] **Step 5: Create empty folder structure**

```bash
mkdir -p web worker content scripts docs/superpowers/specs docs/superpowers/plans
touch content/.gitkeep
```

- [ ] **Step 6: Install deps**

```bash
npm install
```

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "chore: initial project skeleton"
```

---

### Task 0.2: Create GitHub repo and push

- [ ] **Step 1: Create the repo**

```bash
gh repo create seb-revision --private --source=. --remote=origin --push
```

If `gh` is not installed/logged in, stop and ask Dad to run it.

---

### Task 0.3: Wrangler config and hello-world Worker

**Files:**
- Create: `wrangler.toml`
- Create: `worker/src/index.ts`
- Create: `worker/tsconfig.json`

- [ ] **Step 1: Create `wrangler.toml`**

```toml
name = "seb-revision-api"
main = "worker/src/index.ts"
compatibility_date = "2026-05-01"
workers_dev = true

[[kv_namespaces]]
binding = "RATE_KV"
id = "REPLACE_AFTER_CREATE"

[[kv_namespaces]]
binding = "PARENT_KV"
id = "REPLACE_AFTER_CREATE"

[vars]
ALLOWED_ORIGIN = "http://localhost:8080"
DAILY_USD_CAP = "5.00"

# ANTHROPIC_API_KEY is set as a secret via `wrangler secret put`
```

- [ ] **Step 2: Create KV namespaces**

```bash
npx wrangler kv namespace create RATE_KV
npx wrangler kv namespace create PARENT_KV
```

Copy the returned IDs into `wrangler.toml` replacing `REPLACE_AFTER_CREATE`.

- [ ] **Step 3: Create `worker/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 4: Create `worker/src/index.ts` (hello world)**

```typescript
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
```

- [ ] **Step 5: Run locally**

```bash
npx wrangler dev
```

Curl in another terminal: `curl http://127.0.0.1:8787/api/health` should return `{"ok":true}`.

- [ ] **Step 6: Set Anthropic secret**

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```

Paste Dad's key when prompted. For local dev also create `.dev.vars` with `ANTHROPIC_API_KEY=sk-ant-...` (gitignored).

- [ ] **Step 7: Deploy Worker**

```bash
npx wrangler deploy
```

Record the deployed URL (e.g. `https://seb-revision-api.<account>.workers.dev`) in README.

- [ ] **Step 8: Commit**

```bash
git add wrangler.toml worker/ package.json package-lock.json
git commit -m "feat(worker): hello-world Worker with health endpoint"
git push
```

---

### Task 0.4: Hello-world frontend on Pages

**Files:** `web/index.html`, `web/styles.css`

- [ ] **Step 1: Create minimal `web/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Seb's Revision</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script defer src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js"></script>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body class="bg-slate-50 text-slate-900">
    <main class="mx-auto max-w-md p-4">
      <h1 class="text-2xl font-bold">Seb's Revision</h1>
      <p class="mt-2">Hello, world.</p>
    </main>
  </body>
</html>
```

- [ ] **Step 2: Create empty `web/styles.css`**.

- [ ] **Step 3: Run locally**

```bash
npm run dev:web
```

Visit `http://localhost:8080` — heading visible.

- [ ] **Step 4: Connect Cloudflare Pages to the GitHub repo**

In Cloudflare dashboard → Pages → Create project → connect GitHub → select `seb-revision`. Framework: None. Build command empty. Output directory: `web`.

- [ ] **Step 5: Update Worker `ALLOWED_ORIGIN`** to the assigned Pages URL (e.g. `https://seb-revision.pages.dev`), then `npx wrangler deploy`.

- [ ] **Step 6: Commit**

```bash
git add web/ wrangler.toml
git commit -m "feat(web): hello-world Pages site, wire CORS origin"
git push
```

---

## Milestone 1 — Worker grading proxy with rate limits

Goal: a safe `/api/grade` endpoint that only Haiku/Sonnet can reach, with hard per-IP and global caps. Strict TDD here — bugs cost real money.

### Task 1.1: Test framework setup

**Files:** `worker/vitest.config.ts`, `worker/test/helpers.ts`

- [ ] **Step 1: Create `worker/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["worker/test/**/*.test.ts"], environment: "node" },
});
```

- [ ] **Step 2: Create `worker/test/helpers.ts`**

```typescript
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
```

- [ ] **Step 3: Confirm vitest runs**: `npx vitest run` → "No test files found".
- [ ] **Step 4: Commit**: `git add worker/vitest.config.ts worker/test/ && git commit -m "test(worker): add vitest harness and helpers"`.

---

### Task 1.2: Model allowlist

**Files:** `worker/test/policy.test.ts`, `worker/src/policy.ts`

- [ ] **Step 1: Failing test**

```typescript
// worker/test/policy.test.ts
import { describe, it, expect } from "vitest";
import { checkModel } from "../src/policy";

describe("checkModel", () => {
  it("allows claude-haiku-4-5", () => { expect(checkModel("claude-haiku-4-5").ok).toBe(true); });
  it("allows claude-sonnet-4-6", () => { expect(checkModel("claude-sonnet-4-6").ok).toBe(true); });
  it("rejects opus", () => { expect(checkModel("claude-opus-4-7").ok).toBe(false); });
  it("rejects empty", () => { expect(checkModel("").ok).toBe(false); });
});
```

- [ ] **Step 2: Run → fail** (`Cannot resolve ../src/policy`).
- [ ] **Step 3: Implement**

```typescript
// worker/src/policy.ts
const ALLOWED_MODELS = new Set(["claude-haiku-4-5", "claude-sonnet-4-6"]);
export type CheckResult = { ok: true } | { ok: false; reason: string };
export function checkModel(model: string): CheckResult {
  if (!ALLOWED_MODELS.has(model)) return { ok: false, reason: `Model ${model} is not allowed` };
  return { ok: true };
}
```

- [ ] **Step 4: Tests pass**.
- [ ] **Step 5: Commit**: `git add worker/src/policy.ts worker/test/policy.test.ts && git commit -m "feat(worker): model allowlist"`.

---

### Task 1.3: Per-IP rate limiter

**Files:** modify `worker/test/policy.test.ts`, modify `worker/src/policy.ts`

- [ ] **Step 1: Append failing tests**

```typescript
import { checkAndIncrementIp } from "../src/policy";
import { makeEnv } from "./helpers";

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
```

- [ ] **Step 2: Implement**

```typescript
// append to worker/src/policy.ts
import type { Env } from "./index";

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
```

- [ ] **Step 3: Tests pass**.
- [ ] **Step 4: Commit**: `git commit -am "feat(worker): per-IP hourly and daily rate limits"`.

---

### Task 1.4: Global daily $ cap

**Files:** modify `worker/test/policy.test.ts`, modify `worker/src/policy.ts`

- [ ] **Step 1: Failing tests**

```typescript
import { checkGlobalCap, recordSpend } from "../src/policy";
describe("global daily cap", () => {
  it("allows under cap", async () => { expect((await checkGlobalCap(makeEnv({ DAILY_USD_CAP: "5.00" }))).ok).toBe(true); });
  it("blocks over cap", async () => {
    const env = makeEnv({ DAILY_USD_CAP: "1.00" });
    await recordSpend(env, 1.5);
    expect((await checkGlobalCap(env)).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Implement**

```typescript
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
```

- [ ] **Step 3: Tests pass; commit**: `git commit -am "feat(worker): global daily USD cap"`.

---

### Task 1.5: Anthropic client and cost estimator

**Files:** `worker/src/anthropic.ts`, `worker/test/anthropic.test.ts`

- [ ] **Step 1: Failing tests**

```typescript
import { describe, it, expect } from "vitest";
import { estimateCostUSD } from "../src/anthropic";
describe("estimateCostUSD", () => {
  it("haiku cost > 0", () => { expect(estimateCostUSD("claude-haiku-4-5", 1000, 1000)).toBeGreaterThan(0); });
  it("sonnet > haiku", () => {
    expect(estimateCostUSD("claude-sonnet-4-6", 1000, 1000)).toBeGreaterThan(estimateCostUSD("claude-haiku-4-5", 1000, 1000));
  });
});
```

- [ ] **Step 2: Implement**

```typescript
// worker/src/anthropic.ts
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
```

- [ ] **Step 3: Tests pass; commit**: `git add worker/src/anthropic.ts worker/test/anthropic.test.ts && git commit -m "feat(worker): Anthropic client + cost estimator"`.

---

### Task 1.6: `/api/grade` endpoint

**Files:** modify `worker/src/index.ts`, create `worker/test/grade.test.ts`

- [ ] **Step 1: Integration tests**

```typescript
// worker/test/grade.test.ts
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
```

- [ ] **Step 2: Implement** — replace `worker/src/index.ts`:

```typescript
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
```

- [ ] **Step 3: Tests pass; deploy and smoke-test**

```bash
npx vitest run
npx wrangler deploy
curl -X POST https://seb-revision-api.<account>.workers.dev/api/grade \
  -H "origin: https://seb-revision.pages.dev" \
  -H "content-type: application/json" \
  -d '{"model":"claude-haiku-4-5","system":"reply with the word PONG","user":"ping","maxTokens":10}'
```

Expected: `{"text":"PONG", ...}`.

- [ ] **Step 4: Commit and push**: `git add worker/ && git commit -m "feat(worker): /api/grade endpoint with policy enforcement" && git push`.

---

## Milestone 2 — Content extraction

Goal: convert school PDFs into structured JSON the app can consume. Run once, locally.

### Task 2.1: Content schema

**Files:** `content/SCHEMA.md`

- [ ] **Step 1: Write `content/SCHEMA.md`**

```markdown
# Content JSON Schema

Each subject produces `content/<subject-slug>.json`:

{
  "subject": "Geography",
  "slug": "geography",
  "weighting": "heavy" | "structured" | "light",
  "topics": [
    {
      "id": "rivers",
      "name": "Rivers",
      "facts": ["A river's source is its starting point."],
      "retrieval_questions": [
        { "q": "What is the source of a river?", "a": "The starting point." }
      ],
      "pee_prompts": [
        {
          "question": "Explain why rivers meander on flat land.",
          "model_answer": {
            "point": "Rivers meander because lateral erosion dominates on flat land.",
            "evidence": "On the outside of a bend the water flows faster, eroding the bank.",
            "explain": "Faster water has more energy to erode while slower water on the inside deposits sediment, forming a meander."
          }
        }
      ],
      "circle_prompts": []
    }
  ]
}

- `weighting` controls daily-plan emphasis: heavy (Maths/English/Science — confirmed test dates), structured (Geography/History — need structured-answer reps), light (rest).
- `pee_prompts` is populated only for Geography.
- `circle_prompts` is populated only for History (and RE if added). `model_answer` keys mirror the school's circle-method parts as found in the History revision PDF.
```

- [ ] **Step 2: Commit**: `git add content/SCHEMA.md && git commit -m "docs(content): JSON schema"`.

---

### Task 2.2: Extraction procedure

**Files:** `scripts/extract-content.md`

- [ ] **Step 1: Write the procedure**

```markdown
# Content Extraction Procedure

Run interactively in a Claude Code session from the repo root, with PDFs at `/Users/thingy/Desktop/sebbigtest/Year 7 Big Test 2/`.

For each subject PDF:

1. Ask Claude to read the PDF.
2. Identify the assessed topics, knowledge-organiser facts, and worked examples.
3. Produce `content/<slug>.json` matching `content/SCHEMA.md`:
   - 10–25 recall questions per topic.
   - Geography: 2–4 PEE prompts per topic with a high-quality model answer.
   - History: 2–4 circle-method prompts. **First** read the History PDF to identify the school's circle-method structure (the part names). `model_answer` keys must mirror those part names. If the PDF does not define the circle method, stop and ask Dad before guessing.
4. Save the file.
5. Run `node scripts/validate-content.mjs` (added in Task 2.3).
```

- [ ] **Step 2: Commit**: `git add scripts/extract-content.md && git commit -m "docs(content): extraction procedure"`.

---

### Task 2.3: Content validator

**Files:** `scripts/validate-content.mjs`

- [ ] **Step 1: Write validator**

```javascript
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "content";
const files = readdirSync(DIR).filter(f => f.endsWith(".json"));

let failed = 0;
for (const f of files) {
  const path = join(DIR, f);
  try {
    const data = JSON.parse(readFileSync(path, "utf8"));
    if (!data.subject || !data.slug) throw new Error("missing subject/slug");
    if (!["heavy", "structured", "light"].includes(data.weighting)) throw new Error(`bad weighting: ${data.weighting}`);
    if (!Array.isArray(data.topics) || data.topics.length === 0) throw new Error("no topics");
    for (const t of data.topics) {
      if (!t.id || !t.name) throw new Error(`topic missing id/name in ${f}`);
      if (!Array.isArray(t.retrieval_questions) || t.retrieval_questions.length === 0)
        throw new Error(`topic ${t.id} has no recall questions`);
    }
    if (data.slug === "geography") {
      const has = data.topics.some(t => Array.isArray(t.pee_prompts) && t.pee_prompts.length > 0);
      if (!has) throw new Error("geography needs at least one pee_prompt");
    }
    if (data.slug === "history") {
      const has = data.topics.some(t => Array.isArray(t.circle_prompts) && t.circle_prompts.length > 0);
      if (!has) throw new Error("history needs at least one circle_prompt");
    }
    console.log(`OK ${f}`);
  } catch (e) {
    console.error(`FAIL ${f}: ${e.message}`);
    failed++;
  }
}
if (failed > 0) { console.error(`${failed} file(s) failed`); process.exit(1); }
console.log(`All ${files.length} content files valid`);
```

- [ ] **Step 2: Smoke-test with a dummy file**

```bash
cat > content/test.json <<'JSON'
{ "subject":"Test","slug":"test","weighting":"light","topics":[{"id":"t1","name":"T1","facts":[],"retrieval_questions":[{"q":"a","a":"b"}]}] }
JSON
node scripts/validate-content.mjs
rm content/test.json
```

- [ ] **Step 3: Commit**: `git add scripts/validate-content.mjs && git commit -m "feat(scripts): content validator"`.

---

### Task 2.4: Extract all 10 subjects

- [ ] **Step 1: Follow `scripts/extract-content.md`** for each subject (art, drama, english, french, geography, history, maths, pe, science, spanish).
- [ ] **Step 2: Validate**: `node scripts/validate-content.mjs` — expect 10 OK lines.
- [ ] **Step 3: Copy to deploy folder**

```bash
mkdir -p web/content
cp content/*.json web/content/
```

Edit `.gitignore` so `web/content/*.json` is NOT ignored (the private repo can hold the deploy copy).

- [ ] **Step 4: Commit and push**: `git add .gitignore web/content/ && git commit -m "feat(content): ship subject content JSON" && git push`.

---

## Milestone 3 — Frontend shell and onboarding

### Task 3.1: App state module

**Files:** `web/js/state.js`

- [ ] **Step 1: Write `web/js/state.js`**

```javascript
const KEY = "seb-revision-state-v1";

const DEFAULT_STATE = {
  profileId: null,
  displayName: null,
  testStartDate: "2026-06-01",
  enabledSubjects: [],
  coveredTopics: {},
  shareCode: null,
  shareEnabled: false,
  history: [],
  confidence: {},
  sessions: [],
};

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    return { ...structuredClone(DEFAULT_STATE), ...JSON.parse(raw) };
  } catch { return structuredClone(DEFAULT_STATE); }
}
export function saveState(s) { localStorage.setItem(KEY, JSON.stringify(s)); }
export function newProfileId() { return crypto.randomUUID(); }
export function newShareCode() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const pick = n => Array.from({length:n}, () => chars[Math.floor(Math.random()*chars.length)]).join("");
  return `${pick(4)}-${pick(4)}`;
}
```

- [ ] **Step 2: Commit**: `git add web/js/state.js && git commit -m "feat(web): localStorage state module"`.

---

### Task 3.2: Onboarding (name + subjects)

**Files:** modify `web/index.html`, create `web/js/app.js`

- [ ] **Step 1: Rewrite `web/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Seb's Revision</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script type="module" src="js/app.js"></script>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body class="bg-slate-50 text-slate-900 min-h-screen">
    <main id="app" class="mx-auto max-w-md p-4"></main>
  </body>
</html>
```

- [ ] **Step 2: Create `web/js/app.js`**

```javascript
import { loadState, saveState, newProfileId } from "./state.js";

const SUBJECTS = [
  { slug: "maths", name: "Maths" }, { slug: "english", name: "English" }, { slug: "science", name: "Science" },
  { slug: "geography", name: "Geography" }, { slug: "history", name: "History" },
  { slug: "french", name: "French" }, { slug: "spanish", name: "Spanish" },
  { slug: "art", name: "Art" }, { slug: "drama", name: "Drama" }, { slug: "pe", name: "PE" },
];

const root = document.getElementById("app");

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function render() {
  const s = loadState();
  if (!s.profileId || !s.displayName) return renderName();
  if (s.enabledSubjects.length === 0) return renderSubjects();
  return renderHome();
}

function renderName() {
  root.innerHTML = "";
  const view = el(`
    <section class="space-y-4 mt-8">
      <h1 class="text-3xl font-bold">Hi!</h1>
      <p>What should we call you?</p>
      <input id="name" class="w-full rounded border p-3 text-lg" placeholder="Your name" />
      <button id="go" class="w-full rounded bg-indigo-600 px-4 py-3 text-white text-lg font-semibold">Let's go</button>
    </section>
  `);
  root.append(view);
  view.querySelector("#go").addEventListener("click", () => {
    const v = view.querySelector("#name").value.trim();
    if (!v) return;
    const s = loadState();
    s.displayName = v;
    s.profileId = s.profileId ?? newProfileId();
    saveState(s); render();
  });
}

function renderSubjects() {
  root.innerHTML = "";
  const view = el(`
    <section class="space-y-4 mt-8">
      <h1 class="text-2xl font-bold">Pick your subjects</h1>
      <p>Tick the ones you actually do at school.</p>
      <div id="list" class="space-y-2"></div>
      <button id="go" class="w-full rounded bg-indigo-600 px-4 py-3 text-white font-semibold">Continue</button>
    </section>
  `);
  const list = view.querySelector("#list");
  for (const sub of SUBJECTS) {
    list.append(el(`
      <label class="flex items-center gap-3 rounded border p-3 bg-white">
        <input type="checkbox" data-slug="${sub.slug}" class="w-5 h-5" />
        <span class="text-lg">${sub.name}</span>
      </label>`));
  }
  root.append(view);
  view.querySelector("#go").addEventListener("click", () => {
    const checked = [...view.querySelectorAll("input[type=checkbox]:checked")].map(i => i.dataset.slug);
    if (!checked.length) return;
    const s = loadState();
    s.enabledSubjects = checked;
    saveState(s); render();
  });
}

function renderHome() {
  const s = loadState();
  root.innerHTML = "";
  root.append(el(`
    <section class="space-y-4 mt-8">
      <h1 class="text-2xl font-bold">Good morning, ${s.displayName}</h1>
      <p>Today's plan will appear here.</p>
    </section>`));
}

render();
```

- [ ] **Step 3: Verify mobile responsive** (Chrome devtools iPhone view).
- [ ] **Step 4: Commit**: `git add web/ && git commit -m "feat(web): onboarding screens" && git push`.

---

### Task 3.3: Per-subject coverage check

**Files:** `web/js/content-loader.js`, modify `web/js/app.js`

- [ ] **Step 1: Create content loader**

```javascript
// web/js/content-loader.js
const cache = new Map();
export async function loadSubject(slug) {
  if (cache.has(slug)) return cache.get(slug);
  const resp = await fetch(`content/${slug}.json`);
  if (!resp.ok) throw new Error(`Cannot load content/${slug}.json`);
  const data = await resp.json();
  cache.set(slug, data);
  return data;
}
```

- [ ] **Step 2: Insert coverage step**

In `app.js`, change `render()`:

```javascript
import { loadSubject } from "./content-loader.js";

async function render() {
  const s = loadState();
  if (!s.profileId || !s.displayName) return renderName();
  if (s.enabledSubjects.length === 0) return renderSubjects();
  const next = s.enabledSubjects.find(slug => !(slug in s.coveredTopics));
  if (next) return renderCoverage(next);
  return renderHome();
}

async function renderCoverage(slug) {
  root.innerHTML = `<p class="mt-8">Loading…</p>`;
  let subject;
  try { subject = await loadSubject(slug); }
  catch (e) { root.innerHTML = `<p class="mt-8 text-red-600">Couldn't load ${slug}: ${e.message}</p>`; return; }
  root.innerHTML = "";
  const view = el(`
    <section class="space-y-4 mt-8">
      <h1 class="text-2xl font-bold">${subject.subject}</h1>
      <p>Tick the topics your class has actually studied.</p>
      <div id="list" class="space-y-2"></div>
      <button id="go" class="w-full rounded bg-indigo-600 px-4 py-3 text-white font-semibold">Continue</button>
    </section>`);
  const list = view.querySelector("#list");
  for (const t of subject.topics) {
    list.append(el(`
      <label class="flex items-center gap-3 rounded border p-3 bg-white">
        <input type="checkbox" data-id="${t.id}" class="w-5 h-5" checked />
        <span class="text-lg">${t.name}</span>
      </label>`));
  }
  root.append(view);
  view.querySelector("#go").addEventListener("click", () => {
    const ids = [...view.querySelectorAll("input[type=checkbox]:checked")].map(i => i.dataset.id);
    const s = loadState();
    s.coveredTopics[slug] = ids;
    saveState(s); render();
  });
}
```

- [ ] **Step 3: Manual test**: `localStorage.clear(); location.reload();` and walk through.
- [ ] **Step 4: Commit**: `git add web/ && git commit -m "feat(web): per-subject coverage onboarding" && git push`.

---

## Milestone 4 — Card system and recall/LCWC/PEE/Circle

### Task 4.1: Grader client

**Files:** `web/js/config.js`, `web/js/grader.js`

- [ ] **Step 1: `web/js/config.js`**

```javascript
export const API_BASE = "https://seb-revision-api.<account>.workers.dev";
```

Replace `<account>` with the actual Worker URL.

- [ ] **Step 2: `web/js/grader.js`**

```javascript
import { API_BASE } from "./config.js";

export async function grade({ model, system, user, maxTokens = 500 }) {
  const resp = await fetch(`${API_BASE}/api/grade`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, system, user, maxTokens }),
  });
  if (!resp.ok) throw new Error(`Grader ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

const RECALL_SYSTEM = `You are a kind, lenient marker for a 12-year-old's recall-practice answer.
Compare their answer to the expected one.
Return JSON only: {"correct": boolean, "feedback": "one short sentence"}.
Accept paraphrasing, close spellings, and partial answers as correct. Be encouraging.`;

export async function gradeRecall({ question, expected, studentAnswer }) {
  const result = await grade({
    model: "claude-haiku-4-5",
    system: RECALL_SYSTEM,
    user: `Question: ${question}\nExpected: ${expected}\nStudent's answer: ${studentAnswer}`,
    maxTokens: 150,
  });
  try { return JSON.parse(result.text); }
  catch { return { correct: false, feedback: "Couldn't read the grader — try again." }; }
}

const PEE_SYSTEM = `You are a supportive Geography teacher marking a 12-year-old's PEE (Point–Evidence–Explain) answer.
Return JSON only:
{
  "point":    {"score": 0|1|2|3, "feedback": "one sentence"},
  "evidence": {"score": 0|1|2|3, "feedback": "one sentence"},
  "explain":  {"score": 0|1|2|3, "feedback": "one sentence"},
  "overall":  "one encouraging sentence"
}
Score: 3 excellent, 2 good with minor gap, 1 on track but missing detail, 0 missing or wrong.`;

export async function gradePee({ question, model, student }) {
  const r = await grade({
    model: "claude-sonnet-4-6",
    system: PEE_SYSTEM,
    user: `Question: ${question}\n\nModel:\nP: ${model.point}\nE: ${model.evidence}\nE: ${model.explain}\n\nStudent:\nP: ${student.point}\nE: ${student.evidence}\nE: ${student.explain}`,
    maxTokens: 400,
  });
  try { return JSON.parse(r.text); } catch { return null; }
}

const CIRCLE_SYSTEM = `You are a supportive History teacher marking a 12-year-old's structured answer using the school's circle method.
The model answer lists the part names. For each part return: {"score": 0|1|2|3, "feedback": "one sentence"}.
Also include "overall": "one encouraging sentence".
Return JSON only. Use the same part names as the model answer.`;

export async function gradeCircle({ question, model, student }) {
  const parts = Object.keys(model);
  const r = await grade({
    model: "claude-sonnet-4-6",
    system: CIRCLE_SYSTEM,
    user: `Question: ${question}\n\nModel:\n${parts.map(p => `${p}: ${model[p]}`).join("\n")}\n\nStudent:\n${parts.map(p => `${p}: ${student[p] ?? ""}`).join("\n")}`,
    maxTokens: 500,
  });
  try { return JSON.parse(r.text); } catch { return null; }
}
```

- [ ] **Step 3: Browser console test**

```javascript
const { gradeRecall } = await import("./js/grader.js");
await gradeRecall({ question: "Capital of France?", expected: "Paris", studentAnswer: "paris" });
```

Expected: `{correct: true, feedback: "..."}`.

- [ ] **Step 4: Commit**: `git add web/js/ && git commit -m "feat(web): grader client"`.

---

### Task 4.2: Recall card

**Files:** `web/js/cards/recall.js`, modify `web/js/app.js`

- [ ] **Step 1: Create `web/js/cards/recall.js`**

```javascript
import { gradeRecall } from "../grader.js";

export function recallCard({ question, expected, onDone }) {
  const card = document.createElement("section");
  card.className = "rounded-xl bg-white p-4 shadow space-y-3";
  card.innerHTML = `
    <p class="text-sm text-slate-500">Quick recall</p>
    <h2 class="text-xl font-semibold">${question}</h2>
    <textarea class="ans w-full rounded border p-3" rows="3" placeholder="Type what you remember…"></textarea>
    <div class="flex gap-2">
      <button class="submit flex-1 rounded bg-indigo-600 px-4 py-3 text-white font-semibold">Check</button>
      <button class="skip rounded border px-3 py-3 text-sm">I haven't learned this</button>
    </div>
    <div class="feedback hidden rounded p-3"></div>
    <button class="next hidden w-full rounded bg-emerald-600 px-4 py-3 text-white font-semibold">Next</button>
  `;
  const ans = card.querySelector(".ans");
  const submit = card.querySelector(".submit");
  const fb = card.querySelector(".feedback");
  const next = card.querySelector(".next");
  let correct = false;

  submit.addEventListener("click", async () => {
    const studentAnswer = ans.value.trim();
    if (!studentAnswer) return;
    submit.disabled = true; submit.textContent = "Checking…";
    let result;
    try { result = await gradeRecall({ question, expected, studentAnswer }); }
    catch { result = { correct: false, feedback: "Grader napping — let's move on." }; }
    correct = !!result.correct;
    fb.classList.remove("hidden");
    fb.classList.add(correct ? "bg-emerald-100" : "bg-amber-100");
    fb.innerHTML = `
      <p class="font-semibold">${correct ? "Nice!" : "Close — expected:"}</p>
      <p class="text-sm">${result.feedback}</p>
      ${correct ? "" : `<p class="text-sm mt-1"><strong>Expected:</strong> ${expected}</p>`}
    `;
    submit.classList.add("hidden");
    next.classList.remove("hidden");
  });
  card.querySelector(".skip").addEventListener("click", () => onDone({ outcome: "skip", question }));
  next.addEventListener("click", () => onDone({ outcome: "answered", question, correct }));
  return card;
}
```

- [ ] **Step 2: Wire into `renderHome` and add `startSubject`**

```javascript
import { recallCard } from "./cards/recall.js";

function renderHome() {
  const s = loadState();
  root.innerHTML = "";
  const view = el(`
    <section class="space-y-4 mt-8">
      <h1 class="text-2xl font-bold">Hi ${s.displayName}</h1>
      <p>Pick a subject to practise:</p>
      <div id="list" class="space-y-2"></div>
    </section>`);
  const list = view.querySelector("#list");
  for (const slug of s.enabledSubjects) {
    const btn = el(`<button class="w-full rounded bg-white border p-3 text-left text-lg">${slug}</button>`);
    btn.addEventListener("click", () => startSubject(slug, []));
    list.append(btn);
  }
  root.append(view);
}

async function startSubject(slug, remainder) {
  const s = loadState();
  const subject = await loadSubject(slug);
  const covered = new Set(s.coveredTopics[slug] ?? []);
  const topics = subject.topics.filter(t => covered.has(t.id));
  const qs = topics.flatMap(t => t.retrieval_questions.map(q => ({ ...q, topicId: t.id })));
  const queue = qs.sort(() => Math.random() - 0.5).slice(0, 8);

  root.innerHTML = "";
  const container = el(`<section class="mt-4 space-y-4"><h2 class="text-xl font-semibold">${subject.subject}</h2><div class="prog text-sm text-slate-500"></div><div class="slot"></div></section>`);
  root.append(container);
  const slot = container.querySelector(".slot");
  const prog = container.querySelector(".prog");

  let i = 0;
  function showNext() {
    if (i >= queue.length) return runExtras(slug, subject, topics, remainder, slot);
    prog.textContent = `Question ${i + 1} of ${queue.length}`;
    const q = queue[i];
    slot.innerHTML = "";
    slot.append(recallCard({
      question: q.q, expected: q.a,
      onDone: result => {
        const st = loadState();
        st.history.push({ date: new Date().toISOString(), subject: slug, topic: q.topicId, type: "recall", ...result });
        saveState(st);
        if (result.outcome === "answered" && !result.correct) {
          // LCWC inserted in Task 4.3
          i++; showNext();
        } else { i++; showNext(); }
      },
    }));
  }
  showNext();
}

function runExtras(slug, subject, topics, remainder, slot) {
  // overwritten in tasks 4.4 / 4.5 / 5.1
  endSubject(slug, remainder, slot);
}

function endSubject(slug, remainder, slot) {
  slot.innerHTML = `<div class="rounded-xl bg-emerald-50 p-4">Done! <button id="back" class="ml-2 underline">Home</button></div>`;
  slot.querySelector("#back").addEventListener("click", render);
}
```

- [ ] **Step 3: Manual end-to-end test** — onboard, pick a subject, answer some questions.
- [ ] **Step 4: Commit**: `git add web/ && git commit -m "feat(web): recall card + subject session" && git push`.

---

### Task 4.3: Look/Cover/Write/Check card

**Files:** `web/js/cards/lcwc.js`, modify `web/js/app.js`

- [ ] **Step 1: `web/js/cards/lcwc.js`**

```javascript
export function lcwcCard({ fact, onDone }) {
  const card = document.createElement("section");
  card.className = "rounded-xl bg-white p-4 shadow space-y-3";
  card.innerHTML = `
    <p class="text-sm text-slate-500">Look · Cover · Write · Check</p>
    <div class="fact rounded bg-amber-50 p-3 text-lg">${fact}</div>
    <button class="cover w-full rounded bg-indigo-600 px-4 py-3 text-white font-semibold">I've looked — cover it</button>
    <textarea class="ans hidden w-full rounded border p-3" rows="3" placeholder="Write what you remember…"></textarea>
    <button class="check hidden w-full rounded bg-indigo-600 px-4 py-3 text-white font-semibold">Check</button>
    <div class="reveal hidden rounded bg-emerald-50 p-3"></div>
    <button class="next hidden w-full rounded bg-emerald-600 px-4 py-3 text-white font-semibold">Done</button>
  `;
  const factEl = card.querySelector(".fact");
  const cover = card.querySelector(".cover");
  const ans = card.querySelector(".ans");
  const check = card.querySelector(".check");
  const reveal = card.querySelector(".reveal");
  const next = card.querySelector(".next");
  cover.addEventListener("click", () => { factEl.classList.add("hidden"); cover.classList.add("hidden"); ans.classList.remove("hidden"); check.classList.remove("hidden"); ans.focus(); });
  check.addEventListener("click", () => { check.classList.add("hidden"); ans.disabled = true; reveal.classList.remove("hidden"); reveal.innerHTML = `<p class="font-semibold">Original:</p><p>${fact}</p>`; next.classList.remove("hidden"); });
  next.addEventListener("click", onDone);
  return card;
}
```

- [ ] **Step 2: In `app.js`**, after a wrong recall answer, insert an LCWC card before moving on:

```javascript
import { lcwcCard } from "./cards/lcwc.js";

// inside showNext, replace the "wrong" branch:
if (result.outcome === "answered" && !result.correct) {
  slot.innerHTML = "";
  slot.append(lcwcCard({ fact: q.a, onDone: () => { i++; showNext(); } }));
} else { i++; showNext(); }
```

- [ ] **Step 3: Manual test** — deliberately answer wrong, confirm LCWC card appears.
- [ ] **Step 4: Commit**: `git add web/ && git commit -m "feat(web): LCWC card after wrong recall" && git push`.

---

### Task 4.4: PEE structured-answer card (Geography)

**Files:** `web/js/cards/pee.js`, modify `web/js/app.js`

- [ ] **Step 1: Create `web/js/cards/pee.js`**

```javascript
import { gradePee } from "../grader.js";

export function peeCard({ question, model, onDone }) {
  const card = document.createElement("section");
  card.className = "rounded-xl bg-white p-4 shadow space-y-3";
  card.innerHTML = `
    <p class="text-sm text-slate-500">PEE answer practice</p>
    <h2 class="text-lg font-semibold">${question}</h2>
    <label class="block text-sm font-semibold">Point</label>
    <textarea class="p w-full rounded border p-2" rows="2"></textarea>
    <label class="block text-sm font-semibold">Evidence</label>
    <textarea class="e w-full rounded border p-2" rows="2"></textarea>
    <label class="block text-sm font-semibold">Explain</label>
    <textarea class="x w-full rounded border p-2" rows="3"></textarea>
    <button class="submit w-full rounded bg-indigo-600 px-4 py-3 text-white font-semibold">Submit</button>
    <div class="feedback hidden space-y-2"></div>
    <button class="next hidden w-full rounded bg-emerald-600 px-4 py-3 text-white font-semibold">Done</button>
  `;
  const submit = card.querySelector(".submit");
  const fb = card.querySelector(".feedback");
  const next = card.querySelector(".next");
  let student;
  submit.addEventListener("click", async () => {
    student = {
      point: card.querySelector(".p").value.trim(),
      evidence: card.querySelector(".e").value.trim(),
      explain: card.querySelector(".x").value.trim(),
    };
    submit.disabled = true; submit.textContent = "Marking…";
    const r = await gradePee({ question, model, student });
    submit.classList.add("hidden");
    fb.classList.remove("hidden");
    if (!r) { fb.innerHTML = `<p>Marker hiccup — moving on.</p>`; }
    else {
      const row = (label, x) => `<div class="rounded bg-slate-50 p-2"><strong>${label} (${x.score}/3):</strong> ${x.feedback}</div>`;
      fb.innerHTML = `
        ${row("Point", r.point)}${row("Evidence", r.evidence)}${row("Explain", r.explain)}
        <div class="rounded bg-emerald-50 p-2 mt-2"><strong>Overall:</strong> ${r.overall}</div>
        <details class="mt-2"><summary class="cursor-pointer text-sm underline">Show model answer</summary>
          <div class="mt-2 space-y-1 text-sm">
            <p><strong>P:</strong> ${model.point}</p>
            <p><strong>E:</strong> ${model.evidence}</p>
            <p><strong>E:</strong> ${model.explain}</p>
          </div>
        </details>
      `;
    }
    next.classList.remove("hidden");
    card.dataset.result = JSON.stringify({ student, grade: r });
  });
  next.addEventListener("click", () => onDone({ outcome: "pee", question, ...(JSON.parse(card.dataset.result || "{}")) }));
  return card;
}
```

- [ ] **Step 2: In `app.js`, replace `runExtras`** to add a PEE card for Geography:

```javascript
import { peeCard } from "./cards/pee.js";

function runExtras(slug, subject, topics, remainder, slot) {
  if (slug === "geography") {
    const pool = topics.flatMap(t => (t.pee_prompts ?? []).map(p => ({ ...p, topicId: t.id })));
    if (pool.length) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      slot.innerHTML = "";
      slot.append(peeCard({
        question: pick.question, model: pick.model_answer,
        onDone: data => {
          const st = loadState();
          st.history.push({ date: new Date().toISOString(), subject: slug, topic: pick.topicId, type: "pee", ...data });
          saveState(st);
          endSubject(slug, remainder, slot);
        },
      }));
      return;
    }
  }
  endSubject(slug, remainder, slot);
}
```

- [ ] **Step 3: Manual test** — pick Geography, finish recall, get PEE card, submit, see scored feedback.
- [ ] **Step 4: Commit**: `git add web/ && git commit -m "feat(web): PEE card for Geography" && git push`.

---

### Task 4.5: Circle method card (History)

**Files:** `web/js/cards/circle.js`, modify `web/js/app.js`

- [ ] **Step 1: Create `web/js/cards/circle.js`**

```javascript
import { gradeCircle } from "../grader.js";

export function circleCard({ question, model, onDone }) {
  const parts = Object.keys(model);
  const card = document.createElement("section");
  card.className = "rounded-xl bg-white p-4 shadow space-y-3";
  card.innerHTML = `
    <p class="text-sm text-slate-500">Circle method answer</p>
    <h2 class="text-lg font-semibold">${question}</h2>
    <div class="inputs space-y-2"></div>
    <button class="submit w-full rounded bg-indigo-600 px-4 py-3 text-white font-semibold">Submit</button>
    <div class="feedback hidden space-y-2"></div>
    <button class="next hidden w-full rounded bg-emerald-600 px-4 py-3 text-white font-semibold">Done</button>
  `;
  const inputs = card.querySelector(".inputs");
  for (const p of parts) {
    const row = document.createElement("div");
    row.innerHTML = `<label class="block text-sm font-semibold capitalize">${p}</label><textarea data-part="${p}" class="w-full rounded border p-2" rows="2"></textarea>`;
    inputs.append(row);
  }
  const submit = card.querySelector(".submit");
  const fb = card.querySelector(".feedback");
  const next = card.querySelector(".next");
  let student;
  submit.addEventListener("click", async () => {
    student = {};
    for (const ta of inputs.querySelectorAll("textarea")) student[ta.dataset.part] = ta.value.trim();
    submit.disabled = true; submit.textContent = "Marking…";
    const r = await gradeCircle({ question, model, student });
    submit.classList.add("hidden");
    fb.classList.remove("hidden");
    if (!r) { fb.innerHTML = `<p>Marker hiccup — moving on.</p>`; }
    else {
      fb.innerHTML = parts.map(p => `<div class="rounded bg-slate-50 p-2"><strong class="capitalize">${p} (${r[p]?.score}/3):</strong> ${r[p]?.feedback ?? ""}</div>`).join("") +
        `<div class="rounded bg-emerald-50 p-2 mt-2"><strong>Overall:</strong> ${r.overall ?? ""}</div>` +
        `<details class="mt-2"><summary class="cursor-pointer text-sm underline">Model answer</summary>${parts.map(p => `<p class="text-sm mt-1"><strong class="capitalize">${p}:</strong> ${model[p]}</p>`).join("")}</details>`;
    }
    next.classList.remove("hidden");
    card.dataset.result = JSON.stringify({ student, grade: r });
  });
  next.addEventListener("click", () => onDone({ outcome: "circle", question, ...(JSON.parse(card.dataset.result || "{}")) }));
  return card;
}
```

- [ ] **Step 2: Extend `runExtras`** for History:

```javascript
import { circleCard } from "./cards/circle.js";

function runExtras(slug, subject, topics, remainder, slot) {
  let extraType = null;
  let pick = null;
  if (slug === "geography") {
    const pool = topics.flatMap(t => (t.pee_prompts ?? []).map(p => ({ ...p, topicId: t.id })));
    if (pool.length) { extraType = "pee"; pick = pool[Math.floor(Math.random() * pool.length)]; }
  }
  if (slug === "history") {
    const pool = topics.flatMap(t => (t.circle_prompts ?? []).map(p => ({ ...p, topicId: t.id })));
    if (pool.length) { extraType = "circle"; pick = pool[Math.floor(Math.random() * pool.length)]; }
  }
  if (!pick) return endSubject(slug, remainder, slot);
  slot.innerHTML = "";
  const card = extraType === "pee"
    ? peeCard({ question: pick.question, model: pick.model_answer, onDone: finish })
    : circleCard({ question: pick.question, model: pick.model_answer, onDone: finish });
  slot.append(card);

  function finish(data) {
    const st = loadState();
    st.history.push({ date: new Date().toISOString(), subject: slug, topic: pick.topicId, type: extraType, ...data });
    saveState(st);
    endSubject(slug, remainder, slot);
  }
}
```

- [ ] **Step 3: Manual test** with History.
- [ ] **Step 4: Commit**: `git add web/ && git commit -m "feat(web): circle method card for History" && git push`.

---

## Milestone 5 — Daily plan and confidence

### Task 5.1: Confidence rating

**Files:** modify `web/js/app.js`

- [ ] **Step 1: Replace `endSubject` to ask confidence first**

```javascript
function endSubject(slug, remainder, slot) {
  slot.innerHTML = `
    <div class="rounded-xl bg-white p-4 shadow text-center space-y-3">
      <p class="text-lg">How did that feel?</p>
      <div class="flex justify-around text-4xl">
        <button data-c="frown">😅</button>
        <button data-c="smile">🙂</button>
        <button data-c="strong">💪</button>
      </div>
    </div>`;
  slot.querySelectorAll("button[data-c]").forEach(b =>
    b.addEventListener("click", () => {
      const st = loadState();
      st.confidence[slug] = [...(st.confidence[slug] ?? []), b.dataset.c].slice(-10);
      st.sessions.push({ date: new Date().toISOString(), subject: slug, confidence: b.dataset.c });
      saveState(st);
      if (remainder.length) startSubject(remainder[0], remainder.slice(1));
      else render();
    }));
}
```

- [ ] **Step 2: Manual test**.
- [ ] **Step 3: Commit**: `git commit -am "feat(web): confidence rating + chained sessions"`.

---

### Task 5.2: Daily plan algorithm

**Files:** `web/js/plan.js`, modify `web/js/app.js`

- [ ] **Step 1: `web/js/plan.js`**

```javascript
const TEST_DATES = {
  maths: "2026-06-04",
  english: "2026-06-04",
  science: "2026-06-05",
};

function dayDiff(a, b) { return Math.round((new Date(a) - new Date(b)) / 86_400_000); }

function weightFor(slug, meta, confidence) {
  let w = 1;
  if (meta?.weighting === "heavy") w += 3;
  else if (meta?.weighting === "structured") w += 2;
  const testDate = TEST_DATES[slug];
  if (testDate) {
    const days = dayDiff(testDate, new Date().toISOString().slice(0, 10));
    if (days >= 0 && days <= 2) w += 4;
    else if (days >= 0 && days <= 5) w += 2;
  }
  const recent = (confidence[slug] ?? []).slice(-3);
  w += recent.filter(c => c === "frown").length * 2;
  return w;
}

export function planForToday(state, metas) {
  return state.enabledSubjects
    .map(slug => ({ slug, weight: weightFor(slug, metas[slug], state.confidence) }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4)
    .map(c => c.slug);
}
```

- [ ] **Step 2: Use in home screen**

```javascript
import { planForToday } from "./plan.js";

async function renderHome() {
  const s = loadState();
  const metas = {};
  for (const slug of s.enabledSubjects) {
    try { metas[slug] = await loadSubject(slug); } catch {}
  }
  const todays = planForToday(s, metas);
  root.innerHTML = "";
  const view = el(`
    <section class="space-y-4 mt-8">
      <h1 class="text-2xl font-bold">Hi ${s.displayName}</h1>
      <p class="text-slate-600">Today's plan:</p>
      <ol id="list" class="space-y-2"></ol>
      <button id="start" class="w-full rounded bg-indigo-600 px-4 py-3 text-white font-semibold">Start</button>
    </section>`);
  const list = view.querySelector("#list");
  todays.forEach((slug, i) => {
    list.append(el(`<li class="rounded bg-white border p-3">${i + 1}. ${metas[slug]?.subject ?? slug}</li>`));
  });
  view.querySelector("#start").addEventListener("click", () => startSubject(todays[0], todays.slice(1)));
  root.append(view);
}
```

- [ ] **Step 3: Manual test** — verify Maths/English/Science weight up when test date is close, and subjects with multiple `frown` ratings get bumped.
- [ ] **Step 4: Commit and push**: `git add web/ && git commit -m "feat(web): daily plan algorithm" && git push`.

---

## Milestone 6 — Parent view

### Task 6.1: `/api/sync` and `/api/parent/:code`

**Files:** modify `worker/src/index.ts`, create `worker/test/sync.test.ts`

- [ ] **Step 1: Failing tests**

```typescript
// worker/test/sync.test.ts
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
```

- [ ] **Step 2: Implement** — add to `worker/src/index.ts` before the 404:

```typescript
if (url.pathname === "/api/sync" && req.method === "POST") {
  const ip = req.headers.get("CF-Connecting-IP") ?? "unknown";
  const writeKey = `sync:wr:${ip}:${Math.floor(Date.now() / 3_600_000)}`;
  const count = Number((await env.RATE_KV.get(writeKey)) ?? 0);
  if (count >= 6) return new Response("Too many writes", { status: 429, headers: cors(env) });
  let body: { code?: string; snapshot?: unknown };
  try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400, headers: cors(env) }); }
  if (!body.code || !/^[a-z2-9]{4}-[a-z2-9]{4}$/.test(body.code))
    return new Response("Bad code", { status: 400, headers: cors(env) });
  if (!body.snapshot || typeof body.snapshot !== "object")
    return new Response("Bad snapshot", { status: 400, headers: cors(env) });
  const text = JSON.stringify(body.snapshot);
  if (text.length > 200_000) return new Response("Snapshot too large", { status: 413, headers: cors(env) });
  await env.PARENT_KV.put(`p:${body.code}`, text, { expirationTtl: 86_400 * 30 });
  await env.RATE_KV.put(writeKey, String(count + 1), { expirationTtl: 3600 });
  return new Response(null, { status: 204, headers: cors(env) });
}

const m = url.pathname.match(/^\/api\/parent\/([a-z2-9]{4}-[a-z2-9]{4})$/);
if (m && req.method === "GET") {
  const ip = req.headers.get("CF-Connecting-IP") ?? "unknown";
  const readKey = `sync:rd:${ip}:${Math.floor(Date.now() / 60_000)}`;
  const rc = Number((await env.RATE_KV.get(readKey)) ?? 0);
  if (rc >= 30) return new Response("Too many reads", { status: 429, headers: cors(env) });
  await env.RATE_KV.put(readKey, String(rc + 1), { expirationTtl: 60 });
  const stored = await env.PARENT_KV.get(`p:${m[1]}`);
  if (!stored) return new Response("Not found", { status: 404, headers: cors(env) });
  return new Response(stored, { status: 200, headers: { ...cors(env), "content-type": "application/json" } });
}
```

- [ ] **Step 3: Tests pass; deploy**: `npx vitest run && npx wrangler deploy`.
- [ ] **Step 4: Commit**: `git add worker/ && git commit -m "feat(worker): /api/sync and /api/parent/:code" && git push`.

---

### Task 6.2: Client opt-in sync

**Files:** `web/js/sync.js`, modify `web/js/app.js`

- [ ] **Step 1: `web/js/sync.js`**

```javascript
import { loadState, saveState, newShareCode } from "./state.js";
import { API_BASE } from "./config.js";

export function ensureShareCode() {
  const s = loadState();
  if (!s.shareCode) { s.shareCode = newShareCode(); saveState(s); }
  return loadState().shareCode;
}

export async function pushSnapshot() {
  const s = loadState();
  if (!s.shareEnabled || !s.shareCode) return;
  const snapshot = {
    displayName: s.displayName,
    enabledSubjects: s.enabledSubjects,
    coveredTopics: s.coveredTopics,
    confidence: s.confidence,
    sessions: s.sessions.slice(-50),
    history: s.history.slice(-200),
    updatedAt: new Date().toISOString(),
  };
  try {
    await fetch(`${API_BASE}/api/sync`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: s.shareCode, snapshot }),
    });
  } catch {}
}
```

- [ ] **Step 2: Add a settings panel on the home screen**

In `renderHome`, append:

```javascript
import { ensureShareCode, pushSnapshot } from "./sync.js";

const settings = el(`
  <details class="mt-6 text-sm">
    <summary class="cursor-pointer">Settings</summary>
    <label class="mt-2 flex items-center gap-2">
      <input id="share" type="checkbox" />
      Share progress with parent
    </label>
    <div id="codebox" class="hidden mt-1 font-mono"></div>
  </details>`);
const shareToggle = settings.querySelector("#share");
const box = settings.querySelector("#codebox");
shareToggle.checked = s.shareEnabled;
if (s.shareEnabled) {
  const code = ensureShareCode();
  box.classList.remove("hidden");
  box.textContent = `Parent code: ${code}`;
}
shareToggle.addEventListener("change", () => {
  const st = loadState();
  st.shareEnabled = shareToggle.checked;
  if (shareToggle.checked) ensureShareCode();
  saveState(st);
  renderHome();
});
view.append(settings);
```

- [ ] **Step 3: Push snapshot after every session** — call `pushSnapshot()` inside the confidence-rating click handler in `endSubject`, after `saveState(st)`.

- [ ] **Step 4: Manual test** — enable sharing, complete a session, then `curl https://seb-revision-api.<account>.workers.dev/api/parent/<code>` and expect JSON.
- [ ] **Step 5: Commit and push**: `git add web/ && git commit -m "feat(web): opt-in share-code sync" && git push`.

---

### Task 6.3: Parent dashboard

**Files:** `web/parent.html`, `web/js/parent.js`

- [ ] **Step 1: `web/parent.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Parent View</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script type="module" src="js/parent.js"></script>
  </head>
  <body class="bg-slate-50 text-slate-900 min-h-screen">
    <main id="app" class="mx-auto max-w-2xl p-4"></main>
  </body>
</html>
```

- [ ] **Step 2: `web/js/parent.js`**

```javascript
import { API_BASE } from "./config.js";
import { grade } from "./grader.js";

const code = new URLSearchParams(location.search).get("code") ?? prompt("Parent code (e.g. abcd-1234):");
const root = document.getElementById("app");

function summariseConfidence(conf) {
  const out = [];
  for (const [slug, ratings] of Object.entries(conf || {})) {
    const last = ratings.slice(-5);
    const frown = last.filter(r => r === "frown").length;
    out.push({ slug, last, frown });
  }
  return out.sort((a, b) => b.frown - a.frown);
}

function lastByType(history, type, n) {
  return (history || []).filter(h => h.outcome === type).slice(-n).reverse();
}

async function suggestQuestions(snapshot) {
  const weak = summariseConfidence(snapshot.confidence).slice(0, 3).map(c => c.slug);
  if (!weak.length) return [];
  try {
    const r = await grade({
      model: "claude-sonnet-4-6",
      system: "Suggest 4 short open-ended questions a parent can ask their Year 7 child (age 12) about a school topic, to test understanding without it feeling like a quiz. Return a JSON array of strings only.",
      user: `Subjects they're weakest in: ${weak.join(", ")}. Generate 4 questions across these subjects.`,
      maxTokens: 300,
    });
    return JSON.parse(r.text);
  } catch { return []; }
}

async function main() {
  if (!code) { root.innerHTML = "<p>No code.</p>"; return; }
  root.innerHTML = "<p class='mt-8'>Loading…</p>";
  let s;
  try {
    const resp = await fetch(`${API_BASE}/api/parent/${code}`);
    if (!resp.ok) throw new Error(await resp.text());
    s = await resp.json();
  } catch (e) {
    root.innerHTML = `<p class='mt-8 text-red-600'>Couldn't load: ${e.message}</p>`;
    return;
  }
  root.innerHTML = `
    <h1 class="text-2xl font-bold">${s.displayName ?? "Seb"} — revision progress</h1>
    <p class="text-sm text-slate-500">Updated: ${new Date(s.updatedAt).toLocaleString()}</p>
    <h2 class="mt-6 font-semibold">Sessions</h2>
    <p>${(s.sessions || []).length} session(s) recorded</p>
    <h2 class="mt-6 font-semibold">Confidence by subject</h2>
    <ul class="space-y-1">${summariseConfidence(s.confidence).map(c => `<li>${c.slug}: ${c.last.join(" ")} ${c.frown > 1 ? "(weak)" : ""}</li>`).join("")}</ul>
    <h2 class="mt-6 font-semibold">Last PEE answers</h2>
    <div class="space-y-2">${lastByType(s.history, "pee", 5).map(h => `<pre class="text-xs bg-white p-2 rounded border overflow-auto">${JSON.stringify(h, null, 2)}</pre>`).join("") || "<p>None yet.</p>"}</div>
    <h2 class="mt-6 font-semibold">Last Circle answers</h2>
    <div class="space-y-2">${lastByType(s.history, "circle", 5).map(h => `<pre class="text-xs bg-white p-2 rounded border overflow-auto">${JSON.stringify(h, null, 2)}</pre>`).join("") || "<p>None yet.</p>"}</div>
    <h2 class="mt-6 font-semibold">Questions to ask Seb tonight</h2>
    <ul id="qs" class="list-disc ml-5"><li>Generating…</li></ul>
  `;
  const qs = await suggestQuestions(s);
  document.getElementById("qs").innerHTML = qs.length ? qs.map(q => `<li>${q}</li>`).join("") : "<li>(No suggestions yet.)</li>";
}

main();
```

- [ ] **Step 3: Manual test** on phone: `https://<pages-domain>/parent.html?code=<code>`.
- [ ] **Step 4: Commit and push**: `git add web/parent.html web/js/parent.js && git commit -m "feat(web): parent dashboard" && git push`.

---

## Milestone 7 — Smoke test, polish, hand-off

### Task 7.1: Cost smoke test

- [ ] **Step 1: Simulate two full sessions** in two browser windows (Geography + History).
- [ ] **Step 2: Inspect spend**

```bash
npx wrangler kv key get --binding RATE_KV "spend:$(($(date +%s)/86400))"
```

Expected: well under $1 for two sessions. If higher than $2, investigate prompt sizes or maxTokens.

### Task 7.2: QA checklist

- [ ] Mobile (iPhone-sized) view: onboarding works, no horizontal scroll, buttons tappable.
- [ ] Refreshing mid-session does not crash (state restored, lands on home).
- [ ] "I haven't learned this" removes a question.
- [ ] Rate limit (61st request in an hour from one IP) returns 429 with a friendly message.
- [ ] Daily $ cap: temporarily set `DAILY_USD_CAP="0.01"`, redeploy, verify 503 with friendly message, restore.
- [ ] Parent dashboard loads on phone via `?code=<code>` URL.

### Task 7.3: Hand-off

- [ ] **Step 1:** Add a short "How to use this" section to `README.md` (Seb-facing).
- [ ] **Step 2:** Send the Pages URL to Seb.
- [ ] **Step 3:** Commit and push: `git add README.md && git commit -m "docs: how to use" && git push`.

---

## Self-review

**Spec coverage:**
- Hosting/architecture (CF Pages + Worker + KV): M0
- Worker proxy with model allowlist + per-IP + global cap: M1
- Content prep from PDFs into JSON: M2
- Onboarding + per-subject coverage check: M3
- Recall/LCWC/PEE/Circle cards: M4
- Confidence + daily plan algorithm: M5
- Parent view with opt-in sync + Sonnet-generated conversation questions: M6
- Mobile responsive (Tailwind, max-w containers, large tap targets): every render task; verified in 7.2
- Cost-target check: 7.1
- "I haven't learned this" escape hatch: 4.2 (skip button)

**Placeholders:** none — every code block is complete. `REPLACE_AFTER_CREATE` and `<account>` are explicit one-time substitutions described in the step that introduces them.

**Type consistency:** the localStorage state shape defined in `state.js` (Task 3.1) is used unchanged throughout. Worker `Env` interface stable from Task 0.3. `recall_questions` in JSON content is the school's "retrieval_questions" — the executor substitutes the real word when implementing (see top-of-plan note).

**Open items deferred to content extraction (Task 2.4):** circle-method structure for History; whether RE/Music materialise; Maths worked-example format; language vocab format.
