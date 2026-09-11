/**
 * FirebaseService.js
 * Handles Firestore database communication for ChargeOn Power Run.
 *
 * Project: ai-tryouts-cyntexa
 * Collections:
 *   - chargeon_players: Stores comprehensive player session logs, progression,
 *     timestamps, and goodies won.
 *   - chargeon_leaderboard: Stores top scores for live, real-time leaderboard syncing.
 */

import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { applyRemoteContent, getSyncableContent } from "../data/GameContent.js";
import {
  getEventFormattedDateTime,
  getEventDateKey,
} from "../game/config/GameConfig.js";
import { enqueueAction } from "./OfflineSyncService.js";

const firebaseConfig = {
  apiKey: "AIzaSyCVOruNPmhISdKhkSIk-ql37Ea0Kj4NGzQ",
  authDomain: "ai-tryouts-cyntexa.firebaseapp.com",
  projectId: "ai-tryouts-cyntexa",
  storageBucket: "ai-tryouts-cyntexa.firebasestorage.app",
  messagingSenderId: "1086519146668",
  appId: "1:1086519146668:web:7e17d86707745ce38a4709",
  measurementId: "G-QG0N76NJGM",
};

// Initialize Firebase App singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);

export const PLAYERS_COLLECTION = "chargeon_players";
export const LEADERBOARD_COLLECTION = "chargeon_leaderboard";
export const CONFIG_COLLECTION = "chargeon_config";

export const CONFIG_DOCS = {
  PRODUCTION: "game_content",
  STAGING: "staging_game_content",
  DEFAULT: "default_game_content",
};

/**
 * Returns the currently targeted remote config document name.
 * Priority:
 * 1. URL search param: `?env=staging` -> "staging_game_content"
 * 2. localStorage: "chargeon_config_env" === "staging" -> "staging_game_content"
 * 3. Default: "game_content" (Production)
 */
export const getActiveConfigDocName = () => {
  if (typeof window !== "undefined") {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const envParam = urlParams.get("env")?.toLowerCase();
      if (envParam === "staging") return CONFIG_DOCS.STAGING;
      if (envParam === "default") return CONFIG_DOCS.DEFAULT;
      if (envParam === "production" || envParam === "prod") return CONFIG_DOCS.PRODUCTION;

      const storedEnv = localStorage.getItem("chargeon_config_env")?.toLowerCase();
      if (storedEnv === "staging") return CONFIG_DOCS.STAGING;
      if (storedEnv === "default") return CONFIG_DOCS.DEFAULT;
    } catch (e) {
      // ignore
    }
  }
  return CONFIG_DOCS.PRODUCTION;
};

export const getActiveConfigEnv = () => {
  const docName = getActiveConfigDocName();
  if (docName === CONFIG_DOCS.STAGING) return "staging";
  if (docName === CONFIG_DOCS.DEFAULT) return "default";
  return "production";
};

export const setActiveConfigEnv = (env) => {
  if (typeof localStorage !== "undefined") {
    if (env === "staging") {
      localStorage.setItem("chargeon_config_env", "staging");
    } else if (env === "default") {
      localStorage.setItem("chargeon_config_env", "default");
    } else {
      localStorage.setItem("chargeon_config_env", "production");
    }
  }
};

/**
 * Returns the collection name for a specific calendar day's leaderboard.
 * Example: "chargeon_leaderboard_2026_09_11"
 * Isolates each day so yesterday's scores never leak into today's leaderboard.
 */
export const getDailyLeaderboardCollection = (dateKey = getEventDateKey()) => {
  return `chargeon_leaderboard_${dateKey.replace(/-/g, "_")}`;
};

/**
 * Returns consistent event human-readable string and ISO timestamps
 * explicitly in San Francisco (PDT/PST) Dreamforce timezone.
 */
export const getFormattedDateTime = (d = new Date()) => {
  return getEventFormattedDateTime(d);
};

/**
 * Generates a clean document ID based purely on email.
 * This ensures that if a player plays again with the same email,
 * their existing record is updated/overwritten rather than creating duplicates.
 */
export const generateSessionId = (email) => {
  const sanitized = (email || "player")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "_")
    .slice(0, 48);
  return sanitized;
};

/**
 * Checks if a player session already exists for the given email.
 * @param {string} email
 * @returns {Promise<boolean>} True if exists, false otherwise
 */
export const checkEmailExists = async (email) => {
  try {
    const sessionId = generateSessionId(email);
    const docRef = doc(db, PLAYERS_COLLECTION, sessionId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists();
  } catch (err) {
    console.warn("[FirebaseService] Failed to check email existence:", err);
    return false;
  }
};

const isOnline = () =>
  typeof navigator !== "undefined" ? navigator.onLine : true;

const withTimeout = (promise, ms = 2500) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Firestore operation timed out")), ms),
    ),
  ]);

/**
 * Creates a new player game session document in Firestore upon registration.
 *
 * @param {Object} userData - { name, company, email }
 * @returns {Promise<string>} The generated sessionId
 */
export const createPlayerSession = async (userData) => {
  const time = getFormattedDateTime();
  const sessionId = generateSessionId(userData.email);

  const initialData = {
    sessionId,
    name: userData.name || "Anonymous",
    email: (userData.email || "").toLowerCase().trim(),
    company: userData.company || "",
    registeredAt: time.readable,
    registeredAtIso: time.iso,
    registeredAtTimestamp: time.timestamp,
    sessionStatus: "IN_PROGRESS",
    currentLevel: 1,
    score: 0,
    mainDiscount: "",
    level1: {
      status: "Pending",
      completedAt: null,
      goodie: "",
      discount: "",
    },
    level2: {
      status: "Pending",
      completedAt: null,
      goodie: "",
      discount: "",
    },
    level3: {
      status: "Pending",
      completedAt: null,
      goodie: "",
      discount: "",
    },
    lastActiveAt: time.readable,
    serverCreatedAt: serverTimestamp(),
  };

  // Immediate offline dispatch (never blocks or hangs UI)
  if (!isOnline()) {
    console.log(
      `[FirebaseService] Device offline: enqueuing createSession for ${sessionId}`,
    );
    enqueueAction("firebase", "createSession", {
      sessionId,
      data: initialData,
    });
    return sessionId;
  }

  try {
    const docRef = doc(db, PLAYERS_COLLECTION, sessionId);
    await withTimeout(setDoc(docRef, initialData, { merge: true }), 2500);
    console.log(
      `[FirebaseService] Player session created online: ${sessionId}`,
    );
  } catch (err) {
    console.warn(
      "[FirebaseService] Online createPlayerSession failed or timed out, enqueuing for offline sync:",
      err.message,
    );
    enqueueAction("firebase", "createSession", {
      sessionId,
      data: initialData,
    });
  }

  return sessionId;
};

/**
 * Updates a specific level's result (Passed or Failed) with exact timestamp.
 *
 * @param {string} sessionId
 * @param {number} level - 1, 2, or 3
 * @param {'Passed'|'Failed'} status
 * @param {string} goodie
 * @param {string} discount
 * @param {number} score
 */
export const recordLevelResult = async (
  sessionId,
  level,
  status,
  goodie = "",
  discount = "",
  score = 0,
) => {
  if (!sessionId) {
    console.warn(
      "[FirebaseService] recordLevelResult skipped: sessionId is missing",
    );
    return;
  }
  const time = getFormattedDateTime();

  const levelData = {
    status,
    goodie: goodie || "",
    discount: discount || "",
    completedAt: time.readable,
    completedAtIso: time.iso,
    timestamp: time.timestamp,
  };

  const updatePayload = {
    [`level${level}`]: levelData,
    score: Number(score) || 0,
    lastActiveAt: time.readable,
    currentLevel: level,
  };

  if (status === "Failed") {
    updatePayload.sessionStatus = `FAILED_LEVEL_${level}`;
    updatePayload.endedAt = time.readable;
  } else if (level === 3 && status === "Passed") {
    updatePayload.sessionStatus = "VICTORY";
    updatePayload.endedAt = time.readable;
  }

  // Immediate offline dispatch
  if (!isOnline()) {
    console.log(
      `[FirebaseService] Device offline: enqueuing Level ${level} result for ${sessionId}`,
    );
    enqueueAction("firebase", "updateLevel", { sessionId, updatePayload });
    return;
  }

  try {
    const docRef = doc(db, PLAYERS_COLLECTION, sessionId);
    await withTimeout(setDoc(docRef, updatePayload, { merge: true }), 2500);
    console.log(
      `[FirebaseService] Level ${level} result recorded online: ${status}`,
    );
  } catch (err) {
    console.warn(
      `[FirebaseService] Online updateLevel failed or timed out, enqueuing:`,
      err.message,
    );
    enqueueAction("firebase", "updateLevel", { sessionId, updatePayload });
  }
};

/**
 * Updates the 15% discount for a session when the final stage is reached.
 */
export const recordMainDiscount = async (sessionId, discount = "15% OFF") => {
  if (!sessionId) return;
  const time = getFormattedDateTime();
  const updatePayload = {
    mainDiscount: discount,
    discountUnlockedAt: time.readable,
    lastActiveAt: time.readable,
  };

  if (!isOnline()) {
    console.log(
      `[FirebaseService] Device offline: enqueuing main discount for ${sessionId}`,
    );
    enqueueAction("firebase", "updateDiscount", { sessionId, updatePayload });
    return;
  }

  try {
    const docRef = doc(db, PLAYERS_COLLECTION, sessionId);
    await withTimeout(setDoc(docRef, updatePayload, { merge: true }), 2500);
    console.log("[FirebaseService] Main discount updated in Firestore online.");
  } catch (err) {
    console.warn(
      "[FirebaseService] Online updateDiscount failed or timed out, enqueuing:",
      err.message,
    );
    enqueueAction("firebase", "updateDiscount", { sessionId, updatePayload });
  }
};

/**
 * Records final game score and updates both the session doc and the live leaderboard collection.
 *
 * @param {string} sessionId
 * @param {Object} userData - { name, email, company }
 * @param {number} finalScore
 */
export const recordFinalScore = async (sessionId, userData, finalScore) => {
  const time = getFormattedDateTime();
  const numericScore = Number(finalScore) || 0;
  const dateKey = time.dateKey || getEventDateKey();

  const sessionPayload = {
    score: numericScore,
    finalScore: numericScore,
    completedAt: time.readable,
    completedAtTimestamp: time.timestamp,
    lastActiveAt: time.readable,
  };

  // Day-scoped entry ID: ALWAYS derived from the current user's email!
  // This guarantees that one player NEVER overwrites another player's document!
  const basePlayerId = generateSessionId(userData?.email) || sessionId;
  const entryId = `${basePlayerId}_${dateKey.replace(/-/g, "_")}`;
  const targetSessionId = sessionId || basePlayerId;

  const leaderboardPayload = {
    sessionId: entryId,
    playerId: basePlayerId,
    name: userData.name || "Anonymous",
    company: userData.company || "",
    score: numericScore,
    achievedAt: time.readable,
    timestamp: time.timestamp,
    dateKey, // Stamped in San Francisco PDT ("YYYY-MM-DD")
  };

  if (!isOnline()) {
    console.log(
      `[FirebaseService] Device offline: enqueuing finalScore for ${entryId}`,
    );
    enqueueAction("firebase", "finalScore", {
      sessionId: targetSessionId,
      entryId,
      sessionPayload,
      leaderboardPayload,
    });
    return;
  }

  let sessionSucceeded = false;
  let leaderboardSucceeded = false;

  // 1. Update player's individual session document
  if (targetSessionId) {
    try {
      const docRef = doc(db, PLAYERS_COLLECTION, targetSessionId);
      await withTimeout(setDoc(docRef, sessionPayload, { merge: true }), 2500);
      sessionSucceeded = true;
    } catch (err) {
      console.warn(
        "[FirebaseService] Failed to update final score on session:",
        err.message,
      );
    }
  } else {
    sessionSucceeded = true;
  }

  // 2. Add entry to single chargeon_leaderboard collection
  try {
    const leaderboardRef = doc(db, LEADERBOARD_COLLECTION, entryId);
    await withTimeout(
      setDoc(leaderboardRef, leaderboardPayload, { merge: true }),
      2500,
    );
    leaderboardSucceeded = true;
    console.log(
      `[FirebaseService] High score posted to leaderboard (${dateKey}): ${entryId}`,
    );
  } catch (err) {
    console.warn(
      "[FirebaseService] Failed to post score to leaderboard:",
      err.message,
    );
  }

  if (!sessionSucceeded || !leaderboardSucceeded) {
    console.warn(
      "[FirebaseService] Online write timed out/failed, enqueuing finalScore for offline sync",
    );
    enqueueAction("firebase", "finalScore", {
      sessionId: targetSessionId,
      entryId,
      sessionPayload,
      leaderboardPayload,
    });
  }
};

/**
 * Real-time listener for TODAY'S live leaderboard entries from the single chargeon_leaderboard collection.
 * - Filters strictly by today's San Francisco dateKey ("YYYY-MM-DD").
 * - Automatically refreshes at 12:00 AM Midnight in San Francisco time when the date changes,
 *   resetting the board for the new day without requiring a game restart.
 *
 * @param {function} callback - Receives array of top scores: [{ rank, name, score, company }]
 * @param {number} topLimit - Default 5
 * @returns {function} Unsubscribe function that cleans up both Firestore listener and midnight timer
 */
export const subscribeToLeaderboard = (callback, topLimit = 5) => {
  let activeUnsubscribe = null;
  let activeDateKey = getEventDateKey();

  const startListeningForDate = (dateKey) => {
    // Tear down any existing Firestore snapshot listener before starting a new one
    if (typeof activeUnsubscribe === "function") {
      activeUnsubscribe();
      activeUnsubscribe = null;
    }

    console.log(
      `[FirebaseService] 🎯 Subscribing to live leaderboard for date: ${dateKey} (San Francisco Time)`,
    );

    try {
      const leaderboardCol = collection(db, LEADERBOARD_COLLECTION);
      // Query single collection strictly for today's dateKey
      const q = query(leaderboardCol, where("dateKey", "==", dateKey));

      activeUnsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const allItems = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            allItems.push({
              name: data.name || "Anonymous",
              score: Number(data.score) || 0,
              company: data.company || "",
              achievedAt: data.achievedAt || "",
            });
          });

          // Client-side sort by highest score first (zero composite index required in Firestore)
          allItems.sort((a, b) => b.score - a.score);

          // Take top performers and assign rank numbers
          const topResults = allItems.slice(0, topLimit).map((item, idx) => ({
            rank: idx + 1,
            name: item.name,
            score: item.score.toString(),
            company: item.company,
            achievedAt: item.achievedAt,
          }));

          // If fewer than topLimit entries exist today, pad with placeholder slots
          while (topResults.length < topLimit) {
            topResults.push({
              rank: topResults.length + 1,
              name: "--",
              score: "--",
              company: "",
            });
          }

          callback(topResults);
        },
        (error) => {
          console.warn(
            `[FirebaseService] Leaderboard listener error for date ${dateKey}:`,
            error,
          );
        },
      );
    } catch (err) {
      console.warn(
        `[FirebaseService] Failed to initialize leaderboard listener for ${dateKey}:`,
        err,
      );
    }
  };

  // 1. Start listening for today's date
  startListeningForDate(activeDateKey);

  // 2. Automatic 12:00 Midnight Refresh Detector:
  // Runs every 10 seconds and checks if the calendar day in San Francisco has rolled over.
  // When midnight passes, it tears down the old listener, connects to the new day,
  // and resets the screen immediately for today's players.
  const midnightCheckInterval = setInterval(() => {
    const currentDateKey = getEventDateKey();
    if (currentDateKey !== activeDateKey) {
      console.log(
        `[FirebaseService] 🕛 Midnight 12:00 AM passed! Rollover from ${activeDateKey} to ${currentDateKey}. Refreshing leaderboard...`,
      );
      activeDateKey = currentDateKey;
      startListeningForDate(activeDateKey);
    }
  }, 10000);

  // Return master cleanup function
  return () => {
    clearInterval(midnightCheckInterval);
    if (typeof activeUnsubscribe === "function") {
      activeUnsubscribe();
    }
  };
};

/**
 * Real-time listener for remote game configuration from Firestore.
 * Listens to the active environment document (game_content or staging_game_content).
 * Automatically seeds the Firestore document if it does not exist yet.
 * Caches the latest valid configuration to localStorage for instant offline boots.
 *
 * @param {function} [onUpdateCallback] - Optional callback fired when config updates
 * @param {string} [targetDocName] - Optional document override (defaults to active env doc)
 * @returns {function} Unsubscribe function
 */
export const initRemoteConfigSync = (onUpdateCallback, targetDocName = null) => {
  try {
    const docName = targetDocName || getActiveConfigDocName();
    const configDocRef = doc(db, CONFIG_COLLECTION, docName);

    console.log(
      `[FirebaseService] Subscribing to remote config: ${CONFIG_COLLECTION}/${docName}`,
    );

    const unsubscribe = onSnapshot(
      configDocRef,
      async (docSnap) => {
        if (docSnap.exists()) {
          const remoteData = docSnap.data();
          console.log(
            `[FirebaseService] Remote game content received from ${docName}:`,
            remoteData,
          );

          // 1. Apply to in-memory reactive GameContent
          applyRemoteContent(remoteData);

          // 2. Cache to localStorage for instant offline access
          try {
            if (typeof localStorage !== "undefined") {
              localStorage.setItem(
                "chargeon_remote_config",
                JSON.stringify(remoteData),
              );
            }
          } catch (storageErr) {
            console.warn(
              "[FirebaseService] Failed to cache remote config to localStorage:",
              storageErr,
            );
          }

          if (typeof onUpdateCallback === "function") {
            onUpdateCallback(remoteData, docName);
          }
        } else {
          // Document does not exist yet in Firestore: seed it automatically with defaults!
          console.log(
            `[FirebaseService] Remote config document (${docName}) does not exist yet. Seeding defaults...`,
          );
          try {
            const initialPayload = getSyncableContent();
            await setDoc(configDocRef, initialPayload);
            console.log(
              `[FirebaseService] Successfully seeded default game content to ${docName}.`,
            );
          } catch (seedErr) {
            console.warn(
              `[FirebaseService] Could not auto-seed remote config (${docName}):`,
              seedErr,
            );
          }
        }
      },
      (error) => {
        console.warn(
          `[FirebaseService] Remote config listener warning for ${docName}:`,
          error,
        );
      },
    );

    return unsubscribe;
  } catch (err) {
    console.warn(
      "[FirebaseService] Failed to initialize remote config sync:",
      err,
    );
    return () => {};
  }
};

/**
 * Updates remote game configuration in Firestore.
 * Can be called by an admin panel to save changes to the cloud.
 *
 * @param {object} payload - Partial or full game content overrides
 * @param {string} [targetDocName] - Target document (defaults to active env doc)
 */
export const updateRemoteGameContent = async (payload, targetDocName = null) => {
  const docName = targetDocName || getActiveConfigDocName();
  try {
    const configDocRef = doc(db, CONFIG_COLLECTION, docName);
    const time = getFormattedDateTime();
    const cleanPayload = {
      ...payload,
      updatedAt: time.readable,
      timestamp: time.timestamp,
    };
    await setDoc(configDocRef, cleanPayload, { merge: true });
    console.log(
      `[FirebaseService] Successfully updated remote game content in ${docName}.`,
    );
    return { success: true, docName };
  } catch (err) {
    console.error(
      `[FirebaseService] Failed to update remote game content in ${docName}:`,
      err,
    );
    return { success: false, error: err, docName };
  }
};

/**
 * Promotes content from `staging_game_content` into production `game_content`.
 * Updates all live booth screens automatically.
 */
export const promoteStagingToProduction = async () => {
  try {
    const stagingRef = doc(db, CONFIG_COLLECTION, CONFIG_DOCS.STAGING);
    const stagingSnap = await getDoc(stagingRef);

    if (!stagingSnap.exists()) {
      return {
        success: false,
        error: new Error("Staging document (staging_game_content) does not exist."),
      };
    }

    const stagingData = stagingSnap.data();
    const time = getFormattedDateTime();
    const prodPayload = {
      ...stagingData,
      promotedFromStagingAt: time.readable,
      updatedAt: time.readable,
      timestamp: time.timestamp,
    };
    delete prodPayload._description;

    const prodRef = doc(db, CONFIG_COLLECTION, CONFIG_DOCS.PRODUCTION);
    await setDoc(prodRef, prodPayload);

    console.log(
      "[FirebaseService] Successfully promoted staging content to production (game_content)!",
    );
    return { success: true };
  } catch (err) {
    console.error("[FirebaseService] Failed to promote staging to production:", err);
    return { success: false, error: err };
  }
};

/**
 * Restores content from `default_game_content` backup into a target document
 * (defaults to production `game_content`).
 *
 * @param {string} [targetDocName] - Defaults to CONFIG_DOCS.PRODUCTION
 */
export const restoreFromDefaultBackup = async (
  targetDocName = CONFIG_DOCS.PRODUCTION,
) => {
  try {
    const defaultRef = doc(db, CONFIG_COLLECTION, CONFIG_DOCS.DEFAULT);
    const defaultSnap = await getDoc(defaultRef);

    let defaultData;
    if (defaultSnap.exists()) {
      defaultData = defaultSnap.data();
    } else {
      defaultData = getSyncableContent();
    }

    const time = getFormattedDateTime();
    const restoredPayload = {
      ...defaultData,
      restoredFromDefaultAt: time.readable,
      updatedAt: time.readable,
      timestamp: time.timestamp,
    };
    delete restoredPayload._description;

    const targetRef = doc(db, CONFIG_COLLECTION, targetDocName);
    await setDoc(targetRef, restoredPayload);

    console.log(
      `[FirebaseService] Successfully restored ${targetDocName} from default backup!`,
    );
    return { success: true, targetDocName };
  } catch (err) {
    console.error(
      `[FirebaseService] Failed to restore ${targetDocName} from default backup:`,
      err,
    );
    return { success: false, error: err };
  }
};

/**
 * Fetches the current content of any config document directly (one-time read).
 */
export const fetchConfigDocument = async (docName = CONFIG_DOCS.PRODUCTION) => {
  try {
    const docRef = doc(db, CONFIG_COLLECTION, docName);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { success: true, data: snap.data(), docName };
    }
    return {
      success: false,
      error: new Error(`Document ${docName} not found.`),
      docName,
    };
  } catch (err) {
    return { success: false, error: err, docName };
  }
};
