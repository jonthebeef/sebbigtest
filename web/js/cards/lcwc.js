const TEMPLATE = `
  <p class="text-sm text-slate-500">Look · Cover · Write · Check</p>
  <div class="fact rounded bg-amber-50 p-3 text-lg"></div>
  <button class="cover w-full rounded bg-indigo-600 px-4 py-3 text-white font-semibold">I've looked — cover it</button>
  <textarea class="ans hidden w-full rounded border p-3" rows="3" placeholder="Write what you remember…"></textarea>
  <button class="check hidden w-full rounded bg-indigo-600 px-4 py-3 text-white font-semibold">Check</button>
  <div class="reveal hidden rounded bg-emerald-50 p-3"></div>
  <button class="next hidden w-full rounded bg-emerald-600 px-4 py-3 text-white font-semibold">Done</button>
`;

function buildCard() {
  const card = document.createElement("section");
  card.className = "rounded-xl bg-white p-4 shadow space-y-3";
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
    head.className = "font-semibold";
    head.textContent = "Original:";
    const body = document.createElement("p");
    body.textContent = fact;
    reveal.append(head, body);
    next.classList.remove("hidden");
  });
  next.addEventListener("click", onDone);
  return card;
}
