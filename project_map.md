# DriveSafe Fleet Management — Project Map (Common)
> This file describes the full project architecture, shared conventions, data models,
> API contracts, and environment configuration used across frontend and backend.
> Feed this to any AI before making changes.

---

## Project Overview

**App**: DriveSafe Fleet Management System — logistics company tool for managing drivers,
vehicles (FML/EXP-FML/Others), billing, and accounts.

**Stack**:
- Frontend: React 18 + Vite, inline styles only (no Tailwind/CSS files), react-router-dom v6
- Backend: Node.js + Express, MongoDB (Mongoose), Socket.IO, Google Drive API, Google Sheets API
- Auth: JWT (stored in localStorage as `ds_token`), role-based (superadmin > admin > manager > user)
- Google Auth: OAuth2 via `credentials.json` + `token.json` (run `node server/config/authorize.js` once)

---

## Repository Structure

```
drivesafe_working/
├── client/                          # React frontend (Vite)
│   ├── src/
│   │   ├── App.jsx                  # Routes, ProtectedRoute, layout wiring
│   │   ├── main.jsx                 # ReactDOM.createRoot entry point
│   │   ├── api/
│   │   │   └── axios.js             # Axios instance: baseURL=/api, JWT interceptor, 401→redirect
│   │   ├── context/
│   │   │   ├── AuthContext.jsx      # useAuth() → {user,login,logout,hasRole,loading}
│   │   │   └── SocketContext.jsx    # useSocket() → socket.io client, auto-reconnect
│   │   ├── hooks/
│   │   │   ├── useDrivers.js        # Driver list fetch + pagination
│   │   │   └── useUpload.js         # File upload progress tracking
│   │   ├── components/
│   │   │   ├── Layout.jsx           # Sidebar nav + <Outlet />
│   │   │   ├── ConfirmModal.jsx     # Generic confirm dialog
│   │   │   ├── EmptyState.jsx       # Empty list placeholder
│   │   │   ├── ImageUploader.jsx    # Drag-drop image upload component
│   │   │   ├── Spinner.jsx          # Loading spinner
│   │   │   └── TokenBadge.jsx       # Driver SAL token display badge
│   │   └── pages/
│   │       ├── Login.jsx            # Login form → POST /api/auth/login
│   │       ├── Dashboard.jsx        # Stats overview
│   │       ├── Drivers.jsx          # Driver list, search, pagination
│   │       ├── DriverDetail.jsx     # View/edit single driver + images
│   │       ├── DriverForm.jsx       # Create driver with image upload
│   │       ├── Vehicles.jsx         # Vehicle list, create/edit modal per sheet type
│   │       ├── Accounts.jsx         # Financial entry for vehicles
│   │       ├── Billing.jsx          # Billing portal (FML/EXP-FML tabs)
│   │       ├── VehicleSheets.jsx    # Manage vehicle sheet tabs (create/lock/delete)
│   │       ├── LogisticsPartners.jsx# Fixed data: locations, models, tolls, consignees
│   │       └── Users.jsx            # User management (superadmin/admin only)
│   ├── vite.config.js               # Proxy: /api → http://localhost:5000
│   └── index.html
│
└── server/                          # Express backend
    ├── server.js                    # App entry: Express, Socket.IO, routes, error handler
    ├── .env                         # Environment variables (see section below)
    ├── credentials.json             # OAuth2 client credentials (DO NOT COMMIT)
    ├── token.json                   # OAuth2 access+refresh token (DO NOT COMMIT)
    ├── config/
    │   ├── google.js                # OAuth2 client → getDriveClient(), getSheetsClient()
    │   ├── authorize.js             # One-time script: node config/authorize.js → token.json
    │   ├── db.js                    # Mongoose connect
    │   ├── logger.js                # Winston logger
    │   └── seed.js                  # Seeds superadmin user
    ├── middleware/
    │   ├── auth.js                  # protect (JWT verify), authorize(...roles)
    │   └── upload.js                # multer memoryStorage, driverUploadFields
    ├── models/                      # Mongoose schemas (see Data Models section)
    ├── controllers/                 # Business logic per domain
    ├── routes/                      # Express routers
    ├── services/                    # Shared utilities (Drive, Sheets, PDF, Queue)
    └── socket/
        └── index.js                 # Socket.IO connection + JWT auth
```

---

## Environment Variables (server/.env)

```env
# Server
PORT=5000
CLIENT_URL=http://localhost:5173
NODE_ENV=development

# MongoDB
MONGO_URI=mongodb+srv://...

# JWT
JWT_SECRET=...
JWT_EXPIRES_IN=7d

# Superadmin seed
SUPERADMIN_EMAIL=...
SUPERADMIN_PASSWORD=...

# Google OAuth (auth via credentials.json + token.json — no env vars for keys)
GOOGLE_DRIVE_FOLDER_ID=16O9G8jqrgNYRAg5OVXDw0v4P4Giu2JrP

# Google Sheets — Drivers
GOOGLE_SPREADSHEET_ID=1_MSql7b8_4BmhS5tZ9kFVAGQcXuDdqbmQlFcKwaOXGA

# Google Sheets — Vehicles
VEHICLE_SPREADSHEET_ID=11F2eMQLPtz1J3lL3Y530fo3Ef4LSh2USkyBpWDW2Qc4
FML_SPREADSHEET_ID=11F2eMQLPtz1J3lL3Y530fo3Ef4LSh2USkyBpWDW2Qc4
FML_EXP_SPREADSHEET_ID=1iwE0yPc0HVyv5QuSScpuKsfmI3Th6LI1rk-a315SP3c
OTHERS_SPREADSHEET_ID=11F2eMQLPtz1J3lL3Y530fo3Ef4LSh2USkyBpWDW2Qc4
EXPVEHICLE_SPREADSHEET_ID=1iwE0yPc0HVyv5QuSScpuKsfmI3Th6LI1rk-a315SP3c

# Google Sheets — Billing
FML_BILLING_SPREADSHEET_ID=1rKXRtMLj_toKIbvmdLoENilqe-EgGdAdP97Xa15wcNg
FML_EXP_BILLING_SPREADSHEET_ID=1SE0nB7aEN3xJF0JFdMvRxo6UtMknzpE2maCjjzXFYL4
EXPFML_BILLINGSPREADSHEET_ID=1SE0nB7aEN3xJF0JFdMvRxo6UtMknzpE2maCjjzXFYL4
```

---

## Data Models

### User
```
_id, name, email, password(hashed), role(superadmin|admin|manager|user),
isActive, createdBy, timestamps
```
Roles hierarchy: superadmin > admin > manager > user

### Driver
```
_id, tokenNo(SAL01..auto), fullName(UPPER), fatherName, phoneNumber,
temporaryAddress, permanentAddress, dateOfBirth, maritalStatus,
emergencyRelation, emergencyPerson, emergencyContact,
aadharNo(unique), licenseNo, licenseValidity,
senderName, senderContact, inchargeName,
photoUrls[], aadharUrls[], licenseUrls[], tokenUrls[], pdfUrl,
photoDriveIds[], aadharDriveIds[], licenseDriveIds[], tokenDriveIds[], pdfDriveId,
sheetsRowIndex, pendingSheetSync, createdBy, updatedBy, timestamps
```

### Vehicle
```
_id, sheetName, spreadsheetId, financialYear, sheetType(FML|FML_EXP|Others),
uniqueId(unique), logisticsPartner, challanNo,
invoiceDate, invoiceNo, dateOfCollection, dispatchDate, actualDispatchDate,
placeOfCollection, placeOfDelivery, otherLocationDelivery, overallKm,
consigneeName, consigneeRegion, consigneeAddress, consignorName, consignorAddress,
model, modelInfo, modelDetails, chassisNo, engineNo, tempRegNo,
insuranceCompany, insuranceNo, fasTagNo, tokenNo,
driverName, phoneNo, drivingLicenseNo, inchargeName, currentIncharge,
date, time, vehicleLocation, vehicleStatus, deliveryDate, expecteddeliveryDate,
onroutePayment, onsiteReceivingstatus,
-- Financials (filled via Accounts page) --
dieselQuantity, dieselRate, dieselAmount, driverWages, returnFare, total,
toll, border, totalBorder, fourLtrDiesel, gatePass, pettyCash, grandTotal,
ptpAmount, ptpDiesel, secondPumpDiesel,
otpProvider[{name,amount}], hpclCardDiesel,
miscellaneousExpenses, remainingBalance,
pdiStatus, pdiDate, taxPaymentReceipt[{name,amount}],
billed(bill pair e.g. "1&2"), notes,
petrolPumpUsage[{pump,pumpName,amount}],
sheetsRowIndex, pendingSheetSync, deletedAt,
createdBy, updatedBy, lastEditedBy(string username), timestamps
```

### VehicleSheet
```
_id, sheetName(unique, e.g. "MAY2025-26"), sheetType(FML|FML_EXP|Others),
spreadsheetId, googleSheetId(number), financialYear, status(active|inactive),
isLocked, lockedAt, lockedBy, vehicleCount, createdBy, timestamps
```

### LogisticsData (FML fixed data — locations/consignees/routes)
```
_id, logisticPartner(FML|EXP-FML), location, consigneeName, consigneeAddress,
consigneeRegion, overallKM, returnFare, timestamps
```

### ModelDetails (vehicle models with rates)
```
_id, logisticPartner, model(e.g. T1|T2|TRAX), modelSpecs[{modelInfo,modelDetails[]}],
average(avgMileage), vehicleRate(₹/km for billing), driverWages(₹/km),
billingCode, timestamps
```

### Toll (toll rates per location per model)
```
_id, location(unique), tollData: {T1: 450, T2: 300, TRAX: 500, ...}, timestamps
```

### OtherLogistics
```
_id, logisticsPartner, location, consigneeName, consigneeAddress, timestamps
```

### PetrolPump
```
_id, name(unique), timestamps
```

### ChallanSettings (challan number counter per type)
```
_id, sheetType(FML|FML_EXP|Others), prefix(FML|EXP|OTH),
counter, resetDate, autoResetDate("04-01"), timestamps
```
Challan format: FML→FML01, EXP-FML→EXP01, Others→OTH01

### BillingMasterSheet
```
_id, sheetName(unique), sheetType(FML|FML_EXP), spreadsheetId,
googleSheetId, status(active|inactive), isLocked,
billCounter(0=no bills, 1=used 1&2, 2=used 3&4...), createdBy, timestamps
```

### BillingRecord
```
_id, billingSheetName, sheetType, vehicleSheetName,
location, consigneeName,
invoiceNo(odd: 1,3,5..), tollBillNo(even: 2,4,6..), billNoPair("1&2"),
invoiceDate, eAckNumber, eAckDate,
models[], urbania, urbaniaIncentive, miscRate, cgstRate, sgstRate, overallKm,
vehicleUniqueIds[], vehicles[ref],
transportationSubTotal, transportationCGST, transportationSGST, taxInvoiceTotal,
tollSubTotal, tollCGST, tollSGST, tollBillTotal,
createdBy, timestamps
```

### SheetSyncQueue (failed Sheets sync retry queue)
```
_id, operation(append|update|delete), driverId, driverSnapshot,
attempts, maxAttempts(10), lastError, lastAttemptAt, retryAfter,
failed(permanently failed after maxAttempts), timestamps, TTL(30 days)
```

---

## API Reference

### Auth  `POST/GET /api/auth/*`
```
POST /api/auth/login              { email, password } → { token, user }
POST /api/auth/register           [superadmin] { name, email, password, role }
GET  /api/auth/me                 → { user }
GET  /api/auth/users              [superadmin|admin] → { users[] }
PATCH /api/auth/users/:id/toggle  [superadmin] → toggle isActive
GET  /api/auth/queue-stats        [superadmin|admin] → { stats, recentFailed[], pendingJobs[] }
```

### Drivers  `/api/drivers/*`
```
GET    /api/drivers                ?search=&page=&limit=  → { drivers[], total, pages }
GET    /api/drivers/:id            → { driver }
GET    /api/drivers/token/:tokenNo → { driver }
POST   /api/drivers                [admin+] multipart/form-data: fields + files(photos,aadhar,license,token)
PUT    /api/drivers/:id            [admin+] multipart/form-data
DELETE /api/drivers/:id            [admin+]
```
Image upload: multer memoryStorage → Google Drive (OAuth) → URLs stored in driver doc.
PDF: auto-generated from all images via pdf-lib, uploaded to Drive.
Sheets: driver row synced to GOOGLE_SPREADSHEET_ID tab "Drivers" via queueService.

### Vehicle Sheets  `/api/vehicle-sheets/*`
```
GET    /api/vehicle-sheets         ?type=FML|FML_EXP|Others → { sheets[] }
POST   /api/vehicle-sheets         [admin+] { sheetName, sheetType, financialYear }
PATCH  /api/vehicle-sheets/:id/lock    [admin+]
PATCH  /api/vehicle-sheets/:id/status  [admin+] { status: active|inactive }
DELETE /api/vehicle-sheets/:id     [superadmin] { confirmed: true }
GET    /api/vehicle-sheets/pumps   ?page=&limit= → { pumps[], total }
POST   /api/vehicle-sheets/pumps   [admin+] { name }
DELETE /api/vehicle-sheets/pumps/:id [admin+]
```

### Vehicles  `/api/vehicles/*`
```
GET    /api/vehicles               ?sheetName=&search=&status=&pdi=&model=&page=&limit=
GET    /api/vehicles/:id
GET    /api/vehicles/challan/:challanNo
POST   /api/vehicles               [admin+] { ...vehicleFields }
PUT    /api/vehicles/:id           [admin+] { ...vehicleFields }
DELETE /api/vehicles/:id           [admin+]
GET    /api/vehicles/challan-settings
POST   /api/vehicles/challan-reset [superadmin] { sheetType }
```
Creates challan number on creation (FML→FMLnn, EXP→EXPnn, Others→OTHnn).
Syncs to corresponding Google Sheet tab on create/update/delete.

### Logistics  `/api/logistics/*`
```
GET/POST/PUT/DELETE /api/logistics/fml      FML logistics data (location/consignee/KM/returnFare)
GET/POST/PUT/DELETE /api/logistics/models   Model details (vehicleRate, billingCode, average)
GET/POST/PUT/DELETE /api/logistics/tolls    Toll rates by location+model
GET/POST/PUT/DELETE /api/logistics/others   Other logistics partner data
GET/POST/PUT/DELETE /api/logistics/ports    EXP-FML port entries
GET /api/logistics/search                   ?logisticPartner=&location=&consigneeName=
GET /api/logistics/models/search            ?logisticPartner=&model=
GET /api/logistics/tolls/search             ?location=&model=
GET /api/logistics/others/search-by-partner ?partner=
```

### Billing  `/api/billing/*`
```
GET    /api/billing/sheets              ?sheetType=FML|FML_EXP → { sheets[] }
POST   /api/billing/sheets              [admin+] { sheetName, sheetType }
PUT    /api/billing/sheets/:id/lock     [admin+] { isLocked }
PUT    /api/billing/sheets/:id/status   [admin+] { status }
DELETE /api/billing/sheets/:id          [admin+]
GET    /api/billing/sheets/:sheetName/records → { records[] }
GET    /api/billing/preview             ?vehicleSheetName=&location=&consigneeName=&models=
POST   /api/billing/generate            [admin+] { billingSheetName, sheetType, vehicleSheetName, location, consigneeName, models, invoiceDate, eAckNumber, eAckDate, miscRate, cgstRate, sgstRate, urbania, urbaniaIncentive, vehicleIds[] }
GET    /api/billing/pdf/:id             → HTML (printable bill)
DELETE /api/billing/records/:id         [admin+] → clears billed on vehicles + sheets
```

---

## Google Services Architecture

### Auth Flow
`server/config/google.js` → reads `credentials.json` + `token.json` → OAuth2 client
→ `getDriveClient()` returns Drive v3 client
→ `getSheetsClient()` returns Sheets v4 client

ALL services import from `config/google.js`:
- `services/driveService.js` → uses `getDriveClient()`
- `services/sheetsService.js` → uses `getSheetsClient()`
- `services/vehicleSheetsService.js` → uses `getSheetsClient()`
- `services/logisticsSheetService.js` → uses `getSheetsClient()`
- `services/billingService.js` → uses `getSheetsClient()`

### Drive Usage
Files uploaded to folder `GOOGLE_DRIVE_FOLDER_ID`. Subfolders per category (photos/aadhar/license/PDFs).
Service: `driveService.js` → `uploadFileToDrive`, `deleteFileFromDrive`, `uploadPdfToDrive`

### Sheets Usage
| Sheet | Spreadsheet ID env var | Tab name |
|---|---|---|
| Drivers | GOOGLE_SPREADSHEET_ID | "Drivers" |
| FML vehicles | FML_SPREADSHEET_ID | dynamic (sheetName, e.g. "MAY2025-26") |
| EXP-FML vehicles | FML_EXP_SPREADSHEET_ID | dynamic |
| Others vehicles | OTHERS_SPREADSHEET_ID | dynamic |
| FML billing | FML_BILLING_SPREADSHEET_ID | dynamic (sheetName) |
| EXP-FML billing | FML_EXP_BILLING_SPREADSHEET_ID | dynamic |

### Billing Sheet Columns (68 — CUSTOM_HEADERS in billingService.js)
billNo, billDate, billAmountTransportationCharge, miscellaneousExpense,
billAmountExpenseReimbursement, subTotal, cgst, sgst, finalBillingAmount,
uniqueId, logisticsPartner, challanNo, invoiceDate, invoiceNo, dateOfCollection,
dispatchDate, actualDispatchDate, placeOfCollection, placeOfDelivery,
otherLocationDelivery, overallKm, consigneeName, consigneeRegion,
consigneeAddress, consignorName, consignorAddress, model, modelInfo, modelDetails,
chassisNo, engineNo, tempRegNo, insuranceCompany, insuranceNo, fasTagNo, tokenNo,
driverName, phoneNo, drivingLicenseNo, inchargeName, currentIncharge,
date, time, vehicleLocation, dieselQuantity, dieselRate, dieselAmount,
driverWages, returnFare, total, toll, border, fourLtrDiesel, gatePass, pettyCash,
grandTotal, ptpAmount, ptpDiesel, secondPumpDiesel, hpclCardDiesel,
onRoutePayment, onSiteReceivingStatus, miscellaneousExpenses, remainingBalance,
deliveryDate, pdiStatus, taxPaymentReceipt, billed

---

## Billing Calculations

### Bill Numbering
Per billing sheet: counter 0→bill "1&2", 1→"3&4", 2→"5&6"
New sheet always starts fresh at 1&2.
invoiceNo = odd (1,3,5...), tollBillNo = even (2,4,6...)

### FML Tax Invoice (Transportation Bill)
```
transportationCharge[model] = qty × overallKm × vehicleRate
miscellaneousCharges        = totalVehicles × miscRate (default 500)
urbaniaIncentive            = totalVehicles × specialIncentive (default 1000, only if Urbania checked)
transportationSubTotal      = sum(all model charges) + misc + urbaniaIncentive
transportationCGST          = subTotal × cgstRate/100  (default 9%)
transportationSGST          = subTotal × sgstRate/100  (default 9%)
transportationFinalAmount   = subTotal + CGST + SGST
```

### FML Toll Bill (Expense Reimbursement)
```
tollAmount[model] = qty × tollRate[model][location]   (from Toll collection)
tollSubTotal      = sum(all model tolls)
tollCGST          = tollSubTotal × cgstRate/100
tollSGST          = tollSubTotal × sgstRate/100
tollFinalAmount   = tollSubTotal + CGST + SGST
```

### EXP-FML
Transportation Bill only — toll bill NOT generated (commented out in reference server).

### Vehicle Eligibility for Billing
- vehicleStatus = "Delivered" (case-insensitive)
- billed = null/""  (not already billed)
- sheetName matches selected vehicle sheet
- placeOfDelivery matches selected location
- consigneeName matches selected consignee
- model in selected models (or all if none selected)

---

## Socket.IO Events

Server emits via `req.io.emit(event, data)`:
```
vehicleSheet:created   { sheet }
vehicleSheet:updated   { sheet }
vehicleSheet:deleted   { sheetId, sheetName }
```
Client listens in SocketContext → auto-refreshes relevant pages.

---

## Role Permissions Summary

| Action | superadmin | admin | manager | user |
|---|---|---|---|---|
| View all | ✓ | ✓ | ✓ | ✓ |
| Create driver/vehicle | ✓ | ✓ | ✓ | ✗ |
| Update driver/vehicle | ✓ | ✓ | ✓ | ✗ |
| Delete driver/vehicle | ✓ | ✓ | ✗ | ✗ |
| Create/lock sheet | ✓ | ✓ | ✗ | ✗ |
| Delete sheet | ✓ | ✗ | ✗ | ✗ |
| Generate bill | ✓ | ✓ | ✓ | ✗ |
| Register user | ✓ | ✗ | ✗ | ✗ |
| Reset challan | ✓ | ✗ | ✗ | ✗ |

---

## Challan Number Format
- FML     → FML01, FML02, FML03...
- EXP-FML → EXP01, EXP02, EXP03...
- Others  → OTH01, OTH02, OTH03...
Auto-resets on autoResetDate (default April 1 each year). Superadmin can manual reset.

---

## Sheet Sync Queue (MongoDB-backed retry)
Drivers sheet sync: immediate attempt → on failure → enqueued in SheetSyncQueue →
retry worker runs every 2 minutes → exponential backoff (2,4,8...120 min) →
max 10 attempts → permanently failed (kept 30 days for review).
`GET /api/auth/queue-stats` → shows pending/failed jobs.