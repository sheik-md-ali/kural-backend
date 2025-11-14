/**
 * RBAC Routes - Role-Based Access Control for Election Management
 * Handles user management, booth management, and agent assignment
 */

import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Booth from "../models/Booth.js";
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

    // Check permissions
    if (req.user.role !== "L0" && req.user.role !== "L1") {
      return res.status(403).json({
        success: false,
        message: "Only Super Admin and ACIM can view users",
      });
    }

    const query = { isActive: true };

    // L1 (ACIM) can only see users they created or in their AC
    if (req.user.role === "L1") {
      query.$or = [
        { createdBy: req.user._id },
        { assignedAC: req.user.assignedAC },
      ];
    }

    // Filter by role
    if (role) {
      query.role = role;
    }

    // Filter by AC
    if (ac) {
      query.assignedAC = parseInt(ac);
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Search by name, email, or phone
    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ];
    }

    const users = await User.find(query)
      .select("-password -passwordHash")
      .populate("createdBy", "name role")
      .populate("assignedBoothId", "boothName boothCode")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: users.length,
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
      // L1 (ACIM) can only create L2 (ACI) and BoothAgent
      if (role !== "L2" && role !== "BoothAgent") {
        return res.status(403).json({
          success: false,
          message: "ACIM can only create ACI and Booth Agent users",
        });
      }
      // Must be in same AC (compare as numbers)
      const requestedAC = aci_id || assignedAC;
      const requestedACNum = typeof requestedAC === 'number' ? requestedAC : parseInt(requestedAC);
      const userAC = typeof req.user.assignedAC === 'number' ? req.user.assignedAC : parseInt(req.user.assignedAC);
      
      if ((role === "L2" || role === "BoothAgent") && requestedAC && requestedACNum !== userAC) {
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
    const validRoles = ["L0", "L1", "L2", "BoothAgent"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    // For L1 and L2, assignedAC is required
    if ((role === "L1" || role === "L2") && !assignedAC && !aci_id) {
      return res.status(400).json({
        success: false,
        message: `assignedAC is required for role ${role}`,
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

    // Check if booth_agent_id already exists
    if (booth_agent_id) {
      const existingAgent = await User.findOne({ booth_agent_id });
      if (existingAgent) {
        return res.status(409).json({
          success: false,
          message: "Booth agent ID already exists",
        });
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user with all fields
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
      booth_id,
      booth_agent_id,
      status: status || "Active",
      createdBy: req.user._id,
      isActive: true,
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
 * PUT /api/rbac/users/:userId
 * Update an existing user
 * Access: L0, L1 (for users they created)
 */
router.put("/users/:userId", isAuthenticated, async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, phone, password, role, assignedAC, aci_name, assignedBoothId, status, isActive } = req.body;

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
      } else if (req.user.role !== "L1") {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to update users",
        });
      }
    }

    // Update fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (role && req.user.role === "L0") user.role = role; // Only L0 can change roles
    if (assignedAC !== undefined) user.assignedAC = assignedAC;
    if (aci_name) user.aci_name = aci_name;
    if (assignedBoothId !== undefined) user.assignedBoothId = assignedBoothId;
    if (status) user.status = status;
    if (isActive !== undefined && req.user.role === "L0") user.isActive = isActive;

    // Update password if provided
    if (password) {
      user.passwordHash = await bcrypt.hash(password, 10);
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
 * Soft delete a user
 * Access: L0 only
 */
router.delete("/users/:userId", isAuthenticated, canManageUsers, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Soft delete
    user.isActive = false;
    await user.save();

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
 * Access: L0, L1, L2
 */
router.get("/booths", isAuthenticated, canManageBooths, validateACAccess, async (req, res) => {
  try {
    const { ac, search } = req.query;

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

    // Search by booth name or code
    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [{ boothName: searchRegex }, { boothCode: searchRegex }];
    }

    const booths = await Booth.find(query)
      .populate("assignedAgents", "name phone role")
      .populate("primaryAgent", "name phone role")
      .populate("createdBy", "name role")
      .sort({ boothNumber: 1 });

    res.json({
      success: true,
      count: booths.length,
      booths,
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
    const { boothNumber, boothName, boothCode, acId, acName, address, totalVoters } = req.body;

    // Validate required fields
    if (!boothNumber || !boothName || !acId || !acName) {
      return res.status(400).json({
        success: false,
        message: "boothNumber, boothName, acId, and acName are required",
      });
    }

    // Check AC access
    if (!canAccessAC(req.user, acId)) {
      return res.status(403).json({
        success: false,
        message: "You can only create booths in your assigned AC",
      });
    }

    // Check if booth code already exists
    if (boothCode) {
      const existingBooth = await Booth.findOne({ boothCode, isActive: true });
      if (existingBooth) {
        return res.status(409).json({
          success: false,
          message: "Booth with this code already exists",
        });
      }
    }

    // Create booth
    const newBooth = new Booth({
      boothNumber,
      boothName,
      boothCode: boothCode || `AC${acId}-B${boothNumber}`,
      ac_id: acId,
      ac_name: acName,
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

    let query = { role: "BoothAgent", isActive: true };

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
    if (!agent || agent.role !== "BoothAgent" || !agent.isActive) {
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
    if (!agent || agent.role !== "BoothAgent" || !agent.isActive) {
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
    let boothQuery = { isActive: true };
    let userQuery = { isActive: true };

    // Apply AC filter for L1/L2
    boothQuery = applyACFilter(req.user, boothQuery);
    if (req.user.role === "L1" || req.user.role === "L2") {
      userQuery.assignedAC = req.user.assignedAC;
    }

    // Get counts
    const totalBooths = await Booth.countDocuments(boothQuery);
    const totalAgents = await User.countDocuments({
      ...userQuery,
      role: "BoothAgent",
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

    const stats = {
      totalBooths,
      totalAgents,
      assignedAgents: assignedAgentIds.size,
      unassignedAgents: totalAgents - assignedAgentIds.size,
    };

    // L0 gets additional user counts
    if (req.user.role === "L0") {
      const totalACIMs = await User.countDocuments({ ...userQuery, role: "L1" });
      const totalACIs = await User.countDocuments({ ...userQuery, role: "L2" });
      stats.totalACIMs = totalACIMs;
      stats.totalACIs = totalACIs;
      stats.totalUsers = await User.countDocuments(userQuery);
    }

    res.json({
      success: true,
      stats,
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

// ==================== BOOTH MANAGEMENT ROUTES ====================

/**
 * GET /api/rbac/booths
 * Get all booths with optional filters
 * Access: L0, L1, L2
 */
router.get("/booths", isAuthenticated, async (req, res) => {
  try {
    const { ac_id, search, page = 1, limit = 100 } = req.query;

    const query = { isActive: true };

    // Apply AC filter for L1 and L2 users
    if (req.user.role === "L1" || req.user.role === "L2") {
      query.ac_id = req.user.assignedAC;
    } else if (ac_id) {
      query.ac_id = parseInt(ac_id);
    }

    // Search by booth name or code
    if (search) {
      query.$or = [
        { boothName: { $regex: search, $options: "i" } },
        { boothCode: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const booths = await Booth.find(query)
      .populate("assignedAgents", "name phone booth_agent_id")
      .populate("primaryAgent", "name phone")
      .populate("createdBy", "name role")
      .sort({ boothNumber: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Booth.countDocuments(query);

    res.json({
      success: true,
      booths,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
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
 * Access: L0, L1
 */
router.post("/booths", isAuthenticated, async (req, res) => {
  try {
    const { boothNumber, boothName, boothCode, ac_id, ac_name, address, totalVoters } = req.body;

    console.log("=== Booth Creation Request ===");
    console.log("Request body:", req.body);
    console.log("User:", req.user);

    // Validate permissions
    if (req.user.role !== "L0" && req.user.role !== "L1") {
      console.log("Permission denied: User role is", req.user.role);
      return res.status(403).json({
        success: false,
        message: "Only Super Admin and ACIM can create booths",
      });
    }

    // Validate required fields
    if (!boothNumber || !boothName || !ac_id || !ac_name) {
      console.log("Missing required fields:", { boothNumber, boothName, ac_id, ac_name });
      return res.status(400).json({
        success: false,
        message: "Booth number, name, AC ID, and AC name are required",
      });
    }

    // L1 users can only create booths in their AC
    if (req.user.role === "L1" && parseInt(ac_id) !== req.user.assignedAC) {
      console.log(`AC mismatch: User AC ${req.user.assignedAC}, Booth AC ${ac_id}`);
      return res.status(403).json({
        success: false,
        message: "You can only create booths in your assigned AC",
      });
    }

    // Check if booth code already exists
    if (boothCode) {
      const existingBooth = await Booth.findOne({ boothCode });
      if (existingBooth) {
        console.log("Booth code already exists:", boothCode);
        return res.status(409).json({
          success: false,
          message: "Booth code already exists",
        });
      }
    }

    // Generate booth_id
    const booth_id = boothCode || `AC${ac_id}-B${String(boothNumber).padStart(3, "0")}`;
    console.log("Generated booth_id:", booth_id);

    const newBooth = new Booth({
      boothNumber: parseInt(boothNumber),
      boothName,
      boothCode: booth_id,
      booth_id,
      ac_id: parseInt(ac_id),
      ac_name,
      address,
      totalVoters: totalVoters || 0,
      createdBy: req.user._id,
      isActive: true,
    });

    console.log("Saving new booth:", newBooth.toObject());
    await newBooth.save();
    console.log("Booth saved successfully with ID:", newBooth._id);

    const boothResponse = await Booth.findById(newBooth._id)
      .populate("createdBy", "name role");

    console.log("Booth creation successful");
    res.status(201).json({
      success: true,
      message: "Booth created successfully",
      booth: boothResponse,
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
 * Update a booth
 * Access: L0, L1 (for their AC)
 */
router.put("/booths/:boothId", isAuthenticated, async (req, res) => {
  try {
    const { boothId } = req.params;
    const { boothNumber, boothName, boothCode, address, totalVoters } = req.body;

    const booth = await Booth.findById(boothId);
    if (!booth) {
      return res.status(404).json({
        success: false,
        message: "Booth not found",
      });
    }

    // Check permissions
    if (req.user.role !== "L0" && req.user.role !== "L1") {
      return res.status(403).json({
        success: false,
        message: "Only Super Admin and ACIM can update booths",
      });
    }

    // L1 can only update booths in their AC
    if (req.user.role === "L1" && booth.ac_id !== req.user.assignedAC) {
      return res.status(403).json({
        success: false,
        message: "You can only update booths in your assigned AC",
      });
    }

    // Update fields
    if (boothNumber !== undefined) booth.boothNumber = parseInt(boothNumber);
    if (boothName !== undefined) booth.boothName = boothName;
    if (boothCode !== undefined) booth.boothCode = boothCode;
    if (address !== undefined) booth.address = address;
    if (totalVoters !== undefined) booth.totalVoters = totalVoters;

    await booth.save();

    const updatedBooth = await Booth.findById(boothId)
      .populate("assignedAgents", "name phone booth_agent_id")
      .populate("primaryAgent", "name phone")
      .populate("createdBy", "name role");

    res.json({
      success: true,
      message: "Booth updated successfully",
      booth: updatedBooth,
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
 * Delete (deactivate) a booth
 * Access: L0, L1 (for their AC)
 */
router.delete("/booths/:boothId", isAuthenticated, async (req, res) => {
  try {
    const { boothId } = req.params;

    const booth = await Booth.findById(boothId);
    if (!booth) {
      return res.status(404).json({
        success: false,
        message: "Booth not found",
      });
    }

    // Check permissions
    if (req.user.role !== "L0" && req.user.role !== "L1") {
      return res.status(403).json({
        success: false,
        message: "Only Super Admin and ACIM can delete booths",
      });
    }

    // L1 can only delete booths in their AC
    if (req.user.role === "L1" && booth.ac_id !== req.user.assignedAC) {
      return res.status(403).json({
        success: false,
        message: "You can only delete booths in your assigned AC",
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
