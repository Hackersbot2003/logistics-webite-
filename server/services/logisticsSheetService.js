const { getSheetsClient } = require("../config/google");
const logger = require("../config/logger");

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

// ── Ensure sheet tab exists and has headers ───────────────────────────────────
const ensureSheetTab = async (sheets, sheetName, headers) => {
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const exists = meta.data.sheets.some(s => s.properties.title === sheetName);
    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] },
      });
    }
    // Check header row
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A1:Z1` });
    if (!res.data.values?.length) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A1`,
        valueInputOption: "RAW", requestBody: { values: [headers] },
      });
    }
  } catch (err) {
    logger.warn(`ensureSheetTab(${sheetName}) failed: ${err.message}`);
  }
};

// ── TOLL ──────────────────────────────────────────────────────────────────────
const TOLL_HEADERS = ["Location", "Toll Data (JSON)", "Created At"];

const syncTollToSheet = async (toll) => {
  try {
    const sheets = getSheetsClient();
    await ensureSheetTab(sheets, "TollDetails", TOLL_HEADERS);
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "TollDetails!A:A" });
    const rows = res.data.values || [];
    const rowIdx = rows.findIndex(r => r[0] === toll.location);
    const row = [toll.location, JSON.stringify(toll.tollData || {}), toll.createdAt?.toISOString() || new Date().toISOString()];
    if (rowIdx > 0) {
      await sheets.spreadsheets.values.update({ spreadsheetId: SPREADSHEET_ID, range: `TollDetails!A${rowIdx + 1}`, valueInputOption: "RAW", requestBody: { values: [row] } });
    } else {
      await sheets.spreadsheets.values.append({ spreadsheetId: SPREADSHEET_ID, range: "TollDetails!A1", valueInputOption: "RAW", requestBody: { values: [row] } });
    }
    logger.info(`TollDetails sheet synced: ${toll.location}`);
  } catch (err) { logger.warn(`syncTollToSheet failed: ${err.message}`); }
};

const deleteTollFromSheet = async (location) => {
  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "TollDetails!A:A" });
    const rows = res.data.values || [];
    const rowIdx = rows.findIndex(r => r[0] === location);
    if (rowIdx > 0) {
      await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: `TollDetails!A${rowIdx + 1}:Z${rowIdx + 1}` });
    }
  } catch (err) { logger.warn(`deleteTollFromSheet failed: ${err.message}`); }
};

// ── LOGISTICS DATA ────────────────────────────────────────────────────────────
const LOGISTICS_HEADERS = ["Logistic Partner", "Location", "Consignee Name", "Consignee Region", "Consignee Address", "Overall KM", "Return Fare", "Created At"];

const syncLogisticsToSheet = async (doc) => {
  try {
    const sheets = getSheetsClient();
    await ensureSheetTab(sheets, "LogisticsData", LOGISTICS_HEADERS);
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "LogisticsData!A:A" });
    const rows = res.data.values || [];
    const idStr = doc._id?.toString();
    // Use consigneeName as key lookup
    const rowIdx = rows.findIndex((r, i) => i > 0 && r[2] === doc.consigneeName && r[0] === doc.logisticPartner);
    const row = [doc.logisticPartner || "", doc.location || "", doc.consigneeName || "", doc.consigneeRegion || "", doc.consigneeAddress || "", doc.overallKM || "", doc.returnFare || "", doc.createdAt?.toISOString() || new Date().toISOString()];
    if (rowIdx > 0) {
      await sheets.spreadsheets.values.update({ spreadsheetId: SPREADSHEET_ID, range: `LogisticsData!A${rowIdx + 1}`, valueInputOption: "RAW", requestBody: { values: [row] } });
    } else {
      await sheets.spreadsheets.values.append({ spreadsheetId: SPREADSHEET_ID, range: "LogisticsData!A1", valueInputOption: "RAW", requestBody: { values: [row] } });
    }
    logger.info(`LogisticsData sheet synced: ${doc.consigneeName}`);
  } catch (err) { logger.warn(`syncLogisticsToSheet failed: ${err.message}`); }
};

const deleteLogisticsFromSheet = async (doc) => {
  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "LogisticsData!A:C" });
    const rows = res.data.values || [];
    const rowIdx = rows.findIndex((r, i) => i > 0 && r[2] === doc.consigneeName && r[0] === doc.logisticPartner);
    if (rowIdx > 0) {
      await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: `LogisticsData!A${rowIdx + 1}:H${rowIdx + 1}` });
    }
  } catch (err) { logger.warn(`deleteLogisticsFromSheet failed: ${err.message}`); }
};

// ── MODEL DETAILS ─────────────────────────────────────────────────────────────
const MODEL_HEADERS = ["Logistic Partner", "Model", "Model Specs (JSON)", "Average", "Vehicle Rate", "Driver Wages", "Billing Code", "Created At"];

const syncModelToSheet = async (doc) => {
  try {
    const sheets = getSheetsClient();
    await ensureSheetTab(sheets, "ModelDetails", MODEL_HEADERS);
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "ModelDetails!A:B" });
    const rows = res.data.values || [];
    const rowIdx = rows.findIndex((r, i) => i > 0 && r[0] === doc.logisticPartner && r[1] === doc.model);
    const row = [doc.logisticPartner || "", doc.model || "", JSON.stringify(doc.modelSpecs || []), doc.average || "", doc.vehicleRate || "", doc.driverWages || "", doc.billingCode || "", doc.createdAt?.toISOString() || new Date().toISOString()];
    if (rowIdx > 0) {
      await sheets.spreadsheets.values.update({ spreadsheetId: SPREADSHEET_ID, range: `ModelDetails!A${rowIdx + 1}`, valueInputOption: "RAW", requestBody: { values: [row] } });
    } else {
      await sheets.spreadsheets.values.append({ spreadsheetId: SPREADSHEET_ID, range: "ModelDetails!A1", valueInputOption: "RAW", requestBody: { values: [row] } });
    }
    logger.info(`ModelDetails sheet synced: ${doc.logisticPartner} ${doc.model}`);
  } catch (err) { logger.warn(`syncModelToSheet failed: ${err.message}`); }
};

const deleteModelFromSheet = async (doc) => {
  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "ModelDetails!A:B" });
    const rows = res.data.values || [];
    const rowIdx = rows.findIndex((r, i) => i > 0 && r[0] === doc.logisticPartner && r[1] === doc.model);
    if (rowIdx > 0) {
      await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: `ModelDetails!A${rowIdx + 1}:H${rowIdx + 1}` });
    }
  } catch (err) { logger.warn(`deleteModelFromSheet failed: ${err.message}`); }
};

module.exports = { syncTollToSheet, deleteTollFromSheet, syncLogisticsToSheet, deleteLogisticsFromSheet, syncModelToSheet, deleteModelFromSheet };
