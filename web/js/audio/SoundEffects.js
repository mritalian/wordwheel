// Synthesized via Web Audio API, not bundled audio files - keeps this app
// fully self-contained (no assets to source/license) and tiny. Each call
// just schedules a couple of short oscillator blips.
export class SoundEffects {
  constructor() {
    this.ctx = null;
  }

  _context() {
    try {
      if (!this.ctx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return null;
        this.ctx = new AudioContextClass();
      }
      if (this.ctx.state === "suspended") {
        // Browsers block audio until a user gesture - every call here
        // already happens inside a pointer event handler, so this just
        // catches up.
        this.ctx.resume();
      }
      return this.ctx;
    } catch (err) {
      // Some browsers/WebViews cap concurrent AudioContexts and throw once
      // hit - sound is enhancement, never let it take gameplay down with it.
      return null;
    }
  }

  // Release the AudioContext - call this when the screen using this
  // instance tears down. Without it, a new AudioContext gets created (and
  // never freed) every time a level mounts, and some WebViews throw once a
  // per-page AudioContext limit is hit after enough levels.
  close() {
    try {
      this.ctx?.close();
    } catch (err) {
      // Already closing/closed, or unsupported - nothing to do either way.
    }
    this.ctx = null;
  }

  _tone(freq, duration, { type = "sine", gain = 0.12, delay = 0 } = {}) {
    try {
      const ctx = this._context();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      const startTime = ctx.currentTime + delay;
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.008);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.02);
    } catch (err) {
      // Sound is enhancement - a scheduling failure here must never break
      // gameplay (this bit the level-complete overlay once already, when an
      // exception here silently skipped the code that showed it).
    }
  }

  // Tap a wheel letter, or drag onto a new one - pitch climbs a little with
  // trail length so a longer word feels like it's building up.
  letterSelected(trailLength = 0) {
    const freq = 520 + Math.min(trailLength, 10) * 35;
    this._tone(freq, 0.07, { type: "sine", gain: 0.1 });
  }

  // Released without spelling anything real. Soft descending "boop" - sine,
  // not sawtooth (sawtooth's harsh overtones read as an electronic buzz).
  invalidTrace() {
    this._tone(260, 0.16, { type: "sine", gain: 0.09 });
    this._tone(190, 0.22, { type: "sine", gain: 0.09, delay: 0.09 });
  }

  // Traced a word that's already solved - neutral, not good or bad, so
  // it's a flat double-blip at one pitch (matchFound rises, invalidTrace
  // falls; this does neither).
  alreadyFound() {
    this._tone(500, 0.07, { type: "triangle", gain: 0.08 });
    this._tone(500, 0.09, { type: "triangle", gain: 0.08, delay: 0.09 });
  }

  // A target or bonus word matched.
  matchFound() {
    this._tone(660, 0.11, { type: "sine", gain: 0.13 });
    this._tone(880, 0.11, { type: "sine", gain: 0.13, delay: 0.07 });
    this._tone(1100, 0.16, { type: "sine", gain: 0.13, delay: 0.14 });
  }

  // Level just mounted and is ready to play.
  levelStart() {
    this._tone(440, 0.09, { type: "sine", gain: 0.09 });
    this._tone(660, 0.14, { type: "sine", gain: 0.09, delay: 0.08 });
  }

  // Every word in the level found - bigger than a single matchFound.
  levelComplete() {
    this._tone(660, 0.1, { type: "sine", gain: 0.13 });
    this._tone(880, 0.1, { type: "sine", gain: 0.13, delay: 0.09 });
    this._tone(1100, 0.1, { type: "sine", gain: 0.13, delay: 0.18 });
    this._tone(1320, 0.22, { type: "sine", gain: 0.14, delay: 0.27 });
  }
}
