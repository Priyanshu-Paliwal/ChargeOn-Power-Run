<script setup>
import { ref } from 'vue'

const emit = defineEmits(['complete'])

const prizes = [
  "Energy Bars",
  "Exclusive Sticker",
  "Fridge Magnet",
  "Bag Tag",
  "Diary & Pen",
  "Cable Protector",
  "Pin Badge",
  "Tote Bag"
]

const rotation = ref(0)
const spinning = ref(false)
const selectedPrize = ref(null)

const spinWheel = () => {
  if (spinning.value) return
  spinning.value = true
  selectedPrize.value = null
  
  // Eased deceleration logic
  const spins = 5 // Minimum full spins
  const prizeIndex = Math.floor(Math.random() * prizes.length)
  const segmentAngle = 360 / prizes.length
  
  // Calculate final angle (adding offset to center on the segment)
  const targetAngle = (spins * 360) + (360 - (prizeIndex * segmentAngle)) - (segmentAngle / 2)
  
  rotation.value += targetAngle
  
  setTimeout(() => {
    spinning.value = false
    selectedPrize.value = prizes[prizeIndex]
  }, 4000) // matches CSS transition time
}
</script>

<template>
  <div class="overlay">
    <div class="card">
      <h2>Spin to Win</h2>
      <p class="subtitle">Every spin is a guaranteed win!</p>
      
      <div class="wheel-container">
        <div class="pointer">▼</div>
        <div class="wheel" :style="{ transform: `rotate(${rotation}deg)` }">
          <div 
            v-for="(prize, index) in prizes" 
            :key="index"
            class="segment"
            :style="{ 
              transform: `rotate(${index * (360 / prizes.length)}deg)`,
              backgroundColor: index % 2 === 0 ? '#042C53' : '#F4C775',
              color: index % 2 === 0 ? '#FFFFFF' : '#042C53'
            }"
          >
            <span class="prize-text">{{ prize }}</span>
          </div>
        </div>
      </div>
      
      <div class="action-area">
        <button v-if="!selectedPrize" class="btn-primary" @click="spinWheel" :disabled="spinning">SPIN</button>
        <div v-else class="result-area">
          <p>You won: <strong>{{ selectedPrize }}</strong>!</p>
          <button class="btn-primary" @click="emit('complete')">Continue</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay { width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; background: rgba(4, 44, 83, 0.9); backdrop-filter: blur(5px); }
.card { background: white; padding: 40px; border-radius: 12px; text-align: center; color: #042C53; box-shadow: 0 20px 40px rgba(0,0,0,0.3); min-width: 400px; }
h2 { font-size: 2.2rem; margin-bottom: 5px; }
.subtitle { color: #737373; margin-bottom: 30px; }

.wheel-container { position: relative; width: 300px; height: 300px; margin: 0 auto 30px; }
.pointer { position: absolute; top: -15px; left: 50%; transform: translateX(-50%); font-size: 2rem; color: #ff0000; z-index: 10; }
.wheel { width: 100%; height: 100%; border-radius: 50%; border: 4px solid #042C53; position: relative; overflow: hidden; transition: transform 4s cubic-bezier(0.17, 0.67, 0.12, 1); }

.segment { position: absolute; top: 0; right: 0; width: 50%; height: 50%; transform-origin: 0% 100%; display: flex; align-items: center; justify-content: center; clip-path: polygon(100% 0, 0 100%, 100% 100%); /* Note: Real CSS wheels are tricky without canvas/SVG, using this simple CSS approach for speed */ }
/* Using a simpler visual approach for 8 segments in pure CSS */
.wheel { background: conic-gradient(
  #042C53 0deg 45deg,
  #F4C775 45deg 90deg,
  #042C53 90deg 135deg,
  #F4C775 135deg 180deg,
  #042C53 180deg 225deg,
  #F4C775 225deg 270deg,
  #042C53 270deg 315deg,
  #F4C775 315deg 360deg
); }
.segment { background: transparent !important; width: 100%; height: 100%; position: absolute; top: 0; left: 0; transform-origin: center center; }
.prize-text { position: absolute; top: 20px; left: 50%; transform: translateX(-50%) rotate(90deg); font-weight: bold; font-size: 0.8rem; width: 100px; text-align: center; }

.action-area { height: 80px; display: flex; flex-direction: column; justify-content: center; }
.result-area p { font-size: 1.2rem; margin-bottom: 15px; }
.btn-primary { background: #042C53; color: white; border: none; padding: 15px 40px; border-radius: 8px; font-weight: bold; cursor: pointer; width: 100%; font-size: 1.2rem; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
