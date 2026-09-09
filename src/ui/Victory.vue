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
      <svg
        class="icon-header"
        viewBox="0 0 24 24"
        width="56"
        height="56"
        style="
          margin: 0 auto 10px;
          filter: drop-shadow(0 0 15px rgba(244, 199, 117, 0.6));
        "
      >
        <path
          d="M8 21h8m-4-4v4m-5.4-8.6C3.9 11.2 3 9.7 3 8c0-3 2-4 2-4h14s2 1 2 4c0 1.7-.9 3.2-2.6 4.4M12 17c3 0 6-2 6-5V4H6v8c0 3 3 5 6 5z"
          fill="none"
          stroke="#F4C775"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <h2 class="text-navy">Run Complete.</h2>
      <p class="subtitle">54 / 54 features collected.</p>

      <div class="reinforce-box">
        <p>100% Salesforce-native.</p>
        <p>PCI-DSS compliant.</p>
        <p>Live in 40+ countries.</p>
        <p>Powered by Agentforce.</p>
      </div>

      <button class="btn-primary" @click="emit('next')">
        Claim My Prizes
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
.overlay {
  position: fixed !important;
  z-index: 9999 !important;
  transform: translateZ(0);
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgb(0 0 0 / 55%);
  backdrop-filter: blur(15px) !important;
  -webkit-backdrop-filter: blur(15px) !important;
  font-family: "Poppins", sans-serif;
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
  padding: 25px;
  border-radius: 12px;
  text-align: center;
  color: #fff;
  width: 400px;
  max-width: 90%;
}
h2 {
  font-family: "Goldman", sans-serif;
  font-size: 1.8rem;
  font-weight: 600;
  margin-bottom: 5px;
  color: #f4c775;
}
.subtitle {
  font-size: 1rem;
  color: #ccc;
  margin-bottom: 15px;
}
.reinforce-box {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
  text-align: left;
}
.reinforce-box p {
  font-weight: 600;
  margin: 5px 0;
  color: #fff;
  font-size: 0.95rem;
}
.reinforce-box p::before {
  content: "✓ ";
  color: #f4c775;
  font-weight: bold;
}
.btn-primary {
  background: linear-gradient(180deg, #6fa6e0 0%, #1561b1 100%);
  color: #fff;
  border: none;
  padding: 12px 25px;
  border-radius: 8px;
  font-family: "Goldman", sans-serif;
  font-weight: 400;
  font-size: 1.2rem;
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
    font-size: 1.5rem;
  }
  .subtitle {
    font-size: 0.9rem;
  }
  .btn-primary {
    font-size: 1rem;
    padding: 10px;
  }
}
</style>
