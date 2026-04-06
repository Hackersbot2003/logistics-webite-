const { Readable } = require("stream");
const { getDriveClient } = require("../config/google");
const logger = require("../config/logger");

const FOLDER_ID = () => process.env.GOOGLE_DRIVE_FOLDER_ID;

function bufferToStream(buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

/**
 * Upload a buffer to Google Drive.
 * Uses OAuth2 auth via getDriveClient() from config/google.js
 */
const uploadFileToDrive = async (buffer, filename, mimeType, subfolder = null) => {
  const drive = getDriveClient();

  let parentId = FOLDER_ID();
  if (subfolder) {
    parentId = await getOrCreateSubfolder(drive, subfolder, FOLDER_ID());
  }

  const response = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [parentId],
    },
    media: { mimeType, body: bufferToStream(buffer) },
    fields: "id, webViewLink, webContentLink",
  });

  // Make file publicly readable
  await drive.permissions.create({
    fileId: response.data.id,
    requestBody: { role: "reader", type: "anyone" },
  });

  logger.info(`Drive upload OK: ${response.data.id} (${filename})`);
  return response.data;
};

/**
 * Delete a file from Google Drive by file ID.
 */
const deleteFileFromDrive = async (fileId) => {
  if (!fileId) return;
  try {
    const drive = getDriveClient();
    await drive.files.delete({ fileId });
    logger.info(`Drive delete OK: ${fileId}`);
  } catch (err) {
    logger.warn(`Drive delete failed for ${fileId}: ${err.message}`);
  }
};

/**
 * Replace a file: delete old, upload new.
 */
const replaceFileOnDrive = async (oldFileId, buffer, filename, mimeType, subfolder = null) => {
  await deleteFileFromDrive(oldFileId);
  return uploadFileToDrive(buffer, filename, mimeType, subfolder);
};

/**
 * Get or create a subfolder inside a parent folder.
 */
const getOrCreateSubfolder = async (drive, name, parentId) => {
  const res = await drive.files.list({
    q: `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id)",
  });

  if (res.data.files.length > 0) {
    return res.data.files[0].id;
  }

  const folder = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
  });

  return folder.data.id;
};

/**
 * Upload a PDF buffer to Drive, replacing old one if exists.
 */
const uploadPdfToDrive = async (pdfBuffer, driverTokenNo, oldPdfId = null) => {
  if (oldPdfId) await deleteFileFromDrive(oldPdfId);
  const filename = `${driverTokenNo}_documents.pdf`;
  return uploadFileToDrive(pdfBuffer, filename, "application/pdf", "PDFs");
};

module.exports = {
  uploadFileToDrive,
  deleteFileFromDrive,
  replaceFileOnDrive,
  uploadPdfToDrive,
};