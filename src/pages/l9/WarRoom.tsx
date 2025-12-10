import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  TrendingUp, 
  BarChart3, 
  Target, 
  AlertTriangle,
  Activity,
  MapPin,
  MessageSquare,
  Vote,
  Clock,
  CheckCircle2,
  XCircle,
  Radio
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Mock comprehensive data aggregated from all levels
const overallStats = {
  totalVoters: 1250000,
  targetedVoters: 875000,
  contactedVoters: 456789,
  surveyCompletion: 68.5,
  totalACs: 25,
  activeAgents: 342,
  booths: 1850,
  liveUpdates: 127
};

const voterDemographics = [
  { segment: '18-25', count: 125000, targeted: 87500 },
  { segment: '26-35', count: 275000, targeted: 192500 },
  { segment: '36-50', count: 425000, targeted: 297500 },
  { segment: '51-65', count: 275000, targeted: 192500 },
  { segment: '65+', count: 150000, targeted: 105000 }
];

const sentimentData = [
  { date: 'Week 1', positive: 45, neutral: 35, negative: 20 },
  { date: 'Week 2', positive: 52, neutral: 30, negative: 18 },
  { date: 'Week 3', positive: 58, neutral: 27, negative: 15 },
  { date: 'Week 4', positive: 62, neutral: 25, negative: 13 },
];

const campaignPerformance = [
  { ac: 'AC-101', completion: 82, sentiment: 75, turnout: 68 },
  { ac: 'AC-118', completion: 78, sentiment: 72, turnout: 65 },
  { ac: 'AC-119', completion: 71, sentiment: 68, turnout: 62 },
  { ac: 'AC-121', completion: 85, sentiment: 78, turnout: 71 },
  { ac: 'AC-123', completion: 65, sentiment: 62, turnout: 58 },
];

const swingVoterData = [
  { name: 'Identified', value: 125000 },
  { name: 'Contacted', value: 78000 },
  { name: 'Convinced', value: 45000 },
  { name: 'Pending', value: 47000 }
];

const resourceAllocation = [
  { category: 'Digital Campaign', allocated: 2500000, spent: 1875000, efficiency: 75 },
  { category: 'Ground Operations', allocated: 3500000, spent: 2975000, efficiency: 85 },
  { category: 'Media Outreach', allocated: 4000000, spent: 3200000, efficiency: 80 },
  { category: 'Event Management', allocated: 1500000, spent: 1125000, efficiency: 75 }
];

// Vibrant color palette for charts
const COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#14b8a6', // Teal
  '#6366f1', // Indigo
];

export const WarRoom = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Radio className="h-8 w-8 text-primary animate-pulse" />
              Election War Room
            </h1>
            <p className="text-muted-foreground mt-1">
              Real-time Strategic Command Center - All Constituencies
            </p>
          </div>
          <Badge variant="default" className="text-base px-4 py-2">
            <Activity className="h-4 w-4 mr-2 animate-pulse" />
            LIVE
          </Badge>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Voters"
            value={overallStats.totalVoters.toLocaleString()}
            subtitle={`${overallStats.targetedVoters.toLocaleString()} targeted`}
            icon={Users}
          />
          <StatCard
            title="Survey Completion"
            value={`${overallStats.surveyCompletion}%`}
            subtitle={`${overallStats.contactedVoters.toLocaleString()} contacted`}
            icon={CheckCircle2}
          />
          <StatCard
            title="Active Operations"
            value={overallStats.activeAgents}
            subtitle={`Across ${overallStats.totalACs} ACs`}
            icon={Activity}
          />
          <StatCard
            title="Live Updates"
            value={overallStats.liveUpdates}
            subtitle={`From ${overallStats.booths} booths`}
            icon={Radio}
          />
        </div>

        <Tabs defaultValue="voter-intelligence" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="voter-intelligence">
              <Users className="h-4 w-4 mr-2" />
              Voter Intelligence
            </TabsTrigger>
            <TabsTrigger value="sentiment">
              <MessageSquare className="h-4 w-4 mr-2" />
              Sentiment
            </TabsTrigger>
            <TabsTrigger value="performance">
              <TrendingUp className="h-4 w-4 mr-2" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="resources">
              <BarChart3 className="h-4 w-4 mr-2" />
              Resources
            </TabsTrigger>
            <TabsTrigger value="alerts">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Alerts
            </TabsTrigger>
          </TabsList>

          {/* Voter Intelligence Tab */}
          <TabsContent value="voter-intelligence" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Voter Demographics & Targeting
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={voterDemographics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="segment" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#3b82f6" name="Total Voters" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="targeted" fill="#10b981" name="Targeted" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Swing Voter Analysis
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={swingVoterData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {swingVoterData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </div>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Key Voter Intelligence Insights</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    <span className="font-semibold">High Impact Segment</span>
                  </div>
                  <p className="text-sm text-muted-foreground">36-50 age group shows 82% engagement rate with digital campaigns</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    <span className="font-semibold">Needs Attention</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Youth voters (18-25) showing 35% undecided rate - require focused outreach</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-5 w-5 text-blue-500" />
                    <span className="font-semibold">Swing Success</span>
                  </div>
                  <p className="text-sm text-muted-foreground">36% of contacted swing voters convinced - above 30% target</p>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Sentiment Analysis Tab */}
          <TabsContent value="sentiment" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Public Sentiment Trends
              </h3>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={sentimentData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="positive" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.8} />
                  <Area type="monotone" dataKey="neutral" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.8} />
                  <Area type="monotone" dataKey="negative" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.8} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Top Issues - Voter Priority</h3>
                <div className="space-y-3">
                  {[
                    { issue: 'Development & Infrastructure', score: 85, trend: 'up' },
                    { issue: 'Employment Opportunities', score: 78, trend: 'up' },
                    { issue: 'Healthcare Access', score: 72, trend: 'stable' },
                    { issue: 'Education Quality', score: 68, trend: 'up' },
                    { issue: 'Public Safety', score: 65, trend: 'down' }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded">
                      <span className="font-medium">{item.issue}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{item.score}%</span>
                        {item.trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
                        {item.trend === 'down' && <AlertTriangle className="h-4 w-4 text-red-500" />}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Message Effectiveness</h3>
                <div className="space-y-3">
                  {[
                    { message: 'Economic Development', effectiveness: 88, reach: '245K' },
                    { message: 'Youth Empowerment', effectiveness: 82, reach: '198K' },
                    { message: 'Infrastructure Focus', effectiveness: 76, reach: '312K' },
                    { message: 'Social Welfare', effectiveness: 71, reach: '267K' }
                  ].map((item, i) => (
                    <div key={i} className="p-3 border rounded">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{item.message}</span>
                        <Badge>{item.effectiveness}% effective</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">Reach: {item.reach} voters</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Campaign Performance Tab */}
          <TabsContent value="performance" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                AC-wise Campaign Performance
              </h3>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={campaignPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="ac" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="completion" fill="#3b82f6" name="Completion %" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="sentiment" fill="#8b5cf6" name="Sentiment Score" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="turnout" fill="#10b981" name="Expected Turnout %" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                  <h3 className="font-semibold">Top Performer</h3>
                </div>
                <div className="text-2xl font-bold text-primary mb-1">AC-121</div>
                <p className="text-sm text-muted-foreground">85% completion • 78% sentiment • 71% turnout</p>
              </Card>
              
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-6 w-6 text-orange-500" />
                  <h3 className="font-semibold">Needs Focus</h3>
                </div>
                <div className="text-2xl font-bold text-primary mb-1">AC-123</div>
                <p className="text-sm text-muted-foreground">65% completion • Requires additional resources</p>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-6 w-6 text-blue-500" />
                  <h3 className="font-semibold">Most Active</h3>
                </div>
                <div className="text-2xl font-bold text-primary mb-1">AC-101</div>
                <p className="text-sm text-muted-foreground">82% completion • High agent activity</p>
              </Card>
            </div>
          </TabsContent>

          {/* Resource Allocation Tab */}
          <TabsContent value="resources" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Resource Allocation & Efficiency</h3>
              <div className="space-y-4">
                {resourceAllocation.map((resource, i) => (
                  <div key={i} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">{resource.category}</span>
                      <Badge variant={resource.efficiency >= 80 ? "default" : "secondary"}>
                        {resource.efficiency}% efficient
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                      <span>Allocated: ₹{(resource.allocated / 1000000).toFixed(1)}M</span>
                      <span>Spent: ₹{(resource.spent / 1000000).toFixed(1)}M</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${(resource.spent / resource.allocated) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Agent Distribution</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded">
                    <span>Field Agents</span>
                    <span className="font-bold">245</span>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded">
                    <span>Digital Coordinators</span>
                    <span className="font-bold">67</span>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded">
                    <span>Booth Monitors</span>
                    <span className="font-bold">30</span>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Critical Metrics</h3>
                <div className="space-y-3">
                  <div className="p-3 border rounded">
                    <div className="text-sm text-muted-foreground">Cost Per Contact</div>
                    <div className="text-2xl font-bold">₹42</div>
                  </div>
                  <div className="p-3 border rounded">
                    <div className="text-sm text-muted-foreground">Avg. Survey Time</div>
                    <div className="text-2xl font-bold">4.5 min</div>
                  </div>
                  <div className="p-3 border rounded">
                    <div className="text-sm text-muted-foreground">Conversion Rate</div>
                    <div className="text-2xl font-bold">36%</div>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Alerts & Actions Tab */}
          <TabsContent value="alerts" className="space-y-4">
            <div className="grid gap-4">
              {[
                { 
                  type: 'critical', 
                  title: 'Low Turnout Alert - AC-123',
                  description: 'Survey completion below 70% threshold. Immediate resource reallocation recommended.',
                  time: '15 min ago',
                  icon: XCircle
                },
                {
                  type: 'warning',
                  title: 'Sentiment Shift Detected',
                  description: 'Negative sentiment increased by 8% in AC-119 over past 48 hours.',
                  time: '1 hour ago',
                  icon: AlertTriangle
                },
                {
                  type: 'info',
                  title: 'High Engagement in Youth Segment',
                  description: 'Social media campaign achieving 125% of target engagement in 18-25 demographic.',
                  time: '2 hours ago',
                  icon: TrendingUp
                },
                {
                  type: 'success',
                  title: 'Milestone Achieved',
                  description: 'Overall survey completion crossed 65% mark across all constituencies.',
                  time: '3 hours ago',
                  icon: CheckCircle2
                },
                {
                  type: 'warning',
                  title: 'Resource Utilization Alert',
                  description: 'Digital campaign budget at 75% with 40% of timeline remaining.',
                  time: '5 hours ago',
                  icon: Clock
                }
              ].map((alert, i) => {
                const Icon = alert.icon;
                const colorClass = 
                  alert.type === 'critical' ? 'border-red-500 bg-red-50 dark:bg-red-950' :
                  alert.type === 'warning' ? 'border-orange-500 bg-orange-50 dark:bg-orange-950' :
                  alert.type === 'success' ? 'border-green-500 bg-green-50 dark:bg-green-950' :
                  'border-blue-500 bg-blue-50 dark:bg-blue-950';
                
                return (
                  <Card key={i} className={`p-4 border-l-4 ${colorClass}`}>
                    <div className="flex items-start gap-4">
                      <Icon className="h-6 w-6 mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-semibold">{alert.title}</h4>
                          <span className="text-sm text-muted-foreground">{alert.time}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{alert.description}</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};
