import express from "express";
import { connectToDatabase } from "../config/database.js";
import { getVoterModel, aggregateVoters } from "../utils/voterCollection.js";
import { isAuthenticated, canAccessAC } from "../middleware/auth.js";
import { getCache, setCache, TTL, cacheKeys } from "../utils/cache.js";

const router = express.Router();

// Helper to escape regex special characters
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Apply authentication to all routes
router.use(isAuthenticated);

// Get families for a specific AC (aggregated from voters by familyId)
// OPTIMIZED v2: Uses caching + limited $push + efficient pagination
router.get("/:acId", async (req, res) => {
  try {
    await connectToDatabase();

    const acId = parseInt(req.params.acId);
    const { booth, search, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const skip = (pageNum - 1) * limitNum;

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

    // OPTIMIZATION: Check cache first (15 min TTL for families list - increased for better performance)
    const cacheKey = `ac:${acId}:families:${booth || 'all'}:${search || ''}:${pageNum}:${limitNum}`;
    const cached = getCache(cacheKey, TTL.LONG);
    if (cached) {
      return res.json(cached);
    }

    // Build match query - only include voters with valid familyId
    const matchQuery = {
      familyId: { $exists: true, $nin: [null, ""] }
    };

    if (booth && booth !== 'all') {
      const boothNum = parseInt(booth);
      if (!isNaN(boothNum) && String(boothNum) === booth) {
        matchQuery.boothno = boothNum;
      } else if (booth.includes('-')) {
        matchQuery.booth_id = booth;
      } else {
        matchQuery.$or = [
          { boothno: booth },
          { booth_id: new RegExp(`^${escapeRegex(booth)}-`, 'i') }
        ];
      }
    }

    // OPTIMIZATION: Two-stage query approach
    // Stage 1: Get distinct familyIds with pagination (fast)
    // Stage 2: Get voter details only for paginated families

    // Build search match stage (after grouping)
    let searchMatch = null;
    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), 'i');
      searchMatch = {
        $match: {
          $or: [
            { family_head: searchRegex },
            { "first_member_name.english": searchRegex },
            { "first_member_name.tamil": searchRegex },
            { address: searchRegex },
            { _id: searchRegex }
          ]
        }
      };
    }

    // OPTIMIZED: Don't push ALL voters - only count and get first member info
    const groupStage = {
      $group: {
        _id: "$familyId",
        family_head: { $first: "$familyHead" },
        first_member_name: { $first: "$name" },
        members: { $sum: 1 },
        address: { $first: "$address" },
        booth: { $first: "$boothname" },
        boothno: { $first: "$boothno" },
        booth_id: { $first: "$booth_id" },
        mobile: { $first: "$mobile" }
      }
    };

    // Build pipeline - NO $push of all voters!
    const basePipeline = [
      { $match: matchQuery },
      groupStage,
      { $sort: { boothno: 1, _id: 1 } }
    ];

    // Add search filter if provided
    if (searchMatch) {
      basePipeline.push(searchMatch);
    }

    // Use $facet for parallel count and paginated results
    const facetPipeline = [
      ...basePipeline,
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [{ $skip: skip }, { $limit: limitNum }]
        }
      }
    ];

    const [result] = await aggregateVoters(acId, facetPipeline);

    const total = result?.metadata[0]?.total || 0;
    const paginatedFamilies = result?.data || [];

    const response = {
      families: paginatedFamilies.map((family) => {
        const headName = family.family_head ||
          family.first_member_name?.english ||
          family.first_member_name?.tamil ||
          'N/A';

        return {
          id: family._id,
          family_head: headName,
          members: family.members,
          address: family.address || 'N/A',
          booth: family.booth || `Booth ${family.boothno || 'N/A'}`,
          boothNo: family.boothno,
          booth_id: family.booth_id,
          phone: family.mobile ? `+91 ${family.mobile}` : 'N/A',
          status: family.members > 0 ? 'Active' : 'Inactive',
          // OPTIMIZATION: Don't include voters array in list view
          // Use /families/:acId/details?familyId=xxx to get full voter list
          voters: []
        };
      }),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        pages: Math.ceil(total / limitNum)
      }
    };

    // Cache the response (15 min TTL)
    setCache(cacheKey, response, TTL.LONG);

    return res.json(response);

  } catch (error) {
    console.error("Error fetching families:", error);
    return res.status(500).json({ message: "Failed to fetch families" });
  }
});

// Get detailed family information by familyId
router.get("/:acId/details", async (req, res) => {
  try {
    await connectToDatabase();

    const acId = parseInt(req.params.acId);
    const { familyId, address, booth, boothNo } = req.query;

    console.log('Family details request:', { acId, familyId, address, booth, boothNo });

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

    const VoterModel = getVoterModel(acId);
    let members = [];

    // Primary lookup by familyId (preferred method)
    if (familyId) {
      members = await VoterModel.find({ familyId: familyId })
        .sort({ relationToHead: 1, age: -1 })
        .lean();
    }

    // Fallback to address+booth lookup for backward compatibility
    if (members.length === 0 && address && booth) {
      const matchQuery = {
        address: address,
        boothname: booth
      };

      if (boothNo) {
        // Handle boothNo - it could be a number or string like "BOOTH1"
        const boothNoNum = parseInt(boothNo);
        if (!isNaN(boothNoNum)) {
          matchQuery.boothno = boothNoNum;
        } else {
          matchQuery.boothno = boothNo;
        }
      }

      members = await VoterModel.find(matchQuery)
        .sort({ age: -1 })
        .lean();
    }

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

    // Find the family head - prefer member with relationToHead === 'Self'
    const familyHead = members.find(m => m.relationToHead === 'Self') || members[0];

    const formattedMembers = members.map((member) => ({
      id: member._id.toString(),
      name: member.name?.english || member.name?.tamil || 'N/A',
      voterID: member.voterID || 'N/A',
      age: member.age || 0,
      gender: member.gender || 'N/A',
      relationship: member.relationToHead || (member._id.toString() === familyHead._id.toString() ? 'Head' : 'Member'),
      phone: member.mobile ? `+91 ${member.mobile}` : '',
      surveyed: member.surveyed === true,
      surveyedAt: member.verifiedAt || member.surveyedAt || null,
      religion: member.religion || 'N/A',
      caste: member.caste || 'N/A'
    }));

    return res.json({
      success: true,
      family: {
        id: familyId || members[0].familyId || `${address}-${booth}`.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10).toUpperCase(),
        headName: familyHead.familyHead || familyHead.name?.english || familyHead.name?.tamil || 'N/A',
        address: familyHead.address || address || 'N/A',
        booth: familyHead.boothname || booth || 'N/A',
        boothNo: familyHead.boothno || 0,
        booth_id: familyHead.booth_id || '',
        acId: acId,
        acName: familyHead.aci_name || `AC ${acId}`,
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

export default router;
