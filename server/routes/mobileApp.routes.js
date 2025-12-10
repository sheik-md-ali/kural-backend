import express from "express";
import mongoose from "mongoose";
import MobileAppQuestion from "../models/MobileAppQuestion.js";
import MobileAppResponse from "../models/MobileAppResponse.js";
import MobileAppAnswer from "../models/MobileAppAnswer.js";
import MasterQuestion from "../models/MasterQuestion.js";
import Survey from "../models/Survey.js";
import { connectToDatabase } from "../config/database.js";
import {
  escapeRegExp,
  normalizeMasterQuestion,
  OPTION_REQUIRED_TYPES,
} from "../utils/helpers.js";
import { getVoterModel } from "../utils/voterCollection.js";
import { getMobileAppAnswerModel, queryMobileAppAnswers } from "../utils/mobileAppAnswerCollection.js";
import { isAuthenticated } from "../middleware/auth.js";
import {
  normalizeLocation,
  enrichAcFields,
  enrichBoothFields,
  AC_NAMES
} from "../utils/universalAdapter.js";

const router = express.Router();

// Apply authentication to all routes
router.use(isAuthenticated);

// Helper function to format mobile app question response
function formatMobileAppQuestionResponse(questionDoc) {
  if (!questionDoc) {
    return null;
  }

  const question =
    typeof questionDoc.toObject === "function"
      ? questionDoc.toObject({ versionKey: false })
      : questionDoc;

  const formattedOptions =
    OPTION_REQUIRED_TYPES.has(question.type) && Array.isArray(question.options)
      ? [...question.options]
          .sort((a, b) => {
            const orderDiff = (a.order ?? 0) - (b.order ?? 0);
            if (orderDiff !== 0) {
              return orderDiff;
            }
            return String(a.label ?? "").localeCompare(String(b.label ?? ""));
          })
          .map((option) => ({
            id: option._id?.toString?.() ?? option._id ?? undefined,
            label: option.label,
            value: option.value,
            order: option.order ?? 0,
            isDefault: Boolean(option.isDefault),
            masterOptionId: option.masterOptionId,
          }))
      : [];

  return {
    id: question._id?.toString?.() ?? question._id ?? undefined,
    prompt: question.prompt,
    type: question.type,
    isRequired: Boolean(question.isRequired),
    isVisible: true,
    helperText: question.helperText,
    order: question.order ?? 0,
    options: formattedOptions,
    masterQuestionId: question.masterQuestionId,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
  };
}

// Get all mobile app questions
router.get("/questions", async (_req, res) => {
  try {
    await connectToDatabase();
    const questions = await MobileAppQuestion.find()
      .sort({ order: 1, createdAt: 1 });
    return res.json({
      questions: questions.map((question) => formatMobileAppQuestionResponse(question)),
    });
  } catch (error) {
    console.error("Error fetching mobile app questions:", error);
    return res.status(500).json({
      message: "Failed to fetch mobile app questions",
      error: error.message,
    });
  }
});

// Create mobile app question
router.post("/questions", async (req, res) => {
  try {
    await connectToDatabase();

    const questionData = normalizeMasterQuestion(req.body ?? {}, 0);
    const order =
      typeof req.body?.order === "number" && Number.isFinite(req.body.order)
        ? req.body.order
        : await MobileAppQuestion.countDocuments();

    let options = questionData.options || [];
    if (Array.isArray(req.body?.options) && req.body.options.length > 0) {
      options = questionData.options.map((normalizedOption) => {
        const masterOption = req.body.options.find(
          (opt) =>
            (opt.id && (
              opt.value === normalizedOption.value ||
              opt.label === normalizedOption.label ||
              (typeof opt.value === "string" && typeof normalizedOption.value === "string" &&
                opt.value.toLowerCase() === normalizedOption.value.toLowerCase()) ||
              (typeof opt.label === "string" && typeof normalizedOption.label === "string" &&
                opt.label.toLowerCase() === normalizedOption.label.toLowerCase())
            ))
        );

        if (masterOption && masterOption.id) {
          return {
            ...normalizedOption,
            masterOptionId: typeof masterOption.id === "string" ? masterOption.id.trim() : String(masterOption.id),
          };
        }
        return normalizedOption;
      });
    }

    const mobileQuestionData = {
      ...questionData,
      order,
      options,
      masterQuestionId: typeof req.body?.masterQuestionId === "string" ? req.body.masterQuestionId.trim() : undefined,
    };

    const question = await MobileAppQuestion.create(mobileQuestionData);

    return res.status(201).json({
      message: "Question added successfully",
      question: formatMobileAppQuestionResponse(question),
    });
  } catch (error) {
    console.error("Error creating mobile app question:", error);
    return res.status(500).json({
      message: "Failed to create question",
      error: error.message,
    });
  }
});

// Delete mobile app question
router.delete("/questions/:questionId", async (req, res) => {
  try {
    await connectToDatabase();
    const { questionId } = req.params;

    const question = await MobileAppQuestion.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    await MobileAppQuestion.findByIdAndDelete(questionId);

    return res.json({
      message: "Question deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting mobile app question:", error);
    return res.status(500).json({
      message: "Failed to delete question",
      error: error.message,
    });
  }
});

// Helper functions for mobile app responses
function getNestedValue(source, path) {
  if (!source || typeof source !== "object") {
    return undefined;
  }
  return path
    .split(".")
    .reduce(
      (acc, key) =>
        acc !== undefined && acc !== null && typeof acc === "object"
          ? acc[key]
          : undefined,
      source,
    );
}

function pickFirstValue(source, paths, fallback = undefined) {
  for (const path of paths) {
    const value = getNestedValue(source, path);
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return fallback;
}

function safeDateToISOString(value) {
  if (!value) {
    return null;
  }

  let parsed;
  if (value instanceof Date) {
    parsed = value;
  } else if (typeof value === "number") {
    parsed = new Date(value);
  } else if (typeof value === "string") {
    const numeric = Number(value);
    parsed = Number.isFinite(numeric) && value.trim() === String(numeric)
      ? new Date(numeric)
      : new Date(value);
  }

  if (!parsed || Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function normalizeAnswerEntry(entry, index) {
  if (entry && typeof entry === "object" && !Array.isArray(entry)) {
    const questionId =
      entry.questionId ??
      entry.question_id ??
      entry.masterQuestionId ??
      entry.mobileQuestionId ??
      entry.id ??
      entry.key;

    const prompt =
      entry.prompt ??
      entry.question ??
      entry.label ??
      entry.title ??
      entry.fieldLabel ??
      entry.text ??
      entry.name;

    const value =
      entry.answer ??
      entry.value ??
      entry.response ??
      entry.selectedOptions ??
      entry.selectedOption ??
      entry.choices ??
      entry.data ??
      entry.content ??
      entry.values ??
      entry.text ??
      entry;

    return {
      id: questionId ? String(questionId) : `answer-${index}`,
      questionId: questionId ? String(questionId) : undefined,
      prompt: prompt || questionId || `Question ${index + 1}`,
      type: entry.type ?? entry.questionType,
      isRequired: typeof entry.isRequired === "boolean" ? entry.isRequired : Boolean(entry.required),
      value,
      raw: entry,
    };
  }

  return {
    id: `answer-${index}`,
    questionId: undefined,
    prompt: `Question ${index + 1}`,
    value: entry,
    raw: entry,
  };
}

function normalizeAnswerEntries(rawAnswers) {
  if (!rawAnswers) {
    return [];
  }

  if (Array.isArray(rawAnswers)) {
    return rawAnswers.map((entry, index) => normalizeAnswerEntry(entry, index));
  }

  if (typeof rawAnswers === "object") {
    return Object.entries(rawAnswers).map(([key, value], index) => ({
      id: key,
      questionId: key,
      prompt: key,
      value,
      raw: value,
    }));
  }

  return [];
}

function formatMobileAppResponse(responseDoc) {
  if (!responseDoc) {
    return null;
  }

  const response =
    typeof responseDoc.toObject === "function"
      ? responseDoc.toObject({ versionKey: false })
      : responseDoc;

  const respondentName = pickFirstValue(response, [
    "respondentName",
    "respondent_name",
    "name",
    "fullName",
    "applicantName",
    "profile.name",
    "basicDetails.name",
    "metadata.respondentName",
  ]);

  const phoneNumber = pickFirstValue(response, [
    "phoneNumber",
    "phone_number",
    "phone",
    "mobile",
    "mobileNumber",
    "contactNumber",
    "basicDetails.phone",
    "metadata.phoneNumber",
  ]);

  const voterId = pickFirstValue(response, [
    "voterId",
    "voter_id",
    "voterID",
    "voterNumber",
    "voter_id_number",
  ]);

  const submittedAt = safeDateToISOString(
    pickFirstValue(response, [
      "submittedAt",
      "submitted_at",
      "submittedOn",
      "submitted_on",
      "createdAt",
      "created_at",
      "timestamp",
      "meta.submittedAt",
      "meta.createdAt",
    ]),
  );

  const status = pickFirstValue(response, [
    "status",
    "syncStatus",
    "submissionStatus",
    "state",
  ]);

  const metadata = {};
  const metadataMappings = [
    ["formId", ["formId", "form_id", "surveyId", "form.id"]],
    ["aciName", ["aci_name", "aciName", "acName", "ac_name"]],
    ["acNumber", ["aci_id", "aciId", "aciNumber", "aci_num", "acNumber", "ac_no"]],
    // Booth fields - prioritize new structure, fallback to legacy
    ["booth", ["boothname", "booth", "boothName", "boothNumber", "booth_no"]],
    ["booth_id", ["booth_id", "boothId", "boothCode"]],
    ["boothno", ["boothno"]],
    ["ward", ["ward", "wardNumber", "ward_no"]],
    ["location", ["location", "village", "town", "district", "address", "geo.location"]],
    ["agent", ["agentName", "agent", "agent_id", "fieldAgent", "collectedBy"]],
    ["deviceId", ["deviceId", "device_id"]],
    ["appVersion", ["appVersion", "app_version"]],
  ];

  metadataMappings.forEach(([key, paths]) => {
    const value = pickFirstValue(response, paths);
    if (value !== undefined && value !== null && value !== "") {
      metadata[key] = value;
    }
  });

  const answersSource = pickFirstValue(response, [
    "answers",
    "responses",
    "response.answers",
    "response",
    "payload.answers",
    "payload.responses",
    "form.answers",
    "form.responses",
    "data.answers",
    "data.responses",
  ]);

  const answers = normalizeAnswerEntries(answersSource);

  return {
    id: response._id?.toString?.() ?? response.id ?? undefined,
    respondentName: respondentName ?? null,
    phoneNumber: phoneNumber ?? null,
    voterId: voterId ?? null,
    status: status ?? null,
    submittedAt,
    metadata: Object.keys(metadata).length ? metadata : undefined,
    answers,
    // ISS-024 fix: Removed raw document to reduce bandwidth
  };
}

function buildSearchQuery(search, acId, boothId) {
  const conditions = [];

  // Add AC filter
  if (acId) {
    const numericAcId = parseInt(acId, 10);
    if (!Number.isNaN(numericAcId)) {
      conditions.push({
        $or: [
          { aci_id: numericAcId },
          { aciId: numericAcId },
          { acId: numericAcId },
          { "metadata.acNumber": numericAcId },
        ],
      });
    }
  }

  // Add booth filter
  if (boothId) {
    conditions.push({
      $or: [
        { booth_id: boothId },
        { boothId: boothId },
        { booth: boothId },
        { "metadata.booth_id": boothId },
      ],
    });
  }

  // Add search filter
  if (search) {
    const regex = new RegExp(escapeRegExp(search), "i");
    const searchableFields = [
      "respondentName",
      "respondent_name",
      "name",
      "fullName",
      "phone",
      "phoneNumber",
      "mobile",
      "mobileNumber",
      "voterId",
      "voter_id",
      "aciName",
      "aci_name",
      "booth",
      "boothNumber",
    ];
    conditions.push({
      $or: searchableFields.map((field) => ({ [field]: regex })),
    });
  }

  if (conditions.length === 0) {
    return {};
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  return { $and: conditions };
}

function isNamespaceMissingError(error) {
  return (
    error?.codeName === "NamespaceNotFound" ||
    error?.message?.toLowerCase?.().includes("ns not found")
  );
}

// Get mobile app responses
router.get("/responses", async (req, res) => {
  try {
    await connectToDatabase();

    const { limit = "25", cursor, search, acId, boothId } = req.query ?? {};
    const parsedLimit = Number.parseInt(limit, 10);
    const effectiveLimit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 200)
      : 25;

    const options = {
      limit: effectiveLimit,
      cursor: typeof cursor === "string" && cursor.trim() ? cursor.trim() : null,
      search: typeof search === "string" && search.trim() ? search.trim() : null,
      acId: typeof acId === "string" && acId.trim() ? acId.trim() : null,
      boothId: typeof boothId === "string" && boothId.trim() ? boothId.trim() : null,
    };

    const searchQuery = buildSearchQuery(options.search, options.acId, options.boothId);

    const paginatedQuery = { ...searchQuery };
    if (typeof options.cursor === "string" && mongoose.Types.ObjectId.isValid(options.cursor)) {
      paginatedQuery._id = { $lt: new mongoose.Types.ObjectId(options.cursor) };
    }

    let directResult = null;
    try {
      const [responses, totalCount] = await Promise.all([
        MobileAppResponse.find(paginatedQuery)
          .sort({ createdAt: -1, _id: -1 })
          .limit(options.limit + 1),
        MobileAppResponse.countDocuments(searchQuery),
      ]);

      const hasMore = responses.length > options.limit;
      const items = hasMore ? responses.slice(0, options.limit) : responses;
      const nextCursor = hasMore ? items[items.length - 1]._id?.toString?.() ?? null : null;

      directResult = {
        responses: items.map((response) => formatMobileAppResponse(response)),
        pagination: {
          limit: options.limit,
          hasMore,
          nextCursor,
        },
        total: totalCount,
      };
    } catch (error) {
      if (!isNamespaceMissingError(error)) {
        throw error;
      }
    }

    if (directResult && directResult.total > 0) {
      return res.json(directResult);
    }

    // Fallback to aggregated responses from MobileAppAnswer (including AC-sharded collections)
    const aggregatedResult = await fetchAggregatedMobileAppResponses({
      limit: options.limit,
      cursor: options.cursor,
      search: options.search,
      acId: options.acId,
      boothId: options.boothId,
    });
    if (aggregatedResult.total > 0 || !directResult) {
      return res.json(aggregatedResult);
    }

    return res.json(directResult);
  } catch (error) {
    console.error("Error fetching mobile app responses:", error);
    return res.status(500).json({
      message: "Failed to fetch mobile app responses",
      error: error.message,
    });
  }
});

async function fetchAggregatedMobileAppResponses({ limit, cursor, search, acId, boothId }) {
  const matchQuery = buildAnswerSearchQuery(search);
  const fetchSize = Math.min(Math.max(limit * 25, 250), 5000);

  // Add booth filter for query
  if (boothId) {
    matchQuery.$and = matchQuery.$and || [];
    matchQuery.$and.push({
      $or: [
        { booth_id: boothId },
        { boothId: boothId },
        { booth: boothId },
      ],
    });
  }

  // Clean up empty $and
  if (matchQuery.$and && matchQuery.$and.length === 0) {
    delete matchQuery.$and;
  }

  let answers = [];

  // If AC is specified, query the AC-specific collection first
  if (acId) {
    const numericAcId = parseInt(acId, 10);
    if (!Number.isNaN(numericAcId)) {
      try {
        answers = await queryMobileAppAnswers(numericAcId, matchQuery, {
          limit: fetchSize,
          sort: { submittedAt: -1, createdAt: -1, _id: -1 },
        });
      } catch (err) {
        console.log(`AC-specific collection mobileappanswers_${numericAcId} not found, falling back to legacy`);
      }
    }
  }

  // Fallback to legacy collection if no AC-specific results
  if (answers.length === 0) {
    // Add AC filter for legacy collection
    if (acId) {
      const numericAcId = parseInt(acId, 10);
      if (!Number.isNaN(numericAcId)) {
        matchQuery.$and = matchQuery.$and || [];
        matchQuery.$and.push({
          $or: [
            { aci_id: numericAcId },
            { aciId: numericAcId },
            { acId: numericAcId },
          ],
        });
      }
    }

    answers = await MobileAppAnswer.find(matchQuery)
      .sort({ submittedAt: -1, createdAt: -1, _id: -1 })
      .limit(fetchSize)
      .lean();
  }

  if (answers.length === 0) {
    return {
      responses: [],
      pagination: { limit, hasMore: false, nextCursor: null },
      total: 0,
    };
  }

  const questionIds = Array.from(
    new Set(answers.map((a) => a.questionId?.toString?.()).filter(Boolean))
  );

  const masterQuestionIds = Array.from(
    new Set(answers.map((a) => a.masterQuestionId?.toString?.()).filter(Boolean))
  );

  const questions = await MobileAppQuestion.find({ _id: { $in: questionIds } })
    .select(["prompt", "type", "isRequired"])
    .lean();

  const masterQuestions = masterQuestionIds.length
    ? await MasterQuestion.find({ _id: { $in: masterQuestionIds } })
        .select(["prompt", "type", "isRequired"])
        .lean()
    : [];

  const questionLookup = new Map(
    [...questions, ...masterQuestions].map((q) => [q._id?.toString?.(), q])
  );

  const grouped = new Map();

  answers.forEach((answer) => {
    const groupKey = buildAnswerGroupKey(answer);
    if (!grouped.has(groupKey)) {
      const submittedDate = answer.submittedAt ?? answer.syncedAt ?? answer.updatedAt ?? answer.createdAt;
      // Get AC and booth info for metadata
      const acIdValue = answer.aci_id ?? answer.acId ?? answer.aciId ?? null;
      const acName = acIdValue ? AC_NAMES[Number(acIdValue)] || null : null;
      const boothIdValue = answer.booth_id ?? answer.boothId ?? answer.booth ?? null;
      const boothnoValue = answer.boothno || (boothIdValue ? boothIdValue.match(/^(BOOTH\d+)/i)?.[1]?.toUpperCase() : null);

      grouped.set(groupKey, {
        id: groupKey,
        respondentName: answer.respondentName ?? answer.submittedByName ?? null,
        phoneNumber: answer.phoneNumber ?? answer.mobileNumber ?? null,
        voterId: answer.voterId?.toString?.() ?? null,
        status: answer.status ?? "Submitted",
        submittedAt: safeDateToISOString(submittedDate),
        sortTimestamp: submittedDate ? new Date(submittedDate).getTime() : 0,
        metadata: {
          acNumber: acIdValue ? Number(acIdValue) : undefined,
          aciName: acName || undefined,
          booth_id: boothIdValue || undefined,
          boothno: boothnoValue || undefined,
          booth: answer.boothname || boothnoValue || undefined,
          agent: answer.submittedByName || undefined,
        },
        answers: [],
      });
    }
    const group = grouped.get(groupKey);
    group.answers.push(formatAnswerFromDocument(answer, questionLookup, group.answers.length));
  });

  const sortedResponses = Array.from(grouped.values()).sort((a, b) => b.sortTimestamp - a.sortTimestamp);

  let startIndex = 0;
  if (cursor) {
    const cursorIndex = sortedResponses.findIndex((r) => r.id === cursor);
    if (cursorIndex >= 0) startIndex = cursorIndex + 1;
  }

  const items = sortedResponses.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < sortedResponses.length;

  return {
    responses: items.map(({ sortTimestamp, ...rest }) => rest),
    pagination: { limit, hasMore, nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null },
    total: sortedResponses.length,
  };
}

function buildAnswerSearchQuery(search) {
  if (!search) return {};

  const regex = new RegExp(escapeRegExp(search), "i");
  return {
    $or: [
      { respondentName: regex },
      { submittedByName: regex },
      // Booth fields - aligned with voters collection
      { booth_id: regex },
      { boothname: regex },
      // Legacy fields for backward compatibility
      { boothId: regex },
      { booth: regex },
    ],
  };
}

function buildAnswerGroupKey(answer) {
  const explicitId = answer.submissionId ?? answer.responseId ?? answer.mobileSubmissionId;
  if (explicitId) return explicitId.toString();

  const submittedBy = answer.submittedBy?.toString?.() ?? "";
  const voterId = answer.voterId?.toString?.() ?? "";
  // Booth fields - prioritize new structure, fallback to legacy
  const boothId = answer.booth_id ?? answer.boothId ?? answer.booth ?? "";
  const formId = answer.formId ?? answer.surveyId ?? "";
  const submittedAt = safeDateToISOString(answer.submittedAt ?? answer.createdAt);

  const key = [submittedBy, voterId, boothId, formId, submittedAt || ""].filter(Boolean).join("|");
  if (key) return key;
  const idStr = answer._id?.toString?.();
  return idStr || `submission-${Math.random().toString(36).slice(2)}`;
}

function formatAnswerFromDocument(answer, questionLookup, index) {
  const questionId = answer.questionId?.toString?.();
  const question = questionId ? questionLookup.get(questionId) : null;

  return {
    id: `${questionId || answer._id?.toString?.() || `answer-${index}`}`,
    questionId,
    prompt: answer.questionPrompt ?? question?.prompt ?? `Question ${index + 1}`,
    type: question?.type,
    isRequired: Boolean(question?.isRequired),
    value: answer.answerValue ?? answer.answer ?? null,
  };
}

// Live Updates API
router.get("/live-updates", async (req, res) => {
  try {
    await connectToDatabase();
    const { acId, limit = 20 } = req.query;

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    let recentAnswers = [];

    // If AC is specified, query the AC-specific collection first
    if (acId) {
      const numericAcId = parseInt(acId, 10);
      if (!Number.isNaN(numericAcId)) {
        try {
          recentAnswers = await queryMobileAppAnswers(numericAcId, {}, {
            limit: parsedLimit * 3,
            sort: { submittedAt: -1, createdAt: -1, _id: -1 },
          });
        } catch (err) {
          console.log(`AC-specific collection mobileappanswers_${numericAcId} not found for live updates`);
        }
      }
    }

    // Fallback to legacy collection
    if (recentAnswers.length === 0) {
      const matchQuery = {};
      if (acId) {
        const numericAcId = parseInt(acId, 10);
        if (!Number.isNaN(numericAcId)) {
          matchQuery.$or = [
            { acId: numericAcId },
            { aciId: numericAcId },
            { aci_id: numericAcId },
          ];
        }
      }

      recentAnswers = await MobileAppAnswer.find(matchQuery)
        .sort({ submittedAt: -1, createdAt: -1, _id: -1 })
        .limit(parsedLimit * 3)
        .lean();
    }

    const surveyQuery = acId ? { acId: parseInt(acId, 10) } : {};
    const recentSurveys = await Survey.find(surveyQuery)
      .sort({ updatedAt: -1 })
      .limit(parsedLimit)
      .lean();

    const questionIds = Array.from(
      new Set(recentAnswers.map((a) => a.questionId?.toString?.()).filter(Boolean))
    );

    const questions = questionIds.length
      ? await MobileAppQuestion.find({ _id: { $in: questionIds } }).select(["prompt"]).lean()
      : [];

    const questionLookup = new Map(questions.map((q) => [q._id?.toString?.(), q.prompt]));

    const voterIds = Array.from(
      new Set(recentAnswers.map((a) => a.voterId?.toString?.()).filter((id) => id && id !== "unknown"))
    );

    const voterLookup = new Map();
    const boothNameLookup = new Map();

    if (voterIds.length > 0 && acId) {
      const numericAcId = parseInt(acId, 10);
      try {
        const VoterModel = getVoterModel(numericAcId);
        // ISS-028 fix: Only include valid ObjectIds in query
        const validObjectIds = voterIds
          .filter(id => mongoose.Types.ObjectId.isValid(id))
          .map(id => new mongoose.Types.ObjectId(id));

        if (validObjectIds.length > 0) {
          const voters = await VoterModel.find({
            _id: { $in: validObjectIds }
          }).select("name voterID boothname booth_id").lean();

          voters.forEach(v => {
            voterLookup.set(v._id?.toString(), v.name?.english || v.name?.tamil || "Unknown Voter");
            if (v.booth_id && v.boothname) {
              boothNameLookup.set(v.booth_id, v.boothname);
            }
          });
        }
      } catch (err) {
        console.error("Error fetching voter names:", err);
      }
    }

    const grouped = new Map();

    recentAnswers.forEach((answer) => {
      const submittedDate = answer.submittedAt ?? answer.syncedAt ?? answer.createdAt;
      const groupKey = `${answer.voterId || "unknown"}-${submittedDate?.toString() || Date.now()}`;

      if (!grouped.has(groupKey)) {
        const lookupName = voterLookup.get(answer.voterId?.toString());
        const voterName = lookupName || answer.respondentName || "Unknown Voter";
        // Booth fields - prioritize new structure, fallback to legacy
        const boothId = answer.booth_id || answer.boothId || answer.booth || "Unknown Booth";
        const boothName = answer.boothname || boothNameLookup.get(boothId) || boothId;

        // Use universal adapter for AC enrichment
        const acIdValue = answer.aci_id || answer.acId || answer.aciId || null;
        const acName = acIdValue ? (AC_NAMES[Number(acIdValue)] || null) : null;

        // Normalize location data (handle both flat and GeoJSON formats)
        let locationData = null;
        if (answer.location) {
          locationData = normalizeLocation(answer.location);
        }

        grouped.set(groupKey, {
          id: answer._id?.toString() || groupKey,
          voter: voterName,
          booth: boothName,
          booth_id: answer.booth_id || answer.boothId || null,
          boothno: answer.boothno || (answer.booth_id ? answer.booth_id.match(/^(BOOTH\d+)/i)?.[1]?.toUpperCase() : null),
          agent: answer.submittedByName || "Unknown Agent",
          timestamp: submittedDate,
          activity: "Survey completed",
          question: questionLookup.get(answer.questionId?.toString?.()) || null,
          acId: acIdValue,
          aci_name: acName,
          location: locationData,
        });
      }
    });

    const updates = Array.from(grouped.values())
      .sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeB - timeA;
      })
      .slice(0, parsedLimit)
      .map((update) => ({
        ...update,
        timestamp: formatRelativeTime(update.timestamp),
      }));

    return res.json({ success: true, updates, total: updates.length });
  } catch (error) {
    console.error("Error fetching live updates:", error);
    return res.status(500).json({ message: "Failed to fetch live updates", error: error.message });
  }
});

function formatRelativeTime(date) {
  if (!date) return "Unknown";

  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

  return then.toLocaleDateString();
}

export default router;
