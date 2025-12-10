/**
 * Normalized Types for Universal Schema
 *
 * These types align with the backend's universal adapter output.
 * They provide consistent field names across all AC-sharded collections.
 */

// ============================================================================
// AC & BOOTH TYPES (Shared)
// ============================================================================

export interface AcMetadata {
  /** Assembly Constituency ID (number) */
  aci_id: number;
  /** AC name (e.g., "Mettupalayam") */
  aci_name: string | null;
}

export interface BoothMetadata {
  /** Unique booth ID (e.g., "BOOTH1-111") */
  booth_id: string | null;
  /** Full booth name/address */
  boothname: string | null;
  /** Booth number only (e.g., "BOOTH1") */
  boothno: string | null;
}

// ============================================================================
// SURVEY RESPONSE TYPES
// ============================================================================

export interface SurveyAnswerOption {
  optionId: string;
  optionText: string;
  optionValue: string;
  optionIndex: number;
}

export interface SurveyAnswerMapping {
  surveyOptionIndex: number;
  masterQuestionId: string;
  masterOptionValue: string;
}

export interface SurveyAnswer {
  questionId: string;
  questionText: string;
  answer: string | number | boolean | string[];
  answerText: string;
  selectedOptions: string[];
  masterQuestionId: string;
  selectedOption?: SurveyAnswerOption;
  optionMapping?: SurveyAnswerMapping;
  submittedAt?: string;
}

export interface NormalizedSurveyResponse extends AcMetadata, BoothMetadata {
  id: string;
  /** Survey/form ID */
  survey_id: string;
  /** Respondent's name */
  respondent_name: string;
  /** Voter ID */
  voter_id: string;
  /** Legacy voter ID field (for backward compat) */
  voterID?: string;
  /** Legacy voter ID field (for backward compat) */
  voterId?: string;
  /** Booth display name (for backward compat) */
  booth: string;
  /** AC ID (aliased from ac_id) */
  ac_id: number | null;
  /** Survey submission date */
  survey_date: string;
  /** Survey status */
  status: 'Completed' | 'Pending' | string;
  /** Survey answers */
  answers: SurveyAnswer[];
}

// ============================================================================
// MOBILE APP ANSWER TYPES
// ============================================================================

export interface NormalizedLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  _originalFormat: 'Flat' | 'GeoJSON';
  _geoJSON?: {
    type: 'Point';
    coordinates: [number, number];
  };
}

export interface DeviceInfo {
  platform: string;
  version: string;
  model: string;
}

export interface MobileAppAnswerMetadata {
  formId?: string;
  aciName?: string;
  acNumber?: number;
  booth?: string;
  booth_id?: string;
  boothno?: string;
  ward?: string;
  location?: string;
  agent?: string;
  deviceId?: string;
  appVersion?: string;
}

export interface MobileAppAnswer {
  id: string;
  questionId?: string;
  prompt: string;
  type?: string;
  isRequired?: boolean;
  value: string | number | boolean | string[] | null;
}

export interface NormalizedMobileAppResponse {
  id: string;
  respondentName: string | null;
  phoneNumber: string | null;
  voterId: string | null;
  status: string | null;
  submittedAt: string | null;
  metadata?: MobileAppAnswerMetadata;
  answers: MobileAppAnswer[];
}

// ============================================================================
// BOOTH AGENT ACTIVITY TYPES
// ============================================================================

export interface ActivityEvent {
  eventType: string;
  eventData: {
    surveyId?: string;
    voterId?: string;
    voterName?: string;
    questionCount?: number;
  };
  timestamp: string;
  _id: string;
}

export interface NormalizedBoothAgentActivity extends AcMetadata, BoothMetadata {
  _id: string;
  userId: string;
  userName: string;
  userPhone: string;
  loginTime: string;
  logoutTime: string | null;
  timeSpentMinutes: number;
  status: 'active' | 'timeout' | 'logout' | 'inactive';
  activityType: 'login' | 'logout' | 'auto-logout' | 'timeout' | 'session';
  location: NormalizedLocation | null;
  deviceInfo: DeviceInfo;
  ipAddress: string;
  sessionId: string;
  appVersion: string;
  os: string;
  osVersion: string;
  events: ActivityEvent[];
  surveyCount: number;
  voterInteractions: number;
  lastActivityTime: string;
  submittedAt: string;
}

// ============================================================================
// VOTER TYPES
// ============================================================================

export interface VoterName {
  english: string;
  tamil: string;
}

export interface NormalizedVoter extends AcMetadata, BoothMetadata {
  _id: string;
  voterID: string;
  name: VoterName;
  address: string;
  DOB: string;
  age: number;
  gender: 'Male' | 'Female' | string;
  /** Mobile number (always string) */
  mobile: string;
  /** Door number (always string) */
  doornumber: string;
  fathername: string;
  guardian: string;
  fatherless: boolean;
  emailid: string;
  aadhar: string;
  pan: string;
  religion: string;
  caste: string;
  subcaste: string;
  familyId: string | null;
  surveyed: boolean;
  surveyedAt: string | null;
  verified: boolean;
  status: string;
  booth_agent_id: string;
}

// ============================================================================
// LIVE UPDATE TYPES
// ============================================================================

export interface LiveUpdate extends AcMetadata {
  id: string;
  voter: string;
  booth: string;
  booth_id: string | null;
  boothno: string | null;
  agent: string;
  timestamp: string;
  activity: string;
  question: string | null;
  acId: number | null;
}

// ============================================================================
// DASHBOARD TYPES
// ============================================================================

export interface BoothStat {
  boothNo: string;
  boothName: string;
  boothId: string;
  voters: number;
}

export interface DashboardStats {
  acIdentifier: string | null;
  acId: number | null;
  acName: string | null;
  acNumber: number | null;
  totalFamilies: number;
  totalMembers: number;
  surveysCompleted: number;
  totalBooths: number;
  boothStats: BoothStat[];
}

// ============================================================================
// PAGINATION TYPES
// ============================================================================

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface CursorPaginationInfo {
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface SurveyResponsesApiResponse {
  responses: NormalizedSurveyResponse[];
  pagination: PaginationInfo;
}

export interface MobileAppResponsesApiResponse {
  responses: NormalizedMobileAppResponse[];
  pagination: CursorPaginationInfo;
  total: number;
}

export interface LiveUpdatesApiResponse {
  success: boolean;
  updates: LiveUpdate[];
  total: number;
}

// ============================================================================
// HELPER TYPE GUARDS
// ============================================================================

export function hasAcMetadata(obj: unknown): obj is AcMetadata {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'aci_id' in obj &&
    typeof (obj as AcMetadata).aci_id === 'number'
  );
}

export function hasBoothMetadata(obj: unknown): obj is BoothMetadata {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'booth_id' in obj
  );
}

export function isNormalizedLocation(obj: unknown): obj is NormalizedLocation {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'latitude' in obj &&
    'longitude' in obj &&
    '_originalFormat' in obj
  );
}
