import { DashboardLayout } from '@/components/DashboardLayout';
import { StatCard } from '@/components/StatCard';
import { Card } from '@/components/ui/card';
import { Users, Home, FileCheck, TrendingUp, Loader2, BarChart3, PieChart as PieChartIcon, Activity, Calendar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ExportButton } from '@/components/ExportButton';
import { useState, useEffect, useCallback } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import API_BASE_URL from '@/lib/api';

interface BoothReport {
  booth: string;
  boothname: string;
  boothNo: number;
  booth_id: string;
  total_voters: number;
  total_families: number;
  male_voters: number;
  female_voters: number;
  verified_voters: number;
  surveys_completed: number;
  avg_age: number;
  completion_rate: number;
}

interface DashboardStats {
  totalFamilies: number;
  totalMembers: number;
  surveysCompleted: number;
  totalBooths: number;
  acName?: string;
}

interface AgeGroup {
  ageGroup: string;
  count: number;
  male: number;
  female: number;
}

interface DemographicsData {
  ageDistribution: AgeGroup[];
  genderDistribution: { male: number; female: number };
  surveyStatus: { surveyed: number; notSurveyed: number };
}

const COLORS = ['#3B82F6', '#EC4899', '#22C55E', '#EAB308', '#8B5CF6', '#F97316'];
const AGE_COLORS = ['#60A5FA', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#FB923C'];

export const Reports = () => {
  const { user } = useAuth();
  const acNumber = user?.assignedAC || 119;
  const [boothFilter, setBoothFilter] = useState<string>('all');

  // API state
  const [boothReports, setBoothReports] = useState<BoothReport[]>([]);
  const [allBooths, setAllBooths] = useState<Array<{id: string, name: string}>>([]);  // Store all booths for dropdown
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [demographics, setDemographics] = useState<DemographicsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all reports data
  const fetchReports = useCallback(async (booth: string = 'all') => {
    try {
      setLoading(true);
      setError(null);

      const boothParam = booth !== 'all' ? `?booth=${encodeURIComponent(booth)}` : '';

      const [reportsResponse, statsResponse, demographicsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/reports/${acNumber}/booth-performance${boothParam}`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/dashboard/stats/${acNumber}`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/reports/${acNumber}/demographics${boothParam}`, { credentials: 'include' })
      ]);

      if (!reportsResponse.ok) {
        throw new Error('Failed to fetch booth reports');
      }

      const reportsData = await reportsResponse.json();
      setBoothReports(reportsData.reports || []);

      // Store all booths for dropdown on initial load (when no booth filter)
      if (booth === 'all' && reportsData.reports?.length > 0) {
        const boothOptions = reportsData.reports.map((item: BoothReport, index: number) => ({
          id: item.booth_id || `booth-${index}`,
          name: item.boothname || `Booth ${item.boothNo}`
        }));
        setAllBooths(boothOptions);
      }

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      if (demographicsResponse.ok) {
        const demographicsData = await demographicsResponse.json();
        setDemographics(demographicsData);
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [acNumber]);

  useEffect(() => {
    fetchReports();
  }, [acNumber, fetchReports]);

  // Handle booth filter change - trigger data refresh
  const handleBoothFilterChange = (value: string) => {
    setBoothFilter(value);
    fetchReports(value);
  };

  // Use allBooths for filter dropdown (populated on initial load, never changes when filtering)

  // Filter booth data for table display
  const filteredBoothPerformance = boothReports.filter(item => {
    const boothName = item.boothname || `Booth ${item.boothNo}`;
    return boothFilter === 'all' || boothName === boothFilter;
  });

  // Calculate totals from demographics when filtering, fallback to booth reports
  const totalMale = demographics?.genderDistribution?.male || boothReports.reduce((sum, b) => sum + b.male_voters, 0);
  const totalFemale = demographics?.genderDistribution?.female || boothReports.reduce((sum, b) => sum + b.female_voters, 0);
  const totalVoters = totalMale + totalFemale;
  // When filtering by booth, use booth-specific family count; otherwise use global stats
  const totalFamilies = boothFilter !== 'all'
    ? filteredBoothPerformance.reduce((sum, b) => sum + b.total_families, 0)
    : (stats?.totalFamilies || boothReports.reduce((sum, b) => sum + b.total_families, 0));
  // When filtering by booth, use booth-specific survey count from filteredBoothPerformance
  // Use nullish coalescing (??) to properly handle 0 values
  const totalSurveys = boothFilter !== 'all'
    ? filteredBoothPerformance.reduce((sum, b) => sum + b.surveys_completed, 0)
    : (demographics?.surveyStatus?.surveyed ?? stats?.surveysCompleted ?? boothReports.reduce((sum, b) => sum + b.surveys_completed, 0));
  const pendingSurveys = totalVoters - totalSurveys;
  // Calculate completion rate with proper precision for small values
  const rawCompletionRate = totalVoters > 0 ? (totalSurveys / totalVoters) * 100 : 0;
  const completionRate = rawCompletionRate > 0 && rawCompletionRate < 0.1
    ? Math.round(rawCompletionRate * 100) / 100  // 2 decimal places for very small values
    : Math.round(rawCompletionRate * 10) / 10;   // 1 decimal place for normal values
  // Pending rate should use same precision as completion rate
  const rawPendingRate = 100 - rawCompletionRate;
  const pendingRate = rawPendingRate > 99.9 && rawPendingRate < 100
    ? Math.round(rawPendingRate * 100) / 100  // 2 decimal places when close to 100%
    : Math.round(rawPendingRate * 10) / 10;   // 1 decimal place for normal values

  // Chart data preparations
  const genderDistributionData = [
    { name: 'Male', value: totalMale, color: '#3B82F6' },
    { name: 'Female', value: totalFemale, color: '#EC4899' },
  ];

  const surveyStatusData = [
    { name: 'Completed', value: totalSurveys, color: '#22C55E' },
    { name: 'Pending', value: pendingSurveys, color: '#EAB308' },
  ];

  // Age distribution data
  const ageDistributionData = demographics?.ageDistribution?.map((item, index) => ({
    name: item.ageGroup,
    total: item.count,
    male: item.male,
    female: item.female,
    color: AGE_COLORS[index % AGE_COLORS.length]
  })) || [];

  // Top and bottom performing booths (only when viewing all booths)
  const sortedByCompletion = [...boothReports].sort((a, b) => b.completion_rate - a.completion_rate);
  const topPerformingBooths = sortedByCompletion.slice(0, 5);
  const needsAttentionBooths = sortedByCompletion.slice(-5).reverse();

  // Prepare data for export
  const exportData = {
    voters: totalVoters,
    surveys: totalSurveys,
    completion: completionRate,
    booths: boothFilter === 'all' ? allBooths.length : 1,
    families: totalFamilies,
    maleVoters: totalMale,
    femaleVoters: totalFemale,
    filteredBooth: boothFilter !== 'all' ? boothFilter : null,
    ageDistribution: demographics?.ageDistribution,
    boothPerformance: filteredBoothPerformance.map(b => ({
      booth: b.boothname || `Booth ${b.boothNo}`,
      voters: b.total_voters,
      surveyed: b.surveys_completed,
      completion: b.completion_rate
    })),
  };

  // Dynamic filename based on filter
  const exportFilename = boothFilter === 'all'
    ? `AC-${acNumber}-All-Booths-Report`
    : `AC-${acNumber}-Booth-Report`;

  const acName = stats?.acName || user?.aciName || 'Assembly Constituency';

  // Custom label renderer that avoids overlap
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 30;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null; // Don't show labels for tiny slices

    return (
      <text
        x={x}
        y={y}
        fill="#666"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={12}
      >
        {`${name}: ${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading reports...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">Reports & Analytics</h1>
            <p className="text-muted-foreground">
              Performance data for AC {acNumber} - {acName}
              {boothFilter !== 'all' && <span className="ml-2 text-primary font-medium">(Filtered: {boothFilter.substring(0, 30)}...)</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={boothFilter} onValueChange={handleBoothFilterChange}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Filter by Booth" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="all">All Booths ({allBooths.length})</SelectItem>
                {allBooths.map((booth) => (
                  <SelectItem key={booth.id} value={booth.name}>{booth.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ExportButton
              data={exportData}
              filename={exportFilename}
              acNumber={acNumber?.toString()}
            />
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Total Voters" value={totalVoters.toLocaleString()} icon={Users} variant="primary" />
          <StatCard title="Total Families" value={totalFamilies.toLocaleString()} icon={Home} variant="primary" />
          <StatCard title="Surveys Completed" value={totalSurveys.toLocaleString()} icon={FileCheck} variant="success" />
          <StatCard title="Completion Rate" value={`${completionRate}%`} icon={TrendingUp} variant={completionRate > 50 ? 'success' : 'warning'} />
        </div>

        {/* Charts Section */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-[500px]">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="demographics">Demographics</TabsTrigger>
            <TabsTrigger value="booths">Booth Analysis</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Survey Status Pie Chart */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5 text-primary" />
                  Survey Completion Status
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={surveyStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      labelLine={false}
                    >
                      {surveyStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => value.toLocaleString()} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                  <div className="p-3 bg-green-500/10 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{totalSurveys.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Completed ({completionRate}%)</p>
                  </div>
                  <div className="p-3 bg-yellow-500/10 rounded-lg">
                    <p className="text-2xl font-bold text-yellow-600">{pendingSurveys.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Pending ({pendingRate}%)</p>
                  </div>
                </div>
              </Card>

              {/* Gender Distribution Pie Chart */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Gender Distribution
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={genderDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      labelLine={false}
                    >
                      {genderDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => value.toLocaleString()} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                  <div className="p-3 bg-blue-500/10 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{totalMale.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Male ({totalVoters > 0 ? ((totalMale / totalVoters) * 100).toFixed(1) : 0}%)</p>
                  </div>
                  <div className="p-3 bg-pink-500/10 rounded-lg">
                    <p className="text-2xl font-bold text-pink-600">{totalFemale.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Female ({totalVoters > 0 ? ((totalFemale / totalVoters) * 100).toFixed(1) : 0}%)</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Overall Progress */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-6">Overall Survey Progress</h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Overall Completion</span>
                    <span className="font-semibold">{completionRate}%</span>
                  </div>
                  <Progress value={completionRate} className="h-4" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{totalVoters.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Total Target</p>
                  </div>
                  <div className="p-4 bg-green-500/10 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{totalSurveys.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Completed</p>
                  </div>
                  <div className="p-4 bg-yellow-500/10 rounded-lg">
                    <p className="text-2xl font-bold text-yellow-600">{pendingSurveys.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Remaining</p>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Demographics Tab */}
          <TabsContent value="demographics" className="space-y-6">
            {/* Age Distribution Bar Chart */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Age Group Distribution
              </h3>
              {ageDistributionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={ageDistributionData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => value.toLocaleString()} />
                    <Legend />
                    <Bar dataKey="male" fill="#3B82F6" name="Male" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="female" fill="#EC4899" name="Female" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                  No age data available
                </div>
              )}
            </Card>

            {/* Age Group Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {ageDistributionData.map((item, index) => (
                <Card key={item.name} className="p-4 text-center">
                  <p className="text-lg font-bold" style={{ color: AGE_COLORS[index % AGE_COLORS.length] }}>
                    {item.total.toLocaleString()}
                  </p>
                  <p className="text-sm font-medium">{item.name}</p>
                  <div className="flex justify-center gap-2 mt-2 text-xs text-muted-foreground">
                    <span className="text-blue-600">M: {item.male}</span>
                    <span className="text-pink-600">F: {item.female}</span>
                  </div>
                </Card>
              ))}
            </div>

            {/* Demographics Summary */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Demographics Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-blue-500/10 rounded-lg text-center">
                  <p className="text-3xl font-bold text-blue-600">{totalMale.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Male Voters</p>
                  <p className="text-xs text-blue-600 mt-1">
                    {totalVoters > 0 ? ((totalMale / totalVoters) * 100).toFixed(1) : 0}%
                  </p>
                </div>
                <div className="p-4 bg-pink-500/10 rounded-lg text-center">
                  <p className="text-3xl font-bold text-pink-600">{totalFemale.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Female Voters</p>
                  <p className="text-xs text-pink-600 mt-1">
                    {totalVoters > 0 ? ((totalFemale / totalVoters) * 100).toFixed(1) : 0}%
                  </p>
                </div>
                <div className="p-4 bg-purple-500/10 rounded-lg text-center">
                  <p className="text-3xl font-bold text-purple-600">{totalFamilies.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Total Families</p>
                  <p className="text-xs text-purple-600 mt-1">
                    ~{totalFamilies > 0 ? (totalVoters / totalFamilies).toFixed(1) : 0} per family
                  </p>
                </div>
                <div className="p-4 bg-green-500/10 rounded-lg text-center">
                  <p className="text-3xl font-bold text-green-600">{boothReports.length}</p>
                  <p className="text-sm text-muted-foreground">Total Booths</p>
                  <p className="text-xs text-green-600 mt-1">
                    ~{boothReports.length > 0 ? Math.round(totalVoters / boothReports.length) : 0} voters/booth
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Booth Analysis Tab */}
          <TabsContent value="booths" className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4 text-center">
                <p className="text-2xl font-bold text-primary">{filteredBoothPerformance.length}</p>
                <p className="text-sm text-muted-foreground">Booths Shown</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{filteredBoothPerformance.reduce((sum, b) => sum + b.total_voters, 0).toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Voters</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{filteredBoothPerformance.reduce((sum, b) => sum + b.surveys_completed, 0).toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Surveyed</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-2xl font-bold text-purple-600">{filteredBoothPerformance.reduce((sum, b) => sum + b.total_families, 0).toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Families</p>
              </Card>
            </div>

            {/* Booth Performance Table */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-6">Detailed Booth Performance</h2>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Booth</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">Voters</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">Families</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">Male</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">Female</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">Surveyed</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Progress</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredBoothPerformance.length > 0 ? (
                      filteredBoothPerformance.map((row, idx) => (
                        <tr key={idx} className="hover:bg-muted/50">
                          <td className="px-4 py-3 text-sm font-medium max-w-[250px] truncate" title={row.boothname || `Booth ${row.boothNo}`}>
                            {row.boothname || `Booth ${row.boothNo}`}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">{row.total_voters.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-right">{row.total_families.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-right text-blue-600">{row.male_voters.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-right text-pink-600">{row.female_voters.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-right text-green-600">{row.surveys_completed.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Progress value={row.completion_rate} className="h-2 w-20" />
                              <span className={`text-sm font-semibold ${
                                row.completion_rate >= 70 ? 'text-green-600' :
                                row.completion_rate >= 40 ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                                {row.completion_rate}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                          No booth data available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Performing Booths */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 text-green-600">Top 5 Performing Booths</h3>
                <div className="space-y-3">
                  {topPerformingBooths.map((booth, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-green-500/5 border border-green-500/20 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-600 font-bold">
                          {idx + 1}
                        </div>
                        <div className="max-w-[200px]">
                          <p className="text-sm font-medium truncate" title={booth.boothname || `Booth ${booth.boothNo}`}>
                            {booth.boothname || `Booth ${booth.boothNo}`}
                          </p>
                          <p className="text-xs text-muted-foreground">{booth.total_voters} voters</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-green-600">{booth.completion_rate}%</span>
                        <p className="text-xs text-muted-foreground">{booth.surveys_completed} surveyed</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Needs Attention Booths */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 text-red-600">Bottom 5 - Needs Attention</h3>
                <div className="space-y-3">
                  {needsAttentionBooths.map((booth, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-600 font-bold">
                          !
                        </div>
                        <div className="max-w-[200px]">
                          <p className="text-sm font-medium truncate" title={booth.boothname || `Booth ${booth.boothNo}`}>
                            {booth.boothname || `Booth ${booth.boothNo}`}
                          </p>
                          <p className="text-xs text-muted-foreground">{booth.total_voters} voters</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-red-600">{booth.completion_rate}%</span>
                        <p className="text-xs text-muted-foreground">{booth.total_voters - booth.surveys_completed} pending</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Completion Rate Distribution */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Booth Completion Distribution
              </h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-green-500/10 rounded-lg">
                  <p className="text-3xl font-bold text-green-600">
                    {boothReports.filter(b => b.completion_rate >= 70).length}
                  </p>
                  <p className="text-sm text-muted-foreground">High (70%+)</p>
                </div>
                <div className="p-4 bg-yellow-500/10 rounded-lg">
                  <p className="text-3xl font-bold text-yellow-600">
                    {boothReports.filter(b => b.completion_rate >= 40 && b.completion_rate < 70).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Medium (40-69%)</p>
                </div>
                <div className="p-4 bg-red-500/10 rounded-lg">
                  <p className="text-3xl font-bold text-red-600">
                    {boothReports.filter(b => b.completion_rate < 40).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Low (&lt;40%)</p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};
