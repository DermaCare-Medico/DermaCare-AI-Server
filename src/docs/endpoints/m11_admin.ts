import type { EndpointSpec } from '../spec-types.js';

export const ADMIN_ENDPOINTS: EndpointSpec[] = [
  {
    id: 57,
    method: 'GET',
    path: '/admin/users',
    moduleNumber: '11',
    moduleName: 'Admin Operations',
    summary: 'List users; role/status filters include pending doctors',
    description: 'Lists all system users with role and status filtering. Specifically allows admins to filter pending doctors awaiting medical license review.',
    roles: ['ADMIN'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Strictly restricted to authenticated users with ADMIN role.',
      'Supports filtering by role (PATIENT, DOCTOR, ADMIN) and status (ACTIVE, SUSPENDED, PENDING_VERIFICATION).',
      'Supports doctorVerificationStatus filter (PENDING_REVIEW, APPROVED, REJECTED).'
    ],
    parameters: [
      { name: 'role', in: 'query', required: false, type: 'string', enum: ['PATIENT', 'DOCTOR', 'ADMIN'], example: 'DOCTOR' },
      { name: 'status', in: 'query', required: false, type: 'string', enum: ['ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION'], example: 'ACTIVE' },
      { name: 'doctorVerificationStatus', in: 'query', required: false, type: 'string', enum: ['PENDING_REVIEW', 'APPROVED', 'REJECTED'], example: 'PENDING_REVIEW' },
      { name: 'page', in: 'query', required: false, type: 'integer', example: 1 },
      { name: 'limit', in: 'query', required: false, type: 'integer', example: 20 }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Filtered user list for admin review.',
        example: {
          success: true,
          data: {
            users: [
              {
                id: 'usr_doc_9901',
                email: 'dr.chen@example.com',
                name: 'Dr. Robert Chen, MD',
                role: 'DOCTOR',
                status: 'ACTIVE',
                doctorVerificationStatus: 'PENDING_REVIEW',
                createdAt: '2026-10-10T08:00:00Z'
              }
            ],
            pagination: { page: 1, limit: 20, totalCount: 1, totalPages: 1 }
          }
        }
      }
    ],
    relatedEndpointIds: [58, 59, 60]
  },
  {
    id: 58,
    method: 'GET',
    path: '/admin/users/{id}',
    moduleNumber: '11',
    moduleName: 'Admin Operations',
    summary: 'User details; approved staff only',
    description: 'Retrieves full user account metadata, login history, role flags, and medical profile details. Accessible only to approved administrative staff.',
    roles: ['ADMIN'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Admin only.',
      'Logs an administrative audit entry on access of sensitive user records.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'User ID', example: 'usr_doc_9901' }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Detailed user record.',
        example: {
          success: true,
          data: {
            id: 'usr_doc_9901',
            email: 'dr.chen@example.com',
            name: 'Dr. Robert Chen, MD',
            role: 'DOCTOR',
            status: 'ACTIVE',
            doctorLicense: {
              licenseNumber: 'MD-882910-CA',
              state: 'California',
              documentUrl: 'https://storage.dermacare.ai/secure-licenses/lic_882910.pdf',
              verificationStatus: 'PENDING_REVIEW'
            },
            auditLogsCount: 5,
            createdAt: '2026-10-10T08:00:00Z'
          }
        }
      }
    ],
    relatedEndpointIds: [57, 59, 60]
  },
  {
    id: 59,
    method: 'PATCH',
    path: '/admin/users/{id}/status',
    moduleNumber: '11',
    moduleName: 'Admin Operations',
    summary: 'Suspend or reinstate with audit record',
    description: 'Suspends or reinstates a user account. Immediate suspension revokes all active session refresh tokens and logs an immutable audit trail.',
    roles: ['ADMIN'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Status change must be ACTIVE or SUSPENDED.',
      'Requires mandatory administrative reason.',
      'Suspension immediately revokes active refresh tokens and blocks subsequent logins.',
      'Generates an immutable audit log entry in Module 16.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'User ID', example: 'usr_doc_9901' }
    ],
    requestBody: {
      description: 'Target status and justification.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        required: ['status', 'reason'],
        properties: {
          status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED'], example: 'SUSPENDED' },
          reason: { type: 'string', example: 'Report of clinical policy non-compliance pending investigation.' }
        }
      },
      example: {
        status: 'SUSPENDED',
        reason: 'Report of clinical policy non-compliance pending investigation.'
      }
    },
    responses: [
      {
        statusCode: 200,
        description: 'User status updated and audit entry recorded.',
        example: {
          success: true,
          message: 'User status updated to SUSPENDED. Active sessions revoked.',
          data: {
            userId: 'usr_doc_9901',
            newStatus: 'SUSPENDED',
            auditLogId: 'aud_991823'
          }
        }
      }
    ],
    relatedEndpointIds: [57, 58, 84]
  },
  {
    id: 60,
    method: 'PATCH',
    path: '/admin/doctors/{id}/verification',
    moduleNumber: '11',
    moduleName: 'Admin Operations',
    summary: 'Approve/reject license with reason',
    description: 'Approves or rejects a submitted medical license for a doctor with a mandatory clinical/administrative justification.',
    roles: ['ADMIN'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Single PATCH state transition: merges approve and reject into one endpoint.',
      'Enforces allowed transitions (PENDING_REVIEW -> APPROVED or REJECTED).',
      'Mandatory reason field and immutable audit record.',
      'On APPROVED: doctor becomes discoverable in public search (Module 04).'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Doctor User ID', example: 'usr_doc_9901' }
    ],
    requestBody: {
      description: 'Verification decision and justification.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        required: ['decision', 'reason'],
        properties: {
          decision: { type: 'string', enum: ['APPROVED', 'REJECTED'], example: 'APPROVED' },
          reason: { type: 'string', example: 'Verified with California Medical Board database (license active and unencumbered).' }
        }
      },
      example: {
        decision: 'APPROVED',
        reason: 'Verified with California Medical Board database (license active and unencumbered).'
      }
    },
    responses: [
      {
        statusCode: 200,
        description: 'Doctor verification decision recorded.',
        example: {
          success: true,
          data: {
            doctorId: 'usr_doc_9901',
            verificationStatus: 'APPROVED',
            verifiedBy: 'usr_admin_01',
            verifiedAt: '2026-10-13T10:48:00Z'
          }
        }
      }
    ],
    relatedEndpointIds: [12, 17, 57]
  },
  {
    id: 61,
    method: 'GET',
    path: '/admin/medicines',
    moduleNumber: '11',
    moduleName: 'Admin Operations',
    summary: 'List catalog and inventory',
    description: 'Lists all medicine catalog products along with real warehouse inventory counts, reorder thresholds, and prescription flags.',
    roles: ['ADMIN'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Admin only.',
      'Shows full stock quantities and low-stock warning thresholds.'
    ],
    parameters: [
      { name: 'page', in: 'query', required: false, type: 'integer', example: 1 },
      { name: 'limit', in: 'query', required: false, type: 'integer', example: 20 }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Complete medicine catalog inventory.',
        example: {
          success: true,
          data: {
            medicines: [
              {
                id: 'med_hc10',
                name: 'CortiCare 1% Cream',
                price: 14.5,
                stockQuantity: 120,
                reorderThreshold: 25,
                requiresPrescription: true,
                status: 'ACTIVE'
              }
            ],
            pagination: { page: 1, limit: 20, totalCount: 1, totalPages: 1 }
          }
        }
      }
    ],
    relatedEndpointIds: [45, 62, 63]
  },
  {
    id: 62,
    method: 'POST',
    path: '/admin/medicines',
    moduleNumber: '11',
    moduleName: 'Admin Operations',
    summary: 'Create catalog medicine',
    description: 'Creates a new dermatological product entry in the store catalog with stock levels, prescription requirement, and pharmaceutical metadata.',
    roles: ['ADMIN'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Admin only.',
      'Creates audit record for catalog creation.'
    ],
    requestBody: {
      description: 'Medicine details, pricing, and initial stock.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        required: ['name', 'genericName', 'strength', 'dosageForm', 'price', 'stockQuantity', 'requiresPrescription'],
        properties: {
          name: { type: 'string', example: 'CeraBarrier Restoring Balm' },
          genericName: { type: 'string', example: 'Ceramides NP/AP/EOP' },
          strength: { type: 'string', example: '5% Complex' },
          dosageForm: { type: 'string', example: 'Topical Balm' },
          category: { type: 'string', example: 'MOISTURIZER' },
          price: { type: 'number', example: 22.0 },
          stockQuantity: { type: 'integer', example: 250 },
          requiresPrescription: { type: 'boolean', example: false }
        }
      },
      example: {
        name: 'CeraBarrier Restoring Balm',
        genericName: 'Ceramides NP/AP/EOP',
        strength: '5% Complex',
        dosageForm: 'Topical Balm',
        category: 'MOISTURIZER',
        price: 22.0,
        stockQuantity: 250,
        requiresPrescription: false
      }
    },
    responses: [
      {
        statusCode: 201,
        description: 'Medicine product created in catalog.',
        example: {
          success: true,
          data: {
            id: 'med_cera01',
            name: 'CeraBarrier Restoring Balm',
            price: 22.0,
            stockQuantity: 250,
            createdAt: '2026-10-13T10:49:00Z'
          }
        }
      }
    ],
    relatedEndpointIds: [61, 63]
  },
  {
    id: 63,
    method: 'PATCH',
    path: '/admin/medicines/{id}',
    moduleNumber: '11',
    moduleName: 'Admin Operations',
    summary: 'Edit medicine, price, stock with audit',
    description: 'Modifies pricing, stock quantities, or metadata of an existing catalog product. All stock and price adjustments are audit logged.',
    roles: ['ADMIN'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Admin only.',
      'Inventory adjustments execute atomically.',
      'Generates administrative audit entry recording before and after values.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Medicine ID', example: 'med_hc10' }
    ],
    requestBody: {
      description: 'Updated price, stock delta, or metadata.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        properties: {
          price: { type: 'number', example: 15.99 },
          stockQuantity: { type: 'integer', example: 150 },
          inStock: { type: 'boolean', example: true }
        }
      },
      example: {
        price: 15.99,
        stockQuantity: 150
      }
    },
    responses: [
      {
        statusCode: 200,
        description: 'Medicine catalog updated.',
        example: {
          success: true,
          data: {
            id: 'med_hc10',
            price: 15.99,
            stockQuantity: 150,
            updatedAt: '2026-10-13T10:50:00Z'
          }
        }
      }
    ],
    relatedEndpointIds: [61, 62]
  },
  {
    id: 64,
    method: 'GET',
    path: '/admin/orders',
    moduleNumber: '11',
    moduleName: 'Admin Operations',
    summary: 'List all orders; filter and retrieve by id',
    description: 'Administrative order management endpoint. Lists all orders across patients with status filters; passing `?id=...` retrieves single order detail.',
    roles: ['ADMIN'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Contract rule: Combines list and detail retrieval under a single endpoint (?id=...).',
      'Admin only.',
      'Supports filtering by status (PENDING, CONFIRMED, PROCESSING, PACKED, OUT_FOR_DELIVERY, DELIVERED, CANCELLED).'
    ],
    parameters: [
      { name: 'id', in: 'query', required: false, type: 'string', description: 'Query specific order detail by ID', example: 'ord_990182' },
      { name: 'status', in: 'query', required: false, type: 'string', example: 'PROCESSING' },
      { name: 'page', in: 'query', required: false, type: 'integer', example: 1 },
      { name: 'limit', in: 'query', required: false, type: 'integer', example: 20 }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Order list or specific order details for admin.',
        example: {
          success: true,
          data: {
            orders: [
              {
                id: 'ord_990182',
                patientId: 'usr_9f8e7d6c5b',
                status: 'PROCESSING',
                totalAmount: 19.5,
                itemsCount: 1,
                hasPrescriptionVerified: true,
                createdAt: '2026-10-15T11:00:00Z'
              }
            ],
            pagination: { page: 1, limit: 20, totalCount: 1, totalPages: 1 }
          }
        }
      }
    ],
    relatedEndpointIds: [53, 65]
  },
  {
    id: 65,
    method: 'PATCH',
    path: '/admin/orders/{id}/status',
    moduleNumber: '11',
    moduleName: 'Admin Operations',
    summary: 'Accept/reject/cancel/fulfill; stock transaction',
    description: 'Manages fulfillment lifecycle transitions for an order. Canceling or rejecting an order executes an atomic stock restoration transaction.',
    roles: ['ADMIN'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Admin only.',
      'Allowed status values: CONFIRMED, PROCESSING, PACKED, OUT_FOR_DELIVERY, DELIVERED, CANCELLED.',
      'Atomic stock transaction: If status transitions to CANCELLED, reserved stock is automatically returned to inventory.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Order ID', example: 'ord_990182' }
    ],
    requestBody: {
      description: 'New fulfillment status and optional tracking details.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['CONFIRMED', 'PROCESSING', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'], example: 'OUT_FOR_DELIVERY' },
          trackingNumber: { type: 'string', example: 'TRK-992147-US' },
          carrier: { type: 'string', example: 'FedEx Express' }
        }
      },
      example: {
        status: 'OUT_FOR_DELIVERY',
        trackingNumber: 'TRK-992147-US',
        carrier: 'FedEx Express'
      }
    },
    responses: [
      {
        statusCode: 200,
        description: 'Order status updated and fulfillment tracked.',
        example: {
          success: true,
          data: {
            orderId: 'ord_990182',
            status: 'OUT_FOR_DELIVERY',
            trackingNumber: 'TRK-992147-US',
            updatedAt: '2026-10-15T14:30:00Z'
          }
        }
      }
    ],
    relatedEndpointIds: [64, 53]
  }
];

