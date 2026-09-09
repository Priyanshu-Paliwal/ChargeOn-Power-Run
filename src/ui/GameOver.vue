<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
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
const collectedCount = computed(
  () => props.stats?.featuresCollected?.length || 0,
);

const displayScore = ref(0);
const chipsEl = ref(null);
const _scoreTween = { value: 0 };

const handleKeyDown = (e) => {
  if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
    emit("retry");
    e.preventDefault();
  }
};

onMounted(() => {
  gsap.to(_scoreTween, {
    value: props.stats?.score || 0,
    duration: 0.8,
    ease: "power2.out",
    onUpdate: () => (displayScore.value = Math.round(_scoreTween.value)),
  });
  if (chipsEl.value) {
    gsap.from(chipsEl.value.children, {
      opacity: 0,
      y: 10,
      duration: 0.3,
      stagger: 0.025,
      delay: 0.3,
    });
  }

  window.addEventListener("keydown", handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown);
});
</script>

<template>
  <div class="game-over-overlay">
    <div class="game-over-card">
      <svg class="icon-header" viewBox="0 0 24 24" width="48" height="48" style="margin: 0 auto; filter: drop-shadow(0 0 10px rgba(231,76,60,0.5));">
        <path d="M12 2L22 20H2L12 2Z" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <line x1="12" y1="9" x2="12" y2="13" stroke="#e74c3c" stroke-width="2" stroke-linecap="round"/>
        <circle cx="12" cy="17" r="1.5" fill="#e74c3c"/>
      </svg>
      <h1 class="title">RUN FAILED</h1>
      <p class="desc">
        Too many payment blockers slowed you down. Reboot your systems and try
        again.
      </p>

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
          <div class="stat-value">
            {{ collectedCount }} / {{ TOTAL_FEATURES }}
          </div>
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
            :class="
              feature.category === 'Admin' ? 'admin-chip' : 'business-chip'
            "
          >
            {{ feature.name }}
          </div>
        </div>
      </div>

      <button class="btn-primary" @click="emit('retry')">
        <svg class="btn-icon" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none">
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
        TRY AGAIN
      </button>
    </div>
  </div>
</template>

<style scoped>
.game-over-overlay {
  position: fixed !important;
  z-index: 9999 !important;
  transform: translateZ(0);
  width: 100%;
  height: 100%;
  background: rgba(4, 20, 40, 0.65);
  backdrop-filter: blur(15px) !important;
  -webkit-backdrop-filter: blur(15px) !important;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  box-sizing: border-box;
  font-family: "Poppins", sans-serif;
}

.game-over-card {
  background: linear-gradient(
    135deg,
    rgb(0 0 0 / 50%) 0%,
    rgb(0 0 0 / 5%) 100%
  );
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow:
    0px 4px 45px 0px rgba(0, 0, 0, 0.45),
    inset 0 1px 2px rgb(0 0 0 / 50%);
  padding: 25px;
  border-radius: 12px;
  text-align: center;
  width: 440px;
  max-width: 100%;
  max-height: 100%;
  overflow-y: auto;
  color: #fff;
  border-top: 5px solid #e74c3c;
  animation: dropIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

@keyframes dropIn {
  from {
    opacity: 0;
    transform: translateY(-50px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.title {
  font-family: "Goldman", sans-serif;
  font-size: 1.6rem;
  font-weight: 600;
  color: #e74c3c;
  margin-bottom: 10px;
  letter-spacing: 1px;
}

.desc {
  font-size: 0.95rem;
  color: #ccc;
  line-height: 1.5;
  margin-bottom: 20px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  padding: 14px 10px;
  margin-bottom: 18px;
}

.stat {
  flex: 1;
}

.stat-value {
  font-family: "Goldman", sans-serif;
  font-weight: 800;
  font-size: 1.3rem;
  color: #f4c775;
}

.stat-label {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: #ccc;
  margin-top: 2px;
}

.recap {
  text-align: left;
  margin-bottom: 20px;
}

.recap h3 {
  font-family: "Goldman", sans-serif;
  font-size: 0.85rem;
  letter-spacing: 1px;
  color: #f4c775;
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
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.feature-chip:hover {
  transform: translateY(-2px);
}

.admin-chip {
  background: linear-gradient(135deg, rgba(244, 199, 117, 0.8) 0%, rgba(200, 160, 90, 0.9) 100%);
  color: #042c53;
  border: 1px solid rgba(255, 255, 255, 0.4);
}

.business-chip {
  background: linear-gradient(135deg, rgba(111, 166, 224, 0.6) 0%, rgba(21, 97, 177, 0.8) 100%);
  border: 1px solid rgba(111, 166, 224, 0.4);
}

.btn-primary {
  background: linear-gradient(180deg, #6fa6e0 0%, #1561b1 100%);
  color: #fff;
  border: none;
  padding: 12px 25px;
  border-radius: 8px;
  font-family: "Goldman", sans-serif;
  font-weight: 400;
  font-size: 1.2rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  cursor: pointer;
  width: 100%;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.btn-primary:hover {
  background: linear-gradient(180deg, #81b4e9 0%, #1a71cd 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
}
.btn-primary:active {
  transform: translateY(0);
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
    font-size: 1rem;
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

