# DermaCare AI Backend API & Postman Audit

Audit date: 2026-10-22  
Method: read-only static source/JSON inspection. No API, database, SMTP, Stripe, Cloudinary, Google, or AI calls were made. “Verified” below means statically verified unless explicitly stated otherwise.

## A. Executive summary

The collection has excellent route-level coverage of the operational API: all 124 collection requests map to real mounted method/path pairs. It is not yet reliably executable. Three request bodies are invalid, nine query examples contain invalid or unsupported parameters, one protected screening request has no authorization, two binary downloads are asserted as JSON, and the webhook example uses a fake signature while expecting success. Only the health request has a saved response example; the other 123 response contracts are undocumented.

The backend exposes 130 explicit HTTP endpoints: 124 operational endpoints represented in Postman plus six root/documentation endpoints. Swagger static assets under `/docs/swagger` are mounted middleware and are not counted as a single explicit endpoint. Source evidence: `src/app.ts`, `src/routes/index.ts`, every `*.routes.ts`, and `src/docs/docs.routes.ts`.

Critical risks:

- The repository does not currently typecheck because `src/shared/services/email.service.ts:59-70` contains unresolved merge-conflict markers. OTP/email behavior cannot be built or runtime-verified in this state.
- `Get Recommended Doctors for Screening` omits the required Patient bearer token even though `src/modules/screenings/screenings.routes.ts:20-21` authenticates and authorizes the whole router.
- The ordinary Postman webhook request cannot produce a valid Stripe signature. `src/app.ts:15-20` requires the original raw body and `src/modules/payments/services/payment-webhook.service.ts:36-42` verifies it cryptographically.
- Generic tests accept any of 200/201/204 and assert JSON for almost every request, masking exact-contract regressions and failing on the two document streams.

## B. Complete API inventory

Legend: `OK` = method/path/auth and sample input match; `REQ` = request mismatch; `AUTH` = authorization mismatch; `BIN` = binary response incorrectly tested as JSON; `NOEX` = no saved response example; `MISS` = absent from Postman. Roles shown are effective roles after all outer and inner guards.

| Method | Endpoint | Effective role | Backend | Postman | Request match | Response match | Status |
|---|---|---|---|---|---|---|---|
| GET | `/` | Public | Yes, 200 | No | — | — | MISS |
| GET | `/health` | Public | Yes, 200 | No | — | — | MISS |
| GET | `/api/v1/health` | Public | Yes, 200 | Yes | Yes | Saved example present | OK |
| GET | `/api/v1/openapi.json` | Public | Yes, 200 | No | — | — | MISS |
| GET | `/api/v1/openapi.yaml` | Public | Yes, file | No | — | — | MISS |
| GET | `/api/v1/inventory` | Public | Yes, 200 | No | — | — | MISS |
| GET | `/docs/health` | Public | Yes, 200 | No | — | — | MISS |
| POST | `/api/v1/auth/register/request-otp` | Public | Yes, 200 | Yes | Yes | NOEX | OK |
| POST | `/api/v1/auth/register/resend-otp` | Public | Yes, 200 | Yes | Yes | NOEX | OK |
| POST | `/api/v1/auth/register/verify-otp` | Public | Yes, 201 | Yes | Placeholder OTP | NOEX | PARTIAL |
| POST | `/api/v1/auth/register` | Public | Alias, 200 | Yes | Yes | NOEX | OK |
| POST | `/api/v1/auth/resend-otp` | Public | Alias, 200 | Yes | Yes | NOEX | OK |
| POST | `/api/v1/auth/verify-otp` | Public | Alias, 201 | Yes | Placeholder OTP | NOEX | PARTIAL |
| POST | `/api/v1/auth/login` | Public | Yes, 200 | Yes | Yes | NOEX | OK |
| POST | `/api/v1/auth/google` | Public | Yes, 200 | Yes | Placeholder token | NOEX | PARTIAL |
| POST | `/api/v1/auth/forgot-password/request-otp` | Public | Yes, 200 | Yes | Yes | NOEX | OK |
| POST | `/api/v1/auth/forgot-password/verify-otp` | Public | Yes, 200 | Yes | Placeholder OTP | NOEX | PARTIAL |
| POST | `/api/v1/auth/forgot-password/reset` | Public | Yes, 200 | Yes | Placeholder OTP | NOEX | PARTIAL |
| POST | `/api/v1/auth/forgot-password` | Public | Alias, 200 | Yes | Yes | NOEX | OK |
| POST | `/api/v1/auth/reset-password` | Public | Alias, 200 | Yes | Placeholder OTP | NOEX | PARTIAL |
| POST | `/api/v1/auth/refresh` | Public + refresh token | Yes, 200 | Yes | Yes | NOEX | OK |
| POST | `/api/v1/auth/refresh-token` | Public + refresh token | Alias, 200 | Yes | Yes | NOEX | OK |
| POST | `/api/v1/auth/logout` | Public + refresh token | Yes, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/auth/me` | Any authenticated | Yes, 200 | Yes | Yes | NOEX | OK |
| POST | `/api/v1/auth/identities/google` | Any authenticated | Yes, 200 | Yes | Placeholder token | NOEX | PARTIAL |
| DELETE | `/api/v1/auth/identities/:provider` | Any authenticated | Yes, 200 | Yes | `PASSWORD|GOOGLE` | NOEX | OK |
| GET | `/api/v1/users/me` | USER/PATIENT/DOCTOR/ADMIN | Yes, 200 | Yes | Yes | NOEX | OK |
| PATCH | `/api/v1/users/me` | USER/PATIENT/DOCTOR/ADMIN | Yes, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/patients/me/profile` | PATIENT | Yes, 200 | Yes | Yes | NOEX | OK |
| PATCH | `/api/v1/patients/me/profile` | PATIENT | Yes, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/patients/me/dashboard` | PATIENT | Yes, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/patients/me/medications` | PATIENT | Yes, 200 | Yes | Yes | NOEX | OK |
| POST | `/api/v1/patients/me/medications` | PATIENT | Yes, 201 | Yes | Yes | NOEX | OK |
| PATCH | `/api/v1/patients/me/medications/:id` | PATIENT owner | Yes, 200 | Yes | Yes | NOEX | OK |
| DELETE | `/api/v1/patients/me/medications/:id` | PATIENT owner | Yes, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/doctors` | Public | Yes, 200 | Yes | Empty UUID query | NOEX | REQ |
| GET | `/api/v1/doctors/:doctorId/slots` | Public | Yes, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/doctors/:doctorId` | Public | Yes, 200 | Yes | Yes | NOEX | OK |
| POST | `/api/v1/doctors/application/documents` | USER/PATIENT/DOCTOR | Yes, 201 multipart | Yes | Yes | NOEX | OK |
| POST | `/api/v1/doctors/application` | USER/PATIENT/DOCTOR | Yes, 201 | Yes | Dynamic key required | NOEX | PARTIAL |
| GET | `/api/v1/doctors/me/application-documents/:documentIndex` | USER/PATIENT/DOCTOR owner | Yes, binary 200 | Yes | Yes | JSON assertion wrong | BIN |
| GET | `/api/v1/doctors/me/profile` | USER/PATIENT/DOCTOR owner | Yes, 200 | Yes | Yes | NOEX | OK |
| PATCH | `/api/v1/doctors/me/profile` | Active approved DOCTOR | Yes, 200 | Yes | Yes | NOEX | OK |
| POST | `/api/v1/doctors/me/slots` | Active approved DOCTOR | Yes, 201 | Yes | Date must be future | NOEX | PARTIAL |
| GET | `/api/v1/doctors/me/slots` | Active approved DOCTOR | Yes, 200 | Yes | Yes | NOEX | OK |
| PATCH | `/api/v1/doctors/me/slots/:slotId` | DOCTOR owner | Yes, 200 | Yes | Yes | NOEX | OK |
| DELETE | `/api/v1/doctors/me/slots/:slotId` | DOCTOR owner | Yes, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/doctors/me/appointment-requests` | DOCTOR owner | Yes, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/doctors/me/appointments` | DOCTOR owner | Yes, 200 | Yes | Yes | NOEX | OK |
| PATCH | `/api/v1/doctors/me/appointments/:appointmentId/decision` | Assigned DOCTOR | Yes, 200 | Yes | Yes | NOEX | OK |
| PATCH | `/api/v1/doctors/me/appointments/:appointmentId/complete` | Assigned DOCTOR | Yes, 200 | Yes | Yes | NOEX | OK |
| POST | `/api/v1/doctors/me/medicine-requests` | DOCTOR | Yes, 201 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/doctors/me/medicine-requests` | DOCTOR owner | Yes, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/doctors/me/earnings/summary` | DOCTOR owner | Yes, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/doctors/me/earnings/history` | DOCTOR owner | Yes, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/doctors/me/payouts` | DOCTOR owner | Yes, 200 | Yes | Yes | NOEX | OK |
| POST | `/api/v1/appointments` | PATIENT | Yes, 201 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/patients/me/appointments` | PATIENT owner | Yes, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/patients/me/appointments/:id` | PATIENT owner | Yes, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/doctors/me/appointments/:id` | Assigned DOCTOR | Yes, 200 | Yes | Yes | NOEX | OK |
| POST | `/api/v1/appointments/:id/cancellation-request` | PATIENT owner | Yes, 200 | Yes | Role/name misleading | NOEX | PARTIAL |
| PATCH | `/api/v1/appointments/:id/cancellation` | Assigned DOCTOR | Yes, 200 | Yes | Uses `reason`, needs `reviewNotes` | NOEX | REQ |
| POST | `/api/v1/appointments/:id/cancel` | PATIENT/DOCTOR owner | Yes, 200 | Yes | Token role ambiguous | NOEX | PARTIAL |
| PATCH | `/api/v1/appointments/:id/no-show` | Assigned DOCTOR | Yes, 200 | Yes | Yes | NOEX | OK |
| POST | `/api/v1/appointments/:id/prescriptions` | Assigned DOCTOR | Yes, 201 | Yes | Yes | NOEX | OK |
| PATCH | `/api/v1/prescriptions/:id` | Owning DOCTOR | Yes, 200 | Yes | Yes | NOEX | OK |
| PUT | `/api/v1/prescriptions/:id/items` | Owning DOCTOR | Yes, 200 | Yes | Yes | NOEX | OK |
| POST | `/api/v1/prescriptions/:id/finalize` | Owning DOCTOR | Alias, 200 | Yes | Yes | NOEX | OK |
| POST | `/api/v1/prescriptions/:id/send` | Owning DOCTOR | Yes, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/patients/me/prescriptions` | PATIENT owner | Yes, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/patients/me/prescriptions/:id` | PATIENT owner | Yes, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/doctors/me/prescriptions` | DOCTOR owner | Yes, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/prescriptions` | PATIENT/DOCTOR (ADMIN blocked by outer guard) | Yes, 200 | Yes | Unsupported `status` query | NOEX | REQ |
| GET | `/api/v1/conversations/appointment/:appointmentId` | Appointment PATIENT/DOCTOR | Yes, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/conversations/:conversationId/messages` | Conversation member | Yes, 200 | Yes | Uses `page`; API uses `cursor` | NOEX | REQ |
| POST | `/api/v1/conversations/:conversationId/messages` | Conversation member | Yes, 201 | Yes | Uses `message`; API requires `content` | NOEX | REQ |
| POST | `/api/v1/screenings` | PATIENT | Yes, 201 | Yes | Yes | NOEX | OK |
| POST | `/api/v1/screenings/images` | PATIENT owner | Yes, 201 multipart | Yes | Yes | NOEX | OK |
| GET | `/api/v1/screenings/history` | PATIENT owner | Yes, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/screenings/history/:screeningId` | PATIENT owner | Yes, 200 | Yes | Yes | NOEX | OK |
| POST | `/api/v1/screenings/:screeningId/retry` | PATIENT owner | Yes, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/screenings/:screeningId/doctors` | PATIENT owner | Yes, 200 | Yes | Missing bearer token | NOEX | AUTH |
| GET | `/api/v1/medicines` | Public | Yes, 200 | Yes | Empty `search` invalid | NOEX | REQ |
| GET | `/api/v1/medicines/:id` | Public | Yes, 200 | Yes | Yes | NOEX | OK |
| POST | `/api/v1/orders` | PATIENT | Yes, 201 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/patients/me/orders` | PATIENT owner | Yes, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/patients/me/orders/:id` | PATIENT owner | Yes, 200 | Yes | Yes | NOEX | OK |
| POST | `/api/v1/appointments/:id/payments` | PATIENT owner | Demo only, 201 | Yes/disabled | Yes | NOEX | PARTIAL |
| GET | `/api/v1/appointments/:id/payments` | PATIENT owner | Yes, 200 | Yes | Yes | NOEX | OK |
| POST | `/api/v1/appointments/:id/payments/checkout` | PATIENT owner | Stripe, 201 | Yes | Yes | NOEX | OK |
| POST | `/api/v1/orders/:id/payments` | PATIENT owner | Demo only, 201 | Yes/disabled | Yes | NOEX | PARTIAL |
| GET | `/api/v1/orders/:id/payments` | PATIENT owner | Yes, 200 | Yes | Yes | NOEX | OK |
| POST | `/api/v1/orders/:id/payments/checkout` | PATIENT owner | Stripe, 201 | Yes | Yes | NOEX | OK |
| POST | `/api/v1/payments/stripe/webhook` | Signed Stripe | Yes, 200 | Yes | Fake signature cannot pass | NOEX | REQ |
| GET | `/api/v1/notifications/unread-count` | PATIENT/DOCTOR/ADMIN owner | Yes, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/notifications` | PATIENT/DOCTOR/ADMIN owner | Yes, 200 | Yes | Yes | NOEX | OK |
| PATCH | `/api/v1/notifications/read-all` | PATIENT/DOCTOR/ADMIN owner | Yes, 200 | Yes | Yes | NOEX | OK |
| PATCH | `/api/v1/notifications/:id/read` | PATIENT/DOCTOR/ADMIN owner | Yes, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/admin/dashboard` | Active ADMIN | Yes, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/admin/doctor-payments` | Active ADMIN | Yes, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/admin/doctor-payments/summary` | Active ADMIN | Yes, 200 | Yes | Yes | NOEX | OK |
| POST | `/api/v1/admin/doctor-payments/:id/send` | Active ADMIN | Stripe demo checkout, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/admin/doctor-payments/:id` | Active ADMIN | Yes, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/admin/doctors/earnings/summary` | Active ADMIN | Alias, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/admin/doctors/:doctorId/payable` | Active ADMIN | Yes, 200 | Yes | Yes | NOEX | OK |
| POST | `/api/v1/admin/doctors/:doctorId/payouts/generate` | Active ADMIN | 200/201 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/admin/orders` | Active ADMIN | Yes, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/admin/orders/:id` | Active ADMIN | Yes, 200 | Yes | Yes | NOEX | OK |
| PATCH | `/api/v1/admin/orders/:id/status` | Active ADMIN | Yes, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/admin/users` | Active ADMIN | Yes, 200 | Yes | Empty `search` invalid | NOEX | REQ |
| GET | `/api/v1/admin/users/:id` | Active ADMIN | Yes, 200 | Yes | Yes | NOEX | OK |
| PATCH | `/api/v1/admin/users/:id/status` | Active ADMIN | Yes, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/admin/doctors` | Active ADMIN | Yes, 200 | Yes | Empty filters invalid | NOEX | REQ |
| GET | `/api/v1/admin/doctors/:id/documents/:documentIndex` | Active ADMIN | Binary 200 | Yes | Yes | JSON assertion wrong | BIN |
| GET | `/api/v1/admin/doctors/:id` | Active ADMIN | Yes, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/admin/doctor-approvals` | Active ADMIN | Yes, 200 | Yes | Yes | NOEX | OK |
| POST | `/api/v1/admin/doctor-approvals/:id/approve` | Active ADMIN | Yes, 200 | Yes | Yes | NOEX | OK |
| POST | `/api/v1/admin/doctor-approvals/:id/reject` | Active ADMIN | Yes, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/admin/medicines` | Active ADMIN | Yes, 200 | Yes | Empty `search` invalid | NOEX | REQ |
| POST | `/api/v1/admin/medicines` | Active ADMIN | Yes, 201 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/admin/medicines/:id` | Active ADMIN | Yes, 200 | Yes | Yes | NOEX | OK |
| PATCH | `/api/v1/admin/medicines/:id` | Active ADMIN | Yes, 200 | Yes | Yes | NOEX | OK |
| DELETE | `/api/v1/admin/medicines/:id` | Active ADMIN | Soft deactivate, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/admin/appointments` | Active ADMIN | Yes, 200 | Yes | Empty UUID filters invalid | NOEX | REQ |
| GET | `/api/v1/admin/appointments/:id` | Active ADMIN | Yes, 200 | Yes | Yes | NOEX | OK |
| PATCH | `/api/v1/admin/appointments/:id/cancellation` | Active ADMIN | Yes, 200 | Yes | Uses `reason`, needs `reviewNotes` | NOEX | REQ |
| POST | `/api/v1/admin/appointments/:id/cancel` | Active ADMIN | Yes, 200 | Yes | Yes | NOEX | OK |
| PATCH | `/api/v1/admin/appointments/:id/no-show` | Active ADMIN | Yes, 200 | Yes | Yes | NOEX | OK |
| POST | `/api/v1/admin/appointments/:id/meeting/retry` | Active ADMIN | Yes, 200 | Yes | Yes | NOEX | OK |
| GET | `/api/v1/admin/audit-logs` | Active ADMIN | Yes, 200 | Yes | Empty typed filters invalid | NOEX | REQ |

## C. Detailed mismatch report

| Severity | Postman request | Actual implementation | Exact mismatch and correction | Evidence |
|---|---|---|---|---|
| CRITICAL | All OTP/email workflows | Build must parse email service before OTP dispatch can run | Unresolved `<<<<<<<`, `=======`, `>>>>>>>`; resolve source conflict, then typecheck and test delivery | `src/shared/services/email.service.ts:59-70` |
| HIGH | Screening doctor recommendations | Entire screening router requires authenticated PATIENT | Request has no Authorization header; add `Bearer {{patientToken}}` | `src/modules/screenings/screenings.routes.ts:20-21,51` |
| HIGH | Stripe Webhook | Raw body + authentic `stripe-signature` required | Environment contains fake signature and request expects success; disable generic success test and document Stripe CLI forwarding | `src/app.ts:15-20`; `src/modules/payments/controllers/payment-webhook.controller.ts:5-11` |
| HIGH | Decide Appointment Cancellation; Admin Cancellation Decision | Strict body is `{action, reviewNotes}` | Examples send `{action, reason}` and receive 400; rename field | `src/modules/appointments/appointments.validation.ts:51-55` |
| HIGH | Send Message | Strict body is `{content}` | Example sends `{message}` and receives validation error | `src/modules/conversations/conversations.validation.ts:16-18` |
| MEDIUM | Both Doctor document views | Response is `application/octet-stream` with attachment disposition | Generic `pm.response.to.be.json` fails; test content type/status and save response to file | `src/modules/doctors/controllers/doctor-profile.controller.ts:17-25`; `src/modules/admin/controllers/doctor-verification.controller.ts:28-38` |
| MEDIUM | List Doctors; public/admin medicine; admin users/doctors/appointments/audit | Empty query strings are still values and fail `.min(1)`, UUID, or date schemas | Remove disabled/empty parameters instead of sending `key=` | corresponding validation files; collection lines 1582, 4229, 5786, 5973, 6339, 6634, 6992 |
| MEDIUM | Get Messages | API supports `cursor` and `limit` | Example uses ignored `page`; use `cursor={{messageId}}&limit=50` | `src/modules/conversations/conversations.validation.ts:11-14` |
| MEDIUM | Role-filtered Prescriptions | Schema only supports `page` and `limit`; effective outer guard excludes ADMIN | `status=FINALIZED` is ignored/stripped; remove it or implement it. Do not document ADMIN access without remounting | `src/modules/prescriptions/prescriptions.validation.ts:37-40`; `src/routes/index.ts:42-47` |
| MEDIUM | Registration/password OTP examples | OTP is randomly generated, hashed, expiring, and single-use | `123456` is not labeled as a placeholder; add explicit placeholder warning and email prerequisite | `src/modules/auth/services/otp.service.ts:10-18,73-126` |
| MEDIUM | Collection-wide response documentation | Controllers have exact codes/envelopes | 123/124 requests have no saved response example; generic assertions accept wrong success codes | collection audit; controller files |
| MEDIUM | Login/token automation | One login writes one role token based on returned role | Collection has no separate Patient/Doctor/Admin login sequence, so running folders in order does not populate all tokens | collection Login test script; environment token variables |
| LOW | Request Cancellation name | Route permits PATIENT only at both outer and inner guards | Name says “Patient/Doctor”; rename to Patient | `src/modules/appointments/appointments.routes.ts:45-50`; `src/routes/index.ts:48-53` |
| LOW | Environment `documentReference` | Private key must be bound to applying user and match a no-dot storage-key grammar | Hardcoded value uses `doctorId` and ends `.jpg`; rely only on upload extraction | `src/modules/doctors/doctors.validation.ts:11-13`; `doctor-profile.service.ts` |
| LOW | Utility/documentation routes | Six explicit mounted routes exist | They are absent from Postman; add a clearly separated Diagnostics/Docs folder if desired | `src/app.ts:26-40`; `src/docs/docs.routes.ts:19-47` |

## D. Request and response contract review

Canonical JSON success shapes vary and must not be normalized in documentation without checking the controller:

```json
{ "success": true, "data": {} }
```

Some controllers add `statusCode`, `message`, or top-level `pagination`; health and webhook are exceptions. Document downloads are binary. The webhook returns `{ "received": true }`, not the normal envelope. Examples: `payment-verification.controller.ts` returns 201 with `success/statusCode/message/data`; prescription lists return `success/data/pagination`; `/api/v1/health` returns `{success,status}`.

Validation errors from `validateRequest` are 400 and use:

```json
{
  "success": false,
  "message": "Request validation failed",
  "errors": [{ "location": "body", "issues": [{ "path": "field", "message": "..." }] }]
}
```

Application errors use `{statusCode, success:false, message, data:null}` through `src/shared/errors/errorHandler.ts`. Implemented statuses include 400, 401, 403, 404, 409, 429, 500, 502, and 503. No general 422 contract was found. Multer errors may reach the generic 500 handler because invalid MIME types are plain `Error`, so Postman must not promise a stable 400 upload error until backend handling is standardized.

Corrected contract examples:

```json
// PATCH /api/v1/appointments/:id/cancellation
{ "action": "APPROVE", "reviewNotes": "Cancellation accepted." }

// POST /api/v1/conversations/:conversationId/messages
{ "content": "Hello Doctor, I have uploaded the latest photo." }
```

Document responses are binary (`application/octet-stream`, `Content-Disposition: attachment`, `Cache-Control: private, no-store`). Checkout creation returns HTTP 201 with `data.checkoutUrl`; redirects are frontend URLs and never prove payment. Doctor payout checkout returns HTTP 200 and remains `PROCESSING` until signed webhook verification.

## E. Business workflow documentation

### Authentication and profiles

1. Call registration OTP request with role PATIENT or DOCTOR and all three consents. SMTP/Gmail configuration determines actual delivery; a 200 only means the request workflow completed.
2. Obtain the real OTP from email and verify it. PATIENT becomes PATIENT; DOCTOR intent creates a USER (`auth.helpers.ts:74-77`) until Admin approval. Capture access/refresh tokens.
3. Refresh rotates the session token; logout revokes the refresh session. `/auth/me` and `/users/me` require access JWT. Password recovery is request → verify → reset using a real current OTP.

### Doctor application, documents, and slots

1. USER/PATIENT/DOCTOR uploads each private document as multipart field `image`; capture `data.documentReference`.
2. Submit `/doctors/application` with license, qualifications, fee, specialization IDs, and only owner-bound uploaded keys.
3. Admin lists pending applications and may stream documents by zero-based index, then approves (USER→DOCTOR) or rejects (→PATIENT).
4. Approved active Doctor updates profile and creates future non-overlapping UTC slots. Owner and Admin document reads stream through authenticated Cloudinary access; no permanent public URL is returned.

### Screening

PATIENT creates questionnaire → captures `screeningId` → uploads multipart `image` plus `screeningId` and `imageType` → inference updates predictions/status → history/report/retry/recommendations remain owner-only. The ONNX inference, seeded condition mapping, and Cloudinary download must all be configured; red flags influence safety guidance, not a medical diagnosis.

### Appointment, payment, consultation, prescription, chat

1. Patient discovers approved Doctor and available slot, then books it; the appointment is held/pending with a payment deadline.
2. Patient creates Stripe Checkout and redirects to `checkoutUrl`. Only a valid signed webhook can mark payment PAID and confirm the appointment; cleanup workers expire unpaid holds every minute.
3. Assigned Doctor accepts/rejects as permitted. Meeting provisioning runs asynchronously and Admin can retry it.
4. Meeting and conversation access are limited to appointment participants and lifecycle windows. Doctor completes a paid consultation only under completion rules.
5. Doctor creates/updates prescription items and finalizes/sends; Patient reads only their prescriptions. Conversation message pagination is cursor-based.
6. Patient cancellation request applies only to confirmed appointments; Doctor/Admin uses `{action,reviewNotes}`. Direct cancellation, no-show, refund staging, slot release, and audit transitions are state-dependent.

### Store, orders, and refunds

Public users list active medicines. PATIENT places an order from available stock, creates Stripe Checkout, and signed webhook confirmation moves it forward. Admin progresses valid order states and can cancel/refund. Inventory is reserved/restored transactionally by order state rules. Demo direct payment endpoints exist only when `ALLOW_DEMO_PAYMENTS=true` outside production and should remain disabled normally.

### Earnings and Doctor payouts

Completed, successfully paid, non-refunded consultations are aggregated by slot start UTC month. Existing earnings rules apply 15% platform commission and 85% Doctor share. Refund reconciliation removes eligible unpaid ledger items, blocks/reconciles in-flight payouts, and preserves PAID history. Admin generates one Doctor/month ledger, starts Stripe TEST Hosted Checkout for its exact amount, and signed webhook verification alone marks it PAID. This represents demo settlement, not Stripe Connect or a bank transfer. Doctors see only their earnings and payout ledger.

### Administration and notifications

All `/api/v1/admin/*` routes require ADMIN at the mount, and services additionally enforce active Admin where financial/sensitive operations require it. Admin dashboard, users, Doctors, applications/documents, appointments, orders, medicines, payouts, meeting retry, and audit logs are implemented. Notifications are owner-scoped for PATIENT/DOCTOR/ADMIN.

## F. Postman environment and automation review

- `baseUrl` is correct for the default `PORT=4000`; operational paths include `/api/v1` in each request.
- Required tokens exist, but only the generic Login script populates role tokens. Add three explicit login requests or instructions and do not let one role overwrite the workflow’s current token unexpectedly.
- UUID defaults are syntactically valid but fictional. They must never be described as executable fixtures; most are not dynamically extracted. Missing extraction includes Doctor profile/application ID, conversation ID, notification ID, payment IDs, and specialization discovery.
- `doctorApplicationId` is unused by actual approval paths, which require DoctorProfile `id`; clarify or rename it.
- `stripeSignature` is a fake, stale value and must not be used as proof. Remove it or mark it documentation-only.
- `documentReference` fallback is invalid under the current owner/key grammar and should be blank; upload should populate it.
- OTP `123456`, Google tokens, emails, and dated slot samples are placeholders. The slot date will become stale and fail the “future” validator.
- Empty query parameters must be disabled/removed. Postman sends them as empty strings, while strict validators reject them.
- Scripts should parse JSON only after checking content type. Binary streams and potential empty/file responses need tailored tests.
- No secrets were found populated in the environment; token fields are correctly typed `secret`.

## G. External integration requirements

| Integration | Implemented | Automated evidence | External E2E status / prerequisites |
|---|---|---|---|
| PostgreSQL/Prisma (Neon-compatible) | Prisma PG adapter uses `DATABASE_URL` | Unit tests plus opt-in DB integration tests | Not run; valid DB and applied migrations required |
| SMTP/Gmail OAuth2 | OTP mail service and configuration schema exist | OTP logic tests; DB integration opt-in | Not verified; source currently blocked by merge markers; 200 is not delivery proof |
| Stripe Checkout/refunds/webhooks | Appointment, order, and demo payout flows implemented | Signature, amount, replay, payout, late-payment, refund tests exist | No external call made; use Stripe test key, webhook secret, and CLI forwarding |
| Cloudinary | Authenticated uploads and signed server-side downloads | Static implementation inspected | Not externally verified; all three Cloudinary variables required together |
| Google Meet | Calendar event provisioning worker with retry | Meeting provisioning tests exist | Not externally verified; OAuth client/secret/redirect/refresh token/calendar required |
| AI inference | ONNX inference and condition mapping integrated | Screening safety/label tests exist | Model runtime and seeded conditions not externally verified |

Correct Stripe CLI procedure: run the API locally, use Stripe test-mode credentials, then `stripe listen --forward-to localhost:4000/api/v1/payments/stripe/webhook`; use the CLI-provided `whsec_...` as `STRIPE_WEBHOOK_SECRET` and trigger/complete a real test Checkout Session. A copied JSON body, invented event ID, or fake `stripe-signature` in Postman is expected to fail verification.

## H. Coverage summary

| Metric | Result |
|---|---:|
| Explicit mounted backend endpoints | 130 |
| Operational endpoints under collection scope | 124 |
| Postman requests | 124 |
| Exact method/path matches | 124 |
| Missing operational endpoints | 0 |
| Missing root/docs utility endpoints | 6 |
| Extra/nonexistent Postman endpoints | 0 |
| Requests with invalid bodies | 3 |
| Requests with invalid/unsupported query examples | 9 |
| Requests with wrong/missing authorization | 1 definite; 3 role-ambiguous |
| Binary requests with broken JSON assertions | 2 |
| Requests without saved response examples | 123 |
| Structurally broken webhook test | 1 |
| Operational route coverage | 100% (124/124) |
| Full explicit-route coverage | 95.4% (124/130) |
| Runtime-tested by this audit | 0 |

Static checks: both Postman JSON files parse successfully. TypeScript `tsc --noEmit` failed solely at the encountered merge markers in `src/shared/services/email.service.ts:59,68,70`; no source was changed.

## I. Prioritized fix plan

1. Resolve the email-service merge conflict, then run typecheck and focused auth/OTP tests.
2. Fix the three invalid bodies, screening Authorization header, empty query parameters, cursor pagination, and binary-response tests.
3. Replace broad success assertions with exact per-controller status/envelope assertions; add saved 2xx and principal error examples for all requests.
4. Split role login/setup into Patient, Doctor-applicant, approved Doctor, and Admin workflows; dynamically capture every dependent ID and explain approval prerequisites.
5. Mark OTP/Google values as placeholders, remove fake Stripe signature automation, and add the Stripe CLI workflow.
6. Optionally add a Diagnostics/Docs folder for the six mounted utility endpoints, kept separate from business workflows.
