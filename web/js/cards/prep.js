const PREP_BY_SUBJECT = {
  geography: {
    books: ["Geography exercise book", "Geography knowledge organiser", "Red retrieval / LCWC book"],
    tips: [
      "Have your knowledge organiser open on the right topic — refer to it whenever you're stuck.",
      "Geography answers want PEE: Point, Evidence, Explain. The app will walk you through it.",
    ],
  },
  history: {
    books: ["History exercise book", "History knowledge organiser", "Red retrieval / LCWC book"],
    tips: [
      "Essay questions use WEEL: Words from the question, Evidence, Explain with more evidence, Link.",
      "Source questions use PEK: Point, Evidence, Knowledge.",
      "If you're stuck on dates or names, check your knowledge organiser before guessing.",
    ],
  },
  maths: {
    books: ["Maths exercise book", "Maths knowledge organiser", "Calculator", "Pencil + paper for working"],
    tips: [
      "Use paper for any calculation — don't try to do it all in your head.",
      "Watch the units in your answer (cm, cm², °, etc.).",
    ],
  },
  english: {
    books: ["English exercise book", "English knowledge organiser", "Red retrieval / LCWC book", "Copy of the poem if you have one"],
    tips: [
      "For poetry analysis use the What / How / Why structure.",
      "Keep your quotes short and exact — the punctuation matters.",
    ],
  },
  science: {
    books: ["Science exercise book", "Science knowledge organiser", "Red retrieval / LCWC book"],
    tips: [
      "Learn the units alongside the formulae (N for force, J for energy, etc.).",
      "If you can draw the diagram from memory, you understand it.",
    ],
  },
  french: {
    books: ["French exercise book", "French knowledge organiser", "Red retrieval / LCWC book"],
    tips: [
      "Say the word out loud — your ears help your memory.",
      "Don't forget the accents — é, è, à, ç change meaning.",
    ],
  },
  spanish: {
    books: ["Spanish exercise book", "Spanish knowledge organiser", "Red retrieval / LCWC book"],
    tips: [
      "Say the word out loud — your ears help your memory.",
      "Mind the accents — á, é, í, ñ, ¿, ¡ — they matter.",
    ],
  },
  art: {
    books: ["Art sketchbook", "Art knowledge organiser"],
    tips: ["Look at the diagrams in your sketchbook as you go — visuals are half the answer."],
  },
  drama: {
    books: ["Drama exercise book", "Drama knowledge organiser"],
    tips: ["Try saying definitions out loud as if you're explaining them to a friend."],
  },
  pe: {
    books: ["PE knowledge organiser"],
    tips: ["Think about the sports you've actually played — link your answers to real examples."],
  },
};

function escapeText(node, text) {
  node.textContent = text;
}

export function prepCard({ slug, subjectName, onDone }) {
  const cfg = PREP_BY_SUBJECT[slug] ?? { books: ["Your exercise book", "Knowledge organiser"], tips: [] };

  const card = document.createElement("section");
  card.className = "card";
  const pill = document.createElement("span");
  pill.className = "pill pill-amber";
  pill.textContent = "📖 GET READY";
  card.appendChild(pill);

  const h = document.createElement("h2");
  h.className = "card-title";
  escapeText(h, `${subjectName} — let's go!`);
  card.appendChild(h);

  const lead = document.createElement("p");
  lead.className = "card-lead";
  lead.textContent = "Before you start, grab these. They'll really help when you get stuck.";
  card.appendChild(lead);

  const booksTitle = document.createElement("p");
  booksTitle.className = "section-label";
  booksTitle.textContent = "📚 Bring these:";
  card.appendChild(booksTitle);

  const booksList = document.createElement("ul");
  booksList.className = "prep-list";
  for (const b of cfg.books) {
    const li = document.createElement("li");
    escapeText(li, b);
    booksList.appendChild(li);
  }
  card.appendChild(booksList);

  if (cfg.tips.length) {
    const tipsTitle = document.createElement("p");
    tipsTitle.className = "section-label";
    tipsTitle.textContent = "💡 Quick tips:";
    card.appendChild(tipsTitle);

    const tipsList = document.createElement("ul");
    tipsList.className = "prep-list";
    for (const t of cfg.tips) {
      const li = document.createElement("li");
      escapeText(li, t);
      tipsList.appendChild(li);
    }
    card.appendChild(tipsList);
  }

  const btn = document.createElement("button");
  btn.className = "btn btn-primary btn-block";
  btn.textContent = "Got it — let's go! 🚀";
  btn.addEventListener("click", () => onDone());
  card.appendChild(btn);

  return card;
}

export function bookNudge(slug, topicName) {
  const cfg = PREP_BY_SUBJECT[slug];
  const book = cfg?.books?.[1] ?? "your knowledge organiser";
  return topicName
    ? `📖 Take 30 seconds in ${book} — find the ${topicName} section.`
    : `📖 Quick — check ${book}.`;
}
