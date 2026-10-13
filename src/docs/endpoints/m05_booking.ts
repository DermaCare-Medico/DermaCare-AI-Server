import { EndpointSpec } from '../spec-types';

export const BOOKING_ENDPOINTS: EndpointSpec[] = [
  {
    id: 20,
    method: 'POST',
    path: '/doctors/me/slots',
    moduleNumber: '05',
    moduleName: 'Booking & Availability',
    summary: 'Create available time slot',
    description: 'Creates a new consultation availability slot for the authenticated doctor. Prevents overlapping slots with unique constraints.',
    roles: ['DOCTOR'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Caller must be an approved doctor.',
      'Slot startTime must be in the future and endTime must be after startTime.',
      'Unique constraint prevents overlapping slots for the same doctor.'
    ],
    requestBody: {
      description: 'Slot time window and consultation fee override.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        required: ['startTime', 'endTime'],
        properties: {
          startTime: { type: 'string', format: 'date-time', description: 'Slot start ISO timestamp', example: '2026-10-15T09:30:00Z' },
          endTime: { type: 'string', format: 'date-time', description: 'Slot end ISO timestamp', example: '2026-10-15T10:00:00Z' },
          fee: { type: 'number', description: 'Optional fee override for this slot', example: 75.0 }
        }
      },
      example: {
        startTime: '2026-10-15T09:30:00Z',
        endTime: '2026-10-15T10:00:00Z',
        fee: 75.0
      }
    },
    responses: [
      {
        statusCode: 201,
        description: 'Slot created successfully.',
        example: {
          success: true,
          data: {
            id: 'slt_1001',
            doctorId: 'doc_44120',
            startTime: '2026-10-15T09:30:00Z',
            endTime: '2026-10-15T10:00:00Z',
            status: 'AVAILABLE'
          }
        }
      },
      {
        statusCode: 409,
        description: 'Slot overlaps with an existing slot.',
        example: {
          success: false,
          error: { code: 'SLOT_OVERLAP', message: 'You already have an availability slot during this time.' }
        }
      }
    ],
    relatedEndpointIds: [21, 22, 19]
  },
  {
    id: 21,
    method: 'PATCH',
    path: '/doctors/me/slots/{id}',
    moduleNumber: '05',
    moduleName: 'Booking & Availability',
    summary: 'Modify slot if not reserved',
    description: 'Modifies an existing slot schedule. Prohibited if the slot is currently reserved, held, or booked.',
    roles: ['DOCTOR'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Slot modification is rejected if status is HELD or BOOKED.',
      'Doctor must own the slot.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Slot ID', example: 'slt_1001' }
    ],
    requestBody: {
      description: 'Updated slot timestamps.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        properties: {
          startTime: { type: 'string', format: 'date-time', example: '2026-10-15T09:45:00Z' },
          endTime: { type: 'string', format: 'date-time', example: '2026-10-15T10:15:00Z' }
        }
      },
      example: {
        startTime: '2026-10-15T09:45:00Z',
        endTime: '2026-10-15T10:15:00Z'
      }
    },
    responses: [
      {
        statusCode: 200,
        description: 'Slot modified successfully.',
        example: {
          success: true,
          data: {
            id: 'slt_1001',
            startTime: '2026-10-15T09:45:00Z',
            endTime: '2026-10-15T10:15:00Z',
            status: 'AVAILABLE'
          }
        }
      },
      {
        statusCode: 400,
        description: 'Slot is already held or booked.',
        example: {
          success: false,
          error: { code: 'SLOT_RESERVED', message: 'Cannot modify a slot that is currently held or booked.' }
        }
      }
    ],
    relatedEndpointIds: [20, 22]
  },
  {
    id: 22,
    method: 'DELETE',
    path: '/doctors/me/slots/{id}',
    moduleNumber: '05',
    moduleName: 'Booking & Availability',
    summary: 'Remove unbooked slot',
    description: 'Deletes an unbooked availability slot from the doctor calendar.',
    roles: ['DOCTOR'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Slot cannot be deleted if in HELD or BOOKED status.',
      'Only the slot owner doctor can delete.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Slot ID', example: 'slt_1001' }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Slot deleted successfully.',
        example: {
          success: true,
          message: 'Slot removed from schedule.'
        }
      },
      {
        statusCode: 400,
        description: 'Cannot delete held or booked slot.',
        example: {
          success: false,
          error: { code: 'SLOT_NOT_AVAILABLE', message: 'Cannot delete slot with active reservation.' }
        }
      }
    ],
    relatedEndpointIds: [20, 21]
  },
  {
    id: 23,
    method: 'POST',
    path: '/appointments/holds',
    moduleNumber: '05',
    moduleName: 'Booking & Availability',
    summary: 'Atomically hold a slot for 10 minutes',
    description: 'Places a temporary atomic lock on an available time slot for exactly 10 minutes while the patient completes consent and sandbox payment.',
    roles: ['PATIENT'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Atomic Prisma/database transaction ensures no two users can hold the same slot.',
      'Hold expires automatically in exactly 10 minutes (600 seconds).',
      'Free user quota: Maximum 2 completed bookings per month; holds respect quota.'
    ],
    requestBody: {
      description: 'Slot identifier to place on temporary hold.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        required: ['slotId'],
        properties: {
          slotId: { type: 'string', description: 'Doctor slot ID to lock', example: 'slt_1001' }
        }
      },
      example: {
        slotId: 'slt_1001'
      }
    },
    responses: [
      {
        statusCode: 201,
        description: 'Slot held successfully for 10 minutes.',
        example: {
          success: true,
          data: {
            holdId: 'hld_882031a',
            slotId: 'slt_1001',
            heldUntil: '2026-10-13T10:52:00Z',
            expiresInSeconds: 600
          }
        }
      },
      {
        statusCode: 409,
        description: 'Slot already held or booked by another patient.',
        example: {
          success: false,
          error: { code: 'SLOT_ALREADY_HELD', message: 'This slot is currently held by another user. Try again shortly.' }
        }
      }
    ],
    relatedEndpointIds: [24, 54]
  },
  {
    id: 24,
    method: 'POST',
    path: '/appointments',
    moduleNumber: '05',
    moduleName: 'Booking & Availability',
    summary: 'Confirm booking with consent and payment state',
    description: 'Finalizes the appointment booking from an active hold. Requires explicit patient consent for sharing preliminary screening medical data and links the sandbox payment record.',
    roles: ['PATIENT'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Hold must be active and not expired.',
      'Patient consent checkbox is MANDATORY: authorizes the booked doctor to view pre-consultation medical history.',
      'Transitions slot to BOOKED status atomically.'
    ],
    requestBody: {
      description: 'Hold ID, consent confirmation, and optional screening linkage.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        required: ['holdId', 'patientConsentGiven', 'paymentId'],
        properties: {
          holdId: { type: 'string', description: 'Active 10-minute hold identifier', example: 'hld_882031a' },
          patientConsentGiven: { type: 'boolean', description: 'Explicit consent granting doctor clinical data access', example: true },
          paymentId: { type: 'string', description: 'Verified sandbox payment identifier', example: 'pay_992147' },
          screeningId: { type: 'string', description: 'Optional AI screening to attach for doctor review', example: 'scr_9918274a' },
          patientNotes: { type: 'string', description: 'Optional chief complaint description', example: 'Worsening rash on forearm' }
        }
      },
      example: {
        holdId: 'hld_882031a',
        patientConsentGiven: true,
        paymentId: 'pay_992147',
        screeningId: 'scr_9918274a',
        patientNotes: 'Worsening rash on forearm'
      }
    },
    responses: [
      {
        statusCode: 201,
        description: 'Appointment confirmed and scheduled.',
        example: {
          success: true,
          data: {
            appointmentId: 'apt_55102',
            doctorId: 'doc_44120',
            patientId: 'usr_9f8e7d6c5b',
            status: 'SCHEDULED',
            scheduledTime: '2026-10-15T09:30:00Z',
            consentRecorded: true,
            createdAt: '2026-10-13T10:45:00Z'
          }
        }
      },
      {
        statusCode: 400,
        description: 'Hold expired or consent missing.',
        example: {
          success: false,
          error: { code: 'CONSENT_REQUIRED', message: 'Explicit patient consent is required to confirm booking.' }
        }
      }
    ],
    relatedEndpointIds: [23, 26, 31, 54]
  },
  {
    id: 25,
    method: 'GET',
    path: '/appointments',
    moduleNumber: '05',
    moduleName: 'Booking & Availability',
    summary: 'Role-scoped list; patient, doctor, admin filtering',
    description: 'Returns a list of appointments scoped to the caller role. Patients see their own bookings, doctors see their schedule, and admins see all appointments with filtering.',
    roles: ['PATIENT', 'DOCTOR', 'ADMIN'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Role scoping: Patients cannot query other patients; doctors cannot query appointments of other doctors.',
      'Supports filtering by status (SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED).'
    ],
    parameters: [
      { name: 'status', in: 'query', required: false, type: 'string', enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], example: 'SCHEDULED' },
      { name: 'page', in: 'query', required: false, type: 'integer', example: 1 },
      { name: 'limit', in: 'query', required: false, type: 'integer', example: 10 }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'List of role-scoped appointments.',
        example: {
          success: true,
          data: {
            appointments: [
              {
                id: 'apt_55102',
                doctorId: 'doc_44120',
                doctorName: 'Dr. Robert Chen, MD',
                patientId: 'usr_9f8e7d6c5b',
                patientName: 'Jane Doe',
                scheduledTime: '2026-10-15T09:30:00Z',
                status: 'SCHEDULED'
              }
            ],
            pagination: { page: 1, limit: 10, totalCount: 1, totalPages: 1 }
          }
        }
      }
    ],
    relatedEndpointIds: [24, 26, 30]
  },
  {
    id: 26,
    method: 'GET',
    path: '/appointments/{id}',
    moduleNumber: '05',
    moduleName: 'Booking & Availability',
    summary: 'Authorized appointment details',
    description: 'Retrieves comprehensive details of a single appointment including participants, consultation status, and consent flags.',
    roles: ['PATIENT', 'DOCTOR', 'ADMIN'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Ownership enforcement: caller must be the booked patient, assigned doctor, or an admin.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Appointment ID', example: 'apt_55102' }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Appointment details.',
        example: {
          success: true,
          data: {
            id: 'apt_55102',
            status: 'SCHEDULED',
            scheduledTime: '2026-10-15T09:30:00Z',
            doctor: { id: 'doc_44120', name: 'Dr. Robert Chen, MD' },
            patient: { id: 'usr_9f8e7d6c5b', name: 'Jane Doe' },
            consentRecorded: true,
            hasScreeningAttached: true,
            screeningId: 'scr_9918274a'
          }
        }
      },
      {
        statusCode: 403,
        description: 'Forbidden; caller is not authorized for this appointment.',
        example: {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Not authorized to view this appointment.' }
        }
      }
    ],
    relatedEndpointIds: [24, 25, 31, 32]
  },
  {
    id: 27,
    method: 'POST',
    path: '/appointments/{id}/cancellation-request',
    moduleNumber: '05',
    moduleName: 'Booking & Availability',
    summary: 'Patient requests cancellation',
    description: 'Submits a cancellation request from the patient for an upcoming appointment. Requires subsequent doctor or admin review.',
    roles: ['PATIENT'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Only the booked patient can submit a cancellation request.',
      'Appointment must be in SCHEDULED status.',
      'Transitions appointment status to CANCELLATION_REQUESTED.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Appointment ID', example: 'apt_55102' }
    ],
    requestBody: {
      description: 'Reason for cancellation request.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        required: ['reason'],
        properties: {
          reason: { type: 'string', description: 'Reason for cancellation', example: 'Schedule conflict with work.' }
        }
      },
      example: {
        reason: 'Schedule conflict with work.'
      }
    },
    responses: [
      {
        statusCode: 200,
        description: 'Cancellation request submitted.',
        example: {
          success: true,
          message: 'Cancellation request submitted for clinical review.',
          data: { status: 'CANCELLATION_REQUESTED' }
        }
      }
    ],
    relatedEndpointIds: [28, 29]
  },
  {
    id: 28,
    method: 'PATCH',
    path: '/appointments/{id}/cancellation',
    moduleNumber: '05',
    moduleName: 'Booking & Availability',
    summary: 'Doctor/admin approve or reject request',
    description: 'Allows the assigned doctor or an admin to approve or reject a pending patient cancellation request with an explanation.',
    roles: ['DOCTOR', 'ADMIN'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Single PATCH state transition endpoint: merges approve and reject into one route.',
      'Enforces allowed transitions, permissions, reason fields, and creates an audit record.',
      'If approved, frees up slot or flags for refund according to sandbox policy.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Appointment ID', example: 'apt_55102' }
    ],
    requestBody: {
      description: 'Decision (APPROVE or REJECT) and review notes.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        required: ['action', 'reviewNotes'],
        properties: {
          action: { type: 'string', enum: ['APPROVE', 'REJECT'], description: 'Review action', example: 'APPROVE' },
          reviewNotes: { type: 'string', description: 'Clinical or administrative explanation', example: 'Approved within 24h notice window.' }
        }
      },
      example: {
        action: 'APPROVE',
        reviewNotes: 'Approved within 24h notice window.'
      }
    },
    responses: [
      {
        statusCode: 200,
        description: 'Cancellation decision recorded.',
        example: {
          success: true,
          data: {
            appointmentId: 'apt_55102',
            status: 'CANCELLED',
            decision: 'APPROVE',
            reviewedAt: '2026-10-13T10:46:00Z'
          }
        }
      }
    ],
    relatedEndpointIds: [27, 29]
  },
  {
    id: 29,
    method: 'POST',
    path: '/appointments/{id}/cancel',
    moduleNumber: '05',
    moduleName: 'Booking & Availability',
    summary: 'Doctor/admin direct cancellation',
    description: 'Enables a doctor (e.g. emergency unavailability) or administrator to cancel an appointment directly without prior request.',
    roles: ['DOCTOR', 'ADMIN'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Doctor can only cancel their own appointments; Admin can cancel any appointment.',
      'Triggers automated notification event to the patient.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Appointment ID', example: 'apt_55102' }
    ],
    requestBody: {
      description: 'Direct cancellation reason.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        required: ['reason'],
        properties: {
          reason: { type: 'string', description: 'Reason for cancellation', example: 'Clinical emergency call' }
        }
      },
      example: {
        reason: 'Clinical emergency call'
      }
    },
    responses: [
      {
        statusCode: 200,
        description: 'Appointment cancelled.',
        example: {
          success: true,
          message: 'Appointment directly cancelled and patient notified.',
          data: { appointmentId: 'apt_55102', status: 'CANCELLED' }
        }
      }
    ],
    relatedEndpointIds: [27, 28]
  },
  {
    id: 30,
    method: 'GET',
    path: '/admin/appointments',
    moduleNumber: '05',
    moduleName: 'Booking & Availability',
    summary: 'Admin monitoring with filters and pagination',
    description: 'Provides administrative monitoring across all appointments in the system with comprehensive doctor, patient, date-range, and status filters.',
    roles: ['ADMIN'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Strictly restricted to users with ADMIN role.',
      'Provides global view of scheduling throughput.'
    ],
    parameters: [
      { name: 'doctorId', in: 'query', required: false, type: 'string', example: 'doc_44120' },
      { name: 'status', in: 'query', required: false, type: 'string', example: 'SCHEDULED' },
      { name: 'startDate', in: 'query', required: false, type: 'string', example: '2026-10-01' },
      { name: 'endDate', in: 'query', required: false, type: 'string', example: '2026-10-31' },
      { name: 'page', in: 'query', required: false, type: 'integer', example: 1 },
      { name: 'limit', in: 'query', required: false, type: 'integer', example: 20 }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Global appointments monitoring data.',
        example: {
          success: true,
          data: {
            appointments: [
              {
                id: 'apt_55102',
                doctorId: 'doc_44120',
                patientId: 'usr_9f8e7d6c5b',
                status: 'SCHEDULED',
                scheduledTime: '2026-10-15T09:30:00Z'
              }
            ],
            pagination: { page: 1, limit: 20, totalCount: 1, totalPages: 1 }
          }
        }
      }
    ],
    relatedEndpointIds: [25, 26]
  }
];

