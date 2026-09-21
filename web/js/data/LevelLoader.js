const CONTENT_BASE = "assets/content";

async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

export class LevelLoader {
  async loadManifest() {
    return fetchJson(`${CONTENT_BASE}/manifest.json`);
  }

  async loadLadder(ladderId) {
    return fetchJson(`${CONTENT_BASE}/ladders/${ladderId}.json`);
  }

  async loadRound(roundId) {
    return fetchJson(`${CONTENT_BASE}/rounds/${roundId}.json`);
  }

  async loadLevel(levelId) {
    const level = await fetchJson(`${CONTENT_BASE}/levels/${levelId}.json`);
    return this.index(level);
  }

  async loadThemes() {
    const data = await fetchJson(`${CONTENT_BASE}/themes.json`);
    return data.themes;
  }

  index(level) {
    level.wordMap = new Map(level.words.map((w) => [w.text.toUpperCase(), w]));
    level.bonusWordSet = new Set((level.bonusWords ?? []).map((w) => w.toUpperCase()));
    return level;
  }
}
