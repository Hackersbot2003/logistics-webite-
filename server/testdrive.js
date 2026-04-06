require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const { google } = require("googleapis");
const { Readable } = require("stream");

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/drive"],
});

const drive = google.drive({ version: "v3", auth });

async function test() {
  console.log("FOLDER_ID:", process.env.GOOGLE_DRIVE_FOLDER_ID);
  console.log("CLIENT_EMAIL:", process.env.GOOGLE_CLIENT_EMAIL);

  // Try listing files in the folder to verify access
  try {
    const list = await drive.files.list({
      q: `'${process.env.GOOGLE_DRIVE_FOLDER_ID}' in parents`,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      fields: "files(id, name)",
    });
    console.log("✅ Folder access OK. Files inside:", list.data.files.length);
  } catch (e) {
    console.log("❌ Cannot access folder:", e.message);
  }

  // Try uploading a small test file
  try {
    const stream = new Readable();
    stream.push("hello drivesafe test");
    stream.push(null);

    const res = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: "test_upload.txt",
        parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
      },
      media: { mimeType: "text/plain", body: stream },
      fields: "id, webViewLink",
    });

    console.log("✅ Upload SUCCESS!");
    console.log("   File ID:", res.data.id);
    console.log("   Link:", res.data.webViewLink);

    // Clean up — delete test file
    await drive.files.delete({ fileId: res.data.id, supportsAllDrives: true });
    console.log("✅ Test file deleted. Drive is working correctly!");
  } catch (e) {
    console.log("❌ Upload FAILED:", e.message);
    console.log("\n--- HOW TO FIX ---");
    if (e.message.includes("storage quota")) {
      console.log("→ Your FOLDER_ID points to a regular My Drive folder.");
      console.log("→ Create a Shared Drive OR use the exact folder URL ID.");
      console.log("→ Folder URL: https://drive.google.com/drive/folders/FOLDER_ID_HERE");
    }
    if (e.message.includes("not found") || e.message.includes("404")) {
      console.log("→ GOOGLE_DRIVE_FOLDER_ID in .env is wrong.");
      console.log("→ Copy it again from the folder URL.");
    }
  }

  process.exit(0);
}

test().catch(console.error);