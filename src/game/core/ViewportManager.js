import { SIZE_CLASS_RULES } from "../config/GameConfig.js";

// The single source of truth for screen measurement. Nothing else in the
// codebase should read window.innerWidth/innerHeight directly -- both the
// 3D engine (CameraRig, QualityManager) and the Vue UI layer subscribe to
// this SAME instance, so they are provably looking at the same numbers.
//
// Measures via ResizeObserver on the actual canvas container (not
// `window`), cross-checked against visualViewport so a mobile browser's
// animating URL bar can't produce a wrong reading. Every update also writes
// --app-w/--app-h and a data-size-class/data-orientation pair onto
// <html>, so plain CSS can react without any component needing to import
// this module at all.
class ViewportManager {
  constructor() {
    this._container = null;
    this._resizeObserver = null;
    this._visualViewport = window.visualViewport || null;
    this._rafHandle = null;
    this._subscribers = new Set();
    this._state = null;

    this._onViewportEvent = this._onViewportEvent.bind(this);
  }

  // Idempotent: safe to call once per app lifetime. `container` is the
  // element the 3D canvas fills (#game-canvas-container), which is already
  // sized to 100% of the responsive app shell by CSS.
  init(container) {
    if (this._container) return;
    this._container = container;

    this._resizeObserver = new ResizeObserver(() => this._scheduleUpdate());
    this._resizeObserver.observe(container);

    if (this._visualViewport) {
      this._visualViewport.addEventListener("resize", this._onViewportEvent);
      this._visualViewport.addEventListener("scroll", this._onViewportEvent);
    }
    window.addEventListener("orientationchange", this._onViewportEvent);

    this._update(); // synchronous first measurement -- no flash of wrong layout
  }

  _onViewportEvent() {
    this._scheduleUpdate();
  }

  _scheduleUpdate() {
    if (this._rafHandle !== null) return;
    this._rafHandle = requestAnimationFrame(() => {
      this._rafHandle = null;
      this._update();
    });
  }

  _update() {
    if (!this._container) return;

    const rect = this._container.getBoundingClientRect();
    let cssW = rect.width;
    let cssH = rect.height;

    // Cross-check against the true visible area on mobile -- this is what
    // a plain 100vh gets wrong while the URL bar is animating.
    if (this._visualViewport) {
      cssW = Math.min(cssW, this._visualViewport.width);
      cssH = Math.min(cssH, this._visualViewport.height);
    }

    if (cssW <= 0 || cssH <= 0) return; // container not laid out yet

    const dpr = window.devicePixelRatio || 1;
    const aspect = cssW / cssH;
    const orientation = aspect >= 1 ? "landscape" : "portrait";
    const sizeClass = computeSizeClass(cssW, cssH, aspect);
    const safeArea = readSafeAreaInsets();

    const state = { cssW, cssH, dpr, aspect, orientation, sizeClass, safeArea };
    this._state = state;
    this._writeCssState(state);
    for (const cb of this._subscribers) cb(state);
  }

  _writeCssState(state) {
    const root = document.documentElement;
    root.style.setProperty("--app-w", `${state.cssW}px`);
    root.style.setProperty("--app-h", `${state.cssH}px`);
    root.dataset.sizeClass = state.sizeClass;
    root.dataset.orientation = state.orientation;
  }

  getState() {
    return this._state;
  }

  // Returns an unsubscribe function. Calls back immediately with the
  // current state if one is already available, so late subscribers don't
  // have to wait for the next resize to get their first reading.
  subscribe(callback) {
    this._subscribers.add(callback);
    if (this._state) callback(this._state);
    return () => this._subscribers.delete(callback);
  }

  dispose() {
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    if (this._visualViewport) {
      this._visualViewport.removeEventListener("resize", this._onViewportEvent);
      this._visualViewport.removeEventListener("scroll", this._onViewportEvent);
    }
    window.removeEventListener("orientationchange", this._onViewportEvent);
    if (this._rafHandle !== null) {
      cancelAnimationFrame(this._rafHandle);
      this._rafHandle = null;
    }
    this._subscribers.clear();
    this._container = null;
  }
}

function computeSizeClass(cssW, cssH, aspect) {
  const r = SIZE_CLASS_RULES;
  const minDim = Math.min(cssW, cssH);
  const hasFinePointer =
    typeof window.matchMedia === "function" && window.matchMedia("(pointer: fine)").matches;

  // Big screen with no mouse -- the booth TV attract-mode display.
  if (cssW >= r.tvMinWidth && !hasFinePointer) return "tv";

  if (aspect < r.phonePortraitMaxAspect && minDim < r.tabletMinDim) return "phone-portrait";
  if (aspect > r.phoneLandscapeMinAspect && cssH < r.phoneLandscapeMaxHeight) return "phone-landscape";

  if (
    aspect >= 0.6 &&
    aspect < r.tabletPortraitMaxAspect &&
    minDim >= r.tabletMinDim
  ) {
    return "tablet-portrait";
  }
  if (
    aspect >= r.tabletPortraitMaxAspect &&
    aspect <= r.tabletLandscapeMaxAspect &&
    minDim >= r.tabletMinDim
  ) {
    return "tablet-landscape";
  }

  if (aspect > r.desktopMinAspect && cssW >= r.desktopMinWidth) return "desktop";

  // Fallback for the gaps between the buckets above (e.g. a narrow window
  // resized to an in-between size) -- pick the closer bucket by aspect
  // rather than leaving sizeClass undefined.
  return aspect >= 1 ? "desktop" : "tablet-portrait";
}

function readSafeAreaInsets() {
  // style.css defines --safe-top/right/bottom/left via env(safe-area-inset-*)
  // on :root. Reading them back here (rather than re-deriving them) is what
  // guarantees JS and CSS agree on the same numbers.
  const cs = getComputedStyle(document.documentElement);
  const parse = (v) => parseFloat(v) || 0;
  return {
    top: parse(cs.getPropertyValue("--safe-top")),
    right: parse(cs.getPropertyValue("--safe-right")),
    bottom: parse(cs.getPropertyValue("--safe-bottom")),
    left: parse(cs.getPropertyValue("--safe-left")),
  };
}

export const viewportManager = new ViewportManager();
export { ViewportManager };
