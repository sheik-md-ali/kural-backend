import { DashboardLayout } from '@/components/DashboardLayout';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Loader2,
  RefreshCw,
  User,
  Phone,
  MapPin,
  Clock,
  LogIn,
  LogOut,
  Filter,
  Activity
} from 'lucide-react';
import { format } from 'date-fns';
import { CONSTITUENCIES } from '@/constants/constituencies';

interface BoothAgentActivity {
  _id: string;
  id?: string;
  userId?: string;
  userName?: string;
  userPhone?: string;
  booth_id?: string;
  boothname?: string;
  boothno?: string;
  aci_id?: number | string;
  aci_name?: string;
  acId?: number | string;
  loginTime?: string;
  logoutTime?: string;
  timeSpentMinutes?: number;
  status?: 'active' | 'timeout' | 'logout' | 'inactive';
  activityType?: 'login' | 'logout' | 'auto-logout' | 'timeout' | 'session';
  location?: {
    type: string;
    coordinates: number[];
  };
  createdAt?: string;
  updatedAt?: string;
}

interface BoothOption {
  boothId: string;
  booth_id: string;
  boothNo: string;
  boothName: string;
  voterCount?: number;
  displayName?: string;
}

export default function ActivityLogs() {
  const { toast } = useToast();
  const [activities, setActivities] = useState<BoothAgentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAC, setSelectedAC] = useState<string>('111');
  const [selectedBooth, setSelectedBooth] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [booths, setBooths] = useState<BoothOption[]>([]);
  const [loadingBooths, setLoadingBooths] = useState(false);
  const [total, setTotal] = useState(0);

  // Fetch booths when AC changes
  useEffect(() => {
    if (selectedAC && selectedAC !== 'all') {
      fetchBooths(selectedAC);
    } else {
      setBooths([]);
      setSelectedBooth('all');
    }
  }, [selectedAC]);

  // Fetch activities when filters change
  useEffect(() => {
    fetchActivities();
  }, [selectedAC, selectedBooth, selectedStatus]);

  const fetchBooths = async (acId: string) => {
    try {
      setLoadingBooths(true);
      const response = await api.get(`/voters/${acId}/booths`);
      setBooths(response.booths || []);
    } catch (error) {
      console.error('Error fetching booths:', error);
      setBooths([]);
    } finally {
      setLoadingBooths(false);
    }
  };

  const fetchActivities = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      if (selectedAC && selectedAC !== 'all') {
        params.append('acId', selectedAC);
      }
      if (selectedBooth && selectedBooth !== 'all') {
        params.append('boothId', selectedBooth);
      }
      if (selectedStatus && selectedStatus !== 'all') {
        params.append('status', selectedStatus);
      }
      params.append('limit', '200');

      const response = await api.get(`/dashboard/booth-agent-activities?${params.toString()}`);

      if (response.success && response.activities) {
        setActivities(response.activities);
        setTotal(response.total || response.activities.length);
      } else {
        setActivities([]);
        setTotal(0);
      }
    } catch (error: any) {
      console.error('Error fetching booth agent activities:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch booth agent activities',
        variant: 'destructive',
      });
      setActivities([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // Filter activities by search query
  const filteredActivities = activities.filter((activity) => {
    if (!searchQuery.trim()) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      activity.userName?.toLowerCase().includes(searchLower) ||
      activity.userPhone?.includes(searchQuery) ||
      activity.boothname?.toLowerCase().includes(searchLower) ||
      activity.booth_id?.toLowerCase().includes(searchLower)
    );
  });

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Active</Badge>;
      case 'logout':
        return <Badge variant="secondary">Logged Out</Badge>;
      case 'timeout':
        return <Badge variant="outline" className="text-orange-500 border-orange-500">Timeout</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inactive</Badge>;
      default:
        return <Badge variant="outline">{status || '—'}</Badge>;
    }
  };

  const getActivityIcon = (type?: string) => {
    switch (type) {
      case 'login':
        return <LogIn className="h-4 w-4 text-green-500" />;
      case 'logout':
      case 'auto-logout':
        return <LogOut className="h-4 w-4 text-red-500" />;
      case 'timeout':
        return <Clock className="h-4 w-4 text-orange-500" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return '—';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Booth Agent Activity Logs</h1>
            <p className="text-muted-foreground mt-1">
              Monitor booth agent login sessions and activities
            </p>
          </div>
          <Button onClick={fetchActivities} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <Card className="p-6">
          {/* Filters Row */}
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* AC Filter */}
              <Select value={selectedAC} onValueChange={(v) => { setSelectedAC(v); setSelectedBooth('all'); }}>
                <SelectTrigger className="w-full md:w-[220px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Select AC" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Constituencies</SelectItem>
                  {CONSTITUENCIES.map((ac) => (
                    <SelectItem key={ac.number} value={String(ac.number)}>
                      {ac.number} - {ac.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Booth Filter */}
              <Select
                value={selectedBooth}
                onValueChange={setSelectedBooth}
                disabled={selectedAC === 'all' || loadingBooths}
              >
                <SelectTrigger className="w-full md:w-[280px]">
                  <SelectValue placeholder={loadingBooths ? 'Loading booths...' : 'Select Booth'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Booths ({booths.length})</SelectItem>
                  {booths.map((booth) => (
                    <SelectItem key={booth.booth_id} value={booth.booth_id}>
                      {booth.boothName} ({booth.boothNo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-full md:w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="logout">Logged Out</SelectItem>
                  <SelectItem value="timeout">Timeout</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, or booth..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Stats Summary */}
          <div className="flex flex-wrap gap-4 mb-6 text-sm">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-semibold">{total}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md">
              <span className="text-muted-foreground">Showing:</span>
              <span className="font-semibold">{filteredActivities.length}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 rounded-md">
              <span className="text-green-600">Active:</span>
              <span className="font-semibold text-green-600">
                {activities.filter(a => a.status === 'active').length}
              </span>
            </div>
          </div>

          {/* Activities Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-3 text-muted-foreground">Loading activity logs...</p>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Activity className="h-12 w-12 text-muted-foreground mb-2 opacity-50" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No activities found matching your search.' : 'No booth agent activities found.'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Activities will appear here when booth agents log in from the mobile app.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Booth</TableHead>
                    <TableHead>AC</TableHead>
                    <TableHead>Login Time</TableHead>
                    <TableHead>Logout Time</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredActivities.map((activity) => (
                    <TableRow key={activity._id || activity.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{activity.userName || '—'}</div>
                            {activity.userPhone && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {activity.userPhone}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px]">
                          <div className="font-medium truncate" title={activity.boothname}>
                            {activity.boothname || activity.booth_id || '—'}
                          </div>
                          {activity.boothno && (
                            <div className="text-xs text-muted-foreground">
                              {activity.boothno}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">AC {activity.aci_id || activity.acId || '—'}</div>
                          {activity.aci_name && (
                            <div className="text-xs text-muted-foreground">{activity.aci_name}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getActivityIcon('login')}
                          <span className="text-sm">
                            {activity.loginTime
                              ? format(new Date(activity.loginTime), 'MMM dd, HH:mm')
                              : '—'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {activity.logoutTime && getActivityIcon(activity.activityType)}
                          <span className="text-sm">
                            {activity.logoutTime
                              ? format(new Date(activity.logoutTime), 'MMM dd, HH:mm')
                              : '—'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {formatDuration(activity.timeSpentMinutes)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(activity.status)}
                      </TableCell>
                      <TableCell>
                        {activity.location && activity.location.coordinates ? (
                          <div className="flex items-center gap-1 text-xs">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              {activity.location.coordinates[1]?.toFixed(4)},
                              {activity.location.coordinates[0]?.toFixed(4)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">No location</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
