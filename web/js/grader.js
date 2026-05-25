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

function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const braceMatch = candidate.match(/\{[\s\S]*\}/);
  if (!braceMatch) return null;
  try { return JSON.parse(braceMatch[0]); } catch { return null; }
}

const RECALL_SYSTEM = `You are a kind, lenient marker for a 12-year-old's quick-recall answer.

You will receive a question, the expected answer, and the student's answer. Decide if the student's answer is substantively correct.

Be GENEROUS. Accept paraphrasing, close spellings (e.g. "perimeta" for "perimeter"), missing articles, casual phrasing, partial answers that capture the key idea, and answers that approach the concept from a different but valid angle. Only mark wrong if the student is clearly missing the point or has the wrong fact.

Respond with ONLY a JSON object on a single line, with no markdown fences, no prose, no explanation outside the JSON. The JSON must be exactly:
{"correct": <true or false>, "feedback": "<one short encouraging sentence>"}`;

export async function gradeRecall({ question, expected, studentAnswer }) {
  const result = await grade({
    model: "claude-haiku-4-5",
    system: RECALL_SYSTEM,
    user: `Question: ${question}\nExpected: ${expected}\nStudent's answer: ${studentAnswer}\n\nReturn JSON only.`,
    maxTokens: 150,
  });
  const parsed = extractJson(result.text);
  if (!parsed || typeof parsed.correct !== "boolean") {
    return { correct: false, feedback: "Grader couldn't decide — check the expected answer below." };
  }
  return { correct: parsed.correct, feedback: String(parsed.feedback ?? "") };
}

const PEE_SYSTEM = `You are a supportive Geography teacher marking a 12-year-old's PEE (Point–Evidence–Explain) answer for the MEA Central Year 7 Big Test.

Be encouraging — score generously when a student shows understanding even if the wording is rough. Score: 3 excellent, 2 good with minor gap, 1 on track but missing detail, 0 missing or wrong.

Respond with ONLY a JSON object — no markdown, no prose outside the JSON:
{"point":{"score":N,"feedback":"one sentence"},"evidence":{"score":N,"feedback":"one sentence"},"explain":{"score":N,"feedback":"one sentence"},"overall":"one encouraging sentence"}`;

export async function gradePee({ question, model, student }) {
  const r = await grade({
    model: "claude-sonnet-4-6",
    system: PEE_SYSTEM,
    user: `Question: ${question}\n\nModel answer:\nP: ${model.point}\nE: ${model.evidence}\nE: ${model.explain}\n\nStudent's answer:\nP: ${student.point}\nE: ${student.evidence}\nE: ${student.explain}\n\nReturn JSON only.`,
    maxTokens: 400,
  });
  return extractJson(r.text);
}

const WEEL_SYSTEM = `You are a supportive History teacher at MEA Central school marking a Year 7 (12-year-old) student's structured essay answer using the school's WEEL technique:
- W = Words from the question (restate the question in your own words)
- E = Evidence (a specific fact, date, or example)
- E = Explain with more evidence (extend the analysis with further evidence)
- L = Link (link back to the question)

Be encouraging. Score: 3 excellent, 2 good with minor gap, 1 on track but missing detail, 0 missing or wrong.

You will be given the question, a model answer with named parts, and the student's answer with the same parts. For EACH part return {"score": 0–3, "feedback": "one sentence"}. Then add "overall": "one encouraging sentence".

Use the EXACT same part names as in the model answer (e.g. "words_from_question", "evidence", "explain_with_more_evidence", "link").

Respond with ONLY the JSON object — no markdown fences, no prose outside the JSON.`;

const EXPLAIN_SYSTEM = `You are a kind, supportive teacher checking whether a 12-year-old (Year 7) genuinely understands a fact by explaining it in their own words.

Given the original fact and the student's explanation, score their understanding 0-3:
3 = strong grasp, explained accurately with their own phrasing
2 = mostly there, minor gaps
1 = partially understood, key idea missing
0 = doesn't show understanding

Be generous — paraphrasing is the GOAL here, so original-sounding wording is good.

Respond with ONLY a JSON object:
{"score": N, "feedback": "one short encouraging sentence"}`;

export async function gradeExplain({ fact, studentAnswer }) {
  const r = await grade({
    model: "claude-sonnet-4-6",
    system: EXPLAIN_SYSTEM,
    user: `Fact: ${fact}\n\nStudent's explanation: ${studentAnswer}\n\nReturn JSON only.`,
    maxTokens: 200,
  });
  return extractJson(r.text);
}

export async function gradeWeel({ question, model, student }) {
  const parts = Object.keys(model);
  const r = await grade({
    model: "claude-sonnet-4-6",
    system: WEEL_SYSTEM,
    user: `Question: ${question}\n\nModel answer:\n${parts.map(p => `${p}: ${model[p]}`).join("\n")}\n\nStudent's answer:\n${parts.map(p => `${p}: ${student[p] ?? ""}`).join("\n")}\n\nReturn JSON only.`,
    maxTokens: 500,
  });
  return extractJson(r.text);
}
