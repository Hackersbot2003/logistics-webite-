const mongoose = require('mongoose');

const billingRecordSchema = new mongoose.Schema({
  billingSheetName: { type: String, required: true },
  sheetType:        { type: String, enum: ['FML','FML_EXP'], required: true },
  vehicleSheetName: { type: String, required: true },
  location:         { type: String, required: true },
  consigneeName:    { type: String, required: true },
  invoiceNo:        { type: Number, required: true },   // e.g. 1
  tollBillNo:       { type: Number, required: true },   // e.g. 2
  billNoPair:       { type: String, required: true },   // e.g. "1&2"
  invoiceDate:      { type: String },
  eAckNumber:       { type: String },
  eAckDate:         { type: String },
  models:           [{ type: String }],
  urbania:          { type: Boolean, default: false },
  urbaniaIncentive: { type: Number, default: 1000 },
  miscRate:         { type: Number, default: 500 },
  cgstRate:         { type: Number, default: 9 },
  sgstRate:         { type: Number, default: 9 },
  overallKm:        { type: Number, default: 0 },
  vehicleUniqueIds: [{ type: String }],
  vehicles:         [{ type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' }],
  // Totals
  transportationSubTotal: { type: Number, default: 0 },
  transportationCGST:     { type: Number, default: 0 },
  transportationSGST:     { type: Number, default: 0 },
  taxInvoiceTotal:        { type: Number, default: 0 },
  tollSubTotal:           { type: Number, default: 0 },
  tollCGST:               { type: Number, default: 0 },
  tollSGST:               { type: Number, default: 0 },
  tollBillTotal:          { type: Number, default: 0 },
  driveFileId:      { type: String, default: null },   // Google Drive file ID for the PDF
  driveViewLink:    { type: String, default: null },   // Public view link for the PDF
  createdBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('BillingRecord', billingRecordSchema);