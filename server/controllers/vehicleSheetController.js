const VehicleSheet = require("../models/VehicleSheet");
const Vehicle = require("../models/Vehicle");
const PetrolPump = require("../models/PetrolPump");
const { createSheetTab, deleteSheetTab } = require("../services/vehicleSheetsService");
const logger = require("../config/logger");

// ── Helper: pick correct spreadsheet ID per type ──────────────────────────────
const getSpreadsheetId = (sheetType) => {
  if (sheetType === "FML_EXP") return process.env.FML_EXP_SPREADSHEET_ID || process.env.VEHICLE_SPREADSHEET_ID;
  if (sheetType === "Others")  return process.env.OTHERS_SPREADSHEET_ID  || process.env.VEHICLE_SPREADSHEET_ID;
  return process.env.FML_SPREADSHEET_ID || process.env.VEHICLE_SPREADSHEET_ID;
};

// ── GET /api/vehicle-sheets?type=FML ──────────────────────────────────────────
const listSheets = async (req, res) => {
  try {
    const { type } = req.query;
    const q = type ? { sheetType: type } : {};
    const sheets = await VehicleSheet.find(q)
      .sort({ createdAt: -1 })
      .populate("createdBy", "name email")
      .populate("lockedBy", "name email");
    res.json({ sheets });
  } catch (err) { res.status(500).json({ message: "Failed to load sheets" }); }
};

// ── POST /api/vehicle-sheets ──────────────────────────────────────────────────
const createSheet = async (req, res) => {
  try {
    const { sheetName, financialYear, sheetType = "FML" } = req.body;
    if (!sheetName?.trim()) return res.status(400).json({ message: "Sheet name is required" });

    // Auto-derive financial year from current date (April = new year)
    const now = new Date();
    const yr = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fy = financialYear?.trim() || `${yr}-${String(yr + 1).slice(2)}`;

    // Full name = sheetName + fy, e.g. "MAY2025-26"
    const fullName = `${sheetName.trim().toUpperCase()}${fy}`;

    const exists = await VehicleSheet.findOne({ sheetName: fullName });
    if (exists) return res.status(409).json({ message: `Sheet "${fullName}" already exists` });

    const spreadsheetId = getSpreadsheetId(sheetType);

    let googleSheetId = null;
    try { googleSheetId = await createSheetTab(fullName, spreadsheetId); }
    catch (gErr) { logger.warn(`Sheets tab creation failed: ${gErr.message}`); }

    const sheet = await VehicleSheet.create({
      sheetName: fullName,
      sheetType,
      spreadsheetId,
      financialYear: fy,
      googleSheetId,
      status: "active",
      isLocked: false,
      createdBy: req.user._id,
    });

    req.io?.emit("vehicleSheet:created", { sheet });
    logger.info(`Sheet "${fullName}" (${sheetType}) created by ${req.user.email}`);
    res.status(201).json({ message: "Sheet created", sheet });
  } catch (err) {
    logger.error(`createSheet error: ${err.message}`);
    res.status(500).json({ message: err.message || "Failed to create sheet" });
  }
};

// ── PATCH /api/vehicle-sheets/:id/lock — admin only ───────────────────────────
const toggleLock = async (req, res) => {
  try {
    const sheet = await VehicleSheet.findById(req.params.id);
    if (!sheet) return res.status(404).json({ message: "Sheet not found" });
    sheet.isLocked = !sheet.isLocked;
    sheet.lockedAt = sheet.isLocked ? new Date() : null;
    sheet.lockedBy = sheet.isLocked ? req.user._id : null;
    await sheet.save();
    req.io?.emit("vehicleSheet:updated", { sheet });
    logger.info(`Sheet "${sheet.sheetName}" ${sheet.isLocked ? "locked" : "unlocked"} by ${req.user.email}`);
    res.json({ message: sheet.isLocked ? `Locked` : `Unlocked`, sheet });
  } catch (err) { res.status(500).json({ message: "Failed to toggle lock" }); }
};

// ── DELETE /api/vehicle-sheets/:id — superadmin only ─────────────────────────
const deleteSheet = async (req, res) => {
  try {
    const { confirmed } = req.body;
    const sheet = await VehicleSheet.findById(req.params.id);
    if (!sheet) return res.status(404).json({ message: "Sheet not found" });

    if (!confirmed) {
      const vehicleCount = await Vehicle.countDocuments({ sheetName: sheet.sheetName });
      return res.json({ requiresConfirmation: true, sheetName: sheet.sheetName, vehicleCount });
    }

    await Vehicle.deleteMany({ sheetName: sheet.sheetName });
    if (sheet.googleSheetId) {
      try { await deleteSheetTab(sheet.googleSheetId, sheet.spreadsheetId); }
      catch (gErr) { logger.warn(`Could not delete Sheets tab: ${gErr.message}`); }
    }
    await VehicleSheet.findByIdAndDelete(sheet._id);
    req.io?.emit("vehicleSheet:deleted", { sheetId: req.params.id, sheetName: sheet.sheetName });
    logger.info(`Sheet "${sheet.sheetName}" deleted by ${req.user.email}`);
    res.json({ message: `Sheet "${sheet.sheetName}" permanently deleted.` });
  } catch (err) {
    logger.error(`deleteSheet error: ${err.message}`);
    res.status(500).json({ message: "Failed to delete sheet" });
  }
};

// ── PATCH /api/vehicle-sheets/:id/status ─────────────────────────────────────
const setStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["active", "inactive"].includes(status)) return res.status(400).json({ message: "Invalid status" });
    const sheet = await VehicleSheet.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!sheet) return res.status(404).json({ message: "Sheet not found" });
    req.io?.emit("vehicleSheet:updated", { sheet });
    res.json({ sheet });
  } catch (err) { res.status(500).json({ message: "Failed to update status" }); }
};

// ── PETROL PUMP CRUD ──────────────────────────────────────────────────────────
const listPumps = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const [pumps, total] = await Promise.all([
      PetrolPump.find().sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      PetrolPump.countDocuments(),
    ]);
    res.json({ pumps, total, pages: Math.ceil(total / Number(limit)) });
  } catch (err) { res.status(500).json({ message: "Failed to load pumps" }); }
};

const createPump = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "Name required" });
    const pump = await PetrolPump.create({ name: name.trim() });
    res.status(201).json({ pump });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "Pump already exists" });
    res.status(500).json({ message: err.message });
  }
};

const deletePump = async (req, res) => {
  try {
    await PetrolPump.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// controllers/vehicleSheetsController.js

 const setActiveSheet = async (req, res) => {
  try {
    const { id } = req.params;

    // find selected sheet
    const sheet = await VehicleSheet.findById(id);
    if (!sheet) {
      return res.status(404).json({ message: "Sheet not found" });
    }

    // 🔥 IMPORTANT: deactivate ALL of same type
    await VehicleSheet.updateMany(
      { sheetType: sheet.sheetType },
      { status: "inactive" }
    );

    // activate selected
    sheet.status = "active";
    await sheet.save();

    res.json({ message: "Active sheet updated" });
  } catch (err) {
    res.status(500).json({ message: "Failed to set active sheet" });
  }
};

module.exports = { listSheets, createSheet, toggleLock, deleteSheet, setStatus, listPumps, createPump, deletePump,setActiveSheet };

