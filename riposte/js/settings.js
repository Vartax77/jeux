const KEY = 'riposte-settings-v1';
const HS_KEY = 'riposte-highscores-v1';

export function loadSettings() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { return null; }
}
export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) { /* stockage indisponible : on continue sans persister */ }
}
export function loadHighScores() {
  try { return JSON.parse(localStorage.getItem(HS_KEY) || '{}'); } catch (_) { return {}; }
}
export function saveHighScore(levelId, entry) {
  const all = loadHighScores(); const list = all[levelId] || [];
  list.push(entry); list.sort((a, b) => b.score - a.score);
  all[levelId] = list.slice(0, 5);
  try { localStorage.setItem(HS_KEY, JSON.stringify(all)); } catch (_) {}
  return all[levelId];
}
