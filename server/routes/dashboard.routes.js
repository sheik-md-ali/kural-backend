import express from "express";
import { connectToDatabase } from "../config/database.js";
import { buildAcQuery } from "../utils/helpers.js";
import {
  getVoterModel,
  countVoters,
  aggregateVoters,
  findOneVoter,
} from "../utils/voterCollection.js";
import {
  queryBoothAgentActivities,
  queryAllBoothAgentActivities,
  countBoothAgentActivities,
  countAllBoothAgentActivities,
} from "../utils/boothAgentActivityCollection.js";
import { isAuthenticated, canAccessAC } from "../middleware/auth.js";
import { getCache, setCache, cacheKeys, TTL } from "../utils/cache.js";
import { AC_NAMES, normalizeLocation } from "../utils/universalAdapter.js";

const router = express.Router();

// Apply authentication to all routes
router.use(isAuthenticated);

// Dashboard Statistics API
router.get("/stats/:acId", async (req, res) => {
  try {
    await connectToDatabase();

    const rawIdentifier = req.params.acId ?? req.query.aciName ?? req.query.acName;
    const acQuery = buildAcQuery(rawIdentifier);

    // Try to get from cache first (for numeric AC IDs)
    const numericAcId = Number(rawIdentifier);
    if (Number.isFinite(numericAcId)) {
      const cacheKey = cacheKeys.dashboardStats(numericAcId);
      const cachedStats = getCache(cacheKey, TTL.DASHBOARD_STATS);
      if (cachedStats) {
        // Verify user has access before returning cached data
        if (canAccessAC(req.user, numericAcId)) {
          return res.json(cachedStats);
        }
      }
    }

    if (!acQuery) {
      return res.status(400).json({ message: "Invalid AC identifier" });
    }

    const identifierString =
      typeof rawIdentifier === "string" ? rawIdentifier.trim() : "";
    const numericFromIdentifier = Number(
      identifierString || (typeof rawIdentifier === "number" ? rawIdentifier : NaN),
    );
    const hasNumericIdentifier = Number.isFinite(numericFromIdentifier);

    // Use the AC-specific voter collection - we need a numeric AC ID
    let acId;
    if (hasNumericIdentifier) {
      acId = numericFromIdentifier;

      // AC Isolation: Check if user can access this AC
      if (!canAccessAC(req.user, acId)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You do not have permission to view this AC's data."
        });
      }
    } else {
      // For name-based lookup, we need to search across collections to find the AC ID
      const voterResult = await findOneVoter({
        $or: [
          { aci_name: new RegExp(`^${identifierString}$`, 'i') },
          { ac_name: new RegExp(`^${identifierString}$`, 'i') }
        ]
      });
      if (voterResult && voterResult.voter) {
        acId = voterResult.voter.aci_id || voterResult.voter.aci_num;
      }
      if (!acId) {
        return res.status(400).json({ message: `AC not found: ${identifierString}` });
      }
    }
    const VoterModel = getVoterModel(acId);

    const acMeta = await VoterModel.findOne({}, {
      aci_name: 1,
      ac_name: 1,
      aci_num: 1,
      aci_id: 1,
    })
      .lean()
      .exec();

    // Use AC_NAMES from universal adapter as fallback for consistent naming
    const acName =
      acMeta?.aci_name ??
      acMeta?.ac_name ??
      AC_NAMES[acId] ??
      (identifierString && !hasNumericIdentifier ? identifierString : null);
    const acNumber =
      acMeta?.aci_num ??
      acMeta?.aci_id ??
      (hasNumericIdentifier ? numericFromIdentifier : null);

    // Get total members (voters) for this AC - use sharded collection
    const totalMembers = await countVoters(acId, {});

    // Get unique families by grouping voters with same address and guardian
    const familiesAggregation = await aggregateVoters(acId, [
      { $match: {} },
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
    const surveysCompleted = await countVoters(acId, { surveyed: true });

    // Get unique booths for this AC - group by booth_id for accuracy
    const boothsAggregation = await aggregateVoters(acId, [
      { $match: {} },
      { $group: { _id: "$booth_id" } },
      { $count: "total" },
    ]);
    const totalBooths = boothsAggregation.length > 0 ? boothsAggregation[0].total : 0;

    // Get booth-wise data - group by booth_id only to avoid duplicates
    const boothStats = await aggregateVoters(acId, [
      { $match: {} },
      {
        $group: {
          _id: "$boothname",
          boothno: { $first: "$boothno" },
          booth_id: { $first: "$booth_id" },
          voters: { $sum: 1 },
        },
      },
      { $sort: { boothno: 1 } },
      { $limit: 10 },
    ]);

    const responseData = {
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
        boothNo: booth.boothno,
        boothName: booth._id,  // _id contains boothname from the $group stage
        boothId: booth.booth_id,
        voters: booth.voters,
      })),
    };

    // Cache the response for future requests (5 minute TTL)
    if (acId && Number.isFinite(acId)) {
      const cacheKey = cacheKeys.dashboardStats(acId);
      setCache(cacheKey, responseData, TTL.DASHBOARD_STATS);
    }

    return res.json(responseData);
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return res.status(500).json({ message: "Failed to fetch dashboard statistics" });
  }
});

// Booth Agent Activities API - fetch actual activity records from boothagentactivities_* collections
router.get("/booth-agent-activities", async (req, res) => {
  try {
    await connectToDatabase();

    const { acId, boothId, limit = 100, status } = req.query;
    const numericLimit = Math.min(Number(limit) || 100, 500);

    // Build query
    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    if (boothId && boothId !== 'all') {
      // Support both booth_id (e.g., "BOOTH1-111") and boothno (e.g., "BOOTH1") matching
      query.$or = [
        { booth_id: boothId },
        { boothno: boothId },
        { booth_id: { $regex: new RegExp(`^${boothId}`, 'i') } }
      ];
    }

    let activities = [];
    let total = 0;

    if (acId && acId !== 'all') {
      const numericAcId = Number(acId);
      if (!Number.isFinite(numericAcId)) {
        return res.status(400).json({ success: false, message: "Invalid AC ID" });
      }

      // AC Isolation: Check if user can access this AC
      if (!canAccessAC(req.user, numericAcId)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You do not have permission to view this AC's data."
        });
      }

      activities = await queryBoothAgentActivities(numericAcId, query, {
        sort: { loginTime: -1 },
        limit: numericLimit,
      });
      total = await countBoothAgentActivities(numericAcId, query);
    } else {
      // L0 users can query all ACs
      if (req.user.role !== 'L0') {
        return res.status(403).json({
          success: false,
          message: "Only L0 users can query all ACs"
        });
      }

      activities = await queryAllBoothAgentActivities(query, {
        sort: { loginTime: -1 },
        limit: numericLimit,
      });
      total = await countAllBoothAgentActivities(query);
    }

    // Normalize location data and add AC name
    const normalizedActivities = activities.map(activity => {
      const acIdValue = activity.aci_id || activity._acId;
      return {
        ...activity,
        id: activity._id?.toString(),
        acId: acIdValue,
        aci_name: activity.aci_name || AC_NAMES[acIdValue] || null,
        location: activity.location ? normalizeLocation(activity.location) : null,
      };
    });

    // Get unique booth_ids from results for debugging
    const uniqueBooths = [...new Set(normalizedActivities.map(a => a.booth_id).filter(Boolean))];

    return res.json({
      success: true,
      activities: normalizedActivities,
      total,
      count: normalizedActivities.length,
      filters: { acId, boothId, status },
      availableBooths: uniqueBooths.slice(0, 10), // For debugging
    });
  } catch (error) {
    console.error("Error fetching booth agent activities:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch booth agent activities",
      error: error.message
    });
  }
});

export default router;
