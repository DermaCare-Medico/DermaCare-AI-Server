import { ALL_ENDPOINTS } from './endpoints/index.js';
import { ACTIVE_ENDPOINTS } from './active-endpoints.js';
import { MODULES } from './modules-data.js';

export function generateOpenApiSpec() {
  const paths: Record<string, any> = {};

  for (const ep of ACTIVE_ENDPOINTS) {
    if (!paths[ep.path]) {
      paths[ep.path] = {};
    }

    const methodKey = ep.method.toLowerCase();

    // Map parameters
    const parameters: any[] = [];
    if (ep.parameters) {
      for (const p of ep.parameters) {
        parameters.push({
          name: p.name,
          in: p.in,
          required: p.required,
          description: p.description,
          schema: {
            type: p.type,
            ...(p.enum ? { enum: p.enum } : {}),
            ...(p.example !== undefined ? { example: p.example } : {})
          }
        });
      }
    }

    // Map request body
    let requestBody: any = undefined;
    if (ep.requestBody) {
      requestBody = {
        description: ep.requestBody.description,
        required: ep.requestBody.required,
        content: {
          [ep.requestBody.contentType]: {
            schema: ep.requestBody.schema,
            example: ep.requestBody.example
          }
        }
      };
    }

    // Map responses
    const responses: Record<string, any> = {};
    for (const res of ep.responses) {
      responses[String(res.statusCode)] = {
        description: res.description,
        content: {
          'application/json': {
            schema: res.schema || {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: { type: 'object' }
              }
            },
            example: res.example
          }
        }
      };
    }

    // Default error responses if not explicitly specified
    if (!responses['400']) {
      responses['400'] = {
        description: 'Validation error or invalid request format.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: { success: false, error: { code: 'INVALID_REQUEST', message: 'The request payload is invalid or malformed.' } }
          }
        }
      };
    }
    if (ep.authRequired && !responses['401']) {
      responses['401'] = {
        description: 'Unauthorized; missing, invalid, or expired session token.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication credentials are required.' } }
          }
        }
      };
    }
    if (ep.roles.length > 0 && !ep.roles.includes('PUBLIC') && !responses['403']) {
      responses['403'] = {
        description: 'Forbidden; caller lacks necessary role or ownership authorization.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to perform this action.' } }
          }
        }
      };
    }

    // Map security
    const security: any[] = [];
    if (ep.authRequired) {
      if (ep.authType.includes('BearerAuth')) {
        security.push({ BearerAuth: [] });
      }
      if (ep.authType.includes('CookieAuth')) {
        security.push({ CookieAuth: [] });
      }
    }

    // Operation Object
    paths[ep.path][methodKey] = {
      operationId: `${ep.method.toLowerCase()}_${ep.path.replace(/[^a-zA-Z0-9]/g, '_')}_${ep.id}`,
      summary: ep.summary,
      description: `${ep.description}\n\n**Healthcare & Business Constraints:**\n${ep.businessRules.map(r => `- ${r}`).join('\n')}\n\n*Contract Status:* **${ep.implementationStatus}**`,
      tags: [ep.moduleName],
      ...(parameters.length > 0 ? { parameters } : {}),
      ...(requestBody ? { requestBody } : {}),
      responses,
      ...(security.length > 0 ? { security } : []),
      // Custom OpenAPI Extensions
      'x-endpoint-id': ep.id,
      'x-module-number': ep.moduleNumber,
      'x-authorized-roles': ep.roles,
      'x-implementation-status': ep.implementationStatus,
      'x-business-rules': ep.businessRules,
      'x-related-endpoints': ep.relatedEndpointIds || []
    };
  }

  const tags = MODULES.map(m => ({
    name: m.name,
    description: `**Module ${m.number}** — ${m.description}`,
    'x-module-number': m.number
  }));

  return {
    openapi: '3.0.3',
    info: {
      title: 'DermaCare AI API Reference',
      version: '1.0.0',
      description: `
# DermaCare AI — Implemented REST API

This document contains only operations mounted by the current Express application. Proposal-era contracts are excluded from active paths and retained separately in inventory metadata.

### Key Scope & Architecture:
- **AI Skin Screening**: Image analysis, differential findings, confidence calibration, and emergency red-flag safeguards.
- **Doctor Discovery & Booking**: Verified dermatologists, condition matching, atomic 10-minute slot holds, and scheduling.
- **Telemedicine & Consultations**: Consent-gated clinical records, time-limited Jitsi video, and SOAP note authoring.
- **Prescriptions & Digital Pharmacy**: Immutable prescription versioning, generic matching, and Rx-verified ordering.
- **Post-Consultation Chat**: Secure 7-day text messaging channel between patient and treating physician.
- **Sandbox Financials**: Simulated payments, subscription tiers (Free, Patient Premium, Doctor Featured), and order fulfillment.

---

### Non-Negotiable Healthcare Safety Rules:
1. **Preliminary AI Advisory**: AI screening results are strictly preliminary. Confidence below 60% suppresses OTC recommendations; high-risk scores above 20% trigger clinical urgency warnings; red flags override all outputs.
2. **Strict RBAC & Consent**: Never trust client-supplied \`role\` or \`userId\`. Pre-consultation patient records are accessible ONLY to the booked doctor after explicit patient consent.
3. **Atomic Slot Reservation**: Slot holds last exactly 10 minutes to eliminate double-booking.
4. **Prescription Immutability**: Finalizing a prescription freezes that legal version. Amendments create new versions.
5. **Separation of Sponsored Content**: Advertisements must be labeled "Sponsored" and MUST NEVER appear on AI results, emergency alerts, consultations, prescriptions, or chats.

---
> **Implementation Status:** ${ACTIVE_ENDPOINTS.length} mounted operations are documented. Proposal-era operations are not advertised as callable APIs.
      `.trim(),
      contact: {
        name: 'DermaCare AI Developer Team',
        email: 'api-support@dermacare.ai',
        url: 'https://dermacare.ai'
      },
      license: {
        name: 'Proprietary - DermaCare AI Health Systems',
        url: 'https://dermacare.ai/terms'
      }
    },
    servers: [
      {
        url: 'http://localhost:4000/api/v1',
        description: 'Local Development Server (Default)'
      },
      {
        url: 'https://sandbox.api.dermacare.ai/api/v1',
        description: 'Proposed Staging Sandbox Server'
      }
    ],
    tags,
    paths,
    'x-proposed-operations': ALL_ENDPOINTS.map(({ method, path, summary, moduleName }) => ({ method, path, summary, moduleName })),
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Short-lived JWT access token issued upon login (15 min validity). Header: `Authorization: Bearer <token>`'
        },
        CookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'refreshToken',
          description: 'HTTP-only Secure cookie storing the refresh token with automatic rotation (7 days validity).'
        }
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          required: ['statusCode', 'success', 'message', 'data'],
          properties: {
            statusCode: { type: 'integer', example: 400 },
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'The request is invalid.' },
            data: { nullable: true, example: null }
          }
        },
        SuccessResponse: {
          type: 'object',
          required: ['success'],
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Operation completed successfully.' },
            data: { type: 'object' }
          }
        },
        UserProfile: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'usr_9f8e7d6c5b' },
            email: { type: 'string', example: 'patient.jane@example.com' },
            role: { type: 'string', enum: ['PATIENT', 'DOCTOR', 'ADMIN'], example: 'PATIENT' },
            name: { type: 'string', example: 'Jane Doe' },
            status: { type: 'string', enum: ['ACTIVE', 'PENDING_VERIFICATION', 'SUSPENDED'], example: 'ACTIVE' }
          }
        },
        ScreeningSummary: {
          type: 'object',
          properties: {
            screeningId: { type: 'string', example: 'scr_9918274a' },
            bodyPart: { type: 'string', example: 'ARM' },
            detectedCondition: { type: 'string', example: 'Atopic Dermatitis' },
            confidenceScore: { type: 'number', example: 0.84 },
            riskLevel: { type: 'string', enum: ['LOW', 'MODERATE', 'HIGH'], example: 'LOW' },
            redFlagDetected: { type: 'boolean', example: false }
          }
        },
        AppointmentSummary: {
          type: 'object',
          properties: {
            appointmentId: { type: 'string', example: 'apt_55102' },
            doctorId: { type: 'string', example: 'doc_44120' },
            patientId: { type: 'string', example: 'usr_9f8e7d6c5b' },
            status: { type: 'string', enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], example: 'SCHEDULED' },
            scheduledTime: { type: 'string', format: 'date-time', example: '2026-10-15T09:30:00Z' }
          }
        },
        PrescriptionItem: {
          type: 'object',
          required: ['medicineName', 'dosage', 'frequency', 'durationDays'],
          properties: {
            medicineName: { type: 'string', example: 'Hydrocortisone 1% Cream' },
            dosage: { type: 'string', example: 'Thin layer' },
            frequency: { type: 'string', example: 'Twice daily' },
            durationDays: { type: 'integer', example: 7 },
            instructions: { type: 'string', example: 'Apply after cleansing' }
          }
        }
      }
    }
  };
}

