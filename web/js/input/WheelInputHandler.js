export class WheelInputHandler {
  constructor(canvas, wheelRenderer, onTraceComplete) {
    this.canvas = canvas;
    this.wheelRenderer = wheelRenderer;
    this.onTraceComplete = onTraceComplete;

    this.tracedIndices = [];
    this.livePointerPos = null;
    this.isActive = false;
    this.lastHitIndex = null;

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);

    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", this._onPointerDown);
    canvas.addEventListener("pointermove", this._onPointerMove);
    canvas.addEventListener("pointerup", this._onPointerUp);
    canvas.addEventListener("pointercancel", this._onPointerUp);
  }

  teardown() {
    this.canvas.removeEventListener("pointerdown", this._onPointerDown);
    this.canvas.removeEventListener("pointermove", this._onPointerMove);
    this.canvas.removeEventListener("pointerup", this._onPointerUp);
    this.canvas.removeEventListener("pointercancel", this._onPointerUp);
  }

  getTrailState() {
    return {
      selectedIndices: this.tracedIndices,
      livePointerPos: this.livePointerPos,
      isActive: this.isActive,
    };
  }

  _pointerPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  _hitTest(pos) {
    const positions = this.wheelRenderer.computeNodePositions();
    for (const [i, node] of positions.entries()) {
      const dx = pos.x - node.x;
      const dy = pos.y - node.y;
      if (Math.hypot(dx, dy) <= node.nodeRadius * 1.3) return i;
    }
    return null;
  }

  _onPointerDown(e) {
    const pos = this._pointerPos(e);
    const hit = this._hitTest(pos);
    if (hit === null) return;
    this.canvas.setPointerCapture(e.pointerId);
    this.tracedIndices = [hit];
    this.lastHitIndex = hit;
    this.isActive = true;
    this.livePointerPos = pos;
  }

  _onPointerMove(e) {
    const pos = this._pointerPos(e);
    this.livePointerPos = pos;
    if (!this.isActive) return;

    const hit = this._hitTest(pos);
    if (hit === null || hit === this.lastHitIndex) return;

    const secondToLast = this.tracedIndices[this.tracedIndices.length - 2];
    if (secondToLast === hit) {
      // Backtracking onto the previous node - undo the last step.
      this.tracedIndices.pop();
    } else if (!this.tracedIndices.includes(hit)) {
      // Each wheel circle can only be used once per trace, even if the
      // same letter appears on another circle (e.g. two G tiles are two
      // separate, independently-usable nodes; revisiting the same circle
      // is not).
      this.tracedIndices.push(hit);
    } else {
      return;
    }
    this.lastHitIndex = hit;
  }

  _onPointerUp() {
    if (!this.isActive) return;
    this.isActive = false;
    const indices = this.tracedIndices;
    this.tracedIndices = [];
    this.lastHitIndex = null;
    this.livePointerPos = null;
    if (indices.length >= 1) {
      const letters = indices.map((i) => this.wheelRenderer.wheelNodes[i].letter).join("");
      this.onTraceComplete(letters);
    }
  }
}
