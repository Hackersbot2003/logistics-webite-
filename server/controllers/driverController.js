const Driver = require("../models/Driver");
const { uploadFileToDrive, deleteFileFromDrive, uploadPdfToDrive } = require("../services/driveService");
const { generateDriverPdf } = require("../services/pdfService");
const { queueSheetAppend, queueSheetUpdate, queueSheetDelete } = require("../services/queueService");
const logger = require("../config/logger");
const fetch = require("node-fetch");

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Upload a set of image buffers to Drive and return { urls, driveIds }.
 */
const uploadImageGroup = async (files = [], category, tokenNo) => {
  const urls = [];
  const driveIds = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filename = `${tokenNo}_${category}_${i + 1}_${Date.now()}.${file.mimetype.split("/")[1]}`;
    const result = await uploadFileToDrive(file.buffer, filename, file.mimetype, category);
    urls.push(result.webViewLink);
    driveIds.push(result.id);
  }

  return { urls, driveIds };
};

/**
 * Emit a real-time event to all connected clients.
 */
const emit = (req, event, data) => {
  if (req.io) req.io.emit(event, data);
};

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/drivers
 * Create a new driver with optional image uploads
 */
const createDriver = async (req, res) => {
  let driver = null;
  try {
    const body = req.body;
    const files = req.files || {};

    // Uppercase the name fields
    if (body.fullName) body.fullName = body.fullName.toUpperCase();

    // 1. Create driver record first (to get sequential tokenNo via pre-save hook)
    const driverDoc = new Driver({
      ...body,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
    driver = await driverDoc.save();

    // 2. Upload images to Drive (parallel per category)
    const [photoRes, aadharRes, licenseRes, tokenRes] = await Promise.all([
      uploadImageGroup(files.photos || [], "photos", driver.tokenNo),
      uploadImageGroup(files.aadhar || [], "aadhar", driver.tokenNo),
      uploadImageGroup(files.license || [], "license", driver.tokenNo),
      uploadImageGroup(files.token || [], "token", driver.tokenNo),
    ]);

    // 3. Generate PDF from all uploaded images
    const allBuffers = {
      photos: (files.photos || []).map((f) => f.buffer),
      aadhar: (files.aadhar || []).map((f) => f.buffer),
      license: (files.license || []).map((f) => f.buffer),
      token: (files.token || []).map((f) => f.buffer),
    };

    let pdfUrl = null;
    let pdfDriveId = null;
    const hasImages = Object.values(allBuffers).some((g) => g.length > 0);

    if (hasImages) {
      const pdfBuffer = await generateDriverPdf(allBuffers, {
        fullName: driver.fullName,
        tokenNo: driver.tokenNo,
      });
      const pdfResult = await uploadPdfToDrive(pdfBuffer, driver.tokenNo, null);
      pdfUrl = pdfResult.webViewLink;
      pdfDriveId = pdfResult.id;
    }

    // 4. Update driver with all URLs
    const updated = await Driver.findByIdAndUpdate(
      driver._id,
      {
        photoUrls: photoRes.urls,
        photoDriveIds: photoRes.driveIds,
        aadharUrls: aadharRes.urls,
        aadharDriveIds: aadharRes.driveIds,
        licenseUrls: licenseRes.urls,
        licenseDriveIds: licenseRes.driveIds,
        tokenUrls: tokenRes.urls,
        tokenDriveIds: tokenRes.driveIds,
        pdfUrl,
        pdfDriveId,
      },
      { new: true }
    );

    // 5. Sync to Google Sheets (async, non-blocking - fire and forget)
    try { queueSheetAppend(updated._id.toString()); } catch (_) {}

    // 6. Broadcast to all clients
    emit(req, "driver:created", { driver: updated });

    logger.info(`Driver created: ${updated.tokenNo} by ${req.user.email}`);
    res.status(201).json({ message: "Driver created", driver: updated });
  } catch (err) {
    // Rollback: if driver was saved but something else failed, delete it
    if (driver?._id) {
      try { await Driver.findByIdAndDelete(driver._id); } catch (_) {}
    }
    logger.error(`createDriver error: ${err.message}`);
    res.status(500).json({ message: err.message || "Server error" });
  }
};

/**
 * GET /api/drivers
 * List all drivers with search + pagination
 */
const getDrivers = async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    let query = {};
    if (search) {
      query = { $text: { $search: search } };
    }

    const [drivers, total] = await Promise.all([
      Driver.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("createdBy", "name email"),
      Driver.countDocuments(query),
    ]);

    res.json({ drivers, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    logger.error(`getDrivers error: ${err.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/drivers/:id
 * Get single driver by MongoDB ID or tokenNo
 */
const getDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const driver = await Driver.findOne({
      $or: [
        ...(id.match(/^[a-f\d]{24}$/i) ? [{ _id: id }] : []),
        { tokenNo: id.toUpperCase() },
      ],
    }).populate("createdBy updatedBy", "name email");

    if (!driver) return res.status(404).json({ message: "Driver not found" });
    res.json({ driver });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * PUT /api/drivers/:id
 * Update driver details and optionally add/replace images
 */


const fetchBuffersFromDrive = async (urls = []) => {
  const buffers = [];

  for (const url of urls) {
    try {
      const fileIdMatch = url.match(/[-\w]{25,}/);
      const directUrl = fileIdMatch
        ? `https://drive.google.com/uc?id=${fileIdMatch[0]}`
        : url;

      const res = await fetch(directUrl);
      const buffer = await res.buffer();
      buffers.push(buffer);
    } catch (err) {
      console.log("Error fetching file:", url);
    }
  }

  return buffers;
};

const updateDriver = async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    const body = req.body;
    const files = req.files || {};

    const removePhotos = JSON.parse(body.removePhotos || "[]");
    const removeAadhar = JSON.parse(body.removeAadhar || "[]");
    const removeLicense = JSON.parse(body.removeLicense || "[]");
    const removeToken = JSON.parse(body.removeToken || "[]");

    // 🗑️ delete removed files from drive
    const deleteAll = [...removePhotos, ...removeAadhar, ...removeLicense, ...removeToken];
    await Promise.allSettled(deleteAll.map(deleteFileFromDrive));

    // 📤 upload new files
    const [photoRes, aadharRes, licenseRes, tokenRes] = await Promise.all([
      uploadImageGroup(files.photos || [], "photos", driver.tokenNo),
      uploadImageGroup(files.aadhar || [], "aadhar", driver.tokenNo),
      uploadImageGroup(files.license || [], "license", driver.tokenNo),
      uploadImageGroup(files.token || [], "token", driver.tokenNo),
    ]);

    // 🔗 merge logic
    const mergeUrls = (existing, existingIds, removeIds, newUrls, newIds) => {
      const keepIdxs = existingIds
        .map((id, i) => (removeIds.includes(id) ? -1 : i))
        .filter((i) => i !== -1);

      return {
        urls: [...keepIdxs.map((i) => existing[i]), ...newUrls],
        ids: [...keepIdxs.map((i) => existingIds[i]), ...newIds],
      };
    };

    const mergedPhotos = mergeUrls(driver.photoUrls, driver.photoDriveIds, removePhotos, photoRes.urls, photoRes.driveIds);
    const mergedAadhar = mergeUrls(driver.aadharUrls, driver.aadharDriveIds, removeAadhar, aadharRes.urls, aadharRes.driveIds);
    const mergedLicense = mergeUrls(driver.licenseUrls, driver.licenseDriveIds, removeLicense, licenseRes.urls, licenseRes.driveIds);
    const mergedToken = mergeUrls(driver.tokenUrls, driver.tokenDriveIds, removeToken, tokenRes.urls, tokenRes.driveIds);

    // ✅ BUILD FULL BUFFERS (existing + new)
    const allBuffers = {
      photos: [
        ...(await fetchBuffersFromDrive(mergedPhotos.urls)),
        ...(files.photos || []).map(f => f.buffer),
      ],
      aadhar: [
        ...(await fetchBuffersFromDrive(mergedAadhar.urls)),
        ...(files.aadhar || []).map(f => f.buffer),
      ],
      license: [
        ...(await fetchBuffersFromDrive(mergedLicense.urls)),
        ...(files.license || []).map(f => f.buffer),
      ],
      token: [
        ...(await fetchBuffersFromDrive(mergedToken.urls)),
        ...(files.token || []).map(f => f.buffer),
      ],
    };

    // ✅ check if any docs exist
    const hasAnyDocs =
      mergedPhotos.urls.length ||
      mergedAadhar.urls.length ||
      mergedLicense.urls.length ||
      mergedToken.urls.length;

    let pdfUrl = driver.pdfUrl;
    let pdfDriveId = driver.pdfDriveId;

    // 📄 regenerate PDF correctly
    if (hasAnyDocs) {
      const pdfBuffer = await generateDriverPdf(allBuffers, {
        fullName: driver.fullName,
        tokenNo: driver.tokenNo,
      });

      const pdfResult = await uploadPdfToDrive(pdfBuffer, driver.tokenNo, pdfDriveId);
      pdfUrl = pdfResult.webViewLink;
      pdfDriveId = pdfResult.id;
    }

    // 🧾 allowed fields update
    const allowedFields = [
      "fullName", "fatherName", "phoneNumber", "temporaryAddress", "permanentAddress",
      "dateOfBirth", "maritalStatus", "emergencyRelation", "emergencyPerson", "emergencyContact",
      "aadharNo", "licenseNo", "licenseValidity", "senderName", "senderContact", "inchargeName",
    ];

    const updates = {};
    allowedFields.forEach((f) => {
      if (body[f] !== undefined) updates[f] = body[f];
    });

    const updated = await Driver.findByIdAndUpdate(
      driver._id,
      {
        ...updates,
        photoUrls: mergedPhotos.urls,
        photoDriveIds: mergedPhotos.ids,
        aadharUrls: mergedAadhar.urls,
        aadharDriveIds: mergedAadhar.ids,
        licenseUrls: mergedLicense.urls,
        licenseDriveIds: mergedLicense.ids,
        tokenUrls: mergedToken.urls,
        tokenDriveIds: mergedToken.ids,
        pdfUrl,
        pdfDriveId,
        updatedBy: req.user._id,
      },
      { new: true }
    );

    try { queueSheetUpdate(updated._id.toString()); } catch (_) {}

    emit(req, "driver:updated", { driver: updated });

    logger.info(`Driver updated: ${updated.tokenNo} by ${req.user.email}`);
    res.json({ message: "Driver updated", driver: updated });

  } catch (err) {
    logger.error(`updateDriver error: ${err.message}`);
    res.status(500).json({ message: err.message || "Server error" });
  }
};

/**
 * DELETE /api/drivers/:id
 */
const deleteDriver = async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    // Delete all Drive files
    const allIds = [
      ...driver.photoDriveIds,
      ...driver.aadharDriveIds,
      ...driver.licenseDriveIds,
      ...driver.tokenDriveIds,
      driver.pdfDriveId,
    ].filter(Boolean);

    await Promise.allSettled(allIds.map(deleteFileFromDrive));

    // Delete from sheets (pass snapshot before deletion)
    const snapshot = driver.toObject();
    await queueSheetDelete(snapshot);

    await driver.deleteOne();

    emit(req, "driver:deleted", { driverId: req.params.id, tokenNo: driver.tokenNo });

    logger.info(`Driver deleted: ${driver.tokenNo} by ${req.user.email}`);
    res.json({ message: "Driver deleted" });
  } catch (err) {
    logger.error(`deleteDriver error: ${err.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/drivers/token/:tokenNo
 * Look up driver by token number
 */
const getByToken = async (req, res) => {
  try {
    const driver = await Driver.findOne({
      tokenNo: req.params.tokenNo.toUpperCase(),
    });
    if (!driver) return res.status(404).json({ message: "No driver found for this token" });
    res.json({ driver });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { createDriver, getDrivers, getDriver, updateDriver, deleteDriver, getByToken };
