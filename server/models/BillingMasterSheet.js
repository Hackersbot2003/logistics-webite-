const mongoose = require('mongoose');

const billingMasterSheetSchema = new mongoose.Schema({
  sheetName:     { type: String, required: true, unique: true },
  sheetType:     { type: String, enum: ['FML','FML_EXP'], required: true },
  spreadsheetId: { type: String, required: true },
  googleSheetId: { type: Number, default: null },
  status:        { type: String, enum: ['active','inactive'], default: 'inactive' },
  isLocked:      { type: Boolean, default: false },
  billCounter:   { type: Number, default: 0 }, // 0 = no bills yet; 1 = "1&2" used; 2 = "3&4" used
  createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('BillingMasterSheet', billingMasterSheetSchema);