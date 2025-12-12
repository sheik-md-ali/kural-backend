import express from "express";
import mongoose from "mongoose";
import Survey from "../models/Survey.js";
import { connectToDatabase } from "../config/database.js";
import {
  sanitizeTitle,
  sanitizeDescription,
  sanitizeStatus,
  sanitizeAssignedACs,
  normalizeQuestions,
  sanitizeCreatedBy,
  sanitizeCreatedByRole,
} from "../utils/helpers.js";
import { isAuthenticated, canAccessAC } from "../middleware/auth.js";
import { writeRateLimiter } from "../middleware/rateLimit.js";
import { getCache, setCache, TTL } from "../utils/cache.js";

const router = express.Router();

// Apply authentication to all routes
router.use(isAuthenticated);

// Get all surveys
router.get("/", async (req, res) => {
  try {
    await connectToDatabase();

    const { role, assignedAC } = req.query ?? {};

    // Build cache key from query params
    const cacheKey = `surveys:list:${role || 'all'}:${assignedAC || 'all'}`;
    const cached = getCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

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

    const response = surveys.map((survey) => survey.toJSON());

    // Cache surveys list for 5 minutes
    setCache(cacheKey, response, TTL.MEDIUM);

    return res.json(response);
  } catch (error) {
    console.error("Error fetching surveys", error);
    return res.status(500).json({ message: "Failed to fetch surveys" });
  }
});

// Get single survey by ID
router.get("/:surveyId", async (req, res) => {
  try {
    await connectToDatabase();

    const { surveyId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(surveyId)) {
      return res.status(400).json({ message: "Invalid survey ID" });
    }

    // Check cache first
    const cacheKey = `survey:${surveyId}`;
    const cached = getCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const survey = await Survey.findById(surveyId);

    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }

    const response = survey.toJSON();

    // Cache individual survey for 10 minutes
    setCache(cacheKey, response, TTL.MEDIUM * 2);

    return res.json(response);
  } catch (error) {
    console.error("Error fetching survey", error);
    return res.status(500).json({ message: "Failed to fetch survey" });
  }
});

// Create new survey (ISS-022 fix: rate limited)
router.post("/", writeRateLimiter, async (req, res) => {
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

    // Debug: Log incoming questions to see optionMappings
    console.log('Received questions:', JSON.stringify(questions, null, 2));

    // Convert metadata to Map if it's a plain object
    let metadataValue = undefined;
    if (metadata && typeof metadata === "object" && !Array.isArray(metadata) && metadata !== null) {
      const entries = Object.entries(metadata);
      if (entries.length > 0) {
        metadataValue = Object.fromEntries(entries);
      }
    }

    const normalizedQuestions = normalizeQuestions(questions);
    console.log('Normalized questions:', JSON.stringify(normalizedQuestions, null, 2));

    const surveyData = {
      title: sanitizeTitle(title),
      description: sanitizeDescription(description),
      status: sanitizeStatus(status),
      questions: normalizedQuestions,
      assignedACs: sanitizeAssignedACs(assignedACs),
    };

    // Only add optional fields if they have values
    const sanitizedCreatedBy = sanitizeCreatedBy(createdBy);
    if (sanitizedCreatedBy) {
      surveyData.createdBy = sanitizedCreatedBy;
    }

    const sanitizedCreatedByRole = sanitizeCreatedByRole(createdByRole);
    if (sanitizedCreatedByRole) {
      surveyData.createdByRole = sanitizedCreatedByRole;
    }

    if (metadataValue) {
      surveyData.metadata = metadataValue;
    }

    console.log('Survey data to save:', JSON.stringify(surveyData, null, 2));

    const survey = await Survey.create(surveyData);

    const savedSurvey = survey.toJSON();
    console.log('Saved survey:', JSON.stringify(savedSurvey, null, 2));

    return res.status(201).json(savedSurvey);
  } catch (error) {
    console.error("Error creating survey", error);
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: error.message,
        errors: error.errors
      });
    }
    // Handle duplicate key error for formNumber
    if (error.code === 11000 && error.message.includes('formNumber')) {
      return res.status(400).json({
        message: "A survey with this form number already exists. Please use a different form number or leave it empty.",
        error: "Duplicate form number"
      });
    }
    return res.status(500).json({
      message: "Failed to create survey",
      error: error.message
    });
  }
});

// Update survey (ISS-022 fix: rate limited)
router.put("/:surveyId", writeRateLimiter, async (req, res) => {
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

    // Debug: Log incoming questions
    console.log('Update - Received questions:', JSON.stringify(questions, null, 2));

    survey.title = sanitizeTitle(title ?? survey.title);
    survey.description = sanitizeDescription(
      description === undefined ? survey.description : description,
    );
    survey.status = sanitizeStatus(status ?? survey.status);

    const normalizedQuestions = normalizeQuestions(questions ?? survey.questions);
    console.log('Update - Normalized questions:', JSON.stringify(normalizedQuestions, null, 2));
    survey.questions = normalizedQuestions;

    survey.assignedACs =
      assignedACs !== undefined
        ? sanitizeAssignedACs(assignedACs)
        : survey.assignedACs;
    survey.metadata =
      metadata && typeof metadata === "object" ? metadata : survey.metadata;

    await survey.save();

    const updatedSurvey = survey.toJSON();
    console.log('Update - Saved survey:', JSON.stringify(updatedSurvey, null, 2));

    return res.json(updatedSurvey);
  } catch (error) {
    console.error("Error updating survey", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Failed to update survey" });
  }
});

// Delete survey (ISS-022 fix: rate limited)
router.delete("/:surveyId", writeRateLimiter, async (req, res) => {
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

export default router;
