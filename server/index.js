import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import fs from "fs";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

import User from "./models/User.js";
import Survey from "./models/Survey.js";
import Voter from "./models/Voter.js";
import Booth from "./models/Booth.js";
import VoterField from "./models/VoterField.js";
import MasterDataSection from "./models/MasterDataSection.js";
import MasterQuestion from "./models/MasterQuestion.js";
import SurveyMasterDataMapping from "./models/SurveyMasterDataMapping.js";
import MappedField from "./models/MappedField.js";
import MobileAppQuestion from "./models/MobileAppQuestion.js";

// Import RBAC routes
import rbacRoutes from "./routes/rbac.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, ".env");

dotenv.config({
  path: fs.existsSync(envPath) ? envPath : undefined,
});

const app = express();
app.set("trust proxy", 1);

const PORT = process.env.PORT || 4000;
const isProduction = process.env.NODE_ENV === "production";
const DEFAULT_LOCALHOST_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:8080",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:3000",
];
const CLIENT_ORIGINS = Array.from(
  new Set(
    (process.env.CLIENT_ORIGIN || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
      .concat(isProduction ? [] : DEFAULT_LOCALHOST_ORIGINS),
  ),
);
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/kuralapp";
const SESSION_COOKIE_DOMAIN =
  process.env.SESSION_COOKIE_DOMAIN && process.env.SESSION_COOKIE_DOMAIN.trim()
    ? process.env.SESSION_COOKIE_DOMAIN.trim()
    : undefined;
const SESSION_COOKIE_SAMESITE =
  process.env.SESSION_COOKIE_SAMESITE?.toLowerCase() || (isProduction ? "none" : "lax");

function isLocalhostOrigin(origin) {
  try {
    const { hostname } = new URL(origin);
    return ["localhost", "127.0.0.1", "0.0.0.0"].includes(hostname);
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      const isAllowed =
        CLIENT_ORIGINS.includes("*") ||
        CLIENT_ORIGINS.includes(origin) ||
        (!isProduction && isLocalhostOrigin(origin));

      if (isAllowed) {
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

// Initialize MongoDB session store
// Using MongoDB URI directly - connect-mongo will handle the connection
const sessionStore = MongoStore.create({
  mongoUrl: MONGODB_URI,
  collectionName: 'sessions',
  ttl: 24 * 60 * 60, // 24 hours in seconds
  autoRemove: 'native',
  touchAfter: 24 * 3600, // lazy session update
});

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || "kural-election-management-secret-key-2024",
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    name: 'kural.sid', // Set a specific session cookie name
    cookie: {
      secure: isProduction,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: SESSION_COOKIE_SAMESITE,
      path: '/',
      domain: SESSION_COOKIE_DOMAIN,
    },
  })
);

// Middleware to restore user from session
app.use((req, res, next) => {
  if (req.session && req.session.user) {
    req.user = req.session.user;
    console.log('Session restored - User:', {
      id: req.user.id || req.user._id,
      role: req.user.role,
      sessionId: req.sessionID
    });
  } else {
    console.log('No user in session:', {
      hasSession: !!req.session,
      sessionId: req.sessionID,
      cookies: req.headers.cookie
    });
  }
  next();
});

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
  ["Booth Agent", "BoothAgent"],
  ["BoothAgent", "BoothAgent"],
  ["War Room", "L9"],
  ["Command", "L9"],
  ["L9", "L9"],
]);

function escapeRegExp(string) {
  return String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildAcQuery(acIdentifier) {
  if (acIdentifier === undefined || acIdentifier === null) {
    return null;
  }

  const conditions = [];
  const seen = new Set();
  const addCondition = (condition) => {
    const key = JSON.stringify(condition);
    if (!seen.has(key)) {
      conditions.push(condition);
      seen.add(key);
    }
  };

  const identifierString =
    typeof acIdentifier === "string" ? acIdentifier.trim() : null;
  if (identifierString) {
    const regex = new RegExp(`^${escapeRegExp(identifierString)}$`, "i");
    addCondition({ aci_name: regex });
    addCondition({ ac_name: regex });
  }

  const numericIdentifier = Number(
    identifierString ?? (typeof acIdentifier === "number" ? acIdentifier : NaN),
  );
  if (Number.isFinite(numericIdentifier)) {
    addCondition({ aci_num: numericIdentifier });
    addCondition({ aci_id: numericIdentifier });
  }

  if (conditions.length === 0) {
    return null;
  }

  return { $or: conditions };
}

function unwrapLegacyFieldValue(value) {
  const isLegacyObject =
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    Object.prototype.hasOwnProperty.call(value, "value");

  if (isLegacyObject) {
    const actualValue = Object.prototype.hasOwnProperty.call(value, "value")
      ? value.value
      : undefined;
    return {
      actualValue,
      legacyVisible:
        typeof value.visible === "boolean" ? value.visible : undefined,
      wasLegacyFormat: true,
    };
  }

  return { actualValue: value, legacyVisible: undefined, wasLegacyFormat: false };
}

function inferFieldTypeFromValue(value) {
  if (value === null || value === undefined) {
    return "String";
  }
  if (value instanceof Date) {
    return "Date";
  }
  if (typeof value === "number") {
    return "Number";
  }
  if (typeof value === "boolean") {
    return "Boolean";
  }
  if (typeof value === "string") {
    const maybeDate = Date.parse(value);
    if (!Number.isNaN(maybeDate) && value.includes("-")) {
      return "Date";
    }
    return "String";
  }
  return "Object";
}

function hasMeaningfulValue(value) {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return true;
}

let indexFixAttempted = false;

async function connectToDatabase() {
  if (!MONGODB_URI) {
    throw new Error("Missing MONGODB_URI environment variable");
  }

  const wasConnected = mongoose.connection.readyState === 1;

  if (!wasConnected) {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
  }

  // Fix formNumber index to be sparse (allows multiple null values) - only once
  if (!indexFixAttempted && mongoose.connection.readyState === 1) {
    indexFixAttempted = true;
    try {
      const surveysCollection = mongoose.connection.db.collection('surveys');
      const indexes = await surveysCollection.indexes();
      
      // Drop old formId_1 index if it exists (legacy index from old schema)
      const formIdIndex = indexes.find(idx => idx.name === 'formId_1');
      if (formIdIndex) {
        try {
          await surveysCollection.dropIndex('formId_1');
          console.log('✓ Dropped old formId_1 index (legacy index)');
        } catch (dropError) {
          console.log('Could not drop formId_1 index (may not exist):', dropError.message);
        }
      }
      
      const formNumberIndex = indexes.find(idx => idx.name === 'formNumber_1');
      
      if (formNumberIndex) {
        if (!formNumberIndex.sparse) {
          // Drop the old non-sparse index
          try {
            await surveysCollection.dropIndex('formNumber_1');
            console.log('Dropped old formNumber_1 index');
          } catch (dropError) {
            console.log('Could not drop index (may not exist):', dropError.message);
          }
          // Create a new sparse unique index
          await surveysCollection.createIndex({ formNumber: 1 }, { unique: true, sparse: true });
          console.log('✓ Fixed formNumber index: converted to sparse');
        } else {
          console.log('✓ formNumber index is already sparse');
        }
      } else {
        // Create the index if it doesn't exist
        await surveysCollection.createIndex({ formNumber: 1 }, { unique: true, sparse: true });
        console.log('✓ Created formNumber index as sparse');
      }
    } catch (error) {
      console.error('Error fixing formNumber index:', error.message);
      console.error('Full error:', error);
      // Continue even if index fix fails
    }
  }
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

      // Preserve masterQuestionId if it exists
      if (question.masterQuestionId !== undefined && question.masterQuestionId !== null) {
        const masterQuestionId = String(question.masterQuestionId).trim();
        if (masterQuestionId) {
          normalized.masterQuestionId = masterQuestionId;
        }
      }

      if (Array.isArray(question.options)) {
        const options = question.options
          .map((option) => (typeof option === "string" ? option.trim() : ""))
          .filter((option) => option);

        if (options.length > 0) {
          normalized.options = options;
        }
      }

      // Preserve optionMappings if they exist
      if (question.optionMappings !== undefined && question.optionMappings !== null) {
        if (Array.isArray(question.optionMappings)) {
          const optionMappings = question.optionMappings
            .map((mapping) => {
              if (
                typeof mapping === "object" &&
                mapping !== null &&
                typeof mapping.surveyOptionIndex === "number" &&
                typeof mapping.masterQuestionId === "string" &&
                mapping.masterQuestionId.trim() &&
                typeof mapping.masterOptionValue === "string" &&
                mapping.masterOptionValue.trim()
              ) {
                return {
                  surveyOptionIndex: mapping.surveyOptionIndex,
                  masterQuestionId: mapping.masterQuestionId.trim(),
                  masterOptionValue: mapping.masterOptionValue.trim(),
                };
              }
              return null;
            })
            .filter(Boolean);

          // Include optionMappings even if empty array (to preserve the field)
          normalized.optionMappings = optionMappings;
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

const MASTER_QUESTION_TYPES = new Set([
  "short-answer",
  "long-answer",
  "multiple-choice",
  "checkboxes",
  "dropdown",
  "number",
  "date",
  "email",
  "phone",
  "rating",
]);

// Types that require answer options
const OPTION_REQUIRED_TYPES = new Set([
  "multiple-choice",
  "checkboxes",
  "dropdown",
  "rating",
]);

function sanitizeSectionName(name) {
  if (typeof name !== "string") {
    return "";
  }
  return name.trim();
}

function normalizeAnswerOptions(questionType, rawOptions) {
  // Only process options for types that require them
  if (!OPTION_REQUIRED_TYPES.has(questionType)) {
    return [];
  }

  if (!Array.isArray(rawOptions)) {
    return [];
  }

  const normalizedOptions = rawOptions
    .map((option, index) => {
      if (typeof option === "string") {
        const trimmed = option.trim();
        if (!trimmed) {
          return null;
        }
        return {
          label: trimmed,
          value: trimmed,
          order: index,
          isDefault: false,
        };
      }

      if (typeof option === "object" && option !== null) {
        const label =
          typeof option.label === "string" && option.label.trim()
            ? option.label.trim()
            : typeof option.value === "string" && option.value.trim()
              ? option.value.trim()
              : "";
        const value =
          typeof option.value === "string" && option.value.trim()
            ? option.value.trim()
            : label;

        if (!label && !value) {
          return null;
        }

        const order =
          typeof option.order === "number" && Number.isFinite(option.order)
            ? option.order
            : index;

        return {
          label: label || value,
          value: value || label,
          order,
          isDefault: Boolean(option.isDefault),
        };
      }

      return null;
    })
    .filter(Boolean);

  const seenValues = new Set();
  return normalizedOptions.filter((option) => {
    const key = option.value.toLowerCase();
    if (seenValues.has(key)) {
      return false;
    }
    seenValues.add(key);
    return true;
  });
}

function normalizeMasterQuestion(question, fallbackOrder = 0) {
  if (typeof question !== "object" || question === null) {
    throw new Error("Invalid question payload");
  }

  const prompt =
    typeof question.prompt === "string" && question.prompt.trim()
      ? question.prompt.trim()
      : typeof question.text === "string" && question.text.trim()
        ? question.text.trim()
        : "";

  if (!prompt) {
    throw new Error("Question prompt is required");
  }

  const typeInput =
    typeof question.type === "string" && question.type.trim()
      ? question.type.trim().toLowerCase()
      : "short-answer";
  const normalizedType = MASTER_QUESTION_TYPES.has(typeInput)
    ? typeInput
    : "short-answer";

  const helperText =
    typeof question.helperText === "string" && question.helperText.trim()
      ? question.helperText.trim()
      : undefined;

  const order =
    typeof question.order === "number" && Number.isFinite(question.order)
      ? question.order
      : fallbackOrder;

  const options = OPTION_REQUIRED_TYPES.has(normalizedType)
    ? normalizeAnswerOptions(
        normalizedType,
        question.options ?? question.answers ?? [],
      )
    : [];

  if (OPTION_REQUIRED_TYPES.has(normalizedType) && options.length === 0) {
    throw new Error(
      "This question type requires at least one answer option",
    );
  }

  return {
    prompt,
    type: normalizedType,
    isRequired: Boolean(question.isRequired ?? question.required ?? false),
    isVisible: question.isVisible !== undefined ? Boolean(question.isVisible) : true,
    helperText,
    order,
    options,
  };
}

function formatMasterQuestionResponse(questionDoc) {
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
          }))
      : [];

  return {
    id: question._id?.toString?.() ?? question._id ?? undefined,
    prompt: question.prompt,
    type: question.type,
    isRequired: Boolean(question.isRequired),
    helperText: question.helperText,
    order: question.order ?? 0,
    isVisible: question.isVisible !== undefined ? Boolean(question.isVisible) : true,
    options: formattedOptions,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
  };
}

async function formatMasterSectionResponse(sectionDoc, includeQuestions = true) {
  if (!sectionDoc) {
    return null;
  }

  const section =
    typeof sectionDoc.toObject === "function"
      ? sectionDoc.toObject({ versionKey: false })
      : sectionDoc;

  let formattedQuestions = [];
  if (includeQuestions) {
    const questions = await MasterQuestion.find({ sectionId: section._id || sectionDoc._id })
      .sort({ order: 1, createdAt: 1 });
    formattedQuestions = questions.map((question) => formatMasterQuestionResponse(question)).filter(Boolean);
  }

  return {
    id: section._id?.toString?.() ?? section._id ?? undefined,
    name: section.name,
    description: section.description,
    order: section.order ?? 0,
    aci_id: Array.isArray(section.aci_id) ? section.aci_id : [],
    aci_name: Array.isArray(section.aci_name) ? section.aci_name : [],
    isVisible: section.isVisible !== undefined ? Boolean(section.isVisible) : true,
    createdAt: section.createdAt,
    updatedAt: section.updatedAt,
    questions: formattedQuestions,
  };
}

app.post("/api/auth/login", async (req, res) => {
  try {
    const { identifier, password } = req.body ?? {};

    if (!identifier || !password) {
      return res.status(400).json({
        message: "Identifier and password are required",
      });
    }

    try {
      await connectToDatabase();
    } catch (dbError) {
      console.error("Database connection error:", dbError);
      console.error("Database connection error stack:", dbError.stack);
      return res.status(500).json({ 
        message: "Database connection failed",
        error: process.env.NODE_ENV === "development" ? dbError.message : undefined
      });
    }

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
      console.warn("Login failed: user not found", { 
        identifier: normalizedIdentifier,
        lookupConditions: lookupConditions.length,
        identifierVariants: Array.from(identifierVariants)
      });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    console.log("User found:", { 
      userId: user._id.toString(), 
      email: user.email, 
      phone: user.phone,
      role: user.role,
      isActive: user.isActive 
    });

    let isPasswordValid = false;
    try {
      isPasswordValid = await user.verifyPassword(password);
    } catch (passwordError) {
      console.error("Password verification error:", passwordError);
      console.error("Password verification error stack:", passwordError.stack);
      return res.status(500).json({ 
        message: "Error verifying password",
        error: process.env.NODE_ENV === "development" ? passwordError.message : undefined
      });
    }

    if (!isPasswordValid) {
      console.warn("Login failed: invalid password", {
        userId: user._id.toString(),
        identifier: normalizedIdentifier,
        hasPasswordHash: !!user.passwordHash,
        hasPassword: !!user.password,
      });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    console.log("Password verified successfully");

    const mappedRole = roleMap.get(user.role);
    if (!mappedRole) {
      console.warn("Login failed: role not mapped", {
        userId: user._id.toString(),
        userRole: user.role,
        availableRoles: Array.from(roleMap.keys())
      });
      return res.status(403).json({ message: "Role is not authorised" });
    }

    console.log("Role mapped successfully:", mappedRole);

    // Store user in session
    const userSession = {
      _id: user._id,
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: mappedRole,
      assignedAC: user.assignedAC ?? null,
      aciName: user.aci_name ?? null,
    };

    req.session.user = userSession;
    req.user = userSession;
    
    // Save session explicitly and wait for it
    try {
      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            console.error("Session save error:", err);
            reject(err);
          } else {
            resolve(null);
          }
        });
      });
    } catch (sessionError) {
      console.error("Failed to save session:", sessionError);
      return res.status(500).json({ message: "Failed to create session" });
    }

    console.log('Login successful - Session ID:', req.sessionID);
    console.log('Login successful - User stored in session:', !!req.session.user);
    console.log('Login successful - Cookie headers:', res.getHeader('Set-Cookie'));

    return res.json({
      user: userSession,
    });
  } catch (error) {
    console.error("Login error", error);
    console.error("Login error stack:", error.stack);
    return res.status(500).json({ 
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
  }
});

// Logout endpoint
app.post("/api/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: "Failed to logout" });
    }
    res.clearCookie("kural.sid", {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    });
    return res.json({ message: "Logged out successfully" });
  });
});

// Check session endpoint
app.get("/api/auth/me", async (req, res) => {
  // Ensure session is initialized
  if (!req.session) {
    console.log('Auth check - No session object found');
    return res.status(401).json({ message: "Not authenticated" });
  }
  
  // Debug logging
  console.log('Auth check - Session exists:', !!req.session);
  console.log('Auth check - User in session:', !!req.session?.user);
  console.log('Auth check - Session ID:', req.sessionID);
  console.log('Auth check - Cookies received:', req.headers.cookie);
  console.log('Auth check - Session keys:', req.session ? Object.keys(req.session) : 'no session');
  
  if (req.session && req.session.user) {
    // If user exists in session, verify it's still valid by checking the database
    try {
      await connectToDatabase();
      const user = await User.findById(req.session.user._id || req.session.user.id).lean();
      
      if (!user) {
        // User no longer exists in database, destroy session
        req.session.destroy((err) => {
          if (err) console.error('Error destroying session:', err);
        });
        return res.status(401).json({ message: "User not found" });
      }
      
      // Check if user is still active
      if (user.isActive === false) {
        req.session.destroy((err) => {
          if (err) console.error('Error destroying session:', err);
        });
        return res.status(401).json({ message: "User account is inactive" });
      }
      
      // Update session with latest user data (in case role or assignedAC changed)
      const mappedRole = roleMap.get(user.role);
      if (!mappedRole) {
        req.session.destroy((err) => {
          if (err) console.error('Error destroying session:', err);
        });
        return res.status(403).json({ message: "Role is not authorised" });
      }
      
      const userSession = {
        _id: user._id,
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: mappedRole,
        assignedAC: user.assignedAC ?? null,
        aciName: user.aci_name ?? null,
      };
      
      // Update session if user data changed
      if (JSON.stringify(req.session.user) !== JSON.stringify(userSession)) {
        req.session.user = userSession;
        await new Promise((resolve, reject) => {
          req.session.save((err) => {
            if (err) reject(err);
            else resolve(null);
          });
        });
      }
      
      return res.json({ user: userSession });
    } catch (error) {
      console.error('Error verifying user session:', error);
      console.error('Error stack:', error.stack);
      // On error, return proper error response in development
      if (process.env.NODE_ENV === "development") {
        return res.status(500).json({ 
          message: "Error verifying session",
          error: error.message,
          stack: error.stack
        });
      }
      // In production, still return the session user if it exists
      return res.json({ user: req.session.user });
    }
  }
  
  // Log more details for debugging
  console.log('Auth check - No user found in session');
  return res.status(401).json({ message: "Not authenticated" });
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

    // Debug: Log incoming questions to see optionMappings
    console.log('Received questions:', JSON.stringify(questions, null, 2));

    // Convert metadata to Map if it's a plain object
    // Mongoose Map type can be set directly as an object, it will convert automatically
    let metadataValue = undefined;
    if (metadata && typeof metadata === "object" && !Array.isArray(metadata) && metadata !== null) {
      const entries = Object.entries(metadata);
      if (entries.length > 0) {
        // Mongoose will automatically convert plain objects to Map for Map schema types
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

    const rawIdentifier = req.params.acId ?? req.query.aciName ?? req.query.acName;
    const acQuery = buildAcQuery(rawIdentifier);

    if (!acQuery) {
      return res.status(400).json({ message: "Invalid AC identifier" });
    }

    const identifierString =
      typeof rawIdentifier === "string" ? rawIdentifier.trim() : "";
    const numericFromIdentifier = Number(
      identifierString || (typeof rawIdentifier === "number" ? rawIdentifier : NaN),
    );
    const hasNumericIdentifier = Number.isFinite(numericFromIdentifier);

    const acMeta = await Voter.findOne(acQuery, {
      aci_name: 1,
      ac_name: 1,
      aci_num: 1,
      aci_id: 1,
    })
      .lean()
      .exec();

    const acName =
      acMeta?.aci_name ??
      acMeta?.ac_name ??
      (identifierString && !hasNumericIdentifier ? identifierString : null);
    const acNumber =
      acMeta?.aci_num ??
      acMeta?.aci_id ??
      (hasNumericIdentifier ? numericFromIdentifier : null);

    // Get total members (voters) for this AC
    const totalMembers = await Voter.countDocuments(acQuery);

    // Get unique families by grouping voters with same address and guardian
    const familiesAggregation = await Voter.aggregate([
      { $match: acQuery },
      {
        $group: {
          _id: {
            address: "$address",
            guardian: "$guardian",
            booth_id: "$booth_id",
          },
        },
      },
      { $count: "total" },
    ]);
    const totalFamilies = familiesAggregation.length > 0 ? familiesAggregation[0].total : 0;

    // Surveys Completed: Count all members who have surveyed: true
    const surveysCompleted = await Voter.countDocuments({
      ...acQuery,
      surveyed: true
    });

    // Get unique booths for this AC
    const boothsAggregation = await Voter.aggregate([
      { $match: acQuery },
      { $group: { _id: "$boothno" } },
      { $count: "total" },
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
            booth_id: "$booth_id",
          },
          voters: { $sum: 1 },
        },
      },
      { $sort: { "_id.boothno": 1 } },
      { $limit: 10 },
    ]);

    return res.json({
      acIdentifier:
        (acName ?? (hasNumericIdentifier ? String(numericFromIdentifier) : identifierString)) ||
        null,
      acId: hasNumericIdentifier ? numericFromIdentifier : acNumber ?? null,
      acName: acName ?? null,
      acNumber: acNumber ?? null,
      totalFamilies,      // Total Families
      totalMembers,       // Total Members (voters)
      surveysCompleted,   // Families with all members surveyed
      totalBooths,        // Total Booths
      boothStats: boothStats.map((booth) => ({
        boothNo: booth._id.boothno,
        boothName: booth._id.boothname,
        boothId: booth._id.booth_id,
        voters: booth.voters,
      })),
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return res.status(500).json({ message: "Failed to fetch dashboard statistics" });
  }
});

// Get single voter by ID (MUST be before /api/voters/:acId route to avoid conflicts)
app.get("/api/voters/details/:voterId", async (req, res) => {
  try {
    await connectToDatabase();
    
    const { voterId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(voterId)) {
      return res.status(400).json({ message: "Invalid voter ID" });
    }
    
    const voter = await Voter.findById(voterId).lean();
    
    if (!voter) {
      return res.status(404).json({ message: "Voter not found" });
    }
    
    return res.json(voter);
  } catch (error) {
    console.error("Error fetching voter details:", error);
    return res.status(500).json({ message: "Failed to fetch voter details", error: error.message });
  }
});

// Update a single voter by ID (MUST be before /api/voters/:acId route to avoid conflicts)
app.put("/api/voters/:voterId", async (req, res) => {
  try {
    await connectToDatabase();
    
    const { voterId } = req.params;
    const updateData = req.body;
    
    // Check if voterId looks like an ObjectId (24 hex characters)
    if (!mongoose.Types.ObjectId.isValid(voterId)) {
      return res.status(400).json({ message: "Invalid voter ID" });
    }
    
    // Get the current voter to check field structure
    const currentVoter = await Voter.findById(voterId).lean();
    if (!currentVoter) {
      return res.status(404).json({ message: "Voter not found" });
    }
    
    // Handle nested name object
    if (updateData.name && typeof updateData.name === 'string') {
      updateData.name = { ...currentVoter.name, english: updateData.name };
    }
    
    const processedUpdateData = {};
    Object.entries(updateData).forEach(([key, rawValue]) => {
      if (key === '_id' || key === '__v') {
        return;
      }
      
      if (key === 'name' && typeof rawValue === 'string') {
        processedUpdateData.name = { ...currentVoter.name, english: rawValue };
        return;
      }

      const { actualValue } = unwrapLegacyFieldValue(rawValue);
      processedUpdateData[key] = actualValue;
    });
    
    // Find and update the voter
    const voter = await Voter.findByIdAndUpdate(
      voterId,
      { $set: processedUpdateData },
      { new: true, runValidators: false } // Allow flexible schema updates
    );
    
    if (!voter) {
      return res.status(404).json({ message: "Voter not found" });
    }
    
    return res.json({
      message: "Voter updated successfully",
      voter,
    });
  } catch (error) {
    console.error("Error updating voter:", error);
    return res.status(500).json({ message: "Failed to update voter", error: error.message });
  }
});

// Get all voters for a specific AC with optional booth filter
app.get("/api/voters/:acId", async (req, res) => {
  try {
    await connectToDatabase();

    const rawIdentifier = req.params.acId ?? req.query.aciName ?? req.query.acName;
    
    // Check if the identifier looks like an ObjectId (24 hex characters)
    // If so, it's likely a voter ID, not an AC identifier
    if (mongoose.Types.ObjectId.isValid(rawIdentifier) && rawIdentifier.length === 24) {
      return res.status(400).json({ 
        message: "Invalid AC identifier. Use /api/voters/details/:voterId to fetch individual voter details." 
      });
    }
    
    const acQuery = buildAcQuery(rawIdentifier);
    if (!acQuery) {
      return res.status(400).json({ message: "Invalid AC identifier" });
    }

    const { booth, search, status, page = 1, limit = 50 } = req.query;

    const queryClauses = [acQuery];

    // Add booth filter if provided
    if (booth && booth !== "all") {
      queryClauses.push({ boothname: booth });
    }

    // Add status filter if provided
    if (status && status !== "all") {
      queryClauses.push({ status });
    }

    // Add search filter if provided
    if (search) {
      queryClauses.push({
        $or: [
          { "name.english": { $regex: search, $options: "i" } },
          { "name.tamil": { $regex: search, $options: "i" } },
          { voterID: { $regex: search, $options: "i" } },
        ],
      });
    }

    const query =
      queryClauses.length === 1 ? queryClauses[0] : { $and: queryClauses };

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch voters with pagination
    // Include name field explicitly to ensure it's fetched
    const voters = await Voter.find(query)
      .select("name voterID family_id booth_id boothname boothno mobile status age gender verified surveyed")
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ boothno: 1, "name.english": 1 })
      .lean();
    
    // Debug: Log first voter's name structure if available
    if (voters.length > 0 && process.env.NODE_ENV === 'development') {
      console.log('Sample voter name structure:', JSON.stringify(voters[0].name));
    }

    // Get total count
    const totalVoters = await Voter.countDocuments(query);

    return res.json({
      voters: voters.map((voter) => {
        // Handle name field - it can be an object with english/tamil or a string
        let voterName = "N/A";
        if (voter.name) {
          if (typeof voter.name === 'object' && voter.name !== null) {
            voterName = voter.name.english || voter.name.tamil || voter.name.value || "N/A";
          } else if (typeof voter.name === 'string') {
            voterName = voter.name;
          }
        }
        
        return {
          id: voter._id,
          name: voterName,
          voterId: voter.voterID || "N/A",
          familyId: voter.family_id || "N/A",
          booth: voter.boothname || `Booth ${voter.boothno || "N/A"}`,
          boothNo: voter.boothno,
          phone: voter.mobile ? `+91 ${voter.mobile}` : "N/A",
          status: voter.status || "Not Contacted",
          age: voter.age,
          gender: voter.gender,
          verified: voter.verified || false,
          surveyed: voter.surveyed ?? false,
        };
      }),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalVoters,
        pages: Math.ceil(totalVoters / parseInt(limit)),
      },
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

    const rawIdentifier = req.params.acId ?? req.query.aciName ?? req.query.acName;
    const acQuery = buildAcQuery(rawIdentifier);

    if (!acQuery) {
      return res.status(400).json({ message: "Invalid AC identifier" });
    }

    // Get distinct booth names for this AC
    const booths = await Voter.distinct("boothname", {
      ...acQuery,
    });

    // Filter out null/empty values and sort
    const validBooths = booths
      .filter((booth) => booth && booth.trim())
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

// Get detailed family information by address and booth
app.get("/api/families/:acId/details", async (req, res) => {
  try {
    await connectToDatabase();
    
    const acId = parseInt(req.params.acId);
    const { address, booth, boothNo } = req.query;
    
    console.log('Family details request:', {
      acId,
      address,
      booth,
      boothNo
    });
    
    if (isNaN(acId)) {
      return res.status(400).json({ message: "Invalid AC ID" });
    }
    
    if (!address || !booth) {
      return res.status(400).json({ message: "Address and booth are required" });
    }
    
    // Build match query to find all voters in this family
    const matchQuery = {
      $or: [
        { aci_num: acId },
        { aci_id: acId }
      ],
      address: address,
      boothname: booth
    };
    
    if (boothNo) {
      matchQuery.boothno = parseInt(boothNo);
    }
    
    // Fetch all family members (voters at same address and booth)
    const members = await Voter.find(matchQuery)
      .sort({ age: -1 }) // Sort by age, head of family first
      .lean();
    
    console.log('Found members:', members.length);
    
    if (members.length === 0) {
      return res.status(404).json({ message: "Family not found" });
    }
    
    // Calculate demographics
    const demographics = {
      totalMembers: members.length,
      male: members.filter(m => m.gender === 'Male').length,
      female: members.filter(m => m.gender === 'Female').length,
      surveyed: members.filter(m => m.surveyed === true).length,
      pending: members.filter(m => m.surveyed !== true).length,
      averageAge: Math.round(members.reduce((sum, m) => sum + (m.age || 0), 0) / members.length)
    };
    
    // Format family head (first/oldest member)
    const familyHead = members[0];
    
    // Format member data
    const formattedMembers = members.map((member, index) => ({
      id: member._id.toString(),
      name: member.name?.english || member.name?.tamil || 'N/A',
      voterID: member.voterID || 'N/A',
      age: member.age || 0,
      gender: member.gender || 'N/A',
      relationship: index === 0 ? 'Head' : 'Member', // First is head
      phone: member.mobile ? `+91 ${member.mobile}` : '',
      surveyed: member.surveyed === true,
      surveyedAt: member.verifiedAt || null,
      religion: member.religion || 'N/A',
      caste: member.caste || 'N/A'
    }));
    
    return res.json({
      success: true,
      family: {
        id: `${address}-${booth}`.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10).toUpperCase(),
        headName: familyHead.name?.english || familyHead.name?.tamil || 'N/A',
        address: address,
        booth: booth,
        boothNo: members[0].boothno || 0,
        acId: acId,
        acName: members[0].aci_name || `AC ${acId}`,
        phone: familyHead.mobile ? `+91 ${familyHead.mobile}` : 'N/A'
      },
      members: formattedMembers,
      demographics: demographics
    });
    
  } catch (error) {
    console.error("Error fetching family details:", error);
    return res.status(500).json({ message: "Failed to fetch family details", error: error.message });
  }
});

// Get all survey responses (for L0 admin)
app.get("/api/survey-responses", async (req, res) => {
  console.log("Survey responses endpoint hit:", req.query);
  try {
    await connectToDatabase();
    
    const { booth, survey, page = 1, limit = 50, search } = req.query;
    
    // Use the surveyresponses collection (all lowercase, one word)
    const SurveyResponse = mongoose.models.SurveyResponse || 
      mongoose.model('SurveyResponse', new mongoose.Schema({}, { strict: false, collection: 'surveyresponses' }));
    
    // Build query
    const query = {};
    
    if (booth && booth !== 'all') {
      query.booth = booth;
    }
    
    if (survey && survey !== 'all') {
      query.surveyId = survey;
    }
    
    // Search functionality
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      // Check if search is a valid ObjectId for direct matching
      const isObjectId = mongoose.Types.ObjectId.isValid(search);
      
      if (isObjectId) {
        // If it's an ObjectId, search by exact match first, then regex
        query.$or = [
          { voterId: search }, // Exact ObjectId match
          { voterName: searchRegex },
          { respondentName: searchRegex },
          { voterID: searchRegex },
          { surveyId: search },
          { formId: search }
        ];
      } else {
        // Regular text search
        query.$or = [
          { voterName: searchRegex },
          { respondentName: searchRegex },
          { voterId: searchRegex },
          { voterID: searchRegex },
          { surveyId: searchRegex },
          { formId: searchRegex }
        ];
      }
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
        voterID: response.voterID || '', // Also include voterID field
        voterId: response.voterId || response.voterID || 'N/A', // Alias for compatibility
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

// Get survey responses for a specific AC
app.get("/api/survey-responses/:acId", async (req, res) => {
  try {
    await connectToDatabase();
    
    const acId = parseInt(req.params.acId);
    const { booth, survey, page = 1, limit = 50 } = req.query;
    
    if (isNaN(acId)) {
      return res.status(400).json({ message: "Invalid AC ID" });
    }
    
    // Use the surveyresponses collection (all lowercase, one word)
    const SurveyResponse = mongoose.models.SurveyResponse || 
      mongoose.model('SurveyResponse', new mongoose.Schema({}, { strict: false, collection: 'surveyresponses' }));
    
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
        voterID: response.voterID || '', // Also include voterID field
        voterId: response.voterId || response.voterID || 'N/A', // Alias for compatibility
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
    // Use the surveyresponses collection (all lowercase, one word)
    const SurveyResponse = mongoose.models.SurveyResponse || 
      mongoose.model('SurveyResponse', new mongoose.Schema({}, { strict: false, collection: 'surveyresponses' }));
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

// Master Data APIs
app.get("/api/master-data/sections", async (_req, res) => {
  try {
    await connectToDatabase();
    const sections = await MasterDataSection.find().sort({ order: 1, createdAt: 1 });
    const formattedSections = await Promise.all(
      sections.map((section) => formatMasterSectionResponse(section, true))
    );
    return res.json({
      sections: formattedSections,
    });
  } catch (error) {
    console.error("Error fetching master data sections:", error);
    return res.status(500).json({
      message: "Failed to fetch master data sections",
      error: error.message,
    });
  }
});

app.get("/api/master-data/questions", async (req, res) => {
  try {
    await connectToDatabase();
    const { isVisible } = req.query;
    
    let query = {};
    if (isVisible !== undefined) {
      query.isVisible = isVisible === 'true' || isVisible === true;
    }

    const questions = await MasterQuestion.find(query)
      .sort({ order: 1, createdAt: 1 });
    
    return res.json({
      questions: questions.map((question) => formatMasterQuestionResponse(question)),
    });
  } catch (error) {
    console.error("Error fetching master data questions:", error);
    return res.status(500).json({
      message: "Failed to fetch master data questions",
      error: error.message,
    });
  }
});

app.post("/api/master-data/sections", async (req, res) => {
  try {
    await connectToDatabase();

    console.log("POST /api/master-data/sections - Request body:", JSON.stringify(req.body, null, 2));
    console.log("aci_id in body:", req.body?.aci_id, "Type:", typeof req.body?.aci_id, "IsArray:", Array.isArray(req.body?.aci_id));
    console.log("aci_name in body:", req.body?.aci_name, "Type:", typeof req.body?.aci_name, "IsArray:", Array.isArray(req.body?.aci_name));

    const rawName = sanitizeSectionName(req.body?.name ?? req.body?.title ?? "");
    if (!rawName) {
      return res.status(400).json({ message: "Section name is required" });
    }

    const descriptionInput = sanitizeDescription(req.body?.description);
    const description = descriptionInput ? descriptionInput : undefined;

    const orderValue =
      typeof req.body?.order === "number" && Number.isFinite(req.body.order)
        ? req.body.order
        : await MasterDataSection.countDocuments();

    // Process AC arrays - ensure they're always arrays
    let aci_id = [];
    let aci_name = [];
    
    if ('aci_id' in req.body && Array.isArray(req.body.aci_id)) {
      aci_id = req.body.aci_id.filter((id) => typeof id === "number" && Number.isFinite(id));
    }
    
    if ('aci_name' in req.body && Array.isArray(req.body.aci_name)) {
      aci_name = req.body.aci_name.filter((name) => typeof name === "string" && name.trim()).map((name) => name.trim());
    }
    
    // Ensure arrays are the same length
    const minLength = Math.min(aci_id.length, aci_name.length);
    aci_id = aci_id.slice(0, minLength);
    aci_name = aci_name.slice(0, minLength);
    
    const isVisible = req.body?.isVisible !== undefined ? Boolean(req.body.isVisible) : true;

    console.log("Creating section with AC data:", { aci_id, aci_name });

    const sectionData = {
      name: rawName,
      description,
      order: orderValue,
      aci_id: Array.isArray(aci_id) ? aci_id : [],
      aci_name: Array.isArray(aci_name) ? aci_name : [],
      isVisible,
    };
    
    console.log("Section data to create:", JSON.stringify(sectionData, null, 2));
    console.log("aci_id type:", typeof sectionData.aci_id, "isArray:", Array.isArray(sectionData.aci_id));
    console.log("aci_name type:", typeof sectionData.aci_name, "isArray:", Array.isArray(sectionData.aci_name));

    const section = await MasterDataSection.create(sectionData);

    // Reload from DB to verify it was saved
    const savedSection = await MasterDataSection.findById(section._id);
    console.log("Created section - aci_id:", savedSection?.aci_id, "aci_name:", savedSection?.aci_name);
    console.log("Section document:", JSON.stringify(savedSection?.toObject(), null, 2));

    return res.status(201).json({
      message: "Section created successfully",
      section: await formatMasterSectionResponse(savedSection || section, true),
    });
  } catch (error) {
    console.error("Error creating master data section:", error);
    if (error?.message?.toLowerCase().includes("question")) {
      return res.status(400).json({ message: error.message });
    }
    if (error.code === 11000) {
      return res.status(400).json({ message: "A section with this name already exists" });
    }
    return res.status(500).json({
      message: "Failed to create section",
      error: error.message,
    });
  }
});

app.put("/api/master-data/sections/:sectionId", async (req, res) => {
  try {
    await connectToDatabase();
    const { sectionId } = req.params;

    console.log("PUT /api/master-data/sections/:sectionId - Request body:", JSON.stringify(req.body, null, 2));
    console.log("aci_id in body:", req.body?.aci_id, "Type:", typeof req.body?.aci_id, "IsArray:", Array.isArray(req.body?.aci_id));
    console.log("aci_name in body:", req.body?.aci_name, "Type:", typeof req.body?.aci_name, "IsArray:", Array.isArray(req.body?.aci_name));

    const section = await MasterDataSection.findById(sectionId);
    if (!section) {
      return res.status(404).json({ message: "Section not found" });
    }
    
    console.log("Current section aci_id:", section.aci_id, "aci_name:", section.aci_name);

    const nameInput = sanitizeSectionName(req.body?.name ?? req.body?.title ?? "");
    if (nameInput) {
      section.name = nameInput;
    }

    if (req.body?.description !== undefined) {
      const descriptionInput = sanitizeDescription(req.body.description);
      section.description = descriptionInput || undefined;
    }

    if (req.body?.order !== undefined) {
      const parsedOrder = Number(req.body.order);
      if (!Number.isNaN(parsedOrder)) {
        section.order = parsedOrder;
      }
    }

    // Always update both arrays together to keep them in sync
    // Check if aci_id or aci_name are in the request body (even if empty arrays)
    const hasAciId = 'aci_id' in req.body;
    const hasAciName = 'aci_name' in req.body;
    
    if (hasAciId || hasAciName) {
      console.log("Processing AC arrays - hasAciId:", hasAciId, "hasAciName:", hasAciName);
      
      const aci_id = hasAciId && Array.isArray(req.body.aci_id)
        ? req.body.aci_id.filter((id) => typeof id === "number" && Number.isFinite(id))
        : (hasAciId ? [] : (Array.isArray(section.aci_id) ? section.aci_id : []));
      
      const aci_name = hasAciName && Array.isArray(req.body.aci_name)
        ? req.body.aci_name.filter((name) => typeof name === "string" && name.trim()).map((name) => name.trim())
        : (hasAciName ? [] : (Array.isArray(section.aci_name) ? section.aci_name : []));
      
      // Ensure arrays are the same length - they should always match
      const minLength = Math.min(aci_id.length, aci_name.length);
      const finalAciId = aci_id.slice(0, minLength);
      const finalAciName = aci_name.slice(0, minLength);
      
      console.log("Setting arrays - aci_id:", finalAciId, "aci_name:", finalAciName);
      
      // Use set() to ensure Mongoose recognizes the change
      section.set('aci_id', finalAciId);
      section.set('aci_name', finalAciName);
      
      // Mark as modified to ensure Mongoose saves the arrays
      section.markModified('aci_id');
      section.markModified('aci_name');
      
      console.log("After setting - section.aci_id:", section.aci_id, "section.aci_name:", section.aci_name);
      console.log("Section document before save:", JSON.stringify(section.toObject(), null, 2));
    }

    if (req.body?.isVisible !== undefined) {
      section.isVisible = Boolean(req.body.isVisible);
    }

    console.log("Before save - section aci_id:", section.aci_id, "aci_name:", section.aci_name);
    await section.save();
    
    // Reload from DB to verify it was saved
    const savedSection = await MasterDataSection.findById(section._id);
    console.log("After save - saved section aci_id:", savedSection?.aci_id, "aci_name:", savedSection?.aci_name);

    return res.json({
      message: "Section updated successfully",
      section: await formatMasterSectionResponse(savedSection || section, true),
    });
  } catch (error) {
    console.error("Error updating master data section:", error);
    if (error?.message?.toLowerCase().includes("question")) {
      return res.status(400).json({ message: error.message });
    }
    if (error.code === 11000) {
      return res.status(400).json({ message: "A section with this name already exists" });
    }
    return res.status(500).json({
      message: "Failed to update section",
      error: error.message,
    });
  }
});

app.delete("/api/master-data/sections/:sectionId", async (req, res) => {
  try {
    await connectToDatabase();
    const { sectionId } = req.params;

    const section = await MasterDataSection.findById(sectionId);
    if (!section) {
      return res.status(404).json({ message: "Section not found" });
    }

    // Delete all questions associated with this section
    await MasterQuestion.deleteMany({ sectionId: section._id });

    // Delete the section
    await MasterDataSection.findByIdAndDelete(sectionId);

    return res.json({
      message: "Section deleted successfully",
      sectionId,
    });
  } catch (error) {
    console.error("Error deleting master data section:", error);
    return res.status(500).json({
      message: "Failed to delete section",
      error: error.message,
    });
  }
});

app.post("/api/master-data/sections/:sectionId/questions", async (req, res) => {
  try {
    await connectToDatabase();
    const { sectionId } = req.params;

    const section = await MasterDataSection.findById(sectionId);
    if (!section) {
      return res.status(404).json({ message: "Section not found" });
    }

    const nextOrder =
      typeof req.body?.order === "number" && Number.isFinite(req.body.order)
        ? req.body.order
        : await MasterQuestion.countDocuments({ sectionId: section._id });

    const questionData = normalizeMasterQuestion(req.body ?? {}, nextOrder);

    const question = await MasterQuestion.create({
      ...questionData,
      sectionId: section._id,
    });

    return res.status(201).json({
      message: "Question added successfully",
      question: formatMasterQuestionResponse(question),
      section: await formatMasterSectionResponse(section, true),
    });
  } catch (error) {
    console.error("Error adding master data question:", error);
    if (error?.message?.toLowerCase().includes("question")) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({
      message: "Failed to add question",
      error: error.message,
    });
  }
});

app.put("/api/master-data/sections/:sectionId/questions/:questionId", async (req, res) => {
  try {
    await connectToDatabase();
    const { sectionId, questionId } = req.params;

    const section = await MasterDataSection.findById(sectionId);
    if (!section) {
      return res.status(404).json({ message: "Section not found" });
    }

    const question = await MasterQuestion.findOne({
      _id: questionId,
      sectionId: section._id,
    });
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    if (req.body?.prompt !== undefined || req.body?.text !== undefined) {
      const promptValue =
        typeof req.body.prompt === "string" && req.body.prompt.trim()
          ? req.body.prompt.trim()
          : typeof req.body.text === "string" && req.body.text.trim()
            ? req.body.text.trim()
            : "";
      if (!promptValue) {
        return res.status(400).json({ message: "Question prompt is required" });
      }
      question.prompt = promptValue;
    }

    if (req.body?.helperText !== undefined) {
      const helper =
        typeof req.body.helperText === "string" && req.body.helperText.trim()
          ? req.body.helperText.trim()
          : undefined;
      question.helperText = helper;
    }

    if (req.body?.isRequired !== undefined || req.body?.required !== undefined) {
      const requiredValue = Boolean(req.body.isRequired ?? req.body.required);
      question.isRequired = requiredValue;
    }

    if (req.body?.isVisible !== undefined) {
      question.isVisible = Boolean(req.body.isVisible);
    }

    if (req.body?.order !== undefined) {
      const parsedOrder = Number(req.body.order);
      if (!Number.isNaN(parsedOrder)) {
        question.order = parsedOrder;
      }
    }

    let nextType = question.type;
    if (req.body?.type !== undefined) {
      const typeInput =
        typeof req.body.type === "string" && req.body.type.trim()
          ? req.body.type.trim().toLowerCase()
          : "";
      if (MASTER_QUESTION_TYPES.has(typeInput)) {
        nextType = typeInput;
      }
    }

    const typeChanged = nextType !== question.type;
    if (typeChanged) {
      question.type = nextType;
    }

    if (OPTION_REQUIRED_TYPES.has(nextType)) {
      let normalizedOptions;
      if (req.body?.options !== undefined || req.body?.answers !== undefined) {
        normalizedOptions = normalizeAnswerOptions(
          nextType,
          req.body.options ?? req.body.answers,
        );
      } else if (!OPTION_REQUIRED_TYPES.has(question.type)) {
        // If changing from a non-option type, initialize with empty array
        normalizedOptions = [];
      } else {
        // Keep existing options if type hasn't changed and no new options provided
        normalizedOptions = normalizeAnswerOptions(nextType, question.options);
      }

      if (normalizedOptions.length === 0 && OPTION_REQUIRED_TYPES.has(nextType)) {
        return res.status(400).json({
          message: "This question type must include at least one answer option",
        });
      }
      question.options = normalizedOptions;
    } else {
      // For non-option types, clear options
      question.options = [];
    }

    await question.save();

    return res.json({
      message: "Question updated successfully",
      question: formatMasterQuestionResponse(question),
      section: await formatMasterSectionResponse(section, true),
    });
  } catch (error) {
    console.error("Error updating master data question:", error);
    if (error?.message?.toLowerCase().includes("question")) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({
      message: "Failed to update question",
      error: error.message,
    });
  }
});

app.delete("/api/master-data/sections/:sectionId/questions/:questionId", async (req, res) => {
  try {
    await connectToDatabase();
    const { sectionId, questionId } = req.params;

    const section = await MasterDataSection.findById(sectionId);
    if (!section) {
      return res.status(404).json({ message: "Section not found" });
    }

    const question = await MasterQuestion.findOne({
      _id: questionId,
      sectionId: section._id,
    });
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    await MasterQuestion.findByIdAndDelete(questionId);

    return res.json({
      message: "Question deleted successfully",
      section: await formatMasterSectionResponse(section, true),
    });
  } catch (error) {
    console.error("Error deleting master data question:", error);
    return res.status(500).json({
      message: "Failed to delete question",
      error: error.message,
    });
  }
});

// Mobile App Questions APIs
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
    isVisible: true, // Mobile app questions are always visible
    helperText: question.helperText,
    order: question.order ?? 0,
    options: formattedOptions,
    masterQuestionId: question.masterQuestionId,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
  };
}

app.get("/api/mobile-app-questions", async (_req, res) => {
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

app.post("/api/mobile-app-questions", async (req, res) => {
  try {
    await connectToDatabase();

    const questionData = normalizeMasterQuestion(req.body ?? {}, 0);
    const order =
      typeof req.body?.order === "number" && Number.isFinite(req.body.order)
        ? req.body.order
        : await MobileAppQuestion.countDocuments();

    // Preserve option IDs from master question if provided
    let options = questionData.options || [];
    if (Array.isArray(req.body?.options) && req.body.options.length > 0) {
      options = questionData.options.map((normalizedOption) => {
        // Find the matching option from the original master question by value or label
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
    if (error?.message?.toLowerCase().includes("question")) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({
      message: "Failed to create question",
      error: error.message,
    });
  }
});

app.delete("/api/mobile-app-questions/:questionId", async (req, res) => {
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

// Voter Field Management APIs

// Reserved field names - EMPTY to allow full flexibility
const RESERVED_FIELDS = [];

// Get existing fields from actual voter documents (for reference)
// MUST be before /api/voters/fields/:fieldName to avoid route conflicts
app.get("/api/voters/fields/existing", async (req, res) => {
  try {
    await connectToDatabase();
    
    // Sample a few voter documents to analyze existing fields
    const totalVoters = await Voter.countDocuments({});
    console.log(`[Fields Existing] Total voters in collection: ${totalVoters}`);
    
    const sampleVoters = await Voter.find({}).limit(100).lean();
    console.log(`[Fields Existing] Sampled ${sampleVoters.length} voters`);
    
    if (sampleVoters.length === 0) {
      console.log('[Fields Existing] No voters found in collection');
      return res.json({ fields: {}, totalVoters: 0 });
    }
    
    // Analyze all fields present in voter documents
    const fieldAnalysis = {};
    
    sampleVoters.forEach((voter) => {
      Object.keys(voter).forEach((key) => {
        // Skip MongoDB internal fields
        if (key === '_id' || key === '__v' || key === 'createdAt' || key === 'updatedAt') {
          return;
        }
        
        if (!fieldAnalysis[key]) {
          fieldAnalysis[key] = {
            type: 'Unknown',
            samples: []
          };
        }
        
        const { actualValue, legacyVisible } = unwrapLegacyFieldValue(voter[key]);
        if (fieldAnalysis[key].visible === undefined && legacyVisible !== undefined) {
          fieldAnalysis[key].visible = legacyVisible;
        }
        
        // Determine type based on actual value
        let inferredType = 'Unknown';
        if (actualValue === null || actualValue === undefined) {
          inferredType = 'Null';
        } else if (typeof actualValue === 'string') {
          inferredType = 'String';
        } else if (typeof actualValue === 'number') {
          inferredType = 'Number';
        } else if (typeof actualValue === 'boolean') {
          inferredType = 'Boolean';
        } else if (actualValue instanceof Date) {
          inferredType = 'Date';
        } else if (Array.isArray(actualValue)) {
          inferredType = 'Array';
        } else if (typeof actualValue === 'object') {
          inferredType = 'Object';
        }
        
        // Update type if it's more specific
        if (fieldAnalysis[key].type === 'Unknown' || fieldAnalysis[key].type === 'Null') {
          fieldAnalysis[key].type = inferredType;
        }
        
        // Collect sample values (up to 5 unique samples per field)
        if (fieldAnalysis[key].samples.length < 5) {
          // Format value for display
          let displayValue = actualValue;
          if (actualValue instanceof Date) {
            displayValue = actualValue.toISOString().split('T')[0];
          } else if (typeof actualValue === 'object' && actualValue !== null) {
            displayValue = JSON.stringify(actualValue);
            if (displayValue.length > 50) {
              displayValue = displayValue.substring(0, 50) + '...';
            }
          } else if (typeof actualValue === 'string' && actualValue.length > 50) {
            displayValue = actualValue.substring(0, 50) + '...';
          }
          
          // Only add unique samples
          if (!fieldAnalysis[key].samples.some(s => String(s.value) === String(displayValue))) {
            fieldAnalysis[key].samples.push({
              value: displayValue,
              type: inferredType
            });
          }
        }
      });
    });
    
    // Sort fields alphabetically
    const sortedFields = {};
    Object.keys(fieldAnalysis).sort().forEach(key => {
      sortedFields[key] = fieldAnalysis[key];
    });
    
    // Fetch visibility status from VoterField collection
    const fieldMetadata = await VoterField.find({}).lean();
    const visibilityMap = {};
    fieldMetadata.forEach(field => {
      visibilityMap[field.name] = field.visible !== undefined ? field.visible : true;
    });
    
    // Add visibility information to each field (from metadata or from object structure)
    Object.keys(sortedFields).forEach(key => {
      // If field already has visibility from object format, use that; otherwise use metadata
      if (sortedFields[key].visible === undefined) {
        sortedFields[key].visible = visibilityMap[key] !== undefined ? visibilityMap[key] : true;
      }
    });
    
    console.log(`[Fields Existing] Found ${Object.keys(sortedFields).length} unique fields`);
    console.log(`[Fields Existing] Field names:`, Object.keys(sortedFields).slice(0, 10).join(', '), '...');
    
    return res.json({ 
      fields: sortedFields,
      totalVoters,
      samplesAnalyzed: sampleVoters.length 
    });
  } catch (error) {
    console.error("Error fetching existing fields from voters:", error);
    return res.status(500).json({ message: "Failed to fetch existing fields", error: error.message });
  }
});

// Get all voter fields
app.get("/api/voters/fields", async (req, res) => {
  try {
    await connectToDatabase();
    
    const fields = await VoterField.find().sort({ name: 1 });
    
    return res.json({
      fields: fields.map(field => ({
        name: field.name,
        type: field.type,
        required: field.required,
        default: field.default,
        label: field.label,
        description: field.description,
        visible: field.visible !== undefined ? field.visible : true, // Default to true if not set
        isReserved: false, // No reserved fields - full flexibility
      })),
    });
  } catch (error) {
    console.error("Error fetching voter fields:", error);
    return res.status(500).json({ message: "Failed to fetch voter fields", error: error.message });
  }
});

// Convert all existing fields to object format { value, visible }
app.post("/api/voters/fields/convert-all", async (_req, res) => {
  try {
    await connectToDatabase();

    const cursor = Voter.find({}).lean().cursor();
    const systemFields = new Set(['_id', '__v', 'createdAt', 'updatedAt']);
    const batchSize = 500;
    let bulkOps = [];
    let batchIndex = 0;
    let flattenedFields = 0;
    let votersUpdated = 0;
    let votersChecked = 0;

    for await (const voter of cursor) {
      votersChecked++;
      const updateObj = {};

      Object.keys(voter).forEach((key) => {
        if (systemFields.has(key)) return;

        const { actualValue, wasLegacyFormat } = unwrapLegacyFieldValue(voter[key]);
        if (wasLegacyFormat) {
          updateObj[key] = actualValue ?? null;
          flattenedFields++;
        }
      });

      if (Object.keys(updateObj).length > 0) {
        bulkOps.push({
          updateOne: {
            filter: { _id: voter._id },
            update: { $set: updateObj },
          },
        });
      }

      if (bulkOps.length >= batchSize) {
        const result = await Voter.bulkWrite(bulkOps, { ordered: false });
        votersUpdated += result.modifiedCount || 0;
        console.log(`[Convert-All] Batch ${batchIndex} flattened ${result.modifiedCount || 0} voters`);
        bulkOps = [];
        batchIndex++;
      }
    }

    if (bulkOps.length > 0) {
      const result = await Voter.bulkWrite(bulkOps, { ordered: false });
      votersUpdated += result.modifiedCount || 0;
      console.log(`[Convert-All] Final batch flattened ${result.modifiedCount || 0} voters`);
    }

    return res.json({
      message: `Flattened ${flattenedFields} legacy field instances across ${votersUpdated} voter documents`,
      flattenedFields,
      votersUpdated,
      votersChecked,
    });
  } catch (error) {
    console.error("Error flattening legacy field objects:", error);
    return res.status(500).json({
      message: "Failed to normalize voter fields",
      error: error.message,
    });
  }
});

// Add a new voter field
app.post("/api/voters/fields", async (req, res) => {
  try {
    await connectToDatabase();
    
    const { name, type, required, default: defaultValue, label, description } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ message: "Field name and type are required" });
    }
    
    // Validate field name
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return res.status(400).json({ 
        message: "Field name must start with a letter or underscore and contain only letters, numbers, and underscores" 
      });
    }
    
    // Explicitly allow any field name - NO reserved field restrictions
    // All field names are allowed - full flexibility for field naming
    
    // Check if field already exists
    const existingField = await VoterField.findOne({ name });
    if (existingField) {
      return res.status(400).json({ message: `Field "${name}" already exists` });
    }
    
    // Create field metadata
    const newField = new VoterField({
      name,
      type,
      required: required || false,
      default: defaultValue,
      label,
      description,
      visible: req.body.visible !== undefined ? req.body.visible : true, // Default to visible
    });
    
    await newField.save();
    
    // Add the field to ALL existing voter documents with primitive/default values
    const normalizedDefault =
      defaultValue !== undefined && defaultValue !== null && defaultValue !== ''
        ? defaultValue
        : null;
    const updateResult = await Voter.updateMany(
      { [name]: { $exists: false } },
      { $set: { [name]: normalizedDefault } }
    );
    
    const totalVoters = await Voter.countDocuments({});
    
    return res.status(201).json({
      message: `Field "${name}" has been successfully added to all ${totalVoters} voters. ${updateResult.modifiedCount} voters were updated.`,
      field: {
        name: newField.name,
        type: newField.type,
        required: newField.required,
        default: newField.default,
        label: newField.label,
        description: newField.description,
      },
    });
  } catch (error) {
    console.error("Error adding voter field:", error);
    return res.status(500).json({ message: "Failed to add voter field", error: error.message });
  }
});

// Rename a field across all voter documents (MUST be before PUT /api/voters/fields/:fieldName)
app.post("/api/voters/fields/:oldFieldName/rename", async (req, res) => {
  try {
    await connectToDatabase();
    
    const { oldFieldName } = req.params;
    const { newFieldName } = req.body;
    
    if (!newFieldName || !newFieldName.trim()) {
      return res.status(400).json({ message: "New field name is required" });
    }
    
    // Validate new field name
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newFieldName.trim())) {
      return res.status(400).json({ 
        message: "New field name must start with a letter or underscore and contain only letters, numbers, and underscores" 
      });
    }
    
    // Only prevent renaming of critical fields (not all reserved fields)
    const CRITICAL_FIELDS = ['_id', 'name', 'voterID', 'voterId', 'createdAt', 'updatedAt'];
    const isCritical = CRITICAL_FIELDS.some(cf => cf.toLowerCase() === oldFieldName.toLowerCase());
    
    if (isCritical) {
      return res.status(400).json({ 
        message: `Field "${oldFieldName}" is a critical system field and cannot be renamed` 
      });
    }
    
    // Explicitly allow any field name - NO reserved field restrictions
    // All field names are allowed except critical system fields above
    // This ensures full flexibility for field naming
    
    const trimmedNewName = newFieldName.trim();
    
    // Check if new field name already exists in schema
    const existingFieldInSchema = await VoterField.findOne({ name: trimmedNewName });
    
    // Check if new field name already exists in voter documents
    const votersWithNewField = await Voter.countDocuments({ [trimmedNewName]: { $exists: true } });
    const votersWithOldField = await Voter.countDocuments({ [oldFieldName]: { $exists: true } });
    
    // If target field exists and it's different from source, we'll merge the data
    const needsMerge = votersWithNewField > 0 && trimmedNewName !== oldFieldName;
    
    // Count total voters
    const totalVoters = await Voter.countDocuments({});
    const votersWithoutField = totalVoters - votersWithOldField;
    
    if (votersWithOldField === 0) {
      return res.status(404).json({ 
        message: `Field "${oldFieldName}" not found in any voter documents. Total voters: ${totalVoters}` 
      });
    }
    
    // Handle field metadata - ALWAYS allow rename/merge, never fail on duplicate
    try {
      const oldFieldMeta = await VoterField.findOne({ name: oldFieldName });
      const newFieldMeta = await VoterField.findOne({ name: trimmedNewName });
      
      if (oldFieldMeta) {
        if (newFieldMeta && trimmedNewName !== oldFieldName) {
          // Target field exists - delete old one (merging)
          await VoterField.deleteOne({ name: oldFieldName });
          console.log(`Merging: Deleted old field metadata "${oldFieldName}" since "${trimmedNewName}" already exists`);
        } else if (!newFieldMeta) {
          // Target doesn't exist - rename the old one
          try {
            oldFieldMeta.name = trimmedNewName;
            await oldFieldMeta.save();
          } catch (saveError) {
            // ANY error during save - just delete old metadata and continue
            await VoterField.deleteOne({ name: oldFieldName });
            console.log(`Merging: Deleted old field metadata "${oldFieldName}" after save error (likely duplicate):`, saveError.message);
          }
        }
      }
    } catch (metaError) {
      // NEVER fail the entire rename operation due to metadata issues
      console.warn(`Metadata update failed, continuing with field rename:`, metaError.message);
    }
    
    // Rename the field in voter documents that have it
    // We need to iterate and update each document because MongoDB doesn't support field renaming directly
    const votersWithField = await Voter.find({ [oldFieldName]: { $exists: true } }).lean();
    let renamedCount = 0;
    let mergedCount = 0;
    
    // Process in batches for better performance
    const batchSize = 100;
    for (let i = 0; i < votersWithField.length; i += batchSize) {
      const batch = votersWithField.slice(i, i + batchSize);
      const bulkOps = batch.map(voter => {
        const { actualValue: oldActual } = unwrapLegacyFieldValue(voter[oldFieldName]);
        const { actualValue: newActual } = unwrapLegacyFieldValue(voter[trimmedNewName]);
        
        let finalValue = oldActual ?? null;
        
        if (needsMerge) {
          const targetHasValue = hasMeaningfulValue(newActual);
          const sourceHasValue = hasMeaningfulValue(oldActual);
          
          if (!targetHasValue && sourceHasValue) {
            mergedCount++;
          }
          
          if (targetHasValue) {
            finalValue = newActual;
          }
        }
        
        return {
          updateOne: {
            filter: { _id: voter._id },
            update: {
              $set: { [trimmedNewName]: finalValue },
              $unset: { [oldFieldName]: "" }
            }
          }
        };
      });
      
      const batchResult = await Voter.bulkWrite(bulkOps);
      renamedCount += batchResult.modifiedCount;
    }
    
    let message;
    if (needsMerge) {
      message = `Field "${oldFieldName}" has been merged into "${trimmedNewName}" in ${renamedCount} voter documents. ${mergedCount > 0 ? `${mergedCount} documents had existing values that were preserved.` : ''}`;
    } else {
      message = votersWithoutField > 0
        ? `Field "${oldFieldName}" has been successfully renamed to "${trimmedNewName}" in ${renamedCount} of ${totalVoters} voter documents (${votersWithoutField} voters did not have this field)`
        : `Field "${oldFieldName}" has been successfully renamed to "${trimmedNewName}" in all ${renamedCount} voter documents`;
    }
    
    return res.json({
      message,
      oldFieldName,
      newFieldName: trimmedNewName,
      votersAffected: renamedCount,
      totalVoters,
      votersWithField: votersWithOldField,
      votersWithoutField,
      merged: needsMerge,
      mergedCount: needsMerge ? mergedCount : 0,
    });
  } catch (error) {
    console.error("Error renaming voter field:", error);
    // Never return 400 for duplicate/merge scenarios - always allow the operation
    const newName = newFieldName?.trim() || req.body?.newFieldName?.trim() || 'unknown';
    if (error.message?.includes('already exists') || error.message?.includes('duplicate') || error.code === 11000) {
      console.warn("Duplicate field error caught, but allowing rename/merge to proceed");
      // Return success - the field rename should have worked despite metadata issues
      return res.json({
        message: `Field rename/merge completed. Some metadata conflicts were resolved automatically.`,
        oldFieldName,
        newFieldName: newName,
        merged: true,
      });
    }
    return res.status(500).json({ message: "Failed to rename voter field", error: error.message });
  }
});

// Toggle field visibility (MUST be before PUT /api/voters/fields/:fieldName)
app.put("/api/voters/fields/:fieldName/visibility", async (req, res) => {
  try {
    await connectToDatabase();
    
    const { fieldName } = req.params;
    const { visible } = req.body;
    
    if (typeof visible !== 'boolean') {
      return res.status(400).json({ message: "Visible parameter must be a boolean value" });
    }
    
    // Allow visibility toggling for reserved fields, but handle them carefully
    // Only prevent for truly critical fields that shouldn't be modified
    const CRITICAL_FIELDS = ['_id', 'createdAt', 'updatedAt'];
    if (CRITICAL_FIELDS.includes(fieldName)) {
      return res.status(400).json({ 
        message: `Field "${fieldName}" is a critical system field and cannot have visibility toggled` 
      });
    }
    
    // Check if field exists in schema
    let field = await VoterField.findOne({ name: fieldName });
    
    if (field) {
      field.visible = visible;
      await field.save();
    } else {
      // Infer type and create metadata if field exists on any voter
      const sampleVoter = await Voter.findOne({ [fieldName]: { $exists: true } }).lean();
      if (!sampleVoter) {
        return res.status(404).json({
          message: `Field "${fieldName}" not found in schema or voter documents`
        });
      }

      const { actualValue } = unwrapLegacyFieldValue(sampleVoter[fieldName]);
      field = new VoterField({
        name: fieldName,
        type: inferFieldTypeFromValue(actualValue),
        required: false,
        visible,
      });
      await field.save();
    }
    
    return res.json({
      message: `Field "${fieldName}" visibility updated to ${visible ? 'visible' : 'hidden'}`,
      field: {
        name: field.name,
        type: field.type,
        visible: field.visible,
      },
    });
  } catch (error) {
    console.error("Error toggling field visibility:", error);
    console.error("Error stack:", error.stack);
    return res.status(500).json({ 
      message: "Failed to toggle field visibility", 
      error: error.message || String(error),
    });
  }
});

// Update a voter field (MUST be after PUT /api/voters/fields/:fieldName/visibility)
app.put("/api/voters/fields/:fieldName", async (req, res) => {
  try {
    await connectToDatabase();
    
    const { fieldName } = req.params;
    const { type, required, default: defaultValue, label, description } = req.body;
    
    const field = await VoterField.findOne({ name: fieldName });
    if (!field) {
      return res.status(404).json({ message: `Field "${fieldName}" not found` });
    }
    
    // Update field metadata
    if (type !== undefined) field.type = type;
    if (required !== undefined) field.required = required;
    if (defaultValue !== undefined) field.default = defaultValue;
    if (label !== undefined) field.label = label;
    if (description !== undefined) field.description = description;
    if (req.body.visible !== undefined) field.visible = req.body.visible;
    
    await field.save();
    
    // If default value changed and field doesn't exist on some documents, add it directly
    if (defaultValue !== undefined && defaultValue !== null && defaultValue !== '') {
      const updateQuery = { $set: { [fieldName]: defaultValue } };
      await Voter.updateMany({ [fieldName]: { $exists: false } }, updateQuery);
    }
    
    return res.json({
      message: `Field "${fieldName}" has been successfully updated`,
      field: {
        name: field.name,
        type: field.type,
        required: field.required,
        default: field.default,
        label: field.label,
        description: field.description,
        visible: field.visible !== undefined ? field.visible : true,
      },
    });
  } catch (error) {
    console.error("Error updating voter field:", error);
    return res.status(500).json({ message: "Failed to update voter field", error: error.message });
  }
});

// Delete a voter field (works for fields in schema or just in voter documents)
app.delete("/api/voters/fields/:fieldName", async (req, res) => {
  try {
    await connectToDatabase();
    
    const { fieldName } = req.params;
    
    // No reserved field restrictions - all fields can be deleted
    
    // Check if field exists in schema
    const field = await VoterField.findOne({ name: fieldName });
    
    // Delete field metadata if it exists
    if (field) {
      await VoterField.deleteOne({ name: fieldName });
    }
    
    // Remove the field from ALL existing voter documents (even if not in schema)
    const unsetQuery = { $unset: { [fieldName]: "" } };
    const deleteResult = await Voter.updateMany({}, unsetQuery);
    
    return res.json({
      message: `Field "${fieldName}" has been successfully deleted from all voters`,
      fieldName,
      votersAffected: deleteResult.modifiedCount,
      wasInSchema: !!field,
    });
  } catch (error) {
    console.error("Error deleting voter field:", error);
    return res.status(500).json({ message: "Failed to delete voter field", error: error.message });
  }
});

// Survey Master Data Mapper Routes
// Get all mappings
app.get("/api/survey-master-data-mappings", async (req, res) => {
  try {
    await connectToDatabase();
    const { surveyId, masterDataSectionId } = req.query;
    
    console.log("GET /api/survey-master-data-mappings - query params:", { surveyId, masterDataSectionId });
    
    const query = {};
    if (surveyId) query.surveyId = surveyId;
    if (masterDataSectionId) query.masterDataSectionId = masterDataSectionId;
    
    console.log("Query object:", query);
    
    const mappings = await SurveyMasterDataMapping.find(query)
      .sort({ createdAt: -1 })
      .populate("createdBy", "username email role");
    
    console.log("Found mappings:", mappings.length);
    
    return res.json({
      mappings: mappings.map(m => m.toJSON()),
    });
  } catch (error) {
    console.error("Error fetching survey master data mappings:", error);
    console.error("Error stack:", error.stack);
    return res.status(500).json({
      message: "Failed to fetch mappings",
      error: error.message,
    });
  }
});

// Get a specific mapping
app.get("/api/survey-master-data-mappings/:mappingId", async (req, res) => {
  try {
    await connectToDatabase();
    const { mappingId } = req.params;
    
    const mapping = await SurveyMasterDataMapping.findById(mappingId)
      .populate("createdBy", "username email role");
    
    if (!mapping) {
      return res.status(404).json({ message: "Mapping not found" });
    }
    
    return res.json(mapping.toJSON());
  } catch (error) {
    console.error("Error fetching survey master data mapping:", error);
    return res.status(500).json({
      message: "Failed to fetch mapping",
      error: error.message,
    });
  }
});

// Create or update a mapping
app.post("/api/survey-master-data-mappings", async (req, res) => {
  try {
    await connectToDatabase();
    
    const {
      surveyId,
      surveyTitle,
      masterDataSectionId,
      masterDataSectionName,
      mappings,
      createdBy,
      createdByRole,
      status,
      notes,
    } = req.body ?? {};
    
    if (!surveyId || !masterDataSectionId || !Array.isArray(mappings)) {
      return res.status(400).json({
        message: "surveyId, masterDataSectionId, and mappings array are required",
      });
    }
    
    // Check if mapping already exists
    const existingMapping = await SurveyMasterDataMapping.findOne({
      surveyId,
      masterDataSectionId,
    });
    
    if (existingMapping) {
      // Update existing mapping
      existingMapping.surveyTitle = surveyTitle || existingMapping.surveyTitle;
      existingMapping.masterDataSectionName =
        masterDataSectionName || existingMapping.masterDataSectionName;
      existingMapping.mappings = mappings;
      if (status) existingMapping.status = status;
      if (notes !== undefined) existingMapping.notes = notes;
      if (createdBy) existingMapping.createdBy = createdBy;
      if (createdByRole) existingMapping.createdByRole = createdByRole;
      
      await existingMapping.save();
      
      return res.json({
        message: "Mapping updated successfully",
        mapping: existingMapping.toJSON(),
      });
    }
    
    // Create new mapping
    const mappingData = {
      surveyId,
      surveyTitle: surveyTitle || "",
      masterDataSectionId,
      masterDataSectionName: masterDataSectionName || "",
      mappings,
      status: status || "draft",
      notes: notes || "",
    };
    
    if (createdBy) mappingData.createdBy = createdBy;
    if (createdByRole) mappingData.createdByRole = createdByRole;
    
    const mapping = await SurveyMasterDataMapping.create(mappingData);
    
    return res.status(201).json({
      message: "Mapping created successfully",
      mapping: mapping.toJSON(),
    });
  } catch (error) {
    console.error("Error creating/updating survey master data mapping:", error);
    return res.status(500).json({
      message: "Failed to create/update mapping",
      error: error.message,
    });
  }
});

// Update mapping status
app.put("/api/survey-master-data-mappings/:mappingId/status", async (req, res) => {
  try {
    await connectToDatabase();
    const { mappingId } = req.params;
    const { status } = req.body ?? {};
    
    if (!status || !["draft", "active", "archived"].includes(status)) {
      return res.status(400).json({
        message: "Valid status (draft, active, archived) is required",
      });
    }
    
    const mapping = await SurveyMasterDataMapping.findByIdAndUpdate(
      mappingId,
      { status },
      { new: true }
    );
    
    if (!mapping) {
      return res.status(404).json({ message: "Mapping not found" });
    }
    
    return res.json({
      message: "Mapping status updated successfully",
      mapping: mapping.toJSON(),
    });
  } catch (error) {
    console.error("Error updating mapping status:", error);
    return res.status(500).json({
      message: "Failed to update mapping status",
      error: error.message,
    });
  }
});

// Delete a mapping
app.delete("/api/survey-master-data-mappings/:mappingId", async (req, res) => {
  try {
    await connectToDatabase();
    const { mappingId } = req.params;
    
    const mapping = await SurveyMasterDataMapping.findByIdAndDelete(mappingId);
    
    if (!mapping) {
      return res.status(404).json({ message: "Mapping not found" });
    }
    
    return res.json({
      message: "Mapping deleted successfully",
      mappingId,
    });
  } catch (error) {
    console.error("Error deleting survey master data mapping:", error);
    return res.status(500).json({
      message: "Failed to delete mapping",
      error: error.message,
    });
  }
});

// Apply mapping and save to mappedfields collection
app.post("/api/mapped-fields/apply-mapping", async (req, res) => {
  try {
    await connectToDatabase();
    
    const {
      mappingId,
      surveyResponseId,
      voterId,
      acNumber,
      applyToAll = false,
      createdBy,
      createdByRole,
    } = req.body ?? {};
    
    if (!mappingId || !surveyResponseId) {
      return res.status(400).json({
        message: "mappingId and surveyResponseId are required",
      });
    }
    
    // Get the mapping
    const mapping = await SurveyMasterDataMapping.findById(mappingId);
    if (!mapping) {
      return res.status(404).json({ message: "Mapping not found" });
    }
    
    if (mapping.status !== "active") {
      return res.status(400).json({
        message: "Mapping must be active to apply",
      });
    }
    
    // Get survey response
    const SurveyResponse = mongoose.models.SurveyResponse ||
      mongoose.model('SurveyResponse', new mongoose.Schema({}, { strict: false, collection: 'surveyresponses' }));
    
    let surveyResponses = [];
    if (applyToAll) {
      // Apply to all survey responses for this survey
      const responses = await SurveyResponse.find({ surveyId: mapping.surveyId }).limit(1000);
      surveyResponses = responses;
    } else {
      const response = await SurveyResponse.findById(surveyResponseId);
      if (!response) {
        return res.status(404).json({ message: "Survey response not found" });
      }
      surveyResponses = [response];
    }
    
    // Get master data section
    const masterSection = await MasterDataSection.findById(mapping.masterDataSectionId);
    if (!masterSection) {
      return res.status(404).json({ message: "Master data section not found" });
    }
    
    const mappedFieldsArray = [];
    
    // Process each survey response
    for (const surveyResponse of surveyResponses) {
      const responseVoterId = voterId || surveyResponse.voterId || surveyResponse.respondentName || '';
      
      // Get voter information
      let voter = null;
      if (responseVoterId) {
        // Try to find voter by voterId, voterID, or name
        if (mongoose.Types.ObjectId.isValid(responseVoterId)) {
          voter = await Voter.findById(responseVoterId).lean();
        }
        
        if (!voter) {
          voter = await Voter.findOne({
            $or: [
              { voterID: responseVoterId },
              { "name.english": { $regex: new RegExp(responseVoterId, 'i') } },
              { "name.tamil": { $regex: new RegExp(responseVoterId, 'i') } },
            ],
          }).lean();
        }
      }
      
      // Get AC information from voter or use provided acNumber
      let acInfo = {
        acNumber: acNumber || null,
        acName: null,
        aci_id: null,
        aci_name: null,
      };
      
      if (voter) {
        acInfo.acNumber = voter.aci_num || voter.aci_id || acNumber;
        acInfo.acName = voter.aci_name || voter.ac_name;
        acInfo.aci_id = voter.aci_id || voter.aci_num;
        acInfo.aci_name = voter.aci_name || voter.ac_name;
      } else if (acNumber) {
        // Try to get AC name from any voter in that AC
        const sampleVoter = await Voter.findOne({
          $or: [
            { aci_num: acNumber },
            { aci_id: acNumber },
          ],
        }).select('aci_name ac_name').lean();
        
        if (sampleVoter) {
          acInfo.acName = sampleVoter.aci_name || sampleVoter.ac_name;
          acInfo.aci_id = acNumber;
          acInfo.aci_name = sampleVoter.aci_name || sampleVoter.ac_name;
        }
      }
      
      // Apply mappings to create mapped fields - each question mapping creates a separate entry
      const responseAnswers = surveyResponse.answers || surveyResponse.responses || {};
      
      for (const mappingItem of mapping.mappings) {
        const surveyQuestionId = mappingItem.surveyQuestionId;
        const surveyResponseValue = responseAnswers[surveyQuestionId];
        
        if (surveyResponseValue === undefined || surveyResponseValue === null) {
          continue;
        }
        
        // Find the master question
        const masterQuestion = masterSection.questions.find(
          (q) => q.id.toString() === mappingItem.masterDataQuestionId
        );
        
        if (!masterQuestion) {
          continue;
        }
        
        // Determine mapped value based on mapping type
        let mappedValue = surveyResponseValue;
        let originalValue = surveyResponseValue;
        
        if (mappingItem.mappingType === "value-mapping" && mappingItem.responseValueMappings) {
          // Find value mapping (case-insensitive)
          const valueStr = String(surveyResponseValue).trim();
          const valueMapping = mappingItem.responseValueMappings.find(
            (vm) => String(vm.surveyResponseValue).trim().toLowerCase() === valueStr.toLowerCase()
          );
          
          if (valueMapping && valueMapping.masterDataAnswerValue) {
            mappedValue = valueMapping.masterDataAnswerValue;
            originalValue = surveyResponseValue;
          }
        }
        
        // Create a single mapped field entry for this question mapping
        const singleMappedField = {
          surveyQuestionId: mappingItem.surveyQuestionId,
          surveyQuestionText: mappingItem.surveyQuestionText,
          surveyResponseValue: originalValue,
          masterDataQuestionId: mappingItem.masterDataQuestionId,
          masterDataQuestionPrompt: mappingItem.masterDataQuestionPrompt,
          mappedValue: mappedValue,
          mappingType: mappingItem.mappingType,
          originalValue: originalValue,
        };
        
        // Check if mapped field already exists for this specific question mapping
        const existingMappedField = await MappedField.findOne({
          voterId: voter?._id?.toString() || responseVoterId,
          surveyId: mapping.surveyId,
          surveyResponseId: surveyResponse._id.toString(),
          masterDataSectionId: mapping.masterDataSectionId,
          "mappedFields.surveyQuestionId": mappingItem.surveyQuestionId,
          "mappedFields.masterDataQuestionId": mappingItem.masterDataQuestionId,
        });
        
        if (existingMappedField) {
          // Update existing - find the matching mapped field and update it
          const mappedFieldIndex = existingMappedField.mappedFields.findIndex(
            (mf) => mf.surveyQuestionId === mappingItem.surveyQuestionId &&
                     mf.masterDataQuestionId === mappingItem.masterDataQuestionId
          );
          
          if (mappedFieldIndex >= 0) {
            existingMappedField.mappedFields[mappedFieldIndex] = singleMappedField;
          } else {
            existingMappedField.mappedFields.push(singleMappedField);
          }
          
          existingMappedField.mappedAt = new Date();
          if (createdBy) existingMappedField.mappedBy = createdBy;
          if (createdByRole) existingMappedField.mappedByRole = createdByRole;
          
          // Update voter/AC info if available
          if (voter) {
            existingMappedField.voterId = voter._id.toString();
            existingMappedField.voterName = voter.name?.english || voter.name?.tamil || voter.name || '';
            existingMappedField.voterNameTamil = voter.name?.tamil || '';
            existingMappedField.voterID = voter.voterID || '';
            existingMappedField.familyId = voter.family_id || '';
            existingMappedField.mobile = voter.mobile || '';
            existingMappedField.age = voter.age;
            existingMappedField.gender = voter.gender || '';
            existingMappedField.address = voter.address || '';
            existingMappedField.guardian = voter.guardian || '';
          }
          
          if (acInfo.acNumber) {
            existingMappedField.acNumber = acInfo.acNumber;
            existingMappedField.acName = acInfo.acName || '';
            existingMappedField.aci_id = acInfo.aci_id;
            existingMappedField.aci_name = acInfo.aci_name || '';
          }
          
          if (voter) {
            existingMappedField.boothId = voter.booth_id || '';
            existingMappedField.boothName = voter.boothname || '';
            existingMappedField.boothNumber = voter.boothno || '';
          }
          
          await existingMappedField.save();
          
          // Only add if not already in array
          if (!mappedFieldsArray.find(mf => mf.id === existingMappedField._id.toString())) {
            mappedFieldsArray.push(existingMappedField.toJSON());
          }
        } else {
          // Create new document for this question mapping
          const mappedFieldData = {
            voterId: voter?._id?.toString() || responseVoterId,
            voterName: voter?.name?.english || voter?.name?.tamil || voter?.name || surveyResponse.voterName || surveyResponse.respondentName || '',
            voterNameTamil: voter?.name?.tamil || '',
            voterID: voter?.voterID || '',
            familyId: voter?.family_id || '',
            acNumber: acInfo.acNumber || acNumber || null,
            acName: acInfo.acName || '',
            aci_id: acInfo.aci_id,
            aci_name: acInfo.aci_name || '',
            boothId: voter?.booth_id || '',
            boothName: voter?.boothname || '',
            boothNumber: voter?.boothno || '',
            surveyId: mapping.surveyId,
            surveyTitle: mapping.surveyTitle,
            surveyResponseId: surveyResponse._id.toString(),
            masterDataSectionId: mapping.masterDataSectionId,
            masterDataSectionName: mapping.masterDataSectionName,
            mappingId: mapping._id.toString(),
            mappedFields: [singleMappedField], // Single mapping entry
            mobile: voter?.mobile || '',
            age: voter?.age,
            gender: voter?.gender || '',
            address: voter?.address || '',
            guardian: voter?.guardian || '',
            mappedBy: createdBy,
            mappedByRole: createdByRole,
          };
          
          const mappedField = await MappedField.create(mappedFieldData);
          mappedFieldsArray.push(mappedField.toJSON());
        }
      }
    }
    
    return res.status(201).json({
      message: `Mapped fields created/updated successfully for ${mappedFieldsArray.length} record(s)`,
      mappedFields: mappedFieldsArray,
    });
  } catch (error) {
    console.error("Error applying mapping to mappedfields:", error);
    return res.status(500).json({
      message: "Failed to apply mapping",
      error: error.message,
    });
  }
});

// Get mapped fields
app.get("/api/mapped-fields", async (req, res) => {
  try {
    await connectToDatabase();
    
    const {
      acNumber,
      surveyId,
      masterDataSectionId,
      voterId,
      voterID,
      page = 1,
      limit = 50,
      search,
    } = req.query;
    
    const query = {};
    
    if (acNumber) {
      query.acNumber = parseInt(acNumber);
    }
    
    if (surveyId) {
      query.surveyId = surveyId;
    }
    
    if (masterDataSectionId) {
      query.masterDataSectionId = masterDataSectionId;
    }
    
    if (voterId) {
      query.voterId = voterId;
    }
    
    if (voterID) {
      query.voterID = voterID;
    }
    
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { voterName: searchRegex },
        { voterNameTamil: searchRegex },
        { voterID: searchRegex },
        { acName: searchRegex },
        { surveyTitle: searchRegex },
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const mappedFields = await MappedField.find(query)
      .sort({ mappedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("mappedBy", "username email role")
      .lean();
    
    const total = await MappedField.countDocuments(query);
    
    return res.json({
      mappedFields: mappedFields.map((mf) => ({
        ...mf,
        id: mf._id.toString(),
        _id: undefined,
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching mapped fields:", error);
    return res.status(500).json({
      message: "Failed to fetch mapped fields",
      error: error.message,
    });
  }
});

// Get a specific mapped field
app.get("/api/mapped-fields/:mappedFieldId", async (req, res) => {
  try {
    await connectToDatabase();
    const { mappedFieldId } = req.params;
    
    const mappedField = await MappedField.findById(mappedFieldId)
      .populate("mappedBy", "username email role")
      .lean();
    
    if (!mappedField) {
      return res.status(404).json({ message: "Mapped field not found" });
    }
    
    return res.json({
      ...mappedField,
      id: mappedField._id.toString(),
      _id: undefined,
    });
  } catch (error) {
    console.error("Error fetching mapped field:", error);
    return res.status(500).json({
      message: "Failed to fetch mapped field",
      error: error.message,
    });
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

// Mount RBAC routes
app.use("/api/rbac", rbacRoutes);

app.listen(PORT, () => {
  console.log(`Auth server listening on port ${PORT}`);
});

