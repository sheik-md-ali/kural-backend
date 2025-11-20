import { DashboardLayout } from '@/components/DashboardLayout';
import { ActivityLog } from '@/components/ActivityLog';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Calendar, User, Phone, Building2, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface BoothAgentActivity {
  _id: string;
  name: string;
  phone: string;
  email: string;
  booth_agent_id?: string;
  booth_id?: string;
  assignedAC?: number;
  aci_name?: string;
  assignedBoothId?: {
    _id: string;
    boothName: string;
    boothCode: string;
  } | string;
  status?: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ActivityLogs() {
  const { toast } = useToast();
  const [boothAgentActivities, setBoothAgentActivities] = useState<BoothAgentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredActivities, setFilteredActivities] = useState<BoothAgentActivity[]>([]);

  useEffect(() => {
    fetchBoothAgentActivities();
  }, []);

  useEffect(() => {
    // Filter activities based on search query
    if (searchQuery.trim() === '') {
      setFilteredActivities(boothAgentActivities);
    } else {
      const filtered = boothAgentActivities.filter((activity) => {
        const searchLower = searchQuery.toLowerCase();
        return (
          activity.name?.toLowerCase().includes(searchLower) ||
          activity.phone?.includes(searchQuery) ||
          activity.booth_agent_id?.toLowerCase().includes(searchLower) ||
          activity.email?.toLowerCase().includes(searchLower) ||
          (typeof activity.assignedBoothId === 'object' && activity.assignedBoothId?.boothName?.toLowerCase().includes(searchLower)) ||
          (typeof activity.assignedBoothId === 'object' && activity.assignedBoothId?.boothCode?.toLowerCase().includes(searchLower))
        );
      });
      setFilteredActivities(filtered);
    }
  }, [searchQuery, boothAgentActivities]);

  const fetchBoothAgentActivities = async () => {
    try {
      setLoading(true);
      const response = await api.get('/rbac/booth-agents');
      
      if (response.success && response.agents) {
        // Sort by creation date (newest first)
        const sortedActivities = response.agents.sort((a: BoothAgentActivity, b: BoothAgentActivity) => {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        setBoothAgentActivities(sortedActivities);
        setFilteredActivities(sortedActivities);
      } else {
        setBoothAgentActivities([]);
        setFilteredActivities([]);
      }
    } catch (error: any) {
      console.error('Error fetching booth agent activities:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch booth agent activities',
        variant: 'destructive',
      });
      setBoothAgentActivities([]);
      setFilteredActivities([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">System Activity Logs</h1>
          <p className="text-muted-foreground mt-2">
            Monitor all system activities across all users and roles
          </p>
        </div>

        {/* Booth Agent Activities Section */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold">Booth Agent Activities</h2>
              <p className="text-muted-foreground mt-1">
                View all booth agent activities and assignments
              </p>
            </div>
            <Button 
              onClick={fetchBoothAgentActivities} 
              variant="outline"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                'Refresh'
              )}
            </Button>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, booth agent ID, email, or booth name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Activities Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-3 text-muted-foreground">Loading booth agent activities...</p>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <User className="h-12 w-12 text-muted-foreground mb-2 opacity-50" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No booth agent activities found matching your search.' : 'No booth agent activities found.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booth Agent ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Assigned Booth</TableHead>
                    <TableHead>AC</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredActivities.map((activity) => (
                    <TableRow key={activity._id}>
                      <TableCell className="font-mono text-sm">
                        {activity.booth_agent_id || '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{activity.name || '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{activity.phone || '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell>{activity.email || '—'}</TableCell>
                      <TableCell>
                        {typeof activity.assignedBoothId === 'object' && activity.assignedBoothId ? (
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{activity.assignedBoothId.boothName}</div>
                              <div className="text-xs text-muted-foreground">
                                {activity.assignedBoothId.boothCode}
                              </div>
                            </div>
                          </div>
                        ) : activity.assignedBoothId ? (
                          <Badge variant="outline">Booth Assigned</Badge>
                        ) : (
                          <Badge variant="secondary">Not Assigned</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          {activity.assignedAC ? (
                            <>
                              <div className="font-medium">AC {activity.assignedAC}</div>
                              {activity.aci_name && (
                                <div className="text-xs text-muted-foreground">{activity.aci_name}</div>
                              )}
                            </>
                          ) : (
                            '—'
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            activity.isActive && activity.status === 'Active'
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {activity.status || (activity.isActive ? 'Active' : 'Inactive')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span>
                            {activity.createdAt
                              ? format(new Date(activity.createdAt), 'MMM dd, yyyy')
                              : '—'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span>
                            {activity.updatedAt
                              ? format(new Date(activity.updatedAt), 'MMM dd, yyyy HH:mm')
                              : '—'}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {!loading && filteredActivities.length > 0 && (
            <div className="mt-4 text-sm text-muted-foreground">
              Showing {filteredActivities.length} of {boothAgentActivities.length} booth agent activities
            </div>
          )}
        </Card>

        <ActivityLog />
      </div>
    </DashboardLayout>
  );
}
