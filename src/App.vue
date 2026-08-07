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

import { Engine } from './game/core/Engine.js'
import { levels } from './data/GameContent.js'

// --- State Machine ---
// LANDING, REGISTRATION, HOW_TO_PLAY, STORY_BEAT, LEVEL_INTRO, PLAYING, LEVEL_COMPLETE, BOSS_BEAT, OFFER_REVEAL, VICTORY, REDEMPTION
const gameState = ref('LANDING') 

// --- Game Data ---
const userData = reactive({ name: '', company: '', email: '' })
const gameStats = reactive({
  lives: 3,
  currentLevelId: 1,
  featuresCollected: [],
  levelFeaturesCollected: 0,
  score: 0,
  popups: []
})

let gameEngine = null

// --- Music State ---
const isMusicPlaying = ref(false)
const toggleMusic = () => {
  const audio = document.getElementById('bgMusic')
  if (!audio) return
  if (isMusicPlaying.value) {
    audio.pause()
    isMusicPlaying.value = false
  } else {
    audio.play().then(() => {
      isMusicPlaying.value = true
    }).catch(e => console.log("Audio play failed", e))
  }
}
provide('musicState', { isMusicPlaying, toggleMusic })

const addPopup = (text, type, isExclusive) => {
  const id = Date.now() + Math.random()
  gameStats.popups.push({ id, text, type, isExclusive })
  setTimeout(() => {
    gameStats.popups = gameStats.popups.filter(p => p.id !== id)
  }, 2000)
}

const handleCollision = (hit) => {
  if (gameState.value !== 'PLAYING') return
  
  if (hit.type === 'coin') {
    // Score counts every coin grabbed (reflexes), independent of whether it
    // represents new required progress below -- Engine.js's ScoreSystem
    // already computed the running total.
    gameStats.score = hit.score

    if (!gameStats.featuresCollected.some(f => f.name === hit.name)) {
      gameStats.featuresCollected.push(hit)
      gameStats.levelFeaturesCollected++

      let text = hit.isExclusive ? `Yay! ${hit.name}!\n★ Exclusive to ChargeOn!` : `Yay! ${hit.name}!`
      if (hit.powerUp === 'magnet') text += `\n🧲 Magnet active!`
      else if (hit.powerUp === 'shield') text += `\n🛡️ Shield up!`
      addPopup(text, 'success', hit.isExclusive)

      const currentLevelData = levels.find(l => l.id === gameStats.currentLevelId)
      if (gameStats.levelFeaturesCollected >= currentLevelData.requiredCount) {
        completeLevel()
      }
    }
  } else if (hit.type === 'shielded') {
    // Shield absorbed the hit -- no life lost, no game-over check. Reuses
    // the same popup mechanism as everything else (still hidden by the
    // pre-existing success-popup display bug GameHUD.vue has -- Milestone 8
    // fixes that for every popup type at once, not just this one).
    addPopup(`🛡️ Shield absorbed it! ${hit.text}`, 'success', false)
  } else if (hit.type === 'blocker') {
    addPopup(`Oops! ${hit.text} — ${hit.consequence}`, 'error', false)
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
    }
  }
}

const completeLevel = () => {
  if (gameEngine) gameEngine.setMode('LOBBY')
  gameState.value = 'LEVEL_COMPLETE'
}

onMounted(() => {
  const container = document.getElementById('game-canvas-container')
  if (container) {
    gameEngine = new Engine(container, handleCollision)
    gameEngine.start()
  }
})

onUnmounted(() => {
  if (gameEngine) {
    gameEngine.dispose()
  }
})

// --- Flow Actions ---
const handleRegistration = (data) => {
  userData.name = data.name
  userData.company = data.company
  userData.email = data.email
  console.log('CRM WRITE:', userData)
  gameState.value = 'HOW_TO_PLAY' // After form submit, go to game
}

const startLevel = () => {
  gameStats.levelFeaturesCollected = 0
  gameEngine.world.setLevel(gameStats.currentLevelId)
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
  if (gameEngine && gameEngine.player) {
    gameEngine.player.setCharacterVariant(id)
  }
}

const restartGame = () => {
  gameStats.lives = 3
  gameStats.currentLevelId = 1
  gameStats.featuresCollected = []
  gameStats.levelFeaturesCollected = 0
  gameStats.score = 0
  if (gameEngine) gameEngine.resetRun()
  gameState.value = 'LANDING'
}
</script>

<template>
  <div class="app-container">
    <audio id="bgMusic" loop src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3"></audio>
    <div id="game-canvas-container"></div>
    
    <div class="ui-layer">
      <Transition name="fade" mode="out-in">
        <Landing 
          v-if="gameState === 'LANDING'" 
          :userData="userData"
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
        />
        
        <LevelComplete 
          v-else-if="gameState === 'LEVEL_COMPLETE'" 
          :levelId="gameStats.currentLevelId"
          @next="advanceLevel" 
        />
        
        <GameOver
          v-else-if="gameState === 'GAME_OVER'"
          @retry="restartGame"
        />
        
        <BossBeat v-else-if="gameState === 'BOSS_BEAT'" @next="gameState = 'OFFER_REVEAL'" />
        
        <OfferReveal v-else-if="gameState === 'OFFER_REVEAL'" @next="gameState = 'VICTORY'" />
        
        <Victory v-else-if="gameState === 'VICTORY'" @next="gameState = 'REDEMPTION'" />
        
        <Redemption v-else-if="gameState === 'REDEMPTION'" />
      </Transition>
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

/* Base Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Global Typography Overrides (Raleway for headings) */
:deep(h1), :deep(h2), :deep(h3) {
  font-family: 'Raleway', sans-serif;
  margin: 0;
}
</style>
