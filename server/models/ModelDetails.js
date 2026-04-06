const mongoose = require('mongoose');
const modelDetailsSchema = new mongoose.Schema({
  logisticPartner: String,
  model: String,
  modelSpecs: [{ modelInfo: String, modelDetails: [String] }],
  average: Number,
  vehicleRate: Number,
  driverWages: Number,
  billingCode: Number,
}, { timestamps: true });
module.exports = mongoose.model('ModelDetails', modelDetailsSchema);
