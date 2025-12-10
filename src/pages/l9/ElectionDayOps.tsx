import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/StatCard';
import { Vote, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';

const turnoutByHour = [
  { time: '7 AM', turnout: 8, expected: 7 },
  { time: '9 AM', turnout: 18, expected: 16 },
  { time: '11 AM', turnout: 32, expected: 30 },
  { time: '1 PM', turnout: 48, expected: 45 },
  { time: '3 PM', turnout: 62, expected: 60 },
  { time: '5 PM', turnout: 75, expected: 72 },
  { time: '6 PM', turnout: 82, expected: 78 },
];

const boothAlerts = [
  { booth: 'B-042', issue: 'EVM Malfunction', severity: 'critical', status: 'resolved', time: '10:30 AM' },
  { booth: 'B-087', issue: 'Long Queue', severity: 'warning', status: 'monitoring', time: '11:45 AM' },
  { booth: 'B-015', issue: 'Low Turnout', severity: 'warning', status: 'action-taken', time: '12:15 PM' },
  { booth: 'B-134', issue: 'Voter ID Verification Delay', severity: 'info', status: 'resolved', time: '1:30 PM' },
  { booth: 'B-098', issue: 'Booth Agent Replacement Needed', severity: 'warning', status: 'in-progress', time: '2:00 PM' },
];

const acWiseTurnout = [
  { ac: 'AC-001', current: 78, target: 75, booths: 45 },
  { ac: 'AC-002', current: 72, target: 75, booths: 38 },
  { ac: 'AC-003', current: 82, target: 75, booths: 52 },
  { ac: 'AC-004', current: 65, target: 75, booths: 30 },
  { ac: 'AC-005', current: 76, target: 75, booths: 48 },
];

const gotvProgress = [
  { category: 'Supporters Contacted', value: 142500, target: 150000, percentage: 95 },
  { category: 'Ride Assistance Provided', value: 8420, target: 10000, percentage: 84 },
  { category: 'Last-Mile Calls Made', value: 28900, target: 30000, percentage: 96 },
  { category: 'Booth Monitoring Active', value: 208, target: 213, percentage: 98 },
];

const ElectionDayOps = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Election Day Operations</h1>
          <p className="text-muted-foreground mt-2">Real-time monitoring and GOTV tracking</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Overall Turnout" value="78.5%" icon={Vote} variant="success" subtitle="Above target!" />
          <StatCard title="Active Booths" value="208/213" icon={CheckCircle} variant="primary" />
          <StatCard title="Critical Issues" value="2" icon={AlertCircle} variant="warning" />
          <StatCard title="GOTV Success" value="94%" icon={TrendingUp} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Hourly Turnout Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={turnoutByHour}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="turnout" stroke="#10b981" fill="#10b981" fillOpacity={0.6} name="Actual Turnout %" />
                  <Area type="monotone" dataKey="expected" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} name="Expected %" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AC-wise Turnout Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={acWiseTurnout}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="ac" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="current" fill="#3b82f6" name="Current Turnout %" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="target" fill="#f59e0b" name="Target %" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>GOTV Progress Tracker</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {gotvProgress.map((item) => (
                <div key={item.category}>
                  <div className="flex justify-between mb-2">
                    <div>
                      <span className="font-medium">{item.category}</span>
                      <span className="text-sm text-muted-foreground ml-2">
                        {item.value.toLocaleString()} / {item.target.toLocaleString()}
                      </span>
                    </div>
                    <span className="font-semibold">{item.percentage}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full transition-all ${
                        item.percentage >= 95 ? 'bg-success' :
                        item.percentage >= 85 ? 'bg-primary' :
                        'bg-warning'
                      }`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Booth Alerts & Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">Booth ID</th>
                    <th className="text-left p-3">Issue</th>
                    <th className="text-left p-3">Severity</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {boothAlerts.map((alert) => (
                    <tr key={`${alert.booth}-${alert.time}`} className="border-b hover:bg-accent/50">
                      <td className="p-3 font-medium">{alert.booth}</td>
                      <td className="p-3">{alert.issue}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          alert.severity === 'critical' ? 'bg-destructive/20 text-destructive' :
                          alert.severity === 'warning' ? 'bg-warning/20 text-warning' :
                          'bg-muted/50 text-muted-foreground'
                        }`}>
                          {alert.severity.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          alert.status === 'resolved' ? 'bg-success/20 text-success' :
                          alert.status === 'in-progress' ? 'bg-warning/20 text-warning' :
                          'bg-muted/50 text-muted-foreground'
                        }`}>
                          {alert.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground">{alert.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ElectionDayOps;
