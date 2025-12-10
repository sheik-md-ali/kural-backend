/**
 * Database Field Discovery Script
 *
 * Samples documents from AC=111 collections to discover actual field structures.
 * Creates a report of all fields found in the database.
 */

import mongoose from 'mongoose';
import { connectToDatabase } from '../config/database.js';
import { getSurveyResponseModel } from '../utils/surveyResponseCollection.js';
import { getMobileAppAnswerModel } from '../utils/mobileAppAnswerCollection.js';
import { getBoothAgentActivityModel } from '../utils/boothAgentActivityCollection.js';
import { getVoterModel } from '../utils/voterCollection.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AC_ID = 111;
const SAMPLE_SIZE = 100;

/**
 * Extract all unique field paths from a document (including nested fields)
 */
function extractFieldPaths(obj, prefix = '', fieldSet = new Set()) {
  if (!obj || typeof obj !== 'object') return fieldSet;

  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    fieldSet.add(fullPath);

    // For arrays, sample the first item for structure
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
      extractFieldPaths(value[0], `${fullPath}[]`, fieldSet);
    } else if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      extractFieldPaths(value, fullPath, fieldSet);
    }
  }

  return fieldSet;
}

/**
 * Get sample values for key fields
 */
function getSampleValues(docs, fieldPath) {
  const values = [];
  for (const doc of docs.slice(0, 5)) {
    let value = doc;
    for (const key of fieldPath.split('.')) {
      if (key.endsWith('[]')) {
        const arrayKey = key.slice(0, -2);
        value = value?.[arrayKey]?.[0];
      } else {
        value = value?.[key];
      }
      if (value === undefined || value === null) break;
    }
    if (value !== undefined && value !== null) {
      values.push(typeof value === 'object' ? JSON.stringify(value).slice(0, 100) : String(value).slice(0, 100));
    }
  }
  return [...new Set(values)].slice(0, 3);
}

/**
 * Analyze a collection and return field structure
 */
async function analyzeCollection(model, collectionName) {
  try {
    const docs = await model.find({}).limit(SAMPLE_SIZE).lean();
    const count = await model.countDocuments();

    if (docs.length === 0) {
      return {
        name: collectionName,
        totalCount: count,
        sampleSize: 0,
        fields: [],
        error: null
      };
    }

    const allFieldPaths = new Set();
    docs.forEach(doc => extractFieldPaths(doc, '', allFieldPaths));

    const fieldAnalysis = [];
    for (const fieldPath of Array.from(allFieldPaths).sort()) {
      const sampleValues = getSampleValues(docs, fieldPath);
      fieldAnalysis.push({
        path: fieldPath,
        sampleValues,
        presentIn: docs.filter(doc => {
          let value = doc;
          for (const key of fieldPath.split('.')) {
            if (key.endsWith('[]')) {
              value = value?.[key.slice(0, -2)]?.[0];
            } else {
              value = value?.[key];
            }
          }
          return value !== undefined;
        }).length
      });
    }

    return {
      name: collectionName,
      totalCount: count,
      sampleSize: docs.length,
      fields: fieldAnalysis,
      error: null
    };
  } catch (error) {
    return {
      name: collectionName,
      totalCount: 0,
      sampleSize: 0,
      fields: [],
      error: error.message
    };
  }
}

/**
 * Check for legacy (unsharded) collections
 */
async function checkLegacyCollections() {
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map(c => c.name);

  const legacyCollections = {
    mobileappresponses: collectionNames.includes('mobileappresponses'),
    mobileappanswers: collectionNames.includes('mobileappanswers'),
    surveyresponses: collectionNames.includes('surveyresponses'),
    boothagentactivities: collectionNames.includes('boothagentactivities'),
  };

  const results = {};

  for (const [name, exists] of Object.entries(legacyCollections)) {
    if (exists) {
      try {
        const collection = db.collection(name);
        const count = await collection.countDocuments();
        const sample = await collection.findOne();
        results[name] = {
          exists: true,
          count,
          sampleFields: sample ? Object.keys(sample) : []
        };
      } catch (err) {
        results[name] = { exists: true, count: 0, error: err.message };
      }
    } else {
      results[name] = { exists: false, count: 0 };
    }
  }

  return results;
}

async function main() {
  console.log('Connecting to database...');
  await connectToDatabase();
  console.log('Connected!\n');

  const report = {
    generatedAt: new Date().toISOString(),
    acId: AC_ID,
    sampleSize: SAMPLE_SIZE,
    collections: {},
    legacyCollections: {}
  };

  // Analyze sharded collections for AC 111
  console.log(`Analyzing surveyresponses_${AC_ID}...`);
  try {
    const SurveyResponseModel = getSurveyResponseModel(AC_ID);
    report.collections.surveyResponses = await analyzeCollection(SurveyResponseModel, `surveyresponses_${AC_ID}`);
    console.log(`  Found ${report.collections.surveyResponses.totalCount} documents, ${report.collections.surveyResponses.fields.length} unique fields`);
  } catch (err) {
    report.collections.surveyResponses = { error: err.message };
  }

  console.log(`Analyzing mobileappanswers_${AC_ID}...`);
  try {
    const MobileAppAnswerModel = getMobileAppAnswerModel(AC_ID);
    report.collections.mobileAppAnswers = await analyzeCollection(MobileAppAnswerModel, `mobileappanswers_${AC_ID}`);
    console.log(`  Found ${report.collections.mobileAppAnswers.totalCount} documents, ${report.collections.mobileAppAnswers.fields.length} unique fields`);
  } catch (err) {
    report.collections.mobileAppAnswers = { error: err.message };
  }

  console.log(`Analyzing boothagentactivities_${AC_ID}...`);
  try {
    const BoothAgentActivityModel = getBoothAgentActivityModel(AC_ID);
    report.collections.boothAgentActivities = await analyzeCollection(BoothAgentActivityModel, `boothagentactivities_${AC_ID}`);
    console.log(`  Found ${report.collections.boothAgentActivities.totalCount} documents, ${report.collections.boothAgentActivities.fields.length} unique fields`);
  } catch (err) {
    report.collections.boothAgentActivities = { error: err.message };
  }

  console.log(`Analyzing voters_${AC_ID}...`);
  try {
    const VoterModel = getVoterModel(AC_ID);
    report.collections.voters = await analyzeCollection(VoterModel, `voters_${AC_ID}`);
    console.log(`  Found ${report.collections.voters.totalCount} documents, ${report.collections.voters.fields.length} unique fields`);
  } catch (err) {
    report.collections.voters = { error: err.message };
  }

  // Check legacy unsharded collections
  console.log('\nChecking legacy (unsharded) collections...');
  report.legacyCollections = await checkLegacyCollections();

  for (const [name, info] of Object.entries(report.legacyCollections)) {
    if (info.exists) {
      console.log(`  ${name}: ${info.count} documents`);
    } else {
      console.log(`  ${name}: does not exist`);
    }
  }

  // Write report
  const reportsDir = path.join(__dirname, '../../reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, 'db_fields_detected.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport written to: ${reportPath}`);

  await mongoose.connection.close();
  console.log('Done!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
