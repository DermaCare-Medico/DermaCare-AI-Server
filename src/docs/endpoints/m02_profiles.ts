import { EndpointSpec } from '../spec-types';

export const PROFILES_ENDPOINTS: EndpointSpec[] = [
  {
    id: 10,
    method: 'PATCH',
    path: '/users/me/profile',
    moduleNumber: '02',
    moduleName: 'Unified Profiles',
    summary: 'Update patient or doctor profile with role-specific validation',
    description: 'Updates the authenticated caller profile. Applies strict role-specific validation (e.g. medical license & clinic info for doctors; medical history & skin type for patients).',
    roles: ['PATIENT', 'DOCTOR'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Role-specific Zod schema validation: patients cannot update clinical credentials; doctors cannot modify patient health logs.',
      'Prevents client-supplied role escalation or unauthorized property tampering.',
      'Sensitive updates are audit logged.'
    ],
    requestBody: {
      description: 'Profile update fields based on caller role.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Updated full name', example: 'Jane Doe-Smith' },
          phoneNumber: { type: 'string', description: 'Updated phone number', example: '+1-555-019-9988' },
          patientProfile: {
            type: 'object',
            description: 'Patient-specific fields (allowed only for PATIENT role)',
            properties: {
              dateOfBirth: { type: 'string', format: 'date', example: '1992-04-12' },
              skinType: { type: 'string', enum: ['I', 'II', 'III', 'IV', 'V', 'VI'], example: 'II' },
              knownAllergies: { type: 'array', items: { type: 'string' }, example: ['Penicillin', 'Sulfa'] }
            }
          },
          doctorProfile: {
            type: 'object',
            description: 'Doctor-specific fields (allowed only for DOCTOR role)',
            properties: {
              bio: { type: 'string', example: 'Board-certified dermatologist with 12 years of clinical experience.' },
              consultationFee: { type: 'number', example: 75.0 },
              specialties: { type: 'array', items: { type: 'string' }, example: ['Acne Vulgaris', 'Eczema', 'Melanoma Screening'] }
            }
          }
        }
      },
      example: {
        name: 'Jane Doe-Smith',
        phoneNumber: '+1-555-019-9988',
        patientProfile: {
          skinType: 'II',
          knownAllergies: ['Penicillin', 'Sulfa']
        }
      }
    },
    responses: [
      {
        statusCode: 200,
        description: 'Profile updated successfully.',
        example: {
          success: true,
          message: 'Profile updated successfully.',
          data: {
            userId: 'usr_9f8e7d6c5b',
            role: 'PATIENT',
            name: 'Jane Doe-Smith',
            updatedAt: '2026-10-13T10:40:00Z'
          }
        }
      },
      {
        statusCode: 400,
        description: 'Validation error (e.g. role mismatch on specific payload fields).',
        example: {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Field doctorProfile is not permitted for PATIENT role.' }
        }
      }
    ],
    relatedEndpointIds: [9, 11]
  },
  {
    id: 11,
    method: 'GET',
    path: '/patients/me/overview',
    moduleNumber: '02',
    moduleName: 'Unified Profiles',
    summary: 'Return patient dashboard and medical-history summary',
    description: 'Returns the authenticated patient personal dashboard, including recent AI screening history, upcoming appointments, active prescriptions count, and medical overview.',
    roles: ['PATIENT'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Caller must be authenticated and have role PATIENT.',
      'Aggregates active prescriptions, upcoming appointments, and latest AI screenings into a safe summary.'
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Patient medical overview and dashboard data.',
        example: {
          success: true,
          data: {
            patientId: 'usr_9f8e7d6c5b',
            screeningCount: 4,
            upcomingAppointmentsCount: 1,
            activePrescriptionsCount: 2,
            latestScreening: {
              id: 'scr_01h8q7v9',
              createdAt: '2026-10-10T14:22:00Z',
              detectedCondition: 'Atopic Dermatitis',
              riskLevel: 'LOW',
              confidenceScore: 0.88
            },
            nextAppointment: {
              id: 'apt_55102',
              scheduledAt: '2026-10-15T09:30:00Z',
              doctorName: 'Dr. Robert Chen, MD'
            }
          }
        }
      },
      {
        statusCode: 403,
        description: 'Forbidden; caller is not a patient.',
        example: {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access restricted to Patient accounts.' }
        }
      }
    ],
    relatedEndpointIds: [9, 10, 14, 25]
  },
  {
    id: 12,
    method: 'POST',
    path: '/doctors/me/license',
    moduleNumber: '02',
    moduleName: 'Unified Profiles',
    summary: 'Submit doctor verification document; retrieve verification status through /auth/me',
    description: 'Submits a medical license document or board certificate for administrative verification. Places doctor license status into PENDING_REVIEW.',
    roles: ['DOCTOR'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Caller must have role DOCTOR.',
      'Transitions doctor license verification status to PENDING_REVIEW.',
      'Verification status is retrieved through GET /auth/me.',
      'License documents are stored in secure private medical object storage; review is restricted to verified admins.'
    ],
    requestBody: {
      description: 'Medical board license registration and verification file metadata.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        required: ['licenseNumber', 'issuingState', 'documentUrl', 'expiryDate'],
        properties: {
          licenseNumber: { type: 'string', description: 'State or national medical board license identifier', example: 'MD-882910-CA' },
          issuingState: { type: 'string', description: 'Jurisdiction / country / state of license issue', example: 'California, USA' },
          documentUrl: { type: 'string', format: 'uri', description: 'Encrypted document location or pre-signed upload reference', example: 'https://storage.dermacare.ai/secure-licenses/lic_882910.pdf' },
          expiryDate: { type: 'string', format: 'date', description: 'License expiration date', example: '2028-12-31' }
        }
      },
      example: {
        licenseNumber: 'MD-882910-CA',
        issuingState: 'California, USA',
        documentUrl: 'https://storage.dermacare.ai/secure-licenses/lic_882910.pdf',
        expiryDate: '2028-12-31'
      }
    },
    responses: [
      {
        statusCode: 201,
        description: 'License submitted for administrative review.',
        example: {
          success: true,
          message: 'License documents submitted. Verification status is now PENDING_REVIEW.',
          data: {
            verificationStatus: 'PENDING_REVIEW',
            submittedAt: '2026-10-13T10:40:00Z'
          }
        }
      },
      {
        statusCode: 400,
        description: 'Invalid license submission data.',
        example: {
          success: false,
          error: { code: 'INVALID_LICENSE_DATA', message: 'License number and valid future expiration date are required.' }
        }
      }
    ],
    relatedEndpointIds: [9, 60]
  }
];

