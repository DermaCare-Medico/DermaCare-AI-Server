import type { Role } from "../generated/prisma/client.js";
import type { AuthenticatedAccountSnapshot } from "./auth.types.js";

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; role: Role; account?: AuthenticatedAccountSnapshot };
    }
  }
}

export {};
