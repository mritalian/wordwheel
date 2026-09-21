import { LevelLoader } from "../data/LevelLoader.js";
import { LadderConfig } from "../data/LadderConfig.js";
import { ProgressStore } from "../data/ProgressStore.js";
import { Storage } from "../core/Storage.js";
import { BACK_ICON_SVG } from "../core/icons.js";

export class LevelSelectScreen {
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
    const ladder = await config.getLadder(this.params.ladderId);
    const firstRound = await config.getRound(ladder.sequence[0].roundId);
    const flattened = await config.getFlattenedLevels(this.params.ladderId);
    const store = new ProgressStore(new Storage());
    await store.load();

    this.el.innerHTML = `
      <div class="back-fab" data-action="back" role="button" tabindex="0">${BACK_ICON_SVG}</div>
      <h1>${firstRound.themeDisplayName}</h1>
      <div class="card-grid"></div>
    `;
    this.el.querySelector('[data-action="back"]').addEventListener("click", () => {
      this.router.goTo("ladderSelect");
    });
    this._applyBackground(firstRound);

    const grid = this.el.querySelector(".card-grid");
    flattened.forEach(({ roundId, levelId }, i) => {
      const complete = store.isLevelComplete(roundId, levelId);
      // Levels unlock strictly in order across the whole theme, ignoring
      // round/word-length boundaries entirely - level i is playable only
      // once level i-1 is complete (level 0 is always playable).
      const locked = i > 0 && !store.isLevelComplete(flattened[i - 1].roundId, flattened[i - 1].levelId);
      const card = document.createElement("div");
      card.className = `card${complete ? " card--complete" : ""}${locked ? " card--locked" : ""}`;
      card.textContent = `${i + 1}`;
      if (!locked) {
        card.addEventListener("click", () => {
          this.router.goTo("gameplay", { roundId, levelId, ladderId: this.params.ladderId });
        });
      }
      grid.appendChild(card);
    });
  }

  async _applyBackground(round) {
    try {
      const { ThemeLoader } = await import("../theme/ThemeLoader.js");
      const bg = await new ThemeLoader().getBackgroundFor(round);
      if (bg.imageUrl) {
        this.el.style.backgroundImage =
          `linear-gradient(rgba(10,12,16,0.6), rgba(10,12,16,0.6)), url(${bg.imageUrl})`;
      } else if (bg.gradient) {
        this.el.style.background = bg.gradient;
      }
      if (bg.attribution) {
        const link = document.createElement("a");
        link.className = "screen__attribution";
        link.href = bg.attribution.profileUrl;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = `Photo by ${bg.attribution.name} on Unsplash`;
        this.el.appendChild(link);
      }
    } catch (err) {
      // Background is decorative; failures shouldn't block navigation.
    }
  }

  teardown() {}
}
