<script setup>
import { onMounted, ref, onUnmounted, reactive, provide } from "vue";
import Landing from "./ui/Landing.vue";
import RegistrationForm from "./ui/RegistrationForm.vue";
import HowToPlay from "./ui/HowToPlay.vue";
import StoryBeat from "./ui/StoryBeat.vue";
import GameHUD from "./ui/GameHUD.vue";
import LevelComplete from "./ui/LevelComplete.vue";
import OfferReveal from "./ui/OfferReveal.vue";
import Victory from "./ui/Victory.vue";
import Redemption from "./ui/Redemption.vue";
import GameOver from "./ui/GameOver.vue";
import PauseMenu from "./ui/PauseMenu.vue";
import BoothAdminModal from "./ui/BoothAdminModal.vue";

import { Engine } from "./game/core/Engine.js";
import { levels } from "./data/GameContent.js";
import {
  CHARACTERS,
  DEFAULT_HOVERBOARD_ID,
  HIT_VIGNETTE_COLOR,
  HIT_VIGNETTE_INTENSITY,
  POWERUP_VIGNETTE_COLORS,
  POWERUP_VIGNETTE_INTENSITY,
  POWER_UPS,
} from "./game/config/GameConfig.js";
import { audioManager } from "./game/systems/AudioManager.js";
import { viewportManager } from "./game/core/ViewportManager.js";
import {
  submitRegistration,
  updateLevelResult,
  updateMainDiscount,
} from "./services/SheetService.js";
import {
  generateSessionId,
  createPlayerSession,
  recordLevelResult as recordFirebaseLevelResult,
  recordMainDiscount as recordFirebaseMainDiscount,
  recordFinalScore as recordFirebaseFinalScore,
  initRemoteConfigSync,
  getActiveConfigEnv,
} from "./services/FirebaseService.js";

// --- State Machine ---
// LANDING, REGISTRATION, HOW_TO_PLAY, STORY_BEAT, LEVEL_INTRO, PLAYING, LEVEL_COMPLETE, BOSS_BEAT, OFFER_REVEAL, VICTORY, REDEMPTION
const gameState = ref("LANDING");
const activeConfigEnv = ref(getActiveConfigEnv());

// --- Game Data ---
const userData = reactive({ name: "", company: "", email: "" });
const currentSessionId = ref("");
// Lives here (not inside Landing/CharacterSelect) because those components
// fully remount every time gameState cycles back to 'LANDING' (e.g. after
// restartGame()) -- App.vue is the one thing that persists for the whole
// session, so it's the only place that can remember a non-default pick
// across a restart instead of CharacterSelect silently resetting to
// CHARACTERS[0] and dragging the live model back with it.
const selectedCharacterId = ref(CHARACTERS[0].id);
const selectedHoverboardId = ref(DEFAULT_HOVERBOARD_ID);
const gameStats = reactive({
  lives: 3,
  currentLevelId: 1,
  featuresCollected: [],
  levelFeaturesCollected: 0,
  score: 0,
  // Append-only feed, never trimmed here -- GameHUD's own toast queue owns
  // display timing/eviction (max concurrent visible, FIFO promotion) so a
  // rapid pickup streak queues cleanly instead of everything piling up
  // on-screen with independent 2s timers. See GameHUD.vue.
  toastFeed: [],
  // Append-only feed for the screen-edge vignette pulse (Milestone 9) --
  // same consumed-count-baseline pattern as toastFeed, but GameHUD just
  // restarts the same visual on each new entry rather than queuing distinct
  // ones (a flash is a transient reaction, not readable text -- overlapping
  // is fine, queuing would only add pointless latency).
  flashFeed: [],
  // Consecutive coin pickups with no hit in between (Milestone 9). Resets
  // on ANY blocker contact, including a shielded one -- getting hit at all
  // means a dodge was missed, whether or not the shield covered for it.
  // Deliberately NOT fed into ScoreSystem's point math -- a pure display/
  // juice stat for now, not a scoring rebalance.
  combo: 0,
});

// Goodies won so far in this session — used to prevent duplicate goodies
// across levels (passed as prop to LevelComplete for exclusion logic).
const wonGoodies = ref([]);
const hasLostLifeAnyLevel = ref(false);

let gameEngine = null;
let unsubscribeRemoteConfig = null;

// --- Music State (Milestone 9: now backed by AudioManager, not a raw
// <audio> element) --- kept the exact same shape (isMusicPlaying/toggleMusic
// via provide/inject) so Landing.vue's existing music toggle button needs
// no changes at all.
const isMusicPlaying = ref(true);
const toggleMusic = () => {
  audioManager.unlock(); // any click is a valid gesture -- idempotent even if Registration already unlocked it
  if (isMusicPlaying.value) {
    audioManager.pauseMusic();
    isMusicPlaying.value = false;
  } else {
    audioManager.playMusic();
    isMusicPlaying.value = true;
  }
};
provide("musicState", { isMusicPlaying, toggleMusic });

// --- Pause (Milestone 8) ---
// A separate flag, not a gameState transition -- GameHUD stays mounted
// underneath PauseMenu (gameState is still 'PLAYING'), which is what lets
// the world/HUD visibly freeze in place behind the menu instead of
// unmounting and losing that frame.
const isPaused = ref(false);
let _musicWasPlayingBeforePause = false;

const pauseGame = () => {
  if (gameState.value !== "PLAYING" || isPaused.value) return;
  isPaused.value = true;
  gameEngine?.inputManager?.setEnabled(false);
  gameEngine?.stop(); // halts the whole rAF loop -- world, mixer, collision all freeze on this frame
  _musicWasPlayingBeforePause = isMusicPlaying.value;
  if (isMusicPlaying.value) toggleMusic();
};

const resumeGame = () => {
  if (!isPaused.value) return;
  isPaused.value = false;
  gameEngine?.inputManager?.clear();
  gameEngine?.inputManager?.setEnabled(true);
  gameEngine?.start();
  if (_musicWasPlayingBeforePause && !isMusicPlaying.value) toggleMusic();
};

const restartLevelFromPause = () => {
  // Drop THIS level's already-collected features from the run-wide list --
  // handleCollision's "already have this one" dedup check is keyed across
  // the WHOLE run, not the current level, so without this a level restarted
  // mid-attempt could never reach requiredCount again: every feature
  // already logged before the restart would silently refuse to re-count
  // toward levelFeaturesCollected. Score is deliberately NOT rolled back --
  // it's engine-owned (ScoreSystem has no "set to X" API, only reset-to-
  // zero), and a full accurate rollback isn't worth the complexity for a
  // button whose only spec is "Restart Level" with no stated score rule;
  // keeping whatever score was already earned is the safe default.
  const currentLevelData = levels.find(
    (l) => l.id === gameStats.currentLevelId,
  );
  const levelFeatureKeys = new Set(
    currentLevelData.features.map((f) => f.name + "|" + f.category),
  );
  gameStats.featuresCollected = gameStats.featuresCollected.filter(
    (f) => !levelFeatureKeys.has(f.name + "|" + f.category),
  );
  gameStats.levelFeaturesCollected = 0;
  gameStats.lives = 3;
  gameStats.combo = 0;
  if (gameEngine) {
    gameEngine.startLevel(gameStats.currentLevelId);
    gameEngine.setMode("PLAYING");
  }
  resumeGame();
};

// Tabbing away/minimizing mid-run should never silently cost a life to a
// blocker the player couldn't see coming -- auto-pause the instant the tab
// is hidden, same as a manual pause.
const handleVisibilityChange = () => {
  if (document.hidden) pauseGame();
};

const addPopup = (text, type, isExclusive) => {
  gameStats.toastFeed.push({
    id: Date.now() + Math.random(),
    text,
    type,
    isExclusive,
  });
};

const addFlash = (color, intensity = 1) => {
  gameStats.flashFeed.push({
    id: Date.now() + Math.random(),
    color,
    intensity,
  });
};

const saveScoreToLeaderboard = () => {
  const activeSessionId =
    currentSessionId.value || generateSessionId(userData.email);
  // Sync to Firebase live leaderboard and session record
  recordFirebaseFinalScore(
    activeSessionId,
    {
      name: userData.name,
      email: userData.email,
      company: userData.company,
    },
    gameStats.score,
  );
};

const handleCollision = (hit) => {
  // Same logic as before...
  if (gameState.value !== "PLAYING") return;

  if (hit.type === "coin") {
    // Score counts every coin grabbed (reflexes), independent of whether it
    // represents new required progress below -- Engine.js's ScoreSystem
    // already computed the running total.
    gameStats.score = hit.score;
    gameStats.combo++;

    // Special standalone track powerups (Hoverboard and Jetpack)
    if (hit.name === "Hoverboard" || hit.name === "Jetpack") {
      hit.powerUp = hit.name === "Hoverboard" ? "board" : "jetpack";
      const popupText =
        hit.name === "Hoverboard"
          ? ":skateboard: Hoverboard Active!\nCrash Shield Protected (12s)"
          : ":rocket: Jetpack Flight!";
      addPopup(popupText, "success", true);
      addFlash("#00E5FF", 0.8);
      return;
    }

    // Find the next sequential uncollected feature for this level
    const currentLevelData = levels.find(
      (l) => l.id === gameStats.currentLevelId,
    );
    const nextFeature = currentLevelData.features.find(
      (f) =>
        !gameStats.featuresCollected.some(
          (fc) => fc.name === f.name && fc.category === f.category,
        ),
    );

    if (nextFeature) {
      // Overwrite the hit data with the sequential feature so no features are ever skipped
      hit.name = nextFeature.name;
      hit.category = nextFeature.category;
      hit.isExclusive = nextFeature.isExclusive || false;
      hit.exclusiveLine = nextFeature.exclusiveLine || null;

      const powerUpDef = POWER_UPS[hit.name];
      if (powerUpDef) {
        hit.powerUp = powerUpDef.type;
      } else {
        delete hit.powerUp;
      }

      gameStats.featuresCollected.push(hit);
      gameStats.levelFeaturesCollected++;

      let text = hit.name;
      if (hit.powerUp === "magnet") text += `\n🧲 Magnet active!`;
      else if (hit.powerUp === "shield") text += `\n🛡️ Shield up!`;
      addPopup(text, "success", false);
      if (hit.powerUp && POWERUP_VIGNETTE_COLORS[hit.powerUp]) {
        addFlash(
          POWERUP_VIGNETTE_COLORS[hit.powerUp],
          POWERUP_VIGNETTE_INTENSITY,
        );
      }

      if (gameStats.levelFeaturesCollected >= currentLevelData.requiredCount) {
        completeLevel();
      }
    }
  } else if (hit.type === "nearmiss") {
    // Deliberately quiet feedback -- score bump + whoosh (Engine.js) only,
    // no toast. A close call can happen often over a run; a popup for each
    // one would clutter the toast queue for something the plan itself
    // calls "subtle."
    gameStats.score = hit.score;
  } else if (hit.type === "shielded") {
    // Shield absorbed the hit -- no life lost, no game-over check. Still
    // breaks the combo: getting hit at all means a dodge was missed, shield
    // or not.
    gameStats.combo = 0;
    addPopup(`🛡️ Shield absorbed it! ${hit.text}`, "success", false);
  } else if (hit.type === "board_saved") {
    // Subway Surfers Board Crash: board absorbed impact, saving life!
    gameStats.combo = 0;
    addPopup(
      `:skateboard: Board absorbed the impact! ${hit.text}`,
      "success",
      false,
    );
  } else if (hit.type === "blocker") {
    gameStats.combo = 0;
    if (hit.score !== undefined) {
      gameStats.score = hit.score;
    }
    const penaltySuffix = hit.points ? ` (${hit.points} PTS)` : "";
    addPopup(hit.text, "error", false);
    addFlash(HIT_VIGNETTE_COLOR, HIT_VIGNETTE_INTENSITY);
    // Interactive tutorial (Milestone 9): a miss on one of the 3 seeded
    // practice obstacles still shows the full normal feedback above (so
    // the cause-and-effect actually teaches something) but never costs a
    // life or can end the run -- it's a first-ever-controls practice
    // window, not a fair test yet.
    if (hit.isTutorial) return;
    gameStats.lives--;
    hasLostLifeAnyLevel.value = true;
    if (gameStats.lives <= 0) {
      saveScoreToLeaderboard();
      // Update the sheet: current level was Failed
      updateLevelResult(
        userData.email,
        gameStats.currentLevelId,
        "Failed",
        "",
        "",
        gameStats.score,
      );
      // Update Firebase: current level was Failed
      const activeSessionId =
        currentSessionId.value || generateSessionId(userData.email);
      recordFirebaseLevelResult(
        activeSessionId,
        gameStats.currentLevelId,
        "Failed",
        "",
        "",
        gameStats.score,
      );
      gameState.value = "GAME_OVER";
      if (gameEngine) {
        gameEngine.setMode("DEFEAT");
      }
      audioManager.duck(0.2, 1200);
      audioManager.playSFX("gameOver");
    }
  }
};

const completeLevel = () => {
  if (gameEngine) {
    gameEngine.setMode("VICTORY");
  }
  audioManager.duck(0.2, 1200);
  audioManager.playSFX("levelComplete");
  gameState.value = "LEVEL_COMPLETE";
};

onMounted(() => {
  const container = document.getElementById("game-canvas-container");
  if (container) {
    gameEngine = new Engine(container, handleCollision);
    gameEngine.setHoverboard(selectedHoverboardId.value, false);
    // Synchronize the Engine's default player character with the UI's state immediately
    // so it doesn't default to Maya Chen if the slider starts on Kito.
    if (gameEngine.player) {
      gameEngine.player.setCharacter(selectedCharacterId.value);
    }
    gameEngine.start();
    window.gameEngine = gameEngine;
  }
  const handleGlobalKeyDown = (e) => {
    const active = document.activeElement;
    if (
      active &&
      (active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.tagName === "SELECT")
    )
      return;

    if (e.key === "m" || e.key === "M") {
      toggleMusic();
      e.preventDefault();
    } else if (e.key === "Escape" || e.key === "p" || e.key === "P") {
      if (gameState.value === "PLAYING") {
        if (isPaused.value) {
          resumeGame();
        } else {
          pauseGame();
        }
        e.preventDefault();
      }
    }
  };

  window.addEventListener("keydown", handleGlobalKeyDown);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  let _uiGamepadPrev = { enter: false, back: false, left: false, right: false };
  let _uiGamepadFrame = null;
  const pollUIGamepad = () => {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    let enterPressed = false;
    let backPressed = false;
    let leftPressed = false;
    let rightPressed = false;

    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (gp && gp.connected && gp.buttons.length > 0) {
        const isPressed = (b) =>
          typeof b === "object" ? b.pressed : b === 1.0;
        if (gp.buttons[0] && isPressed(gp.buttons[0])) enterPressed = true;
        if (gp.buttons[1] && isPressed(gp.buttons[1])) backPressed = true;
        if (gp.buttons[14] && isPressed(gp.buttons[14])) leftPressed = true;
        if (gp.buttons[15] && isPressed(gp.buttons[15])) rightPressed = true;
        if (gp.axes && gp.axes[0] < -0.5) leftPressed = true;
        if (gp.axes && gp.axes[0] > 0.5) rightPressed = true;
        if (enterPressed || backPressed || leftPressed || rightPressed) break;
      }
    }

    const isGameActive = gameState.value === "PLAYING" && !isPaused.value;

    if (enterPressed && !_uiGamepadPrev.enter && !isGameActive) {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
        }),
      );
    }
    if (backPressed && !_uiGamepadPrev.back && !isGameActive) {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      );
    }
    if (gameState.value !== "PLAYING") {
      if (leftPressed && !_uiGamepadPrev.left) {
        window.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "ArrowLeft",
            bubbles: true,
            cancelable: true,
          }),
        );
      }
      if (rightPressed && !_uiGamepadPrev.right) {
        window.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "ArrowRight",
            bubbles: true,
            cancelable: true,
          }),
        );
      }
    }

    _uiGamepadPrev = {
      enter: enterPressed,
      back: backPressed,
      left: leftPressed,
      right: rightPressed,
    };
    _uiGamepadFrame = requestAnimationFrame(pollUIGamepad);
  };
  _uiGamepadFrame = requestAnimationFrame(pollUIGamepad);

// Attempt to play music by default on load without waiting for interaction
  audioManager.unlock();
  if (isMusicPlaying.value) {
    audioManager.playMusic();
  }
  // Fallback: If autoplay was blocked by the browser, play on first interaction.
  // We check audioManager.isMusicPlaying so we don't restart it if it's already playing.
  const startAudioOnInteract = () => {
    if (!audioManager.isMusicPlaying) {
      audioManager.unlock();
      if (isMusicPlaying.value) {
        audioManager.playMusic();
      }
    }
    document.removeEventListener("pointerdown", startAudioOnInteract);
    document.removeEventListener("keydown", startAudioOnInteract);
  };

  document.addEventListener("pointerdown", startAudioOnInteract);
  document.addEventListener("keydown", startAudioOnInteract);

  // Initialize live remote configuration sync from Firebase Firestore
  const setupRemoteConfig = () => {
    activeConfigEnv.value = getActiveConfigEnv();
    if (typeof unsubscribeRemoteConfig === "function") {
      unsubscribeRemoteConfig();
    }
    unsubscribeRemoteConfig = initRemoteConfigSync((updatedData, docName) => {
      console.log(`[App] Live content synchronized from Firestore (${docName}):`, updatedData);
    });
  };
  setupRemoteConfig();
  window.addEventListener("chargeon-env-changed", setupRemoteConfig);

  onUnmounted(() => {
    window.removeEventListener("keydown", handleGlobalKeyDown);
    window.removeEventListener("chargeon-env-changed", setupRemoteConfig);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    cancelAnimationFrame(_uiGamepadFrame);

    if (typeof unsubscribeRemoteConfig === "function") {
      unsubscribeRemoteConfig();
    }

    if (gameEngine) {
      gameEngine.dispose();
    }
  });
});

// --- Flow Actions ---
const handleRegistration = (data) => {
  // Per the plan, Registration submit is the guaranteed audio-unlock point
  // (a real user gesture) -- redundant with the Lobby music toggle's own
  // unlock() call (harmless, unlock() is idempotent) for a visitor who
  // never touches that toggle but still needs working gameplay SFX.
  audioManager.unlock();
  userData.name = data.name;
  userData.company = data.company;
  userData.email = data.email;
  // Compute and assign session ID synchronously immediately so it is never null or stale
  currentSessionId.value = generateSessionId(data.email);
  console.log("CRM WRITE:", userData, "Session ID:", currentSessionId.value);
  // Clear any goodies from a previous game session in this browser
  wonGoodies.value = [];
  hasLostLifeAnyLevel.value = false;
  // Send registration data to Google Sheet (fire-and-forget, non-blocking)
  submitRegistration(userData.name, userData.company, userData.email);
  // Send registration data to Firebase Firestore (dual-sync with exact timestamp)
  createPlayerSession({
    name: userData.name,
    company: userData.company,
    email: userData.email,
  });
  gameState.value = "HOW_TO_PLAY"; // After form submit, go to game
};

const startLevel = () => {
  gameStats.levelFeaturesCollected = 0;
  gameStats.lives = 3;

  // Clean up any features collected from this specific level previously (e.g. from a failed run)
  const currentLevelData = levels.find(
    (l) => l.id === gameStats.currentLevelId,
  );
  if (currentLevelData) {
    const levelFeatureKeys = new Set(
      currentLevelData.features.map((f) => `${f.name}|${f.category}`),
    );
    gameStats.featuresCollected = gameStats.featuresCollected.filter(
      (fc) => !levelFeatureKeys.has(`${fc.name}|${fc.category}`),
    );
  }

  gameEngine.startLevel(gameStats.currentLevelId);
  gameEngine.setMode("PLAYING");
  gameState.value = "PLAYING";
};

const advanceLevel = () => {
  const currentLevelData = levels.find(
    (l) => l.id === gameStats.currentLevelId,
  );
  const wonGoodie = currentLevelData?.goodie || "";
  const wonDiscount = currentLevelData?.discount || "";

  // Track won goodie to prevent duplicates in subsequent levels
  if (wonGoodie) wonGoodies.value.push(wonGoodie);
  // 1. Update the sheet: this level was Passed with the specific goodie won
  updateLevelResult(
    userData.email,
    gameStats.currentLevelId,
    "Passed",
    wonGoodie,
    wonDiscount,
    gameStats.score,
  );
  // 2. Update Firestore: this level was Passed with exact completion timestamp
  const activeSessionId =
    currentSessionId.value || generateSessionId(userData.email);
  recordFirebaseLevelResult(
    activeSessionId,
    gameStats.currentLevelId,
    "Passed",
    wonGoodie,
    wonDiscount,
    gameStats.score,
  );
  if (gameStats.currentLevelId === 3) {
    if (!hasLostLifeAnyLevel.value && gameEngine?.scoreSystem) {
      const bonus = gameEngine.scoreSystem.applyFlawlessBonus();
      gameStats.score = bonus.total;
      addPopup(
        ":star: FLAWLESS RUN BONUS! +300 PTS\nAll 3 Levels Cleared With 0 Lives Lost!",
        "success",
        true,
      );
    }

    saveScoreToLeaderboard();

    // Automatically apply the final main discount
    updateMainDiscount(userData.email);
    recordFirebaseMainDiscount(activeSessionId, "15% OFF");

    gameState.value = "OFFER_REVEAL";
  } else {
    gameStats.currentLevelId++;
    startLevel();
  }
};

const handleOfferRevealNext = () => {
  if (gameEngine) {
    gameEngine.setMode("VICTORY");
  }
  gameState.value = "VICTORY";
};

const handleCharacterSelected = (id) => {
  selectedCharacterId.value = id;
  if (gameEngine && gameEngine.player) {
    gameEngine.player.setCharacter(id);
  }
};

const handleHoverboardSelected = (id) => {
  selectedHoverboardId.value = id;
  if (gameEngine) {
    gameEngine.setHoverboard(id, false);
  }
};

// Shared by GameOver's retry AND PauseMenu's Quit -- both fully abandon the
// current run and return to the Lobby, which is correct for both callers:
// there is no "resume where you left off" concept once back at the Lobby
// (its Start button always leads into a fresh Registration), so leftover
// score/features from an abandoned run would only ever be stale state that
// incorrectly bleeds into the next playthrough if left un-reset.
const quitToLobby = () => {
  isPaused.value = false;
  userData.name = "";
  userData.company = "";
  userData.email = "";
  currentSessionId.value = "";
  wonGoodies.value = [];

  gameStats.lives = 3;
  gameStats.currentLevelId = 1;
  gameStats.featuresCollected = [];
  gameStats.levelFeaturesCollected = 0;
  gameStats.score = 0;
  gameStats.toastFeed = [];
  gameStats.combo = 0;
  hasLostLifeAnyLevel.value = false;
  if (gameEngine) {
    gameEngine.resetRun();
    gameEngine.setMode("LOBBY");
    gameEngine.setHoverboard(selectedHoverboardId.value, false);
    gameEngine.start(); // in case quitting out of an active pause
  }
  gameState.value = "LANDING";
};
</script>

<template>
  <div class="app-container">
    <div id="game-canvas-container"></div>

    <div class="ui-layer">
      <Transition name="wipe" mode="out-in">
        <Landing
          v-if="gameState === 'LANDING'"
          :userData="userData"
          :selectedCharacterId="selectedCharacterId"
          @start="gameState = 'REGISTRATION'"
          @dev-start="startLevel"
          @character-selected="handleCharacterSelected"
        />

        <RegistrationForm
          v-else-if="gameState === 'REGISTRATION'"
          :characterId="selectedCharacterId"
          @cancel="gameState = 'LANDING'"
          @submit="handleRegistration"
        />

        <HowToPlay
          v-else-if="gameState === 'HOW_TO_PLAY'"
          @next="gameState = 'STORY_BEAT'"
        />

        <StoryBeat
          v-else-if="gameState === 'STORY_BEAT'"
          :characterId="selectedCharacterId"
          @next="startLevel"
        />

        <GameHUD
          v-else-if="gameState === 'PLAYING'"
          :stats="gameStats"
          :engine="gameEngine"
          :selectedHoverboardId="selectedHoverboardId"
          @pause="pauseGame"
          @hoverboard-selected="handleHoverboardSelected"
        />

        <LevelComplete
          v-else-if="gameState === 'LEVEL_COMPLETE'"
          :levelId="gameStats.currentLevelId"
          :stats="gameStats"
          :previousGoodies="wonGoodies"
          @next="advanceLevel"
        />

        <GameOver
          v-else-if="gameState === 'GAME_OVER'"
          :stats="gameStats"
          :wonGoodies="wonGoodies"
          @retry="quitToLobby"
        />

        <OfferReveal
          v-else-if="gameState === 'OFFER_REVEAL'"
          @next="handleOfferRevealNext"
        />

        <Victory
          v-else-if="gameState === 'VICTORY'"
          @next="gameState = 'REDEMPTION'"
        />

        <Redemption
          v-else-if="gameState === 'REDEMPTION'"
          :wonGoodies="wonGoodies"
          @restart="quitToLobby"
        />
      </Transition>

      <!-- Overlaid on top of GameHUD (gameState stays 'PLAYING') rather than
           its own state, so the frozen world/HUD stays visible underneath. -->
      <PauseMenu
        v-if="gameState === 'PLAYING' && isPaused"
        @resume="resumeGame"
        @restart-level="restartLevelFromPause"
        @quit="quitToLobby"
      />

      <!-- Hidden Booth Management Modal (Shortcut: Ctrl + Shift + A or Cmd + Shift + A) -->
      <BoothAdminModal />

      <!-- Floating Staging Indicator Badge (Only shown when running in Staging mode) -->
      <div
        v-if="activeConfigEnv === 'staging'"
        class="staging-floating-badge"
        title="Running in Staging Sandbox mode. Live booth games are unaffected."
      >
        <span class="pulse-dot"></span>
        STAGING SANDBOX
      </div>
    </div>
  </div>
</template>

<style scoped>
.staging-floating-badge {
  position: fixed;
  top: 14px;
  right: 14px;
  z-index: 99990;
  background: rgba(234, 179, 8, 0.95);
  color: #0f172a;
  font-family: "Plus Jakarta Sans", sans-serif;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1px;
  padding: 5px 12px;
  border-radius: 20px;
  box-shadow: 0 4px 15px rgba(234, 179, 8, 0.4);
  display: flex;
  align-items: center;
  gap: 6px;
  pointer-events: none;
  text-transform: uppercase;
}

.staging-floating-badge .pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #0f172a;
  animation: pulse-badge 1.5s infinite;
}

@keyframes pulse-badge {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.3; transform: scale(1.3); }
}

.app-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  font-family: "Roboto", sans-serif;
  color: #ffffff;
  touch-action: none;
}

#game-canvas-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}

.ui-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10;
  pointer-events: none;
}
.ui-layer > * {
  pointer-events: auto;
}

/* Shared wipe transition between every screen (Milestone 9) -- clip-path,
   not opacity, so the outgoing screen visually wipes away to reveal
   whatever's behind it (the live 3D canvas, which never stops rendering
   during a Vue transition) rather than just cross-fading over it.
   mode="out-in" means these play sequentially: the old screen wipes
   closed first, THEN the new one wipes in -- both screens' own
   (semi-)transparent backgrounds already let the canvas show through
   during that gap on top of the reveal itself. */
.wipe-enter-active,
.wipe-leave-active {
  transition: clip-path 0.45s cubic-bezier(0.65, 0, 0.35, 1);
}
.wipe-enter-from,
.wipe-leave-to {
  clip-path: inset(0 0 0 100%);
}

/* Global Typography Overrides (Raleway for headings) */
:deep(h1),
:deep(h2),
:deep(h3) {
  font-family: "Raleway", sans-serif;
  margin: 0;
}
</style>
