const mongoose = require("mongoose");

// Auto-generate SAL01, SAL02, ... token numbers
const generateTokenNo = async () => {
  const last = await mongoose.model("Driver").findOne({}, { tokenNo: 1 }, { sort: { createdAt: -1 } });
  if (!last || !last.tokenNo) return "SAL01";
  const match = last.tokenNo.match(/^SAL(\d+)$/i);
  if (!match) return "SAL01";
  const next = parseInt(match[1], 10) + 1;
  return `SAL${String(next).padStart(2, "0")}`;
};

const driverSchema = new mongoose.Schema(
  {
    tokenNo: {
      type: String,
      unique: true,
      uppercase: true,
    },

    // ── Personal Info ────────────────────────────────────
    fullName: { type: String, required: true, trim: true, uppercase: true },
    fatherName: { type: String, trim: true, required: true },
    phoneNumber: { type: String, trim: true, required: true },
    temporaryAddress: { type: String, required: true },
    permanentAddress: { type: String, required: true },
    dateOfBirth: { type: String, required: true },
    maritalStatus: {
      type: String,
      enum: ["single", "married", "divorced", "widowed", ""],
      required: true,
    },

    // ── Emergency Contact ────────────────────────────────
    emergencyRelation: { type: String, required: true },
    emergencyPerson: { type: String, required: true },
    emergencyContact: { type: String, required: true },

    // ── Documents ────────────────────────────────────────
    aadharNo: { type: String, unique: true, sparse: true, required: true },
    licenseNo: { type: String, required: true },
    licenseValidity: { type: String, required: true },

    // ── Company Info ─────────────────────────────────────
    senderName: String,
    senderContact: String,
    inchargeName: String,

    // ── Media URLs (stored after Google Drive upload) ────
    photoUrls: { type: [String], default: [], validate: [v => v.length <= 5, "Max 5 photos"] },
    aadharUrls: { type: [String], default: [], validate: [v => v.length <= 5, "Max 5 aadhar images"] },
    licenseUrls: { type: [String], default: [], validate: [v => v.length <= 5, "Max 5 license images"] },
    tokenUrls: { type: [String], default: [], validate: [v => v.length <= 5, "Max 5 token images"] },
    pdfUrl: { type: String, default: null }, // combined PDF (single latest)

    // ── Google Drive file IDs (for deletion/replacement) ─
    photoDriveIds: { type: [String], default: [] },
    aadharDriveIds: { type: [String], default: [] },
    licenseDriveIds: { type: [String], default: [] },
    tokenDriveIds: { type: [String], default: [] },
    pdfDriveId: { type: String, default: null },

    // ── Sync state ───────────────────────────────────────
    sheetsRowIndex: { type: Number, default: null }, // row in Google Sheet
    pendingSheetSync: { type: Boolean, default: false }, // flag if sync failed

    // ── Audit ────────────────────────────────────────────
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Auto-generate tokenNo before first save
driverSchema.pre("save", async function (next) {
  if (!this.tokenNo) {
    this.tokenNo = await generateTokenNo();
  }
  // Ensure uppercase
  if (this.tokenNo) this.tokenNo = this.tokenNo.toUpperCase();
  if (this.fullName) this.fullName = this.fullName.toUpperCase();
  next();
});

// Text search index
driverSchema.index({
  fullName: "text",
  tokenNo: "text",
  aadharNo: "text",
  phoneNumber: "text",
  licenseNo: "text",
});

module.exports = mongoose.model("Driver", driverSchema);
