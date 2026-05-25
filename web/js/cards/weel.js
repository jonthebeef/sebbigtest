import { gradeWeel } from "../grader.js";

const TEMPLATE_HTML = `
  <section class="card space-y-3">
    <span class="q-pill">📝 WEEL answer</span>
    <h2 class="h-display question"></h2>
    <div class="inputs space-y-2"></div>
    <button class="submit btn btn-primary">Submit ✓</button>
    <div class="feedback hidden space-y-2"></div>
    <button class="next btn btn-success hidden">Done →</button>
  </section>
`;

function buildCard() {
  const doc = new DOMParser().parseFromString(TEMPLATE_HTML, "text/html");
  return doc.body.firstElementChild;
}

function prettyLabel(key) {
  return key.replace(/_/g, " ");
}

export function weelCard({ question, model, onDone }) {
  const parts = Object.keys(model);
  const card = buildCard();
  card.querySelector(".question").textContent = question;
  const inputs = card.querySelector(".inputs");
  for (const p of parts) {
    const row = document.createElement("div");
    const label = document.createElement("label");
    label.className = "block h-sub capitalize";
    label.style.fontSize = "15px";
    label.textContent = prettyLabel(p);
    const ta = document.createElement("textarea");
    ta.className = "textarea";
    ta.rows = 2;
    ta.dataset.part = p;
    row.append(label, ta);
    inputs.append(row);
  }
  const submit = card.querySelector(".submit");
  const fb = card.querySelector(".feedback");
  const next = card.querySelector(".next");
  let lastResult = null;
  let student;

  submit.addEventListener("click", async () => {
    student = {};
    for (const ta of inputs.querySelectorAll("textarea")) {
      student[ta.dataset.part] = ta.value.trim();
    }
    submit.disabled = true;
    submit.textContent = "Marking…";
    let r;
    try { r = await gradeWeel({ question, model, student }); }
    catch { r = null; }
    submit.classList.add("hidden");
    fb.classList.remove("hidden");
    fb.replaceChildren();
    if (!r) {
      const p = document.createElement("p");
      p.className = "fb fb-nudge";
      p.textContent = "Grader napping — let's move on.";
      fb.append(p);
    } else {
      for (const p of parts) {
        const part = r[p];
        const div = document.createElement("div");
        div.className = "fb fb-info";
        const strong = document.createElement("strong");
        strong.className = "capitalize font-display";
        strong.textContent = `${prettyLabel(p)} (${part?.score ?? "?"}/3): `;
        div.append(strong, document.createTextNode(part?.feedback ?? ""));
        fb.append(div);
      }
      const overall = document.createElement("div");
      overall.className = "fb fb-good mt-2";
      const strong = document.createElement("strong");
      strong.className = "font-display";
      strong.textContent = "Overall: ";
      overall.append(strong, document.createTextNode(r.overall ?? ""));
      fb.append(overall);

      const details = document.createElement("details");
      details.className = "mt-2 card-soft";
      const summary = document.createElement("summary");
      summary.className = "cursor-pointer font-display";
      summary.textContent = "📖 Model answer";
      details.append(summary);
      for (const p of parts) {
        const para = document.createElement("p");
        para.className = "text-sm mt-1";
        const s = document.createElement("strong");
        s.className = "capitalize";
        s.textContent = `${prettyLabel(p)}: `;
        para.append(s, document.createTextNode(model[p] ?? ""));
        details.append(para);
      }
      fb.append(details);
    }
    lastResult = r;
    next.classList.remove("hidden");
  });
  next.addEventListener("click", () => onDone({ outcome: "weel", question, student, grade: lastResult }));
  return card;
}
