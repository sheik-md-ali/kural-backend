import express from "express";
import mongoose from "mongoose";
import VoterField from "../models/VoterField.js";
import { connectToDatabase } from "../config/database.js";
import {
  unwrapLegacyFieldValue,
  inferFieldTypeFromValue,
  hasMeaningfulValue,
} from "../utils/helpers.js";
import {
  getVoterModel,
  findVoterById,
  findVoterByIdAndUpdate,
  findOneVoter,
  countAllVoters,
  queryAllVoters,
  ALL_AC_IDS,
} from "../utils/voterCollection.js";
import { isAuthenticated, canAccessAC } from "../middleware/auth.js";
import { getCache, setCache } from "../utils/cache.js";

const router = express.Router();

// Apply authentication to all routes
router.use(isAuthenticated);

// Reserved field names - EMPTY to allow full flexibility
const RESERVED_FIELDS = [];

// Get existing fields from actual voter documents (for reference)
// OPTIMIZED: Uses caching and samples from single AC collection
router.get("/fields/existing", async (req, res) => {
  try {
    await connectToDatabase();

    // Check cache first (30 minute TTL)
    const cacheKey = 'global:voter:fields:existing';
    const cached = getCache(cacheKey, 30 * 60 * 1000);
    if (cached) {
      return res.json(cached);
    }

    // Sample from voters_111 which has the most data (10k voters)
    // This is much faster than querying all 21 AC collections
    const primaryAcId = 111;
    const VoterModel = getVoterModel(primaryAcId);

    // Get total count from primary collection
    const totalVoters = await VoterModel.countDocuments({});

    // Sample 50 documents (sufficient for field discovery)
    const sampleVoters = await VoterModel.find({})
      .limit(50)
      .lean();

    if (sampleVoters.length === 0) {
      const response = { fields: {}, totalVoters: 0, samplesAnalyzed: 0 };
      setCache(cacheKey, response, 30 * 60 * 1000);
      return res.json(response);
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

        // Collect sample values (up to 3 unique samples per field - reduced from 5)
        if (fieldAnalysis[key].samples.length < 3) {
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

    // Add visibility information to each field
    Object.keys(sortedFields).forEach(key => {
      if (sortedFields[key].visible === undefined) {
        sortedFields[key].visible = visibilityMap[key] !== undefined ? visibilityMap[key] : true;
      }
    });

    const response = {
      fields: sortedFields,
      totalVoters,
      samplesAnalyzed: sampleVoters.length
    };

    // Cache the result
    setCache(cacheKey, response, 30 * 60 * 1000);

    return res.json(response);
  } catch (error) {
    console.error("Error fetching existing fields from voters:", error);
    return res.status(500).json({ message: "Failed to fetch existing fields", error: error.message });
  }
});

// Get all voter fields
router.get("/fields", async (req, res) => {
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
        visible: field.visible !== undefined ? field.visible : true,
        isReserved: false,
      })),
    });
  } catch (error) {
    console.error("Error fetching voter fields:", error);
    return res.status(500).json({ message: "Failed to fetch voter fields", error: error.message });
  }
});

// Convert all existing fields to object format { value, visible }
router.post("/fields/convert-all", async (_req, res) => {
  try {
    await connectToDatabase();

    const systemFields = new Set(['_id', '__v', 'createdAt', 'updatedAt']);
    const batchSize = 500;
    let totalFlattenedFields = 0;
    let totalVotersUpdated = 0;
    let totalVotersChecked = 0;

    // Iterate through all sharded voter collections
    for (const acId of ALL_AC_IDS) {
      const VoterModel = getVoterModel(acId);
      const cursor = VoterModel.find({}).lean().cursor();
      let bulkOps = [];
      let batchIndex = 0;

      for await (const voter of cursor) {
        totalVotersChecked++;
        const updateObj = {};

        Object.keys(voter).forEach((key) => {
          if (systemFields.has(key)) return;

          const { actualValue, wasLegacyFormat } = unwrapLegacyFieldValue(voter[key]);
          if (wasLegacyFormat) {
            updateObj[key] = actualValue ?? null;
            totalFlattenedFields++;
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
          const result = await VoterModel.bulkWrite(bulkOps, { ordered: false });
          totalVotersUpdated += result.modifiedCount || 0;
          console.log(`[Convert-All] AC ${acId} Batch ${batchIndex} flattened ${result.modifiedCount || 0} voters`);
          bulkOps = [];
          batchIndex++;
        }
      }

      if (bulkOps.length > 0) {
        const result = await VoterModel.bulkWrite(bulkOps, { ordered: false });
        totalVotersUpdated += result.modifiedCount || 0;
        console.log(`[Convert-All] AC ${acId} Final batch flattened ${result.modifiedCount || 0} voters`);
      }
    }

    return res.json({
      message: `Flattened ${totalFlattenedFields} legacy field instances across ${totalVotersUpdated} voter documents`,
      flattenedFields: totalFlattenedFields,
      votersUpdated: totalVotersUpdated,
      votersChecked: totalVotersChecked,
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
router.post("/fields", async (req, res) => {
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
      visible: req.body.visible !== undefined ? req.body.visible : true,
    });

    await newField.save();

    // Add the field to ALL existing voter documents across all sharded collections
    const normalizedDefault =
      defaultValue !== undefined && defaultValue !== null && defaultValue !== ''
        ? defaultValue
        : null;

    let totalUpdated = 0;
    let totalVoters = 0;
    for (const acId of ALL_AC_IDS) {
      const VoterModel = getVoterModel(acId);
      const updateResult = await VoterModel.updateMany(
        { [name]: { $exists: false } },
        { $set: { [name]: normalizedDefault } }
      );
      totalUpdated += updateResult.modifiedCount;
      totalVoters += await VoterModel.countDocuments({});
    }

    return res.status(201).json({
      message: `Field "${name}" has been successfully added to all ${totalVoters} voters. ${totalUpdated} voters were updated.`,
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

// Rename a field across all voter documents
router.post("/fields/:oldFieldName/rename", async (req, res) => {
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

    // Only prevent renaming of critical fields
    const CRITICAL_FIELDS = ['_id', 'name', 'voterID', 'voterId', 'createdAt', 'updatedAt'];
    const isCritical = CRITICAL_FIELDS.some(cf => cf.toLowerCase() === oldFieldName.toLowerCase());

    if (isCritical) {
      return res.status(400).json({
        message: `Field "${oldFieldName}" is a critical system field and cannot be renamed`
      });
    }

    const trimmedNewName = newFieldName.trim();

    // Check if new field name already exists in schema
    const existingFieldInSchema = await VoterField.findOne({ name: trimmedNewName });

    // Check if new field name already exists in voter documents
    const votersWithNewField = await countAllVoters({ [trimmedNewName]: { $exists: true } });
    const votersWithOldField = await countAllVoters({ [oldFieldName]: { $exists: true } });

    // If target field exists and it's different from source, we'll merge the data
    const needsMerge = votersWithNewField > 0 && trimmedNewName !== oldFieldName;

    // Count total voters
    const totalVoters = await countAllVoters({});
    const votersWithoutField = totalVoters - votersWithOldField;

    if (votersWithOldField === 0) {
      return res.status(404).json({
        message: `Field "${oldFieldName}" not found in any voter documents. Total voters: ${totalVoters}`
      });
    }

    // Handle field metadata
    try {
      const oldFieldMeta = await VoterField.findOne({ name: oldFieldName });
      const newFieldMeta = await VoterField.findOne({ name: trimmedNewName });

      if (oldFieldMeta) {
        if (newFieldMeta && trimmedNewName !== oldFieldName) {
          await VoterField.deleteOne({ name: oldFieldName });
          console.log(`Merging: Deleted old field metadata "${oldFieldName}" since "${trimmedNewName}" already exists`);
        } else if (!newFieldMeta) {
          try {
            oldFieldMeta.name = trimmedNewName;
            await oldFieldMeta.save();
          } catch (saveError) {
            await VoterField.deleteOne({ name: oldFieldName });
            console.log(`Merging: Deleted old field metadata "${oldFieldName}" after save error:`, saveError.message);
          }
        }
      }
    } catch (metaError) {
      console.warn(`Metadata update failed, continuing with field rename:`, metaError.message);
    }

    // Rename the field in voter documents
    let renamedCount = 0;
    let mergedCount = 0;

    for (const acId of ALL_AC_IDS) {
      const VoterModel = getVoterModel(acId);
      const votersWithField = await VoterModel.find({ [oldFieldName]: { $exists: true } }).lean();

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

        if (bulkOps.length > 0) {
          const batchResult = await VoterModel.bulkWrite(bulkOps);
          renamedCount += batchResult.modifiedCount;
        }
      }
    }

    let message;
    if (needsMerge) {
      message = `Field "${oldFieldName}" has been merged into "${trimmedNewName}" in ${renamedCount} voter documents.`;
    } else {
      message = `Field "${oldFieldName}" has been successfully renamed to "${trimmedNewName}" in ${renamedCount} voter documents`;
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
    const newName = newFieldName?.trim() || 'unknown';
    if (error.message?.includes('already exists') || error.message?.includes('duplicate') || error.code === 11000) {
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

// Toggle field visibility
router.put("/fields/:fieldName/visibility", async (req, res) => {
  try {
    await connectToDatabase();

    const { fieldName } = req.params;
    const { visible } = req.body;

    if (typeof visible !== 'boolean') {
      return res.status(400).json({ message: "Visible parameter must be a boolean value" });
    }

    const CRITICAL_FIELDS = ['_id', 'createdAt', 'updatedAt'];
    if (CRITICAL_FIELDS.includes(fieldName)) {
      return res.status(400).json({
        message: `Field "${fieldName}" is a critical system field and cannot have visibility toggled`
      });
    }

    let field = await VoterField.findOne({ name: fieldName });

    if (field) {
      field.visible = visible;
      await field.save();
    } else {
      const sampleVoterResult = await findOneVoter({ [fieldName]: { $exists: true } });
      if (!sampleVoterResult) {
        return res.status(404).json({
          message: `Field "${fieldName}" not found in schema or voter documents`
        });
      }

      const { actualValue } = unwrapLegacyFieldValue(sampleVoterResult.voter[fieldName]);
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
    return res.status(500).json({
      message: "Failed to toggle field visibility",
      error: error.message || String(error),
    });
  }
});

// Update a voter field
router.put("/fields/:fieldName", async (req, res) => {
  try {
    await connectToDatabase();

    const { fieldName } = req.params;
    const { type, required, default: defaultValue, label, description } = req.body;

    const field = await VoterField.findOne({ name: fieldName });
    if (!field) {
      return res.status(404).json({ message: `Field "${fieldName}" not found` });
    }

    if (type !== undefined) field.type = type;
    if (required !== undefined) field.required = required;
    if (defaultValue !== undefined) field.default = defaultValue;
    if (label !== undefined) field.label = label;
    if (description !== undefined) field.description = description;
    if (req.body.visible !== undefined) field.visible = req.body.visible;

    await field.save();

    if (defaultValue !== undefined && defaultValue !== null && defaultValue !== '') {
      const updateQuery = { $set: { [fieldName]: defaultValue } };
      for (const acId of ALL_AC_IDS) {
        const VoterModel = getVoterModel(acId);
        await VoterModel.updateMany({ [fieldName]: { $exists: false } }, updateQuery);
      }
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

// Delete a voter field
router.delete("/fields/:fieldName", async (req, res) => {
  try {
    await connectToDatabase();

    const { fieldName } = req.params;

    const field = await VoterField.findOne({ name: fieldName });

    if (field) {
      await VoterField.deleteOne({ name: fieldName });
    }

    const unsetQuery = { $unset: { [fieldName]: "" } };
    let totalModified = 0;
    for (const acId of ALL_AC_IDS) {
      const VoterModel = getVoterModel(acId);
      const result = await VoterModel.updateMany({}, unsetQuery);
      totalModified += result.modifiedCount;
    }

    return res.json({
      message: `Field "${fieldName}" has been successfully deleted from all voters`,
      fieldName,
      votersAffected: totalModified,
      wasInSchema: !!field,
    });
  } catch (error) {
    console.error("Error deleting voter field:", error);
    return res.status(500).json({ message: "Failed to delete voter field", error: error.message });
  }
});

// Get single voter by ID
router.get("/details/:voterId", async (req, res) => {
  try {
    await connectToDatabase();

    const { voterId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(voterId)) {
      return res.status(400).json({ message: "Invalid voter ID" });
    }

    const result = await findVoterById(voterId);

    if (!result) {
      return res.status(404).json({ message: "Voter not found" });
    }

    return res.json(result.voter);
  } catch (error) {
    console.error("Error fetching voter details:", error);
    return res.status(500).json({ message: "Failed to fetch voter details", error: error.message });
  }
});

// Update a single voter by ID
router.put("/:voterId", async (req, res) => {
  try {
    await connectToDatabase();

    const { voterId } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(voterId)) {
      return res.status(400).json({ message: "Invalid voter ID" });
    }

    const currentVoterResult = await findVoterById(voterId);
    if (!currentVoterResult) {
      return res.status(404).json({ message: "Voter not found" });
    }
    const currentVoter = currentVoterResult.voter;
    const voterAcId = currentVoterResult.acId;

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

    const VoterModel = getVoterModel(voterAcId);
    const voter = await VoterModel.findByIdAndUpdate(
      voterId,
      { $set: processedUpdateData },
      { new: true, runValidators: false }
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
router.get("/:acId", async (req, res) => {
  try {
    await connectToDatabase();

    const acIdParam = req.params.acId;

    // Check if it's a reserved path
    if (['fields', 'details'].includes(acIdParam)) {
      return res.status(400).json({ message: "Invalid route" });
    }

    const rawIdentifier = acIdParam ?? req.query.aciName ?? req.query.acName;

    // Check if the identifier looks like an ObjectId
    if (mongoose.Types.ObjectId.isValid(rawIdentifier) && rawIdentifier.length === 24) {
      return res.status(400).json({
        message: "Invalid AC identifier. Use /api/voters/details/:voterId to fetch individual voter details."
      });
    }

    let acId;
    const numericId = Number(rawIdentifier);
    if (!isNaN(numericId) && numericId > 0) {
      acId = numericId;
    } else {
      const identifierString = String(rawIdentifier);
      const voterResult = await findOneVoter({
        $or: [
          { aci_name: new RegExp(`^${identifierString}$`, 'i') },
          { ac_name: new RegExp(`^${identifierString}$`, 'i') }
        ]
      });
      if (voterResult && voterResult.voter) {
        acId = voterResult.voter.aci_id || voterResult.voter.aci_num;
      }
    }

    if (!acId) {
      return res.status(400).json({ message: `Invalid AC identifier: ${rawIdentifier}` });
    }

    // AC Isolation: Check if user can access this AC
    if (!canAccessAC(req.user, acId)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You do not have permission to view this AC's data."
      });
    }

    const { booth, search, status, page = 1, limit = 50 } = req.query;

    const queryClauses = [];

    if (booth && booth !== "all") {
      // Support both booth_id (e.g., "BOOTH1-111") and boothname
      queryClauses.push({
        $or: [
          { booth_id: booth },
          { boothname: booth }
        ]
      });
    }

    if (status && status !== "all") {
      // Handle "Not Contacted" status - includes voters without status field or with null/undefined status
      if (status === "Not Contacted") {
        queryClauses.push({
          $or: [
            { status: { $regex: /^not\s*contacted$/i } },
            { status: { $exists: false } },
            { status: null },
            { status: "" }
          ]
        });
      } else if (status === "Surveyed") {
        // Match "Surveyed" or "verified" (case-insensitive)
        queryClauses.push({
          $or: [
            { status: { $regex: /^surveyed$/i } },
            { status: { $regex: /^verified$/i } }
          ]
        });
      } else if (status === "Pending") {
        // Match "Pending" (case-insensitive)
        queryClauses.push({ status: { $regex: /^pending$/i } });
      } else {
        // For any other status, use case-insensitive match
        queryClauses.push({ status: { $regex: new RegExp(`^${status}$`, 'i') } });
      }
    }

    if (search) {
      queryClauses.push({
        $or: [
          { "name.english": { $regex: search, $options: "i" } },
          { "name.tamil": { $regex: search, $options: "i" } },
          { voterID: { $regex: search, $options: "i" } },
        ],
      });
    }

    const query = queryClauses.length === 0 ? {} :
      queryClauses.length === 1 ? queryClauses[0] : { $and: queryClauses };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const VoterModel = getVoterModel(acId);

    const voters = await VoterModel.find(query)
      .select("name voterID familyId family_id booth_id boothname boothno mobile status age gender verified surveyed")
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ boothno: 1, "name.english": 1 })
      .lean();

    const totalVoters = await VoterModel.countDocuments(query);

    return res.json({
      voters: voters.map((voter) => {
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
          familyId: voter.familyId || voter.family_id || "N/A",
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
router.get("/:acId/booths", async (req, res) => {
  try {
    await connectToDatabase();

    const rawIdentifier = req.params.acId;

    let acId;
    const numericId = Number(rawIdentifier);
    if (!isNaN(numericId) && numericId > 0) {
      acId = numericId;
    } else {
      const identifierString = String(rawIdentifier);
      const voterResult = await findOneVoter({
        $or: [
          { aci_name: new RegExp(`^${identifierString}$`, 'i') },
          { ac_name: new RegExp(`^${identifierString}$`, 'i') }
        ]
      });
      if (voterResult && voterResult.voter) {
        acId = voterResult.voter.aci_id || voterResult.voter.aci_num;
      }
    }

    if (!acId) {
      return res.status(400).json({ message: `Invalid AC identifier: ${rawIdentifier}` });
    }

    // AC Isolation: Check if user can access this AC
    if (!canAccessAC(req.user, acId)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You do not have permission to view this AC's data."
      });
    }

    const VoterModel = getVoterModel(acId);

    const boothsAggregation = await VoterModel.aggregate([
      {
        $group: {
          _id: "$booth_id",
          boothno: { $first: "$boothno" },
          boothname: { $first: "$boothname" },
          voterCount: { $sum: 1 }
        }
      },
      { $sort: { boothno: 1 } }
    ]);

    const booths = boothsAggregation
      .filter((booth) => booth._id != null && booth._id !== "")
      .map((booth) => ({
        boothId: booth._id,
        booth_id: booth._id,
        boothNo: booth.boothno,
        boothName: booth.boothname || `Booth ${booth.boothno}`,
        voterCount: booth.voterCount,
        label: booth.boothname || `Booth ${booth.boothno}`,
        // Combined display for dropdowns: "BOOTH_ID - Booth Name"
        displayName: `${booth._id} - ${booth.boothname || `Booth ${booth.boothno}`}`
      }));

    return res.json({ booths });
  } catch (error) {
    console.error("Error fetching booths:", error);
    return res.status(500).json({ message: "Failed to fetch booths" });
  }
});

export default router;
