import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Activity, Clock, Search, RefreshCw, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useCallback } from 'react';
import { CONSTITUENCIES } from '@/constants/constituencies';

interface LiveUpdate {
  id: string;
  voter: string;
  booth: string;
  agent: string;
  timestamp: string;
  activity: string;
  question: string | null;
  acId: number | null;
}

export const LiveBoothUpdates = () => {
  const { user } = useAuth();
  const acNumber = user?.assignedAC || 119;
  const acName = CONSTITUENCIES.find(c => c.number === acNumber)?.name || 'Unknown';

  const [updates, setUpdates] = useState<LiveUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [boothFilter, setBoothFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activityFilter, setActivityFilter] = useState<string>('all');

  const fetchLiveUpdates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/live-updates?acId=${acNumber}&limit=50`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch live updates');
      }

      const data = await response.json();

      if (data.success && Array.isArray(data.updates)) {
        setUpdates(data.updates);
      } else {
        setUpdates([]);
      }
    } catch (err) {
      console.error('Error fetching live updates:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch updates');
      setUpdates([]);
    } finally {
      setLoading(false);
    }
  }, [acNumber]);

  useEffect(() => {
    fetchLiveUpdates();

    // Poll for updates every 30 seconds
    const interval = setInterval(fetchLiveUpdates, 30000);

    return () => clearInterval(interval);
  }, [fetchLiveUpdates]);

  // Get unique booths for filter options
  const uniqueBooths = Array.from(new Set(updates.map(update => update.booth).filter(Boolean)));

  // Get unique activities for filter options
  const uniqueActivities = Array.from(new Set(updates.map(update => update.activity).filter(Boolean)));

  // Filter updates based on selected filters and search term
  const filteredUpdates = updates.filter(update => {
    // Search filter
    const matchesSearch =
      update.voter.toLowerCase().includes(searchTerm.toLowerCase()) ||
      update.agent.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (update.question && update.question.toLowerCase().includes(searchTerm.toLowerCase()));

    // Booth filter
    const matchesBooth = boothFilter === 'all' || update.booth === boothFilter;

    // Activity filter
    const matchesActivity = activityFilter === 'all' || update.activity === activityFilter;

    return matchesSearch && matchesBooth && matchesActivity;
  });

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 flex items-center">
              <Activity className="mr-3 h-8 w-8 text-success animate-pulse" />
              Live Booth Updates
            </h1>
            <p className="text-muted-foreground">Real-time activity from AC {acNumber} - {acName}</p>
          </div>
          <Button
            variant="outline"
            onClick={fetchLiveUpdates}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by voter, agent, or activity..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={boothFilter} onValueChange={setBoothFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filter by Booth" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Booths</SelectItem>
                {uniqueBooths.map(booth => (
                  <SelectItem key={booth} value={booth}>{booth}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={activityFilter} onValueChange={setActivityFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filter by Activity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Activities</SelectItem>
                {uniqueActivities.map(activity => (
                  <SelectItem key={activity} value={activity}>{activity}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {error && (
          <Card className="p-6 border-destructive bg-destructive/10">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-destructive">{error}</p>
            </div>
          </Card>
        )}

        <div className="space-y-4">
          {loading && updates.length === 0 ? (
            <Card className="p-8 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Loading live updates...</p>
            </Card>
          ) : filteredUpdates.length > 0 ? (
            filteredUpdates.map((update) => (
              <Card key={update.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">
                        Live
                      </span>
                      <span className="text-sm text-muted-foreground flex items-center">
                        <Clock className="mr-1 h-3 w-3" />
                        {update.timestamp}
                      </span>
                    </div>

                    <h3 className="text-lg font-semibold mb-2">{update.activity}</h3>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-3">
                      <div>
                        <span className="text-muted-foreground">Voter:</span>
                        <span className="ml-2 font-medium">{update.voter}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Booth:</span>
                        <span className="ml-2 font-medium">{update.booth}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Agent:</span>
                        <span className="ml-2 font-medium">{update.agent}</span>
                      </div>
                    </div>

                    {update.question && (
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">{update.question}</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-8 text-center">
              <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No Recent Activity</h3>
              <p className="text-muted-foreground">
                {searchTerm || boothFilter !== 'all' || activityFilter !== 'all'
                  ? 'No updates match the current filters.'
                  : 'No recent booth activity found for this AC. Activity will appear here when booth agents submit surveys.'}
              </p>
            </Card>
          )}
        </div>

        {filteredUpdates.length > 0 && (
          <p className="text-sm text-muted-foreground text-center">
            Showing {filteredUpdates.length} of {updates.length} updates
          </p>
        )}
      </div>
    </DashboardLayout>
  );
};
