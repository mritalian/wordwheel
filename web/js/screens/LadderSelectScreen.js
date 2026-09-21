import { LevelLoader } from "../data/LevelLoader.js";
import { LadderConfig } from "../data/LadderConfig.js";
import { ProgressStore } from "../data/ProgressStore.js";
import { Storage } from "../core/Storage.js";
import { ThemeLoader } from "../theme/ThemeLoader.js";

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
    const themeLoader = new ThemeLoader();

    this.el.innerHTML = `
      <h1>Word Wheel</h1>
      <div class="theme-grid"></div>
    `;
    const grid = this.el.querySelector(".theme-grid");

    // One card per theme (ladder) - each theme is a single sequential run
    // of levels under the hood, with no round/word-length grouping shown
    // to the player.
    const ladderIds = await config.getAllLadderIds();
    for (const ladderId of ladderIds) {
      const ladder = await config.getLadder(ladderId);
      const firstRound = await config.getRound(ladder.sequence[0].roundId);
      const flattened = await config.getFlattenedLevels(ladderId);
      const complete = flattened.every(({ roundId, levelId }) => store.isLevelComplete(roundId, levelId));
      const bg = await themeLoader.getBackgroundFor(firstRound);

      const card = document.createElement("div");
      card.className = `theme-card${complete ? " theme-card--complete" : ""}`;
      card.style.background = bg.imageUrl ? `url(${bg.imageUrl}) center/cover` : bg.gradient;
      card.innerHTML = `<div class="theme-card__label">${firstRound.themeDisplayName}</div>`;
      card.addEventListener("click", () => {
        this.router.goTo("levelSelect", { ladderId });
      });
      grid.appendChild(card);
    }
  }

  teardown() {}
}
