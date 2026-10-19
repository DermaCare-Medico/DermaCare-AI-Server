
import { rotateSession, revokeSession } from "./token.service.js";
import type { RequestMeta } from "../../../types/auth.types.js";

export const sessionService = {
  refresh: (refreshToken: string, meta: RequestMeta) =>
    rotateSession(refreshToken, meta),

  logout: (refreshToken: string) => revokeSession(refreshToken),
};
