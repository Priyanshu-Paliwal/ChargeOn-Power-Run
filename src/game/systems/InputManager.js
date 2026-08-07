import { viewportManager } from "../core/ViewportManager.js";
import { INPUT_BUFFER_MS, SWIPE } from "../config/GameConfig.js";

// Keyboard (arrows/WASD/space) + touch (swipe with a screen-proportional
// distance threshold, tap-zone fallback for lane changes). Everything is
// poll-based: DOM events just queue a request, and Player.js's update()
// loop consumes the queue once per frame. This is simpler to reason about
// than firing callbacks mid-event, and the at-most-one-frame (~16ms)
// deferral is imperceptible while still preserving every individual
// keypress's cumulative effect (nothing is collapsed or overwritten).
//
// Touch listeners bind to `targetElement` (the canvas container), not
// `window` -- the UI layer sits in front of the canvas as a separate,
// higher z-index element with its own pointer-events, so a tap on a UI
// button is captured there and never reaches these listeners at all. Binding
// to `window` instead would see every touch regardless of what was actually
// tapped, misreading UI button taps as game swipes.
//
// Keyboard listeners stay on `window` (keydown only fires there or on a
// focused element; there's no equivalent "double-fire on UI click" problem
// for key events the way there is for touch).
export class InputManager {
  constructor(targetElement) {
    this.targetElement = targetElement;

    // 'keyboard' | 'touch' | 'both' -- updated as capability is actually
    // observed. Milestone 8's UI work can read this to show the right
    // control hints; not consumed anywhere yet.
    this.scheme = "keyboard";

    this._laneRequests = [];
    this._buffered = []; // [{ action: 'jump' | 'slide', time }]
    this._touchStart = null;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);

    window.addEventListener("keydown", this._onKeyDown);
    this.targetElement.addEventListener("touchstart", this._onTouchStart, { passive: true });
    this.targetElement.addEventListener("touchend", this._onTouchEnd, { passive: true });
  }

  _onKeyDown(e) {
    // Don't hijack keys while the player is typing into a form field
    // (Registration screen's Name/Company/Email inputs, most notably --
    // "wasd" in a name would otherwise queue lane/jump/slide requests).
    const active = document.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;

    this.scheme = this.scheme === "touch" ? "both" : "keyboard";

    switch (e.key) {
      case "ArrowLeft":
      case "a":
      case "A":
        this._laneRequests.push(-1);
        break;
      case "ArrowRight":
      case "d":
      case "D":
        this._laneRequests.push(1);
        break;
      case "ArrowUp":
      case "w":
      case "W":
      case " ":
        this._buffered.push({ action: "jump", time: performance.now() });
        break;
      case "ArrowDown":
      case "s":
      case "S":
        this._buffered.push({ action: "slide", time: performance.now() });
        break;
    }
  }

  _onTouchStart(e) {
    const t = e.changedTouches[0];
    this._touchStart = { screenX: t.screenX, screenY: t.screenY, clientX: t.clientX, time: performance.now() };
  }

  _onTouchEnd(e) {
    if (!this._touchStart) return;
    this.scheme = this.scheme === "keyboard" ? "both" : "touch";

    const t = e.changedTouches[0];
    const diffX = t.screenX - this._touchStart.screenX;
    const diffY = t.screenY - this._touchStart.screenY;
    const duration = performance.now() - this._touchStart.time;
    const tapClientX = this._touchStart.clientX;
    this._touchStart = null;

    const distance = Math.max(Math.abs(diffX), Math.abs(diffY));
    const cssW = viewportManager.getState()?.cssW || window.innerWidth;
    const swipeThreshold = Math.max(SWIPE.minDistancePx, cssW * SWIPE.minDistanceRatio);

    if (distance >= swipeThreshold && duration <= SWIPE.maxDurationMs) {
      if (Math.abs(diffX) > Math.abs(diffY)) {
        this._laneRequests.push(diffX > 0 ? 1 : -1);
      } else if (diffY > 0) {
        this._buffered.push({ action: "slide", time: performance.now() });
      } else {
        this._buffered.push({ action: "jump", time: performance.now() });
      }
    } else if (distance < swipeThreshold && duration <= SWIPE.tapMaxDurationMs) {
      // Tap-zone fallback: left half of the container = lane left, right
      // half = lane right. Covers the common "my swipe didn't register"
      // case for the most frequent action (lateral movement) without
      // trying to map jump/slide onto ambiguous screen zones.
      const rect = this.targetElement.getBoundingClientRect();
      this._laneRequests.push(tapClientX - rect.left < rect.width / 2 ? -1 : 1);
    }
  }

  // Returns every lane-direction request queued since the last call (in
  // order), then clears the queue. Lane changes are never "blocked" by
  // player state, so they don't need buffering with an expiry window --
  // whatever arrived gets applied on the very next poll.
  consumeLaneRequests() {
    if (this._laneRequests.length === 0) return this._laneRequests;
    const reqs = this._laneRequests;
    this._laneRequests = [];
    return reqs;
  }

  // Call when the player is able to accept `action` ('jump' | 'slide')
  // right now. Returns true and consumes the oldest matching buffered
  // request if one exists within INPUT_BUFFER_MS; false otherwise. This is
  // what makes a jump pressed slightly before landing still fire the
  // instant landing completes, instead of being silently dropped.
  consumeBuffered(action) {
    const now = performance.now();
    for (let i = 0; i < this._buffered.length; i++) {
      const entry = this._buffered[i];
      if (entry.action === action && now - entry.time <= INPUT_BUFFER_MS) {
        this._buffered.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  // Drops buffered entries older than the buffer window that were never
  // consumed. Call once per frame (Player.update() does this before
  // checking consumeBuffered) so stale requests can't fire long after the
  // player meant them.
  prune() {
    const now = performance.now();
    if (this._buffered.length === 0) return;
    this._buffered = this._buffered.filter((e) => now - e.time <= INPUT_BUFFER_MS);
  }

  dispose() {
    window.removeEventListener("keydown", this._onKeyDown);
    this.targetElement.removeEventListener("touchstart", this._onTouchStart);
    this.targetElement.removeEventListener("touchend", this._onTouchEnd);
    this._laneRequests = [];
    this._buffered = [];
  }
}
