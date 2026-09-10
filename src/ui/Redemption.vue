<script setup>
import { onMounted, onUnmounted, computed } from "vue";

const props = defineProps({
  wonGoodies: {
    type: Array,
    default: () => [],
  },
});

const wonGoodies = computed(() => {
  return [...new Set(props.wonGoodies || [])];
});

const emit = defineEmits(["restart"]);

const resetGame = () => {
  emit("restart");
};

const handleKeyDown = (e) => {
  if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
    resetGame();
    e.preventDefault();
  }
};

onMounted(() => {
  window.addEventListener("keydown", handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown);
});
</script>

<template>
  <div class="overlay">
    <div class="card">
      <svg class="icon-header" viewBox="0 0 24 24" width="56" height="56">
        <path
          d="M12 2L15 9L22 9L16 14L18 21L12 17L6 21L8 14L2 9L9 9L12 2Z"
          fill="none"
          stroke="#FACC15"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <circle cx="12" cy="12" r="3" fill="#FACC15" />
      </svg>
      <h2 class="title-main">SHOW THIS TO OUR TEAM</h2>
      <p class="subtitle">Here's what you earned:</p>

      <div class="goodies-list">
        <p v-for="(goodie, idx) in wonGoodies" :key="idx" class="goodie-item">
          {{ goodie }}
        </p>
        <p v-if="wonGoodies.length === 0" class="goodie-item">
          No prizes earned.
        </p>
      </div>

      <p class="footer-note">
        Ask about your 15% offer. Our team can tell you more.
      </p>

      <button class="btn-primary" @click="resetGame">
        <svg
          class="btn-icon"
          viewBox="0 0 24 24"
          width="20"
          height="20"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          fill="none"
        >
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2-2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        RETURN TO START
      </button>
    </div>
  </div>
</template>

<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700;800;900&display=swap");

.overlay {
  position: fixed !important;
  z-index: 9999 !important;
  transform: translateZ(0);
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgb(0 0 0 / 65%);
  backdrop-filter: blur(20px) !important;
  -webkit-backdrop-filter: blur(20px) !important;
  font-family: "Plus Jakarta Sans", sans-serif;
}

.card {
  background: rgba(12, 16, 25, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0px 4px 45px 0px rgba(0, 0, 0, 0.45);
  padding: 35px 30px;
  border-radius: 16px;
  text-align: center;
  color: #fff;
  width: 440px;
  max-width: 90%;
  animation: floatIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  display: flex;
  flex-direction: column;
  align-items: center;
}

@keyframes floatIn {
  0% {
    opacity: 0;
    transform: translateY(30px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.icon-header {
  margin: 0 auto 15px;
  filter: drop-shadow(0 0 10px rgba(250, 204, 21, 0.3));
}

.title-main {
  font-family: "Plus Jakarta Sans", sans-serif;
  font-size: 24px;
  font-weight: 900;
  margin-top: 0;
  margin-bottom: 5px;
  letter-spacing: 0.65px;
  color: #facc15;
  text-transform: uppercase;
  line-height: 1.3;
}

.subtitle {
  font-family: "Plus Jakarta Sans", sans-serif;
  font-weight: 500;
  font-size: 14px;
  line-height: 20px;
  text-align: center;
  color: #cbd5e1;
  margin-bottom: 20px;
}

.goodies-list {
  background: rgba(8, 13, 22, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 15px 20px;
  border-radius: 12px;
  margin-bottom: 25px;
  text-align: left;
  width: 100%;
}

.goodie-item {
  font-family: "Plus Jakarta Sans", sans-serif;
  font-weight: 700;
  font-size: 15px;
  color: #ffffff;
  margin: 0;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.goodie-item:first-child {
  padding-top: 5px;
}

.goodie-item:last-child {
  border-bottom: none;
  padding-bottom: 5px;
}

.footer-note {
  font-family: "Plus Jakarta Sans", sans-serif;
  font-weight: 700;
  color: #ffffff;
  font-size: 13px;
  margin-top: 0;
  margin-bottom: 25px;
}

.btn-primary {
  width: 100%;
  height: 54px;
  border-radius: 12px;
  background: linear-gradient(90deg, #2563eb 0%, #3b82f6 50%, #2563eb 100%);
  border: 1px solid rgba(147, 197, 253, 0.3);
  box-shadow:
    inset 0px 1px 0px 1px rgba(255, 255, 255, 0.3),
    0px 4px 20px 0px rgba(37, 99, 235, 0.45);
  color: #fff;
  font-family: "Plus Jakarta Sans", sans-serif;
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 0.5px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 50%, #3b82f6 100%);
  transform: translateY(-2px);
}

.btn-primary:active {
  transform: translateY(0);
}
</style>
