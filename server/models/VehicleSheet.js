const mongoose = require("mongoose");

const vehicleSheetSchema = new mongoose.Schema(
  {
    sheetName: { type: String, required: true, unique: true, trim: true },
    sheetType: { type: String, enum: ["FML", "FML_EXP", "Others"], default: "FML" },
    spreadsheetId: { type: String, required: true },
    googleSheetId: { type: Number, default: null },
    financialYear: { type: String, default: null },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    isLocked: { type: Boolean, default: false },
    lockedAt: { type: Date, default: null },
    lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    vehicleCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("VehicleSheet", vehicleSheetSchema);
