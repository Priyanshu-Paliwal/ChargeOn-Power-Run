<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { levels, campaignPromo } from "../data/GameContent.js";

const props = defineProps({
  levelId: Number,
  stats: Object,
  previousGoodies: { type: Array, default: () => [] },
});
const emit = defineEmits(["next"]);

const levelData = computed(() => levels.find((l) => l.id === props.levelId));
const wonGoodie = computed(() => levelData.value?.goodie || "");
const wonGoodieImage = computed(() => levelData.value?.goodieImage || "");
const wonDiscount = computed(() => levelData.value?.discount || "");
const wonDiscountImage = computed(() => levelData.value?.discountImage || "");

const formattedDiscountText = computed(() => {
  const discount = wonDiscount.value;
  if (!discount) return "";
  if (discount.toLowerCase().includes("off")) {
    return `${discount} on <span style="text-transform: none;">ChargeOn</span>`;
  }
  return `${discount} Off on <span style="text-transform: none;">ChargeOn</span>`;
});

const levelFeatures = computed(() => {
  const currentLevelData = levels.find((l) => l.id === props.levelId);
  if (!currentLevelData || !props.stats?.featuresCollected) return [];
  const levelFeatureKeys = new Set(
    currentLevelData.features.map((f) => `${f.name}|${f.category}`),
  );
  return props.stats.featuresCollected.filter((f) =>
    levelFeatureKeys.has(`${f.name}|${f.category}`),
  );
});

const isCountingDown = ref(false);
const countdown = ref(0);
let timer = null;

const handleContinue = () => {
  if (isCountingDown.value) return;

  if (props.levelId === 3) {
    emit("next");
    return;
  }

  isCountingDown.value = true;
  countdown.value = 3;

  timer = setInterval(() => {
    countdown.value--;
    if (countdown.value === 0) {
      clearInterval(timer);
      emit("next");
    }
  }, 1000);
};

const handleKeyDown = (e) => {
  if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
    handleContinue();
    e.preventDefault();
  }
};

onMounted(() => {
  window.addEventListener("keydown", handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown);
  if (timer) clearInterval(timer);
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
  <div class="overlay" :class="{ 'transparent-overlay': isCountingDown }">
    <div v-if="!isCountingDown" class="card new-two-column-card">
      <!-- LEFT COLUMN -->
      <div class="column-left">
        <!-- Star with decorations -->
        <div class="star-container">
          <div class="star-glow-bg"></div>
          <svg
            width="49"
            height="47"
            viewBox="0 0 49 47"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            class="star-icon"
          >
            <path
              d="M24.1605 0.47998L31.2005 15.84L47.8405 17.76L35.0405 29.28L38.8805 45.92L24.1605 36.96L9.44047 45.92L13.2805 29.28L0.480469 17.76L17.1205 15.84L24.1605 0.47998Z"
              fill="url(#paint0_linear_1081_120)"
              stroke="#FEF08A"
              stroke-width="0.96"
              stroke-linejoin="round"
            />
            <path
              d="M24.1602 4.31982L29.2802 16.4798L42.0802 17.7598L31.8402 27.3598L35.0402 40.1598L24.1602 33.1198L13.2802 40.1598L16.4802 27.3598L6.24023 17.7598L19.0402 16.4798L24.1602 4.31982"
              stroke="white"
              stroke-opacity="0.35"
              stroke-width="0.768"
            />
            <defs>
              <linearGradient
                id="paint0_linear_1081_120"
                x1="0.480469"
                y1="0.47998"
                x2="45.8816"
                y2="47.7995"
                gradientUnits="userSpaceOnUse"
              >
                <stop stop-color="#FEF08A" />
                <stop offset="0.45" stop-color="#FACC15" />
                <stop offset="0.85" stop-color="#CA8A04" />
                <stop offset="1" stop-color="#854D0E" />
              </linearGradient>
            </defs>
          </svg>
          <svg
            width="49"
            height="47"
            viewBox="0 0 49 47"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M24.1605 0.47998L31.2005 15.84L47.8405 17.76L35.0405 29.28L38.8805 45.92L24.1605 36.96L9.44047 45.92L13.2805 29.28L0.480469 17.76L17.1205 15.84L24.1605 0.47998Z"
              fill="url(#paint0_linear_1081_120)"
              stroke="#FEF08A"
              stroke-width="0.96"
              stroke-linejoin="round"
            />
            <path
              d="M24.1602 4.31982L29.2802 16.4798L42.0802 17.7598L31.8402 27.3598L35.0402 40.1598L24.1602 33.1198L13.2802 40.1598L16.4802 27.3598L6.24023 17.7598L19.0402 16.4798L24.1602 4.31982"
              stroke="white"
              stroke-opacity="0.35"
              stroke-width="0.768"
            />
          </svg>
          <svg
            width="49"
            height="47"
            viewBox="0 0 49 47"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M24.1605 0.47998L31.2005 15.84L47.8405 17.76L35.0405 29.28L38.8805 45.92L24.1605 36.96L9.44047 45.92L13.2805 29.28L0.480469 17.76L17.1205 15.84L24.1605 0.47998Z"
              fill="url(#paint0_linear_1081_120)"
              stroke="#FEF08A"
              stroke-width="0.96"
              stroke-linejoin="round"
            />
            <path
              d="M24.1602 4.31982L29.2802 16.4798L42.0802 17.7598L31.8402 27.3598L35.0402 40.1598L24.1602 33.1198L13.2802 40.1598L16.4802 27.3598L6.24023 17.7598L19.0402 16.4798L24.1602 4.31982"
              stroke="white"
              stroke-opacity="0.35"
              stroke-width="0.768"
            />
          </svg>
        </div>

        <h2 class="text-cleared">{{ copy.header }}</h2>
        <p class="subtitle">{{ copy.body }}</p>

        <!-- Reward Box -->
        <div class="prize-reveal">
          <div class="corner top-left"></div>
          <div class="corner top-right"></div>
          <div class="corner bottom-left"></div>
          <div class="corner bottom-right"></div>

          <div class="reward-header">
            <span class="gift-icon">🎁</span>
            REWARD UNLOCKED!
          </div>

          <div
            class="reward-items"
            :class="{ 'single-item': !wonGoodie || !wonDiscount }"
          >
            <!-- Goodie Item (Hidden if goodie is null or empty) -->
            <div v-if="wonGoodie" class="reward-item">
              <div class="reward-img-container">
                <div class="reward-glow-bg"></div>
                <img
                  v-if="wonGoodieImage"
                  :src="wonGoodieImage"
                  :alt="wonGoodie"
                  class="reward-image"
                />
              </div>
              <span class="reward-name">{{ wonGoodie }}</span>
            </div>
            <!-- Discount Tag -->
            <div v-if="wonDiscount" class="reward-item">
              <div class="reward-img-container">
                <div class="reward-glow-bg"></div>
                <img
                  v-if="wonDiscountImage"
                  :src="wonDiscountImage"
                  alt="Discount"
                  class="reward-image"
                />
                <div v-else class="css-discount-badge">
                  <span>{{ parseInt(wonDiscount) }}<small>%</small></span>
                </div>
              </div>
              <span class="reward-name" v-html="formattedDiscountText"></span>
            </div>
          </div>
        </div>

        <button class="btn-primary" @click="handleContinue">
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

        <div class="recap-list" :class="{ 'full-height': props.levelId === 3 }">
          <div
            v-for="(feature, index) in levelFeatures"
            :key="feature.name"
            class="feature-row"
            :class="index % 2 === 0 ? 'row-even' : 'row-odd'"
          >
            <span class="feature-text">{{ feature.name }}</span>

            <div class="check-icon">
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect width="20" height="20" rx="10" fill="#10B981" />
                <path
                  d="M5.91699 10.5835L8.25033 12.9168L14.0837 7.0835"
                  stroke="white"
                  stroke-width="1.75"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>

        <!-- Still in the running -->
        <div v-if="props.levelId !== 3" class="still-running-box">
          <div class="trophy-icon">🏆</div>
          <div class="still-running-text">
            <h4>{{ campaignPromo.levelCompleteRunningBox.title }}</h4>
            <p>
              {{ campaignPromo.levelCompleteRunningBox.desc }}
              <span
                v-if="campaignPromo.levelCompleteRunningBox.highlight"
                class="highlight-gold"
              >
                {{ campaignPromo.levelCompleteRunningBox.highlight }}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="countdown > 0" class="countdown-display">
      {{ countdown }}
    </div>
  </div>
</template>

<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700;800;900&display=swap");

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
  font-family: "Plus Jakarta Sans", sans-serif;
}

.transparent-overlay {
  background: transparent !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

.countdown-display {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 8rem;
  font-family: "Goldman", sans-serif;
  font-weight: 800;
  color: #ffffff;
  animation: pulse 1s infinite;
  text-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
  z-index: 20;
}

@keyframes pulse {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.1);
    opacity: 0.8;
  }
  100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
}

.new-two-column-card {
  width: 1000px;
  height: 535px;
  max-width: 95%;
  max-height: 90vh;
  border-radius: 16px;
  background: rgba(12, 16, 25, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: row;
  padding: 30px;
  gap: 30px;
  box-shadow: 0px 4px 45px 0px rgba(0, 0, 0, 0.45);
}

/* LEFT COLUMN */
.column-left {
  flex: 0.9;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  width: 419px;
}

.star-container {
  position: relative;
  margin-top: 10px;
  margin-bottom: 5px;
  width: 200px;
  height: 80px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
}

.star-glow-bg {
  position: absolute;
  width: 82px;
  height: 82px;
  border-radius: 50%;
  filter: blur(24px);
  z-index: 1;
  opacity: 1;
  background: #fbbf2487;
}

.star-icon {
  position: relative;
  z-index: 2;
  filter: drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.5));
}

.star-small-left {
  position: absolute;
  left: 0;
  top: 15px;
  transform: scale(0.7) rotate(-15deg);
}

.star-small-right {
  position: absolute;
  right: 0;
  top: 15px;
  transform: scale(0.7) rotate(15deg);
}

.text-cleared {
  font-family: "Plus Jakarta Sans", sans-serif;
  font-weight: 800;
  font-size: 27px;
  line-height: 32px;
  letter-spacing: 0.68px;
  text-align: center;
  text-transform: uppercase;
  color: #fde047;
  text-shadow: 0px 2px 10px rgba(250, 204, 21, 0.3);
  margin-bottom: 5px;
  margin-top: 10px;
}

.subtitle {
  font-family: "Plus Jakarta Sans", sans-serif;
  font-weight: 500;
  font-size: 14px;
  line-height: 20px;
  text-align: center;
  color: #cbd5e1;
  margin-bottom: 25px;
}

/* PRIZE REVEAL BOX */
.prize-reveal {
  width: 419px;
  height: 174px;
  border-radius: 12px;
  background: rgba(8, 13, 22, 0.95);
  border: 1px solid rgba(251, 191, 36, 0.25);
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 15px;
  margin-bottom: 20px;
  max-width: 100%;
}

.corner {
  position: absolute;
  width: 10px;
  height: 10px;
  border: 2px solid #facc15;
}
.corner.top-left {
  top: -1px;
  left: -1px;
  border-right: none;
  border-bottom: none;
  border-radius: 4px 0 0 0;
}
.corner.top-right {
  top: -1px;
  right: -1px;
  border-left: none;
  border-bottom: none;
  border-radius: 0 4px 0 0;
}
.corner.bottom-left {
  bottom: -1px;
  left: -1px;
  border-right: none;
  border-top: none;
  border-radius: 0 0 0 4px;
}
.corner.bottom-right {
  bottom: -1px;
  right: -1px;
  border-left: none;
  border-top: none;
  border-radius: 0 0 4px 0;
}

.reward-header {
  font-family: "Plus Jakarta Sans", sans-serif;
  font-weight: 700;
  font-size: 14px;
  line-height: 16px;
  letter-spacing: 0.65px;
  text-align: center;
  text-transform: uppercase;
  color: #facc15;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.reward-items {
  display: flex;
  align-items: center;
  justify-content: space-around;
  width: 100%;
  padding: 0 20px;
}

.reward-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.reward-items.single-item {
  justify-content: center;
}

.reward-img-container {
  width: 72px;
  height: 72px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.reward-glow-bg {
  position: absolute;
  width: 82px;
  height: 82px;
  background: #558dff;
  border-radius: 50%;
  filter: blur(15px);
  z-index: 1;
  opacity: 0.5;
}

.reward-image {
  max-width: 100px;
  max-height: 80px;
  z-index: 2;
  object-fit: contain;
  transform: rotate(-15deg);
}

.css-discount-badge {
  width: 50px;
  height: 50px;
  background: #3b82f6;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  box-shadow:
    inset 0 -4px 10px rgba(0, 0, 0, 0.3),
    0 4px 10px rgba(0, 0, 0, 0.3);
  border: 2px solid #60a5fa;
  clip-path: polygon(
    50% 0%,
    90% 20%,
    100% 60%,
    75% 100%,
    25% 100%,
    0% 60%,
    10% 20%
  );
}

.css-discount-badge span {
  font-family: "Plus Jakarta Sans", sans-serif;
  font-weight: 900;
  color: white;
  font-size: 22px;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
}

.css-discount-badge small {
  font-size: 14px;
}

.reward-name {
  font-family: "Plus Jakarta Sans", sans-serif;
  font-weight: 700;
  color: #ffffff;
  font-size: 11px;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* BUTTON */
.btn-primary {
  width: 419px;
  max-width: 100%;
  height: 54px;
  border-radius: 12px;
  background: linear-gradient(90deg, #2563eb 0%, #3b82f6 50%, #2563eb 100%);
  border: 1px solid rgba(147, 197, 253, 0.3); /* #93C5FD4D */
  box-shadow:
    inset 0px 1px 0px 1px rgba(255, 255, 255, 0.3),
    0px 4px 20px 0px rgba(37, 99, 235, 0.45);
  color: #fff;
  font-family: "Plus Jakarta Sans", sans-serif;
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 0.5px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: auto;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 50%, #3b82f6 100%);
  transform: translateY(-2px);
}

.btn-primary:active {
  transform: translateY(0);
}

/* RIGHT COLUMN */
.column-right {
  flex: 1.1;
  display: flex;
  flex-direction: column;
}

.column-right h3 {
  font-family: "Plus Jakarta Sans", sans-serif;
  font-weight: 900;
  font-size: 13px;
  line-height: 16px;
  letter-spacing: 0.65px;
  text-transform: uppercase;
  color: #facc15;
  margin-top: 0;
  margin-bottom: 12px;
}

.recap-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  width: 100%;
  max-height: 88px;
  overflow-y: auto;
  margin-bottom: 20px;
  padding-right: 4px;
}

.recap-list.full-height {
  max-height: none;
  flex: 1;
  grid-template-columns: 1fr;
}

.recap-list::-webkit-scrollbar {
  width: 4px;
}
.recap-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.feature-row {
  width: 100%;
  height: 40px;
  border-radius: 8px;
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-sizing: border-box;
  min-width: 0;
}

.row-even {
  background: #1150c7;
  box-shadow: 0px 1px 2px 0px rgba(0, 0, 0, 0.05);
  border: 1px solid transparent;
}

.row-odd {
  background: #14233e;
  border: 1px solid rgba(30, 58, 138, 0.4); /* #1E3A8A66 */
}

.feature-text {
  font-family: "Plus Jakarta Sans", sans-serif;
  font-weight: 600;
  font-size: 12px;
  color: #fff;
  letter-spacing: 0.3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  margin-right: 8px;
}

/* STILL IN THE RUNNING */
.still-running-box {
  width: 100%;
  flex: 1;
  min-height: 80px;
  border-radius: 12px;
  background: rgba(8, 13, 22, 0.95);
  border: 1px solid rgba(251, 191, 36, 0.25);
  box-shadow: inset 0px 2px 4px 1px rgba(0, 0, 0, 0.05);
  padding: 20px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 15px;
  text-align: center;
}

.trophy-icon {
  font-size: 80px;
  filter: drop-shadow(0 2px 4px rgba(250, 204, 21, 0.4));
  margin-bottom: 10px;
}

.still-running-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.still-running-text h4 {
  font-family: "Plus Jakarta Sans", sans-serif;
  font-weight: 800;
  font-size: 24px;
  line-height: 22px;
  color: #facc15;
  margin: 0;
}

.still-running-text p {
  font-family: "Plus Jakarta Sans", sans-serif;
  font-weight: 400;
  font-size: 16px;
  line-height: 20px;
  color: #cbd5e1;
  margin: 0;
}

.highlight-gold {
  color: #fde047;
}

@media (max-width: 900px) {
  .new-two-column-card {
    flex-direction: column;
    height: auto;
    max-height: 95vh;
    padding: 20px;
    overflow-y: auto;
  }
  .column-left {
    width: 100%;
    margin-bottom: 20px;
  }
  .prize-reveal {
    width: 100%;
  }
  .btn-primary {
    width: 100%;
    margin-top: 20px;
  }
  .recap-list {
    min-height: 200px;
  }
}
</style>
