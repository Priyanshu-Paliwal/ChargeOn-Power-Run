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

    // Only accept gameplay inputs while enabled (i.e. during PLAYING mode)
    this.enabled = false;

    this._laneRequests = [];
    this._buffered = []; // [{ action: 'jump' | 'slide' | 'board', time }]
    this._touchStart = null;
    this._lastTap = null; // { time, clientX, clientY }
    
    this._prevGamepadState = {
      up: false,
      down: false,
      left: false,
      right: false,
      cross: false,
      circle: false,
      triangle: false,
      square: false
    };

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);
    this._onTouchCancel = this._onTouchCancel.bind(this);

    window.addEventListener("keydown", this._onKeyDown);
    this.targetElement.addEventListener("touchstart", this._onTouchStart, { passive: false });
    this.targetElement.addEventListener("touchmove", this._onTouchMove, { passive: false });
    this.targetElement.addEventListener("touchend", this._onTouchEnd, { passive: false });
    this.targetElement.addEventListener("touchcancel", this._onTouchCancel, { passive: false });
  }

  setEnabled(enabled) {
    const wasEnabled = this.enabled;
    this.enabled = Boolean(enabled);
    if (!this.enabled) {
      this.clear();
    } else if (!wasEnabled) {
      // Transitioning from false -> true. Read hardware state immediately 
      // so we don't trigger actions from buttons held during the menu.
      this._pollGamepads(true);
    }
  }

  clear() {
    this._laneRequests = [];
    this._buffered = [];
    this._touchStart = null;
    this._lastTap = null;
  }

  _onKeyDown(e) {
    if (!this.enabled) return;

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
    if (!this.enabled) return;
    e.preventDefault(); // see the constructor's comment -- stops the browser claiming this gesture as its own
    const t = e.changedTouches[0];
    this._touchStart = { screenX: t.screenX, screenY: t.screenY, clientX: t.clientX, clientY: t.clientY, time: performance.now() };
  }

  // Only preventDefault while a swipe we're actually tracking is underway --
  // scoped to that so this can't fight any other in-flight touch this
  // element didn't start tracking.
  _onTouchMove(e) {
    if (!this.enabled) return;
    if (this._touchStart) e.preventDefault();
  }

  // Fires instead of touchend if the browser/OS interrupts the gesture
  // (an incoming call/notification, or -- pre-fix -- exactly the native
  // gesture takeover this class now prevents). Drop the in-progress swipe
  // rather than leave stale start data that could pair with a LATER,
  // unrelated touchend and misfire.
  _onTouchCancel() {
    this._touchStart = null;
  }

  _onTouchEnd(e) {
    if (!this.enabled || !this._touchStart) {
      this._touchStart = null;
      return;
    }
    this.scheme = this.scheme === "keyboard" ? "both" : "touch";

    const t = e.changedTouches[0];
    const diffX = t.screenX - this._touchStart.screenX;
    const diffY = t.screenY - this._touchStart.screenY;
    const duration = performance.now() - this._touchStart.time;
    const tapClientX = this._touchStart.clientX;
    const tapClientY = this._touchStart.clientY;
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
      const now = performance.now();
      // Double tap detection (Subway Surfers style hoverboard activation)
      if (
        this._lastTap &&
        now - this._lastTap.time <= 340 &&
        Math.hypot(tapClientX - this._lastTap.clientX, tapClientY - this._lastTap.clientY) < 60
      ) {
        this._buffered.push({ action: "board", time: now });
        this._lastTap = null;
      } else {
        this._lastTap = { time: now, clientX: tapClientX, clientY: tapClientY };
        // Tap-zone fallback: left half of the container = lane left, right
        // half = lane right. Covers the common "my swipe didn't register"
        // case for the most frequent action (lateral movement) without
        // trying to map jump/slide onto ambiguous screen zones.
        const rect = this.targetElement.getBoundingClientRect();
        this._laneRequests.push(tapClientX - rect.left < rect.width / 2 ? -1 : 1);
      }
    }
  }

  triggerBoard() {
    this._buffered.push({ action: "board", time: performance.now() });
  }

  triggerCycleBoard() {
    this._buffered.push({ action: "cycle_board", time: performance.now() });
  }

  // Returns every lane-direction request queued since the last call (in
  // order), then clears the queue. Lane changes are never "blocked" by
  // player state, so they don't need buffering with an expiry window --
  // whatever arrived gets applied on the very next poll.
  consumeLaneRequests() {
    if (!this.enabled || this._laneRequests.length === 0) {
      this._laneRequests = [];
      return [];
    }
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

  // Polling update called once per frame by Player.update().
  // Checks for gamepad input, then drops buffered entries older than the
  // buffer window that were never consumed so stale requests can't fire
  // long after the player meant them.
  update() {
    this._pollGamepads();
    
    const now = performance.now();
    if (this._buffered.length > 0) {
      this._buffered = this._buffered.filter((e) => now - e.time <= INPUT_BUFFER_MS);
    }
  }

  _pollGamepads(isInitialRead = false) {
    if (!this.enabled) return;
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : []);
    if (!gamepads) return;

    let gp = null;
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i] && gamepads[i].connected) {
        gp = gamepads[i];
        break; // Take the first connected gamepad
      }
    }
    if (!gp) return;

    this.scheme = 'gamepad';

    const axes = gp.axes;
    const buttons = gp.buttons;
    const isPressed = (b) => typeof b === "object" ? b.pressed : b === 1.0;

    const threshold = 0.5;
    const currentState = {
      up: (axes[1] < -threshold) || (buttons[12] && isPressed(buttons[12])),
      down: (axes[1] > threshold) || (buttons[13] && isPressed(buttons[13])),
      left: (axes[0] < -threshold) || (buttons[14] && isPressed(buttons[14])),
      right: (axes[0] > threshold) || (buttons[15] && isPressed(buttons[15])),
      cross: buttons[0] && isPressed(buttons[0]),
      circle: buttons[1] && isPressed(buttons[1]),
      square: buttons[2] && isPressed(buttons[2]),
      triangle: buttons[3] && isPressed(buttons[3]),
    };

    const prev = this._prevGamepadState;
    const now = performance.now();

    if (!isInitialRead) {
      if (currentState.left && !prev.left) {
        this._laneRequests.push(-1);
      }
      if (currentState.right && !prev.right) {
        this._laneRequests.push(1);
      }
      if ((currentState.up && !prev.up) || (currentState.circle && !prev.circle)) {
        this._buffered.push({ action: "jump", time: now });
      }
      if ((currentState.down && !prev.down) || (currentState.square && !prev.square) || (currentState.cross && !prev.cross)) {
        this._buffered.push({ action: "slide", time: now });
      }
    }

    this._prevGamepadState = currentState;
  }

  dispose() {
    window.removeEventListener("keydown", this._onKeyDown);
    this.targetElement.removeEventListener("touchstart", this._onTouchStart);
    this.targetElement.removeEventListener("touchmove", this._onTouchMove);
    this.targetElement.removeEventListener("touchend", this._onTouchEnd);
    this.targetElement.removeEventListener("touchcancel", this._onTouchCancel);
    this._laneRequests = [];
    this._buffered = [];
  }
}
