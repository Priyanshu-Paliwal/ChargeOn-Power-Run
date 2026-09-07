<script setup>
const emit = defineEmits(["next"]);
</script>

<template>
  <div class="overlay">
    <div class="card">
      <svg class="icon-header" viewBox="0 0 24 24" width="56" height="56" style="margin: 0 auto 10px; filter: drop-shadow(0 0 15px rgba(244,199,117,0.6));">
        <path d="M20 12v10H4V12M22 7H2v5h20V7zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" fill="none" stroke="#F4C775" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <h2 class="text-gold">You've Unlocked Something Big</h2>

      <div class="offer-box">
        <h3>15% OFF</h3>
        <p>your first year.</p>
      </div>

      <p class="subtitle">Talk to our team at the booth to claim it.</p>

      <button class="btn-primary" @click="emit('next')">
        See My Results
        <svg class="btn-icon" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
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

h2 {
  font-family: "Goldman", sans-serif;
  font-size: 1.6rem;
  font-weight: 600;
  margin-bottom: 10px;
}

.text-gold {
  color: #f4c775;
}

.offer-box {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  padding: 20px;
  border-radius: 8px;
  margin: 15px 0;
}

.offer-box h3 {
  font-family: "Goldman", sans-serif;
  font-size: 2.5rem;
  color: #f4c775;
  margin-bottom: 8px;
}

.offer-box p {
  font-size: 1rem;
  opacity: 0.9;
  font-weight: 600;
}

.subtitle {
  color: #ccc;
  margin-bottom: 30px;
  font-size: 1.2rem;
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

  .offer-box h3 {
    font-size: 2rem;
  }

  .offer-box p {
    font-size: 0.9rem;
  }

  .btn-primary {
    font-size: 1rem;
    padding: 10px;
  }
}
</style>

