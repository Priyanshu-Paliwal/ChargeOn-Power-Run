<script setup>
import { onMounted, ref } from 'vue'
const emit = defineEmits(['next'])
const canSkip = ref(false)

onMounted(() => {
  setTimeout(() => canSkip.value = true, 2000) // skippable after 2 seconds
  setTimeout(() => emit('next'), 10000) // auto-advance after 10 seconds
})
</script>

<template>
  <div class="overlay">
    <div class="cinematic-bars"></div>
    <div class="text-container">
      <p>Somewhere, a payment just failed.</p>
      <p>A reconciliation report just got messier.</p>
      <p class="highlight">Time to fix this.</p>
    </div>
    <button v-if="canSkip" class="skip-btn" @click="emit('next')">Skip ›</button>
    <div class="cinematic-bars bottom"></div>
  </div>
</template>

<style scoped>
.overlay { width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; background: rgba(0,0,0,0.9); }
.cinematic-bars { position: absolute; top: 0; left: 0; width: 100%; height: 15%; background: black; }
.cinematic-bars.bottom { top: auto; bottom: 0; }
.text-container { text-align: center; color: white; }
h2 { color: #ff3333; letter-spacing: 1px; margin-bottom: 10px; font-size: 1.6rem; font-weight: 600; }
p { font-size: 1.05rem; opacity: 0.8; margin: 8px 0; }
.highlight { color: #F4C775; font-weight: 600; opacity: 1; }
.skip-btn { 
  position: absolute; 
  bottom: 18%; 
  right: 5%; 
  background: rgba(255, 255, 255, 0.1); 
  color: white; 
  border: 1px solid rgba(255, 255, 255, 0.3); 
  padding: 10px 20px; 
  border-radius: 20px; 
  cursor: pointer; 
  font-size: 0.95rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  backdrop-filter: blur(5px);
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
  transition: all 0.2s;
}
.skip-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.6);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.4);
}
.skip-btn:active {
  transform: translateY(1px);
}

@media (max-width: 1024px) {
  .text-container { width: 90%; padding: 15px; }
}

@media (max-width: 600px) {
  .text-container p { font-size: 0.95rem; }
  .text-container .highlight { font-size: 1rem; }
  .skip-btn { bottom: 17%; right: 5%; font-size: 0.85rem; padding: 6px 12px; }
}
</style>
