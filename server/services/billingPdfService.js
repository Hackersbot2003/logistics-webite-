const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const fontkit = require('@pdf-lib/fontkit');
const { buildBillingHTML } = require("./billingService");
const logger = require("../config/logger");

// Helper function to safely handle currency symbols
const safeCurrencyFormat = (amount) => {
  try {
    // Try to format with ₹ symbol, fallback to Rs. if encoding fails
    const formatted = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
    
    // Replace ₹ with Rs. for PDF compatibility
    return formatted.replace('₹', 'Rs.');
  } catch {
    // Fallback to simple format
    return `Rs.${parseFloat(amount || 0).toFixed(2)}`;
  }
};

/**
 * Generate a PDF from billing record HTML
 * @param {Object} billingData - Billing record and calculation data
 * @returns {Buffer} PDF bytes
 */
const generateBillingPdf = async (billingData) => {
  try {
    // Note: PDF-lib doesn't render HTML directly, so we'll need to use a different approach
    // For now, we'll create a basic PDF structure similar to what's in the HTML
    const { record, calc, overallKm, sheetType } = billingData;
    
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    
    // Embed metadata
    pdfDoc.setTitle(`Billing Invoice - ${record.billNoPair}`);
    pdfDoc.setAuthor("Shree Aarya Logistics");
    pdfDoc.setSubject(`Bill: ${record.billNoPair} | Location: ${record.location}`);
    pdfDoc.setCreationDate(new Date());
    
    // Try to use a font that supports Unicode characters, fallback to standard fonts
    let regularFont, boldFont;
    try {
      // Attempt to embed a font that supports Unicode (like DejaVu Sans)
      const fontBytes = require('fs').readFileSync('./assets/fonts/DejaVuSans.ttf');
      regularFont = await pdfDoc.embedFont(fontBytes);
      const boldFontBytes = require('fs').readFileSync('./assets/fonts/DejaVuSans-Bold.ttf');
      boldFont = await pdfDoc.embedFont(boldFontBytes);
    } catch {
      // Fallback to standard fonts and replace ₹ with Rs. for compatibility
      regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    }
    
    const page = pdfDoc.addPage([595, 842]); // A4 size
    let yPosition = 800;
    
    // Company Header
    page.drawText("SHREE AARYA LOGISTICS", {
      x: 50, y: yPosition, size: 16, font: boldFont, color: rgb(0, 0, 0)
    });
    yPosition -= 20;
    page.drawText("197-AMBIKAPURI EXTENSION. AERODROME ROAD, NEAR GANGESHWAR DHAM TEMPLE, INDORE-M.P.-452005", {
      x: 50, y: yPosition, size: 10, font: regularFont, color: rgb(0.3, 0.3, 0.3)
    });
    yPosition -= 30;
    
    // Invoice Info
    page.drawText(`INVOICE NO: ${record.billNoPair}`, {
      x: 50, y: yPosition, size: 12, font: boldFont, color: rgb(0, 0, 0)
    });
    page.drawText(`DATE: ${new Date().toLocaleDateString('en-GB')}`, {
      x: 400, y: yPosition, size: 12, font: regularFont, color: rgb(0, 0, 0)
    });
    yPosition -= 15;
    
    page.drawText(`DEALER NAME: ${record.consigneeName}`, {
      x: 50, y: yPosition, size: 12, font: boldFont, color: rgb(0, 0, 0)
    });
    page.drawText(`PITHAMPUR TO ${record.location.toUpperCase()}`, {
      x: 400, y: yPosition, size: 12, font: boldFont, color: rgb(0, 0, 0)
    });
    yPosition -= 25;
    
    // Table Headers
    page.drawLine({ start: { x: 50, y: yPosition }, end: { x: 545, y: yPosition }, thickness: 1 });
    yPosition -= 15;
    
    // Column headers
    page.drawText("SR.NO.", { x: 55, y: yPosition, size: 10, font: boldFont, color: rgb(0, 0, 0) });
    page.drawText("CHALLAN NO.", { x: 120, y: yPosition, size: 10, font: boldFont, color: rgb(0, 0, 0) });
    page.drawText("CHASSIS NO.", { x: 220, y: yPosition, size: 10, font: boldFont, color: rgb(0, 0, 0) });
    page.drawText("MODEL", { x: 340, y: yPosition, size: 10, font: boldFont, color: rgb(0, 0, 0) });
    page.drawText("RATE", { x: 420, y: yPosition, size: 10, font: boldFont, color: rgb(0, 0, 0) });
    page.drawText("AMOUNT", { x: 480, y: yPosition, size: 10, font: boldFont, color: rgb(0, 0, 0) });
    yPosition -= 15;
    
    page.drawLine({ start: { x: 50, y: yPosition }, end: { x: 545, y: yPosition }, thickness: 1 });
    
    // Vehicle data would go here - for now we'll add a placeholder
    yPosition -= 20;
    page.drawText("Vehicle data would be populated here", {
      x: 50, y: yPosition, size: 10, font: regularFont, color: rgb(0.5, 0.5, 0.5)
    });
    
    // Calculations summary
    yPosition -= 100;
    page.drawLine({ start: { x: 350, y: yPosition + 20 }, end: { x: 545, y: yPosition + 20 }, thickness: 1 });
    
    const calcItems = [
      ['Transportation Sub Total:', safeCurrencyFormat(calc.transportationSubTotal)],
      ['CGST (9%):', safeCurrencyFormat(calc.transportationCGST)],
      ['SGST (9%):', safeCurrencyFormat(calc.transportationSGST)],
      ['Tax Invoice Total:', safeCurrencyFormat(calc.transportationFinalAmount)],
      ['Toll Sub Total:', safeCurrencyFormat(calc.tollSubTotal)],
      ['Toll CGST (9%):', safeCurrencyFormat(calc.tollCGST)],
      ['Toll SGST (9%):', safeCurrencyFormat(calc.tollSGST)],
      ['Toll Bill Total:', safeCurrencyFormat(calc.tollFinalAmount)],
    ];
    
    for (const [label, value] of calcItems) {
      yPosition -= 15;
      page.drawText(label, { x: 350, y: yPosition, size: 10, font: regularFont, color: rgb(0, 0, 0) });
      page.drawText(value, { x: 450, y: yPosition, size: 10, font: regularFont, color: rgb(0, 0, 0) });
    }
    
    yPosition -= 30;
    page.drawText("For Shree Aarya Logistics", { x: 400, y: yPosition, size: 10, font: boldFont, color: rgb(0, 0, 0) });
    yPosition -= 50;
    page.drawText("Authorized Signatory", { x: 400, y: yPosition, size: 10, font: boldFont, color: rgb(0, 0, 0) });
    
    const bytes = await pdfDoc.save();
    return Buffer.from(bytes);
  } catch (error) {
    logger.error('generateBillingPdf error:', error.message);
    throw error;
  }
};

/**
 * Generate PDF from HTML string (alternative approach using puppeteer would be better)
 * This is a simplified version - in production you might want to use puppeteer
 */
const generatePdfFromHtml = async (htmlContent) => {
  // This is a placeholder - in a real implementation you'd use puppeteer or similar
  // to convert HTML to PDF. For now, we'll return the basic PDF we created above.
  return await generateBillingPdf({
    record: { billNoPair: 'N/A', consigneeName: 'N/A', location: 'N/A' },
    calc: {},
    overallKm: 0,
    sheetType: 'FML'
  });
};

module.exports = { generateBillingPdf, generatePdfFromHtml };