const { getSheetsClient } = require("../config/google");
const logger = require("../config/logger");

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const SHEET_NAME = "Drivers";

const HEADERS = [
  "Token No", "Full Name", "Father Name", "Phone Number",
  "Date of Birth", "Marital Status", "Aadhar No", "License No",
  "License Validity", "Temporary Address", "Permanent Address",
  "Emergency Person", "Emergency Relation", "Emergency Contact",
  "Sender Name", "Sender Contact", "Incharge Name",
  "Photo URLs", "Aadhar URLs", "License URLs", "Token URLs", "PDF URL",
  "Created At", "Updated At",
];

/**
 * Ensure the header row exists. Call once on startup.
 */
const ensureHeaders = async () => {
  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:Z1`,
    });

    if (!res.data.values || res.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [HEADERS] },
      });
      logger.info("Sheets headers written");
    }
  } catch (err) {
    logger.warn(`Sheets ensureHeaders failed: ${err.message}`);
  }
};

/**
 * Convert a Driver document to a row array matching HEADERS order.
 */
const driverToRow = (driver) => [
  driver.tokenNo,
  driver.fullName,
  driver.fatherName || "",
  driver.phoneNumber || "",
  driver.dateOfBirth || "",
  driver.maritalStatus || "",
  driver.aadharNo || "",
  driver.licenseNo || "",
  driver.licenseValidity || "",
  driver.temporaryAddress || "",
  driver.permanentAddress || "",
  driver.emergencyPerson || "",
  driver.emergencyRelation || "",
  driver.emergencyContact || "",
  driver.senderName || "",
  driver.senderContact || "",
  driver.inchargeName || "",
  (driver.photoUrls || []).join(", "),
  (driver.aadharUrls || []).join(", "),
  (driver.licenseUrls || []).join(", "),
  (driver.tokenUrls || []).join(", "),
  driver.pdfUrl || "",
  driver.createdAt?.toISOString() || "",
  driver.updatedAt?.toISOString() || "",
];

/**
 * Append a new driver row. Returns the row index (1-based).
 */
const appendDriverToSheet = async (driver) => {
  const sheets = getSheetsClient();
  const row = driverToRow(driver);

  const res = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:Z`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });

  // Extract the row number from updatedRange like "Drivers!A5:X5"
  const updatedRange = res.data.updates?.updatedRange || "";
  const match = updatedRange.match(/(\d+):/);
  const rowIndex = match ? parseInt(match[1]) : null;

  logger.info(`Sheets append OK: row ${rowIndex}`);
  return rowIndex;
};

/**
 * Update an existing row in the sheet.
 */
const updateDriverInSheet = async (driver) => {
  if (!driver.sheetsRowIndex) {
    // Row not tracked — append instead
    return appendDriverToSheet(driver);
  }

  const sheets = getSheetsClient();
  const row = driverToRow(driver);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A${driver.sheetsRowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [row] },
  });

  logger.info(`Sheets update OK: row ${driver.sheetsRowIndex}`);
  return driver.sheetsRowIndex;
};

/**
 * Delete a driver row by clearing it (Sheets API has no true delete row in values).
 * We use batchUpdate to delete the actual row.
 */
const deleteDriverFromSheet = async (driver) => {
  if (!driver.sheetsRowIndex) return;

  try {
    const sheets = getSheetsClient();

    // Get the sheet ID (numeric) for the named sheet
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheetObj = meta.data.sheets.find(
      (s) => s.properties.title === SHEET_NAME
    );
    if (!sheetObj) return;

    const sheetId = sheetObj.properties.sheetId;
    const rowIdx = driver.sheetsRowIndex - 1; // 0-based

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: rowIdx,
                endIndex: rowIdx + 1,
              },
            },
          },
        ],
      },
    });

    logger.info(`Sheets delete OK: row ${driver.sheetsRowIndex}`);
  } catch (err) {
    logger.warn(`Sheets delete failed: ${err.message}`);
  }
};

module.exports = {
  ensureHeaders,
  appendDriverToSheet,
  updateDriverInSheet,
  deleteDriverFromSheet,
};
