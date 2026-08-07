import {
  QUALITY_TIERS,
  QUALITY_TIER_ORDER,
  QUALITY_DPR_FLOOR,
  QUALITY_FPS_WINDOW,
  QUALITY_DOWNGRADE_FPS_THRESHOLD,
  QUALITY_DOWNGRADE_MIN_SAMPLES,
  QUALITY_DOWNGRADE_COOLDOWN_SAMPLES,
} from "../config/GameConfig.js";

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Decides render quality from a device's real capability instead of a flat
// "isMobile ? 1 : 1.5" pixel-ratio cutoff -- a landscape phone at 900px
// wide was previously treated as a desktop and rendered at 1.5x DPR, while
// a genuinely capable tablet was capped down unnecessarily. Picks a
// starting tier from coarse device signals, then can ratchet the tier DOWN
// (never back up, to avoid visible oscillation) if sustained FPS is low.
//
// `antialias` only takes effect when the WebGLRenderer is first
// constructed -- Engine.js must read it once at startup; it is not part of
// the live-adjustable set (pixelRatio, shadows, shadowMapSize, bloom are).
export class QualityManager {
  constructor() {
    this.tierName = this._pickInitialTier();
    this._fpsHistory = [];
    this._framesSinceChange = 0;
  }

  _pickInitialTier() {
    const cores = navigator.hardwareConcurrency || 4;
    const dpr = window.devicePixelRatio || 1;
    const coarsePointer =
      typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;

    if (coarsePointer && (cores <= 4 || dpr >= 3)) return "low";
    if (coarsePointer) return "medium";
    return cores >= 8 ? "high" : "medium";
  }

  get tier() {
    return QUALITY_TIERS[this.tierName];
  }

  // Pixel-budget DPR: targets a total rendered-pixel count per tier instead
  // of a flat device-pixel-ratio cap, so a 4K TV and a 360px phone both
  // land on a sane workload rather than one wasting a good phone's screen
  // or the other melting a cheap one.
  computeRendererSize(viewportState) {
    const { cssW, cssH, dpr } = viewportState;
    const tier = this.tier;
    const fit = Math.sqrt(tier.maxPixels / (cssW * cssH));
    const pixelRatio = clamp(Math.min(dpr, fit), QUALITY_DPR_FLOOR, tier.dprMax);
    return { width: cssW, height: cssH, pixelRatio };
  }

  // Call once per frame with the frame's delta time. Returns true when the
  // tier just changed, so the caller knows to re-apply renderer/composer
  // settings for the new tier.
  recordFrame(delta) {
    const fps = 1 / Math.max(delta, 0.0001);
    this._fpsHistory.push(fps);
    if (this._fpsHistory.length > QUALITY_FPS_WINDOW) this._fpsHistory.shift();
    this._framesSinceChange++;

    if (this.tierName === "low") return false; // nothing lower to fall back to
    if (this._framesSinceChange < QUALITY_DOWNGRADE_MIN_SAMPLES) return false;
    if (this._fpsHistory.length < QUALITY_FPS_WINDOW) return false;

    const avg = this._fpsHistory.reduce((a, b) => a + b, 0) / this._fpsHistory.length;
    if (avg < QUALITY_DOWNGRADE_FPS_THRESHOLD) {
      this._downgrade();
      return true;
    }
    return false;
  }

  _downgrade() {
    const idx = QUALITY_TIER_ORDER.indexOf(this.tierName);
    const next = QUALITY_TIER_ORDER[Math.min(idx + 1, QUALITY_TIER_ORDER.length - 1)];
    this.tierName = next;
    this._fpsHistory = [];
    this._framesSinceChange = -QUALITY_DOWNGRADE_COOLDOWN_SAMPLES; // cooldown before judging again
  }
}
