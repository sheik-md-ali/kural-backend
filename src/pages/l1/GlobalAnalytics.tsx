import { DashboardLayout } from '@/components/DashboardLayout';
import { StatCard } from '@/components/StatCard';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Home, FileCheck, TrendingUp, TrendingDown, Calendar as CalendarIcon, Filter, Activity, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

interface ACPerformance {
  ac: string;
  acNumber: number;
  voters: number;
  completion: number;
  activity: string;
  surveyedMembers: number;
}

export const GlobalAnalytics = () => {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<Date | undefined>(new Date());
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [isLive, setIsLive] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [acPerformance, setAcPerformance] = useState<ACPerformance[]>([]);
  const [totals, setTotals] = useState({
    totalVoters: 0,
    totalFamilies: 0,
    totalSurveyedMembers: 0,
    avgCompletion: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const data = await api.get('/rbac/dashboard/ac-overview');

        if (data.success && data.acPerformance) {
          const mappedData: ACPerformance[] = data.acPerformance.map((ac: {
            ac: string;
            acNumber: number;
            acName: string | null;
            voters: number;
            surveyedMembers: number;
            completion: number;
          }) => ({
            ac: ac.ac || `AC ${ac.acNumber}`,
            acNumber: ac.acNumber,
            voters: ac.voters || 0,
            completion: ac.completion || 0,
            surveyedMembers: ac.surveyedMembers || 0,
            activity: ac.completion >= 15 ? 'High' : ac.completion >= 8 ? 'Medium' : 'Low',
          }));

          setAcPerformance(mappedData);

          // Use totals from API (includes actual families count)
          setTotals({
            totalVoters: data.totals?.totalVoters || mappedData.reduce((sum, ac) => sum + ac.voters, 0),
            totalFamilies: data.totals?.totalFamilies || 0,
            totalSurveyedMembers: data.totals?.totalSurveyedMembers || mappedData.reduce((sum, ac) => sum + ac.surveyedMembers, 0),
            avgCompletion: mappedData.length > 0
              ? Math.round((mappedData.reduce((sum, ac) => sum + ac.completion, 0) / mappedData.length) * 10) / 10
              : 0,
          });
        }
      } catch (error) {
        console.error('Error fetching analytics data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Generate chart data from AC performance
  const voterTurnoutData = acPerformance.slice(0, 7).map((ac, idx) => ({
    date: `Day ${idx + 1}`,
    turnout: ac.completion,
  }));

  const surveyProgressData = acPerformance.slice(0, 6).map((ac, idx) => ({
    week: `Week ${idx + 1}`,
    surveys: ac.surveyedMembers,
  }));

  const agentActivityData = acPerformance.slice(0, 7).map((ac, idx) => ({
    day: `Day ${idx + 1}`,
    submissions: ac.surveyedMembers,
  }));

  const handleACClick = (acNumber: number) => {
    navigate(`/l1/ac/${acNumber}`);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading analytics data...</span>
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
              Global Analytics Dashboard
              <span className={cn(
                "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium",
                isLive ? "bg-success/10 text-success animate-pulse" : "bg-muted text-muted-foreground"
              )}>
                <Activity className="h-3 w-3" />
                {isLive ? 'Live' : 'Offline'}
              </span>
            </h1>
            <p className="text-muted-foreground">Overall performance across {acPerformance.length} Assembly Constituencies</p>
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

            <Select value={activityFilter} onValueChange={setActivityFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Activity Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Activity</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>

            {activityFilter !== 'all' && (
              <Button variant="ghost" size="sm" onClick={() => setActivityFilter('all')}>
                Clear Filters
              </Button>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Total Voters" value={totals.totalVoters.toLocaleString()} icon={Users} variant="primary" />
          <StatCard title="Total Families" value={totals.totalFamilies.toLocaleString()} icon={Home} variant="primary" />
          <StatCard title="Surveys Completed" value={totals.totalSurveyedMembers.toLocaleString()} icon={FileCheck} variant="success" />
          <StatCard title="Avg Completion" value={`${totals.avgCompletion}%`} icon={TrendingUp} variant="warning" />
        </div>

        {/* Interactive Charts */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Voter Turnout Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={voterTurnoutData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="turnout" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 5 }} activeDot={{ r: 7 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Survey Progress by Week</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={surveyProgressData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="surveys" fill="#10b981" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Agent Activity Over Time</h3>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={agentActivityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="submissions" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">AC Performance Insights</h2>
              <p className="text-sm text-muted-foreground mb-4">Click any row to view detailed analytics</p>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Assembly Constituency</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Total Voters</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Completion %</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Activity Level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {acPerformance
                      .filter(row => activityFilter === 'all' || row.activity === activityFilter)
                      .map((row, idx) => (
                      <tr 
                        key={idx} 
                        className="hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => handleACClick(row.acNumber)}
                      >
                        <td className="px-4 py-3 text-sm font-medium">{row.ac}</td>
                        <td className="px-4 py-3 text-sm">{row.voters.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center space-x-2">
                            <span>{row.completion}%</span>
                            {row.completion > 15 ? (
                              <TrendingUp className="h-4 w-4 text-success" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-destructive" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            row.activity === 'High' ? 'bg-success/10 text-success' :
                            row.activity === 'Medium' ? 'bg-warning/10 text-warning' :
                            'bg-destructive/10 text-destructive'
                          }`}>
                            {row.activity}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <TrendingUp className="mr-2 h-5 w-5 text-success" />
              Highest Activity AC
            </h3>
            <div className="space-y-2">
              {acPerformance.length > 0 ? (
                <>
                  {(() => {
                    const highest = [...acPerformance].sort((a, b) => {
                      // First sort by completion rate, then by surveys as tiebreaker
                      if (b.completion !== a.completion) return b.completion - a.completion;
                      return b.surveyedMembers - a.surveyedMembers;
                    })[0];
                    return (
                      <>
                        <p className="text-2xl font-bold text-primary">{highest.ac}</p>
                        <p className="text-sm text-muted-foreground">{highest.completion}% completion rate</p>
                        <p className="text-sm text-muted-foreground">{highest.surveyedMembers.toLocaleString()} surveys completed</p>
                      </>
                    );
                  })()}
                </>
              ) : (
                <p className="text-muted-foreground">No data available</p>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <TrendingDown className="mr-2 h-5 w-5 text-destructive" />
              Lowest Activity AC
            </h3>
            <div className="space-y-2">
              {acPerformance.length > 0 ? (
                <>
                  {(() => {
                    const lowest = [...acPerformance].sort((a, b) => {
                      // First sort by completion rate (ascending), then by surveys as tiebreaker (ascending)
                      if (a.completion !== b.completion) return a.completion - b.completion;
                      return a.surveyedMembers - b.surveyedMembers;
                    })[0];
                    return (
                      <>
                        <p className="text-2xl font-bold text-primary">{lowest.ac}</p>
                        <p className="text-sm text-muted-foreground">{lowest.completion}% completion rate</p>
                        <p className="text-sm text-muted-foreground">{lowest.surveyedMembers.toLocaleString()} surveys completed</p>
                      </>
                    );
                  })()}
                </>
              ) : (
                <p className="text-muted-foreground">No data available</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};
