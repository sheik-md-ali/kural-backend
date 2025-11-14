import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import Index from "@/pages/Index";
import { Login } from "@/pages/Login";
import { ConstituencySelector } from "@/pages/l1/ConstituencySelector";
import { ACDetailedDashboard } from "@/pages/l1/ACDetailedDashboard";
import { ACAnalyticsDashboard } from "@/pages/l1/ACAnalyticsDashboard";
import { ACComparison } from "@/pages/l1/ACComparison";
import { GlobalAnalytics } from "@/pages/l1/GlobalAnalytics";
import { SurveyAssignments } from "@/pages/l1/SurveyAssignments";
import { ModeratorManagement } from "@/pages/l1/ModeratorManagement";
import { LiveSurveyMonitor } from "@/pages/l1/LiveSurveyMonitor";
import { ACVoterManager } from "@/pages/l1/ACVoterManager";
import { ACFamilyManager } from "@/pages/l1/ACFamilyManager";
import { ACSurveyManager } from "@/pages/l1/ACSurveyManager";
import { ACReports } from "@/pages/l1/ACReports";
import L1AdvancedAnalytics from "@/pages/l1/AdvancedAnalytics";
import L0ActivityLogs from "@/pages/l0/ActivityLogs";
import L1ActivityLogs from "@/pages/l1/ActivityLogs";
import L2ActivityLogs from "@/pages/l2/ActivityLogs";
import { BoothManagement } from "@/pages/shared/BoothManagement";
import { BoothAgentManagement } from "@/pages/shared/BoothAgentManagement";
import BoothAgentRegistration from "@/pages/shared/BoothAgentRegistration";
import { L0Dashboard } from "@/pages/l0/Dashboard";
import { AdminManagement } from "@/pages/l0/AdminManagement";
import { AppSettings } from "@/pages/l0/AppSettings";
import { VoterData } from "@/pages/l0/VoterData";
import { SurveyBank } from "@/pages/l0/SurveyBank";
import { FormBuilder } from "@/pages/l0/FormBuilder";
import { SurveyForms } from "@/pages/l1/SurveyForms";
import { L2Dashboard } from "@/pages/l2/Dashboard";
import { VoterManager } from "@/pages/l2/VoterManager";
import { FamilyManager } from "@/pages/l2/FamilyManager";
import { SurveyManager } from "@/pages/l2/SurveyManager";
import { LiveBoothUpdates } from "@/pages/l2/LiveBoothUpdates";
import { Reports } from "@/pages/l2/Reports";
import { SurveyForms as L2SurveyForms } from "@/pages/l2/SurveyForms";
import { FormPreview } from "@/pages/shared/FormPreview";
import UserManagement from "@/pages/l0/UserManagement";
import { BoothAgentManagement as BoothAgentManagementNew } from "@/pages/shared/BoothAgentManagement";
import { WarRoom } from "@/pages/l9/WarRoom";
import GeographicIntelligence from "@/pages/l9/GeographicIntelligence";
import PredictiveAnalytics from "@/pages/l9/PredictiveAnalytics";
import MicroTargeting from "@/pages/l9/MicroTargeting";
import FinancialIntelligence from "@/pages/l9/FinancialIntelligence";
import DigitalAnalytics from "@/pages/l9/DigitalAnalytics";
import TeamManagement from "@/pages/l9/TeamManagement";
import OppositionIntelligence from "@/pages/l9/OppositionIntelligence";
import CommunicationAnalytics from "@/pages/l9/CommunicationAnalytics";
import ElectionDayOps from "@/pages/l9/ElectionDayOps";
import SurveyIntelligence from "@/pages/l9/SurveyIntelligence";
import SuccessMetrics from "@/pages/l9/SuccessMetrics";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) => {
  const { user, isAuthenticated } = useAuth();
  
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

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<RoleBasedRedirect />} />
      
      {/* L0 Routes */}
      <Route path="/l0/dashboard" element={<ProtectedRoute allowedRoles={['L0']}><L0Dashboard /></ProtectedRoute>} />
      <Route path="/l0/users" element={<ProtectedRoute allowedRoles={['L0']}><UserManagement /></ProtectedRoute>} />
      <Route path="/l0/admins" element={<ProtectedRoute allowedRoles={['L0']}><AdminManagement /></ProtectedRoute>} />
      <Route path="/l0/settings" element={<ProtectedRoute allowedRoles={['L0']}><AppSettings /></ProtectedRoute>} />
      <Route path="/l0/voters" element={<ProtectedRoute allowedRoles={['L0']}><VoterData /></ProtectedRoute>} />
      <Route path="/l0/surveys" element={<ProtectedRoute allowedRoles={['L0']}><SurveyBank /></ProtectedRoute>} />
      <Route path="/l0/surveys/builder/:formId" element={<ProtectedRoute allowedRoles={['L0']}><FormBuilder /></ProtectedRoute>} />
      <Route path="/l0/surveys/preview/:formId" element={<ProtectedRoute allowedRoles={['L0']}><FormPreview /></ProtectedRoute>} />
      <Route path="/l0/booths" element={<ProtectedRoute allowedRoles={['L0']}><BoothManagement /></ProtectedRoute>} />
      <Route path="/l0/booth-agents" element={<ProtectedRoute allowedRoles={['L0']}><BoothAgentManagement /></ProtectedRoute>} />
      <Route path="/l0/activity-logs" element={<ProtectedRoute allowedRoles={['L0']}><L0ActivityLogs /></ProtectedRoute>} />
      
      {/* Shared Routes (RBAC-enabled) */}
      <Route path="/shared/booth-agent-management" element={<ProtectedRoute allowedRoles={['L1', 'L2']}><BoothAgentManagementNew /></ProtectedRoute>} />
      <Route path="/shared/booth-agent-registration" element={<ProtectedRoute allowedRoles={['L0', 'L1']}><BoothAgentRegistration /></ProtectedRoute>} />
      
      {/* L1 Routes */}
      <Route path="/l1/constituencies" element={<ProtectedRoute allowedRoles={['L1']}><ConstituencySelector /></ProtectedRoute>} />
      <Route path="/l1/ac/:acNumber" element={<ProtectedRoute allowedRoles={['L1']}><ACDetailedDashboard /></ProtectedRoute>} />
      <Route path="/l1/ac/:acNumber/voters" element={<ProtectedRoute allowedRoles={['L1']}><ACVoterManager /></ProtectedRoute>} />
      <Route path="/l1/ac/:acNumber/families" element={<ProtectedRoute allowedRoles={['L1']}><ACFamilyManager /></ProtectedRoute>} />
      <Route path="/l1/ac/:acNumber/surveys" element={<ProtectedRoute allowedRoles={['L1']}><ACSurveyManager /></ProtectedRoute>} />
      <Route path="/l1/ac/:acNumber/reports" element={<ProtectedRoute allowedRoles={['L1']}><ACReports /></ProtectedRoute>} />
      <Route path="/l1/analytics" element={<ProtectedRoute allowedRoles={['L1']}><GlobalAnalytics /></ProtectedRoute>} />
      <Route path="/l1/ac-analytics" element={<ProtectedRoute allowedRoles={['L1']}><ACAnalyticsDashboard /></ProtectedRoute>} />
      <Route path="/l1/ac-comparison" element={<ProtectedRoute allowedRoles={['L1']}><ACComparison /></ProtectedRoute>} />
      <Route path="/l1/surveys" element={<ProtectedRoute allowedRoles={['L1']}><SurveyForms /></ProtectedRoute>} />
      <Route path="/l1/surveys/builder/:formId" element={<ProtectedRoute allowedRoles={['L1']}><FormBuilder /></ProtectedRoute>} />
      <Route path="/l1/surveys/preview/:formId" element={<ProtectedRoute allowedRoles={['L1']}><FormPreview /></ProtectedRoute>} />
      <Route path="/l1/survey-assignments" element={<ProtectedRoute allowedRoles={['L1']}><SurveyAssignments /></ProtectedRoute>} />
              <Route path="/l1/moderators" element={<ProtectedRoute allowedRoles={['L1']}><ModeratorManagement /></ProtectedRoute>} />
              <Route path="/l1/booths" element={<ProtectedRoute allowedRoles={['L1']}><BoothManagement /></ProtectedRoute>} />
              <Route path="/l1/booth-agents" element={<ProtectedRoute allowedRoles={['L1']}><BoothAgentManagement /></ProtectedRoute>} />
              <Route path="/l1/live-surveys" element={<ProtectedRoute allowedRoles={['L1']}><LiveSurveyMonitor /></ProtectedRoute>} />
              <Route path="/l1/advanced-analytics" element={<ProtectedRoute allowedRoles={['L1']}><L1AdvancedAnalytics /></ProtectedRoute>} />
              <Route path="/l1/activity-logs" element={<ProtectedRoute allowedRoles={['L1']}><L1ActivityLogs /></ProtectedRoute>} />
      
      {/* L2 Routes */}
      <Route path="/l2/dashboard" element={<ProtectedRoute allowedRoles={['L2']}><L2Dashboard /></ProtectedRoute>} />
      <Route path="/l2/voters" element={<ProtectedRoute allowedRoles={['L2']}><VoterManager /></ProtectedRoute>} />
      <Route path="/l2/families" element={<ProtectedRoute allowedRoles={['L2']}><FamilyManager /></ProtectedRoute>} />
      <Route path="/l2/survey-forms" element={<ProtectedRoute allowedRoles={['L2']}><L2SurveyForms /></ProtectedRoute>} />
      <Route path="/l2/surveys" element={<ProtectedRoute allowedRoles={['L2']}><SurveyManager /></ProtectedRoute>} />
      <Route path="/l2/surveys/builder/:formId" element={<ProtectedRoute allowedRoles={['L2']}><FormBuilder /></ProtectedRoute>} />
      <Route path="/l2/surveys/preview/:formId" element={<ProtectedRoute allowedRoles={['L2']}><FormPreview /></ProtectedRoute>} />
      <Route path="/l2/booths" element={<ProtectedRoute allowedRoles={['L2']}><BoothManagement /></ProtectedRoute>} />
      <Route path="/l2/booth-agents" element={<ProtectedRoute allowedRoles={['L2']}><BoothAgentManagement /></ProtectedRoute>} />
      <Route path="/l2/live-updates" element={<ProtectedRoute allowedRoles={['L2']}><LiveBoothUpdates /></ProtectedRoute>} />
      <Route path="/l2/reports" element={<ProtectedRoute allowedRoles={['L2']}><Reports /></ProtectedRoute>} />
      <Route path="/l2/activity-logs" element={<ProtectedRoute allowedRoles={['L2']}><L2ActivityLogs /></ProtectedRoute>} />
      
      {/* L9 War Room Routes */}
      <Route path="/l9/war-room" element={<ProtectedRoute allowedRoles={['L9']}><WarRoom /></ProtectedRoute>} />
      <Route path="/l9/geographic" element={<ProtectedRoute allowedRoles={['L9']}><GeographicIntelligence /></ProtectedRoute>} />
      <Route path="/l9/predictive" element={<ProtectedRoute allowedRoles={['L9']}><PredictiveAnalytics /></ProtectedRoute>} />
      <Route path="/l9/micro-targeting" element={<ProtectedRoute allowedRoles={['L9']}><MicroTargeting /></ProtectedRoute>} />
      <Route path="/l9/financial" element={<ProtectedRoute allowedRoles={['L9']}><FinancialIntelligence /></ProtectedRoute>} />
      <Route path="/l9/digital" element={<ProtectedRoute allowedRoles={['L9']}><DigitalAnalytics /></ProtectedRoute>} />
      <Route path="/l9/team" element={<ProtectedRoute allowedRoles={['L9']}><TeamManagement /></ProtectedRoute>} />
      <Route path="/l9/opposition" element={<ProtectedRoute allowedRoles={['L9']}><OppositionIntelligence /></ProtectedRoute>} />
      <Route path="/l9/communication" element={<ProtectedRoute allowedRoles={['L9']}><CommunicationAnalytics /></ProtectedRoute>} />
      <Route path="/l9/election-day" element={<ProtectedRoute allowedRoles={['L9']}><ElectionDayOps /></ProtectedRoute>} />
      <Route path="/l9/surveys" element={<ProtectedRoute allowedRoles={['L9']}><SurveyIntelligence /></ProtectedRoute>} />
      <Route path="/l9/success" element={<ProtectedRoute allowedRoles={['L9']}><SuccessMetrics /></ProtectedRoute>} />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
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
);

export default App;
