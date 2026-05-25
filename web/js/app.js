import { loadState, saveState, newProfileId } from "./state.js";

const SUBJECTS = [
  { slug: "maths", name: "Maths" }, { slug: "english", name: "English" }, { slug: "science", name: "Science" },
  { slug: "geography", name: "Geography" }, { slug: "history", name: "History" },
  { slug: "french", name: "French" }, { slug: "spanish", name: "Spanish" },
  { slug: "art", name: "Art" }, { slug: "drama", name: "Drama" }, { slug: "pe", name: "PE" },
];

const root = document.getElementById("app");

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function setText(node, selector, text) {
  const target = node.querySelector(selector);
  if (target) target.textContent = text;
}

function render() {
  const s = loadState();
  if (!s.profileId || !s.displayName) return renderName();
  if (s.enabledSubjects.length === 0) return renderSubjects();
  return renderHome();
}

function renderName() {
  root.innerHTML = "";
  const view = el(`
    <section class="space-y-4 mt-8">
      <h1 class="text-3xl font-bold">Hi!</h1>
      <p>What should we call you?</p>
      <input id="name" class="w-full rounded border p-3 text-lg" placeholder="Your name" />
      <button id="go" class="w-full rounded bg-indigo-600 px-4 py-3 text-white text-lg font-semibold">Let's go</button>
    </section>
  `);
  root.append(view);
  view.querySelector("#go").addEventListener("click", () => {
    const v = view.querySelector("#name").value.trim();
    if (!v) return;
    const s = loadState();
    s.displayName = v;
    s.profileId = s.profileId ?? newProfileId();
    saveState(s); render();
  });
}

function renderSubjects() {
  root.innerHTML = "";
  const view = el(`
    <section class="space-y-4 mt-8">
      <h1 class="text-2xl font-bold">Pick your subjects</h1>
      <p>Tick the ones you actually do at school.</p>
      <div id="list" class="space-y-2"></div>
      <button id="go" class="w-full rounded bg-indigo-600 px-4 py-3 text-white font-semibold">Continue</button>
    </section>
  `);
  const list = view.querySelector("#list");
  for (const sub of SUBJECTS) {
    const row = el(`
      <label class="flex items-center gap-3 rounded border p-3 bg-white">
        <input type="checkbox" class="w-5 h-5" />
        <span class="text-lg subject-name"></span>
      </label>`);
    const cb = row.querySelector("input");
    cb.dataset.slug = sub.slug;
    setText(row, ".subject-name", sub.name);
    list.append(row);
  }
  root.append(view);
  view.querySelector("#go").addEventListener("click", () => {
    const checked = [...view.querySelectorAll("input[type=checkbox]:checked")].map(i => i.dataset.slug);
    if (!checked.length) return;
    const s = loadState();
    s.enabledSubjects = checked;
    saveState(s); render();
  });
}

function renderHome() {
  const s = loadState();
  root.innerHTML = "";
  const view = el(`
    <section class="space-y-4 mt-8">
      <h1 class="text-2xl font-bold greeting"></h1>
      <p>Today's plan will appear here.</p>
    </section>`);
  setText(view, ".greeting", `Good morning, ${s.displayName}`);
  root.append(view);
}

render();
