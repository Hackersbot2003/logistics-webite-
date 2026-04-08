const router = require("express").Router();
const {
  listSheets, createSheet, toggleLock, deleteSheet, setStatus,
  listPumps, createPump, deletePump,setActiveSheet
} = require("../controllers/vehicleSheetController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

// ── Petrol Pump routes (MUST be before /:id routes) ───────────────────────────
router.get("/pumps",         listPumps);
router.post("/pumps",        authorize("superadmin", "admin", "manager"), createPump);
router.delete("/pumps/:id",  authorize("superadmin", "admin"), deletePump);

// ── Sheet routes ──────────────────────────────────────────────────────────────
router.get("/",              listSheets);
router.post("/",             authorize("superadmin", "admin"), createSheet);
router.patch("/:id/lock",    authorize("superadmin", "admin"), toggleLock);
router.patch("/:id/status",  authorize("superadmin", "admin"), setStatus);
router.delete("/:id",        authorize("superadmin"), deleteSheet);  // superadmin only

router.patch("/set-active/:id", setActiveSheet);

module.exports = router;
