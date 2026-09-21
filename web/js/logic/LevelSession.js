import { WordValidator } from "./WordValidator.js";

export class LevelSession {
  constructor(gameState, animationManager, eventBus) {
    this.gameState = gameState;
    this.animationManager = animationManager;
    this.eventBus = eventBus;
    this.validator = new WordValidator(gameState.level);
  }

  handleTrace(tracedLetters) {
    const result = this.validator.resolve(tracedLetters, this.gameState);

    if (result.type === "target") {
      this.gameState.revealWord(result.word);
      result.word.cells.forEach((cell, i) => {
        this.animationManager.fillCell(this.gameState.cellKey(cell.row, cell.col), i * 60);
      });
      this.eventBus.emit("word-found", result.word);
      if (this.gameState.isComplete()) {
        this.eventBus.emit("level-complete", {
          bonusWords: [...this.gameState.foundBonusWords],
        });
      }
    } else if (result.type === "bonus") {
      this.gameState.addBonusWord(result.word);
      this.eventBus.emit("bonus-found", result.word);
    } else if (result.type === "invalid") {
      this.animationManager.shakeTrail();
      this.eventBus.emit("invalid-word", result.word);
    }
  }
}
