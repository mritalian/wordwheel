export class GameState {
  constructor(level) {
    this.level = level;
    this.foundWordIds = new Set();
    this.foundBonusWords = new Set();
    this.revealedCells = new Set();
  }

  cellKey(row, col) {
    return `${row}:${col}`;
  }

  isCellRevealed(row, col) {
    return this.revealedCells.has(this.cellKey(row, col));
  }

  revealWord(word) {
    this.foundWordIds.add(word.wordId);
    for (const cell of word.cells) this.revealedCells.add(this.cellKey(cell.row, cell.col));
  }

  addBonusWord(word) {
    this.foundBonusWords.add(word);
  }

  isComplete() {
    return this.foundWordIds.size === this.level.words.length;
  }
}
