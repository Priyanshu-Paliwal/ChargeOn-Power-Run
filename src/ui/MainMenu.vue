<script setup>
const emit = defineEmits(['start-registration'])
</script>

<template>
  <div class="main-menu-overlay">
    <!-- Top Nav -->
    <header class="top-nav">
      <div class="brand">
        <h1>CHARGE<span class="text-gold">ON</span></h1>
        <div class="subtitle">POWER RUN</div>
      </div>
      <div class="player-info glass-panel">
        <div class="avatar"></div>
        <div class="details">
          <span class="name">GUEST_001</span>
          <span class="rank">Rank: <span class="text-gold">Bronze</span></span>
        </div>
      </div>
    </header>

    <!-- Center Content -->
    <main class="center-content">
      <div class="mode-selector">
        <button class="btn mode-btn active">ENDLESS RUN</button>
        <button class="btn mode-btn">LEADERBOARD</button>
        <button class="btn mode-btn">SETTINGS</button>
      </div>
    </main>

    <!-- Bottom Action -->
    <footer class="bottom-action">
      <button class="btn btn-gold start-btn" @click="emit('start-registration')">
        ENTER THE GRID
      </button>
    </footer>
  </div>
</template>

<style scoped>
.main-menu-overlay {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 2rem 4rem;
  background: linear-gradient(135deg, rgba(4, 44, 83, 0.4) 0%, rgba(10, 10, 10, 0.9) 100%);
}

.top-nav {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.brand h1 {
  font-size: 3.5rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 4px;
  text-shadow: 0 4px 15px rgba(0,0,0,0.5);
}
.brand .text-gold {
  color: var(--color-secondary);
}
.subtitle {
  font-family: var(--font-body);
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 8px;
  color: var(--color-text-muted);
}

.player-info {
  display: flex;
  align-items: center;
  padding: 0.5rem 1rem;
  gap: 1rem;
}
.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--color-primary);
  border: 2px solid var(--color-secondary);
}
.details {
  display: flex;
  flex-direction: column;
}
.details .name {
  font-weight: 600;
  font-size: 1.1rem;
}
.details .rank {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}
.details .text-gold {
  color: var(--color-secondary);
  font-weight: 700;
}

.center-content {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  flex-grow: 1;
}

.mode-selector {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 300px;
}
.mode-btn {
  text-align: left;
  background: transparent;
  border: none;
  border-left: 3px solid transparent;
  border-radius: 0;
  padding: 1rem 2rem;
  font-size: 1.5rem;
  color: var(--color-text-muted);
}
.mode-btn:hover, .mode-btn.active {
  background: linear-gradient(90deg, rgba(4, 44, 83, 0.8) 0%, transparent 100%);
  border-left-color: var(--color-secondary);
  color: #fff;
  box-shadow: none;
  transform: translateX(10px);
}

.bottom-action {
  display: flex;
  justify-content: flex-end;
}
.start-btn {
  font-size: 1.8rem;
  padding: 1rem 4rem;
  clip-path: polygon(10% 0, 100% 0, 90% 100%, 0% 100%);
}
</style>
