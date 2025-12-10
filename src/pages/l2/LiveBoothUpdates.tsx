import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Clock, Search, RefreshCw, AlertCircle, MapPin, User, Building2, List, Map as MapIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useCallback, useRef } from 'react';
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

// Google Maps API Key from docs/key.md
const GOOGLE_MAPS_API_KEY = 'AIzaSyCiwZbwy5fgQQ-0E6zFGrdSPWQGh1XVFPQ';

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

  // Map references
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

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

  // Initialize Google Maps
  useEffect(() => {
    if (activeTab !== 'map' || !mapRef.current) return;

    const initMap = () => {
      if (!window.google || !mapRef.current) return;

      // Center on Tamil Nadu (or first location if available)
      const firstWithLocation = updates.find(u => u.location?.latitude && u.location?.longitude);
      const center = firstWithLocation?.location
        ? { lat: firstWithLocation.location.latitude, lng: firstWithLocation.location.longitude }
        : { lat: 11.1271, lng: 78.6569 };

      googleMapRef.current = new google.maps.Map(mapRef.current, {
        zoom: 12,
        center,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
      });
    };

    // Load Google Maps script if not loaded
    if (!window.google) {
      const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`);
      if (!existingScript) {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=marker`;
        script.async = true;
        script.defer = true;
        script.onload = initMap;
        document.head.appendChild(script);
      }
    } else {
      initMap();
    }
  }, [activeTab, updates]);

  // Update map markers when updates change
  const updateMapMarkers = useCallback((updatesToShow: LiveUpdate[]) => {
    if (!googleMapRef.current || !window.google) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    let hasValidLocations = false;

    updatesToShow.forEach((update, index) => {
      if (update.location?.latitude && update.location?.longitude) {
        hasValidLocations = true;
        const position = {
          lat: update.location.latitude,
          lng: update.location.longitude,
        };

        bounds.extend(position);

        const marker = new google.maps.Marker({
          position,
          map: googleMapRef.current,
          title: `${update.voter} - ${update.booth}`,
          label: {
            text: String(index + 1),
            color: 'white',
            fontWeight: 'bold',
          },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: '#22c55e',
            fillOpacity: 1,
            strokeColor: '#16a34a',
            strokeWeight: 2,
          },
        });

        // Info window
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="padding: 8px; min-width: 200px;">
              <h4 style="font-weight: bold; margin: 0 0 8px 0;">${safeString(update.activity)}</h4>
              <p style="margin: 4px 0;"><strong>Voter:</strong> ${safeString(update.voter)}</p>
              <p style="margin: 4px 0;"><strong>Booth:</strong> ${formatBoothDisplay(null, update.boothno, update.booth_id)}</p>
              <p style="margin: 4px 0;"><strong>Agent:</strong> ${safeString(update.agent)}</p>
              <p style="margin: 4px 0; color: #666;"><strong>Time:</strong> ${formatRelativeTime(update.timestamp)}</p>
            </div>
          `,
        });

        marker.addListener('click', () => {
          infoWindow.open(googleMapRef.current, marker);
        });

        markersRef.current.push(marker);
      }
    });

    // Fit bounds if we have valid locations
    if (hasValidLocations && googleMapRef.current) {
      googleMapRef.current.fitBounds(bounds);
      // Don't zoom in too much
      const listener = google.maps.event.addListener(googleMapRef.current, 'idle', () => {
        const currentZoom = googleMapRef.current?.getZoom();
        if (currentZoom && currentZoom > 15) {
          googleMapRef.current?.setZoom(15);
        }
        google.maps.event.removeListener(listener);
      });
    }
  }, []);

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

  // Update markers when filtered updates change
  useEffect(() => {
    if (activeTab === 'map' && googleMapRef.current) {
      updateMapMarkers(filteredUpdates);
    }
  }, [filteredUpdates, activeTab, updateMapMarkers]);

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
                <div
                  ref={mapRef}
                  className="w-full h-[500px]"
                  style={{ minHeight: '500px' }}
                />
              )}
            </Card>
            {updatesWithLocation > 0 && (
              <p className="text-sm text-muted-foreground text-center mt-2">
                Showing {updatesWithLocation} locations on map
              </p>
            )}
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
