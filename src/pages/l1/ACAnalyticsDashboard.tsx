import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Users, Home, FileCheck, MapPin, Search, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { CONSTITUENCIES } from '@/constants/constituencies';
import { api } from '@/lib/api';

interface ACData {
  acNumber: string;
  name: string;
  voters: number;
  families: number;
  surveys: number;
  booths: number;
  completion: number;
}

export const ACAnalyticsDashboard = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('completion');
  const [allACsData, setAllACsData] = useState<ACData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchACData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch real data from the API
        const data = await api.get('/rbac/dashboard/ac-overview');

        if (data.success && data.acPerformance) {
          // Map API data to our format, enriching with constituency names
          const mappedData: ACData[] = data.acPerformance.map((ac: {
            acNumber: number;
            acName: string | null;
            voters: number;
            surveyedMembers: number;
            families: number;
            booths: number;
            completion: number;
            agents: number;
          }) => {
            const constituency = CONSTITUENCIES.find(c => c.number === ac.acNumber);
            return {
              acNumber: String(ac.acNumber),
              name: ac.acName || constituency?.name || `AC ${ac.acNumber}`,
              voters: ac.voters || 0,
              families: ac.families || 0, // Use actual families from API
              surveys: ac.surveyedMembers || 0,
              booths: ac.booths || 0, // Use actual booths from API
              completion: ac.completion || 0,
            };
          });

          setAllACsData(mappedData);
        } else {
          // Fallback to constituency list with zeros if API returns no data
          const fallbackData: ACData[] = CONSTITUENCIES.map(c => ({
            acNumber: String(c.number),
            name: c.name,
            voters: 0,
            families: 0,
            surveys: 0,
            booths: 0,
            completion: 0,
          }));
          setAllACsData(fallbackData);
        }
      } catch (err) {
        console.error('Error fetching AC data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');

        // Fallback to constituency list with zeros on error
        const fallbackData: ACData[] = CONSTITUENCIES.map(c => ({
          acNumber: String(c.number),
          name: c.name,
          voters: 0,
          families: 0,
          surveys: 0,
          booths: 0,
          completion: 0,
        }));
        setAllACsData(fallbackData);
      } finally {
        setIsLoading(false);
      }
    };

    fetchACData();
  }, []);

  const getPerformanceColor = (completion: number) => {
    if (completion >= 80) return 'success';
    if (completion >= 60) return 'warning';
    return 'destructive';
  };

  const getPerformanceLabel = (completion: number) => {
    if (completion >= 80) return 'High';
    if (completion >= 60) return 'Medium';
    return 'Low';
  };

  const filteredAndSortedACs = allACsData
    .filter((ac) =>
      ac.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ac.acNumber.includes(searchQuery)
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'completion':
          return b.completion - a.completion;
        case 'voters':
          return b.voters - a.voters;
        case 'surveys':
          return b.surveys - a.surveys;
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading AC data...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold mb-2">AC Analytics Dashboard</h1>
          <p className="text-xl text-muted-foreground">
            Overview of {allACsData.length} Assembly Constituencies
            {error && <span className="text-destructive text-sm ml-2">(Some data may be unavailable)</span>}
          </p>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by AC name or number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="completion">Completion Rate</SelectItem>
              <SelectItem value="voters">Total Voters</SelectItem>
              <SelectItem value="surveys">Surveys Completed</SelectItem>
              <SelectItem value="name">Name (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* AC Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredAndSortedACs.map((ac) => (
            <Card
              key={ac.acNumber}
              className="p-6 hover:shadow-lg transition-all cursor-pointer hover:scale-105 border-2 hover:border-primary"
              onClick={() => navigate(`/l1/ac/${ac.acNumber}`)}
            >
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold">AC {ac.acNumber}</h3>
                    <p className="text-sm text-muted-foreground">{ac.name}</p>
                  </div>
                  <Badge variant={getPerformanceColor(ac.completion) as any}>
                    {getPerformanceLabel(ac.completion)}
                  </Badge>
                </div>

                {/* Completion Percentage */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">Completion</span>
                    <span className="text-sm font-bold">{ac.completion}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        ac.completion >= 80
                          ? 'bg-success'
                          : ac.completion >= 60
                          ? 'bg-warning'
                          : 'bg-destructive'
                      }`}
                      style={{ width: `${ac.completion}%` }}
                    />
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                    <Users className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Voters</p>
                      <p className="text-sm font-bold">{ac.voters.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                    <Home className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Families</p>
                      <p className="text-sm font-bold">{ac.families}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                    <FileCheck className="h-4 w-4 text-success" />
                    <div>
                      <p className="text-xs text-muted-foreground">Surveys</p>
                      <p className="text-sm font-bold">{ac.surveys}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                    <MapPin className="h-4 w-4 text-warning" />
                    <div>
                      <p className="text-xs text-muted-foreground">Booths</p>
                      <p className="text-sm font-bold">{ac.booths}</p>
                    </div>
                  </div>
                </div>

                {/* Trend Indicator */}
                <div className="flex items-center justify-center gap-2 pt-2 border-t">
                  {ac.completion >= 75 ? (
                    <>
                      <TrendingUp className="h-4 w-4 text-success" />
                      <span className="text-xs text-success font-medium">On Track</span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="h-4 w-4 text-warning" />
                      <span className="text-xs text-warning font-medium">Needs Attention</span>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Summary Stats */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Overall Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-2xl font-bold text-primary">{allACsData.length}</p>
              <p className="text-sm text-muted-foreground">Total ACs</p>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-2xl font-bold text-primary">
                {allACsData.reduce((sum, ac) => sum + ac.voters, 0).toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">Total Voters</p>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-2xl font-bold text-success">
                {allACsData.reduce((sum, ac) => sum + ac.surveys, 0).toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">Surveys Done</p>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-2xl font-bold text-warning">
                {Math.round(allACsData.reduce((sum, ac) => sum + ac.completion, 0) / allACsData.length)}%
              </p>
              <p className="text-sm text-muted-foreground">Avg Completion</p>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-2xl font-bold text-primary">
                {allACsData.reduce((sum, ac) => sum + ac.booths, 0)}
              </p>
              <p className="text-sm text-muted-foreground">Total Booths</p>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};
