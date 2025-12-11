import express from "express";
import mongoose from "mongoose";
import { connectToDatabase } from "../config/database.js";
import { escapeRegExp } from "../utils/helpers.js";
import { aggregateVoters, getVoterModel, ALL_AC_IDS } from "../utils/voterCollection.js";
import {
  getSurveyResponseModel,
  querySurveyResponses,
  countSurveyResponses,
  queryAllSurveyResponses,
  countAllSurveyResponses
} from "../utils/surveyResponseCollection.js";
import {
  normalizeSurveyResponse,
  enrichAcFields
} from "../utils/universalAdapter.js";
import Survey from "../models/Survey.js";
import { isAuthenticated, canAccessAC } from "../middleware/auth.js";

const router = express.Router();

// Apply authentication to all routes
router.use(isAuthenticated);

// Helper function to populate question text from survey form
const populateQuestionText = async (answers, surveyId) => {
  if (!answers || !Array.isArray(answers) || answers.length === 0) {
    return answers;
  }

  // Try to fetch the survey form to get question text
  let surveyForm = null;
  if (surveyId) {
    try {
      surveyForm = await Survey.findById(surveyId);
    } catch (err) {
      // surveyId might not be a valid ObjectId
      console.log(`Could not fetch survey form: ${err.message}`);
    }
  }

  // Build a map of questionId to question text
  const questionMap = new Map();
  if (surveyForm && surveyForm.questions) {
    surveyForm.questions.forEach((q) => {
      if (q.id) {
        questionMap.set(q.id, q.text || q.prompt || `Question`);
      }
      if (q._id) {
        questionMap.set(q._id.toString(), q.text || q.prompt || `Question`);
      }
    });
  }

  // Populate question text in answers
  return answers.map((answer, index) => {
    // If question text already exists, use it
    if (answer.question && typeof answer.question === 'string' && answer.question.length > 0 && !/^\d+$/.test(answer.question)) {
      return answer;
    }

    // Try to find question text from map
    const qId = answer.questionId || answer.question;
    const questionText = qId ? questionMap.get(String(qId)) : null;

    return {
      ...answer,
      question: questionText || answer.prompt || `Question ${index + 1}`,
      questionId: qId || answer.questionId
    };
  });
};

// Get all survey responses (for L0 admin)
router.get("/", async (req, res) => {
  console.log("Survey responses endpoint hit:", req.query);
  try {
    await connectToDatabase();

    const { booth, survey, ac, page = 1, limit = 50, search } = req.query;

    const query = {};
    let boothNamesFromAC = [];
    const acId = ac && ac !== 'all' ? parseInt(ac) : null;

    // When AC is specified, we'll query the AC-specific collection directly
    // No need to filter by booth names - the collection already contains only that AC's data
    if (acId) {
      console.log(`Querying AC-specific collection: surveyresponses_${acId}`);
      // Get booth names for booth filter dropdown support
      try {
        const voterBooths = await aggregateVoters(acId, [
          { $match: {} },
          { $group: { _id: "$boothname", booth_id: { $first: "$booth_id" } } }
        ]);
        boothNamesFromAC = voterBooths.map(b => b._id).filter(Boolean);
        console.log(`Found ${boothNamesFromAC.length} unique booth names for AC ${acId}`);
      } catch (voterError) {
        console.error("Error getting booth names from voter data:", voterError);
      }
    }

    // Filter by booth - use boothname (primary), booth_id, or legacy booth field
    if (booth && booth !== 'all') {
      console.log(`Booth filter requested: "${booth}"`);
      if (boothNamesFromAC.length > 0) {
        if (boothNamesFromAC.includes(booth)) {
          query.boothname = booth;
          console.log(`Exact booth match found: "${booth}"`);
        } else {
          const matchingBoothNames = boothNamesFromAC.filter(name =>
            name && name.toLowerCase().includes(booth.toLowerCase())
          );
          if (matchingBoothNames.length > 0) {
            query.boothname = { $in: matchingBoothNames };
            console.log(`Partial booth match found ${matchingBoothNames.length} booths`);
          } else {
            // Try matching on multiple booth fields
            query.$or = [
              { boothname: { $regex: booth, $options: 'i' } },
              { booth_id: { $regex: booth, $options: 'i' } },
              { booth: { $regex: booth, $options: 'i' } }
            ];
            console.log(`Using regex booth match for: "${booth}"`);
          }
        }
      } else {
        // When no AC context, search across all booth field variants
        query.$or = [
          { boothname: { $regex: booth, $options: 'i' } },
          { booth_id: booth },
          { booth: { $regex: booth, $options: 'i' } },
          { boothCode: booth }
        ];
      }
    }

    if (survey && survey !== 'all') {
      const surveyFilter = { $or: [{ surveyId: survey }, { formId: survey }] };
      if (query.$or) {
        query.$and = [{ $or: query.$or }, surveyFilter];
        delete query.$or;
      } else {
        query.$or = surveyFilter.$or;
      }
    }

    // Search functionality
    if (search) {
      const searchRegex = new RegExp(escapeRegExp(search), 'i');
      const isObjectId = mongoose.Types.ObjectId.isValid(search);

      const searchFilter = isObjectId ? {
        $or: [
          { voterId: search },
          { voterName: searchRegex },
          { respondentName: searchRegex },
          { voterID: searchRegex },
          { respondentVoterId: searchRegex },
          { surveyId: search },
          { formId: search }
        ]
      } : {
        $or: [
          { voterName: searchRegex },
          { respondentName: searchRegex },
          { voterId: searchRegex },
          { voterID: searchRegex },
          { respondentVoterId: searchRegex },
          { surveyId: searchRegex },
          { formId: searchRegex }
        ]
      };

      if (query.$and) {
        query.$and.push(searchFilter);
      } else if (query.$or) {
        query.$and = [{ $or: query.$or }, searchFilter];
        delete query.$or;
      } else if (query.booth) {
        query.$and = [{ booth: query.booth }, searchFilter];
        delete query.booth;
      } else {
        query.$or = searchFilter.$or;
      }
    }

    console.log("Survey responses query:", JSON.stringify(query, null, 2));

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    let responses = [];
    let totalResponses = 0;

    // If AC is specified, query that specific collection
    if (acId) {
      responses = await querySurveyResponses(acId, query, {
        skip,
        limit: limitNum,
        sort: { createdAt: -1 }
      });
      totalResponses = await countSurveyResponses(acId, query);
    } else {
      // Query all AC collections for L0 admin
      responses = await queryAllSurveyResponses(query, {
        limit: limitNum,
        sort: { createdAt: -1 }
      });
      totalResponses = await countAllSurveyResponses(query);

      // Apply pagination on combined results
      responses = responses.slice(skip, skip + limitNum);
    }

    // Normalize and process responses using universal adapter
    const processedResponses = await Promise.all(responses.map(async (response) => {
      // Use universal adapter to normalize the response
      const normalized = normalizeSurveyResponse(response, { enrichAc: true, enrichBooth: true });

      const surveyId = normalized.formId;
      const answers = normalized.answers || [];
      const populatedAnswers = await populateQuestionText(answers, surveyId);

      return {
        id: normalized._id,
        survey_id: surveyId || 'N/A',
        respondent_name: normalized.respondentName || 'N/A',
        voter_id: normalized.respondentVoterId || 'N/A',
        voterID: normalized.respondentVoterId || '',
        voterId: normalized.respondentVoterId || 'N/A',
        // Booth fields - from normalized data
        booth: normalized.boothname || 'N/A',
        booth_id: normalized.booth_id || null,
        boothno: normalized.boothno || null,
        // AC fields - from normalized data
        ac_id: normalized.aci_id || null,
        aci_name: normalized.aci_name || null,
        survey_date: normalized.submittedAt || new Date(),
        status: normalized.isComplete ? 'Completed' : (normalized.status || 'Pending'),
        answers: populatedAnswers
      };
    }));

    return res.json({
      responses: processedResponses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalResponses,
        pages: Math.ceil(totalResponses / parseInt(limit))
      }
    });

  } catch (error) {
    console.error("Error fetching survey responses:", error);
    return res.status(500).json({ message: "Failed to fetch survey responses" });
  }
});

// Get survey responses for a specific AC
router.get("/:acId", async (req, res) => {
  try {
    await connectToDatabase();

    const acId = parseInt(req.params.acId);
    const { booth, survey, search, page = 1, limit = 50 } = req.query;

    if (isNaN(acId)) {
      return res.status(400).json({ message: "Invalid AC ID" });
    }

    // AC Isolation: Check if user can access this AC
    if (!canAccessAC(req.user, acId)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You do not have permission to view this AC's data."
      });
    }

    const query = {};
    const conditions = [];

    // Filter by booth - use boothname (primary), booth_id, or legacy booth field
    if (booth && booth !== 'all') {
      conditions.push({
        $or: [
          { boothname: { $regex: booth, $options: 'i' } },
          { booth_id: { $regex: booth, $options: 'i' } },
          { booth: { $regex: booth, $options: 'i' } },
          { boothCode: booth }
        ]
      });
    }

    // Filter by survey form
    if (survey && survey !== 'all') {
      conditions.push({
        $or: [{ surveyId: survey }, { formId: survey }]
      });
    }

    // Search by voter name or voter ID
    if (search && search.trim()) {
      const searchRegex = new RegExp(escapeRegExp(search.trim()), 'i');
      conditions.push({
        $or: [
          { respondentName: searchRegex },
          { voterName: searchRegex },
          { respondentVoterId: searchRegex },
          { voterId: searchRegex },
          { voterID: searchRegex }
        ]
      });
    }

    // Build final query
    if (conditions.length > 0) {
      query.$and = conditions;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Query the AC-specific collection
    const responses = await querySurveyResponses(acId, query, {
      skip,
      limit: limitNum,
      sort: { createdAt: -1 }
    });

    const totalResponses = await countSurveyResponses(acId, query);

    // Normalize and process responses using universal adapter
    const processedResponses = await Promise.all(responses.map(async (response) => {
      // Use universal adapter to normalize the response
      const normalized = normalizeSurveyResponse(response, { enrichAc: true, enrichBooth: true });

      const surveyId = normalized.formId;
      const answers = normalized.answers || [];
      const populatedAnswers = await populateQuestionText(answers, surveyId);

      return {
        id: normalized._id,
        survey_id: surveyId || 'N/A',
        respondent_name: normalized.respondentName || 'N/A',
        voter_id: normalized.respondentVoterId || 'N/A',
        voterID: normalized.respondentVoterId || '',
        voterId: normalized.respondentVoterId || 'N/A',
        // Booth fields - from normalized data
        booth: normalized.boothname || 'N/A',
        booth_id: normalized.booth_id || null,
        boothno: normalized.boothno || null,
        // AC fields - from normalized data (use acId param as fallback)
        ac_id: normalized.aci_id || acId,
        aci_name: normalized.aci_name || null,
        survey_date: normalized.submittedAt || new Date(),
        status: normalized.isComplete ? 'Completed' : (normalized.status || 'Pending'),
        answers: populatedAnswers
      };
    }));

    return res.json({
      responses: processedResponses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalResponses,
        pages: Math.ceil(totalResponses / parseInt(limit))
      }
    });

  } catch (error) {
    console.error("Error fetching survey responses:", error);
    return res.status(500).json({ message: "Failed to fetch survey responses" });
  }
});

export default router;
