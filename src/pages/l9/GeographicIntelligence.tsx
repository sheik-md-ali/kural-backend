import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/StatCard';
import { Map, MapPin, TrendingUp, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, Cell } from 'recharts';

const acPerformanceData = [
  { ac: 'AC-001', performance: 85, booths: 45, agents: 120, turnout: 72 },
  { ac: 'AC-002', performance: 78, booths: 38, agents: 95, turnout: 68 },
  { ac: 'AC-003', performance: 92, booths: 52, agents: 140, turnout: 78 },
  { ac: 'AC-004', performance: 65, booths: 30, agents: 80, turnout: 61 },
  { ac: 'AC-005', performance: 88, booths: 48, agents: 125, turnout: 75 },
];

const boothStatus = [
  { booth: 'B001', status: 'active', voters: 850, contacted: 680, completion: 80 },
  { booth: 'B002', status: 'active', voters: 920, contacted: 750, completion: 82 },
  { booth: 'B003', status: 'critical', voters: 780, contacted: 350, completion: 45 },
  { booth: 'B004', status: 'active', voters: 1050, contacted: 890, completion: 85 },
  { booth: 'B005', status: 'warning', voters: 650, contacted: 420, completion: 65 },
];

const GeographicIntelligence = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Geographic & Booth Intelligence</h1>
          <p className="text-muted-foreground mt-2">Location-based campaign performance and booth-level insights</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Booths" value="213" icon={MapPin} variant="primary" />
          <StatCard title="Active Booths" value="198" icon={MapPin} variant="success" subtitle="93% operational" />
          <StatCard title="Critical Booths" value="8" icon={MapPin} variant="warning" subtitle="Need attention" />
          <StatCard title="Avg Completion" value="74%" icon={TrendingUp} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>AC-wise Performance Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={acPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="ac" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="performance" fill="#3b82f6" name="Performance Score" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="turnout" fill="#10b981" name="Turnout %" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Booth Performance Scatter</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="voters" name="Total Voters" />
                  <YAxis dataKey="completion" name="Completion %" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Legend />
                  <Scatter name="Booths" data={boothStatus} fill="#3b82f6">
                    {boothStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={
                        entry.status === 'critical' ? '#ef4444' :
                        entry.status === 'warning' ? '#f59e0b' :
                        '#10b981'
                      } />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Booth Status Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">Booth ID</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-right p-3">Total Voters</th>
                    <th className="text-right p-3">Contacted</th>
                    <th className="text-right p-3">Completion %</th>
                  </tr>
                </thead>
                <tbody>
                  {boothStatus.map((booth) => (
                    <tr key={booth.booth} className="border-b hover:bg-accent/50">
                      <td className="p-3 font-medium">{booth.booth}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          booth.status === 'active' ? 'bg-success/20 text-success' :
                          booth.status === 'warning' ? 'bg-warning/20 text-warning' :
                          'bg-destructive/20 text-destructive'
                        }`}>
                          {booth.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="text-right p-3">{booth.voters.toLocaleString()}</td>
                      <td className="text-right p-3">{booth.contacted.toLocaleString()}</td>
                      <td className="text-right p-3 font-semibold">{booth.completion}%</td>
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

export default GeographicIntelligence;
