const Vehicle = require("../models/Vehicle");
const VehicleSheet = require("../models/VehicleSheet");
const ChallanSettings = require("../models/ChallanSettings");
const { appendVehicleToSheet, updateVehicleInSheet, deleteVehicleFromSheet } = require("../services/vehicleSheetsService");
const logger = require("../config/logger");

const TYPE_PREFIX = { FML:"FML", FML_EXP:"EXP", Others:"OTH" };

const getOrCreateSettings = async (sheetType) => {
  let s = await ChallanSettings.findOne({ sheetType });
  if (!s) s = await ChallanSettings.create({ sheetType, prefix: TYPE_PREFIX[sheetType]||sheetType, counter:0, resetDate:null, autoResetDate:"04-01" });
  return s;
};

// Challan is unique per SHEET — generate next available number for this sheet
const generateChallanNo = async (sheetType, sheetName) => {
  const settings = await getOrCreateSettings(sheetType);
  const prefix = settings.prefix;

  // Auto-reset check (April 1 by default)
  const now = new Date();
  const [rMo, rDy] = (settings.autoResetDate||"04-01").split("-").map(Number);
  const thisReset = new Date(now.getFullYear(), rMo-1, rDy);
  const lastReset = settings.resetDate ? new Date(settings.resetDate) : null;
  if (!lastReset || (now >= thisReset && lastReset < thisReset)) {
    settings.counter = 0;
    settings.resetDate = now;
    await settings.save();
  }

  // Find the highest challan number in this specific sheet
  const existing = await Vehicle.find({ sheetName, challanNo: new RegExp(`^${prefix}\\d+$`), deletedAt:null })
    .select("challanNo").lean();
  
  let maxNum = settings.counter;
  for (const v of existing) {
    const n = parseInt(v.challanNo.replace(prefix, ""), 10);
    if (!isNaN(n) && n > maxNum) maxNum = n;
  }

  const next = maxNum + 1;
  const challanNo = `${prefix}${String(next).padStart(2,"0")}`;

  // Update global counter if needed
  if (next > settings.counter) {
    settings.counter = next;
    await settings.save();
  }

  return challanNo;
};

const checkLocked = async (sheetName, res) => {
  const sheet = await VehicleSheet.findOne({ sheetName });
  if (!sheet) { res.status(404).json({ message:`Sheet "${sheetName}" not found` }); return true; }
  if (sheet.isLocked) { res.status(423).json({ message:`🔒 Sheet "${sheetName}" is locked.`, locked:true, sheetName }); return true; }
  return false;
};

const syncToSheets = (op, vehicle) => {
  (async()=>{
    try {
      let rowIndex;
      if (op==="append") rowIndex = await appendVehicleToSheet(vehicle);
      else if (op==="update") rowIndex = await updateVehicleInSheet(vehicle);
      else if (op==="delete") await deleteVehicleFromSheet(vehicle);
      if (rowIndex && vehicle._id) await Vehicle.findByIdAndUpdate(vehicle._id, { sheetsRowIndex:rowIndex, pendingSheetSync:false });
    } catch(err) {
      logger.warn(`Sheets sync (${op}) failed: ${err.message}`);
      if (vehicle._id) await Vehicle.findByIdAndUpdate(vehicle._id, { pendingSheetSync:true }).catch(()=>{});
    }
  })();
};

const getVehicles = async (req, res) => {
  try {
    const { sheetName, search, page=1, limit=10, status } = req.query;
    const skip = (Number(page)-1)*Number(limit);
    const query = { deletedAt:null };
    if (sheetName) query.sheetName = sheetName;
    if (search) query.$text = { $search:search };
    if (status) query.vehicleStatus = new RegExp(status, 'i');
    const [vehicles, total] = await Promise.all([
      Vehicle.find(query).sort({ challanNo:-1 }).skip(skip).limit(Number(limit)),
      Vehicle.countDocuments(query),
    ]);
    res.json({ vehicles, total, page:Number(page), pages:Math.ceil(total/Number(limit)) });
  } catch(err) { res.status(500).json({ message:"Server error" }); }
};

const getVehicle = async (req, res) => {
  try {
    const v = await Vehicle.findById(req.params.id);
    if (!v||v.deletedAt) return res.status(404).json({ message:"Not found" });
    res.json({ vehicle:v });
  } catch { res.status(500).json({ message:"Server error" }); }
};

const getVehicleByChallan = async (req, res) => {
  try {
    const v = await Vehicle.findOne({ challanNo:req.params.challanNo.toUpperCase(), deletedAt:null });
    if (!v) return res.status(404).json({ message:"Vehicle not found" });
    res.json({ vehicle:v });
  } catch { res.status(500).json({ message:"Server error" }); }
};

const createVehicle = async (req, res) => {
  try {
    const { sheetName, sheetType="FML", ...body } = req.body;
    if (!sheetName) return res.status(400).json({ message:"sheetName is required" });
    if (await checkLocked(sheetName, res)) return;

    const sheet = await VehicleSheet.findOne({ sheetName });
    const challanNo = await generateChallanNo(sheetType, sheetName);
    const uniqueId = `${TYPE_PREFIX[sheetType]||"VH"}${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2,5).toUpperCase()}`;

    const vehicle = await Vehicle.create({
      ...body, sheetName, sheetType,
      spreadsheetId: sheet?.spreadsheetId || process.env.VEHICLE_SPREADSHEET_ID,
      financialYear: sheet?.financialYear || null,
      challanNo, uniqueId,
      createdBy: req.user._id, updatedBy: req.user._id,
    });

    await VehicleSheet.findOneAndUpdate({ sheetName }, { $inc:{ vehicleCount:1 } });
    syncToSheets("append", vehicle);
    req.io?.emit("vehicle:created", { vehicle });
    logger.info(`Vehicle created: ${challanNo} in "${sheetName}" by ${req.user.email}`);
    res.status(201).json({ message:"Vehicle created", vehicle });
  } catch(err) {
    logger.error(`createVehicle: ${err.message}`);
    if (err.code===11000) return res.status(409).json({ message:"Duplicate entry — "+err.message });
    res.status(500).json({ message:err.message||"Server error" });
  }
};

const updateVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle||vehicle.deletedAt) return res.status(404).json({ message:"Not found" });
    if (await checkLocked(vehicle.sheetName, res)) return;
    const { sheetName, challanNo, spreadsheetId, uniqueId, ...updates } = req.body;
    const updated = await Vehicle.findByIdAndUpdate(vehicle._id, { ...updates, updatedBy:req.user._id, lastEditedBy:req.user.name||req.user.email }, { new:true });
    syncToSheets("update", updated);
    req.io?.emit("vehicle:updated", { vehicle:updated });
    res.json({ message:"Vehicle updated", vehicle:updated });
  } catch(err) { res.status(500).json({ message:err.message }); }
};

const deleteVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle||vehicle.deletedAt) return res.status(404).json({ message:"Not found" });
    if (await checkLocked(vehicle.sheetName, res)) return;
    await Vehicle.findByIdAndUpdate(vehicle._id, { deletedAt:new Date() });
    await VehicleSheet.findOneAndUpdate({ sheetName:vehicle.sheetName }, { $inc:{ vehicleCount:-1 } });
    syncToSheets("delete", vehicle);
    req.io?.emit("vehicle:deleted", { vehicleId:req.params.id });
    res.json({ message:"Vehicle deleted" });
  } catch(err) { res.status(500).json({ message:err.message }); }
};

const getChallanSettings = async (req, res) => {
  try {
    const types = ["FML","FML_EXP","Others"];
    const settings = await Promise.all(types.map(t=>getOrCreateSettings(t)));
    res.json({ settings });
  } catch(err) { res.status(500).json({ message:err.message }); }
};

const resetChallanCounter = async (req, res) => {
  try {
    const { sheetType, resetDate, autoResetDate } = req.body;
    const s = await getOrCreateSettings(sheetType);
    if (resetDate!==undefined) { s.counter=0; s.resetDate=new Date(resetDate); }
    if (autoResetDate) s.autoResetDate = autoResetDate;
    await s.save();
    res.json({ message:`${sheetType} reset`, settings:s });
  } catch(err) { res.status(500).json({ message:err.message }); }
};

module.exports = { getVehicles, getVehicle, getVehicleByChallan, createVehicle, updateVehicle, deleteVehicle, getChallanSettings, resetChallanCounter };