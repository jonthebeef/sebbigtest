import { gradeRecall } from "../grader.js";

const TEMPLATE = `
  <p class="text-sm text-slate-500">Quick recall</p>
  <h2 class="text-xl font-semibold question"></h2>
  <textarea class="ans w-full rounded border p-3" rows="3" placeholder="Type what you remember…"></textarea>
  <div class="flex gap-2">
    <button class="submit flex-1 rounded bg-indigo-600 px-4 py-3 text-white font-semibold">Check</button>
    <button class="skip rounded border px-3 py-3 text-sm">I haven't learned this</button>
  </div>
  <div class="feedback hidden rounded p-3"></div>
  <button class="next hidden w-full rounded bg-emerald-600 px-4 py-3 text-white font-semibold">Next</button>
`;

export function recallCard({ question, expected, onDone }) {
  const card = document.createElement("section");
  card.className = "rounded-xl bg-white p-4 shadow space-y-3";
  // eslint-disable-next-line no-unsanitized/property
  card.innerHTML = TEMPLATE;
  card.querySelector(".question").textContent = question;
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
    fb.replaceChildren();
    const head = document.createElement("p");
    head.className = "font-semibold";
    head.textContent = correct ? "Nice!" : "Close — here's the feedback:";
    const body = document.createElement("p");
    body.className = "text-sm";
    body.textContent = result.feedback ?? "";
    fb.append(head, body);
    if (!correct) {
      const exp = document.createElement("p");
      exp.className = "text-sm mt-1";
      const strong = document.createElement("strong");
      strong.textContent = "Expected: ";
      exp.append(strong, document.createTextNode(expected));
      fb.append(exp);
    }
    submit.classList.add("hidden");
    next.classList.remove("hidden");
  });
  card.querySelector(".skip").addEventListener("click", () => onDone({ outcome: "skip", question }));
  next.addEventListener("click", () => onDone({ outcome: "answered", question, correct }));
  return card;
}
