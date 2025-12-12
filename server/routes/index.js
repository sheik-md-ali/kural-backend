import authRoutes from "./auth.routes.js";
import surveyRoutes from "./survey.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import voterRoutes from "./voter.routes.js";
import familyRoutes from "./family.routes.js";
import surveyResponseRoutes from "./surveyResponse.routes.js";
import reportRoutes from "./report.routes.js";
import masterDataRoutes from "./masterData.routes.js";
import mobileAppRoutes from "./mobileApp.routes.js";
import mappedFieldsRoutes from "./mappedFields.routes.js";
import healthRoutes from "./health.routes.js";
import rbacRoutes from "./rbac.js";

export {
  authRoutes,
  surveyRoutes,
  dashboardRoutes,
  voterRoutes,
  familyRoutes,
  surveyResponseRoutes,
  reportRoutes,
  masterDataRoutes,
  mobileAppRoutes,
  mappedFieldsRoutes,
  healthRoutes,
  rbacRoutes,
};

export function registerRoutes(app) {
  // Auth routes
  app.use("/api/auth", authRoutes);

  // Survey routes
  app.use("/api/surveys", surveyRoutes);

  // Dashboard routes
  app.use("/api/dashboard", dashboardRoutes);

  // Voter routes (including field management)
  app.use("/api/voters", voterRoutes);

  // Family routes
  app.use("/api/families", familyRoutes);

  // Survey response routes
  app.use("/api/survey-responses", surveyResponseRoutes);

  // Report routes
  app.use("/api/reports", reportRoutes);

  // Master data routes
  app.use("/api/master-data", masterDataRoutes);

  // Mobile app routes - need to handle different paths
  // Questions: /api/mobile-app-questions/*
  app.use("/api/mobile-app", mobileAppRoutes);

  // Also mount specific paths for backwards compatibility
  app.get("/api/mobile-app-questions", (req, res, next) => {
    req.url = "/questions";
    mobileAppRoutes(req, res, next);
  });
  app.post("/api/mobile-app-questions", (req, res, next) => {
    req.url = "/questions";
    mobileAppRoutes(req, res, next);
  });
  app.delete("/api/mobile-app-questions/:questionId", (req, res, next) => {
    req.url = `/questions/${req.params.questionId}`;
    mobileAppRoutes(req, res, next);
  });
  app.get("/api/mobile-app-responses", (req, res, next) => {
    req.url = "/responses";
    mobileAppRoutes(req, res, next);
  });
  app.get("/api/live-updates", (req, res, next) => {
    req.url = "/live-updates";
    mobileAppRoutes(req, res, next);
  });

  // Survey master data mappings and mapped fields
  app.use("/api", mappedFieldsRoutes);

  // Health check
  app.use("/api/health", healthRoutes);

  // RBAC routes
  app.use("/api/rbac", rbacRoutes);


  console.log("✓ All routes registered");
}
