const pdf = require('html-pdf');

// Helper function to convert HTML to PDF buffer
function htmlToPdfBuffer(html) {
  return new Promise((resolve, reject) => {
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

module.exports = { htmlToPdfBuffer };