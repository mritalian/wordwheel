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
import { SoundEffects } from "../audio/SoundEffects.js";

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
      <div class="gameplay-screen__bonus-fab" data-action="toggle-bonus" role="button" tabindex="0" hidden></div>
      <canvas id="grid-canvas"></canvas>
      <canvas id="wheel-canvas"></canvas>
    `;
    this.rootEl.appendChild(this.el);

    this.el.querySelector('[data-action="back"]').addEventListener("click", () => {
      this.router.goTo("levelSelect", { ladderId: this.params.ladderId });
    });

    this.el.querySelector('[data-action="toggle-bonus"]').addEventListener("click", () => {
      this._toggleBonusOverlay();
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
        `${this.round.themeDisplayName} ${levelIndex + 1}/${this.flattenedLevels.length}`;
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

    this.soundEffects = new SoundEffects();
    this.session = new LevelSession(this.gameState, this.animationManager, this.eventBus, this.soundEffects);
    this.inputHandler = new WheelInputHandler(
      wheelCanvas,
      this.wheelRenderer,
      (letters) => this.session.handleTrace(letters),
      this.soundEffects
    );

    this._bindEvents();
    this._renderBonusList();
    this._applyBackground();

    this._onResize = () => this.layout.resize();
    window.addEventListener("resize", this._onResize);

    this.soundEffects.levelStart();
    this._loop();
  }

  _bindEvents() {
    this.eventBus.on("word-found", () => this._saveProgress());
    this.eventBus.on("bonus-found", () => {
      this._renderBonusList();
      this._saveProgress();
    });
    this.eventBus.on("bonus-already-found", () => this._pulseBonusFab());
    this.eventBus.on("level-complete", async ({ bonusWords }) => {
      await this.progressStore.markLevelComplete(this.params.roundId, this.params.levelId, bonusWords);
      setTimeout(() => {
        // Overlay first, sound second - a sound failure must never be able
        // to block the player's path forward.
        this._showCompleteOverlay(bonusWords);
        this.soundEffects.levelComplete();
      }, 500);
    });
  }

  _showCompleteOverlay(bonusWords) {
    const AUTO_CONTINUE_SECONDS = 5;
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    const totalBonus = this.level.bonusWords.length;
    // Crossword words are already visible in the grid - no need to repeat
    // them here. Bonus words only get a section when the level actually has
    // any (most don't need it at all).
    const bonusSection =
      totalBonus > 0
        ? `<p>Bonus words: ${bonusWords.length}/${totalBonus}</p>
           <div>${bonusWords.map((w) => `<span class="bonus-word-tag">${w}</span>`).join("")}</div>`
        : "";
    overlay.innerHTML = `
      <div class="overlay__panel">
        <h1>Level Complete!</h1>
        ${bonusSection}
        <div class="btn" data-action="continue" role="button" tabindex="0">Continue (${AUTO_CONTINUE_SECONDS})</div>
      </div>
    `;
    const continueBtn = overlay.querySelector('[data-action="continue"]');
    let secondsLeft = AUTO_CONTINUE_SECONDS;
    this._autoContinueTimer = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        goNext();
      } else {
        continueBtn.textContent = `Continue (${secondsLeft})`;
      }
    }, 1000);

    const goNext = () => {
      clearInterval(this._autoContinueTimer);
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
    };
    continueBtn.addEventListener("click", goNext);
    this.el.appendChild(overlay);
  }

  async _saveProgress() {
    await this.progressStore.saveLevelState(this.params.roundId, this.params.levelId, {
      foundWordIds: [...this.gameState.foundWordIds],
      bonusWordsFound: [...this.gameState.foundBonusWords],
    });
  }

  _renderBonusList() {
    const total = this.level.bonusWords.length;
    const found = this.gameState.foundBonusWords.size;
    const fab = this.el.querySelector(".gameplay-screen__bonus-fab");
    fab.hidden = total === 0;
    fab.textContent = `${found}/${total}`;
    this._refreshBonusOverlay();
  }

  // If the bonus overlay happens to be open when the found count changes
  // (a fresh bonus find while it's up), keep its contents in sync instead
  // of requiring a close/reopen.
  _refreshBonusOverlay() {
    const panel = this.el.querySelector(".bonus-overlay .overlay__panel");
    if (panel) panel.innerHTML = this._bonusOverlayContent();
  }

  _bonusOverlayContent() {
    const total = this.level.bonusWords.length;
    const found = [...this.gameState.foundBonusWords];
    const chips = found.length
      ? found.map((w) => `<span class="bonus-word-tag">${w}</span>`).join("")
      : "<em>No bonus words found yet</em>";
    return `<h1>You've found ${found.length}/${total} bonus words</h1><div>${chips}</div>`;
  }

  _toggleBonusOverlay() {
    const existing = this.el.querySelector(".bonus-overlay");
    if (existing) {
      existing.remove();
      return;
    }
    const overlay = document.createElement("div");
    overlay.className = "overlay bonus-overlay";
    overlay.innerHTML = `<div class="overlay__panel">${this._bonusOverlayContent()}</div>`;
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
    this.el.appendChild(overlay);
  }

  // Traced a bonus word that's already in the found list - the list itself
  // doesn't change, so briefly pulse the FAB to make it obvious this one's
  // already been collected rather than looking like nothing happened.
  _pulseBonusFab() {
    const fab = this.el.querySelector(".gameplay-screen__bonus-fab");
    fab.classList.remove("gameplay-screen__bonus-fab--pulse");
    void fab.offsetWidth; // restart the animation if it's already mid-pulse
    fab.classList.add("gameplay-screen__bonus-fab--pulse");
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
    clearInterval(this._autoContinueTimer);
    this.inputHandler?.teardown();
    this.soundEffects?.close();
    if (this._onResize) window.removeEventListener("resize", this._onResize);
  }
}
