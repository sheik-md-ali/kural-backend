/**
 * Universal Adapter for Data Normalization
 *
 * This module provides read-time normalization for all AC-sharded collections.
 * It maps legacy field names to canonical names and enriches missing metadata.
 *
 * Design Principles:
 * 1. Read-Time Normalization: Normalize when reading, not writing
 * 2. Write-Time Compatibility: Accept legacy fields, preserve existing format
 * 3. AC-Agnostic: Works for any AC dynamically
 * 4. Zero Data Loss: Preserve originals, add normalized views
 */

import {
  querySurveyResponses,
  queryAllSurveyResponses,
  countSurveyResponses,
  countAllSurveyResponses
} from './surveyResponseCollection.js';

import {
  queryMobileAppAnswers,
  queryAllMobileAppAnswers,
  countMobileAppAnswers,
  countAllMobileAppAnswers
} from './mobileAppAnswerCollection.js';

import {
  queryBoothAgentActivities,
  queryAllBoothAgentActivities,
  countBoothAgentActivities,
  countAllBoothAgentActivities
} from './boothAgentActivityCollection.js';

import {
  queryVoters,
  countVoters
} from './voterCollection.js';

// ============================================================================
// CONSTANTS & MAPPINGS
// ============================================================================

/**
 * AC Name lookup map for enrichment
 */
export const AC_NAMES = {
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
 * Field alias mappings from legacy to canonical names
 */
export const FIELD_ALIASES = {
  // AC ID aliases
  'acId': 'aci_id',
  'aci_num': 'aci_id',
  '_acId': 'aci_id',
  'aciId': 'aci_id',

  // Booth ID aliases
  'boothId': 'booth_id',
  'boothCode': 'booth_id',

  // Booth name aliases
  'booth': 'boothname',
  'boothName': 'boothname',

  // Voter/Respondent aliases
  'voterName': 'respondentName',
  'voter_id': 'voterId',
  'voterID': 'voterId',
  'respondentVoterId': 'voterId',

  // Form/Survey aliases
  'surveyId': 'formId',
  'form_id': 'formId',

  // Answer aliases
  'responses': 'answers',
  'answer': 'answerValue',

  // Timestamp aliases
  'createdAt': 'submittedAt',
  'syncedAt': 'submittedAt'
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Pick first non-null/undefined value from multiple field paths
 * @param {Object} doc - Document to search
 * @param {Array<string>} paths - Field paths to check in order
 * @returns {*} First found value or null
 */
function pickFirstValue(doc, paths) {
  for (const path of paths) {
    const value = getNestedValue(doc, path);
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return null;
}

/**
 * Get nested value from object using dot notation
 * @param {Object} obj - Object to traverse
 * @param {string} path - Dot-notation path (e.g., "location.latitude")
 * @returns {*} Value at path or undefined
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((curr, key) => curr?.[key], obj);
}

/**
 * Normalize location data to consistent format
 * Handles both Flat format and GeoJSON format
 * @param {Object} location - Location object
 * @returns {Object|null} Normalized location or null
 */
export function normalizeLocation(location) {
  if (!location) return null;

  // Flat format: { latitude, longitude, accuracy }
  if (location.latitude !== undefined && location.longitude !== undefined) {
    return {
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
      accuracy: location.accuracy ? Number(location.accuracy) : null,
      _originalFormat: 'Flat',
      _geoJSON: {
        type: 'Point',
        coordinates: [Number(location.longitude), Number(location.latitude)]
      }
    };
  }

  // GeoJSON format: { type: "Point", coordinates: [lng, lat] }
  if (location.type === 'Point' && Array.isArray(location.coordinates) && location.coordinates.length >= 2) {
    const [lng, lat] = location.coordinates;
    return {
      latitude: Number(lat),
      longitude: Number(lng),
      accuracy: null,
      _originalFormat: 'GeoJSON',
      _geoJSON: location
    };
  }

  return null;
}

/**
 * Enrich document with AC metadata
 * @param {Object} doc - Document to enrich
 * @returns {Object} Document with aci_name filled if missing
 */
export function enrichAcFields(doc) {
  if (!doc) return doc;

  const result = { ...doc };

  // Get AC ID from various possible fields
  const acId = Number(doc.aci_id || doc.acId || doc.aci_num || doc._acId || doc.aciId);

  if (acId && !isNaN(acId)) {
    // Always set canonical aci_id as number
    result.aci_id = acId;

    // Add aci_name if missing
    if (!result.aci_name && AC_NAMES[acId]) {
      result.aci_name = AC_NAMES[acId];
    }
  }

  return result;
}

/**
 * Enrich document with booth metadata
 * @param {Object} doc - Document to enrich
 * @param {Object} boothsLookup - Optional booth lookup map
 * @returns {Object} Document with booth fields filled if missing
 */
export function enrichBoothFields(doc, boothsLookup = null) {
  if (!doc) return doc;

  const result = { ...doc };

  // Get booth_id from various possible fields
  const boothId = doc.booth_id || doc.boothId || doc.boothCode;
  if (boothId) {
    result.booth_id = boothId;
  }

  // Try lookup first
  if (boothId && boothsLookup && boothsLookup[boothId]) {
    const booth = boothsLookup[boothId];
    if (!result.boothname) result.boothname = booth.boothname;
    if (!result.boothno) result.boothno = booth.boothno;
  }

  // Fallback: extract boothno from booth_id pattern "BOOTH1-111"
  if (!result.boothno && result.booth_id) {
    const match = result.booth_id.match(/^(BOOTH\d+)/i);
    if (match) {
      result.boothno = match[1].toUpperCase();
    }
  }

  return result;
}

/**
 * Normalize string/number fields to consistent types
 * @param {Object} doc - Document to normalize
 * @param {Object} typeMap - Map of field names to target types
 * @returns {Object} Type-normalized document
 */
function normalizeTypes(doc, typeMap) {
  if (!doc) return doc;

  const result = { ...doc };

  for (const [field, targetType] of Object.entries(typeMap)) {
    if (result[field] !== undefined && result[field] !== null) {
      if (targetType === 'string') {
        result[field] = String(result[field]);
      } else if (targetType === 'number') {
        const num = Number(result[field]);
        if (!isNaN(num)) {
          result[field] = num;
        }
      }
    }
  }

  return result;
}

// ============================================================================
// SURVEY RESPONSE NORMALIZATION
// ============================================================================

/**
 * Normalize a single survey response document
 * @param {Object} doc - Raw survey response document
 * @param {Object} options - Normalization options
 * @returns {Object} Normalized survey response
 */
export function normalizeSurveyResponse(doc, options = {}) {
  if (!doc) return null;

  const {
    enrichAc = true,
    enrichBooth = true,
    normalizeTypes: doNormalizeTypes = true
  } = options;

  let result = { ...doc };

  // Map respondent voter ID
  result.respondentVoterId = pickFirstValue(doc, ['respondentVoterId', 'voterId', 'voterID', 'voter_id']) || result.respondentVoterId;

  // Map respondent name
  result.respondentName = pickFirstValue(doc, ['respondentName', 'voterName']) || result.respondentName;

  // Map form ID
  result.formId = pickFirstValue(doc, ['formId', 'surveyId', 'form_id']) || result.formId;

  // Map answers
  result.answers = doc.answers || doc.responses || [];

  // Map submitted timestamp
  result.submittedAt = doc.submittedAt || doc.createdAt || doc.syncedAt;

  // Enrich AC fields
  if (enrichAc) {
    result = enrichAcFields(result);
  }

  // Enrich booth fields
  if (enrichBooth) {
    result = enrichBoothFields(result, options.boothsLookup);
  }

  // Normalize types
  if (doNormalizeTypes) {
    result = normalizeTypes(result, {
      aci_id: 'number',
      respondentAge: 'number'
    });
  }

  return result;
}

/**
 * Get normalized survey responses from a specific AC
 * @param {number|string} acId - AC ID
 * @param {Object} query - MongoDB query
 * @param {Object} options - Query and normalization options
 * @returns {Promise<Array>} Normalized survey responses
 */
export async function getNormalizedSurveyResponses(acId, query = {}, options = {}) {
  const { limit, skip, sort, select, ...normOptions } = options;

  const docs = await querySurveyResponses(acId, query, { limit, skip, sort, select });
  return docs.map(doc => normalizeSurveyResponse(doc, normOptions));
}

/**
 * Get normalized survey responses from all ACs
 * @param {Object} query - MongoDB query
 * @param {Object} options - Query and normalization options
 * @returns {Promise<Array>} Normalized survey responses
 */
export async function getAllNormalizedSurveyResponses(query = {}, options = {}) {
  const { limit, skip, sort, select, ...normOptions } = options;

  const docs = await queryAllSurveyResponses(query, { limit, skip, sort, select });
  return docs.map(doc => normalizeSurveyResponse(doc, normOptions));
}

// ============================================================================
// MOBILE APP ANSWER NORMALIZATION
// ============================================================================

/**
 * Normalize a single mobile app answer document
 * @param {Object} doc - Raw mobile app answer document
 * @param {Object} options - Normalization options
 * @returns {Object} Normalized mobile app answer
 */
export function normalizeMobileAppAnswer(doc, options = {}) {
  if (!doc) return null;

  const {
    enrichAc = true,
    enrichBooth = true,
    normalizeLocationData = true,
    normalizeTypes: doNormalizeTypes = true
  } = options;

  let result = { ...doc };

  // Map answer value
  result.answerValue = doc.answerValue || doc.answer;

  // Map submitted timestamp
  result.submittedAt = doc.submittedAt || doc.createdAt || doc.syncedAt;

  // Normalize location
  if (normalizeLocationData && doc.location) {
    result.location = normalizeLocation(doc.location);
  }

  // Enrich AC fields
  if (enrichAc) {
    result = enrichAcFields(result);
  }

  // Enrich booth fields
  if (enrichBooth) {
    result = enrichBoothFields(result, options.boothsLookup);
  }

  // Normalize types
  if (doNormalizeTypes) {
    result = normalizeTypes(result, {
      aci_id: 'number'
    });
  }

  return result;
}

/**
 * Get normalized mobile app answers from a specific AC
 * @param {number|string} acId - AC ID
 * @param {Object} query - MongoDB query
 * @param {Object} options - Query and normalization options
 * @returns {Promise<Array>} Normalized mobile app answers
 */
export async function getNormalizedMobileAppAnswers(acId, query = {}, options = {}) {
  const { limit, skip, sort, select, ...normOptions } = options;

  const docs = await queryMobileAppAnswers(acId, query, { limit, skip, sort, select });
  return docs.map(doc => normalizeMobileAppAnswer(doc, normOptions));
}

/**
 * Get normalized mobile app answers from all ACs
 * @param {Object} query - MongoDB query
 * @param {Object} options - Query and normalization options
 * @returns {Promise<Array>} Normalized mobile app answers
 */
export async function getAllNormalizedMobileAppAnswers(query = {}, options = {}) {
  const { limit, skip, sort, select, ...normOptions } = options;

  const docs = await queryAllMobileAppAnswers(query, { limit, skip, sort, select });
  return docs.map(doc => normalizeMobileAppAnswer(doc, normOptions));
}

// ============================================================================
// BOOTH AGENT ACTIVITY NORMALIZATION
// ============================================================================

/**
 * Normalize a single booth agent activity document
 * @param {Object} doc - Raw booth agent activity document
 * @param {Object} options - Normalization options
 * @returns {Object} Normalized booth agent activity
 */
export function normalizeBoothAgentActivity(doc, options = {}) {
  if (!doc) return null;

  const {
    enrichAc = true,
    enrichBooth = true,
    normalizeLocationData = true,
    normalizeTypes: doNormalizeTypes = true
  } = options;

  let result = { ...doc };

  // Map submitted timestamp (use loginTime as primary timestamp)
  result.submittedAt = doc.createdAt || doc.loginTime;

  // Normalize location
  if (normalizeLocationData && doc.location) {
    result.location = normalizeLocation(doc.location);
  }

  // Enrich AC fields
  if (enrichAc) {
    result = enrichAcFields(result);
  }

  // Enrich booth fields
  if (enrichBooth) {
    result = enrichBoothFields(result, options.boothsLookup);
  }

  // Normalize types
  if (doNormalizeTypes) {
    result = normalizeTypes(result, {
      aci_id: 'number',
      timeSpentMinutes: 'number',
      surveyCount: 'number',
      voterInteractions: 'number'
    });
  }

  return result;
}

/**
 * Get normalized booth agent activities from a specific AC
 * @param {number|string} acId - AC ID
 * @param {Object} query - MongoDB query
 * @param {Object} options - Query and normalization options
 * @returns {Promise<Array>} Normalized booth agent activities
 */
export async function getNormalizedBoothAgentActivities(acId, query = {}, options = {}) {
  const { limit, skip, sort, select, ...normOptions } = options;

  const docs = await queryBoothAgentActivities(acId, query, { limit, skip, sort, select });
  return docs.map(doc => normalizeBoothAgentActivity(doc, normOptions));
}

/**
 * Get normalized booth agent activities from all ACs
 * @param {Object} query - MongoDB query
 * @param {Object} options - Query and normalization options
 * @returns {Promise<Array>} Normalized booth agent activities
 */
export async function getAllNormalizedBoothAgentActivities(query = {}, options = {}) {
  const { limit, skip, sort, select, ...normOptions } = options;

  const docs = await queryAllBoothAgentActivities(query, { limit, skip, sort, select });
  return docs.map(doc => normalizeBoothAgentActivity(doc, normOptions));
}

// ============================================================================
// VOTER NORMALIZATION
// ============================================================================

/**
 * Normalize a single voter document
 * @param {Object} doc - Raw voter document
 * @param {Object} options - Normalization options
 * @returns {Object} Normalized voter
 */
export function normalizeVoter(doc, options = {}) {
  if (!doc) return null;

  const {
    enrichAc = true,
    enrichBooth = true,
    normalizeTypes: doNormalizeTypes = true
  } = options;

  let result = { ...doc };

  // Map voter ID (voters use voterID as canonical)
  result.voterID = doc.voterID || doc.voterId || doc.voter_id;

  // Enrich AC fields
  if (enrichAc) {
    result = enrichAcFields(result);
  }

  // Enrich booth fields
  if (enrichBooth) {
    result = enrichBoothFields(result, options.boothsLookup);
  }

  // Normalize types - specifically handle doornumber and mobile which have mixed types
  if (doNormalizeTypes) {
    result = normalizeTypes(result, {
      aci_id: 'number',
      age: 'number',
      mobile: 'string',
      doornumber: 'string'
    });
  }

  return result;
}

/**
 * Get normalized voters from a specific AC
 * @param {number|string} acId - AC ID
 * @param {Object} query - MongoDB query
 * @param {Object} options - Query and normalization options
 * @returns {Promise<Array>} Normalized voters
 */
export async function getNormalizedVoters(acId, query = {}, options = {}) {
  const { limit, skip, sort, select, ...normOptions } = options;

  const docs = await queryVoters(acId, query, { limit, skip, sort, select });
  return docs.map(doc => normalizeVoter(doc, normOptions));
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Build a query that handles field aliases
 * Useful for queries that may use either legacy or canonical field names
 * @param {Object} filters - Query filters using canonical names
 * @returns {Object} MongoDB query with $or for aliased fields
 */
export function buildNormalizedQuery(filters) {
  const query = {};
  const orConditions = [];

  // Handle AC ID with all its aliases
  if (filters.aci_id !== undefined) {
    const acValue = Number(filters.aci_id);
    orConditions.push([
      { aci_id: acValue },
      { aci_id: String(acValue) },
      { acId: acValue },
      { aci_num: acValue },
      { aciId: acValue }
    ]);
  }

  // Handle booth_id with aliases
  if (filters.booth_id !== undefined) {
    orConditions.push([
      { booth_id: filters.booth_id },
      { boothId: filters.booth_id },
      { boothCode: filters.booth_id }
    ]);
  }

  // Handle voterId with aliases
  if (filters.voterId !== undefined) {
    orConditions.push([
      { voterId: filters.voterId },
      { voterID: filters.voterId },
      { voter_id: filters.voterId },
      { respondentVoterId: filters.voterId }
    ]);
  }

  // Handle formId with aliases
  if (filters.formId !== undefined) {
    orConditions.push([
      { formId: filters.formId },
      { surveyId: filters.formId },
      { form_id: filters.formId }
    ]);
  }

  // Build $and query for multiple fields, each with $or for aliases
  if (orConditions.length > 0) {
    query.$and = orConditions.map(conditions => ({ $or: conditions }));
  }

  // Copy over non-aliased filters directly
  const aliasedFields = ['aci_id', 'booth_id', 'voterId', 'formId'];
  for (const [key, value] of Object.entries(filters)) {
    if (!aliasedFields.includes(key)) {
      query[key] = value;
    }
  }

  return query;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Constants
  FIELD_ALIASES,
  AC_NAMES,

  // Utility functions
  normalizeLocation,
  enrichAcFields,
  enrichBoothFields,
  buildNormalizedQuery,

  // Survey Response functions
  normalizeSurveyResponse,
  getNormalizedSurveyResponses,
  getAllNormalizedSurveyResponses,

  // Mobile App Answer functions
  normalizeMobileAppAnswer,
  getNormalizedMobileAppAnswers,
  getAllNormalizedMobileAppAnswers,

  // Booth Agent Activity functions
  normalizeBoothAgentActivity,
  getNormalizedBoothAgentActivities,
  getAllNormalizedBoothAgentActivities,

  // Voter functions
  normalizeVoter,
  getNormalizedVoters,

  // Re-export count functions (no normalization needed)
  countSurveyResponses,
  countAllSurveyResponses,
  countMobileAppAnswers,
  countAllMobileAppAnswers,
  countBoothAgentActivities,
  countAllBoothAgentActivities,
  countVoters
};
