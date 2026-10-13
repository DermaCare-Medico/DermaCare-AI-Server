import { EndpointSpec } from '../spec-types';

export const NOTIFICATIONS_ENDPOINTS: EndpointSpec[] = [
  {
    id: 66,
    method: 'GET',
    path: '/notifications',
    moduleNumber: '12',
    moduleName: 'Notifications',
    summary: 'List notifications and return unreadCount',
    description: 'Retrieves the authenticated user transactional notifications inbox, returning notification items alongside an exact unreadCount metric.',
    roles: ['PATIENT', 'DOCTOR', 'ADMIN'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Delivers transactional clinical and order notifications (e.g. appointment reminders, prescription finalized, order shipped).',
      'Returns aggregate unreadCount alongside the item list for badge synchronization.',
      'Supports ?unreadOnly=true and pagination parameters.'
    ],
    parameters: [
      { name: 'unreadOnly', in: 'query', required: false, type: 'boolean', description: 'Filter only unread notifications', example: true },
      { name: 'page', in: 'query', required: false, type: 'integer', example: 1 },
      { name: 'limit', in: 'query', required: false, type: 'integer', example: 20 }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Notifications inbox with unread count.',
        example: {
          success: true,
          data: {
            unreadCount: 1,
            notifications: [
              {
                id: 'notif_88190',
                type: 'PRESCRIPTION_FINALIZED',
                title: 'New Prescription Available',
                message: 'Dr. Robert Chen finalized your prescription for Atopic Dermatitis.',
                isRead: false,
                actionUrl: '/prescriptions/rx_77810',
                createdAt: '2026-10-15T10:05:00Z'
              }
            ],
            pagination: { page: 1, limit: 20, totalCount: 1, totalPages: 1 }
          }
        }
      }
    ],
    relatedEndpointIds: [67, 37, 26]
  },
  {
    id: 67,
    method: 'PATCH',
    path: '/notifications/{id}/read',
    moduleNumber: '12',
    moduleName: 'Notifications',
    summary: 'Mark notification read',
    description: 'Marks a specific notification as read and updates the unread badge counter.',
    roles: ['PATIENT', 'DOCTOR', 'ADMIN'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Ownership enforcement: caller must be the recipient of this notification.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Notification ID', example: 'notif_88190' }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Notification marked as read.',
        example: {
          success: true,
          data: {
            id: 'notif_88190',
            isRead: true,
            readAt: '2026-10-15T10:15:00Z'
          }
        }
      }
    ],
    relatedEndpointIds: [66]
  }
];

