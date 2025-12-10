import { DashboardLayout } from '@/components/DashboardLayout';
import { StatCard } from '@/components/StatCard';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, UserCircle, Shield, CheckCircle, TrendingUp, TrendingDown, Calendar as CalendarIcon, Filter, Activity, Home, FileCheck, Layers, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface ACPerformance {
  ac: string;
  acNumber: number;
  voters: number;
  completion: number;
  admins: number;
  moderators: number;
  agents: number;
  surveyedMembers?: number;
}

interface DashboardStats {
  totalL1Admins: number;
  totalL2Moderators: number;
  totalL3Agents: number;
  totalVoters: number;
  acPerformance: ACPerformance[];
  systemGrowthData: Array<{ month: string; voters: number; surveys: number; agents: number }>;
  surveyDistribution: Array<{ category: string; completed: number; pending: number }>;
  adminActivityData: Array<{ day: string; l1: number; l2: number; l3: number }>;
  highestVoterAC: { ac: string; voters: number; completion: number } | null;
  bestCompletionAC: { ac: string; completion: number; surveys: number } | null;
  needsAttentionAC: { ac: string; completion: number; surveys: number } | null;
  trendSummary: {
    avgDailyLogins?: number | null;
    peakHourActivity?: string | null;
    formsCreatedLast30Days?: number | null;
    boothsActive?: number | null;
    boothsTotal?: number | null;
  } | null;
}

export const L0Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<Date | undefined>(new Date());
  const [acFilter, setAcFilter] = useState<string>('all');
  const [isLive, setIsLive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalL1Admins: 0,
    totalL2Moderators: 0,
    totalL3Agents: 0,
    totalVoters: 0,
    acPerformance: [],
    systemGrowthData: [],
    surveyDistribution: [],
    adminActivityData: [],
    highestVoterAC: null,
    bestCompletionAC: null,
    needsAttentionAC: null,
    trendSummary: null,
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [overviewResponse, dashboardStats] = await Promise.all([
        api.get('/rbac/dashboard/ac-overview'),
        api.get('/rbac/dashboard/stats').catch(() => ({ stats: {} })),
      ]);

      const acPerformance: ACPerformance[] = (overviewResponse?.acPerformance || []).map((ac: any) => ({
        ac: ac.ac || `AC ${ac.acNumber ?? ''}`,
        acNumber: ac.acNumber ?? 0,
        voters: ac.voters ?? 0,
        completion: ac.completion ?? 0,
        admins: ac.admins ?? 0,
        moderators: ac.moderators ?? 0,
        agents: ac.agents ?? 0,
        surveyedMembers: ac.surveyedMembers ?? 0,
      }));

      const totals = overviewResponse?.totals || {};
      const totalL1Admins = totals.totalL1Admins ?? 0;
      const totalL2Moderators = totals.totalL2Moderators ?? 0;
      const totalL3Agents = totals.totalL3Agents ?? 0;
      
      // Calculate total voters
      const totalVoters = totals.totalVoters ?? acPerformance.reduce((sum, ac) => sum + ac.voters, 0);

      // Find highest voter AC, best completion AC, and needs attention AC
      const highestVoterAC = acPerformance.length > 0
        ? acPerformance.reduce((max, ac) => ac.voters > max.voters ? ac : max)
        : null;

      const bestCompletionAC = acPerformance.length > 0
        ? acPerformance.reduce((max, ac) => ac.completion > max.completion ? ac : max)
        : null;

      const needsAttentionAC = acPerformance.length > 0
        ? acPerformance.filter(ac => ac.completion > 0).reduce((min, ac) => 
            ac.completion < min.completion ? ac : min,
            acPerformance.filter(ac => ac.completion > 0)[0] || acPerformance[0]
          )
        : null;

      const statsPayload = dashboardStats?.stats ?? dashboardStats ?? {};
      const systemGrowthData = Array.isArray(statsPayload.systemGrowthData) ? statsPayload.systemGrowthData : [];
      const surveyDistribution = Array.isArray(statsPayload.surveyDistribution) ? statsPayload.surveyDistribution : [];
      const adminActivityData = Array.isArray(statsPayload.adminActivityData) ? statsPayload.adminActivityData : [];
      const trendSummaryData = statsPayload && typeof statsPayload.trendSummary === 'object'
        ? {
            avgDailyLogins: statsPayload.trendSummary?.avgDailyLogins ?? null,
            peakHourActivity: statsPayload.trendSummary?.peakHourActivity ?? null,
            formsCreatedLast30Days: statsPayload.trendSummary?.formsCreatedLast30Days ?? null,
            boothsActive: statsPayload.trendSummary?.boothsActive ?? null,
            boothsTotal: statsPayload.trendSummary?.boothsTotal ?? null,
          }
        : null;

      setStats({
        totalL1Admins,
        totalL2Moderators,
        totalL3Agents,
        totalVoters,
        acPerformance,
        systemGrowthData,
        surveyDistribution,
        adminActivityData,
        highestVoterAC: highestVoterAC ? {
          ac: highestVoterAC.ac,
          voters: highestVoterAC.voters,
          completion: highestVoterAC.completion,
        } : null,
        bestCompletionAC: bestCompletionAC ? {
          ac: bestCompletionAC.ac,
          completion: bestCompletionAC.completion,
          surveys: Math.round((bestCompletionAC.voters * bestCompletionAC.completion) / 100),
        } : null,
        needsAttentionAC: needsAttentionAC ? {
          ac: needsAttentionAC.ac,
          completion: needsAttentionAC.completion,
          surveys: Math.round((needsAttentionAC.voters * needsAttentionAC.completion) / 100),
        } : null,
        trendSummary: trendSummaryData,
      });
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load dashboard data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const hasTrendSummaryData = !!stats.trendSummary && Object.values(stats.trendSummary).some((value) => value !== null && value !== undefined && value !== '');
  const formatNumberValue = (value?: number | null) =>
    typeof value === 'number' ? value.toLocaleString() : '—';
  const hasHighlightInsights =
    (stats.highestVoterAC && stats.highestVoterAC.voters > 0) ||
    (stats.bestCompletionAC && stats.bestCompletionAC.completion > 0) ||
    (stats.needsAttentionAC && stats.needsAttentionAC.completion > 0);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading dashboard data...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
              System Dashboard
              <span className={cn(
                "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium",
                isLive ? "bg-success/10 text-success animate-pulse" : "bg-muted text-muted-foreground"
              )}>
                <Activity className="h-3 w-3" />
                {isLive ? 'Live' : 'Offline'}
              </span>
            </h1>
            <p className="text-muted-foreground">High-level overview across all 26 Assembly Constituencies</p>
          </div>
          <div className="flex gap-3">
            <Button 
              onClick={() => navigate('/l0/users?create=L1')}
              className="gap-2"
            >
              <UserCircle className="h-4 w-4" />
              Create L1 User
            </Button>
            <Button 
              onClick={() => navigate('/l0/users?create=L2')}
              variant="outline"
              className="gap-2"
            >
              <UserCircle className="h-4 w-4" />
              Create L2 User
            </Button>
            <Button 
              onClick={() => navigate('/l0/master-data')}
              variant="secondary"
              className="gap-2"
            >
              <Layers className="h-4 w-4" />
              Master Data
            </Button>
          </div>
        </div>

        {/* Smart Filters */}
        <Card className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {dateRange ? format(dateRange, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dateRange}
                  onSelect={setDateRange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Select value={acFilter} onValueChange={setAcFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by AC" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ACs</SelectItem>
                <SelectItem value="high">High Performance</SelectItem>
                <SelectItem value="medium">Medium Performance</SelectItem>
                <SelectItem value="low">Low Performance</SelectItem>
              </SelectContent>
            </Select>

            {acFilter !== 'all' && (
              <Button variant="ghost" size="sm" onClick={() => setAcFilter('all')}>
                Clear Filters
              </Button>
            )}
          </div>
        </Card>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Total L1 Admins" value={stats.totalL1Admins.toLocaleString()} icon={Shield} variant="primary" subtitle="ACIM Dashboard Users" />
          <StatCard title="Total L2 Moderators" value={stats.totalL2Moderators.toLocaleString()} icon={UserCircle} variant="primary" subtitle="ACI Dashboard Users" />
          <StatCard title="Total L3 Booth Agents" value={stats.totalL3Agents.toLocaleString()} icon={Users} variant="success" subtitle="Active Field Agents" />
          <StatCard title="Total Voters (All ACs)" value={stats.totalVoters.toLocaleString()} icon={CheckCircle} variant="default" subtitle="Registered Voters" />
        </div>

        {/* Analytics Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="trends">Growth Trends</TabsTrigger>
            <TabsTrigger value="performance">AC Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">System Growth (5 Months)</h3>
                {stats.systemGrowthData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={stats.systemGrowthData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="voters" stroke="hsl(var(--primary))" strokeWidth={2} name="Voters" />
                      <Line type="monotone" dataKey="surveys" stroke="hsl(var(--success))" strokeWidth={2} name="Surveys" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                    No valid data available.
                  </div>
                )}
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Survey Distribution (Weekly)</h3>
                {stats.surveyDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.surveyDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="completed" fill="hsl(var(--success))" name="Completed" />
                      <Bar dataKey="pending" fill="hsl(var(--warning))" name="Pending" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                    No valid data available.
                  </div>
                )}
              </Card>
            </div>

            {hasHighlightInsights ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <TrendingUp className="mr-2 h-5 w-5 text-success" />
                    Highest Voter AC
                  </h3>
                  <div className="space-y-2">
                    {stats.highestVoterAC && stats.highestVoterAC.voters > 0 ? (
                      <>
                        <p className="text-2xl font-bold text-primary">{stats.highestVoterAC.ac}</p>
                        <p className="text-sm text-muted-foreground">{stats.highestVoterAC.voters.toLocaleString()} voters</p>
                        <p className="text-sm text-muted-foreground">{stats.highestVoterAC.completion.toFixed(1)}% completion</p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No data available</p>
                    )}
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <FileCheck className="mr-2 h-5 w-5 text-success" />
                    Best Completion Rate
                  </h3>
                  <div className="space-y-2">
                    {stats.bestCompletionAC && stats.bestCompletionAC.completion > 0 ? (
                      <>
                        <p className="text-2xl font-bold text-primary">{stats.bestCompletionAC.ac}</p>
                        <p className="text-sm text-muted-foreground">{stats.bestCompletionAC.completion.toFixed(1)}% completion</p>
                        <p className="text-sm text-muted-foreground">{stats.bestCompletionAC.surveys.toLocaleString()} surveys</p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No data available</p>
                    )}
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <TrendingDown className="mr-2 h-5 w-5 text-destructive" />
                    Needs Attention
                  </h3>
                  <div className="space-y-2">
                    {stats.needsAttentionAC && stats.needsAttentionAC.completion > 0 ? (
                      <>
                        <p className="text-2xl font-bold text-primary">{stats.needsAttentionAC.ac}</p>
                        <p className="text-sm text-muted-foreground">{stats.needsAttentionAC.completion.toFixed(1)}% completion</p>
                        <p className="text-sm text-muted-foreground">{stats.needsAttentionAC.surveys.toLocaleString()} surveys</p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No data available</p>
                    )}
                  </div>
                </Card>
              </div>
            ) : (
              <Card className="p-6 text-center text-muted-foreground">
                No valid data available.
              </Card>
            )}
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Admin Activity by Level (7 Days)</h3>
              {stats.adminActivityData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={stats.adminActivityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="l1" stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.6} name="L1 Admins" />
                    <Area type="monotone" dataKey="l2" stackId="1" stroke="hsl(var(--success))" fill="hsl(var(--success))" fillOpacity={0.6} name="L2 Moderators" />
                    <Area type="monotone" dataKey="l3" stackId="1" stroke="hsl(var(--warning))" fill="hsl(var(--warning))" fillOpacity={0.6} name="L3 Agents" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[400px] items-center justify-center text-sm text-muted-foreground">
                  No valid data available.
                </div>
              )}
            </Card>

            {hasTrendSummaryData ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                  title="Avg Daily Logins"
                  value={formatNumberValue(stats.trendSummary?.avgDailyLogins)}
                  icon={Activity}
                  variant="default"
                  subtitle="Across all users"
                />
                <StatCard
                  title="Peak Hour Activity"
                  value={stats.trendSummary?.peakHourActivity || '—'}
                  icon={Activity}
                  variant="primary"
                  subtitle="Highest traffic"
                />
                <StatCard
                  title="Forms Created"
                  value={formatNumberValue(stats.trendSummary?.formsCreatedLast30Days)}
                  icon={FileCheck}
                  variant="success"
                  subtitle="Last 30 days"
                />
                <StatCard
                  title="Booths Active"
                  value={formatNumberValue(stats.trendSummary?.boothsActive)}
                  icon={Home}
                  variant="warning"
                  subtitle={
                    stats.trendSummary?.boothsTotal
                      ? `Out of ${stats.trendSummary.boothsTotal.toLocaleString()} total`
                      : 'Booth coverage unavailable'
                  }
                />
              </div>
            ) : (
              <Card className="p-6 text-center text-muted-foreground">
                No valid data available.
              </Card>
            )}
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">Assembly Constituency Performance</h2>
                  <p className="text-sm text-muted-foreground">
                    {stats.acPerformance.length} constituencies • {stats.totalVoters.toLocaleString()} total voters
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  Showing {stats.acPerformance.filter(row => {
                    if (acFilter === 'all') return true;
                    if (acFilter === 'high') return row.completion > 15;
                    if (acFilter === 'medium') return row.completion >= 10 && row.completion <= 15;
                    if (acFilter === 'low') return row.completion < 10;
                    return true;
                  }).length} of {stats.acPerformance.length} ACs
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold">AC</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">Voters</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">Surveyed</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Completion</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">L1</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">L2</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">Agents</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {stats.acPerformance
                      .filter(row => {
                        if (acFilter === 'all') return true;
                        if (acFilter === 'high') return row.completion > 15;
                        if (acFilter === 'medium') return row.completion >= 10 && row.completion <= 15;
                        if (acFilter === 'low') return row.completion < 10;
                        return true;
                      })
                      .map((row, idx) => (
                      <tr
                        key={row.acNumber || idx}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm">
                          <div className="font-medium">{row.ac}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium">{row.voters.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-right text-muted-foreground">
                          {(row.surveyedMembers || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-muted rounded-full h-2">
                              <div
                                className={cn(
                                  "h-2 rounded-full",
                                  row.completion > 15 ? "bg-success" : row.completion > 5 ? "bg-warning" : "bg-destructive"
                                )}
                                style={{ width: `${Math.min(row.completion, 100)}%` }}
                              />
                            </div>
                            <span className="w-14">{row.completion}%</span>
                            {row.completion > 15 ? (
                              <TrendingUp className="h-4 w-4 text-success" />
                            ) : row.completion > 5 ? (
                              <span className="h-4 w-4" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-destructive" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-center">{row.admins}</td>
                        <td className="px-4 py-3 text-sm text-center">{row.moderators}</td>
                        <td className="px-4 py-3 text-sm text-center font-medium text-primary">{row.agents}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};
