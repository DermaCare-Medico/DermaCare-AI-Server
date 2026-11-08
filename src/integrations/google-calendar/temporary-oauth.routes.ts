import { randomBytes, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { google } from "googleapis";

import { env } from "../../config/env.js";

// Temporary setup utility. Keep this state in memory so it cannot become a
// second token store and so every authorization attempt is single-use.
const PRODUCTION_REDIRECT_URI = "https://dermacare-ai-server.onrender.com/oauth2callback";
const STATE_TTL_MS = 10 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 10 * 60 * 1000;
const pendingStates = new Map<string, number>();
let pendingRefreshToken: { token: string; expiresAt: number } | undefined;

const configurationError = () =>
  !env.GOOGLE_CALENDAR_CLIENT_ID
  || !env.GOOGLE_CALENDAR_CLIENT_SECRET
  || !env.GOOGLE_CALENDAR_OAUTH_TRANSFER_SECRET;

const createOAuthClient = () => new google.auth.OAuth2(
  env.GOOGLE_CALENDAR_CLIENT_ID,
  env.GOOGLE_CALENDAR_CLIENT_SECRET,
  PRODUCTION_REDIRECT_URI,
);

const removeExpiredStates = () => {
  const now = Date.now();
  for (const [state, expiresAt] of pendingStates) {
    if (expiresAt <= now) pendingStates.delete(state);
  }
  if (pendingRefreshToken && pendingRefreshToken.expiresAt <= now) {
    pendingRefreshToken = undefined;
  }
};

const hasValidTransferSecret = (candidate: string | undefined) => {
  const expected = env.GOOGLE_CALENDAR_OAUTH_TRANSFER_SECRET;
  if (!expected || !candidate) return false;
  const expectedBytes = Buffer.from(expected);
  const candidateBytes = Buffer.from(candidate);
  return expectedBytes.length === candidateBytes.length
    && timingSafeEqual(expectedBytes, candidateBytes);
};

const consumeState = (candidate: string) => {
  removeExpiredStates();
  const matchingState = [...pendingStates.keys()].find((state) => {
    const expected = Buffer.from(state);
    const actual = Buffer.from(candidate);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  });

  if (!matchingState) return false;
  pendingStates.delete(matchingState);
  return true;
};

const router = Router();

router.get("/oauth2authorize", (_req, res) => {
  if (configurationError()) {
    res.status(503).json({ success: false, message: "Temporary Google Calendar OAuth is not configured" });
    return;
  }

  removeExpiredStates();
  const state = randomBytes(32).toString("base64url");
  pendingStates.set(state, Date.now() + STATE_TTL_MS);

  const authorizationUrl = createOAuthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar"],
    state,
  });

  res.status(200).json({ success: true, authorizationUrl });
});

router.get("/oauth2callback", async (req, res) => {
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const code = typeof req.query.code === "string" ? req.query.code : "";

  if (!state || !consumeState(state)) {
    res.status(400).send("Invalid or expired OAuth state.");
    return;
  }

  if (!code || typeof req.query.error === "string") {
    res.status(400).send("Google Calendar authorization was not completed.");
    return;
  }

  if (configurationError()) {
    res.status(503).send("Temporary Google Calendar OAuth is not configured.");
    return;
  }

  try {
    const { tokens } = await createOAuthClient().getToken(code);
    if (!tokens.refresh_token) {
      res.status(502).send("Google Calendar authorization did not provide a refresh token.");
      return;
    }
    pendingRefreshToken = {
      token: tokens.refresh_token,
      expiresAt: Date.now() + REFRESH_TOKEN_TTL_MS,
    };
    res.status(200).send("Google Calendar authorization completed. Retrieve the refresh token using the one-time transfer endpoint.");
  } catch {
    // Do not log or return the authorization code, tokens, or client secret.
    res.status(502).send("Google Calendar authorization could not be completed.");
  }
});

router.post("/oauth2token", (req, res) => {
  removeExpiredStates();
  if (!hasValidTransferSecret(req.get("x-google-calendar-transfer-secret"))) {
    res.status(404).send("Not found.");
    return;
  }

  if (!pendingRefreshToken) {
    res.status(404).send("No pending Google Calendar token.");
    return;
  }

  const refreshToken = pendingRefreshToken.token;
  pendingRefreshToken = undefined;
  res.status(200).json({ refreshToken });
});

export default router;
