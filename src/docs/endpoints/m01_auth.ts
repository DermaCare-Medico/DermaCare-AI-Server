import { EndpointSpec } from '../spec-types';

export const AUTH_ENDPOINTS: EndpointSpec[] = [
  {
    id: 1,
    method: 'POST',
    path: '/auth/register',
    moduleNumber: '01',
    moduleName: 'Authentication',
    summary: 'Register patient or doctor and start OTP verification',
    description: 'Registers a new user account with role Patient or Doctor. Generates a secure time-limited OTP sent to the supplied email for identity activation.',
    roles: ['PUBLIC'],
    authRequired: false,
    authType: 'None',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Account begins in PENDING_VERIFICATION status.',
      'Generates a 6-digit cryptographic OTP valid for 10 minutes.',
      'Doctor accounts require subsequent medical license submission via POST /doctors/me/license.'
    ],
    requestBody: {
      description: 'Registration credentials and initial user profile data.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        required: ['email', 'password', 'role', 'name'],
        properties: {
          email: { type: 'string', format: 'email', description: 'Unique user email address', example: 'patient.jane@example.com' },
          password: { type: 'string', format: 'password', description: 'Strong password with min 8 chars, 1 uppercase, 1 symbol', example: 'SecureDermal#2026' },
          role: { type: 'string', enum: ['PATIENT', 'DOCTOR'], description: 'Initial account role', example: 'PATIENT' },
          name: { type: 'string', description: 'Full legal name', example: 'Jane Doe' },
          phoneNumber: { type: 'string', description: 'Optional contact phone number', example: '+1-555-019-2834' }
        }
      },
      example: {
        email: 'patient.jane@example.com',
        password: 'SecureDermal#2026',
        role: 'PATIENT',
        name: 'Jane Doe',
        phoneNumber: '+1-555-019-2834'
      }
    },
    responses: [
      {
        statusCode: 201,
        description: 'Account created successfully; OTP dispatched to email.',
        example: {
          success: true,
          message: 'Verification code sent to patient.jane@example.com',
          data: {
            userId: 'usr_9f8e7d6c5b',
            email: 'patient.jane@example.com',
            role: 'PATIENT',
            status: 'PENDING_VERIFICATION',
            expiresIn: 600
          }
        }
      },
      {
        statusCode: 400,
        description: 'Validation failed or email already registered.',
        example: {
          success: false,
          error: { code: 'EMAIL_ALREADY_EXISTS', message: 'An account with this email already exists.' }
        }
      }
    ],
    relatedEndpointIds: [2, 3, 4]
  },
  {
    id: 2,
    method: 'POST',
    path: '/auth/verify-otp',
    moduleNumber: '01',
    moduleName: 'Authentication',
    summary: 'Verify email OTP and activate registration',
    description: 'Validates the submitted 6-digit email OTP. On success, transitions user status to ACTIVE and issues initial authentication session tokens.',
    roles: ['PUBLIC'],
    authRequired: false,
    authType: 'None',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Maximum 5 failed attempts allowed before OTP invalidation.',
      'Transitions user state from PENDING_VERIFICATION to ACTIVE.',
      'Issues short-lived JWT access token (15 mins) and HTTP-only refresh token (7 days).'
    ],
    requestBody: {
      description: 'Email and 6-digit OTP code.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        required: ['email', 'otp'],
        properties: {
          email: { type: 'string', format: 'email', description: 'Registered email address', example: 'patient.jane@example.com' },
          otp: { type: 'string', description: '6-digit numeric verification code', example: '492817' }
        }
      },
      example: {
        email: 'patient.jane@example.com',
        otp: '492817'
      }
    },
    responses: [
      {
        statusCode: 200,
        description: 'OTP verified successfully; session tokens issued.',
        example: {
          success: true,
          message: 'Account verified and activated.',
          data: {
            accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.exampleAccessToken...',
            expiresIn: 900,
            user: {
              id: 'usr_9f8e7d6c5b',
              email: 'patient.jane@example.com',
              role: 'PATIENT',
              status: 'ACTIVE'
            }
          }
        }
      },
      {
        statusCode: 400,
        description: 'Invalid or expired OTP code.',
        example: {
          success: false,
          error: { code: 'INVALID_OTP', message: 'The provided verification code is incorrect or expired.' }
        }
      }
    ],
    relatedEndpointIds: [1, 3, 4]
  },
  {
    id: 3,
    method: 'POST',
    path: '/auth/resend-otp',
    moduleNumber: '01',
    moduleName: 'Authentication',
    summary: 'Resend rate-limited OTP',
    description: 'Regenerates and dispatches a new verification OTP to the target email. Strictly throttled to prevent spam and abuse.',
    roles: ['PUBLIC'],
    authRequired: false,
    authType: 'None',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Rate-limited: 60-second cooldown between resend requests.',
      'Invalidates any previously issued unexpired OTP for this account.'
    ],
    requestBody: {
      description: 'User email and OTP reason.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email', description: 'Target email address', example: 'patient.jane@example.com' },
          type: { type: 'string', enum: ['REGISTRATION', 'PASSWORD_RESET'], description: 'OTP purpose', example: 'REGISTRATION' }
        }
      },
      example: {
        email: 'patient.jane@example.com',
        type: 'REGISTRATION'
      }
    },
    responses: [
      {
        statusCode: 200,
        description: 'New verification OTP generated and dispatched.',
        example: {
          success: true,
          message: 'A new verification code has been dispatched.',
          data: { cooldownSeconds: 60 }
        }
      },
      {
        statusCode: 429,
        description: 'Rate limit exceeded.',
        example: {
          success: false,
          error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Please wait 45 seconds before requesting another code.' }
        }
      }
    ],
    relatedEndpointIds: [1, 2]
  },
  {
    id: 4,
    method: 'POST',
    path: '/auth/login',
    moduleNumber: '01',
    moduleName: 'Authentication',
    summary: 'Issue access and refresh credentials',
    description: 'Authenticates user credentials, validates account status, and issues access token and refresh token credentials.',
    roles: ['PUBLIC'],
    authRequired: false,
    authType: 'None',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Rejects login if user status is PENDING_VERIFICATION or SUSPENDED.',
      'Access token expires in 15 minutes (900s).',
      'Refresh token is delivered via Secure HTTP-Only cookie with SameSite=Strict and expires in 7 days.'
    ],
    requestBody: {
      description: 'User login credentials.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', description: 'Account email', example: 'patient.jane@example.com' },
          password: { type: 'string', format: 'password', description: 'Account password', example: 'SecureDermal#2026' }
        }
      },
      example: {
        email: 'patient.jane@example.com',
        password: 'SecureDermal#2026'
      }
    },
    responses: [
      {
        statusCode: 200,
        description: 'Authentication successful; credentials issued.',
        example: {
          success: true,
          data: {
            accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            tokenType: 'Bearer',
            expiresIn: 900,
            user: {
              id: 'usr_9f8e7d6c5b',
              email: 'patient.jane@example.com',
              role: 'PATIENT',
              name: 'Jane Doe'
            }
          }
        }
      },
      {
        statusCode: 401,
        description: 'Invalid credentials or inactive account.',
        example: {
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' }
        }
      }
    ],
    relatedEndpointIds: [5, 6, 9]
  },
  {
    id: 5,
    method: 'POST',
    path: '/auth/logout',
    moduleNumber: '01',
    moduleName: 'Authentication',
    summary: 'Revoke refresh session',
    description: 'Revokes the active refresh token session in the database and clears the refresh session cookie.',
    roles: ['PATIENT', 'DOCTOR', 'ADMIN'],
    authRequired: true,
    authType: 'BearerAuth | CookieAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Revokes stored refresh token hash in database.',
      'Clears HTTP-only refresh session cookie.'
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Logged out successfully; session invalidated.',
        example: {
          success: true,
          message: 'Session revoked successfully.'
        }
      },
      {
        statusCode: 401,
        description: 'Unauthorized; missing or invalid session token.',
        example: {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Session token is invalid or expired.' }
        }
      }
    ],
    relatedEndpointIds: [4, 6]
  },
  {
    id: 6,
    method: 'POST',
    path: '/auth/refresh-token',
    moduleNumber: '01',
    moduleName: 'Authentication',
    summary: 'Rotate refresh token',
    description: 'Rotates the refresh token and issues a new access token. Employs refresh token reuse detection to guard against token theft.',
    roles: ['PUBLIC'],
    authRequired: false,
    authType: 'CookieAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Rotates refresh token upon every use.',
      'If a previously used refresh token is presented, all user sessions are immediately revoked (reuse detection safeguard).'
    ],
    requestBody: {
      description: 'Optional refresh token in body if cookies are not used.',
      required: false,
      contentType: 'application/json',
      schema: {
        type: 'object',
        properties: {
          refreshToken: { type: 'string', description: 'Refresh token string', example: 'rft_a1b2c3d4e5f6...' }
        }
      },
      example: {
        refreshToken: 'rft_a1b2c3d4e5f6...'
      }
    },
    responses: [
      {
        statusCode: 200,
        description: 'Tokens rotated successfully.',
        example: {
          success: true,
          data: {
            accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            expiresIn: 900
          }
        }
      },
      {
        statusCode: 401,
        description: 'Invalid or revoked refresh token.',
        example: {
          success: false,
          error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token is expired, revoked, or already reused.' }
        }
      }
    ],
    relatedEndpointIds: [4, 5]
  },
  {
    id: 7,
    method: 'POST',
    path: '/auth/forgot-password',
    moduleNumber: '01',
    moduleName: 'Authentication',
    summary: 'Initiate password-reset OTP',
    description: 'Initiates a password recovery request and dispatches a secure reset code to the verified user email.',
    roles: ['PUBLIC'],
    authRequired: false,
    authType: 'None',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Rate-limited: 60-second cooldown per account.',
      'Returns generic success message regardless of email existence to prevent user enumeration attacks.'
    ],
    requestBody: {
      description: 'Target account email.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email', description: 'Registered email address', example: 'patient.jane@example.com' }
        }
      },
      example: {
        email: 'patient.jane@example.com'
      }
    },
    responses: [
      {
        statusCode: 200,
        description: 'Reset request received. If email exists, OTP was dispatched.',
        example: {
          success: true,
          message: 'If the email matches an account, a reset code has been sent.'
        }
      }
    ],
    relatedEndpointIds: [8]
  },
  {
    id: 8,
    method: 'POST',
    path: '/auth/reset-password',
    moduleNumber: '01',
    moduleName: 'Authentication',
    summary: 'Verify reset proof and change password',
    description: 'Verifies the password reset OTP code and updates the account password with cryptographic hashing.',
    roles: ['PUBLIC'],
    authRequired: false,
    authType: 'None',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Enforces password complexity rules (minimum 8 characters, numbers, uppercase, symbols).',
      'Invalidates all active refresh tokens upon successful password reset.'
    ],
    requestBody: {
      description: 'Reset code and new password.',
      required: true,
      contentType: 'application/json',
      schema: {
        type: 'object',
        required: ['email', 'otp', 'newPassword'],
        properties: {
          email: { type: 'string', format: 'email', description: 'Account email', example: 'patient.jane@example.com' },
          otp: { type: 'string', description: '6-digit verification code', example: '839201' },
          newPassword: { type: 'string', format: 'password', description: 'New strong password', example: 'BrandNewSecure#2026' }
        }
      },
      example: {
        email: 'patient.jane@example.com',
        otp: '839201',
        newPassword: 'BrandNewSecure#2026'
      }
    },
    responses: [
      {
        statusCode: 200,
        description: 'Password reset successfully.',
        example: {
          success: true,
          message: 'Password has been successfully updated. Please log in.'
        }
      },
      {
        statusCode: 400,
        description: 'Invalid OTP or password does not meet criteria.',
        example: {
          success: false,
          error: { code: 'INVALID_RESET_PROOF', message: 'The verification code is invalid or has expired.' }
        }
      }
    ],
    relatedEndpointIds: [4, 7]
  },
  {
    id: 9,
    method: 'GET',
    path: '/auth/me',
    moduleNumber: '01',
    moduleName: 'Authentication',
    summary: 'Return role-aware identity and safe profile summary',
    description: 'Unifies role-specific profile reads under a single endpoint. Returns safe user identity, active role, permissions, and doctor verification status if applicable.',
    roles: ['PATIENT', 'DOCTOR', 'ADMIN'],
    authRequired: true,
    authType: 'BearerAuth',
    implementationStatus: 'Specified but not implemented',
    statusNotes: 'Specified in MVP contract. Backend route not yet implemented in repository.',
    businessRules: [
      'Never returns password hashes or private cryptographic salts.',
      'For doctors, includes license verification status (PENDING_REVIEW, APPROVED, REJECTED).',
      'For patients, includes active subscription tier (FREE, PREMIUM).'
    ],
    responses: [
      {
        statusCode: 200,
        description: 'Identity and safe profile summary.',
        example: {
          success: true,
          data: {
            id: 'usr_9f8e7d6c5b',
            email: 'patient.jane@example.com',
            role: 'PATIENT',
            name: 'Jane Doe',
            phoneNumber: '+1-555-019-2834',
            status: 'ACTIVE',
            emailVerified: true,
            subscriptionTier: 'PREMIUM',
            profile: {
              dateOfBirth: '1992-04-12',
              gender: 'FEMALE',
              knownAllergies: ['Penicillin'],
              skinType: 'Fitzpatrick Type II'
            }
          }
        }
      },
      {
        statusCode: 401,
        description: 'Unauthorized; token missing or expired.',
        example: {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required.' }
        }
      }
    ],
    relatedEndpointIds: [4, 10, 11, 12]
  }
];

