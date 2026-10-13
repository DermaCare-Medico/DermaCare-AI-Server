import { EndpointSpec } from '../spec-types';

export const HEALTH_ENDPOINTS: EndpointSpec[] = [
  {
    id: 68,
    method: 'GET',
    path: '/health',
    moduleNumber: '13',
    moduleName: 'Health & Secure Images',
    summary: 'Public minimal liveness status; no secrets',
    description: 'Provides a minimal public liveness and readiness probe for load balancers and system monitoring. Never exposes environment variables, secrets, database credentials, or system paths.',
    roles: ['PUBLIC'],
    authRequired: false,
    authType: 'None',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Minimal public payload: status, version, and server timestamp only.',
      'No sensitive internals, stack traces, database URIs, or server configuration exposed.'
    ],
    responses: [
      {
        statusCode: 200,
        description: 'System is healthy and operational.',
        example: {
          status: 'ok',
          service: 'DermaCare AI API',
          version: '1.0.0-proposed',
          timestamp: '2026-10-13T10:44:00Z'
        }
      }
    ],
    relatedEndpointIds: [69]
  },
  {
    id: 69,
    method: 'GET',
    path: '/uploads/medical-images/{id}/signed-url',
    moduleNumber: '13',
    moduleName: 'Health & Secure Images',
    summary: 'Short-lived signed URL after ownership/consent checks',
    description: 'Issues a short-lived (5-minute expiry) cryptographic presigned URL for private medical images after strictly validating caller ownership or explicit patient consent.',
    roles: ['PATIENT', 'DOCTOR'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Medical images MUST NEVER be hosted on public or static open bucket URLs.',
      'Caller MUST either be the owning patient OR the assigned doctor with active patient consent.',
      'Issued signed URL expires in exactly 300 seconds (5 minutes).',
      'Image access generates an audit event in Module 16.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Medical image ID', example: 'img_4810a' }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Short-lived signed URL generated.',
        example: {
          success: true,
          data: {
            imageId: 'img_4810a',
            signedUrl: 'https://storage.dermacare.ai/secure-phi/img_4810a.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA...&X-Amz-Expires=300&X-Amz-Signature=88a10...',
            expiresInSeconds: 300
          }
        }
      },
      {
        statusCode: 403,
        description: 'Forbidden; caller lacks ownership or patient consent.',
        example: {
          success: false,
          error: { code: 'UNAUTHORIZED_PHI_ACCESS', message: 'You are not authorized to view this private clinical image.' }
        }
      }
    ],
    relatedEndpointIds: [13, 15, 31, 68]
  }
];

