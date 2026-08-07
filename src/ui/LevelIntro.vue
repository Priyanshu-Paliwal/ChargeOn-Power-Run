<script setup>
import { computed } from 'vue'
import { levels } from '../data/GameContent.js'

const props = defineProps({
  levelId: Number
})

const emit = defineEmits(['start'])

const levelData = computed(() => levels.find(l => l.id === props.levelId))
</script>

<template>
  <div class="overlay">
    <div class="card">
      <h2>{{ levelData.title }}</h2>
      <p class="target">{{ levelData.subtext }}</p>
      
      <div class="stats">
        <div>{{ levelData.speedTag }}</div>
      </div>
      
      <button class="btn-primary" @click="emit('start')">Start Level {{ levelData.id }}</button>
    </div>
  </div>
</template>

<style scoped>
.overlay { width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; background: rgba(4, 44, 83, 0.7); backdrop-filter: blur(10px); }
.card { background: white; padding: 20px; border-radius: 12px; text-align: center; color: #042C53; width: 400px; max-width: 90%; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
.level-badge { background: #F4C775; color: #042C53; display: inline-block; padding: 4px 12px; border-radius: 20px; font-weight: 600; font-size: 0.9rem; margin-bottom: 10px; }
h2 { font-size: 1.6rem; font-weight: 600; margin-bottom: 8px; }
.target { font-size: 0.95rem; color: #424242; margin-bottom: 15px; }
.stats { background: #f5f5f5; padding: 12px; border-radius: 8px; margin-bottom: 15px; text-align: left; font-size: 0.9rem; }
.stats span { font-weight: 600; color: #737373; }
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
  h2 { font-size: 1.4rem; }
}
</style>
