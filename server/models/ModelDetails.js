const mongoose = require('mongoose');

const modelSpecsSchema = new mongoose.Schema({
  modelInfo: {
    type: String,
    required: true
  },
  modelDetails: [String]
}, { _id: false });

const modelDetailsSchema = new mongoose.Schema({
  logisticPartner: String,

  // ✅ Make model unique (OPTION 1: global unique)
  model: {
    type: String,
    required: true,
    unique: true
  },

  // ✅ Array of specs
  modelSpecs: [modelSpecsSchema],

  average: Number,
  vehicleRate: Number,
  driverWages: Number,
  billingCode: Number,
}, { timestamps: true });

/*
✅ OPTIONAL (Better approach):
If you want SAME model name allowed for different partners:
use compound index instead of unique:true
*/

// modelDetailsSchema.index({ logisticPartner: 1, model: 1 }, { unique: true });


// ✅ Custom validator for unique modelInfo inside array
modelDetailsSchema.pre('save', function (next) {
  const infos = this.modelSpecs.map(s => s.modelInfo);

  const hasDuplicates = infos.length !== new Set(infos).size;

  if (hasDuplicates) {
    return next(new Error("modelInfo must be unique within a model"));
  }

  next();
});

module.exports = mongoose.model('ModelDetails', modelDetailsSchema);