const mongoose = require('mongoose');
const consigneeSchema = new mongoose.Schema({ consigneeName: { type: String, required: true }, consigneeRegion: { type: String, required: true }, consigneeAddress: { type: String, required: true } });
const locationSchema = new mongoose.Schema({ locationName: { type: String, required: true }, consignees: [consigneeSchema] });
const consignorSchema = new mongoose.Schema({ consignorName: { type: String, required: true }, consignorAddress: { type: String, required: true } });
const placeOfCollectionSchema = new mongoose.Schema({ placeName: { type: String, required: true }, consignors: [consignorSchema] });
const otherLogisticsSchema = new mongoose.Schema({
  logisticsPartner: { type: String, required: true, unique: true },
  partnerCode: { type: String, required: true, unique: true },
  locations: [locationSchema],
  placesOfCollection: [placeOfCollectionSchema],
}, { timestamps: true });
module.exports = mongoose.model('OtherLogisticsPartner', otherLogisticsSchema);
