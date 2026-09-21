import { WordValidator } from "./WordValidator.js";
import { Haptics } from "../audio/Haptics.js";

export class LevelSession {
  constructor(gameState, animationManager, eventBus, soundEffects = null) {
    this.gameState = gameState;
    this.animationManager = animationManager;
    this.eventBus = eventBus;
    this.soundEffects = soundEffects;
    this.validator = new WordValidator(gameState.level);
  }

  handleTrace(tracedLetters) {
    const result = this.validator.resolve(tracedLetters, this.gameState);

    if (result.type === "target") {
      this.gameState.revealWord(result.word);
      result.word.cells.forEach((cell, i) => {
        this.animationManager.fillCell(this.gameState.cellKey(cell.row, cell.col), i * 60);
      });
      this.soundEffects?.matchFound();
      Haptics.match();
      this.eventBus.emit("word-found", result.word);
      if (this.gameState.isComplete()) {
        this.eventBus.emit("level-complete", {
          bonusWords: [...this.gameState.foundBonusWords],
        });
      }
    } else if (result.type === "bonus") {
      this.gameState.addBonusWord(result.word);
      this.soundEffects?.matchFound();
      Haptics.match();
      this.eventBus.emit("bonus-found", result.word);
    } else if (result.type === "invalid") {
      this.animationManager.shakeTrail();
      this.soundEffects?.invalidTrace();
      Haptics.miss();
      this.eventBus.emit("invalid-word", result.word);
    } else if (result.type === "already-found") {
      this.soundEffects?.alreadyFound();
      if (result.subtype === "target") {
        this.animationManager.shimmerCells(
          result.target.cells.map((c) => this.gameState.cellKey(c.row, c.col))
        );
      } else {
        this.eventBus.emit("bonus-already-found", result.word);
      }
      this.eventBus.emit("already-found", result.word);
    }
  }
}
