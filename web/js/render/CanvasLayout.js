const GRID_PADDING = 16;
const MIN_WHEEL_HEIGHT_FRACTION = 0.4;

export class CanvasLayout {
  constructor(gridCanvas, wheelCanvas, gridDims) {
    this.gridCanvas = gridCanvas;
    this.wheelCanvas = wheelCanvas;
    this.gridDims = gridDims;
    this.gridCtx = gridCanvas.getContext("2d");
    this.wheelCtx = wheelCanvas.getContext("2d");
    this.resize();
  }

  resize() {
    this._applySplit();
    this._fitCanvas(this.gridCanvas, this.gridCtx);
    this._fitCanvas(this.wheelCanvas, this.wheelCtx);
  }

  // Size the grid canvas to whatever height lets it use the full available
  // width for its actual row/col count (small/square grids end up much
  // bigger), capped so the wheel below always keeps a usable minimum. Also
  // pushes the grid down below the HUD chrome (back-fab, title, bonus FAB -
  // all independently absolutely-positioned, not a single measurable
  // wrapper), which would otherwise overlap the grid's top row. The back-fab
  // is the tallest/lowest of the three, so its bottom edge sets the offset.
  _applySplit() {
    const container = this.gridCanvas.parentElement;
    const backFab = container.querySelector(".back-fab");
    const topOffset = backFab
      ? backFab.getBoundingClientRect().bottom - container.getBoundingClientRect().top + 8
      : 0;
    const totalWidth = container.clientWidth;
    const availableHeight = container.clientHeight - topOffset;
    const { rows, cols } = this.gridDims;

    const widthDrivenCellSize = (totalWidth - GRID_PADDING * 2) / cols;
    const desiredGridHeight = widthDrivenCellSize * rows + GRID_PADDING * 2;
    const maxGridHeight = availableHeight * (1 - MIN_WHEEL_HEIGHT_FRACTION);
    const gridHeight = Math.max(0, Math.min(desiredGridHeight, maxGridHeight));

    this.gridCanvas.style.top = `${topOffset}px`;
    this.gridCanvas.style.height = `${gridHeight}px`;
    this.wheelCanvas.style.top = `${topOffset + gridHeight}px`;
    this.wheelCanvas.style.height = `${availableHeight - gridHeight}px`;
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

    // Upper bound so neighboring nodes never overlap: each node gets an
    // equal slice of the ring's circumference (with a small gap factor so
    // they don't touch edge-to-edge). Also capped as a fraction of the
    // canvas so a small wheel (e.g. 3 letters) doesn't produce absurdly
    // huge nodes. Previously this was clamped to a tiny fixed 22-26px range
    // regardless of how much room was actually available; that undershot,
    // this is the corrected, more moderate middle ground.
    const noOverlapCap = ((Math.PI * radius) / Math.max(letterCount, 1)) * 0.8;
    const screenCap = Math.min(width, height) * 0.14;
    const minNodeRadius = 26;
    const nodeRadius = Math.max(minNodeRadius, Math.min(noOverlapCap, screenCap));
    return { cx, cy, radius, nodeRadius };
  }
}
