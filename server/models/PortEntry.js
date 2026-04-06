const mongoose = require('mongoose');
const consigneeSchema = new mongoose.Schema({ consigneeName: { type: String, required: true }, consigneeRegion: { type: String, required: true }, consigneeAddress: { type: String, required: true } });
const portEntrySchema = new mongoose.Schema({
  portName: { type: String, required: true, unique: true },
  overallKm: { type: Number, required: true },
  consignees: [consigneeSchema],
}, { timestamps: true });
module.exports = mongoose.model('PortEntry', portEntrySchema);
