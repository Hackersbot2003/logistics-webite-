/**
 * Billing Service
 * - 68 CUSTOM_HEADERS matching reference server
 * - Bill numbering: per-sheet (1&2, 3&4, 5&6 ... resets on new sheet)
 * - FML: Transportation Bill + Toll Bill (2 pages)
 * - FML_EXP: Transportation Bill ONLY (no toll, matching reference expbillingController)
 */

const { getSheetsClient, getDriveClient } = require('../config/google');
const logger = require('../config/logger');
const puppeteer = require('puppeteer');

// ─── 68 columns — identical to reference server ────────────────────────────────
const CUSTOM_HEADERS = [
  "billNo","billDate",
  "billAmountTransportationCharge","miscellaneousExpense","billAmountExpenseReimbursement",
  "subTotal","cgst","sgst","finalBillingAmount",
  "uniqueId","logisticsPartner","challanNo","invoiceDate","invoiceNo",
  "dateOfCollection","dispatchDate","actualDispatchDate",
  "placeOfCollection","placeOfDelivery","otherLocationDelivery","overallKm",
  "consigneeName","consigneeRegion","consigneeAddress","consignorName","consignorAddress",
  "model","modelInfo","modelDetails","chassisNo","engineNo","tempRegNo",
  "insuranceCompany","insuranceNo","fasTagNo","tokenNo",
  "driverName","phoneNo","drivingLicenseNo","inchargeName","currentIncharge",
  "date","time","vehicleLocation",
  "dieselQuantity","dieselRate","dieselAmount","driverWages","returnFare","total",
  "toll","border","fourLtrDiesel","gatePass","pettyCash","grandTotal",
  "ptpAmount","ptpDiesel","secondPumpDiesel","hpclCardDiesel",
  "onRoutePayment","onSiteReceivingStatus","miscellaneousExpenses","remainingBalance",
  "deliveryDate","pdiStatus","taxPaymentReceipt","billed",
];


// ─── Company data ──────────────────────────────────────────────────────────────
const SUPPLIER = {
  name: 'SHREE AARYA LOGISTICS',
  address: '197, Ambika Puri Extension, Aerodrome Road\nNear Gangeshwar Dham Temple, Indore\nPin Code-452005',
  gstin: '23AEAFS3850E1ZE', pan: 'AEAFS3850E', state: '23', vendor: 'V097920M',
};
const RECIPIENT = {
  name: 'FORCE MOTORS LIMITED',
  address: 'Sector 1, Industrial Area Pithampur Dist Dhar, Pithampur\nPin Code-454775',
  gstin: '23AAACB7066L1ZM', pan: 'AAACB7066L',
  cin: 'L34102PN1958PLC011172', state: '23',
};

// ─── Number → Indian words ─────────────────────────────────────────────────────
function numberToWords(amount) {
  const units = ['','one','two','three','four','five','six','seven','eight','nine'];
  const teens = ['','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
  const tens  = ['','ten','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
  const numToWords = (num) => {
    let w = '';
    if (!num) return '';
    if (num >= 100) { w += units[Math.floor(num/100)] + ' hundred '; num %= 100; }
    if (num > 10 && num < 20) w += teens[num-10] + ' ';
    else { w += tens[Math.floor(num/10)] + ' '; w += units[num%10] + ' '; }
    return w;
  };
  const indian = (num) => {
    if (!num) return '';
    let w = '';
    const cr = Math.floor(num/10000000); num %= 10000000; if (cr) w += numToWords(cr)+'crore ';
    const lk = Math.floor(num/100000);   num %= 100000;   if (lk) w += numToWords(lk)+'lakh ';
    const th = Math.floor(num/1000);     num %= 1000;     if (th) w += numToWords(th)+'thousand ';
    w += numToWords(num);
    return w.trim();
  };
  if (!amount || isNaN(amount)) return 'zero rupees only';
  const [i,d='00'] = amount.toFixed(2).split('.');
  let r = '';
  if (Number(i) > 0) r += indian(Number(i)) + ' rupees';
  if (Number(d) > 0) { if (r) r += ' and '; r += indian(Number(d)) + ' paisa'; }
  return (r || 'zero rupees') + ' only';
}

// ─── Core calculation — same as reference performCalculations ─────────────────
function performCalculations({ vehicles, modelDetailsMap, tollData, overallKm,
                                miscRate, cgstRate, sgstRate, isUrbania, specialIncentive, sheetType }) {
  const pf = v => parseFloat(v)||0;
  const mR = pf(miscRate)||500, cR = pf(cgstRate)||9, sR = pf(sgstRate)||9;
  const km = pf(overallKm);

  // Group by model
  const byModel = {};
  for (const v of vehicles) { if (!byModel[v.model]) byModel[v.model]=[]; byModel[v.model].push(v); }
  const modelNames = Object.keys(byModel);
  const modelCounts = {};
  for (const m of modelNames) modelCounts[m] = byModel[m].length;
  const totalQty = vehicles.length;

  // Transportation charge per model: qty × overallKm × vehicleRate
  let billAmountTransportationCharge = 0;
  const taxableAmountsByModel = {};
  const transportationBreakdown = [];
  for (const modelName of modelNames) {
    const qty  = modelCounts[modelName];
    const md   = modelDetailsMap[modelName];
    const rate = md?.vehicleRate || 0;
    const bilCode = md?.billingCode || '';
    const taxable = qty * km * rate;
    taxableAmountsByModel[modelName] = taxable;
    billAmountTransportationCharge += taxable;
    transportationBreakdown.push({ model:modelName, qty, overallKm:km, rate, amount:taxable, billingCode:bilCode });
  }

  // Misc: totalVehicles × miscRate
  const miscellaneousCharges = totalQty * mR;

  // Urbania incentive: totalVehicles × specialIncentive (only if isUrbania)
  const urbaniaIncentiveTotal = isUrbania ? totalQty * (pf(specialIncentive)||1000) : 0;

  // Transportation subtotal
  const transportationSubTotal = billAmountTransportationCharge + miscellaneousCharges + urbaniaIncentiveTotal;
  const transportationCGST    = transportationSubTotal * (cR/100);
  const transportationSGST    = transportationSubTotal * (sR/100);
  const transportationFinalAmount = transportationSubTotal + transportationCGST + transportationSGST;
  const transportationFinalAmountInWords = numberToWords(transportationFinalAmount);

  // Toll (FML only — EXP-FML has toll commented out matching reference)
  let expenseReimbursementTollAndTax = 0;
  const tollBreakdown = [];
  if (sheetType === 'FML') {
    for (const modelName of modelNames) {
      const qty    = modelCounts[modelName];
      const tRate  = (tollData && tollData[modelName]) || 0;
      const taxable = qty * tRate;
      expenseReimbursementTollAndTax += taxable;
      tollBreakdown.push({ model:modelName, qty, overallKm:km, rate:tRate, amount:taxable });
    }
  }
  const tollSubTotal    = expenseReimbursementTollAndTax;
  const tollCGST        = tollSubTotal * (cR/100);
  const tollSGST        = tollSubTotal * (sR/100);
  const tollFinalAmount = tollSubTotal + tollCGST + tollSGST;
  const tollFinalAmountInWords = numberToWords(tollFinalAmount);

  return {
    byModel, modelNames, modelCounts, totalQty,
    billAmountTransportationCharge, miscellaneousCharges, urbaniaIncentiveTotal,
    transportationSubTotal, transportationCGST, transportationSGST,
    transportationFinalAmount, transportationFinalAmountInWords, transportationBreakdown,
    tollSubTotal, tollCGST, tollSGST, tollFinalAmount, tollFinalAmountInWords, tollBreakdown,
  };
}

// ─── Build one row (68 cols) per vehicle for Google Sheets ────────────────────
function buildVehicleRow({ vehicle:v, billNoPair, billDate, rate, tollRate,
                            miscExpense, cgstRate, sgstRate }) {
  const pf = x => parseFloat(x)||0;
  const km  = pf(v.overallKm);
  const cR  = pf(cgstRate)||9, sR = pf(sgstRate)||9;
  const transCharge = km * pf(rate);
  const base = transCharge + pf(miscExpense) + pf(tollRate);
  const cgst = base * (cR/100);
  const sgst = base * (sR/100);

  const map = {
    ...v,
    billNo:                          billNoPair,
    billDate,
    billAmountTransportationCharge:  transCharge,
    miscellaneousExpense:             pf(miscExpense),
    billAmountExpenseReimbursement:   pf(tollRate),
    subTotal:                         base,
    cgst,
    sgst,
    finalBillingAmount:               base + cgst + sgst,
    onRoutePayment:                   v.onroutePayment || '',
    onSiteReceivingStatus:            v.onsiteReceivingstatus || '',
    taxPaymentReceipt:
      Array.isArray(v.taxPaymentReceipt) && v.taxPaymentReceipt.length
        ? v.taxPaymentReceipt.map(t=>`${t.name||''}: ${t.amount||''}`).join(', ')
        : (v.taxPaymentReceipt || ''),
  };

  return CUSTOM_HEADERS.map(h => {
    let val = map[h] ?? '';
    if (Array.isArray(val))            val = val.map(x => typeof x==='object'?`${x.name||''}:${x.amount||''}`:x).join(', ');
    else if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
    return String(val);
  });
}

// ─── Ensure billing tab exists with 68-col headers ────────────────────────────
async function ensureBillingTab(spreadsheetId, tabName) {
  try {
    const sheets = getSheetsClient();
    const ss = await sheets.spreadsheets.get({ spreadsheetId });
    const exists = ss.data.sheets.find(s => s.properties.title === tabName);
    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests:[{ addSheet:{properties:{title:tabName}} }] },
      });
    }
    const hr = await sheets.spreadsheets.values.get({ spreadsheetId, range:`${tabName}!A1:A1` });
    if (!hr.data.values?.length) {
      await sheets.spreadsheets.values.update({
        spreadsheetId, range:`${tabName}!A1`,
        valueInputOption:'RAW',
        requestBody:{ values:[CUSTOM_HEADERS] },
      });
      // Format header row: grey background, bold text
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      const tab  = meta.data.sheets.find(s => s.properties.title === tabName);
      if (tab) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{
              repeatCell: {
                range: { sheetId: tab.properties.sheetId, startRowIndex: 0, endRowIndex: 1 },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.85, green: 0.85, blue: 0.85 },
                    textFormat: { bold: true },
                    horizontalAlignment: "CENTER",
                  }
                },
                fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
              }
            }]
          }
        });
      }
    }
  } catch(e) { logger.warn(`ensureBillingTab: ${e.message}`); }
}

// ─── Append rows ──────────────────────────────────────────────────────────────
async function appendVehicleRows(spreadsheetId, tabName, rows) {
  try {
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId, range:`${tabName}!A1`,
      valueInputOption:'USER_ENTERED', insertDataOption:'INSERT_ROWS',
      requestBody:{ values:rows },
    });
  } catch(e) { logger.warn(`appendVehicleRows: ${e.message}`); }
}

// ─── Mark billed in vehicle Google Sheet ──────────────────────────────────────
async function markVehiclesBilledInSheet(vehicleSpreadsheetId, vehicleSheetName, uniqueIds, billNoPair) {
  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: vehicleSpreadsheetId, range:`${vehicleSheetName}!A1:ZZZ`,
    });
    const rows = res.data.values; if (!rows?.length) return;
    const header = rows[0].map(h => h.trim().toLowerCase());
    const bIdx = header.indexOf('billed'), uIdx = header.indexOf('uniqueid');
    if (bIdx===-1 || uIdx===-1) return;
    const updates = [];
    for (let i=1;i<rows.length;i++) {
      if (uniqueIds.includes(rows[i][uIdx])) {
        updates.push({ range:`${vehicleSheetName}!${colLetter(bIdx)}${i+1}`, values:[[billNoPair]] });
      }
    }
    if (updates.length) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: vehicleSpreadsheetId,
        requestBody:{ data:updates, valueInputOption:'USER_ENTERED' },
      });
    }
  } catch(e) { logger.warn(`markVehiclesBilled: ${e.message}`); }
}

function colLetter(index) {
  let l='';
  while (index>=0) { l=String.fromCharCode((index%26)+65)+l; index=Math.floor(index/26)-1; }
  return l;
}

// ─── Generate printable HTML bill (Transportation + optional Toll) ────────────
function buildBillingHTML({ record, calc, overallKm, sheetType }) {
  const cR = record.cgstRate||9, sR = record.sgstRate||9;
  const taxRate = cR + sR;
  const today = new Date().toLocaleDateString('en-GB');

  const css = `
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html, body {
      font-family: Arial, Helvetica, sans-serif;
      margin: 0;
      padding: 0;
      font-size: 8.5px;
      color: #000;
      background: #fff;
      line-height: 1.3;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      max-height: 297mm;
      overflow: hidden;
      padding: 6mm 8mm;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    td, th {
      border: 1px solid #000;
      padding: 2px 3px;
      vertical-align: top;
      word-break: break-word;
      overflow: hidden;
    }
    .no-border td, .no-border th { border: none; }
    .text-center { text-align: center; }
    .text-right  { text-align: right; }
    .bold        { font-weight: bold; }
    .pb {
      page-break-after: always;
      break-after: page;
      display: block;
      height: 0;
      margin: 0;
      padding: 0;
      border: none;
    }
    b, strong { font-weight: bold; }
    p { margin: 2px 0; }

    /* ── Company header ───────────────────────────── */
    .company-title {
      font-size: 16px;
      font-weight: bold;
      text-align: center;
      padding: 4px 0 2px;
      border-bottom: none;
    }
    .original-copy {
      font-size: 7.5px;
      text-align: right;
      padding: 1px 3px;
      border-top: none;
    }
    .tax-invoice-label {
      font-size: 9px;
      font-weight: bold;
      text-align: center;
      padding: 2px;
    }

    /* ── Party info block ─────────────────────────── */
    .party-table td {
      font-size: 7.5px;
      vertical-align: top;
      padding: 3px 4px;
      width: 33.33%;
    }
    .party-label {
      font-size: 7.5px;
      font-weight: bold;
      text-decoration: underline;
      display: block;
      margin-bottom: 1px;
    }
    .party-name {
      font-size: 8.5px;
      font-weight: bold;
    }

    /* ── Invoice meta row ─────────────────────────── */
    .meta-table td {
      font-size: 7.5px;
      text-align: center;
      padding: 2px 3px;
      font-weight: bold;
    }
    .meta-table .meta-label {
      font-weight: bold;
      font-size: 7px;
    }

    /* ── Section title ────────────────────────────── */
    .section-title {
      font-size: 8.5px;
      font-weight: bold;
      text-align: center;
      padding: 3px;
      background: #fff;
    }

    /* ── Main items table ─────────────────────────── */
    .items-table th {
      font-size: 7px;
      text-align: center;
      padding: 2px 2px;
      font-weight: bold;
      background: #fff;
      vertical-align: middle;
    }
    .items-table td {
      font-size: 7.5px;
      padding: 2px 3px;
    }
    .items-table .desc-cell {
      font-size: 7.5px;
    }
    .items-table .num-cell {
      text-align: right;
    }
    .items-table .center-cell {
      text-align: center;
    }
    .total-row td {
      font-weight: bold;
      font-size: 8px;
      padding: 3px;
    }

    /* ── Summary section ──────────────────────────── */
    .summary-outer {
      margin-top: 0;
    }
    .summary-left {
      font-size: 7.5px;
      padding: 3px 4px;
      vertical-align: top;
      width: 42%;
    }
    .summary-right {
      font-size: 7.5px;
      padding: 2px 4px;
      vertical-align: top;
      width: 58%;
    }
    .summary-right-table td {
      border: none;
      font-size: 7.5px;
      padding: 1px 3px;
    }
    .summary-right-table .total-label {
      width: 65%;
    }
    .summary-right-table .total-val {
      text-align: right;
      width: 35%;
    }
    .words-text {
      font-size: 7.5px;
      font-weight: bold;
    }
    .for-company {
      font-size: 10px;
      font-weight: bold;
      margin-top: 4px;
    }
    .sign-block {
      font-size: 7.5px;
      margin-top: 2px;
    }

    /* ── Footer ───────────────────────────────────── */
    .footer-table td {
      font-size: 7px;
      padding: 2px 4px;
      border: 1px solid #000;
    }

    @page {
      size: A4 portrait;
      margin: 0;
    }
    @media print {
      html, body { margin: 0; padding: 0; }
      .page {
        margin: 0;
        padding: 6mm 8mm;
        page-break-after: always;
        break-after: page;
      }
      .pb { page-break-after: always; break-after: page; }
      button { display: none !important; }
    }
    @media screen {
      body { background: #e0e0e0; }
      .page {
        box-shadow: 0 2px 16px rgba(0,0,0,0.18);
        margin: 16px auto;
        background: #fff;
      }
    }`;

  // ── Reusable party block HTML ────────────────────────────────────────────────
  const supplierHtml = `
    <span class="party-label">Supplier:</span>
    <span class="party-name">${SUPPLIER.name}</span><br>
    ${SUPPLIER.address.replace(/\n/g,'<br>')}
    <br>GSTIN No.:- ${SUPPLIER.gstin}
    <br>PAN No. :- ${SUPPLIER.pan}
    <br>STATE CODE :- ${SUPPLIER.state}
    <br>VENDOR CODE:- ${SUPPLIER.vendor}`;

  const recipientHtml = `
    <span class="party-label">Recipient:</span>
    <span class="party-name">${RECIPIENT.name}</span><br>
    ${RECIPIENT.address.replace(/\n/g,'<br>')}
    <br>GSTIN No.: ${RECIPIENT.gstin}
    <br>PAN No. :- ${RECIPIENT.pan}
    <br>CIN :- ${RECIPIENT.cin}
    <br>STATE CODE :- ${RECIPIENT.state}`;

  const placeHtml = `
    <span class="party-label">Place of Supply:</span>
    <span class="party-name">${RECIPIENT.name}</span><br>
    ${RECIPIENT.address.replace(/\n/g,'<br>')}
    <br>GSTIN No.: ${RECIPIENT.gstin}
    <br>PAN No. :- ${RECIPIENT.pan}
    <br>CIN :- ${RECIPIENT.cin}
    <br>STATE CODE :- ${RECIPIENT.state}`;

  // ── Header block builder ─────────────────────────────────────────────────────
  const buildHeader = (invoiceNo, sectionTitle) => `
    <table>
      <tr>
        <td colspan="3" class="company-title" style="border-bottom:none">SHREE AARYA LOGISTICS</td>
      </tr>
      <tr>
        <td colspan="3" class="original-copy" style="border-top:none;border-bottom:none">Orignal for Receipient / Duplicate for Supplier</td>
      </tr>
      <tr>
        <td colspan="3" class="tax-invoice-label">Tax Invoice</td>
      </tr>
    </table>
    <table class="party-table">
      <tr>
        <td>${supplierHtml}</td>
        <td>${recipientHtml}</td>
        <td>${placeHtml}</td>
      </tr>
    </table>
    <table>
      <tr>
        <td colspan="2" style="padding:1px 3px;font-size:7.5px">PO Number :-<br>PO Date &nbsp;&nbsp; :-</td>
        <td style="width:18%;text-align:center;font-size:7px;font-weight:bold;vertical-align:middle">INVOICE NUMBER</td>
        <td style="width:16%;text-align:center;font-size:7px;font-weight:bold;vertical-align:middle">INVOICE DATE</td>
        <td style="width:18%;text-align:center;font-size:7px;font-weight:bold;vertical-align:middle">E-INVOICE ACK NO:</td>
        <td style="width:18%;text-align:center;font-size:7px;font-weight:bold;vertical-align:middle">E-INVOICE ACK DATE:</td>
      </tr>
      <tr>
        <td colspan="2" style="font-size:7.5px;padding:1px 3px">&nbsp;</td>
        <td style="text-align:center;font-size:8px;font-weight:bold">${invoiceNo||''}</td>
        <td style="text-align:center;font-size:7.5px">${record.invoiceDate||''}</td>
        <td style="text-align:center;font-size:7.5px">${record.eAckNumber||''}</td>
        <td style="text-align:center;font-size:7.5px">${record.eAckDate||''}</td>
      </tr>
    </table>
    <table>
      <tr>
        <td colspan="10" class="section-title">${sectionTitle}</td>
      </tr>
    </table>`;

  // ── Items table header ───────────────────────────────────────────────────────
  const itemsTableHead = `
    <table class="items-table">
      <thead>
        <tr>
          <th rowspan="2" style="width:4%">Sr. No.</th>
          <th rowspan="2" style="width:22%">Description of Service</th>
          <th rowspan="2" style="width:8%">HSN / SAC Code</th>
          <th colspan="3" class="text-center" style="width:21%">Quantity UOM Unit Rate (Rs.Ps)</th>
          <th rowspan="2" style="width:12%">Taxable Amount (Rs.Ps)</th>
          <th rowspan="2" style="width:8%">Tax Rate %</th>
          <th rowspan="2" style="width:11%">Total Tax Amount (Rs.Ps)</th>
          <th rowspan="2" style="width:12%">Total (Rs.Ps)</th>
        </tr>
        <tr>
          <th style="width:7%">KM</th>
          <th style="width:7%">Qty</th>
          <th style="width:7%">Rate</th>
        </tr>
      </thead>
      <tbody>`;

  // ── Summary right panel builder ──────────────────────────────────────────────
  const buildSummaryRight = (net, cgstAmt, sgstAmt, total, billNoRef) => `
    <table class="summary-right-table" style="width:100%">
      <tr><td class="total-label bold">Total Net Value Rs :</td><td class="total-val">${net.toFixed(2)}</td></tr>
      <tr><td class="total-label">Total CGST Value Rs :</td><td class="total-val">${cgstAmt.toFixed(2)}&nbsp;(${cR} %)</td></tr>
      <tr><td class="total-label">Total SGST Value Rs :</td><td class="total-val">${sgstAmt.toFixed(2)}&nbsp;(${sR} %)</td></tr>
      <tr><td class="total-label">Total IGST Value Rs :</td><td class="total-val">-</td></tr>
      <tr><td class="total-label">Total Tax Value Rs :</td><td class="total-val">${(cgstAmt+sgstAmt).toFixed(2)}</td></tr>
      <tr><td class="total-label bold">Total Invoice Value Rs :</td><td class="total-val bold">${total.toFixed(2)}</td></tr>
      <tr><td colspan="2">Whether Reverse Charge Applicable (Y / N) : <b>No</b></td></tr>
    </table>
    <p class="for-company">FOR SHREE AARYA LOGISTICS</p>
    <div class="sign-block">
      <br>
      <b>AUTHORISED SIGNATORY</b><br>
      DATE : ${today}<br>
      PLACE : PITHAMPUR
    </div>`;

  // ════════════════════════════════════════════════════════════════
  // TRANSPORTATION PAGE
  // ════════════════════════════════════════════════════════════════
  let transRows = '';
  calc.transportationBreakdown.forEach((row, i) => {
    const tax = row.amount * taxRate / 100;
    transRows += `
      <tr>
        <td class="center-cell">${i+1}</td>
        <td class="desc-cell">DESCRIPTION-${row.model} (${row.billingCode||'—'})<br>INVOICE &amp; CHASSIS NO AS PER ANNEXTURE</td>
        <td class="center-cell">996793</td>
        <td class="num-cell">${overallKm}</td>
        <td class="num-cell">${row.qty}</td>
        <td class="num-cell">${(Number(row.rate)||0).toFixed(2)}</td>
        <td class="num-cell">${(Number(row.amount)||0).toFixed(2)}</td>
        <td class="center-cell">${taxRate} %</td>
        <td class="num-cell">${(Number(tax)||0).toFixed(2)}</td>
        <td class="num-cell">${(Number(row.amount+tax)||0).toFixed(2)}</td>
      </tr>`;
  });

  if (record.urbania) {
    const uAmt = calc.urbaniaIncentiveTotal;
    const uTax = uAmt * taxRate / 100;
    transRows += `
      <tr>
        <td class="center-cell"></td>
        <td class="desc-cell">SPECIAL INCENTIVE FOR URBANIA</td>
        <td class="center-cell">996793</td>
        <td class="num-cell">${overallKm}</td>
        <td class="num-cell">${calc.totalQty}</td>
        <td class="num-cell">${record.urbaniaIncentive||1000}</td>
        <td class="num-cell">${uAmt.toFixed(2)}</td>
        <td class="center-cell">${taxRate} %</td>
        <td class="num-cell">${uTax.toFixed(2)}</td>
        <td class="num-cell">${(uAmt+uTax).toFixed(2)}</td>
      </tr>`;
  }

  const mAmt = calc.miscellaneousCharges;
  const mTax = mAmt * taxRate / 100;
  transRows += `
    <tr>
      <td class="center-cell"></td>
      <td class="desc-cell">MISCELLANEOUS CHARGES<br>INVOICE &amp; CHASSIS NO AS PER ANNEXTURE</td>
      <td class="center-cell">996793</td>
      <td class="num-cell">${overallKm}</td>
      <td class="num-cell">${calc.totalQty}</td>
      <td class="num-cell">${record.miscRate||500}</td>
      <td class="num-cell">${mAmt.toFixed(2)}</td>
      <td class="center-cell">${taxRate} %</td>
      <td class="num-cell">${mTax.toFixed(2)}</td>
      <td class="num-cell">${(mAmt+mTax).toFixed(2)}</td>
    </tr>`;

  const tNet = calc.transportationSubTotal;
  const tTax = calc.transportationCGST + calc.transportationSGST;
  transRows += `
    <tr class="total-row">
      <td colspan="6" class="text-right">TOTAL NET VALUE:</td>
      <td class="num-cell">${tNet.toFixed(2)}</td>
      <td></td>
      <td class="num-cell">${tTax.toFixed(2)}</td>
      <td class="num-cell">${calc.transportationFinalAmount.toFixed(2)}</td>
    </tr>`;

  const transPage = `
    <div class="page">
      ${buildHeader(record.invoiceNo, 'TRANSPORTATION')}
      ${itemsTableHead}${transRows}</tbody>
    </table>
    <table class="summary-outer" style="border-top:none">
      <tr>
        <td class="summary-left">
          <p>PITHAMPUR TO :- <b>${record.location||''}</b></p>
          <p>Invoice Value Rs. (In Words) :-</p>
          <p class="words-text">${calc.transportationFinalAmountInWords.toUpperCase()}</p>
          <p style="margin-top:4px">Electronic Reference Number :</p>
          <p style="margin-bottom:6px">&nbsp;</p>
          <p class="bold">NOTIFICATION NO - AS PER GST TARIFF</p>
          <p style="margin-top:4px">Certified that the particulars given above are true and correct.</p>
          <p class="bold text-center" style="margin-top:6px">EXPENSE REIMBURSEMENT TOLL &amp; TAX BILL NO ${record.tollBillNo||''}</p>
        </td>
        <td class="summary-right">
          ${buildSummaryRight(tNet, calc.transportationCGST, calc.transportationSGST, calc.transportationFinalAmount, record.tollBillNo)}
        </td>
      </tr>
    </table>
    <table class="footer-table" style="margin-top:2px">
      <tr><td><b>Regd. Office :</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td></tr>
    </table>
    </div>`;

  // EXP-FML: transport page only
  if (sheetType === 'FML_EXP') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Bill_${record.billNoPair}</title>
  <style>${css}</style>
</head>
<body>
  ${transPage}
  <script>window.onload=function(){document.title="Bill_${record.billNoPair}";};</script>
</body>
</html>`;
  }

  // ════════════════════════════════════════════════════════════════
  // TOLL PAGE (FML only)
  // ════════════════════════════════════════════════════════════════
  let tollRows = '';
  calc.tollBreakdown.forEach((row, i) => {
    const tax = row.amount * taxRate / 100;
    tollRows += `
      <tr>
        <td class="center-cell">${i+1}</td>
        <td class="desc-cell">DESCRIPTION-${row.model}<br>INVOICE &amp; CHASSIS NO AS PER ANNEXTURE</td>
        <td class="center-cell">996793</td>
        <td class="num-cell">${overallKm}</td>
        <td class="num-cell">${row.qty}</td>
        <td class="num-cell">${(Number(row.rate)||0).toFixed(2)}</td>
        <td class="num-cell">${(Number(row.amount)||0).toFixed(2)}</td>
        <td class="center-cell">${taxRate} %</td>
        <td class="num-cell">${(Number(tax)||0).toFixed(2)}</td>
        <td class="num-cell">${(Number(row.amount+tax)||0).toFixed(2)}</td>
      </tr>`;
  });

  const tn2 = calc.tollSubTotal, tt2 = calc.tollCGST + calc.tollSGST;
  tollRows += `
    <tr class="total-row">
      <td colspan="6" class="text-right">TOTAL NET VALUE:</td>
      <td class="num-cell">${tn2.toFixed(2)}</td>
      <td></td>
      <td class="num-cell">${tt2.toFixed(2)}</td>
      <td class="num-cell">${calc.tollFinalAmount.toFixed(2)}</td>
    </tr>`;

  const tollPage = `
    <div class="page">
      ${buildHeader(record.tollBillNo, 'EXP REIMBURSEMENT TOLL &amp; TAX')}
      ${itemsTableHead}${tollRows}</tbody>
    </table>
    <table class="summary-outer" style="border-top:none">
      <tr>
        <td class="summary-left">
          <p>PITHAMPUR TO :- <b>${record.location||''}</b></p>
          <p>Invoice Value Rs. (In Words) :-</p>
          <p class="words-text">${calc.tollFinalAmountInWords.toUpperCase()}</p>
          <p style="margin-top:4px">Electronic Reference Number :</p>
          <p style="margin-bottom:6px">&nbsp;</p>
          <p class="bold">NOTIFICATION NO - AS PER GST TARIFF</p>
          <p style="margin-top:4px">Certified that the particulars given above are true and correct.</p>
          <p class="bold text-center" style="margin-top:6px">TRANSPORTATION BILL NO<br>${record.invoiceNo||''}</p>
        </td>
        <td class="summary-right">
          ${buildSummaryRight(tn2, calc.tollCGST, calc.tollSGST, calc.tollFinalAmount, record.invoiceNo)}
        </td>
      </tr>
    </table>
    <table class="footer-table" style="margin-top:2px">
      <tr><td><b>Regd. Office :</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td></tr>
    </table>
    </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Bill_${record.billNoPair}</title>
  <style>${css}</style>
</head>
<body>
  ${transPage}
  ${tollPage}
  <script>window.onload=function(){document.title="Bill_${record.billNoPair}";};</script>
</body>
</html>`;
}

// ─── PDF Generation ──────────────────────────────────────────────────────────────
async function generatePDFBuffer(htmlContent) {
  console.log('Starting PDF generation...');
  let browser;
  try {
    console.log('Launching puppeteer browser...');
    browser = await puppeteer.launch({ 
      headless: "new",
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process'
      ],
    });
    console.log('Browser launched successfully');
    const page = await browser.newPage();
    console.log('New page created, setting content...');
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    console.log('Content set, generating PDF...');
    
    let pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      },
    });

    console.log('PDF generated successfully, size:', pdfBuffer.length, 'bytes');
    
    // Ensure pdfBuffer is a Buffer object before returning
    if (!Buffer.isBuffer(pdfBuffer)) {
      pdfBuffer = Buffer.from(pdfBuffer);
    }
    
    return pdfBuffer;
  } catch (error) {
    console.error('PDF generation failed:', error.message);
    console.error('Error stack:', error.stack);
    logger.error(`PDF generation failed: ${error.message}`);
    throw error;
  } finally {
    if (browser) {
      console.log('Closing browser...');
      await browser.close();
      console.log('Browser closed');
    }
  }
}

// ─── Upload to Google Drive ──────────────────────────────────────────────────────
const { Readable } = require('stream');

async function uploadToDrive(buffer, fileName, folderId) {
  try {
    const drive = getDriveClient();
    
    const fileMetadata = {
      name: fileName,
      parents: [folderId],
    };

    const media = {
      mimeType: 'application/pdf',
      body: Readable.from(buffer),
    };

    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, webViewLink, webContentLink',
    });

    return response.data;
  } catch (error) {
    logger.error(`Upload to Drive failed: ${error.message}`);
    throw error;
  }
}

module.exports = {
  CUSTOM_HEADERS, SUPPLIER, RECIPIENT,
  numberToWords, performCalculations, buildVehicleRow, buildBillingHTML,
  ensureBillingTab, appendVehicleRows, markVehiclesBilledInSheet,
  generatePDFBuffer, uploadToDrive,
};
