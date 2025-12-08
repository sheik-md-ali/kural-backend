import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useParams, useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, Filter, Eye, Loader2 } from 'lucide-react';
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

export const ACVoterManager = () => {
  const { acNumber } = useParams();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [boothFilter, setBoothFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
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

  // Fetch booths on mount
  useEffect(() => {
    if (acNumber) {
      fetchBooths();
    }
  }, [acNumber]);

  // Fetch voters when filters change
  useEffect(() => {
    if (acNumber) {
      fetchVoters();
    }
  }, [acNumber, boothFilter, statusFilter, pagination.page]);

  const fetchBooths = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/voters/${acNumber}/booths`, {
        credentials: 'include',
      });

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

      const response = await fetch(`${API_BASE_URL}/voters/${acNumber}?${params}`, {
        credentials: 'include',
      });

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
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/l1/ac/${acNumber}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-4xl font-bold">Voter Manager</h1>
            <p className="text-muted-foreground">AC {acNumber} - Manage voter records</p>
          </div>
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
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Select value={boothFilter} onValueChange={setBoothFilter}>
              <SelectTrigger className="w-[350px]">
                <SelectValue placeholder="All Booths" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Booths ({booths.length})</SelectItem>
                {booths.map((booth) => (
                  <SelectItem key={booth.boothId} value={booth.boothId}>
                    {booth.boothName || booth.label} ({booth.boothNo}) - {booth.voterCount} voters
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
                    <td colSpan={7} className="px-4 py-8 text-center">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Loading voters...
                      </div>
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
                        <Badge variant={voter.status === 'Surveyed' ? 'default' : 'secondary'}>
                          {voter.status}
                        </Badge>
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
