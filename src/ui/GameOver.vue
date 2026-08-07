<script setup>
import { computed, onMounted, ref } from "vue";
import { gsap } from "gsap";
import { levels } from "../data/GameContent.js";

// Copy note: the content script has no dedicated "Run Failed" screen
// section at all (it covers Level Complete, Boss Beat, Victory, Redemption,
// but never a game-over case) -- the header/body text below predates this
// milestone and isn't sourced from the script. Flagged in
// docs/PROCESS_TRACKER.md for a marketing pass, not rewritten here; this
// milestone's job was the STRUCTURE (stat summary, recap, retry), not copy.
const props = defineProps({ stats: Object });
const emit = defineEmits(["retry"]);

const TOTAL_FEATURES = levels.reduce((sum, l) => sum + l.requiredCount, 0);
const collectedCount = computed(() => props.stats?.featuresCollected?.length || 0);

const displayScore = ref(0);
const chipsEl = ref(null);
const _scoreTween = { value: 0 };

onMounted(() => {
  gsap.to(_scoreTween, {
    value: props.stats?.score || 0,
    duration: 0.8,
    ease: "power2.out",
    onUpdate: () => (displayScore.value = Math.round(_scoreTween.value)),
  });
  if (chipsEl.value) {
    gsap.from(chipsEl.value.children, { opacity: 0, y: 10, duration: 0.3, stagger: 0.025, delay: 0.3 });
  }
});
</script>

<template>
  <div class="game-over-overlay">
    <div class="game-over-card">
      <h1 class="title">RUN FAILED</h1>
      <p class="desc">Too many payment blockers slowed you down. Reboot your systems and try again.</p>

      <div class="stat-row">
        <div class="stat">
          <div class="stat-value">{{ displayScore }}</div>
          <div class="stat-label">Score</div>
        </div>
        <div class="stat">
          <div class="stat-value">{{ stats?.currentLevelId || 1 }}</div>
          <div class="stat-label">Level Reached</div>
        </div>
        <div class="stat">
          <div class="stat-value">{{ collectedCount }} / {{ TOTAL_FEATURES }}</div>
          <div class="stat-label">Features Collected</div>
        </div>
      </div>

      <div v-if="collectedCount > 0" class="recap">
        <h3>Features Collected</h3>
        <div class="recap-chips" ref="chipsEl">
          <div
            v-for="feature in stats.featuresCollected"
            :key="feature.name"
            class="feature-chip"
            :class="feature.category === 'Admin' ? 'admin-chip' : 'business-chip'"
          >
            {{ feature.name }}
          </div>
        </div>
      </div>

      <button class="btn-primary" @click="emit('retry')">TRY AGAIN</button>
    </div>
  </div>
</template>

<style scoped>
.game-over-overlay {
  width: 100%;
  height: 100%;
  background: rgba(13, 45, 64, 0.85);
  backdrop-filter: blur(10px);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  box-sizing: border-box;
}

.game-over-card {
  background: #FFFFFF;
  padding: 25px;
  border-radius: 12px;
  text-align: center;
  width: 440px;
  max-width: 100%;
  max-height: 100%;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0,0,0,0.3);
  border-top: 5px solid #e74c3c;
  animation: dropIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes dropIn {
  from { opacity: 0; transform: translateY(-50px) scale(0.9); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.title {
  font-family: 'Raleway', sans-serif;
  font-size: 1.6rem;
  font-weight: 600;
  color: #e74c3c;
  margin-bottom: 10px;
  letter-spacing: 1px;
}

.desc {
  font-size: 0.95rem;
  color: #4A5568;
  line-height: 1.5;
  margin-bottom: 20px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  background: rgba(13, 45, 64, 0.04);
  border-radius: 10px;
  padding: 14px 10px;
  margin-bottom: 18px;
}

.stat {
  flex: 1;
}

.stat-value {
  font-family: 'Raleway', sans-serif;
  font-weight: 800;
  font-size: 1.3rem;
  color: #0d2d40;
}

.stat-label {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: #4a5568;
  margin-top: 2px;
}

.recap {
  text-align: left;
  margin-bottom: 20px;
}

.recap h3 {
  font-size: 0.85rem;
  letter-spacing: 1px;
  color: #1e4860;
  margin-bottom: 10px;
  text-transform: uppercase;
}

.recap-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 130px;
  overflow-y: auto;
  padding-right: 4px;
}

.feature-chip {
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
}

.admin-chip {
  background: #F4C775;
  color: #042C53;
}

.business-chip {
  background: #042C53;
}

.btn-primary {
  background: #0d2d40;
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
  box-shadow: 0 4px 15px rgba(13, 45, 64, 0.4);
  transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
}
.btn-primary:hover {
  background: #154563;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(13, 45, 64, 0.6);
}
.btn-primary:active {
  transform: translateY(1px);
  box-shadow: 0 2px 10px rgba(13, 45, 64, 0.4);
}


@media (max-width: 1024px) {
  .game-over-card {
    padding: 15px;
  }
}

@media (max-width: 600px) {
  .game-over-card {
    margin: 15px;
    padding: 15px;
  }
  .title {
    font-size: 1.4rem;
  }
  .desc {
    font-size: 0.9rem;
  }
  .stat-value {
    font-size: 1.1rem;
  }
  .btn-primary {
    padding: 10px 15px;
    font-size: 0.95rem;
  }
}

@media (max-height: 600px) {
  .desc {
    margin-bottom: 10px;
  }
  .stat-row {
    padding: 8px;
    margin-bottom: 10px;
  }
  .recap {
    margin-bottom: 10px;
  }
  .recap-chips {
    max-height: 70px;
  }
}
</style>
