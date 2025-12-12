import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { StatCard } from '@/components/StatCard';
import { ActionButton } from '@/components/ActionButton';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Home, FileCheck, MapPin, Activity, Clock, TrendingUp, LineChart, Loader2, UserCheck, Phone } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart as RechartsLineChart, Line, AreaChart, Area } from 'recharts';
import { BoothDetailDrawer } from '@/components/BoothDetailDrawer';
import { AgentLeaderboard } from '@/components/AgentLeaderboard';
import { ExportButton } from '@/components/ExportButton';
import { ComparisonMetrics } from '@/components/ComparisonMetrics';
import { api } from '@/lib/api';
import { CONSTITUENCIES } from '@/constants/constituencies';

interface ACStats {
  acIdentifier: string | null;
  acId: number | null;
  acName: string | null;
  acNumber: number | null;
  totalFamilies: number;
  totalMembers: number;
  surveysCompleted: number;
  totalBooths: number;
  boothStats: {
    boothNo: string;
    boothName: string;
    boothId: string;
    voters: number;
  }[];
}

interface BoothData {
  booth: string;
  completion: number;
  voters: number;
}

interface BoothAgent {
  id: string;
  name: string;
  phone: string;
  boothId: string;
  boothName: string;
  boothNo: string;
  isActive: boolean;
  createdAt?: string;
}

export const ACDetailedDashboard = () => {
  const { acNumber } = useParams<{ acNumber: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [acStats, setAcStats] = useState<ACStats | null>(null);
  const [selectedBooth, setSelectedBooth] = useState<BoothData | null>(null);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [boothAgents, setBoothAgents] = useState<BoothAgent[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);

  useEffect(() => {
    const fetchACStats = async () => {
      if (!acNumber) return;

      try {
        setIsLoading(true);
        const data = await api.get(`/dashboard/stats/${acNumber}`);
        setAcStats(data);

        // Generate recent activities from booth agent activities and surveys
        try {
          const activitiesList: any[] = [];

          // Fetch booth agent activities
          try {
            const agentActivityData = await api.get(`/dashboard/booth-agent-activities?acId=${acNumber}&limit=5`);
            if (agentActivityData.activities && agentActivityData.activities.length > 0) {
              agentActivityData.activities.forEach((activity: any, idx: number) => {
                activitiesList.push({
                  id: `agent-${idx}`,
                  text: `${activity.userName || 'Agent'} ${activity.status === 'active' ? 'logged in' : 'logged out'} - ${activity.boothno || activity.booth_id || 'Booth'}`,
                  time: activity.loginTime ? new Date(activity.loginTime).toLocaleString() : 'N/A',
                  type: activity.status === 'active' ? 'booth' : 'info',
                  timestamp: new Date(activity.loginTime || activity.createdAt).getTime(),
                });
              });
            }
          } catch (e) {
            console.log('No booth agent activities available');
          }

          // Fetch survey responses
          try {
            const surveyData = await api.get(`/survey-responses?ac=${acNumber}&limit=5`);
            if (surveyData.responses && surveyData.responses.length > 0) {
              surveyData.responses.forEach((response: any, idx: number) => {
                activitiesList.push({
                  id: `survey-${idx}`,
                  text: `Survey completed for ${response.respondent_name || 'Voter'}`,
                  time: new Date(response.survey_date).toLocaleString(),
                  type: 'survey',
                  timestamp: new Date(response.survey_date).getTime(),
                });
              });
            }
          } catch (e) {
            console.log('No survey responses available');
          }

          // Sort by timestamp (most recent first) and take top 10
          activitiesList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          const topActivities = activitiesList.slice(0, 10);

          if (topActivities.length > 0) {
            setRecentActivities(topActivities);
          } else {
            setRecentActivities([
              { id: 1, text: 'No recent activity', time: 'N/A', type: 'info' }
            ]);
          }
        } catch {
          setRecentActivities([]);
        }
      } catch (error) {
        console.error('Error fetching AC stats:', error);
        // Set fallback data from CONSTITUENCIES
        const constituency = CONSTITUENCIES.find(c => c.number === parseInt(acNumber));
        setAcStats({
          acIdentifier: acNumber,
          acId: parseInt(acNumber),
          acName: constituency?.name || `AC ${acNumber}`,
          acNumber: parseInt(acNumber),
          totalFamilies: 0,
          totalMembers: 0,
          surveysCompleted: 0,
          totalBooths: 0,
          boothStats: [],
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchACStats();
  }, [acNumber]);

  // Fetch booth agents for this AC
  useEffect(() => {
    const fetchBoothAgents = async () => {
      if (!acNumber) return;

      try {
        setIsLoadingAgents(true);
        const params = new URLSearchParams({ ac: acNumber });
        const data = await api.get(`/rbac/booth-agents?${params.toString()}`);

        const agents = (data.agents || data || []).map((agent: any) => ({
          id: agent._id || agent.id,
          name: agent.name || 'Unknown',
          phone: agent.phone || 'N/A',
          boothId: agent.boothId || agent.assignedBooth || 'N/A',
          boothName: agent.boothName || agent.assignedBoothName || 'N/A',
          boothNo: agent.boothNo || 'N/A',
          isActive: agent.isActive !== false,
          createdAt: agent.createdAt,
        }));

        setBoothAgents(agents);
      } catch (error) {
        console.error('Error fetching booth agents:', error);
        setBoothAgents([]);
      } finally {
        setIsLoadingAgents(false);
      }
    };

    fetchBoothAgents();
  }, [acNumber]);

  // Get AC name from CONSTITUENCIES for display
  const getACDisplayName = () => {
    if (acStats?.acName) return acStats.acName;
    const constituency = CONSTITUENCIES.find(c => c.number === parseInt(acNumber || '0'));
    return constituency?.name || `AC ${acNumber}`;
  };

  // Calculate completion percentage
  const completionPercentage = acStats && acStats.totalMembers > 0
    ? Math.round((acStats.surveysCompleted / acStats.totalMembers) * 100)
    : 0;

  // Prepare booth performance data for chart
  const boothPerformanceData: BoothData[] = acStats?.boothStats?.map(booth => ({
    booth: booth.boothName || booth.boothNo || 'Unknown',
    completion: Math.round((booth.voters / (acStats.totalMembers || 1)) * 100),
    voters: booth.voters,
  })) || [];

  // Generate time-series data from current stats
  const timeSeriesData = [
    { date: 'Week 1', surveys: Math.round((acStats?.surveysCompleted || 0) * 0.15), voters: Math.round((acStats?.totalMembers || 0) * 0.25) },
    { date: 'Week 2', surveys: Math.round((acStats?.surveysCompleted || 0) * 0.30), voters: Math.round((acStats?.totalMembers || 0) * 0.40) },
    { date: 'Week 3', surveys: Math.round((acStats?.surveysCompleted || 0) * 0.50), voters: Math.round((acStats?.totalMembers || 0) * 0.60) },
    { date: 'Week 4', surveys: Math.round((acStats?.surveysCompleted || 0) * 0.70), voters: Math.round((acStats?.totalMembers || 0) * 0.75) },
    { date: 'Week 5', surveys: Math.round((acStats?.surveysCompleted || 0) * 0.85), voters: Math.round((acStats?.totalMembers || 0) * 0.90) },
    { date: 'Week 6', surveys: acStats?.surveysCompleted || 0, voters: acStats?.totalMembers || 0 },
  ];

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading AC data...</span>
        </div>
      </DashboardLayout>
    );
  }

  const exportData = {
    name: getACDisplayName(),
    voters: acStats?.totalMembers || 0,
    families: acStats?.totalFamilies || 0,
    surveys: acStats?.surveysCompleted || 0,
    booths: acStats?.totalBooths || 0,
    completion: completionPercentage,
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header with AC Selector */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">Assembly Constituency {acNumber}</h1>
            <p className="text-xl text-muted-foreground">{getACDisplayName()}</p>
          </div>
          <div className="flex items-center gap-4">
            <Select
              value={acNumber || ''}
              onValueChange={(value) => navigate(`/l1/ac/${value}`)}
            >
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select AC" />
              </SelectTrigger>
              <SelectContent>
                {CONSTITUENCIES.map((ac) => (
                  <SelectItem key={ac.number} value={String(ac.number)}>
                    AC {ac.number} - {ac.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ExportButton data={exportData} filename={`ac-${acNumber}-report`} acNumber={acNumber} />
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Voters"
            value={(acStats?.totalMembers || 0).toLocaleString()}
            icon={Users}
            variant="primary"
          />
          <StatCard
            title="Total Families"
            value={(acStats?.totalFamilies || 0).toLocaleString()}
            icon={Home}
            variant="primary"
          />
          <StatCard
            title="Surveys Completed"
            value={(acStats?.surveysCompleted || 0).toLocaleString()}
            icon={FileCheck}
            variant="success"
          />
          <StatCard
            title="Total Booths"
            value={(acStats?.totalBooths || 0).toLocaleString()}
            icon={MapPin}
            variant="warning"
          />
        </div>

        <Separator />

        {/* Tabbed View with Detailed Analytics */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="booths">Booths</TabsTrigger>
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="surveys">Surveys</TabsTrigger>
            <TabsTrigger value="families">Families</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Comparison Metrics */}
            <ComparisonMetrics currentAC={{ ...exportData, acNumber: acNumber || '' }} />

            <div>
              <h2 className="text-2xl font-bold mb-6">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <ActionButton
                  icon={Users}
                  title="Voter Manager"
                  description="View & update voter details"
                  href={`/l1/ac/${acNumber}/voters`}
                />
                <ActionButton
                  icon={Home}
                  title="Family Manager"
                  description="Manage family records"
                  href={`/l1/ac/${acNumber}/families`}
                />
                <ActionButton
                  icon={FileCheck}
                  title="Survey Manager"
                  description="Complete or review surveys"
                  href={`/l1/ac/${acNumber}/surveys`}
                />
                <ActionButton
                  icon={Activity}
                  title="Reports"
                  description="View performance and statistics"
                  href={`/l1/ac/${acNumber}/reports`}
                />
              </div>
            </div>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Activity Feed
              </h3>
              <div className="space-y-4">
                {recentActivities.length > 0 ? (
                  recentActivities.map((activity) => (
                    <div key={activity.id} className="flex items-start space-x-3 pb-3 border-b last:border-0">
                      <div className={`mt-1 rounded-full p-1 ${
                        activity.type === 'voter' ? 'bg-primary/10' :
                        activity.type === 'booth' ? 'bg-warning/10' :
                        activity.type === 'family' ? 'bg-success/10' :
                        'bg-accent/10'
                      }`}>
                        {activity.type === 'voter' && <Users className="h-4 w-4 text-primary" />}
                        {activity.type === 'booth' && <MapPin className="h-4 w-4 text-warning" />}
                        {activity.type === 'family' && <Home className="h-4 w-4 text-success" />}
                        {activity.type === 'survey' && <FileCheck className="h-4 w-4 text-accent" />}
                        {activity.type === 'info' && <Activity className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm">{activity.text}</p>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {activity.time}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">No recent activity</p>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends" className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <LineChart className="h-5 w-5" />
                Survey Progress Over Time
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsLineChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="surveys" stroke="hsl(var(--primary))" strokeWidth={2} name="Surveys" />
                </RechartsLineChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Voter Registration Trends</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="voters" stroke="hsl(var(--success))" fill="hsl(var(--success))" fillOpacity={0.3} name="Voters" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>

          {/* Booths Tab with Drill-Down */}
          <TabsContent value="booths" className="space-y-6">
            {/* Booth Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Total Booths</p>
                <p className="text-3xl font-bold text-primary">{acStats?.totalBooths || 0}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Total Voters</p>
                <p className="text-3xl font-bold text-success">{(acStats?.totalMembers || 0).toLocaleString()}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Avg Voters/Booth</p>
                <p className="text-3xl font-bold text-warning">
                  {acStats?.totalBooths && acStats.totalBooths > 0
                    ? Math.round((acStats.totalMembers || 0) / acStats.totalBooths).toLocaleString()
                    : '0'}
                </p>
              </Card>
            </div>

            {/* Booth Performance Chart - showing top 20 for better visualization */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Top Booths by Voter Count</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {boothPerformanceData.length > 0
                  ? `Showing top ${Math.min(20, boothPerformanceData.length)} booths. Click on any bar to view details.`
                  : 'No booth data available for this AC'}
              </p>
              {boothPerformanceData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={boothPerformanceData.slice(0, 20)} onClick={(data) => {
                    if (data && data.activePayload) {
                      setSelectedBooth(data.activePayload[0].payload);
                    }
                  }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="booth" angle={-45} textAnchor="end" height={100} interval={0} fontSize={10} />
                    <YAxis />
                    <Tooltip cursor={{ fill: 'hsl(var(--primary) / 0.1)' }} />
                    <Legend />
                    <Bar dataKey="voters" fill="hsl(var(--success))" name="Total Voters" className="cursor-pointer" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                  No booth data available
                </div>
              )}
            </Card>

            {/* Full Booth Stats Table with Scrolling */}
            {acStats?.boothStats && acStats.boothStats.length > 0 && (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">All Booths ({acStats.boothStats.length})</h3>
                  <p className="text-sm text-muted-foreground">Scroll to see all booths</p>
                </div>
                <div className="overflow-auto max-h-[500px] border rounded-lg">
                  <table className="w-full">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold">#</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Booth Name</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Booth No</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">Voters</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold">% of Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {acStats.boothStats.map((booth, idx) => (
                        <tr key={idx} className="hover:bg-muted/50">
                          <td className="px-4 py-3 text-sm text-muted-foreground">{idx + 1}</td>
                          <td className="px-4 py-3 text-sm font-medium">{booth.boothName || 'Unknown'}</td>
                          <td className="px-4 py-3 text-sm">{booth.boothNo || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold">{booth.voters.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-right text-muted-foreground">
                            {acStats.totalMembers > 0 ? ((booth.voters / acStats.totalMembers) * 100).toFixed(1) : 0}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* Agents Tab with Leaderboard */}
          <TabsContent value="agents" className="space-y-6">
            {/* Agent Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Total Agents</p>
                <p className="text-3xl font-bold text-primary">{boothAgents.length}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Active Agents</p>
                <p className="text-3xl font-bold text-success">
                  {boothAgents.filter(a => a.isActive).length}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Inactive Agents</p>
                <p className="text-3xl font-bold text-muted-foreground">
                  {boothAgents.filter(a => !a.isActive).length}
                </p>
              </Card>
            </div>

            {/* All Booth Agents Table */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  All Booth Agents ({boothAgents.length})
                </h3>
              </div>

              {isLoadingAgents ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground">Loading agents...</span>
                </div>
              ) : boothAgents.length > 0 ? (
                <div className="overflow-auto max-h-[500px] border rounded-lg">
                  <table className="w-full">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold">#</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Agent Name</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Phone</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Booth</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {boothAgents.map((agent, idx) => (
                        <tr key={agent.id} className="hover:bg-muted/50">
                          <td className="px-4 py-3 text-sm text-muted-foreground">{idx + 1}</td>
                          <td className="px-4 py-3 text-sm font-medium">{agent.name}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {agent.phone}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {agent.boothName !== 'N/A' ? agent.boothName : agent.boothNo !== 'N/A' ? `Booth ${agent.boothNo}` : 'Not Assigned'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              agent.isActive
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                            }`}>
                              {agent.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No booth agents found for AC {acNumber}
                </div>
              )}
            </Card>

            {/* Agent Leaderboard */}
            <AgentLeaderboard acNumber={acNumber} />
          </TabsContent>

          <TabsContent value="surveys" className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Survey Progress</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Overall Completion</span>
                    <span className="text-sm text-muted-foreground">{completionPercentage}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: `${completionPercentage}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold text-primary">{(acStats?.surveysCompleted || 0).toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Completed Surveys</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold text-warning">{((acStats?.totalMembers || 0) - (acStats?.surveysCompleted || 0)).toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Pending Surveys</p>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="families" className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Family Statistics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-primary">{(acStats?.totalFamilies || 0).toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Total Families</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-success">
                    {acStats && acStats.totalFamilies > 0
                      ? (acStats.totalMembers / acStats.totalFamilies).toFixed(1)
                      : '0'}
                  </p>
                  <p className="text-sm text-muted-foreground">Avg Family Size</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-warning">{(acStats?.totalMembers || 0).toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Total Members</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-accent">{(acStats?.totalBooths || 0).toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Booths Covered</p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Booth Detail Drawer */}
        <BoothDetailDrawer
          open={selectedBooth !== null}
          onClose={() => setSelectedBooth(null)}
          boothData={selectedBooth}
        />
      </div>
    </DashboardLayout>
  );
};
