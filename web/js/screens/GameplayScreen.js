import { LevelLoader } from "../data/LevelLoader.js";
import { GameState } from "../core/GameState.js";
import { CanvasLayout } from "../render/CanvasLayout.js";
import { AnimationManager } from "../render/AnimationManager.js";
import { GridRenderer } from "../render/GridRenderer.js";
import { WheelRenderer } from "../render/WheelRenderer.js";
import { WheelInputHandler } from "../input/WheelInputHandler.js";
import { LevelSession } from "../logic/LevelSession.js";
import { EventBus } from "../core/EventBus.js";
import { BACK_ICON_SVG } from "../core/icons.js";

function expandWheelNodes(wheelLetters) {
  const nodes = [];
  for (const { letter, count } of wheelLetters) {
    for (let i = 0; i < count; i++) nodes.push({ letter });
  }
  return nodes;
}

export class GameplayScreen {
  constructor(rootEl, params, router) {
    this.rootEl = rootEl;
    this.params = params;
    this.router = router;
    this.rafId = null;
  }

  async mount() {
    this.el = document.createElement("div");
    this.el.className = "screen gameplay-screen";
    this.el.innerHTML = `
      <div class="back-fab" data-action="back" role="button" tabindex="0">${BACK_ICON_SVG}</div>
      <div class="gameplay-screen__title"></div>
      <div class="gameplay-screen__bonus-widget">
        <div class="gameplay-screen__bonus-fab" data-action="toggle-bonus" role="button" tabindex="0" hidden></div>
        <div class="gameplay-screen__bonus-panel" hidden></div>
      </div>
      <canvas id="grid-canvas"></canvas>
      <canvas id="wheel-canvas"></canvas>
    `;
    this.rootEl.appendChild(this.el);

    this.el.querySelector('[data-action="back"]').addEventListener("click", () => {
      this.router.goTo("levelSelect", { ladderId: this.params.ladderId });
    });

    this.el.querySelector('[data-action="toggle-bonus"]').addEventListener("click", () => {
      const panel = this.el.querySelector(".gameplay-screen__bonus-panel");
      panel.hidden = !panel.hidden;
    });

    const loader = new LevelLoader();
    this.level = await loader.loadLevel(this.params.levelId);
    this.round = await loader.loadRound(this.params.roundId);
    this.gameState = new GameState(this.level);

    const { LadderConfig } = await import("../data/LadderConfig.js");
    this.ladderConfig = new LadderConfig(loader);
    this.flattenedLevels = await this.ladderConfig.getFlattenedLevels(this.params.ladderId);
    const levelIndex = this.flattenedLevels.findIndex(
      (l) => l.roundId === this.params.roundId && l.levelId === this.params.levelId
    );
    if (levelIndex !== -1) {
      this.el.querySelector(".gameplay-screen__title").textContent =
        `${levelIndex + 1}/${this.flattenedLevels.length}`;
    }

    const { ProgressStore } = await import("../data/ProgressStore.js");
    const { Storage } = await import("../core/Storage.js");
    this.progressStore = new ProgressStore(new Storage());
    await this.progressStore.load();
    const saved = this.progressStore.getLevelState(this.params.roundId, this.params.levelId);
    if (saved) this.gameState.restore(saved);

    this.animationManager = new AnimationManager();
    this.eventBus = new EventBus();

    const gridCanvas = this.el.querySelector("#grid-canvas");
    const wheelCanvas = this.el.querySelector("#wheel-canvas");
    this.layout = new CanvasLayout(gridCanvas, wheelCanvas, this.level.grid);

    this.gridRenderer = new GridRenderer(this.layout, this.level, this.animationManager);
    const wheelNodes = expandWheelNodes(this.level.wheelLetters);
    this.wheelRenderer = new WheelRenderer(this.layout, wheelNodes, this.animationManager);
    this.wheelRenderer.wheelNodes = wheelNodes;

    this.session = new LevelSession(this.gameState, this.animationManager, this.eventBus);
    this.inputHandler = new WheelInputHandler(wheelCanvas, this.wheelRenderer, (letters) =>
      this.session.handleTrace(letters)
    );

    this._bindEvents();
    this._renderBonusList();
    this._applyBackground();

    this._onResize = () => this.layout.resize();
    window.addEventListener("resize", this._onResize);

    this._loop();
  }

  _bindEvents() {
    this.eventBus.on("word-found", () => this._saveProgress());
    this.eventBus.on("bonus-found", () => {
      this._renderBonusList();
      this._saveProgress();
    });
    this.eventBus.on("level-complete", async ({ bonusWords }) => {
      await this.progressStore.markLevelComplete(this.params.roundId, this.params.levelId, bonusWords);
      setTimeout(() => this._showCompleteOverlay(bonusWords), 500);
    });
  }

  _showCompleteOverlay(bonusWords) {
    const overlay = document.createElement("div");
    overlay.className = "level-complete-overlay";
    const bonusHtml = bonusWords.length
      ? bonusWords.map((w) => `<span class="bonus-word-tag">${w}</span>`).join("")
      : "<em>No bonus words found</em>";
    overlay.innerHTML = `
      <div class="level-complete-overlay__panel">
        <h1>Level Complete!</h1>
        <p>Words found: ${this.level.words.map((w) => w.text).join(", ")}</p>
        <div>${bonusHtml}</div>
        <div class="btn" data-action="continue" role="button" tabindex="0">Continue</div>
      </div>
    `;
    overlay.querySelector('[data-action="continue"]').addEventListener("click", () => {
      const levelIndex = this.flattenedLevels.findIndex(
        (l) => l.roundId === this.params.roundId && l.levelId === this.params.levelId
      );
      const next = this.flattenedLevels[levelIndex + 1];
      if (next) {
        this.router.goTo("gameplay", {
          roundId: next.roundId,
          levelId: next.levelId,
          ladderId: this.params.ladderId,
        });
      } else {
        this.router.goTo("levelSelect", { ladderId: this.params.ladderId });
      }
    });
    this.el.appendChild(overlay);
  }

  async _saveProgress() {
    await this.progressStore.saveLevelState(this.params.roundId, this.params.levelId, {
      foundWordIds: [...this.gameState.foundWordIds],
      bonusWordsFound: [...this.gameState.foundBonusWords],
    });
  }

  _renderBonusList() {
    const words = [...this.gameState.foundBonusWords];
    const fab = this.el.querySelector(".gameplay-screen__bonus-fab");
    const panel = this.el.querySelector(".gameplay-screen__bonus-panel");

    fab.hidden = words.length === 0;
    fab.textContent = `${words.length} found`;
    if (words.length === 0) panel.hidden = true;
    panel.innerHTML = words.map((w) => `<span class="bonus-word-tag">${w}</span>`).join("");
  }

  async _applyBackground() {
    try {
      const { ThemeLoader } = await import("../theme/ThemeLoader.js");
      const themeLoader = new ThemeLoader();
      const bg = await themeLoader.getBackgroundFor(this.round);
      if (bg.imageUrl) {
        this.el.style.backgroundImage = `url(${bg.imageUrl})`;
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
      // Background is decorative; failures shouldn't block gameplay.
    }
  }

  _loop() {
    const now = performance.now();
    this.animationManager.update(now);
    this.gridRenderer.render(this.gameState);
    this.wheelRenderer.render(this.inputHandler.getTrailState());
    this.rafId = requestAnimationFrame(() => this._loop());
  }

  teardown() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.inputHandler?.teardown();
    if (this._onResize) window.removeEventListener("resize", this._onResize);
  }
}
