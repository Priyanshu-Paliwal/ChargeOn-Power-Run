<script setup>
const emit = defineEmits(['complete'])

const handleBook = () => {
  // Real app: Write to CRM here
  emit('complete')
}

const handleSkip = () => {
  emit('complete')
}
</script>

<template>
  <div class="overlay">
    <div class="card">
      <h2 class="text-navy">Your prize is reserved!</h2>
      <p class="subtitle">While the team preps it, want a 5-minute ChargeOn demo?</p>
      
      <div class="action-buttons">
        <button class="btn-primary" @click="handleBook">Yes, Book a Demo</button>
        <button class="btn-secondary" @click="handleSkip">Skip for now</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay { width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; background: rgba(4, 44, 83, 0.85); backdrop-filter: blur(5px); }
.card { background: white; padding: 50px; border-radius: 12px; text-align: center; color: #042C53; box-shadow: 0 20px 40px rgba(0,0,0,0.3); max-width: 500px; }
h2 { font-size: 2rem; margin-bottom: 10px; }
.subtitle { color: #737373; margin-bottom: 40px; font-size: 1.1rem; line-height: 1.5; }
.action-buttons { display: flex; flex-direction: column; gap: 15px; }
button { padding: 16px; border-radius: 8px; font-weight: bold; cursor: pointer; width: 100%; font-size: 1.1rem; border: none; font-family: 'Raleway', sans-serif; transition: all 0.2s; }
.btn-primary { background: #042C53; color: white; }
.btn-primary:hover { background: #06407a; }
.btn-secondary { background: #f0f0f0; color: #424242; border: 1px solid #D9D9D9; }
.btn-secondary:hover { background: #e0e0e0; }
</style>
