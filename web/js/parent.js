import { API_BASE } from "./config.js";
import { grade } from "./grader.js";

const code = new URLSearchParams(location.search).get("code") ?? prompt("Parent code (e.g. abcd-1234):");
const root = document.getElementById("app");

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

function summariseConfidence(conf) {
  const out = [];
  for (const [slug, ratings] of Object.entries(conf || {})) {
    const last = (ratings || []).slice(-5);
    const frown = last.filter(r => r === "frown").length;
    out.push({ slug, last, frown });
  }
  return out.sort((a, b) => b.frown - a.frown);
}

function lastByType(history, type, n) {
  return (history || []).filter(h => h.outcome === type).slice(-n).reverse();
}

const PEE_PARTS = [
  { key: "point", label: "Point" },
  { key: "evidence", label: "Evidence" },
  { key: "explain", label: "Explain" },
];

function renderPeeCard(h) {
  const card = el("div", "rounded-xl bg-white p-3 shadow-sm border space-y-2");
  if (h.subject || h.topic) {
    const meta = el("p", "text-xs text-slate-500", `${h.subject ?? ""}${h.topic ? " · " + h.topic : ""}`);
    card.append(meta);
  }
  card.append(el("h3", "font-semibold", h.question ?? "(no question)"));
  const student = h.student || {};
  const grd = h.grade || null;
  for (const { key, label } of PEE_PARTS) {
    const row = el("div", "rounded bg-slate-50 p-2");
    row.append(el("div", "text-xs font-semibold text-slate-600", label));
    row.append(el("p", "text-sm whitespace-pre-wrap", student[key] || "(blank)"));
    if (grd && grd[key]) {
      const fb = el("p", "text-xs mt-1 text-slate-700", `Score ${grd[key].score ?? "?"}/3 — ${grd[key].feedback ?? ""}`);
      row.append(fb);
    }
    card.append(row);
  }
  if (grd && grd.overall) {
    const overall = el("div", "rounded bg-emerald-50 p-2 text-sm");
    overall.append(el("strong", null, "Overall: "));
    overall.append(document.createTextNode(grd.overall));
    card.append(overall);
  }
  // Model answer is not stored on the history record, so it is omitted here.
  return card;
}

function renderWeelCard(h) {
  const card = el("div", "rounded-xl bg-white p-3 shadow-sm border space-y-2");
  if (h.subject || h.topic) {
    const meta = el("p", "text-xs text-slate-500", `${h.subject ?? ""}${h.topic ? " · " + h.topic : ""}`);
    card.append(meta);
  }
  card.append(el("h3", "font-semibold", h.question ?? "(no question)"));
  const student = h.student || {};
  const grd = h.grade || null;
  const partKeys = Array.from(new Set([...Object.keys(student), ...(grd ? Object.keys(grd).filter(k => k !== "overall") : [])]));
  for (const key of partKeys) {
    const row = el("div", "rounded bg-slate-50 p-2");
    row.append(el("div", "text-xs font-semibold text-slate-600", key));
    row.append(el("p", "text-sm whitespace-pre-wrap", student[key] || "(blank)"));
    if (grd && grd[key] && typeof grd[key] === "object") {
      const fb = el("p", "text-xs mt-1 text-slate-700", `Score ${grd[key].score ?? "?"}/3 — ${grd[key].feedback ?? ""}`);
      row.append(fb);
    }
    card.append(row);
  }
  if (grd && grd.overall) {
    const overall = el("div", "rounded bg-emerald-50 p-2 text-sm");
    overall.append(el("strong", null, "Overall: "));
    overall.append(document.createTextNode(grd.overall));
    card.append(overall);
  }
  return card;
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

function clearRoot() { root.replaceChildren(); }

function showMessage(text, color = "text-slate-700") {
  clearRoot();
  root.append(el("p", `mt-8 ${color}`, text));
}

async function main() {
  if (!code) { showMessage("No code provided.", "text-red-600"); return; }
  showMessage("Loading…");
  let s;
  try {
    const resp = await fetch(`${API_BASE}/api/parent/${code}`);
    if (!resp.ok) throw new Error(`${resp.status} ${await resp.text()}`);
    s = await resp.json();
  } catch (e) {
    showMessage(`Couldn't load: ${e.message}`, "text-red-600");
    return;
  }

  clearRoot();
  root.append(el("h1", "text-2xl font-bold", `${s.displayName ?? "Seb"} — revision progress`));
  const updated = s.updatedAt ? new Date(s.updatedAt).toLocaleString() : "—";
  root.append(el("p", "text-sm text-slate-500", `Updated: ${updated}`));

  root.append(el("h2", "mt-6 font-semibold", "Sessions"));
  root.append(el("p", null, `${(s.sessions || []).length} session(s) recorded`));

  root.append(el("h2", "mt-6 font-semibold", "Confidence by subject"));
  const confList = el("ul", "space-y-1");
  const confSummary = summariseConfidence(s.confidence);
  if (!confSummary.length) {
    confList.append(el("li", "text-slate-500", "No confidence ratings yet."));
  } else {
    for (const c of confSummary) {
      const li = el("li", null);
      li.append(el("strong", null, c.slug));
      li.append(document.createTextNode(`: ${c.last.join(" ") || "(none)"}`));
      if (c.frown > 1) li.append(el("span", "ml-2 text-red-600", "(weak)"));
      confList.append(li);
    }
  }
  root.append(confList);

  root.append(el("h2", "mt-6 font-semibold", "Last PEE answers"));
  const peeWrap = el("div", "space-y-2");
  const peeRecords = lastByType(s.history, "pee", 5);
  if (!peeRecords.length) peeWrap.append(el("p", "text-slate-500", "None yet."));
  else for (const h of peeRecords) peeWrap.append(renderPeeCard(h));
  root.append(peeWrap);

  root.append(el("h2", "mt-6 font-semibold", "Last WEEL answers"));
  const weelWrap = el("div", "space-y-2");
  const weelRecords = lastByType(s.history, "weel", 5);
  if (!weelRecords.length) weelWrap.append(el("p", "text-slate-500", "None yet."));
  else for (const h of weelRecords) weelWrap.append(renderWeelCard(h));
  root.append(weelWrap);

  root.append(el("h2", "mt-6 font-semibold", "Questions to ask Seb tonight"));
  const qsList = el("ul", "list-disc ml-5");
  qsList.append(el("li", null, "Generating…"));
  root.append(qsList);

  const qs = await suggestQuestions(s);
  qsList.replaceChildren();
  if (!qs.length) {
    qsList.append(el("li", "text-slate-500", "(No suggestions yet.)"));
  } else {
    for (const q of qs) qsList.append(el("li", null, String(q)));
  }
}

main();
