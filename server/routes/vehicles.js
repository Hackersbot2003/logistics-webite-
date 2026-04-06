const router = require("express").Router();
const {
  getVehicles, getVehicle, getVehicleByChallan,
  createVehicle, updateVehicle, deleteVehicle,
  getChallanSettings, resetChallanCounter,
} = require("../controllers/vehicleController");
const { protect, authorize } = require("../middleware/auth");

// ── Public tracking route (no auth required) ──────────────────────────────────
router.get('/public/track/:uniqueId', async (req, res) => {
  try {
    const Vehicle = require('../models/Vehicle');
    const v = await Vehicle.findOne({ uniqueId: req.params.uniqueId, deletedAt: null })
      .select('placeOfDelivery model tempRegNo driverName date time vehicleStatus vehicleLocation consigneeName')
      .lean();
    if (!v) return res.status(404).json({ message: 'Vehicle not found' });
    res.json({ vehicle: v });
  } catch(err) { res.status(500).json({ message: err.message }); }
});

router.use(protect);

// Challan settings (superadmin only for reset)
router.get("/challan-settings", getChallanSettings);
router.post("/challan-reset", authorize("superadmin"), resetChallanCounter);

// Challan lookup (must be before /:id)
router.get("/challan/:challanNo", getVehicleByChallan);

router.get("/", getVehicles);
router.get("/:id", getVehicle);
router.post("/", createVehicle);
router.put("/:id", updateVehicle);
router.delete("/:id", deleteVehicle);

module.exports = router;
// Dashboard stats — returns vehicle counts by status and financial year
router.get('/stats/dashboard', async (req, res) => {
  try {
    const Vehicle = require('../models/Vehicle');
    const Driver  = require('../models/Driver');
    const { financialYear } = req.query;

    // Get all available financial years from VehicleSheet
    const VehicleSheet = require('../models/VehicleSheet');
    const sheets = await VehicleSheet.find({}, { financialYear: 1 }).lean();
    const allFYs = [...new Set(sheets.map(s => s.financialYear).filter(Boolean))].sort().reverse();

    // Current FY: April to March
    const now = new Date();
    const fyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const currentFY = `${fyYear}-${String(fyYear + 1).slice(2)}`;
    const targetFY = financialYear || currentFY;

    // Find sheets for this FY
    const fySheets = await VehicleSheet.find({ financialYear: targetFY }, { sheetName: 1 }).lean();
    const sheetNames = fySheets.map(s => s.sheetName);

    const baseQ = { deletedAt: null, ...(sheetNames.length ? { sheetName: { $in: sheetNames } } : {}) };

    const [delivered, inTransit, accidental, recentVehicles] = await Promise.all([
      Vehicle.countDocuments({ ...baseQ, vehicleStatus: /Delivered/i }),
      Vehicle.countDocuments({ ...baseQ, vehicleStatus: /In-Transit/i }),
      Vehicle.countDocuments({ ...baseQ, vehicleStatus: /Accidental/i }),
      Vehicle.find(baseQ).sort({ createdAt: -1 }).limit(10)
        .select('challanNo driverName placeOfDelivery vehicleStatus model createdAt deliveryDate')
        .lean(),
    ]);

    // Driver stats
    const today = new Date();
    const in30 = new Date(today); in30.setDate(today.getDate() + 30);
    const allDrivers = await Driver.find({}, { licenseValidity: 1 }).lean();
    let expiringSoon = 0, expired = 0;
    for (const d of allDrivers) {
      if (!d.licenseValidity) continue;
      const parts = d.licenseValidity.split(/[-/]/);
      let dt;
      if (parts.length === 3) {
        if (parts[2].length === 4) dt = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        else dt = new Date(d.licenseValidity);
      }
      if (!dt || isNaN(dt)) continue;
      if (dt < today) expired++;
      else if (dt <= in30) expiringSoon++;
    }

    res.json({
      financialYear: targetFY,
      allFYs,
      vehicle: { delivered, inTransit, accidental, total: delivered + inTransit + accidental },
      driver: { total: allDrivers.length, expiringSoon, expired },
      recentVehicles,
    });
  } catch(err) { res.status(500).json({ message: err.message }); }
});
