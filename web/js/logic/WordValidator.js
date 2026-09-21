export class WordValidator {
  constructor(level) {
    this.level = level;
  }

  resolve(tracedLetters, gameState) {
    const word = tracedLetters.toUpperCase();

    const target = this.level.wordMap.get(word);
    if (target) {
      if (gameState.foundWordIds.has(target.wordId)) {
        return { type: "already-found", word };
      }
      return { type: "target", word: target };
    }

    if (this.level.bonusWordSet.has(word)) {
      if (gameState.foundBonusWords.has(word)) {
        return { type: "already-found", word };
      }
      return { type: "bonus", word };
    }

    return { type: "invalid", word };
  }
}
