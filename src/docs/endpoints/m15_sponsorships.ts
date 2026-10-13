import { EndpointSpec } from '../spec-types';

export const SPONSORSHIPS_ENDPOINTS: EndpointSpec[] = [
  {
    id: 77,
    method: 'GET',
    path: '/sponsorships',
    moduleNumber: '15',
    moduleName: 'Sponsored Content',
    summary: 'Placement-filtered ads; admin can view all',
    description: 'Retrieves active sponsored healthcare advertisements filtered by placement zone. Admins can view all campaigns including scheduled or paused ads.',
    roles: ['PUBLIC', 'PATIENT', 'DOCTOR', 'ADMIN'],
    authRequired: false,
    authType: 'None',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Sponsored content MUST ALWAYS be returned with isSponsored: true and labeled "Sponsored".',
      'SAFETY PROHIBITION: Sponsored ads MUST NEVER appear on AI screening results, emergency warnings, consultations, prescriptions, or post-consultation chat.',
      'Allowed placements: HOME_FEED, STORE_FEATURED, DISCOVERY_SIDEBAR.',
      'Impression and click tracking endpoints are intentionally omitted from this API; analytics does not collect ad interaction counts.'
    ],
    parameters: [
      { name: 'placement', in: 'query', required: false, type: 'string', enum: ['HOME_FEED', 'STORE_FEATURED', 'DISCOVERY_SIDEBAR'], example: 'HOME_FEED' }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Active sponsored campaigns for specified placement.',
        example: {
          success: true,
          data: [
            {
              id: 'spn_99214a',
              brandName: 'DermBarrier Skincare',
              headline: 'Hypoallergenic Ceramide Cleansers for Sensitive Skin',
              imageUrl: 'https://cdn.dermacare.ai/sponsorships/spn_99214a.jpg',
              destinationUrl: 'https://dermbarrier.example.com/sensitive',
              placement: 'HOME_FEED',
              isSponsored: true,
              label: 'Sponsored'
            }
          ]
        }
      }
    ],
    relatedEndpointIds: [78, 79, 80]
  },
  {
    id: 78,
    method: 'POST',
    path: '/admin/sponsorships',
    moduleNumber: '15',
    moduleName: 'Sponsored Content',
    summary: 'Create labeled ad with placement and dates',
    description: 'Creates a new sponsored healthcare campaign with verified labeling, targeting placement, and start/end active date range.',
    roles: ['ADMIN'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Admin only.',
      'Target placement must NOT be any clinical result view (AI result, consultation, prescription, chat).',
      'Enforces isSponsored: true permanently on database record.'
    ],
    requestBody: {
      description: 'Sponsorship campaign details.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        required: ['brandName', 'headline', 'imageUrl', 'destinationUrl', 'placement', 'startDate', 'endDate'],
        properties: {
          brandName: { type: 'string', example: 'DermBarrier Skincare' },
          headline: { type: 'string', example: 'Hypoallergenic Ceramide Cleansers' },
          imageUrl: { type: 'string', format: 'uri', example: 'https://cdn.dermacare.ai/sponsorships/spn_99214a.jpg' },
          destinationUrl: { type: 'string', format: 'uri', example: 'https://dermbarrier.example.com' },
          placement: { type: 'string', enum: ['HOME_FEED', 'STORE_FEATURED', 'DISCOVERY_SIDEBAR'], example: 'HOME_FEED' },
          startDate: { type: 'string', format: 'date-time', example: '2026-10-15T00:00:00Z' },
          endDate: { type: 'string', format: 'date-time', example: '2026-11-15T23:59:59Z' }
        }
      },
      example: {
        brandName: 'DermBarrier Skincare',
        headline: 'Hypoallergenic Ceramide Cleansers',
        imageUrl: 'https://cdn.dermacare.ai/sponsorships/spn_99214a.jpg',
        destinationUrl: 'https://dermbarrier.example.com',
        placement: 'HOME_FEED',
        startDate: '2026-10-15T00:00:00Z',
        endDate: '2026-11-15T23:59:59Z'
      }
    },
    responses: [
      {
        statusCode: 201,
        description: 'Sponsorship campaign created.',
        example: {
          success: true,
          data: {
            id: 'spn_99214a',
            brandName: 'DermBarrier Skincare',
            placement: 'HOME_FEED',
            status: 'SCHEDULED',
            isSponsored: true,
            createdAt: '2026-10-13T10:47:00Z'
          }
        }
      }
    ],
    relatedEndpointIds: [77, 79, 80]
  },
  {
    id: 79,
    method: 'PATCH',
    path: '/admin/sponsorships/{id}',
    moduleNumber: '15',
    moduleName: 'Sponsored Content',
    summary: 'Edit schedule/content/status',
    description: 'Updates campaign flight dates, copy, banner creative, or toggles campaign active status.',
    roles: ['ADMIN'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Admin only.',
      'Audits changes to external destination URLs and creatives.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Campaign ID', example: 'spn_99214a' }
    ],
    requestBody: {
      description: 'Updated campaign fields.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        properties: {
          headline: { type: 'string', example: 'Updated: Clinical Barrier Creams' },
          status: { type: 'string', enum: ['ACTIVE', 'PAUSED', 'ENDED'], example: 'ACTIVE' }
        }
      },
      example: {
        headline: 'Updated: Clinical Barrier Creams',
        status: 'ACTIVE'
      }
    },
    responses: [
      {
        statusCode: 200,
        description: 'Campaign updated.',
        example: {
          success: true,
          data: {
            id: 'spn_99214a',
            status: 'ACTIVE',
            updatedAt: '2026-10-13T10:48:00Z'
          }
        }
      }
    ],
    relatedEndpointIds: [77, 78, 80]
  },
  {
    id: 80,
    method: 'DELETE',
    path: '/admin/sponsorships/{id}',
    moduleNumber: '15',
    moduleName: 'Sponsored Content',
    summary: 'Soft-delete campaign',
    description: 'Soft-deletes an advertising sponsorship campaign, removing it from all public placements while preserving campaign audit history.',
    roles: ['ADMIN'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Admin only.',
      'Soft-delete maintains billing and contract compliance records.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Campaign ID', example: 'spn_99214a' }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Campaign deleted.',
        example: {
          success: true,
          message: 'Sponsorship campaign soft-deleted.'
        }
      }
    ],
    relatedEndpointIds: [77, 78, 79]
  }
];

