import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useParams, useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, Home, Users, Loader2, Filter } from 'lucide-react';
import { useState, useEffect } from 'react';
import { FamilyDetailDrawer } from '@/components/FamilyDetailDrawer';
import API_BASE_URL from '@/lib/api';

interface Family {
  id: string;
  family_head: string;
  members: number;
  address: string;
  booth: string;
  boothNo: number;
  phone: string;
  status: string;
  voters: any[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export const ACFamilyManager = () => {
  const { acNumber } = useParams();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [boothFilter, setBoothFilter] = useState('all');
  const [selectedFamily, setSelectedFamily] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // API state
  const [families, setFamilies] = useState<Family[]>([]);
  const [booths, setBooths] = useState<{ boothNo: number; boothName: string; label: string; boothId?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 30,
    total: 0,
    pages: 0
  });

  // Fetch booths on mount
  useEffect(() => {
    if (acNumber) {
      fetchBooths();
    }
  }, [acNumber]);

  // Fetch families when filters change
  useEffect(() => {
    if (acNumber) {
      fetchFamilies();
    }
  }, [acNumber, boothFilter, pagination.page]);

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

  const fetchFamilies = async () => {
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

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      const response = await fetch(`${API_BASE_URL}/families/${acNumber}?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch families');
      }

      const data = await response.json();
      setFamilies(data.families || []);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error fetching families:', err);
      setError(err instanceof Error ? err.message : 'Failed to load families');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchFamilies();
  };

  const handleViewDetails = (family: Family) => {
    setSelectedFamily(family);
    setIsDrawerOpen(true);
  };

  // Calculate survey progress for a family (surveyed voters / total voters)
  const getSurveyProgress = (family: Family) => {
    if (!family.voters || family.voters.length === 0) return { surveyed: 0, total: family.members };
    const surveyed = family.voters.filter((v: any) => v.surveyed === true).length;
    return { surveyed, total: family.members };
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/l1/ac/${acNumber}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-4xl font-bold">Family Manager</h1>
            <p className="text-muted-foreground">AC {acNumber} - Manage family records</p>
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
                placeholder="Search by family head or address..."
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
                  <SelectItem key={booth.boothNo} value={booth.boothId || `BOOTH${booth.boothNo}-${acNumber}`}>
                    {booth.boothName || booth.label} ({booth.boothNo})
                  </SelectItem>
                ))}
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
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total.toLocaleString()} families
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

        {loading ? (
          <Card className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading families...</p>
          </Card>
        ) : families.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {families.map((family) => {
              const progress = getSurveyProgress(family);
              return (
                <Card key={family.id} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-lg bg-primary/10">
                          <Home className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{family.id}</h3>
                          <p className="text-sm text-muted-foreground">{family.family_head}</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleViewDetails(family)}>View Details</Button>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground line-clamp-2">{family.address}</p>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          <span>{family.members} members</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Home className="h-4 w-4" />
                          <span>Booth {family.boothNo || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-2 bg-muted rounded text-sm">
                      <p className="text-xs text-muted-foreground mb-1">Booth Location</p>
                      <p className="font-medium text-xs line-clamp-1">{family.booth}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="p-2 bg-muted rounded">
                        <p className="text-xs text-muted-foreground">Phone</p>
                        <p className="font-semibold text-xs">{family.phone !== 'N/A' ? family.phone.replace('+91 ', '') : 'N/A'}</p>
                      </div>
                      <div className="p-2 bg-muted rounded">
                        <p className="text-xs text-muted-foreground">Status</p>
                        <p className={`font-semibold text-xs ${family.status === 'Active' ? 'text-green-600' : 'text-gray-500'}`}>
                          {family.status}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Survey Progress</span>
                        <span className="font-medium">{progress.surveyed}/{progress.total}</span>
                      </div>
                      <Progress value={progress.total > 0 ? (progress.surveyed / progress.total) * 100 : 0} />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No families found for the selected filters.</p>
          </Card>
        )}
      </div>

      <FamilyDetailDrawer
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        familyData={selectedFamily}
        acId={acNumber}
      />
    </DashboardLayout>
  );
};
