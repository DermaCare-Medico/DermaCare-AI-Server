
import "dotenv/config";
import { google } from "googleapis";
import { createInterface } from "node:readline/promises";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CALENDAR_CLIENT_ID,
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
  process.env.GOOGLE_CALENDAR_REDIRECT_URI,
);

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

try {
  const code = await rl.question("Paste authorization code: ");
  const { tokens } = await oauth2Client.getToken(code.trim());

  if (!tokens.refresh_token) {
    throw new Error("No refresh token returned. Reauthorize with offline consent.");
  }

  console.log("\nRefresh token generated successfully.");
  console.log("Copy it privately into GOOGLE_CALENDAR_REFRESH_TOKEN:");
  console.log(tokens.refresh_token);
} finally {
  rl.close();
}
