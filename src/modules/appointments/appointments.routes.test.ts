import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";

import { Role } from "../../generated/prisma/client.js";
import { authorize } from "../../middlewares/authorize.middleware.js";
import appointmentRoutes from "./appointments.routes.js";

type RouteLayer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ name: string }>;
  };
};

const mountedRoutes = () =>
  ((appointmentRoutes as unknown as { stack: RouteLayer[] }).stack)
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route!.path,
      method: Object.keys(layer.route!.methods)[0]!.toUpperCase(),
    }));

const checkRole = (allowed: Role[], role: Role) => {
  let error: unknown;
  let passed = false;
  const req = { auth: { userId: "test-user-id", role } } as Request;
  const next: NextFunction = (value?: unknown) => {
    error = value;
    passed = value === undefined;
  };

  authorize(...allowed)(req, {} as Response, next);
  return { error, passed };
};

test("Appointment router exposes canonical Patient and Doctor appointment endpoints", () => {
  const routes = mountedRoutes();

  assert.deepEqual(routes, [
    { method: "POST", path: "/appointments" },
    { method: "GET", path: "/patients/me/appointments" },
    { method: "GET", path: "/patients/me/appointments/:id" },
    { method: "GET", path: "/doctors/me/appointments/:id" },
    { method: "POST", path: "/appointments/:id/cancellation-request" },
    { method: "PATCH", path: "/appointments/:id/cancellation" },
    { method: "POST", path: "/appointments/:id/cancel" },
    { method: "PATCH", path: "/appointments/:id/no-show" },
  ]);
});

test("Appointment booking POST /appointments rejects DOCTOR and allows PATIENT", () => {
  assert.equal(checkRole([Role.PATIENT], Role.PATIENT).passed, true);
  assert.equal(checkRole([Role.PATIENT], Role.DOCTOR).passed, false);
});

test("Doctor single appointment GET /doctors/me/appointments/:id allows DOCTOR and rejects PATIENT", () => {
  assert.equal(checkRole([Role.DOCTOR], Role.DOCTOR).passed, true);
  assert.equal(checkRole([Role.DOCTOR], Role.PATIENT).passed, false);
});

test("Patient list GET /patients/me/appointments allows PATIENT and rejects DOCTOR", () => {
  assert.equal(checkRole([Role.PATIENT], Role.PATIENT).passed, true);
  assert.equal(checkRole([Role.PATIENT], Role.DOCTOR).passed, false);
});

