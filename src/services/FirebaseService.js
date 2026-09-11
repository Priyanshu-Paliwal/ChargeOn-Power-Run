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
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import {
  applyRemoteContent,
  getSyncableContent,
} from "../data/GameContent.js";

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

const PLAYERS_COLLECTION = "chargeon_players";
const LEADERBOARD_COLLECTION = "chargeon_leaderboard";
const CONFIG_COLLECTION = "chargeon_config";
const CONFIG_DOC = "game_content";

/**
 * Returns consistent local human-readable string and ISO timestamps.
 */
export const getFormattedDateTime = () => {
  const now = new Date();
  return {
    readable: now.toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }),
    iso: now.toISOString(),
    timestamp: now.getTime(),
  };
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

  try {
    const docRef = doc(db, PLAYERS_COLLECTION, sessionId);
    await setDoc(docRef, initialData);
    console.log(`[FirebaseService] Player session created: ${sessionId}`);
  } catch (err) {
    console.warn(
      "[FirebaseService] Failed to create player session (non-blocking):",
      err,
    );
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
  if (!sessionId) return;
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

  try {
    const docRef = doc(db, PLAYERS_COLLECTION, sessionId);
    await updateDoc(docRef, updatePayload);
    console.log(`[FirebaseService] Level ${level} result recorded: ${status}`);
  } catch (err) {
    console.warn(
      `[FirebaseService] Failed to update Level ${level} result:`,
      err,
    );
  }
};

/**
 * Updates the 15% discount for a session when the final stage is reached.
 */
export const recordMainDiscount = async (sessionId, discount = "15% OFF") => {
  if (!sessionId) return;
  const time = getFormattedDateTime();

  try {
    const docRef = doc(db, PLAYERS_COLLECTION, sessionId);
    await updateDoc(docRef, {
      mainDiscount: discount,
      discountUnlockedAt: time.readable,
      lastActiveAt: time.readable,
    });
    console.log("[FirebaseService] Main discount updated in Firestore.");
  } catch (err) {
    console.warn("[FirebaseService] Failed to update main discount:", err);
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

  // 1. Update player's session doc
  if (sessionId) {
    try {
      const docRef = doc(db, PLAYERS_COLLECTION, sessionId);
      await updateDoc(docRef, {
        score: numericScore,
        finalScore: numericScore,
        completedAt: time.readable,
        completedAtTimestamp: time.timestamp,
        lastActiveAt: time.readable,
      });
    } catch (err) {
      console.warn(
        "[FirebaseService] Failed to update final score on session:",
        err,
      );
    }
  }

  // 2. Add entry to live leaderboard collection
  try {
    const entryId = sessionId || generateSessionId(userData.email);
    const leaderboardRef = doc(db, LEADERBOARD_COLLECTION, entryId);
    await setDoc(leaderboardRef, {
      sessionId: entryId,
      name: userData.name || "Anonymous",
      company: userData.company || "",
      score: numericScore,
      achievedAt: time.readable,
      timestamp: time.timestamp,
    });
    console.log("[FirebaseService] High score posted to live leaderboard.");
  } catch (err) {
    console.warn("[FirebaseService] Failed to post score to leaderboard:", err);
  }
};

/**
 * Sets up a real-time onSnapshot listener on the leaderboard collection.
 * Returns an unsubscribe function.
 *
 * @param {function} callback - Receives array of top scores: [{ rank, name, score, company }]
 * @param {number} topLimit - Default 5
 */
export const subscribeToLeaderboard = (callback, topLimit = 5) => {
  try {
    const leaderboardCol = collection(db, LEADERBOARD_COLLECTION);
    const q = query(leaderboardCol, orderBy("score", "desc"), limit(topLimit));

    return onSnapshot(
      q,
      (snapshot) => {
        const results = [];
        let rank = 1;
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          results.push({
            rank: rank++,
            name: data.name || "Anonymous",
            score: data.score != null ? data.score.toString() : "0",
            company: data.company || "",
            achievedAt: data.achievedAt || "",
          });
        });

        // If fewer than topLimit entries exist, pad with clean placeholders
        while (results.length < topLimit) {
          results.push({
            rank: results.length + 1,
            name: "--",
            score: "--",
            company: "",
          });
        }

        callback(results);
      },
      (error) => {
        console.warn("[FirebaseService] Leaderboard listener error:", error);
      },
    );
  } catch (err) {
    console.warn(
      "[FirebaseService] Failed to initialize leaderboard listener:",
      err,
    );
    return () => {};
  }
};

/**
 * Real-time listener for remote game configuration from Firestore.
 * Automatically seeds the Firestore document if it does not exist yet.
 * Caches the latest valid configuration to localStorage for instant offline boots.
 *
 * @param {function} [onUpdateCallback] - Optional callback fired when config updates
 * @returns {function} Unsubscribe function
 */
export const initRemoteConfigSync = (onUpdateCallback) => {
  try {
    const configDocRef = doc(db, CONFIG_COLLECTION, CONFIG_DOC);

    const unsubscribe = onSnapshot(
      configDocRef,
      async (docSnap) => {
        if (docSnap.exists()) {
          const remoteData = docSnap.data();
          console.log("[FirebaseService] Remote game content received from Firestore:", remoteData);

          // 1. Apply to in-memory reactive GameContent
          applyRemoteContent(remoteData);

          // 2. Cache to localStorage for instant offline access
          try {
            if (typeof localStorage !== "undefined") {
              localStorage.setItem("chargeon_remote_config", JSON.stringify(remoteData));
            }
          } catch (storageErr) {
            console.warn("[FirebaseService] Failed to cache remote config to localStorage:", storageErr);
          }

          if (typeof onUpdateCallback === "function") {
            onUpdateCallback(remoteData);
          }
        } else {
          // Document does not exist yet in Firestore: seed it automatically with defaults!
          console.log("[FirebaseService] Remote config document does not exist yet. Seeding defaults from GameContent.js...");
          try {
            const initialPayload = getSyncableContent();
            await setDoc(configDocRef, initialPayload);
            console.log("[FirebaseService] Successfully seeded default game content to Firestore.");
          } catch (seedErr) {
            console.warn("[FirebaseService] Could not auto-seed remote config:", seedErr);
          }
        }
      },
      (error) => {
        console.warn("[FirebaseService] Remote config listener warning (offline or permissions):", error);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn("[FirebaseService] Failed to initialize remote config sync:", err);
    return () => {};
  }
};

/**
 * Updates remote game configuration in Firestore.
 * Can be called by an admin panel to save changes to the cloud.
 *
 * @param {object} payload - Partial or full game content overrides
 */
export const updateRemoteGameContent = async (payload) => {
  try {
    const configDocRef = doc(db, CONFIG_COLLECTION, CONFIG_DOC);
    const time = getFormattedDateTime();
    const cleanPayload = {
      ...payload,
      updatedAt: time.readable,
      timestamp: time.timestamp,
    };
    await setDoc(configDocRef, cleanPayload, { merge: true });
    console.log("[FirebaseService] Successfully updated remote game content in Firestore.");
    return { success: true };
  } catch (err) {
    console.error("[FirebaseService] Failed to update remote game content:", err);
    return { success: false, error: err };
  }
};

