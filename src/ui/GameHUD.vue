<script setup>
import { computed } from 'vue'
import { levels } from '../data/GameContent.js'

const props = defineProps({
  stats: Object
})

const currentLevelData = computed(() => levels.find(l => l.id === props.stats.currentLevelId) || levels[0])
const progressPct = computed(() => (props.stats.levelFeaturesCollected / currentLevelData.value.requiredCount) * 100)

</script>

<template>
  <div class="hud-container">
    <!-- Top Bar -->
    <div class="top-bar">
      <div class="lives">
        <span v-for="n in 3" :key="n" :class="{ 'lost': n > props.stats.lives }">❤️</span>
      </div>
      
      <div class="progress-section">
        <div class="level-badge">LEVEL {{ props.stats.currentLevelId }}</div>
        <div class="progress-bar-container">
          <div class="progress-bar-fill" :style="{ width: progressPct + '%' }"></div>
        </div>
        <div class="progress-text">{{ props.stats.levelFeaturesCollected }} / {{ currentLevelData.requiredCount }}</div>
      </div>
    </div>
    
    <!-- Side Panel (Collected Features) -->
    <div class="side-panel">
      <h3>Collected Features</h3>
      <transition-group name="list" tag="div" class="feature-list">
        <div 
          v-for="feature in props.stats.featuresCollected" 
          :key="feature.name" 
          class="feature-chip"
          :class="feature.category === 'Admin' ? 'admin-chip' : 'business-chip'"
        >
          {{ feature.name }}
        </div>
      </transition-group>
    </div>
    
    <!-- Popups -->
    <div class="popups-container">
      <transition-group name="popup-anim" tag="div">
        <div 
          v-for="popup in props.stats.popups.filter(p => p.type !== 'success')" 
          :key="popup.id"
          class="popup-message"
          :class="{ 'popup-success': popup.type === 'success', 'popup-error': popup.type === 'error', 'popup-exclusive': popup.isExclusive }"
        >
          {{ popup.text }}
        </div>
      </transition-group>
    </div>
  </div>
</template>

<style scoped>
.hud-container {
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.top-bar {
  position: absolute;
  top: 15px;
  left: 50%;
  transform: translateX(-50%);
  width: 45%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.9);
  padding: 8px 15px;
  border-radius: 12px;
  box-shadow: 0 5px 15px rgba(0,0,0,0.2);
  color: #042C53;
}

.lives span {
  font-size: 1.5rem;
  margin-right: 5px;
  transition: opacity 0.3s;
}
.lives span.lost {
  opacity: 0.2;
  filter: grayscale(100%);
}

.progress-section {
  display: flex;
  align-items: center;
  gap: 15px;
  flex: 1;
  margin-left: 20px;
}

.level-badge {
  font-weight: bold;
  background: #042C53;
  color: white;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 0.9rem;
}

.progress-bar-container {
  flex: 1;
  height: 12px;
  background: #e0e0e0;
  border-radius: 6px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: #F4C775;
  transition: width 0.3s ease;
}

.progress-text {
  font-weight: bold;
  font-size: 1.1rem;
}

.side-panel {
  position: absolute;
  top: 80px;
  right: 15px;
  width: 240px;
  bottom: 20px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 10px;
  padding: 12px;
  box-shadow: 0 5px 15px rgba(0,0,0,0.2);
  overflow-y: auto;
  color: #042C53;
}

h3 {
  font-size: 1rem;
  margin-bottom: 10px;
  border-bottom: 2px solid #e0e0e0;
  padding-bottom: 8px;
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.feature-chip {
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  color: #fff;
}

.admin-chip {
  background: #F4C775;
  color: #042C53;
}

.business-chip {
  background: #042C53;
}

/* Animations */
.list-enter-active,
.list-leave-active {
  transition: all 0.5s ease;
}
.list-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

/* Popups */
.popups-container {
  position: absolute;
  top: 15%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  z-index: 100;
  pointer-events: none;
}

.popup-message {
  padding: 10px 20px;
  border-radius: 20px;
  font-size: 1.1rem;
  font-weight: bold;
  color: white;
  text-align: center;
  white-space: pre-wrap;
  box-shadow: 0 5px 15px rgba(0,0,0,0.3);
  max-width: 400px;
  border: 2px solid transparent;
}

.popup-success {
  background: rgba(4, 44, 83, 0.9);
  border-color: #F4C775;
}

.popup-error {
  background: rgba(211, 47, 47, 0.9);
  border-color: #ff9999;
}

.popup-exclusive {
  background: linear-gradient(135deg, #042C53 0%, #D2B48C 100%);
  border-color: #ffd164;
  text-shadow: 0 2px 5px rgba(0,0,0,0.5);
}

.popup-anim-enter-active,
.popup-anim-leave-active {
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.popup-anim-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.8);
}
.popup-anim-leave-to {
  opacity: 0;
  transform: translateY(-20px) scale(0.8);
}

/* RESPONSIVE DESIGN */
@media (max-width: 1024px) {
  .top-bar {
    width: 95%;
    padding: 8px 12px;
    flex-wrap: wrap;
    top: 10px;
  }
  
  .progress-section {
    margin-left: 10px;
    gap: 10px;
  }

  .lives span {
    font-size: 1.2rem;
    margin-right: 2px;
  }

  .level-badge {
    font-size: 0.8rem;
    padding: 3px 6px;
  }
  
  .progress-text {
    font-size: 0.9rem;
  }
  
  /* On mobile, move the side panel to the bottom and make it a horizontal scrolling list */
  .side-panel {
    top: auto;
    bottom: 20px;
    left: 10px;
    right: 10px;
    width: auto;
    height: 100px;
    padding: 10px;
    overflow-x: auto;
    overflow-y: hidden;
  }
  
  .side-panel h3 {
    font-size: 0.9rem;
    margin-bottom: 5px;
    border-bottom: none;
    padding-bottom: 0;
  }
  
  .feature-list {
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
  }
  
  .feature-chip {
    white-space: nowrap;
  }

  .popups-container {
    top: 30%;
    width: 90%;
  }

  .popup-message {
    font-size: 1rem;
    padding: 8px 15px;
  }
}
</style>
