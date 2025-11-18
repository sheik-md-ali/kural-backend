import { DashboardLayout } from '@/components/DashboardLayout';
import { StatCard } from '@/components/StatCard';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, UserCircle, Shield, CheckCircle, TrendingUp, TrendingDown, Calendar as CalendarIcon, Filter, Activity, Home, FileCheck } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const acPerformance = [
  { ac: '101 - Dharapuram (SC)', acNumber: 101, voters: 2134, completion: 16.5, admins: 2, moderators: 6, agents: 16 },
  { ac: '102 - Kangayam', acNumber: 102, voters: 1845, completion: 13.2, admins: 1, moderators: 5, agents: 14 },
  { ac: '108 - Udhagamandalam', acNumber: 108, voters: 1678, completion: 12.8, admins: 1, moderators: 4, agents: 13 },
  { ac: '109 - Gudalur (SC)', acNumber: 109, voters: 1234, completion: 10.5, admins: 1, moderators: 3, agents: 10 },
  { ac: '110 - Coonoor', acNumber: 110, voters: 1890, completion: 14.2, admins: 2, moderators: 5, agents: 14 },
  { ac: '111 - Mettupalayam', acNumber: 111, voters: 2023, completion: 15.4, admins: 2, moderators: 6, agents: 15 },
  { ac: '112 - Avanashi (SC)', acNumber: 112, voters: 1756, completion: 13.8, admins: 1, moderators: 5, agents: 13 },
  { ac: '113 - Tiruppur North', acNumber: 113, voters: 2456, completion: 18.4, admins: 2, moderators: 8, agents: 19 },
  { ac: '114 - Tiruppur South', acNumber: 114, voters: 2189, completion: 16.8, admins: 2, moderators: 7, agents: 17 },
  { ac: '115 - Palladam', acNumber: 115, voters: 1823, completion: 14.0, admins: 2, moderators: 6, agents: 14 },
  { ac: '116 - Sulur', acNumber: 116, voters: 1678, completion: 13.0, admins: 1, moderators: 5, agents: 12 },
  { ac: '117 - Kavundampalayam', acNumber: 117, voters: 1956, completion: 14.6, admins: 2, moderators: 6, agents: 15 },
  { ac: '118 - Coimbatore North', acNumber: 118, voters: 2340, completion: 17.0, admins: 2, moderators: 8, agents: 18 },
  { ac: '119 - Thondamuthur', acNumber: 119, voters: 1247, completion: 12.5, admins: 1, moderators: 5, agents: 12 },
  { ac: '120 - Coimbatore South', acNumber: 120, voters: 1890, completion: 14.4, admins: 2, moderators: 6, agents: 15 },
  { ac: '121 - Singanallur', acNumber: 121, voters: 2145, completion: 18.2, admins: 2, moderators: 7, agents: 17 },
  { ac: '122 - Kinathukadavu', acNumber: 122, voters: 1678, completion: 13.4, admins: 1, moderators: 5, agents: 13 },
  { ac: '123 - Pollachi', acNumber: 123, voters: 2378, completion: 17.8, admins: 2, moderators: 8, agents: 18 },
  { ac: '124 - Valparai (SC)', acNumber: 124, voters: 1234, completion: 11.6, admins: 1, moderators: 4, agents: 10 },
  { ac: '125 - Udumalaipettai', acNumber: 125, voters: 1945, completion: 15.0, admins: 2, moderators: 6, agents: 15 },
  { ac: '126 - Madathukulam', acNumber: 126, voters: 1567, completion: 12.4, admins: 1, moderators: 5, agents: 11 },
];

const systemGrowthData = [
  { month: 'Jan', voters: 35000, surveys: 3200, agents: 180 },
  { month: 'Feb', voters: 37500, surveys: 4100, agents: 195 },
  { month: 'Mar', voters: 39800, surveys: 5300, agents: 210 },
  { month: 'Apr', voters: 41200, surveys: 6700, agents: 225 },
  { month: 'May', voters: 42567, surveys: 8400, agents: 234 },
];

const adminActivityData = [
  { day: 'Mon', l1: 8, l2: 32, l3: 156 },
  { day: 'Tue', l1: 10, l2: 38, l3: 178 },
  { day: 'Wed', l1: 9, l2: 35, l3: 165 },
  { day: 'Thu', l1: 11, l2: 40, l3: 189 },
  { day: 'Fri', l1: 12, l2: 42, l3: 201 },
  { day: 'Sat', l1: 7, l2: 28, l3: 142 },
  { day: 'Sun', l1: 5, l2: 20, l3: 98 },
];

const surveyDistribution = [
  { category: 'Week 1', completed: 1420, pending: 580 },
  { category: 'Week 2', completed: 1680, pending: 420 },
  { category: 'Week 3', completed: 1890, pending: 310 },
  { category: 'Week 4', completed: 2120, pending: 280 },
  { category: 'Week 5', completed: 1290, pending: 410 },
];

export const L0Dashboard = () => {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<Date | undefined>(new Date());
  const [acFilter, setAcFilter] = useState<string>('all');
  const [isLive, setIsLive] = useState(true);

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
          <StatCard title="Total L1 Admins" value="12" icon={Shield} variant="primary" subtitle="ACIM Dashboard Users" />
          <StatCard title="Total L2 Moderators" value="45" icon={UserCircle} variant="primary" subtitle="ACI Dashboard Users" />
          <StatCard title="Total L3 Booth Agents" value="234" icon={Users} variant="success" subtitle="Active Field Agents" />
          <StatCard title="Total Voters (All ACs)" value="42,567" icon={CheckCircle} variant="default" subtitle="Registered Voters" />
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
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={systemGrowthData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="voters" stroke="hsl(var(--primary))" strokeWidth={2} name="Voters" />
                    <Line type="monotone" dataKey="surveys" stroke="hsl(var(--success))" strokeWidth={2} name="Surveys" />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Survey Distribution (Weekly)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={surveyDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="completed" fill="hsl(var(--success))" name="Completed" />
                    <Bar dataKey="pending" fill="hsl(var(--warning))" name="Pending" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <TrendingUp className="mr-2 h-5 w-5 text-success" />
                  Highest Voter AC
                </h3>
                <div className="space-y-2">
                  <p className="text-2xl font-bold text-primary">119 - Coimbatore North</p>
                  <p className="text-sm text-muted-foreground">2,340 voters</p>
                  <p className="text-sm text-muted-foreground">18.1% completion</p>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <FileCheck className="mr-2 h-5 w-5 text-success" />
                  Best Completion Rate
                </h3>
                <div className="space-y-2">
                  <p className="text-2xl font-bold text-primary">119 - Coimbatore North</p>
                  <p className="text-sm text-muted-foreground">18.1% completion</p>
                  <p className="text-sm text-muted-foreground">423 surveys</p>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <TrendingDown className="mr-2 h-5 w-5 text-destructive" />
                  Needs Attention
                </h3>
                <div className="space-y-2">
                  <p className="text-2xl font-bold text-primary">121 - Singanallur</p>
                  <p className="text-sm text-muted-foreground">8.2% completion</p>
                  <p className="text-sm text-muted-foreground">138 surveys</p>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Admin Activity by Level (7 Days)</h3>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={adminActivityData}>
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
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard title="Avg Daily Logins" value="287" icon={Activity} variant="default" subtitle="Across all users" />
              <StatCard title="Peak Hour Activity" value="2-4 PM" icon={Activity} variant="primary" subtitle="Highest traffic" />
              <StatCard title="Forms Created" value="37" icon={FileCheck} variant="success" subtitle="Last 30 days" />
              <StatCard title="Booths Active" value="142" icon={Home} variant="warning" subtitle="Out of 234 total" />
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Assembly Constituency Performance</h2>
              <p className="text-sm text-muted-foreground mb-4">Overview of top performing ACs</p>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Assembly Constituency</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Voters</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Completion</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">L1 Admins</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">L2 Mods</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">L3 Agents</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {acPerformance
                      .filter(row => {
                        if (acFilter === 'all') return true;
                        if (acFilter === 'high') return row.completion > 15;
                        if (acFilter === 'medium') return row.completion >= 10 && row.completion <= 15;
                        if (acFilter === 'low') return row.completion < 10;
                        return true;
                      })
                      .map((row, idx) => (
                      <tr 
                        key={idx} 
                        className="hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => navigate('/l0/booths')}
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
                        <td className="px-4 py-3 text-sm">{row.admins}</td>
                        <td className="px-4 py-3 text-sm">{row.moderators}</td>
                        <td className="px-4 py-3 text-sm">{row.agents}</td>
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
