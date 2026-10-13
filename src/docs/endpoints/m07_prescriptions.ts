import type { EndpointSpec } from '../spec-types.js';

export const PRESCRIPTIONS_ENDPOINTS: EndpointSpec[] = [
  {
    id: 35,
    method: 'POST',
    path: '/appointments/{id}/prescriptions',
    moduleNumber: '07',
    moduleName: 'Prescriptions & Medication',
    summary: 'Create draft for consultation',
    description: 'Initializes a new draft digital prescription for the specified completed or in-progress consultation.',
    roles: ['DOCTOR'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'ONLY the treating doctor assigned to this appointment can author a prescription.',
      'Initial version number starts at 1 in DRAFT status.',
      'A draft cannot be used for purchasing medicine until finalized.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Appointment ID', example: 'apt_55102' }
    ],
    requestBody: {
      description: 'Prescription header notes and initial draft medications.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        required: ['diagnosis', 'items'],
        properties: {
          diagnosis: { type: 'string', description: 'Clinical diagnosis', example: 'Atopic Dermatitis (L20.9)' },
          doctorNotes: { type: 'string', description: 'General instructions to patient', example: 'Apply sparingly to affected areas.' },
          items: {
            type: 'array',
            description: 'List of prescribed medication items',
            items: {
              type: 'object',
              required: ['medicineName', 'dosage', 'frequency', 'durationDays'],
              properties: {
                medicineName: { type: 'string', example: 'Hydrocortisone 1% Cream' },
                dosage: { type: 'string', example: 'Thin layer' },
                frequency: { type: 'string', example: 'Twice daily' },
                durationDays: { type: 'integer', example: 7 },
                instructions: { type: 'string', example: 'Apply after lukewarm shower' }
              }
            }
          }
        }
      },
      example: {
        diagnosis: 'Atopic Dermatitis (L20.9)',
        doctorNotes: 'Apply sparingly to affected areas.',
        items: [
          {
            medicineName: 'Hydrocortisone 1% Cream',
            dosage: 'Thin layer',
            frequency: 'Twice daily',
            durationDays: 7,
            instructions: 'Apply after lukewarm shower'
          }
        ]
      }
    },
    responses: [
      {
        statusCode: 201,
        description: 'Draft prescription created.',
        example: {
          success: true,
          data: {
            prescriptionId: 'rx_77810',
            appointmentId: 'apt_55102',
            doctorId: 'doc_44120',
            patientId: 'usr_9f8e7d6c5b',
            status: 'DRAFT',
            version: 1,
            itemCount: 1,
            createdAt: '2026-10-15T10:00:00Z'
          }
        }
      }
    ],
    relatedEndpointIds: [36, 37, 38, 39, 40]
  },
  {
    id: 36,
    method: 'GET',
    path: '/prescriptions',
    moduleNumber: '07',
    moduleName: 'Prescriptions & Medication',
    summary: 'Role-scoped prescription list',
    description: 'Lists prescriptions scoped to the caller role. Patients view their own prescriptions; doctors view prescriptions they have authored; admins can view all.',
    roles: ['PATIENT', 'DOCTOR', 'ADMIN'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Role scoping: Patients cannot query other patients prescriptions.',
      'Supports filtering by status (DRAFT, FINALIZED).'
    ],
    parameters: [
      { name: 'status', in: 'query', required: false, type: 'string', enum: ['DRAFT', 'FINALIZED'], example: 'FINALIZED' },
      { name: 'page', in: 'query', required: false, type: 'integer', example: 1 },
      { name: 'limit', in: 'query', required: false, type: 'integer', example: 10 }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Paginated prescription list.',
        example: {
          success: true,
          data: {
            prescriptions: [
              {
                id: 'rx_77810',
                doctorName: 'Dr. Robert Chen, MD',
                diagnosis: 'Atopic Dermatitis',
                status: 'FINALIZED',
                version: 1,
                itemCount: 1,
                finalizedAt: '2026-10-15T10:05:00Z'
              }
            ],
            pagination: { page: 1, limit: 10, totalCount: 1, totalPages: 1 }
          }
        }
      }
    ],
    relatedEndpointIds: [35, 37, 41]
  },
  {
    id: 37,
    method: 'GET',
    path: '/prescriptions/{id}',
    moduleNumber: '07',
    moduleName: 'Prescriptions & Medication',
    summary: 'Get prescription and versions',
    description: 'Retrieves complete prescription record, including medication items and version history.',
    roles: ['PATIENT', 'DOCTOR', 'ADMIN'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Ownership and role check: caller must be the patient, the prescribing doctor, or an admin.',
      'Displays full version history if amendments have occurred.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Prescription ID', example: 'rx_77810' }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Prescription details and items.',
        example: {
          success: true,
          data: {
            id: 'rx_77810',
            appointmentId: 'apt_55102',
            doctorId: 'doc_44120',
            doctorName: 'Dr. Robert Chen, MD',
            patientId: 'usr_9f8e7d6c5b',
            patientName: 'Jane Doe',
            diagnosis: 'Atopic Dermatitis (L20.9)',
            status: 'FINALIZED',
            version: 1,
            items: [
              {
                id: 'rxi_01',
                medicineName: 'Hydrocortisone 1% Cream',
                dosage: 'Thin layer',
                frequency: 'Twice daily',
                durationDays: 7,
                instructions: 'Apply after lukewarm shower'
              }
            ],
            versionHistory: [
              { version: 1, status: 'FINALIZED', finalizedAt: '2026-10-15T10:05:00Z' }
            ]
          }
        }
      }
    ],
    relatedEndpointIds: [36, 38, 40]
  },
  {
    id: 38,
    method: 'PATCH',
    path: '/prescriptions/{id}',
    moduleNumber: '07',
    moduleName: 'Prescriptions & Medication',
    summary: 'Edit draft only',
    description: 'Modifies metadata or doctor notes on a draft prescription. Edits to finalized prescriptions are strictly rejected.',
    roles: ['DOCTOR'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Prescription MUST be in DRAFT status.',
      'Finalized prescriptions are immutable; attempting to edit a finalized prescription returns 409 Conflict.',
      'Only the treating authoring doctor can edit.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Prescription ID', example: 'rx_77810' }
    ],
    requestBody: {
      description: 'Prescription fields to update.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        properties: {
          diagnosis: { type: 'string', example: 'Atopic Dermatitis with secondary xerosis' },
          doctorNotes: { type: 'string', example: 'Updated: Use moisturizer 10 mins prior.' }
        }
      },
      example: {
        diagnosis: 'Atopic Dermatitis with secondary xerosis',
        doctorNotes: 'Updated: Use moisturizer 10 mins prior.'
      }
    },
    responses: [
      {
        statusCode: 200,
        description: 'Draft prescription updated.',
        example: {
          success: true,
          data: {
            id: 'rx_77810',
            status: 'DRAFT',
            diagnosis: 'Atopic Dermatitis with secondary xerosis',
            updatedAt: '2026-10-15T10:02:00Z'
          }
        }
      },
      {
        statusCode: 409,
        description: 'Conflict; prescription is already finalized.',
        example: {
          success: false,
          error: { code: 'PRESCRIPTION_IMMUTABLE', message: 'Finalized prescriptions cannot be modified. Create a new version amendment.' }
        }
      }
    ],
    relatedEndpointIds: [37, 39, 40]
  },
  {
    id: 39,
    method: 'PUT',
    path: '/prescriptions/{id}/items',
    moduleNumber: '07',
    moduleName: 'Prescriptions & Medication',
    summary: 'Replace draft medication items atomically',
    description: 'Atomically replaces the full array of medication items for a draft prescription in a single database transaction.',
    roles: ['DOCTOR'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Applies only to prescriptions in DRAFT status.',
      'Atomic replacement ensures no orphaned or partially updated medication lines.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Prescription ID', example: 'rx_77810' }
    ],
    requestBody: {
      description: 'New full list of medication items.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['medicineName', 'dosage', 'frequency', 'durationDays'],
              properties: {
                medicineName: { type: 'string', example: 'Hydrocortisone 1% Cream' },
                dosage: { type: 'string', example: 'Thin layer' },
                frequency: { type: 'string', example: 'Twice daily' },
                durationDays: { type: 'integer', example: 10 }
              }
            }
          }
        }
      },
      example: {
        items: [
          {
            medicineName: 'Hydrocortisone 1% Cream',
            dosage: 'Thin layer',
            frequency: 'Twice daily',
            durationDays: 10
          }
        ]
      }
    },
    responses: [
      {
        statusCode: 200,
        description: 'Prescription items atomically replaced.',
        example: {
          success: true,
          message: 'Medication items updated.',
          data: {
            prescriptionId: 'rx_77810',
            itemCount: 1
          }
        }
      }
    ],
    relatedEndpointIds: [37, 38, 40]
  },
  {
    id: 40,
    method: 'POST',
    path: '/prescriptions/{id}/finalize',
    moduleNumber: '07',
    moduleName: 'Prescriptions & Medication',
    summary: 'Finalize immutable prescription version',
    description: 'Freezes the draft prescription into an immutable legal version record and unlocks medicine store ordering.',
    roles: ['DOCTOR'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Irreversible clinical action: finalization permanently locks the current version.',
      'Only the authoring doctor can finalize.',
      'Generates a cryptographic checksum / signature of the finalized record.',
      'Prescription becomes eligible for medicine order fulfillment in Module 09.'
    ],
    parameters: [
      { name: 'id', in: 'path', required: true, type: 'string', description: 'Prescription ID', example: 'rx_77810' }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Prescription finalized successfully.',
        example: {
          success: true,
          message: 'Prescription frozen into immutable Version 1.',
          data: {
            prescriptionId: 'rx_77810',
            status: 'FINALIZED',
            version: 1,
            finalizedAt: '2026-10-15T10:05:00Z',
            digitalSignature: 'sig_ed25519_88a91b2c3d4e'
          }
        }
      },
      {
        statusCode: 400,
        description: 'Prescription contains 0 items or is already finalized.',
        example: {
          success: false,
          error: { code: 'INVALID_PRESCRIPTION_STATE', message: 'Cannot finalize an empty prescription or already finalized document.' }
        }
      }
    ],
    relatedEndpointIds: [35, 37, 41, 49, 52]
  },
  {
    id: 41,
    method: 'GET',
    path: '/medications',
    moduleNumber: '07',
    moduleName: 'Prescriptions & Medication',
    summary: 'Filter status=current/history; derive from finalized Rx',
    description: 'Retrieves patient medications derived strictly from finalized prescriptions, filtered by active/current vs past medical history.',
    roles: ['PATIENT', 'DOCTOR'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Derived strictly from finalized prescriptions; draft prescriptions are excluded.',
      'Query parameter ?status=current filters medications within their prescribed durationDays window.',
      'Query parameter ?status=history returns expired medication courses.'
    ],
    parameters: [
      { name: 'status', in: 'query', required: false, type: 'string', enum: ['current', 'history'], description: 'Medication status filter', example: 'current' },
      { name: 'patientId', in: 'query', required: false, type: 'string', description: 'Doctor can query specific consented patient', example: 'usr_9f8e7d6c5b' }
    ],
    responses: [
      {
        statusCode: 200,
        description: 'List of active or historical patient medications.',
        example: {
          success: true,
          data: [
            {
              id: 'med_01',
              medicineName: 'Hydrocortisone 1% Cream',
              dosage: 'Thin layer twice daily',
              prescribedBy: 'Dr. Robert Chen, MD',
              startDate: '2026-10-15',
              endDate: '2026-10-25',
              status: 'current'
            }
          ]
        }
      }
    ],
    relatedEndpointIds: [36, 40, 45]
  }
];

