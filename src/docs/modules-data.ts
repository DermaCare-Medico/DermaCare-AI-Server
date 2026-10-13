import type { ModuleDef } from './spec-types.js';

export const MODULES: ModuleDef[] = [
  {
    number: '01',
    id: 'auth',
    name: 'Authentication',
    description: 'Patient and doctor registration, email OTP verification, JWT access/refresh token lifecycle, and secure identity recovery.',
    icon: 'shield-lock',
    businessRules: [
      'Issue access token with 15-minute validity and HTTP-only refresh token with 7-day rotation.',
      'Enforce rate limiting on OTP request endpoints (/auth/resend-otp, /auth/forgot-password).',
      'Unified profile reads are consolidated under GET /auth/me, returning only safe profile summaries.',
      'Never trust client-supplied role or userId as proof of authorization.'
    ]
  },
  {
    number: '02',
    id: 'profiles',
    name: 'Unified Profiles',
    description: 'Role-specific profile management for patients and doctors, medical history summaries, and clinical license verification submissions.',
    icon: 'user-check',
    businessRules: [
      'PATCH /users/me/profile applies strict role-specific Zod schema validation depending on the caller identity.',
      'GET /patients/me/overview provides consolidated medical history summary for the logged-in patient.',
      'POST /doctors/me/license accepts verification documents; review status is read via /auth/me and moderated by Admin.',
      'Protected healthcare information (PHI) is isolated and access is restricted to verified identities.'
    ]
  },
  {
    number: '03',
    id: 'screenings',
    name: 'AI Screening & Conditions',
    description: 'Dermatological AI image and symptom screening, preliminary risk calculation, confidence scoring, and condition encyclopedia reference.',
    icon: 'activity',
    businessRules: [
      'AI screening results are strictly preliminary and MUST NEVER be presented as a definitive clinical diagnosis.',
      'Safety rule: Confidence below 60% suppresses natural-care and home-treatment suggestions.',
      'Safety rule: High-risk scores above 20% trigger immediate clinical consultation warnings.',
      'Safety rule: Red-flag symptoms override all algorithms and force emergency clinical escalation.',
      'All uploaded medical images must be stored privately; pre-consultation access requires explicit patient consent.'
    ]
  },
  {
    number: '04',
    id: 'doctor-discovery',
    name: 'Doctor Discovery',
    description: 'Specialist search, filtering by verified credentials, condition-based matching via screeningId, and public slot inspection.',
    icon: 'search',
    businessRules: [
      'Only approved, verified doctors with active licenses appear in search results.',
      'Passing ?screeningId=... enables intelligent matching based on detected condition category.',
      'Public doctor slot queries MUST hide booked, held, and unavailable slots from unauthenticated/public callers.',
      'Doctor featured status (sponsored) must NEVER bias or alter clinical matching algorithm accuracy.'
    ]
  },
  {
    number: '05',
    id: 'booking',
    name: 'Booking & Availability',
    description: 'Doctor slot schedule management, atomic 10-minute temporary holds, booking confirmation with patient consent, and cancellation workflows.',
    icon: 'calendar',
    businessRules: [
      'Appointment holds last exactly 10 minutes and require atomic database reservations to eliminate double-booking.',
      'Doctors cannot edit or delete slots that are currently held or confirmed.',
      'Booking confirmation requires explicit patient consent for sharing pre-consultation medical data with the booked doctor.',
      'Patient cancellation requests require doctor or admin approval; direct cancellation is restricted to doctor or admin.'
    ]
  },
  {
    number: '06',
    id: 'consultation',
    name: 'Consultation',
    description: 'Consent-gated clinical history access, time-limited Jitsi telemedicine video sessions, consultation state transitions, and clinical note authoring.',
    icon: 'video',
    businessRules: [
      'Pre-consultation history is accessible ONLY to the booked doctor after explicit patient consent has been verified.',
      'Telemedicine video session tokens are scoped exclusively to the specific appointment and strictly time-limited.',
      'Consultation status progression follows strict finite state transitions (SCHEDULED -> IN_PROGRESS -> COMPLETED).',
      'Clinical consultation notes can be updated only before final closure of the consultation session.'
    ]
  },
  {
    number: '07',
    id: 'prescriptions',
    name: 'Prescriptions & Medication',
    description: 'Doctor prescription authoring, atomic draft medication item replacement, immutable version finalization, and derived medication tracking.',
    icon: 'file-text',
    businessRules: [
      'ONLY the treating doctor assigned to the completed consultation may author or edit prescriptions.',
      'Finalizing a prescription freezes that version into an immutable legal record.',
      'Prescription amendments must create new numbered versions rather than silently altering finalized versions.',
      'GET /medications allows filtering current vs historical medications derived strictly from finalized prescriptions.'
    ]
  },
  {
    number: '08',
    id: 'chat',
    name: 'Post-consultation Chat',
    description: 'Time-windowed post-consultation secure text messaging between the verified patient and the assigned doctor.',
    icon: 'message-square',
    businessRules: [
      'Post-consultation text messaging is strictly restricted to text only (no media/attachments in this MVP).',
      'Access is exclusively granted to the verified patient and the treating doctor for that specific consultation.',
      'The chat window automatically expires 7 days after the completed consultation.',
      'No sponsored advertisements or third-party content may ever be injected into the medical chat window.'
    ]
  },
  {
    number: '09',
    id: 'store',
    name: 'Store & Orders',
    description: 'Fictional dermatological medicine catalog, generic alternatives matching, cart management with Rx verification, and order placement.',
    icon: 'shopping-bag',
    businessRules: [
      'Orders and cart items requiring a prescription must reference a valid, finalized prescription authored by a verified doctor.',
      'Medicine alternative matching requires exact matching of active generic substance, strength, and dosage form.',
      'Fictional order placement validates inventory atomically and checks prescription eligibility and live pricing.',
      'Inventory adjustments must be atomic, with stock restored upon order cancellation.'
    ]
  },
  {
    number: '10',
    id: 'payments',
    name: 'Sandbox Payments',
    description: 'Sandbox payment transaction creation for bookings, medicine orders, and subscription tiers, with server-controlled demo simulation.',
    icon: 'credit-card',
    businessRules: [
      'All payment endpoints operate in a simulated sandbox environment; no real financial card data or live gateways are invoked.',
      'Server-controlled simulation endpoint (/payments/{id}/simulate) executes verified state transitions (SUCCESS / FAILED).',
      'Payment completion triggers atomic state changes on the associated booking, medicine order, or subscription.',
      'All payment records maintain audit trails and idempotency tracking.'
    ]
  },
  {
    number: '11',
    id: 'admin',
    name: 'Admin Operations',
    description: 'Administrative user governance, doctor license verification and approval, catalog management, and order fulfillment workflows.',
    icon: 'sliders',
    businessRules: [
      'Restricted strictly to authenticated users with the ADMIN role; authorization proof cannot be client-supplied.',
      'Doctor license approval/rejection requires a documented administrative reason and creates an immutable audit record.',
      'User status changes (suspension / reinstatement) immediately revoke active refresh tokens and log audit entries.',
      'Medicine catalog edits (pricing, stock adjustments) must be audited and inventory operations must be atomic.'
    ]
  },
  {
    number: '12',
    id: 'notifications',
    name: 'Notifications',
    description: 'In-app clinical and transactional notification inbox, unread count polling, and read state synchronization.',
    icon: 'bell',
    businessRules: [
      'Notifications deliver transactional clinical alerts (appointment reminders, prescription finalization, order status updates).',
      'GET /notifications returns paginated notifications along with an exact unreadCount badge metric.',
      'PATCH /notifications/{id}/read marks single notification as read; callers may only update their own notifications.'
    ]
  },
  {
    number: '13',
    id: 'health-images',
    name: 'Health & Secure Images',
    description: 'System health liveness probe and secure, time-limited presigned URL generation for private medical imagery.',
    icon: 'lock',
    businessRules: [
      'GET /health provides minimal public liveness check without leaking server secrets, database credentials, or system paths.',
      'GET /uploads/medical-images/{id}/signed-url issues a short-lived presigned URL only after strict ownership and consent verification.',
      'Private medical imagery must NEVER be accessible via static public CDN links without tokenized signatures.'
    ]
  },
  {
    number: '14',
    id: 'subscriptions',
    name: 'Subscriptions',
    description: 'Patient premium tier and doctor featured visibility subscription plans, sandbox checkout, usage tracking, and quota enforcement.',
    icon: 'award',
    businessRules: [
      'Free quota baseline: 3 AI skin screenings per day and 2 doctor appointments per month.',
      'Premium tier unlocks unlimited AI screenings and priority scheduling according to proposed contract.',
      'Doctor featured subscription status increases catalog visibility but MUST NEVER alter clinical matching scores.',
      'Admin creates and manages subscription tier pricing and quota boundaries.'
    ]
  },
  {
    number: '15',
    id: 'sponsorships',
    name: 'Sponsored Content',
    description: 'Placement-targeted healthcare product sponsorships, campaign scheduling, and administrative ad moderation.',
    icon: 'tag',
    businessRules: [
      'Sponsored content must ALWAYS be explicitly labeled as "Sponsored".',
      'Strict safety boundary: Sponsored ads MUST NEVER appear on AI screening results, emergency alerts, consultations, prescriptions, or chats.',
      'Impression/click tracking was intentionally omitted from this MVP design; analytics do not collect ad interaction counts.',
      'Campaigns support placement targeting (e.g. HOME_BANNER, STORE_SIDEBAR) with start and end schedule enforcement.'
    ]
  },
  {
    number: '16',
    id: 'analytics',
    name: 'Advanced Analytics',
    description: 'Aggregated administrative metrics, time-series operational trends, fictional sandbox revenue reporting, and clinical audit logging.',
    icon: 'bar-chart-2',
    businessRules: [
      'Analytics endpoints deliver strictly aggregated, anonymized metrics; NO patient-level medical data or PHI is exposed.',
      'Revenue metrics represent fictional sandbox transaction sums from orders and subscriptions.',
      'GET /admin/analytics selects metrics category via ?type=overview|users|screenings|appointments|orders|subscriptions.',
      'GET /admin/audit-logs provides paginated audit records of administrative operations and clinical data accesses.'
    ]
  }
];

