import { EndpointSpec } from '../spec-types';

export const CONSULTATION_ENDPOINTS: EndpointSpec[] = [
  {
    id: 31,
    method: 'GET',
    path: '/appointments/{id}/pre-consultation',
    moduleNumber: '06',
    moduleName: 'Consultation',
    summary: 'Consent-gated patient history for booked doctor',
    description: 'Retrieves patient medical history, previous screenings, and chief complaints for the upcoming consultation. Strictly gated by patient consent.',
    roles: ['DOCTOR'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Caller MUST be the specific doctor assigned to this appointment.',
      'Explicit patient consent MUST have been granted during booking.',
      'If consent is not granted, returns 403 Forbidden with CONSENT_REQUIRED code.',
      'All access events to patient pre-consultation history are audit logged.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Appointment ID', example: 'apt_55102' }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Pre-consultation clinical history data.',
        example: {
          success: true,
          data: {
            appointmentId: 'apt_55102',
            patient: {
              name: 'Jane Doe',
              age: 34,
              gender: 'FEMALE',
              knownAllergies: ['Penicillin'],
              skinType: 'II'
            },
            attachedScreening: {
              id: 'scr_9918274a',
              bodyPart: 'ARM',
              detectedCondition: 'Atopic Dermatitis',
              confidenceScore: 0.84,
              riskLevel: 'LOW',
              signedImageUrl: 'https://storage.dermacare.ai/signed/scr_9918274a.jpg?token=sec_abc123'
            },
            patientNotes: 'Worsening rash on forearm with intense night itching for 2 weeks.'
          }
        }
      },
      {
        statusCode: 403,
        description: 'Consent not granted or caller is not the booked doctor.',
        example: {
          success: false,
          error: { code: 'CONSENT_REQUIRED', message: 'Patient has not granted consent for pre-consultation record access.' }
        }
      }
    ],
    relatedEndpointIds: [24, 26, 32, 69]
  },
  {
    id: 32,
    method: 'GET',
    path: '/appointments/{id}/video',
    moduleNumber: '06',
    moduleName: 'Consultation',
    summary: 'Time-gated Jitsi meeting access',
    description: 'Generates a secure, time-limited Jitsi Meet token and room identifier for conducting the telemedicine video consultation.',
    roles: ['PATIENT', 'DOCTOR'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Caller must be either the booked patient or assigned doctor.',
      'Time-gated access: Room token is only valid starting 10 minutes before the scheduled time until 60 minutes after.',
      'Jitsi JWT is signed with server secret and specifies room permissions (doctor as moderator, patient as participant).'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Appointment ID', example: 'apt_55102' }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Jitsi telemedicine session access credentials.',
        example: {
          success: true,
          data: {
            roomName: 'dermacare-apt-55102-s7b29a',
            domain: 'meet.jit.si',
            jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.videoMeetingToken...',
            role: 'MODERATOR',
            validFrom: '2026-10-15T09:20:00Z',
            validUntil: '2026-10-15T10:30:00Z'
          }
        }
      },
      {
        statusCode: 400,
        description: 'Outside authorized video window.',
        example: {
          success: false,
          error: { code: 'MEETING_WINDOW_INACTIVE', message: 'Video room access is only active 10 minutes prior to scheduled start time.' }
        }
      }
    ],
    relatedEndpointIds: [26, 31, 33]
  },
  {
    id: 33,
    method: 'PATCH',
    path: '/appointments/{id}/consultation',
    moduleNumber: '06',
    moduleName: 'Consultation',
    summary: 'Start/complete with strict state transitions',
    description: 'Controls the clinical consultation lifecycle. Advances state from SCHEDULED -> IN_PROGRESS, or IN_PROGRESS -> COMPLETED.',
    roles: ['DOCTOR'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Only the assigned doctor can advance consultation state.',
      'Enforces strict finite state transitions: SCHEDULED -> IN_PROGRESS, IN_PROGRESS -> COMPLETED.',
      'Completion initiates the 7-day post-consultation chat window and unlocks prescription authoring.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Appointment ID', example: 'apt_55102' }
    ],
    requestBody: {
      description: 'Target consultation state transition.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['IN_PROGRESS', 'COMPLETED'], description: 'Next lifecycle state', example: 'COMPLETED' },
          completionSummary: { type: 'string', description: 'Clinical wrap-up note', example: 'Patient examined via video. Prescribed topical hydrocortisone.' }
        }
      },
      example: {
        status: 'COMPLETED',
        completionSummary: 'Patient examined via video. Prescribed topical hydrocortisone.'
      }
    },
    responses: [
      {
        statusCode: 200,
        description: 'Consultation state transitioned successfully.',
        example: {
          success: true,
          data: {
            appointmentId: 'apt_55102',
            previousStatus: 'IN_PROGRESS',
            currentStatus: 'COMPLETED',
            completedAt: '2026-10-15T09:55:00Z',
            chatWindowExpiresAt: '2026-10-22T09:55:00Z'
          }
        }
      },
      {
        statusCode: 400,
        description: 'Invalid status transition.',
        example: {
          success: false,
          error: { code: 'INVALID_TRANSITION', message: 'Cannot transition from SCHEDULED directly to COMPLETED.' }
        }
      }
    ],
    relatedEndpointIds: [34, 35, 42]
  },
  {
    id: 34,
    method: 'PUT',
    path: '/appointments/{id}/consultation-note',
    moduleNumber: '06',
    moduleName: 'Consultation',
    summary: 'Save or revise clinician notes before closure',
    description: 'Saves or revises private clinical SOAP notes (Subjective, Objective, Assessment, Plan). Permitted only while consultation is ongoing or pending closure.',
    roles: ['DOCTOR'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Only treating doctor can author or modify consultation notes.',
      'Notes can be edited only before final closure of the consultation.',
      'Notes are protected health information and are strictly confidential to the clinician.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Appointment ID', example: 'apt_55102' }
    ],
    requestBody: {
      description: 'Clinical SOAP notes content.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        required: ['subjective', 'assessment', 'plan'],
        properties: {
          subjective: { type: 'string', example: 'Patient reports 2-week history of itchy red patches on forearm.' },
          objective: { type: 'string', example: 'Erythematous plaques with slight excoriation on flexor surfaces.' },
          assessment: { type: 'string', example: 'Mild-to-moderate Atopic Dermatitis flare.' },
          plan: { type: 'string', example: 'Start Hydrocortisone 1% cream BID for 7 days. Gentle skin hydration.' }
        }
      },
      example: {
        subjective: 'Patient reports 2-week history of itchy red patches on forearm.',
        objective: 'Erythematous plaques with slight excoriation on flexor surfaces.',
        assessment: 'Mild-to-moderate Atopic Dermatitis flare.',
        plan: 'Start Hydrocortisone 1% cream BID for 7 days. Gentle skin hydration.'
      }
    },
    responses: [
      {
        statusCode: 200,
        description: 'Consultation notes updated.',
        example: {
          success: true,
          message: 'Clinical notes saved successfully.',
          data: {
            appointmentId: 'apt_55102',
            updatedAt: '2026-10-15T09:50:00Z'
          }
        }
      }
    ],
    relatedEndpointIds: [31, 33, 35]
  }
];

