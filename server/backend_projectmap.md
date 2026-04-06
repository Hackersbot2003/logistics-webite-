# DriveSafe Fleet Management — Backend Map
> Feed this + PROJECT_MAP_COMMON.md to any AI when making backend changes.
> This file tells you exactly which file to edit for any backend task.

---

## Entry Point

**`server/server.js`**
- Creates Express app + HTTP server + Socket.IO
- Registers all routes: `/api/auth`, `/api/drivers`, `/api/vehicle-sheets`, `/api/vehicles`, `/api/logistics`, `/api/billing`
- Attaches `req.io` to every request for server→client socket events
- Global error handler: handles MulterError, ValidationError, duplicate key (11000)
- Starts MongoDB, queue worker, sheets header init on boot
- EDIT THIS when: adding a new route group, changing CORS, rate limits, server startup logic

---

## Config Files

### `server/config/google.js`
- Reads `credentials.json` + `token.json` → OAuth2 client
- Exports: `getDriveClient()`, `getSheetsClient()`, `getGoogleAuth()`
- EDIT THIS when: changing Google scopes, switching auth method

### `server/config/authorize.js`
- One-time script: `node server/config/authorize.js`
- Generates `token.json` from OAuth2 consent flow
- NEVER edit unless changing scopes

### `server/config/db.js` — MongoDB connect (Mongoose)
### `server/config/logger.js` — Winston logger (console + file)
### `server/config/seed.js` — `node server/config/seed.js` → creates superadmin from .env

---

## Middleware

### `server/middleware/auth.js`
- `protect` — verifies JWT, attaches `req.user`
- `authorize(...roles)` — role check middleware
- EDIT THIS when: changing token validation, adding new role logic

### `server/middleware/upload.js`
- `multer` memoryStorage, 10MB limit, 20 files max
- `driverUploadFields` — fields: photos(5), aadhar(5), license(5), token(5)
- EDIT THIS when: adding new upload fields or changing limits

---

## Controllers

### `server/controllers/authController.js`
Handles: login, register, me, listUsers, toggleUser
- `login`: validates credentials → signs JWT → returns `{token, user}`
- `register`: superadmin-only user creation
- `me`: returns req.user from token
- Key: JWT signed with `process.env.JWT_SECRET`, expires `JWT_EXPIRES_IN`
- EDIT THIS when: changing login logic, adding fields to user creation

### `server/controllers/driverController.js`
Handles: createDriver, getDrivers, getDriver, updateDriver, deleteDriver, getByToken
- `createDriver`: creates Driver doc → uploads images to Drive → generates PDF → syncs to Sheets
- `updateDriver`: replaces changed images on Drive → regenerates PDF → updates Sheets
- `deleteDriver`: deletes Drive files → deletes Sheets row → deletes MongoDB doc
- Image upload via: `services/driveService.js` → `uploadFileToDrive(buffer, filename, mimeType, subfolder)`
- PDF via: `services/pdfService.js` → `generateDriverPdf(imageGroups, driverInfo)`
- Sheets sync via: `services/queueService.js` → fire-and-forget with retry
- `getDrivers`: supports ?search (text index), ?page, ?limit
- EDIT THIS when: changing driver fields, image upload logic, PDF generation, sheet columns

### `server/controllers/vehicleController.js`
Handles: getVehicles, getVehicle, createVehicle, updateVehicle, deleteVehicle, getVehicleByChallan, getChallanSettings, resetChallanCounter
- `createVehicle`: auto-generates challanNo per sheetType → saves → syncs to Google Sheet tab
- `updateVehicle`: saves `lastEditedBy` = username → syncs sheet
- Challan: uses `ChallanSettings` model — counter increments per type, format: `${prefix}${counter.toString().padStart(2,'0')}`
- Sheet sync: `services/vehicleSheetsService.js` → `syncVehicleToSheet`
- Filtering: `?sheetName=`, `?search=`, `?status=`, `?pdi=`, `?model=`, `?page=`, `?limit=`
- EDIT THIS when: changing vehicle fields, challan logic, vehicle sheet columns

### `server/controllers/vehicleSheetController.js`
Handles: listSheets, createSheet, toggleLock, deleteSheet, setStatus, listPumps, createPump, deletePump
- `createSheet`: derives financialYear → creates VehicleSheet doc → calls `createSheetTab()` in Google Sheets
- `getSpreadsheetId(sheetType)` → picks env var per type (FML_SPREADSHEET_ID, FML_EXP_SPREADSHEET_ID, OTHERS_SPREADSHEET_ID)
- `deleteSheet`: deletes all vehicles in sheet → deletes Google Sheets tab → deletes VehicleSheet doc
- EDIT THIS when: changing sheet creation logic, adding sheet types, pump management

### `server/controllers/logisticsController.js`
Handles all logistics fixed data CRUD:
- `getLogistics/createLogistics/updateLogistics/deleteLogistics` → LogisticsData (FML routes/consignees)
- `getModels/createModel/updateModel/deleteModel` → ModelDetails (vehicle models + billing rates)
- `getTolls/createToll/updateToll/deleteToll` → Toll (toll rates per location per model)
- `getOtherLogistics...` → OtherLogistics
- `getPorts...` → PortEntry
- Search endpoints: `searchLogistics`, `searchModels`, `searchToll`, `searchOthersByPartner`
- Each CRUD also calls `logisticsSheetService.js` to sync to fixed-data spreadsheet
- EDIT THIS when: adding new logistics fields, changing search logic

### `server/controllers/billingController.js`
Handles all billing operations:
- `getSheets/createSheet/lockSheet/deleteSheet/updateSheetStatus` → BillingMasterSheet CRUD
- `getSheetRecords` → BillingRecord list for a sheet (with vehicle populate)
- `previewBilling` → finds eligible vehicles (Delivered + unbilled + location + consignee match)
- `generateBill` → full generation: calcs → BillingRecord → mark vehicles billed → append to billing Google Sheet → mark billed in vehicle Google Sheet
- `generatePDF` → returns printable HTML (Tax Invoice + Toll Bill for FML, transport-only for EXP-FML)
- `deleteBillRecord` → clears billed on vehicles (MongoDB + Google Sheet) → deletes rows from billing sheet → deletes BillingRecord
- EDIT THIS when: changing bill generation logic, PDF layout, delete flow

---

## Services

### `server/services/driveService.js`
```
uploadFileToDrive(buffer, filename, mimeType, subfolder?)  → { id, webViewLink, webContentLink }
deleteFileFromDrive(fileId)
replaceFileOnDrive(oldFileId, buffer, filename, mimeType, subfolder?)
uploadPdfToDrive(pdfBuffer, driverTokenNo, oldPdfId?)
```
- Uses `getDriveClient()` from `config/google.js`
- Folder: `process.env.GOOGLE_DRIVE_FOLDER_ID`
- Subfolders: auto-created inside main folder (photos, aadhar, license, PDFs)
- EDIT THIS when: changing Drive folder structure, upload logic

### `server/services/sheetsService.js`
- Driver → Google Sheets sync
- `SPREADSHEET_ID` = `process.env.GOOGLE_SPREADSHEET_ID`, tab = "Drivers"
- Headers: SR NO, TokenNo, Full Name, Father Name, Phone number, Temporary Address, Permanent Address, Date Of Birth, Marital Status, Emergency Contact Relation, Emergency Contact Person, Emergency Contact No, Aadhar Card No, Driving License No, Driving license validity, Sender Name, Sender Contact No, In charge Name
- Functions: `ensureHeaders()`, `appendDriverToSheet(driver)`, `updateDriverInSheet(driver)`, `deleteDriverFromSheet(tokenNo, rowIndex)`
- EDIT THIS when: changing driver sheet columns, headers order

### `server/services/vehicleSheetsService.js`
- Vehicle → Google Sheets sync (per sheet tab)
- 72-column HEADERS array (all vehicle fields + financial + timestamps + Last Edited By)
- `SPREADSHEET_ID()` = `process.env.VEHICLE_SPREADSHEET_ID`
- Functions: `createSheetTab(sheetName, spreadsheetId)`, `deleteSheetTab(googleSheetId, spreadsheetId)`, `syncVehicleToSheet(vehicle)`, `deleteVehicleFromSheet(vehicle)`
- EDIT THIS when: changing vehicle sheet columns, adding/removing headers

### `server/services/billingService.js`
- All billing calculations + HTML generation + Google Sheets helpers
- `CUSTOM_HEADERS` array (68 columns for billing spreadsheet)
- `performCalculations({vehicles, modelDetailsMap, tollData, overallKm, miscRate, cgstRate, sgstRate, isUrbania, specialIncentive, sheetType})`
- `buildVehicleRow({vehicle, billNoPair, billDate, rate, tollRate, miscExpense, cgstRate, sgstRate})`
- `buildBillingHTML({record, calc, overallKm, sheetType})` → printable HTML
- `ensureBillingTab(spreadsheetId, tabName)` → creates tab with CUSTOM_HEADERS if missing
- `appendVehicleRows(spreadsheetId, tabName, rows)`
- `markVehiclesBilledInSheet(vehicleSpreadsheetId, vehicleSheetName, uniqueIds, billNoPair)`
- EDIT THIS when: changing billing calculations, PDF layout, spreadsheet columns

### `server/services/pdfService.js`
- `generateDriverPdf(imageGroups, driverInfo)` → Buffer (PDF)
- Uses `pdf-lib`. Each image = one page. Section headers embedded.
- EDIT THIS when: changing driver PDF layout or content

### `server/services/queueService.js`
- MongoDB-backed retry queue for driver Sheets sync
- `initQueue()` → starts retry worker (every 2 min)
- `syncDriverToSheets(driver, operation)` → tries immediately, queues on failure
- `retryStaleSyncs()` → called on server start to catch leftover pending jobs
- `getQueueStats()` → returns { pending, failed, processing } counts
- EDIT THIS when: changing retry backoff, max attempts, queue behavior

### `server/services/logisticsSheetService.js`
- Syncs logistics fixed data changes to their own Google Sheet
- Used by logisticsController on create/update/delete
- EDIT THIS when: changing logistics sheet columns

---

## Models Reference (quick schema lookup)

| Model file | Collection | Key unique fields |
|---|---|---|
| `User.js` | users | email |
| `Driver.js` | drivers | tokenNo, aadharNo |
| `Vehicle.js` | vehicles | uniqueId |
| `VehicleSheet.js` | vehiclesheets | sheetName |
| `LogisticsData.js` | logisticsdatas | — |
| `ModelDetails.js` | modeldetails | — |
| `Toll.js` | tolls | location |
| `OtherLogistics.js` | otherlogistics | — |
| `PetrolPump.js` | petrolpumps | name |
| `ChallanSettings.js` | challansettings | sheetType |
| `BillingMasterSheet.js` | billingmastersheets | sheetName |
| `BillingRecord.js` | billingrecords | — |
| `SheetSyncQueue.js` | sheetsyncs | — (TTL 30 days) |
| `PortEntry.js` | portentries | — |

---

## Routes Summary

```
server/routes/auth.js          → /api/auth/*
server/routes/drivers.js       → /api/drivers/*    (uses driverUploadFields middleware)
server/routes/vehicleSheets.js → /api/vehicle-sheets/*
server/routes/vehicles.js      → /api/vehicles/*
server/routes/logistics.js     → /api/logistics/*
server/routes/billing.js       → /api/billing/*
```

---

## Common Patterns

### Adding a new field to Vehicle
1. Add to `server/models/Vehicle.js`
2. Add to `HEADERS` array in `server/services/vehicleSheetsService.js`
3. Add to `vehicleToRow()` function in `vehicleSheetsService.js`
4. Add to form in `client/src/pages/Vehicles.jsx`

### Adding a new API endpoint
1. Add controller function to appropriate `controllers/*.js`
2. Add route to appropriate `routes/*.js`
3. If new route group, register in `server.js` with `app.use()`

### Adding a new billing sheet column
1. Add to `CUSTOM_HEADERS` in `services/billingService.js`
2. Add to `buildVehicleRow()` in `billingService.js`

### Changing PDF layout (billing)
Edit `buildBillingHTML()` in `server/services/billingService.js`

### Changing driver PDF
Edit `generateDriverPdf()` in `server/services/pdfService.js`