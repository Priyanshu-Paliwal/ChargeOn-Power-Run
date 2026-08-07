<script setup>
import { ref, onMounted, inject } from "vue";
import { gsap } from "gsap";
import CharacterSelect from "./CharacterSelect.vue";
import { TV_ATTRACT_LINE_1, TV_ATTRACT_LINE_2 } from "../game/config/GameConfig.js";

const props = defineProps({
  userData: {
    type: Object,
    default: () => ({ name: "Unknown", company: "" }),
  },
  selectedCharacterId: {
    type: Number,
    default: null,
  },
});

const emit = defineEmits(["start", "character-selected"]);

const musicState = inject('musicState');

// Dynamic leaderboard
const leaderboard = ref([]);

// Entrance-animation targets (Milestone 8). A GSAP timeline staggers these
// in on mount instead of everything just appearing at once; the leaderboard
// rows get their own separate stagger since they don't exist until the
// localStorage read above resolves.
const logoEl = ref(null);
const topStatsEl = ref(null);
const leftPanelEl = ref(null);
const rightPanelEl = ref(null);
const bottomBarEl = ref(null);
const leaderboardListEl = ref(null);

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

  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
  tl.from(logoEl.value, { opacity: 0, y: -16, scale: 0.85, duration: 0.5 })
    .from(topStatsEl.value, { opacity: 0, y: -12, duration: 0.4 }, "-=0.3")
    .from(leftPanelEl.value, { opacity: 0, x: -30, duration: 0.5 }, "-=0.2")
    .from(rightPanelEl.value, { opacity: 0, x: 30, duration: 0.5 }, "<")
    .from(bottomBarEl.value, { opacity: 0, y: 20, duration: 0.4 }, "-=0.2");

  if (leaderboardListEl.value) {
    gsap.from(leaderboardListEl.value.children, {
      opacity: 0,
      x: -15,
      duration: 0.35,
      stagger: 0.08,
      delay: 0.65,
      ease: "power2.out",
    });
  }
});
</script>

<template>
  <div class="lobby-dashboard">
    <!-- Top Bar -->
    <header class="top-bar">
      <div class="logo-container" ref="logoEl">
        <img
          src="/img/chargeon-Logo.webp"
          alt="ChargeOn Logo"
          class="logo"
        />
      </div>
      <div class="profile-container">
        <div class="top-stats" ref="topStatsEl">
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
      <section class="left-panel" ref="leftPanelEl">
        <h3 class="panel-subtitle">SALESFORCE NATIVE</h3>
        <h1 class="panel-title">CHARGEON POWER RUN</h1>
        <p class="panel-desc">
          Outrun every payment problem. Unlock exciting goodies at every level,
          plus an exclusive ChargeOn offer when you finish.
        </p>

        <div class="leaderboard">
          <h4 class="text-dim">TOP AGENTS</h4>
          <ul ref="leaderboardListEl">
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
      <section class="right-panel" ref="rightPanelEl">
        <CharacterSelect :modelValue="selectedCharacterId" @select="(id) => emit('character-selected', id)" />
      </section>
    </main>

    <!-- Bottom Actions -->
    <footer class="bottom-bar" ref="bottomBarEl">
      <div class="compliance-badges">
        <span>● PCI-DSS Compliant</span>
        <span>● AppExchange Listed</span>
      </div>

      <div class="action-buttons">
        <button class="btn-primary" @click="emit('start')">START RUN</button>
      </div>
    </footer>

    <!-- TV attract mode: only visible when ViewportManager's size class is
         'tv' (see the :global() rule below) -- exact content-script
         caption lines for the idle loop on the booth's attract-mode
         display. This IS the Lobby screen already looping (per the
         script's own "also the TV attract-mode idle loop" note), so this
         is an added caption banner, not a separate screen. -->
    <div class="tv-attract-caption">
      <p>{{ TV_ATTRACT_LINE_1 }}</p>
      <p>{{ TV_ATTRACT_LINE_2 }}</p>
    </div>
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
  transition: transform 0.25s ease;
}

.logo-container:hover .logo {
  transform: scale(1.05);
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

.music-toggle-btn:active {
  transform: scale(0.92);
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
  transition: background 0.15s, transform 0.15s;
}

.leaderboard li:hover {
  background: rgba(13, 45, 64, 0.04);
  transform: translateX(3px);
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

.btn-primary:active {
  transform: translateY(0);
  box-shadow: 0 3px 10px rgba(255, 209, 100, 0.4);
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

  :deep(.character-select) {
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
  :deep(.character-select) {
    padding: 15px;
  }
}

/* Short-landscape (phone rotated sideways: wide but very short) is its own
   first-class case per the Milestone 2 responsive strategy, not just an
   extension of the generic max-height rule above -- a rotated phone is WIDE
   enough that stacking the two panels vertically (what the max-width:1024px
   rule above does) would blow out the available height even further. This
   keeps the grid as a row and collapses everything to its essentials
   instead: description hidden, leaderboard capped to 3 rows, smaller logo
   and character picker. Uses ViewportManager's data-size-class attribute
   (written on <html>, see ViewportManager.js) via :global() since scoped
   styles can't otherwise reach an ancestor outside this component.

   NOTE ON :global() SYNTAX (found and fixed this session -- see
   docs/PROCESS_TRACKER.md): :global(A) B compiles to just `A { ... }`,
   silently DROPPING `B` entirely -- confirmed directly against the real
   @vue/compiler-sfc, not assumed (the one exception below,
   `.character-select`, already used the correct form by coincidence).
   Every other rule here used the broken partial-wrap form, meaning this
   entire phone-landscape Lobby treatment has been a complete no-op since
   Milestone 8 -- verified by inspecting the actual compiled dist/ CSS,
   which showed the trailing class missing from every one of them. The
   whole selector (ancestor AND descendant together) must go inside ONE
   :global(...) call instead. */
:global(html[data-size-class="phone-landscape"] .lobby-dashboard) {
  padding: 8px;
  overflow-y: auto;
}
:global(html[data-size-class="phone-landscape"] .top-bar) {
  margin-bottom: 6px;
}
:global(html[data-size-class="phone-landscape"] .logo-container .logo) {
  height: 28px;
}
:global(html[data-size-class="phone-landscape"] .dashboard-grid) {
  flex-direction: row;
  gap: 10px;
  align-items: stretch;
}
:global(html[data-size-class="phone-landscape"] .left-panel),
:global(html[data-size-class="phone-landscape"] .right-panel) {
  width: auto;
  flex: 1;
}
:global(html[data-size-class="phone-landscape"] .left-panel) {
  padding: 8px 12px;
  max-height: 100%;
  overflow-y: auto;
}
:global(html[data-size-class="phone-landscape"] .panel-subtitle) {
  font-size: 0.6rem;
  margin-bottom: 2px;
}
:global(html[data-size-class="phone-landscape"] .panel-title) {
  font-size: 1.1rem;
  margin-bottom: 2px;
}
:global(html[data-size-class="phone-landscape"] .panel-desc) {
  display: none;
}
:global(html[data-size-class="phone-landscape"] .leaderboard) {
  margin-top: 4px;
}
:global(html[data-size-class="phone-landscape"] .leaderboard li) {
  padding: 3px 8px;
  font-size: 0.7rem;
}
:global(html[data-size-class="phone-landscape"] .leaderboard li:nth-child(n + 4)) {
  display: none;
}
:global(html[data-size-class="phone-landscape"] .right-panel) {
  justify-content: flex-start;
  align-items: stretch;
}
:global(html[data-size-class="phone-landscape"] .character-select) {
  padding: 8px;
  max-width: 100%;
}
:global(html[data-size-class="phone-landscape"] .bottom-bar) {
  margin-top: 6px;
}
:global(html[data-size-class="phone-landscape"] .btn-primary) {
  padding: 8px 30px;
  font-size: 0.9rem;
}
:global(html[data-size-class="phone-landscape"] .compliance-badges) {
  font-size: 0.65rem;
  gap: 10px;
}

/* TV attract mode -- hidden everywhere except the booth's big-screen idle
   display (ViewportManager's 'tv' size class: width >= 1920 AND no fine
   pointer). Sits above everything else in the Lobby as a bottom banner
   rather than replacing any of the existing content -- nobody is about to
   tap "Start Run" from the TV itself, but the rest of the Lobby (logo,
   leaderboard) still reads fine as attract-mode dressing behind it. */
.tv-attract-caption {
  display: none;
}
:global(html[data-size-class="tv"] .tv-attract-caption) {
  display: block;
  position: absolute;
  left: 50%;
  bottom: 6%;
  transform: translateX(-50%);
  text-align: center;
  pointer-events: none;
  z-index: 30;
}
:global(html[data-size-class="tv"] .tv-attract-caption p) {
  font-family: "Raleway", sans-serif;
  font-weight: 700;
  font-size: clamp(1.5rem, 2.5vw, 2.8rem);
  color: #ffffff;
  text-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
  margin: 0.2em 0;
}
:global(html[data-size-class="tv"] .tv-attract-caption p:last-child) {
  color: #ffd164;
}
</style>
