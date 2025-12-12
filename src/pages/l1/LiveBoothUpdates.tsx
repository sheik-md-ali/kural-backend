import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Activity, Clock, Search, RefreshCw, AlertCircle, MapPin, User, Building2, List, Map as MapIcon, Users, FileText, Smartphone, ToggleLeft, ToggleRight, LogIn, LogOut, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { CONSTITUENCIES } from '@/constants/constituencies';
import { useBooths, getBoothLabel } from '@/hooks/use-booths';
import { LeafletMap, type MapMarker, type MapLayerType } from '@/components/maps/LeafletMap';
import { cn } from '@/lib/utils';

// Location data type from API
interface LocationData {
  id: string;
  type: 'activity' | 'mobile' | 'survey';
  latitude: number;
  longitude: number;
  title: string;
  subtitle: string;
  booth_id?: string;
  boothno?: string;
  boothname?: string;
  agent?: string;
  respondent?: string;
  status?: string;
  answerValue?: string;
  timestamp: string;
  color: string;
}

// Grouped location for map display
interface GroupedLocation {
  key: string;
  latitude: number;
  longitude: number;
  items: LocationData[];
  boothname?: string;
}

// Loading skeleton for updates
const UpdateSkeleton = () => (
  <div className="space-y-3">
    {[...Array(5)].map((_, i) => (
      <Card key={i} className="p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      </Card>
    ))}
  </div>
);

// Data type config with descriptive labels - colors match dashboard theme
const DATA_TYPES = {
  activities: {
    label: 'Agent Activities',
    description: 'Login/Logout activities from booth agents',
    icon: Users,
    color: '#8b5cf6', // Violet - matches dashboard primary
    bgClass: 'bg-violet-500'
  },
  mobile: {
    label: 'Master Answers',
    description: 'Responses from mobile app master data collection',
    icon: Smartphone,
    color: '#6366f1', // Indigo - matches Total Members card
    bgClass: 'bg-indigo-500'
  },
  surveys: {
    label: 'Survey Responses',
    description: 'Survey submissions from booth agents',
    icon: FileText,
    color: '#10b981', // Emerald - matches Surveys Completed card
    bgClass: 'bg-emerald-500'
  },
} as const;

// Get activity-specific icon and label - colors match dashboard theme
const getActivityDetails = (item: LocationData) => {
  if (item.type === 'activity') {
    const isLogin = item.subtitle?.toLowerCase().includes('login') || item.status === 'active';
    const isLogout = item.subtitle?.toLowerCase().includes('logout') || item.status === 'logged_out';
    return {
      icon: isLogout ? LogOut : LogIn,
      label: isLogout ? 'Agent Logout' : 'Agent Login',
      statusColor: isLogin ? '#8b5cf6' : '#64748b', // Violet for login, slate for logout
    };
  }
  if (item.type === 'mobile') {
    return {
      icon: Smartphone,
      label: 'Master Answer',
      statusColor: '#6366f1', // Indigo
    };
  }
  return {
    icon: FileText,
    label: 'Survey Response',
    statusColor: '#10b981', // Emerald
  };
};

export const LiveBoothUpdates = () => {
  const { user } = useAuth();

  // L1 (ACIM) can select any AC
  const [selectedAC, setSelectedAC] = useState<number>(CONSTITUENCIES[0]?.number || 111);
  const acName = CONSTITUENCIES.find(c => c.number === selectedAC)?.name || 'Unknown';

  const [locationData, setLocationData] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [boothFilter, setBoothFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('map');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [mapLayer, setMapLayer] = useState<MapLayerType>('osm');
  const [counts, setCounts] = useState({ activities: 0, mobile: 0, surveys: 0, total: 0 });
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
  const [selectedLocationGroup, setSelectedLocationGroup] = useState<GroupedLocation | null>(null);

  // Data source toggles
  const [showActivities, setShowActivities] = useState(true);
  const [showMobile, setShowMobile] = useState(true);
  const [showSurveys, setShowSurveys] = useState(true);

  // Use centralized booth fetching hook
  const { booths, loading: loadingBooths, fetchBooths } = useBooths();

  // Fetch booths when AC changes
  useEffect(() => {
    if (selectedAC) {
      fetchBooths(selectedAC);
      // Reset booth filter when AC changes
      setBoothFilter('all');
    }
  }, [selectedAC, fetchBooths]);

  const fetchLocationData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/dashboard/location-data?acId=${selectedAC}&limit=200`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch location data');
      }

      const data = await response.json();

      if (data.success && Array.isArray(data.data)) {
        setLocationData(data.data);
        setCounts(data.counts || { activities: 0, mobile: 0, surveys: 0, total: 0 });
      } else {
        setLocationData([]);
        setCounts({ activities: 0, mobile: 0, surveys: 0, total: 0 });
      }
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error fetching location data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch location data');
      setLocationData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedAC]);

  useEffect(() => {
    fetchLocationData();

    // Poll for updates every 30 seconds if auto-refresh is enabled
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(fetchLocationData, 30000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchLocationData, autoRefresh]);

  // Handle AC change
  const handleACChange = (value: string) => {
    const acNum = parseInt(value, 10);
    setSelectedAC(acNum);
    setSelectedMarker(null);
    setSelectedLocationGroup(null);
  };

  // Filter data based on toggles, booth, and search
  const filteredData = locationData.filter(item => {
    // Type filter
    if (item.type === 'activity' && !showActivities) return false;
    if (item.type === 'mobile' && !showMobile) return false;
    if (item.type === 'survey' && !showSurveys) return false;

    // Search filter
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm ||
      item.title?.toLowerCase().includes(searchLower) ||
      item.subtitle?.toLowerCase().includes(searchLower) ||
      item.agent?.toLowerCase().includes(searchLower) ||
      item.boothname?.toLowerCase().includes(searchLower);

    // Booth filter
    const matchesBooth = boothFilter === 'all' ||
      item.booth_id === boothFilter ||
      item.boothno === boothFilter;

    return matchesSearch && matchesBooth;
  });

  // Format relative time
  const formatRelativeTime = (timestamp: string) => {
    if (!timestamp) return 'Unknown';
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString();
  };

  // Group items by location (round to 4 decimal places for ~11m precision clustering)
  const groupByLocation = useCallback((items: LocationData[]): GroupedLocation[] => {
    const groups = new Map<string, GroupedLocation>();
    items.forEach(item => {
      // Round to ~11 meter precision for clustering (4 decimal places)
      const key = `${item.latitude.toFixed(4)},${item.longitude.toFixed(4)}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          latitude: item.latitude,
          longitude: item.longitude,
          items: [],
          boothname: item.boothname,
        });
      }
      groups.get(key)!.items.push(item);
    });
    return Array.from(groups.values());
  }, []);

  // Group filtered data by location - memoized for performance
  const locationGroups = useMemo(() => groupByLocation(filteredData), [filteredData, groupByLocation]);

  // Calculate activity breakdown for a group
  const getGroupBreakdown = (items: LocationData[]) => {
    const activities = items.filter(i => i.type === 'activity');
    const logins = activities.filter(i => i.subtitle?.toLowerCase().includes('login') || i.status === 'active').length;
    const logouts = activities.filter(i => i.subtitle?.toLowerCase().includes('logout') || i.status === 'logged_out').length;
    return {
      logins,
      logouts,
      activities: activities.length,
      mobile: items.filter(i => i.type === 'mobile').length,
      surveys: items.filter(i => i.type === 'survey').length,
    };
  };

  // Handle marker click - show activities in the detail panel
  const handleMarkerClick = useCallback((markerId: string) => {
    const group = locationGroups.find(g =>
      g.key === markerId.replace('group-', '') || g.items.some(i => i.id === markerId)
    );
    if (group) {
      setSelectedLocationGroup(group);
      setSelectedMarker(markerId);
    }
  }, [locationGroups]);

  // Convert grouped data to map markers
  const mapMarkers: MapMarker[] = locationGroups.map((group, index) => {
    const hasMultiple = group.items.length > 1;
    const firstItem = group.items[0];
    const breakdown = getGroupBreakdown(group.items);

    // Determine marker color based on dominant activity type
    let markerColor = firstItem.color;
    if (hasMultiple) {
      // Use purple for mixed locations, otherwise use dominant type color
      const types = new Set(group.items.map(i => i.type));
      if (types.size > 1) {
        markerColor = '#8b5cf6'; // Purple for mixed
      } else if (breakdown.mobile > 0) {
        markerColor = '#3b82f6'; // Blue for master answers
      } else if (breakdown.surveys > 0) {
        markerColor = '#f59e0b'; // Amber for surveys
      } else {
        markerColor = '#22c55e'; // Green for agent activities
      }
    }

    const markerId = hasMultiple ? `group-${group.key}` : firstItem.id;

    // Simple popup - just tells user to see details below
    const simplePopup = `
      <div style="font-family: -apple-system, sans-serif; padding: 12px; text-align: center; min-width: 180px;">
        <div style="font-size: 14px; font-weight: 600; color: #1e293b; margin-bottom: 4px;">
          ${hasMultiple ? `${group.items.length} Activities` : firstItem.title}
        </div>
        <div style="font-size: 12px; color: #64748b;">
          ${group.boothname || 'Click to view details below'}
        </div>
      </div>
    `;

    return {
      id: markerId,
      latitude: group.latitude,
      longitude: group.longitude,
      title: hasMultiple ? `${group.items.length} activities` : firstItem.title,
      label: hasMultiple ? String(group.items.length) : '',
      color: markerColor,
      content: simplePopup,
    };
  });

  // Get type icon component
  const getTypeIcon = (type: string) => {
    const config = DATA_TYPES[type as keyof typeof DATA_TYPES];
    return config ? config.icon : Activity;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <MapPin className="h-8 w-8 text-primary" />
              Live Booth Updates
            </h1>
            <p className="text-muted-foreground mt-1">
              Real-time location data across all Assembly Constituencies
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Last refreshed: {lastRefresh.toLocaleTimeString()}
              {autoRefresh && ' (Auto-refresh: 30s)'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={autoRefresh ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="gap-2"
            >
              {autoRefresh ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
              {autoRefresh ? 'Auto ON' : 'Auto OFF'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchLocationData}
              disabled={loading}
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filters & Toggles */}
        <Card className="p-4">
          <div className="space-y-4">
            {/* AC Selector and Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* AC Dropdown - L1 can select any AC */}
              <Select value={String(selectedAC)} onValueChange={handleACChange}>
                <SelectTrigger className="w-full">
                  <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Select AC" />
                </SelectTrigger>
                <SelectContent>
                  {CONSTITUENCIES.map((ac) => (
                    <SelectItem key={ac.number} value={String(ac.number)}>
                      {ac.number} - {ac.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, booth, or agent..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={boothFilter} onValueChange={setBoothFilter} disabled={loadingBooths}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingBooths ? "Loading booths..." : "Filter by Booth"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Booths ({booths.length})</SelectItem>
                  {booths.map(booth => (
                    <SelectItem key={booth._id || booth.boothCode} value={booth.booth_id || booth.boothCode}>
                      {getBoothLabel(booth)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Current AC indicator */}
            <div className="flex items-center gap-4">
              <p className="text-sm text-muted-foreground">
                Viewing: <span className="font-medium text-foreground">AC {selectedAC} - {acName}</span>
              </p>
            </div>
          </div>
        </Card>

        {/* Error Display */}
        {error && (
          <Card className="p-4 border-destructive bg-destructive/10">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-destructive">{error}</p>
            </div>
          </Card>
        )}

        {/* Tabs: Map and List View */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="map" className="flex items-center gap-2">
              <MapIcon className="h-4 w-4" />
              Map View ({mapMarkers.length} locations)
            </TabsTrigger>
            <TabsTrigger value="list" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              List View
            </TabsTrigger>
          </TabsList>

          {/* Map View */}
          <TabsContent value="map" className="mt-4 space-y-4">
            {/* Map Controls Card */}
            <Card className="p-4">
              <div className="space-y-4">
                {/* Layer Toggles - Primary Controls */}
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Data Layers (All Enabled by Default - Click to Toggle)
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(DATA_TYPES).map(([key, config]) => {
                      const isActive = key === 'activities' ? showActivities : key === 'mobile' ? showMobile : showSurveys;
                      const setActive = key === 'activities' ? setShowActivities : key === 'mobile' ? setShowMobile : setShowSurveys;
                      const Icon = config.icon;
                      const count = key === 'activities' ? counts.activities : key === 'mobile' ? counts.mobile : counts.surveys;
                      return (
                        <button
                          key={key}
                          onClick={() => setActive(!isActive)}
                          className={cn(
                            'px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 shadow-sm hover:shadow-lg border-2',
                            isActive
                              ? `${config.bgClass} text-white shadow-md border-transparent`
                              : 'bg-muted/50 text-muted-foreground hover:bg-muted border-muted-foreground/20'
                          )}
                          title={`${isActive ? 'Hide' : 'Show'} ${config.label}`}
                        >
                          <Icon className="h-4 w-4" />
                          <span className="hidden sm:inline">{config.label}</span>
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full font-bold ml-1',
                            isActive ? 'bg-white/30' : 'bg-background/50'
                          )}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Map Style Controls */}
                <div className="pt-4 border-t border-muted/30">
                  <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                    Map Style
                  </p>
                  <div className="flex gap-3 flex-wrap">
                    {[
                      { id: 'osm' as const, label: 'Standard', icon: '🗺️' },
                      { id: 'satellite' as const, label: 'Satellite', icon: '🛰️' },
                      { id: 'terrain' as const, label: 'Terrain', icon: '⛰️' },
                      { id: 'dark' as const, label: 'Dark', icon: '🌙' },
                    ].map(({ id, label, icon }) => (
                      <button
                        key={id}
                        onClick={() => setMapLayer(id)}
                        className={cn(
                          'px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-1.5',
                          mapLayer === id
                            ? 'bg-primary text-primary-foreground shadow-lg scale-105'
                            : 'bg-muted hover:bg-muted/80'
                        )}
                        title={`Switch to ${label} view`}
                      >
                        <span className="text-base">{icon}</span>
                        <span className="hidden sm:inline">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Map Layer Controls */}
            <Card className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="font-semibold">{mapMarkers.length}</span>
                  <span className="text-muted-foreground">location{mapMarkers.length !== 1 ? 's' : ''}</span>
                  {filteredData.length !== mapMarkers.length && (
                    <span className="text-muted-foreground">
                      ({filteredData.length} total activities)
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Last updated: {lastRefresh.toLocaleTimeString()}
                </div>
              </div>
            </Card>

            {/* Map Container */}
            <Card className="overflow-hidden">
              {loading && locationData.length === 0 ? (
                <div className="h-[500px] flex items-center justify-center">
                  <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Loading location data...</p>
                  </div>
                </div>
              ) : mapMarkers.length === 0 ? (
                <div className="h-[500px] flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">No Location Data</h3>
                    <p className="text-muted-foreground text-sm max-w-md">
                      {counts.total === 0
                        ? 'No location data available for this AC. Data will appear when agents submit activities with GPS enabled.'
                        : 'No data matches the current filters. Try adjusting the toggles or search criteria.'}
                    </p>
                  </div>
                </div>
              ) : (
                <LeafletMap
                  markers={mapMarkers}
                  height="500px"
                  fitBounds
                  maxZoom={16}
                  layer={mapLayer}
                  onMarkerClick={(marker) => handleMarkerClick(marker.id)}
                />
              )}
            </Card>

            {/* Map Legend */}
            {mapMarkers.length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Legend & Statistics
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(DATA_TYPES).map(([key, config]) => {
                    const count = key === 'activities' ? counts.activities : key === 'mobile' ? counts.mobile : counts.surveys;
                    if (count === 0) return null;
                    const Icon = config.icon;
                    return (
                      <div key={key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: config.color }}
                          />
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{config.label}</p>
                          <p className="text-xs text-muted-foreground">{count} location{count !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Selected Location Activities Panel */}
            {selectedLocationGroup && (
              <Card className="p-0 overflow-hidden border-2 border-primary/30">
                <div className="bg-gradient-primary text-white p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-lg flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        {selectedLocationGroup.items.length} Activities at this Location
                      </h3>
                      {selectedLocationGroup.boothname && (
                        <p className="text-sm opacity-90 mt-1">Booth: {selectedLocationGroup.boothname}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedLocationGroup(null);
                        setSelectedMarker(null);
                      }}
                      className="text-white hover:bg-white/20"
                    >
                      Close
                    </Button>
                  </div>
                  {/* Activity type badges */}
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {(() => {
                      const breakdown = getGroupBreakdown(selectedLocationGroup.items);
                      return (
                        <>
                          {breakdown.logins > 0 && (
                            <Badge className="bg-white text-green-600 border-0 font-medium">
                              <LogIn className="h-3 w-3 mr-1" /> Login: {breakdown.logins}
                            </Badge>
                          )}
                          {breakdown.logouts > 0 && (
                            <Badge className="bg-white/90 text-gray-600 border-0 font-medium">
                              <LogOut className="h-3 w-3 mr-1" /> Logout: {breakdown.logouts}
                            </Badge>
                          )}
                          {breakdown.mobile > 0 && (
                            <Badge className="bg-white text-blue-600 border-0 font-medium">
                              <Smartphone className="h-3 w-3 mr-1" /> Master: {breakdown.mobile}
                            </Badge>
                          )}
                          {breakdown.surveys > 0 && (
                            <Badge className="bg-white text-amber-600 border-0 font-medium">
                              <FileText className="h-3 w-3 mr-1" /> Survey: {breakdown.surveys}
                            </Badge>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
                {/* Activities List */}
                <div className="max-h-[400px] overflow-y-auto divide-y">
                  {[...selectedLocationGroup.items]
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .map((item, idx) => {
                      const details = getActivityDetails(item);
                      const Icon = details.icon;
                      return (
                        <div key={item.id || idx} className="p-4 hover:bg-muted/50 transition-colors">
                          <div className="flex items-start gap-3">
                            <div
                              className="p-2 rounded-lg flex-shrink-0"
                              style={{ backgroundColor: `${details.statusColor}20` }}
                            >
                              <Icon className="h-4 w-4" style={{ color: details.statusColor }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <Badge
                                  variant="outline"
                                  className="text-xs"
                                  style={{
                                    borderColor: details.statusColor,
                                    color: details.statusColor,
                                  }}
                                >
                                  {details.label}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {formatRelativeTime(item.timestamp)}
                                </span>
                              </div>
                              <h4 className="font-semibold text-sm">{item.title}</h4>
                              <p className="text-sm text-muted-foreground">{item.subtitle}</p>
                              {item.answerValue && (
                                <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-100">
                                  <p className="text-xs text-blue-700 font-medium">Answer: {item.answerValue}</p>
                                </div>
                              )}
                              {item.agent && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  <User className="h-3 w-3 inline mr-1" />
                                  Agent: {item.agent}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
                {/* Footer with coordinates */}
                <div className="p-3 bg-muted/50 border-t text-xs text-muted-foreground flex items-center justify-between">
                  <span>
                    Coordinates: {selectedLocationGroup.latitude.toFixed(6)}, {selectedLocationGroup.longitude.toFixed(6)}
                  </span>
                  <a
                    href={`https://www.google.com/maps?q=${selectedLocationGroup.latitude},${selectedLocationGroup.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    <MapPin className="h-3 w-3" /> Open in Google Maps
                  </a>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* List View */}
          <TabsContent value="list" className="mt-4 space-y-4">
            {/* Summary Stats Cards - matching dashboard style */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="p-4 bg-violet-500 text-white rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90">Agent Activities</p>
                    <p className="text-3xl font-bold">{counts.activities}</p>
                  </div>
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Users className="h-6 w-6" />
                  </div>
                </div>
              </Card>
              <Card className="p-4 bg-indigo-500 text-white rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90">Master Answers</p>
                    <p className="text-3xl font-bold">{counts.mobile}</p>
                  </div>
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Smartphone className="h-6 w-6" />
                  </div>
                </div>
              </Card>
              <Card className="p-4 bg-emerald-500 text-white rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90">Surveys</p>
                    <p className="text-3xl font-bold">{counts.surveys}</p>
                  </div>
                  <div className="p-2 bg-white/20 rounded-lg">
                    <FileText className="h-6 w-6" />
                  </div>
                </div>
              </Card>
              <Card className="p-4 bg-gradient-primary text-white rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90">Locations</p>
                    <p className="text-3xl font-bold">{locationGroups.length}</p>
                  </div>
                  <div className="p-2 bg-white/20 rounded-lg">
                    <MapPin className="h-6 w-6" />
                  </div>
                </div>
              </Card>
            </div>

            {loading && locationData.length === 0 ? (
              <div className="space-y-3">
                <Card className="p-8 text-center bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/50 dark:border-blue-800/50">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
                  <p className="text-sm font-medium text-foreground">Loading location data...</p>
                  <p className="text-xs text-muted-foreground mt-2">This may take a few seconds</p>
                </Card>
                <UpdateSkeleton />
              </div>
            ) : filteredData.length > 0 ? (
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {filteredData.map((item) => {
                  const details = getActivityDetails(item);
                  const Icon = details.icon;
                  const isSelected = selectedMarker === item.id;
                  return (
                    <Card
                      key={item.id}
                      className={cn(
                        "p-4 transition-all duration-200 cursor-pointer border-l-4",
                        isSelected
                          ? "shadow-lg bg-accent/50"
                          : "hover:shadow-md hover:bg-muted/50"
                      )}
                      style={{ borderLeftColor: isSelected ? details.statusColor : 'transparent' }}
                      onClick={() => setSelectedMarker(isSelected ? null : item.id)}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className="p-2.5 rounded-lg flex-shrink-0 flex items-center justify-center"
                          style={{ backgroundColor: `${details.statusColor}20` }}
                        >
                          <Icon className="h-5 w-5" style={{ color: details.statusColor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge
                              variant="outline"
                              className="text-xs font-semibold"
                              style={{
                                borderColor: details.statusColor,
                                color: details.statusColor,
                                backgroundColor: `${details.statusColor}10`
                              }}
                            >
                              {details.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                              <Clock className="h-3 w-3" />
                              {formatRelativeTime(item.timestamp)}
                            </span>
                            {item.status && (
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "text-xs",
                                  item.status === 'active' && "bg-green-100 text-green-700",
                                  item.status === 'logged_out' && "bg-gray-100 text-gray-600"
                                )}
                              >
                                {item.status}
                              </Badge>
                            )}
                          </div>
                          <h4 className="font-semibold text-sm truncate mb-1">{item.title}</h4>
                          <p className="text-sm text-muted-foreground truncate mb-2">{item.subtitle}</p>

                          {/* Answer value for Master Answers */}
                          {item.answerValue && (
                            <div className="mb-2 p-2 bg-blue-50 rounded-md border border-blue-100">
                              <p className="text-xs text-blue-600 font-medium">Answer: {item.answerValue}</p>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                            {item.boothname && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="truncate font-medium">{item.boothname}</span>
                              </div>
                            )}
                            {item.agent && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <User className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="truncate">{item.agent}</span>
                              </div>
                            )}
                            {item.respondent && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <User className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="truncate">{item.respondent}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-muted/50">
                            <div className="text-xs text-muted-foreground">
                              <span className="font-medium">{item.latitude.toFixed(4)}</span>,
                              <span className="font-medium ml-1">{item.longitude.toFixed(4)}</span>
                            </div>
                            <a
                              href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MapPin className="h-3 w-3" />
                              View in Maps
                            </a>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No Data Found</h3>
                <p className="text-muted-foreground mb-4">
                  {counts.total === 0
                    ? 'No location data available yet for this AC. Data will appear when agents submit activities with GPS enabled.'
                    : 'No data matches the current filters. Try:'}
                </p>
                {counts.total > 0 && (
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>Enabling data layer toggles above (all are active by default)</li>
                    <li>Clearing the search term</li>
                    <li>Selecting "All Booths" in the filter</li>
                    <li>Refreshing the page</li>
                  </ul>
                )}
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};
