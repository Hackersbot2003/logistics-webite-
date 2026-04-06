const logger = require("../config/logger");
const Driver = require("../models/Driver");
const SheetSyncQueue = require("../models/SheetSyncQueue");
const { appendDriverToSheet, updateDriverInSheet, deleteDriverFromSheet } = require("./sheetsService");

/**
 * MongoDB-backed Sheet Sync Queue
 * ─────────────────────────────────────────────────────────────────────────────
 * How it works:
 *
 *  1. Every Sheets operation (append / update / delete) runs immediately
 *     as a non-blocking background task.
 *
 *  2. SUCCESS → nothing stored, driver's pendingSheetSync stays false.
 *
 *  3. FAILURE → a SheetSyncQueue document is created in MongoDB with:
 *       - the operation type
 *       - the driverId (for append/update) OR a snapshot (for delete)
 *       - attempt count, last error, next retryAfter time
 *
 *  4. A retry worker runs every 2 minutes (started in server.js).
 *     It picks up all queue docs where: failed=false AND retryAfter <= now
 *     Retries them. On success → document is DELETED from MongoDB.
 *     On failure → attempt++ and retryAfter pushed forward (exponential backoff).
 *
 *  5. After maxAttempts (10), document is marked failed=true and kept for
 *     manual review. It auto-expires from MongoDB after 30 days.
 *
 * Cost: ₹0 — uses MongoDB Atlas free tier only. No Redis, no Bull, nothing paid.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Backoff calculator ────────────────────────────────────────────────────────
// attempt 1 →  2 min,  2 → 4 min,  3 → 8 min ... capped at 2 hours
const nextRetryAfter = (attempts) => {
  const minutes = Math.min(2 * Math.pow(2, attempts), 120);
  return new Date(Date.now() + minutes * 60 * 1000);
};

// ── Queue a failed operation ──────────────────────────────────────────────────
const enqueueFailure = async ({ operation, driverId = null, driverSnapshot = null, error }) => {
  try {
    // If a pending job for this driver+operation already exists, just increment
    if (driverId) {
      const existing = await SheetSyncQueue.findOne({
        driverId,
        operation,
        failed: false,
      });
      if (existing) {
        existing.attempts += 1;
        existing.lastError = error?.message || String(error);
        existing.lastAttemptAt = new Date();
        existing.retryAfter = nextRetryAfter(existing.attempts);
        if (existing.attempts >= existing.maxAttempts) {
          existing.failed = true;
          logger.error(`SheetSyncQueue: permanently failed ${operation} for driver ${driverId} after ${existing.attempts} attempts`);
        }
        await existing.save();
        return;
      }
    }

    await SheetSyncQueue.create({
      operation,
      driverId,
      driverSnapshot,
      attempts: 1,
      lastError: error?.message || String(error),
      lastAttemptAt: new Date(),
      retryAfter: nextRetryAfter(1),
    });

    logger.warn(`SheetSyncQueue: queued failed ${operation} for retry (driver: ${driverId || driverSnapshot?.tokenNo})`);
  } catch (dbErr) {
    // Even MongoDB failed — just log, never crash the main request
    logger.error(`SheetSyncQueue: could not save failure to DB: ${dbErr.message}`);
  }
};

// ── Try a single queue job ────────────────────────────────────────────────────
const processJob = async (job) => {
  try {
    if (job.operation === "append" || job.operation === "update") {
      const driver = await Driver.findById(job.driverId);
      if (!driver) {
        // Driver was deleted after this job was queued — clean up silently
        await SheetSyncQueue.findByIdAndDelete(job._id);
        return;
      }

      let rowIndex;
      if (job.operation === "append") {
        rowIndex = await appendDriverToSheet(driver);
      } else {
        rowIndex = await updateDriverInSheet(driver);
      }

      // Update driver's sheet row reference
      await Driver.findByIdAndUpdate(job.driverId, {
        sheetsRowIndex: rowIndex,
        pendingSheetSync: false,
      });

    } else if (job.operation === "delete") {
      await deleteDriverFromSheet(job.driverSnapshot);
    }

    // ✅ SUCCESS — delete the queue document, job is done
    await SheetSyncQueue.findByIdAndDelete(job._id);
    logger.info(`SheetSyncQueue: ${job.operation} succeeded for ${job.driverId || job.driverSnapshot?.tokenNo} — removed from queue`);

  } catch (err) {
    // ❌ FAILED again — update attempt count and push back retryAfter
    const newAttempts = (job.attempts || 1) + 1;
    const permanentlyFailed = newAttempts >= job.maxAttempts;

    await SheetSyncQueue.findByIdAndUpdate(job._id, {
      attempts: newAttempts,
      lastError: err.message,
      lastAttemptAt: new Date(),
      retryAfter: permanentlyFailed ? job.retryAfter : nextRetryAfter(newAttempts),
      failed: permanentlyFailed,
    });

    if (permanentlyFailed) {
      logger.error(`SheetSyncQueue: permanently failed ${job.operation} for ${job.driverId || job.driverSnapshot?.tokenNo} — manual intervention needed`);
    } else {
      logger.warn(`SheetSyncQueue: retry ${newAttempts}/${job.maxAttempts} failed for ${job.operation} (${job.driverId || job.driverSnapshot?.tokenNo}): ${err.message}`);
    }
  }
};

// ── Retry worker — called every 2 minutes ─────────────────────────────────────
const runRetryWorker = async () => {
  try {
    const now = new Date();
    const jobs = await SheetSyncQueue.find({
      failed: false,
      retryAfter: { $lte: now },
    }).limit(20); // process max 20 at a time to avoid rate limits

    if (jobs.length === 0) return;

    logger.info(`SheetSyncQueue: processing ${jobs.length} pending job(s)`);

    // Stagger by 3 seconds each to avoid hitting Google API rate limits
    for (let i = 0; i < jobs.length; i++) {
      setTimeout(() => processJob(jobs[i]), i * 3000);
    }
  } catch (err) {
    logger.error(`SheetSyncQueue retry worker error: ${err.message}`);
  }
};

// ── Public API ────────────────────────────────────────────────────────────────

const initQueue = () => {
  // Run retry worker immediately on startup, then every 2 minutes
  runRetryWorker();
  setInterval(runRetryWorker, 2 * 60 * 1000);
  logger.info("SheetSyncQueue: MongoDB-backed retry worker started (every 2 min)");
};

/**
 * Fire-and-forget: try Sheets append immediately.
 * On failure → create a SheetSyncQueue retry document.
 */
const queueSheetAppend = (driverId) => {
  (async () => {
    try {
      const driver = await Driver.findById(driverId);
      if (!driver) return;
      const rowIndex = await appendDriverToSheet(driver);
      await Driver.findByIdAndUpdate(driverId, {
        sheetsRowIndex: rowIndex,
        pendingSheetSync: false,
      });
      logger.info(`Sheets append OK: ${driver.tokenNo}`);
    } catch (err) {
      logger.warn(`Sheets append failed for ${driverId}, queuing for retry: ${err.message}`);
      await Driver.findByIdAndUpdate(driverId, { pendingSheetSync: true }).catch(() => {});
      await enqueueFailure({ operation: "append", driverId, error: err });
    }
  })().catch(() => {});
};

/**
 * Fire-and-forget: try Sheets update immediately.
 * On failure → create a SheetSyncQueue retry document.
 */
const queueSheetUpdate = (driverId) => {
  (async () => {
    try {
      const driver = await Driver.findById(driverId);
      if (!driver) return;
      const rowIndex = await updateDriverInSheet(driver);
      await Driver.findByIdAndUpdate(driverId, {
        sheetsRowIndex: rowIndex,
        pendingSheetSync: false,
      });
      logger.info(`Sheets update OK: ${driver.tokenNo}`);
    } catch (err) {
      logger.warn(`Sheets update failed for ${driverId}, queuing for retry: ${err.message}`);
      await Driver.findByIdAndUpdate(driverId, { pendingSheetSync: true }).catch(() => {});
      await enqueueFailure({ operation: "update", driverId, error: err });
    }
  })().catch(() => {});
};

/**
 * Fire-and-forget: try Sheets delete immediately.
 * On failure → create a SheetSyncQueue retry document with a driver snapshot
 * (because the driver document will already be gone from MongoDB by then).
 */
const queueSheetDelete = (driverSnapshot) => {
  (async () => {
    try {
      await deleteDriverFromSheet(driverSnapshot);
      logger.info(`Sheets delete OK: ${driverSnapshot.tokenNo}`);
    } catch (err) {
      logger.warn(`Sheets delete failed for ${driverSnapshot.tokenNo}, queuing for retry: ${err.message}`);
      await enqueueFailure({ operation: "delete", driverSnapshot, error: err });
    }
  })().catch(() => {});
};

/**
 * On server startup: re-queue any drivers still flagged as pendingSheetSync
 * that don't already have a queue document. Handles the edge case where
 * the server crashed between a MongoDB save and the Sheets attempt.
 */
const retryStaleSyncs = async () => {
  try {
    const stalePending = await Driver.find({ pendingSheetSync: true });
    if (stalePending.length === 0) return;

    for (const driver of stalePending) {
      // Check if already in queue
      const exists = await SheetSyncQueue.exists({
        driverId: driver._id,
        failed: false,
      });
      if (!exists) {
        await SheetSyncQueue.create({
          operation: driver.sheetsRowIndex ? "update" : "append",
          driverId: driver._id,
          lastError: "Recovered on server startup",
          retryAfter: new Date(), // eligible immediately
        });
      }
    }

    logger.info(`SheetSyncQueue: recovered ${stalePending.length} stale driver(s) from MongoDB into retry queue`);
  } catch (err) {
    logger.warn(`retryStaleSyncs failed: ${err.message}`);
  }
};

/**
 * Get current queue status — useful for admin monitoring.
 */
const getQueueStats = async () => {
  const [pending, failed, total] = await Promise.all([
    SheetSyncQueue.countDocuments({ failed: false }),
    SheetSyncQueue.countDocuments({ failed: true }),
    SheetSyncQueue.countDocuments(),
  ]);
  return { pending, failed, total };
};

module.exports = {
  initQueue,
  queueSheetAppend,
  queueSheetUpdate,
  queueSheetDelete,
  retryStaleSyncs,
  getQueueStats,
};
