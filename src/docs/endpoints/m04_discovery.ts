import { EndpointSpec } from '../spec-types';

export const DISCOVERY_ENDPOINTS: EndpointSpec[] = [
  {
    id: 17,
    method: 'GET',
    path: '/doctors',
    moduleNumber: '04',
    moduleName: 'Doctor Discovery',
    summary: 'Search, filter, rank; screeningId enables matching',
    description: 'Searches and filters verified dermatologists. When `screeningId` query parameter is provided, ranks doctors by clinical specialty matching the detected condition.',
    roles: ['PUBLIC', 'PATIENT'],
    authRequired: false,
    authType: 'None',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Only approved and verified doctors with active licenses appear in results.',
      'Passing ?screeningId=... enables intelligent matching based on detected condition.',
      'Doctor featured (sponsored) status increases catalog visibility but MUST NEVER alter clinical matching algorithm accuracy or relevance ranking.',
      'Public users cannot see internal doctor private contact information.'
    ],
    parameters: [
      { name: 'search', in: 'query', required: false, type: 'string', description: 'Search doctor name or clinic', example: 'Chen' },
      { name: 'specialty', in: 'query', required: false, type: 'string', description: 'Clinical specialty', example: 'Pediatric Dermatology' },
      { name: 'screeningId', in: 'query', required: false, type: 'string', description: 'Screening ID to enable condition-based doctor matching', example: 'scr_9918274a' },
      { name: 'minRating', in: 'query', required: false, type: 'number', description: 'Minimum patient rating (1.0 to 5.0)', example: 4.5 },
      { name: 'page', in: 'query', required: false, type: 'integer', description: 'Page number', example: 1 },
      { name: 'limit', in: 'query', required: false, type: 'integer', description: 'Page limit', example: 10 }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'List of verified doctors matching query criteria.',
        example: {
          success: true,
          data: {
            doctors: [
              {
                id: 'doc_44120',
                name: 'Dr. Robert Chen, MD',
                avatarUrl: 'https://cdn.dermacare.ai/avatars/doc_44120.jpg',
                specialties: ['Atopic Dermatitis', 'General Dermatology'],
                consultationFee: 75.0,
                rating: 4.9,
                totalReviews: 128,
                isFeatured: true,
                matchedCondition: 'Atopic Dermatitis (Match score: 98%)',
                nextAvailableSlot: '2026-10-15T09:30:00Z'
              }
            ],
            pagination: { page: 1, limit: 10, totalCount: 1, totalPages: 1 }
          }
        }
      }
    ],
    relatedEndpointIds: [13, 18, 19, 20]
  },
  {
    id: 18,
    method: 'GET',
    path: '/doctors/{id}',
    moduleNumber: '04',
    moduleName: 'Doctor Discovery',
    summary: 'Public verified doctor details',
    description: 'Retrieves public profile, verified credentials, clinical biography, consultation pricing, and reviews for a specific verified doctor.',
    roles: ['PUBLIC'],
    authRequired: false,
    authType: 'None',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Doctor must have APPROVED verification status.',
      'Displays public information only; medical license documents remain protected.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Doctor identifier', example: 'doc_44120' }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Doctor public profile details.',
        example: {
          success: true,
          data: {
            id: 'doc_44120',
            name: 'Dr. Robert Chen, MD',
            qualifications: 'MD, FAAD - Stanford University School of Medicine',
            bio: 'Board-certified dermatologist specializing in inflammatory skin conditions and skin barrier repair.',
            specialties: ['Atopic Dermatitis', 'Eczema', 'Allergic Contact Dermatitis'],
            consultationFee: 75.0,
            currency: 'USD',
            rating: 4.9,
            reviewCount: 128,
            yearsExperience: 14
          }
        }
      },
      {
        statusCode: 404,
        description: 'Doctor not found or not approved.',
        example: {
          success: false,
          error: { code: 'DOCTOR_NOT_FOUND', message: 'Doctor profile not found or inactive.' }
        }
      }
    ],
    relatedEndpointIds: [17, 19]
  },
  {
    id: 19,
    method: 'GET',
    path: '/doctors/{id}/slots',
    moduleNumber: '04',
    moduleName: 'Doctor Discovery',
    summary: 'Available slots; doctor may query own slots',
    description: 'Returns available consultation time slots for a doctor. Public callers see only unbooked, unheld slots. Authenticated doctors querying their own ID see complete slot statuses.',
    roles: ['PUBLIC', 'PATIENT', 'DOCTOR'],
    authRequired: false,
    authType: 'None',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Privacy Rule: Public and patient users MUST NOT see booked, held, or unavailable slots.',
      'Doctors querying their own ID receive full slot inventory with reservation statuses.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Doctor identifier', example: 'doc_44120' },
      { name: 'startDate', in: 'query', required: false, type: 'string', format: 'date', description: 'Filter start date (YYYY-MM-DD)', example: '2026-10-15' },
      { name: 'endDate', in: 'query', required: false, type: 'string', format: 'date', description: 'Filter end date (YYYY-MM-DD)', example: '2026-10-22' }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'List of available doctor consultation slots.',
        example: {
          success: true,
          data: {
            doctorId: 'doc_44120',
            slots: [
              {
                id: 'slt_1001',
                startTime: '2026-10-15T09:30:00Z',
                endTime: '2026-10-15T10:00:00Z',
                durationMinutes: 30,
                status: 'AVAILABLE'
              },
              {
                id: 'slt_1002',
                startTime: '2026-10-15T10:15:00Z',
                endTime: '2026-10-15T10:45:00Z',
                durationMinutes: 30,
                status: 'AVAILABLE'
              }
            ]
          }
        }
      }
    ],
    relatedEndpointIds: [17, 20, 23]
  }
];

