import type { EndpointSpec } from '../spec-types.js';

export const SUBSCRIPTIONS_ENDPOINTS: EndpointSpec[] = [
  {
    id: 70,
    method: 'GET',
    path: '/subscription-plans',
    moduleNumber: '14',
    moduleName: 'Subscriptions',
    summary: 'Public active plans; admin sees managed plans',
    description: 'Lists available subscription tiers. Public callers see active customer plans (Patient Premium, Doctor Featured). Admins see all plans including disabled or archived tiers.',
    roles: ['PUBLIC', 'PATIENT', 'DOCTOR', 'ADMIN'],
    authRequired: false,
    authType: 'None',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Lists public plans with quota details (Free: 3 screenings/day, 2 bookings/month; Premium: unlimited).',
      'Doctor featured plans: provides priority catalog placement, but never biases clinical matching algorithms.'
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Available subscription plans.',
        example: {
          success: true,
          data: [
            {
              id: 'plan_pat_free',
              name: 'Patient Free',
              targetRole: 'PATIENT',
              monthlyPrice: 0.0,
              features: ['3 AI skin screenings/day', '2 Doctor bookings/month', 'Standard chat access'],
              screeningDailyQuota: 3,
              bookingMonthlyQuota: 2,
              isActive: true
            },
            {
              id: 'plan_pat_prem',
              name: 'Patient Premium',
              targetRole: 'PATIENT',
              monthlyPrice: 19.99,
              features: ['Unlimited AI skin screenings', 'Unlimited Doctor bookings', 'Priority consultation scheduling'],
              screeningDailyQuota: -1,
              bookingMonthlyQuota: -1,
              isActive: true
            },
            {
              id: 'plan_doc_feat',
              name: 'Doctor Featured Practice',
              targetRole: 'DOCTOR',
              monthlyPrice: 49.99,
              features: ['Featured directory badge', 'Homepage spotlight'],
              isActive: true
            }
          ]
        }
      }
    ],
    relatedEndpointIds: [71, 72, 75]
  },
  {
    id: 71,
    method: 'POST',
    path: '/subscriptions',
    moduleNumber: '14',
    moduleName: 'Subscriptions',
    summary: 'Start patient premium or doctor featured sandbox flow',
    description: 'Initiates a subscription checkout flow for Patient Premium or Doctor Featured tier, generating a linked sandbox payment intent.',
    roles: ['PATIENT', 'DOCTOR'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Role matching: Patient cannot subscribe to Doctor Featured plan; Doctor cannot subscribe to Patient tier.',
      'Generates sandbox payment intent in Module 10.'
    ],
    requestBody: {
      description: 'Target plan ID.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        required: ['planId'],
        properties: {
          planId: { type: 'string', example: 'plan_pat_prem' }
        }
      },
      example: {
        planId: 'plan_pat_prem'
      }
    },
    responses: [
      {
        statusCode: 201,
        description: 'Subscription session started; sandbox payment ready.',
        example: {
          success: true,
          data: {
            subscriptionId: 'sub_99214a',
            planId: 'plan_pat_prem',
            status: 'PENDING_PAYMENT',
            paymentId: 'pay_sim_sub_01',
            createdAt: '2026-10-13T10:45:00Z'
          }
        }
      }
    ],
    relatedEndpointIds: [54, 55, 70, 72]
  },
  {
    id: 72,
    method: 'GET',
    path: '/subscriptions/me',
    moduleNumber: '14',
    moduleName: 'Subscriptions',
    summary: 'Current plan, expiry and status',
    description: 'Retrieves active subscription status, renewal date, current tier, and payment status for the authenticated user.',
    roles: ['PATIENT', 'DOCTOR'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Returns current active plan or defaults to Free plan tier.'
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Current subscription plan details.',
        example: {
          success: true,
          data: {
            planId: 'plan_pat_prem',
            planName: 'Patient Premium',
            status: 'ACTIVE',
            currentPeriodStart: '2026-10-01T00:00:00Z',
            currentPeriodEnd: '2026-11-01T00:00:00Z',
            cancelAtPeriodEnd: false
          }
        }
      }
    ],
    relatedEndpointIds: [70, 73, 74]
  },
  {
    id: 73,
    method: 'GET',
    path: '/subscriptions/me/usage',
    moduleNumber: '14',
    moduleName: 'Subscriptions',
    summary: 'Screening/booking quota and limits',
    description: 'Returns real-time usage metrics and remaining daily/monthly quotas for AI skin screenings and appointments.',
    roles: ['PATIENT'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Free quota baseline: 3 screenings/day, 2 bookings/month.',
      'Premium tier: unlimited (-1).',
      'Resets screening quota at 00:00 UTC daily.'
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Quota usage and limits summary.',
        example: {
          success: true,
          data: {
            tier: 'FREE',
            screenings: {
              usedToday: 1,
              dailyLimit: 3,
              remainingToday: 2,
              resetsAt: '2026-10-14T00:00:00Z'
            },
            bookings: {
              usedThisMonth: 1,
              monthlyLimit: 2,
              remainingThisMonth: 1
            }
          }
        }
      }
    ],
    relatedEndpointIds: [13, 23, 72]
  },
  {
    id: 74,
    method: 'POST',
    path: '/subscriptions/{id}/cancel',
    moduleNumber: '14',
    moduleName: 'Subscriptions',
    summary: 'Cancel owned subscription',
    description: 'Cancels the active paid subscription. Retains premium tier access until the end of the current billing period.',
    roles: ['PATIENT', 'DOCTOR'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Caller must own the subscription.',
      'Flags subscription with cancelAtPeriodEnd=true.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Subscription ID', example: 'sub_99214a' }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Subscription scheduled for cancellation at period end.',
        example: {
          success: true,
          message: 'Subscription will not renew. Benefits remain active until current period ends.',
          data: {
            subscriptionId: 'sub_99214a',
            cancelAtPeriodEnd: true,
            effectiveEndDate: '2026-11-01T00:00:00Z'
          }
        }
      }
    ],
    relatedEndpointIds: [72]
  },
  {
    id: 75,
    method: 'POST',
    path: '/admin/subscription-plans',
    moduleNumber: '14',
    moduleName: 'Subscriptions',
    summary: 'Create plan',
    description: 'Creates a new subscription tier with configured pricing, target role, and quota thresholds.',
    roles: ['ADMIN'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Admin only.',
      'Defines quotas: -1 indicates unlimited.'
    ],
    requestBody: {
      description: 'Subscription plan parameters.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        required: ['name', 'targetRole', 'monthlyPrice', 'screeningDailyQuota', 'bookingMonthlyQuota'],
        properties: {
          name: { type: 'string', example: 'Family Care Tier' },
          targetRole: { type: 'string', enum: ['PATIENT', 'DOCTOR'], example: 'PATIENT' },
          monthlyPrice: { type: 'number', example: 29.99 },
          screeningDailyQuota: { type: 'integer', example: 10 },
          bookingMonthlyQuota: { type: 'integer', example: 5 },
          features: { type: 'array', items: { type: 'string' }, example: ['Up to 4 family members', '10 screenings/day'] }
        }
      },
      example: {
        name: 'Family Care Tier',
        targetRole: 'PATIENT',
        monthlyPrice: 29.99,
        screeningDailyQuota: 10,
        bookingMonthlyQuota: 5,
        features: ['Up to 4 family members', '10 screenings/day']
      }
    },
    responses: [
      {
        statusCode: 201,
        description: 'Subscription plan created.',
        example: {
          success: true,
          data: {
            id: 'plan_fam_01',
            name: 'Family Care Tier',
            monthlyPrice: 29.99,
            isActive: true
          }
        }
      }
    ],
    relatedEndpointIds: [70, 76]
  },
  {
    id: 76,
    method: 'PATCH',
    path: '/admin/subscription-plans/{id}',
    moduleNumber: '14',
    moduleName: 'Subscriptions',
    summary: 'Update/disable plan',
    description: 'Updates plan pricing, quota limits, or toggles active status to disable a plan from public registration.',
    roles: ['ADMIN'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Admin only.',
      'Disabling a plan prevents new sign-ups while preserving existing active subscriptions.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Plan ID', example: 'plan_fam_01' }
    ],
    requestBody: {
      description: 'Fields to update.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        properties: {
          monthlyPrice: { type: 'number', example: 27.99 },
          isActive: { type: 'boolean', example: false }
        }
      },
      example: {
        monthlyPrice: 27.99,
        isActive: false
      }
    },
    responses: [
      {
        statusCode: 200,
        description: 'Plan updated.',
        example: {
          success: true,
          data: {
            id: 'plan_fam_01',
            isActive: false,
            updatedAt: '2026-10-13T10:46:00Z'
          }
        }
      }
    ],
    relatedEndpointIds: [70, 75]
  }
];

