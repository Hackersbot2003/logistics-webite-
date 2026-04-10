/**
 * Billing Service
 * - 68 CUSTOM_HEADERS matching reference server
 * - Bill numbering: per-sheet (1&2, 3&4, 5&6 ... resets on new sheet)
 * - FML: Transportation Bill + Toll Bill (2 pages)
 * - FML_EXP: Transportation Bill ONLY (no toll, matching reference expbillingController)
 */

const { getSheetsClient } = require('../config/google');
const logger = require('../config/logger');

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
    *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    html,body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:8px;font-size:10px;color:#000;background:#fff}
    table{width:100%;border-collapse:collapse}
    td,th{border:1px solid #000;padding:4px 5px;vertical-align:top;word-break:break-word}
    .text-center{text-align:center} .text-right{text-align:right}
    .bold{font-weight:bold}
    .pb{page-break-after:always;margin:0;padding:0;border:none;height:0}
    b,strong{font-weight:bold} p{margin:4px 0}
    @page{size:A4 portrait;margin:1cm}
    @media print{html,body{margin:0;padding:0;font-size:9px}.pb{page-break-after:always}button{display:none!important}}
    @media screen{body{max-width:210mm;margin:0 auto;padding:10px;box-shadow:0 0 10px rgba(0,0,0,0.1)}}`;

  const supplierTd = `<b>${SUPPLIER.name}</b><br>${SUPPLIER.address.replace(/\n/g,'<br>')}
    <br>GSTIN No.:- ${SUPPLIER.gstin}<br>PAN No. :- ${SUPPLIER.pan}
    <br>STATE CODE :- ${SUPPLIER.state}<br>VENDOR CODE:- ${SUPPLIER.vendor}`;

  const recipientTd = `<b>${RECIPIENT.name}</b><br>${RECIPIENT.address.replace(/\n/g,'<br>')}
    <br>GSTIN No.: ${RECIPIENT.gstin}<br>PAN No. :- ${RECIPIENT.pan}
    <br>CIN:- ${RECIPIENT.cin}<br>STATE CODE :- ${RECIPIENT.state}`;

  const headerBlock = (invNo, title) => `
    <table>
      <tr><td colspan="4" class="text-center bold" style="font-size:16px">${SUPPLIER.name}</td></tr>
      <tr><td colspan="4" class="text-right" style="font-size:10px">Original for Recipient / Duplicate for Supplier</td></tr>
      <tr><td colspan="4" class="text-center bold" style="font-size:14px">${title}</td></tr>
      <tr>
        <td><b>Supplier:</b><br>${supplierTd}</td>
        <td><b>Recipient:</b><br>${recipientTd}</td>
        <td><b>Place of Supply:</b><br>${recipientTd}</td>
        <td>
          <b>INVOICE NUMBER:</b> ${invNo}<br>
          <b>INVOICE DATE:</b> ${record.invoiceDate||''}<br>
          <b>E-INVOICE ACK NO:</b> ${record.eAckNumber||''}<br>
          <b>E-INVOICE ACK DATE:</b> ${record.eAckDate||''}
        </td>
      </tr>
    </table>`;

  const tableHead = `
    <table>
      <thead>
        <tr>
          <th rowspan="2" class="text-center">Sr. No.</th>
          <th rowspan="2" class="text-center">Description of Service</th>
          <th rowspan="2" class="text-center">HSN / SAC Code</th>
          <th colspan="3" class="text-center">Quantity UOM Unit Rate (Rs.Ps)</th>
          <th rowspan="2" class="text-center">Taxable Amount (Rs.Ps)</th>
          <th rowspan="2" class="text-center">Tax Rate %</th>
          <th rowspan="2" class="text-center">Total Tax Amount (Rs.Ps)</th>
          <th rowspan="2" class="text-center">Total (Rs.Ps)</th>
        </tr>
        <tr>
          <th class="text-center">KM</th>
          <th class="text-center">Qty</th>
          <th class="text-center">Rate</th>
        </tr>
      </thead><tbody>`;

  // ── Transportation page ────────────────────────────────────────────────────
  let transRows = '';
  calc.transportationBreakdown.forEach((row, i) => {
    const tax = row.amount * taxRate / 100;
     transRows += `<tr>
       <td class="text-center">${i+1}</td>
       <td>DESCRIPTION-${row.model}<br><b>BILLING CODE: ${row.billingCode||'—'}</b><br>INVOICE & CHASSIS NO AS PER ANNEXTURE</td>
       <td class="text-center">996793</td>
       <td class="text-right">${overallKm}</td>
       <td class="text-right">${row.qty}</td>
       <td class="text-right">${(Number(row.rate)||0).toFixed(2)}</td>
       <td class="text-right">${(Number(row.amount)||0).toFixed(2)}</td>
       <td class="text-right">${taxRate} %</td>
       <td class="text-right">${(Number(tax)||0).toFixed(2)}</td>
       <td class="text-right">${(Number(row.amount+tax)||0).toFixed(2)}</td>
     </tr>`;
  });
  if (record.urbania) {
    const uAmt = calc.urbaniaIncentiveTotal;
    const uTax = uAmt * taxRate / 100;
    transRows += `<tr>
      <td></td>
      <td>SPECIAL INCENTIVE FOR URBANIA</td>
      <td class="text-center">996793</td>
      <td class="text-right">${overallKm}</td>
      <td class="text-right">${calc.totalQty}</td>
      <td class="text-right">${record.urbaniaIncentive||1000}</td>
      <td class="text-right">${uAmt.toFixed(2)}</td>
      <td class="text-right">${taxRate} %</td>
      <td class="text-right">${uTax.toFixed(2)}</td>
      <td class="text-right">${(uAmt+uTax).toFixed(2)}</td>
    </tr>`;
  }
  const mAmt = calc.miscellaneousCharges;
  const mTax = mAmt * taxRate / 100;
  transRows += `<tr>
    <td></td>
    <td>MISCELLANEOUS CHARGES<br>INVOICE &amp; CHASSIS NO AS PER ANNEXTURE</td>
    <td class="text-center">996793</td>
    <td class="text-right">${overallKm}</td>
    <td class="text-right">${calc.totalQty}</td>
    <td class="text-right">${record.miscRate||500}</td>
    <td class="text-right">${mAmt.toFixed(2)}</td>
    <td class="text-right">${taxRate} %</td>
    <td class="text-right">${mTax.toFixed(2)}</td>
    <td class="text-right">${(mAmt+mTax).toFixed(2)}</td>
  </tr>`;
  const tNet = calc.transportationSubTotal;
  const tTax = calc.transportationCGST + calc.transportationSGST;
  transRows += `<tr class="bold">
    <td colspan="6" class="text-right">TOTAL NET VALUE:</td>
    <td class="text-right">${tNet.toFixed(2)}</td>
    <td></td>
    <td class="text-right">${tTax.toFixed(2)}</td>
    <td class="text-right">${calc.transportationFinalAmount.toFixed(2)}</td>
  </tr>`;

  const transSummaryLeft = `
    <p>PITHAMPUR TO :- <b>${record.location}</b></p>
    <p>Invoice Value Rs. (In Words):<br><b>${calc.transportationFinalAmountInWords.toUpperCase()}</b></p>
    <p>Electronic Reference Number :<br><br></p>
    <p class="bold">NOTIFICATION NO - AS PER GST TARIFF</p>
    <p>Certified that the particulars given above are true and correct.</p>
    <p class="bold text-center">EXPENSE REIMBURSEMENT TOLL &amp; TAX BILL NO ${record.tollBillNo}</p>`;

  const summaryRight = (net, cgstAmt, sgstAmt, total) => `
    <table style="border:none">
      <tr class="bold"><td>Total Net Value Rs :</td><td class="text-right">${net.toFixed(2)}</td></tr>
      <tr><td>Total CGST Value Rs :</td><td class="text-right">${cgstAmt.toFixed(2)} (${cR} %)</td></tr>
      <tr><td>Total SGST Value Rs :</td><td class="text-right">${sgstAmt.toFixed(2)} (${sR} %)</td></tr>
      <tr><td>Total IGST Value Rs :</td><td class="text-right">-</td></tr>
      <tr><td>Total Tax Value Rs :</td><td class="text-right">${(cgstAmt+sgstAmt).toFixed(2)}</td></tr>
      <tr class="bold"><td>Total Invoice Value Rs :</td><td class="text-right">${total.toFixed(2)}</td></tr>
      <tr><td colspan="2">Whether Reverse Charge Applicable (Y / N) : <b>No</b></td></tr>
    </table>
    <p class="bold" style="font-size:12px">FOR SHREE AARYA LOGISTICS</p>
    <p><br><br><b>AUTHORISED SIGNATORY</b><br>DATE : ${today}<br>PLACE : PITHAMPUR</p>`;

  const transPage = `
    ${headerBlock(record.invoiceNo, 'Tax Invoice')}
    ${tableHead}${transRows}</tbody></table>
    <table style="border:none"><tr>
      <td style="width:40%;vertical-align:top">${transSummaryLeft}</td>
      <td style="width:60%;vertical-align:top">${summaryRight(tNet, calc.transportationCGST, calc.transportationSGST, calc.transportationFinalAmount)}</td>
    </tr></table>
    <table><tr><td style="font-size:10px"><b>Regd. Office :</b> ________________________________</td></tr></table>`;

  // EXP-FML: transport only
  if (sheetType === 'FML_EXP') {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${transPage}<script>window.onload=function(){document.title="Bill_${record.billNoPair}";}</script></body></html>`;
  }

  // ── Toll page (FML only) ───────────────────────────────────────────────────
  let tollRows = '';
  calc.tollBreakdown.forEach((row, i) => {
    const tax = row.amount * taxRate / 100;
    tollRows += `<tr>
      <td class="text-center">${i+1}</td>
      <td>Toll & Tax for ${row.model}</td>
      <td class="text-center">996793</td>
      <td class="text-right">${overallKm}</td>
      <td class="text-right">${row.qty}</td>
      <td class="text-right">${(Number(row.rate)||0).toFixed(2)}</td>
      <td class="text-right">${(Number(row.amount)||0).toFixed(2)}</td>
      <td class="text-right">${taxRate} %</td>
      <td class="text-right">${(Number(tax)||0).toFixed(2)}</td>
      <td class="text-right">${(Number(row.amount+tax)||0).toFixed(2)}</td>
    </tr>`;
  });
  const tn2 = calc.tollSubTotal, tt2 = calc.tollCGST+calc.tollSGST;
  tollRows += `<tr class="bold">
    <td colspan="6" class="text-right">TOTAL NET VALUE:</td>
    <td class="text-right">${tn2.toFixed(2)}</td>
    <td></td>
    <td class="text-right">${tt2.toFixed(2)}</td>
    <td class="text-right">${calc.tollFinalAmount.toFixed(2)}</td>
  </tr>`;

  const tollPage = `
    ${headerBlock(record.tollBillNo, 'EXPENSE REIMBURSEMENT TOLL &amp; TAX BILL')}
    ${tableHead}${tollRows}</tbody></table>
    <table style="border:none"><tr>
      <td style="width:40%;vertical-align:top">
        <p>PITHAMPUR TO :- <b>${record.location}</b></p>
        <p>Invoice Value Rs. (In Words):<br><b>${calc.tollFinalAmountInWords.toUpperCase()}</b></p>
        <p>Electronic Reference Number :<br><br></p>
        <p class="bold">NOTIFICATION NO - AS PER GST TARIFF</p>
        <p>Certified that the particulars given above are true and correct.</p>
        <p class="bold text-center">EXPENSE REIMBURSEMENT TOLL &amp; TAX BILL NO ${record.invoiceNo}</p>
      </td>
      <td style="width:60%;vertical-align:top">${summaryRight(tn2, calc.tollCGST, calc.tollSGST, calc.tollFinalAmount)}</td>
    </tr></table>
    <table><tr><td style="font-size:10px"><b>Regd. Office :</b> ________________________________</td></tr></table>`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>
    ${transPage}
    <div class="pb"></div>
    ${tollPage}
    <script>window.onload=function(){document.title="Bill_${record.billNoPair}";}</script>
  </body></html>`;
}

module.exports = {
  CUSTOM_HEADERS, SUPPLIER, RECIPIENT,
  numberToWords, performCalculations, buildVehicleRow, buildBillingHTML,
  ensureBillingTab, appendVehicleRows, markVehiclesBilledInSheet,
};