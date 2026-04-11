const fs = require('fs');
const path = require('path');
const Vehicle = require('../models/Vehicle');
const LrSignature = require('../models/LrSignature');
const { uploadFileToDrive, deleteFileFromDrive } = require('../services/driveService');
const logger = require('../config/logger');
const puppeteer = require('puppeteer');

// ── Helper: HTML → PDF buffer ─────────────────────────────────────────────────
async function htmlToPdfBuffer(html) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
    ],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
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
    const { challanNo, addSignature, signatureId } = req.query;
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

    const logoBase64 = getLocalLogoBase64();

    const html = buildLRHtml(vehicle, signatureDataUrl, logoBase64);
    const pdfBuffer = await htmlToPdfBuffer(html);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=LR_${challanNo}.pdf`);
    res.send(pdfBuffer);
  } catch (err) {
    logger.error('generateLR error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// ── HTML/UI Building Functions ────────────────────────────────────────────────

function buildLRHtml(v, signatureUrl, logoBase64) {
  const fmt = (d) => {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('en-GB'); } catch { return d; }
  };

  const copies = ['ORIGINAL', 'DUPLICATE', 'TRIPLICATE'];

  const css = `
    * { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      background: #fff;
      font-family: Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ── A4 PAGE: fixed pixel dimensions (794 x 1123px @ 96dpi) ── */
    .page {
      width: 794px;
      height: 1123px;
      padding: 24px;
      page-break-after: always;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      position: relative;
    }

    /* ── INNER BOX ── */
    .inner-content {
      width: 100%;
      height: 100%;
      border: 1px solid #000;
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
    }

    /* ── TABLE SAFETY ── */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 3px;
    }

    tr, td, th {
      border: 1px solid #000;
      padding: 2px 5px;
      font-size: 8px;
      line-height: 1.3;
    }

    /* ── Header section ── */
    .header-title {
      font-size: 11px;
      font-weight: bold;
      text-align: center;
      padding: 3px 0;
    }
    .sub-title {
      font-size: 9px;
      text-align: center;
      line-height: 1.5;
      padding: 2px 0;
    }
    .doc-title {
      font-size: 13px;
      font-weight: bold;
      text-align: center;
      padding: 5px;
      background: #eeeeee;
      letter-spacing: 0.5px;
    }

    /* ── Field labels ── */
    .lbl {
      font-weight: bold;
      font-size: 8px;
      display: block;
      margin-bottom: 1px;
      color: #333;
    }

    /* ── ORIGINAL / DUPLICATE / TRIPLICATE badge ── */
    .copy-badge {
      font-weight: bold;
      font-size: 10px;
      text-align: right;
      vertical-align: middle;
      border: none !important;
    }
    .no-border td { border: none !important; }

    /* ── Checklist header row ── */
    .chk-header { background: #eeeeee; font-weight: bold; font-size: 8px; }

    /* ── Rating table header ── */
    .rating-header { background: #eeeeee; font-weight: bold; font-size: 8px; text-align: center; }

    /* ── Remarks box ── */
    .remarks-box {
      font-size: 8px;
      line-height: 1.9;
      border: 1px solid #000;
      padding: 3px 6px;
      margin-bottom: 3px;
    }

    /* ── Signature row ── */
    .sig-cell {
      height: 70px;
      vertical-align: bottom;
      text-align: center;
      font-weight: bold;
      font-size: 9px;
      padding-bottom: 5px;
    }
    .sig-img {
      max-height: 55px;
      max-width: 120px;
      display: block;
      margin: 0 auto 3px auto;
    }

    /* ── Section heading ── */
    .section-heading {
      font-weight: bold;
      font-size: 9px;
      margin: 2px 0 2px 0;
    }

    @page { size: A4 portrait; margin: 0; }
  `;

  const pages = copies.map(copy => buildPage(v, copy, signatureUrl, logoBase64, fmt)).join('\n');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${css}</style></head><body>${pages}</body></html>`;
}

function buildPage(v, copy, signatureUrl, logoBase64, fmt) {
  const sigImg = signatureUrl
    ? `<img src="${signatureUrl}" class="sig-img" />`
    : '';

  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" style="max-width:80px; max-height:75px; object-fit:contain; display:block; margin:auto;" />`
    : `<div style="font-size:18px; text-align:center;">🚛</div>`;

  const modelDisplay = [v.model, v.modelInfo, v.modelDetails].filter(Boolean).join(' ');

  return `
  <div class="page">
    <div class="inner-content">

      <!-- ══ HEADER ══ -->
      <table style="margin-bottom:4px;">
        <tr>
          <td rowspan="2" style="width:95px; text-align:center; vertical-align:middle; border:1px solid #000; padding:4px;">
            ${logoHtml}
          </td>
          <td class="header-title" style="border:1px solid #000;">SHREE AARYA LOGISTICS</td>
        </tr>
        <tr>
          <td class="sub-title" style="border:1px solid #000;">
            VIJAY NAGAR, INDORE-M.P.-452010<br>
            CONTACT DETAILS : INDORE +91-91111-91111
          </td>
        </tr>
        <tr>
          <td colspan="2" class="doc-title" style="border:1px solid #000;">CONSIGNMENT NOTE CUM CHECK LIST</td>
        </tr>
      </table>

      <!-- ══ CHALLAN NO + COPY BADGE ══ -->
      <table class="no-border" style="margin-bottom:3px;">
        <tr>
          <td style="width:60%; padding:2px 5px;">
            <span class="lbl" style="display:inline;">Challan No:</span>
            <strong style="font-size:16px; margin-left:4px;">${v.challanNo || ''}</strong>
          </td>
          <td class="copy-badge" style="padding:2px 5px;">${copy}</td>
        </tr>
      </table>

      <!-- ══ CONSIGNOR ROW ══ -->
      <table>
        <tr>
          <td style="width:48%">
            <span class="lbl">Name of Consignor:</span>
            ${v.consignorName || 'FORCE MOTOR LIMITED'}
          </td>
          <td style="width:26%">
            <span class="lbl">Invoice Date</span>
            ${fmt(v.invoiceDate)}
          </td>
          <td style="width:26%">
            <span class="lbl">Challan Date</span>
            ${fmt(v.dispatchDate || v.date)}
          </td>
        </tr>
        <tr>
          <td>
            <span class="lbl">Address of Consignor:</span>
            ${v.consignorAddress || 'PITHUMPUR, M.P.'}
          </td>
          <td colspan="2">
            <span class="lbl">Expected Delivery Date</span>
            ${fmt(v.expecteddeliveryDate)}
          </td>
        </tr>
      </table>

      <!-- ══ CONSIGNEE + DRIVER ══ -->
      <table>
        <tr>
          <td style="width:50%">
            <span class="lbl">Name of Depot/Dealer/Customer:</span>
            ${v.consigneeName || ''}
          </td>
          <td style="width:50%">
            <span class="lbl">Driver Name</span>
            ${v.driverName || ''}
          </td>
        </tr>
        <tr>
          <td>
            <span class="lbl">Address of Depot/Dealer/Customer:</span>
            ${v.consigneeAddress || ''}
          </td>
          <td>
            <span class="lbl">Place</span>
            ${v.placeOfCollection || ''}
          </td>
        </tr>
        <tr>
          <td></td>
          <td>
            <span class="lbl">Delivery</span>
            ${v.placeOfDelivery || ''}
          </td>
        </tr>
      </table>

      <!-- ══ VEHICLE DETAILS ══ -->
      <table>
        <tr>
          <td style="width:33%">
            <span class="lbl">Chassis No:</span>
            ${v.chassisNo || ''}
          </td>
          <td colspan="2">
            <span class="lbl">Vehicle Model:</span>
            ${modelDisplay}
          </td>
        </tr>
        <tr>
          <td>
            <span class="lbl">Engine No:</span>
            ${v.engineNo || ''}
          </td>
          <td colspan="2">
            <span class="lbl">Temp Reg No:</span>
            ${v.tempRegNo || ''}
          </td>
        </tr>
        <tr>
          <td>
            <span class="lbl">Invoice No:</span>
            ${v.invoiceNo || ''}
          </td>
          <td colspan="2">
            <span class="lbl">Insurance No:</span>
            ${v.insuranceNo || ''}
          </td>
        </tr>
        <tr>
          <td>
            <span class="lbl">Insurance Company:</span>
            ${v.insuranceCompany || ''}
          </td>
          <td colspan="2">
            <span class="lbl">KM Reading:</span>
            Start: _______ &nbsp;&nbsp; End: _______
          </td>
        </tr>
      </table>

      <!-- ══ CHECKLIST ══ -->
      <div class="section-heading">Checklist (Kindly Tick (✓))</div>
      <table>
        <tr>
          <th class="chk-header" style="width:65%; text-align:left;">Checklist</th>
          <th class="chk-header" style="width:17.5%; text-align:center;">Yes</th>
          <th class="chk-header" style="width:17.5%; text-align:center;">No</th>
        </tr>
        <tr><td>Invoice Original / Duplicate:</td><td style="text-align:center;">☐</td><td style="text-align:center;">☐</td></tr>
        <tr><td>Insurance Paper:</td><td style="text-align:center;">☐</td><td style="text-align:center;">☐</td></tr>
        <tr><td>T.R.C.:</td><td style="text-align:center;">☐</td><td style="text-align:center;">☐</td></tr>
        <tr><td>Service Book:</td><td style="text-align:center;">☐</td><td style="text-align:center;">☐</td></tr>
        <tr><td>Tool Kit:</td><td style="text-align:center;">☐</td><td style="text-align:center;">☐</td></tr>
        <tr><td>Key Ring:</td><td style="text-align:center;">☐</td><td style="text-align:center;">☐</td></tr>
      </table>

      <!-- ══ RATING TABLE ══ -->
      <table>
        <tr>
          <th class="rating-header" style="width:42%; text-align:left;">Particular</th>
          <th class="rating-header">Very Good</th>
          <th class="rating-header">Good</th>
          <th class="rating-header">Average</th>
          <th class="rating-header">Poor</th>
        </tr>
        <tr style="height:18px;"><td>Delivery on Time</td><td></td><td></td><td></td><td></td></tr>
        <tr style="height:18px;"><td>Behavior of Incharge</td><td></td><td></td><td></td><td></td></tr>
        <tr style="height:18px;"><td>Cleanliness of Vehicle</td><td></td><td></td><td></td><td></td></tr>
      </table>

      <!-- ══ DAMAGE + DISCLAIMER ══ -->
      <div style="font-size:8px; margin:3px 0;">
        Damage if any: &nbsp; ☐ YES &nbsp; ☐ NO &nbsp;&nbsp;&nbsp; E-Mail I'd: _______________________<br>
        <span style="font-style:italic; font-size:7.5px;">In case of any damage provide a photograph with incharge of convoy, standing near by the vehicle.</span>
      </div>

      <!-- ══ PARTNER INFO ══ -->
      <table>
        <tr>
          <td style="width:33%">PARTNER NAME:</td>
          <td style="width:33%">E-MAIL ID:</td>
          <td style="width:34%">CONTACT NO:</td>
        </tr>
        <tr>
          <td colspan="3">FOR TRANSIT RELATED INFORMATION CONTACT: 91-9752092341</td>
        </tr>
      </table>

      <!-- ══ REMARKS BOX ══ -->
      <div class="remarks-box">
        At the time of vehicle delivery Diesel in tank 7 Ltrs :-<br>
        In case of Manufacturing / Technical fault :-<br>
        Remark :-<br>
        Any Comments/Suggestion for Improvement of Services :-
      </div>

      <!-- ══ RECIPIENT ROW ══ -->
      <table>
        <tr>
          <td style="width:55%">Receipent Name: ${v.consigneeName || ''}</td>
          <td>Receipent Mob No.:</td>
        </tr>
      </table>

      <!-- ══ SIGNATURE ROW ══ -->
      <table style="margin-bottom:0;">
        <tr>
          <td class="sig-cell" style="width:33%;">DRIVER SIGNATURE</td>
          <td class="sig-cell" style="width:34%;">
            ${sigImg}
            SIGNATURE &amp; STAMP<br>
            DELIVERY DATE: ${fmt(v.deliveryDate || v.expecteddeliveryDate)}
          </td>
          <td class="sig-cell" style="width:33%;">RECEIPIENT SIGNATURE &amp; STAMP</td>
        </tr>
      </table>

    </div><!-- /inner-content -->
  </div><!-- /page -->`;
}