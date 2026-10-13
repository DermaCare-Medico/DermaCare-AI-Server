import type { EndpointSpec } from '../spec-types.js';

export const SCREENINGS_ENDPOINTS: EndpointSpec[] = [
  {
    id: 13,
    method: 'POST',
    path: '/screenings',
    moduleNumber: '03',
    moduleName: 'AI Screening & Conditions',
    summary: 'Upload private image, symptoms; run screening and safety rules',
    description: 'Uploads a private clinical photograph and user-reported symptoms. Executes the dermatological AI screening model and evaluates mandatory clinical safety guardrails.',
    roles: ['PATIENT'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Preliminary results only: MUST NOT be presented as a definitive clinical diagnosis.',
      'Safety Rule: Confidence score below 60% suppresses all natural-care and OTC recommendations.',
      'Safety Rule: High-risk scores above 20% trigger clinical urgency warnings.',
      'Safety Rule: Red flags (e.g. rapid bleeding, color variation, asymmetry) override all scores and force an emergency consultation advisory.',
      'Daily quota check: Free users limited to 3 screenings per day; Premium users enjoy unlimited screenings.'
    ],
    requestBody: {
      description: 'Screening image reference, lesion location, and patient symptoms.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        required: ['imageUrl', 'bodyPart', 'durationDays'],
        properties: {
          imageUrl: { type: 'string', format: 'uri', description: 'Private secure image URL or upload key', example: 'https://storage.dermacare.ai/raw-screenings/img_4810a.jpg' },
          bodyPart: { type: 'string', enum: ['FACE', 'NECK', 'CHEST', 'BACK', 'ARM', 'LEG', 'HAND', 'FOOT', 'TORSO', 'OTHER'], example: 'ARM' },
          durationDays: { type: 'integer', minimum: 1, description: 'Number of days lesion/symptom has been observed', example: 14 },
          symptoms: { type: 'array', items: { type: 'string' }, example: ['itching', 'redness', 'dryness'] },
          itchinessSeverity: { type: 'integer', minimum: 1, maximum: 10, description: 'Patient-rated itch severity (1-10)', example: 6 },
          hasBleeding: { type: 'boolean', description: 'Indicates lesion bleeding (red flag trigger)', example: false }
        }
      },
      example: {
        imageUrl: 'https://storage.dermacare.ai/raw-screenings/img_4810a.jpg',
        bodyPart: 'ARM',
        durationDays: 14,
        symptoms: ['itching', 'redness', 'dryness'],
        itchinessSeverity: 6,
        hasBleeding: false
      }
    },
    responses: [
      {
        statusCode: 201,
        description: 'Screening processed successfully; preliminary AI assessment generated.',
        example: {
          success: true,
          data: {
            screeningId: 'scr_9918274a',
            status: 'COMPLETED',
            detectedCondition: 'Atopic Dermatitis (Eczema)',
            confidenceScore: 0.84,
            riskLevel: 'LOW',
            redFlagDetected: false,
            naturalCareSuppressed: false,
            urgencyWarning: null,
            preliminaryDisclaimer: 'This result is an automated AI screening for informational purposes and is NOT a definitive diagnosis. Always consult a qualified dermatologist.',
            recommendedDoctorSpecialty: 'General Dermatology',
            createdAt: '2026-10-13T10:42:00Z'
          }
        }
      },
      {
        statusCode: 429,
        description: 'Daily screening quota exceeded for free subscription tier.',
        example: {
          success: false,
          error: { code: 'QUOTA_EXCEEDED', message: 'You have reached your daily limit of 3 free AI screenings. Upgrade to Premium for unlimited screenings.' }
        }
      }
    ],
    relatedEndpointIds: [14, 15, 17, 73]
  },
  {
    id: 14,
    method: 'GET',
    path: '/screenings',
    moduleNumber: '03',
    moduleName: 'AI Screening & Conditions',
    summary: 'List own screenings with paging',
    description: 'Retrieves a paginated list of AI screenings belonging to the authenticated patient, ordered chronologically.',
    roles: ['PATIENT'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Patients can only inspect their own screening records.',
      'Supports limit and page query parameters.'
    ],
    parameters: [
      { name: 'page', in: 'query', required: false, type: 'integer', description: 'Page index (starts at 1)', example: 1 },
      { name: 'limit', in: 'query', required: false, type: 'integer', description: 'Items per page (default 10, max 50)', example: 10 }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Paginated list of patient screenings.',
        example: {
          success: true,
          data: {
            screenings: [
              {
                id: 'scr_9918274a',
                bodyPart: 'ARM',
                detectedCondition: 'Atopic Dermatitis',
                confidenceScore: 0.84,
                riskLevel: 'LOW',
                createdAt: '2026-10-13T10:42:00Z'
              }
            ],
            pagination: { page: 1, limit: 10, totalCount: 1, totalPages: 1 }
          }
        }
      }
    ],
    relatedEndpointIds: [13, 15]
  },
  {
    id: 15,
    method: 'GET',
    path: '/screenings/{id}',
    moduleNumber: '03',
    moduleName: 'AI Screening & Conditions',
    summary: 'Details, confidence, findings and result together',
    description: 'Combines detailed screening assessment, differential AI findings, confidence breakdown, and preliminary care guidance in a single response.',
    roles: ['PATIENT'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Combines screening findings with differential results into one unified response.',
      'Strict ownership check: patient can only view screenings authored by themselves.',
      'Image access remains secure; uses signed image reference.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Unique screening identifier', example: 'scr_9918274a' }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Complete screening details and AI findings.',
        example: {
          success: true,
          data: {
            id: 'scr_9918274a',
            patientId: 'usr_9f8e7d6c5b',
            bodyPart: 'ARM',
            durationDays: 14,
            symptoms: ['itching', 'redness'],
            primaryCondition: {
              name: 'Atopic Dermatitis',
              icd10: 'L20.9',
              confidenceScore: 0.84
            },
            differentialFindings: [
              { name: 'Contact Dermatitis', confidenceScore: 0.11 },
              { name: 'Plaque Psoriasis', confidenceScore: 0.05 }
            ],
            riskEvaluation: {
              level: 'LOW',
              riskScorePercentage: 8,
              redFlagPresent: false,
              naturalCareSuppressed: false
            },
            homeCareSuggestions: [
              'Apply hypoallergenic moisturizing barrier cream twice daily.',
              'Avoid fragrant detergents and hot water exposure.'
            ],
            createdAt: '2026-10-13T10:42:00Z'
          }
        }
      },
      {
        statusCode: 404,
        description: 'Screening not found or caller lacks ownership.',
        example: {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Screening record not found.' }
        }
      }
    ],
    relatedEndpointIds: [13, 14, 16]
  },
  {
    id: 16,
    method: 'GET',
    path: '/conditions',
    moduleNumber: '03',
    moduleName: 'AI Screening & Conditions',
    summary: 'Search/list conditions; optional ids or detail filter',
    description: 'Public clinical reference encyclopedia. Allows searching conditions, filtering by symptoms or categories, or retrieving multiple condition summaries by ID.',
    roles: ['PUBLIC'],
    authRequired: false,
    authType: 'None',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Public encyclopedia viewable without authentication.',
      'Supports query parameter ?search=..., ?category=..., and ?ids=cond_1,cond_2.'
    ],
    parameters: [
      { name: 'search', in: 'query', required: false, type: 'string', description: 'Search term (condition name or symptom)', example: 'eczema' },
      { name: 'category', in: 'query', required: false, type: 'string', description: 'Dermatology condition category', example: 'INFLAMMATORY' },
      { name: 'ids', in: 'query', required: false, type: 'string', description: 'Comma-separated condition IDs for batch lookup', example: 'cnd_eczema,cnd_psoriasis' }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'List of verified dermatological conditions.',
        example: {
          success: true,
          data: [
            {
              id: 'cnd_eczema',
              name: 'Atopic Dermatitis',
              commonName: 'Eczema',
              category: 'INFLAMMATORY',
              overview: 'A chronic condition causing inflamed, itchy, and dry skin.',
              typicalSymptoms: ['Pruritus (itching)', 'Erythema (redness)', 'Xerosis (dry skin)']
            }
          ]
        }
      }
    ],
    relatedEndpointIds: [13, 15]
  }
];

