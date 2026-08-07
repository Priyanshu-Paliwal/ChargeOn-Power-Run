<script setup>
const emit = defineEmits(['retry'])
</script>

<template>
  <div class="game-over-overlay">
    <div class="game-over-card">
      <h1 class="title">RUN FAILED</h1>
      <p class="desc">Too many payment blockers slowed you down. Reboot your systems and try again.</p>
      
      <button class="btn-primary" @click="emit('retry')">TRY AGAIN</button>
    </div>
  </div>
</template>

<style scoped>
.game-over-overlay {
  width: 100%;
  height: 100%;
  background: rgba(13, 45, 64, 0.85);
  backdrop-filter: blur(10px);
  display: flex;
  justify-content: center;
  align-items: center;
}

.game-over-card {
  background: #FFFFFF;
  padding: 20px;
  border-radius: 12px;
  text-align: center;
  width: 400px;
  max-width: 90%;
  box-shadow: 0 10px 40px rgba(0,0,0,0.3);
  border-top: 5px solid #e74c3c;
  animation: dropIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes dropIn {
  from { opacity: 0; transform: translateY(-50px) scale(0.9); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.title {
  font-family: 'Raleway', sans-serif;
  font-size: 1.6rem;
  font-weight: 600;
  color: #e74c3c;
  margin-bottom: 10px;
  letter-spacing: 1px;
}

.desc {
  font-size: 0.95rem;
  color: #4A5568;
  line-height: 1.5;
  margin-bottom: 20px;
}

.btn-primary { 
  background: #0d2d40; 
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
  box-shadow: 0 4px 15px rgba(13, 45, 64, 0.4);
  transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
}
.btn-primary:hover {
  background: #154563;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(13, 45, 64, 0.6);
}
.btn-primary:active {
  transform: translateY(1px);
  box-shadow: 0 2px 10px rgba(13, 45, 64, 0.4);
}


@media (max-width: 1024px) {
  .game-over-card {
    padding: 15px;
  }
}

@media (max-width: 600px) {
  .game-over-card {
    margin: 15px;
    padding: 15px;
  }
  .title {
    font-size: 1.4rem;
  }
  .desc {
    font-size: 0.9rem;
  }
  .btn-primary {
    padding: 10px 15px;
    font-size: 0.95rem;
  }
}
</style>
