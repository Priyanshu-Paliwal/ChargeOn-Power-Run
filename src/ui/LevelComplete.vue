<script setup>
import { computed, ref, onMounted } from "vue";
import { levels } from "../data/GameContent.js";

const props = defineProps({
  levelId: Number,
  stats: Object,
  previousGoodies: { type: Array, default: () => [] }, // goodies already won in earlier levels
});
const emit = defineEmits(["next"]);

const levelData = computed(() => levels.find((l) => l.id === props.levelId));
const wonGoodie = computed(() => levelData.value?.goodie || "");
const wonDiscount = computed(() => levelData.value?.discount || "");

const levelFeatures = computed(() => {
  const currentLevelData = levels.find((l) => l.id === props.levelId);
  if (!currentLevelData || !props.stats?.featuresCollected) return [];
  const levelFeatureNames = new Set(currentLevelData.features.map((f) => f.name));
  return props.stats.featuresCollected.filter(f => levelFeatureNames.has(f.name));
});

const getArticle = (item) => {
  if (!item) return "";
  return item.toLowerCase().endsWith("s") ? "some cool" : "a cool";
};

onMounted(() => {
  if (levelData.value && wonGoodie.value) {
    // Save won goodie to localStorage for Redemption screen
    const stored = localStorage.getItem("chargeon_won_goodies");
    const goodiesList = stored ? JSON.parse(stored) : [];
    
    // Deduplicate: only add if not already in the list
    if (!goodiesList.includes(wonGoodie.value)) {
      goodiesList.push(wonGoodie.value);
      localStorage.setItem("chargeon_won_goodies", JSON.stringify(goodiesList));
    }
  }
});

const copy = computed(() => {
  if (props.levelId === 1) {
    return {
      header: "Level 1 Cleared!",
      body: "You just caught 22 real ChargeOn features. Nice work outrunning the basics.",
      button: "Continue to Level 2",
    };
  } else if (props.levelId === 2) {
    return {
      header: "Level 2 Cleared!",
      body: "22 more features down. You're moving faster than most payment tools can process a transaction.",
      button: "Continue to Level 3",
    };
  } else {
    return {
      header: "Level 3 Cleared!",
      body: "You just caught all 54 ChargeOn features, including our AI assistant.",
      button: "See What Else You Won",
    };
  }
});
</script>

<template>
  <div class="overlay">
    <div class="card two-column-card">
      <div class="column-left">
        <svg class="icon-header" viewBox="0 0 24 24" width="56" height="56" style="margin: 0 auto 10px; filter: drop-shadow(0 0 15px rgba(244,199,117,0.6));">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" fill="#F4C775"/>
        </svg>
        <h2 class="text-gold">{{ copy.header }}</h2>
        <p class="subtitle">{{ copy.body }}</p>

        <div class="prize-reveal">
          <p>
            You have won {{ getArticle(wonGoodie) }}
            <span class="prize-name">{{ wonGoodie }}</span
            >!
          </p>
          <p style="margin-top: 5px">
            Plus an exclusive
            <span class="prize-name">{{ wonDiscount }}</span> discount!
          </p>
        </div>

        <button class="btn-primary" @click="emit('next')">
          {{ copy.button }}
          <svg class="btn-icon" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
      
      <div class="column-right">
        <h3>Features Collected ({{ levelFeatures.length }})</h3>
        <div class="recap-chips">
          <div
            v-for="feature in levelFeatures"
            :key="feature.name"
            class="feature-chip"
            :class="feature.category === 'Admin' ? 'admin-chip' : 'business-chip'"
          >
            {{ feature.name }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed !important;
  z-index: 9999 !important;
  transform: translateZ(0);
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(4, 20, 40, 0.65);
  backdrop-filter: blur(15px) !important;
  -webkit-backdrop-filter: blur(15px) !important;
}
.card {
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
  border-radius: 12px;
  color: #fff;
}

.two-column-card {
  width: 800px;
  max-width: 95%;
  display: flex;
  flex-direction: row;
  gap: 30px;
  padding: 35px;
}

.column-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
}

.column-right {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.column-right h3 {
  font-family: "Goldman", sans-serif;
  color: #f4c775;
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 1.1rem;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  text-align: left;
}

.recap-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  overflow-y: auto;
  max-height: 250px;
  padding-right: 5px;
  align-content: flex-start;
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
h2 {
  font-family: "Goldman", sans-serif;
  font-size: 1.6rem;
  font-weight: 600;
  margin-bottom: 10px;
}
.text-gold {
  color: #f4c775;
}
.subtitle {
  font-family: "Poppins", sans-serif;
  color: #e0e0e0;
  margin-bottom: 15px;
  font-size: 0.95rem;
  line-height: 1.4;
}
.prize-reveal {
  background: rgba(255, 255, 255, 0.1);
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
  border: 1px solid rgba(244, 199, 117, 0.5);
  font-family: "Poppins", sans-serif;
}
.prize-reveal p {
  color: white;
  margin: 0;
  font-size: 1rem;
}
.prize-name {
  color: #f4c775;
  font-weight: 600;
  font-size: 1.1rem;
  text-transform: capitalize;
}
.btn-primary {
  background: linear-gradient(180deg, #6fa6e0 0%, #1561b1 100%);
  color: #fff;
  border: none;
  padding: 12px 25px;
  border-radius: 8px;
  font-family: "Goldman", sans-serif;
  font-weight: 400;
  font-size: 1.05rem;
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
  .two-column-card {
    padding: 25px;
    gap: 20px;
  }
}

@media (max-width: 768px) {
  .two-column-card {
    flex-direction: column;
    padding: 20px;
    gap: 20px;
    max-height: 90vh;
    overflow-y: auto;
  }
  .recap-chips {
    max-height: 150px;
  }
  h2 {
    font-size: 1.4rem;
  }
  .subtitle {
    font-size: 0.9rem;
  }
  .prize-reveal p {
    font-size: 0.9rem;
  }
  .btn-primary {
    font-size: 0.9rem;
    padding: 10px;
  }
}
</style>

