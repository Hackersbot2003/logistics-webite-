const mongoose = require("mongoose");

/**
 * SheetSyncQueue
 *
 * Acts as a persistent job queue backed by MongoDB Atlas.
 * When a Google Sheets operation fails, a document is created here.
 * When the operation succeeds on retry, the document deletes itself.
 *
 * This means:
 *  - Zero paid services needed (no Redis, no Bull)
 *  - Survives server restarts (stored in MongoDB)
 *  - Self-cleaning (deleted on success)
 *  - Full audit trail of what failed and why
 */
const sheetSyncQueueSchema = new mongoose.Schema(
  {
    // Which operation to perform
    operation: {
      type: String,
      enum: ["append", "update", "delete"],
      required: true,
    },

    // For append/update — store the driver ID to re-fetch fresh data
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      default: null,
    },

    // For delete — driver is already gone from DB, so snapshot the row info
    driverSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // Retry tracking
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 10,
    },
    lastAttemptAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      default: null,
    },

    // Exponential backoff: next retry not before this time
    retryAfter: {
      type: Date,
      default: () => new Date(), // immediately eligible on creation
    },

    // Permanently failed (exhausted maxAttempts) — kept for manual review
    failed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    // Auto-delete permanently-failed records after 30 days
    expires: 60 * 60 * 24 * 30,
  }
);

// Index for efficient queue polling: find pending jobs due for retry
sheetSyncQueueSchema.index({ failed: 1, retryAfter: 1 });
sheetSyncQueueSchema.index({ driverId: 1 });

module.exports = mongoose.model("SheetSyncQueue", sheetSyncQueueSchema);
