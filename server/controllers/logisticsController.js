const Toll = require("../models/Toll");
const LogisticsData = require("../models/LogisticsData");
const ModelDetails = require("../models/ModelDetails");
const OtherLogistics = require("../models/OtherLogistics");
const PortEntry = require("../models/PortEntry");
const logger = require("../config/logger");
const { syncTollToSheet, deleteTollFromSheet, syncLogisticsToSheet, deleteLogisticsFromSheet, syncModelToSheet, deleteModelFromSheet } = require("../services/logisticsSheetService");

// ── TOLL ──────────────────────────────────────────────────────────────────────
exports.getTolls = async (req, res) => {
  try {
    const { search } = req.query;
    const q = search ? { location: new RegExp(search, "i") } : {};
    const tolls = await Toll.find(q).sort({ location: 1 });
    res.json({ tolls });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.createToll = async (req, res) => {
  try {
    const { location, tollData } = req.body;
    const toll = await Toll.create({ location, tollData: tollData || {} });
    try { syncTollToSheet(toll); } catch(_) {}
    res.status(201).json({ toll });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "Location already exists" });
    res.status(500).json({ message: err.message });
  }
};

exports.updateToll = async (req, res) => {
  try {
    const { location, tollData } = req.body;
    const toll = await Toll.findByIdAndUpdate(req.params.id, { location, tollData, updatedAt: new Date() }, { new: true });
    if (!toll) return res.status(404).json({ message: "Not found" });
    try { syncTollToSheet(toll); } catch(_) {}
    res.json({ toll });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.deleteToll = async (req, res) => {
  try {
    const toll = await Toll.findByIdAndDelete(req.params.id);
    if (!toll) return res.status(404).json({ message: "Not found" });
    try { deleteTollFromSheet(toll.location); } catch(_) {}
    res.json({ message: "Deleted" });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── LOGISTICS DATA (FML) ──────────────────────────────────────────────────────
exports.getLogistics = async (req, res) => {
  try {
    const { partner } = req.query;
    const q = partner ? { logisticPartner: partner } : {};
    const items = await LogisticsData.find(q).sort({ createdAt: -1 });
    res.json({ items });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.createLogistics = async (req, res) => {
  try {
    const item = await LogisticsData.create(req.body);
    try { syncLogisticsToSheet(item); } catch(_) {}
    res.status(201).json({ item });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.updateLogistics = async (req, res) => {
  try {
    const item = await LogisticsData.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).json({ message: "Not found" });
    try { syncLogisticsToSheet(item); } catch(_) {}
    res.json({ item });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.deleteLogistics = async (req, res) => {
  try {
    const item = await LogisticsData.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: "Not found" });
    try { deleteLogisticsFromSheet(item); } catch(_) {}
    res.json({ message: "Deleted" });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── MODEL DETAILS ─────────────────────────────────────────────────────────────
exports.getModels = async (req, res) => {
  try {
    const { partner } = req.query;
    const q = partner ? { logisticPartner: partner } : {};
    const items = await ModelDetails.find(q).sort({ createdAt: -1 });
    res.json({ items });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.createModel = async (req, res) => {
  try {
    const { modelSpecs } = req.body;

    if (modelSpecs) {
      // ✅ 1. modelInfo unique
      const infos = modelSpecs.map(s => s.modelInfo?.trim().toLowerCase());
      if (infos.length !== new Set(infos).size) {
        return res.status(400).json({
          message: "modelInfo must be unique within a model"
        });
      }

      // ✅ 2. modelDetails unique inside each object
      for (let spec of modelSpecs) {
        if (spec.modelDetails) {
          const details = spec.modelDetails.map(d => d.trim().toLowerCase());

          if (details.length !== new Set(details).size) {
            return res.status(400).json({
              message: `Duplicate modelDetails found in modelInfo: ${spec.modelInfo}`
            });
          }
        }
      }
    }

    const item = await ModelDetails.create(req.body);

    try { syncModelToSheet(item); } catch (_) {}

    res.status(201).json({ item });

  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "Model already exists" });
    }
    res.status(500).json({ message: err.message });
  }
};

exports.updateModel = async (req, res) => {
  try {
    const { modelSpecs } = req.body;

    if (modelSpecs) {
      // ✅ 1. modelInfo unique
      const infos = modelSpecs.map(s => s.modelInfo?.trim().toLowerCase());
      if (infos.length !== new Set(infos).size) {
        return res.status(400).json({
          message: "modelInfo must be unique within a model"
        });
      }

      // ✅ 2. modelDetails unique inside each object
      for (let spec of modelSpecs) {
        if (spec.modelDetails) {
          const details = spec.modelDetails.map(d => d.trim().toLowerCase());

          if (details.length !== new Set(details).size) {
            return res.status(400).json({
              message: `Duplicate modelDetails found in modelInfo: ${spec.modelInfo}`
            });
          }
        }
      }
    }

    const item = await ModelDetails.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: "Not found" });
    }

    Object.assign(item, req.body);

    await item.save(); // ✅ triggers schema validation

    try { syncModelToSheet(item); } catch (_) {}

    res.json({ item });

  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "Model already exists" });
    }

    res.status(500).json({ message: err.message });
  }
};

exports.deleteModel = async (req, res) => {
  try {
    const item = await ModelDetails.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: "Not found" });
    try { deleteModelFromSheet(item); } catch(_) {}
    res.json({ message: "Deleted" });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── OTHER LOGISTICS ───────────────────────────────────────────────────────────
exports.getOtherLogistics = async (req, res) => {
  try {
    const items = await OtherLogistics.find().sort({ logisticsPartner: 1 });
    res.json({ items });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.createOtherLogistics = async (req, res) => {
  try {
    const item = await OtherLogistics.create(req.body);
    res.status(201).json({ item });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "Partner or code already exists" });
    res.status(500).json({ message: err.message });
  }
};

exports.updateOtherLogistics = async (req, res) => {
  try {
    const item = await OtherLogistics.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json({ item });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.deleteOtherLogistics = async (req, res) => {
  try {
    const item = await OtherLogistics.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Deleted" });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── PORT ENTRIES (EXP-FML) ────────────────────────────────────────────────────
exports.getPorts = async (req, res) => {
  try {
    const items = await PortEntry.find().sort({ portName: 1 });
    res.json({ items });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.createPort = async (req, res) => {
  try {
    const item = await PortEntry.create(req.body);
    res.status(201).json({ item });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "Port already exists" });
    res.status(500).json({ message: err.message });
  }
};

exports.updatePort = async (req, res) => {
  try {
    const item = await PortEntry.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json({ item });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.deletePort = async (req, res) => {
  try {
    const item = await PortEntry.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Deleted" });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── SEARCH HELPERS (for Accounts page calculations) ──────────────────────────

// GET /api/logistics/search?logisticPartner=FML&location=X&consigneeName=Y
exports.searchLogistics = async (req, res) => {
  try {
    const { logisticPartner, location, consigneeName } = req.query;
    const q = {};
    if (logisticPartner) q.logisticPartner = new RegExp(logisticPartner, "i");
    if (location) q.location = new RegExp(location, "i");
    if (consigneeName) q.consigneeName = new RegExp(consigneeName, "i");
    const item = await LogisticsData.findOne(q);
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/logistics/models/search?logisticPartner=FML&model=T1
exports.searchModels = async (req, res) => {
  try {
    const { logisticPartner, model } = req.query;
    const q = {};
    if (logisticPartner) q.logisticPartner = new RegExp(logisticPartner, "i");
    if (model) q.model = new RegExp(model, "i");
    const items = await ModelDetails.find(q);
    if (!items.length) return res.status(404).json({ message: "Not found" });
    res.json(items);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/logistics/tolls/search?location=X&model=T1
exports.searchToll = async (req, res) => {
  try {
    const { location, model } = req.query;
    const toll = await Toll.findOne({ location: new RegExp(location, "i") });
    if (!toll) return res.status(404).json({ message: "Not found" });
    res.json([toll.tollData]); // returns array like [{T1: 450, T2: 300}]
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/logistics/others/search-by-partner?partner=X
exports.searchOthersByPartner = async (req, res) => {
  try {
    const { partner } = req.query;
    const item = await OtherLogistics.findOne({ logisticsPartner: new RegExp(partner, "i") });
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json({ item });
  } catch (err) { res.status(500).json({ message: err.message }); }
};