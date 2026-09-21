export class WheelRenderer {
  constructor(layout, wheelNodes, animationManager) {
    this.layout = layout;
    this.wheelNodes = wheelNodes;
    this.animationManager = animationManager;
  }

  computeNodePositions() {
    const { cx, cy, radius, nodeRadius } = this.layout.computeWheelMetrics(this.wheelNodes.length);
    return this.wheelNodes.map((node, i) => {
      const angle = (i / this.wheelNodes.length) * Math.PI * 2 - Math.PI / 2;
      return {
        ...node,
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
        nodeRadius,
      };
    });
  }

  render(trailState) {
    const ctx = this.layout.wheelCtx;
    const { width, height } = this.layout.wheelSize;
    ctx.clearRect(0, 0, width, height);

    const positions = this.computeNodePositions();
    const shakeOffset = this.animationManager.shakeOffset;

    ctx.save();
    ctx.translate(shakeOffset, 0);

    this._drawTrail(ctx, positions, trailState);

    for (const [i, node] of positions.entries()) {
      const isSelected = trailState.selectedIndices.includes(i);
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.nodeRadius, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? "#ffcb47" : "rgba(255,255,255,0.92)";
      ctx.fill();

      ctx.fillStyle = isSelected ? "#10141a" : "#10141a";
      ctx.font = `700 ${Math.floor(node.nodeRadius)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.letter, node.x, node.y + 1);
    }

    ctx.restore();
  }

  _drawTrail(ctx, positions, trailState) {
    if (trailState.selectedIndices.length === 0) return;
    ctx.save();
    ctx.strokeStyle = "rgba(255,203,71,0.85)";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    const first = positions[trailState.selectedIndices[0]];
    ctx.moveTo(first.x, first.y);
    for (const idx of trailState.selectedIndices.slice(1)) {
      const p = positions[idx];
      ctx.lineTo(p.x, p.y);
    }
    if (trailState.livePointerPos && trailState.isActive) {
      ctx.lineTo(trailState.livePointerPos.x, trailState.livePointerPos.y);
    }
    ctx.stroke();
    ctx.restore();
  }
}
