<script setup>
import { ref, computed } from "vue";
import { CHARACTERS } from "../game/config/GameConfig.js";

// The actual "3D turntable" this component describes is the live engine
// scene already running behind the Lobby (Engine.js's LOBBY mode orbits the
// camera around the player model and faces it toward the camera -- see
// CameraRig's LOBBY_ORBIT). This component is the lightweight name/role +
// prev/next control layered on top of that live view; picking a character
// here calls Player.setCharacter() (via the `select` emit, forwarded by
// Landing.vue -> App.vue), which swaps the actual mesh the visitor is
// already looking at -- not a flat preview image.
const props = defineProps({
  modelValue: { type: Number, default: null },
});
const emit = defineEmits(["update:modelValue", "select"]);

const selectedId = ref(props.modelValue ?? CHARACTERS[0].id);
const selectedIndex = computed(() => Math.max(0, CHARACTERS.findIndex((c) => c.id === selectedId.value)));
const current = computed(() => CHARACTERS[selectedIndex.value]);

function choose(id) {
  if (id === selectedId.value) return;
  selectedId.value = id;
  emit("update:modelValue", id);
  emit("select", id);
}

function step(dir) {
  const next = (selectedIndex.value + dir + CHARACTERS.length) % CHARACTERS.length;
  choose(CHARACTERS[next].id);
}

// Touch swipe as an alternative to the arrow buttons. This is a UI-level
// gesture on a small card, not gameplay input, so it deliberately doesn't
// go through InputManager (that only binds to the canvas container).
let touchStartX = 0;
function onTouchStart(e) {
  touchStartX = e.changedTouches[0].clientX;
}
function onTouchEnd(e) {
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
}

// Sync the live engine to whatever's shown here from the very first frame,
// not just after the visitor's first click.
emit("select", selectedId.value);
</script>

<template>
  <div
    class="character-select"
    tabindex="0"
    @keydown.left="step(-1)"
    @keydown.right="step(1)"
    @touchstart="onTouchStart"
    @touchend="onTouchEnd"
  >
    <h3>SELECT CHARACTER</h3>
    <div class="turntable-card">
      <button class="nav-arrow" @click="step(-1)" aria-label="Previous character">‹</button>
      <div class="character-info">
        <div class="character-name">{{ current.name }}</div>
        <div class="character-role">{{ current.role }}</div>
      </div>
      <button class="nav-arrow" @click="step(1)" aria-label="Next character">›</button>
    </div>
    <div class="dots">
      <button
        v-for="c in CHARACTERS"
        :key="c.id"
        class="dot"
        :class="{ active: c.id === selectedId }"
        :aria-label="`Select ${c.name}`"
        @click="choose(c.id)"
      ></button>
    </div>
  </div>
</template>

<style scoped>
.character-select {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  padding: 20px;
  border-radius: 16px;
  border: 1px solid rgba(13, 45, 64, 0.1);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
  width: 100%;
  max-width: 300px;
  outline: none;
}

.character-select h3 {
  font-family: "Raleway", sans-serif;
  font-size: 1.2rem;
  font-weight: 700;
  margin-bottom: 16px;
  color: #0d2d40;
  letter-spacing: 1px;
}

.turntable-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: #ffffff;
  border: 2px solid #ffd164;
  border-radius: 10px;
  padding: 14px 10px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
}

.nav-arrow {
  background: #f0f4f8;
  border: none;
  color: #1e4860;
  width: 34px;
  height: 34px;
  min-width: 34px;
  border-radius: 50%;
  font-size: 1.3rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.nav-arrow:hover {
  background: #ffd164;
  color: #0d2d40;
  transform: scale(1.08);
}

.character-info {
  flex: 1;
  text-align: center;
  overflow: hidden;
}

.character-name {
  font-family: "Raleway", sans-serif;
  font-weight: 700;
  font-size: 1.05rem;
  color: #0d2d40;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.character-role {
  font-size: 0.78rem;
  color: #1e4860;
  letter-spacing: 0.5px;
  margin-top: 2px;
}

.dots {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 14px;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid rgba(13, 45, 64, 0.25);
  background: #ffffff;
  cursor: pointer;
  padding: 0;
  transition: all 0.15s;
}

.dot:hover {
  border-color: #1e4860;
}

.dot.active {
  background: #ffd164;
  border-color: #ffd164;
}
</style>
