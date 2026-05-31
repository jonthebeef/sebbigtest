export function flashcardCard({ question, answer, index, total, onRate, onSkip }) {
  const card = document.createElement("section");
  card.className = "space-y-4";

  // Counter pill
  const counterRow = document.createElement("div");
  counterRow.className = "flex items-center justify-between";
  const pill = document.createElement("span");
  pill.className = "pill pill-amber";
  pill.textContent = "🎴 FLASHCARD";
  const counter = document.createElement("span");
  counter.className = "font-display text-sm text-slate-700";
  counter.textContent = `${index + 1} / ${total}`;
  counterRow.append(pill, counter);
  card.append(counterRow);

  // The flippable card itself
  const scene = document.createElement("div");
  scene.className = "flashcard-scene";
  const flipper = document.createElement("div");
  flipper.className = "flashcard-flipper";

  const front = document.createElement("div");
  front.className = "flashcard-face flashcard-front";
  const frontLabel = document.createElement("p");
  frontLabel.className = "text-xs font-display uppercase tracking-wide opacity-80";
  frontLabel.textContent = "Question";
  const frontText = document.createElement("p");
  frontText.className = "flashcard-text";
  frontText.textContent = question;
  const tapHint = document.createElement("p");
  tapHint.className = "text-sm opacity-80 mt-3";
  tapHint.textContent = "Tap to flip 👇";
  front.append(frontLabel, frontText, tapHint);

  const back = document.createElement("div");
  back.className = "flashcard-face flashcard-back";
  const backLabel = document.createElement("p");
  backLabel.className = "text-xs font-display uppercase tracking-wide opacity-80";
  backLabel.textContent = "Answer";
  const backText = document.createElement("p");
  backText.className = "flashcard-text";
  backText.textContent = answer;
  back.append(backLabel, backText);

  flipper.append(front, back);
  scene.append(flipper);
  card.append(scene);

  let flipped = false;
  scene.addEventListener("click", () => {
    flipped = !flipped;
    flipper.classList.toggle("flipped", flipped);
    rateRow.classList.toggle("hidden", !flipped);
  });

  // Rating row (hidden until flipped)
  const rateRow = document.createElement("div");
  rateRow.className = "hidden grid grid-cols-3 gap-2";
  const ratings = [
    { key: "frown", label: "😅 Don't know", cls: "btn-rate btn-rate-bad" },
    { key: "smile", label: "🤔 Hmm", cls: "btn-rate btn-rate-mid" },
    { key: "strong", label: "💪 Got it!", cls: "btn-rate btn-rate-good" },
  ];
  for (const r of ratings) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = r.cls;
    b.textContent = r.label;
    b.addEventListener("click", e => { e.stopPropagation(); onRate(r.key); });
    rateRow.append(b);
  }
  card.append(rateRow);

  // Skip row
  const skipRow = document.createElement("div");
  skipRow.className = "flex justify-center mt-2";
  const skipBtn = document.createElement("button");
  skipBtn.type = "button";
  skipBtn.className = "text-sm underline text-slate-600";
  skipBtn.textContent = "Finish early";
  skipBtn.addEventListener("click", e => { e.stopPropagation(); onSkip(); });
  skipRow.append(skipBtn);
  card.append(skipRow);

  return card;
}
