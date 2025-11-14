/**
 * Authentication and Authorization Middleware
 * Provides role-based access control for election management system
 */

/**
 * Middleware to check if user is authenticated
 */
export const isAuthenticated = (req, res, next) => {
  if (!req.user || !req.user._id) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Please log in.",
    });
  }
  next();
};

/**
 * Middleware to check if user has specific role(s)
 * @param {...string} allowedRoles - Roles that are allowed access
 */
export const hasRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${allowedRoles.join(", ")}`,
      });
    }

    next();
  };
};

/**
 * Check if user is ACIM (L1) - Assembly Constituency In-charge Manager
 */
export const isACIM = hasRole("L1");

/**
 * Check if user is ACI (L2) or higher - Assembly Constituency In-charge
 */
export const isACIOrAbove = hasRole("L0", "L1", "L2");

/**
 * Check if user is Super Admin (L0)
 */
export const isSuperAdmin = hasRole("L0");

/**
 * Middleware for user management operations
 * Only L0 (Super Admin) can create and manage users
 */
export const canManageUsers = (req, res, next) => {
  if (!req.user || req.user.role !== "L0") {
    return res.status(403).json({
      success: false,
      message: "Only Super Admin can manage users.",
    });
  }
  next();
};

/**
 * Middleware for booth management operations
 * L0, L1 (ACIM), and L2 (ACI) can manage booths
 */
export const canManageBooths = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  const allowedRoles = ["L0", "L1", "L2"];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Only ACIM and ACI can manage booths.",
    });
  }

  next();
};

/**
 * Middleware for booth agent management operations
 * L0, L1 (ACIM), and L2 (ACI) can manage booth agents
 */
export const canManageBoothAgents = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  const allowedRoles = ["L0", "L1", "L2"];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Only ACIM and ACI can manage booth agents.",
    });
  }

  next();
};

/**
 * Middleware to check if user can assign agents to booths
 * L0, L1 (ACIM), and L2 (ACI) can assign agents
 */
export const canAssignAgents = canManageBoothAgents;

/**
 * Middleware to validate AC (Assembly Constituency) access
 * L1 and L2 users can only access data from their assigned AC
 */
export const validateACAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  // L0 (Super Admin) has access to all ACs
  if (req.user.role === "L0") {
    return next();
  }

  // L1 and L2 must have assignedAC
  if (req.user.role === "L1" || req.user.role === "L2") {
    if (!req.user.assignedAC) {
      return res.status(403).json({
        success: false,
        message: "No AC assigned to your account.",
      });
    }

    // Store the user's AC for filtering in the route handler
    req.userAC = req.user.assignedAC;
  }

  next();
};

/**
 * Helper function to filter data by AC based on user role
 * @param {Object} user - The authenticated user
 * @param {Object} query - MongoDB query object to modify
 */
export const applyACFilter = (user, query = {}) => {
  if (!user) {
    return query;
  }

  // L0 sees everything
  if (user.role === "L0") {
    return query;
  }

  // L1 and L2 see only their AC
  if ((user.role === "L1" || user.role === "L2") && user.assignedAC) {
    query.ac_id = user.assignedAC;
  }

  return query;
};

/**
 * Helper function to check if user can access specific AC
 * @param {Object} user - The authenticated user
 * @param {Number} acId - AC ID to check
 * @returns {Boolean}
 */
export const canAccessAC = (user, acId) => {
  if (!user) return false;
  if (user.role === "L0") return true;
  if ((user.role === "L1" || user.role === "L2") && user.assignedAC) {
    return user.assignedAC === acId;
  }
  return false;
};
