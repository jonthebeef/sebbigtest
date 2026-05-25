# Seb's Revision Tool — Design

**Date:** 2026-05-25
**Author:** brainstormed with Dad
**Status:** Approved design, ready for implementation plan

## Goal

Build a friendly, daily web-based revision tool for Sebastian (Year 7, age 12) and any friends he shares it with, to prepare for the MEA Central Year 7 Big Test 2 starting Monday 1st June 2026. Specifically supports the school's revision methods (Look/Cover/Write/Check + retrieval practice) and trains structured exam answers:

- **PEE** (Point–Evidence–Explain) for Geography
- **Circle method** for History (and RE if it materialises)

Target: noticeably better preparation than the previous Big Test. Recommended daily session ~60–90 min during half-term.

## User & context

- **Primary user:** Seb, 12, working independently on his laptop
- **Subjects in folder:** Art, Drama, English, French, Geography, History, Maths, PE, Science, Spanish (10 total). Seb may not actually take all of them — onboarding lets him tick the ones he studies.
- **Confirmed test dates:** Maths Thu 4 June, English Thu 4 June, Science Fri 5 June. Others scheduled by teachers during the test fortnight.
- **Paper notes:** Seb has paper exercise books + a "red homework book". Tool prompts him to open the right book at the right moment — it does **not** ingest or display photos of those pages.
- **Friends may use it:** Tool is deployed to a public URL; no auth.
- **Device:** Primarily laptop, but **must be fully mobile responsive** — Seb may revise on his phone too. Card layouts, scaffolded answer boxes, and the home screen all adapt to phone widths.

## Non-goals

- No spaced-repetition scheduling beyond a simple "weak → more often next day" rule.
- No teacher dashboards.
- No ingestion of the school PDFs into the deployed product (copyright). Only derived facts/questions are shipped.
- No accounts, no email, no PII collected.

## Architecture

### Hosting

- **Cloudflare Pages** — static SPA (HTML + Tailwind + vanilla JS or Alpine.js, no build step required)
- **Cloudflare Worker** at `/api/grade` — proxies to the Anthropic API; holds the API key as a secret
- **Cloudflare KV** — stores rate-limit counters and a global kill-switch
- **GitHub repo** — auto-deploys to Cloudflare on push to `main`
- No D1, no R2 (KV is also used for opt-in parent-view sync snapshots, see Parent view section)

### Client

- Single-page app. No build step (or minimal — esbuild only if needed).
- All progress, written answers, and confidence ratings stored in `localStorage` keyed by a per-device profile id (a random UUID generated on first visit; Seb just picks a display name).
- A "Download my progress" button exports JSON, "Upload" restores it — so a kid switching devices can keep going.
- All AI-graded interactions go through `/api/grade` — the API key is never in the browser.

### Worker (`/api/grade`)

Stateless proxy with strict policy:

- **Model allowlist**: `claude-haiku-4-5` and `claude-sonnet-4-6` only. Anything else → 400.
- **Per-request caps**: max input 4k tokens, max output 1k tokens (enforced before forwarding).
- **Per-IP caps** (KV-backed, 24h TTL):
  - 60 requests / hour
  - 30,000 tokens / day (sum of input + output)
- **Global daily cap**: estimated USD spend counter in KV. If it crosses a configured ceiling (e.g. $5/day), the Worker returns 503 until the next UTC day. Counter resets at 00:00 UTC.
- **CORS**: restrict `Origin` to the Pages domain.
- **Logging**: per-request: timestamp, IP hash, model, tokens, cost estimate. No prompt content logged.

### Prompt caching

Use Anthropic prompt caching on:
- The grading rubric / system prompt (large, stable)
- The subject's `content.json` slice if included in context

This keeps Sonnet grading affordable for the PEE/Circle path.

## Daily session flow

### Onboarding (first visit only)

1. "Hi! What's your name?" → display name, saved locally
2. "Which subjects do you take?" → checkbox list of the 10 subjects
3. "When's your first test?" → defaults to 1 June 2026
4. Tool generates a personalised plan for the days until tests end (~5 June)

### Per-subject first-time setup (curriculum coverage check)

The first time Seb opens a subject, the tool shows the list of topics extracted from that subject's revision PDF and asks:

> "Tick the topics your class has actually studied this year. We'll only quiz you on these."

Topics he doesn't tick are filtered out of all retrieval, LCWC, and structured-answer cards for that subject. He can edit this list later from a "My subjects" screen.

This guarantees the tool never asks about content he hasn't been taught — questions are sourced **only** from the school's own revision PDFs (which define the assessed curriculum), and further narrowed by what Seb confirms his class has covered.

### Daily home screen

```
Good morning, Seb 👋
Today: Maths · Geography · History     ~60 min
[ ▶ Start today's revision ]
Streak: 3 days 🔥
```

### Per-subject card sequence

For each subject in today's plan (cards adapt to subject type):

1. **Warm-up prompt** — "📖 Grab your Geography exercise book. Open it to your most recent piece on Rivers."
2. **Retrieval quiz** — 5–8 short questions from `content/<subject>.json`:
   - Free-text answer
   - Graded by **Haiku** with a lenient rubric (accepts close spellings, paraphrasing, partial credit). Returns: correct? / model answer / one-line nudge.
3. **Look / Cover / Write / Check** — for each fact Seb got wrong, a card shows the fact → hides it → he retypes from memory → reveals for self-check. These re-test at end of session.
4. **Structured-answer practice** — only on Geography and History days:
   - Geography: a PEE prompt question. UI has three labelled boxes: **Point** / **Evidence** / **Explain**. Submit → **Sonnet** grades each part separately against a rubric, returns score (1–3 per box) + specific feedback + a model answer he can compare to.
   - History: a Circle-method prompt question. Same scaffolded UI with whatever parts the school's Circle method requires. (Structure to be confirmed from `HISTORY Year 7 Big Test 2 Revision 25_26.pdf` during content prep — if ambiguous, ask Dad.)
5. **Confidence rating** — 😅 / 🙂 / 💪. Feeds plan-builder for tomorrow.

Every card has an **"I haven't learned this yet"** button. Pressing it removes the question, flags the topic as not-yet-covered (so future sessions skip it), and moves on without penalty.

### End of day

- Tiny celebration screen with the day's score, streak, and a "Save progress" reminder.

## Parent view (analytics + conversation prompts)

A read-only view for Dad (and any other parent whose kid opts in) showing how Seb is getting on, plus suggested questions Dad can ask him offline.

### Sync model (opt-in share code)

- In settings, Seb taps **"Share with Dad"** → tool generates a random 8-character share code (e.g. `8f3k-x9q2`)
- After each session, his device POSTs a snapshot JSON of his progress to `/api/sync` keyed by that code (KV, 30-day TTL)
- Dad opens `https://<site>/parent/8f3k-x9q2` on any device → Worker reads KV and renders the dashboard
- Only the snapshot JSON is stored (no PII beyond Seb's chosen display name)
- Sync is **off by default**; turning it off deletes the KV entry

### Parent dashboard contents

- **At-a-glance**: streak, sessions completed, % subjects on track
- **Per-subject confidence trend** — last N ratings as a sparkline, weak topics flagged in red
- **Recent structured answers** — last 5 PEE answers + last 5 Circle answers, each with: the question, Seb's answer, Sonnet's grading, the model answer
- **"Ask Seb tonight" prompts** — 3–5 conversation-starter questions per day generated by Sonnet from Seb's weakest topics. These are deliberately open-ended ("Explain in your own words…", "Why do you think…") rather than fact recall. Cached for 24h to control cost.
- **Cost meter** — tiny line showing today's API spend for transparency

### Privacy

- Share codes are 8 random characters → ~10^14 space, brute force infeasible within rate limits.
- Worker rate-limits `/parent/<code>` reads (e.g. 30/min per IP) and `/api/sync` writes (e.g. 6/hour per IP).
- Parent view URL contains the secret; not linked from anywhere public.

## Daily plan algorithm

Generated at end of each day for the next day:

- **Always include** any subject with a confirmed test in the next 48 hours.
- **Weight by**:
  - Confirmed-test subjects (Maths/Eng/Sci): heavy
  - Structured-answer subjects (Geo/Hist): heavy (need practice reps)
  - Other academic subjects (Fr/Sp/Art/Drama/PE): light, retrieval-only days, rotated
- **Weak subjects** (last confidence 😅) bumped earlier in the queue.
- Hard cap: max 4 subjects per day so a 60–90 min session is realistic.

## Content preparation (one-time)

Before launch, run a Claude Code script (or interactive session) locally that:

1. Reads each subject PDF in `Year 7 Big Test 2/`
2. Emits `content/<subject>.json` with structure:
   ```json
   {
     "subject": "Geography",
     "topics": [
       {
         "name": "Rivers",
         "facts": ["..."],
         "retrieval_questions": [
           {"q": "What is the source of a river?", "a": "The starting point, usually in upland areas."}
         ],
         "pee_prompts": [
           {"question": "...", "model_answer": {"P": "...", "E": "...", "E2": "..."}}
         ]
       }
     ]
   }
   ```
3. For History, also captures the Circle-method structure and emits `circle_prompts` analogous to `pee_prompts`.
4. The PDFs themselves are **not** committed to the repo; only the derived JSON is. PDFs stay on Dad's local disk.

## Tech stack

- **Frontend**: plain HTML + Tailwind (CDN build) + Alpine.js for interactivity. Single `index.html`, a few JS modules, no bundler.
- **Worker**: TypeScript, `wrangler` for local dev + deploy.
- **Repo layout**:
  ```
  /web/              static site (deployed to Pages)
  /worker/           Cloudflare Worker source
  /content/          generated subject JSON
  /scripts/          one-time content extraction script
  /docs/             specs, plans
  ```
- **Deploy**: GitHub Actions → Cloudflare on push to `main`.

## Error handling

- Worker errors (rate limit, API failure) → client shows a kid-friendly message: "The grader is having a snooze — try again in a minute." Retrieval/LCWC cards continue working without AI (local check by string match for retrieval; LCWC doesn't need AI at all).
- Lost localStorage → onboarding restarts. Download/upload progress is the user's safety net.

## Testing

- Unit tests on Worker policy (model allowlist, per-IP limits, global cap).
- Manual end-to-end run of a full day's session before Seb uses it day 1.
- Cost smoke test: simulate 5 sessions, confirm projected daily cost < £1.

## Open questions to resolve during implementation

1. **Circle method structure** — confirm from the History PDF during content prep. Fallback: ask Dad / Seb.
2. **Maths card design** — retrieval is awkward for maths; may need a separate "worked-example walkthrough" card type. Decide during content prep.
3. **Languages (French/Spanish)** — retrieval format for vocab vs grammar. Default: vocab flashcards with lenient grading.

## Success criteria

- Seb opens the tool every day from 26 May to 5 June without being nagged.
- He completes at least 5 full sessions in that window.
- He has written and received feedback on at least 6 PEE answers and 4 Circle answers by test day.
- Total Anthropic API cost < £10 for the full revision window.
- Tool stays up and within rate limits even if 10+ kids use it.
