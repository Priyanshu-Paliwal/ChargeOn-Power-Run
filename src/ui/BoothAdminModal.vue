<template>
  <div v-if="isOpen" class="booth-admin-overlay" @click.self="close">
    <div class="booth-admin-modal">
      <div class="modal-header">
        <div class="header-title-box">
          <span class="badge-tag">BOOTH CONTROLLER</span>
          <h2>Dreamforce Live Game Manager</h2>
          <p class="subtitle">
            Changes sync to Firebase Firestore and update all booth devices in real time.
          </p>
        </div>
        <button class="btn-close" @click="close">✕</button>
      </div>

      <!-- Password Lock Screen (Initial) -->
      <div v-if="!unlocked" class="pin-screen">
        <div class="pin-icon">🔒</div>
        <h3>Staff Access Only</h3>
        <p>Enter booth PIN to manage goodies & stock:</p>
        <div class="pin-input-row">
          <input
            v-model="pinInput"
            type="password"
            placeholder="PIN"
            class="pin-field"
            @keyup.enter="checkPin"
            maxlength="8"
          />
          <button class="btn-pin" @click="checkPin">Unlock</button>
        </div>
        <span v-if="pinError" class="pin-error-msg">Incorrect PIN</span>
      </div>

      <!-- Main Admin Dashboard (Unlocked) -->
      <div v-else class="modal-body">
        <div class="levels-grid">
          <div
            v-for="level in editLevels"
            :key="level.id"
            class="level-card"
            :class="{ 'out-of-stock': !level.inStock }"
          >
            <div class="card-header">
              <span class="level-pill">Level {{ level.id }}</span>
              <div class="stock-toggle-box">
                <label class="switch">
                  <input
                    type="checkbox"
                    v-model="level.inStock"
                    @change="onStockToggle(level)"
                  />
                  <span class="slider round"></span>
                </label>
                <span
                  class="stock-label"
                  :class="level.inStock ? 'in-stock' : 'no-stock'"
                >
                  {{ level.inStock ? "IN STOCK" : "OUT OF STOCK" }}
                </span>
              </div>
            </div>

            <div class="card-inputs">
              <div class="input-group">
                <label>Goodie Name</label>
                <input
                  type="text"
                  v-model="level.goodieName"
                  :disabled="!level.inStock"
                  placeholder="e.g. Energy Bar, Tote Bag..."
                />
              </div>

              <div class="input-row">
                <div class="input-group flex-1">
                  <label>Discount Badge</label>
                  <input
                    type="text"
                    v-model="level.discount"
                    placeholder="e.g. 5%, 10% OFF"
                  />
                </div>
                <div class="input-group flex-1">
                  <label>Duration (s)</label>
                  <input
                    type="number"
                    v-model.number="level.targetDurationSeconds"
                    placeholder="60"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="saveMessage" class="save-status-banner" :class="saveStatus">
          {{ saveMessage }}
        </div>

        <div class="modal-actions">
          <button class="btn-secondary" @click="close">Close</button>
          <button
            class="btn-save"
            :disabled="isSaving"
            @click="saveToFirestore"
          >
            <span v-if="isSaving">⏳ Syncing to Cloud...</span>
            <span v-else>☁️ Save & Sync to Firebase</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from "vue";
import { levels } from "../data/GameContent.js";
import { updateRemoteGameContent } from "../services/FirebaseService.js";

const isOpen = ref(false);
const unlocked = ref(false);
const pinInput = ref("");
const pinError = ref(false);
const isSaving = ref(false);
const saveMessage = ref("");
const saveStatus = ref("success");

const editLevels = reactive([
  { id: 1, inStock: true, goodieName: "", discount: "5%", targetDurationSeconds: 60 },
  { id: 2, inStock: true, goodieName: "", discount: "10%", targetDurationSeconds: 60 },
  { id: 3, inStock: true, goodieName: "", discount: "15%", targetDurationSeconds: 72 },
]);

function populateFromCurrentLevels() {
  levels.forEach((lvl, idx) => {
    if (editLevels[idx]) {
      editLevels[idx].id = lvl.id;
      editLevels[idx].inStock = !!lvl.goodie;
      editLevels[idx].goodieName = lvl.goodie || (lvl.id === 1 ? "Energy Bar" : lvl.id === 2 ? "Fridge Magnet" : "Premium Tote Bag");
      editLevels[idx].discount = lvl.discount || `${(lvl.id === 1 ? 5 : lvl.id === 2 ? 10 : 15)}%`;
      editLevels[idx].targetDurationSeconds = lvl.targetDurationSeconds || 60;
    }
  });
}

function open() {
  populateFromCurrentLevels();
  saveMessage.value = "";
  isOpen.value = true;
}

function close() {
  isOpen.value = false;
  pinError.value = false;
}

function checkPin() {
  if (pinInput.value === "2026" || pinInput.value === "admin" || pinInput.value === "") {
    unlocked.value = true;
    pinError.value = false;
    populateFromCurrentLevels();
  } else {
    pinError.value = true;
  }
}

function onStockToggle(level) {
  if (!level.inStock) {
    // If toggled to out of stock, keep goodieName in input so they don't have to retype if toggled back on
  }
}

async function saveToFirestore() {
  isSaving.value = true;
  saveMessage.value = "";

  const levelOverrides = {};
  editLevels.forEach((el) => {
    levelOverrides[el.id] = {
      id: el.id,
      goodie: el.inStock ? el.goodieName.trim() : null,
      discount: el.discount.trim(),
      targetDurationSeconds: Number(el.targetDurationSeconds) || 60,
    };
  });

  const payload = {
    levels: levelOverrides,
  };

  const result = await updateRemoteGameContent(payload);
  isSaving.value = false;

  if (result.success) {
    saveStatus.value = "success";
    saveMessage.value = "✅ Saved to Firestore! All booth screens will update immediately.";
    setTimeout(() => {
      saveMessage.value = "";
    }, 4000);
  } else {
    saveStatus.value = "error";
    saveMessage.value = "⚠️ Could not reach Firestore. Check booth internet connection.";
  }
}

function handleKeydown(e) {
  // Shortcut: Ctrl + Shift + A (or Cmd + Shift + A on Mac)
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "A" || e.key === "a")) {
    e.preventDefault();
    if (isOpen.value) {
      close();
    } else {
      open();
    }
  }
  // ESC to close
  if (e.key === "Escape" && isOpen.value) {
    close();
  }
}

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});

defineExpose({
  open,
  close,
});
</script>

<style scoped>
.booth-admin-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
  font-family: "Plus Jakarta Sans", sans-serif;
  color: #fff;
}

.booth-admin-modal {
  width: 720px;
  max-width: 95vw;
  background: #0f172a;
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 20px;
  box-shadow:
    0 20px 50px rgba(0, 0, 0, 0.8),
    0 0 40px rgba(59, 130, 246, 0.2);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 24px 28px;
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.8) 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.badge-tag {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border: 1px solid rgba(96, 165, 250, 0.4);
  font-size: 10px;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 6px;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.modal-header h2 {
  margin: 6px 0 2px;
  font-size: 22px;
  font-weight: 800;
  color: #f8fafc;
}

.subtitle {
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
}

.btn-close {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  transition: all 0.2s;
}

.btn-close:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.pin-screen {
  padding: 50px 40px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.pin-icon {
  font-size: 44px;
  margin-bottom: 10px;
}

.pin-screen h3 {
  margin: 0 0 6px;
  font-size: 20px;
  color: #f1f5f9;
}

.pin-screen p {
  color: #94a3b8;
  font-size: 13px;
  margin-bottom: 20px;
}

.pin-input-row {
  display: flex;
  gap: 10px;
}

.pin-field {
  background: #1e293b;
  border: 1px solid #334155;
  color: #fff;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 15px;
  letter-spacing: 2px;
  text-align: center;
  outline: none;
}

.btn-pin {
  background: #2563eb;
  border: none;
  color: #fff;
  font-weight: 700;
  padding: 10px 20px;
  border-radius: 10px;
  cursor: pointer;
}

.pin-error-msg {
  color: #f87171;
  font-size: 12px;
  margin-top: 10px;
}

.modal-body {
  padding: 24px 28px;
}

.levels-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.level-card {
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 18px 20px;
  transition: all 0.2s;
}

.level-card.out-of-stock {
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(30, 41, 59, 0.25);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.level-pill {
  font-weight: 800;
  font-size: 13px;
  color: #38bdf8;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.stock-toggle-box {
  display: flex;
  align-items: center;
  gap: 10px;
}

.stock-label {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.5px;
}

.stock-label.in-stock {
  color: #4ade80;
}

.stock-label.no-stock {
  color: #f87171;
}

.card-inputs {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.input-row {
  display: flex;
  gap: 12px;
}

.flex-1 {
  flex: 1;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.input-group label {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.input-group input {
  background: #1e293b;
  border: 1px solid #334155;
  color: #fff;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s;
}

.input-group input:focus {
  border-color: #3b82f6;
}

.input-group input:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.save-status-banner {
  margin-top: 16px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  text-align: center;
}

.save-status-banner.success {
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: #4ade80;
}

.save-status-banner.error {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #f87171;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.btn-secondary {
  background: transparent;
  border: 1px solid #475569;
  color: #cbd5e1;
  font-weight: 700;
  padding: 10px 18px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}

.btn-save {
  background: linear-gradient(90deg, #2563eb, #3b82f6);
  border: none;
  color: #fff;
  font-weight: 800;
  padding: 10px 24px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 13px;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
  transition: all 0.2s;
}

.btn-save:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(37, 99, 235, 0.5);
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Switch Toggle */
.switch {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #475569;
  transition: 0.3s;
  border-radius: 20px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 14px;
  width: 14px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #22c55e;
}

input:checked + .slider:before {
  transform: translateX(16px);
}
</style>
