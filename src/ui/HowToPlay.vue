<script setup>
import { onMounted, onUnmounted, ref } from "vue";
const emit = defineEmits(["next"]);
const step = ref(1);

const handleNext = () => {
  if (step.value === 1) {
    step.value = 2;
  } else {
    emit("next");
  }
};

const handleKeyDown = (e) => {
  if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
    handleNext();
    e.preventDefault();
  }
};
onMounted(() => {
  window.addEventListener("keydown", handleKeyDown);
});
onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown);
});
</script>

<template>
  <div class="overlay">
    <!-- STEP 1 HEADER -->
    <div class="header" v-if="step === 1">
      <h2>HOW TO PLAY</h2>
    </div>

    <div class="boxes-container" v-if="step === 1">
      <!-- Box 1: Left / Right -->
      <div class="glass-box">
        <div class="icons">
          <span class="icon">⬅️</span>
          <span class="icon">➡️</span>
        </div>
        <p>Swipe left or right to switch lanes</p>
      </div>

      <!-- Box 2: Items (Formerly Box 3) -->
      <div class="glass-box">
        <div class="instructions-list">
          <div class="instruction-row">
            <span class="item-icon gold">🪙</span>
            <p>
              <span class="highlight-gold">Gold coins</span> = ChargeOn Features
            </p>
          </div>
          <div class="instruction-row">
            <span class="item-icon blue">🔵</span>
            <p>
              <span class="highlight-blue">Blue coins</span> = High Stakes
              Business USPs
            </p>
          </div>
          <div class="instruction-row">
            <span class="item-icon"
              ><div class="css-coin css-coin-pink"></div
            ></span>
            <p>
              <span class="highlight-pink">Pink coins</span> = Activate Shield &
              Magnet
            </p>
          </div>
          <div class="instruction-row">
            <span class="item-icon red">🚧</span>
            <p>
              <span class="highlight-red">Blockers</span> = Payment Problems
            </p>
          </div>
          <div class="instruction-row">
            <span class="item-icon heart">❤️</span>
            <p>3 lives per level</p>
          </div>
          <div class="instruction-row">
            <span class="item-icon">🛹</span>
            <p>Hoverboard = Prevent 1 Crash</p>
          </div>
          <div class="instruction-row">
            <span class="item-icon">🚀</span>
            <p>Jetpack = Fly to Collect Coins</p>
          </div>
        </div>
      </div>

      <!-- Box 3: Top / Bottom (Formerly Box 2) -->
      <div class="glass-box">
        <div class="icons">
          <span class="icon">⬆️</span>
          <span class="icon">⬇️</span>
        </div>
        <p>Swipe up to jump low blockers</p>
        <p class="subtext">Swipe down to slide under drones</p>
      </div>
    </div>

    <!-- Step 2: Controller Popup -->
    <div v-if="step === 2" class="controller-container glass-box">
      <img
        src="/img/controller.png"
        alt="Game Controller"
        class="controller-img"
      />
    </div>

    <!-- ACTION BUTTON -->
    <div class="action-container" style="justify-content: center; width: 100%">
      <button
        class="btn-primary"
        @click="handleNext"
        title="Click or Press Enter ↵"
      >
        {{ step === 1 ? "NEXT" : "START RUN" }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  width: 100%;
  height: 100%;
  /* Match Landing page dark shade gradient at top and bottom */
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0) 30%),
    linear-gradient(0deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0) 30%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  font-family: "Poppins", sans-serif;
  padding: 20px;
  overflow-y: auto;
  pointer-events: auto;
}

.header {
  margin-bottom: 30px;
  text-align: center;
}

.header h2 {
  font-family: "Goldman", sans-serif;
  font-size: 2.5rem;
  font-weight: 600;
  color: #fff;
  text-transform: uppercase;
  margin: 0;
  text-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
}

.boxes-container {
  display: flex;
  gap: 25px;
  justify-content: center;
  align-items: stretch;
  width: 100%;
  max-width: 1000px;
  margin-bottom: 40px;
}

.glass-box {
  flex: 1;
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
  padding: 30px 20px;
  text-align: center;
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.icons {
  display: flex;
  gap: 15px;
  margin-bottom: 20px;
}

.icon {
  font-size: 2.5rem;
  background: rgba(255, 255, 255, 0.1);
  padding: 10px;
  border-radius: 12px;
  box-shadow: inset 0 0 10px rgba(255, 255, 255, 0.05);
}

.glass-box p {
  font-size: 1.05rem;
  font-weight: 500;
  margin: 0;
  line-height: 1.5;
}

.glass-box .subtext {
  font-size: 0.9rem;
  color: #ccc;
  margin-top: 15px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 15px;
}

.instructions-list {
  display: flex;
  flex-direction: column;
  gap: 25px; /* reduced gap to fit 8 items */
  text-align: left;
  width: 100%;
}

.instruction-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.item-icon {
  font-size: 1.4rem; /* slightly smaller icon */
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.instruction-row p {
  font-size: 0.85rem; /* smaller text */
  font-weight: 500;
  margin: 0;
  line-height: 1.3;
}

.highlight-gold {
  color: #ffd164;
  font-weight: 600;
}

.highlight-red {
  color: #ff3622;
  font-weight: 600;
}

.highlight-pink {
  color: #ff8cbe;
  font-weight: 600;
}

.highlight-blue {
  color: #6fb0ff;
  font-weight: 600;
}

/* Custom CSS Coin for Pink */
.css-coin {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.6);
  box-shadow:
    inset 0 0 5px rgba(0, 0, 0, 0.4),
    0 2px 4px rgba(0, 0, 0, 0.3);
  display: inline-block;
}

.css-coin-pink {
  background: radial-gradient(circle at 35% 35%, #ffb6c1, #ff1493);
}

.action-container {
  display: flex;
}

.btn-primary {
  background: linear-gradient(180deg, #6fa6e0 0%, #1561b1 100%);
  color: #fff;
  border: none;
  padding: 15px 50px;
  border-radius: 8px;
  font-family: "Goldman", sans-serif;
  font-weight: 400;
  font-size: 1.3rem;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: linear-gradient(180deg, #81b4e9 0%, #1a71cd 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
}

.btn-primary:active {
  transform: translateY(0);
}

@media (max-width: 900px) {
  .boxes-container {
    flex-direction: column;
    max-width: 500px;
    gap: 15px;
  }
  .glass-box {
    padding: 20px;
  }
}

@media (max-height: 750px) {
  .header {
    margin-bottom: 15px;
  }
  .header h2 {
    font-size: 2rem;
  }
  .boxes-container {
    margin-bottom: 20px;
  }
  .glass-box {
    padding: 15px;
  }
  .icon {
    font-size: 2rem;
    padding: 8px;
  }
  .glass-box p {
    font-size: 0.95rem;
  }
}

.controller-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 30px;
  width: 100%;
  max-width: 720px;
  max-height: max-content;
  margin-bottom: 30px;
}

.controller-img {
  width: 100%;
  height: auto;
  object-fit: contain;
  border-radius: 12px;
}
</style>
