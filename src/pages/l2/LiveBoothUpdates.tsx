import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Clock, Search, RefreshCw, AlertCircle, MapPin, User, Building2, List, Map as MapIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useCallback } from 'react';
import { CONSTITUENCIES } from '@/constants/constituencies';
import { useBooths, getBoothLabel } from '@/hooks/use-booths';
import type { LiveUpdate as LiveUpdateType } from '@/utils/normalizedTypes';
import {
  normalizeLiveUpdate,
  formatRelativeTime,
  formatBoothDisplay,
  safeString,
  getAcName,
} from '@/utils/universalMappers';
import { LeafletMap, type MapMarker } from '@/components/maps/LeafletMap';

// Extended LiveUpdate with location for map
interface LiveUpdate extends LiveUpdateType {
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
  } | null;
}

// Loading skeleton for updates
const UpdateSkeleton = () => (
  <div className="space-y-4">
    {[...Array(3)].map((_, i) => (
      <Card key={i} className="p-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-6 w-48" />
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      </Card>
    ))}
  </div>
);

export const LiveBoothUpdates = () => {
  const { user } = useAuth();
  const acNumber = user?.assignedAC || 119;
  const acName = user?.aciName || CONSTITUENCIES.find(c => c.number === acNumber)?.name || 'Unknown';

  const [updates, setUpdates] = useState<LiveUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [boothFilter, setBoothFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('list');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [mapLayer, setMapLayer] = useState<'osm' | 'satellite' | 'terrain' | 'dark'>('osm');

  // Use centralized booth fetching hook
  const { booths, loading: loadingBooths, fetchBooths } = useBooths();

  // Fetch booths when AC changes
  useEffect(() => {
    if (acNumber) {
      fetchBooths(acNumber);
    }
  }, [acNumber, fetchBooths]);

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
        // Normalize updates using universal mapper
        const normalizedUpdates = data.updates.map((u: any) => ({
          ...normalizeLiveUpdate(u),
          location: u.location ? {
            latitude: u.location.latitude,
            longitude: u.location.longitude,
            accuracy: u.location.accuracy,
          } : null,
        }));
        setUpdates(normalizedUpdates);
      } else {
        setUpdates([]);
      }
      setLastRefresh(new Date());
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

    // Poll for updates every 20 seconds if auto-refresh is enabled
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(fetchLiveUpdates, 20000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchLiveUpdates, autoRefresh]);

  // Get unique activities for filter options
  const uniqueActivities = Array.from(new Set(updates.map(update => update.activity).filter(Boolean)));

  // Filter updates based on selected filters and search term
  const filteredUpdates = updates.filter(update => {
    // Search filter
    const matchesSearch =
      safeString(update.voter).toLowerCase().includes(searchTerm.toLowerCase()) ||
      safeString(update.agent).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (update.question && update.question.toLowerCase().includes(searchTerm.toLowerCase()));

    // Booth filter
    const matchesBooth = boothFilter === 'all' || update.booth === boothFilter;

    // Activity filter
    const matchesActivity = activityFilter === 'all' || update.activity === activityFilter;

    return matchesSearch && matchesBooth && matchesActivity;
  });

  // Count updates with location data
  const updatesWithLocation = filteredUpdates.filter(u => u.location?.latitude && u.location?.longitude).length;

  // Get activity distribution
  const activityDistribution = uniqueActivities.map(activity => ({
    activity,
    count: filteredUpdates.filter(u => u.activity === activity).length,
  })).sort((a, b) => b.count - a.count);

  // Convert updates to map markers with better color coding
  const getActivityColor = (activity: string) => {
    const colors: Record<string, string> = {
      'Survey Submitted': '#22c55e',
      'Agent Location': '#3b82f6',
      'Booth Check-in': '#f59e0b',
      'Issue Reported': '#ef4444',
      'Status Update': '#8b5cf6',
      'Response Received': '#10b981',
    };
    return colors[activity] || '#6366f1';
  };

  const mapMarkers: MapMarker[] = filteredUpdates
    .filter(u => u.location?.latitude && u.location?.longitude)
    .map((update, index) => ({
      id: update.id,
      latitude: update.location!.latitude,
      longitude: update.location!.longitude,
      title: `${update.voter} - ${update.booth}`,
      label: String(index + 1),
      color: getActivityColor(update.activity || 'Status Update'),
      content: `
        <div style="padding: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
          <h4 style="font-weight: 700; margin: 0 0 8px 0; font-size: 14px;">${safeString(update.activity)}</h4>
          <div style="border-top: 1px solid #e5e7eb; padding-top: 8px;">
            <p style="margin: 6px 0; font-size: 13px;"><strong>Voter:</strong> ${safeString(update.voter)}</p>
            <p style="margin: 6px 0; font-size: 13px;"><strong>Booth:</strong> ${formatBoothDisplay(null, update.boothno, update.booth_id)}</p>
            <p style="margin: 6px 0; font-size: 13px;"><strong>Agent:</strong> ${safeString(update.agent)}</p>
            <p style="margin: 6px 0; font-size: 13px; color: #666;"><strong>Time:</strong> ${formatRelativeTime(update.timestamp)}</p>
          </div>
        </div>
      `,
    }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Activity className="h-8 w-8 text-green-500 animate-pulse" />
              Live Booth Updates
            </h1>
            <p className="text-muted-foreground mt-1">
              Real-time activity from AC {acNumber} - {acName}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Last refreshed: {lastRefresh.toLocaleTimeString()}
              {autoRefresh && ' (Auto-refresh: 20s)'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={autoRefresh ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            </Button>
            <Button
              variant="outline"
              onClick={fetchLiveUpdates}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filters */}
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
            <Select value={boothFilter} onValueChange={setBoothFilter} disabled={loadingBooths}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={loadingBooths ? "Loading booths..." : "Filter by Booth"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Booths ({booths.length})</SelectItem>
                {booths.map(booth => (
                  <SelectItem key={booth._id || booth.boothCode} value={booth.boothName || booth.boothCode}>
                    {getBoothLabel(booth)}
                  </SelectItem>
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-5 bg-gradient-to-br from-blue-50 via-blue-50 to-cyan-50 dark:from-blue-950/40 dark:via-blue-950/40 dark:to-cyan-950/40 border border-blue-200 dark:border-blue-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Total Updates</p>
                <p className="text-3xl font-bold text-blue-700 dark:text-blue-300 mt-2">{updates.length}</p>
              </div>
              <div className="p-3 bg-white/50 dark:bg-slate-800/50 rounded-lg">
                <Activity className="h-6 w-6 text-blue-500 opacity-70" />
              </div>
            </div>
          </Card>
          <Card className="p-5 bg-gradient-to-br from-green-50 via-green-50 to-emerald-50 dark:from-green-950/40 dark:via-green-950/40 dark:to-emerald-950/40 border border-green-200 dark:border-green-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">With Location</p>
                <p className="text-3xl font-bold text-green-700 dark:text-green-300 mt-2">{updatesWithLocation}</p>
              </div>
              <div className="p-3 bg-white/50 dark:bg-slate-800/50 rounded-lg">
                <MapPin className="h-6 w-6 text-green-500 opacity-70" />
              </div>
            </div>
          </Card>
          <Card className="p-5 bg-gradient-to-br from-purple-50 via-purple-50 to-pink-50 dark:from-purple-950/40 dark:via-purple-950/40 dark:to-pink-950/40 border border-purple-200 dark:border-purple-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">Activities</p>
                <p className="text-3xl font-bold text-purple-700 dark:text-purple-300 mt-2">{uniqueActivities.length}</p>
              </div>
              <div className="p-3 bg-white/50 dark:bg-slate-800/50 rounded-lg">
                <AlertCircle className="h-6 w-6 text-purple-500 opacity-70" />
              </div>
            </div>
          </Card>
          <Card className="p-5 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 dark:from-amber-950/40 dark:via-orange-950/40 dark:to-amber-950/40 border border-amber-200 dark:border-amber-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">Filtered</p>
                <p className="text-3xl font-bold text-amber-700 dark:text-amber-300 mt-2">{filteredUpdates.length}</p>
              </div>
              <div className="p-3 bg-white/50 dark:bg-slate-800/50 rounded-lg">
                <Search className="h-6 w-6 text-amber-500 opacity-70" />
              </div>
            </div>
          </Card>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="p-6 border-destructive bg-destructive/10">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-destructive">{error}</p>
            </div>
          </Card>
        )}

        {/* Tabs: List and Map View */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="list" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              List View
            </TabsTrigger>
            <TabsTrigger value="map" className="flex items-center gap-2">
              <MapIcon className="h-4 w-4" />
              Map View ({updatesWithLocation})
            </TabsTrigger>
          </TabsList>

          {/* List View */}
          <TabsContent value="list" className="mt-4">
            <div className="space-y-4">
              {loading && updates.length === 0 ? (
                <UpdateSkeleton />
              ) : filteredUpdates.length > 0 ? (
                filteredUpdates.map((update) => (
                  <Card key={update.id} className="p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center flex-wrap gap-2 mb-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5 animate-pulse" />
                            Live
                          </span>
                          <span className="text-sm text-muted-foreground flex items-center">
                            <Clock className="mr-1 h-3 w-3" />
                            {formatRelativeTime(update.timestamp)}
                          </span>
                          {update.aci_name && (
                            <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded">
                              {update.aci_name}
                            </span>
                          )}
                        </div>

                        <h3 className="text-lg font-semibold mb-3">{safeString(update.activity)}</h3>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <span className="text-muted-foreground block text-xs">Voter</span>
                              <span className="font-medium">{safeString(update.voter)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <span className="text-muted-foreground block text-xs">Booth</span>
                              <span className="font-medium">{formatBoothDisplay(null, update.boothno, update.booth_id)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <span className="text-muted-foreground block text-xs">Agent</span>
                              <span className="font-medium">{safeString(update.agent)}</span>
                            </div>
                          </div>
                          {update.location?.latitude && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <span className="text-muted-foreground block text-xs">Location</span>
                                <a
                                  href={`https://www.google.com/maps?q=${update.location.latitude},${update.location.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-primary hover:underline text-xs"
                                >
                                  View on Map
                                </a>
                              </div>
                            </div>
                          )}
                        </div>

                        {update.question && (
                          <div className="mt-3 p-3 bg-muted rounded-lg">
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
          </TabsContent>

          {/* Map View */}
          <TabsContent value="map" className="mt-4">
            <div className="space-y-4">
              {/* Map Layer Controls - Above Map */}
              <Card className="p-4 bg-gradient-to-r from-slate-50 to-slate-50 dark:from-slate-900 dark:to-slate-900 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-3">Map Layer</p>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { name: 'Map', id: 'osm' as const, icon: '🗺️' },
                        { name: 'Satellite', id: 'satellite' as const, icon: '🛰️' },
                        { name: 'Terrain', id: 'terrain' as const, icon: '⛰️' },
                        { name: 'Dark', id: 'dark' as const, icon: '🌙' },
                      ].map(({ name, id, icon }) => (
                        <button
                          key={id}
                          onClick={() => setMapLayer(id)}
                          className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
                            mapLayer === id
                              ? 'bg-indigo-600 text-white shadow-lg'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600'
                          }`}
                        >
                          <span>{icon}</span>
                          <span>{name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 text-right">
                    <p>Current: <span className="font-semibold text-slate-700 dark:text-slate-300">{mapLayer.toUpperCase()}</span></p>
                  </div>
                </div>
              </Card>

              {/* Map Container */}
              <Card className="p-0 overflow-hidden">
                {updatesWithLocation === 0 ? (
                  <div className="p-8 text-center">
                    <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">No Location Data</h3>
                    <p className="text-muted-foreground">
                      No updates have location coordinates. Location data will appear on the map when booth agents submit surveys with GPS enabled.
                    </p>
                  </div>
                ) : (
                  <div>
                    <LeafletMap
                      markers={mapMarkers}
                      height="550px"
                      fitBounds
                      maxZoom={15}
                    />
                    <div className="p-4 border-t bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 border-indigo-200 dark:border-indigo-800">
                      <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200 text-center">
                        💡 <strong>Tip:</strong> Use map controls for zoom, pan, and fullscreen. Click markers for location details.
                      </p>
                    </div>
                  </div>
                )}
              </Card>

              {/* Map Legend */}
              {updatesWithLocation > 0 && activityDistribution.length > 0 && (
                <Card className="p-6 bg-gradient-to-r from-slate-50 via-slate-50 to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <div className="space-y-4">
                    <h3 className="font-bold text-lg flex items-center gap-2 text-slate-900 dark:text-slate-50">
                      <MapPin className="h-5 w-5 text-indigo-500" />
                      Activity Legend
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                      {activityDistribution.map(({ activity, count }) => (
                        <div
                          key={activity}
                          className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md transition-all"
                        >
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm ring-1 ring-offset-2 ring-offset-slate-50 dark:ring-offset-slate-900"
                            style={{
                              backgroundColor: getActivityColor(activity),
                              ringColor: getActivityColor(activity) + '33',
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{activity}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                              {count} location{count !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                      <div className="flex items-center justify-between text-sm">
                        <p className="text-slate-600 dark:text-slate-400 font-medium">
                          ✓ Total: <span className="font-bold text-slate-900 dark:text-slate-50">{updatesWithLocation}</span> locations
                        </p>
                        <p className="text-slate-500 dark:text-slate-400 text-xs italic">Click any marker for details</p>
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Summary */}
        {filteredUpdates.length > 0 && (
          <p className="text-sm text-muted-foreground text-center">
            Showing {filteredUpdates.length} of {updates.length} updates
          </p>
        )}
      </div>
    </DashboardLayout>
  );
};
