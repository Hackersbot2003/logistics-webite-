const router = require("express").Router();
const {
  createDriver, getDrivers, getDriver, updateDriver, deleteDriver, getByToken,
} = require("../controllers/driverController");
const { protect, authorize } = require("../middleware/auth");
const { driverUploadFields } = require("../middleware/upload");

// Public token lookup (can restrict with protect if needed)
router.get("/token/:tokenNo", protect, getByToken);

router.get("/", protect, getDrivers);
router.get("/:id", protect, getDriver);

router.post(
  "/",
  protect,
  driverUploadFields,
  createDriver
);

router.put(
  "/:id",
  protect,
  driverUploadFields,
  updateDriver
);

router.delete(
  "/:id",
  protect,
  deleteDriver
);

module.exports = router;
