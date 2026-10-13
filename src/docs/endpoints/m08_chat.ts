import type { EndpointSpec } from '../spec-types.js';

export const CHAT_ENDPOINTS: EndpointSpec[] = [
  {
    id: 42,
    method: 'GET',
    path: '/appointments/{id}/conversation',
    moduleNumber: '08',
    moduleName: 'Post-consultation Chat',
    summary: 'Fetch conversation metadata and 7-day expiry',
    description: 'Retrieves conversation channel metadata for a completed appointment, including participants and the exact 7-day expiration timestamp.',
    roles: ['PATIENT', 'DOCTOR'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Chat is available ONLY after consultation has reached COMPLETED status.',
      'Access restricted strictly to the patient and assigned doctor of this consultation.',
      'The conversation window automatically expires exactly 7 days after the consultation completion time.',
      'No sponsored advertisements or third-party marketing may ever be injected into this channel.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Appointment ID', example: 'apt_55102' }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Conversation channel metadata and expiry window.',
        example: {
          success: true,
          data: {
            conversationId: 'cnv_88192a',
            appointmentId: 'apt_55102',
            patientId: 'usr_9f8e7d6c5b',
            doctorId: 'doc_44120',
            isActive: true,
            completedAt: '2026-10-15T09:55:00Z',
            expiresAt: '2026-10-22T09:55:00Z',
            totalMessages: 4
          }
        }
      },
      {
        statusCode: 400,
        description: 'Consultation is not yet completed.',
        example: {
          success: false,
          error: { code: 'CHAT_NOT_READY', message: 'Post-consultation chat is only available after consultation completion.' }
        }
      }
    ],
    relatedEndpointIds: [33, 43, 44]
  },
  {
    id: 43,
    method: 'GET',
    path: '/conversations/{id}/messages',
    moduleNumber: '08',
    moduleName: 'Post-consultation Chat',
    summary: 'Poll text messages with cursor',
    description: 'Retrieves text messages in the conversation channel using cursor-based pagination for smooth client polling.',
    roles: ['PATIENT', 'DOCTOR'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Participant validation: caller must be the patient or the doctor belonging to this channel.',
      'Cursor-based pagination: ?cursor=msg_... and ?limit=... parameters.',
      'Messages remain readable even after 7-day expiry for clinical audit records.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Conversation ID', example: 'cnv_88192a' },
      { name: 'cursor', in: 'query', required: false, type: 'string', description: 'Last message ID received', example: 'msg_01' },
      { name: 'limit', in: 'query', required: false, type: 'integer', description: 'Message batch size (default 20, max 50)', example: 20 }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'List of text messages.',
        example: {
          success: true,
          data: {
            messages: [
              {
                id: 'msg_01',
                senderId: 'doc_44120',
                senderRole: 'DOCTOR',
                senderName: 'Dr. Robert Chen, MD',
                content: 'Hello Jane, please let me know if the redness improves after 3 days of hydrocortisone use.',
                sentAt: '2026-10-15T10:10:00Z'
              },
              {
                id: 'msg_02',
                senderId: 'usr_9f8e7d6c5b',
                senderRole: 'PATIENT',
                senderName: 'Jane Doe',
                content: 'Thank you doctor, the itching is already beginning to subside.',
                sentAt: '2026-10-16T08:30:00Z'
              }
            ],
            nextCursor: 'msg_02',
            hasMore: false
          }
        }
      }
    ],
    relatedEndpointIds: [42, 44]
  },
  {
    id: 44,
    method: 'POST',
    path: '/conversations/{id}/messages',
    moduleNumber: '08',
    moduleName: 'Post-consultation Chat',
    summary: 'Send text within authorized chat window',
    description: 'Sends a text message to the doctor or patient in the active conversation channel. Fails if the 7-day window has expired.',
    roles: ['PATIENT', 'DOCTOR'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Text messages ONLY (no media, executable links, or binary uploads supported in this MVP).',
      'Window check: MUST be within the 7 days following consultation completion.',
      'Attempts to post after expiry return 403 CHAT_WINDOW_EXPIRED.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Conversation ID', example: 'cnv_88192a' }
    ],
    requestBody: {
      description: 'Text message content.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string', minLength: 1, maxLength: 2000, description: 'Message text content', example: 'Doctor, should I continue applying if the skin feels dry?' }
        }
      },
      example: {
        content: 'Doctor, should I continue applying if the skin feels dry?'
      }
    },
    responses: [
      {
        statusCode: 201,
        description: 'Message sent successfully.',
        example: {
          success: true,
          data: {
            id: 'msg_03',
            conversationId: 'cnv_88192a',
            senderId: 'usr_9f8e7d6c5b',
            senderRole: 'PATIENT',
            content: 'Doctor, should I continue applying if the skin feels dry?',
            sentAt: '2026-10-16T09:00:00Z'
          }
        }
      },
      {
        statusCode: 403,
        description: 'Chat window has expired.',
        example: {
          success: false,
          error: { code: 'CHAT_WINDOW_EXPIRED', message: 'The 7-day post-consultation chat window for this appointment has closed.' }
        }
      }
    ],
    relatedEndpointIds: [42, 43]
  }
];

