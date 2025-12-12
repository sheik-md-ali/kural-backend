import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import ErrorBoundary from "@/components/ErrorBoundary";
import PageErrorBoundary from "@/components/PageErrorBoundary";
import { PageLoader } from "@/components/PageLoader";

// Static imports for critical path (login, index)
import Index from "@/pages/Index";
import { Login } from "@/pages/Login";
import NotFound from "./pages/NotFound";

// Lazy load L0 pages
const L0Dashboard = lazy(() => import("@/pages/l0/Dashboard").then(m => ({ default: m.L0Dashboard })));
const UserManagement = lazy(() => import("@/pages/l0/UserManagement"));
const AppSettings = lazy(() => import("@/pages/l0/AppSettings").then(m => ({ default: m.AppSettings })));
const VoterData = lazy(() => import("@/pages/l0/VoterData").then(m => ({ default: m.VoterData })));
const VoterFieldManager = lazy(() => import("@/pages/l0/VoterFieldManager").then(m => ({ default: m.VoterFieldManager })));
const SurveyBank = lazy(() => import("@/pages/l0/SurveyBank").then(m => ({ default: m.SurveyBank })));
const SurveyResponses = lazy(() => import("@/pages/l0/SurveyResponses").then(m => ({ default: m.SurveyResponses })));
const FormBuilder = lazy(() => import("@/pages/l0/FormBuilder").then(m => ({ default: m.FormBuilder })));
const MasterData = lazy(() => import("@/pages/l0/MasterData").then(m => ({ default: m.MasterData })));
const MobileAppQuestions = lazy(() => import("@/pages/l0/MobileAppQuestions").then(m => ({ default: m.MobileAppQuestions })));
const MobileAppResponses = lazy(() => import("@/pages/l0/MobileAppResponses").then(m => ({ default: m.MobileAppResponses })));
const L0FamilyManager = lazy(() => import("@/pages/l0/FamilyManager").then(m => ({ default: m.FamilyManager })));
const L0ActivityLogs = lazy(() => import("@/pages/l0/ActivityLogs"));

// Lazy load L1 pages
const ConstituencySelector = lazy(() => import("@/pages/l1/ConstituencySelector").then(m => ({ default: m.ConstituencySelector })));
const ACDetailedDashboard = lazy(() => import("@/pages/l1/ACDetailedDashboard").then(m => ({ default: m.ACDetailedDashboard })));
const ACAnalyticsDashboard = lazy(() => import("@/pages/l1/ACAnalyticsDashboard").then(m => ({ default: m.ACAnalyticsDashboard })));
const ACComparison = lazy(() => import("@/pages/l1/ACComparison").then(m => ({ default: m.ACComparison })));
const GlobalAnalytics = lazy(() => import("@/pages/l1/GlobalAnalytics").then(m => ({ default: m.GlobalAnalytics })));
const ModeratorManagement = lazy(() => import("@/pages/l1/ModeratorManagement").then(m => ({ default: m.ModeratorManagement })));
const LiveSurveyMonitor = lazy(() => import("@/pages/l1/LiveSurveyMonitor").then(m => ({ default: m.LiveSurveyMonitor })));
const ACVoterManager = lazy(() => import("@/pages/l1/ACVoterManager").then(m => ({ default: m.ACVoterManager })));
const ACFamilyManager = lazy(() => import("@/pages/l1/ACFamilyManager").then(m => ({ default: m.ACFamilyManager })));
const ACSurveyManager = lazy(() => import("@/pages/l1/ACSurveyManager").then(m => ({ default: m.ACSurveyManager })));
const ACReports = lazy(() => import("@/pages/l1/ACReports").then(m => ({ default: m.ACReports })));
const L1AdvancedAnalytics = lazy(() => import("@/pages/l1/AdvancedAnalytics"));
const SurveyForms = lazy(() => import("@/pages/l1/SurveyForms").then(m => ({ default: m.SurveyForms })));
const L1ActivityLogs = lazy(() => import("@/pages/l1/ActivityLogs"));
const GlobalVoterManager = lazy(() => import("@/pages/l1/GlobalVoterManager").then(m => ({ default: m.GlobalVoterManager })));
const GlobalFamilyManager = lazy(() => import("@/pages/l1/GlobalFamilyManager").then(m => ({ default: m.GlobalFamilyManager })));
const L1LiveBoothUpdates = lazy(() => import("@/pages/l1/LiveBoothUpdates").then(m => ({ default: m.LiveBoothUpdates })));

// Lazy load L2 pages
const L2Dashboard = lazy(() => import("@/pages/l2/Dashboard").then(m => ({ default: m.L2Dashboard })));
const VoterManager = lazy(() => import("@/pages/l2/VoterManager").then(m => ({ default: m.VoterManager })));
const FamilyManager = lazy(() => import("@/pages/l2/FamilyManager").then(m => ({ default: m.FamilyManager })));
const SurveyManager = lazy(() => import("@/pages/l2/SurveyManager").then(m => ({ default: m.SurveyManager })));
const LiveBoothUpdates = lazy(() => import("@/pages/l2/LiveBoothUpdates").then(m => ({ default: m.LiveBoothUpdates })));
const Reports = lazy(() => import("@/pages/l2/Reports").then(m => ({ default: m.Reports })));
const L2SurveyForms = lazy(() => import("@/pages/l2/SurveyForms").then(m => ({ default: m.SurveyForms })));
const L2ActivityLogs = lazy(() => import("@/pages/l2/ActivityLogs"));

// Lazy load L9 War Room pages
const WarRoom = lazy(() => import("@/pages/l9/WarRoom").then(m => ({ default: m.WarRoom })));
const GeographicIntelligence = lazy(() => import("@/pages/l9/GeographicIntelligence"));
const PredictiveAnalytics = lazy(() => import("@/pages/l9/PredictiveAnalytics"));
const MicroTargeting = lazy(() => import("@/pages/l9/MicroTargeting"));
const FinancialIntelligence = lazy(() => import("@/pages/l9/FinancialIntelligence"));
const DigitalAnalytics = lazy(() => import("@/pages/l9/DigitalAnalytics"));
const TeamManagement = lazy(() => import("@/pages/l9/TeamManagement"));
const OppositionIntelligence = lazy(() => import("@/pages/l9/OppositionIntelligence"));
const CommunicationAnalytics = lazy(() => import("@/pages/l9/CommunicationAnalytics"));
const ElectionDayOps = lazy(() => import("@/pages/l9/ElectionDayOps"));
const SurveyIntelligence = lazy(() => import("@/pages/l9/SurveyIntelligence"));
const SuccessMetrics = lazy(() => import("@/pages/l9/SuccessMetrics"));

// Lazy load Shared pages
const BoothManagement = lazy(() => import("@/pages/shared/BoothManagement").then(m => ({ default: m.BoothManagement })));
const BoothAgentManagementNew = lazy(() => import("@/pages/shared/BoothAgentManagementNew").then(m => ({ default: m.BoothAgentManagementNew })));
const BoothAgentRegistration = lazy(() => import("@/pages/shared/BoothAgentRegistration"));
const FormPreview = lazy(() => import("@/pages/shared/FormPreview").then(m => ({ default: m.FormPreview })));

const queryClient = new QueryClient();

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) => {
  const { user, isAuthenticated, isCheckingSession } = useAuth();

  if (isCheckingSession) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span>Validating your session…</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const RoleBasedRedirect = () => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  switch (user?.role) {
    case 'L0':
      return <Navigate to="/l0/dashboard" replace />;
    case 'L1':
      return <Navigate to="/l1/constituencies" replace />;
    case 'L2':
      return <Navigate to="/l2/dashboard" replace />;
    case 'L9':
      return <Navigate to="/l9/war-room" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
};

// Wrapper component for lazy loaded routes
const LazyRoute = ({ children, pageName }: { children: React.ReactNode; pageName?: string }) => (
  <Suspense fallback={<PageLoader />}>
    <PageErrorBoundary pageName={pageName}>
      {children}
    </PageErrorBoundary>
  </Suspense>
);

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<RoleBasedRedirect />} />

      {/* L0 Routes */}
      <Route path="/l0/dashboard" element={<ProtectedRoute allowedRoles={['L0']}><LazyRoute pageName="System Dashboard"><L0Dashboard /></LazyRoute></ProtectedRoute>} />
      <Route path="/l0/users" element={<ProtectedRoute allowedRoles={['L0']}><LazyRoute pageName="User Management"><UserManagement /></LazyRoute></ProtectedRoute>} />
      <Route path="/l0/settings" element={<ProtectedRoute allowedRoles={['L0']}><LazyRoute pageName="App Settings"><AppSettings /></LazyRoute></ProtectedRoute>} />
      <Route path="/l0/voters" element={<ProtectedRoute allowedRoles={['L0']}><LazyRoute pageName="Voter Data"><VoterData /></LazyRoute></ProtectedRoute>} />
      <Route path="/l0/voter-fields" element={<ProtectedRoute allowedRoles={['L0']}><LazyRoute pageName="Voter Fields"><VoterFieldManager /></LazyRoute></ProtectedRoute>} />
      <Route path="/l0/surveys" element={<ProtectedRoute allowedRoles={['L0']}><LazyRoute pageName="Survey Bank"><SurveyBank /></LazyRoute></ProtectedRoute>} />
      <Route path="/l0/survey-responses" element={<ProtectedRoute allowedRoles={['L0']}><LazyRoute pageName="Survey Responses"><SurveyResponses /></LazyRoute></ProtectedRoute>} />
      <Route path="/l0/master-data" element={<ProtectedRoute allowedRoles={['L0']}><LazyRoute pageName="Master Data"><MasterData /></LazyRoute></ProtectedRoute>} />
      <Route path="/l0/mobile-app-questions" element={<ProtectedRoute allowedRoles={['L0']}><LazyRoute pageName="Mobile App Questions"><MobileAppQuestions /></LazyRoute></ProtectedRoute>} />
      <Route path="/l0/mobile-app-responses" element={<ProtectedRoute allowedRoles={['L0']}><LazyRoute pageName="Mobile App Responses"><MobileAppResponses /></LazyRoute></ProtectedRoute>} />
      <Route path="/l0/surveys/builder/:formId" element={<ProtectedRoute allowedRoles={['L0']}><LazyRoute pageName="Form Builder"><FormBuilder /></LazyRoute></ProtectedRoute>} />
      <Route path="/l0/surveys/preview/:formId" element={<ProtectedRoute allowedRoles={['L0']}><LazyRoute pageName="Form Preview"><FormPreview /></LazyRoute></ProtectedRoute>} />
      <Route path="/l0/activity-logs" element={<ProtectedRoute allowedRoles={['L0']}><LazyRoute pageName="Activity Logs"><L0ActivityLogs /></LazyRoute></ProtectedRoute>} />
      <Route path="/l0/families" element={<ProtectedRoute allowedRoles={['L0']}><LazyRoute pageName="Family Manager"><L0FamilyManager /></LazyRoute></ProtectedRoute>} />

      {/* Shared Routes (RBAC-enabled) */}
      <Route path="/shared/booth-management" element={<ProtectedRoute allowedRoles={['L0', 'L1', 'L2']}><LazyRoute pageName="Booth Management"><BoothManagement /></LazyRoute></ProtectedRoute>} />
      <Route path="/shared/booth-agent-management" element={<ProtectedRoute allowedRoles={['L0', 'L1', 'L2']}><LazyRoute pageName="Booth Agent Management"><BoothAgentManagementNew /></LazyRoute></ProtectedRoute>} />
      <Route path="/shared/booth-agent-registration" element={<ProtectedRoute allowedRoles={['L0', 'L1']}><LazyRoute pageName="Booth Agent Registration"><BoothAgentRegistration /></LazyRoute></ProtectedRoute>} />

      {/* L1 Routes */}
      <Route path="/l1/constituencies" element={<ProtectedRoute allowedRoles={['L1']}><LazyRoute pageName="Constituencies"><ConstituencySelector /></LazyRoute></ProtectedRoute>} />
      <Route path="/l1/ac/:acNumber" element={<ProtectedRoute allowedRoles={['L1']}><LazyRoute pageName="AC Dashboard"><ACDetailedDashboard /></LazyRoute></ProtectedRoute>} />
      <Route path="/l1/ac/:acNumber/voters" element={<ProtectedRoute allowedRoles={['L1']}><LazyRoute pageName="AC Voters"><ACVoterManager /></LazyRoute></ProtectedRoute>} />
      <Route path="/l1/ac/:acNumber/families" element={<ProtectedRoute allowedRoles={['L1']}><LazyRoute pageName="AC Families"><ACFamilyManager /></LazyRoute></ProtectedRoute>} />
      <Route path="/l1/ac/:acNumber/surveys" element={<ProtectedRoute allowedRoles={['L1']}><LazyRoute pageName="AC Surveys"><ACSurveyManager /></LazyRoute></ProtectedRoute>} />
      <Route path="/l1/ac/:acNumber/reports" element={<ProtectedRoute allowedRoles={['L1']}><LazyRoute pageName="AC Reports"><ACReports /></LazyRoute></ProtectedRoute>} />
      <Route path="/l1/analytics" element={<ProtectedRoute allowedRoles={['L1']}><LazyRoute pageName="Global Analytics"><GlobalAnalytics /></LazyRoute></ProtectedRoute>} />
      <Route path="/l1/ac-analytics" element={<ProtectedRoute allowedRoles={['L1']}><LazyRoute pageName="AC Analytics"><ACAnalyticsDashboard /></LazyRoute></ProtectedRoute>} />
      <Route path="/l1/ac-comparison" element={<ProtectedRoute allowedRoles={['L1']}><LazyRoute pageName="AC Comparison"><ACComparison /></LazyRoute></ProtectedRoute>} />
      <Route path="/l1/surveys" element={<ProtectedRoute allowedRoles={['L1']}><LazyRoute pageName="Survey Forms"><SurveyForms /></LazyRoute></ProtectedRoute>} />
      <Route path="/l1/surveys/builder/:formId" element={<ProtectedRoute allowedRoles={['L1']}><LazyRoute pageName="Form Builder"><FormBuilder /></LazyRoute></ProtectedRoute>} />
      <Route path="/l1/surveys/preview/:formId" element={<ProtectedRoute allowedRoles={['L1']}><LazyRoute pageName="Form Preview"><FormPreview /></LazyRoute></ProtectedRoute>} />
      <Route path="/l1/moderators" element={<ProtectedRoute allowedRoles={['L1']}><LazyRoute pageName="Moderators"><ModeratorManagement /></LazyRoute></ProtectedRoute>} />
      <Route path="/l1/live-surveys" element={<ProtectedRoute allowedRoles={['L1']}><LazyRoute pageName="Live Surveys"><LiveSurveyMonitor /></LazyRoute></ProtectedRoute>} />
      <Route path="/l1/advanced-analytics" element={<ProtectedRoute allowedRoles={['L1']}><LazyRoute pageName="Advanced Analytics"><L1AdvancedAnalytics /></LazyRoute></ProtectedRoute>} />
      <Route path="/l1/activity-logs" element={<ProtectedRoute allowedRoles={['L1']}><LazyRoute pageName="Activity Logs"><L1ActivityLogs /></LazyRoute></ProtectedRoute>} />
      <Route path="/l1/live-booth-updates" element={<ProtectedRoute allowedRoles={['L1']}><LazyRoute pageName="Live Booth Updates"><L1LiveBoothUpdates /></LazyRoute></ProtectedRoute>} />
      <Route path="/l1/voters" element={<ProtectedRoute allowedRoles={['L1']}><LazyRoute pageName="Voter Manager"><GlobalVoterManager /></LazyRoute></ProtectedRoute>} />
      <Route path="/l1/families" element={<ProtectedRoute allowedRoles={['L1']}><LazyRoute pageName="Family Manager"><GlobalFamilyManager /></LazyRoute></ProtectedRoute>} />

      {/* L2 Routes */}
      <Route path="/l2/dashboard" element={<ProtectedRoute allowedRoles={['L2']}><LazyRoute pageName="Dashboard"><L2Dashboard /></LazyRoute></ProtectedRoute>} />
      <Route path="/l2/voters" element={<ProtectedRoute allowedRoles={['L2']}><LazyRoute pageName="Voter Manager"><VoterManager /></LazyRoute></ProtectedRoute>} />
      <Route path="/l2/families" element={<ProtectedRoute allowedRoles={['L2']}><LazyRoute pageName="Family Manager"><FamilyManager /></LazyRoute></ProtectedRoute>} />
      <Route path="/l2/survey-forms" element={<ProtectedRoute allowedRoles={['L2']}><LazyRoute pageName="Survey Forms"><L2SurveyForms /></LazyRoute></ProtectedRoute>} />
      <Route path="/l2/surveys" element={<ProtectedRoute allowedRoles={['L2']}><LazyRoute pageName="Survey Manager"><SurveyManager /></LazyRoute></ProtectedRoute>} />
      <Route path="/l2/surveys/builder/:formId" element={<ProtectedRoute allowedRoles={['L2']}><LazyRoute pageName="Form Builder"><FormBuilder /></LazyRoute></ProtectedRoute>} />
      <Route path="/l2/surveys/preview/:formId" element={<ProtectedRoute allowedRoles={['L2']}><LazyRoute pageName="Form Preview"><FormPreview /></LazyRoute></ProtectedRoute>} />
      <Route path="/l2/live-updates" element={<ProtectedRoute allowedRoles={['L2']}><LazyRoute pageName="Live Updates"><LiveBoothUpdates /></LazyRoute></ProtectedRoute>} />
      <Route path="/l2/reports" element={<ProtectedRoute allowedRoles={['L2']}><LazyRoute pageName="Reports"><Reports /></LazyRoute></ProtectedRoute>} />
      <Route path="/l2/activity-logs" element={<ProtectedRoute allowedRoles={['L2']}><LazyRoute pageName="Activity Logs"><L2ActivityLogs /></LazyRoute></ProtectedRoute>} />

      {/* L9 War Room Routes */}
      <Route path="/l9/war-room" element={<ProtectedRoute allowedRoles={['L9']}><LazyRoute pageName="War Room"><WarRoom /></LazyRoute></ProtectedRoute>} />
      <Route path="/l9/geographic" element={<ProtectedRoute allowedRoles={['L9']}><LazyRoute pageName="Geographic Intelligence"><GeographicIntelligence /></LazyRoute></ProtectedRoute>} />
      <Route path="/l9/predictive" element={<ProtectedRoute allowedRoles={['L9']}><LazyRoute pageName="Predictive Analytics"><PredictiveAnalytics /></LazyRoute></ProtectedRoute>} />
      <Route path="/l9/micro-targeting" element={<ProtectedRoute allowedRoles={['L9']}><LazyRoute pageName="Micro-Targeting"><MicroTargeting /></LazyRoute></ProtectedRoute>} />
      <Route path="/l9/financial" element={<ProtectedRoute allowedRoles={['L9']}><LazyRoute pageName="Financial Intelligence"><FinancialIntelligence /></LazyRoute></ProtectedRoute>} />
      <Route path="/l9/digital" element={<ProtectedRoute allowedRoles={['L9']}><LazyRoute pageName="Digital Analytics"><DigitalAnalytics /></LazyRoute></ProtectedRoute>} />
      <Route path="/l9/team" element={<ProtectedRoute allowedRoles={['L9']}><LazyRoute pageName="Team Management"><TeamManagement /></LazyRoute></ProtectedRoute>} />
      <Route path="/l9/opposition" element={<ProtectedRoute allowedRoles={['L9']}><LazyRoute pageName="Opposition Intelligence"><OppositionIntelligence /></LazyRoute></ProtectedRoute>} />
      <Route path="/l9/communication" element={<ProtectedRoute allowedRoles={['L9']}><LazyRoute pageName="Communication Analytics"><CommunicationAnalytics /></LazyRoute></ProtectedRoute>} />
      <Route path="/l9/election-day" element={<ProtectedRoute allowedRoles={['L9']}><LazyRoute pageName="Election Day Ops"><ElectionDayOps /></LazyRoute></ProtectedRoute>} />
      <Route path="/l9/surveys" element={<ProtectedRoute allowedRoles={['L9']}><LazyRoute pageName="Survey Intelligence"><SurveyIntelligence /></LazyRoute></ProtectedRoute>} />
      <Route path="/l9/success" element={<ProtectedRoute allowedRoles={['L9']}><LazyRoute pageName="Success Metrics"><SuccessMetrics /></LazyRoute></ProtectedRoute>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
