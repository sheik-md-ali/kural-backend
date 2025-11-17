import { DashboardLayout } from '@/components/DashboardLayout';
import { StatCard } from '@/components/StatCard';
import { ActionButton } from '@/components/ActionButton';
import { Card } from '@/components/ui/card';
import { Users, Home, FileCheck, MapPin, Activity } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import API_BASE_URL from '@/lib/api';

interface DashboardStats {
  acIdentifier: string | null;
  acId: number | null;
  acName: string | null;
  acNumber: number | null;
  totalFamilies: number;
  totalMembers: number;
  surveysCompleted: number;
  totalBooths: number;
  boothStats: Array<{
    boothNo: number;
    boothName: string;
    boothId: string;
    voters: number;
  }>;
}

export const L2Dashboard = () => {
  const { user } = useAuth();
  const fallbackAcIdentifier = "119";
  const acIdentifier =
    (user?.aciName && user.aciName.trim()) ||
    (user?.assignedAC !== undefined && user?.assignedAC !== null
      ? String(user.assignedAC)
      : fallbackAcIdentifier);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardStats();
  }, [acIdentifier]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${API_BASE_URL}/dashboard/stats/${encodeURIComponent(acIdentifier)}`,
        {
        credentials: 'include',
        },
      );

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard statistics');
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Format number with commas
  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const displayAcNumber =
    stats?.acNumber ??
    (user?.assignedAC !== undefined && user?.assignedAC !== null
      ? user.assignedAC
      : Number(stats?.acIdentifier ?? acIdentifier) || undefined);
  const displayAcName = stats?.acName ?? user?.aciName ?? null;
  const constituencyLabel = displayAcName
    ? `Assembly Constituency${displayAcNumber ? ` ${displayAcNumber}` : ''} - ${displayAcName}`
    : displayAcNumber
      ? `Assembly Constituency ${displayAcNumber}`
      : 'Assembly Constituency Overview';

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">My Dashboard</h1>
          <p className="text-xl text-muted-foreground">{constituencyLabel}</p>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Overview Cards - Clean Minimal Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="Total Families" 
            value={loading ? "Loading..." : formatNumber(stats?.totalFamilies || 0)} 
            icon={Home} 
            variant="primary" 
          />
          <StatCard 
            title="Total Members" 
            value={loading ? "Loading..." : formatNumber(stats?.totalMembers || 0)} 
            icon={Users} 
            variant="primary" 
          />
          <StatCard 
            title="Surveys Completed" 
            value={loading ? "Loading..." : formatNumber(stats?.surveysCompleted || 0)} 
            icon={FileCheck} 
            variant="success" 
          />
          <StatCard 
            title="Total Booths" 
            value={loading ? "Loading..." : formatNumber(stats?.totalBooths || 0)} 
            icon={MapPin} 
            variant="warning" 
          />
        </div>

        <Separator />

        {/* Quick Actions */}
        <div>
          <h2 className="text-2xl font-bold mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <ActionButton
              icon={Users}
              title="Voter Manager"
              description="View & update voter details"
              href="/l2/voters"
            />
            <ActionButton
              icon={Home}
              title="Family Manager"
              description="Manage family records"
              href="/l2/families"
            />
            <ActionButton
              icon={FileCheck}
              title="Survey Manager"
              description="Complete or review surveys"
              href="/l2/surveys"
            />
            <ActionButton
              icon={Activity}
              title="Reports"
              description="View booth performance"
              href="/l2/live-updates"
            />
            <ActionButton
              icon={Home}
              title="Booth Management"
              description="Create & update booths"
              href="/shared/booth-management"
            />
          </div>
        </div>

        <Separator />

        {/* Booth Status Monitor */}
        <div>
          <h2 className="text-2xl font-bold mb-6">Booth Status Monitor</h2>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Booth #</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Location</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Voters</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                        Loading booth data...
                      </td>
                    </tr>
                  ) : stats?.boothStats && stats.boothStats.length > 0 ? (
                    stats.boothStats.map((booth, index) => {
                      const boothKey =
                        (booth.boothId ? `${booth.boothId}-${index}` : null) ||
                        `${booth.boothNo ?? 'unknown'}-${booth.boothName ?? 'booth'}-${index}`;
                      return (
                        <tr key={boothKey} className="hover:bg-muted/50">
                          <td className="px-4 py-3 text-sm font-medium">{booth.boothNo}</td>
                          <td className="px-4 py-3 text-sm">{booth.boothName || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm">{formatNumber(booth.voters)}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">
                              Active
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                        No booth data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};
