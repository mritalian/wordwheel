export class AnimationManager {
  constructor() {
    this.tweens = [];
  }

  addTween(tween) {
    tween.startedAt = performance.now();
    this.tweens.push(tween);
  }

  update(now) {
    this.tweens = this.tweens.filter((tween) => {
      const elapsed = now - tween.startedAt;
      const t = Math.min(1, elapsed / tween.duration);
      tween.onUpdate(t);
      if (t >= 1) {
        tween.onComplete?.();
        return false;
      }
      return true;
    });
  }

  cellProgress(cellKey) {
    const tween = this.tweens.find((t) => t.cellKey === cellKey);
    return tween ? tween.lastT ?? 0 : 1;
  }

  get shakeOffset() {
    const tween = this.tweens.find((t) => t.kind === "shake");
    return tween ? tween.lastOffset ?? 0 : 0;
  }

  fillCell(cellKey, delayMs = 0) {
    const tween = {
      cellKey,
      duration: 260,
      lastT: 0,
      onUpdate: (t) => {
        tween.lastT = t;
      },
    };
    setTimeout(() => this.addTween(tween), delayMs);
  }

  shakeTrail() {
    const tween = {
      kind: "shake",
      duration: 220,
      lastOffset: 0,
      onUpdate: (t) => {
        tween.lastOffset = Math.sin(t * Math.PI * 6) * (1 - t) * 6;
      },
    };
    this.addTween(tween);
  }

  // A word the player already solved got traced again - briefly flash its
  // cells so it's obvious which word they just re-found.
  shimmerCells(cellKeys) {
    const tween = {
      kind: "shimmer",
      cellKeys: new Set(cellKeys),
      duration: 500,
      lastT: 0,
      onUpdate: (t) => {
        tween.lastT = t;
      },
    };
    this.addTween(tween);
  }

  shimmerIntensity(cellKey) {
    const tween = this.tweens.find((t) => t.kind === "shimmer" && t.cellKeys.has(cellKey));
    if (!tween) return 0;
    return Math.sin(tween.lastT * Math.PI);
  }
}
