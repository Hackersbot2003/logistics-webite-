const router = require("express").Router();
const ctrl = require("../controllers/logisticsController");
const { protect, authorize } = require("../middleware/auth");

const canWrite = authorize("superadmin", "admin", "manager");
const canDelete = authorize("superadmin", "admin");

// ── TOLL ──────────────────────────────────────────────────────────────────────
router.get("/tolls", protect, ctrl.getTolls);
router.post("/tolls", protect, canWrite, ctrl.createToll);
router.put("/tolls/:id", protect, canWrite, ctrl.updateToll);
router.delete("/tolls/:id", protect, canDelete, ctrl.deleteToll);

// ── FML LOGISTICS DATA ────────────────────────────────────────────────────────
router.get("/fml", protect, ctrl.getLogistics);
router.post("/fml", protect, canWrite, ctrl.createLogistics);
router.put("/fml/:id", protect, canWrite, ctrl.updateLogistics);
router.delete("/fml/:id", protect, canDelete, ctrl.deleteLogistics);

// ── MODEL DETAILS ─────────────────────────────────────────────────────────────
router.get("/models", protect, ctrl.getModels);
router.post("/models", protect, canWrite, ctrl.createModel);
router.put("/models/:id", protect, canWrite, ctrl.updateModel);
router.delete("/models/:id", protect, canDelete, ctrl.deleteModel);

// ── OTHERS ────────────────────────────────────────────────────────────────────
router.get("/others", protect, ctrl.getOtherLogistics);
router.post("/others", protect, canWrite, ctrl.createOtherLogistics);
router.put("/others/:id", protect, canWrite, ctrl.updateOtherLogistics);
router.delete("/others/:id", protect, canDelete, ctrl.deleteOtherLogistics);

// ── EXP-FML PORTS ─────────────────────────────────────────────────────────────
router.get("/ports", protect, ctrl.getPorts);
router.post("/ports", protect, canWrite, ctrl.createPort);
router.put("/ports/:id", protect, canWrite, ctrl.updatePort);
router.delete("/ports/:id", protect, canDelete, ctrl.deletePort);

module.exports = router;

// ── SEARCH (used by Accounts calculations) ───────────────────────────────────
router.get("/search",          protect, ctrl.searchLogistics);
router.get("/models/search",   protect, ctrl.searchModels);
router.get("/tolls/search",    protect, ctrl.searchToll);
router.get("/others/search-by-partner", protect, ctrl.searchOthersByPartner);