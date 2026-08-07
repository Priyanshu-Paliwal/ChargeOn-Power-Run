<script setup>
const emit = defineEmits(['next'])
</script>

<template>
  <div class="overlay">
    <div class="card">
      <h2>How to Play</h2>
      <div class="grid">
        <div class="item">
          <div class="icon">⬅️ ➡️</div>
          <p>Swipe left or right to switch lanes</p>
        </div>
        <div class="item">
          <div class="icon">⬆️</div>
          <p>Swipe up to jump low blockers</p>
        </div>
        <div class="item">
          <div class="icon">⬇️</div>
          <!-- Corrected Milestone 9: the approved content script
               contradicted itself on drones (this control line said "slide
               under drones" while the Level 2 intro card said "only a lane
               switch saves you"). Milestone 5 implemented the mixed system
               the user chose -- low drones (gap underneath) are cleared by
               sliding, high drones (no gap) need a lane switch -- and this
               line now describes that instead of either half of the
               original contradiction. See GameContent.js's Level 2 subtext
               for the matching correction. -->
          <p>Drones: slide under low ones, switch lanes for high ones (Level 2 onward)</p>
        </div>
      </div>
      <div class="instructions">
        <p><span class="gold">Gold coins</span> = real ChargeOn features</p>
        <p><span class="red">Red blockers</span> = real payment problems</p>
        <p>3 lives per level</p>
      </div>
      <button class="btn-primary" @click="emit('next')">Let's Run</button>
    </div>
  </div>
</template>

<style scoped>
.overlay { 
  width: 100%; 
  height: 100%; 
  display: flex; 
  justify-content: flex-start; 
  align-items: center; 
  padding-left: 10%;
  pointer-events: none; /* allow clicks to pass through background if needed */
}
.card { 
  background: rgba(4, 44, 83, 0.6); 
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 20px; 
  border-radius: 12px; 
  text-align: center; 
  color: #FFFFFF; 
  width: 90%;
  max-width: 400px; 
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  pointer-events: auto;
  animation: slideIn 0.5s ease-out;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateX(-50px); }
  to { opacity: 1; transform: translateX(0); }
}

h2 { font-size: 1.6rem; font-weight: 600; margin-bottom: 15px; color: #F4C775; }
.grid { display: flex; justify-content: space-around; margin-bottom: 20px; }
.item { flex: 1; }
.icon { font-size: 1.6rem; margin-bottom: 5px; }
.desc { font-size: 0.9rem; font-weight: 600; color: #A0B3C6; }
.instructions { 
  text-align: left; 
  background: rgba(0,0,0,0.3); 
  padding: 15px; 
  border-radius: 8px; 
  font-size: 0.95rem; 
  margin-bottom: 20px; 
  line-height: 1.4;
  border-left: 3px solid #F4C775;
}
.instructions p { margin: 8px 0; }
.gold { color: #F4C775; font-weight: bold; }
.red { color: #ff6b6b; font-weight: bold; }
.btn-primary { 
  background: #F4C775; 
  color: #042C53; 
  border: none; 
  padding: 12px 25px; 
  border-radius: 8px; 
  font-weight: 700; 
  font-size: 1.05rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  cursor: pointer; 
  width: 100%; 
  box-shadow: 0 4px 15px rgba(244, 199, 117, 0.4);
  transition: transform 0.2s, box-shadow 0.2s;
}
.btn-primary:hover {
  background: #FFDB99;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(244, 199, 117, 0.6);
}
.btn-primary:active {
  transform: translateY(1px);
  box-shadow: 0 2px 10px rgba(244, 199, 117, 0.4);
}

@media (max-width: 1024px) {
  .overlay {
    padding-left: 0;
    justify-content: center;
    align-items: center;
    padding: 15px;
  }
}

@media (max-width: 600px) {
  .card {
    padding: 15px;
  }
  
  .grid {
    flex-direction: column;
    gap: 10px;
  }
  
  .icon {
    font-size: 1.4rem;
    margin-bottom: 2px;
  }
  
  h2 {
    font-size: 1.4rem;
    margin-bottom: 10px;
  }
  
  .instructions {
    padding: 12px;
    font-size: 0.85rem;
    margin-bottom: 10px;
  }
}

@media (max-height: 750px) {
  .card {
    padding: 10px;
  }
  .grid {
    margin-bottom: 10px;
  }
  .instructions {
    margin-bottom: 10px;
    padding: 10px;
  }
}
</style>
