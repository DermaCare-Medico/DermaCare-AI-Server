import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";

import {
  clearRefreshCookie,
  REFRESH_COOKIE_NAME,
  refreshTokenOf,
  setRefreshCookie,
} from "./session-cookie.js";

test("refresh token body remains supported and takes precedence over the cookie", () => {
  const req = {
    body: { refreshToken: "body-refresh-token-1234567890" },
    get: () => `${REFRESH_COOKIE_NAME}=cookie-refresh-token-1234567890`,
  } as unknown as Request;
  assert.equal(refreshTokenOf(req), "body-refresh-token-1234567890");
});

test("refresh token can be delivered by the HTTP-only session cookie", () => {
  const req = {
    body: {},
    get: () => `${REFRESH_COOKIE_NAME}=cookie-refresh-token-1234567890`,
  } as unknown as Request;
  assert.equal(refreshTokenOf(req), "cookie-refresh-token-1234567890");
});

test("session cookie is HTTP-only, scoped, same-site and cleared with matching attributes", () => {
  const calls: unknown[][] = [];
  const res = {
    cookie: (...args: unknown[]) => calls.push(["set", ...args]),
    clearCookie: (...args: unknown[]) => calls.push(["clear", ...args]),
  } as unknown as Response;
  setRefreshCookie(res, "refresh-token-1234567890");
  clearRefreshCookie(res);
  const setOptions = calls[0]![3] as Record<string, unknown>;
  const clearOptions = calls[1]![2] as Record<string, unknown>;
  assert.equal(setOptions.httpOnly, true);
  assert.equal(setOptions.sameSite, "strict");
  assert.equal(setOptions.path, "/api/v1/auth");
  assert.equal(setOptions.maxAge, 30 * 24 * 60 * 60 * 1000);
  assert.equal(clearOptions.path, setOptions.path);
  assert.equal(clearOptions.sameSite, setOptions.sameSite);
});
