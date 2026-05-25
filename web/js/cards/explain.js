import { gradeExplain } from "../grader.js";

const TPL = [
  '<span class="q-pill">💭 EXPLAIN IT</span>',
  '<h2 class="h-display mt-2">Tell me about this idea in your own words:</h2>',
  '<div class="fact card-soft text-lg mt-1" style="background:linear-gradient(135deg,#fff1de,#ffd8a8);"></div>',
  '<textarea class="ans textarea" rows="4" placeholder="Explain it like you\'d tell a friend…"></textarea>',
  '<button class="submit btn btn-primary">Submit ✓</button>',
  '<div class="feedback fb hidden"></div>',
  '<button class="next btn btn-success hidden">Next &rarr;</button>',
].join("\n");

export function explainCard({ fact, onDone }) {
  const card = document.createElement("section");
  card.className = "card space-y-3";
  const tpl = document.createElement("template");
  tpl.innerHTML = TPL;
  card.append(tpl.content);
  card.querySelector(".fact").textContent = fact;

  const ans = card.querySelector(".ans");
  const submit = card.querySelector(".submit");
  const fb = card.querySelector(".feedback");
  const next = card.querySelector(".next");
  let lastScore = null;

  submit.addEventListener("click", async () => {
    const studentAnswer = ans.value.trim();
    if (!studentAnswer) return;
    submit.disabled = true; submit.textContent = "Checking…";
    let result;
    try { result = await gradeExplain({ fact, studentAnswer }); }
    catch { result = null; }
    if (!result || typeof result.score !== "number") {
      result = { score: 2, feedback: "Nice effort — keep going!" };
    }
    lastScore = result.score;
    const good = result.score >= 2;
    fb.classList.remove("hidden");
    fb.classList.add(good ? "fb-good" : "fb-nudge");
    fb.replaceChildren();
    const head = document.createElement("p");
    head.className = "font-display text-lg";
    const stars = "⭐".repeat(Math.max(0, Math.min(3, result.score)));
    head.textContent = `${stars || "—"}  ${good ? "Great explaining!" : "Good start"}`;
    const body = document.createElement("p");
    body.className = "mt-1";
    body.textContent = result.feedback ?? "";
    fb.append(head, body);
    submit.classList.add("hidden");
    next.classList.remove("hidden");
    if (good && typeof window !== "undefined" && window.__sebCelebrate) {
      window.__sebCelebrate();
    }
  });

  next.addEventListener("click", () => {
    onDone({ outcome: "answered", score: lastScore, fact, studentAnswer: ans.value.trim() });
  });

  return card;
}
