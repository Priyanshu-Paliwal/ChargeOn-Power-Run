<script setup>
import { computed, onMounted, onUnmounted } from "vue";
import { levels } from "../data/GameContent.js";

const props = defineProps({
  levelId: Number,
  stats: Object,
  previousGoodies: { type: Array, default: () => [] },
});
const emit = defineEmits(["next"]);

const levelData = computed(() => levels.find((l) => l.id === props.levelId));
const wonGoodie = computed(() => levelData.value?.goodie || "");
const wonDiscount = computed(() => levelData.value?.discount || "");

const levelFeatures = computed(() => {
  const currentLevelData = levels.find((l) => l.id === props.levelId);
  if (!currentLevelData || !props.stats?.featuresCollected) return [];
  const levelFeatureNames = new Set(
    currentLevelData.features.map((f) => f.name),
  );
  return props.stats.featuresCollected.filter((f) =>
    levelFeatureNames.has(f.name),
  );
});

const handleKeyDown = (e) => {
  if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
    emit("next");
    e.preventDefault();
  }
};

onMounted(() => {
  window.addEventListener("keydown", handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown);
});

const copy = computed(() => {
  if (props.levelId === 1) {
    return {
      header: "LEVEL 1 CLEARED!",
      body: "Nice run! You've unlocked your first rewards.",
      button: "CONTINUE TO LEVEL 2",
    };
  } else if (props.levelId === 2) {
    return {
      header: "LEVEL 2 CLEARED!",
      body: "22 more features down. You're moving faster than most payment tools.",
      button: "CONTINUE TO LEVEL 3",
    };
  } else {
    return {
      header: "LEVEL 3 CLEARED!",
      body: "You just caught all 54 ChargeOn features, including our AI assistant.",
      button: "SEE WHAT ELSE YOU WON",
    };
  }
});
</script>

<template>
  <div class="overlay">
    <div class="card two-column-card">
      <!-- LEFT COLUMN -->
      <div class="column-left">
        <!-- Star with decorations -->
        <div class="star-container">
          <!-- Decoration sparks -->
          <div class="spark spark-1"></div>
          <div class="spark spark-2"></div>
          <div class="spark spark-3"></div>
          <div class="spark spark-4"></div>
          <div class="spark spark-5"></div>

          <svg class="icon-header" viewBox="0 0 24 24" width="70" height="70">
            <polygon
              points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
              fill="#F4C775"
            />
          </svg>
        </div>

        <h2 class="text-gold">{{ copy.header }}</h2>
        <p class="subtitle">{{ copy.body }}</p>

        <!-- Reward Box -->
        <div class="prize-reveal">
          <div class="reward-header">
            <span class="gift-icon">🎁</span>
            REWARD UNLOCKED!
          </div>

          <div class="reward-items">
            <!-- CSS Energy Bar -->
            <div class="reward-item">
              <div class="css-energy-bar">
                <div class="wrapper-end left"></div>
                <div class="wrapper-body">
                  <svg
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    class="bar-lightning"
                  >
                    <polygon
                      points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
                      fill="#F4C775"
                    />
                  </svg>
                </div>
                <div class="wrapper-end right"></div>
              </div>
              <span class="reward-name">{{ wonGoodie }}</span>
            </div>

            <div class="reward-plus">+</div>

            <!-- CSS Tag -->
            <div class="reward-item">
              <div class="css-tag">
                <div class="tag-hole"></div>
                <span class="tag-text">{{ parseInt(wonDiscount) }}%</span>
              </div>
              <span class="reward-name"
                >{{ wonDiscount }} OFF ON<br />ChargeOn</span
              >
            </div>
          </div>
        </div>

        <button class="btn-primary" @click="emit('next')">
          {{ copy.button }}
          <svg
            class="btn-icon"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="none"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      <!-- RIGHT COLUMN -->
      <div class="column-right">
        <h3>FEATURES COLLECTED ({{ levelFeatures.length }})</h3>

        <div class="recap-list">
          <div
            v-for="(feature, index) in levelFeatures"
            :key="feature.name"
            class="feature-row"
          >
            <span class="feature-text">{{ feature.name }}</span>

            <!-- Green check icon -->
            <div class="check-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="#4CAF50">
                <circle cx="12" cy="12" r="10" />
                <polyline
                  points="7 12 10.5 15.5 17 8"
                  fill="none"
                  stroke="#fff"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>

        <!-- Still in the running -->
        <div class="still-running-box">
          <div class="trophy-icon">🏆</div>
          <div class="still-running-text">
            <h4>STILL IN THE RUNNING!</h4>
            <p>
              Post your run on LinkedIn, tag Cyntexa, and attach your booth
              selfie.
              <span class="highlight-gold"
                >Highest engagement wins an exclusive gift!</span
              >
            </p>
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
  background: rgb(0 0 0 / 55%);
  backdrop-filter: blur(15px) !important;
  -webkit-backdrop-filter: blur(15px) !important;
  font-family: "Poppins", sans-serif;
}

.card {
  background: linear-gradient(
    135deg,
    rgb(0 0 0 / 25%) 0%,
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
  width: 900px;
  max-width: 95%;
  height: 550px;
  max-height: 90vh;
  display: flex;
  flex-direction: row;
  padding: 30px;
  gap: 30px;
}

/* LEFT COLUMN */
.column-left {
  flex: 0.9;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding-right: 15px;
}

.star-container {
  position: relative;
  margin-bottom: 10px;
  width: 100px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-header {
  filter: drop-shadow(0 0 20px rgba(244, 199, 117, 0.8));
  position: relative;
  z-index: 2;
}

.spark {
  position: absolute;
  width: 6px;
  height: 16px;
  border-radius: 3px;
  background: #f4c775;
  top: 50%;
  left: 50%;
  transform-origin: center -30px;
}
.spark-1 {
  transform: translate(-50%, -50%) rotate(-45deg);
  background: #3b82f6;
  height: 12px;
}
.spark-2 {
  transform: translate(-50%, -50%) rotate(-20deg);
}
.spark-3 {
  transform: translate(-50%, -50%) rotate(0deg);
  background: #3b82f6;
}
.spark-4 {
  transform: translate(-50%, -50%) rotate(20deg);
}
.spark-5 {
  transform: translate(-50%, -50%) rotate(45deg);
  background: #3b82f6;
  height: 12px;
}

h2 {
  font-family: "Goldman", sans-serif;
  font-size: 1.8rem;
  font-weight: 600;
  margin-bottom: 5px;
  letter-spacing: 1px;
}

.text-gold {
  color: #f4c775;
}

.subtitle {
  color: #d1d5db;
  margin-bottom: 25px;
  font-size: 0.95rem;
  line-height: 1.4;
}

/* PRIZE REVEAL BOX */
.prize-reveal {
  background: rgba(0, 0, 0, 0.3);
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 25px;
  border: 2px solid rgba(244, 199, 117, 0.4);
  box-shadow: 0 0 20px rgba(244, 199, 117, 0.1) inset;
  width: 100%;
  position: relative;
}
.prize-reveal::before,
.prize-reveal::after {
  content: "";
  position: absolute;
  width: 10px;
  height: 2px;
  background: #f4c775;
  top: 15px;
}
.prize-reveal::before {
  left: 15px;
  transform: rotate(45deg);
}
.prize-reveal::after {
  right: 15px;
  transform: rotate(-45deg);
}

.reward-header {
  font-family: "Goldman", sans-serif;
  color: #f4c775;
  font-size: 1.1rem;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.reward-items {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
}

.reward-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.reward-plus {
  font-size: 1.5rem;
  font-weight: bold;
  color: #fff;
  margin: 0 10px;
}

.reward-name {
  color: #d1d5db;
  font-size: 0.85rem;
  text-align: center;
  line-height: 1.2;
}

/* CSS Energy Bar */
.css-energy-bar {
  display: flex;
  align-items: center;
  height: 30px;
  transform: rotate(-10deg);
  margin-bottom: 5px;
}
.wrapper-end {
  width: 8px;
  height: 100%;
  background: #f4c775;
}
.wrapper-end.left {
  border-radius: 3px 0 0 3px;
}
.wrapper-end.right {
  border-radius: 0 3px 3px 0;
}
.wrapper-body {
  background: linear-gradient(180deg, #1a71cd 0%, #044fb4 100%);
  height: 110%;
  width: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5);
  z-index: 2;
  border-radius: 2px;
}

/* CSS Discount Tag */
.css-tag {
  width: 50px;
  height: 60px;
  background: linear-gradient(135deg, #1a71cd 0%, #044fb4 100%);
  border-radius: 5px 5px 25px 25px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
  transform: rotate(15deg);
  border: 1px solid rgba(255, 255, 255, 0.2);
}
.css-tag::before {
  content: "";
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  border-bottom-color: transparent;
  border-left-color: transparent;
}
.tag-hole {
  position: absolute;
  top: 8px;
  width: 8px;
  height: 8px;
  background: #0b1423;
  border-radius: 50%;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.8);
}
.tag-text {
  margin-top: 10px;
  font-family: "Goldman", sans-serif;
  font-weight: bold;
  font-size: 1.1rem;
  color: #fff;
}

/* CONTINUE BUTTON */
.btn-primary {
  background: linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 15px 30px;
  border-radius: 8px;
  font-family: "Goldman", sans-serif;
  font-weight: 500;
  font-size: 1.1rem;
  letter-spacing: 1px;
  cursor: pointer;
  width: 100%;
  box-shadow: 0 4px 15px rgba(29, 78, 216, 0.4);
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.btn-primary:hover {
  background: linear-gradient(180deg, #60a5fa 0%, #2563eb 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.6);
}

/* RIGHT COLUMN */
.column-right {
  flex: 1.1;
  display: flex;
  flex-direction: column;
  padding-left: 10px;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
}

.column-right h3 {
  font-family: "Goldman", sans-serif;
  color: #f4c775;
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 1.1rem;
  letter-spacing: 0.5px;
  text-align: left;
}

.recap-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  padding-right: 10px;
  margin-bottom: 15px;
}
.recap-list::-webkit-scrollbar {
  width: 6px;
}
.recap-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.feature-row {
  display: flex;
  align-items: center;
  padding: 10px 15px;
  border-radius: 8px;
  gap: 15px;
}

/* Alternating row colors */
.feature-row:nth-child(odd) {
  background: #0056d2; /* Bright Blue */
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
}
.feature-row:nth-child(even) {
  background: rgba(0, 86, 210, 0.2); /* Transparent Dark Blue */
  border: 1px solid rgba(0, 86, 210, 0.4);
}

.feature-icon-wrapper {
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.feature-text {
  flex: 1;
  font-size: 0.9rem;
  font-weight: 500;
  color: #fff;
}

.check-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* STILL IN THE RUNNING */
.still-running-box {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(244, 199, 117, 0.3);
  border-radius: 10px;
  padding: 15px;
  display: flex;
  align-items: center;
  gap: 15px;
}

.trophy-icon {
  font-size: 2.5rem;
  filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.5));
}

.still-running-text h4 {
  font-family: "Goldman", sans-serif;
  color: #f4c775;
  margin: 0 0 5px 0;
  font-size: 0.95rem;
  letter-spacing: 0.5px;
}

.still-running-text p {
  margin: 0;
  font-size: 0.75rem;
  color: #d1d5db;
  line-height: 1.4;
}

.highlight-gold {
  color: #f4c775;
  font-weight: 600;
}

@media (max-width: 1024px) {
  .two-column-card {
    height: auto;
    flex-direction: column;
    padding: 25px;
    gap: 20px;
  }
  .column-right {
    border-left: none;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding-left: 0;
    padding-top: 20px;
  }
  .recap-list {
    max-height: 250px;
  }
}
</style>
