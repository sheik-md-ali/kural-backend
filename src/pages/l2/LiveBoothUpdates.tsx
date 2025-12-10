import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Activity, Clock, Search, RefreshCw, AlertCircle, MapPin, User, Building2, List, Map as MapIcon, Users, FileText, Smartphone, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useCallback } from 'react';
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

// Data type config
const DATA_TYPES = {
  activities: { label: 'Agent Activities', icon: Users, color: '#22c55e', bgClass: 'bg-green-500' },
  mobile: { label: 'Mobile Responses', icon: Smartphone, color: '#3b82f6', bgClass: 'bg-blue-500' },
  surveys: { label: 'Survey Responses', icon: FileText, color: '#f59e0b', bgClass: 'bg-amber-500' },
} as const;

export const LiveBoothUpdates = () => {
  const { user } = useAuth();
  const acNumber = user?.assignedAC || 111;
  const acName = user?.aciName || CONSTITUENCIES.find(c => c.number === acNumber)?.name || 'Unknown';

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

  // Data source toggles
  const [showActivities, setShowActivities] = useState(true);
  const [showMobile, setShowMobile] = useState(true);
  const [showSurveys, setShowSurveys] = useState(true);

  // Use centralized booth fetching hook
  const { booths, loading: loadingBooths, fetchBooths } = useBooths();

  // Fetch booths when AC changes
  useEffect(() => {
    if (acNumber) {
      fetchBooths(acNumber);
    }
  }, [acNumber, fetchBooths]);

  const fetchLocationData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/dashboard/location-data?acId=${acNumber}&limit=200`, {
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
  }, [acNumber]);

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

  // Convert to map markers
  const mapMarkers: MapMarker[] = filteredData.map((item, index) => ({
    id: item.id,
    latitude: item.latitude,
    longitude: item.longitude,
    title: item.title,
    label: String(index + 1),
    color: item.color,
    content: `
      <div style="padding: 12px; font-family: system-ui, sans-serif; min-width: 200px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <div style="width: 10px; height: 10px; border-radius: 50%; background: ${item.color};"></div>
          <span style="font-weight: 600; font-size: 13px; text-transform: uppercase; color: #64748b;">
            ${item.type === 'activity' ? 'Agent Activity' : item.type === 'mobile' ? 'Mobile Response' : 'Survey'}
          </span>
        </div>
        <h4 style="font-weight: 700; margin: 0 0 8px 0; font-size: 15px; color: #1e293b;">${item.title}</h4>
        <p style="margin: 4px 0; font-size: 13px; color: #475569;">${item.subtitle}</p>
        ${item.boothname ? `<p style="margin: 4px 0; font-size: 12px; color: #64748b;"><strong>Booth:</strong> ${item.boothname}</p>` : ''}
        ${item.status ? `<p style="margin: 4px 0; font-size: 12px; color: #64748b;"><strong>Status:</strong> ${item.status}</p>` : ''}
        <p style="margin: 8px 0 0 0; font-size: 11px; color: #94a3b8;">${formatRelativeTime(item.timestamp)}</p>
      </div>
    `,
  }));

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
              Real-time location data from AC {acNumber} - {acName}
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
            {/* Search and Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              Map View ({filteredData.length})
            </TabsTrigger>
            <TabsTrigger value="list" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              List View
            </TabsTrigger>
          </TabsList>

          {/* Map View */}
          <TabsContent value="map" className="mt-4 space-y-4">
            {/* Map Controls Card */}
            <Card className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
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
                    🗺️ Map Style
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
                  <span className="font-semibold">{filteredData.length}</span>
                  <span className="text-muted-foreground">location{filteredData.length !== 1 ? 's' : ''} displayed</span>
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
              ) : filteredData.length === 0 ? (
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
                  onMarkerClick={(marker) => setSelectedMarker(marker.id)}
                />
              )}
            </Card>

            {/* Map Legend */}
            {filteredData.length > 0 && (
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
          </TabsContent>

          {/* List View */}
          <TabsContent value="list" className="mt-4">
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
              <div className="space-y-2 max-h-[700px] overflow-y-auto">
                {filteredData.map((item) => {
                  const Icon = getTypeIcon(item.type);
                  const config = DATA_TYPES[item.type as keyof typeof DATA_TYPES];
                  const isSelected = selectedMarker === item.id;
                  return (
                    <Card 
                      key={item.id} 
                      className={cn(
                        "p-4 transition-all duration-200 cursor-pointer border-l-4",
                        isSelected 
                          ? "shadow-lg bg-accent/50 border-l-primary" 
                          : "hover:shadow-md border-l-transparent hover:bg-muted/50"
                      )}
                      onClick={() => setSelectedMarker(isSelected ? null : item.id)}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className="p-2.5 rounded-lg flex-shrink-0 flex items-center justify-center"
                          style={{ backgroundColor: `${item.color}20` }}
                        >
                          <Icon className="h-5 w-5" style={{ color: item.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge
                              variant="outline"
                              className="text-xs font-semibold"
                              style={{ 
                                borderColor: item.color, 
                                color: item.color,
                                backgroundColor: `${item.color}10`
                              }}
                            >
                              {config?.label || item.type}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                              <Clock className="h-3 w-3" />
                              {formatRelativeTime(item.timestamp)}
                            </span>
                            {item.status && (
                              <Badge variant="secondary" className="text-xs">
                                {item.status}
                              </Badge>
                            )}
                          </div>
                          <h4 className="font-semibold text-sm truncate mb-1">{item.title}</h4>
                          <p className="text-sm text-muted-foreground truncate mb-2">{item.subtitle}</p>
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
                            {item.answerValue && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Activity className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="truncate">{item.answerValue}</span>
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
                              View
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
                    <li>• Enabling data layer toggles above (all are active by default)</li>
                    <li>• Clearing the search term</li>
                    <li>• Selecting "All Booths" in the filter</li>
                    <li>• Refreshing the page</li>
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
