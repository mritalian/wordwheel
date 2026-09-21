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
}
