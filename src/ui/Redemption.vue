<script setup>
import { onMounted, ref } from 'vue'

const wonGoodies = ref([])

onMounted(() => {
  const stored = localStorage.getItem('chargeon_won_goodies')
  if (stored) {
    try {
      wonGoodies.value = JSON.parse(stored)
    } catch(e) {}
  }
})

const resetGame = () => {
  localStorage.removeItem('chargeon_won_goodies') // Reset for next player
  window.location.reload()
}
</script>

<template>
  <div class="overlay">
    <div class="card">
      <div class="confetti-placeholder">🎉</div>
      <h2 class="text-navy">Show This to Our Team</h2>
      <p class="subtitle">Here's what you earned:</p>
      
      <div class="goodies-list">
        <p v-for="(goodie, idx) in wonGoodies" :key="idx" class="goodie-item">{{ goodie }}</p>
        <p v-if="wonGoodies.length === 0" class="goodie-item">No prizes earned.</p>
      </div>
      
      <p class="footer-note">Ask about your 15% offer. Our team can tell you more.</p>
      
      <button class="btn-text" @click="resetGame">Return to Start</button>
    </div>
  </div>
</template>

<style scoped>
.overlay { width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; background: radial-gradient(circle at center, rgba(4, 44, 83, 0.4) 0%, rgba(4, 44, 83, 0.9) 100%); backdrop-filter: blur(5px); }
.card { background: white; padding: 20px; border-radius: 12px; text-align: center; color: #042C53; width: 400px; max-width: 90%; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
.confetti-placeholder { font-size: 2.5rem; margin-bottom: 15px; }
h2 { font-size: 1.6rem; font-weight: 600; margin-bottom: 8px; }
.subtitle { color: #737373; margin-bottom: 15px; font-size: 0.95rem; }
.goodies-list { background: #f5f5f5; border: 2px solid #042C53; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: left; }
.goodie-item { font-size: 1.1rem; font-weight: 600; color: #042C53; text-transform: capitalize; margin: 8px 0; border-bottom: 1px solid #ddd; padding-bottom: 8px; }
.goodie-item:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
.footer-note { font-weight: 600; color: #042C53; font-size: 0.95rem; margin-bottom: 20px; }
.btn-text { background: transparent; color: #737373; border: none; font-size: 0.85rem; text-decoration: underline; cursor: pointer; }

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
  h2 { font-size: 1.4rem; }
  .confetti-placeholder { font-size: 2rem; }
  .goodie-item { font-size: 1rem; }
}
</style>
