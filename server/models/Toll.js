const mongoose = require('mongoose');
const tollSchema = new mongoose.Schema({
  location: { type: String, required: true, unique: true },
  tollData: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });
module.exports = mongoose.models.Toll || mongoose.model('Toll', tollSchema);
