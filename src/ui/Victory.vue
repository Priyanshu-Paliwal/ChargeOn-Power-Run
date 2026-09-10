<script setup>
import { onMounted, onUnmounted } from "vue";
const emit = defineEmits(["next"]);

const handleKeyDown = (e) => {
  if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
    emit("next");
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
          d="M8 21h8m-4-4v4m-5.4-8.6C3.9 11.2 3 9.7 3 8c0-3 2-4 2-4h14s2 1 2 4c0 1.7-.9 3.2-2.6 4.4M12 17c3 0 6-2 6-5V4H6v8c0 3 3 5 6 5z"
          fill="none"
          stroke="#FACC15"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <h2 class="title-main">RUN COMPLETE.</h2>
      <p class="subtitle">54 / 54 features collected.</p>

      <div class="reinforce-box">
        <p>100% Salesforce-native.</p>
        <p>PCI-DSS compliant.</p>
        <p>Live in 40+ countries.</p>
        <p>Powered by Agentforce.</p>
      </div>

      <button class="btn-primary" @click="emit('next')">
        CLAIM MY PRIZES
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
          <polygon
            points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"
          />
        </svg>
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
  margin: 0 auto 10px;
  filter: drop-shadow(0 0 10px rgba(250, 204, 21, 0.3));
}

.title-main {
  font-family: "Plus Jakarta Sans", sans-serif;
  font-size: 26px;
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

.reinforce-box {
  background: rgba(8, 13, 22, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 25px;
  text-align: left;
  width: 100%;
}

.reinforce-box p {
  font-family: "Plus Jakarta Sans", sans-serif;
  font-weight: 700;
  margin: 8px 0;
  color: #ffffff;
  font-size: 14px;
  display: flex;
  align-items: center;
}

.reinforce-box p::before {
  content: "✓";
  color: #facc15;
  font-weight: 900;
  margin-right: 8px;
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
