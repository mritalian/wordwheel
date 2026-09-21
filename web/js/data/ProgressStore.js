const PROGRESS_KEY = "wordgame.progress.v1";

function emptyProgress() {
  return {
    version: 1,
    currentPosition: { roundId: null, levelIndex: 0 },
    rounds: {},
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
      this.data.rounds[roundId] = { levels: {} };
    }
    return this.data.rounds[roundId];
  }

  isLevelComplete(roundId, levelId) {
    return Boolean(this.data.rounds[roundId]?.levels?.[levelId]?.completed);
  }

  async markLevelComplete(roundId, levelId, bonusWordsFound) {
    const round = this.ensureRound(roundId);
    const existing = round.levels[levelId] ?? {};
    round.levels[levelId] = { ...existing, completed: true, bonusWordsFound: [...bonusWordsFound] };
    await this.persist();
  }

  getLevelState(roundId, levelId) {
    return this.data.rounds[roundId]?.levels?.[levelId] ?? null;
  }

  async saveLevelState(roundId, levelId, { foundWordIds, bonusWordsFound }) {
    const round = this.ensureRound(roundId);
    const existing = round.levels[levelId] ?? {};
    round.levels[levelId] = {
      ...existing,
      foundWordIds: [...foundWordIds],
      bonusWordsFound: [...bonusWordsFound],
    };
    await this.persist();
  }
}
