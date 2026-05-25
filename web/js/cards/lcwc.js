const TEMPLATE = `
  <span class="q-pill">👀 Look · Cover · Write · Check</span>
  <div class="fact card-soft text-lg mt-2" style="background:linear-gradient(135deg,#fff1de,#ffd8a8);"></div>
  <button class="cover btn btn-primary">I've looked — cover it 🙈</button>
  <textarea class="ans textarea hidden" rows="3" placeholder="Write what you remember…"></textarea>
  <button class="check btn btn-primary hidden">Check ✓</button>
  <div class="reveal fb fb-good hidden"></div>
  <button class="next btn btn-success hidden">Done →</button>
`;

function buildCard() {
  const card = document.createElement("section");
  card.className = "card space-y-3";
  const tpl = document.createElement("template");
  tpl.innerHTML = TEMPLATE;
  card.append(tpl.content);
  return card;
}

export function lcwcCard({ fact, onDone }) {
  const card = buildCard();
  const factEl = card.querySelector(".fact");
  factEl.textContent = fact;
  const cover = card.querySelector(".cover");
  const ans = card.querySelector(".ans");
  const check = card.querySelector(".check");
  const reveal = card.querySelector(".reveal");
  const next = card.querySelector(".next");
  cover.addEventListener("click", () => {
    factEl.classList.add("hidden");
    cover.classList.add("hidden");
    ans.classList.remove("hidden");
    check.classList.remove("hidden");
    ans.focus();
  });
  check.addEventListener("click", () => {
    check.classList.add("hidden");
    ans.disabled = true;
    reveal.classList.remove("hidden");
    reveal.replaceChildren();
    const head = document.createElement("p");
    head.className = "font-display text-lg";
    head.textContent = "📜 Original:";
    const body = document.createElement("p");
    body.className = "mt-1";
    body.textContent = fact;
    reveal.append(head, body);
    next.classList.remove("hidden");
  });
  next.addEventListener("click", onDone);
  return card;
}
