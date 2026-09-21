import { LevelLoader } from "../data/LevelLoader.js";
import { ProgressStore } from "../data/ProgressStore.js";
import { Storage } from "../core/Storage.js";

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
    const round = await loader.loadRound(this.params.roundId);
    const store = new ProgressStore(new Storage());
    await store.load();

    this.el.innerHTML = `
      <h1>${round.themeDisplayName}</h1>
      <button data-action="back">Back to ladder</button>
      <div class="card-grid"></div>
    `;
    this.el.querySelector('[data-action="back"]').addEventListener("click", () => {
      this.router.goTo("ladderSelect");
    });

    const grid = this.el.querySelector(".card-grid");
    round.levelIds.forEach((levelId, i) => {
      const complete = store.isLevelComplete(round.roundId, levelId);
      const card = document.createElement("div");
      card.className = `card${complete ? " card--complete" : ""}`;
      card.textContent = `Level ${i + 1}`;
      card.addEventListener("click", () => {
        this.router.goTo("gameplay", { roundId: round.roundId, levelId });
      });
      grid.appendChild(card);
    });
  }

  teardown() {}
}
