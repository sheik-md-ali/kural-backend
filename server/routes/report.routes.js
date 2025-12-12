import express from "express";
import mongoose from "mongoose";
import { connectToDatabase } from "../config/database.js";
import { getVoterModel } from "../utils/voterCollection.js";
import { aggregateSurveyResponses } from "../utils/surveyResponseCollection.js";
import { isAuthenticated, canAccessAC } from "../middleware/auth.js";

const router = express.Router();

// Apply authentication to all routes
router.use(isAuthenticated);

// Get booth performance reports
router.get("/:acId/booth-performance", async (req, res) => {
  try {
    await connectToDatabase();

    const acId = parseInt(req.params.acId);
    const { booth } = req.query;

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

    const matchQuery = {};

    if (booth && booth !== 'all') {
      matchQuery.boothname = booth;
    }

    // Aggregate booth performance data using AC-specific voter collection
    const VoterModel = getVoterModel(acId);
    const boothPerformance = await VoterModel.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            boothname: "$boothname",
            boothno: "$boothno",
            booth_id: "$booth_id"
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

    // Get survey completion data from AC-specific collection
    // Use boothname (primary), booth_id, or legacy booth field
    let surveysByBooth = [];
    try {
      surveysByBooth = await aggregateSurveyResponses(acId, [
        {
          $group: {
            // Group by boothname first, fallback to booth_id or legacy booth
            _id: { $ifNull: ["$boothname", { $ifNull: ["$booth_id", "$booth"] }] },
            surveys_completed: { $sum: 1 }
          }
        }
      ]);
    } catch (error) {
      console.error("Error aggregating survey responses:", error);
    }

    const surveyMap = new Map(surveysByBooth.map(s => [s._id, s.surveys_completed]));

    // Calculate families per booth using unique familyId (camelCase field)
    const familiesByBooth = await VoterModel.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$boothname",
          // Use $addToSet to get unique family IDs
          uniqueFamilies: { $addToSet: "$familyId" }
        }
      },
      {
        $project: {
          _id: 1,
          total_families: { $size: "$uniqueFamilies" }
        }
      }
    ]);

    const familyMap = new Map(familiesByBooth.map(f => [f._id, f.total_families]));

    return res.json({
      reports: boothPerformance.map(booth => ({
        // Booth identification fields
        booth: booth._id.boothname || `Booth ${booth._id.boothno}`,
        boothname: booth._id.boothname,
        boothNo: booth._id.boothno,
        booth_id: booth._id.booth_id,
        // Stats
        total_voters: booth.total_voters,
        total_families: familyMap.get(booth._id.boothname) || 0,
        male_voters: booth.male_voters,
        female_voters: booth.female_voters,
        verified_voters: booth.verified_voters,
        // Survey data - try matching by boothname first, then booth_id
        surveys_completed: surveyMap.get(booth._id.boothname) || surveyMap.get(booth._id.booth_id) || 0,
        avg_age: Math.round(booth.avg_age || 0),
        completion_rate: booth.total_voters > 0
          ? Math.round(((surveyMap.get(booth._id.boothname) || surveyMap.get(booth._id.booth_id) || 0) / booth.total_voters) * 100)
          : 0
      }))
    });

  } catch (error) {
    console.error("Error fetching booth performance:", error);
    return res.status(500).json({ message: "Failed to fetch booth performance" });
  }
});

// Get demographics data including age distribution
router.get("/:acId/demographics", async (req, res) => {
  try {
    await connectToDatabase();

    const acId = parseInt(req.params.acId);
    const { booth } = req.query;

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

    const matchQuery = { age: { $exists: true, $ne: null } };
    if (booth && booth !== 'all') {
      matchQuery.boothname = booth;
    }

    const VoterModel = getVoterModel(acId);

    // Age distribution with gender breakdown
    const ageDistribution = await VoterModel.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $and: [{ $gte: ["$age", 18] }, { $lte: ["$age", 25] }] }, then: "18-25" },
                { case: { $and: [{ $gte: ["$age", 26] }, { $lte: ["$age", 35] }] }, then: "26-35" },
                { case: { $and: [{ $gte: ["$age", 36] }, { $lte: ["$age", 45] }] }, then: "36-45" },
                { case: { $and: [{ $gte: ["$age", 46] }, { $lte: ["$age", 55] }] }, then: "46-55" },
                { case: { $and: [{ $gte: ["$age", 56] }, { $lte: ["$age", 65] }] }, then: "56-65" },
                { case: { $gte: ["$age", 66] }, then: "65+" }
              ],
              default: "Unknown"
            }
          },
          count: { $sum: 1 },
          maleCount: { $sum: { $cond: [{ $eq: ["$gender", "Male"] }, 1, 0] } },
          femaleCount: { $sum: { $cond: [{ $eq: ["$gender", "Female"] }, 1, 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Gender distribution
    const genderMatchQuery = booth && booth !== 'all' ? { boothname: booth } : {};
    const genderDistribution = await VoterModel.aggregate([
      { $match: genderMatchQuery },
      {
        $group: {
          _id: "$gender",
          count: { $sum: 1 }
        }
      }
    ]);

    // Surveyed status
    const surveyedStatus = await VoterModel.aggregate([
      { $match: genderMatchQuery },
      {
        $group: {
          _id: "$surveyed",
          count: { $sum: 1 }
        }
      }
    ]);

    // Format age groups in consistent order
    const ageGroups = ["18-25", "26-35", "36-45", "46-55", "56-65", "65+"];
    const formattedAgeData = ageGroups.map(group => {
      const data = ageDistribution.find(a => a._id === group);
      return {
        ageGroup: group,
        count: data?.count || 0,
        male: data?.maleCount || 0,
        female: data?.femaleCount || 0
      };
    });

    // Format gender data
    const genderData = {
      male: genderDistribution.find(g => g._id === "Male")?.count || 0,
      female: genderDistribution.find(g => g._id === "Female")?.count || 0
    };

    // Format survey status
    const surveyData = {
      surveyed: surveyedStatus.find(s => s._id === true)?.count || 0,
      notSurveyed: surveyedStatus.find(s => s._id === false)?.count || 0
    };

    return res.json({
      ageDistribution: formattedAgeData,
      genderDistribution: genderData,
      surveyStatus: surveyData
    });

  } catch (error) {
    console.error("Error fetching demographics:", error);
    return res.status(500).json({ message: "Failed to fetch demographics data" });
  }
});

export default router;
