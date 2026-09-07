<script setup>
import { computed, ref } from "vue";
import { levels } from "../data/GameContent.js";

const props = defineProps({
  levelId: Number,
});

const emit = defineEmits(["start"]);

const levelData = computed(() => levels.find((l) => l.id === props.levelId));

const countdown = ref(0);
const isCountingDown = ref(false);
let timer = null;

const startCountdown = () => {
  if (props.levelId === 1) {
    emit("start");
    return;
  }

  if (isCountingDown.value) return;
  isCountingDown.value = true;
  countdown.value = 3;

  timer = setInterval(() => {
    countdown.value--;
    if (countdown.value === 0) {
      clearInterval(timer);
      emit("start");
    }
  }, 1000);
};
</script>

<template>
  <div class="overlay" :class="{ 'transparent-overlay': isCountingDown }">
    <div v-if="!isCountingDown" class="card">
      <svg class="icon-header" viewBox="0 0 24 24" width="56" height="56" style="margin: 0 auto 10px; filter: drop-shadow(0 0 15px rgba(244,199,117,0.6));">
        <path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z" fill="none" stroke="#F4C775" stroke-width="2" stroke-linejoin="round"/>
      </svg>
      <h2>{{ levelData.title }}</h2>
      <p class="target">{{ levelData.subtext }}</p>

      <div class="stats">
        <div>{{ levelData.speedTag }}</div>
      </div>

      <button class="btn-primary" @click="startCountdown">
        Start Level {{ levelData.id }}
        <svg class="btn-icon" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      </button>
    </div>

    <div v-else-if="countdown > 0" class="countdown-display">
      {{ countdown }}
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed !important;
  z-index: 9999 !important;
  transform: translateZ(0);
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(4, 20, 40, 0.65);
  backdrop-filter: blur(15px) !important;
  -webkit-backdrop-filter: blur(15px) !important;
  transition: all 0.3s ease;
}
.overlay.transparent-overlay {
  background: transparent;
  backdrop-filter: none;
}
.card {
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
  text-align: center;
  color: #fff;
  width: 400px;
  max-width: 90%;
}
.level-badge {
  background: #f4c775;
  color: #042c53;
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: 10px;
}
h2 {
  font-family: "Goldman", sans-serif;
  font-size: 1.6rem;
  font-weight: 600;
  margin-bottom: 8px;
  color: #fff;
}
.target {
  font-family: "Poppins", sans-serif;
  font-size: 0.95rem;
  color: #fff;
  margin-bottom: 15px;
}
.stats {
  font-family: "Poppins", sans-serif;
  background: rgba(255, 255, 255, 0.1);
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 15px;
  text-align: left;
  font-size: 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
}
.stats span {
  font-weight: 600;
  color: #f4c775;
}
.btn-primary {
  background: linear-gradient(180deg, #6fa6e0 0%, #1561b1 100%);
  color: #fff;
  border: none;
  padding: 12px 25px;
  border-radius: 8px;
  font-family: "Goldman", sans-serif;
  font-weight: 400;
  font-size: 1.05rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  cursor: pointer;
  width: 100%;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.btn-primary:hover {
  background: linear-gradient(180deg, #81b4e9 0%, #1a71cd 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
}
.btn-primary:active {
  transform: translateY(0);
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

@media (max-width: 1024px) {
  .card {
    padding: 15px;
  }
}

@media (max-width: 600px) {
  .card {
    min-width: auto;
    width: 90%;
    padding: 15px;
  }
  h2 {
    font-size: 1.4rem;
  }
}
</style>

