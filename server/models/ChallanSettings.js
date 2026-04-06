const mongoose = require("mongoose");

// Stores the challan counter per type (FML, FML_EXP, Others) with reset date
const challanSettingsSchema = new mongoose.Schema({
  sheetType: { type: String, required: true, unique: true }, // FML, FML_EXP, Others
  prefix: { type: String, required: true },                  // FML, EXP, OTH
  counter: { type: Number, default: 0 },                     // current count
  resetDate: { type: Date, default: null },                   // last reset date
  autoResetDate: { type: String, default: "04-01" },         // MM-DD, default April 1
}, { timestamps: true });

module.exports = mongoose.model("ChallanSettings", challanSettingsSchema);
