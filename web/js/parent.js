import { API_BASE } from "./config.js";
import { grade } from "./grader.js";

const SUBJECT_EMOJI = {
  maths: "🧮", english: "📖", science: "🔬", geography: "🌍", history: "🏛️",
  french: "🇫🇷", spanish: "🇪🇸", art: "🎨", drama: "🎭", pe: "⚽",
};

const code = new URLSearchParams(location.search).get("code") ?? prompt("Parent code (e.g. abcd-1234):");
const root = document.getElementById("app");

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

function computeStreak(sessions) {
  if (!sessions || !sessions.length) return 0;
  const days = new Set(sessions.map(s => (s.date || "").slice(0, 10)));
  const iso = d => d.toISOString().slice(0, 10);
  let cursor = new Date();
  if (!days.has(iso(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(iso(cursor))) return 0;
  }
  let count = 0;
  while (days.has(iso(cursor))) { count++; cursor.setDate(cursor.getDate() - 1); }
  return count;
}

function computeXp(history) {
  return (history || []).reduce((sum, h) => {
    if (h.type === "recall" && h.outcome === "answered" && h.correct) return sum + 5;
    if (h.type === "pee" || h.type === "weel") return sum + 10;
    return sum;
  }, 0);
}

function summariseConfidence(conf) {
  const out = [];
  for (const [slug, ratings] of Object.entries(conf || {})) {
    const last = (ratings || []).slice(-5);
    const frown = last.filter(r => r === "frown").length;
    const strong = last.filter(r => r === "strong").length;
    const score = last.length ? (strong - frown) / last.length : 0;
    out.push({ slug, last, frown, strong, score });
  }
  return out.sort((a, b) => b.frown - a.frown || a.score - b.score);
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
  const card = el("div", "parent-card space-y-2");
  if (h.subject || h.topic) {
    const meta = el("p", "text-xs text-slate-500", `${h.subject ?? ""}${h.topic ? " · " + h.topic : ""}`);
    card.append(meta);
  }
  card.append(el("h3", "font-semibold text-slate-900", h.question ?? "(no question)"));
  const student = h.student || {};
  const grd = h.grade || null;
  for (const { key, label } of PEE_PARTS) {
    const row = el("div", "rounded-lg bg-slate-50 p-3 border border-slate-100");
    row.append(el("div", "text-xs font-semibold uppercase tracking-wide text-slate-500", label));
    row.append(el("p", "text-sm whitespace-pre-wrap mt-1 text-slate-800", student[key] || "(blank)"));
    if (grd && grd[key]) {
      const fb = el("p", "text-xs mt-2 text-slate-600", `Score ${grd[key].score ?? "?"}/3 — ${grd[key].feedback ?? ""}`);
      row.append(fb);
    }
    card.append(row);
  }
  if (grd && grd.overall) {
    const overall = el("div", "rounded-lg bg-emerald-50 p-3 text-sm border border-emerald-100");
    overall.append(el("strong", "text-emerald-900", "Overall: "));
    overall.append(document.createTextNode(grd.overall));
    card.append(overall);
  }
  return card;
}

function renderWeelCard(h) {
  const card = el("div", "parent-card space-y-2");
  if (h.subject || h.topic) {
    const meta = el("p", "text-xs text-slate-500", `${h.subject ?? ""}${h.topic ? " · " + h.topic : ""}`);
    card.append(meta);
  }
  card.append(el("h3", "font-semibold text-slate-900", h.question ?? "(no question)"));
  const student = h.student || {};
  const grd = h.grade || null;
  const partKeys = Array.from(new Set([...Object.keys(student), ...(grd ? Object.keys(grd).filter(k => k !== "overall") : [])]));
  for (const key of partKeys) {
    const row = el("div", "rounded-lg bg-slate-50 p-3 border border-slate-100");
    row.append(el("div", "text-xs font-semibold uppercase tracking-wide text-slate-500", key));
    row.append(el("p", "text-sm whitespace-pre-wrap mt-1 text-slate-800", student[key] || "(blank)"));
    if (grd && grd[key] && typeof grd[key] === "object") {
      const fb = el("p", "text-xs mt-2 text-slate-600", `Score ${grd[key].score ?? "?"}/3 — ${grd[key].feedback ?? ""}`);
      row.append(fb);
    }
    card.append(row);
  }
  if (grd && grd.overall) {
    const overall = el("div", "rounded-lg bg-emerald-50 p-3 text-sm border border-emerald-100");
    overall.append(el("strong", "text-emerald-900", "Overall: "));
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

function headingBlock(s) {
  const wrap = el("section", "parent-card mb-6");
  const top = el("div", "flex items-start justify-between gap-3 flex-wrap");
  const left = document.createElement("div");
  left.append(el("p", "parent-chip", "Parent View"));
  const h1 = el("h1", "mt-2 text-3xl text-slate-900", `${s.displayName ?? "Seb"}'s revision`);
  h1.style.fontFamily = "Fredoka, sans-serif";
  h1.style.fontWeight = "700";
  left.append(h1);
  const updated = s.updatedAt ? new Date(s.updatedAt).toLocaleString() : "—";
  left.append(el("p", "text-sm text-slate-500 mt-1", `Last updated ${updated}`));
  top.append(left);

  const stats = el("div", "flex gap-2 flex-wrap");
  const sessionCount = (s.sessions || []).length;
  const streak = computeStreak(s.sessions);
  const xp = computeXp(s.history);
  function stat(label, value) {
    const box = el("div", "rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center min-w-[80px]");
    const v = el("div", "text-xl font-bold text-slate-900", String(value));
    v.style.fontFamily = "Fredoka, sans-serif";
    const l = el("div", "text-[11px] uppercase tracking-wide text-slate-500", label);
    box.append(v, l);
    return box;
  }
  stats.append(stat("Sessions", sessionCount));
  stats.append(stat("Streak", `${streak}d`));
  stats.append(stat("XP", xp));
  top.append(stats);
  wrap.append(top);
  return wrap;
}

function confidenceBlock(s) {
  const wrap = el("section", "parent-card mb-6");
  const h = el("h2", "text-lg font-semibold text-slate-900 mb-3", "Confidence by subject");
  wrap.append(h);
  const confSummary = summariseConfidence(s.confidence);
  if (!confSummary.length) {
    wrap.append(el("p", "text-slate-500 text-sm", "No confidence ratings yet."));
    return wrap;
  }
  const list = el("div", "space-y-3");
  for (const c of confSummary) {
    const row = el("div", "space-y-1");
    const top = el("div", "flex items-center justify-between gap-2");
    const name = el("div", "text-sm font-semibold text-slate-800");
    name.append(document.createTextNode(`${SUBJECT_EMOJI[c.slug] || "📚"} ${c.slug}`));
    if (c.frown > 1) {
      const tag = el("span", "ml-2 inline-block text-[11px] uppercase tracking-wide text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full", "needs help");
      name.append(tag);
    }
    const ratings = el("div", "text-base", c.last.map(r => r === "frown" ? "😅" : r === "smile" ? "🙂" : "💪").join(" ") || "(none)");
    top.append(name, ratings);
    row.append(top);
    // Bar: map score (-1..1) to width
    const bar = el("div", "parent-bar");
    const fill = el("span", null);
    const pct = Math.round(((c.score + 1) / 2) * 100);
    fill.style.width = `${pct}%`;
    bar.append(fill);
    row.append(bar);
    list.append(row);
  }
  wrap.append(list);
  return wrap;
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
  root.append(headingBlock(s));
  root.append(confidenceBlock(s));

  // Suggested questions
  const qWrap = el("section", "parent-card mb-6");
  qWrap.append(el("h2", "text-lg font-semibold text-slate-900 mb-1", "Questions to ask Seb tonight"));
  qWrap.append(el("p", "text-xs text-slate-500 mb-3", "Short, open-ended prompts based on his weakest subjects."));
  const qsList = el("ul", "list-disc ml-5 space-y-1 text-sm text-slate-800");
  qsList.append(el("li", "text-slate-500", "Generating…"));
  qWrap.append(qsList);
  root.append(qWrap);

  // PEE
  const peeRecords = lastByType(s.history, "pee", 5);
  if (peeRecords.length) {
    const wrap = el("section", "mb-6");
    wrap.append(el("h2", "text-lg font-semibold text-slate-900 mb-3", "Last PEE answers"));
    const grid = el("div", "space-y-3");
    for (const h of peeRecords) grid.append(renderPeeCard(h));
    wrap.append(grid);
    root.append(wrap);
  }

  // WEEL
  const weelRecords = lastByType(s.history, "weel", 5);
  if (weelRecords.length) {
    const wrap = el("section", "mb-6");
    wrap.append(el("h2", "text-lg font-semibold text-slate-900 mb-3", "Last WEEL answers"));
    const grid = el("div", "space-y-3");
    for (const h of weelRecords) grid.append(renderWeelCard(h));
    wrap.append(grid);
    root.append(wrap);
  }

  const qs = await suggestQuestions(s);
  qsList.replaceChildren();
  if (!qs.length) {
    qsList.append(el("li", "text-slate-500", "(No suggestions yet.)"));
  } else {
    for (const q of qs) qsList.append(el("li", null, String(q)));
  }
}

main();
