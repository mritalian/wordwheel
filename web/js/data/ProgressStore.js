const PROGRESS_KEY = "wordgame.progress.v1";

function emptyProgress() {
  return {
    version: 1,
    currentPosition: { roundId: null, levelIndex: 0 },
    rounds: {},
    themeUnsplashCache: {},
  };
}

export class ProgressStore {
  constructor(storage) {
    this.storage = storage;
    this.data = null;
  }

  async load() {
    const raw = await this.storage.get(PROGRESS_KEY);
    this.data = raw ? JSON.parse(raw) : emptyProgress();
    return this.data;
  }

  async persist() {
    await this.storage.set(PROGRESS_KEY, JSON.stringify(this.data));
  }

  ensureRound(roundId) {
    if (!this.data.rounds[roundId]) {
      this.data.rounds[roundId] = { unlocked: true, levels: {} };
    }
    return this.data.rounds[roundId];
  }

  isLevelComplete(roundId, levelId) {
    return Boolean(this.data.rounds[roundId]?.levels?.[levelId]?.completed);
  }

  async markLevelComplete(roundId, levelId, bonusWordsFound) {
    const round = this.ensureRound(roundId);
    round.levels[levelId] = { completed: true, bonusWordsFound: [...bonusWordsFound] };
    await this.persist();
  }

  isRoundUnlocked(roundId) {
    return this.data.rounds[roundId]?.unlocked !== false;
  }

  async unlockRound(roundId) {
    this.ensureRound(roundId).unlocked = true;
    await this.persist();
  }

  async setThemeCache(roundId, cacheEntry) {
    this.data.themeUnsplashCache[roundId] = cacheEntry;
    await this.persist();
  }

  getThemeCache(roundId) {
    return this.data.themeUnsplashCache[roundId] ?? null;
  }
}
