import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, Filter, Eye } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { VoterDetailDrawer } from '@/components/VoterDetailDrawer';
import API_BASE_URL from '@/lib/api';

interface Voter {
  id: string;
  name: string;
  voterId: string;
  familyId: string;
  booth: string;
  boothNo: number;
  phone: string;
  status: string;
  age?: number;
  gender?: string;
  verified?: boolean;
  surveyed?: boolean;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export const VoterManager = () => {
  const { user } = useAuth();
  const fallbackAcIdentifier = "119";
  const acIdentifier =
    (user?.aciName && user.aciName.trim()) ||
    (user?.assignedAC !== undefined && user?.assignedAC !== null
      ? String(user.assignedAC)
      : fallbackAcIdentifier);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [boothFilter, setBoothFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedVoter, setSelectedVoter] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // API state
  const [voters, setVoters] = useState<Voter[]>([]);
  const [booths, setBooths] = useState<{ boothId: string; boothNo: number; boothName: string; voterCount: number; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  });

  useEffect(() => {
    setPagination({
      page: 1,
      limit: 50,
      total: 0,
      pages: 0
    });
  }, [acIdentifier]);

  // Fetch booths on mount
  useEffect(() => {
    fetchBooths();
  }, [acIdentifier]);

  // Fetch voters when filters change
  useEffect(() => {
    fetchVoters();
  }, [acIdentifier, boothFilter, statusFilter, pagination.page]);

  const fetchBooths = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/voters/${encodeURIComponent(acIdentifier)}/booths`,
        {
          credentials: 'include',
        },
      );

      if (!response.ok) {
        throw new Error('Failed to fetch booths');
      }

      const data = await response.json();
      setBooths(data.booths || []);
    } catch (err) {
      console.error('Error fetching booths:', err);
    }
  };

  const fetchVoters = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (boothFilter && boothFilter !== 'all') {
        params.append('booth', boothFilter);
      }

      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      const response = await fetch(
        `${API_BASE_URL}/voters/${encodeURIComponent(acIdentifier)}?${params}`,
        {
          credentials: 'include',
        },
      );

      if (!response.ok) {
        throw new Error('Failed to fetch voters');
      }

      const data = await response.json();
      setVoters(data.voters || []);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error fetching voters:', err);
      setError(err instanceof Error ? err.message : 'Failed to load voters');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchVoters();
  };

  const handleViewDetails = (voter: Voter) => {
    setSelectedVoter(voter);
    setIsDrawerOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Voter Manager</h1>
          <p className="text-muted-foreground">
            {user?.aciName
              ? `Manage voters for ${user.aciName}`
              : `Manage voters for AC ${user?.assignedAC ?? fallbackAcIdentifier}`}
          </p>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded">
            {error}
          </div>
        )}

        <Card className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by name or voter ID..." 
                className="pl-10" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Select value={boothFilter} onValueChange={setBoothFilter}>
              <SelectTrigger className="w-[350px]">
                <SelectValue placeholder="All Booths" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Booths</SelectItem>
                {booths.map((booth) => (
                  <SelectItem key={booth.boothId} value={booth.boothId}>
                    {booth.boothName} ({booth.voterCount} voters)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Surveyed">Surveyed</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Not Contacted">Not Contacted</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleSearch}>
              <Filter className="mr-2 h-4 w-4" />
              Apply
            </Button>
          </div>
        </Card>

        {/* Pagination Info */}
        {!loading && pagination.total > 0 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total.toLocaleString()} voters
            </div>
            {pagination.pages > 1 && (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                >
                  Previous
                </Button>
                <span className="flex items-center px-3">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page === pagination.pages}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Voter ID</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Family ID</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Booth</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Phone</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      Loading voters...
                    </td>
                  </tr>
                ) : voters.length > 0 ? (
                  voters.map((voter) => (
                    <tr key={voter.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 text-sm font-medium">{voter.name}</td>
                      <td className="px-4 py-3 text-sm">{voter.voterId}</td>
                      <td className="px-4 py-3 text-sm">{voter.familyId}</td>
                      <td className="px-4 py-3 text-sm">{voter.booth}</td>
                      <td className="px-4 py-3 text-sm">{voter.phone}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          voter.status === 'Surveyed' ? 'bg-success/10 text-success' :
                          voter.status === 'Pending' ? 'bg-warning/10 text-warning' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {voter.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" onClick={() => handleViewDetails(voter)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No voters found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <VoterDetailDrawer 
        open={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        voterData={selectedVoter} 
      />
    </DashboardLayout>
  );
};