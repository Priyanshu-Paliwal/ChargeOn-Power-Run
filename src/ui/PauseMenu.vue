<script setup>
import { ref } from "vue";
import HowToPlay from "./HowToPlay.vue";

const emit = defineEmits(["resume", "restart-level", "quit"]);

// 'menu' | 'how-to-play' -- How to Play reuses the exact onboarding
// component/copy rather than inventing new pause-specific text (the content
// script has no dedicated Pause-menu section at all; button labels below
// are the plan's own wording, not sourced from the script -- flagged in
// docs/PROCESS_TRACKER.md for a marketing pass later, same treatment as
// GameOver's copy).
const view = ref("menu");
const countdown = ref(0);
let timer = null;

const startResumeCountdown = () => {
  if (countdown.value > 0) return;
  countdown.value = 3;
  timer = setInterval(() => {
    countdown.value--;
    if (countdown.value === 0) {
      clearInterval(timer);
      emit('resume');
    }
  }, 1000);
};
</script>

<template>
  <div class="pause-overlay">
    <div v-if="view === 'menu' && countdown === 0" class="pause-card">
      <h2>Paused</h2>
      <button class="pause-option primary" @click="startResumeCountdown">Resume</button>
      <button class="pause-option" @click="emit('restart-level')">Restart Level</button>
      <button class="pause-option" @click="view = 'how-to-play'">How to Play</button>
      <button class="pause-option danger" @click="emit('quit')">Quit</button>
    </div>
    
    <div v-else-if="countdown > 0" class="countdown-display">
      {{ countdown }}
    </div>
    <!-- HowToPlay emits 'next' when its own button is pressed -- from Pause
         that just returns to the menu rather than advancing the game flow. -->
    <HowToPlay v-else @next="view = 'menu'" />
  </div>
</template>

<style scoped>
.pause-overlay {
  /* Absolute, not normal flow -- this renders as a SECOND simultaneous
     child of .ui-layer alongside whichever screen the main Transition is
     showing (GameHUD stays mounted underneath, by design). Every other
     top-level screen component only ever appears alone (the v-else-if
     chain + Transition guarantee exclusivity), so relying on a plain
     width/height:100% block to "fill the parent" was never actually tested
     against having a sibling -- two static-flow 100%-height boxes stack
     vertically instead of overlapping, which would push this off-screen
     below the viewport (and out of app-container's overflow:hidden) rather
     than overlaying GameHUD. */
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: rgba(13, 45, 64, 0.85);
  backdrop-filter: blur(10px);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  box-sizing: border-box;
}

.pause-card {
  background: #ffffff;
  padding: 30px;
  border-radius: 16px;
  width: 340px;
  max-width: 100%;
  text-align: center;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  animation: dropIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@keyframes dropIn {
  from { opacity: 0; transform: translateY(-30px) scale(0.9); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.countdown-display {
  font-size: 5rem;
  font-weight: 800;
  color: #ffffff;
  animation: pulse 1s infinite;
  text-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.8; }
  100% { transform: scale(1); opacity: 1; }
}

h2 {
  font-family: "Raleway", sans-serif;
  color: #0d2d40;
  font-size: 1.6rem;
  margin-bottom: 6px;
  letter-spacing: 1px;
}

.pause-option {
  background: #f0f4f8;
  color: #0d2d40;
  border: none;
  padding: 14px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.pause-option:hover {
  background: #e2e8f0;
  transform: translateY(-2px);
}
.pause-option:active {
  transform: translateY(0);
}

.pause-option.primary {
  background: #ffd164;
  color: #0d2d40;
  box-shadow: 0 4px 15px rgba(255, 209, 100, 0.4);
}
.pause-option.primary:hover {
  background: #ffdb99;
  box-shadow: 0 6px 20px rgba(255, 209, 100, 0.6);
}

.pause-option.danger {
  background: transparent;
  color: #e74c3c;
  border: 1px solid rgba(231, 76, 60, 0.3);
}
.pause-option.danger:hover {
  background: rgba(231, 76, 60, 0.08);
}

@media (max-height: 600px) {
  .pause-card {
    padding: 18px;
    gap: 8px;
  }
  .pause-option {
    padding: 10px;
  }
}
</style>
