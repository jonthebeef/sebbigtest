import { gradePee } from "../grader.js";

const TEMPLATE_HTML = `
  <section class="rounded-xl bg-white p-4 shadow space-y-3">
    <p class="text-sm text-slate-500">PEE answer practice</p>
    <h2 class="text-lg font-semibold question"></h2>
    <label class="block text-sm font-semibold">Point</label>
    <textarea class="p w-full rounded border p-2" rows="2"></textarea>
    <label class="block text-sm font-semibold">Evidence</label>
    <textarea class="e w-full rounded border p-2" rows="2"></textarea>
    <label class="block text-sm font-semibold">Explain</label>
    <textarea class="x w-full rounded border p-2" rows="3"></textarea>
    <button class="submit w-full rounded bg-indigo-600 px-4 py-3 text-white font-semibold">Submit</button>
    <div class="feedback hidden space-y-2"></div>
    <button class="next hidden w-full rounded bg-emerald-600 px-4 py-3 text-white font-semibold">Done</button>
  </section>
`;

function buildCard() {
  const doc = new DOMParser().parseFromString(TEMPLATE_HTML, "text/html");
  return doc.body.firstElementChild;
}

function feedbackRow(label, part) {
  const div = document.createElement("div");
  div.className = "rounded bg-slate-50 p-2";
  const strong = document.createElement("strong");
  strong.textContent = `${label} (${part?.score ?? "?"}/3): `;
  div.append(strong, document.createTextNode(part?.feedback ?? ""));
  return div;
}

export function peeCard({ question, model, onDone }) {
  const card = buildCard();
  card.querySelector(".question").textContent = question;
  const submit = card.querySelector(".submit");
  const fb = card.querySelector(".feedback");
  const next = card.querySelector(".next");
  let lastResult = null;
  let student;

  submit.addEventListener("click", async () => {
    student = {
      point: card.querySelector(".p").value.trim(),
      evidence: card.querySelector(".e").value.trim(),
      explain: card.querySelector(".x").value.trim(),
    };
    submit.disabled = true;
    submit.textContent = "Marking…";
    let r;
    try { r = await gradePee({ question, model, student }); }
    catch { r = null; }
    submit.classList.add("hidden");
    fb.classList.remove("hidden");
    fb.replaceChildren();
    if (!r) {
      const p = document.createElement("p");
      p.textContent = "Grader napping — let's move on.";
      fb.append(p);
    } else {
      fb.append(feedbackRow("Point", r.point));
      fb.append(feedbackRow("Evidence", r.evidence));
      fb.append(feedbackRow("Explain", r.explain));
      const overall = document.createElement("div");
      overall.className = "rounded bg-emerald-50 p-2 mt-2";
      const strong = document.createElement("strong");
      strong.textContent = "Overall: ";
      overall.append(strong, document.createTextNode(r.overall ?? ""));
      fb.append(overall);

      const details = document.createElement("details");
      details.className = "mt-2";
      const summary = document.createElement("summary");
      summary.className = "cursor-pointer text-sm underline";
      summary.textContent = "Show model answer";
      details.append(summary);
      const wrap = document.createElement("div");
      wrap.className = "mt-2 space-y-1 text-sm";
      for (const [label, key] of [["P", "point"], ["E", "evidence"], ["E", "explain"]]) {
        const p = document.createElement("p");
        const s = document.createElement("strong");
        s.textContent = `${label}: `;
        p.append(s, document.createTextNode(model[key] ?? ""));
        wrap.append(p);
      }
      details.append(wrap);
      fb.append(details);
    }
    lastResult = r;
    next.classList.remove("hidden");
  });
  next.addEventListener("click", () => onDone({ outcome: "pee", question, student, grade: lastResult }));
  return card;
}
