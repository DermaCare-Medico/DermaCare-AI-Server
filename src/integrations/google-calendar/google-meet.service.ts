import type { calendar_v3 } from "googleapis";

import { env } from "../../config/env.js";
import { createGoogleCalendarClient } from "./oauth-client.js";

export type MeetingInput = { appointmentId: string; startTime: Date; endTime: Date };
export type MeetingResult = { eventId: string; meetUrl: string };

export const googleEventIdForAppointment = (appointmentId: string) =>
  appointmentId.replaceAll("-", "").toLowerCase();

const resultFromEvent = (event: calendar_v3.Schema$Event, fallbackId: string): MeetingResult => {
  const meetUrl = event.hangoutLink
    ?? event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri;
  if (!meetUrl) throw new Error("Google Meet conference is still pending");
  return { eventId: event.id ?? fallbackId, meetUrl };
};

export const createGoogleMeet = async (
  input: MeetingInput,
  calendar = createGoogleCalendarClient(),
): Promise<MeetingResult> => {
  const eventId = googleEventIdForAppointment(input.appointmentId);
  try {
    const response = await calendar.events.insert({
      calendarId: env.GOOGLE_CALENDAR_ID,
      conferenceDataVersion: 1,
      requestBody: {
        id: eventId,
        summary: "DermaCare AI consultation",
        description: "Secure online consultation appointment.",
        start: { dateTime: input.startTime.toISOString() },
        end: { dateTime: input.endTime.toISOString() },
        conferenceData: {
          createRequest: {
            requestId: `appointment-${input.appointmentId}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      },
    });
    return resultFromEvent(response.data, eventId);
  } catch (error: unknown) {
    const status = (error as { code?: number; response?: { status?: number } }).code
      ?? (error as { response?: { status?: number } }).response?.status;
    if (status !== 409) throw error;
    const existing = await calendar.events.get({ calendarId: env.GOOGLE_CALENDAR_ID, eventId });
    return resultFromEvent(existing.data, eventId);
  }
};
