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

const SHEET_NAME = 'ChargeOn Power Run Game Data';

// Column positions (1-indexed)
const COL = {
  FULL_NAME:     1,  // A
  COMPANY_NAME:  2,  // B
  EMAIL:         3,  // C
  LEVEL_1:       4,  // D
  LEVEL_1_GOODIE:5,  // E
  LEVEL_2:       6,  // F
  LEVEL_2_GOODIE:7,  // G
  LEVEL_3:       8,  // H
  LEVEL_3_GOODIE:9,  // I
  MAIN_DISCOUNT: 10, // J
};

// Helper: find the 1-indexed row number for a given email. Returns -1 if not found.
function findRowByEmail(sheet, email) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1; // only header row exists
  const emailCol = sheet.getRange(2, COL.EMAIL, lastRow - 1, 1).getValues();
  for (let i = 0; i < emailCol.length; i++) {
    if ((emailCol[i][0] + '').toLowerCase().trim() === (email + '').toLowerCase().trim()) {
      return i + 2; // +2: skip 0-index + header row
    }
  }
  return -1;
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ error: 'Sheet not found: ' + SHEET_NAME }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === 'register') {
      const targetRow = findRowByEmail(sheet, data.email);

      if (targetRow !== -1) {
        // Email exists: update Name & Company, and reset all progression columns to blank
        sheet.getRange(targetRow, COL.FULL_NAME).setValue(data.name || '');
        sheet.getRange(targetRow, COL.COMPANY_NAME).setValue(data.company || '');
        
        const colsToClear = [
          COL.LEVEL_1, COL.LEVEL_1_GOODIE,
          COL.LEVEL_2, COL.LEVEL_2_GOODIE,
          COL.LEVEL_3, COL.LEVEL_3_GOODIE,
          COL.MAIN_DISCOUNT
        ];
        
        colsToClear.forEach(col => {
          sheet.getRange(targetRow, col).setValue('');
        });
      } else {
        // New user: create a new row (Main Discount is blank — set only after Level 3 is cleared)
        sheet.appendRow([
          data.name || '',
          data.company || '',
          data.email || '',
          '', // Level 1 - filled after level completes
          '', // Level 1 Goodie
          '', // Level 2
          '', // Level 2 Goodie
          '', // Level 3
          '', // Level 3 Goodie
          '', // Main Discount - intentionally blank at registration
        ]);
      }

    } else if (data.action === 'updateLevel') {
      // Find the row with matching email and update level columns
      const targetRow = findRowByEmail(sheet, data.email);

      if (targetRow === -1) {
        return ContentService.createTextOutput(JSON.stringify({ error: 'Email not found: ' + data.email }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      const level = parseInt(data.level);
      const statusCol = level === 1 ? COL.LEVEL_1       : level === 2 ? COL.LEVEL_2       : COL.LEVEL_3;
      const goodieCol = level === 1 ? COL.LEVEL_1_GOODIE : level === 2 ? COL.LEVEL_2_GOODIE : COL.LEVEL_3_GOODIE;

      sheet.getRange(targetRow, statusCol).setValue(data.status || '');
      sheet.getRange(targetRow, goodieCol).setValue(data.goodie || '');

    } else if (data.action === 'updateDiscount') {
      // Called only when user completes ALL 3 levels and earns the 15% discount
      const targetRow = findRowByEmail(sheet, data.email);

      if (targetRow === -1) {
        return ContentService.createTextOutput(JSON.stringify({ error: 'Email not found: ' + data.email }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      sheet.getRange(targetRow, COL.MAIN_DISCOUNT).setValue(data.discount || '15% OFF');
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// GET handler for health check / testing
function doGet(e) {
  return ContentService.createTextOutput('ChargeOn Power Run Game — Sheets API is live ✅')
    .setMimeType(ContentService.MimeType.TEXT);
}
