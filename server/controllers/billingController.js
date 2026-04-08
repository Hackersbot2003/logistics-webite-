const BillingMasterSheet = require('../models/BillingMasterSheet');
const BillingRecord      = require('../models/BillingRecord');
const Vehicle            = require('../models/Vehicle');
const VehicleSheet       = require('../models/VehicleSheet');
const ModelDetails       = require('../models/ModelDetails');
const LogisticsData      = require('../models/LogisticsData');
const Toll               = require('../models/Toll');
const { getSheetsClient } = require('../config/google');
const logger             = require('../config/logger');
const { uploadFileToDrive } = require('../services/driveService');
const {
  CUSTOM_HEADERS, performCalculations, buildVehicleRow,
  buildBillingHTML, ensureBillingTab, appendVehicleRows, markVehiclesBilledInSheet,
  numberToWords,
} = require('../services/billingService');

const n = v => parseFloat(v) || 0;

// ── Bill number: always use last BillingRecord invoiceNo for this sheet ────────
// Bug fix: counter was resetting when sheet deleted+recreated.
// Now we look at the last BillingRecord for this billing sheet name.
async function getNextBillPair(billingSheet) {
  // Find the highest invoiceNo already used in this billing sheet
  const lastRecord = await BillingRecord.findOne({ billingSheetName: billingSheet.sheetName })
    .sort({ invoiceNo: -1 })
    .lean();

  let nextInv;
  if (lastRecord) {
    // Continue from last used pair
    nextInv = lastRecord.tollBillNo + 1; // e.g. last was 3&4 → next = 5
  } else {
    nextInv = 1; // brand new sheet
  }

  const tollNo = nextInv + 1;

  // Keep billCounter in sync for display
  billingSheet.billCounter = Math.ceil(nextInv / 2);
  await billingSheet.save();

  return { invoiceNo: nextInv, tollBillNo: tollNo, billNoPair: `${nextInv}&${tollNo}` };
}

// ── Column letter helper ──────────────────────────────────────────────────────
function colLetter(index) {
  let l = '';
  while (index >= 0) {
    l = String.fromCharCode((index % 26) + 65) + l;
    index = Math.floor(index / 26) - 1;
  }
  return l;
}

// ── Clear billed field in vehicle Google Sheet ────────────────────────────────
async function clearBilledInVehicleSheet(vehicleSheetName, vehicleUniqueIds) {
  try {
    const vsDoc = await VehicleSheet.findOne({ sheetName: vehicleSheetName });
    if (!vsDoc?.spreadsheetId) return;
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: vsDoc.spreadsheetId,
      range: `${vehicleSheetName}!A1:ZZZ`,
    });
    const rows = res.data.values;
    if (!rows?.length) return;
    const header = rows[0].map(h => h.trim().toLowerCase());
    const bIdx = header.indexOf('billed');
    const uIdx = header.indexOf('uniqueid');
    if (bIdx === -1 || uIdx === -1) return;
    const updates = [];
    for (let i = 1; i < rows.length; i++) {
      if (vehicleUniqueIds.includes(rows[i][uIdx])) {
        updates.push({ range: `${vehicleSheetName}!${colLetter(bIdx)}${i + 1}`, values: [['']] });
      }
    }
    if (updates.length) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: vsDoc.spreadsheetId,
        requestBody: { data: updates, valueInputOption: 'USER_ENTERED' },
      });
    }
  } catch (e) { logger.warn(`clearBilledInVehicleSheet: ${e.message}`); }
}

// ── DELETE rows from billing Google Sheet ─────────────────────────────────────
async function deleteRowsFromBillingSheet(billingSheetName, billingSpreadsheetId, billNoPair) {
  try {
    const sheets = getSheetsClient();
    const bRes = await sheets.spreadsheets.values.get({
      spreadsheetId: billingSpreadsheetId,
      range: `${billingSheetName}!A:A`,
    });
    const bRows = bRes.data.values || [];
    const rowsToDelete = [];
    for (let i = 1; i < bRows.length; i++) {
      if ((bRows[i][0] || '') === billNoPair) rowsToDelete.push(i);
    }
    if (!rowsToDelete.length) return;
    const meta = await sheets.spreadsheets.get({ spreadsheetId: billingSpreadsheetId });
    const tab  = meta.data.sheets.find(s => s.properties.title === billingSheetName);
    if (!tab) return;
    const requests = rowsToDelete.reverse().map(idx => ({
      deleteDimension: {
        range: { sheetId: tab.properties.sheetId, dimension: 'ROWS', startIndex: idx, endIndex: idx + 1 },
      },
    }));
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: billingSpreadsheetId, requestBody: { requests } });
  } catch (e) { logger.warn(`deleteRowsFromBillingSheet: ${e.message}`); }
}

// ══════════════════════════════════════════════════════════════════════════════
// BILLING SHEET CRUD
// ══════════════════════════════════════════════════════════════════════════════

exports.getSheets = async (req, res) => {
  try {
    const { sheetType } = req.query;
    const q = sheetType ? { sheetType } : {};
    const sheets = await BillingMasterSheet.find(q).sort({ createdAt: -1 });
    res.json({ sheets });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.createSheet = async (req, res) => {
  try {
    const { sheetName, sheetType } = req.body;
    if (!sheetName || !sheetType) return res.status(400).json({ message: 'sheetName and sheetType required' });
    const spreadsheetId = sheetType === 'FML'
      ? (process.env.FML_BILLING_SPREADSHEET_ID || process.env.VEHICLE_SPREADSHEET_ID)
      : (process.env.FML_EXP_BILLING_SPREADSHEET_ID || process.env.VEHICLE_SPREADSHEET_ID);
    const sheet = await BillingMasterSheet.create({
      sheetName, sheetType, spreadsheetId, billCounter: 0, status: 'inactive', createdBy: req.user._id,
    });
    ensureBillingTab(spreadsheetId, sheetName).catch(e => logger.warn(`Tab create: ${e.message}`));
    res.status(201).json({ sheet });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Sheet name already exists' });
    res.status(500).json({ message: err.message });
  }
};

exports.updateSheetStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const sheet = await BillingMasterSheet.findById(req.params.id);
    if (!sheet) return res.status(404).json({ message: 'Sheet not found' });
    if (status === 'active') {
      await BillingMasterSheet.updateMany({ sheetType: sheet.sheetType }, { status: 'inactive' });
    }
    sheet.status = status;
    await sheet.save();
    res.json({ sheet });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.lockSheet = async (req, res) => {
  try {
    const sheet = await BillingMasterSheet.findByIdAndUpdate(
      req.params.id, { isLocked: !req.body.isLocked }, { new: true }
    );
    res.json({ sheet });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// FIX: deleteSheet now also clears vehicle billed fields + allows delete even if locked (superadmin force)
exports.deleteSheet = async (req, res) => {
  try {
    const sheet = await BillingMasterSheet.findById(req.params.id);
    if (!sheet) return res.status(404).json({ message: 'Not found' });

    // Get all billing records for this sheet to clear vehicles
    const records = await BillingRecord.find({ billingSheetName: sheet.sheetName }).lean();
    const allUniqueIds = [...new Set(records.flatMap(r => r.vehicleUniqueIds || []))];
    const allVehicleSheetNames = [...new Set(records.map(r => r.vehicleSheetName).filter(Boolean))];

    // Clear billed in MongoDB vehicles
    if (allUniqueIds.length) {
      await Vehicle.updateMany({ uniqueId: { $in: allUniqueIds } }, { $set: { billed: null } });
    }

    // Clear billed in vehicle Google Sheets
    for (const vsName of allVehicleSheetNames) {
      const uidsForSheet = records.filter(r => r.vehicleSheetName === vsName).flatMap(r => r.vehicleUniqueIds || []);
      await clearBilledInVehicleSheet(vsName, uidsForSheet);
    }

    // Delete all BillingRecords
    await BillingRecord.deleteMany({ billingSheetName: sheet.sheetName });
    await sheet.deleteOne();
    res.json({ message: 'Deleted and all vehicle billed fields cleared' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ══════════════════════════════════════════════════════════════════════════════
// RECORDS
// ══════════════════════════════════════════════════════════════════════════════

exports.getSheetRecords = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const [records, total] = await Promise.all([
      BillingRecord.find({ billingSheetName: req.params.sheetName })
        .sort({ invoiceNo: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      BillingRecord.countDocuments({ billingSheetName: req.params.sheetName }),
    ]);
    res.json({ records, total, pages: Math.ceil(total / Number(limit)) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ══════════════════════════════════════════════════════════════════════════════
// PREVIEW + GENERATE
// ══════════════════════════════════════════════════════════════════════════════

exports.previewBilling = async (req, res) => {
  try {
    const { vehicleSheetName, location, consigneeName, models } = req.query;
    if (!vehicleSheetName || !location || !consigneeName) {
      return res.status(400).json({ message: 'vehicleSheetName, location, consigneeName required' });
    }
    const modelList = models ? models.split(',').map(m => m.trim()).filter(Boolean) : [];
    const query = {
      sheetName: vehicleSheetName, placeOfDelivery: location, consigneeName,
      vehicleStatus: { $regex: /Delivered/i }, deletedAt: null,
      $or: [{ billed: { $exists: false } }, { billed: '' }, { billed: null }],
    };
    if (modelList.length) query.model = { $in: modelList };
    const vehicles = await Vehicle.find(query).lean();

    // Failure messages
    const allV     = await Vehicle.find({ sheetName: vehicleSheetName, deletedAt: null }).lean();
    const atLoc    = allV.filter(v => v.placeOfDelivery === location && v.consigneeName === consigneeName);
    const delivered = atLoc.filter(v => /Delivered/i.test(v.vehicleStatus));
    const unbilled  = delivered.filter(v => !v.billed);
    const failures = [];
    if (!atLoc.length)       failures.push(`No vehicles for "${location}" / "${consigneeName}"`);
    else if (!delivered.length) failures.push(`No Delivered vehicles (${atLoc.length} found but none delivered)`);
    else if (!unbilled.length)  failures.push(`All ${delivered.length} delivered vehicles already billed`);
    if (modelList.length && !vehicles.length && unbilled.length) {
      const avail = [...new Set(unbilled.map(v => v.model))];
      failures.push(`Models [${modelList.join(', ')}] not found. Available: ${avail.join(', ')}`);
    }
    const byModel = {};
    for (const v of vehicles) byModel[v.model] = (byModel[v.model] || 0) + 1;
    res.json({ vehicles, failures, summary: { total: vehicles.length, byModel } });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.generateBill = async (req, res) => {
  try {
    const { billingSheetName, sheetType, vehicleSheetName, location, consigneeName, models,
            invoiceDate, eAckNumber, eAckDate, miscRate, cgstRate, sgstRate,
            urbania, urbaniaIncentive, vehicleIds } = req.body;

    if (!billingSheetName || !sheetType || !vehicleSheetName || !location || !consigneeName)
      return res.status(400).json({ message: 'Missing required fields' });

    const billingSheet = await BillingMasterSheet.findOne({ sheetName: billingSheetName });
    if (!billingSheet) return res.status(404).json({ message: 'Billing sheet not found' });
    if (billingSheet.isLocked) return res.status(423).json({ message: 'Billing sheet is locked' });

    let vehicles;
    if (vehicleIds?.length) {
      vehicles = await Vehicle.find({ _id: { $in: vehicleIds }, deletedAt: null }).lean();
    } else {
      const modelList = models ? models.split(',').map(m => m.trim()).filter(Boolean) : [];
      const q = {
        sheetName: vehicleSheetName, placeOfDelivery: location, consigneeName,
        vehicleStatus: { $regex: /Delivered/i }, deletedAt: null,
        $or: [{ billed: { $exists: false } }, { billed: '' }, { billed: null }],
      };
      if (modelList.length) q.model = { $in: modelList };
      vehicles = await Vehicle.find(q).lean();
    }
    if (!vehicles.length) return res.status(400).json({ message: 'No eligible vehicles found' });

    const allModels = [...new Set(vehicles.map(v => v.model))];
    const mdDocs    = await ModelDetails.find({ model: { $in: allModels } }).lean();
    const modelDetailsMap = {};
    for (const md of mdDocs) modelDetailsMap[md.model] = md;

    const logData   = await LogisticsData.findOne({ location, consigneeName }).lean();
    const overallKm = logData?.overallKM || n(vehicles[0]?.overallKm) || 0;
    const tollDoc   = await Toll.findOne({ location: new RegExp(location, 'i') }).lean();
    const tollData  = tollDoc?.tollData || {};
    const vsDoc     = await VehicleSheet.findOne({ sheetName: vehicleSheetName });

    const calc = performCalculations({
      vehicles, modelDetailsMap, tollData, overallKm,
      miscRate: n(miscRate) || 500, cgstRate: n(cgstRate) || 9, sgstRate: n(sgstRate) || 9,
      isUrbania: !!urbania, specialIncentive: n(urbaniaIncentive) || 1000, sheetType,
    });

    // FIX: use last BillingRecord to determine next bill number
    const { invoiceNo, tollBillNo, billNoPair } = await getNextBillPair(billingSheet);

    const billDate  = new Date().toLocaleDateString('en-GB');
    const uniqueIds = vehicles.map(v => v.uniqueId);

    const record = await BillingRecord.create({
      billingSheetName, sheetType, vehicleSheetName, location, consigneeName,
      invoiceNo, tollBillNo, billNoPair,
      invoiceDate: invoiceDate || new Date().toISOString().split('T')[0],
      eAckNumber, eAckDate, models: allModels,
      urbania: !!urbania, urbaniaIncentive: n(urbaniaIncentive) || 1000,
      miscRate: n(miscRate) || 500, cgstRate: n(cgstRate) || 9, sgstRate: n(sgstRate) || 9,
      overallKm, vehicleUniqueIds: uniqueIds,
      vehicles: vehicles.map(v => v._id),
      transportationSubTotal: calc.transportationSubTotal,
      transportationCGST: calc.transportationCGST,
      transportationSGST: calc.transportationSGST,
      taxInvoiceTotal: calc.transportationFinalAmount,
      tollSubTotal: calc.tollSubTotal, tollCGST: calc.tollCGST,
      tollSGST: calc.tollSGST, tollBillTotal: calc.tollFinalAmount,
      createdBy: req.user._id,
    });

    await Vehicle.updateMany(
      { _id: { $in: vehicles.map(v => v._id) } },
      { billed: billNoPair, lastEditedBy: req.user.name || req.user.email }
    );

    const sheetRows = vehicles.map(v => {
      const md = modelDetailsMap[v.model];
      return buildVehicleRow({
        vehicle: v, billNoPair, billDate,
        rate: md?.vehicleRate || 0,
        tollRate: sheetType === 'FML' ? (tollData[v.model] || 0) : 0,
        miscExpense: (n(miscRate) || 500) + (!!urbania ? n(urbaniaIncentive) || 1000 : 0),
        cgstRate: n(cgstRate) || 9, sgstRate: n(sgstRate) || 9,
      });
    });

    const spreadsheetId = billingSheet.spreadsheetId;
    ensureBillingTab(spreadsheetId, billingSheetName)
      .then(() => appendVehicleRows(spreadsheetId, billingSheetName, sheetRows))
      .catch(e => logger.warn(`Sheets append: ${e.message}`));

    if (vsDoc?.spreadsheetId) {
      markVehiclesBilledInSheet(vsDoc.spreadsheetId, vehicleSheetName, uniqueIds, billNoPair)
        .catch(e => logger.warn(`Mark billed: ${e.message}`));
    }

    const populatedRecord = { ...record.toObject(), vehicles };

    // Upload bill HTML as PDF to Google Drive (fire-and-forget — does not block response)
    (async () => {
      try {
        const { buildBillingHTML } = require('../services/billingService');
        const html = buildBillingHTML({ record: populatedRecord, calc, overallKm, sheetType });
        // Convert HTML string to Buffer and upload as HTML file (opens in browser like PDF)
        const htmlBuffer = Buffer.from(html, 'utf-8');
        const filename = `BILL_${billNoPair}_${consigneeName}_${location}.html`;
        const driveFile = await uploadFileToDrive(htmlBuffer, filename, 'text/html', 'Billing_PDFs');
        await BillingRecord.findByIdAndUpdate(record._id, {
          driveFileId: driveFile.id,
          driveViewLink: driveFile.webViewLink || driveFile.webContentLink,
        });
        logger.info(`Billing PDF uploaded to Drive: ${driveFile.id}`);
      } catch (e) {
        logger.warn(`Drive upload for billing failed: ${e.message}`);
      }
    })();

    res.status(201).json({ record: populatedRecord, calc, invoiceNo, tollBillNo, billNoPair, vehicles });
  } catch (err) {
    logger.error('generateBill error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/billing/pdf/:id — FIX: fetch via api with token, return HTML ─────
exports.generatePDF = async (req, res) => {
  try {
    const record = await BillingRecord.findById(req.params.id).populate('vehicles').lean();
    if (!record) return res.status(404).json({ message: 'Record not found' });
    // Safety: ensure vehicles array exists
    if (!record.vehicles) record.vehicles = [];

    const validVehicles = (record.vehicles || []).filter(Boolean);
    const allModels = [...new Set(validVehicles.map(v => v.model).filter(Boolean))];
    const mdDocs    = await ModelDetails.find({ model: { $in: allModels } }).lean();
    const modelDetailsMap = {};
    for (const md of mdDocs) modelDetailsMap[md.model] = md;

    const logData   = await LogisticsData.findOne({ location: record.location, consigneeName: record.consigneeName }).lean();
    const overallKm = logData?.overallKM || record.overallKm || n(record.vehicles[0]?.overallKm) || 0;
    const tollDoc   = await Toll.findOne({ location: new RegExp(record.location, 'i') }).lean();
    const tollData  = tollDoc?.tollData || {};

    const calc = performCalculations({
      vehicles: validVehicles, modelDetailsMap, tollData, overallKm,
      miscRate: record.miscRate || 500, cgstRate: record.cgstRate || 9, sgstRate: record.sgstRate || 9,
      isUrbania: record.urbania, specialIncentive: record.urbaniaIncentive || 1000,
      sheetType: record.sheetType,
    });

    const html = buildBillingHTML({ record, calc, overallKm, sheetType: record.sheetType });
    // Add print button and auto-print script
    const finalHtml = html.replace('</body>', `
      <button onclick="window.print()" style="position:fixed;top:12px;right:18px;background:#2563EB;color:#fff;border:none;padding:8px 22px;font-size:13px;font-weight:700;border-radius:6px;cursor:pointer;z-index:999;box-shadow:0 2px 8px rgba(0,0,0,0.2)">🖨️ Print / Save PDF</button>
      <style>@media print{button{display:none!important}}</style>
      </body>`);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(finalHtml);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ══════════════════════════════════════════════════════════════════════════════
// DELETE BILL RECORD
// ══════════════════════════════════════════════════════════════════════════════

exports.deleteBillRecord = async (req, res) => {
  try {
    const record = await BillingRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Bill record not found' });

    const { billingSheetName, vehicleSheetName, vehicleUniqueIds, billNoPair } = record;

    // 1. Clear billed in MongoDB
    await Vehicle.updateMany({ uniqueId: { $in: vehicleUniqueIds } }, { $set: { billed: null } });

    // 2. Clear billed in vehicle Google Sheet
    await clearBilledInVehicleSheet(vehicleSheetName, vehicleUniqueIds);

    // 3. Delete rows from billing Google Sheet
    const billingSheet = await BillingMasterSheet.findOne({ sheetName: billingSheetName });
    if (billingSheet?.spreadsheetId) {
      await deleteRowsFromBillingSheet(billingSheetName, billingSheet.spreadsheetId, billNoPair);
    }

    // 4. Delete BillingRecord
    await record.deleteOne();
    res.json({ message: `Bill ${billNoPair} deleted. Vehicles and spreadsheet cleared.` });
  } catch (err) {
    logger.error('deleteBillRecord error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// ANNEXURE PDF
// ══════════════════════════════════════════════════════════════════════════════

exports.generateAnnexurePDF = async (req, res) => {
  try {
    const { vehicleSheetName, billNo } = req.query;
    if (!vehicleSheetName || !billNo) return res.status(400).json({ message: 'vehicleSheetName and billNo required' });
    const num = parseInt(billNo, 10);
    if (isNaN(num)) return res.status(400).json({ message: 'billNo must be a number' });

    const record = await BillingRecord.findOne({
      vehicleSheetName,
      $or: [{ invoiceNo: num }, { tollBillNo: num }],
    }).lean();
    if (!record) return res.status(404).json({ message: `No bill found for bill no ${billNo} in sheet "${vehicleSheetName}"` });

    const vehicles = await Vehicle.find({ uniqueId: { $in: record.vehicleUniqueIds } }).lean();
    if (!vehicles.length) return res.status(404).json({ message: 'No vehicles found for this bill' });

    const consigneeName   = vehicles[0].consigneeName || '';
    const placeOfDelivery = vehicles[0].placeOfDelivery || '';

    const rows = vehicles.map((v, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${v.invoiceDate || ''}</td>
        <td>${v.invoiceNo || ''}</td>
        <td>${v.chassisNo || ''}</td>
        <td>${v.engineNo || ''}</td>
        <td>${v.tempRegNo || ''}</td>
        <td>${v.dateOfCollection || ''}</td>
        <td>${v.deliveryDate || ''}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Annexure - ${billNo}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:9pt;background:#fff;color:#000}
  .page{width:277mm;margin:0 auto;padding:8mm 10mm}
  .co-name{font-size:13pt;font-weight:bold;text-align:center}
  .co-addr{font-size:8pt;text-align:center;margin-top:1px}
  .info-bar{display:flex;justify-content:space-between;border:1px solid #000;padding:3px 6px;font-size:9pt;font-weight:bold;margin:5px 0 0}
  table{width:100%;border-collapse:collapse;margin-top:0}
  th{border:1px solid #000;padding:4px 3px;background:#e8e8e8;font-size:8pt;font-weight:bold;text-align:center;line-height:1.2}
  td{border:1px solid #000;padding:3px 3px;font-size:8pt;text-align:center}
  .total{text-align:right;font-size:9pt;font-weight:bold;margin-top:4px}
  .print-btn{position:fixed;top:12px;right:18px;background:#2563EB;color:#fff;border:none;padding:8px 22px;font-size:13px;font-weight:700;border-radius:6px;cursor:pointer;z-index:999}
  @media print{.print-btn{display:none}@page{size:A4 landscape;margin:8mm 10mm}}
</style></head><body>
<button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
<div class="page">
  <div class="co-name">SHREE AARYA LOGISTICS</div>
  <div class="co-addr">197-AMBIKAPURI EXTENSION. AERODROME ROAD, NEAR GANGESHWAR DHAM TEMPLE, INDORE-M.P.-452005</div>
  <div class="info-bar">
    <span>DEALER NAME: ${consigneeName}&nbsp;&nbsp; PITHAMPUR TO ${placeOfDelivery}</span>
    <span>INVOICE NO: ${billNo}</span>
  </div>
  <table>
    <thead><tr>
      <th style="width:4%">Sr.<br>No.</th>
      <th style="width:11%">INVOICE DATE</th>
      <th style="width:15%">INVOICE NO</th>
      <th style="width:21%">CHASSIS NUMBER</th>
      <th style="width:16%">ENGINE NUMBER</th>
      <th style="width:13%">TEMP. REG. NO.</th>
      <th style="width:10%">COLLECTION<br>DATE</th>
      <th style="width:10%">DELIVERY<br>DATE</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total">Total Vehicles: ${vehicles.length}</div>
</div>
</body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) { logger.error('generateAnnexurePDF:', err.message); res.status(500).json({ message: err.message }); }
};

// ══════════════════════════════════════════════════════════════════════════════
// TOLL PDF
// ══════════════════════════════════════════════════════════════════════════════

exports.generateTollPDF = async (req, res) => {
  try {
    const { vehicleSheetName, billNo } = req.query;
    if (!vehicleSheetName || !billNo) return res.status(400).json({ message: 'vehicleSheetName and billNo required' });
    const num = parseInt(billNo, 10);
    if (isNaN(num)) return res.status(400).json({ message: 'billNo must be a number' });

    const record = await BillingRecord.findOne({
      vehicleSheetName,
      $or: [{ invoiceNo: num }, { tollBillNo: num }],
    }).lean();
    if (!record) return res.status(404).json({ message: `No bill found for bill no ${billNo} in sheet "${vehicleSheetName}"` });

    const vehicles = await Vehicle.find({ uniqueId: { $in: record.vehicleUniqueIds } }).lean();
    if (!vehicles.length) return res.status(404).json({ message: 'No vehicles found for this bill' });

    const consigneeName   = vehicles[0].consigneeName || '';
    const placeOfDelivery = vehicles[0].placeOfDelivery || '';

    const tollDoc  = await Toll.findOne({ location: new RegExp(record.location || placeOfDelivery, 'i') }).lean();
    const tollData = tollDoc?.tollData || {};

    const byModel = {};
    for (const v of vehicles) { if (!byModel[v.model]) byModel[v.model] = []; byModel[v.model].push(v); }

    let totalAmount = 0;
    const rows = [];
    let srNo = 1;
    for (const [model, vList] of Object.entries(byModel)) {
      const qty = vList.length, rate = tollData[model] || 0, amt = qty * rate;
      totalAmount += amt;
      rows.push({ srNo: srNo++, model, qty, rate, amt });
    }

    const amountInWords = numberToWords(totalAmount).toUpperCase();

    const rowsHtml = rows.map(r => `
      <tr>
        <td>${r.srNo}</td><td class="model">${r.model}</td>
        <td>${r.qty}</td>
        <td class="right">${r.rate % 1 === 0 ? r.rate : r.rate.toFixed(2)}</td>
        <td class="right">${r.amt % 1 === 0 ? r.amt : r.amt.toFixed(2)}</td>
      </tr>`).join('');

    const fillerHtml = Array.from({ length: Math.max(0, 20 - rows.length) }, (_, i) => `
      <tr>
        <td>${rows.length + i + 1}</td><td class="model"></td>
        <td></td><td></td><td class="right">0</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Expense Reimbursement - ${billNo}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:9pt;background:#fff;color:#000}
  .page{width:190mm;margin:0 auto;padding:8mm 10mm}
  .co-name{font-size:13pt;font-weight:bold;text-align:center}
  .co-addr{font-size:8pt;text-align:center;margin-top:1px}
  .info-bar{display:flex;justify-content:space-between;border:1px solid #000;padding:3px 6px;font-size:9pt;font-weight:bold;margin:5px 0 0}
  table{width:100%;border-collapse:collapse}
  th{border:1px solid #000;padding:4px 5px;background:#e8e8e8;font-size:9pt;font-weight:bold;text-align:center}
  td{border:1px solid #000;padding:3px 5px;font-size:9pt;text-align:center}
  td.model{text-align:left;padding-left:6px} td.right{text-align:right;padding-right:6px}
  .summary{border:1px solid #000;padding:5px 8px;margin-top:8px;font-size:9pt}
  .sig{margin-top:14px;font-size:9pt}
  .print-btn{position:fixed;top:12px;right:18px;background:#16A34A;color:#fff;border:none;padding:8px 22px;font-size:13px;font-weight:700;border-radius:6px;cursor:pointer;z-index:999}
  @media print{.print-btn{display:none}@page{size:A4 portrait;margin:8mm 10mm}}
</style></head><body>
<button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
<div class="page">
  <div class="co-name">SHREE AARYA LOGISTICS</div>
  <div class="co-addr">197-AMBIKAPURI EXTENSION. AERODROME ROAD, NEAR GANGESHWAR DHAM TEMPLE, INDORE-M.P.-452005</div>
  <div class="info-bar">
    <span>DEALER NAME: ${consigneeName}&nbsp;&nbsp; PITHAMPUR TO ${placeOfDelivery}</span>
    <span>INVOICE NO: ${String(billNo).padStart(3, '0')}</span>
  </div>
  <table>
    <thead><tr>
      <th style="width:10%">Sr. No.</th><th style="width:42%">MODEL</th>
      <th style="width:16%">QUANTITY</th><th style="width:16%">RATE</th><th style="width:16%">AMOUNT</th>
    </tr></thead>
    <tbody>${rowsHtml}${fillerHtml}</tbody>
  </table>
  <div class="summary">
    <div style="font-weight:bold;font-size:9.5pt">EXPENSES REIMBURSEMENT TOLL &amp; TAX</div>
    <div style="margin-top:3px">Invoice Value Rs. : <strong>${totalAmount.toFixed(2)}</strong></div>
    <div style="margin-top:3px">Invoice Value Rs. (In Words) : <strong>- ${amountInWords} RUPEES AND ZERO PAISA ONLY</strong></div>
  </div>
  <div class="sig">
    <div>FOR : <strong>SHREE AARYA LOGISTICS</strong></div>
    <div style="height:24px"></div>
    <div><strong>AUTHORIZED SIGNATORY</strong></div>
    <div style="margin-top:3px">PLACE : PITHAMPUR</div>
    <div style="margin-top:8px;font-size:8pt;border-top:1px solid #ccc;padding-top:5px">Certified that the particulars given above are true and correct.</div>
  </div>
</div>
</body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) { logger.error('generateTollPDF:', err.message); res.status(500).json({ message: err.message }); }
};