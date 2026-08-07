<script setup>
const emit = defineEmits(["dismiss"]);
</script>

<template>
  <div class="idle-overlay" @click="emit('dismiss')">
    <div class="idle-card">
      <h2>Still there?</h2>
      <p>Tap to keep going.</p>
    </div>
  </div>
</template>

<style scoped>
.idle-overlay {
  /* Absolute, not normal flow -- this is a second simultaneous overlay
     alongside whichever screen App.vue's main Transition is showing (see
     PauseMenu.vue's comment for why a plain width/height:100% block would
     stack below its sibling instead of overlaying it). */
  position: absolute;
  inset: 0;
  background: rgba(13, 45, 64, 0.85);
  backdrop-filter: blur(10px);
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  z-index: 50;
}

.idle-card {
  background: #ffffff;
  padding: 40px 50px;
  border-radius: 16px;
  text-align: center;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  animation: dropIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  pointer-events: none; /* the click that dismisses this is meant to land anywhere on the overlay, not just outside the card */
}

@keyframes dropIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}

h2 {
  font-family: "Raleway", sans-serif;
  font-size: 2rem;
  color: #0d2d40;
  margin-bottom: 10px;
  letter-spacing: 1px;
}

p {
  font-size: 1.1rem;
  color: #1e4860;
}
</style>
