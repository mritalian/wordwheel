export class CanvasLayout {
  constructor(gridCanvas, wheelCanvas) {
    this.gridCanvas = gridCanvas;
    this.wheelCanvas = wheelCanvas;
    this.gridCtx = gridCanvas.getContext("2d");
    this.wheelCtx = wheelCanvas.getContext("2d");
    this.resize();
  }

  resize() {
    this._fitCanvas(this.gridCanvas, this.gridCtx);
    this._fitCanvas(this.wheelCanvas, this.wheelCtx);
  }

  _fitCanvas(canvas, ctx) {
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  get gridSize() {
    return { width: this.gridCanvas.clientWidth, height: this.gridCanvas.clientHeight };
  }

  get wheelSize() {
    return { width: this.wheelCanvas.clientWidth, height: this.wheelCanvas.clientHeight };
  }

  computeGridMetrics(rows, cols) {
    const { width, height } = this.gridSize;
    const padding = 16;
    const cellSize = Math.floor(
      Math.min((width - padding * 2) / cols, (height - padding * 2) / rows)
    );
    const boardWidth = cellSize * cols;
    const boardHeight = cellSize * rows;
    const offsetX = (width - boardWidth) / 2;
    const offsetY = (height - boardHeight) / 2;
    return { cellSize, offsetX, offsetY };
  }

  computeWheelMetrics(letterCount) {
    const { width, height } = this.wheelSize;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.32;
    const minNodeRadius = 22;
    const maxNodeRadius = 26;
    const nodeRadius = Math.max(
      minNodeRadius,
      Math.min(maxNodeRadius, (Math.PI * radius) / Math.max(letterCount, 1))
    );
    return { cx, cy, radius, nodeRadius };
  }
}
