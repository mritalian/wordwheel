export class GridRenderer {
  constructor(layout, level, animationManager) {
    this.layout = layout;
    this.level = level;
    this.animationManager = animationManager;
  }

  render(gameState) {
    const ctx = this.layout.gridCtx;
    const { width, height } = this.layout.gridSize;
    ctx.clearRect(0, 0, width, height);

    const { rows, cols } = this.level.grid;
    const { cellSize, offsetX, offsetY } = this.layout.computeGridMetrics(rows, cols);

    for (const word of this.level.words) {
      for (const cell of word.cells) {
        this._drawCell(ctx, cell, cellSize, offsetX, offsetY, gameState);
      }
    }
  }

  _drawCell(ctx, cell, cellSize, offsetX, offsetY, gameState) {
    const x = offsetX + cell.col * cellSize;
    const y = offsetY + cell.row * cellSize;
    const gap = 3;
    const isRevealed = gameState.isCellRevealed(cell.row, cell.col);
    const progress = isRevealed
      ? this.animationManager.cellProgress(gameState.cellKey(cell.row, cell.col))
      : 0;

    ctx.save();
    const radius = 6;
    this._roundRect(ctx, x + gap / 2, y + gap / 2, cellSize - gap, cellSize - gap, radius);

    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = isRevealed
      ? this._lerpColor("rgba(244,242,238,0.92)", "rgba(20,184,166,1)", progress)
      : "rgba(244,242,238,0.92)";
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = isRevealed
      ? this._lerpColor("rgba(0,0,0,0.15)", "rgba(13,148,136,1)", progress)
      : "rgba(0,0,0,0.15)";
    ctx.stroke();
    ctx.restore();

    if (isRevealed && progress > 0.4) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (progress - 0.4) / 0.6);
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 ${Math.floor(cellSize * 0.45)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(cell.letter ?? this._letterFor(cell), x + cellSize / 2, y + cellSize / 2 + 1);
      ctx.restore();
    }
  }

  _letterFor(cell) {
    for (const word of this.level.words) {
      const idx = word.cells.findIndex((c) => c.row === cell.row && c.col === cell.col);
      if (idx !== -1) return word.text[idx];
    }
    return "";
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  _lerpColor(a, b, t) {
    const pa = this._parseColor(a);
    const pb = this._parseColor(b);
    const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
    const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
    const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
    return `rgb(${r},${g},${bl})`;
  }

  _parseColor(str) {
    const nums = str.match(/[\d.]+/g).map(Number);
    return nums;
  }
}
