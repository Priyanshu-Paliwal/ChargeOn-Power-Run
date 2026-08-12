<script setup>
import { computed, ref, onMounted } from 'vue'
import { levels } from '../data/GameContent.js'

const props = defineProps({
  levelId: Number
})
const emit = defineEmits(['next'])

const levelData = computed(() => levels.find(l => l.id === props.levelId))
const wonGoodie = ref('')

const getArticle = (item) => {
  return item.toLowerCase().endsWith('s') ? 'some cool' : 'a cool'
}

onMounted(() => {
  if (levelData.value) {
    const pool = levelData.value.goodiesPool
    wonGoodie.value = pool[Math.floor(Math.random() * pool.length)]
    
    // Save won goodie to localStorage for Redemption screen
    const stored = localStorage.getItem('chargeon_won_goodies')
    const goodiesList = stored ? JSON.parse(stored) : []
    goodiesList.push(wonGoodie.value)
    localStorage.setItem('chargeon_won_goodies', JSON.stringify(goodiesList))
  }
})

const copy = computed(() => {
  if (props.levelId === 1) {
    return {
      header: 'Level 1 Cleared!',
      body: 'You just caught 22 real ChargeOn features. Nice work outrunning the basics.',
      button: 'Continue to Level 2'
    }
  } else if (props.levelId === 2) {
    return {
      header: 'Level 2 Cleared!',
      body: "22 more features down. You're moving faster than most payment tools can process a transaction.",
      button: 'Continue to Level 3'
    }
  } else {
    return {
      header: 'Level 3 Cleared!',
      body: 'You just caught all 54 ChargeOn features, including our AI assistant.',
      button: 'See What Else You Won'
    }
  }
})
</script>

<template>
  <div class="overlay">
    <div class="card">
      <h2 class="text-gold">{{ copy.header }}</h2>
      <p class="subtitle">{{ copy.body }}</p>
      
      <div class="prize-reveal">
        <p>You have won {{ getArticle(wonGoodie) }} <span class="prize-name">{{ wonGoodie }}</span>!</p>
      </div>
      
      <button class="btn-primary" @click="emit('next')">{{ copy.button }}</button>
    </div>
  </div>
</template>

<style scoped>
.overlay { width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; background: rgba(4, 44, 83, 0.85); backdrop-filter: blur(10px); }
.card { background: white; padding: 20px; border-radius: 12px; text-align: center; color: #042C53; box-shadow: 0 10px 30px rgba(0,0,0,0.3); width: 400px; max-width: 90%; }
h2 { font-size: 1.6rem; font-weight: 600; margin-bottom: 10px; }
.text-gold { color: #F4C775; }
.subtitle { color: #424242; margin-bottom: 15px; font-size: 0.95rem; line-height: 1.4; }
.prize-reveal { background: #042C53; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 2px solid #F4C775; }
.prize-reveal p { color: white; margin: 0; font-size: 1rem; }
.prize-name { color: #F4C775; font-weight: 600; font-size: 1.1rem; text-transform: capitalize; }
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
  .subtitle { font-size: 0.9rem; }
  .prize-reveal p { font-size: 0.9rem; }
  .btn-primary { font-size: 0.9rem; padding: 10px; }
}
</style>
