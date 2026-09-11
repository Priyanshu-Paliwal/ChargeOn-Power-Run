<script setup>
import { onMounted, onUnmounted } from "vue";
import { campaignPromo } from "../data/GameContent.js";
import { audioManager } from "../game/systems/AudioManager.js";
import confetti from "canvas-confetti";

const emit = defineEmits(["next"]);

let celebrationInterval = null;
let ambientInterval = null;
const timers = [];

const addTimer = (fn, delay) => {
  const id = setTimeout(fn, delay);
  timers.push(id);
  return id;
};

const clearAllCelebration = () => {
  timers.forEach((t) => clearTimeout(t));
  timers.length = 0;
  if (celebrationInterval) {
    clearInterval(celebrationInterval);
    celebrationInterval = null;
  }
  if (ambientInterval) {
    clearInterval(ambientInterval);
    ambientInterval = null;
  }
};

const launchCelebration = () => {
  clearAllCelebration();

  // Vibrant celebration palette: Cyan, Gold, Blue, Emerald, Neon Pink, Purple, White
  const fullPalette = [
    "#00E5FF",
    "#FACC15",
    "#3B82F6",
    "#10B981",
    "#EC4899",
    "#A855F7",
    "#FFFFFF",
  ];
  const goldPalette = ["#FACC15", "#FFD700", "#FFE57F", "#FFFFFF", "#00E5FF"];

  // Victory audio chime
  try {
    audioManager.playSFX("levelComplete");
  } catch (e) {
    // Audio context may require prior interaction
  }

  // -------------------------------------------------------------
  // ACT 1: The Grand Opening Blast (0ms)
  // Two high-power corner party poppers crossing overhead
  // -------------------------------------------------------------
  confetti({
    particleCount: 80,
    angle: 60,
    spread: 70,
    origin: { x: 0.04, y: 0.85 },
    colors: fullPalette,
    zIndex: 10001,
    startVelocity: 58,
  });

  confetti({
    particleCount: 80,
    angle: 120,
    spread: 70,
    origin: { x: 0.96, y: 0.85 },
    colors: fullPalette,
    zIndex: 10001,
    startVelocity: 58,
  });

  // Center golden starburst directly over the card
  addTimer(() => {
    confetti({
      particleCount: 90,
      spread: 110,
      origin: { x: 0.5, y: 0.32 },
      colors: goldPalette,
      zIndex: 10001,
      startVelocity: 40,
      scalar: 1.2,
    });
  }, 350);

  // -------------------------------------------------------------
  // ACT 2: The Cascading Wave / Roman Candle Sweeps (1.2s - 2.6s)
  // Sweeps across the screen from left to right like stadium fireworks
  // -------------------------------------------------------------
  const wavePoints = [
    { x: 0.18, angle: 70, delay: 1200 },
    { x: 0.38, angle: 80, delay: 1550 },
    { x: 0.62, angle: 100, delay: 1900 },
    { x: 0.82, angle: 110, delay: 2250 },
  ];

  wavePoints.forEach((pt) => {
    addTimer(() => {
      confetti({
        particleCount: 45,
        angle: pt.angle,
        spread: 55,
        origin: { x: pt.x, y: 0.8 },
        colors: fullPalette,
        zIndex: 10001,
        startVelocity: 50,
      });
    }, pt.delay);
  });

  // -------------------------------------------------------------
  // ACT 3: Grand Mid-Show Dual Super-Burst (3.0s)
  // Massive synchronized burst meeting high in the sky
  // -------------------------------------------------------------
  addTimer(() => {
    confetti({
      particleCount: 70,
      angle: 55,
      spread: 80,
      origin: { x: 0.08, y: 0.7 },
      colors: goldPalette,
      zIndex: 10001,
      startVelocity: 52,
      scalar: 1.1,
    });
    confetti({
      particleCount: 70,
      angle: 125,
      spread: 80,
      origin: { x: 0.92, y: 0.7 },
      colors: goldPalette,
      zIndex: 10001,
      startVelocity: 52,
      scalar: 1.1,
    });
  }, 3000);

  // -------------------------------------------------------------
  // ACT 4: Shimmering Gold & Cyan Confetti Rain (Infinite)
  // Slow-floating feather drift gently descending across the screen
  // -------------------------------------------------------------
  addTimer(() => {
    celebrationInterval = setInterval(() => {
      // Alternating gentle clouds of floating sparkles
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 60,
        origin: { x: 0.02, y: 0.3 },
        colors: fullPalette,
        zIndex: 10001,
        startVelocity: 24,
        gravity: 0.65,
        ticks: 250,
        scalar: 0.9,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 60,
        origin: { x: 0.98, y: 0.3 },
        colors: fullPalette,
        zIndex: 10001,
        startVelocity: 24,
        gravity: 0.65,
        ticks: 250,
        scalar: 0.9,
      });
      // Soft drift from top
      confetti({
        particleCount: 2,
        angle: 90,
        spread: 90,
        origin: { x: Math.random() * 0.8 + 0.1, y: -0.05 },
        colors: goldPalette,
        zIndex: 10001,
        startVelocity: 15,
        gravity: 0.6,
        ticks: 300,
        scalar: 1.0,
      });
    }, 240);
  }, 3500);
};

const handleKeyDown = (e) => {
  if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
    emit("next");
    e.preventDefault();
  }
};

onMounted(() => {
  window.addEventListener("keydown", handleKeyDown);
  launchCelebration();
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown);
  clearAllCelebration();
  confetti.reset();
});
</script>

<template>
  <div class="overlay">
    <div class="card new-two-column-card">
      <!-- LEFT COLUMN -->
      <div class="column-left">
        <div class="airpods-showcase">
          <div class="glow-effect"></div>
          <img
            :src="campaignPromo.offerReveal.image || '/img/airpods.png'"
            alt="AirPods"
            class="airpods-image"
          />
        </div>
      </div>

      <!-- RIGHT COLUMN -->
      <div class="column-right">
        <div class="star-container">
          <div class="star-glow-bg"></div>
          <svg
            class="icon-header"
            viewBox="0 0 24 24"
            width="60"
            height="60"
          >
            <path
              d="M20 12v10H4V12M22 7H2v5h20V7zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"
              fill="none"
              stroke="#FACC15"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <h2 class="title-main">{{ campaignPromo.offerReveal.title }}</h2>

        <div class="instructions-box">
          <p class="to-earn">
            {{ campaignPromo.offerReveal.instructionsHeader }}
          </p>
          <ul class="task-list">
            <li
              v-for="(task, idx) in campaignPromo.offerReveal.tasks"
              :key="idx"
            >
              <svg
                v-if="task.isLinkedIn"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="currentColor"
                class="linkedin-icon"
              >
                <path
                  d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"
                />
              </svg>
              <span v-else class="bullet"></span>
              {{ task.text }}
              <strong v-if="task.highlight">{{ task.highlight }}</strong>
            </li>
          </ul>
          <div class="highlight-box">
            <p class="highlight-gold">
              {{ campaignPromo.offerReveal.highlightBox }}
            </p>
          </div>
        </div>

        <button class="btn-primary" @click="emit('next')">
          {{ campaignPromo.offerReveal.buttonText || "SEE MY RESULTS" }}
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
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
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
  background: rgb(0 0 0 / 65%);
  backdrop-filter: blur(20px) !important;
  -webkit-backdrop-filter: blur(20px) !important;
  font-family: "Plus Jakarta Sans", sans-serif;
}

.new-two-column-card {
  width: 940px;
  height: 504px;
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
  animation: floatIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}

@keyframes floatIn {
  0% { opacity: 0; transform: translateY(30px) scale(0.95); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

/* LEFT COLUMN */
.column-left {
  flex: 0.9;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding-right: 15px;
}

/* RIGHT COLUMN */
.column-right {
  flex: 1.1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  padding-left: 15px;
}

.star-container {
  position: relative;
  display: none;
  justify-content: center;
  align-items: center;
  margin-bottom: 25px;
  width: 82px;
  height: 82px;
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

.icon-header {
  position: relative;
  z-index: 2;
  filter: drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.5));
}

.title-main {
  font-family: "Plus Jakarta Sans", sans-serif;
  font-size: 26px;
  font-weight: 900;
  margin-top: 0;
  margin-bottom: 15px;
  letter-spacing: 0.65px;
  color: #FACC15;
  text-transform: uppercase;
  line-height: 1.3;
  text-align: left;
  width: 100%;
  text-shadow: 0 0 25px rgba(250, 204, 21, 0.35);
}

.btn-primary {
  width: 419px;
  max-width: 100%;
  height: 54px;
  border-radius: 12px;
  background: linear-gradient(90deg, #2563EB 0%, #3B82F6 50%, #2563EB 100%);
  border: 1px solid rgba(147, 197, 253, 0.3);
  box-shadow: inset 0px 1px 0px 1px rgba(255, 255, 255, 0.3), 0px 4px 20px 0px rgba(37, 99, 235, 0.45);
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
  transition: all 0.2s;
  margin-top: 15px;
}

.btn-primary:hover {
  background: linear-gradient(90deg, #3B82F6 0%, #60A5FA 50%, #3B82F6 100%);
  transform: translateY(-2px);
}

.btn-primary:active {
  transform: translateY(0);
}

.airpods-showcase {
  position: relative;
  width: 250px;
  height: 250px;
  margin: 0 auto;
  border-radius: 16px;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: inset 0 2px 10px rgba(0,0,0,0.2);
}

.glow-effect {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 160px;
  height: 160px;
  background: #ffffff;
  border-radius: 50%;
  filter: blur(35px);
  z-index: 1;
  opacity: 0.8;
}

.airpods-image {
  position: relative;
  width: 180px;
  height: 180px;
  object-fit: contain;
  z-index: 2;
  filter: drop-shadow(0 10px 15px rgba(0, 0, 0, 0.5));
}

.instructions-box {
  background: rgba(8, 13, 22, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 20px;
  border-radius: 12px;
  text-align: left;
  width: 100%;
}

.to-earn {
  font-family: "Plus Jakarta Sans", sans-serif;
  font-weight: 700;
  color: #ffffff;
  margin-top: 0;
  margin-bottom: 12px;
  font-size: 14px;
}

.task-list {
  list-style: none;
  padding: 0;
  margin: 0 0 15px 0;
}

.task-list li {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  font-size: 13px;
  color: #CBD5E1;
  font-weight: 500;
}

.task-list li strong {
  color: #ffffff;
  font-weight: 700;
  margin-left: 4px;
}

.linkedin-icon {
  color: #0077b5;
  margin-right: 10px;
}

.bullet {
  width: 6px;
  height: 6px;
  background: #FACC15;
  border-radius: 50%;
  margin: 0 15px 0 5px;
  box-shadow: 0 0 5px rgba(250, 204, 21, 0.5);
}

.highlight-box {
  background: rgba(250, 204, 21, 0.05);
  border-left: 3px solid #FACC15;
  padding: 12px 15px;
  border-radius: 0 6px 6px 0;
}

.highlight-gold {
  color: #FACC15;
  font-weight: 700;
  font-size: 12px;
  line-height: 1.4;
  margin: 0;
}

@media (max-width: 800px) {
  .new-two-column-card {
    flex-direction: column;
    height: auto;
    max-height: 95vh;
    padding: 20px;
    gap: 20px;
    overflow-y: auto;
  }
  .column-left {
    padding-right: 0;
  }
  .column-right {
    padding-left: 0;
    border-left: none;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding-top: 20px;
  }
  .btn-primary {
    margin-top: 15px;
    width: 100%;
  }
}
</style>
