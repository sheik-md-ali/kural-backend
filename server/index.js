import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

import User from "./models/User.js";
import Survey from "./models/Survey.js";
import Voter from "./models/Voter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, ".env");

dotenv.config({
  path: fs.existsSync(envPath) ? envPath : undefined,
});

const app = express();

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/kuralapp";

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (CLIENT_ORIGINS.includes("*") || CLIENT_ORIGINS.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error(
          `CORS origin ${origin} not allowed. Update CLIENT_ORIGIN env variable.`,
        ),
      );
    },
    credentials: true,
  }),
);

app.use(express.json());

const roleMap = new Map([
  ["Admin", "L0"],
  ["admin", "L0"],
  ["L0", "L0"],
  ["Assembly CIM", "L1"],
  ["AssemblyCIM", "L1"],
  ["CIM", "L1"],
  ["L1", "L1"],
  ["Assembly CI", "L2"],
  ["AssemblyCI", "L2"],
  ["CI", "L2"],
  ["L2", "L2"],
  ["War Room", "L9"],
  ["Command", "L9"],
  ["L9", "L9"],
]);

async function connectToDatabase() {
  if (!MONGODB_URI) {
    throw new Error("Missing MONGODB_URI environment variable");
  }

  if (mongoose.connection.readyState === 1) {
    return;
  }

  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });
}

function sanitizeTitle(title) {
  if (typeof title === "string" && title.trim()) {
    return title.trim();
  }
  return "Untitled Form";
}

function sanitizeDescription(description) {
  if (typeof description === "string") {
    return description.trim();
  }
  return "";
}

function sanitizeStatus(status) {
  return status === "Active" ? "Active" : "Draft";
}

function sanitizeAssignedACs(value) {
  const values = Array.isArray(value) ? value : value !== undefined ? [value] : [];
  return values
    .map((item) => {
      const num = Number(item);
      return Number.isFinite(num) ? Math.trunc(num) : null;
    })
    .filter((item) => item !== null);
}

function normalizeQuestions(questions) {
  if (!Array.isArray(questions)) {
    return [];
  }

  return questions
    .map((question, index) => {
      if (typeof question !== "object" || question === null) {
        return null;
      }

      const id =
        question.id && String(question.id).trim()
          ? String(question.id).trim()
          : new mongoose.Types.ObjectId().toString();

      const text =
        typeof question.text === "string" && question.text.trim()
          ? question.text.trim()
          : `Question ${index + 1}`;

      const type =
        typeof question.type === "string" && question.type.trim()
          ? question.type.trim()
          : "short-text";

      const normalized = {
        id,
        text,
        type,
        required: Boolean(question.required),
      };

      if (Array.isArray(question.options)) {
        const options = question.options
          .map((option) => (typeof option === "string" ? option.trim() : ""))
          .filter((option) => option);

        if (options.length > 0) {
          normalized.options = options;
        }
      }

      return normalized;
    })
    .filter(Boolean);
}

function sanitizeCreatedBy(createdBy) {
  if (typeof createdBy !== "string" || !createdBy.trim()) {
    return undefined;
  }

  if (!mongoose.Types.ObjectId.isValid(createdBy)) {
    return undefined;
  }

  return createdBy.trim();
}

function sanitizeCreatedByRole(createdByRole) {
  if (typeof createdByRole !== "string") {
    return undefined;
  }
  const trimmed = createdByRole.trim();
  return trimmed || undefined;
}

app.post("/api/auth/login", async (req, res) => {
  try {
    const { identifier, password } = req.body ?? {};

    if (!identifier || !password) {
      return res.status(400).json({
        message: "Identifier and password are required",
      });
    }

    await connectToDatabase();

    const trimmedIdentifier = String(identifier).trim();
    const normalizedIdentifier = trimmedIdentifier.toLowerCase();

    const identifierVariants = new Set();
    const addVariant = (variant) => {
      if (variant === undefined || variant === null) {
        return;
      }
      const value = typeof variant === "string" ? variant.trim() : variant;
      if (value === "" || identifierVariants.has(value)) {
        return;
      }
      identifierVariants.add(value);
    };

    addVariant(trimmedIdentifier);
    addVariant(normalizedIdentifier);

    if (/^\d+$/.test(trimmedIdentifier)) {
      addVariant(Number(trimmedIdentifier));
    }

    const digitsOnly = trimmedIdentifier.replace(/\D/g, "");
    if (digitsOnly && digitsOnly !== trimmedIdentifier) {
      addVariant(digitsOnly);
    }
    if (/^\d+$/.test(digitsOnly)) {
      addVariant(Number(digitsOnly));
      if (digitsOnly.length > 10) {
        addVariant(digitsOnly.slice(-10));
        addVariant(Number(digitsOnly.slice(-10)));
      }
    }

    const lookupConditions = [];
    const conditionKeys = new Set();
    const pushCondition = (condition) => {
      const key = JSON.stringify(condition);
      if (!conditionKeys.has(key)) {
        lookupConditions.push(condition);
        conditionKeys.add(key);
      }
    };

    for (const value of identifierVariants) {
      if (typeof value === "string") {
        const lowerValue = value.toLowerCase();
        pushCondition({ email: lowerValue });
        pushCondition({ email: value });
        pushCondition({ phone: value });
        pushCondition({ phone: lowerValue });
      } else {
        pushCondition({ phone: value });
      }
    }

    console.debug("Login lookup variants", Array.from(identifierVariants));
    console.debug("Login lookup conditions", lookupConditions);
    const activeFilter = { $or: [{ isActive: { $exists: false } }, { isActive: true }] };

    const user = await User.findOne({
      $and: [{ $or: lookupConditions }, activeFilter],
    }).lean(false);

    if (!user) {
      console.warn("Login failed: user not found", { identifier: normalizedIdentifier });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isPasswordValid = await user.verifyPassword(password);
    if (!isPasswordValid) {
      console.warn("Login failed: invalid password", {
        userId: user._id.toString(),
        identifier: normalizedIdentifier,
      });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const mappedRole = roleMap.get(user.role);
    if (!mappedRole) {
      return res.status(403).json({ message: "Role is not authorised" });
    }

    return res.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: mappedRole,
        assignedAC: user.assignedAC ?? null,
      },
    });
  } catch (error) {
    console.error("Login error", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/api/surveys", async (req, res) => {
  try {
    await connectToDatabase();

    const { role, assignedAC } = req.query ?? {};

    const filter = {};

    if (role) {
      const roles = Array.isArray(role)
        ? role
        : String(role)
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);

      if (roles.length > 0) {
        filter.createdByRole = { $in: roles };
      }
    }

    if (assignedAC !== undefined) {
      const assignedValues = Array.isArray(assignedAC)
        ? assignedAC
        : String(assignedAC)
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);

      const assignedNumbers = assignedValues
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));

      if (assignedNumbers.length > 0) {
        filter.assignedACs = { $in: assignedNumbers };
      }
    }

    const surveys = await Survey.find(filter).sort({ createdAt: -1 });

    return res.json(surveys.map((survey) => survey.toJSON()));
  } catch (error) {
    console.error("Error fetching surveys", error);
    return res.status(500).json({ message: "Failed to fetch surveys" });
  }
});

app.get("/api/surveys/:surveyId", async (req, res) => {
  try {
    await connectToDatabase();

    const { surveyId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
      return res.status(400).json({ message: "Invalid survey ID" });
    }

    const survey = await Survey.findById(surveyId);

    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }

    return res.json(survey.toJSON());
  } catch (error) {
    console.error("Error fetching survey", error);
    return res.status(500).json({ message: "Failed to fetch survey" });
  }
});

app.post("/api/surveys", async (req, res) => {
  try {
    await connectToDatabase();

    const {
      title,
      description,
      status,
      questions,
      assignedACs,
      createdBy,
      createdByRole,
      metadata,
    } = req.body ?? {};

    const survey = await Survey.create({
      title: sanitizeTitle(title),
      description: sanitizeDescription(description),
      status: sanitizeStatus(status),
      questions: normalizeQuestions(questions),
      assignedACs: sanitizeAssignedACs(assignedACs),
      createdBy: sanitizeCreatedBy(createdBy),
      createdByRole: sanitizeCreatedByRole(createdByRole),
      metadata: metadata && typeof metadata === "object" ? metadata : undefined,
    });

    return res.status(201).json(survey.toJSON());
  } catch (error) {
    console.error("Error creating survey", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Failed to create survey" });
  }
});

app.put("/api/surveys/:surveyId", async (req, res) => {
  try {
    await connectToDatabase();

    const { surveyId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
      return res.status(400).json({ message: "Invalid survey ID" });
    }

    const survey = await Survey.findById(surveyId);

    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }

    const {
      title,
      description,
      status,
      questions,
      assignedACs,
      metadata,
    } = req.body ?? {};

    survey.title = sanitizeTitle(title ?? survey.title);
    survey.description = sanitizeDescription(
      description === undefined ? survey.description : description,
    );
    survey.status = sanitizeStatus(status ?? survey.status);
    survey.questions = normalizeQuestions(questions ?? survey.questions);
    survey.assignedACs =
      assignedACs !== undefined
        ? sanitizeAssignedACs(assignedACs)
        : survey.assignedACs;
    survey.metadata =
      metadata && typeof metadata === "object" ? metadata : survey.metadata;

    await survey.save();

    return res.json(survey.toJSON());
  } catch (error) {
    console.error("Error updating survey", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Failed to update survey" });
  }
});

app.delete("/api/surveys/:surveyId", async (req, res) => {
  try {
    await connectToDatabase();

    const { surveyId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
      return res.status(400).json({ message: "Invalid survey ID" });
    }

    const survey = await Survey.findByIdAndDelete(surveyId);

    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }

    return res.status(204).send();
  } catch (error) {
    console.error("Error deleting survey", error);
    return res.status(500).json({ message: "Failed to delete survey" });
  }
});

// Dashboard Statistics API
app.get("/api/dashboard/stats/:acId", async (req, res) => {
  try {
    await connectToDatabase();
    
    const acId = parseInt(req.params.acId);
    
    if (isNaN(acId)) {
      return res.status(400).json({ message: "Invalid AC ID" });
    }
    
    // Query filter - support both aci_num (preferred) and aci_id (fallback)
    // For Thondamuthur AC 119, we query: { aci_num: 119, aci_name: "THONDAMUTHUR" }
    const acQuery = { 
      $or: [
        { aci_num: acId },
        { aci_id: acId }
      ]
    };
    
    // Get total voters for this AC using aci_num
    const totalVoters = await Voter.countDocuments(acQuery);
    
    // Get unique families (by grouping voters with same guardian/father name and address)
    const familiesAggregation = await Voter.aggregate([
      { $match: acQuery },
      { 
        $group: { 
          _id: { 
            address: "$address", 
            guardian: "$guardian",
            booth_id: "$booth_id"
          } 
        } 
      },
      { $count: "total" }
    ]);
    const totalFamilies = familiesAggregation.length > 0 ? familiesAggregation[0].total : 0;
    
    // Get surveys completed for this AC (from surveys collection)
    const surveysCompleted = await Survey.countDocuments({ 
      assignedACs: acId,
      status: "Active"
    });
    
    // Get unique booths for this AC
    const boothsAggregation = await Voter.aggregate([
      { $match: acQuery },
      { $group: { _id: "$boothno" } },
      { $count: "total" }
    ]);
    const totalBooths = boothsAggregation.length > 0 ? boothsAggregation[0].total : 0;
    
    // Get booth-wise data
    const boothStats = await Voter.aggregate([
      { $match: acQuery },
      { 
        $group: { 
          _id: { 
            boothno: "$boothno",
            boothname: "$boothname",
            booth_id: "$booth_id"
          },
          voters: { $sum: 1 }
        } 
      },
      { $sort: { "_id.boothno": 1 } },
      { $limit: 10 }
    ]);
    
    return res.json({
      acId,
      totalVoters,
      totalFamilies,
      surveysCompleted,
      totalBooths,
      boothStats: boothStats.map(booth => ({
        boothNo: booth._id.boothno,
        boothName: booth._id.boothname,
        boothId: booth._id.booth_id,
        voters: booth.voters
      }))
    });
    
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return res.status(500).json({ message: "Failed to fetch dashboard statistics" });
  }
});

// Get all voters for a specific AC with optional booth filter
app.get("/api/voters/:acId", async (req, res) => {
  try {
    await connectToDatabase();
    
    const acId = parseInt(req.params.acId);
    const { booth, search, status, page = 1, limit = 50 } = req.query;
    
    if (isNaN(acId)) {
      return res.status(400).json({ message: "Invalid AC ID" });
    }
    
    // Build query - support both aci_num and aci_id
    const query = {
      $or: [
        { aci_num: acId },
        { aci_id: acId }
      ]
    };
    
    // Add booth filter if provided
    if (booth && booth !== 'all') {
      query.boothname = booth;
    }
    
    // Add status filter if provided
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Add search filter if provided
    if (search) {
      query.$or = [
        { 'name.english': { $regex: search, $options: 'i' } },
        { 'name.tamil': { $regex: search, $options: 'i' } },
        { voterID: { $regex: search, $options: 'i' } }
      ];
      
      // Need to recreate the AC query when search is present
      query.$and = [
        {
          $or: [
            { aci_num: acId },
            { aci_id: acId }
          ]
        }
      ];
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Fetch voters with pagination
    const voters = await Voter.find(query)
      .select('name voterID family_id booth_id boothname boothno mobile status age gender verified')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ boothno: 1, name: 1 });
    
    // Get total count
    const totalVoters = await Voter.countDocuments(query);
    
    return res.json({
      voters: voters.map(voter => ({
        id: voter._id,
        name: voter.name?.english || voter.name?.tamil || 'N/A',
        voterId: voter.voterID || 'N/A',
        familyId: voter.family_id || 'N/A',
        booth: voter.boothname || `Booth ${voter.boothno || 'N/A'}`,
        boothNo: voter.boothno,
        phone: voter.mobile ? `+91 ${voter.mobile}` : 'N/A',
        status: voter.status || 'Not Contacted',
        age: voter.age,
        gender: voter.gender,
        verified: voter.verified || false
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalVoters,
        pages: Math.ceil(totalVoters / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error("Error fetching voters:", error);
    return res.status(500).json({ message: "Failed to fetch voters" });
  }
});

// Get distinct booths for a specific AC
app.get("/api/voters/:acId/booths", async (req, res) => {
  try {
    await connectToDatabase();
    
    const acId = parseInt(req.params.acId);
    
    if (isNaN(acId)) {
      return res.status(400).json({ message: "Invalid AC ID" });
    }
    
    // Get distinct booth names for this AC
    const booths = await Voter.distinct("boothname", {
      $or: [
        { aci_num: acId },
        { aci_id: acId }
      ]
    });
    
    // Filter out null/empty values and sort
    const validBooths = booths
      .filter(booth => booth && booth.trim())
      .sort();
    
    return res.json({ booths: validBooths });
    
  } catch (error) {
    console.error("Error fetching booths:", error);
    return res.status(500).json({ message: "Failed to fetch booths" });
  }
});

// Get families for a specific AC (aggregated from voters)
app.get("/api/families/:acId", async (req, res) => {
  try {
    await connectToDatabase();
    
    const acId = parseInt(req.params.acId);
    const { booth, search, page = 1, limit = 50 } = req.query;
    
    if (isNaN(acId)) {
      return res.status(400).json({ message: "Invalid AC ID" });
    }
    
    // Build match query
    const matchQuery = {
      $or: [
        { aci_num: acId },
        { aci_id: acId }
      ]
    };
    
    // Add booth filter if provided
    if (booth && booth !== 'all') {
      matchQuery.boothname = booth;
    }
    
    // Aggregate families by grouping voters with same address and booth
    const familiesAggregation = await Voter.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            address: "$address",
            booth: "$boothname",
            boothno: "$boothno"
          },
          family_head: { $first: "$name" },
          members: { $sum: 1 },
          voters: { $push: { name: "$name", voterID: "$voterID", age: "$age", gender: "$gender", mobile: "$mobile" } },
          mobile: { $first: "$mobile" }
        }
      },
      { $sort: { "_id.boothno": 1, "_id.address": 1 } }
    ]);
    
    // Apply search filter if provided (client-side filtering after aggregation)
    let filteredFamilies = familiesAggregation;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredFamilies = familiesAggregation.filter(family => 
        (family.family_head?.english?.toLowerCase().includes(searchLower) ||
         family.family_head?.tamil?.toLowerCase().includes(searchLower) ||
         family._id.address?.toLowerCase().includes(searchLower))
      );
    }
    
    // Pagination
    const total = filteredFamilies.length;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedFamilies = filteredFamilies.slice(skip, skip + parseInt(limit));
    
    return res.json({
      families: paginatedFamilies.map((family, index) => ({
        id: `FAM${skip + index + 1}`.padStart(8, '0'),
        family_head: family.family_head?.english || family.family_head?.tamil || family.voters[0]?.name?.english || 'N/A',
        members: family.members,
        address: family._id.address || 'N/A',
        booth: family._id.booth || `Booth ${family._id.boothno || 'N/A'}`,
        boothNo: family._id.boothno,
        phone: family.mobile ? `+91 ${family.mobile}` : 'N/A',
        status: family.members > 0 ? 'Active' : 'Inactive',
        voters: family.voters
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error("Error fetching families:", error);
    return res.status(500).json({ message: "Failed to fetch families" });
  }
});

// Get survey responses for a specific AC
app.get("/api/survey-responses/:acId", async (req, res) => {
  try {
    await connectToDatabase();
    
    const acId = parseInt(req.params.acId);
    const { booth, survey, page = 1, limit = 50 } = req.query;
    
    if (isNaN(acId)) {
      return res.status(400).json({ message: "Invalid AC ID" });
    }
    
    const SurveyResponse = mongoose.model('SurveyResponse', new mongoose.Schema({}, { strict: false, collection: 'surveyresponses' }));
    
    // Build query
    const query = {};
    
    // Note: Survey responses might not have aci_num/aci_id directly
    // They might be linked through voter or booth data
    // Adjust based on your actual schema
    
    if (booth && booth !== 'all') {
      query.booth = booth;
    }
    
    if (survey && survey !== 'all') {
      query.surveyId = survey;
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Fetch survey responses
    const responses = await SurveyResponse.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });
    
    const totalResponses = await SurveyResponse.countDocuments(query);
    
    return res.json({
      responses: responses.map(response => ({
        id: response._id,
        survey_id: response.surveyId || response.formId || 'N/A',
        respondent_name: response.voterName || response.respondentName || 'N/A',
        voter_id: response.voterId || 'N/A',
        booth: response.booth || 'N/A',
        survey_date: response.createdAt || response.submittedAt || new Date(),
        status: response.status || 'Completed',
        answers: response.answers || response.responses || []
      })),
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

// Get booth performance reports
app.get("/api/reports/:acId/booth-performance", async (req, res) => {
  try {
    await connectToDatabase();
    
    const acId = parseInt(req.params.acId);
    const { booth } = req.query;
    
    if (isNaN(acId)) {
      return res.status(400).json({ message: "Invalid AC ID" });
    }
    
    // Build match query
    const matchQuery = {
      $or: [
        { aci_num: acId },
        { aci_id: acId }
      ]
    };
    
    if (booth && booth !== 'all') {
      matchQuery.boothname = booth;
    }
    
    // Aggregate booth performance data
    const boothPerformance = await Voter.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            boothname: "$boothname",
            boothno: "$boothno"
          },
          total_voters: { $sum: 1 },
          male_voters: {
            $sum: { $cond: [{ $eq: ["$gender", "Male"] }, 1, 0] }
          },
          female_voters: {
            $sum: { $cond: [{ $eq: ["$gender", "Female"] }, 1, 0] }
          },
          verified_voters: {
            $sum: { $cond: ["$verified", 1, 0] }
          },
          avg_age: { $avg: "$age" }
        }
      },
      { $sort: { "_id.boothno": 1 } }
    ]);
    
    // Get survey completion data (if survey responses have booth info)
    const SurveyResponse = mongoose.model('SurveyResponse', new mongoose.Schema({}, { strict: false, collection: 'surveyresponses' }));
    const surveysByBooth = await SurveyResponse.aggregate([
      {
        $group: {
          _id: "$booth",
          surveys_completed: { $sum: 1 }
        }
      }
    ]);
    
    const surveyMap = new Map(surveysByBooth.map(s => [s._id, s.surveys_completed]));
    
    // Calculate families per booth
    const familiesByBooth = await Voter.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            booth: "$boothname",
            address: "$address"
          }
        }
      },
      {
        $group: {
          _id: "$_id.booth",
          total_families: { $sum: 1 }
        }
      }
    ]);
    
    const familyMap = new Map(familiesByBooth.map(f => [f._id, f.total_families]));
    
    return res.json({
      reports: boothPerformance.map(booth => ({
        booth: booth._id.boothname || `Booth ${booth._id.boothno}`,
        boothNo: booth._id.boothno,
        total_voters: booth.total_voters,
        total_families: familyMap.get(booth._id.boothname) || 0,
        male_voters: booth.male_voters,
        female_voters: booth.female_voters,
        verified_voters: booth.verified_voters,
        surveys_completed: surveyMap.get(booth._id.boothname) || 0,
        avg_age: Math.round(booth.avg_age || 0),
        completion_rate: booth.total_voters > 0 
          ? Math.round(((surveyMap.get(booth._id.boothname) || 0) / booth.total_voters) * 100)
          : 0
      }))
    });
    
  } catch (error) {
    console.error("Error fetching booth performance:", error);
    return res.status(500).json({ message: "Failed to fetch booth performance" });
  }
});

app.get("/api/health", async (_req, res) => {
  try {
    await connectToDatabase();
    return res.json({ status: "ok" });
  } catch (error) {
    return res.status(503).json({ status: "error", message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Auth server listening on port ${PORT}`);
});

