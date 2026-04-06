/**
 * One-time OAuth2 authorization script.
 * Run this ONCE on your machine to generate token.json.
 *
 * Usage:
 *   cd server
 *   node config/authorize.js
 *
 * Then open the printed URL in a browser, authorize, paste the code back.
 * This creates server/token.json — keep it safe and never commit to git.
 */

const { google } = require("googleapis");
const path = require("path");
const fs   = require("fs");
const readline = require("readline");

const CREDENTIALS_PATH = path.join(__dirname, "../credentials.json");
const TOKEN_PATH       = path.join(__dirname, "../token.json");

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/spreadsheets",
];

async function main() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error("❌ credentials.json not found in server/");
    console.error("   Download it from: console.cloud.google.com → APIs & Services → Credentials");
    console.error("   Create → OAuth 2.0 Client ID → Desktop App → Download JSON → rename to credentials.json");
    process.exit(1);
  }

  const { installed } = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));
  const { client_id, client_secret, redirect_uris } = installed;

  const oAuth2Client = new google.auth.OAuth2(
    client_id, client_secret, redirect_uris[0]
  );

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",   // gives a refresh_token so it never expires
    scope: SCOPES,
    prompt: "consent",        // force consent screen to always get refresh_token
  });

  console.log("\n🔗 Open this URL in your browser and authorize the app:\n");
  console.log(authUrl);
  console.log("\n");
  

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question("📋 Paste the authorization code here: ", async (code) => {
    rl.close();
    try {
      const { tokens } = await oAuth2Client.getToken(code.trim());
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
      console.log("\n✅ token.json created at:", TOKEN_PATH);
      console.log("   Your app can now access Google Drive and Sheets.");
      console.log("   ⚠️  Add token.json and credentials.json to .gitignore — never commit them.");
    } catch (err) {
      console.error("❌ Error getting token:", err.message);
    }
  });
}

main();