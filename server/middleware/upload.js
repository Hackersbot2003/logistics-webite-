const multer = require("multer");

// Store in memory so we can pipe directly to Google Drive
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG and WebP images are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 20, // max total files across all fields
  },
});

/**
 * Fields definition for driver document upload.
 * Each category allows up to 5 files.
 */
const driverUploadFields = upload.fields([
  { name: "photos", maxCount: 5 },
  { name: "aadhar", maxCount: 5 },
  { name: "license", maxCount: 5 },
  { name: "token", maxCount: 5 },
]);

module.exports = { upload, driverUploadFields };
