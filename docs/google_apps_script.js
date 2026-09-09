/**
 * ================================================================
 * ChargeOn Power Run Game — Google Apps Script
 * ================================================================
 * SETUP STEPS (one time only, takes ~2 minutes):
 *
 * 1. Open your Google Sheet:
 *    https://docs.google.com/spreadsheets/d/1ONeh97Ugs196DOCdnifr2912nnVnMDPSgP21j1hl0hI
 *
 * 2. Click: Extensions → Apps Script
 *
 * 3. Delete any existing code in the editor and paste THIS entire file.
 *
 * 4. Click: Deploy → New deployment
 *    - Type: "Web app"
 *    - Execute as: "Me"
 *    - Who has access: "Anyone"
 *    - Click "Deploy" and authorize when prompted
 *
 * 5. Copy the Web app URL shown after deployment.
 *
 * 6. Open this file in your game project:
 *    src/game/config/GameConfig.js
 *    Find the line:
 *      export const APPS_SCRIPT_URL = 'YOUR_APPS_SCRIPT_URL_HERE';
 *    Replace 'YOUR_APPS_SCRIPT_URL_HERE' with the URL you copied.
 *
 * 7. Save, commit, and deploy — done!
 * ================================================================
 */

const SHEET_NAME = "ChargeOn Power Run Game Data";

// Column positions (1-indexed matching the exact Google Sheet columns)
const COL = {
  FULL_NAME: 1, // A: Full Name
  COMPANY_NAME: 2, // B: Company Name
  EMAIL: 3, // C: Email
  LEVEL_1: 4, // D: Level 1 (Passed / Failed)
  LEVEL_1_GOODIE: 5, // E: Level 1 Goodie
  LEVEL_1_DISCOUNT: 6, // F: Level 1 Discount
  LEVEL_2: 7, // G: Level 2 (Passed / Failed)
  LEVEL_2_GOODIE: 8, // H: Level 2 Goodie
  LEVEL_2_DISCOUNT: 9, // I: Level 2 Discount
  LEVEL_3: 10, // J: Level 3 (Passed / Failed)
  LEVEL_3_GOODIE: 11, // K: Level 3 Goodie
  MAIN_DISCOUNT: 12, // L: Main Discount (15% OFF)
  DATE_TIME: 13, // M: Registration Date & Time
  SCORE: 14, // N: Final Score
  COMPLETION_TIME: 15, // O: Completion Time
};

// Helper: find the 1-indexed row number for a given email. Returns -1 if not found.
function findRowByEmail(sheet, email) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1; // only header row exists
  const emailCol = sheet.getRange(2, COL.EMAIL, lastRow - 1, 1).getValues();
  for (let i = 0; i < emailCol.length; i++) {
    if (
      (emailCol[i][0] + "").toLowerCase().trim() ===
      (email + "").toLowerCase().trim()
    ) {
      return i + 2; // +2: skip 0-index + header row
    }
  }
  return -1;
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);

    // Fallback: If sheet with SHEET_NAME is not found, use the first tab
    if (!sheet) {
      sheet = ss.getSheets()[0];
    }

    if (!sheet) {
      return ContentService.createTextOutput(
        JSON.stringify({ error: "No active sheet found" }),
      ).setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === "register") {
      const targetRow = findRowByEmail(sheet, data.email);
      const timestamp =
        data.registeredAt || data.timestamp || new Date().toLocaleString();

      if (targetRow !== -1) {
        // Email exists: update Name & Company & Timestamp, and reset all progression columns
        sheet.getRange(targetRow, COL.FULL_NAME).setValue(data.name || "");
        sheet
          .getRange(targetRow, COL.COMPANY_NAME)
          .setValue(data.company || "");
        sheet.getRange(targetRow, COL.DATE_TIME).setValue(timestamp);
        sheet.getRange(targetRow, COL.SCORE).setValue(0);

        const colsToClear = [
          COL.LEVEL_1,
          COL.LEVEL_1_GOODIE,
          COL.LEVEL_1_DISCOUNT,
          COL.LEVEL_2,
          COL.LEVEL_2_GOODIE,
          COL.LEVEL_2_DISCOUNT,
          COL.LEVEL_3,
          COL.LEVEL_3_GOODIE,
          COL.MAIN_DISCOUNT,
          COL.COMPLETION_TIME,
        ];

        colsToClear.forEach((col) => {
          sheet.getRange(targetRow, col).setValue("");
        });
      } else {
        // New user: append 15-column row matching the exact sheet layout
        sheet.appendRow([
          data.name || "", // A: Full Name
          data.company || "", // B: Company Name
          data.email || "", // C: Email
          "", // D: Level 1
          "", // E: Level 1 Goodie
          "", // F: Level 1 Discount
          "", // G: Level 2
          "", // H: Level 2 Goodie
          "", // I: Level 2 Discount
          "", // J: Level 3
          "", // K: Level 3 Goodie
          "", // L: Main Discount
          timestamp, // M: Registration Date & Time
          0, // N: Score
          "", // O: Completion Time
        ]);
      }
    } else if (data.action === "updateLevel") {
      const targetRow = findRowByEmail(sheet, data.email);

      if (targetRow === -1) {
        return ContentService.createTextOutput(
          JSON.stringify({ error: "Email not found: " + data.email }),
        ).setMimeType(ContentService.MimeType.JSON);
      }

      const level = parseInt(data.level);
      const timestamp = data.timestamp || new Date().toLocaleString();

      if (level === 1) {
        sheet.getRange(targetRow, COL.LEVEL_1).setValue(data.status || "");
        sheet
          .getRange(targetRow, COL.LEVEL_1_GOODIE)
          .setValue(data.goodie || "");
        sheet
          .getRange(targetRow, COL.LEVEL_1_DISCOUNT)
          .setValue(data.discount || "");
      } else if (level === 2) {
        sheet.getRange(targetRow, COL.LEVEL_2).setValue(data.status || "");
        sheet
          .getRange(targetRow, COL.LEVEL_2_GOODIE)
          .setValue(data.goodie || "");
        sheet
          .getRange(targetRow, COL.LEVEL_2_DISCOUNT)
          .setValue(data.discount || "");
      } else if (level === 3) {
        sheet.getRange(targetRow, COL.LEVEL_3).setValue(data.status || "");
        sheet
          .getRange(targetRow, COL.LEVEL_3_GOODIE)
          .setValue(data.goodie || "");
      }

      // Update Score
      if (data.score != null) {
        sheet.getRange(targetRow, COL.SCORE).setValue(data.score);
      }

      // If level failed or level 3 completed, record Completion Time in Column O
      if (data.status === "Failed" || level === 3) {
        sheet.getRange(targetRow, COL.COMPLETION_TIME).setValue(timestamp);
      }
    } else if (data.action === "updateDiscount") {
      // Called when user completes all 3 levels
      const targetRow = findRowByEmail(sheet, data.email);

      if (targetRow === -1) {
        return ContentService.createTextOutput(
          JSON.stringify({ error: "Email not found: " + data.email }),
        ).setMimeType(ContentService.MimeType.JSON);
      }

      const timestamp =
        data.completedAt || data.timestamp || new Date().toLocaleString();
      sheet
        .getRange(targetRow, COL.MAIN_DISCOUNT)
        .setValue(data.discount || "15% OFF");
      sheet.getRange(targetRow, COL.COMPLETION_TIME).setValue(timestamp);
    }

    return ContentService.createTextOutput(
      JSON.stringify({ ok: true }),
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ error: err.message }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// GET handler for health check / testing
function doGet(e) {
  return ContentService.createTextOutput(
    "ChargeOn Power Run Game — Sheets API is live ✅",
  ).setMimeType(ContentService.MimeType.TEXT);
}
