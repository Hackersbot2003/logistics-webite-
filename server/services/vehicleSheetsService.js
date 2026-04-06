const { getSheetsClient } = require("../config/google");
const logger = require("../config/logger");

const SPREADSHEET_ID = () => process.env.VEHICLE_SPREADSHEET_ID;

// All columns in order — matches the Vehicle schema
const HEADERS = [
  "Unique ID", "Sheet Name", "Financial Year",
  "Logistics Partner", "Onroute Payment", "Onsite Receiving Status",
  "Challan No", "Invoice Date", "Invoice No",
  "Date of Collection", "Dispatch Date", "Actual Dispatch Date",
  "Place of Collection", "Place of Delivery", "Other Location Delivery",
  "Overall KM",
  "Consignee Name", "Consignee Region", "Consignee Address",
  "Consignor Name", "Consignor Address",
  "Model", "Model Info", "Model Details",
  "Chassis No", "Engine No", "Temp Reg No",
  "Insurance Company", "Insurance No", "FasTag No", "Token No",
  "Driver Name", "Phone No", "Driving License No",
  "Incharge Name", "Current Incharge",
  "Date", "Time", "Vehicle Location", "Vehicle Status",
  "Delivery Date", "Expected Delivery Date",
  "Diesel Qty", "Diesel Rate", "Diesel Amount",
  "Driver Wages", "Return Fare", "Total", "Toll",
  "Border", "Total Border", "4Ltr Diesel",
  "Gate Pass", "Petty Cash", "Grand Total",
  "PTP Amount", "PTP Diesel", "2nd Pump Diesel",
  "OTP Providers", "HPCL Card Diesel",
  "Misc Expenses", "Remaining Balance",
  "PDI Status", "PDI Date",
  "Tax Payment Receipts",
  "Billed", "Notes",
  "Petrol Pump Usage",
  "Created At", "Updated At", "Last Edited By",
];

/**
 * Convert a Vehicle document to a flat row array.
 */
const vehicleToRow = (v) => [
  v.uniqueId || "",
  v.sheetName || "",
  v.financialYear || "",
  v.logisticsPartner || "",
  v.onroutePayment || "",
  v.onsiteReceivingstatus || "",
  v.challanNo || "",
  v.invoiceDate || "",
  v.invoiceNo || "",
  v.dateOfCollection || "",
  v.dispatchDate || "",
  v.actualDispatchDate || "",
  v.placeOfCollection || "",
  v.placeOfDelivery || "",
  v.otherLocationDelivery || "",
  v.overallKm || "",
  v.consigneeName || "",
  v.consigneeRegion || "",
  v.consigneeAddress || "",
  v.consignorName || "",
  v.consignorAddress || "",
  v.model || "",
  v.modelInfo || "",
  v.modelDetails || "",
  v.chassisNo || "",
  v.engineNo || "",
  v.tempRegNo || "",
  v.insuranceCompany || "",
  v.insuranceNo || "",
  v.fasTagNo || "",
  v.tokenNo || "",
  v.driverName || "",
  v.phoneNo || "",
  v.drivingLicenseNo || "",
  v.inchargeName || "",
  v.currentIncharge || "",
  v.date || "",
  v.time || "",
  v.vehicleLocation || "",
  v.vehicleStatus || "",
  v.deliveryDate || "",
  v.expecteddeliveryDate || "",
  v.dieselQuantity || "",
  v.dieselRate || "",
  v.dieselAmount || "",
  v.driverWages || "",
  v.returnFare || "",
  v.total || "",
  v.toll || "",
  v.border || "",
  v.totalBorder || "",
  v.fourLtrDiesel || "",
  v.gatePass || "",
  v.pettyCash || "",
  v.grandTotal || "",
  v.ptpAmount || "",
  v.ptpDiesel || "",
  v.secondPumpDiesel || "",
  (v.otpProvider || []).map((o) => `${o.name}:${o.amount}`).join(", "),
  v.hpclCardDiesel || "",
  v.miscellaneousExpenses || "",
  v.remainingBalance || "",
  v.pdiStatus || "",
  v.pdiDate || "",
  (v.taxPaymentReceipt || []).map((t) => `${t.name}:${t.amount}`).join(", "),
  v.billed || "",
  v.notes || "",
  (v.petrolPumpUsage || []).map((p) => `${p.pumpName}:${p.amount}`).join(", "),
  v.createdAt ? new Date(v.createdAt).toISOString() : "",
  v.updatedAt ? new Date(v.updatedAt).toISOString() : "",
  v.lastEditedBy || "",
];

// ── Sheet Tab Management ───────────────────────────────────────────────────────

/**
 * Create a new tab (sheet) inside the vehicle spreadsheet.
 * Adds header row automatically.
 * Returns the new sheet's numeric ID.
 */
const createSheetTab = async (sheetName, customSpreadsheetId) => {
  const sheets = getSheetsClient();
  const spreadsheetId = customSpreadsheetId || SPREADSHEET_ID();

  // Add the new sheet tab
  const addRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: sheetName,
              gridProperties: { rowCount: 1000, columnCount: HEADERS.length + 5 },
            },
          },
        },
      ],
    },
  });

  const newSheetId = addRes.data.replies[0].addSheet.properties.sheetId;
  const newSheetIndex = addRes.data.replies[0].addSheet.properties.index;

  // Write header row
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [HEADERS] },
  });

  // Style header row — light grey background only, default text
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: { sheetId: newSheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.85, green: 0.85, blue: 0.85 },
                textFormat: { bold: true },
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat)",
          },
        },
        {
          autoResizeDimensions: {
            dimensions: {
              sheetId: newSheetId,
              dimension: "COLUMNS",
              startIndex: 0,
              endIndex: HEADERS.length,
            },
          },
        },
        {
          updateSheetProperties: {
            properties: {
              sheetId: newSheetId,
              gridProperties: { frozenRowCount: 1 },
            },
            fields: "gridProperties.frozenRowCount",
          },
        },
      ],
    },
  });

  logger.info(`Vehicle sheet tab created: "${sheetName}" (sheetId: ${newSheetId})`);
  return newSheetId;
};

/**
 * Delete a sheet tab by its numeric Google sheetId.
 */
const deleteSheetTab = async (googleSheetId, customSpreadsheetId) => {
  const sheets = getSheetsClient();
  const spreadsheetId = customSpreadsheetId || SPREADSHEET_ID();
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ deleteSheet: { sheetId: googleSheetId } }],
    },
  });
  logger.info(`Vehicle sheet tab deleted: googleSheetId=${googleSheetId}`);
};


/**
 * List all tabs in the vehicle spreadsheet.
 */
const listSheetTabs = async () => {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID(),
    fields: "sheets.properties",
  });
  return res.data.sheets.map((s) => ({
    title: s.properties.title,
    sheetId: s.properties.sheetId,
    index: s.properties.index,
  }));
};

// ── Vehicle Row Operations ─────────────────────────────────────────────────────

/**
 * Append a vehicle row to the appropriate sheet tab.
 */
const appendVehicleToSheet = async (vehicle) => {
  const sheets = getSheetsClient();
  const row = vehicleToRow(vehicle);

  const res = await sheets.spreadsheets.values.append({
    spreadsheetId: vehicle.spreadsheetId || SPREADSHEET_ID(),
    range: `${vehicle.sheetName}!A:A`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });

  const updatedRange = res.data.updates?.updatedRange || "";
  const match = updatedRange.match(/(\d+):/);
  const rowIndex = match ? parseInt(match[1]) : null;
  logger.info(`Vehicle appended to sheet "${vehicle.sheetName}" at row ${rowIndex}`);
  return rowIndex;
};

/**
 * Update an existing vehicle row in the sheet.
 */
const updateVehicleInSheet = async (vehicle) => {
  if (!vehicle.sheetsRowIndex) {
    return appendVehicleToSheet(vehicle);
  }

  const sheets = getSheetsClient();
  const row = vehicleToRow(vehicle);

  await sheets.spreadsheets.values.update({
    spreadsheetId: vehicle.spreadsheetId || SPREADSHEET_ID(),
    range: `${vehicle.sheetName}!A${vehicle.sheetsRowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [row] },
  });

  logger.info(`Vehicle updated in sheet "${vehicle.sheetName}" row ${vehicle.sheetsRowIndex}`);
  return vehicle.sheetsRowIndex;
};

/**
 * Delete (clear) a vehicle row from the sheet.
 */
const deleteVehicleFromSheet = async (vehicle) => {
  if (!vehicle.sheetsRowIndex || !vehicle.sheetName) return;

  try {
    const sheets = getSheetsClient();
    const spreadsheetId = vehicle.spreadsheetId || SPREADSHEET_ID();

    // Get numeric sheet ID for the named tab
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties",
    });
    const tab = meta.data.sheets.find((s) => s.properties.title === vehicle.sheetName);
    if (!tab) return;

    const sheetId = tab.properties.sheetId;
    const rowIdx = vehicle.sheetsRowIndex - 1; // 0-based

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
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

    logger.info(`Vehicle row deleted from sheet "${vehicle.sheetName}" row ${vehicle.sheetsRowIndex}`);
  } catch (err) {
    logger.warn(`deleteVehicleFromSheet failed: ${err.message}`);
  }
};

module.exports = {
  createSheetTab,
  deleteSheetTab,
  listSheetTabs,
  appendVehicleToSheet,
  updateVehicleInSheet,
  deleteVehicleFromSheet,
  vehicleToRow,
  HEADERS,
};