import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { ActivityLogProvider } from '@/contexts/ActivityLogContext';
import { NotificationCenter } from './NotificationCenter';
import { ThemeToggle } from './ThemeToggle';
import {
  LayoutDashboard,
  Users,
  Settings,
  BarChart3,
  UserCog,
  LogOut,
  Home,
  UserCircle,
  Activity,
  FileText,
  Grid3x3,
  GitCompare,
  TrendingUp,
  ScrollText,
  Menu,
  Map,
  Target,
  DollarSign,
  Share2,
  Shield,
  MessageSquare,
  Vote,
  Award,
  Database,
  ClipboardList,
  Layers,
  Smartphone,
} from 'lucide-react';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from './ui/sidebar';

interface DashboardLayoutProps {
  children: ReactNode;
}

const roleLabels = {
  L0: 'Super Admin',
  L1: 'ACIM Dashboard',
  L2: 'ACI Dashboard',
  L9: 'War Room Command',
};

const dashboardTitles = {
  L0: 'System Dashboard',
  L1: 'ACIM Dashboard',
  L2: 'ACI Dashboard',
  L9: 'War Room Command',
};

const AppSidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useSidebar();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getMenuItems = () => {
    switch (user?.role) {
      case 'L0':
        return [
          { icon: LayoutDashboard, label: 'System Dashboard', path: '/l0/dashboard' },
          { icon: Users, label: 'User Management', path: '/l0/users' },
          { icon: Users, label: 'Voter Data', path: '/l0/voters' },
          { icon: Database, label: 'Voter Field Manager', path: '/l0/voter-fields' },
          { icon: Layers, label: 'Master Data', path: '/l0/master-data' },
          { icon: FileText, label: 'Survey Forms', path: '/l0/surveys' },
          { icon: ClipboardList, label: 'Survey Responses', path: '/l0/survey-responses' },
          { icon: Smartphone, label: 'Mobile App Question', path: '/l0/mobile-app-questions' },
          { icon: Home, label: 'Booth Management', path: '/shared/booth-management' },
          { icon: UserCircle, label: 'Booth Agent Management', path: '/shared/booth-agent-management' },
          { icon: ScrollText, label: 'Activity Logs', path: '/l0/activity-logs' },
          { icon: Settings, label: 'Settings', path: '/l0/settings' },
        ];
      case 'L1':
        return [
          { icon: Home, label: 'Constituencies', path: '/l1/constituencies' },
          { icon: BarChart3, label: 'Analytics Dashboard', path: '/l1/analytics' },
          { icon: Grid3x3, label: 'AC Analytics Dashboard', path: '/l1/ac-analytics' },
          { icon: GitCompare, label: 'AC Comparison', path: '/l1/ac-comparison' },
          { icon: TrendingUp, label: 'Advanced Analytics', path: '/l1/advanced-analytics' },
          { icon: FileText, label: 'Survey Forms', path: '/l1/surveys' },
          { icon: FileText, label: 'Survey Form Assignments', path: '/l1/survey-assignments' },
          { icon: UserCog, label: 'Moderator Management', path: '/l1/moderators' },
          { icon: Home, label: 'Booth Management', path: '/shared/booth-management' },
          { icon: UserCircle, label: 'Booth Agent Management', path: '/shared/booth-agent-management' },
          { icon: Activity, label: 'Live Survey Monitor', path: '/l1/live-surveys' },
          { icon: ScrollText, label: 'Activity Logs', path: '/l1/activity-logs' },
        ];
      case 'L2':
        return [
          { icon: LayoutDashboard, label: 'My Dashboard', path: '/l2/dashboard' },
          { icon: Users, label: 'Voter Manager', path: '/l2/voters' },
          { icon: Home, label: 'Family Manager', path: '/l2/families' },
          { icon: FileText, label: 'Survey Forms', path: '/l2/survey-forms' },
          { icon: FileText, label: 'Survey Manager', path: '/l2/surveys' },
          { icon: Home, label: 'Booth Management', path: '/shared/booth-management' },
          { icon: UserCircle, label: 'Booth Agent Management', path: '/shared/booth-agent-management' },
          { icon: Activity, label: 'Live Booth Updates', path: '/l2/live-updates' },
          { icon: ScrollText, label: 'Activity Logs', path: '/l2/activity-logs' },
        ];
      case 'L9':
        return [
          { icon: LayoutDashboard, label: 'War Room Overview', path: '/l9/war-room' },
          { icon: Map, label: 'Geographic Intelligence', path: '/l9/geographic' },
          { icon: TrendingUp, label: 'Predictive Analytics', path: '/l9/predictive' },
          { icon: Target, label: 'Micro-Targeting', path: '/l9/micro-targeting' },
          { icon: DollarSign, label: 'Financial Intelligence', path: '/l9/financial' },
          { icon: Share2, label: 'Digital Analytics', path: '/l9/digital' },
          { icon: Users, label: 'Team Management', path: '/l9/team' },
          { icon: Shield, label: 'Opposition Intelligence', path: '/l9/opposition' },
          { icon: MessageSquare, label: 'Communication Analytics', path: '/l9/communication' },
          { icon: Vote, label: 'Election Day Ops', path: '/l9/election-day' },
          { icon: FileText, label: 'Survey Intelligence', path: '/l9/surveys' },
          { icon: Award, label: 'Success Metrics', path: '/l9/success' },
        ];
      default:
        return [];
    }
  };

  const menuItems = getMenuItems();
  const isCollapsed = state === 'collapsed';

  if (!user) return null;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex items-center justify-between p-4">
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-primary truncate">
                {dashboardTitles[user?.role as keyof typeof dashboardTitles] || 'Dashboard'}
              </h1>
              <p className="text-xs text-muted-foreground mt-1 truncate">Management System</p>
            </div>
          )}
          {isCollapsed && (
            <div className="flex justify-center w-full">
              <div className="bg-primary rounded-md p-1.5">
                <Home className="h-5 w-5 text-primary-foreground" />
              </div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu className="px-2 py-4">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  onClick={() => navigate(item.path)}
                  isActive={isActive}
                  tooltip={item.label}
                  className="transition-all duration-200 ease-in-out"
                >
                  <item.icon className="h-5 w-5 sidebar-icon" />
                  <span className="truncate">{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <div className="p-4 space-y-3">
          {/* Always show user info and logout button with proper responsive handling */}
          <div className={`p-3 bg-accent rounded-lg sidebar-user-info ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
            {!isCollapsed ? (
              <>
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{roleLabels[user?.role || 'L0']}</p>
                {user?.aciName && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">{user.aciName}</p>
                )}
                {user?.assignedAC && (
                  <p className="text-xs text-muted-foreground truncate">
                    AC {user.assignedAC}
                  </p>
                )}
              </>
            ) : (
              // Show compact user info when sidebar is collapsed
              <div className="flex flex-col items-center justify-center w-full">
                <UserCircle className="h-5 w-5 mb-1 sidebar-icon flex-shrink-0" />
                <span className="text-xs text-muted-foreground text-center truncate w-full">{user?.name?.charAt(0)}</span>
              </div>
            )}
          </div>
          
          {/* Logout button with consistent icon sizing and responsive text */}
          <SidebarMenuButton 
            onClick={handleLogout} 
            tooltip={!isCollapsed ? "Logout" : undefined}
            className={`transition-all duration-200 ease-in-out logout-button ${isCollapsed ? 'justify-center h-10' : ''}`}
          >
            <LogOut className={`h-5 w-5 ${!isCollapsed ? 'mr-2 sidebar-icon' : 'sidebar-icon'} flex-shrink-0`} />
            {!isCollapsed && <span>Logout</span>}
          </SidebarMenuButton>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <NotificationProvider userId={user.id} userRole={user.role}>
      <ActivityLogProvider>
        <SidebarProvider defaultOpen={true}>
          <div className="flex min-h-screen w-full bg-background">
            <AppSidebar />
            <main className="flex-1 flex flex-col overflow-hidden">
              {/* Header with hamburger and notifications */}
              <header className="h-14 border-b bg-card flex items-center justify-between px-4 sticky top-0 z-10">
                <SidebarTrigger className="hover:bg-accent rounded-md p-1.5 h-8 w-8 flex items-center justify-center">
                  <Menu className="h-5 w-5" />
                </SidebarTrigger>
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <NotificationCenter />
                </div>
              </header>
              {/* Main content area */}
              <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
                {children}
              </div>
            </main>
          </div>
        </SidebarProvider>
      </ActivityLogProvider>
    </NotificationProvider>
  );
};
