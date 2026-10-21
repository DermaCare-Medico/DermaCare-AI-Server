import type { EndpointSpec, HttpMethod, ParameterDef, SchemaProperty, UserRole } from "./spec-types.js";

type Active = {
  method: HttpMethod; path: string; tag: string; summary: string; roles?: UserRole[];
  body?: Record<string, SchemaProperty>; required?: string[]; query?: string[]; success?: number;
};

const uuid: SchemaProperty = { type: "string", format: "uuid" };
const text: SchemaProperty = { type: "string" };
const bool: SchemaProperty = { type: "boolean" };
const integer: SchemaProperty = { type: "integer" };
const page = ["page", "limit"];
const states = {
  appointment: ["HELD", "PENDING", "CONFIRMED", "CANCELLATION_REQUESTED", "COMPLETED", "CANCELLED", "NO_SHOW"],
  order: ["PENDING", "CONFIRMED", "PROCESSING", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
};

const operations: Active[] = [
  { method: "GET", path: "/health", tag: "Health", summary: "Service health check" },
  { method: "POST", path: "/auth/register/request-otp", tag: "Authentication", summary: "Request registration OTP", body: { role: { type: "string", enum: ["PATIENT", "DOCTOR"] }, name: text, email: { type: "string", format: "email" }, password: { type: "string", minLength: 8, maxLength: 128 }, acceptTerms: bool, acceptPrivacy: bool, acceptHealthConsent: bool }, required: ["role", "name", "email", "password", "acceptTerms", "acceptPrivacy", "acceptHealthConsent"] },
  { method: "POST", path: "/auth/register/resend-otp", tag: "Authentication", summary: "Resend registration OTP", body: { email: { type: "string", format: "email" } }, required: ["email"] },
  { method: "POST", path: "/auth/register/verify-otp", tag: "Authentication", summary: "Verify registration OTP", success: 201, body: { email: { type: "string", format: "email" }, otp: { type: "string", minLength: 6, maxLength: 6 } }, required: ["email", "otp"] },
  { method: "POST", path: "/auth/login", tag: "Authentication", summary: "Password login", body: { email: { type: "string", format: "email" }, password: text }, required: ["email", "password"] },
  { method: "POST", path: "/auth/google", tag: "Authentication", summary: "Google login or registration", body: { idToken: text, role: { type: "string", enum: ["PATIENT", "DOCTOR"] }, acceptTerms: bool, acceptPrivacy: bool, acceptHealthConsent: bool }, required: ["idToken"] },
  { method: "POST", path: "/auth/forgot-password/request-otp", tag: "Authentication", summary: "Request password-reset OTP", body: { email: { type: "string", format: "email" } }, required: ["email"] },
  { method: "POST", path: "/auth/forgot-password/verify-otp", tag: "Authentication", summary: "Verify password-reset OTP", body: { email: { type: "string", format: "email" }, otp: text }, required: ["email", "otp"] },
  { method: "POST", path: "/auth/forgot-password/reset", tag: "Authentication", summary: "Reset password", body: { email: { type: "string", format: "email" }, otp: text, newPassword: text }, required: ["email", "otp", "newPassword"] },
  { method: "POST", path: "/auth/refresh", tag: "Authentication", summary: "Rotate refresh token", body: { refreshToken: text }, required: ["refreshToken"] },
  { method: "POST", path: "/auth/logout", tag: "Authentication", summary: "Revoke refresh token", body: { refreshToken: text }, required: ["refreshToken"] },
  { method: "GET", path: "/auth/me", tag: "Authentication", summary: "Get signed-in account", roles: ["PATIENT", "DOCTOR", "ADMIN", "STORE_OWNER"] },
  { method: "POST", path: "/auth/identities/google", tag: "Authentication", summary: "Link Google identity", roles: ["PATIENT", "DOCTOR", "ADMIN", "STORE_OWNER"], body: { idToken: text }, required: ["idToken"] },
  { method: "DELETE", path: "/auth/identities/{provider}", tag: "Authentication", summary: "Unlink sign-in identity", roles: ["PATIENT", "DOCTOR", "ADMIN", "STORE_OWNER"] },
  { method: "GET", path: "/medicines", tag: "Store", summary: "List available medicines", query: [...page, "search"] },
  { method: "GET", path: "/medicines/{id}", tag: "Store", summary: "Get available medicine" },
  { method: "POST", path: "/appointments", tag: "Appointments", summary: "Create Patient appointment", roles: ["PATIENT"], success: 201, body: { doctorId: uuid, slotId: uuid, screeningId: uuid, historySharingConsent: bool }, required: ["doctorId", "slotId"] },
  { method: "GET", path: "/patients/me/appointments", tag: "Appointments", summary: "List Patient appointments", roles: ["PATIENT"], query: [...page, "status"] },
  { method: "GET", path: "/patients/me/appointments/{id}", tag: "Appointments", summary: "Get Patient appointment and Meet provisioning state", roles: ["PATIENT"] },
  { method: "GET", path: "/doctors/me/appointments/{id}", tag: "Appointments", summary: "Get assigned Doctor appointment and Meet URL", roles: ["DOCTOR"] },
  { method: "POST", path: "/appointments/{id}/payments", tag: "Payments", summary: "Complete demo appointment payment", roles: ["PATIENT"], success: 201, body: {} },
  { method: "GET", path: "/appointments/{id}/payments", tag: "Payments", summary: "Get appointment payment", roles: ["PATIENT"] },
  { method: "POST", path: "/orders/{id}/payments", tag: "Payments", summary: "Complete demo medicine-order payment", roles: ["PATIENT"], success: 201, body: { amount: { type: "number" }, currency: { type: "string", enum: ["BDT"] } }, required: ["amount", "currency"] },
  { method: "GET", path: "/orders/{id}/payments", tag: "Payments", summary: "Get order payment", roles: ["PATIENT"] },
  { method: "POST", path: "/orders", tag: "Orders", summary: "Place medicine order", roles: ["PATIENT"], success: 201, body: { deliveryAddress: text, prescriptionId: uuid, items: { type: "array", items: { type: "object", properties: { medicineId: uuid, quantity: integer } } } }, required: ["deliveryAddress", "items"] },
  { method: "GET", path: "/patients/me/orders", tag: "Orders", summary: "List Patient orders", roles: ["PATIENT"], query: [...page, "status"] },
  { method: "GET", path: "/patients/me/orders/{id}", tag: "Orders", summary: "Get Patient order", roles: ["PATIENT"] },
  { method: "GET", path: "/patients/me/profile", tag: "Patients", summary: "Get Patient profile", roles: ["PATIENT"] },
  { method: "PATCH", path: "/patients/me/profile", tag: "Patients", summary: "Update Patient profile", roles: ["PATIENT"], body: { dateOfBirth: { type: "string", format: "date" }, gender: { type: "string", enum: ["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"] }, address: text, allergies: { type: "array", items: text }, existingConditions: { type: "array", items: text } } },
  { method: "GET", path: "/patients/me/dashboard", tag: "Patients", summary: "Get Patient dashboard", roles: ["PATIENT"] },
  { method: "GET", path: "/patients/me/medications", tag: "Patients", summary: "List Patient medications", roles: ["PATIENT"] },
  { method: "POST", path: "/patients/me/medications", tag: "Patients", summary: "Create Patient medication", roles: ["PATIENT"], success: 201, body: { medicineName: text, dosage: text, frequency: text, startDate: { type: "string", format: "date" }, endDate: { type: "string", format: "date" }, notes: text }, required: ["medicineName"] },
  { method: "PATCH", path: "/patients/me/medications/{id}", tag: "Patients", summary: "Update Patient medication", roles: ["PATIENT"], body: { medicineName: text, dosage: text, frequency: text, startDate: { type: "string", format: "date" }, endDate: { type: "string", format: "date" }, notes: text } },
  { method: "DELETE", path: "/patients/me/medications/{id}", tag: "Patients", summary: "Delete Patient medication", roles: ["PATIENT"] },
  { method: "GET", path: "/patients/me/prescriptions", tag: "Patients", summary: "List finalized Patient prescriptions", roles: ["PATIENT"], query: page },
  { method: "GET", path: "/patients/me/prescriptions/{id}", tag: "Patients", summary: "Get finalized Patient prescription", roles: ["PATIENT"] },
  { method: "GET", path: "/notifications", tag: "Notifications", summary: "List own notifications", roles: ["PATIENT", "DOCTOR", "ADMIN"], query: [...page, "isRead"] },
  { method: "GET", path: "/notifications/unread-count", tag: "Notifications", summary: "Get unread notification count", roles: ["PATIENT", "DOCTOR", "ADMIN"] },
  { method: "PATCH", path: "/notifications/read-all", tag: "Notifications", summary: "Mark all own notifications read", roles: ["PATIENT", "DOCTOR", "ADMIN"] },
  { method: "PATCH", path: "/notifications/{id}/read", tag: "Notifications", summary: "Mark own notification read", roles: ["PATIENT", "DOCTOR", "ADMIN"] },
  { method: "GET", path: "/users/me", tag: "Admin", summary: "Get Admin profile", roles: ["ADMIN"] },
  { method: "PATCH", path: "/users/me", tag: "Admin", summary: "Update Admin profile", roles: ["ADMIN"], body: { name: text, phone: text } },
];

const admin: Active[] = [
  ["GET", "/admin/dashboard", "Get Admin dashboard"], ["GET", "/admin/doctor-payments", "List Doctor payouts", [...page, "status"]], ["POST", "/admin/doctor-payments/{id}/send", "Send demo Doctor payout"],
  ["GET", "/admin/orders", "List orders", [...page, "status"]], ["GET", "/admin/orders/{id}", "Get order"], ["PATCH", "/admin/orders/{id}/status", "Update order status", undefined, { status: { type: "string", enum: states.order }, reason: text }, ["status"]],
  ["GET", "/admin/users", "List users", [...page, "search", "role", "status"]], ["GET", "/admin/users/{id}", "Get user"], ["PATCH", "/admin/users/{id}/status", "Update user status", undefined, { status: { type: "string", enum: ["ACTIVE", "SUSPENDED"] } }, ["status"]],
  ["GET", "/admin/doctors", "List Doctors", [...page, "search", "specialization", "status"]], ["GET", "/admin/doctors/{id}", "Get Doctor"], ["GET", "/admin/doctor-approvals", "List pending Doctor approvals", page],
  ["POST", "/admin/doctor-approvals/{id}/approve", "Approve Doctor", undefined, {}], ["POST", "/admin/doctor-approvals/{id}/reject", "Reject Doctor", undefined, { reason: text }, ["reason"]],
  ["GET", "/admin/medicines", "List medicines", [...page, "search", "lowStock", "isAvailable"]], ["POST", "/admin/medicines", "Create medicine", undefined, { name: text, strength: text, description: text, price: { type: "number" }, stockQuantity: integer, requiresPrescription: bool }, ["name", "price", "stockQuantity", "requiresPrescription"]],
  ["GET", "/admin/medicines/{id}", "Get medicine"], ["PATCH", "/admin/medicines/{id}", "Update medicine", undefined, { name: text, strength: text, description: text, price: { type: "number" }, stockQuantity: integer, requiresPrescription: bool, isAvailable: bool }], ["DELETE", "/admin/medicines/{id}", "Deactivate medicine"],
  ["GET", "/admin/appointments", "List appointments", [...page, "status", "doctorId", "patientId"]], ["GET", "/admin/appointments/{id}", "Get appointment"], ["GET", "/admin/audit-logs", "List audit logs", [...page, "dateFrom", "dateTo", "actorUserId", "action", "entityType", "entityId"]],
].map(([method, path, summary, query, body, required]) => ({ method: method as HttpMethod, path: path as string, tag: "Admin", summary: summary as string, roles: ["ADMIN"], query: query as string[] | undefined, body: body as Record<string, SchemaProperty> | undefined, required: required as string[] | undefined, success: method === "POST" && path === "/admin/medicines" ? 201 : undefined }));

operations.push(...admin);

const queryProperty = (name: string): SchemaProperty => {
  if (name === "page" || name === "limit") return { type: "integer", minimum: 1 };
  if (["doctorId", "patientId", "actorUserId", "entityId"].includes(name)) return uuid;
  if (["isRead", "lowStock", "isAvailable"].includes(name)) return { type: "boolean" };
  if (name === "status") return { type: "string", description: `Allowed values depend on the resource. Appointment: ${states.appointment.join(", ")}; order: ${states.order.join(", ")}.` };
  return text;
};

export const ACTIVE_ENDPOINTS: EndpointSpec[] = operations.map((op, index) => {
  const roles = op.roles ?? ["PUBLIC"];
  const parameters: ParameterDef[] = [
    ...Array.from(op.path.matchAll(/\{([^}]+)\}/g), (match) => ({ name: match[1]!, in: "path" as const, required: true, type: "string", format: match[1] === "provider" ? undefined : "uuid" })),
    ...(op.query ?? []).map((name) => {
      const property = queryProperty(name);
      return { name, in: "query" as const, required: false, type: property.type, format: property.format, description: property.description, enum: property.enum };
    }),
  ];
  const hasConflict = op.path === "/appointments"
    || op.path === "/orders"
    || op.path === "/auth/identities/google"
    || op.path.includes("/payments")
    || (op.path.startsWith("/admin/") && ["POST", "PATCH"].includes(op.method));
  const hasPublicAuthFailure = ["/auth/login", "/auth/google", "/auth/refresh"].includes(op.path);
  const isRateLimitedAuth = op.path.startsWith("/auth/") && roles.includes("PUBLIC");
  return {
    id: 1000 + index,
    method: op.method,
    path: op.path,
    moduleNumber: "ACTIVE",
    moduleName: op.tag,
    summary: op.summary,
    description: `${op.summary}. This operation is mounted by the current Express application.`,
    roles,
    authRequired: !roles.includes("PUBLIC"),
    authType: roles.includes("PUBLIC") ? "None" : "BearerAuth",
    implementationStatus: "Implemented and verified",
    businessRules: op.tag === "Payments" ? ["Demo payment only; no external payment gateway is charged.", "Successful payment transitions are atomic and concurrency guarded."] : [],
    ...(parameters.length ? { parameters } : {}),
    ...(op.body !== undefined ? { requestBody: { description: "JSON request body", required: Object.keys(op.body).length > 0, contentType: "application/json", schema: { type: "object", properties: op.body, required: op.required }, example: {} } } : {}),
    responses: [
      { statusCode: op.success ?? 200, description: "Operation completed successfully." },
      { statusCode: 400, description: "Request validation or business-rule failure." },
      ...(!roles.includes("PUBLIC") ? [{ statusCode: 401, description: "Missing, invalid, expired, or deleted-account access token." }, { statusCode: 403, description: "Inactive account or insufficient role." }] : []),
      ...(hasPublicAuthFailure ? [{ statusCode: 401, description: "Authentication credential or refresh token is invalid or expired." }, { statusCode: 403, description: "Account is not active." }] : []),
      ...((op.path.includes("{id}") || op.path.includes("{provider}")) ? [{ statusCode: 404, description: "Resource not found or not owned by the caller." }] : []),
      ...(hasConflict ? [{ statusCode: 409, description: "State conflict, duplicate resource, or concurrent transition." }] : []),
      ...(isRateLimitedAuth ? [{ statusCode: 429, description: "Authentication rate limit exceeded." }] : []),
    ],
  };
});
