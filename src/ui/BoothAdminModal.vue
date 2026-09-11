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
        <!-- Environment Selector Bar -->
        <div class="env-selector-bar">
          <div class="env-left">
            <span class="env-label">TARGET DOC:</span>
            <div class="env-pills">
              <button
                type="button"
                class="env-pill"
                :class="{ active: activeEnv === 'production' }"
                @click="switchEnvironment('production')"
              >
                <span class="env-dot prod"></span> Live Production
              </button>
              <button
                type="button"
                class="env-pill"
                :class="{ active: activeEnv === 'staging' }"
                @click="switchEnvironment('staging')"
              >
                <span class="env-dot stg"></span> Staging Sandbox
              </button>
            </div>
          </div>
          <div class="env-right">
            <span class="env-doc-indicator">
              Firestore Doc: <code>{{ activeDocName }}</code>
            </span>
          </div>
        </div>

        <div v-if="activeEnv === 'staging'" class="env-banner staging-banner">
          🧪 <strong>Staging Mode Active:</strong> Changes saved here only affect local/test devices listening to <code>staging_game_content</code>. Live booth screens remain untouched.
        </div>

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

        <div class="modal-actions-container">
          <div class="actions-left">
            <button
              type="button"
              class="btn-restore"
              :disabled="isSaving"
              @click="handleRestoreDefault"
              title="Reset configuration to original default_game_content backup"
            >
              🔄 Restore Defaults
            </button>
            <button
              v-if="activeEnv === 'staging'"
              type="button"
              class="btn-promote"
              :disabled="isSaving"
              @click="handlePromoteStaging"
              title="Publish staging configuration to live production game_content"
            >
              🚀 Promote to Production
            </button>
          </div>
          <div class="actions-right">
            <button class="btn-secondary" @click="close">Close</button>
            <button
              class="btn-save"
              :disabled="isSaving"
              @click="saveToFirestore"
            >
              <span v-if="isSaving">⏳ Syncing...</span>
              <span v-else>☁️ Save to {{ activeEnv === 'staging' ? 'Staging' : 'Production' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from "vue";
import { levels } from "../data/GameContent.js";
import {
  CONFIG_DOCS,
  getActiveConfigEnv,
  setActiveConfigEnv,
  updateRemoteGameContent,
  promoteStagingToProduction,
  restoreFromDefaultBackup,
  fetchConfigDocument,
} from "../services/FirebaseService.js";

const isOpen = ref(false);
const unlocked = ref(false);
const pinInput = ref("");
const pinError = ref(false);
const isSaving = ref(false);
const saveMessage = ref("");
const saveStatus = ref("success");

const activeEnv = ref(getActiveConfigEnv());
const activeDocName = computed(() => {
  return activeEnv.value === "staging"
    ? CONFIG_DOCS.STAGING
    : CONFIG_DOCS.PRODUCTION;
});

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

async function loadDocContent() {
  const docName = activeDocName.value;
  try {
    const res = await fetchConfigDocument(docName);
    if (res.success && res.data?.levels) {
      const remoteLevels = res.data.levels;
      const list = Array.isArray(remoteLevels) ? remoteLevels : Object.values(remoteLevels);
      list.forEach((lvl) => {
        const target = editLevels.find((e) => e.id === Number(lvl.id));
        if (target) {
          target.inStock = !!lvl.goodie;
          target.goodieName = lvl.goodie || "";
          target.discount = lvl.discount || `${target.id === 1 ? 5 : target.id === 2 ? 10 : 15}%`;
          target.targetDurationSeconds = lvl.targetDurationSeconds || 60;
        }
      });
    } else {
      populateFromCurrentLevels();
    }
  } catch (err) {
    console.warn("[BoothAdminModal] Failed to load doc content, falling back:", err);
    populateFromCurrentLevels();
  }
}

async function switchEnvironment(env) {
  if (activeEnv.value === env) return;
  activeEnv.value = env;
  setActiveConfigEnv(env);
  saveMessage.value = "";
  window.dispatchEvent(new CustomEvent("chargeon-env-changed", { detail: { env } }));
  await loadDocContent();
}

function open() {
  activeEnv.value = getActiveConfigEnv();
  loadDocContent();
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
    loadDocContent();
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

  const targetDoc = activeDocName.value;
  const result = await updateRemoteGameContent(payload, targetDoc);
  isSaving.value = false;

  if (result.success) {
    saveStatus.value = "success";
    const targetLabel = activeEnv.value === "staging" ? "Staging (staging_game_content)" : "Production (game_content)";
    saveMessage.value = `✅ Saved to ${targetLabel}! Connected screens will update immediately.`;
    setTimeout(() => {
      saveMessage.value = "";
    }, 4000);
  } else {
    saveStatus.value = "error";
    saveMessage.value = "⚠️ Could not reach Firestore. Check booth internet connection.";
  }
}

async function handlePromoteStaging() {
  const confirmed = window.confirm(
    "Are you sure you want to promote all Staging settings into Live Production (game_content)?\n\nAll live booth games connected to the internet will immediately update with these settings."
  );
  if (!confirmed) return;

  isSaving.value = true;
  saveMessage.value = "";
  const result = await promoteStagingToProduction();
  isSaving.value = false;

  if (result.success) {
    saveStatus.value = "success";
    saveMessage.value = "🚀 Staging content has been promoted to Live Production (game_content)!";
    setTimeout(() => {
      saveMessage.value = "";
    }, 5000);
  } else {
    saveStatus.value = "error";
    saveMessage.value = "⚠️ Promotion failed: " + (result.error?.message || "Unknown error");
  }
}

async function handleRestoreDefault() {
  const targetLabel = activeEnv.value === "staging" ? "Staging (staging_game_content)" : "Production (game_content)";
  const confirmed = window.confirm(
    `Are you sure you want to restore ${targetLabel} from the pristine default_game_content backup?\n\nThis will reset goodies, discounts, and durations back to factory defaults.`
  );
  if (!confirmed) return;

  isSaving.value = true;
  saveMessage.value = "";
  const targetDoc = activeDocName.value;
  const result = await restoreFromDefaultBackup(targetDoc);
  isSaving.value = false;

  if (result.success) {
    saveStatus.value = "success";
    saveMessage.value = `🔄 Successfully restored ${targetLabel} from default backup!`;
    await loadDocContent();
    setTimeout(() => {
      saveMessage.value = "";
    }, 5000);
  } else {
    saveStatus.value = "error";
    saveMessage.value = "⚠️ Restore failed: " + (result.error?.message || "Unknown error");
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
  width: 620px;
  max-width: 95vw;
  max-height: 90vh;
  background: #0f172a;
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 16px;
  box-shadow:
    0 20px 50px rgba(0, 0, 0, 0.8),
    0 0 40px rgba(59, 130, 246, 0.2);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 14px 20px;
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.8) 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-shrink: 0;
}

.badge-tag {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border: 1px solid rgba(96, 165, 250, 0.4);
  font-size: 9px;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 5px;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.modal-header h2 {
  margin: 4px 0 2px;
  font-size: 18px;
  font-weight: 800;
  color: #f8fafc;
}

.subtitle {
  margin: 0;
  font-size: 11px;
  color: #94a3b8;
}

.btn-close {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 18px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
  transition: all 0.2s;
}

.btn-close:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.pin-screen {
  padding: 40px 30px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.pin-icon {
  font-size: 36px;
  margin-bottom: 8px;
}

.pin-screen h3 {
  margin: 0 0 4px;
  font-size: 18px;
  color: #f1f5f9;
}

.pin-screen p {
  color: #94a3b8;
  font-size: 12px;
  margin-bottom: 16px;
}

.pin-input-row {
  display: flex;
  gap: 10px;
}

.pin-field {
  background: #1e293b;
  border: 1px solid #334155;
  color: #fff;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 14px;
  letter-spacing: 2px;
  text-align: center;
  outline: none;
}

.btn-pin {
  background: #2563eb;
  border: none;
  color: #fff;
  font-weight: 700;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
}

.pin-error-msg {
  color: #f87171;
  font-size: 12px;
  margin-top: 8px;
}

.modal-body {
  padding: 14px 20px;
  overflow-y: auto;
  flex: 1;
}

.modal-body::-webkit-scrollbar {
  width: 6px;
}

.modal-body::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.5);
}

.modal-body::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 3px;
}

.modal-body::-webkit-scrollbar-thumb:hover {
  background: #475569;
}

.levels-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.level-card {
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 10px 14px;
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
  margin-bottom: 8px;
}

.level-pill {
  font-weight: 800;
  font-size: 12px;
  color: #38bdf8;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.stock-toggle-box {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stock-label {
  font-size: 10px;
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
  gap: 6px;
}

.input-row {
  display: flex;
  gap: 10px;
}

.flex-1 {
  flex: 1;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.input-group label {
  font-size: 10px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.input-group input {
  background: #1e293b;
  border: 1px solid #334155;
  color: #fff;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
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
  margin-top: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 11px;
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

.env-selector-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(15, 23, 42, 0.6);
  padding: 10px 16px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 16px;
}

.env-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.env-label {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1px;
  color: #94a3b8;
  text-transform: uppercase;
}

.env-pills {
  display: flex;
  gap: 8px;
}

.env-pill {
  background: #1e293b;
  border: 1px solid #334155;
  color: #94a3b8;
  font-size: 12px;
  font-weight: 700;
  padding: 6px 14px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}

.env-pill:hover {
  background: #273549;
  color: #f1f5f9;
}

.env-pill.active {
  background: rgba(37, 99, 235, 0.2);
  border-color: #3b82f6;
  color: #60a5fa;
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.2);
}

.env-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.env-dot.prod {
  background: #22c55e;
  box-shadow: 0 0 8px #22c55e;
}

.env-dot.stg {
  background: #eab308;
  box-shadow: 0 0 8px #eab308;
}

.env-doc-indicator {
  font-size: 11px;
  color: #64748b;
}

.env-doc-indicator code {
  background: rgba(0, 0, 0, 0.4);
  padding: 2px 6px;
  border-radius: 4px;
  color: #38bdf8;
  font-family: monospace;
}

.env-banner {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 11px;
  margin-bottom: 8px;
}

.staging-banner {
  background: rgba(234, 179, 8, 0.15);
  border: 1px solid rgba(234, 179, 8, 0.35);
  color: #fef08a;
}

.modal-actions-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  position: sticky;
  bottom: 0;
  background: #0f172a;
  z-index: 10;
}

.actions-left,
.actions-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-restore {
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  font-weight: 700;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.btn-restore:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.25);
  color: #fff;
}

.btn-promote {
  background: linear-gradient(90deg, #10b981, #059669);
  border: none;
  color: #fff;
  font-weight: 800;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
  transition: all 0.2s;
}

.btn-promote:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(16, 185, 129, 0.45);
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

.btn-save:disabled,
.btn-restore:disabled,
.btn-promote:disabled {
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
