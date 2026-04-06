const express = require('express');
const multer  = require('multer');
const { protect, authorize } = require('../middleware/auth');
const {
  getSignatures, uploadSignature, setDefaultSignature,
  deleteSignature, generateLR,
} = require('../controllers/lrController');

const router = express.Router();

// Single-file upload for signatures (images only, 5MB max)
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

router.use(protect);

// Signature management
router.get ('/signatures',              getSignatures);
router.post('/signatures', authorize('superadmin','admin','manager'), upload.single('signature'), uploadSignature);
router.patch('/signatures/:id/default', authorize('superadmin','admin','manager'), setDefaultSignature);
router.delete('/signatures/:id',        authorize('superadmin','admin'), deleteSignature);

// LR PDF generation — all authenticated users
router.get('/generate', generateLR);

module.exports = router;