import { LevelLoader } from "../data/LevelLoader.js";
import { GameState } from "../core/GameState.js";
import { CanvasLayout } from "../render/CanvasLayout.js";
import { AnimationManager } from "../render/AnimationManager.js";
import { GridRenderer } from "../render/GridRenderer.js";
import { WheelRenderer } from "../render/WheelRenderer.js";
import { WheelInputHandler } from "../input/WheelInputHandler.js";
import { LevelSession } from "../logic/LevelSession.js";
import { EventBus } from "../core/EventBus.js";

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
      <div class="gameplay-screen__hud">
        <button data-action="back">Back</button>
        <div class="gameplay-screen__title"></div>
      </div>
      <div class="gameplay-screen__bonus-list"></div>
      <canvas id="grid-canvas"></canvas>
      <canvas id="wheel-canvas"></canvas>
    `;
    this.rootEl.appendChild(this.el);

    this.el.querySelector('[data-action="back"]').addEventListener("click", () => {
      this.router.goTo("levelSelect", { roundId: this.params.roundId });
    });

    const loader = new LevelLoader();
    this.level = await loader.loadLevel(this.params.levelId);
    this.gameState = new GameState(this.level);
    this.animationManager = new AnimationManager();
    this.eventBus = new EventBus();

    const gridCanvas = this.el.querySelector("#grid-canvas");
    const wheelCanvas = this.el.querySelector("#wheel-canvas");
    this.layout = new CanvasLayout(gridCanvas, wheelCanvas);

    this.gridRenderer = new GridRenderer(this.layout, this.level, this.animationManager);
    const wheelNodes = expandWheelNodes(this.level.wheelLetters);
    this.wheelRenderer = new WheelRenderer(this.layout, wheelNodes, this.animationManager);
    this.wheelRenderer.wheelNodes = wheelNodes;

    this.session = new LevelSession(this.gameState, this.animationManager, this.eventBus);
    this.inputHandler = new WheelInputHandler(wheelCanvas, this.wheelRenderer, (letters) =>
      this.session.handleTrace(letters)
    );

    this._bindEvents();
    this._applyBackground();

    this._onResize = () => this.layout.resize();
    window.addEventListener("resize", this._onResize);

    this._loop();
  }

  _bindEvents() {
    this.eventBus.on("bonus-found", (word) => this._renderBonusList());
    this.eventBus.on("level-complete", async ({ bonusWords }) => {
      const { ProgressStore } = await import("../data/ProgressStore.js");
      const { Storage } = await import("../core/Storage.js");
      const store = new ProgressStore(new Storage());
      await store.load();
      await store.markLevelComplete(this.params.roundId, this.params.levelId, bonusWords);
      setTimeout(() => {
        this.router.goTo("levelComplete", {
          roundId: this.params.roundId,
          levelId: this.params.levelId,
          bonusWords,
          words: this.level.words.map((w) => w.text),
        });
      }, 500);
    });
  }

  _renderBonusList() {
    const el = this.el.querySelector(".gameplay-screen__bonus-list");
    el.innerHTML = [...this.gameState.foundBonusWords]
      .map((w) => `<span class="bonus-word-tag">${w}</span>`)
      .join("");
  }

  async _applyBackground() {
    try {
      const loader = new LevelLoader();
      const round = await loader.loadRound(this.params.roundId);
      const { ThemeLoader } = await import("../theme/ThemeLoader.js");
      const { ProgressStore } = await import("../data/ProgressStore.js");
      const { Storage } = await import("../core/Storage.js");
      const store = new ProgressStore(new Storage());
      await store.load();
      const themeLoader = new ThemeLoader(store);
      const bg = await themeLoader.getBackgroundFor(round);
      if (bg.imageUrl) {
        this.el.style.backgroundImage = `url(${bg.imageUrl})`;
      } else if (bg.gradient) {
        this.el.style.background = bg.gradient;
      }
      if (bg.attribution) {
        const link = document.createElement("a");
        link.className = "gameplay-screen__attribution";
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
