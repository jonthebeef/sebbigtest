const TEST_DATES = {
  maths: "2026-06-04",
  english: "2026-06-04",
  science: "2026-06-05",
};

function daysBetween(todayIso, targetIso) {
  const a = new Date(todayIso + "T00:00:00Z").getTime();
  const b = new Date(targetIso + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86400000);
}

export function planForToday(state, metas) {
  const today = new Date().toISOString().slice(0, 10);
  const enabled = (state.enabledSubjects ?? []).filter(slug => metas && metas[slug]);

  const scored = enabled.map(slug => {
    const meta = metas[slug];
    let weight = 1;
    if (meta?.weighting === "heavy") weight += 3;
    else if (meta?.weighting === "structured") weight += 2;

    const testDate = TEST_DATES[slug];
    if (testDate) {
      const d = daysBetween(today, testDate);
      if (d >= 0 && d <= 2) weight += 4;
      else if (d >= 3 && d <= 5) weight += 2;
    }

    const recent = (state.confidence?.[slug] ?? []).slice(-3);
    const frowns = recent.filter(c => c === "frown").length;
    weight += frowns * 2;

    return { slug, weight };
  });

  scored.sort((a, b) => b.weight - a.weight);
  return scored.slice(0, 4).map(s => s.slug);
}
