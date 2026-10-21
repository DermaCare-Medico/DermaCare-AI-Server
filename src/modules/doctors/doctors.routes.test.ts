import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";

import { Role } from "../../generated/prisma/client.js";
import { authorize } from "../../middlewares/authorize.middleware.js";
import doctorRoutes from "./doctors.routes.js";

type RouteLayer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
  };
};

const mountedRoutes = () =>
  ((doctorRoutes as unknown as { stack: RouteLayer[] }).stack)
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route!.path,
      method: Object.keys(layer.route!.methods)[0]!.toUpperCase(),
    }));

const checkRole = (allowed: Role[], role: Role) => {
  let error: unknown;
  let passed = false;
  const req = { auth: { userId: "user-id", role } } as Request;
  const next: NextFunction = (value?: unknown) => {
    error = value;
    passed = value === undefined;
  };

  authorize(...allowed)(req, {} as Response, next);
  return { error, passed };
};

test("Doctor router exposes only canonical public and role-specific routes", () => {
  const routes = mountedRoutes();

  assert.deepEqual(routes, [
    { method: "GET", path: "/" },
    { method: "GET", path: "/:doctorId" },
    { method: "POST", path: "/application" },
    { method: "GET", path: "/me/profile" },
    { method: "POST", path: "/me/slots" },
    { method: "GET", path: "/me/slots" },
    { method: "PATCH", path: "/me/slots/:slotId" },
    { method: "GET", path: "/me/appointment-requests" },
    { method: "PATCH", path: "/me/appointments/:appointmentId/decision" },
    { method: "PATCH", path: "/me/appointments/:appointmentId/complete" },
    { method: "POST", path: "/me/medicine-requests" },
    { method: "GET", path: "/me/medicine-requests" },
  ]);
  assert.equal(routes.some(({ path }) => path.startsWith("/admin/")), false);
});

test("Doctor application and profile RBAC preserve Patient and Doctor access", () => {
  assert.equal(checkRole([Role.PATIENT], Role.PATIENT).passed, true);
  assert.equal(checkRole([Role.PATIENT], Role.DOCTOR).passed, false);
  assert.equal(checkRole([Role.PATIENT, Role.DOCTOR], Role.PATIENT).passed, true);
  assert.equal(checkRole([Role.PATIENT, Role.DOCTOR], Role.DOCTOR).passed, true);
  assert.ok(checkRole([Role.PATIENT, Role.DOCTOR], Role.ADMIN).error);
});

test("Doctor operational routes remain Doctor-only", () => {
  assert.equal(checkRole([Role.DOCTOR], Role.DOCTOR).passed, true);
  assert.equal(checkRole([Role.DOCTOR], Role.PATIENT).passed, false);
  assert.equal(checkRole([Role.DOCTOR], Role.ADMIN).passed, false);
});
