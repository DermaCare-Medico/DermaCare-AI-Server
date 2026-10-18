import { OAuth2Client } from "google-auth-library";
import { env } from "../../../config/env.js";
import { AppError } from "../../../shared/errors/AppError.js";

const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
}

// Verifies the signature, audience and expiry with Google's public keys
export const verifyGoogleIdToken = async (idToken: string): Promise<GoogleProfile> => {
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email || !payload.email_verified) {
      throw new Error("Google email is not verified");
    }

    return {
      sub: payload.sub,
      email: payload.email.toLowerCase(),
      name: payload.name ?? payload.email.split("@")[0] ?? "User",
    };
  } catch {
    throw new AppError("Invalid Google token", 401);
  }
};