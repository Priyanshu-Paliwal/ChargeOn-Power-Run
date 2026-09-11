<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { gsap } from "gsap";
import { levels, campaignPromo } from "../data/GameContent.js";

const props = defineProps({ stats: Object });
const emit = defineEmits(["retry"]);

const TOTAL_FEATURES = levels.reduce((sum, l) => sum + l.requiredCount, 0);
const collectedCount = computed(
  () => props.stats?.featuresCollected?.length || 0,
);

const displayScore = ref(0);
const featuresListEl = ref(null);
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
  if (featuresListEl.value) {
    gsap.from(featuresListEl.value.children, {
      opacity: 0,
      x: 20,
      duration: 0.3,
      stagger: 0.05,
      delay: 0.2,
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
    <div class="card two-column-card">
      <!-- LEFT COLUMN -->
      <div class="column-left">
        <svg
          class="icon-header"
          width="49"
          height="49"
          viewBox="0 0 49 49"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="24.5"
            cy="24.5"
            r="22.9923"
            stroke="#DC5C53"
            stroke-width="3.01538"
          />
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M24.2881 13.5231C23.5064 13.7103 22.8856 14.1082 22.4534 14.6991C22.2285 15.0065 14.4961 29.0903 14.3805 29.403C14.1781 29.9506 14.1576 30.6575 14.3267 31.2602C14.53 31.9842 15.1589 32.7366 15.8396 33.0699C16.575 33.4299 15.8727 33.4039 24.877 33.4039C33.8892 33.4039 33.1779 33.4305 33.9218 33.0662C35.0104 32.5331 35.6744 31.2775 35.5203 30.0437C35.4949 29.8411 35.4297 29.5549 35.3753 29.4076C35.2592 29.0937 27.5298 15.0131 27.2995 14.6959C26.7541 13.945 25.9337 13.521 24.9712 13.4925C24.6992 13.4845 24.3917 13.4982 24.2881 13.5231ZM24.4155 15.6003C24.3041 15.6555 24.1636 15.7668 24.1032 15.8476C23.975 16.0194 16.4849 29.6304 16.3123 30.0053C16.1269 30.4078 16.2089 30.8067 16.5444 31.1347C16.8583 31.4416 16.3856 31.4251 24.877 31.4251C31.5341 31.4251 32.6188 31.4156 32.8208 31.3556C33.3487 31.1988 33.6603 30.6215 33.4867 30.1215C33.4092 29.8982 25.8201 16.0743 25.6499 15.8465C25.4017 15.5141 24.8229 15.3987 24.4155 15.6003ZM24.4723 19.4281C24.2631 19.5228 23.9891 19.8223 23.9317 20.019C23.8995 20.1295 23.8874 20.974 23.8968 22.4574L23.9111 24.7267L24.0546 24.9309C24.4626 25.512 25.2914 25.512 25.6995 24.9309L25.8429 24.7266V22.359V19.9915L25.7141 19.8071C25.5065 19.5099 25.2913 19.3916 24.9293 19.3758C24.7355 19.3674 24.5629 19.3871 24.4723 19.4281ZM24.6575 27.4173C23.8759 27.6088 23.6222 28.5967 24.2168 29.1339C24.8944 29.746 25.933 29.2125 25.8566 28.2915C25.8084 27.7112 25.2172 27.2801 24.6575 27.4173Z"
            fill="#DC5C53"
          />
        </svg>
        <h2 class="title-main">RUN FAILED!</h2>
        <p class="desc">
          Too many payment blockers slowed you down.<br />Reboot your systems
          and try again
        </p>

        <div class="stats-block">
          <div class="stat-item">
            <div class="stat-icon">
              <!-- Trophy Icon -->
              <svg viewBox="0 0 24 24" width="20" height="20" fill="#FACC15">
                <path
                  d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.002 5.002 0 0 0 11 17.9V19H7v2h10v-2h-4v-1.1a5.002 5.002 0 0 0 3.61-4.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"
                />
              </svg>
            </div>
            <div class="stat-value">{{ displayScore }}</div>
            <div class="stat-label">SCORE</div>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <div class="stat-icon">
              <!-- Level Reached Icon -->
              <svg viewBox="0 0 24 24" width="20" height="20" fill="#3B82F6">
                <path
                  d="M16 4h-2V2h-4v2H8v2h8V4zm-4 8h-4v2h4v-2zm-4 4H4v2h4v-2zm12-4h-4v2h4v-2zm-4-8h-4v2h4V4z"
                />
              </svg>
            </div>
            <div class="stat-value">{{ stats?.currentLevelId || 1 }}</div>
            <div class="stat-label">LEVEL REACHED</div>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <div class="stat-icon">
              <!-- Features Icon -->
              <svg viewBox="0 0 24 24" width="20" height="20" fill="#A855F7">
                <path
                  d="M12 2l-5.5 9h11L12 2zm0 3.84L13.93 9h-3.86L12 5.84zM2 22h20l-5-9H7l-5 9zm5.35-7h9.3l3.33 6H4.02l3.33-6z"
                />
              </svg>
            </div>
            <div class="stat-value">
              {{ collectedCount }} / {{ TOTAL_FEATURES }}
            </div>
            <div class="stat-label">FEATURES COLLECTED</div>
          </div>
        </div>

        <button class="btn-primary" @click="emit('retry')">
          RETURN TO LEADER BOARD
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
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>

      <!-- RIGHT COLUMN -->
      <div class="column-right">
        <h3 class="features-heading">
          FEATURES COLLECTED ({{ collectedCount }})
        </h3>

        <div
          class="features-list"
          ref="featuresListEl"
          v-if="collectedCount > 0"
        >
          <div
            v-for="(feature, idx) in stats.featuresCollected"
            :key="idx"
            class="feature-row"
            :class="{ 'row-odd': idx % 2 === 0, 'row-even': idx % 2 !== 0 }"
          >
            <span>{{ feature.name }}</span>
            <div class="check-icon">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="12" cy="12" r="10" fill="#10B981" />
                <path
                  d="M7.5 12.5L10.5 15.5L16.5 8.5"
                  stroke="white"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>
        <div
          v-else
          class="features-list"
          style="justify-content: center; align-items: center; color: #888"
        >
          No features collected yet.
        </div>

        <!-- Still in the running -->
        <!-- Still in the running -->

        <div class="eligibility-box">
          <img
            :src="
              campaignPromo.gameOverEligibilityBox.image ||
              '/img/run-failed-airpod-img.png'
            "
            alt="Airpods"
            class="eligibility-img"
          />

          <div class="eligibility-content">
            <div class="eligibility-title">
              {{ campaignPromo.gameOverEligibilityBox.title }}
            </div>

            <div class="eligibility-desc">
              {{ campaignPromo.gameOverEligibilityBox.desc }}
              <span
                v-if="campaignPromo.gameOverEligibilityBox.highlight"
                class="highlight-gold"
              >
                {{ campaignPromo.gameOverEligibilityBox.highlight }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800;900&family=Chakra+Petch:wght@700&family=Inter:wght@700&family=Goldman&display=swap");

.game-over-overlay {
  position: fixed !important;
  z-index: 9999 !important;
  transform: translateZ(0);
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(15px) !important;
  -webkit-backdrop-filter: blur(15px) !important;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  box-sizing: border-box;
  font-family: "Plus Jakarta Sans", sans-serif;
}

.card.two-column-card {
  width: 1000px;
  height: 535px;
  background: rgba(0, 0, 0, 0.8);
  border: 4px solid #8e0808;
  border-radius: 16px;
  display: flex;
  flex-direction: row;
  padding: 30px;
  gap: 30px;
  box-sizing: border-box;
  color: #fff;
  animation: dropIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
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

/* LEFT COLUMN */
.column-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.icon-header {
  margin-bottom: 10px;
}

.title-main {
  font-family: "Goldman", sans-serif;
  font-weight: 400;
  font-size: 28.73px;
  color: #dc5c53;
  margin: 0 0 10px 0;
  text-transform: uppercase;
  line-height: 100%;
}

.desc {
  font-family: "Plus Jakarta Sans", sans-serif;
  font-weight: 600;
  font-size: 13px;
  line-height: 16px;
  color: #e2e8f0;
  margin: 0 0 30px 0;
  max-width: 380px;
  text-align: center;
}

/* STATS BLOCK */
.stats-block {
  width: 432px;
  height: 97px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  padding: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  box-sizing: border-box;
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.stat-icon {
  margin-bottom: 2px;
}

.stat-divider {
  width: 1px;
  height: 50px;
  background: rgba(255, 255, 255, 0.15);
}

.stat-value {
  font-family: "Chakra Petch", sans-serif;
  font-weight: 700;
  font-size: 20px;
  line-height: 28px;
  letter-spacing: -0.5px;
  color: #ffffff;
}

.stat-label {
  font-family: "Inter", sans-serif;
  font-weight: 700;
  font-size: 10px;
  line-height: 15px;
  letter-spacing: 0.5px;
  color: #94a3b8;
  text-transform: uppercase;
}

/* BUTTON */
.btn-primary {
  width: 435px;
  height: 54px;
  border-radius: 12px;
  background: linear-gradient(90deg, #2563eb 0%, #3b82f6 50%, #2563eb 100%);
  border: 1px solid rgba(147, 197, 253, 0.3);
  box-shadow:
    inset 0px 1px 0px 1px rgba(255, 255, 255, 0.3),
    0px 4px 20px 0px rgba(37, 99, 235, 0.45);
  font-family: "Plus Jakarta Sans", sans-serif;
  font-weight: 800;
  font-size: 16px;
  line-height: 24px;
  letter-spacing: 0.8px;
  color: #ffffff;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
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
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
}

.features-heading {
  font-family: "Plus Jakarta Sans", sans-serif;
  font-weight: 900;
  font-size: 13px;
  line-height: 16px;
  letter-spacing: 0.65px;
  color: #ffffff;
  text-transform: uppercase;
  margin: 0 0 15px 0;
}

.features-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  width: 100%;
  max-height: 88px;
  overflow-y: auto;
  margin-bottom: 20px;
  padding-right: 4px;
}

.features-list::-webkit-scrollbar {
  width: 4px;
}
.features-list::-webkit-scrollbar-thumb {
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

.row-odd {
  background: #282929;
  box-shadow: 0px 1px 2px 0px rgba(0, 0, 0, 0.05);
}

.row-even {
  background: #6d6d6d;
  border: 1px solid rgba(30, 58, 138, 0.4);
  box-shadow: 0px 1px 2px 0px rgba(0, 0, 0, 0.05);
}

.feature-row span {
  font-family: "Plus Jakarta Sans", sans-serif;
  font-weight: 600;
  font-size: 12px;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  margin-right: 8px;
}

.check-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ELIGIBILITY BOX */
.eligibility-box {
  width: 100%;
  flex: 1;
  min-height: 100px;
  border-radius: 12px;
  background: rgba(8, 13, 22, 0.95);
  border: 1px solid rgba(251, 191, 36, 0.25);
  box-shadow: inset 0px 2px 4px 1px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 20px;
  box-sizing: border-box;
  gap: 15px;
  text-align: center;
}

.eligibility-img-container {
  width: 150px;
  height: 150px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 5px;
}

.reward-glow-bg {
  position: absolute;
  width: 150px;
  height: 150px;
  background: #558dff;
  border-radius: 50%;
  filter: blur(25px);
  z-index: 1;
  opacity: 0.5;
}

.eligibility-img {
  width: 150px;
  height: 150px;
  object-fit: contain;
  image-rendering: high-quality;
  transform: translateZ(0);
  z-index: 2;
  position: relative;
}

.eligibility-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.eligibility-title {
  font-family: "Plus Jakarta Sans", sans-serif;
  font-weight: 800;
  font-size: 16px;
  line-height: 22px;
  letter-spacing: 0.3px;
  color: #facc15;
  text-transform: uppercase;
}

.eligibility-desc {
  font-family: "Plus Jakarta Sans", sans-serif;
  font-weight: 400;
  font-size: 14px;
  line-height: 20px;
  color: #e2e8f0;
}

.highlight-gold {
  color: #facc15;
  font-weight: 600;
}

@media (max-width: 800px) {
  .card.two-column-card {
    flex-direction: column;
    height: auto;
    max-height: 95vh;
    padding: 20px;
    gap: 20px;
    overflow-y: auto;
  }
  .column-left,
  .column-right {
    width: 100%;
  }
  .stats-block,
  .btn-primary {
    width: 100%;
  }
  .features-list {
    max-height: 150px;
  }
  .eligibility-box {
    height: auto;
  }
}
</style>
