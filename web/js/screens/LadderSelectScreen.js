import { LevelLoader } from "../data/LevelLoader.js";
import { LadderConfig } from "../data/LadderConfig.js";
import { ProgressStore } from "../data/ProgressStore.js";
import { Storage } from "../core/Storage.js";

export class LadderSelectScreen {
  constructor(rootEl, params, router) {
    this.rootEl = rootEl;
    this.params = params;
    this.router = router;
  }

  async mount() {
    this.el = document.createElement("div");
    this.el.className = "screen list-screen";
    this.rootEl.appendChild(this.el);

    const loader = new LevelLoader();
    const config = new LadderConfig(loader);
    const store = new ProgressStore(new Storage());
    await store.load();

    const ladderIds = await config.getAllLadderIds();
    const rounds = [];
    for (const ladderId of ladderIds) {
      const ladder = await config.getLadder(ladderId);
      for (const entry of ladder.sequence) {
        rounds.push(await config.getRound(entry.roundId));
      }
    }

    this.el.innerHTML = `
      <h1>Word Wheel</h1>
      <div class="card-grid"></div>
    `;
    const grid = this.el.querySelector(".card-grid");
    rounds.forEach((round) => {
      const unlocked = store.isRoundUnlocked(round.roundId);
      const card = document.createElement("div");
      card.className = `card${unlocked ? "" : " card--locked"}`;
      card.innerHTML = `<div>${round.themeDisplayName}</div><small>${round.wordLengthBucket}-letter</small>`;
      card.addEventListener("click", () => {
        if (!unlocked) return;
        this.router.goTo("levelSelect", { roundId: round.roundId });
      });
      grid.appendChild(card);
    });
  }

  teardown() {}
}
