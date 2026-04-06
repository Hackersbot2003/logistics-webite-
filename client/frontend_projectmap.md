# DriveSafe Fleet Management — Frontend Map
> Feed this + PROJECT_MAP_COMMON.md to any AI when making frontend changes.
> This file tells you exactly which file to edit for any frontend task.

---

## Tech Stack & Conventions

- **React 18** + **Vite** (no CRA)
- **No Tailwind, no CSS files** — all styles are **inline JS objects**
- **No class components** — all functional with hooks
- **react-router-dom v6** — nested routes via `<Outlet />`
- **axios** for all API calls (instance at `src/api/axios.js`)
- **react-hot-toast** for notifications
- **socket.io-client** for real-time updates
- Proxy: Vite proxies `/api` → `http://localhost:5000` (see `vite.config.js`)
- Auth token stored in `localStorage` as `ds_token`, user as `ds_user`

---

## File-by-File Guide

### `src/main.jsx`
React entry point. Wraps `<App />` in `<BrowserRouter>`.

### `src/App.jsx`
- Defines all routes with `react-router-dom`
- `ProtectedRoute` component: redirects to `/login` if no user, redirects to `/drivers` if wrong role
- `Placeholder` component for pages not yet implemented
- Wraps authenticated routes in `<Layout />` + `<SocketProvider />`
- **EDIT THIS when**: adding a new page/route, changing role restrictions per page

**Current routes**:
```
/login                → Login.jsx
/                     → redirect to /drivers
/dashboard            → Dashboard.jsx
/drivers              → Drivers.jsx
/drivers/:id          → DriverDetail.jsx
/vehicles             → Vehicles.jsx          [all roles]
/accounts             → Accounts.jsx          [all roles]
/billing              → Billing.jsx           [admin+]
/lr-generator         → Placeholder
/vehicle-sheets       → VehicleSheets.jsx     [admin+]
/ManageVehicleSheets  → VehicleSheets.jsx     [admin+]  (same component, alt URL)
/logistics-partners   → LogisticsPartners.jsx [all roles]
/users                → Users.jsx             [superadmin|admin]
```

---

## Context / State

### `src/context/AuthContext.jsx`
```js
const { user, login, logout, hasRole, loading } = useAuth();
```
- `user` — `{ _id, name, email, role, isActive }`
- `login(email, password)` — calls `POST /api/auth/login`, stores token+user in localStorage
- `logout()` — clears localStorage, redirects to `/login`
- `hasRole(...roles)` — `hasRole("superadmin","admin")` returns boolean
- `loading` — true while checking stored token on mount
- **EDIT THIS when**: changing what's stored after login, adding user fields

### `src/context/SocketContext.jsx`
```js
const socket = useSocket();
```
- Connects to backend Socket.IO with JWT auth header
- Auto-reconnect on disconnect
- `socket.on("vehicleSheet:created", handler)` etc.
- **EDIT THIS when**: adding new socket event listeners globally, changing connection config

---

## API Layer

### `src/api/axios.js`
- Base URL: `/api` (proxied to `localhost:5000`)
- Request interceptor: attaches `Authorization: Bearer <ds_token>`
- Response interceptor: on 401 → clears localStorage → redirects to `/login`
- Timeout: 60 seconds (for large file uploads)
- Usage: `import api from "../api/axios";` then `api.get("/drivers")`, `api.post("/vehicles", data)`
- **EDIT THIS when**: changing timeout, base URL, error handling globally

---

## Components

### `src/components/Layout.jsx`
- Sidebar navigation with all nav links
- `<Outlet />` renders the active page
- Shows current user name + role badge
- Sidebar links: Dashboard, Drivers, Vehicles, Accounts, Billing, LR Generator, ManageVehicleSheets, Logistics Partners, User Management
- **EDIT THIS when**: adding a nav link, changing sidebar styling, changing active link logic

### `src/components/ConfirmModal.jsx`
- Generic confirm/cancel dialog
- Props: `{ message, onConfirm, onCancel, confirmText, cancelText }`
- **EDIT THIS when**: changing confirm dialog styling

### `src/components/ImageUploader.jsx`
- Drag-drop + click to upload
- Props: `{ label, multiple, onFiles, existingUrls[], maxFiles }`
- Previews selected images before upload
- **EDIT THIS when**: changing upload UI or max files

### `src/components/EmptyState.jsx`
- Empty list placeholder with icon + message
- Props: `{ icon, title, description, action? }`

### `src/components/Spinner.jsx`
- Loading spinner component (inline animation)

### `src/components/TokenBadge.jsx`
- Displays SAL token number with styling badge
- Props: `{ tokenNo }`

---

## Pages

### `src/pages/Login.jsx`
- Email + password form
- Calls `useAuth().login()`
- Redirects to `/drivers` on success
- **EDIT THIS when**: changing login form, adding remember me, etc.

### `src/pages/Dashboard.jsx`
- Stats cards: total drivers, vehicles, active sheets
- Quick links to main sections
- **EDIT THIS when**: adding dashboard widgets or stats

### `src/pages/Drivers.jsx`
- Driver list with search, pagination
- Cards/table layout showing tokenNo, name, phone, status
- Links to DriverDetail for each driver
- **EDIT THIS when**: changing driver list columns, filters, card layout

### `src/pages/DriverDetail.jsx`
- View + edit a single driver
- Shows all images (photos, aadhar, license, token) in tabs
- Edit form with ImageUploader for each category
- Shows PDF link
- Calls `PUT /api/drivers/:id` with multipart/form-data
- **EDIT THIS when**: adding driver fields to detail/edit view, changing image display

### `src/pages/DriverForm.jsx`
- Create new driver form
- Uses ImageUploader for each document category
- Calls `POST /api/drivers` with multipart/form-data
- **EDIT THIS when**: changing driver creation form fields

### `src/pages/Vehicles.jsx`
- Vehicle list filtered by active sheet
- Type selector: FML / EXP-FML / Others
- Create/Edit modal — different form fields per type:
  - FML: standard vehicle fields
  - FML_EXP (EXP-FML): same structure, uses EXP challan
  - Others: uses OtherLogistics fixed data for dropdowns
- Calls challan lookup on EXP-FML entry via `GET /api/vehicles/challan/:challanNo`
- Accounts modal (Step 2 of vehicle edit): financial fields for FML/EXP/Others
- **EDIT THIS when**: adding vehicle fields, changing form per type, accounts calculation UI

### `src/pages/Accounts.jsx`
- Financial data entry per vehicle (Step 2 of vehicle edit flow)
- Three separate form components: `FMLFinancials`, `EXPFinancials`, `OthersFinancials`
- All sub-components defined at MODULE LEVEL (outside component) to prevent cursor-jumping
- Auto-calculations:
  - FML: `dieselQty = floor(overallKm / avgMileage)` (avgMileage from ModelDetails, READ-ONLY)
  - `driverWages = overallKm × driverWagesPerKm` (from ModelDetails)
  - `returnFare` from LogisticsData (FML: read-only, EXP: user-entered)
  - `total = dieselAmt + driverWages + returnFare`
  - `grandTotal = total + toll + border + fourLtrDiesel`
  - `ptpAmount = gatePass + pettyCash`
  - `hpclCardDiesel = sum(otpProviders)`
  - `remaining = grandTotal - ptpAmount - ptpDiesel - secondPumpDiesel - hpclCardDiesel - onroutePayment - onsiteReceiving - miscExpenses`
- OTP Providers: multiple entries (HPCL card entries)
- Tax Payment Receipts: multiple name+amount rows
- Petrol pump dropdown from `/api/vehicle-sheets/pumps`
- **EDIT THIS when**: changing financial calculations, adding new financial fields

### `src/pages/Billing.jsx`
- FML Billing / EXPFML Billing tab switcher
- Left panel: Select Sheet, Location, Consignee, Models checkboxes, Urbania toggle + incentive
- Right panel: Invoice Details (E-Ack No/Date, Invoice Date, Misc Charges, CGST/SGST/IGST, Delivery Location)
- "Generate Billing Report" → preview modal → confirm → generate
- Active billing sheet indicator (shows next bill number)
- Billing Sheets section: create, set active, lock, delete billing sheets
- View Bills modal: sheet selector, records table, PDF link, delete button
- `api.get("/billing/preview")` → shows eligible vehicles before generating
- `api.post("/billing/generate")` → generates bill
- `api.delete("/billing/records/:id")` → deletes bill + clears vehicle billed field + removes from sheet
- **EDIT THIS when**: changing billing form, bill preview UI, PDF open behavior

### `src/pages/VehicleSheets.jsx`
- Create/list/lock/delete vehicle sheet tabs (per type: FML/FML_EXP/Others)
- Type selector pills (FML / FML_EXP / Others)
- "🧾 Go to Billing Sheet →" button for FML/FML_EXP types (navigates to /billing)
- Create form: sheet name + financial year auto-derived
- Table: sheet name, type, status badge, vehicle count, lock/delete actions
- Lock: prevents vehicle creation in that sheet
- Delete: shows vehicle count confirmation before hard delete
- **EDIT THIS when**: changing sheet management UI, adding sheet types

### `src/pages/LogisticsPartners.jsx`
- Fixed data management: Logistics Partners, Model Details, Toll Rates, Other Logistics
- Tabbed interface per data type
- FML logistics: location + consignee + address + region + overallKM + returnFare
- Model details: model name + vehicleRate + billingCode + average + driverWages
- Tolls: location + toll rate per model (dynamic model keys)
- Others: same structure as FML logistics but for "Others" type
- Modal backgrounds: white `#fff` (NOT dark)
- **EDIT THIS when**: adding logistics fields, changing partner data forms

### `src/pages/Users.jsx`
- List all users (superadmin/admin only)
- Register new user: name, email, password, role
- Toggle user active/inactive
- **EDIT THIS when**: changing user management UI

---

## Hooks

### `src/hooks/useDrivers.js`
- `const { drivers, loading, total, pages, fetchDrivers } = useDrivers()`
- Handles pagination + search state
- Calls `GET /api/drivers`
- **EDIT THIS when**: changing driver list fetch logic

### `src/hooks/useUpload.js`
- `const { uploading, progress, upload } = useUpload()`
- Tracks file upload progress for multipart requests
- **EDIT THIS when**: changing upload progress tracking

---

## Design System (Inline Styles)

All pages use a shared color palette defined as a const at the top:
```js
const C = {
  bg: "#F1F5F9",        // page background
  white: "#fff",         // card/modal background
  border: "#E2E8F0",     // borders
  text: "#1E293B",       // primary text
  muted: "#64748B",      // secondary text
  faint: "#94A3B8",      // placeholder/disabled text
  blue: "#2563EB",       // primary action
  red: "#EF4444",        // danger/delete
  green: "#16A34A",      // success/active
  yellow: "#D97706",     // warning/lock
  panel: "#F8FAFC",      // table row hover / card panels
  darkBg: "#2D3748",     // dark header (billing portal)
};
```

Common style patterns:
```js
const INP = { width:"100%", padding:"9px 12px", border:`1px solid ${C.border}`, ... }
const SEL = { ...INP, cursor:"pointer" }
const BTN = (bg, color="#fff", extra={}) => ({ padding:"9px 18px", background:bg, ... })
const Lbl = ({children}) => <div style={{fontSize:13, fontWeight:600, color:C.text...}}>{children}</div>
const Fld = ({label, children}) => <div style={{marginBottom:14}}><Lbl>{label}</Lbl>{children}</div>
```

---

## Common UI Patterns

### Loading states
```jsx
{loading ? <div style={{textAlign:"center",padding:60}}><Spin /></div> : <content />}
```

### Spin component (inline, no import needed — defined per page)
```jsx
function Spin() { return <div style={{width:20,height:20,border:`3px solid ${C.border}`,borderTopColor:C.blue,borderRadius:"50%",animation:"bspin 0.7s linear infinite"}} />; }
// Add to page: <style>{`@keyframes bspin{to{transform:rotate(360deg)}}`}</style>
```

### Toast notifications
```js
import toast from "react-hot-toast";
toast.success("Done!"); toast.error("Failed");
```

### Modal pattern
```jsx
{showModal && (
  <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center"}}>
    <div style={{background:C.white,borderRadius:12,padding:28,width:"min(90vw,480px)",...}}>
      ...content
    </div>
  </div>
)}
```

### Role-gated UI
```jsx
const { hasRole } = useAuth();
{hasRole("superadmin","admin") && <button>Admin Action</button>}
```

### API call pattern
```jsx
const [loading, setLoading] = useState(false);
const doAction = async () => {
  setLoading(true);
  try {
    const { data } = await api.post("/endpoint", payload);
    toast.success("Done");
    // update state
  } catch(e) {
    toast.error(e.response?.data?.message || "Failed");
  } finally {
    setLoading(false);
  }
};
```

---

## Adding New Pages Checklist

1. Create `src/pages/NewPage.jsx`
2. Import in `src/App.jsx`
3. Add `<Route path="new-page" element={<NewPage />} />` in `AppRoutes`
4. Add nav link in `src/components/Layout.jsx`
5. If role-protected: wrap in `<ProtectedRoute roles={[...]}>`

## Adding New Fields to a Form

1. Add state: `const [field, setField] = useState("")`
2. Add input in JSX with `value={field}` + `onChange={e=>setField(e.target.value)}`
3. Include in API call payload
4. Add to backend model (see Backend Map)
5. Add to sheet sync (see Backend Map)

## Important: Cursor-jumping Prevention
Any sub-component used inside another component's render body MUST be defined
at module level (outside the parent component function).
Defining components inline causes React to unmount/remount on every parent render,
losing input focus. See `Accounts.jsx` for the correct pattern.