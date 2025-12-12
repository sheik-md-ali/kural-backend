import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Search, Users, FileCheck, Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { CONSTITUENCIES, type Constituency } from '@/constants/constituencies';
import { api } from '@/lib/api';

interface ACStats {
  acNumber: number;
  voters: number;
  surveyedMembers: number;
  completion: number;
}

/**
 * ConstituencySelector Component
 * 
 * Displays a searchable grid of all Assembly Constituencies (AC).
 * Users can:
 * - Search by constituency name or number
 * - Click on any constituency card to view detailed information
 * 
 * @returns A dashboard layout with searchable constituency cards
 */
export const ConstituencySelector = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [acStats, setAcStats] = useState<Map<number, ACStats>>(new Map());
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const navigate = useNavigate();

  // Fetch real-time AC stats
  useEffect(() => {
    const fetchACStats = async () => {
      try {
        setIsLoadingStats(true);
        const data = await api.get('/rbac/dashboard/ac-overview');

        if (data.success && data.acPerformance) {
          const statsMap = new Map<number, ACStats>();
          data.acPerformance.forEach((ac: {
            acNumber: number;
            voters: number;
            surveyedMembers: number;
            completion: number;
          }) => {
            statsMap.set(ac.acNumber, {
              acNumber: ac.acNumber,
              voters: ac.voters || 0,
              surveyedMembers: ac.surveyedMembers || 0,
              completion: ac.completion || 0,
            });
          });
          setAcStats(statsMap);
        }
      } catch (error) {
        console.error('Error fetching AC stats:', error);
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchACStats();
  }, []);

  /**
   * Filters constituencies based on search term
   * Matches against both constituency name (case-insensitive) and number
   */
  const filteredConstituencies = filterConstituencies(CONSTITUENCIES, searchTerm);

  /**
   * Handles constituency card click
   * Navigates to the detailed view for the selected constituency
   */
  const handleConstituencyClick = (acNumber: number) => {
    navigate(`/l1/ac/${acNumber}`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-12 p-8">
        {/* Page Header */}
        <PageHeader />

        {/* Search Input */}
        <SearchBar value={searchTerm} onChange={setSearchTerm} />

        {/* Constituency Grid */}
        <ConstituencyGrid
          constituencies={filteredConstituencies}
          onSelect={handleConstituencyClick}
          acStats={acStats}
          isLoadingStats={isLoadingStats}
        />
      </div>
    </DashboardLayout>
  );
};

/**
 * Page header with title and description
 */
const PageHeader = () => (
  <div className="space-y-4">
    <h1 className="text-6xl font-bold tracking-tight bg-gradient-primary bg-clip-text text-transparent">
      Assembly Constituencies
    </h1>
    <p className="text-xl text-muted-foreground font-medium">
      Select a constituency to view detailed information and analytics
    </p>
  </div>
);

/**
 * Search bar component for filtering constituencies
 */
interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

const SearchBar = ({ value, onChange }: SearchBarProps) => (
  <div className="relative max-w-2xl">
    <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
    <Input
      placeholder="Search by constituency name or number..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="pl-14 h-14 text-base shadow-lg border-2 focus:border-primary focus:shadow-xl transition-all rounded-2xl"
    />
  </div>
);

/**
 * Grid of constituency cards
 */
interface ConstituencyGridProps {
  constituencies: Constituency[];
  onSelect: (acNumber: number) => void;
  acStats: Map<number, ACStats>;
  isLoadingStats: boolean;
}

const ConstituencyGrid = ({ constituencies, onSelect, acStats, isLoadingStats }: ConstituencyGridProps) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    {constituencies.map((ac) => (
      <ConstituencyCard
        key={ac.number}
        constituency={ac}
        onClick={() => onSelect(ac.number)}
        stats={acStats.get(ac.number)}
        isLoadingStats={isLoadingStats}
      />
    ))}
  </div>
);

/**
 * Individual constituency card with hover effects and stats
 */
interface ConstituencyCardProps {
  constituency: Constituency;
  onClick: () => void;
  stats?: ACStats;
  isLoadingStats: boolean;
}

const ConstituencyCard = ({ constituency, onClick, stats, isLoadingStats }: ConstituencyCardProps) => (
  <Card
    className="p-5 cursor-pointer hover:shadow-xl transition-all duration-200 border-2 hover:border-primary/50 group bg-card"
    onClick={onClick}
  >
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        {/* Icon */}
        <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-200 flex-shrink-0">
          <MapPin className="h-5 w-5" />
        </div>

        {/* Constituency info */}
        <div className="flex-1 min-w-0">
          <p className="text-xl font-bold text-primary mb-1">
            AC {constituency.number}
          </p>
          <p className="text-sm font-semibold text-foreground/80 group-hover:text-primary transition-colors leading-tight line-clamp-2">
            {constituency.name}
          </p>
        </div>
      </div>

      {/* Stats Section */}
      {isLoadingStats ? (
        <div className="flex items-center justify-center py-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : stats ? (
        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span>Voters</span>
            </div>
            <span className="font-semibold">{stats.voters.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <FileCheck className="h-3.5 w-3.5" />
              <span>Surveyed</span>
            </div>
            <span className="font-semibold">{stats.surveyedMembers.toLocaleString()}</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Completion</span>
              <span className="font-semibold">{stats.completion}%</span>
            </div>
            <Progress value={stats.completion} className="h-1.5" />
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground text-center py-2 border-t">
          No stats available
        </div>
      )}
    </div>
  </Card>
);

/**
 * Utility function to filter constituencies by search term
 * Searches both name (case-insensitive) and number
 */
const filterConstituencies = (
  constituencies: Constituency[],
  searchTerm: string
): Constituency[] => {
  if (!searchTerm.trim()) {
    return constituencies;
  }

  const lowerSearchTerm = searchTerm.toLowerCase();
  
  return constituencies.filter((ac) => 
    ac.name.toLowerCase().includes(lowerSearchTerm) ||
    ac.number.toString().includes(searchTerm)
  );
};
