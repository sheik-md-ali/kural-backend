import { DashboardLayout } from '@/components/DashboardLayout';
import { useState, useEffect, useCallback } from 'react';
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
  Activity,
  Building2,
  Users,
  ExternalLink
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
  const [selectedAC, setSelectedAC] = useState<string>('all');
  const [selectedBooth, setSelectedBooth] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [booths, setBooths] = useState<BoothOption[]>([]);
  const [loadingBooths, setLoadingBooths] = useState(false);
  const [total, setTotal] = useState(0);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

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

  const fetchActivities = useCallback(async () => {
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
      setLastRefresh(new Date());
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
  }, [selectedAC, selectedBooth, selectedStatus, toast]);

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

  // Stats calculations
  const activeCount = activities.filter(a => a.status === 'active').length;
  const logoutCount = activities.filter(a => a.status === 'logout').length;
  const timeoutCount = activities.filter(a => a.status === 'timeout').length;

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500 hover:bg-green-600">Active</Badge>;
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
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Activity className="h-8 w-8 text-primary" />
              Booth Agent Activity Logs
            </h1>
            <p className="text-muted-foreground mt-1">
              Monitor booth agent login sessions across all Assembly Constituencies
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Last refreshed: {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
          <Button onClick={fetchActivities} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/40 dark:to-cyan-950/40 border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase">Total Activities</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{total}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500 opacity-60" />
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/40 border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase">Active Now</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">{activeCount}</p>
              </div>
              <div className="h-8 w-8 flex items-center justify-center">
                <div className="h-4 w-4 bg-green-500 rounded-full animate-pulse" />
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-950/40 dark:to-gray-950/40 border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Logged Out</p>
                <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">{logoutCount}</p>
              </div>
              <LogOut className="h-8 w-8 text-slate-500 opacity-60" />
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/40 border-orange-200 dark:border-orange-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase">Timeout</p>
                <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{timeoutCount}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500 opacity-60" />
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col gap-4">
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
                  <Building2 className="h-4 w-4 mr-2" />
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
                <SelectTrigger className="w-full md:w-[180px]">
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
                placeholder="Search by agent name, phone, or booth..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </Card>

        {/* Activities Table */}
        <Card className="p-0 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-3 text-muted-foreground">Loading activities...</p>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Activity className="h-12 w-12 text-muted-foreground mb-2 opacity-50" />
              <p className="text-muted-foreground">
                {searchQuery || selectedBooth !== 'all' || selectedStatus !== 'all' || selectedAC !== 'all'
                  ? 'No activities match the current filters.'
                  : 'No booth agent activities found.'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Activities will appear when booth agents log in from the mobile app.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Agent</TableHead>
                    <TableHead className="font-semibold">Booth</TableHead>
                    <TableHead className="font-semibold">AC</TableHead>
                    <TableHead className="font-semibold">Login</TableHead>
                    <TableHead className="font-semibold">Logout</TableHead>
                    <TableHead className="font-semibold">Duration</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredActivities.map((activity) => (
                    <TableRow key={activity._id || activity.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
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
                            {activity.boothno || activity.booth_id || '—'}
                          </div>
                          {activity.boothname && (
                            <div className="text-xs text-muted-foreground truncate" title={activity.boothname}>
                              {activity.boothname}
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
                          <LogIn className="h-3 w-3 text-green-500" />
                          <span className="text-sm">
                            {activity.loginTime
                              ? format(new Date(activity.loginTime), 'MMM dd, HH:mm')
                              : '—'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {activity.logoutTime ? (
                            <>
                              <LogOut className="h-3 w-3 text-red-500" />
                              <span className="text-sm">
                                {format(new Date(activity.logoutTime), 'MMM dd, HH:mm')}
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
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
                        {activity.location && activity.location.coordinates?.length >= 2 ? (
                          <a
                            href={`https://www.google.com/maps?q=${activity.location.coordinates[1]},${activity.location.coordinates[0]}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <MapPin className="h-3 w-3" />
                            View
                            <ExternalLink className="h-3 w-3" />
                          </a>
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

        {/* Footer */}
        {filteredActivities.length > 0 && (
          <p className="text-sm text-muted-foreground text-center">
            Showing {filteredActivities.length} of {total} activities
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
