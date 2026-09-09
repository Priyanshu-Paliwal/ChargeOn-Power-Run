<script setup>
import { onMounted, ref, computed, onUnmounted } from "vue";
import { CHARACTERS } from "../game/config/GameConfig.js";

const props = defineProps({
  characterId: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits(["next"]);

const characterImage = computed(() => {
  const char = CHARACTERS.find((c) => c.id === props.characterId);
  return char?.images?.story || "/img/1-1-1-game.png";
});

const isCountingDown = ref(false);
const countdown = ref(0);
let timer = null;

const handleSkip = () => {
  if (isCountingDown.value) return;
  isCountingDown.value = true;
  countdown.value = 3;

  timer = setInterval(() => {
    countdown.value--;
    if (countdown.value === 0) {
      clearInterval(timer);
      emit("next");
    }
  }, 1000);
};

const handleKeyDown = (e) => {
  if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
    handleSkip();
    e.preventDefault();
  }
};

onMounted(() => {
  window.addEventListener("keydown", handleKeyDown);
  // Automatically trigger skip after 10 seconds
  setTimeout(() => handleSkip(), 10000);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown);
  if (timer) clearInterval(timer);
});
</script>

<template>
  <div class="overlay" :class="{ 'transparent-overlay': isCountingDown }">
    <div v-if="!isCountingDown" class="content-wrapper">
      <img :src="characterImage" alt="Character" class="story-character-img" />

      <div class="story-card">
        <h2>
          Somewhere, <span class="highlight">a payment just failed!!!</span>
        </h2>
        <p>A reconciliation report just got messier. Time to Fix this.</p>

        <div class="btn-container">
          <button class="skip-btn" @click="handleSkip">Skip &rarr;</button>
        </div>
      </div>
    </div>

    <div v-else-if="countdown > 0" class="countdown-display">
      {{ countdown }}
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: relative;
  width: 100%;
  height: 100%;
  /* Top shadow only */
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.8) 0%,
    rgba(0, 0, 0, 0) 30%
  );
  pointer-events: auto;
  transition: background 0.3s ease;
  overflow: hidden; /* Prevent scrolling */
}

.transparent-overlay {
  background: transparent;
}

.content-wrapper {
  position: absolute;
  width: 100%;
  height: 100%;
  bottom: 0;
  left: 0;
}

.story-character-img {
  position: absolute;
  left: 0;
  bottom: 0px;
  height: auto;
  width: 42%;
  z-index: 10;
  pointer-events: none;
}

.story-card {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 60%;
  height: 26%;
  border: 4px solid transparent;
  border-bottom: 0;
  border-right: 0;
  border-top-left-radius: 20px;
  background:
    linear-gradient(98.38deg, #3b7394 0.1%, #133f59 57.82%) padding-box,
    linear-gradient(98.04deg, #ffd164 0.49%, #f6dfa9 28.85%, #ffe4a3 57.21%)
      border-box;
  padding: 30px;
  z-index: 11;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.story-card h2 {
  font-family: "Goldman", sans-serif;
  font-weight: 400;
  font-size: 36px;
  line-height: 1.2;
  color: #fff;
  margin: 0 0 20px 0;
  text-transform: none;
}

.story-card .highlight {
  color: #ffe4a3;
}

.story-card p {
  font-family: "Poppins", sans-serif;
  font-weight: 400;
  font-size: 24px;
  line-height: 1.3;
  color: #fff;
  margin: 0 0 20px 0;
}

.btn-container {
  display: flex;
  justify-content: flex-end;
  width: 100%;
}

.skip-btn {
  background: rgba(19, 46, 62, 1);
  border: 1px solid rgba(147, 215, 255, 1);
  border-radius: 12px;
  padding: 8px 30px;
  color: #fff;
  font-family: "Goldman", sans-serif;
  font-weight: 400;
  font-size: 24px;
  line-height: 100%;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 10px;
}

.skip-btn:hover {
  background: rgba(29, 66, 92, 1);
  transform: translateY(-2px);
}

.countdown-display {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 8rem;
  font-family: "Goldman", sans-serif;
  font-weight: 800;
  color: #ffffff;
  animation: pulse 1s infinite;
  text-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
  z-index: 20;
}

@keyframes pulse {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.1);
    opacity: 0.8;
  }
  100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
}

@media (max-width: 1024px) {
  .story-card h2 {
    font-size: 32px;
  }
  .story-card p {
    font-size: 22px;
  }
  .story-character-img {
    width: 50%;
    height: 80%;
  }
  .story-card {
    width: 75%;
    padding: 30px;
  }
  .skip-btn {
    font-size: 22px;
    padding: 10px 25px;
  }
}

@media (max-width: 768px) {
  .story-character-img {
    position: absolute;
    width: 60%;
    left: -10%;
    height: 60%;
  }
  .story-card {
    width: 90%;
    height: 40%;
    padding: 25px;
    border-width: 6px 0 0 6px;
  }
}
</style>
