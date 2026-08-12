<script setup>
import { computed, reactive, ref, watch, onMounted, onUnmounted, nextTick, inject } from "vue";
import { gsap } from "gsap";
import { levels } from "../data/GameContent.js";
import { TUTORIAL_BANNER } from "../game/config/GameConfig.js";
import { viewportManager } from "../game/core/ViewportManager.js";

// Same provide('musicState', ...) App.vue exposes at the app root for
// Landing.vue's Lobby toggle (see App.vue) -- injected here too so there's
// a working mute/music control DURING gameplay as well, not only on the
// pre-game Lobby screen. Vue's provide/inject isn't limited to direct
// parent-child pairs; any descendant of the provider can inject it.
const musicState = inject("musicState");

const props = defineProps({
  stats: Object,
  // Engine.js instance -- read-only telemetry poll for the power-up radial
  // timer (see pollPowerUps below). Same pragmatic "reach into the engine
  // instance directly" pattern App.vue already uses elsewhere
  // (gameEngine.player.setCharacter(), gameEngine.world.setLevel()) --
  // Signals.js-style decoupling is the eventual goal, not something this
  // milestone's scope requires building out for one read-only poll.
  engine: Object,
});
const emit = defineEmits(["pause"]);

const currentLevelData = computed(() => levels.find((l) => l.id === props.stats.currentLevelId) || levels[0]);

// -----------------------------------------------------------------------
// Screen-edge vignette. Shared by hit reactions (red) and power-up pickups
// (their own color) -- App.vue's gameStats.flashFeed is append-only, same
// baseline-on-mount pattern as toastFeed, but a flash RESTARTS the same
// visual on each new entry instead of queuing distinct ones: it's a
// transient reaction, not readable text, so overlapping is fine and
// queuing would only add pointless latency to how "instant" it reads.
// -----------------------------------------------------------------------
const vignetteColor = ref("transparent");
const vignetteOpacity = ref(0);
const _vignetteTween = { value: 0 };
let _consumedFlashCount = 0;

watch(
  () => props.stats.flashFeed.length,
  (len) => {
    if (len <= _consumedFlashCount) return;
    const flash = props.stats.flashFeed[len - 1]; // only the latest matters -- see comment above
    _consumedFlashCount = len;
    vignetteColor.value = flash.color;
    gsap.killTweensOf(_vignetteTween);
    _vignetteTween.value = flash.intensity;
    vignetteOpacity.value = flash.intensity;
    gsap.to(_vignetteTween, {
      value: 0,
      duration: 0.45,
      ease: "power2.out",
      onUpdate: () => (vignetteOpacity.value = _vignetteTween.value),
    });
  }
);

// -----------------------------------------------------------------------
// Animated counters. gameStats.score/levelFeaturesCollected already update
// instantly (Milestone 6); GSAP ticks the DISPLAYED number up to the new
// value over a short tween instead of snapping, and the progress bar fill
// gets a slight overshoot so a pickup reads as a small, satisfying "gain"
// rather than a flat instant redraw.
// -----------------------------------------------------------------------
// Both initialize from the CURRENT prop value, not 0 -- levelFeaturesCollected
// resets every level (so 0 happens to be correct there today), but score is a
// whole-run stat that persists across levels. GameHUD remounts fresh each
// level (App.vue's v-else-if chain), so starting this at 0 would show "0"
// on every level-2+ mount until the next coin, even though the real score
// (e.g. from level 1) is already nonzero.
const displayScore = ref(props.stats.score);
const displayFeatureCount = ref(props.stats.levelFeaturesCollected);
const _scoreTween = { value: props.stats.score };
const _featureTween = { value: props.stats.levelFeaturesCollected };

watch(
  () => props.stats.score,
  (val) => {
    gsap.to(_scoreTween, {
      value: val,
      duration: 0.5,
      ease: "power2.out",
      onUpdate: () => (displayScore.value = Math.round(_scoreTween.value)),
    });
  }
);

watch(
  () => props.stats.levelFeaturesCollected,
  (val) => {
    gsap.to(_featureTween, {
      value: val,
      duration: 0.4,
      ease: "power2.out",
      onUpdate: () => (displayFeatureCount.value = Math.round(_featureTween.value)),
    });
  }
);

// Combo badge pop (Milestone 9). Only pops on an INCREASE -- popping on the
// reset-to-0 too (when the badge disappears) would look like a celebration
// for breaking your own streak.
const comboEl = ref(null);
watch(
  () => props.stats.combo,
  (val, prev) => {
    if (val <= prev) return;
    nextTick(() => {
      if (!comboEl.value) return;
      gsap.fromTo(comboEl.value, { scale: 1.4 }, { scale: 1, duration: 0.3, ease: "back.out(2)" });
    });
  }
);

const progressPct = computed(() => (displayFeatureCount.value / currentLevelData.value.requiredCount) * 100);

const barFillEl = ref(null);
watch(progressPct, (pct) => {
  if (!barFillEl.value) return;
  gsap.to(barFillEl.value, { width: `${pct}%`, duration: 0.5, ease: "back.out(1.5)" });
});

// -----------------------------------------------------------------------
// Toast queue. App.vue's gameStats.toastFeed is append-only (never trimmed
// there) -- this component owns display timing/eviction itself, capping how
// many are ever shown AT ONCE and queuing the rest, so a rapid pickup
// streak (e.g. an active magnet sweeping several coins in under a second)
// queues cleanly instead of every pickup's independent timer piling
// messages on top of each other with no cap.
// -----------------------------------------------------------------------
const MAX_CONCURRENT_TOASTS = 3;
// On a phone, even small toasts stacked 2-3 deep eat a large fraction of the
// limited vertical space that shows the road ahead -- capping to 1 at a time
// (still queued/promoted the same way, just narrower) keeps the play area
// visible instead of covering it during exactly the moments (rapid pickups)
// that most need to see incoming obstacles.
function _maxConcurrentToasts() {
  const sizeClass = viewportManager.getState()?.sizeClass || "";
  return sizeClass.startsWith("phone") ? 1 : MAX_CONCURRENT_TOASTS;
}
const TOAST_DURATION_MS = 2200;
const activeToasts = ref([]);
const _pendingToasts = [];
const _toastTimeouts = new Set();
let _consumedToastCount = 0;

function _promoteToasts() {
  while (activeToasts.value.length < _maxConcurrentToasts() && _pendingToasts.length) {
    const toast = _pendingToasts.shift();
    activeToasts.value.push(toast);
    const timeoutId = setTimeout(() => {
      activeToasts.value = activeToasts.value.filter((t) => t.id !== toast.id);
      _toastTimeouts.delete(timeoutId);
      _promoteToasts();
    }, TOAST_DURATION_MS);
    _toastTimeouts.add(timeoutId);
  }
}

watch(
  () => props.stats.toastFeed.length,
  (len) => {
    for (let i = _consumedToastCount; i < len; i++) _pendingToasts.push(props.stats.toastFeed[i]);
    _consumedToastCount = len;
    _promoteToasts();
  }
);

// -----------------------------------------------------------------------
// Power-up radial timer. Polled via rAF rather than routed through
// gameStats -- a countdown changes every frame, which doesn't belong in
// Vue's coin/blocker event-driven reactive state the way score/features do.
// -----------------------------------------------------------------------
const powerUpState = reactive({ magnetActive: false, magnetPct: 0, shieldActive: false });
// Speed-lines overlay (Milestone 9): Engine.startLevel() sets a brief
// window on the engine itself (isSpeedLinesActive), the same kind of
// transient timed visual as the power-up countdown above -- polled here
// rather than routed through gameStats for the same reason.
const speedLinesActive = ref(false);
// Interactive tutorial banner (Milestone 9) -- WorldStreamer.tutorialActive
// is the same kind of transient engine-owned state as the power-up
// countdown, polled the same way.
const tutorialActive = ref(false);
let _powerUpRaf = null;
function _pollPowerUps() {
  const player = props.engine?.player;
  if (player) {
    const status = player.getPowerUpStatus();
    powerUpState.magnetActive = status.magnetActive;
    powerUpState.magnetPct = status.magnetDurationMs > 0 ? status.magnetRemainingMs / status.magnetDurationMs : 0;
    powerUpState.shieldActive = status.shieldActive;
  }
  speedLinesActive.value = !!props.engine?.isSpeedLinesActive;
  tutorialActive.value = !!props.engine?.world?.tutorialActive;
  _powerUpRaf = requestAnimationFrame(_pollPowerUps);
}

const RING_RADIUS = 15;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const magnetDashOffset = computed(() => RING_CIRCUMFERENCE * (1 - powerUpState.magnetPct));

onMounted(() => {
  // Baseline consumption at the CURRENT feed length, not 0 -- toastFeed
  // persists for the whole run but GameHUD remounts fresh every level (it's
  // in App.vue's v-else-if chain), so without this a level-2 mount would
  // immediately re-queue every toast level 1 already showed.
  _consumedToastCount = props.stats.toastFeed.length;
  _consumedFlashCount = props.stats.flashFeed.length;
  _powerUpRaf = requestAnimationFrame(_pollPowerUps);
});

onUnmounted(() => {
  if (_powerUpRaf) cancelAnimationFrame(_powerUpRaf);
  _toastTimeouts.forEach((id) => clearTimeout(id));
  _toastTimeouts.clear();
});
</script>

<template>
  <div class="hud-container">
    <!-- Top Bar -->
    <div class="top-bar">
      <div class="lives">
        <span v-for="n in 3" :key="n" :class="{ lost: n > props.stats.lives }">❤️</span>
      </div>

      <div class="progress-section">
        <div class="level-badge">LEVEL {{ props.stats.currentLevelId }}</div>
        <div class="progress-bar-container">
          <div class="progress-bar-fill" ref="barFillEl"></div>
        </div>
        <div class="progress-text">{{ displayFeatureCount }} / {{ currentLevelData.requiredCount }}</div>
      </div>

      <div class="utility-group">
        <div class="score-display" title="Score">
          <span class="score-icon">★</span>{{ displayScore }}
        </div>

        <div v-if="props.stats.combo >= 2" ref="comboEl" class="combo-badge" title="Combo streak">
          🔥 {{ props.stats.combo }}x
        </div>

        <div v-if="powerUpState.magnetActive" class="powerup-icon magnet-icon" title="Magnet active">
          <svg viewBox="0 0 36 36">
            <circle class="ring-track" cx="18" cy="18" r="15" />
            <circle
              class="ring-fill"
              cx="18"
              cy="18"
              r="15"
              :stroke-dasharray="RING_CIRCUMFERENCE"
              :stroke-dashoffset="magnetDashOffset"
            />
          </svg>
          <span class="powerup-emoji">🧲</span>
        </div>

        <div v-if="powerUpState.shieldActive" class="powerup-icon shield-icon" title="Shield up">
          <span class="powerup-emoji">🛡️</span>
        </div>

        <button
          v-if="musicState"
          class="music-btn"
          @click="musicState.toggleMusic()"
          :title="musicState.isMusicPlaying.value ? 'Pause Music' : 'Play Music'"
          :aria-label="musicState.isMusicPlaying.value ? 'Pause Music' : 'Play Music'"
        >
          {{ musicState.isMusicPlaying.value ? "🔊" : "🔇" }}
        </button>

        <button class="pause-btn" @click="emit('pause')" aria-label="Pause">⏸</button>
      </div>
    </div>

    <!-- Side Panel (Collected Features) -->
    <div class="side-panel">
      <h3>Features Collected</h3>
      <transition-group name="list" tag="div" class="feature-list">
        <div
          v-for="feature in props.stats.featuresCollected"
          :key="feature.name"
          class="feature-chip"
          :class="feature.category === 'Admin' ? 'admin-chip' : 'business-chip'"
        >
          {{ feature.name }}
        </div>
      </transition-group>
    </div>

    <!-- Toasts -->
    <div class="popups-container">
      <transition-group name="popup-anim" tag="div">
        <div
          v-for="popup in activeToasts"
          :key="popup.id"
          class="popup-message"
          :class="{ 'popup-success': popup.type === 'success', 'popup-error': popup.type === 'error', 'popup-exclusive': popup.isExclusive }"
        >
          {{ popup.text }}
        </div>
      </transition-group>
    </div>

    <!-- Screen-edge vignette: hit reactions (red) and power-up pickups
         (their own color) share this one element, driven by flashFeed. -->
    <div class="edge-vignette" :style="{ opacity: vignetteOpacity, '--vignette-color': vignetteColor }"></div>

    <!-- Speed-up juice: brief radiating streaks at each level transition
         (Engine.startLevel()), alongside the camera's own FOV kick. -->
    <div class="speed-lines" :class="{ active: speedLinesActive }"></div>

    <!-- Interactive tutorial banner (Milestone 9, Level 1 opening only). -->
    <Transition name="tutorial-banner">
      <div v-if="tutorialActive" class="tutorial-banner">{{ TUTORIAL_BANNER }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.hud-container {
  width: 100%;
  height: 100%;
  /* !important is load-bearing, not a shortcut: App.vue's `.ui-layer > *
     { pointer-events: auto }` (every screen's root gets click-through
     re-enabled by default) and this rule end up with IDENTICAL CSS
     specificity once Vue's scoped-style attributes are compiled in (both
     resolve to one class + one attribute selector) -- found by inspecting
     the actual built CSS, not guessed. A tie is broken by source order in
     the final bundle, which happened to put App.vue's rule LAST, so this
     rule was silently losing: .hud-container computed to pointer-events:
     auto despite this line, meaning the ENTIRE full-screen HUD (not just
     its buttons) was capturing every touch before it could ever reach the
     canvas underneath -- the root cause of "mobile swipes do nothing at
     all." Source order is an implementation detail of how Vite happens to
     bundle today, not something this rule should depend on to win. */
  pointer-events: none !important;
}

.edge-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  /* Inset shadow keeps this confined to the screen EDGES, not a full-screen
     overlay -- the content script is explicit that a hit should read as "a
     red flash at the screen edges," not a color wash over the whole view. */
  box-shadow: inset 0 0 15vw 3vw var(--vignette-color, transparent);
  z-index: 20;
  opacity: 0;
  will-change: opacity;
}

.speed-lines {
  position: absolute;
  inset: -25%;
  pointer-events: none;
  z-index: 19;
  background: repeating-conic-gradient(
    from 0deg,
    rgba(255, 255, 255, 0.4) 0deg 1.5deg,
    transparent 1.5deg 10deg
  );
  mix-blend-mode: screen;
  opacity: 0;
  transform: scale(0.75);
  transition: opacity 0.15s ease-out, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
.speed-lines.active {
  opacity: 1;
  transform: scale(1.25);
}

.tutorial-banner {
  position: absolute;
  bottom: 8%;
  left: 50%;
  transform: translateX(-50%);
  max-width: 90%;
  background: rgba(4, 44, 83, 0.9);
  border: 2px solid #F4C775;
  color: #fff;
  padding: 12px 22px;
  border-radius: 12px;
  font-weight: 700;
  font-size: 0.95rem;
  text-align: center;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  z-index: 25;
  pointer-events: none;
}

.tutorial-banner-enter-active,
.tutorial-banner-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.tutorial-banner-enter-from,
.tutorial-banner-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}

.top-bar {
  position: absolute;
  top: 15px;
  left: 50%;
  transform: translateX(-50%);
  width: 60%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 15px;
  background: rgba(255, 255, 255, 0.9);
  padding: 8px 15px;
  border-radius: 12px;
  box-shadow: 0 5px 15px rgba(0,0,0,0.2);
  color: #042C53;
}

.lives span {
  font-size: 1.5rem;
  margin-right: 5px;
  transition: opacity 0.3s;
}
.lives span.lost {
  opacity: 0.2;
  filter: grayscale(100%);
}

.progress-section {
  display: flex;
  align-items: center;
  gap: 15px;
  flex: 1;
  margin-left: 20px;
}

.level-badge {
  font-weight: bold;
  background: #042C53;
  color: white;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 0.9rem;
}

.progress-bar-container {
  flex: 1;
  height: 12px;
  background: #e0e0e0;
  border-radius: 6px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: #F4C775;
  width: 0%;
}

.progress-text {
  font-weight: bold;
  font-size: 1.1rem;
}

.utility-group {
  display: flex;
  align-items: center;
  gap: 10px;
  pointer-events: auto;
}

.score-display {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 800;
  font-size: 1.1rem;
  color: #0d2d40;
  white-space: nowrap;
}
.score-icon {
  color: #F4C775;
  text-shadow: 0 0 6px rgba(244, 199, 117, 0.6);
}

.combo-badge {
  font-weight: 800;
  font-size: 1rem;
  color: #ff6b35;
  white-space: nowrap;
  background: rgba(255, 107, 53, 0.12);
  padding: 3px 8px;
  border-radius: 12px;
}

.powerup-icon {
  position: relative;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.powerup-icon svg {
  position: absolute;
  inset: 0;
  transform: rotate(-90deg);
  width: 100%;
  height: 100%;
}
.ring-track {
  fill: none;
  stroke: rgba(4, 44, 83, 0.15);
  stroke-width: 3;
}
.ring-fill {
  fill: none;
  stroke: #00B0FF;
  stroke-width: 3;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.1s linear;
}
.powerup-emoji {
  font-size: 1.1rem;
  line-height: 1;
}
.shield-icon .powerup-emoji {
  filter: drop-shadow(0 0 4px rgba(0, 176, 255, 0.6));
}

.pause-btn,
.music-btn {
  background: #042C53;
  color: #fff;
  border: none;
  width: 32px;
  height: 32px;
  min-width: 32px;
  border-radius: 50%;
  font-size: 0.9rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s, background 0.15s;
}
.pause-btn:hover,
.music-btn:hover {
  background: #154563;
  transform: scale(1.08);
}

.side-panel {
  position: absolute;
  top: 80px;
  right: 15px;
  width: 240px;
  bottom: 20px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 10px;
  padding: 12px;
  box-shadow: 0 5px 15px rgba(0,0,0,0.2);
  overflow-y: auto;
  color: #042C53;
}

h3 {
  font-size: 1rem;
  margin-bottom: 10px;
  border-bottom: 2px solid #e0e0e0;
  padding-bottom: 8px;
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.feature-chip {
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  color: #fff;
}

.admin-chip {
  background: #F4C775;
  color: #042C53;
}

.business-chip {
  background: #042C53;
}

/* Animations */
.list-enter-active,
.list-leave-active {
  transition: all 0.5s ease;
}
.list-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

/* Popups */
.popups-container {
  position: absolute;
  top: 15%;
  right: 20px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  z-index: 100;
  pointer-events: none;
}

.popup-message {
  padding: 10px 20px;
  border-radius: 20px;
  font-size: 1rem;
  font-weight: bold;
  color: white;
  text-align: right;
  white-space: pre-wrap;
  box-shadow: 0 5px 15px rgba(0,0,0,0.3);
  max-width: 300px;
  border: 2px solid transparent;
}

.popup-success {
  background: rgba(4, 44, 83, 0.9);
  border-color: #F4C775;
}

.popup-error {
  background: rgba(211, 47, 47, 0.9);
  border-color: #ff9999;
}

.popup-exclusive {
  background: linear-gradient(135deg, #042C53 0%, #D2B48C 100%);
  border-color: #ffd164;
  text-shadow: 0 2px 5px rgba(0,0,0,0.5);
}

.popup-anim-enter-active,
.popup-anim-leave-active {
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.popup-anim-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.8);
}
.popup-anim-leave-to {
  opacity: 0;
  transform: translateY(-20px) scale(0.8);
}

/* RESPONSIVE DESIGN */
@media (max-width: 1024px) {
  .top-bar {
    width: 95%;
    padding: 8px 12px;
    flex-wrap: wrap;
    top: 10px;
  }

  .progress-section {
    margin-left: 10px;
    gap: 10px;
  }

  .lives span {
    font-size: 1.2rem;
    margin-right: 2px;
  }

  .level-badge {
    font-size: 0.8rem;
    padding: 3px 6px;
  }

  .progress-text {
    font-size: 0.9rem;
  }

  .score-display {
    font-size: 0.95rem;
  }

  .pause-btn,
  .music-btn {
    width: 28px;
    height: 28px;
    min-width: 28px;
  }

  /* On mobile, move the side panel to the bottom and make it a horizontal scrolling list */
  .side-panel {
    top: auto;
    bottom: 20px;
    left: 10px;
    right: 10px;
    width: auto;
    height: 100px;
    padding: 10px;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .side-panel h3 {
    font-size: 0.9rem;
    margin-bottom: 5px;
    border-bottom: none;
    padding-bottom: 0;
  }

  .feature-list {
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
  }

  .feature-chip {
    white-space: nowrap;
  }

  .popups-container {
    top: 30%;
    right: 10px;
    width: auto;
  }

  .popup-message {
    font-size: 1rem;
    padding: 8px 15px;
  }
}

/* Short-landscape (phone in landscape): the top bar's 3-section layout is
   too wide to wrap cleanly at very low heights -- collapse to icons/compact
   text and shrink the side panel so it doesn't eat the whole short screen.

   NOTE ON :global() SYNTAX (found and fixed this session -- see
   docs/PROCESS_TRACKER.md): :global(A) B compiles to just `A { ... }`,
   silently DROPPING `B` entirely -- confirmed directly against the real
   @vue/compiler-sfc, not assumed. Every rule below (and the equivalent
   pattern in Landing.vue/RegistrationForm.vue) previously used that broken
   form, meaning EVERY phone-landscape/phone-portrait override in this
   codebase has been a complete no-op since Milestone 8 -- verified by
   inspecting the actual compiled dist/ CSS, which showed the trailing
   class missing from all of them. The whole selector (ancestor AND
   descendant together) must go inside ONE :global(...) call instead. */
:global(html[data-size-class="phone-landscape"] .top-bar) {
  width: 98%;
  padding: 5px 10px;
  gap: 8px;
}
:global(html[data-size-class="phone-landscape"] .progress-section) {
  margin-left: 6px;
  gap: 6px;
}
:global(html[data-size-class="phone-landscape"] .side-panel) {
  height: 60px;
  bottom: 8px;
}

/* Pickup/hit toasts on a phone: the generic tablet-oriented rule above
   (top: 30%, width: 90%) sits squarely in the middle of a phone's much
   shorter, narrower viewport -- right where the road and incoming obstacles
   need to be visible. Pushed to hug the very top edge instead, narrower and
   smaller, so a toast is readable without covering the play area. Paired
   with _maxConcurrentToasts() (script block) capping to 1 at a time on
   phones instead of 3, so this doesn't also depend on 2-3 of these ever
   stacking cleanly in a short vertical space. */
:global(html[data-size-class="phone-portrait"] .popups-container),
:global(html[data-size-class="phone-landscape"] .popups-container) {
  top: 4%;
  right: 10px;
  gap: 6px;
  width: auto;
}
:global(html[data-size-class="phone-portrait"] .popup-message),
:global(html[data-size-class="phone-landscape"] .popup-message) {
  font-size: 0.8rem;
  padding: 6px 12px;
  max-width: 90%;
}
</style>
