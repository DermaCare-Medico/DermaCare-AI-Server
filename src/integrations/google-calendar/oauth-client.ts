import { google } from "googleapis";

import { env } from "../../config/env.js";

export class GoogleCalendarConfigurationError extends Error {}

export const createGoogleCalendarClient = () => {
  const { GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET,
    GOOGLE_CALENDAR_REDIRECT_URI, GOOGLE_CALENDAR_REFRESH_TOKEN } = env;
  if (!GOOGLE_CALENDAR_CLIENT_ID || !GOOGLE_CALENDAR_CLIENT_SECRET
    || !GOOGLE_CALENDAR_REDIRECT_URI || !GOOGLE_CALENDAR_REFRESH_TOKEN) {
    throw new GoogleCalendarConfigurationError("Google Calendar integration is not configured");
  }

  const auth = new google.auth.OAuth2(
    GOOGLE_CALENDAR_CLIENT_ID,
    GOOGLE_CALENDAR_CLIENT_SECRET,
    GOOGLE_CALENDAR_REDIRECT_URI,
  );
  auth.setCredentials({ refresh_token: GOOGLE_CALENDAR_REFRESH_TOKEN });
  return google.calendar({ version: "v3", auth });
};
