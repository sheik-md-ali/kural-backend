/**
 * RBAC Routes - Role-Based Access Control for Election Management
 * Handles user management, booth management, and agent assignment
 */

import express from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "../models/User.js";
import Booth from "../models/Booth.js";
import Voter from "../models/Voter.js";
import Survey from "../models/Survey.js";
import { resolveAssignedACFromUser } from "../utils/ac.js";
import {
  getVoterModel,
  aggregateVoters,
  aggregateAllVoters,
  ALL_AC_IDS
} from "../utils/voterCollection.js";
import {
  isAuthenticated,
  canManageUsers,
  canManageBooths,
  canManageBoothAgents,
  canAssignAgents,
  validateACAccess,
  applyACFilter,
  canAccessAC,
} from "../middleware/auth.js";

const router = express.Router();

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const getSurveyResponseModel = () => {
  if (mongoose.models.SurveyResponse) {
    return mongoose.models.SurveyResponse;
  }
  return mongoose.model(
    "SurveyResponse",
    new mongoose.Schema({}, { strict: false, collection: "surveyresponses" }),
  );
};

const isNamespaceMissingError = (error) =>
  error?.codeName === "NamespaceNotFound" ||
  error?.message?.toLowerCase?.().includes("ns not found");

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const startOfWeek = (date) => {
  const start = startOfDay(date);
  const day = start.getDay(); // Sunday = 0
  start.setDate(start.getDate() - day);
  return start;
};

const createMonthBuckets = (count = 5) => {
  const buckets = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const reference = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
    const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 1);
    buckets.push({
      label: `${MONTH_LABELS[start.getMonth()]} ${String(start.getFullYear()).slice(-2)}`,
      year: start.getFullYear(),
      month: start.getMonth() + 1,
      start,
      end,
    });
  }
  return buckets;
};

const createWeekBuckets = (count = 6) => {
  const buckets = [];
  const currentWeekStart = startOfWeek(new Date());
  for (let i = count - 1; i >= 0; i -= 1) {
    const start = new Date(currentWeekStart);
    start.setDate(start.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    buckets.push({
      label: `Week of ${start.toLocaleDateString("en-IN", { month: "short", day: "2-digit" })}`,
      start,
      end,
    });
  }
  return buckets;
};

const createDayBuckets = (count = 7) => {
  const buckets = [];
  const todayStart = startOfDay(new Date());
  for (let i = count - 1; i >= 0; i -= 1) {
    const start = new Date(todayStart);
    start.setDate(start.getDate() - i);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    buckets.push({
      label: start.toLocaleDateString("en-IN", { weekday: "short" }),
      start,
      end,
    });
  }
  return buckets;
};

const formatHourWindow = (hour) => {
  if (!Number.isFinite(hour) || hour < 0) {
    return null;
  }
  const normalize = (value) => (value % 12 === 0 ? 12 : value % 12);
  const suffix = (value) => (value < 12 ? "AM" : "PM");
  const endHour = (hour + 1) % 24;
  return `${normalize(hour)} ${suffix(hour)} - ${normalize(endHour)} ${suffix(endHour)}`;
};

const aggregateCountsByMonth = async (model, baseMatch, buckets, dateField = "createdAt") => {
  if (!model || buckets.length === 0) {
    return [];
  }

  const matchStage = {
    ...baseMatch,
    [dateField]: {
      $gte: buckets[0].start,
      $lt: buckets[buckets.length - 1].end,
    },
  };

  const results = await model.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          year: { $year: `$${dateField}` },
          month: { $month: `$${dateField}` },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const lookup = new Map(
    results.map((item) => [`${item._id.year}-${item._id.month}`, item.count]),
  );

  return buckets.map((bucket) => lookup.get(`${bucket.year}-${bucket.month}`) || 0);
};

const buildDashboardAnalytics = async ({ assignedAC, totalBooths, boothsActive }) => {
  const monthBuckets = createMonthBuckets(5);
  const weekBuckets = createWeekBuckets(6);
  const dayBuckets = createDayBuckets(7);

  const voterMatch = assignedAC !== null ? { aci_id: assignedAC } : {};
  const surveyMatch = assignedAC !== null ? { assignedACs: assignedAC } : {};
  const agentMatch =
    assignedAC !== null
      ? { assignedAC, role: { $in: ["Booth Agent", "BoothAgent"] } }
      : { role: { $in: ["Booth Agent", "BoothAgent"] } };
  const dayUserMatch =
    assignedAC !== null
      ? { assignedAC, role: { $in: ["L1", "L2", "Booth Agent", "BoothAgent"] } }
      : { role: { $in: ["L1", "L2", "Booth Agent", "BoothAgent"] } };

  const weekRangeStart = weekBuckets[0].start;
  const weekRangeEnd = weekBuckets[weekBuckets.length - 1].end;
  const surveyResponseDateFilter = {
    $or: [
      { createdAt: { $gte: weekRangeStart, $lt: weekRangeEnd } },
      { submittedAt: { $gte: weekRangeStart, $lt: weekRangeEnd } },
      { updatedAt: { $gte: weekRangeStart, $lt: weekRangeEnd } },
    ],
  };
  const acFilter =
    assignedAC !== null
      ? {
          $or: [
            { aci_id: assignedAC },
            { aci_num: assignedAC },
            { acId: assignedAC },
            { assignedAC },
            { "metadata.acId": assignedAC },
          ],
        }
      : null;
  const surveyResponseMatch =
    acFilter !== null
      ? { $and: [surveyResponseDateFilter, acFilter] }
      : surveyResponseDateFilter;

  const [voterMonthlyCounts, surveyMonthlyCounts, agentMonthlyCounts] = await Promise.all([
    aggregateCountsByMonth(Voter, voterMatch, monthBuckets, "createdAt"),
    aggregateCountsByMonth(Survey, surveyMatch, monthBuckets, "createdAt"),
    aggregateCountsByMonth(User, agentMatch, monthBuckets, "createdAt"),
  ]);

  const dayRangeStart = dayBuckets[0].start;
  const recentUsers = await User.find({
    ...dayUserMatch,
    createdAt: { $gte: dayRangeStart },
  })
    .select({ role: 1, createdAt: 1 })
    .lean();

  let surveyResponses = [];
  try {
    surveyResponses = await getSurveyResponseModel()
      .find(surveyResponseMatch)
      .select({ createdAt: 1, submittedAt: 1, updatedAt: 1, status: 1 })
      .lean();
  } catch (error) {
    if (!isNamespaceMissingError(error)) {
      throw error;
    }
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const formsCreatedLast30Days = await Survey.countDocuments({
    ...surveyMatch,
    createdAt: { $gte: thirtyDaysAgo },
  });

  const systemGrowthData = monthBuckets.map((bucket, index) => ({
    month: bucket.label,
    voters: voterMonthlyCounts[index] || 0,
    surveys: surveyMonthlyCounts[index] || 0,
    agents: agentMonthlyCounts[index] || 0,
  }));

  const weeklyBucketsData = weekBuckets.map((bucket) => ({
    ...bucket,
    completed: 0,
    pending: 0,
  }));
  const hourBuckets = Array(24).fill(0);

  surveyResponses.forEach((response) => {
    const timestamp =
      response.createdAt || response.submittedAt || response.updatedAt;
    if (!timestamp) {
      return;
    }
    const time = new Date(timestamp);
    const target = weeklyBucketsData.find(
      (bucket) => time >= bucket.start && time < bucket.end,
    );
    if (!target) {
      return;
    }
    const isCompleted = String(response.status || "").toLowerCase() === "completed";
    if (isCompleted) {
      target.completed += 1;
    } else {
      target.pending += 1;
    }
    const hour = time.getHours();
    if (Number.isFinite(hour)) {
      hourBuckets[hour] += 1;
    }
  });

  const surveyDistribution = weeklyBucketsData.map((bucket) => ({
    category: bucket.label,
    completed: bucket.completed,
    pending: bucket.pending,
  }));

  const adminActivityBuckets = dayBuckets.map((bucket) => ({
    ...bucket,
    l1: 0,
    l2: 0,
    l3: 0,
  }));

  recentUsers.forEach((user) => {
    const createdAt = user.createdAt ? new Date(user.createdAt) : null;
    if (!createdAt) {
      return;
    }
    const bucket = adminActivityBuckets.find(
      (entry) => createdAt >= entry.start && createdAt < entry.end,
    );
    if (!bucket) {
      return;
    }
    if (user.role === "L1") {
      bucket.l1 += 1;
    } else if (user.role === "L2") {
      bucket.l2 += 1;
    } else if (user.role === "Booth Agent" || user.role === "BoothAgent") {
      bucket.l3 += 1;
    }
  });

  const adminActivityData = adminActivityBuckets.map((bucket) => ({
    day: bucket.label,
    l1: bucket.l1,
    l2: bucket.l2,
    l3: bucket.l3,
  }));

  const totalActivity = adminActivityData.reduce(
    (sum, row) => sum + row.l1 + row.l2 + row.l3,
    0,
  );
  const avgDailyLogins =
    adminActivityData.length > 0
      ? Math.round((totalActivity / adminActivityData.length) * 10) / 10
      : null;
  const peakHourCount = Math.max(...hourBuckets);
  const peakHourIndex = peakHourCount > 0 ? hourBuckets.indexOf(peakHourCount) : null;

  const trendSummary = {
    avgDailyLogins,
    peakHourActivity: peakHourIndex !== null ? formatHourWindow(peakHourIndex) : null,
    formsCreatedLast30Days,
    boothsActive,
    boothsTotal: totalBooths,
  };

  return {
    systemGrowthData,
    surveyDistribution,
    adminActivityData,
    trendSummary,
  };
};

// ==================== USER MANAGEMENT ROUTES ====================
// L0 can manage all users, L1 (ACIM) can create L2 (ACI) and BoothAgents

/**
 * GET /api/rbac/users
 * Get all users (with optional filters)
 * Access: L0, L1 (ACIM)
 */
router.get("/users", isAuthenticated, async (req, res) => {
  try {
    const { role, ac, search, status } = req.query;

    // Check permissions - L0, L1, and L2 can view users (with restrictions)
    if (req.user.role !== "L0" && req.user.role !== "L1" && req.user.role !== "L2") {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to view users",
      });
    }

    // L0 can see all users (including inactive), L1/L2 only see active users
    const query = {};
    let hasL1Or = false;

    // Only filter by isActive for L1 and L2, L0 can see all users
    if (req.user.role !== "L0") {
      query.isActive = true;
    }

    // L1 (ACIM) can only see users they created or in their AC
    if (req.user.role === "L1") {
      query.$or = [
        { createdBy: req.user._id },
        { assignedAC: req.user.assignedAC },
      ];
      hasL1Or = true;
    }

    // L2 (ACI) can only see users in their AC
    if (req.user.role === "L2") {
      query.assignedAC = req.user.assignedAC;
    }

    // Filter by role
    if (role) {
      // Handle both "Booth Agent" and "BoothAgent" for backward compatibility
      if (role === "Booth Agent" || role === "BoothAgent") {
        const roleFilter = { $or: [{ role: "Booth Agent" }, { role: "BoothAgent" }] };
        
        // If there's already a $or from L1 filter, combine with $and
        if (hasL1Or) {
          query.$and = [
            { $or: query.$or },
            roleFilter
          ];
          delete query.$or;
        } else {
          query.$or = roleFilter.$or;
        }
      } else {
        query.role = role;
      }
    }

    // Filter by AC
    if (ac) {
      const acId = parseInt(ac);
      // For L1/L2, ensure they can only filter by their own AC
      if ((req.user.role === "L1" || req.user.role === "L2") && acId !== req.user.assignedAC) {
        return res.status(403).json({
          success: false,
          message: "Access denied to users in this AC",
        });
      }
      query.assignedAC = acId;
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Search by name, email, or phone
    if (search) {
      const searchRegex = new RegExp(search, "i");
      const searchFilter = {
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
        ]
      };
      
      // If there's already a $and (from L1 + role filter), add search to it
      if (query.$and) {
        query.$and.push(searchFilter);
      } else if (query.$or) {
        // If there's a $or (from role filter or L1), combine with $and
        query.$and = [
          { $or: query.$or },
          searchFilter
        ];
        delete query.$or;
      } else {
        query.$or = searchFilter.$or;
      }
    }

    // Fetch all users without any limit
    // Remove any potential default limits by explicitly setting a very high limit
    const users = await User.find(query)
      .select("-password -passwordHash")
      .populate("createdBy", "name role")
      .populate("assignedBoothId", "boothName boothCode")
      .sort({ createdAt: -1 })
      .limit(10000) // Set a very high limit to ensure we get all users
      .lean()
      .exec();

    // Get the actual count to verify
    const totalCount = await User.countDocuments(query);
    
    // Also get total count without any filters for L0
    let totalInDatabase = totalCount;
    if (req.user.role === "L0") {
      totalInDatabase = await User.countDocuments({});
    }

    console.log(`[RBAC] Query:`, JSON.stringify(query, null, 2));
    console.log(`[RBAC] Fetched ${users.length} users out of ${totalCount} total matching query`);
    console.log(`[RBAC] Total users in database: ${totalInDatabase}`);

    res.json({
      success: true,
      count: users.length,
      totalCount: totalCount,
      totalInDatabase: totalInDatabase,
      users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message,
    });
  }
});

/**
 * POST /api/rbac/users
 * Create a new user
 * Access: L0 (all users), L1/ACIM (can create L2/ACI and BoothAgent)
 */
router.post("/users", isAuthenticated, async (req, res) => {
  try {
    const { 
      name, email, phone, password, role, assignedAC, aci_name, assignedBoothId, status,
      booth_id, booth_agent_id, aci_id 
    } = req.body;

    console.log("Create user request:", { 
      name, role, assignedAC, booth_id, booth_agent_id, aci_id,
      currentUserRole: req.user.role, currentUserAC: req.user.assignedAC 
    });

    // Validate required fields
    if (!name || !role) {
      return res.status(400).json({
        success: false,
        message: "Name and role are required",
      });
    }

    // Password is required for new users
    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required",
      });
    }

    // Check creation privileges
    if (req.user.role === "L0") {
      // L0 can create anyone
    } else if (req.user.role === "L1") {
      // L1 (ACIM) can only create L2 (ACI) and Booth Agent
      if (role !== "L2" && role !== "Booth Agent" && role !== "BoothAgent") {
        return res.status(403).json({
          success: false,
          message: "ACIM can only create ACI and Booth Agent users",
        });
      }
      // Must be in same AC (compare as numbers)
      const requestedAC = aci_id || assignedAC;
      const requestedACNum = typeof requestedAC === 'number' ? requestedAC : parseInt(requestedAC);
      const userAC = typeof req.user.assignedAC === 'number' ? req.user.assignedAC : parseInt(req.user.assignedAC);
      
      if ((role === "L2" || role === "Booth Agent" || role === "BoothAgent") && requestedAC && requestedACNum !== userAC) {
        return res.status(403).json({
          success: false,
          message: `You can only create users in your assigned AC (${userAC})`,
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to create users",
      });
    }

    // Validate role
    const validRoles = ["L0", "L1", "L2", "Booth Agent", "BoothAgent"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    // For L2, assignedAC is required
    if ((role === "L2") && !assignedAC && !aci_id) {
      return res.status(400).json({
        success: false,
        message: `assignedAC is required for role ${role}`,
      });
    }

    // For L1 (ACIM), assignedAC should NOT be set
    if (role === "L1" && (assignedAC || aci_id)) {
      return res.status(400).json({
        success: false,
        message: "ACIM (L1) users should not have an assigned AC",
      });
    }

    // Check if user already exists
    if (email || phone) {
      const existingUser = await User.findOne({
        $or: [
          email ? { email } : null,
          phone ? { phone } : null,
        ].filter(Boolean),
        isActive: true,
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "User with this email or phone already exists",
        });
      }
    }

    // Auto-generate booth_agent_id for Booth Agent role if not provided
    let finalBoothAgentId = booth_agent_id;
    if ((role === "Booth Agent" || role === "BoothAgent") && assignedBoothId && !booth_agent_id) {
      // Get the booth to get its booth_id
      const booth = await Booth.findById(assignedBoothId);
      if (booth) {
        const boothIdentifier = booth.booth_id || booth.boothCode || `BOOTH${booth.boothNumber}-${booth.ac_id}`;
        
        // Count existing agents assigned to this specific booth
        const existingAgentsCount = await User.countDocuments({ 
          assignedBoothId: assignedBoothId,
          role: { $in: ["Booth Agent", "BoothAgent"] },
          isActive: true 
        });
        
        // Generate booth_agent_id: {booth_id}-{sequence}
        let sequence = existingAgentsCount + 1;
        finalBoothAgentId = `${boothIdentifier}-${sequence}`;

        // Check if booth_agent_id already exists
        let existingAgentId = await User.findOne({ booth_agent_id: finalBoothAgentId });
        while (existingAgentId) {
          sequence++;
          finalBoothAgentId = `${boothIdentifier}-${sequence}`;
          existingAgentId = await User.findOne({ booth_agent_id: finalBoothAgentId });
        }
        
        console.log(`Auto-generated booth_agent_id: ${finalBoothAgentId} for booth ${boothIdentifier}`);
      }
    }

    // Check if booth_agent_id already exists (if manually provided)
    if (finalBoothAgentId) {
      const existingAgent = await User.findOne({ booth_agent_id: finalBoothAgentId });
      if (existingAgent) {
        return res.status(409).json({
          success: false,
          message: "Booth agent ID already exists",
        });
      }
    }

    // Get booth_id string if assignedBoothId is provided but booth_id is not
    let finalBoothId = booth_id;
    if (!finalBoothId && assignedBoothId) {
      const booth = await Booth.findById(assignedBoothId);
      if (booth) {
        finalBoothId = booth.booth_id || booth.boothCode || `BOOTH${booth.boothNumber}-${booth.ac_id}`;
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user with all fields (including mobile app fields)
    const newUser = new User({
      name,
      email,
      phone,
      passwordHash,
      password: passwordHash, // Store in both fields for compatibility
      role,
      assignedAC: aci_id || assignedAC || (req.user.role === "L1" ? req.user.assignedAC : undefined),
      aci_id: aci_id || assignedAC,
      aci_name: aci_name || (req.user.role === "L1" ? req.user.aci_name : undefined),
      assignedBoothId,
      booth_id: finalBoothId,
      booth_agent_id: finalBoothAgentId,
      status: status || "Active",
      createdBy: req.user._id,
      isActive: true,
      // Mobile app fields
      emailVerified: false,
      loginAttempts: 0,
    });

    await newUser.save();

    // Return user without password
    const userResponse = await User.findById(newUser._id)
      .select("-password -passwordHash")
      .populate("createdBy", "name role")
      .populate("assignedBoothId", "boothName boothCode booth_id");

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user: userResponse,
      booth_agent_id: newUser.booth_agent_id,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create user",
      error: error.message,
    });
  }
});

/**
 * Normalize phone number - remove spaces, dashes, and keep only digits
 * @param {string|number} phone - Phone number to normalize
 * @returns {string} Normalized phone number
 */
function normalizePhone(phone) {
  if (!phone) return phone;
  // Convert to string and remove all non-digit characters
  const normalized = String(phone).replace(/\D/g, '');
  return normalized || phone; // Return original if normalization results in empty string
}

/**
 * POST /api/rbac/users/booth-agent
 * Create a new booth agent (dedicated endpoint)
 * Access: L0, L1, L2
 */
router.post("/users/booth-agent", isAuthenticated, async (req, res) => {
  try {
    const { 
      username, 
      password, 
      fullName, 
      phoneNumber, 
      booth_id, 
      aci_id, 
      aci_name 
    } = req.body;

    console.log("Create booth agent request:", { 
      username, fullName, phoneNumber, booth_id, aci_id,
      currentUserRole: req.user.role, currentUserAC: req.user.assignedAC 
    });

    // Validate required fields
    if (!username || !password || !fullName || !phoneNumber || !booth_id || !aci_id) {
      return res.status(400).json({
        success: false,
        message: "All fields are required (username, password, fullName, phoneNumber, booth_id, aci_id)",
      });
    }

    // Normalize phone number
    const normalizedPhone = normalizePhone(phoneNumber);

    // Check creation privileges
    if (req.user.role === "L0") {
      // L0 can create anyone
    } else if (req.user.role === "L1") {
      // L1 (ACIM) can only create in their AC
      const requestedACNum = typeof aci_id === 'number' ? aci_id : parseInt(aci_id);
      const userAC = typeof req.user.assignedAC === 'number' ? req.user.assignedAC : parseInt(req.user.assignedAC);
      
      if (requestedACNum !== userAC) {
        return res.status(403).json({
          success: false,
          message: `You can only create booth agents in your assigned AC (${userAC})`,
        });
      }
    } else if (req.user.role === "L2") {
      // L2 (ACI) can only create in their AC
      const requestedACNum = typeof aci_id === 'number' ? aci_id : parseInt(aci_id);
      const userAC = typeof req.user.assignedAC === 'number' ? req.user.assignedAC : parseInt(req.user.assignedAC);
      
      if (requestedACNum !== userAC) {
        return res.status(403).json({
          success: false,
          message: `You can only create booth agents in your assigned AC (${userAC})`,
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to create booth agents",
      });
    }

    // Verify booth exists and is in the correct AC
    const booth = await Booth.findById(booth_id);
    if (!booth || !booth.isActive) {
      return res.status(404).json({
        success: false,
        message: "Booth not found or inactive",
      });
    }

    const aciIdNum = typeof aci_id === 'number' ? aci_id : parseInt(aci_id);
    if (booth.ac_id !== aciIdNum) {
      return res.status(400).json({
        success: false,
        message: "Booth does not belong to the specified AC",
      });
    }

    // Check if user already exists (by email/username or phone)
    // Check both normalized and original phone for backward compatibility
    const existingUser = await User.findOne({
      $or: [
        { email: username.toLowerCase() },
        { phone: normalizedPhone },
        { phone: phoneNumber }, // Also check original format for backward compatibility
      ],
      isActive: true,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this username or phone number already exists",
      });
    }

    // Generate booth_agent_id
    // Format: {booth_id}-{sequence} where sequence is the number of agents for this booth
    // Get the booth's booth_id (e.g., "BOOTH1-119")
    const boothIdentifier = booth.booth_id || booth.boothCode || `BOOTH${booth.boothNumber}-${booth.ac_id}`;
    
    // Count existing agents assigned to this specific booth
    const existingAgentsCount = await User.countDocuments({ 
      assignedBoothId: booth_id,
      role: { $in: ["Booth Agent", "BoothAgent"] },
      isActive: true 
    });
    
    // Generate booth_agent_id: {booth_id}-{sequence}
    let sequence = existingAgentsCount + 1;
    let booth_agent_id = `${boothIdentifier}-${sequence}`;

    // Check if booth_agent_id already exists (unlikely but possible)
    let existingAgentId = await User.findOne({ booth_agent_id });
    while (existingAgentId) {
      // Try with incremented sequence
      sequence++;
      booth_agent_id = `${boothIdentifier}-${sequence}`;
      existingAgentId = await User.findOne({ booth_agent_id });
    }
    
    console.log(`Generated booth_agent_id: ${booth_agent_id} for booth ${boothIdentifier} (${existingAgentsCount} existing agents)`);

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create booth agent user
    // Store username in email field for login purposes
    // Store normalized phone number for consistency
    const newUser = new User({
      email: username.toLowerCase(),
      name: fullName.trim(),
      phone: normalizedPhone, // Store normalized phone as string
      passwordHash,
      password: passwordHash, // Store in both fields for compatibility
      role: "Booth Agent",
      assignedAC: aciIdNum,
      aci_id: aciIdNum,
      aci_name: aci_name || booth.ac_name,
      assignedBoothId: booth_id, // Store the booth ObjectId reference
      booth_id: booth.booth_id || booth.boothCode || `BOOTH${booth.boothNumber}-${booth.ac_id}`, // Store the booth identifier string
      booth_agent_id,
      status: "Active",
      createdBy: req.user._id,
      isActive: true,
      // Mobile app fields
      emailVerified: false,
      loginAttempts: 0,
    });

    await newUser.save();

    // Update booth to include this agent in assignedAgents
    if (!booth.assignedAgents.includes(newUser._id)) {
      booth.assignedAgents.push(newUser._id);
      // If this is the first agent, set as primary
      if (!booth.primaryAgent) {
        booth.primaryAgent = newUser._id;
      }
      await booth.save();
    }

    // Return user without password
    const userResponse = await User.findById(newUser._id)
      .select("-password -passwordHash")
      .populate("createdBy", "name role")
      .populate("assignedBoothId", "boothName boothCode booth_id");

    res.status(201).json({
      success: true,
      message: "Booth agent created successfully",
      user: userResponse,
      booth_agent_id: newUser.booth_agent_id,
    });
  } catch (error) {
    console.error("Error creating booth agent:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create booth agent",
      error: error.message,
    });
  }
});

/**
 * PUT /api/rbac/users/:userId
 * Update an existing user
 * Access: L0, L1 (for users they created)
 */
router.put("/users/:userId", isAuthenticated, async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, fullName, email, phone, phoneNumber, password, role, assignedAC, aci_name, assignedBoothId, booth_id, status, isActive } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check update permissions
    if (req.user.role !== "L0") {
      // L1 can only update users they created
      if (req.user.role === "L1" && user.createdBy?.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "You can only update users you created",
        });
      }
      // L2 can update booth agents in their AC
      else if (req.user.role === "L2") {
        // L2 can only update booth agents (not other user types)
        if (user.role !== "Booth Agent" && user.role !== "BoothAgent") {
          return res.status(403).json({
            success: false,
            message: "ACI can only update booth agents",
          });
        }
        // L2 can only update agents in their assigned AC
        if (user.assignedAC !== req.user.assignedAC) {
          return res.status(403).json({
            success: false,
            message: "You can only update booth agents in your assigned AC",
          });
        }
      } else if (req.user.role !== "L1" && req.user.role !== "L2") {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to update users",
        });
      }
    }

    // Update fields (support both naming conventions)
    if (name || fullName) user.name = name || fullName;
    if (email) user.email = email;
    if (phone || phoneNumber) user.phone = phone || phoneNumber;
    if (role && req.user.role === "L0") user.role = role; // Only L0 can change roles
    if (assignedAC !== undefined) user.assignedAC = assignedAC;
    if (aci_name) user.aci_name = aci_name;
    if (assignedBoothId !== undefined) user.assignedBoothId = assignedBoothId;
    if (booth_id !== undefined) user.booth_id = booth_id;
    if (status) user.status = status;
    if (isActive !== undefined && req.user.role === "L0") user.isActive = isActive;

    // Update password if provided - update both fields for compatibility
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      user.passwordHash = hashedPassword;
      user.password = hashedPassword; // Keep both fields in sync
    }

    await user.save();

    const userResponse = await User.findById(user._id)
      .select("-password -passwordHash")
      .populate("createdBy", "name role")
      .populate("assignedBoothId", "boothName boothCode");

    res.json({
      success: true,
      message: "User updated successfully",
      user: userResponse,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update user",
      error: error.message,
    });
  }
});

/**
 * DELETE /api/rbac/users/:userId
 * Permanently delete a user from the database
 * Access: L0 (all users), L1 (users they created)
 */
router.delete("/users/:userId", isAuthenticated, async (req, res) => {
  try {
    const { userId } = req.params;

    // Check permissions
    if (req.user.role !== "L0" && req.user.role !== "L1") {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to delete users",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // L1 users can only delete users they created
    if (req.user.role === "L1") {
      const userCreatedBy = user.createdBy?.toString();
      const currentUserId = req.user._id.toString();
      
      if (userCreatedBy !== currentUserId) {
        return res.status(403).json({
          success: false,
          message: "You can only delete users you created",
        });
      }
    }

    // If user is a booth agent, remove them from booth's assignedAgents before deletion
    if (user.assignedBoothId) {
      const booth = await Booth.findById(user.assignedBoothId);
      if (booth) {
        booth.assignedAgents = booth.assignedAgents.filter(
          (agentId) => agentId.toString() !== userId
        );
        // If this was the primary agent, clear it
        if (booth.primaryAgent && booth.primaryAgent.toString() === userId) {
          booth.primaryAgent = null;
        }
        await booth.save();
      }
    }

    // Permanently delete the user from the database
    await User.findByIdAndDelete(userId);

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
      error: error.message,
    });
  }
});

// ==================== BOOTH MANAGEMENT ROUTES ====================
// L0, L1, L2 can manage booths (with AC restrictions for L1/L2)

/**
 * GET /api/rbac/booths
 * Get booths (filtered by AC for L1/L2)
 * Aggregates booth data from voter documents and merges with any existing booths in collection
 * Access: L0, L1, L2
 */
router.get("/booths", isAuthenticated, canManageBooths, validateACAccess, async (req, res) => {
  try {
    const { ac, search, source, page = 1, limit = 50 } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;

    let query = { isActive: true };

    // Apply AC filter based on user role
    query = applyACFilter(req.user, query);

    // Additional AC filter from query params (must match user's AC for L1/L2)
    if (ac) {
      const acId = parseInt(ac);
      if (!canAccessAC(req.user, acId)) {
        return res.status(403).json({
          success: false,
          message: "Access denied to this AC",
        });
      }
      query.ac_id = acId;
    }

    // Determine the target AC for voter data aggregation
    const targetAC = query.ac_id || req.user.assignedAC;

    // If source=collection, only return booths from collection (for backwards compatibility)
    if (source === "collection") {
      if (search) {
        const searchRegex = new RegExp(search, "i");
        query.$or = [{ boothName: searchRegex }, { boothCode: searchRegex }];
      }

      const booths = await Booth.find(query)
        .populate("assignedAgents", "name phone role")
        .populate("primaryAgent", "name phone role")
        .populate("createdBy", "name role")
        .sort({ boothNumber: 1 });

      return res.json({
        success: true,
        count: booths.length,
        booths,
      });
    }

    // For L1/L2 users with a specific AC, aggregate booth data from voter documents
    // This provides a complete view of all booths based on actual voter data
    let booths = [];

    if (targetAC) {
      try {
        // Aggregate booth data from voter documents
        // booth_id is the unique identifier (e.g., BOOTH1-111, BOOTH2-111, etc.)
        // Each booth_id has ~100 voters
        const voterBooths = await aggregateVoters(targetAC, [
          { $match: {} },
          {
            $group: {
              _id: "$booth_id",
              boothno: { $first: "$boothno" },
              boothname: { $first: "$boothname" },
              totalVoters: { $sum: 1 }
            }
          },
          { $sort: { "boothno": 1 } }
        ]);

        // Fetch existing booths from collection to merge metadata
        const existingBooths = await Booth.find({ ac_id: targetAC, isActive: true })
          .populate("assignedAgents", "name phone role")
          .populate("primaryAgent", "name phone role")
          .populate("createdBy", "name role");

        // Create a map of existing booths by their booth code
        const existingBoothMap = {};
        existingBooths.forEach(booth => {
          existingBoothMap[booth.boothCode] = booth;
          if (booth.booth_id) existingBoothMap[booth.booth_id] = booth;
        });

        // Get assigned agents for each booth from users collection
        const boothAgentMap = {};
        const boothAgents = await User.find({
          role: { $in: ["Booth Agent", "BoothAgent"] },
          assignedAC: targetAC,
          deleted: { $ne: true }
        }).select("name phone role booth_id assignedBoothId booth_agent_id");

        boothAgents.forEach(agent => {
          // Try to determine the booth ID in this priority:
          // 1. booth_id if it's in BOOTH format (e.g., "BOOTH1-111")
          // 2. Extract from booth_agent_id (e.g., "BOOTH1-111-2" -> "BOOTH1-111")
          // 3. Fall back to booth_id or assignedBoothId as-is
          let boothId = null;

          // Check if booth_id is in the correct format (starts with BOOTH)
          if (agent.booth_id && agent.booth_id.toString().startsWith("BOOTH")) {
            boothId = agent.booth_id;
          }
          // Try to extract from booth_agent_id (format: "BOOTH1-111-2")
          else if (agent.booth_agent_id) {
            const match = agent.booth_agent_id.match(/^(BOOTH\d+-\d+)/);
            if (match) {
              boothId = match[1];
            }
          }
          // Fall back to booth_id or assignedBoothId
          if (!boothId) {
            boothId = agent.booth_id || (agent.assignedBoothId ? agent.assignedBoothId.toString() : null);
          }

          if (boothId) {
            if (!boothAgentMap[boothId]) {
              boothAgentMap[boothId] = [];
            }
            boothAgentMap[boothId].push({
              _id: agent._id,
              name: agent.name,
              phone: agent.phone,
              role: agent.role
            });
          }
        });

        // Transform voter data into booth format, merging with existing booth data
        booths = voterBooths.map((vb, index) => {
          const boothId = vb._id; // e.g., "BOOTH1-111"
          const boothNumber = vb.boothno || index + 1;
          const boothName = vb.boothname || `Booth ${boothNumber}`;

          const existingBooth = existingBoothMap[boothId];
          const agentsFromUsers = boothAgentMap[boothId] || [];

          // Prefer existing booth data if available, but update voter count from voter data
          if (existingBooth) {
            return {
              ...existingBooth.toObject(),
              totalVoters: vb.totalVoters,
              isFromVoterData: false
            };
          }

          return {
            _id: `voter-booth-${targetAC}-${boothNumber}`,
            boothCode: boothId,
            boothNumber: boothNumber,
            boothName: boothName,
            ac_id: targetAC,
            acName: req.user.aci_name || `AC ${targetAC}`,
            totalVoters: vb.totalVoters,
            assignedAgents: agentsFromUsers,
            primaryAgent: agentsFromUsers.length > 0 ? agentsFromUsers[0] : null,
            address: "",
            isActive: true,
            isFromVoterData: true
          };
        });

        // Apply search filter if provided
        if (search) {
          const searchRegex = new RegExp(search, "i");
          booths = booths.filter(b =>
            searchRegex.test(b.boothName) || searchRegex.test(b.boothCode)
          );
        }
      } catch (voterError) {
        console.error("Error aggregating booths from voter data:", voterError);
        // Fall back to collection-only data
        if (search) {
          const searchRegex = new RegExp(search, "i");
          query.$or = [{ boothName: searchRegex }, { boothCode: searchRegex }];
        }
        booths = await Booth.find(query)
          .populate("assignedAgents", "name phone role")
          .populate("primaryAgent", "name phone role")
          .populate("createdBy", "name role")
          .sort({ boothNumber: 1 });
      }
    } else {
      // For L0 without specific AC filter, return booths from collection
      if (search) {
        const searchRegex = new RegExp(search, "i");
        query.$or = [{ boothName: searchRegex }, { boothCode: searchRegex }];
      }
      booths = await Booth.find(query)
        .populate("assignedAgents", "name phone role")
        .populate("primaryAgent", "name phone role")
        .populate("createdBy", "name role")
        .sort({ boothNumber: 1 });
    }

    // Apply pagination
    const totalCount = booths.length;
    const totalPages = Math.ceil(totalCount / limitNum);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedBooths = booths.slice(startIndex, endIndex);

    res.json({
      success: true,
      count: paginatedBooths.length,
      total: totalCount,
      booths: paginatedBooths,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages,
        total: totalCount,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    console.error("Error fetching booths:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch booths",
      error: error.message,
    });
  }
});

/**
 * POST /api/rbac/booths
 * Create a new booth
 * Access: L0, L1, L2
 */
router.post("/booths", isAuthenticated, canManageBooths, validateACAccess, async (req, res) => {
  try {
    // Support both acId/acName and ac_id/ac_name for backward compatibility
    const { boothName, boothCode, acId, acName, ac_id, ac_name, address, totalVoters } = req.body;
    
    // Normalize field names
    const normalizedAcId = parseInt(acId || ac_id);
    const normalizedAcName = acName || ac_name;

    // Validate required fields
    if (!boothName || !normalizedAcId || !normalizedAcName) {
      return res.status(400).json({
        success: false,
        message: "Booth name, AC ID, and AC name are required",
      });
    }

    // Check AC access
    if (!canAccessAC(req.user, normalizedAcId)) {
      return res.status(403).json({
        success: false,
        message: "You can only create booths in your assigned AC",
      });
    }

    // Auto-generate booth number: find the max booth number for this AC and increment by 1
    const maxBooth = await Booth.findOne({ ac_id: normalizedAcId, isActive: true })
      .sort({ boothNumber: -1 })
      .select("boothNumber")
      .lean();

    const nextBoothNumber = maxBooth ? maxBooth.boothNumber + 1 : 1;
    console.log(`Auto-generated booth number for AC ${normalizedAcId}: ${nextBoothNumber}`);

    // Generate booth_id in format: BOOTH<number>-<AC number>
    const boothIdentifier = boothCode || `BOOTH${nextBoothNumber}-${normalizedAcId}`;
    console.log("Generated booth_id:", boothIdentifier);

    // Check if booth code already exists
    const existingBooth = await Booth.findOne({ boothCode: boothIdentifier, isActive: true });
    if (existingBooth) {
      return res.status(409).json({
        success: false,
        message: "Booth with this code already exists",
      });
    }

    // Create booth
    const newBooth = new Booth({
      boothNumber: nextBoothNumber,
      boothName,
      boothCode: boothIdentifier,
      booth_id: boothIdentifier,
      ac_id: normalizedAcId,
      ac_name: normalizedAcName,
      address,
      totalVoters: totalVoters || 0,
      createdBy: req.user._id,
      isActive: true,
    });

    await newBooth.save();

    // Populate references before returning
    await newBooth.populate("createdBy", "name role");

    res.status(201).json({
      success: true,
      message: "Booth created successfully",
      booth: newBooth,
    });
  } catch (error) {
    console.error("Error creating booth:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create booth",
      error: error.message,
    });
  }
});

/**
 * PUT /api/rbac/booths/:boothId
 * Update an existing booth
 * Access: L0, L1, L2
 */
router.put("/booths/:boothId", isAuthenticated, canManageBooths, validateACAccess, async (req, res) => {
  try {
    const { boothId } = req.params;
    const { boothNumber, boothName, boothCode, address, totalVoters } = req.body;

    const booth = await Booth.findById(boothId);
    if (!booth || !booth.isActive) {
      return res.status(404).json({
        success: false,
        message: "Booth not found",
      });
    }

    // Check AC access
    if (!canAccessAC(req.user, booth.ac_id)) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this booth",
      });
    }

    // Update fields
    if (boothNumber) booth.boothNumber = boothNumber;
    if (boothName) booth.boothName = boothName;
    if (boothCode) {
      // Check if new booth code is unique
      const existingBooth = await Booth.findOne({
        boothCode,
        _id: { $ne: boothId },
        isActive: true,
      });
      if (existingBooth) {
        return res.status(409).json({
          success: false,
          message: "Booth code already exists",
        });
      }
      booth.boothCode = boothCode;
    }
    if (address) booth.address = address;
    if (totalVoters !== undefined) booth.totalVoters = totalVoters;

    await booth.save();
    await booth.populate([
      { path: "assignedAgents", select: "name phone role" },
      { path: "primaryAgent", select: "name phone role" },
      { path: "createdBy", select: "name role" },
    ]);

    res.json({
      success: true,
      message: "Booth updated successfully",
      booth,
    });
  } catch (error) {
    console.error("Error updating booth:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update booth",
      error: error.message,
    });
  }
});

/**
 * DELETE /api/rbac/booths/:boothId
 * Soft delete a booth
 * Access: L0, L1, L2
 */
router.delete("/booths/:boothId", isAuthenticated, canManageBooths, validateACAccess, async (req, res) => {
  try {
    const { boothId } = req.params;

    const booth = await Booth.findById(boothId);
    if (!booth) {
      return res.status(404).json({
        success: false,
        message: "Booth not found",
      });
    }

    // Check AC access
    if (!canAccessAC(req.user, booth.ac_id)) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this booth",
      });
    }

    // Soft delete
    booth.isActive = false;
    await booth.save();

    res.json({
      success: true,
      message: "Booth deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting booth:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete booth",
      error: error.message,
    });
  }
});

// ==================== BOOTH AGENT MANAGEMENT ROUTES ====================
// L0, L1, L2 can manage booth agents and assignments

/**
 * GET /api/rbac/booth-agents
 * Get booth agents (filtered by AC for L1/L2)
 * Access: L0, L1, L2
 */
router.get("/booth-agents", isAuthenticated, canManageBoothAgents, validateACAccess, async (req, res) => {
  try {
    const { ac, assigned, search } = req.query;

    let query = { 
      $or: [
        { role: "Booth Agent" },
        { role: "BoothAgent" }
      ],
      isActive: true 
    };

    // Apply AC filter for L1/L2
    if (req.user.role === "L1" || req.user.role === "L2") {
      query.assignedAC = req.user.assignedAC;
    }

    // Additional AC filter from query params
    if (ac) {
      const acId = parseInt(ac);
      if (req.user.role !== "L0" && acId !== req.user.assignedAC) {
        return res.status(403).json({
          success: false,
          message: "Access denied to agents in this AC",
        });
      }
      query.assignedAC = acId;
    }

    // Search by name or phone
    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [{ name: searchRegex }, { phone: searchRegex }];
    }

    const agents = await User.find(query)
      .select("-password -passwordHash")
      .sort({ name: 1 });

    // If filtering by assigned status, check booth assignments
    let filteredAgents = agents;
    if (assigned !== undefined) {
      const isAssigned = assigned === "true";
      const agentIds = agents.map((agent) => agent._id);

      const boothsWithAgents = await Booth.find({
        assignedAgents: { $in: agentIds },
        isActive: true,
      }).select("assignedAgents");

      const assignedAgentIds = new Set();
      boothsWithAgents.forEach((booth) => {
        booth.assignedAgents.forEach((agentId) => {
          assignedAgentIds.add(agentId.toString());
        });
      });

      filteredAgents = agents.filter((agent) => {
        const isAgentAssigned = assignedAgentIds.has(agent._id.toString());
        return isAssigned ? isAgentAssigned : !isAgentAssigned;
      });
    }

    res.json({
      success: true,
      count: filteredAgents.length,
      agents: filteredAgents,
    });
  } catch (error) {
    console.error("Error fetching booth agents:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch booth agents",
      error: error.message,
    });
  }
});

/**
 * POST /api/rbac/booth-agents/:boothId/assign
 * Assign a booth agent to a booth
 * Access: L0, L1, L2
 */
router.post("/booth-agents/:boothId/assign", isAuthenticated, canAssignAgents, validateACAccess, async (req, res) => {
  try {
    const { boothId } = req.params;
    const { agentId, isPrimary } = req.body;

    if (!agentId) {
      return res.status(400).json({
        success: false,
        message: "agentId is required",
      });
    }

    // Find booth
    const booth = await Booth.findById(boothId);
    if (!booth || !booth.isActive) {
      return res.status(404).json({
        success: false,
        message: "Booth not found",
      });
    }

    // Check AC access
    if (!canAccessAC(req.user, booth.ac_id)) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this booth",
      });
    }

    // Find agent
    const agent = await User.findById(agentId);
    if (!agent || (agent.role !== "Booth Agent" && agent.role !== "BoothAgent") || !agent.isActive) {
      return res.status(404).json({
        success: false,
        message: "Booth agent not found",
      });
    }

    // Verify agent is in the same AC
    if (agent.assignedAC && agent.assignedAC !== booth.ac_id) {
      return res.status(400).json({
        success: false,
        message: "Agent must be assigned to the same AC as the booth",
      });
    }

    // Check if already assigned
    const isAlreadyAssigned = booth.assignedAgents.some(
      (id) => id.toString() === agentId
    );

    if (!isAlreadyAssigned) {
      booth.assignedAgents.push(agentId);
    }

    // Set as primary if requested
    if (isPrimary) {
      booth.primaryAgent = agentId;
    }

    await booth.save();
    await booth.populate([
      { path: "assignedAgents", select: "name phone role" },
      { path: "primaryAgent", select: "name phone role" },
    ]);

    res.json({
      success: true,
      message: "Agent assigned successfully",
      booth,
    });
  } catch (error) {
    console.error("Error assigning agent:", error);
    res.status(500).json({
      success: false,
      message: "Failed to assign agent",
      error: error.message,
    });
  }
});

/**
 * DELETE /api/rbac/booth-agents/:boothId/unassign/:agentId
 * Unassign a booth agent from a booth
 * Access: L0, L1, L2
 */
router.delete("/booth-agents/:boothId/unassign/:agentId", isAuthenticated, canAssignAgents, validateACAccess, async (req, res) => {
  try {
    const { boothId, agentId } = req.params;

    // Find booth
    const booth = await Booth.findById(boothId);
    if (!booth || !booth.isActive) {
      return res.status(404).json({
        success: false,
        message: "Booth not found",
      });
    }

    // Check AC access
    if (!canAccessAC(req.user, booth.ac_id)) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this booth",
      });
    }

    // Remove agent from assignedAgents
    booth.assignedAgents = booth.assignedAgents.filter(
      (id) => id.toString() !== agentId
    );

    // Remove as primary if needed
    if (booth.primaryAgent && booth.primaryAgent.toString() === agentId) {
      booth.primaryAgent = null;
    }

    await booth.save();
    await booth.populate([
      { path: "assignedAgents", select: "name phone role" },
      { path: "primaryAgent", select: "name phone role" },
    ]);

    res.json({
      success: true,
      message: "Agent unassigned successfully",
      booth,
    });
  } catch (error) {
    console.error("Error unassigning agent:", error);
    res.status(500).json({
      success: false,
      message: "Failed to unassign agent",
      error: error.message,
    });
  }
});

/**
 * PUT /api/rbac/booth-agents/:agentId/assign-booth
 * Assign an agent directly to a booth (updates agent's assignedBoothId)
 * Access: L0, L1, L2
 */
router.put("/booth-agents/:agentId/assign-booth", isAuthenticated, canAssignAgents, validateACAccess, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { boothId } = req.body;

    // Find agent
    const agent = await User.findById(agentId);
    if (!agent || (agent.role !== "Booth Agent" && agent.role !== "BoothAgent") || !agent.isActive) {
      return res.status(404).json({
        success: false,
        message: "Booth agent not found",
      });
    }

    // Check AC access for agent
    if (req.user.role !== "L0" && agent.assignedAC && agent.assignedAC !== req.user.assignedAC) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this agent",
      });
    }

    // If boothId provided, validate booth
    if (boothId) {
      const booth = await Booth.findById(boothId);
      if (!booth || !booth.isActive) {
        return res.status(404).json({
          success: false,
          message: "Booth not found",
        });
      }

      // Check AC access for booth
      if (!canAccessAC(req.user, booth.ac_id)) {
        return res.status(403).json({
          success: false,
          message: "Access denied to this booth",
        });
      }

      // Verify booth and agent are in same AC
      if (agent.assignedAC && agent.assignedAC !== booth.ac_id) {
        return res.status(400).json({
          success: false,
          message: "Agent and booth must be in the same AC",
        });
      }

      agent.assignedBoothId = boothId;
    } else {
      // Unassign booth
      agent.assignedBoothId = null;
    }

    await agent.save();

    const agentResponse = await User.findById(agent._id)
      .select("-password -passwordHash")
      .populate("assignedBoothId", "boothName boothCode ac_id ac_name");

    res.json({
      success: true,
      message: boothId ? "Agent assigned to booth successfully" : "Agent unassigned from booth",
      agent: agentResponse,
    });
  } catch (error) {
    console.error("Error assigning booth to agent:", error);
    res.status(500).json({
      success: false,
      message: "Failed to assign booth to agent",
      error: error.message,
    });
  }
});

// ==================== DASHBOARD & STATISTICS ====================

/**
 * GET /api/rbac/dashboard/stats
 * Get dashboard statistics
 * Access: L0, L1, L2
 */
router.get("/dashboard/stats", isAuthenticated, validateACAccess, async (req, res) => {
  try {
    const assignedAC = req.user.role === "L0" ? null : resolveAssignedACFromUser(req.user);
    const boothQuery = assignedAC !== null ? { isActive: true, ac_id: assignedAC } : { isActive: true };
    const userQuery = assignedAC !== null ? { isActive: true, assignedAC } : { isActive: true };
    const agentRoleFilter = {
      $or: [{ role: "Booth Agent" }, { role: "BoothAgent" }],
    };

    // Get counts
    const totalBooths = await Booth.countDocuments(boothQuery);
    const totalAgents = await User.countDocuments({
      ...userQuery,
      ...agentRoleFilter,
    });

    // Get assigned agents count
    const boothsWithAgents = await Booth.find(boothQuery).select(
      "assignedAgents"
    );
    const assignedAgentIds = new Set();
    boothsWithAgents.forEach((booth) => {
      booth.assignedAgents.forEach((agentId) => {
        assignedAgentIds.add(agentId.toString());
      });
    });
    const boothsActive = boothsWithAgents.filter(
      (booth) => Array.isArray(booth.assignedAgents) && booth.assignedAgents.length > 0,
    ).length;

    const stats = {
      totalBooths,
      totalAgents,
      assignedAgents: assignedAgentIds.size,
      unassignedAgents: Math.max(totalAgents - assignedAgentIds.size, 0),
      boothsActive,
    };

    // L0 gets additional user counts
    if (req.user.role === "L0") {
      const totalACIMs = await User.countDocuments({ ...userQuery, role: "L1" });
      const totalACIs = await User.countDocuments({ ...userQuery, role: "L2" });
      stats.totalACIMs = totalACIMs;
      stats.totalACIs = totalACIs;
      stats.totalUsers = await User.countDocuments(userQuery);
    }

    const analytics = await buildDashboardAnalytics({
      assignedAC,
      totalBooths,
      boothsActive,
    });

    res.json({
      success: true,
      stats: {
        ...stats,
        ...analytics,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics",
      error: error.message,
    });
  }
});

/**
 * GET /api/rbac/dashboard/ac-overview
 * Batched AC performance stats to avoid hundreds of client requests
 * Access: L0 (all ACs), L1/L2 (their AC only)
 */
router.get("/dashboard/ac-overview", isAuthenticated, async (req, res) => {
  try {
    const toNumber = (value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const limitToAc =
      req.user.role === "L1" || req.user.role === "L2"
        ? resolveAssignedACFromUser(req.user)
        : null;

    if ((req.user.role === "L1" || req.user.role === "L2") && limitToAc === null) {
      return res.status(403).json({
        success: false,
        message: "No AC assigned to your account.",
      });
    }

    // Aggregation pipeline for voter stats
    const aggregationPipeline = [
      {
        $group: {
          _id: { acId: "$aci_id", acName: "$aci_name" },
          totalMembers: { $sum: 1 },
          surveyedMembers: {
            $sum: {
              $cond: [
                { $eq: ["$surveyed", true] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { "_id.acId": 1 } },
    ];

    let voterAggregation;
    if (limitToAc !== null) {
      // L1/L2: Query only the assigned AC collection
      voterAggregation = await aggregateVoters(limitToAc, aggregationPipeline);
    } else {
      // L0: Query all AC collections
      voterAggregation = await aggregateAllVoters(aggregationPipeline);
    }

    const userMatch = {
      isActive: { $ne: false },
      role: { $in: ["L1", "L2", "Booth Agent", "BoothAgent"] },
    };
    if (limitToAc !== null) {
      userMatch.assignedAC = limitToAc;
    }

    const users = await User.find(userMatch)
      .select("role assignedAC")
      .lean();

    const perAcUserCounts = new Map();
    const roleTotals = {
      totalL1Admins: 0,
      totalL2Moderators: 0,
      totalL3Agents: 0,
    };

    users.forEach((user) => {
      if (user.role === "L1") {
        roleTotals.totalL1Admins += 1;
      } else if (user.role === "L2") {
        roleTotals.totalL2Moderators += 1;
      } else if (user.role === "Booth Agent" || user.role === "BoothAgent") {
        roleTotals.totalL3Agents += 1;
      }

      const acId = resolveAssignedACFromUser(user);
      if (acId === null) {
        return;
      }

      const bucket =
        perAcUserCounts.get(acId) || { admins: 0, moderators: 0, agents: 0 };

      if (user.role === "L1") {
        bucket.admins += 1;
      } else if (user.role === "L2") {
        bucket.moderators += 1;
      } else if (user.role === "Booth Agent" || user.role === "BoothAgent") {
        bucket.agents += 1;
      }

      perAcUserCounts.set(acId, bucket);
    });

    const acPerformance = voterAggregation.map((entry) => {
      const acId = entry._id.acId;
      const acName = entry._id.acName;
      const counts = perAcUserCounts.get(acId) || {
        admins: 0,
        moderators: 0,
        agents: 0,
      };
      const voters = entry.totalMembers || 0;
      const surveyedMembers = entry.surveyedMembers || 0;
      const completion =
        voters > 0 ? Math.round((surveyedMembers / voters) * 1000) / 10 : 0;

      return {
        ac: acName ? `${acId ?? ""} - ${acName}` : `AC ${acId ?? ""}`,
        acNumber: acId ?? null,
        acName: acName || null,
        voters,
        surveyedMembers,
        completion,
        admins: counts.admins,
        moderators: counts.moderators,
        agents: counts.agents,
      };
    });

    // Include ACs that only have user data (no voters yet)
    perAcUserCounts.forEach((counts, acId) => {
      if (!acPerformance.find((ac) => ac.acNumber === acId)) {
        acPerformance.push({
          ac: `AC ${acId}`,
          acNumber: acId,
          acName: null,
          voters: 0,
          surveyedMembers: 0,
          completion: 0,
          admins: counts.admins,
          moderators: counts.moderators,
          agents: counts.agents,
        });
      }
    });

    // Sort again after potential additions
    acPerformance.sort((a, b) => {
      const aId = a.acNumber ?? 0;
      const bId = b.acNumber ?? 0;
      return aId - bId;
    });

    const totals = {
      ...roleTotals,
      totalVoters: acPerformance.reduce((sum, ac) => sum + ac.voters, 0),
      totalSurveyedMembers: acPerformance.reduce(
        (sum, ac) => sum + (ac.surveyedMembers || 0),
        0,
      ),
    };

    res.json({
      success: true,
      totals,
      acPerformance,
      scope: limitToAc ?? "all",
    });
  } catch (error) {
    console.error("Error building AC overview stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to build AC overview stats",
      error: error.message,
    });
  }
});

/**
 * GET /api/rbac/booths/:boothId/agents
 * Get all agents assigned to a specific booth
 * Access: L0, L1, L2
 */
router.get("/booths/:boothId/agents", isAuthenticated, async (req, res) => {
  try {
    const { boothId } = req.params;

    const booth = await Booth.findById(boothId)
      .populate("assignedAgents", "name phone email booth_agent_id booth_id status")
      .populate("primaryAgent", "name phone email booth_agent_id");

    if (!booth) {
      return res.status(404).json({
        success: false,
        message: "Booth not found",
      });
    }

    // Check AC access for L1 and L2
    if ((req.user.role === "L1" || req.user.role === "L2") && booth.ac_id !== req.user.assignedAC) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this booth",
      });
    }

    res.json({
      success: true,
      booth: {
        _id: booth._id,
        boothName: booth.boothName,
        boothCode: booth.boothCode,
        booth_id: booth.booth_id,
      },
      agents: booth.assignedAgents,
      primaryAgent: booth.primaryAgent,
    });
  } catch (error) {
    console.error("Error fetching booth agents:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch booth agents",
      error: error.message,
    });
  }
});

export default router;
