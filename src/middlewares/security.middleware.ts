import cors from "cors";
import helmet from "helmet";
import { env } from "../config/env.js";

const allowedOrigins: string[] = env.CORS_ORIGIN
  .split(",")
  .map((origin: string) => origin.trim())
  .filter(Boolean);

export const security = [
  helmet(),
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
];