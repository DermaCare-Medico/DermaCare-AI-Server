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
    stack: Array<{ name: string }>;
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
    { method: "GET", path: "/:doctorId/slots" },
    { method: "GET", path: "/:doctorId" },
    { method: "POST", path: "/application/documents" },
    { method: "POST", path: "/application" },
    { method: "GET", path: "/me/application-documents/:documentIndex" },
    { method: "GET", path: "/me/profile" },
    { method: "PATCH", path: "/me/profile" },
    { method: "POST", path: "/me/slots" },
    { method: "GET", path: "/me/slots" },
    { method: "PATCH", path: "/me/slots/:slotId" },
    { method: "DELETE", path: "/me/slots/:slotId" },
    { method: "GET", path: "/me/appointment-requests" },
    { method: "GET", path: "/me/appointments" },
    { method: "PATCH", path: "/me/appointments/:appointmentId/decision" },
    { method: "PATCH", path: "/me/appointments/:appointmentId/complete" },
    { method: "POST", path: "/me/medicine-requests" },
    { method: "GET", path: "/me/medicine-requests" },
    { method: "GET", path: "/me/earnings/summary" },
    { method: "GET", path: "/me/earnings/history" },
    { method: "GET", path: "/me/payouts" },
  ]);
  assert.equal(routes.some(({ path }) => path.startsWith("/admin/")), false);
});

test("Doctor application and profile RBAC preserve Patient and Doctor access", () => {
  const applicants = [Role.USER, Role.PATIENT, Role.DOCTOR];
  assert.equal(checkRole(applicants, Role.USER).passed, true);
  assert.equal(checkRole(applicants, Role.PATIENT).passed, true);
  assert.equal(checkRole(applicants, Role.DOCTOR).passed, true);
  assert.ok(checkRole(applicants, Role.ADMIN).error);
});

test("final Doctor application uses authentication plus service-level applicant authorization", () => {
  const layer = ((doctorRoutes as unknown as { stack: RouteLayer[] }).stack)
    .find(({ route }) => route?.path === "/application" && route.methods.post);

  assert.ok(layer?.route);
  assert.deepEqual(layer.route.stack.map(({ name }) => name), [
    "authenticate",
    "submitApplication",
  ]);
});

test("Doctor document upload authenticates before file and service-level applicant checks", () => {
  const layer = ((doctorRoutes as unknown as { stack: RouteLayer[] }).stack)
    .find(({ route }) => route?.path === "/application/documents" && route.methods.post);

  assert.ok(layer?.route);
  assert.deepEqual(layer.route.stack.map(({ name }) => name), [
    "authenticate",
    "multerMiddleware",
    "uploadApplicationDocument",
  ]);
});

test("clinical Doctor routes retain their role-authorization middleware", () => {
  const clinicalPaths = [
    "/me/profile",
    "/me/slots",
    "/me/appointment-requests",
    "/me/appointments",
    "/me/medicine-requests",
    "/me/earnings/summary",
    "/me/earnings/history",
    "/me/payouts",
  ];
  const routeLayers = ((doctorRoutes as unknown as { stack: RouteLayer[] }).stack)
    .filter(({ route }) => route && clinicalPaths.includes(route.path));

  assert.ok(routeLayers.length >= clinicalPaths.length);
  for (const { route } of routeLayers) {
    assert.ok(route!.stack.length >= 3, `${route!.path} must retain authenticate and authorize`);
  }
});

test("Doctor operational routes remain Doctor-only", () => {
  assert.equal(checkRole([Role.DOCTOR], Role.DOCTOR).passed, true);
  assert.equal(checkRole([Role.DOCTOR], Role.PATIENT).passed, false);
  assert.equal(checkRole([Role.DOCTOR], Role.USER).passed, false);
  assert.equal(checkRole([Role.DOCTOR], Role.ADMIN).passed, false);
});
