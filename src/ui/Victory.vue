<script setup>
const emit = defineEmits(['next'])
</script>

<template>
  <div class="overlay">
    <div class="card">
      <h2 class="text-navy">Run Complete.</h2>
      <p class="subtitle">54 / 54 features collected.</p>
      
      <div class="reinforce-box">
        <p>100% Salesforce-native.</p>
        <p>PCI-DSS compliant.</p>
        <p>Live in 40+ countries.</p>
        <p>Powered by Agentforce.</p>
      </div>
      
      <button class="btn-primary" @click="emit('next')">Claim My Prizes</button>
    </div>
  </div>
</template>

<style scoped>
.overlay { width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; background: radial-gradient(circle at center, rgba(244, 199, 117, 0.4) 0%, rgba(4, 44, 83, 0.9) 100%); }
.card { background: white; padding: 20px; border-radius: 12px; text-align: center; color: #042C53; width: 400px; max-width: 90%; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
h2 { font-size: 1.8rem; font-weight: 600; margin-bottom: 5px; }
.subtitle { font-size: 1rem; color: #737373; margin-bottom: 15px; }
.reinforce-box { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: left; }
.reinforce-box p { font-weight: 600; margin: 5px 0; color: #424242; font-size: 0.95rem; }
.reinforce-box p::before { content: "✓ "; color: #F4C775; font-weight: bold; }
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
  transition: transform 0.2s, box-shadow 0.2s;
}
.btn-primary:hover {
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
  h2 { font-size: 1.5rem; }
  .subtitle { font-size: 0.9rem; }
  .btn-primary { font-size: 0.9rem; padding: 10px; }
}
</style>
