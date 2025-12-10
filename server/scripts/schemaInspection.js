/**
 * Schema Inspection Script - Phase 1
 *
 * Samples documents from AC=111 collections to discover:
 * - Field names and frequencies
 * - Nested structure variations
 * - Missing booth/agent/AC fields
 * - Geo coordinate formats
 * - Answer structures vs master questions
 *
 * Usage: node server/scripts/schemaInspection.js
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kuralapp';
const AC_ID = 111; // Sample AC
const SAMPLE_SIZE = 500;

// Track discovered field patterns
const fieldStats = {
  surveyResponses: { fields: {}, samples: [], typeVariations: {}, missingFields: [] },
  mobileAppAnswers: { fields: {}, samples: [], typeVariations: {}, missingFields: [] },
  boothAgentActivities: { fields: {}, samples: [], typeVariations: {}, missingFields: [] },
  voters: { fields: {}, samples: [], typeVariations: {}, missingFields: [] }
};

// Standard expected fields for comparison
const expectedFields = {
  surveyResponses: ['aci_id', 'aci_name', 'booth_id', 'boothname', 'boothno', 'respondentName', 'respondentVoterId', 'formId', 'answers', 'submittedAt', 'isComplete'],
  mobileAppAnswers: ['aci_id', 'aci_name', 'booth_id', 'boothname', 'boothno', 'voterId', 'questionId', 'masterQuestionId', 'answerValue', 'submittedBy', 'submittedAt', 'location'],
  boothAgentActivities: ['aci_id', 'aci_name', 'booth_id', 'boothname', 'boothno', 'userId', 'userName', 'loginTime', 'logoutTime', 'status', 'location'],
  voters: ['aci_id', 'aci_name', 'booth_id', 'boothname', 'boothno', 'voterID', 'name', 'mobile', 'address', 'gender', 'age']
};

// Field aliases mapping (legacy → standard)
const fieldAliases = {
  'acId': 'aci_id',
  'aci_num': 'aci_id',
  '_acId': 'aci_id',
  'aciId': 'aci_id',
  'boothId': 'booth_id',
  'boothCode': 'booth_id',
  'booth': 'boothname',
  'boothName': 'boothname',
  'voterName': 'respondentName',
  'respondent_name': 'respondentName',
  'voter_id': 'voterId',
  'voterID': 'voterId',
  'respondentVoterId': 'voterId',
  'surveyId': 'formId',
  'form_id': 'formId',
  'responses': 'answers',
  'answer': 'answerValue',
  'createdAt': 'submittedAt',
  'syncedAt': 'submittedAt'
};

/**
 * Recursively analyze document structure
 */
function analyzeDocument(doc, prefix = '', stats) {
  if (!doc || typeof doc !== 'object') return;

  const keys = Object.keys(doc);

  for (const key of keys) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    const value = doc[key];
    const valueType = getValueType(value);

    // Initialize field stats
    if (!stats.fields[fullPath]) {
      stats.fields[fullPath] = {
        count: 0,
        types: {},
        nullCount: 0,
        emptyCount: 0,
        sampleValues: [],
        aliasOf: fieldAliases[key] || null
      };
    }

    // Update counts
    stats.fields[fullPath].count++;
    stats.fields[fullPath].types[valueType] = (stats.fields[fullPath].types[valueType] || 0) + 1;

    if (value === null || value === undefined) {
      stats.fields[fullPath].nullCount++;
    } else if (value === '' || (Array.isArray(value) && value.length === 0)) {
      stats.fields[fullPath].emptyCount++;
    }

    // Store sample values (max 5)
    if (stats.fields[fullPath].sampleValues.length < 5 && value !== null && value !== undefined && value !== '') {
      const sampleValue = valueType === 'object' || valueType === 'array'
        ? JSON.stringify(value).substring(0, 200) + (JSON.stringify(value).length > 200 ? '...' : '')
        : String(value).substring(0, 100);
      if (!stats.fields[fullPath].sampleValues.includes(sampleValue)) {
        stats.fields[fullPath].sampleValues.push(sampleValue);
      }
    }

    // Track type variations for same field
    if (!stats.typeVariations[key]) {
      stats.typeVariations[key] = new Set();
    }
    stats.typeVariations[key].add(valueType);

    // Recurse into nested objects (but not arrays of primitives)
    if (valueType === 'object' && !Array.isArray(value) && !(value instanceof Date) && !(value instanceof mongoose.Types.ObjectId)) {
      analyzeDocument(value, fullPath, stats);
    }

    // For arrays, analyze first few elements
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
      analyzeDocument(value[0], `${fullPath}[0]`, stats);
    }
  }
}

/**
 * Get value type string
 */
function getValueType(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'date';
  if (value instanceof mongoose.Types.ObjectId) return 'objectId';
  if (typeof value === 'object') return 'object';
  return typeof value;
}

/**
 * Analyze geo coordinate formats
 */
function analyzeGeoFormat(doc) {
  const formats = [];

  // GeoJSON Point format
  if (doc.location?.type === 'Point' && Array.isArray(doc.location?.coordinates)) {
    formats.push({ format: 'GeoJSON', coordinates: doc.location.coordinates });
  }

  // Flat format
  if (doc.location?.latitude !== undefined && doc.location?.longitude !== undefined) {
    formats.push({ format: 'Flat', latitude: doc.location.latitude, longitude: doc.location.longitude });
  }

  // Direct fields
  if (doc.latitude !== undefined && doc.longitude !== undefined) {
    formats.push({ format: 'Direct', latitude: doc.latitude, longitude: doc.longitude });
  }

  return formats;
}

/**
 * Analyze answer structures
 */
function analyzeAnswerStructure(answers) {
  if (!answers || !Array.isArray(answers)) return null;

  const structures = answers.slice(0, 10).map(answer => {
    return {
      hasQuestionId: !!answer.questionId,
      hasQuestion: !!answer.question,
      hasAnswer: !!answer.answer,
      hasAnswerValue: !!answer.answerValue,
      hasAnswerText: !!answer.answerText,
      hasSelectedOptions: !!answer.selectedOptions,
      hasSelectedOption: !!answer.selectedOption,
      hasMasterQuestionId: !!answer.masterQuestionId,
      hasOptionMapping: !!answer.optionMapping,
      hasSubmittedAt: !!answer.submittedAt,
      keys: Object.keys(answer)
    };
  });

  return structures;
}

/**
 * Find missing expected fields in documents
 */
function findMissingFields(docs, expectedFieldsList) {
  const missingFieldCounts = {};

  for (const doc of docs) {
    const docFields = getAllFieldPaths(doc);

    for (const expected of expectedFieldsList) {
      // Check if field or its alias exists
      const hasField = docFields.includes(expected) ||
        Object.entries(fieldAliases).some(([alias, standard]) =>
          standard === expected && docFields.includes(alias)
        );

      if (!hasField) {
        missingFieldCounts[expected] = (missingFieldCounts[expected] || 0) + 1;
      }
    }
  }

  return missingFieldCounts;
}

/**
 * Get all field paths from document
 */
function getAllFieldPaths(doc, prefix = '') {
  const paths = [];
  if (!doc || typeof doc !== 'object') return paths;

  for (const key of Object.keys(doc)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    paths.push(fullPath);

    if (doc[key] && typeof doc[key] === 'object' && !Array.isArray(doc[key]) && !(doc[key] instanceof Date)) {
      paths.push(...getAllFieldPaths(doc[key], fullPath));
    }
  }

  return paths;
}

/**
 * Main inspection function
 */
async function inspectCollections() {
  console.log('='.repeat(70));
  console.log('PHASE 1: Schema Discovery - AC=' + AC_ID);
  console.log('='.repeat(70));

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // 1. Survey Responses
    console.log('\n--- Inspecting surveyresponses_' + AC_ID + ' ---');
    try {
      const surveyResponses = await db.collection(`surveyresponses_${AC_ID}`).find({}).limit(SAMPLE_SIZE).toArray();
      console.log(`Found ${surveyResponses.length} documents`);

      fieldStats.surveyResponses.samples = surveyResponses.slice(0, 5);

      for (const doc of surveyResponses) {
        analyzeDocument(doc, '', fieldStats.surveyResponses);
      }

      fieldStats.surveyResponses.missingFields = findMissingFields(surveyResponses, expectedFields.surveyResponses);
      fieldStats.surveyResponses.geoFormats = surveyResponses.slice(0, 20).map(analyzeGeoFormat).filter(g => g.length > 0);
      fieldStats.surveyResponses.answerStructures = surveyResponses.slice(0, 20).map(d => analyzeAnswerStructure(d.answers || d.responses)).filter(Boolean);
      fieldStats.surveyResponses.totalSampled = surveyResponses.length;
    } catch (err) {
      console.log('Collection not found or error:', err.message);
      fieldStats.surveyResponses.error = err.message;
    }

    // 2. Mobile App Answers
    console.log('\n--- Inspecting mobileappanswers_' + AC_ID + ' ---');
    try {
      const mobileAnswers = await db.collection(`mobileappanswers_${AC_ID}`).find({}).limit(SAMPLE_SIZE).toArray();
      console.log(`Found ${mobileAnswers.length} documents`);

      fieldStats.mobileAppAnswers.samples = mobileAnswers.slice(0, 5);

      for (const doc of mobileAnswers) {
        analyzeDocument(doc, '', fieldStats.mobileAppAnswers);
      }

      fieldStats.mobileAppAnswers.missingFields = findMissingFields(mobileAnswers, expectedFields.mobileAppAnswers);
      fieldStats.mobileAppAnswers.geoFormats = mobileAnswers.slice(0, 20).map(analyzeGeoFormat).filter(g => g.length > 0);
      fieldStats.mobileAppAnswers.totalSampled = mobileAnswers.length;
    } catch (err) {
      console.log('Collection not found or error:', err.message);
      fieldStats.mobileAppAnswers.error = err.message;
    }

    // 3. Booth Agent Activities
    console.log('\n--- Inspecting boothagentactivities_' + AC_ID + ' ---');
    try {
      const activities = await db.collection(`boothagentactivities_${AC_ID}`).find({}).limit(SAMPLE_SIZE).toArray();
      console.log(`Found ${activities.length} documents`);

      fieldStats.boothAgentActivities.samples = activities.slice(0, 5);

      for (const doc of activities) {
        analyzeDocument(doc, '', fieldStats.boothAgentActivities);
      }

      fieldStats.boothAgentActivities.missingFields = findMissingFields(activities, expectedFields.boothAgentActivities);
      fieldStats.boothAgentActivities.geoFormats = activities.slice(0, 20).map(analyzeGeoFormat).filter(g => g.length > 0);
      fieldStats.boothAgentActivities.totalSampled = activities.length;
    } catch (err) {
      console.log('Collection not found or error:', err.message);
      fieldStats.boothAgentActivities.error = err.message;
    }

    // 4. Voters (for reference)
    console.log('\n--- Inspecting voters_' + AC_ID + ' ---');
    try {
      const voters = await db.collection(`voters_${AC_ID}`).find({}).limit(SAMPLE_SIZE).toArray();
      console.log(`Found ${voters.length} documents`);

      fieldStats.voters.samples = voters.slice(0, 3);

      for (const doc of voters) {
        analyzeDocument(doc, '', fieldStats.voters);
      }

      fieldStats.voters.missingFields = findMissingFields(voters, expectedFields.voters);
      fieldStats.voters.totalSampled = voters.length;
    } catch (err) {
      console.log('Collection not found or error:', err.message);
      fieldStats.voters.error = err.message;
    }

    // Generate summary
    const summary = generateSummary();

    // Write output to reports directory
    const outputPath = path.resolve(__dirname, '../../reports/schema_inference_111.json');
    fs.writeFileSync(outputPath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      acId: AC_ID,
      sampleSize: SAMPLE_SIZE,
      fieldAliases,
      expectedFields,
      collections: fieldStats,
      summary
    }, null, 2));

    console.log('\n' + '='.repeat(70));
    console.log('Schema inference complete!');
    console.log('Output saved to: ' + outputPath);
    console.log('='.repeat(70));

    // Print summary
    console.log('\n=== SUMMARY ===\n');
    console.log(JSON.stringify(summary, null, 2));

  } catch (error) {
    console.error('Error during inspection:', error);
  } finally {
    await mongoose.disconnect();
  }
}

/**
 * Generate summary of findings
 */
function generateSummary() {
  const summary = {
    surveyResponses: {
      totalFields: Object.keys(fieldStats.surveyResponses.fields).length,
      topLevelFields: Object.keys(fieldStats.surveyResponses.fields).filter(k => !k.includes('.')).length,
      missingStandardFields: fieldStats.surveyResponses.missingFields,
      typeInconsistencies: [],
      aliasedFields: [],
      geoFormatsFound: [...new Set(fieldStats.surveyResponses.geoFormats?.flatMap(g => g.map(f => f.format)) || [])]
    },
    mobileAppAnswers: {
      totalFields: Object.keys(fieldStats.mobileAppAnswers.fields).length,
      topLevelFields: Object.keys(fieldStats.mobileAppAnswers.fields).filter(k => !k.includes('.')).length,
      missingStandardFields: fieldStats.mobileAppAnswers.missingFields,
      typeInconsistencies: [],
      aliasedFields: [],
      geoFormatsFound: [...new Set(fieldStats.mobileAppAnswers.geoFormats?.flatMap(g => g.map(f => f.format)) || [])]
    },
    boothAgentActivities: {
      totalFields: Object.keys(fieldStats.boothAgentActivities.fields).length,
      topLevelFields: Object.keys(fieldStats.boothAgentActivities.fields).filter(k => !k.includes('.')).length,
      missingStandardFields: fieldStats.boothAgentActivities.missingFields,
      typeInconsistencies: [],
      aliasedFields: [],
      geoFormatsFound: [...new Set(fieldStats.boothAgentActivities.geoFormats?.flatMap(g => g.map(f => f.format)) || [])]
    },
    voters: {
      totalFields: Object.keys(fieldStats.voters.fields).length,
      topLevelFields: Object.keys(fieldStats.voters.fields).filter(k => !k.includes('.')).length,
      missingStandardFields: fieldStats.voters.missingFields,
      typeInconsistencies: [],
      aliasedFields: []
    }
  };

  // Find type inconsistencies and aliased fields
  for (const [collection, stats] of Object.entries(fieldStats)) {
    for (const [field, data] of Object.entries(stats.typeVariations || {})) {
      const types = Array.from(data);
      if (types.length > 1 && !types.every(t => t === 'null' || t === 'undefined')) {
        const nonNullTypes = types.filter(t => t !== 'null' && t !== 'undefined');
        if (nonNullTypes.length > 1) {
          summary[collection].typeInconsistencies.push({ field, types: nonNullTypes });
        }
      }
    }

    for (const [field, data] of Object.entries(stats.fields)) {
      if (data.aliasOf) {
        summary[collection].aliasedFields.push({ field, standardName: data.aliasOf });
      }
    }
  }

  // Add recommendations
  summary.recommendations = {
    surveyResponses: [],
    mobileAppAnswers: [],
    boothAgentActivities: [],
    voters: []
  };

  // Generate recommendations based on findings
  for (const collection of ['surveyResponses', 'mobileAppAnswers', 'boothAgentActivities', 'voters']) {
    const s = summary[collection];

    if (Object.keys(s.missingStandardFields).length > 0) {
      summary.recommendations[collection].push(`Normalize ${Object.keys(s.missingStandardFields).length} missing standard fields`);
    }

    if (s.typeInconsistencies.length > 0) {
      summary.recommendations[collection].push(`Fix ${s.typeInconsistencies.length} type inconsistencies`);
    }

    if (s.aliasedFields.length > 0) {
      summary.recommendations[collection].push(`Map ${s.aliasedFields.length} legacy field aliases to standard names`);
    }

    if (s.geoFormatsFound && s.geoFormatsFound.length > 1) {
      summary.recommendations[collection].push(`Standardize geo format (found: ${s.geoFormatsFound.join(', ')})`);
    }
  }

  return summary;
}

// Run inspection
inspectCollections();
