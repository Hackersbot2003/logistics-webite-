/**
 * Google OAuth2 Authentication
 *
 * Uses OAuth2 (not service account / keys.json).
 * OAuth2 tokens are stored in server/token.json after first authorization.
 * This avoids the "Service Accounts do not have storage quota" error entirely.
 *
 * Works for BOTH Drive (file uploads) AND Sheets (spreadsheet read/write).
 *
 * Setup:
 *  1. Go to console.cloud.google.com → APIs & Services → Credentials
 *  2. Create OAuth 2.0 Client ID → Desktop App → Download JSON → save as server/credentials.json
 *  3. Run:  node server/config/authorize.js
 *  4. Open the printed URL in browser → authorize → paste the code back
 *  5. token.json is created → never commit it to git
 */

const { google } = require("googleapis");
const path = require("path");
const fs   = require("fs");

const CREDENTIALS_PATH = path.join(__dirname, "../credentials.json");
const TOKEN_PATH       = path.join(__dirname, "../token.json");

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/spreadsheets",
];

/**
 * Load credentials and token, return an authorized OAuth2 client.
 * Throws a clear error if credentials.json or token.json are missing.
 */
function getOAuth2Client() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(
      "Missing credentials.json — download it from Google Cloud Console " +
      "(APIs & Services → Credentials → OAuth 2.0 Client) and place it in server/"
    );
  }

  const { installed } = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));
  const { client_id, client_secret, redirect_uris } = installed;

  const oAuth2Client = new google.auth.OAuth2(
    client_id, client_secret, redirect_uris[0]
  );

  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error(
      "Missing token.json — run:  node server/config/authorize.js  and follow the instructions"
    );
  }

  const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
  oAuth2Client.setCredentials(token);

  // Auto-refresh: save new token when it refreshes
  oAuth2Client.on("tokens", (newTokens) => {
    const existing = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
    const merged = { ...existing, ...newTokens };
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
  });

  return oAuth2Client;
}

const getDriveClient = () => {
  const auth = getOAuth2Client();
  return google.drive({ version: "v3", auth });
};

const getSheetsClient = () => {
  const auth = getOAuth2Client();
  return google.sheets({ version: "v4", auth });
};

const getGoogleAuth = () => getOAuth2Client();

module.exports = { getGoogleAuth, getDriveClient, getSheetsClient, SCOPES };