/**
 * SheetService.js
 * Handles all communication between the game and the Google Sheet
 * via a Google Apps Script Web App acting as a serverless proxy.
 *
 * Sheet columns (row 1 = headers):
 *   A: Full Name  B: Company Name  C: Email
 *   D: Level 1    E: Level 1 Goodie
 *   F: Level 2    G: Level 2 Goodie
 *   H: Level 3    I: Level 3 Goodie
 *   J: Main Discount
 */

import { APPS_SCRIPT_URL } from '../game/config/GameConfig.js'

const isConfigured = () =>
  APPS_SCRIPT_URL && APPS_SCRIPT_URL !== 'YOUR_APPS_SCRIPT_URL_HERE'

/**
 * Sends a payload to the Apps Script Web App.
 * Uses no-cors mode because Apps Script redirects (which fetch
 * would block in cors mode). The response is opaque but the
 * script on the server side runs fine regardless.
 */
const postToSheet = (payload) => {
  if (!isConfigured()) {
    console.warn('[SheetService] APPS_SCRIPT_URL not set. Skipping sheet update.')
    return
  }
  // Fire-and-forget: we don't block the game on the response.
  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' }, // text/plain avoids CORS preflight
    body: JSON.stringify(payload),
  }).catch((err) => {
    console.warn('[SheetService] Network error (non-blocking):', err.message)
  })
}

/**
 * Called when user submits the registration form.
 * Creates a new row in the sheet with user details.
 * Main Discount column is intentionally left blank here —
 * it is only written when the user completes all 3 levels.
 */
export const submitRegistration = (name, company, email) => {
  postToSheet({
    action: 'register',
    name,
    company,
    email,
  })
}

/**
 * Called when user completes all 3 levels and reaches the Offer Reveal screen.
 * Writes '15% OFF' into the Main Discount column for this user's row.
 */
export const updateMainDiscount = (email) => {
  postToSheet({
    action: 'updateDiscount',
    email,
    discount: '15% OFF',
  })
}

/**
 * Called when a level is completed or failed.
 * @param {string} email - User's email (used as unique key to find their row)
 * @param {number} level - Level number (1, 2 or 3)
 * @param {'Passed'|'Failed'} status
 * @param {string} goodie - The goodie won (empty string if failed)
 */
export const updateLevelResult = (email, level, status, goodie = '') => {
  postToSheet({
    action: 'updateLevel',
    email,
    level,
    status,
    goodie,
  })
}
