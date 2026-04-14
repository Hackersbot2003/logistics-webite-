const fs = require('fs');
const path = require('path');
const Vehicle = require('../models/Vehicle');
const LrSignature = require('../models/LrSignature');
const { uploadFileToDrive, deleteFileFromDrive } = require('../services/driveService');
const logger = require('../config/logger');
const pdf = require('html-pdf');
const ejs = require('ejs');

// ── Helper: HTML → PDF buffer ─────────────────────────────────────────────────
function htmlToPdfBuffer(html) {
  return new Promise((resolve, reject) => {
    // Ensure html is a string and not empty
    if (!html || typeof html !== 'string' || html.trim() === '') {
      return reject(new Error('HTML string is required'));
    }
    pdf.create(html, {
  format: "A4",
  orientation: "portrait",
  border: {
    top: "0mm",
    right: "0mm",
    bottom: "0mm",
    left: "0mm",
  },
  timeout: 60000,
}).toBuffer((err, buf) => (err ? reject(err) : resolve(buf)));
  });
}

// ── Helper: Get Local Logo as Base64 ──────────────────────────────────────────
function getLocalLogoBase64() {
  try {
    const logoPath = path.join(__dirname, '../assets/horselogo.jpg');
    if (!fs.existsSync(logoPath)) {
      logger.warn(`Logo not found at ${logoPath}, using fallback emoji.`);
      return null;
    }
    const bitmap = fs.readFileSync(logoPath);
    const extension = path.extname(logoPath).replace('.', '');
    return `data:image/${extension};base64,${bitmap.toString('base64')}`;
  } catch (err) {
    logger.error("Error reading logo file:", err.message);
    return null;
  }
}

// ── GET /api/lr/signatures ────────────────────────────────────────────────────
exports.getSignatures = async (req, res) => {
  try {
    const sigs = await LrSignature.find().sort({ createdAt: -1 });
    res.json({ signatures: sigs });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── POST /api/lr/signatures ───────────────────────────────────────────────────
exports.uploadSignature = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ message: 'No file uploaded' });
    const label = req.body.label || `Signature ${Date.now()}`;

    const driveFile = await uploadFileToDrive(file.buffer, file.originalname, file.mimetype, 'Signatures');
    const directUrl = `https://drive.google.com/uc?export=view&id=${driveFile.id}`;

    const count = await LrSignature.countDocuments();
    const sig = await LrSignature.create({
      label,
      driveFileId: driveFile.id,
      driveViewLink: driveFile.webViewLink,
      directUrl,
      isDefault: count === 0,
      uploadedBy: req.user._id,
    });

    res.status(201).json({ signature: sig });
  } catch (err) {
    logger.error('uploadSignature error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// ── PATCH /api/lr/signatures/:id/default ─────────────────────────────────────
exports.setDefaultSignature = async (req, res) => {
  try {
    await LrSignature.updateMany({}, { isDefault: false });
    const sig = await LrSignature.findByIdAndUpdate(req.params.id, { isDefault: true }, { new: true });
    if (!sig) return res.status(404).json({ message: 'Signature not found' });
    res.json({ signature: sig });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── DELETE /api/lr/signatures/:id ─────────────────────────────────────────────
exports.deleteSignature = async (req, res) => {
  try {
    const sig = await LrSignature.findById(req.params.id);
    if (!sig) return res.status(404).json({ message: 'Not found' });
    await deleteFileFromDrive(sig.driveFileId).catch(() => {});
    await sig.deleteOne();

    if (sig.isDefault) {
      const next = await LrSignature.findOne().sort({ createdAt: -1 });
      if (next) { next.isDefault = true; await next.save(); }
    }
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── GET /api/lr/generate ──────────────────────────────────────────────────────
exports.generateLR = async (req, res) => {
  try {
    const { challanNo, addSignature, signatureId, copies } = req.query;
    if (!challanNo) return res.status(400).json({ message: 'challanNo required' });

    const vehicle = await Vehicle.findOne({ 
        challanNo: new RegExp(`^${challanNo}$`, 'i'), 
        deletedAt: null 
    }).lean();

    if (!vehicle) return res.status(404).json({ message: `Challan "${challanNo}" not found` });

    let signatureDataUrl = null;
    if (addSignature === 'true') {
      let sig;
      if (signatureId) sig = await LrSignature.findById(signatureId);
      if (!sig) sig = await LrSignature.findOne({ isDefault: true });
      if (sig) signatureDataUrl = sig.directUrl;
    }

    // Use Google Drive logo instead of local logo
 const logoBase64 = getLocalLogoBase64();

    // Generate multiple copies if requested
    const requestedCopies = copies || 'original';
    let htmlContent = '';

    if (requestedCopies === 'all' || requestedCopies === 'three') {
      // Generate three copies: Original, Duplicate, Triplicate
      const copyTypes = ['ORIGINAL', 'DUPLICATE', 'TRIPLICATE'];
      
      for (let i = 0; i < copyTypes.length; i++) {
        const copyHtml = await buildLRHtml(vehicle, signatureDataUrl, logoBase64, copyTypes[i]);
        htmlContent += copyHtml;
        if (i < copyTypes.length - 1) {
          htmlContent += '<div style="page-break-after: always;"></div>'; // Page break between copies
        }
      }
    } else {
      // Generate single copy with specified type
      const copyType = requestedCopies.toUpperCase();
      htmlContent = await buildLRHtml(vehicle, signatureDataUrl, logoBase64, copyType);
    }

    if (!htmlContent || typeof htmlContent !== 'string' || htmlContent.trim() === '') {
      throw new Error('Generated HTML is empty or invalid');
    }

    const pdfBuffer = await htmlToPdfBuffer(htmlContent);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=LR_${challanNo}.pdf`);
    res.send(pdfBuffer);
  } catch (err) {
    logger.error('generateLR error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// ── HTML/UI Building Functions ───────────────────────────────────────────────

async function buildLRHtml(v, signatureUrl, logoBase64, copyType = 'ORIGINAL') {
  const fmt = (d) => {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('en-GB'); } catch { return d; }
  };

  // Render the EJS template
  const templatePath = path.join(__dirname, '../templates/lr-template.ejs');
  const html = await ejs.renderFile(templatePath, {
    vehicle: v,
    signatureUrl: signatureUrl,
    logoBase64: logoBase64,
    copyType: copyType,
    new: {
      Date: Date,
      DatePrototype: {
        toLocaleDateString: function(date, options) {
          return new Date(date).toLocaleDateString('en-GB', options);
        }
      }
    }
  });

  return html;
}
