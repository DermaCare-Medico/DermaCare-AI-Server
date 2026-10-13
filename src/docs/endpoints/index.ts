import type { EndpointSpec } from '../spec-types.js';
import { AUTH_ENDPOINTS } from './m01_auth.js';
import { PROFILES_ENDPOINTS } from './m02_profiles.js';
import { SCREENINGS_ENDPOINTS } from './m03_screenings.js';
import { DISCOVERY_ENDPOINTS } from './m04_discovery.js';
import { BOOKING_ENDPOINTS } from './m05_booking.js';
import { CONSULTATION_ENDPOINTS } from './m06_consultation.js';
import { PRESCRIPTIONS_ENDPOINTS } from './m07_prescriptions.js';
import { CHAT_ENDPOINTS } from './m08_chat.js';
import { STORE_ENDPOINTS } from './m09_store.js';
import { PAYMENTS_ENDPOINTS } from './m10_payments.js';
import { ADMIN_ENDPOINTS } from './m11_admin.js';
import { NOTIFICATIONS_ENDPOINTS } from './m12_notifications.js';
import { HEALTH_ENDPOINTS } from './m13_health.js';
import { SUBSCRIPTIONS_ENDPOINTS } from './m14_subscriptions.js';
import { SPONSORSHIPS_ENDPOINTS } from './m15_sponsorships.js';
import { ANALYTICS_ENDPOINTS } from './m16_analytics.js';

export const ALL_ENDPOINTS: EndpointSpec[] = [
  ...AUTH_ENDPOINTS,
  ...PROFILES_ENDPOINTS,
  ...SCREENINGS_ENDPOINTS,
  ...DISCOVERY_ENDPOINTS,
  ...BOOKING_ENDPOINTS,
  ...CONSULTATION_ENDPOINTS,
  ...PRESCRIPTIONS_ENDPOINTS,
  ...CHAT_ENDPOINTS,
  ...STORE_ENDPOINTS,
  ...PAYMENTS_ENDPOINTS,
  ...ADMIN_ENDPOINTS,
  ...NOTIFICATIONS_ENDPOINTS,
  ...HEALTH_ENDPOINTS,
  ...SUBSCRIPTIONS_ENDPOINTS,
  ...SPONSORSHIPS_ENDPOINTS,
  ...ANALYTICS_ENDPOINTS,
];

export function getEndpointById(id: number): EndpointSpec | undefined {
  return ALL_ENDPOINTS.find(ep => ep.id === id);
}

export function getEndpointsByModule(moduleNumber: string): EndpointSpec[] {
  return ALL_ENDPOINTS.filter(ep => ep.moduleNumber === moduleNumber);
}

export function getEndpointsByMethod(method: string): EndpointSpec[] {
  return ALL_ENDPOINTS.filter(ep => ep.method === method.toUpperCase());
}

