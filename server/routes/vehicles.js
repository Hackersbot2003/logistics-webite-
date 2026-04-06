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
router.post("/", authorize("superadmin", "admin", "manager"), createVehicle);
router.put("/:id", authorize("superadmin", "admin", "manager"), updateVehicle);
router.delete("/:id", authorize("superadmin", "admin"), deleteVehicle);

module.exports = router;