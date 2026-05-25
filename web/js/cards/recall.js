import { gradeRecall } from "../grader.js";

const TEMPLATE = `
  <span class="q-pill">⚡ Quick recall</span>
  <h2 class="h-display question mt-2"></h2>
  <textarea class="ans textarea" rows="3" placeholder="Type what you remember…"></textarea>
  <div class="flex gap-2 flex-wrap">
    <button class="submit btn btn-primary flex-1">Check ✓</button>
    <button class="idk btn btn-ghost" style="width:auto;">I don't know yet 🤔</button>
    <button class="skip btn btn-ghost" style="width:auto;">I haven't learned this</button>
  </div>
  <div class="feedback fb hidden"></div>
  <button class="next btn btn-success hidden">Next →</button>
`;

export function recallCard({ question, expected, onDone }) {
  const card = document.createElement("section");
  card.className = "card space-y-3";
  // eslint-disable-next-line no-unsanitized/property
  card.innerHTML = TEMPLATE;
  card.querySelector(".question").textContent = question;
  const ans = card.querySelector(".ans");
  const submit = card.querySelector(".submit");
  const idk = card.querySelector(".idk");
  const skip = card.querySelector(".skip");
  const fb = card.querySelector(".feedback");
  const next = card.querySelector(".next");
  let correct = false;
  let mode = "answer"; // "answer" | "idk"

  submit.addEventListener("click", async () => {
    const studentAnswer = ans.value.trim();
    if (!studentAnswer) return;
    submit.disabled = true; submit.textContent = "Checking…";
    let result;
    try { result = await gradeRecall({ question, expected, studentAnswer }); }
    catch { result = { correct: false, feedback: "Grader napping — let's move on." }; }
    correct = !!result.correct;
    fb.classList.remove("hidden");
    fb.classList.add(correct ? "fb-good" : "fb-nudge");
    if (!correct) card.classList.add("shake");
    fb.replaceChildren();
    const head = document.createElement("p");
    head.className = "font-display text-lg";
    head.textContent = correct ? "🎉 Nice one!" : "🤔 So close — have a look:";
    const body = document.createElement("p");
    body.className = "mt-1";
    body.textContent = result.feedback ?? "";
    fb.append(head, body);
    if (!correct) {
      const exp = document.createElement("p");
      exp.className = "mt-2";
      const strong = document.createElement("strong");
      strong.textContent = "Expected: ";
      exp.append(strong, document.createTextNode(expected));
      fb.append(exp);
    }
    submit.classList.add("hidden");
    idk.classList.add("hidden");
    skip.classList.add("hidden");
    next.classList.remove("hidden");
    if (correct && typeof window !== "undefined" && window.__sebCelebrate) {
      window.__sebCelebrate();
    }
  });

  idk.addEventListener("click", () => {
    mode = "idk";
    // Hide input controls, reveal teaching panel
    ans.classList.add("hidden");
    submit.classList.add("hidden");
    idk.classList.add("hidden");
    skip.classList.add("hidden");
    fb.classList.remove("hidden");
    fb.classList.add("fb-info");
    fb.replaceChildren();
    const head = document.createElement("p");
    head.className = "font-display text-lg";
    head.textContent = "💡 Here's the answer:";
    const body = document.createElement("p");
    body.className = "mt-1";
    body.textContent = expected;
    const hint = document.createElement("p");
    hint.className = "mt-2 text-sm";
    hint.textContent = "We'll practise this one with Look-Cover-Write-Check, then bring it back later.";
    fb.append(head, body, hint);
    next.classList.remove("hidden");
    next.textContent = "Practise it →";
  });

  skip.addEventListener("click", () => onDone({ outcome: "skip", question }));
  next.addEventListener("click", () => {
    if (mode === "idk") onDone({ outcome: "idk", question });
    else onDone({ outcome: "answered", question, correct });
  });
  return card;
}
