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

const WEEL_SYSTEM = `You are a supportive History teacher at MEA Central school marking a 12-year-old's structured answer using the WEEL technique (Words from the question, Evidence, Explain with more evidence, Link).
The model answer lists the part names as keys. For each part return: {"score": 0|1|2|3, "feedback": "one sentence"}.
Also include "overall": "one encouraging sentence".
Return JSON only. Use the same part names as the model answer.`;

export async function gradeWeel({ question, model, student }) {
  const parts = Object.keys(model);
  const r = await grade({
    model: "claude-sonnet-4-6",
    system: WEEL_SYSTEM,
    user: `Question: ${question}\n\nModel:\n${parts.map(p => `${p}: ${model[p]}`).join("\n")}\n\nStudent:\n${parts.map(p => `${p}: ${student[p] ?? ""}`).join("\n")}`,
    maxTokens: 500,
  });
  try { return JSON.parse(r.text); } catch { return null; }
}
