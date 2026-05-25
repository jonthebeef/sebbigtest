import { loadState, saveState, newProfileId } from "./state.js";
import { loadSubject } from "./content-loader.js";
import { recallCard } from "./cards/recall.js";
import { lcwcCard } from "./cards/lcwc.js";
import { peeCard } from "./cards/pee.js";

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

function subjectPrettyName(slug) {
  const found = SUBJECTS.find(s => s.slug === slug);
  return found ? found.name : slug;
}

async function render() {
  const s = loadState();
  if (!s.profileId || !s.displayName) return renderName();
  if (s.enabledSubjects.length === 0) return renderSubjects();
  const next = s.enabledSubjects.find(slug => !(slug in s.coveredTopics));
  if (next) return renderCoverage(next);
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

async function renderCoverage(slug) {
  root.innerHTML = "";
  root.append(el(`<p class="mt-8">Loading…</p>`));
  let subject;
  try {
    subject = await loadSubject(slug);
  } catch (e) {
    // Lenient: if content isn't ready, mark this subject as having empty
    // coverage and let the user move on, so we don't get stuck.
    root.innerHTML = "";
    const notReady = el(`
      <section class="space-y-4 mt-8">
        <h1 class="text-2xl font-bold subject-title"></h1>
        <p>Content isn't ready yet for this subject. We'll skip it for now.</p>
        <button id="go" class="w-full rounded bg-indigo-600 px-4 py-3 text-white font-semibold">Continue</button>
      </section>`);
    setText(notReady, ".subject-title", subjectPrettyName(slug));
    root.append(notReady);
    notReady.querySelector("#go").addEventListener("click", () => {
      const s = loadState();
      s.coveredTopics[slug] = [];
      saveState(s); render();
    });
    return;
  }
  root.innerHTML = "";
  const view = el(`
    <section class="space-y-4 mt-8">
      <h1 class="text-2xl font-bold subject-title"></h1>
      <p>Tick the topics your class has actually studied.</p>
      <div id="list" class="space-y-2"></div>
      <button id="go" class="w-full rounded bg-indigo-600 px-4 py-3 text-white font-semibold">Continue</button>
    </section>`);
  setText(view, ".subject-title", subject.subject ?? subjectPrettyName(slug));
  const list = view.querySelector("#list");
  for (const t of (subject.topics ?? [])) {
    const row = el(`
      <label class="flex items-center gap-3 rounded border p-3 bg-white">
        <input type="checkbox" class="w-5 h-5" checked />
        <span class="text-lg topic-name"></span>
      </label>`);
    const cb = row.querySelector("input");
    cb.dataset.id = t.id;
    setText(row, ".topic-name", t.name);
    list.append(row);
  }
  root.append(view);
  view.querySelector("#go").addEventListener("click", () => {
    const ids = [...view.querySelectorAll("input[type=checkbox]:checked")].map(i => i.dataset.id);
    const s = loadState();
    s.coveredTopics[slug] = ids;
    saveState(s); render();
  });
}

function renderHome() {
  const s = loadState();
  root.innerHTML = "";
  const view = el(`
    <section class="space-y-4 mt-8">
      <h1 class="text-2xl font-bold greeting"></h1>
      <p>Pick a subject to practise:</p>
      <div id="list" class="space-y-2"></div>
    </section>`);
  setText(view, ".greeting", `Hi ${s.displayName}`);
  const list = view.querySelector("#list");
  for (const slug of s.enabledSubjects) {
    const btn = el(`<button class="w-full rounded bg-white border p-3 text-left text-lg"></button>`);
    btn.textContent = subjectPrettyName(slug);
    btn.addEventListener("click", () => startSubject(slug, []));
    list.append(btn);
  }
  root.append(view);
}

async function startSubject(slug, remainder) {
  const s = loadState();
  let subject;
  try { subject = await loadSubject(slug); }
  catch { return render(); }
  const covered = new Set(s.coveredTopics[slug] ?? []);
  const topics = (subject.topics ?? []).filter(t => covered.has(t.id));
  const qs = topics.flatMap(t => (t.retrieval_questions ?? []).map(q => ({ ...q, topicId: t.id })));
  const queue = qs.sort(() => Math.random() - 0.5).slice(0, 8);

  root.innerHTML = "";
  const container = el(`
    <section class="mt-4 space-y-4">
      <h2 class="text-xl font-semibold subject-title"></h2>
      <div class="prog text-sm text-slate-500"></div>
      <div class="slot"></div>
    </section>`);
  setText(container, ".subject-title", subject.subject ?? subjectPrettyName(slug));
  root.append(container);
  const slot = container.querySelector(".slot");
  const prog = container.querySelector(".prog");

  if (!queue.length) {
    return runExtras(slug, subject, topics, remainder, slot);
  }

  let i = 0;
  function showNext() {
    if (i >= queue.length) return runExtras(slug, subject, topics, remainder, slot);
    prog.textContent = `Question ${i + 1} of ${queue.length}`;
    const q = queue[i];
    slot.innerHTML = "";
    slot.append(recallCard({
      question: q.q, expected: q.a,
      onDone: result => {
        const st = loadState();
        st.history.push({ date: new Date().toISOString(), subject: slug, topic: q.topicId, type: "recall", ...result });
        saveState(st);
        if (result.outcome === "answered" && !result.correct) {
          slot.innerHTML = "";
          slot.append(lcwcCard({ fact: q.a, onDone: () => { i++; showNext(); } }));
        } else { i++; showNext(); }
      },
    }));
  }
  showNext();
}

function runExtras(slug, subject, topics, remainder, slot) {
  if (slug === "geography") {
    const pool = topics.flatMap(t => (t.pee_prompts ?? []).map(p => ({ ...p, topicId: t.id })));
    if (pool.length) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      slot.innerHTML = "";
      slot.append(peeCard({
        question: pick.question, model: pick.model_answer,
        onDone: data => {
          const st = loadState();
          st.history.push({ date: new Date().toISOString(), subject: slug, topic: pick.topicId, type: "pee", ...data });
          saveState(st);
          endSubject(slug, remainder, slot);
        },
      }));
      return;
    }
  }
  endSubject(slug, remainder, slot);
}

function endSubject(slug, remainder, slot) {
  slot.innerHTML = "";
  const done = el(`<div class="rounded-xl bg-emerald-50 p-4">Done! <button class="back ml-2 underline">Home</button></div>`);
  done.querySelector(".back").addEventListener("click", render);
  slot.append(done);
}

render();
