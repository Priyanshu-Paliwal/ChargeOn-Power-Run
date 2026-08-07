<script setup>
import { ref, computed, onMounted, inject } from "vue";

const props = defineProps({
  userData: {
    type: Object,
    default: () => ({ name: "Unknown", company: "" }),
  },
});

const emit = defineEmits(["start", "character-selected"]);

const musicState = inject('musicState');

const selectedVariant = ref(3); // Default to Beige Suit
const variants = [
  { id: 0, name: "Gold Standard", color: "#ffd164" },
  { id: 1, name: "ChargeOn Blue", color: "#00B0FF" },
  { id: 2, name: "Clean White", color: "#FFFFFF" },
  { id: 3, name: "Beige Suit", color: "#D2B48C" },
];

const selectCharacter = (id) => {
  selectedVariant.value = id;
  emit("character-selected", id);
};

// Dynamic leaderboard
const leaderboard = ref([]);

onMounted(() => {
  const stored = localStorage.getItem("chargeon_leaderboard");
  if (stored) {
    try {
      leaderboard.value = JSON.parse(stored);
    } catch (e) {}
  }

  // If empty, supply default mocks
  if (leaderboard.value.length === 0) {
    leaderboard.value = [
      { rank: 1, name: "S. Smith", score: "01:12" },
      { rank: 2, name: "A. Johnson", score: "01:15" },
      {
        rank: 3,
        name: props.userData.name !== "Unknown" ? props.userData.name : "You",
        score: "--:--",
      },
      { rank: 4, name: "M. Lee", score: "01:21" },
      { rank: 5, name: "K. Davis", score: "01:25" },
    ];
  } else {
    // Add rank property based on index
    leaderboard.value = leaderboard.value.map((entry, idx) => ({
      ...entry,
      rank: idx + 1,
    }));
  }
});
</script>

<template>
  <div class="lobby-dashboard">
    <!-- Top Bar -->
    <header class="top-bar">
      <div class="logo-container">
        <img
          src="/img/chargeon-Logo.webp"
          alt="ChargeOn Logo"
          class="logo"
        />
      </div>
      <div class="profile-container">
        <div class="top-stats">
          <button v-if="musicState" class="music-toggle-btn" @click="musicState.toggleMusic()" :title="musicState.isMusicPlaying.value ? 'Pause Music' : 'Play Music'">
            {{ musicState.isMusicPlaying.value ? '🔊' : '🔇' }}
          </button>
          <div class="stat-box">DREAMFORCE '26</div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="dashboard-grid">
      <!-- Left Panel: Info & Leaderboard -->
      <section class="left-panel">
        <h3 class="panel-subtitle">SALESFORCE NATIVE</h3>
        <h1 class="panel-title">CHARGEON POWER RUN</h1>
        <p class="panel-desc">
          Outrun every payment problem. Unlock exciting goodies at every level,
          plus an exclusive ChargeOn offer when you finish.
        </p>

        <div class="leaderboard">
          <h4 class="text-dim">TOP AGENTS</h4>
          <ul>
            <li
              v-for="(entry, index) in leaderboard"
              :key="index"
              :class="{
                'rank-gold': index === 0,
                'rank-highlight': entry.name === props.userData.name,
              }"
            >
              <span class="rank">{{ entry.rank }}</span>
              <span class="name">{{ entry.name }}</span>
              <span class="score">{{ entry.score }}</span>
            </li>
          </ul>
        </div>
      </section>

      <!-- Right Panel: Character Selector -->
      <section class="right-panel">
        <div class="character-selector">
          <h3>SELECT AGENT</h3>
          <div class="char-options">
            <button
              v-for="variant in variants"
              :key="variant.id"
              class="char-btn"
              :class="{ active: selectedVariant === variant.id }"
              @click="selectCharacter(variant.id)"
            >
              <div
                class="color-swatch"
                :style="{ backgroundColor: variant.color }"
              ></div>
              <span>{{ variant.name }}</span>
            </button>
          </div>
        </div>
      </section>
    </main>

    <!-- Bottom Actions -->
    <footer class="bottom-bar">
      <div class="compliance-badges">
        <span>● PCI-DSS Compliant</span>
        <span>● AppExchange Listed</span>
      </div>

      <div class="action-buttons">
        <button class="btn-primary" @click="emit('start')">START RUN</button>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.lobby-dashboard {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  /* Transparent background to see 3D scene */
  background: transparent;
  color: #0d2d40;
  font-family: "Roboto", sans-serif;
  padding: 20px;
  box-sizing: border-box;
}

/* TOP BAR */
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.logo-container .logo {
  height: 50px;
  object-fit: contain;
}

.profile-container {
  display: flex;
  gap: 15px;
  align-items: center;
}

.profile-display {
  display: flex;
  align-items: center;
  background: #ffffff;
  border: 1px solid rgba(13, 45, 64, 0.2);
  border-radius: 20px;
  padding: 8px 20px;
  gap: 10px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
}

.profile-display .label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 1px;
  color: #1e4860;
}

.profile-display .name {
  color: #0d2d40;
  font-weight: 700;
  font-size: 1.1rem;
}

.profile-display .alert {
  color: #f39c12;
  border: 1px solid #f39c12;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 0.7rem;
  color: #1e4860;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
}

.top-stats {
  display: flex;
  gap: 10px;
  align-items: center;
}

.music-toggle-btn {
  background: #ffffff;
  border: 1px solid rgba(13, 45, 64, 0.2);
  color: #1e4860;
  font-size: 1.2rem;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: all 0.2s;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
}

.music-toggle-btn:hover {
  background: #f0f0f0;
  transform: scale(1.05);
}

.stat-box {
  background: #ffffff;
  border: 1px solid rgba(13, 45, 64, 0.2);
  border-radius: 8px;
  padding: 10px 15px;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 1px;
  color: #1e4860;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
}

/* MAIN GRID */
.dashboard-grid {
  display: flex;
  flex: 1;
  justify-content: space-between;
  align-items: end;
}

.left-panel {
  width: 40%;
  height: fit-content;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  padding: 20px;
  border-radius: 16px;
  border: 1px solid rgba(13, 45, 64, 0.1);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
}

.panel-subtitle {
  font-family: "Raleway", sans-serif;
  font-size: 0.8rem;
  letter-spacing: 2px;
  color: #1e4860;
  margin-bottom: 10px;
}

.panel-title {
  font-family: "Raleway", sans-serif;
  font-size: 3rem;
  font-weight: 700;
  letter-spacing: 1px;
  margin-bottom: 15px;
  line-height: 1;
  color: #0d2d40;
}

.panel-desc {
  font-size: 1rem;
  color: #4a5568;
  line-height: 1.6;
  margin-bottom: 20px;
}

.text-dim {
  color: #1e4860;
  font-size: 0.8rem;
  letter-spacing: 2px;
  font-weight: 600;
  margin-bottom: 20px;
}

.leaderboard {
  margin-top: 20px;
}

.leaderboard ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.leaderboard li {
  display: flex;
  align-items: center;
  padding: 12px 15px;
  border-bottom: 1px solid rgba(13, 45, 64, 0.1);
  font-family: "Roboto", sans-serif;
  font-size: 1rem;
  font-weight: 500;
}

.leaderboard .rank-gold {
  color: #d4af37;
  background: rgba(212, 175, 55, 0.1);
  border-radius: 4px;
}

.leaderboard .rank-highlight {
  background: rgba(30, 72, 96, 0.05);
  border-left: 3px solid #1e4860;
}

.leaderboard .rank {
  width: 40px;
}

.leaderboard .name {
  flex: 1;
}

.leaderboard .score {
  font-weight: 500;
}

/* RIGHT PANEL */
.right-panel {
  width: auto;
  height: fit-content;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-end;
}

.character-selector {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  padding: 20px;
  border-radius: 16px;
  border: 1px solid rgba(13, 45, 64, 0.1);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
  width: 100%;
  max-width: 300px;
}

.character-selector h3 {
  font-family: "Raleway", sans-serif;
  font-size: 1.2rem;
  font-weight: 700;
  margin-bottom: 20px;
  color: #0d2d40;
  letter-spacing: 1px;
}

.char-options {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.char-btn {
  display: flex;
  align-items: center;
  gap: 20px;
  background: #ffffff;
  border: 2px solid transparent;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
  font-family: "Roboto", sans-serif;
  font-weight: 600;
  font-size: 1rem;
  color: #1e4860;
  text-align: left;
}

.char-btn:hover {
  transform: translateX(-5px);
  border-color: rgba(13, 45, 64, 0.2);
}

.char-btn.active {
  border-color: #ffd164;
  background: #f0f4f8;
  color: #0d2d40;
}

.color-swatch {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid #ffffff;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
}

/* BOTTOM BAR */
.bottom-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid rgba(13, 45, 64, 0.1);
  margin-top: 20px;
}

.compliance-badges {
  display: flex;
  gap: 20px;
  font-size: 0.9rem;
  color: #fff;
  font-weight: 600;
  letter-spacing: 1px;
}

.action-buttons {
  display: flex;
  gap: 20px;
  align-items: center;
}

.btn-primary {
  background: #ffd164;
  color: #0d2d40;
  border: none;
  padding: 15px 50px;
  border-radius: 8px;
  font-weight: 800;
  font-size: 1.2rem;
  letter-spacing: 2px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 15px rgba(255, 209, 100, 0.4);
}

.btn-primary:hover {
  background: #ffdb99;
  box-shadow: 0 6px 20px rgba(255, 209, 100, 0.6);
  transform: translateY(-2px);
}

/* RESPONSIVE DESIGN */
@media (max-width: 1024px) {
  .dashboard-grid {
    flex-direction: column;
    gap: 30px;
  }

  .left-panel,
  .right-panel {
    width: 100%;
    align-items: flex-start;
  }

  .right-panel {
    align-items: center;
  }

  .character-selector {
    max-width: 100%;
  }

  .panel-title {
    font-size: 3rem;
  }

  .lobby-dashboard {
    padding: 20px;
    overflow-y: auto;
  }

  .bottom-bar {
    flex-direction: column;
    gap: 20px;
    align-items: stretch;
  }

  .compliance-badges {
    justify-content: center;
    flex-wrap: wrap;
  }

  .action-buttons {
    width: 100%;
  }

  .btn-primary {
    width: 100%;
  }
}

@media (max-width: 600px) {
  .panel-title {
    font-size: 2.2rem;
  }

  .top-bar {
    flex-direction: column;
    gap: 15px;
    margin-bottom: 20px;
  }

  .profile-container {
    width: 100%;
    justify-content: space-between;
  }
}

@media (max-height: 750px) {
  .logo-container {
    margin-bottom: 10px;
  }
  .left-panel {
    padding: 15px;
  }
  .panel-title {
    font-size: 2.2rem;
    margin-bottom: 5px;
  }
  .panel-desc {
    margin-bottom: 10px;
    font-size: 0.9rem;
  }
  .leaderboard {
    margin-bottom: 10px;
  }
  .bottom-bar {
    margin-top: 10px;
  }
  .character-selector {
    padding: 15px;
  }
}
</style>
