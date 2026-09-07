<script setup>
import { ref } from "vue";

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
      emit("resume");
    }
  }, 1000);
};
</script>

<template>
  <div class="pause-overlay">
    <div v-if="view === 'menu' && countdown === 0" class="pause-card">
      <svg class="icon-header" viewBox="0 0 24 24" width="48" height="48" style="margin: 0 auto; drop-shadow(0 0 10px rgba(244,199,117,0.5));">
        <rect x="6" y="4" width="4" height="16" fill="#F4C775" rx="1" />
        <rect x="14" y="4" width="4" height="16" fill="#F4C775" rx="1" />
      </svg>
      <h2>Paused</h2>
      <button class="pause-option primary" @click="startResumeCountdown">
        <svg class="btn-icon" viewBox="0 0 24 24" width="20" height="20">
          <polygon points="6,4 19,12 6,20" fill="currentColor" />
        </svg>
        Resume
      </button>
      <button class="pause-option danger" @click="emit('quit')">
        <svg class="btn-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Quit
      </button>
    </div>

    <div v-else-if="countdown > 0" class="countdown-display">
      {{ countdown }}
    </div>
  </div>
</template>

<style scoped>
.pause-overlay {
  position: fixed !important;
  z-index: 9999 !important;
  transform: translateZ(0);
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
  background: rgba(4, 20, 40, 0.65);
  backdrop-filter: blur(15px) !important;
  -webkit-backdrop-filter: blur(15px) !important;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  box-sizing: border-box;
}

.pause-card {
  background: linear-gradient(
    135deg,
    rgb(0 0 0 / 50%) 0%,
    rgb(0 0 0 / 5%) 100%
  );
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow:
    0px 4px 45px 0px rgba(0, 0, 0, 0.45),
    inset 0 1px 2px rgb(0 0 0 / 50%);
  padding: 30px;
  border-radius: 12px;
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
  from {
    opacity: 0;
    transform: translateY(-30px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.countdown-display {
  font-size: 5rem;
  font-weight: 800;
  color: #ffffff;
  animation: pulse 1s infinite;
  text-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
}

@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

h2 {
  font-family: "Goldman", sans-serif;
  color: #fff;
  font-size: 1.6rem;
  margin-bottom: 6px;
  letter-spacing: 1px;
}

.pause-option {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 14px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.pause-option:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}
.pause-option:active {
  transform: translateY(0);
}

.pause-option.primary {
  background: linear-gradient(180deg, #6fa6e0 0%, #1561b1 100%);
  color: #fff;
  border: none;
  font-family: "Goldman", sans-serif;
  font-weight: 400;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}
.pause-option.primary:hover {
  background: linear-gradient(180deg, #81b4e9 0%, #1a71cd 100%);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
}

.pause-option.danger {
  background: transparent;
  color: #ff6b6b;
  border: 1px solid rgba(255, 107, 107, 0.4);
}
.pause-option.danger:hover {
  background: rgba(255, 107, 107, 0.15);
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

