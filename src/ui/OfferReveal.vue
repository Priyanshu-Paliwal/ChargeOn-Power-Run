<script setup>
const emit = defineEmits(['next'])
</script>

<template>
  <div class="overlay">
    <div class="card">
      <h2 class="text-gold">You've Unlocked Something Big</h2>
      
      <div class="offer-box">
        <h3>15% OFF</h3>
        <p>your first year.</p>
      </div>
      
      <p class="subtitle">Talk to our team at the booth to claim it.</p>
      
      <button class="btn-primary" @click="emit('next')">See My Results</button>
    </div>
  </div>
</template>

<style scoped>
.overlay { width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; background: rgba(4, 44, 83, 0.9); backdrop-filter: blur(10px); }
.card { background: white; padding: 20px; border-radius: 12px; text-align: center; color: #042C53; box-shadow: 0 10px 30px rgba(0,0,0,0.3); width: 400px; max-width: 90%; }
h2 { font-size: 1.6rem; font-weight: 600; margin-bottom: 10px; }
.text-gold { color: #F4C775; }
.offer-box { background: #042C53; color: white; padding: 20px; border-radius: 8px; margin: 15px 0; border: 2px solid #F4C775; }
.offer-box h3 { font-size: 2.5rem; color: #F4C775; margin-bottom: 8px; }
.offer-box p { font-size: 1rem; opacity: 0.9; font-weight: 600; }
.subtitle { color: #424242; margin-bottom: 30px; font-size: 1.2rem; }
.btn-primary { 
  background: #042C53; 
  color: white; 
  border: none; 
  padding: 12px 25px; 
  border-radius: 8px; 
  font-weight: 700; 
  font-size: 1.05rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  cursor: pointer; 
  width: 100%; 
  box-shadow: 0 4px 15px rgba(4, 44, 83, 0.4);
  transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
}
.btn-primary:hover {
  background: #06407a;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(4, 44, 83, 0.6);
}
.btn-primary:active {
  transform: translateY(1px);
  box-shadow: 0 2px 10px rgba(4, 44, 83, 0.4);
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
  h2 { font-size: 1.4rem; }
  .offer-box h3 { font-size: 2rem; }
  .offer-box p { font-size: 0.9rem; }
  .btn-primary { font-size: 0.9rem; padding: 10px; }
}
</style>
