const { google } = require("googleapis");
const logger = require("./logger");

/**
 * Modernized Google Auth Config
 * Uses Environment Variables to avoid "installed" vs "web" JSON errors.
 */
const getOAuth2Client = () => {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  // The redirect URI must match what you set in the Cloud Console
  // For Playground it's https://developers.google.com/oauthplayground
  const redirectURI = "https://developers.google.com/oauthplayground";

  const oAuth2Client = new google.auth.OAuth2(
    clientID,
    clientSecret,
    redirectURI
  );

  // Use the permanent Refresh Token you just generated
  oAuth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  return oAuth2Client;
};

const getDriveClient = () => {
  const auth = getOAuth2Client();
  return google.drive({ version: "v3", auth });
};

const getSheetsClient = () => {
  const auth = getOAuth2Client();
  return google.sheets({ version: "v4", auth });
};

module.exports = { getDriveClient, getSheetsClient };