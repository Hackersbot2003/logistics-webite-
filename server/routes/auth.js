const router = require("express").Router();
const { login, register, me, listUsers, toggleUser } = require("../controllers/authController");
const { protect, authorize } = require("../middleware/auth");
const { getQueueStats } = require("../services/queueService");
const SheetSyncQueue = require("../models/SheetSyncQueue");

router.post("/login", login);
router.post("/register", protect, authorize("superadmin"), register);
router.get("/me", protect, me);
router.get("/users", protect, authorize("superadmin", "admin"), listUsers);
router.patch("/users/:id/toggle", protect, authorize("superadmin"), toggleUser);

/**
 * GET /api/auth/queue-stats
 * Returns current SheetSyncQueue status for admin monitoring dashboard.
 */
router.get("/queue-stats", protect, authorize("superadmin", "admin"), async (req, res) => {
  try {
    const stats = await getQueueStats();
    // Also return the 10 most recent failed jobs for visibility
    const recentFailed = await SheetSyncQueue.find({ failed: true })
      .sort({ updatedAt: -1 })
      .limit(10)
      .select("operation driverId driverSnapshot attempts lastError updatedAt");
    const pendingJobs = await SheetSyncQueue.find({ failed: false })
      .sort({ retryAfter: 1 })
      .limit(20)
      .select("operation driverId attempts lastError retryAfter");
    res.json({ stats, recentFailed, pendingJobs });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch queue stats" });
  }
});

module.exports = router;
