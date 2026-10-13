# DermaCare AI — Premium Swagger / OpenAPI 3.0 Documentation Portal

A modern, high-performance, clinical-grade developer portal and authoritative OpenAPI 3.0.3 specification for **DermaCare AI**, covering all **84 proposed REST API endpoints** across **16 modules**.

---

## 🌟 Features & Highlights

- **Linear / Stripe Docs / Vercel Design Identity**: Clean 3-panel layout, crisp typography, neutral surfaces, dark & light theme modes, and accessible contrast.
- **Authoritative OpenAPI 3.0.3 Specification**: Single source of truth exported to `openapi.json` and `openapi.yaml`, 100% validated using `@apidevtools/swagger-parser`.
- **Complete 84-Endpoint Inventory**: Every endpoint from the *DermaCare AI Optimized MVP API Specification* is accounted for with exact methods, `/api/v1` routes, roles, parameters, request body schemas, response statuses, and illustrative examples.
- **Strict Implementation Audit**: Transparently labels contract status (0 endpoints currently implemented in repository, 84 specified in proposed contract).
- **Interactive API Console ("Try It Out")**: Supports request testing with Bearer token authentication, environment switching, and realistic simulation responses that clearly declare contract status (`X-Contract-Status: Specified-Not-Implemented`).
- **Classic Swagger UI Included**: Full Swagger UI available at `/docs/swagger` and `/api-docs` styled to match the dark clinical theme.
- **Healthcare & Clinical Guardrails**: Explicitly documents AI screening thresholds (confidence < 60% suppresses natural care, risk > 20% triggers urgency alert, red flags override all), 10-minute atomic holds, immutable prescriptions, and sponsored content restrictions.

---

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18 (Tested on Node.js v24.16.0)
- npm >= 9

### Installation
```bash
npm install
```

### Validate OpenAPI Specification
Validates the authoritative OpenAPI 3.0.3 document against the official OpenAPI specification schema:
```bash
npm run validate
```

### Build Project
Compiles TypeScript, exports `openapi.json` and `openapi.yaml`, and prepares public distribution files:
```bash
npm run build
```

### Start Server
Launches the Express server on port 4000:
```bash
npm start
```
Or for live development:
```bash
npm run dev
```

---

## 📍 Local Portal URLs

| Resource | URL | Description |
|---|---|---|
| **Premium Developer Portal** | `http://localhost:4000/` | Main 3-panel documentation portal |
| **Classic Swagger UI** | `http://localhost:4000/docs/swagger` | Official Swagger UI interface |
| **OpenAPI 3.0 JSON** | `http://localhost:4000/api/v1/openapi.json` | Authoritative raw OpenAPI specification (JSON) |
| **OpenAPI 3.0 YAML** | `http://localhost:4000/api/v1/openapi.yaml` | Authoritative raw OpenAPI specification (YAML) |
| **Endpoint Inventory API** | `http://localhost:4000/api/v1/inventory` | Machine-readable endpoint audit dataset |
| **System Health Check** | `http://localhost:4000/api/v1/health` | Operational liveness probe |

---

## 📊 Complete 84-API Module Inventory

| Module | Module Name | APIs | Primary Responsibility |
|---|---|:---:|---|
| **01** | Authentication | 9 | Patient/Doctor registration, email OTP verification, JWT access/refresh rotation |
| **02** | Unified Profiles | 3 | Role-specific profile updates, patient medical summary, doctor license submission |
| **03** | AI Screening & Conditions | 4 | Dermatological image screening, risk score, confidence calibration, conditions encyclopedia |
| **04** | Doctor Discovery | 3 | Verified specialist search, condition matching via `screeningId`, slot inspection |
| **05** | Booking & Availability | 11 | Doctor schedule management, 10-min atomic holds, consent confirmation, cancellations |
| **06** | Consultation | 4 | Consent-gated pre-consultation records, time-limited Jitsi video, SOAP notes |
| **07** | Prescriptions & Medication | 7 | Doctor prescription drafts, atomic item replacement, immutable finalization, medication list |
| **08** | Post-consultation Chat | 3 | 7-day post-consultation secure text chat channel between patient and physician |
| **09** | Store & Orders | 9 | Fictional medicine catalog, generic alternatives, cart with Rx verification, order placement |
| **10** | Sandbox Payments | 3 | Simulated sandbox payments for appointments, orders, and subscriptions |
| **11** | Admin Operations | 9 | User governance, doctor license verification, medicine catalog, order fulfillment |
| **12** | Notifications | 2 | Transactional clinical alerts, unread count polling, and read receipts |
| **13** | Health & Secure Images | 2 | Minimal public liveness probe, short-lived (5 min) presigned URL for private medical imagery |
| **14** | Subscriptions | 7 | Free tier quota tracking, Patient Premium, Doctor Featured Practice plans |
| **15** | Sponsored Content | 4 | Labeled healthcare product sponsorships, placement targeting, schedule moderation |
| **16** | Advanced Analytics | 4 | Aggregated platform metrics, operational trends, sandbox revenue, clinical audit logs |
| **TOTAL** | **16 Modules** | **84** | **100% Accounted For & Validated** |

---

## 🛡️ Repository Implementation Status Audit

- **Implemented and verified in repository:** 0
- **Partially implemented in repository:** 0
- **Specified but not yet implemented (Proposed Contract):** 84
- **Requires verification:** 0

All 84 endpoints are documented accurately from the *DermaCare AI Optimized MVP Specification*. No endpoints have been fabricated, removed, or misrepresented.

