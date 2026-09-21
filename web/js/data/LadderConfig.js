export class LadderConfig {
  constructor(loader) {
    this.loader = loader;
    this.ladderCache = new Map();
    this.roundCache = new Map();
  }

  async getLadder(ladderId) {
    if (!this.ladderCache.has(ladderId)) {
      this.ladderCache.set(ladderId, await this.loader.loadLadder(ladderId));
    }
    return this.ladderCache.get(ladderId);
  }

  async getRound(roundId) {
    if (!this.roundCache.has(roundId)) {
      this.roundCache.set(roundId, await this.loader.loadRound(roundId));
    }
    return this.roundCache.get(roundId);
  }

  async getAllLadderIds() {
    const manifest = await this.loader.loadManifest();
    return manifest.ladders;
  }

  // A ladder's levels as one flat, sequential list (round/word-length
  // boundaries aren't shown to the player - it's just "level 1, 2, 3...").
  async getFlattenedLevels(ladderId) {
    const ladder = await this.getLadder(ladderId);
    const items = [];
    for (const entry of ladder.sequence) {
      const round = await this.getRound(entry.roundId);
      for (const levelId of round.levelIds) {
        items.push({ roundId: round.roundId, levelId });
      }
    }
    return items;
  }
}
