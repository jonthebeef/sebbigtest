# Seb's Revision Tool

A friendly daily web revision tool for Sebastian (Year 7) and friends, built for the MEA Central Year 7 Big Test 2 (Monday 1 June 2026).

- **Spec:** `docs/superpowers/specs/2026-05-25-seb-revision-tool-design.md`
- **Implementation plan:** `docs/superpowers/plans/2026-05-25-seb-revision-tool.md`
- **Stack:** Cloudflare Pages (static frontend) + Cloudflare Worker (Anthropic proxy) + Cloudflare KV (rate limits, opt-in parent sync)

## Local development

```bash
npm install
npm run dev:web     # frontend at http://localhost:8080
npm run dev:worker  # Worker at http://localhost:8787
npm test            # Worker unit tests
```

## Deploy

```bash
npx wrangler deploy
```

Frontend is auto-deployed by Cloudflare Pages on push to `main`.
