/**
 * Universal Frontend Mappers
 *
 * This module provides frontend-level normalization utilities that work with
 * the backend's universalAdapter.js output. It ensures consistent data display
 * across all frontend pages regardless of legacy field variations.
 */

import type {
  NormalizedSurveyResponse,
  NormalizedMobileAppResponse,
  NormalizedBoothAgentActivity,
  NormalizedVoter,
  LiveUpdate,
  NormalizedLocation,
  SurveyAnswer,
  MobileAppAnswer,
} from './normalizedTypes';

// ============================================================================
// AC METADATA
// ============================================================================

/**
 * AC Names lookup - matches backend universalAdapter.js
 */
export const AC_NAMES: Record<number, string> = {
  101: 'Dharapuram (SC)',
  102: 'Kangayam',
  108: 'Udhagamandalam',
  109: 'Gudalur (SC)',
  110: 'Coonoor',
  111: 'Mettupalayam',
  112: 'Avanashi (SC)',
  113: 'Tiruppur North',
  114: 'Tiruppur South',
  115: 'Palladam',
  116: 'Sulur',
  117: 'Kavundampalayam',
  118: 'Coimbatore North',
  119: 'Thondamuthur',
  120: 'Coimbatore South',
  121: 'Singanallur',
  122: 'Kinathukadavu',
  123: 'Pollachi',
  124: 'Valparai (SC)',
  125: 'Udumalaipettai',
  126: 'Madathukulam'
};

/**
 * Get AC name by ID with fallback
 */
export function getAcName(acId: number | string | null | undefined): string {
  if (acId === null || acId === undefined) return 'Unknown';
  const id = Number(acId);
  return AC_NAMES[id] || `AC ${id}`;
}

/**
 * Format AC display string
 */
export function formatAcDisplay(acId: number | string | null | undefined, acName?: string | null): string {
  if (acId === null || acId === undefined) return 'Unknown AC';
  const id = Number(acId);
  const name = acName || AC_NAMES[id] || 'Unknown';
  return `AC ${id} - ${name}`;
}

// ============================================================================
// BOOTH METADATA
// ============================================================================

/**
 * Get booth display name with fallbacks
 */
export function getBoothDisplayName(
  boothname?: string | null,
  boothno?: string | null,
  booth_id?: string | null
): string {
  if (boothname) return boothname;
  if (boothno) return boothno;
  if (booth_id) {
    // Try to extract booth number from booth_id (e.g., "BOOTH1-111" -> "BOOTH1")
    const match = booth_id.match(/^(BOOTH\d+)/i);
    return match ? match[1].toUpperCase() : booth_id;
  }
  return 'Unknown Booth';
}

/**
 * Format booth display with booth number
 */
export function formatBoothDisplay(
  boothname?: string | null,
  boothno?: string | null,
  booth_id?: string | null
): string {
  const name = getBoothDisplayName(boothname, boothno, booth_id);
  if (boothno && boothname && boothno !== boothname) {
    return `${name} (${boothno})`;
  }
  return name;
}

// ============================================================================
// SURVEY RESPONSE MAPPERS
// ============================================================================

/**
 * Raw survey response from API (may have legacy fields)
 */
interface RawSurveyResponse {
  id?: string;
  _id?: string;
  survey_id?: string;
  surveyId?: string;
  formId?: string;
  respondent_name?: string;
  respondentName?: string;
  voterName?: string;
  voter_id?: string;
  voterId?: string;
  voterID?: string;
  respondentVoterId?: string;
  booth?: string;
  boothname?: string;
  boothName?: string;
  booth_id?: string;
  boothId?: string;
  boothCode?: string;
  boothno?: string;
  ac_id?: number | string | null;
  aci_id?: number | string | null;
  acId?: number | string | null;
  aci_name?: string | null;
  survey_date?: string;
  submittedAt?: string;
  createdAt?: string;
  status?: string;
  isComplete?: boolean;
  answers?: unknown[];
  responses?: unknown[];
}

/**
 * Normalize a survey response from API
 */
export function normalizeSurveyResponse(raw: RawSurveyResponse): NormalizedSurveyResponse {
  const acId = Number(raw.ac_id ?? raw.aci_id ?? raw.acId ?? 0) || null;

  return {
    id: raw.id || raw._id || '',
    survey_id: raw.survey_id || raw.surveyId || raw.formId || 'N/A',
    respondent_name: raw.respondent_name || raw.respondentName || raw.voterName || 'N/A',
    voter_id: raw.voter_id || raw.voterId || raw.voterID || raw.respondentVoterId || 'N/A',
    voterId: raw.voterId || raw.voterID || raw.respondentVoterId || raw.voter_id || undefined,
    voterID: raw.voterID || raw.voterId || undefined,
    booth: raw.booth || raw.boothname || raw.boothName || 'N/A',
    booth_id: raw.booth_id || raw.boothId || raw.boothCode || null,
    boothname: raw.boothname || raw.boothName || raw.booth || null,
    boothno: raw.boothno || null,
    ac_id: acId,
    aci_id: acId ?? 0,
    aci_name: raw.aci_name || (acId ? AC_NAMES[acId] : null) || null,
    survey_date: raw.survey_date || raw.submittedAt || raw.createdAt || new Date().toISOString(),
    status: raw.status || (raw.isComplete ? 'Completed' : 'Pending'),
    answers: normalizeAnswers(raw.answers || raw.responses || []),
  };
}

/**
 * Normalize survey answers array
 */
function normalizeAnswers(answers: unknown[]): SurveyAnswer[] {
  if (!Array.isArray(answers)) return [];

  return answers.map((ans: any, index) => ({
    questionId: ans.questionId || ans.question_id || `q_${index}`,
    questionText: ans.questionText || ans.question || '',
    answer: ans.answer ?? ans.answerValue ?? ans.value ?? '',
    answerText: ans.answerText || String(ans.answer ?? ans.answerValue ?? ''),
    selectedOptions: ans.selectedOptions || [],
    masterQuestionId: ans.masterQuestionId || '',
    selectedOption: ans.selectedOption,
    optionMapping: ans.optionMapping,
    submittedAt: ans.submittedAt,
  }));
}

// ============================================================================
// MOBILE APP RESPONSE MAPPERS
// ============================================================================

/**
 * Raw mobile app response from API
 */
interface RawMobileAppResponse {
  id?: string;
  _id?: string;
  respondentName?: string;
  respondent_name?: string;
  phoneNumber?: string;
  phone?: string;
  mobile?: string;
  voterId?: string;
  voter_id?: string;
  voterID?: string;
  status?: string;
  submittedAt?: string;
  createdAt?: string;
  syncedAt?: string;
  metadata?: Record<string, unknown>;
  answers?: unknown[];
}

/**
 * Normalize a mobile app response from API
 */
export function normalizeMobileAppResponse(raw: RawMobileAppResponse): NormalizedMobileAppResponse {
  return {
    id: raw.id || raw._id || '',
    respondentName: raw.respondentName || raw.respondent_name || null,
    phoneNumber: raw.phoneNumber || raw.phone || raw.mobile || null,
    voterId: raw.voterId || raw.voter_id || raw.voterID || null,
    status: raw.status || null,
    submittedAt: raw.submittedAt || raw.createdAt || raw.syncedAt || null,
    metadata: raw.metadata ? normalizeMobileMetadata(raw.metadata) : undefined,
    answers: normalizeMobileAnswers(raw.answers || []),
  };
}

/**
 * Normalize mobile app metadata
 */
function normalizeMobileMetadata(metadata: Record<string, unknown>) {
  return {
    formId: metadata.formId as string | undefined,
    aciName: (metadata.aciName || metadata.aci_name || metadata.acName) as string | undefined,
    acNumber: Number(metadata.acNumber || metadata.aci_id || metadata.acId) || undefined,
    booth: (metadata.booth || metadata.boothname || metadata.boothName) as string | undefined,
    booth_id: (metadata.booth_id || metadata.boothId || metadata.boothCode) as string | undefined,
    boothno: metadata.boothno as string | undefined,
    ward: metadata.ward as string | undefined,
    location: metadata.location as string | undefined,
    agent: metadata.agent as string | undefined,
    deviceId: metadata.deviceId as string | undefined,
    appVersion: metadata.appVersion as string | undefined,
  };
}

/**
 * Normalize mobile app answers
 */
function normalizeMobileAnswers(answers: unknown[]): MobileAppAnswer[] {
  if (!Array.isArray(answers)) return [];

  return answers.map((ans: any, index) => ({
    id: ans.id || ans._id || `ans_${index}`,
    questionId: ans.questionId || ans.question_id,
    prompt: ans.prompt || ans.question || ans.questionText || `Question ${index + 1}`,
    type: ans.type,
    isRequired: ans.isRequired,
    value: ans.value ?? ans.answer ?? ans.answerValue ?? null,
  }));
}

// ============================================================================
// LIVE UPDATE MAPPERS
// ============================================================================

/**
 * Raw live update from API
 */
interface RawLiveUpdate {
  id?: string;
  _id?: string;
  voter?: string;
  voterName?: string;
  respondentName?: string;
  booth?: string;
  boothname?: string;
  boothName?: string;
  booth_id?: string;
  boothId?: string;
  boothno?: string;
  agent?: string;
  agentName?: string;
  submittedByName?: string;
  timestamp?: string;
  submittedAt?: string;
  createdAt?: string;
  activity?: string;
  activityType?: string;
  question?: string | null;
  acId?: number | string | null;
  aci_id?: number | string | null;
  aci_name?: string | null;
}

/**
 * Normalize a live update from API
 */
export function normalizeLiveUpdate(raw: RawLiveUpdate): LiveUpdate {
  const acId = Number(raw.acId ?? raw.aci_id ?? 0) || null;

  return {
    id: raw.id || raw._id || '',
    voter: raw.voter || raw.voterName || raw.respondentName || 'Unknown',
    booth: raw.booth || raw.boothname || raw.boothName || 'Unknown Booth',
    booth_id: raw.booth_id || raw.boothId || null,
    boothno: raw.boothno || null,
    agent: raw.agent || raw.agentName || raw.submittedByName || 'Unknown Agent',
    timestamp: raw.timestamp || raw.submittedAt || raw.createdAt || new Date().toISOString(),
    activity: raw.activity || raw.activityType || 'Survey completed',
    question: raw.question || null,
    acId: acId,
    aci_id: acId ?? 0,
    aci_name: raw.aci_name || (acId ? AC_NAMES[acId] : null) || null,
  };
}

// ============================================================================
// LOCATION MAPPERS
// ============================================================================

/**
 * Raw location from API (may be Flat or GeoJSON format)
 */
interface RawLocation {
  latitude?: number;
  longitude?: number;
  accuracy?: number | null;
  type?: string;
  coordinates?: [number, number];
  _originalFormat?: 'Flat' | 'GeoJSON';
  _geoJSON?: { type: 'Point'; coordinates: [number, number] };
}

/**
 * Normalize location data from API
 */
export function normalizeLocation(raw: RawLocation | null | undefined): NormalizedLocation | null {
  if (!raw) return null;

  // Already normalized
  if (raw._originalFormat) {
    return raw as NormalizedLocation;
  }

  // Flat format
  if (raw.latitude !== undefined && raw.longitude !== undefined) {
    return {
      latitude: Number(raw.latitude),
      longitude: Number(raw.longitude),
      accuracy: raw.accuracy ?? null,
      _originalFormat: 'Flat',
      _geoJSON: {
        type: 'Point',
        coordinates: [Number(raw.longitude), Number(raw.latitude)],
      },
    };
  }

  // GeoJSON format
  if (raw.type === 'Point' && Array.isArray(raw.coordinates) && raw.coordinates.length >= 2) {
    const [lng, lat] = raw.coordinates;
    return {
      latitude: Number(lat),
      longitude: Number(lng),
      accuracy: null,
      _originalFormat: 'GeoJSON',
      _geoJSON: {
        type: 'Point',
        coordinates: [Number(lng), Number(lat)],
      },
    };
  }

  return null;
}

/**
 * Format location for display
 */
export function formatLocationDisplay(location: NormalizedLocation | null): string {
  if (!location) return 'Location not available';
  return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
}

/**
 * Get Google Maps URL for a location
 * Note: External link only - maps on pages use Leaflet.js with OpenStreetMap tiles (free, no API key needed)
 */
export function getGoogleMapsUrl(location: NormalizedLocation | null): string | null {
  if (!location) return null;
  return `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
}

/**
 * Get OpenStreetMap URL for a location
 * Alternative free mapping service without API key requirement
 */
export function getOpenStreetMapUrl(location: NormalizedLocation | null): string | null {
  if (!location) return null;
  return `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}&zoom=16`;
}

// ============================================================================
// DATE/TIME FORMATTERS
// ============================================================================

/**
 * Format date for display
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * Format date and time for display
 */
export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

/**
 * Format relative time (e.g., "5 minutes ago")
 */
export function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

    return formatDate(dateString);
  } catch {
    return dateString;
  }
}

// ============================================================================
// SAFE VALUE EXTRACTORS
// ============================================================================

/**
 * Safely get a string value with fallback
 */
export function safeString(value: unknown, fallback = 'N/A'): string {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

/**
 * Safely get a number value with fallback
 */
export function safeNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const num = Number(value);
  return isNaN(num) ? fallback : num;
}

/**
 * Pick first non-null/undefined value from an array
 */
export function pickFirst<T>(...values: (T | null | undefined)[]): T | null {
  for (const v of values) {
    if (v !== null && v !== undefined) return v;
  }
  return null;
}

// ============================================================================
// BATCH NORMALIZATION
// ============================================================================

/**
 * Normalize an array of survey responses
 */
export function normalizeSurveyResponses(responses: RawSurveyResponse[]): NormalizedSurveyResponse[] {
  return responses.map(normalizeSurveyResponse);
}

/**
 * Normalize an array of mobile app responses
 */
export function normalizeMobileAppResponses(responses: RawMobileAppResponse[]): NormalizedMobileAppResponse[] {
  return responses.map(normalizeMobileAppResponse);
}

/**
 * Normalize an array of live updates
 */
export function normalizeLiveUpdates(updates: RawLiveUpdate[]): LiveUpdate[] {
  return updates.map(normalizeLiveUpdate);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // AC utilities
  AC_NAMES,
  getAcName,
  formatAcDisplay,

  // Booth utilities
  getBoothDisplayName,
  formatBoothDisplay,

  // Survey response utilities
  normalizeSurveyResponse,
  normalizeSurveyResponses,

  // Mobile app utilities
  normalizeMobileAppResponse,
  normalizeMobileAppResponses,

  // Live update utilities
  normalizeLiveUpdate,
  normalizeLiveUpdates,

  // Location utilities
  normalizeLocation,
  formatLocationDisplay,
  getGoogleMapsUrl,

  // Date/time utilities
  formatDate,
  formatDateTime,
  formatRelativeTime,

  // Value utilities
  safeString,
  safeNumber,
  pickFirst,
};
