import { loadState, saveState, newProfileId } from "./state.js";
import { loadSubject } from "./content-loader.js";
import { recallCard } from "./cards/recall.js";
import { lcwcCard } from "./cards/lcwc.js";
import { peeCard } from "./cards/pee.js";
import { weelCard } from "./cards/weel.js";
import { mcqCard } from "./cards/mcq.js";
import { explainCard } from "./cards/explain.js";
import { prepCard, bookNudge } from "./cards/prep.js";
import { flashcardCard } from "./cards/flashcard.js";
import { planForToday } from "./plan.js";
import { ensureShareCode, pushSnapshot } from "./sync.js";

const SUBJECTS = [
  { slug: "maths", name: "Maths", emoji: "🧮" },
  { slug: "english", name: "English", emoji: "📖" },
  { slug: "science", name: "Science", emoji: "🔬" },
  { slug: "geography", name: "Geography", emoji: "🌍" },
  { slug: "history", name: "History", emoji: "🏛️" },
  { slug: "french", name: "French", emoji: "🇫🇷" },
  { slug: "spanish", name: "Spanish", emoji: "🇪🇸" },
  { slug: "art", name: "Art", emoji: "🎨" },
  { slug: "drama", name: "Drama", emoji: "🎭" },
  { slug: "pe", name: "PE", emoji: "⚽" },
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

function subjectInfo(slug) {
  return SUBJECTS.find(s => s.slug === slug) || { slug, name: slug, emoji: "📚" };
}

function subjectPrettyName(slug) {
  return subjectInfo(slug).name;
}

/* ------------------------------------------------------------
   Streak + XP (derived, visual-only)
   ------------------------------------------------------------ */
function computeStreak(sessions) {
  if (!sessions || !sessions.length) return 0;
  const days = new Set(sessions.map(s => (s.date || "").slice(0, 10)));
  const today = new Date();
  const iso = d => d.toISOString().slice(0, 10);
  let count = 0;
  // Allow starting today OR yesterday (so a streak counts before they study today).
  let cursor = new Date(today);
  if (!days.has(iso(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(iso(cursor))) return 0;
  }
  while (days.has(iso(cursor))) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

function computeXp(history) {
  return (history || []).reduce((sum, h) => {
    if (h.type === "recall" && h.outcome === "answered" && h.correct) return sum + 5;
    if (h.type === "pee" || h.type === "weel") return sum + 10;
    return sum;
  }, 0);
}

function buildTopbar() {
  const s = loadState();
  const streak = computeStreak(s.sessions);
  const xp = computeXp(s.history);
  const bar = el(`
    <div class="topbar">
      <span class="chip chip-streak" data-streak></span>
      <span class="chip chip-xp" data-xp></span>
    </div>`);
  const streakEl = bar.querySelector("[data-streak]");
  if (streak <= 0) streakEl.textContent = "🚀 Start your streak!";
  else streakEl.textContent = `🔥 ${streak}-day streak`;
  bar.querySelector("[data-xp]").textContent = `✨ ${xp} XP`;
  return bar;
}

/* ------------------------------------------------------------
   Celebration helpers
   ------------------------------------------------------------ */
const CONFETTI_COLORS = ["#ff3b81", "#7c3aed", "#ffb020", "#16a374", "#38bdf8", "#ff8a00"];

function celebrate() {
  // Confetti
  const confetti = document.createElement("div");
  confetti.className = "confetti";
  for (let i = 0; i < 18; i++) {
    const piece = document.createElement("span");
    const angle = (Math.PI * 2 * i) / 18 + Math.random() * 0.3;
    const dist = 140 + Math.random() * 120;
    piece.style.setProperty("--tx", `${Math.cos(angle) * dist}px`);
    piece.style.setProperty("--ty", `${Math.sin(angle) * dist}px`);
    piece.style.setProperty("--rot", `${Math.random() * 720 - 360}deg`);
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    piece.style.animationDelay = `${Math.random() * 60}ms`;
    confetti.append(piece);
  }
  document.body.append(confetti);
  setTimeout(() => confetti.remove(), 1100);

  // Badge
  const badge = document.createElement("div");
  badge.className = "correct-badge";
  const inner = document.createElement("div");
  inner.className = "b";
  inner.textContent = "CORRECT!";
  badge.append(inner);
  document.body.append(badge);
  setTimeout(() => badge.remove(), 950);

  // XP floater
  const xp = document.createElement("div");
  xp.className = "xp-float";
  xp.textContent = "+5 XP";
  document.body.append(xp);
  setTimeout(() => xp.remove(), 1250);
}

function showXpGain(amount) {
  const xp = document.createElement("div");
  xp.className = "xp-float";
  xp.textContent = `+${amount} XP`;
  document.body.append(xp);
  setTimeout(() => xp.remove(), 1250);
}

// Expose for card modules
window.__sebCelebrate = celebrate;
window.__sebXp = showXpGain;

/* ------------------------------------------------------------
   Renderers
   ------------------------------------------------------------ */
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
    <section class="space-y-5 mt-6">
      <div class="hero">
        <h1>Hey there! 👋</h1>
        <p class="text-lg">Let's get you ready for the Big Test.</p>
      </div>
      <div class="card space-y-4">
        <label class="h-sub" for="name">What should we call you?</label>
        <input id="name" class="input" placeholder="Your name" autocomplete="given-name" />
        <button id="go" class="btn btn-primary">Let's go 🚀</button>
      </div>
    </section>
  `);
  root.append(view);
  const input = view.querySelector("#name");
  input.focus();
  const go = view.querySelector("#go");
  function commit() {
    const v = input.value.trim();
    if (!v) return;
    const s = loadState();
    s.displayName = v;
    s.profileId = s.profileId ?? newProfileId();
    saveState(s); render();
  }
  go.addEventListener("click", commit);
  input.addEventListener("keydown", e => { if (e.key === "Enter") commit(); });
}

function renderSubjects() {
  root.innerHTML = "";
  const view = el(`
    <section class="space-y-5 mt-4">
      <div class="hero">
        <h1>Pick your subjects 📚</h1>
        <p>Tick the ones you actually do at school.</p>
      </div>
      <div id="list" class="space-y-2"></div>
      <button id="go" class="btn btn-primary">Continue →</button>
    </section>
  `);
  const list = view.querySelector("#list");
  for (const sub of SUBJECTS) {
    const row = el(`
      <label class="tile">
        <input type="checkbox" />
        <span class="emoji" style="font-size:24px"></span>
        <span class="subject-name flex-1"></span>
      </label>`);
    const cb = row.querySelector("input");
    cb.dataset.slug = sub.slug;
    setText(row, ".emoji", sub.emoji);
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
  root.append(el(`<p class="mt-8 h-sub">Loading…</p>`));
  let subject;
  try {
    subject = await loadSubject(slug);
  } catch (e) {
    root.innerHTML = "";
    const info = subjectInfo(slug);
    const notReady = el(`
      <section class="space-y-4 mt-4">
        <div class="hero">
          <h1><span class="subject-emoji"></span> <span class="subject-title"></span></h1>
          <p>Content isn't ready for this subject yet — we'll skip it for now.</p>
        </div>
        <button id="go" class="btn btn-primary">Continue →</button>
      </section>`);
    setText(notReady, ".subject-emoji", info.emoji);
    setText(notReady, ".subject-title", info.name);
    root.append(notReady);
    notReady.querySelector("#go").addEventListener("click", () => {
      const s = loadState();
      s.coveredTopics[slug] = [];
      saveState(s); render();
    });
    return;
  }
  root.innerHTML = "";
  const info = subjectInfo(slug);
  const view = el(`
    <section class="space-y-5 mt-4">
      <div class="hero">
        <h1><span class="subject-emoji"></span> <span class="subject-title"></span></h1>
        <p>Tick the topics your class has actually studied.</p>
      </div>
      <div id="list" class="space-y-2"></div>
      <button id="go" class="btn btn-primary">Continue →</button>
    </section>`);
  setText(view, ".subject-emoji", info.emoji);
  setText(view, ".subject-title", subject.subject ?? info.name);
  const list = view.querySelector("#list");
  for (const t of (subject.topics ?? [])) {
    const row = el(`
      <label class="tile">
        <input type="checkbox" checked />
        <span class="topic-name flex-1"></span>
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

async function renderHome() {
  const s = loadState();
  root.innerHTML = "";
  root.append(el(`<p class="mt-8 h-sub">Loading…</p>`));

  const metas = {};
  await Promise.all(s.enabledSubjects.map(async slug => {
    try { metas[slug] = await loadSubject(slug); }
    catch { /* skip unavailable */ }
  }));

  const todays = planForToday(s, metas);

  root.innerHTML = "";
  root.append(buildTopbar());

  const view = el(`
    <section class="space-y-5">
      <div class="hero">
        <h1 class="greeting"></h1>
        <p class="text-lg">📚 Today's plan — let's smash it.</p>
      </div>
      <div class="md:grid md:grid-cols-5 md:gap-6 md:items-start space-y-5 md:space-y-0">
        <div class="md:col-span-3 space-y-3">
          <h2 class="h-sub md:block hidden">Today's plan</h2>
          <ol id="list" class="space-y-2"></ol>
        </div>
        <div class="md:col-span-2 space-y-3 md:sticky md:top-4">
          <div class="card-soft hidden md:block">
            <p class="font-display text-lg mb-1">Stuck? 📖</p>
            <p class="text-sm">Open your exercise book or textbook for the topic before you start. A quick skim helps your brain warm up.</p>
          </div>
          <button id="start" class="btn btn-go">🚀 Start</button>
          <button id="flash" class="btn btn-primary" style="margin-top:10px">🎴 Flashcards</button>
        </div>
      </div>
    </section>`);
  setText(view, ".greeting", `Hi ${s.displayName}! 💪`);
  const list = view.querySelector("#list");
  todays.forEach((slug, i) => {
    const info = subjectInfo(slug);
    const meta = metas[slug];
    const name = meta?.subject ?? info.name;
    const li = el(`<li class="plan-item"><span class="num"></span><span class="emoji"></span><span class="name"></span></li>`);
    li.querySelector(".num").textContent = String(i + 1);
    li.querySelector(".emoji").textContent = info.emoji;
    li.querySelector(".name").textContent = name;
    list.append(li);
  });
  const startBtn = view.querySelector("#start");
  if (!todays.length) {
    startBtn.disabled = true;
    startBtn.textContent = "All done for today! 🎉";
  } else {
    startBtn.addEventListener("click", () => startSubject(todays[0], todays.slice(1)));
  }
  view.querySelector("#flash").addEventListener("click", () => renderFlashcardSubjects());
  root.append(view);

  const settings = el(`
    <details class="mt-6 card-soft text-sm">
      <summary class="cursor-pointer font-display text-base">⚙️ Settings</summary>
      <label class="mt-3 flex items-center gap-2 font-display">
        <input id="share" type="checkbox" class="w-5 h-5" />
        Share progress with parent
      </label>
      <div id="codebox" class="hidden mt-3 space-y-1"></div>
    </details>`);
  const shareToggle = settings.querySelector("#share");
  const box = settings.querySelector("#codebox");
  shareToggle.checked = !!s.shareEnabled;
  function showCode() {
    const code = ensureShareCode();
    box.replaceChildren();
    const codeLine = document.createElement("div");
    codeLine.className = "font-mono text-base font-display";
    codeLine.textContent = `Parent code: ${code}`;
    const help = document.createElement("p");
    help.className = "text-slate-700 mt-1";
    help.textContent = "Share this code with your parent. They open the Parent View at the same site /parent.html?code=" + code;
    box.append(codeLine, help);
    box.classList.remove("hidden");
  }
  if (s.shareEnabled) showCode();
  shareToggle.addEventListener("change", () => {
    const st = loadState();
    st.shareEnabled = shareToggle.checked;
    saveState(st);
    if (shareToggle.checked) ensureShareCode();
    render();
  });
  root.append(settings);
}

/* ------------------------------------------------------------
   Flashcard mode
   ------------------------------------------------------------ */
async function renderFlashcardSubjects() {
  const s = loadState();
  root.innerHTML = "";
  root.append(buildTopbar());
  const view = el(`
    <section class="space-y-5">
      <div class="hero">
        <h1>🎴 Flashcards</h1>
        <p class="text-lg">Pick a subject — only what's in your revision notes.</p>
      </div>
      <div id="list" class="space-y-2"></div>
      <button id="back" class="btn btn-ghost mt-4">← Back</button>
    </section>`);
  const list = view.querySelector("#list");
  for (const slug of s.enabledSubjects) {
    const info = subjectInfo(slug);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "topic-tile";
    const e = document.createElement("span"); e.style.fontSize = "22px"; e.textContent = info.emoji;
    const n = document.createElement("span"); n.textContent = info.name;
    btn.append(e, n);
    btn.addEventListener("click", () => renderFlashcardTopics(slug));
    list.append(btn);
  }
  view.querySelector("#back").addEventListener("click", render);
  root.append(view);
}

async function renderFlashcardTopics(slug) {
  const s = loadState();
  root.innerHTML = "";
  root.append(buildTopbar());
  let subject;
  try { subject = await loadSubject(slug); }
  catch { return renderFlashcardSubjects(); }
  const covered = new Set(s.coveredTopics[slug] ?? []);
  const topics = (subject.topics ?? []).filter(t => covered.has(t.id) && (t.retrieval_questions ?? []).length);

  const info = subjectInfo(slug);
  const view = el(`
    <section class="space-y-5">
      <div class="hero">
        <h1></h1>
        <p class="text-lg">Pick a topic to flashcard.</p>
      </div>
      <div id="list" class="space-y-2"></div>
      <button id="back" class="btn btn-ghost mt-4">← Subjects</button>
    </section>`);
  view.querySelector("h1").textContent = `${info.emoji} ${subject.subject ?? info.name}`;
  const list = view.querySelector("#list");
  if (!topics.length) {
    const empty = document.createElement("p");
    empty.className = "card-soft";
    empty.textContent = "No covered topics yet for this subject. Tick them in Settings or finish a session first.";
    list.append(empty);
  }
  for (const t of topics) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "topic-tile";
    const name = document.createElement("span"); name.textContent = t.name;
    const count = document.createElement("span"); count.className = "count"; count.textContent = `${(t.retrieval_questions ?? []).length} cards`;
    btn.append(name, count);
    btn.addEventListener("click", () => runFlashcards(slug, t));
    list.append(btn);
  }
  view.querySelector("#back").addEventListener("click", renderFlashcardSubjects);
  root.append(view);
}

function runFlashcards(slug, topic) {
  const cards = [...(topic.retrieval_questions ?? [])].sort(() => Math.random() - 0.5);
  const total = cards.length;
  if (!total) return renderFlashcardTopics(slug);

  root.innerHTML = "";
  root.append(buildTopbar());
  const info = subjectInfo(slug);
  const container = el(`
    <section class="space-y-4">
      <div class="card-soft">
        <p class="text-sm text-slate-700">${info.emoji} ${subjectInfo(slug).name} · Flashcards</p>
        <h2 class="h-display topic-title"></h2>
      </div>
      <div class="slot"></div>
    </section>`);
  container.querySelector(".topic-title").textContent = topic.name;
  root.append(container);
  const slot = container.querySelector(".slot");

  const ratings = { strong: 0, smile: 0, frown: 0 };
  let i = 0;

  function showNext() {
    if (i >= cards.length) return finish();
    const c = cards[i];
    slot.replaceChildren();
    slot.append(flashcardCard({
      question: c.q,
      answer: c.a,
      index: i,
      total: cards.length,
      onRate: rating => {
        ratings[rating] = (ratings[rating] ?? 0) + 1;
        const st = loadState();
        st.history.push({
          date: new Date().toISOString(),
          subject: slug,
          topic: topic.id,
          type: "flashcard",
          outcome: "rated",
          rating,
        });
        // Count "strong" rating as a session entry for streak/sessions
        if (i === 0) {
          st.sessions.push({ date: new Date().toISOString(), subject: slug, mode: "flashcards" });
        }
        saveState(st);
        if (rating === "strong" && typeof window.__sebXp === "function") window.__sebXp(3);
        i++;
        showNext();
      },
      onSkip: () => finish(),
    }));
  }

  function finish() {
    slot.replaceChildren();
    const done = el(`
      <div class="card-soft space-y-3">
        <h2 class="h-display">Nice work! 🎉</h2>
        <p class="text-base">Summary for <strong class="topic-name"></strong>:</p>
        <ul class="prep-list">
          <li>💪 Got it: <strong class="r-strong"></strong></li>
          <li>🤔 Hmm: <strong class="r-smile"></strong></li>
          <li>😅 Don't know: <strong class="r-frown"></strong></li>
        </ul>
        <div class="grid grid-cols-2 gap-2">
          <button id="again" class="btn btn-primary">🔁 Again</button>
          <button id="home" class="btn btn-go">🏠 Home</button>
        </div>
      </div>`);
    done.querySelector(".topic-name").textContent = topic.name;
    done.querySelector(".r-strong").textContent = String(ratings.strong);
    done.querySelector(".r-smile").textContent = String(ratings.smile);
    done.querySelector(".r-frown").textContent = String(ratings.frown);
    done.querySelector("#again").addEventListener("click", () => runFlashcards(slug, topic));
    done.querySelector("#home").addEventListener("click", render);
    slot.append(done);

    // Push snapshot if sharing
    pushSnapshot();
  }

  showNext();
}

function questionKey(topicId, q) { return `${topicId}|${q}`; }

function addToWeak(slug, key) {
  const st = loadState();
  const list = st.weakQuestions[slug] ?? [];
  if (!list.includes(key)) {
    list.push(key);
    st.weakQuestions[slug] = list.slice(-50);
    saveState(st);
  }
}

function removeFromWeak(slug, key) {
  const st = loadState();
  const list = st.weakQuestions[slug] ?? [];
  const next = list.filter(k => k !== key);
  if (next.length !== list.length) {
    st.weakQuestions[slug] = next;
    saveState(st);
  }
}

async function startSubject(slug, remainder) {
  const s = loadState();
  let subject;
  try { subject = await loadSubject(slug); }
  catch { return render(); }
  const covered = new Set(s.coveredTopics[slug] ?? []);
  const topics = (subject.topics ?? []).filter(t => covered.has(t.id));
  const allQs = topics.flatMap(t => (t.retrieval_questions ?? []).map(q => ({ ...q, topicId: t.id })));

  // Build queue: weak Qs first (up to 3), then fresh random to reach 8
  const weakKeys = s.weakQuestions[slug] ?? [];
  const byKey = new Map(allQs.map(q => [questionKey(q.topicId, q.q), q]));
  const weakPicks = [];
  for (const k of weakKeys) {
    if (weakPicks.length >= 3) break;
    const q = byKey.get(k);
    if (q) weakPicks.push(q);
  }
  const weakSet = new Set(weakPicks.map(q => questionKey(q.topicId, q.q)));
  const fresh = allQs.filter(q => !weakSet.has(questionKey(q.topicId, q.q)))
                     .sort(() => Math.random() - 0.5)
                     .slice(0, Math.max(0, 8 - weakPicks.length));
  const queue = [...weakPicks, ...fresh];

  // Pre-decide which slots use MCQ (~30%) and which is the explain slot (~position 4)
  const mcqSlots = new Set();
  queue.forEach((_, idx) => { if (Math.random() < 0.3) mcqSlots.add(idx); });
  const explainSlot = queue.length >= 4 ? 3 : -1;
  let explainShown = false;

  // Warm-up: 3 LCWC facts
  const allFacts = topics.flatMap(t => (t.facts ?? []).map(f => ({ fact: f, topicId: t.id })));
  const warmups = allFacts.sort(() => Math.random() - 0.5).slice(0, 3);

  // Pick a fact for explain card
  const explainFact = allFacts.length ? allFacts[Math.floor(Math.random() * allFacts.length)] : null;

  root.innerHTML = "";
  root.append(buildTopbar());

  const info = subjectInfo(slug);
  const container = el(`
    <section class="mt-2 space-y-4">
      <div class="card-soft">
        <div class="flex items-center gap-3 mb-3">
          <span class="text-3xl subject-emoji"></span>
          <h2 class="h-display flex-1 subject-title"></h2>
        </div>
        <div class="flex items-center gap-3">
          <div class="progress-shell flex-1"><div class="progress-fill"></div></div>
          <span class="font-display text-sm prog-text whitespace-nowrap"></span>
        </div>
      </div>
      <div class="slot"></div>
    </section>`);
  setText(container, ".subject-emoji", info.emoji);
  setText(container, ".subject-title", subject.subject ?? info.name);
  root.append(container);
  const slot = container.querySelector(".slot");
  const fill = container.querySelector(".progress-fill");
  const progText = container.querySelector(".prog-text");

  function updateProgress(current, total) {
    const pct = total ? Math.round((current / total) * 100) : 100;
    fill.style.width = `${pct}%`;
    progText.textContent = `${current}/${total}`;
  }

  if (!queue.length && !warmups.length) {
    updateProgress(0, 1);
    return runExtras(slug, subject, topics, remainder, slot);
  }

  // ----- Warm-up phase -----
  function runWarmups(done) {
    if (!warmups.length) return done();
    let w = 0;
    function showWarm() {
      if (w >= warmups.length) return done();
      slot.innerHTML = "";
      const wrap = document.createElement("div");
      wrap.className = "space-y-3";
      const heading = document.createElement("h3");
      heading.className = "h-display";
      heading.textContent = `Warm up 🔥  (${w + 1}/${warmups.length})`;
      wrap.append(heading);
      wrap.append(lcwcCard({
        fact: warmups[w].fact,
        onDone: () => { w++; showWarm(); },
      }));
      slot.append(wrap);
    }
    showWarm();
  }

  updateProgress(0, Math.max(queue.length, 1));

  let i = 0;
  function showNext() {
    if (i >= queue.length) {
      updateProgress(queue.length, queue.length);
      return runExtras(slug, subject, topics, remainder, slot);
    }
    updateProgress(i, queue.length);
    slot.innerHTML = "";

    // Insert explain card at the explainSlot position (before recall at that index)
    if (i === explainSlot && !explainShown && explainFact) {
      explainShown = true;
      slot.append(explainCard({
        fact: explainFact.fact,
        onDone: data => {
          const st = loadState();
          st.history.push({
            date: new Date().toISOString(),
            subject: slug,
            topic: explainFact.topicId,
            type: "explain",
            ...data,
          });
          saveState(st);
          // Don't advance i — fall through to the recall/MCQ for slot i
          renderQuestion();
        },
      }));
      return;
    }

    renderQuestion();
  }

  function renderQuestion() {
    const q = queue[i];
    slot.innerHTML = "";

    // MCQ branch
    if (mcqSlots.has(i)) {
      const others = allQs
        .filter(o => !(o.topicId === q.topicId && o.q === q.q))
        .map(o => o.a);
      const uniq = [...new Set(others.filter(a => a && a !== q.a))];
      const distractors = uniq.sort(() => Math.random() - 0.5).slice(0, 3);
      if (distractors.length === 3) {
        slot.append(mcqCard({
          question: q.q, expected: q.a, distractors,
          onDone: result => {
            const st = loadState();
            st.history.push({
              date: new Date().toISOString(),
              subject: slug, topic: q.topicId, type: "mcq",
              outcome: result.outcome, correct: result.correct, question: q.q,
            });
            saveState(st);
            if (result.correct) removeFromWeak(slug, questionKey(q.topicId, q.q));
            i++;
            updateProgress(i, queue.length);
            showNext();
          },
        }));
        return;
      }
      // fall through to recall if not enough distractors
    }

    slot.append(recallCard({
      question: q.q, expected: q.a,
      onDone: result => {
        const st = loadState();
        st.history.push({ date: new Date().toISOString(), subject: slug, topic: q.topicId, type: "recall", ...result });
        saveState(st);
        const key = questionKey(q.topicId, q.q);

        if (result.outcome === "idk") {
          addToWeak(slug, key);
          // Slot in LCWC, then re-queue the question, then advance
          slot.innerHTML = "";
          slot.append(lcwcCard({
            fact: q.a,
            onDone: () => {
              queue.push(q);
              i++;
              updateProgress(i, queue.length);
              showNext();
            },
          }));
          return;
        }

        if (result.outcome === "answered" && !result.correct) {
          slot.innerHTML = "";
          slot.append(lcwcCard({ fact: q.a, onDone: () => { i++; updateProgress(i, queue.length); showNext(); } }));
        } else {
          if (result.outcome === "answered" && result.correct) removeFromWeak(slug, key);
          i++;
          updateProgress(i, queue.length);
          showNext();
        }
      },
    }));
  }

  // Prep card → warmups → questions
  slot.innerHTML = "";
  slot.append(prepCard({
    slug,
    subjectName: subject.subject ?? info.name,
    onDone: () => runWarmups(() => showNext()),
  }));
}

function runExtras(slug, subject, topics, remainder, slot) {
  let extraType = null;
  let pick = null;
  if (slug === "geography") {
    const pool = topics.flatMap(t => (t.pee_prompts ?? []).map(p => ({ ...p, topicId: t.id })));
    if (pool.length) { extraType = "pee"; pick = pool[Math.floor(Math.random() * pool.length)]; }
  } else if (slug === "history") {
    const pool = topics.flatMap(t => (t.circle_prompts ?? []).map(p => ({ ...p, topicId: t.id })));
    if (pool.length) { extraType = "weel"; pick = pool[Math.floor(Math.random() * pool.length)]; }
  }
  if (!pick) return endSubject(slug, remainder, slot);

  function finish(data) {
    const st = loadState();
    st.history.push({ date: new Date().toISOString(), subject: slug, topic: pick.topicId, type: extraType, ...data });
    saveState(st);
    showXpGain(10);
    endSubject(slug, remainder, slot);
  }

  slot.innerHTML = "";
  const card = extraType === "pee"
    ? peeCard({ question: pick.question, model: pick.model_answer, onDone: finish })
    : weelCard({ question: pick.question, model: pick.model_answer, onDone: finish });
  slot.append(card);
}

function endSubject(slug, remainder, slot) {
  slot.innerHTML = "";
  const panel = el(`
    <div class="card space-y-4">
      <p class="h-display text-center">How did that feel? 🎯</p>
      <div class="flex gap-3">
        <button data-c="frown" class="conf-btn">😅<span class="lbl">tricky</span></button>
        <button data-c="smile" class="conf-btn">🙂<span class="lbl">okay</span></button>
        <button data-c="strong" class="conf-btn">💪<span class="lbl">strong</span></button>
      </div>
    </div>`);
  panel.querySelectorAll("button[data-c]").forEach(btn => {
    btn.addEventListener("click", () => {
      const choice = btn.dataset.c;
      const st = loadState();
      const prev = st.confidence[slug] ?? [];
      st.confidence[slug] = [...prev, choice].slice(-10);
      st.sessions.push({ date: new Date().toISOString(), subject: slug, confidence: choice });
      saveState(st);
      pushSnapshot();
      if (remainder.length) startSubject(remainder[0], remainder.slice(1));
      else render();
    });
  });
  slot.append(panel);
}

render();
