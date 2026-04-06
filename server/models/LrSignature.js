const mongoose = require('mongoose');

const LrSignatureSchema = new mongoose.Schema({
  label:        { type: String, required: true },        // display name e.g. "Stamp 1"
  driveFileId:  { type: String, required: true },        // Google Drive file ID
  driveViewLink:{ type: String, required: true },        // webViewLink
  directUrl:    { type: String, required: true },        // direct image URL for embedding
  isDefault:    { type: Boolean, default: false },       // only one can be default
  uploadedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('LrSignature', LrSignatureSchema);