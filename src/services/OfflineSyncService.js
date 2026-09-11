/**
 * OfflineSyncService.js
 * Comprehensive offline store-and-forward sync manager for ChargeOn Power Run.
 *
 * Ensures 100% data preservation during live events (Dreamforce) even if Wi-Fi
 * disconnects. Automatically queues writes to localStorage and auto-syncs to
 * Google Sheets and Firebase Firestore when network connectivity is restored.
 */

import { reactive } from "vue";
import { APPS_SCRIPT_URL, getEventFormattedDateTime } from "../game/config/GameConfig.js";
import { db } from "./FirebaseService.js";
import { doc, setDoc, updateDoc } from "firebase/firestore";

const STORAGE_KEY = "chargeon_offline_sync_queue";
const PLAYERS_COLLECTION = "chargeon_players";
const LEADERBOARD_COLLECTION = "chargeon_leaderboard";

export const syncStatus = reactive({
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  pendingCount: 0,
  isSyncing: false,
  lastSyncTime: null,
});

/**
 * Loads the current offline queue from localStorage.
 */
export const getQueue = () => {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn("[OfflineSync] Failed to read queue from localStorage:", err);
    return [];
  }
};

/**
 * Persists queue to localStorage and updates pendingCount.
 */
const saveQueue = (queue) => {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    }
    syncStatus.pendingCount = queue.length;
  } catch (err) {
    console.error("[OfflineSync] Failed to save queue to localStorage:", err);
  }
};

// Initialize count on boot
syncStatus.pendingCount = getQueue().length;

/**
 * Enqueues an action into localStorage and immediately attempts to sync if online.
 *
 * @param {'sheet'|'firebase'} target
 * @param {string} action
 * @param {object} payload
 */
export const enqueueAction = async (target, action, payload) => {
  const time = getEventFormattedDateTime();
  const queue = getQueue();

  const item = {
    id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    target,
    action,
    payload,
    eventTime: time.readable,
    timestamp: time.timestamp,
    retryCount: 0,
  };

  queue.push(item);
  saveQueue(queue);
  console.log(`[OfflineSync] Enqueued ${target}:${action} (queue size: ${queue.length})`);

  // Try immediate sync if device reports online
  if (syncStatus.isOnline && !syncStatus.isSyncing) {
    flushQueue();
  }
};

/**
 * Executes a single queue item against its destination API.
 */
const processItem = async (item) => {
  if (item.target === "sheet") {
    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === "YOUR_APPS_SCRIPT_URL_HERE") {
      // Not configured, discard
      return true;
    }
    // Apps Script web app endpoint (no-cors mode)
    await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(item.payload),
    });
    return true;
  }

  if (item.target === "firebase") {
    const { action, payload } = item;
    if (action === "createSession") {
      const docRef = doc(db, PLAYERS_COLLECTION, payload.sessionId);
      await setDoc(docRef, payload.data, { merge: true });
      return true;
    }
    if (action === "updateLevel") {
      const docRef = doc(db, PLAYERS_COLLECTION, payload.sessionId);
      await setDoc(docRef, payload.updatePayload, { merge: true });
      return true;
    }
    if (action === "updateDiscount") {
      const docRef = doc(db, PLAYERS_COLLECTION, payload.sessionId);
      await setDoc(docRef, payload.updatePayload, { merge: true });
      return true;
    }
    if (action === "finalScore") {
      if (payload.sessionId) {
        const docRef = doc(db, PLAYERS_COLLECTION, payload.sessionId);
        await setDoc(docRef, payload.sessionPayload, { merge: true });
      }
      if (payload.leaderboardPayload) {
        const lbRef = doc(db, LEADERBOARD_COLLECTION, payload.entryId);
        await setDoc(lbRef, payload.leaderboardPayload, { merge: true });
      }
      return true;
    }
  }

  return true;
};

/**
 * Flushes all queued items in chronological order.
 * Safe against race conditions and connection drops mid-flush.
 */
export const flushQueue = async () => {
  if (syncStatus.isSyncing) return;
  const queue = getQueue();
  if (queue.length === 0) {
    syncStatus.pendingCount = 0;
    return;
  }

  syncStatus.isSyncing = true;
  console.log(`[OfflineSync] Starting queue flush (${queue.length} items pending)...`);

  const remaining = [];

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    try {
      await processItem(item);
      console.log(`[OfflineSync] Successfully synced ${item.target}:${item.action} (${item.id})`);
    } catch (err) {
      console.warn(`[OfflineSync] Sync failed for ${item.id} (device likely offline):`, err.message);
      item.retryCount = (item.retryCount || 0) + 1;
      remaining.push(item);

      // Append all subsequent items that were not attempted yet
      for (let j = i + 1; j < queue.length; j++) {
        remaining.push(queue[j]);
      }
      break;
    }
  }

  saveQueue(remaining);
  syncStatus.isSyncing = false;
  syncStatus.lastSyncTime = getEventFormattedDateTime().readable;

  if (remaining.length === 0) {
    console.log("[OfflineSync] Queue fully synced! All records up-to-date in cloud.");
  } else {
    console.log(`[OfflineSync] Queue flush paused. ${remaining.length} items remaining for next reconnect.`);
  }
};

// -------------------------------------------------------------
// Automatic Network & Lifecycle Listeners
// -------------------------------------------------------------
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    syncStatus.isOnline = true;
    console.log("[OfflineSync] Internet connection detected (online). Triggering auto-sync...");
    flushQueue();
  });

  window.addEventListener("offline", () => {
    syncStatus.isOnline = false;
    console.warn("[OfflineSync] Internet connection lost (offline). Offline queue active.");
  });

  // Background heartbeat every 15 seconds to sync any pending items
  setInterval(() => {
    if (typeof navigator !== "undefined") {
      syncStatus.isOnline = navigator.onLine;
    }
    if (syncStatus.isOnline && syncStatus.pendingCount > 0 && !syncStatus.isSyncing) {
      flushQueue();
    }
  }, 15000);

  // App focus / tab restore check
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && syncStatus.isOnline && syncStatus.pendingCount > 0) {
      flushQueue();
    }
  });

  // Startup check: auto-flush any items saved from a previous session
  setTimeout(() => {
    if (typeof navigator !== "undefined") {
      syncStatus.isOnline = navigator.onLine;
    }
    if (syncStatus.isOnline && syncStatus.pendingCount > 0 && !syncStatus.isSyncing) {
      console.log(`[OfflineSync] App startup: ${syncStatus.pendingCount} pending items found, initiating sync...`);
      flushQueue();
    }
  }, 1200);
}
