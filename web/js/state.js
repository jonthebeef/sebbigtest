const KEY = "seb-revision-state-v1";

const DEFAULT_STATE = {
  profileId: null,
  displayName: null,
  testStartDate: "2026-06-01",
  enabledSubjects: [],
  coveredTopics: {},
  shareCode: null,
  shareEnabled: false,
  history: [],
  confidence: {},
  sessions: [],
};

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    return { ...structuredClone(DEFAULT_STATE), ...JSON.parse(raw) };
  } catch { return structuredClone(DEFAULT_STATE); }
}
export function saveState(s) { localStorage.setItem(KEY, JSON.stringify(s)); }
export function newProfileId() { return crypto.randomUUID(); }
export function newShareCode() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const pick = n => Array.from({length:n}, () => chars[Math.floor(Math.random()*chars.length)]).join("");
  return `${pick(4)}-${pick(4)}`;
}
