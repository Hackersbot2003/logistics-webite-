const mongoose = require('mongoose');
const logisticsSchema = new mongoose.Schema({
  logisticPartner: { type: String, required: true },
  location: String,
  consigneeName: String,
  consigneeAddress: String,
  consigneeRegion: String,
  overallKM: Number,
   accountsoverallKM: Number,
  returnFare: Number,
}, { timestamps: true });
module.exports = mongoose.model('LogisticsData', logisticsSchema);
