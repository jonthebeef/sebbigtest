import { loadState, saveState, newShareCode } from "./state.js";
import { API_BASE } from "./config.js";

export function ensureShareCode() {
  const s = loadState();
  if (!s.shareCode) {
    s.shareCode = newShareCode();
    saveState(s);
  }
  return loadState().shareCode;
}

export async function pushSnapshot() {
  const s = loadState();
  if (!s.shareEnabled || !s.shareCode) return;
  const snapshot = {
    displayName: s.displayName,
    enabledSubjects: s.enabledSubjects,
    coveredTopics: s.coveredTopics,
    confidence: s.confidence,
    sessions: (s.sessions ?? []).slice(-50),
    history: (s.history ?? []).slice(-200),
    updatedAt: new Date().toISOString(),
  };
  try {
    await fetch(`${API_BASE}/api/sync`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: s.shareCode, snapshot }),
    });
  } catch {}
}
