/**
 * SheetService.js
 * Handles all communication between the game and the Google Sheet
 * via a Google Apps Script Web App acting as a serverless proxy.
 *
 * Sheet columns (row 1 = headers):
 *   A: Full Name          B: Company Name     C: Email
 *   D: Level 1            E: Level 1 Goodie   F: Level 1 Discount
 *   G: Level 2            H: Level 2 Goodie   I: Level 2 Discount
 *   J: Level 3            K: Level 3 Goodie
 *   L: Main Discount
 *   M: Date & Time        N: Score            O: Completion Time
 */

import { APPS_SCRIPT_URL, getEventFormattedDateTime } from "../game/config/GameConfig.js";
import { enqueueAction } from "./OfflineSyncService.js";

const isConfigured = () =>
  APPS_SCRIPT_URL && APPS_SCRIPT_URL !== "YOUR_APPS_SCRIPT_URL_HERE";

/**
 * Sends a payload to the Apps Script Web App via OfflineSyncService.
 * If offline, queues the payload in localStorage and auto-syncs when online.
 */
const postToSheet = (payload) => {
  if (!isConfigured()) {
    console.warn(
      "[SheetService] APPS_SCRIPT_URL not set. Skipping sheet update.",
    );
    return;
  }
  enqueueAction("sheet", payload.action, payload);
};

/**
 * Called when user submits the registration form.
 * Creates a new row in the sheet with user details and registration timestamp in San Francisco PDT.
 */
export const submitRegistration = (name, company, email) => {
  const time = getEventFormattedDateTime();

  postToSheet({
    action: "register",
    name,
    company,
    email,
    registeredAt: time.readable,
    timestamp: time.readable,
  });
};

/**
 * Called when user completes all 3 levels and reaches the Offer Reveal screen.
 * Writes '15% OFF' into the Main Discount column for this user's row with timestamp in San Francisco PDT.
 */
export const updateMainDiscount = (email) => {
  const time = getEventFormattedDateTime();

  postToSheet({
    action: "updateDiscount",
    email,
    discount: "15% OFF",
    completedAt: time.readable,
    timestamp: time.readable,
  });
};

/**
 * Called when a level is completed or failed.
 */
export const updateLevelResult = (
  email,
  level,
  status,
  goodie = "",
  discount = "",
  score = 0,
) => {
  const time = getEventFormattedDateTime();

  postToSheet({
    action: "updateLevel",
    email,
    level,
    status,
    goodie,
    discount,
    score,
    timestamp: time.readable,
  });
};
