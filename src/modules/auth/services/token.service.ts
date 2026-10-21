import crypto from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../../../config/env.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { AUTH_TOKEN } from "../../../shared/constants/auth.constants.js";
import { AccountStatus, Role } from "../../../generated/prisma/client.js";
import type { RequestMeta, SessionTokens } from "../../../types/auth.types.js";

const hashToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

const isRole = (value: unknown): value is Role =>
  typeof value === "string" && (Object.values(Role) as string[]).includes(value);

export const signAccessToken = (user: { id: string; role: Role }): string =>
  jwt.sign({ role: user.role }, env.JWT_ACCESS_SECRET, {
    subject: user.id,
    algorithm: "HS256",
    issuer: AUTH_TOKEN.ACCESS_ISSUER,
    audience: AUTH_TOKEN.ACCESS_AUDIENCE,
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"],
  });

// Verify only: checks signature, expiry, issuer and audience. Never jwt.decode().
export const verifyAccessToken = (token: string): { userId: string; role: Role } => {
  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ["HS256"],
      issuer: AUTH_TOKEN.ACCESS_ISSUER,
      audience: AUTH_TOKEN.ACCESS_AUDIENCE,
    });
  } catch {
    throw new AppError("Invalid or expired token", 401);
  }

  if (typeof payload === "string" || typeof payload.sub !== "string" || !isRole(payload.role)) {
    throw new AppError("Invalid token", 401);
  }
  return { userId: payload.sub, role: payload.role };
};

type AccessTokenClaims = ReturnType<typeof verifyAccessToken>;
type CurrentAccount = { id: string; role: Role; status: AccountStatus; deletedAt: Date | null } | null;

export const resolveAccessTokenAccount = async (
  claims: AccessTokenClaims,
  findAccount: (userId: string) => Promise<CurrentAccount> = async (userId) =>
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true, deletedAt: true },
    }),
): Promise<AccessTokenClaims> => {
  const account = await findAccount(claims.userId);
  if (!account || account.deletedAt) {
    throw new AppError("Invalid or expired token", 401);
  }
  if (account.status !== AccountStatus.ACTIVE) {
    throw new AppError("Account is not active", 403);
  }

  return { userId: account.id, role: account.role };
};

export const issueSession = async (
  user: { id: string; role: Role },
  meta: RequestMeta,
): Promise<SessionTokens> => {
  const refreshToken = crypto.randomBytes(48).toString("base64url");

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + AUTH_TOKEN.REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
      userAgent: meta.userAgent?.slice(0, 255),
      ipAddress: meta.ipAddress,
    },
  });

  return { accessToken: signAccessToken(user), refreshToken };
};

export const revokeAllSessions = async (userId: string): Promise<void> => {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

export const revokeSession = async (refreshToken: string): Promise<void> => {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

// Each refresh token works once. Using an old one again revokes every session of that user.
export const rotateSession = async (
  refreshToken: string,
  meta: RequestMeta,
): Promise<SessionTokens> => {
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
    include: { user: { select: { id: true, role: true, status: true, deletedAt: true } } },
  });

  if (!record) throw new AppError("Invalid refresh token", 401);

  if (record.revokedAt) {
    await revokeAllSessions(record.userId);
    throw new AppError("Invalid refresh token", 401);
  }

  if (record.expiresAt.getTime() < Date.now()) {
    throw new AppError("Refresh token expired", 401);
  }

  if (record.user.deletedAt) {
    throw new AppError("Invalid refresh token", 401);
  }

  if (record.user.status !== AccountStatus.ACTIVE) {
    throw new AppError("Account is not active", 403);
  }

  const result = await prisma.refreshToken.updateMany({
    where: { id: record.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count !== 1) throw new AppError("Invalid refresh token", 401);

  return issueSession(record.user, meta);
};
