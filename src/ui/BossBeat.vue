<script setup>
import { onMounted, ref } from 'vue'
const emit = defineEmits(['next'])

const showImpact = ref(false)

onMounted(() => {
  setTimeout(() => { showImpact.value = true }, 1500) // Type effect time
  setTimeout(() => { emit('next') }, 5000)
})
</script>

<template>
  <div class="overlay">
    <div class="terminal">
      <p class="prompt">Type: "Fix Payment Failures"<span class="cursor">_</span></p>
    </div>
    
    <div class="impact-text" v-if="showImpact">
      <h2>Handled. Just like that.</h2>
    </div>
  </div>
</template>

<style scoped>
.overlay { width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; background: rgba(0,0,0,0.9); }
.terminal { font-family: monospace; font-size: 1.6rem; color: #00ff00; margin-bottom: 40px; }
.cursor { animation: blink 1s step-end infinite; }
@keyframes blink { 50% { opacity: 0; } }
.impact-text h2 { font-size: 2rem; color: #F4C775; font-weight: 600; }

@media (max-width: 1024px) {
  .terminal { font-size: 1.4rem; padding: 0 15px; text-align: center; }
  .impact-text h2 { font-size: 1.8rem; text-align: center; }
}

@media (max-width: 600px) {
  .terminal { font-size: 1.1rem; }
  .impact-text h2 { font-size: 1.5rem; }
}
</style>
