const TEMPLATE = `
  <span class="q-pill">🎯 PICK THE ANSWER</span>
  <h2 class="h-display question mt-2"></h2>
  <div class="options space-y-2 mt-2"></div>
  <div class="feedback fb hidden"></div>
  <button class="next btn btn-success hidden">Next &rarr;</button>
`;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function mcqCard({ question, expected, distractors, onDone }) {
  const card = document.createElement("section");
  card.className = "card space-y-3";
  const tpl = document.createElement("template");
  tpl.innerHTML = TEMPLATE;
  card.append(tpl.content);
  card.querySelector(".question").textContent = question;

  const optionsHost = card.querySelector(".options");
  const fb = card.querySelector(".feedback");
  const next = card.querySelector(".next");
  let chosenCorrect = false;
  let answered = false;

  const options = shuffle([expected, ...distractors]);
  const buttons = [];

  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "tile w-full text-left";
    btn.style.cursor = "pointer";
    btn.style.fontFamily = "inherit";
    btn.textContent = opt;
    btn.addEventListener("click", () => {
      if (answered) return;
      answered = true;
      const isCorrect = opt === expected;
      chosenCorrect = isCorrect;
      buttons.forEach(b => {
        b.disabled = true;
        if (b.textContent === expected) {
          b.style.background = "linear-gradient(135deg,#d6f5e6,#b9f0d4)";
        }
        if (b === btn && !isCorrect) {
          b.style.background = "linear-gradient(135deg,#ffd6d6,#ffb0b0)";
        }
      });
      fb.classList.remove("hidden");
      fb.classList.add(isCorrect ? "fb-good" : "fb-nudge");
      if (!isCorrect) card.classList.add("shake");
      fb.replaceChildren();
      const head = document.createElement("p");
      head.className = "font-display text-lg";
      head.textContent = isCorrect ? "🎉 Bang on!" : "🤔 Not quite — the green one's right.";
      fb.append(head);
      if (!isCorrect) {
        const body = document.createElement("p");
        body.className = "mt-1";
        const strong = document.createElement("strong");
        strong.textContent = "Correct answer: ";
        body.append(strong, document.createTextNode(expected));
        fb.append(body);
      }
      next.classList.remove("hidden");
      if (isCorrect && typeof window !== "undefined" && window.__sebCelebrate) {
        window.__sebCelebrate();
      }
    });
    buttons.push(btn);
    optionsHost.append(btn);
  });

  next.addEventListener("click", () => {
    onDone({ outcome: "answered", correct: chosenCorrect, question });
  });

  return card;
}
