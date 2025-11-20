import { useState, useEffect } from 'react';
import { useActivityLog, ActivityAction, EntityType, ActivityLog as ActivityLogType } from '@/contexts/ActivityLogContext';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Badge } from './ui/badge';
import { Search, Download, Calendar, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

const actionColors: Record<ActivityAction, string> = {
  create: 'bg-green-500/10 text-green-500',
  update: 'bg-blue-500/10 text-blue-500',
  delete: 'bg-red-500/10 text-red-500',
  view: 'bg-gray-500/10 text-gray-500',
  export: 'bg-purple-500/10 text-purple-500',
  assign: 'bg-yellow-500/10 text-yellow-500',
  login: 'bg-cyan-500/10 text-cyan-500',
  logout: 'bg-orange-500/10 text-orange-500',
};

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

export const ActivityLog = () => {
  const { getFilteredActivities } = useActivityLog();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<ActivityAction | 'all'>('all');
  const [entityFilter, setEntityFilter] = useState<EntityType | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [boothAgentActivities, setBoothAgentActivities] = useState<BoothAgentActivity[]>([]);
  const [loadingBoothAgents, setLoadingBoothAgents] = useState(false);
  const itemsPerPage = 20;

  // Fetch booth agent activities
  useEffect(() => {
    fetchBoothAgentActivities();
  }, []);

  const fetchBoothAgentActivities = async () => {
    try {
      setLoadingBoothAgents(true);
      const response = await api.get('/rbac/booth-agents');
      
      if (response.success && response.agents) {
        setBoothAgentActivities(response.agents || []);
      }
    } catch (error: any) {
      console.error('Error fetching booth agent activities:', error);
      // Don't show toast for this as it's a background fetch
    } finally {
      setLoadingBoothAgents(false);
    }
  };

  // Convert booth agent activities to activity log format
  const convertBoothAgentsToActivities = (agents: BoothAgentActivity[]): ActivityLogType[] => {
    return agents.flatMap((agent) => {
      const activities: ActivityLogType[] = [];
      
      // Activity for agent creation
      if (agent.createdAt) {
        activities.push({
          id: `booth_agent_${agent._id}_created`,
          timestamp: new Date(agent.createdAt),
          userId: agent._id,
          userName: agent.name || 'Unknown Agent',
          userRole: 'L9' as const, // Booth Agent role mapped to L9 for display
          action: 'create' as ActivityAction,
          entityType: 'agent' as EntityType,
          entityId: agent._id,
          details: `Booth Agent ${agent.name || agent.booth_agent_id || 'Unknown'} created${agent.assignedAC ? ` in AC ${agent.assignedAC}` : ''}${typeof agent.assignedBoothId === 'object' && agent.assignedBoothId ? ` - Assigned to ${agent.assignedBoothId.boothName} (${agent.assignedBoothId.boothCode})` : ''}`,
          metadata: {
            boothAgentId: agent.booth_agent_id,
            phone: agent.phone,
            email: agent.email,
          },
          acNumber: agent.assignedAC,
        });
      }

      // Activity for agent update if updatedAt differs from createdAt
      if (agent.updatedAt && agent.updatedAt !== agent.createdAt) {
        const updatedDetails = [];
        if (typeof agent.assignedBoothId === 'object' && agent.assignedBoothId) {
          updatedDetails.push(`Assigned to ${agent.assignedBoothId.boothName} (${agent.assignedBoothId.boothCode})`);
        }
        if (agent.status) {
          updatedDetails.push(`Status: ${agent.status}`);
        }
        
        if (updatedDetails.length > 0 || agent.updatedAt) {
          activities.push({
            id: `booth_agent_${agent._id}_updated`,
            timestamp: new Date(agent.updatedAt),
            userId: agent._id,
            userName: agent.name || 'Unknown Agent',
            userRole: 'L9' as const,
            action: 'update' as ActivityAction,
            entityType: 'agent' as EntityType,
            entityId: agent._id,
            details: `Booth Agent ${agent.name || agent.booth_agent_id || 'Unknown'} updated${updatedDetails.length > 0 ? ` - ${updatedDetails.join(', ')}` : ''}`,
            metadata: {
              boothAgentId: agent.booth_agent_id,
              status: agent.status,
              isActive: agent.isActive,
            },
            acNumber: agent.assignedAC,
          });
        }
      }

      return activities;
    });
  };

  const filters: any = {};
  if (actionFilter !== 'all') filters.action = actionFilter;
  if (entityFilter !== 'all') filters.entityType = entityFilter;

  // Get activities from context
  let contextActivities = getFilteredActivities(filters);
  
  // Convert booth agent activities and merge with context activities
  const boothAgentActivityLogs = convertBoothAgentsToActivities(boothAgentActivities);
  
  // Merge and sort all activities by timestamp
  let activities = [...contextActivities, ...boothAgentActivityLogs].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );

  // Search filter
  if (searchQuery) {
    activities = activities.filter(
      a =>
        a.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.userName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  // Pagination
  const totalPages = Math.ceil(activities.length / itemsPerPage);
  const paginatedActivities = activities.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleExport = () => {
    const csv = [
      ['Timestamp', 'User', 'Role', 'Action', 'Entity', 'Details', 'IP Address'],
      ...activities.map(a => [
        format(a.timestamp, 'yyyy-MM-dd HH:mm:ss'),
        a.userName,
        a.userRole,
        a.action,
        a.entityType,
        a.details,
        a.ipAddress || 'N/A',
      ]),
    ]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as any)}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="create">Create</SelectItem>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
              <SelectItem value="view">View</SelectItem>
              <SelectItem value="export">Export</SelectItem>
              <SelectItem value="assign">Assign</SelectItem>
              <SelectItem value="login">Login</SelectItem>
              <SelectItem value="logout">Logout</SelectItem>
            </SelectContent>
          </Select>
          <Select value={entityFilter} onValueChange={(v) => setEntityFilter(v as any)}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Entity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              <SelectItem value="voter">Voter</SelectItem>
              <SelectItem value="family">Family</SelectItem>
              <SelectItem value="survey">Survey</SelectItem>
              <SelectItem value="booth">Booth</SelectItem>
              <SelectItem value="agent">Agent</SelectItem>
              <SelectItem value="form">Form</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="moderator">Moderator</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={fetchBoothAgentActivities} 
            variant="outline"
            disabled={loadingBoothAgents}
            title="Refresh booth agent activities"
          >
            {loadingBoothAgents ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Refresh
          </Button>
          <Button onClick={handleExport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Timestamp</TableHead>
                <TableHead className="whitespace-nowrap">User</TableHead>
                <TableHead className="whitespace-nowrap">Action</TableHead>
                <TableHead className="whitespace-nowrap">Entity</TableHead>
                <TableHead className="whitespace-nowrap min-w-[200px]">Details</TableHead>
                {user?.role === 'L0' && <TableHead className="whitespace-nowrap">IP Address</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedActivities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={user?.role === 'L0' ? 6 : 5} className="text-center py-8 text-muted-foreground">
                    No activities found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedActivities.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {format(activity.timestamp, 'MMM dd, HH:mm')}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div>
                        <p className="text-sm font-medium">{activity.userName}</p>
                        <p className="text-xs text-muted-foreground">
                          {activity.userRole === 'L9' ? 'Booth Agent' : activity.userRole}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge className={actionColors[activity.action]}>
                        {activity.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{activity.entityType}</TableCell>
                    <TableCell className="text-sm max-w-md truncate">{activity.details}</TableCell>
                    {user?.role === 'L0' && (
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {activity.ipAddress || 'N/A'}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
          </div>
          <Button
            variant="outline"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};
