const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const logger = require("../config/logger");

/**
 * Combine all uploaded image buffers into a single PDF.
 * Each image gets its own page, auto-sized to the image dimensions.
 *
 * @param {Object} imageGroups  { photos: Buffer[], aadhar: Buffer[], license: Buffer[], token: Buffer[] }
 * @param {Object} driverInfo   Metadata to embed in the first page header
 * @returns {Buffer} PDF bytes
 */
const generateDriverPdf = async (imageGroups, driverInfo) => {
  const pdfDoc = await PDFDocument.create();

  // Embed metadata
  pdfDoc.setTitle(`Driver Documents – ${driverInfo.fullName}`);
  pdfDoc.setAuthor("DriveSafe Fleet Management");
  pdfDoc.setSubject(`Token: ${driverInfo.tokenNo}`);
  pdfDoc.setCreationDate(new Date());

  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const sectionOrder = [
    { key: "photos", label: "Photographs" },
    { key: "aadhar", label: "Aadhar Card" },
    { key: "license", label: "Driving License" },
    { key: "token", label: "Token Card" },
  ];

  let hasContent = false;

  for (const section of sectionOrder) {
    const buffers = imageGroups[section.key] || [];
    if (buffers.length === 0) continue;

    for (let i = 0; i < buffers.length; i++) {
      const buffer = buffers[i];
      if (!buffer || buffer.length === 0) continue;

      try {
        let image;
        // Detect JPEG vs PNG by magic bytes
        const magic = buffer.slice(0, 4);
        if (magic[0] === 0xff && magic[1] === 0xd8) {
          image = await pdfDoc.embedJpg(buffer);
        } else if (magic[0] === 0x89 && magic[1] === 0x50) {
          image = await pdfDoc.embedPng(buffer);
        } else {
          // Try JPEG as fallback
          image = await pdfDoc.embedJpg(buffer);
        }

        const imgDims = image.scale(1);
        const pageWidth = Math.min(imgDims.width, 595);  // A4 width cap
        const scale = pageWidth / imgDims.width;
        const pageHeight = Math.min(imgDims.height * scale + 60, 842); // A4 height cap

        const page = pdfDoc.addPage([pageWidth, pageHeight]);

        // Section label header
        page.drawRectangle({
          x: 0, y: pageHeight - 40,
          width: pageWidth, height: 40,
          color: rgb(0.1, 0.15, 0.3),
        });
        page.drawText(`${section.label} (${i + 1}/${buffers.length})  |  ${driverInfo.tokenNo} – ${driverInfo.fullName}`, {
          x: 10, y: pageHeight - 28,
          size: 11, font, color: rgb(1, 1, 1),
          maxWidth: pageWidth - 20,
        });

        // Draw image
        page.drawImage(image, {
          x: 0, y: pageHeight - 40 - imgDims.height * scale,
          width: imgDims.width * scale,
          height: imgDims.height * scale,
        });

        hasContent = true;
      } catch (imgErr) {
        logger.warn(`PDF embed failed for ${section.label} image ${i}: ${imgErr.message}`);
      }
    }
  }

  if (!hasContent) {
    // Empty placeholder page
    const page = pdfDoc.addPage([595, 200]);
    page.drawText("No documents uploaded yet.", {
      x: 50, y: 100, size: 14, font, color: rgb(0.5, 0.5, 0.5),
    });
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
};

module.exports = { generateDriverPdf };
