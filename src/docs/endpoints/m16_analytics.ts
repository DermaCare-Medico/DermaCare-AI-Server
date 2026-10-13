import { EndpointSpec } from '../spec-types';

export const ANALYTICS_ENDPOINTS: EndpointSpec[] = [
  {
    id: 81,
    method: 'GET',
    path: '/admin/analytics',
    moduleNumber: '16',
    moduleName: 'Advanced Analytics',
    summary: 'Type=overview/users/screenings/appointments/orders/subscriptions',
    description: 'Returns aggregated high-level business and clinical throughput metrics selected by query parameter `type`. Strictly excludes patient-level medical data or personal health identifiers.',
    roles: ['ADMIN'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Admin only.',
      'Strict Privacy Guard: Aggregated counts and percentages only; NEVER includes patient names, diagnoses, or photos.',
      'Query parameter ?type=overview | users | screenings | appointments | orders | subscriptions.'
    ],
    parameters: [
      {
        name: 'type',
        in: 'query',
        required: false,
        type: 'string',
        enum: ['overview', 'users', 'screenings', 'appointments', 'orders', 'subscriptions'],
        description: 'Category of aggregated metrics',
        example: 'overview'
      }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Aggregated platform metrics.',
        example: {
          success: true,
          data: {
            category: 'overview',
            timestamp: '2026-10-13T10:50:00Z',
            metrics: {
              totalUsers: 1420,
              activeDoctors: 48,
              totalScreeningsCompleted: 3840,
              totalAppointmentsHeld: 612,
              completedConsultations: 589,
              totalOrdersFulfilled: 310,
              activeSubscriptions: 240
            }
          }
        }
      }
    ],
    relatedEndpointIds: [82, 83, 84]
  },
  {
    id: 82,
    method: 'GET',
    path: '/admin/analytics/trends',
    moduleNumber: '16',
    moduleName: 'Advanced Analytics',
    summary: 'Time-series trends by metric/date range',
    description: 'Retrieves time-series telemetry data (daily, weekly, monthly intervals) for specific operational metrics such as screening volume, appointment bookings, and user registrations.',
    roles: ['ADMIN'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Admin only.',
      'Metric parameter must be one of: screenings, bookings, registrations, orders.',
      'Interval parameter: daily, weekly, or monthly.'
    ],
    parameters: [
      { name: 'metric', in: 'query', required: true, type: 'string', enum: ['screenings', 'bookings', 'registrations', 'orders'], example: 'screenings' },
      { name: 'startDate', in: 'query', required: false, type: 'string', format: 'date', example: '2026-10-01' },
      { name: 'endDate', in: 'query', required: false, type: 'string', format: 'date', example: '2026-10-13' },
      { name: 'interval', in: 'query', required: false, type: 'string', enum: ['daily', 'weekly', 'monthly'], example: 'daily' }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Time-series operational trend data points.',
        example: {
          success: true,
          data: {
            metric: 'screenings',
            interval: 'daily',
            points: [
              { date: '2026-10-10', count: 142 },
              { date: '2026-10-11', count: 168 },
              { date: '2026-10-12', count: 195 },
              { date: '2026-10-13', count: 210 }
            ]
          }
        }
      }
    ],
    relatedEndpointIds: [81, 83]
  },
  {
    id: 83,
    method: 'GET',
    path: '/admin/analytics/revenue',
    moduleNumber: '16',
    moduleName: 'Advanced Analytics',
    summary: 'Sandbox revenue by orders and subscriptions',
    description: 'Reports simulated financial totals and sandbox revenue breakdown from medicine store orders and recurring patient/doctor subscriptions.',
    roles: ['ADMIN'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Admin only.',
      'All revenue figures represent fictional sandbox demo amounts, not live banking funds.',
      'Categorizes revenue into ORDERS vs SUBSCRIPTIONS.'
    ],
    parameters: [
      { name: 'startDate', in: 'query', required: false, type: 'string', format: 'date', example: '2026-10-01' },
      { name: 'endDate', in: 'query', required: false, type: 'string', format: 'date', example: '2026-10-31' }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Simulated sandbox revenue summary.',
        example: {
          success: true,
          data: {
            isSandbox: true,
            currency: 'USD',
            totalSandboxRevenue: 12480.5,
            breakdown: {
              medicineOrders: 6420.5,
              patientSubscriptions: 3560.0,
              doctorFeaturedSubscriptions: 2500.0
            },
            period: '2026-10-01 to 2026-10-31'
          }
        }
      }
    ],
    relatedEndpointIds: [81, 82]
  },
  {
    id: 84,
    method: 'GET',
    path: '/admin/audit-logs',
    moduleNumber: '16',
    moduleName: 'Advanced Analytics',
    summary: 'Paginated admin and clinical-access audit metadata',
    description: 'Provides paginated immutable audit logs of administrative actions, user suspensions, doctor approvals, and consent-gated clinical history accesses for regulatory compliance.',
    roles: ['ADMIN'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Admin only.',
      'Audit log entries are immutable and append-only.',
      'Tracks actorId, action, targetEntity, ipAddress, and timestamp.'
    ],
    parameters: [
      { name: 'action', in: 'query', required: false, type: 'string', example: 'USER_SUSPENDED' },
      { name: 'actorId', in: 'query', required: false, type: 'string', example: 'usr_admin_01' },
      { name: 'page', in: 'query', required: false, type: 'integer', example: 1 },
      { name: 'limit', in: 'query', required: false, type: 'integer', example: 25 }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Paginated administrative audit records.',
        example: {
          success: true,
          data: {
            logs: [
              {
                id: 'aud_991823',
                actorId: 'usr_admin_01',
                action: 'DOCTOR_VERIFIED',
                targetEntity: 'usr_doc_9901',
                details: 'Verified license MD-882910-CA',
                ipAddress: '192.168.1.1',
                createdAt: '2026-10-13T10:48:00Z'
              }
            ],
            pagination: { page: 1, limit: 25, totalCount: 1, totalPages: 1 }
          }
        }
      }
    ],
    relatedEndpointIds: [59, 60, 81]
  }
];

