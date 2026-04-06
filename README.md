# DriveSafe — Fleet Management System

MERN stack · Google Drive · Google Sheets · Socket.IO real-time

## Structure

```
drivesafe/
├── client/          ← React + Vite + Tailwind (frontend)
├── server/          ← Node.js + Express + MongoDB (backend)
├── .env             ← single env file for everything (create from .env.example)
├── .env.example     ← template
└── package.json     ← root scripts
```

## Quick Start

### 1. Install dependencies
```bash
npm run install:all
```

### 2. Set up environment
```bash
cp .env.example .env
# Fill in all values in .env
```

### 3. Seed SuperAdmin (first time only)
```bash
npm run seed
```

### 4. Run development servers

**Terminal 1 — Backend:**
```bash
npm run dev:server
# Runs on http://localhost:5000
```

**Terminal 2 — Frontend:**
```bash
npm run dev:client
# Runs on http://localhost:5173
```

Open http://localhost:5173 and log in with your SUPERADMIN_EMAIL + SUPERADMIN_PASSWORD.

---

## Google APIs Setup

### Step 1 — Google Cloud Project
1. Go to https://console.cloud.google.com
2. Create project → **DriveSafe**
3. Enable: **Google Drive API** + **Google Sheets API**

### Step 2 — Service Account
1. APIs & Services → Credentials → Create Credentials → Service Account
2. Name it `drivesafe-service` → Done
3. Click it → Keys → Add Key → JSON → Download
4. Copy `client_email` → `GOOGLE_CLIENT_EMAIL` in `.env`
5. Copy `private_key` → `GOOGLE_PRIVATE_KEY` in `.env` (keep the `\n` as literal backslash-n, wrapped in double quotes)

### Step 3 — Google Drive Folder
1. Create folder **DriveSafe Media** in Drive
2. Share with your `GOOGLE_CLIENT_EMAIL` as **Editor**
3. Copy folder ID from URL → `GOOGLE_DRIVE_FOLDER_ID`

### Step 4 — Google Sheets (Drivers)
1. Create spreadsheet, rename tab to **Drivers**
2. Share with `GOOGLE_CLIENT_EMAIL` as **Editor**
3. Copy spreadsheet ID from URL → `GOOGLE_SPREADSHEET_ID`

### Step 5 — Google Sheets (Vehicles)
1. Create a **separate** spreadsheet for vehicles
2. Share with `GOOGLE_CLIENT_EMAIL` as **Editor**
3. Copy spreadsheet ID → `VEHICLE_SPREADSHEET_ID`
4. From the frontend, create monthly tabs (e.g. "April 2025") — headers are added automatically

---

## Roles & Permissions

| Action              | SuperAdmin | Admin | Manager | User |
|---------------------|:---:|:---:|:---:|:---:|
| Login               | ✅ | ✅ | ✅ | ✅ |
| View drivers/vehicles | ✅ | ✅ | ✅ | ✅ |
| Add / Edit          | ✅ | ✅ | ✅ | ❌ |
| Delete              | ✅ | ✅ | ❌ | ❌ |
| Create vehicle sheet | ✅ | ✅ | ✅ | ❌ |
| Lock / Unlock sheet  | ✅ | ✅ | ❌ | ❌ |
| Delete sheet        | ✅ | ✅ | ❌ | ❌ |
| Register users      | ✅ | ✅ | ❌ | ❌ |
| Disable users       | ✅ | ❌ | ❌ | ❌ |

---

## Deploying (Free — ₹0)

| Service | Platform | Notes |
|---------|----------|-------|
| Backend (server/) | Render free tier | Root dir: `server` · Start: `node server.js` |
| Frontend (client/) | Vercel free tier | Root dir: `client` · Framework: Vite |
| Database | MongoDB Atlas M0 | Free 512MB |
| Images/PDFs | Google Drive | 15GB free |
| Data mirror | Google Sheets | Free |
