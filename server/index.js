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

// Import RBAC routes
import rbacRoutes from "./routes/rbac.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, ".env");

dotenv.config({
  path: fs.existsSync(envPath) ? envPath : undefined,
});

const app = express();

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN || "http://localhost:5173,http://localhost:8080,http://localhost:3000")
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
      secure: false, // Set to false for development (localhost doesn't use HTTPS)
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax', // Use 'lax' for localhost development, 'none' for production with HTTPS
      path: '/',
    },
  })
);

// Middleware to restore user from session
app.use((req, res, next) => {
  if (req.session && req.session.user) {
    req.user = req.session.user;
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

    console.log('Login successful - Session ID:', req.sessionID);
    console.log('Login successful - User stored in session:', !!req.session.user);
    console.log('Login successful - Cookie will be sent:', res.getHeader('Set-Cookie'));

    return res.json({
      user: userSession,
    });
  } catch (error) {
    console.error("Login error", error);
    return res.status(500).json({ message: "Internal server error" });
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
  // Debug logging
  console.log('Auth check - Session exists:', !!req.session);
  console.log('Auth check - User in session:', !!req.session?.user);
  console.log('Auth check - Session ID:', req.sessionID);
  console.log('Auth check - Cookies received:', req.headers.cookie);
  
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
      // On error, still return the session user if it exists
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

    const surveyData = {
      title: sanitizeTitle(title),
      description: sanitizeDescription(description),
      status: sanitizeStatus(status),
      questions: normalizeQuestions(questions),
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

    const survey = await Survey.create(surveyData);

    return res.status(201).json(survey.toJSON());
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
    
    // Convert any custom fields to object format { value, visible } if they're not already
    // Get field metadata to check which fields should be in object format
    const fieldMetadata = await VoterField.find({}).lean();
    const fieldsMap = {};
    fieldMetadata.forEach(f => { fieldsMap[f.name] = f; });
    
    // Process updateData to convert fields to object format
    const processedUpdateData = {};
    Object.keys(updateData).forEach(key => {
      // Skip reserved/system fields and internal fields
      if (['_id', 'name', 'voterID', 'voterId', 'address', 'DOB', 'fathername', 'doornumber', 
           'fatherless', 'guardian', 'age', 'gender', 'mobile', 'emailid', 'aadhar', 'PAN', 
           'religion', 'caste', 'subcaste', 'booth_id', 'boothname', 'boothno', 'status', 
           'verified', 'verifiedAt', 'surveyed', 'aci_id', 'aci_name', 'createdAt', 'updatedAt'].includes(key)) {
        processedUpdateData[key] = updateData[key];
        return;
      }
      
      const currentFieldValue = currentVoter[key];
      const newFieldValue = updateData[key];
      
      // Check if field should be in object format (exists in metadata or already in object format)
      const fieldMeta = fieldsMap[key];
      const isAlreadyObject = typeof currentFieldValue === 'object' && 
                              currentFieldValue !== null && 
                              !Array.isArray(currentFieldValue) && 
                              !(currentFieldValue instanceof Date) &&
                              'value' in currentFieldValue;
      
      if (fieldMeta || isAlreadyObject) {
        // Field should be in object format { value, visible }
        const visible = isAlreadyObject ? currentFieldValue.visible : 
                       (fieldMeta && fieldMeta.visible !== undefined ? fieldMeta.visible : true);
        
        processedUpdateData[key] = {
          value: newFieldValue,
          visible: visible
        };
      } else {
        // Keep as is for backward compatibility
        processedUpdateData[key] = newFieldValue;
      }
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
      query.$or = [
        { voterName: searchRegex },
        { respondentName: searchRegex },
        { voterId: searchRegex },
        { surveyId: searchRegex },
        { formId: searchRegex }
      ];
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

// Voter Field Management APIs

// Reserved field names that cannot be deleted
const RESERVED_FIELDS = [
  '_id',
  'name',
  'voterID',
  'address',
  'DOB',
  'fathername',
  'doornumber',
  'fatherless',
  'guardian',
  'age',
  'gender',
  'mobile',
  'emailid',
  'aadhar',
  'PAN',
  'religion',
  'caste',
  'subcaste',
  'booth_id',
  'boothname',
  'boothno',
  'status',
  'verified',
  'verifiedAt',
  'surveyed',
  'aci_id',
  'aci_name',
  'createdAt',
  'updatedAt',
];

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
        
        let value = voter[key];
        let actualValue = value;
        let isObjectFormat = false;
        
        // Check if field is stored in object format { value, visible }
        if (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)) {
          if ('value' in value) {
            // Field is in object format { value, visible }
            actualValue = value.value;
            isObjectFormat = true;
            // Store visibility if available
            if (!fieldAnalysis[key].visible && value.visible !== undefined) {
              fieldAnalysis[key].visible = value.visible;
            }
          }
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
        isReserved: RESERVED_FIELDS.includes(field.name),
      })),
    });
  } catch (error) {
    console.error("Error fetching voter fields:", error);
    return res.status(500).json({ message: "Failed to fetch voter fields", error: error.message });
  }
});

// Convert all existing fields to object format { value, visible }
app.post("/api/voters/fields/convert-all", async (req, res) => {
  try {
    await connectToDatabase();
    
    // Get all voter documents
    const voters = await Voter.find({}).lean();
    
    if (voters.length === 0) {
      return res.json({
        message: "No voters found to convert",
        fieldsConverted: 0,
        votersProcessed: 0,
      });
    }
    
    // Sample one voter to get all field names (excluding MongoDB system fields)
    const sampleVoter = voters[0];
    const systemFields = ['_id', '__v', 'createdAt', 'updatedAt'];
    let fieldNames = Object.keys(sampleVoter).filter(key => !systemFields.includes(key));
    
    // Also check for fields that might exist in other voters but not in the first one
    // by checking a larger sample to ensure we get ALL fields
    const additionalFieldNames = new Set();
    for (let i = 1; i < Math.min(500, voters.length); i++) {
      const voter = voters[i];
      for (const key of Object.keys(voter)) {
        if (!systemFields.includes(key) && !fieldNames.includes(key)) {
          additionalFieldNames.add(key);
        }
      }
    }
    fieldNames.push(...Array.from(additionalFieldNames));
    
    // Also check all voters to ensure we don't miss any field
    // This ensures we convert ALL fields, even if they only exist in a few documents
    const allFieldNames = new Set(fieldNames);
    for (const voter of voters) {
      for (const key of Object.keys(voter)) {
        if (!systemFields.includes(key)) {
          allFieldNames.add(key);
        }
      }
    }
    fieldNames = Array.from(allFieldNames);
    
    console.log(`Converting ${fieldNames.length} fields across ${voters.length} voters...`);
    console.log(`Fields to convert:`, fieldNames.slice(0, 10).join(', '), fieldNames.length > 10 ? '...' : '');
    
    let totalFieldsConverted = 0;
    let votersProcessed = 0;
    const batchSize = 100;
    
    // Process voters in batches
    for (let i = 0; i < voters.length; i += batchSize) {
      const batch = voters.slice(i, i + batchSize);
      const bulkOps = [];
      
      for (const voter of batch) {
        let hasChanges = false;
        const updateObj = {};
        
        // Check each field and convert if needed
        for (const fieldName of fieldNames) {
          const currentValue = voter[fieldName];
          
          // Skip if field doesn't exist
          if (currentValue === undefined) continue;
          
          // Check if already in object format
          let needsConversion = false;
          let newValue;
          
          // First check if it's already in our exact format { value, visible }
          const isAlreadyInFormat = typeof currentValue === 'object' && 
                                    currentValue !== null && 
                                    !Array.isArray(currentValue) &&
                                    'value' in currentValue && 
                                    'visible' in currentValue;
          
          if (isAlreadyInFormat) {
            // It's already in format - check if we can skip it
            const expectedVisible = currentValue.visible !== undefined ? currentValue.visible : true;
            const hasOnlyValueAndVisible = Object.keys(currentValue).length === 2 && 
                                          'value' in currentValue && 
                                          'visible' in currentValue;
            
            if (hasOnlyValueAndVisible && currentValue.visible === expectedVisible) {
              // Already exactly in format with correct visibility - skip
              continue;
            } else {
              // Need to normalize (remove extra properties or fix visibility)
              needsConversion = true;
              // Force a new object structure to ensure MongoDB sees it as different
              newValue = {
                value: currentValue.value,
                visible: expectedVisible
              };
            }
          } else if (currentValue === null) {
            // Null - convert to object format
            needsConversion = true;
            newValue = { value: null, visible: true };
          } else if (typeof currentValue === 'object' && !Array.isArray(currentValue)) {
            // Object - check if it's a Date first
            const isDate = currentValue instanceof Date || 
                          (currentValue && currentValue.constructor && currentValue.constructor.name === 'Date') ||
                          (currentValue && currentValue.$date !== undefined);
            
            if (isDate) {
              // Handle as Date
              needsConversion = true;
              const dateValue = currentValue instanceof Date ? currentValue : new Date(currentValue);
              newValue = {
                value: dateValue,
                visible: true
              };
            } else if ('value' in currentValue) {
              // Has value but missing visible or has extra properties
              needsConversion = true;
              const existingVisible = currentValue.visible !== undefined ? currentValue.visible : true;
              newValue = {
                value: currentValue.value,
                visible: existingVisible
              };
            } else {
              // Object but not in our format - wrap it
              needsConversion = true;
              newValue = {
                value: currentValue,
                visible: true
              };
            }
          } else if (Array.isArray(currentValue)) {
            // Array - wrap in object format
            needsConversion = true;
            newValue = {
              value: currentValue,
              visible: true
            };
          } else if (typeof currentValue === 'string' && (fieldName === 'DOB' || /^\d{4}-\d{2}-\d{2}/.test(currentValue))) {
            // Date string - convert to Date object in object format
            needsConversion = true;
            try {
              const dateValue = new Date(currentValue);
              if (!isNaN(dateValue.getTime())) {
                newValue = {
                  value: dateValue,
                  visible: true
                };
              } else {
                // Invalid date, keep as string
                newValue = {
                  value: currentValue,
                  visible: true
                };
              }
            } catch (e) {
              newValue = {
                value: currentValue,
                visible: true
              };
            }
          } else {
            // Primitive value (string, number, boolean) - convert to object format
            needsConversion = true;
            newValue = {
              value: currentValue,
              visible: true
            };
          }
          
          if (needsConversion) {
            updateObj[fieldName] = newValue;
            hasChanges = true;
            totalFieldsConverted++;
          }
        }
        
        if (hasChanges) {
          bulkOps.push({
            updateOne: {
              filter: { _id: voter._id },
              update: { $set: updateObj }
            }
          });
        }
      }
      
      if (bulkOps.length > 0) {
        try {
          // Debug: log first operation to see what we're trying to update
          if (i === 0 && bulkOps.length > 0) {
            const firstOp = bulkOps[0];
            console.log(`[Convert-All] Sample update for voter ${firstOp.updateOne.filter._id}:`);
            console.log(`[Convert-All] Update fields:`, Object.keys(firstOp.updateOne.update.$set || {}));
            // Get the voter to compare
            const sampleVoter = await Voter.findById(firstOp.updateOne.filter._id).lean();
            if (sampleVoter) {
              const updateFields = Object.keys(firstOp.updateOne.update.$set || {});
              const sampleField = updateFields[0];
              if (sampleField) {
                console.log(`[Convert-All] Field "${sampleField}":`);
                console.log(`[Convert-All]   Current:`, JSON.stringify(sampleVoter[sampleField])?.substring(0, 100));
                console.log(`[Convert-All]   New:`, JSON.stringify(firstOp.updateOne.update.$set[sampleField])?.substring(0, 100));
              }
            }
          }
          
          const batchResult = await Voter.bulkWrite(bulkOps, { ordered: false });
          const modifiedCount = batchResult.modifiedCount || 0;
          const matchedCount = batchResult.matchedCount || 0;
          console.log(`Batch ${i}-${i + batch.length - 1}: Updated ${modifiedCount} of ${bulkOps.length} voters (matched: ${matchedCount})`);
          
          if (modifiedCount === 0 && matchedCount > 0 && i === 0) {
            console.warn(`[Convert-All] Warning: Matched ${matchedCount} documents but modified 0. This might mean values are identical.`);
          }
          
          votersProcessed += modifiedCount;
        } catch (bulkErr) {
          console.error(`Bulk write error in batch starting at ${i}:`, bulkErr);
          console.error(`Error message:`, bulkErr.message);
          console.error(`Error stack:`, bulkErr.stack);
          // Try individual updates as fallback for first few to debug
          for (let j = 0; j < Math.min(5, bulkOps.length); j++) {
            const op = bulkOps[j];
            try {
              const result = await Voter.updateOne(op.updateOne.filter, op.updateOne.update);
              if (result.modifiedCount === 0 && result.matchedCount > 0) {
                console.warn(`[Convert-All] Voter ${op.updateOne.filter._id}: Matched but not modified. Values may be identical.`);
              }
              votersProcessed += result.modifiedCount || 0;
            } catch (individualErr) {
              console.error(`Error updating individual voter:`, individualErr.message);
            }
          }
        }
      }
    }
    
    return res.json({
      message: `Successfully converted ${totalFieldsConverted} field instances across ${votersProcessed} voters to object format { value, visible }`,
      fieldsConverted: totalFieldsConverted,
      votersProcessed: votersProcessed,
      totalVoters: voters.length,
      uniqueFields: fieldNames.length,
    });
  } catch (error) {
    console.error("Error converting fields to object format:", error);
    return res.status(500).json({ 
      message: "Failed to convert fields to object format", 
      error: error.message 
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
    
    // Check if field name conflicts with reserved fields
    if (RESERVED_FIELDS.includes(name)) {
      return res.status(400).json({ 
        message: `Field name "${name}" is reserved and cannot be used. Please choose a different name.` 
      });
    }
    
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
    
    // Add the field to ALL existing voter documents in object format { value, visible }
    // If default value is provided, set it for voters that don't have this field
    // If no default, set it to null so the field exists on all documents
    const fieldVisible = req.body.visible !== undefined ? req.body.visible : true;
    let updateResult;
    if (defaultValue !== undefined && defaultValue !== null && defaultValue !== '') {
      // Set default value for all voters that don't have this field in object format
      updateResult = await Voter.updateMany(
        { [name]: { $exists: false } }, 
        { $set: { [name]: { value: defaultValue, visible: fieldVisible } } }
      );
    } else {
      // Add field with null value to all voters that don't have it in object format
      updateResult = await Voter.updateMany(
        { [name]: { $exists: false } }, 
        { $set: { [name]: { value: null, visible: fieldVisible } } }
      );
    }
    
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
    
    // Check if new field name is reserved
    if (RESERVED_FIELDS.includes(newFieldName.trim())) {
      return res.status(400).json({ 
        message: `Field name "${newFieldName}" is reserved and cannot be used. Please choose a different name.` 
      });
    }
    
    // Check if new field name already exists
    const existingField = await VoterField.findOne({ name: newFieldName.trim() });
    if (existingField && existingField.name !== oldFieldName) {
      return res.status(400).json({ message: `Field "${newFieldName}" already exists` });
    }
    
    // Count total voters and voters with the old field
    const totalVoters = await Voter.countDocuments({});
    const votersWithFieldCount = await Voter.countDocuments({ [oldFieldName]: { $exists: true } });
    const votersWithoutField = totalVoters - votersWithFieldCount;
    
    if (votersWithFieldCount === 0) {
      return res.status(404).json({ 
        message: `Field "${oldFieldName}" not found in any voter documents. Total voters: ${totalVoters}` 
      });
    }
    
    // Update field metadata if it exists in VoterField collection
    const oldFieldMeta = await VoterField.findOne({ name: oldFieldName });
    if (oldFieldMeta) {
      oldFieldMeta.name = newFieldName.trim();
      await oldFieldMeta.save();
    }
    
    // Rename the field in voter documents that have it
    // We need to iterate and update each document because MongoDB doesn't support field renaming directly
    const votersWithField = await Voter.find({ [oldFieldName]: { $exists: true } }).lean();
    let renamedCount = 0;
    
    // Process in batches for better performance
    const batchSize = 100;
    for (let i = 0; i < votersWithField.length; i += batchSize) {
      const batch = votersWithField.slice(i, i + batchSize);
      const bulkOps = batch.map(voter => {
        const oldValue = voter[oldFieldName];
        let newValue;
        
        // Preserve object format if it exists, otherwise convert to object format
        if (oldValue === null || oldValue === undefined) {
          // Null/undefined - convert to object format
          newValue = { value: null, visible: true };
        } else if (typeof oldValue === 'object' && !Array.isArray(oldValue) && !(oldValue instanceof Date)) {
          // Already an object - check if it's in our format
          if ('value' in oldValue) {
            // Already in object format { value, visible } or { value } - preserve it
            newValue = {
              value: oldValue.value,
              visible: oldValue.visible !== undefined ? oldValue.visible : true
            };
          } else {
            // Object but not in our format - convert it
            newValue = {
              value: oldValue,
              visible: true
            };
          }
        } else if (oldValue instanceof Date) {
          // Date object - preserve as Date in object format
          newValue = {
            value: oldValue,
            visible: true
          };
        } else {
          // Primitive value - convert to object format
          newValue = {
            value: oldValue,
            visible: true
          };
        }
        
        return {
          updateOne: {
            filter: { _id: voter._id },
            update: {
              $set: { [newFieldName.trim()]: newValue },
              $unset: { [oldFieldName]: "" }
            }
          }
        };
      });
      
      const batchResult = await Voter.bulkWrite(bulkOps);
      renamedCount += batchResult.modifiedCount;
    }
    
    const message = votersWithoutField > 0
      ? `Field "${oldFieldName}" has been successfully renamed to "${newFieldName.trim()}" in ${renamedCount} of ${totalVoters} voter documents (${votersWithoutField} voters did not have this field)`
      : `Field "${oldFieldName}" has been successfully renamed to "${newFieldName.trim()}" in all ${renamedCount} voter documents`;
    
    return res.json({
      message,
      oldFieldName,
      newFieldName: newFieldName.trim(),
      votersAffected: renamedCount,
      totalVoters,
      votersWithField: votersWithFieldCount,
      votersWithoutField,
    });
  } catch (error) {
    console.error("Error renaming voter field:", error);
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
      // Update existing field visibility
      field.visible = visible;
      await field.save();
    } else {
      // If field doesn't exist in schema but exists in voters, create a metadata entry
      // First check if field exists in any voter documents
      const votersWithField = await Voter.countDocuments({ [fieldName]: { $exists: true } });
      
      if (votersWithField === 0) {
        return res.status(404).json({ 
          message: `Field "${fieldName}" not found in schema or voter documents` 
        });
      }
      
      // Infer type from voter documents
      const sampleVoter = await Voter.findOne({ [fieldName]: { $exists: true } }).lean();
      let inferredType = 'String';
      let sampleValue = null;
      if (sampleVoter && sampleVoter[fieldName] !== null && sampleVoter[fieldName] !== undefined) {
        sampleValue = sampleVoter[fieldName];
        // Check if it's already an object with value/visible structure
        if (typeof sampleValue === 'object' && sampleValue !== null && !Array.isArray(sampleValue) && !(sampleValue instanceof Date)) {
          if ('value' in sampleValue) {
            // Already converted to object format
            inferredType = typeof sampleValue.value === 'number' ? 'Number' :
                          typeof sampleValue.value === 'boolean' ? 'Boolean' :
                          sampleValue.value instanceof Date ? 'Date' :
                          typeof sampleValue.value === 'object' ? 'Object' : 'String';
          } else {
            inferredType = 'Object';
          }
        } else if (typeof sampleValue === 'number') {
          inferredType = 'Number';
        } else if (typeof sampleValue === 'boolean') {
          inferredType = 'Boolean';
        } else if (sampleValue instanceof Date || (typeof sampleValue === 'string' && !isNaN(Date.parse(sampleValue)) && sampleValue.includes('-'))) {
          inferredType = 'Date';
        }
      }
      
      // Create new field metadata entry
      field = new VoterField({
        name: fieldName,
        type: inferredType,
        required: false,
        visible: visible,
      });
      await field.save();
    }
    
    // Ensure field object exists (it should after the above logic)
    if (!field) {
      return res.status(500).json({ 
        message: `Failed to create or retrieve field metadata for "${fieldName}"` 
      });
    }
    
    // Use MongoDB aggregation to update all voters efficiently
    // First, get count of voters with this field for reporting
    const votersCount = await Voter.countDocuments({ [fieldName]: { $exists: true } });
    
    // Return immediately and process updates asynchronously
    res.json({
      message: `Field "${fieldName}" visibility is being updated to ${visible ? 'visible' : 'hidden'}. This may take a moment for all ${votersCount} voters.`,
      field: {
        name: field.name,
        type: field.type,
        visible: field.visible,
      },
      votersCount: votersCount,
      processing: true,
    });
    
    // Process updates asynchronously in the background
    (async () => {
      try {
        let updatedCount = 0;
        
        // Use MongoDB's update operations to handle different field formats efficiently
        // Strategy 1: Update fields already in object format with 'value' property
        // We'll use a simpler approach - update all fields that have the value property
        try {
          const updateResult1 = await Voter.updateMany(
            { 
              [`${fieldName}.value`]: { $exists: true }
            },
            { 
              $set: { 
                [`${fieldName}.visible`]: visible
              }
            }
          );
          updatedCount += updateResult1.modifiedCount || 0;
          console.log(`[Visibility] Updated ${updateResult1.modifiedCount} existing object-format fields`);
        } catch (err) {
          console.error(`[Visibility] Error updating object-format fields:`, err.message);
        }
        
        // Strategy 2: Convert primitive values to object format using bulk operations
        // Get all voters with this field, we'll filter in code to find ones that need conversion
        const votersWithField = await Voter.countDocuments({
          [fieldName]: { $exists: true }
        });
        
        console.log(`[Visibility] Found ${votersWithField} voters with field "${fieldName}"`);
        
        if (votersWithField > 0) {
          // Process in batches for efficiency
          const batchSize = 500;
          let processed = 0;
          
          // Use cursor for better memory efficiency with large datasets
          // Get all voters with the field, we'll check each one to see if it needs conversion
          const cursor = Voter.find({
            [fieldName]: { $exists: true }
          }).select(`${fieldName} _id`).lean().cursor();
          
          let bulkOps = [];
          let batchIndex = 0;
          let needsConversion = 0;
          
          for await (const voter of cursor) {
            const currentValue = voter[fieldName];
            let fieldValue;
            let shouldConvert = false;
            
            // Check if already in object format - skip if it is
            if (typeof currentValue === 'object' && currentValue !== null && !Array.isArray(currentValue) && !(currentValue instanceof Date)) {
              // It's an object - check if it has 'value' property (our format)
              if ('value' in currentValue) {
                // Already in object format, just update visibility if needed
                if (currentValue.visible !== visible) {
                  shouldConvert = true;
                  fieldValue = {
                    value: currentValue.value,
                    visible: visible
                  };
                } else {
                  // Already correct format and visibility, skip
                  processed++;
                  continue;
                }
              } else {
                // Object but not in our format - convert it
                shouldConvert = true;
                fieldValue = { value: currentValue, visible: visible };
              }
            } else {
              // Not an object or is array/Date - needs conversion
              shouldConvert = true;
              
              // Convert based on type
              if (currentValue === null || currentValue === undefined) {
                fieldValue = { value: null, visible: visible };
              } else if (currentValue instanceof Date) {
                fieldValue = { value: currentValue, visible: visible };
              } else if (Array.isArray(currentValue)) {
                fieldValue = { value: currentValue, visible: visible };
              } else {
                // Primitive (string, number, boolean)
                fieldValue = { value: currentValue, visible: visible };
              }
            }
            
            if (shouldConvert) {
              needsConversion++;
              bulkOps.push({
                updateOne: {
                  filter: { _id: voter._id },
                  update: {
                    $set: {
                      [fieldName]: fieldValue
                    }
                  }
                }
              });
            }
            
            processed++;
            
            // Execute batch when it reaches batchSize
            if (bulkOps.length >= batchSize) {
              try {
                const batchResult = await Voter.bulkWrite(bulkOps, { ordered: false });
                updatedCount += batchResult.modifiedCount || 0;
                console.log(`[Visibility] Batch ${batchIndex}: Converted ${batchResult.modifiedCount}/${bulkOps.length} fields (${processed}/${votersWithField} processed, ${needsConversion} need conversion)`);
                batchIndex++;
                bulkOps = []; // Reset for next batch
              } catch (bulkErr) {
                console.error(`[Visibility] Bulk write error in batch ${batchIndex}:`, bulkErr.message);
                console.error(`[Visibility] Error details:`, bulkErr);
                bulkOps = []; // Clear failed batch
              }
            }
          }
          
          // Process remaining operations
          if (bulkOps.length > 0) {
            try {
              const batchResult = await Voter.bulkWrite(bulkOps, { ordered: false });
              updatedCount += batchResult.modifiedCount || 0;
              console.log(`[Visibility] Final batch: Converted ${batchResult.modifiedCount}/${bulkOps.length} fields`);
            } catch (bulkErr) {
              console.error(`[Visibility] Bulk write error in final batch:`, bulkErr.message);
            }
          }
          
          console.log(`[Visibility] Conversion complete: ${updatedCount} fields converted for "${fieldName}" (${needsConversion} needed conversion, ${processed} total processed)`);
        } else {
          console.log(`[Visibility] No voters found with field "${fieldName}"`);
        }
        
        
        console.log(`[Visibility Toggle] Field "${fieldName}" visibility updated to ${visible ? 'visible' : 'hidden'}. Updated ${updatedCount} voter documents.`);
      } catch (asyncError) {
        console.error(`[Visibility Toggle] Error updating voters for field ${fieldName}:`, asyncError);
      }
    })();
  } catch (error) {
    console.error("Error toggling field visibility:", error);
    console.error("Error stack:", error.stack);
    console.error("Field name:", fieldName);
    console.error("Visible value:", visible);
    
    return res.status(500).json({ 
      message: "Failed to toggle field visibility", 
      error: error.message || String(error),
      fieldName: fieldName,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
    
    // If default value changed and field doesn't exist on some documents, add it in object format
    if (defaultValue !== undefined && defaultValue !== null && defaultValue !== '') {
      const fieldVisible = field.visible !== undefined ? field.visible : true;
      const updateQuery = { $set: { [fieldName]: { value: defaultValue, visible: fieldVisible } } };
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
    
    // Check if field is reserved
    if (RESERVED_FIELDS.includes(fieldName)) {
      return res.status(400).json({ 
        message: `Field "${fieldName}" is a reserved system field and cannot be deleted` 
      });
    }
    
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

