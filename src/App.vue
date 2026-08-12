<script setup>
import { onMounted, ref, onUnmounted, reactive, provide } from 'vue'
import Landing from './ui/Landing.vue'
import RegistrationForm from './ui/RegistrationForm.vue'
import HowToPlay from './ui/HowToPlay.vue'
import StoryBeat from './ui/StoryBeat.vue'
import LevelIntro from './ui/LevelIntro.vue'
import GameHUD from './ui/GameHUD.vue'
import LevelComplete from './ui/LevelComplete.vue'
import BossBeat from './ui/BossBeat.vue'
import OfferReveal from './ui/OfferReveal.vue'
import Victory from './ui/Victory.vue'
import Redemption from './ui/Redemption.vue'
import GameOver from './ui/GameOver.vue'
import PauseMenu from './ui/PauseMenu.vue'
import IdlePrompt from './ui/IdlePrompt.vue'

import { Engine } from './game/core/Engine.js'
import { levels } from './data/GameContent.js'
import {
  CHARACTERS,
  HIT_VIGNETTE_COLOR,
  HIT_VIGNETTE_INTENSITY,
  POWERUP_VIGNETTE_COLORS,
  POWERUP_VIGNETTE_INTENSITY,
  IDLE_PROMPT_MS,
  IDLE_RESET_MS,
  POWER_UPS,
} from './game/config/GameConfig.js'
import { audioManager } from './game/systems/AudioManager.js'
import { viewportManager } from './game/core/ViewportManager.js'

// --- State Machine ---
// LANDING, REGISTRATION, HOW_TO_PLAY, STORY_BEAT, LEVEL_INTRO, PLAYING, LEVEL_COMPLETE, BOSS_BEAT, OFFER_REVEAL, VICTORY, REDEMPTION
const gameState = ref('LANDING')

// --- Game Data ---
const userData = reactive({ name: '', company: '', email: '' })
// Lives here (not inside Landing/CharacterSelect) because those components
// fully remount every time gameState cycles back to 'LANDING' (e.g. after
// restartGame()) -- App.vue is the one thing that persists for the whole
// session, so it's the only place that can remember a non-default pick
// across a restart instead of CharacterSelect silently resetting to
// CHARACTERS[0] and dragging the live model back with it.
const selectedCharacterId = ref(CHARACTERS[0].id)
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
  combo: 0
})

let gameEngine = null

// --- Music State (Milestone 9: now backed by AudioManager, not a raw
// <audio> element) --- kept the exact same shape (isMusicPlaying/toggleMusic
// via provide/inject) so Landing.vue's existing music toggle button needs
// no changes at all.
const isMusicPlaying = ref(false)
const toggleMusic = () => {
  audioManager.unlock() // any click is a valid gesture -- idempotent even if Registration already unlocked it
  if (isMusicPlaying.value) {
    audioManager.pauseMusic()
    isMusicPlaying.value = false
  } else {
    audioManager.playMusic()
    isMusicPlaying.value = true
  }
}
provide('musicState', { isMusicPlaying, toggleMusic })

// --- Pause (Milestone 8) ---
// A separate flag, not a gameState transition -- GameHUD stays mounted
// underneath PauseMenu (gameState is still 'PLAYING'), which is what lets
// the world/HUD visibly freeze in place behind the menu instead of
// unmounting and losing that frame.
const isPaused = ref(false)
let _musicWasPlayingBeforePause = false

const pauseGame = () => {
  if (gameState.value !== 'PLAYING' || isPaused.value) return
  isPaused.value = true
  gameEngine?.stop() // halts the whole rAF loop -- world, mixer, collision all freeze on this frame
  _musicWasPlayingBeforePause = isMusicPlaying.value
  if (isMusicPlaying.value) toggleMusic()
}

const resumeGame = () => {
  if (!isPaused.value) return
  isPaused.value = false
  gameEngine?.start()
  if (_musicWasPlayingBeforePause && !isMusicPlaying.value) toggleMusic()
}

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
  const currentLevelData = levels.find(l => l.id === gameStats.currentLevelId)
  const levelFeatureNames = new Set(currentLevelData.features.map(f => f.name))
  gameStats.featuresCollected = gameStats.featuresCollected.filter(f => !levelFeatureNames.has(f.name))
  gameStats.levelFeaturesCollected = 0
  gameStats.lives = 3
  gameStats.combo = 0
  if (gameEngine) {
    gameEngine.startLevel(gameStats.currentLevelId)
    gameEngine.setMode('PLAYING')
  }
  resumeGame()
}

// Tabbing away/minimizing mid-run should never silently cost a life to a
// blocker the player couldn't see coming -- auto-pause the instant the tab
// is hidden, same as a manual pause.
const handleVisibilityChange = () => {
  if (document.hidden) pauseGame()
}

// --- Idle timeout (Milestone 9, booth tablet only) ---
// Global, not tied to any one screen -- a visitor can walk away mid-
// Registration just as easily as mid-run. Gated to the tablet size classes
// (the booth device) and never fires on the Lobby itself (already the
// reset state -- see GameConfig.js's IDLE_PROMPT_MS comment).
const showIdlePrompt = ref(false)
let _lastActivityAt = Date.now()
let _idleCheckHandle = null

const isBoothTablet = () => {
  const sizeClass = viewportManager.getState()?.sizeClass
  return sizeClass === 'tablet-portrait' || sizeClass === 'tablet-landscape'
}

const recordActivity = () => {
  _lastActivityAt = Date.now()
  if (showIdlePrompt.value) showIdlePrompt.value = false
}

const checkIdle = () => {
  if (gameState.value === 'LANDING' || !isBoothTablet()) {
    if (showIdlePrompt.value) showIdlePrompt.value = false
    return
  }
  const idleFor = Date.now() - _lastActivityAt
  if (!showIdlePrompt.value && idleFor >= IDLE_PROMPT_MS) {
    showIdlePrompt.value = true
  } else if (showIdlePrompt.value && idleFor >= IDLE_PROMPT_MS + IDLE_RESET_MS) {
    showIdlePrompt.value = false
    quitToLobby()
  }
}

const addPopup = (text, type, isExclusive) => {
  gameStats.toastFeed.push({ id: Date.now() + Math.random(), text, type, isExclusive })
}

const addFlash = (color, intensity = 1) => {
  gameStats.flashFeed.push({ id: Date.now() + Math.random(), color, intensity })
}

const handleCollision = (hit) => {
  if (gameState.value !== 'PLAYING') return
  
  if (hit.type === 'coin') {
    // Score counts every coin grabbed (reflexes), independent of whether it
    // represents new required progress below -- Engine.js's ScoreSystem
    // already computed the running total.
    gameStats.score = hit.score
    gameStats.combo++

    // Find the next sequential uncollected feature for this level
    const currentLevelData = levels.find(l => l.id === gameStats.currentLevelId)
    const nextFeature = currentLevelData.features.find(f => !gameStats.featuresCollected.some(fc => fc.name === f.name))

    if (nextFeature) {
      // Overwrite the hit data with the sequential feature so no features are ever skipped
      hit.name = nextFeature.name
      hit.category = nextFeature.category
      hit.isExclusive = nextFeature.isExclusive || false
      hit.exclusiveLine = nextFeature.exclusiveLine || null
      
      const powerUpDef = POWER_UPS[hit.name]
      if (powerUpDef) {
        hit.powerUp = powerUpDef.type
      } else {
        delete hit.powerUp
      }

      gameStats.featuresCollected.push(hit)
      gameStats.levelFeaturesCollected++

      // Per-feature exclusiveLine (Milestone 9, sourced from the content
      // script) replaces the old generic "★ Exclusive to ChargeOn!" line --
      // every exclusive feature gets its own specific celebration line
      // instead of the same boilerplate 20 times over. Falls back to the
      // generic line only if a feature is flagged exclusive but somehow has
      // no line authored (shouldn't happen -- GameContent.js's exclusives
      // all have one -- but a missing line silently showing NO celebration
      // text at all would be worse than the old generic fallback).
      let text = hit.isExclusive
        ? `Yay! ${hit.name}!\n★ ${hit.exclusiveLine || 'Exclusive to ChargeOn!'}`
        : `Yay! ${hit.name}!`
      if (hit.powerUp === 'magnet') text += `\n🧲 Magnet active!`
      else if (hit.powerUp === 'shield') text += `\n🛡️ Shield up!`
      addPopup(text, 'success', hit.isExclusive)
      if (hit.powerUp && POWERUP_VIGNETTE_COLORS[hit.powerUp]) {
        addFlash(POWERUP_VIGNETTE_COLORS[hit.powerUp], POWERUP_VIGNETTE_INTENSITY)
      }

      if (gameStats.levelFeaturesCollected >= currentLevelData.requiredCount) {
        completeLevel()
      }
    }
  } else if (hit.type === 'nearmiss') {
    // Deliberately quiet feedback -- score bump + whoosh (Engine.js) only,
    // no toast. A close call can happen often over a run; a popup for each
    // one would clutter the toast queue for something the plan itself
    // calls "subtle."
    gameStats.score = hit.score
  } else if (hit.type === 'shielded') {
    // Shield absorbed the hit -- no life lost, no game-over check. Still
    // breaks the combo: getting hit at all means a dodge was missed, shield
    // or not.
    gameStats.combo = 0
    addPopup(`🛡️ Shield absorbed it! ${hit.text}`, 'success', false)
  } else if (hit.type === 'blocker') {
    gameStats.combo = 0
    addPopup(`Oops! ${hit.text} — ${hit.consequence}`, 'error', false)
    addFlash(HIT_VIGNETTE_COLOR, HIT_VIGNETTE_INTENSITY)
    // Interactive tutorial (Milestone 9): a miss on one of the 3 seeded
    // practice obstacles still shows the full normal feedback above (so
    // the cause-and-effect actually teaches something) but never costs a
    // life or can end the run -- it's a first-ever-controls practice
    // window, not a fair test yet.
    if (hit.isTutorial) return
    gameStats.lives--
    if (gameStats.lives <= 0) {
      // Save score to LocalStorage
      const name = userData.name || 'Anonymous'
      // Generate a mock time based on features collected (1 feature = 5 seconds deduction from a base time, or just format the collected count as time)
      const seconds = Math.max(30, 120 - gameStats.featuresCollected.length * 5)
      const mm = Math.floor(seconds / 60).toString().padStart(2, '0')
      const ss = (seconds % 60).toString().padStart(2, '0')
      const timeStr = `${mm}:${ss}`

      const stored = localStorage.getItem('chargeon_leaderboard')
      let leaderboard = stored ? JSON.parse(stored) : []
      leaderboard.push({ name, score: timeStr })
      leaderboard.sort((a, b) => a.score.localeCompare(b.score))
      leaderboard = leaderboard.slice(0, 5)
      localStorage.setItem('chargeon_leaderboard', JSON.stringify(leaderboard))

      gameState.value = 'GAME_OVER'
      gameEngine.setMode('LOBBY') // Stop running animation
      audioManager.duck(0.2, 1200)
      audioManager.playSFX('gameOver')
    }
  }
}

const completeLevel = () => {
  if (gameEngine) gameEngine.setMode('LOBBY')
  audioManager.duck(0.2, 1200)
  audioManager.playSFX('levelComplete')
  gameState.value = 'LEVEL_COMPLETE'
}

onMounted(() => {
  const container = document.getElementById('game-canvas-container')
  if (container) {
    gameEngine = new Engine(container, handleCollision)
    gameEngine.start()
  }
  document.addEventListener('visibilitychange', handleVisibilityChange)
  document.addEventListener('pointerdown', recordActivity)
  document.addEventListener('keydown', recordActivity)
  _idleCheckHandle = setInterval(checkIdle, 1000)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  document.removeEventListener('pointerdown', recordActivity)
  document.removeEventListener('keydown', recordActivity)
  clearInterval(_idleCheckHandle)
  if (gameEngine) {
    gameEngine.dispose()
  }
})

// --- Flow Actions ---
const handleRegistration = (data) => {
  // Per the plan, Registration submit is the guaranteed audio-unlock point
  // (a real user gesture) -- redundant with the Lobby music toggle's own
  // unlock() call (harmless, unlock() is idempotent) for a visitor who
  // never touches that toggle but still needs working gameplay SFX.
  audioManager.unlock()
  userData.name = data.name
  userData.company = data.company
  userData.email = data.email
  console.log('CRM WRITE:', userData)
  gameState.value = 'HOW_TO_PLAY' // After form submit, go to game
}

const startLevel = () => {
  gameStats.levelFeaturesCollected = 0
  gameStats.lives = 3
  gameEngine.startLevel(gameStats.currentLevelId)
  gameEngine.setMode('PLAYING')
  gameState.value = 'PLAYING'
}

const advanceLevel = () => {
  if (gameStats.currentLevelId === 3) {
    gameState.value = 'BOSS_BEAT'
  } else {
    gameStats.currentLevelId++
    gameState.value = 'LEVEL_INTRO'
  }
}

const handleCharacterSelected = (id) => {
  selectedCharacterId.value = id
  if (gameEngine && gameEngine.player) {
    gameEngine.player.setCharacter(id)
  }
}

// Shared by GameOver's retry AND PauseMenu's Quit -- both fully abandon the
// current run and return to the Lobby, which is correct for both callers:
// there is no "resume where you left off" concept once back at the Lobby
// (its Start button always leads into a fresh Registration), so leftover
// score/features from an abandoned run would only ever be stale state that
// incorrectly bleeds into the next playthrough if left un-reset.
const quitToLobby = () => {
  isPaused.value = false
  gameStats.lives = 3
  gameStats.currentLevelId = 1
  gameStats.featuresCollected = []
  gameStats.levelFeaturesCollected = 0
  gameStats.score = 0
  gameStats.toastFeed = []
  gameStats.combo = 0
  if (gameEngine) {
    gameEngine.resetRun()
    gameEngine.setMode('LOBBY')
    gameEngine.start() // in case quitting out of an active pause
  }
  gameState.value = 'LANDING'
}
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
          @character-selected="handleCharacterSelected"
        />
        
        <RegistrationForm 
          v-else-if="gameState === 'REGISTRATION'" 
          @cancel="gameState = 'LANDING'"
          @submit="handleRegistration"
        />

        <HowToPlay v-else-if="gameState === 'HOW_TO_PLAY'" @next="gameState = 'STORY_BEAT'" />
        
        <StoryBeat v-else-if="gameState === 'STORY_BEAT'" @next="gameState = 'LEVEL_INTRO'" />
        
        <LevelIntro 
          v-else-if="gameState === 'LEVEL_INTRO'" 
          :levelId="gameStats.currentLevelId" 
          @start="startLevel" 
        />
        
        <GameHUD
          v-else-if="gameState === 'PLAYING'"
          :stats="gameStats"
          :engine="gameEngine"
          @pause="pauseGame"
        />

        <LevelComplete
          v-else-if="gameState === 'LEVEL_COMPLETE'"
          :levelId="gameStats.currentLevelId"
          @next="advanceLevel"
        />

        <GameOver
          v-else-if="gameState === 'GAME_OVER'"
          :stats="gameStats"
          @retry="quitToLobby"
        />

        <BossBeat v-else-if="gameState === 'BOSS_BEAT'" @next="gameState = 'OFFER_REVEAL'" />

        <OfferReveal v-else-if="gameState === 'OFFER_REVEAL'" @next="gameState = 'VICTORY'" />

        <Victory v-else-if="gameState === 'VICTORY'" @next="gameState = 'REDEMPTION'" />

        <Redemption v-else-if="gameState === 'REDEMPTION'" />
      </Transition>

      <!-- Overlaid on top of GameHUD (gameState stays 'PLAYING') rather than
           its own state, so the frozen world/HUD stays visible underneath. -->
      <PauseMenu
        v-if="gameState === 'PLAYING' && isPaused"
        @resume="resumeGame"
        @restart-level="restartLevelFromPause"
        @quit="quitToLobby"
      />

      <IdlePrompt v-if="showIdlePrompt" @dismiss="recordActivity" />
    </div>
  </div>
</template>

<style scoped>
.app-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  font-family: 'Roboto', sans-serif;
  color: #FFFFFF;
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
:deep(h1), :deep(h2), :deep(h3) {
  font-family: 'Raleway', sans-serif;
  margin: 0;
}
</style>
