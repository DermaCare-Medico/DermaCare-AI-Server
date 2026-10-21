export const MAX_MEETING_ATTEMPTS = 8;

export const meetingRetryDelayMs = (attempt: number) =>
  Math.min(15 * 60_000, 5_000 * (2 ** Math.max(0, attempt - 1)));

export const safeProvisioningError = (error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown Google Calendar error";
  return message.replace(/(?:token|secret|credential|authorization)\s*[:=]\s*\S+/gi, "credential=[REDACTED]").slice(0, 500);
};
