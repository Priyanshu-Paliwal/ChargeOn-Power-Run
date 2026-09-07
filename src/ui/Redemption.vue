<script setup>
import { onMounted, ref } from "vue";

const wonGoodies = ref([]);

onMounted(() => {
  const stored = localStorage.getItem("chargeon_won_goodies");
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Remove duplicates that happen on dev reloads or level retries
      wonGoodies.value = [...new Set(parsed)];
    } catch (e) {}
  }
});

const resetGame = () => {
  localStorage.removeItem("chargeon_won_goodies"); // Reset for next player
  window.location.reload();
};
</script>

<template>
  <div class="overlay">
    <div class="card">
      <svg class="icon-header" viewBox="0 0 24 24" width="56" height="56" style="margin: 0 auto 10px; filter: drop-shadow(0 0 15px rgba(244,199,117,0.6));">
        <path d="M12 2L15 9L22 9L16 14L18 21L12 17L6 21L8 14L2 9L9 9L12 2Z" fill="none" stroke="#F4C775" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="12" cy="12" r="3" fill="#F4C775"/>
      </svg>
      <h2 class="text-navy">Show This to Our Team</h2>
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
        <svg class="btn-icon" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2-2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        Return to Start
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
  background: rgba(4, 20, 40, 0.65);
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

.icon-header {
  margin-bottom: 15px;
}

h2 {
  font-family: "Goldman", sans-serif;
  font-size: 1.6rem;
  font-weight: 600;
  margin-bottom: 8px;
  color: #f4c775;
}

.subtitle {
  color: #ccc;
  margin-bottom: 15px;
  font-size: 0.95rem;
}

.goodies-list {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
  text-align: left;
}

.goodie-item {
  font-size: 1.1rem;
  font-weight: 600;
  color: #fff;
  text-transform: capitalize;
  margin: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 8px;
}

.goodie-item:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.footer-note {
  font-weight: 600;
  color: #fff;
  font-size: 0.95rem;
  margin-bottom: 20px;
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
    font-size: 1.4rem;
  }

  .confetti-placeholder {
    font-size: 2rem;
  }

  .goodie-item {
    font-size: 1rem;
  }
}
</style>

