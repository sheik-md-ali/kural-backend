import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { TrendingUp, TrendingDown, Minus, Loader2, Users, Home, FileCheck, MapPin, UserCheck } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { CONSTITUENCIES } from '@/constants/constituencies';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ACPerformance {
  acNumber: number;
  acName: string | null;
  voters: number;
  surveyedMembers: number;
  families: number;
  booths: number;
  completion: number;
  agents: number;
}

interface ComparisonData {
  acNumber: number;
  name: string;
  voters: number;
  families: number;
  surveys: number;
  booths: number;
  agents: number;
  completion: number;
  surveyRate: number;
  votersPerBooth: number;
  votersPerAgent: number;
  rank: number;
}

export const ComparativeAnalysis = () => {
  const [comparisons, setComparisons] = useState<ComparisonData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bestPerformer, setBestPerformer] = useState<ComparisonData | null>(null);
  const [needsAttention, setNeedsAttention] = useState<ComparisonData | null>(null);
  const [topByEfficiency, setTopByEfficiency] = useState<ComparisonData | null>(null);

  useEffect(() => {
    const fetchComparisonData = async () => {
      try {
        setIsLoading(true);

        // Use the batched ac-overview API for accurate data
        const data = await api.get('/rbac/dashboard/ac-overview');

        if (!data.success || !data.acPerformance) {
          setComparisons([]);
          return;
        }

        const comparisonData: ComparisonData[] = data.acPerformance
          .filter((ac: ACPerformance) => ac.voters > 0)
          .map((ac: ACPerformance, index: number) => {
            const constituency = CONSTITUENCIES.find(c => c.number === ac.acNumber);
            const name = ac.acName || constituency?.name || `AC ${ac.acNumber}`;

            const voters = ac.voters;
            const families = ac.families;
            const surveys = ac.surveyedMembers;
            const booths = ac.booths;
            const agents = ac.agents || 0;
            const completion = ac.completion || 0;

            // Calculate derived metrics
            const surveyRate = voters > 0 ? (surveys / voters) * 100 : 0;
            const votersPerBooth = booths > 0 ? Math.round(voters / booths) : 0;
            const votersPerAgent = agents > 0 ? Math.round(voters / agents) : voters;

            return {
              acNumber: ac.acNumber,
              name,
              voters,
              families,
              surveys,
              booths,
              agents,
              completion,
              surveyRate: parseFloat(surveyRate.toFixed(2)),
              votersPerBooth,
              votersPerAgent,
              rank: 0, // Will be set after sorting
            };
          });

        // Sort by survey rate (best metric for comparison) and assign ranks
        comparisonData.sort((a, b) => b.surveyRate - a.surveyRate);
        comparisonData.forEach((item, index) => {
          item.rank = index + 1;
        });

        setComparisons(comparisonData);

        // Find best performer (highest survey rate)
        if (comparisonData.length > 0) {
          setBestPerformer(comparisonData[0]);

          // Find needs attention (lowest survey rate)
          setNeedsAttention(comparisonData[comparisonData.length - 1]);

          // Find most efficient (best voters per agent ratio - lower is better if agents > 0)
          const withAgents = comparisonData.filter(c => c.agents > 0);
          if (withAgents.length > 0) {
            const efficient = withAgents.reduce((prev, curr) =>
              curr.votersPerAgent < prev.votersPerAgent ? curr : prev
            );
            setTopByEfficiency(efficient);
          }
        }
      } catch (error) {
        console.error('Error fetching comparison data:', error);
        setComparisons([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchComparisonData();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">AC Performance Comparison</h2>
          <p className="text-muted-foreground mt-1">Loading comparison data...</p>
        </div>
        <Card className="p-6">
          <div className="flex items-center justify-center min-h-[200px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </Card>
      </div>
    );
  }

  if (comparisons.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">AC Performance Comparison</h2>
          <p className="text-muted-foreground mt-1">No data available for comparison</p>
        </div>
        <Card className="p-6">
          <p className="text-center text-muted-foreground">
            No ACs with voter data found. Add voter data to see comparisons.
          </p>
        </Card>
      </div>
    );
  }

  // Prepare chart data
  const chartData = comparisons.map(c => ({
    name: `AC ${c.acNumber}`,
    'Survey Rate %': c.surveyRate,
    'Voters (k)': Math.round(c.voters / 1000 * 10) / 10,
    'Surveys': c.surveys,
  }));

  // Summary statistics
  const totalVoters = comparisons.reduce((sum, c) => sum + c.voters, 0);
  const totalSurveys = comparisons.reduce((sum, c) => sum + c.surveys, 0);
  const avgSurveyRate = totalVoters > 0 ? (totalSurveys / totalVoters) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">AC Performance Comparison</h2>
        <p className="text-muted-foreground mt-1">
          Compare performance metrics across all Assembly Constituencies
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Best Performer</p>
              <p className="text-xl font-bold">AC {bestPerformer?.acNumber || '-'}</p>
              <p className="text-xs text-muted-foreground">
                {bestPerformer ? `${bestPerformer.surveyRate}% survey rate` : 'No data'}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
              <TrendingDown className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Needs Attention</p>
              <p className="text-xl font-bold">AC {needsAttention?.acNumber || '-'}</p>
              <p className="text-xs text-muted-foreground">
                {needsAttention ? `${needsAttention.surveyRate}% survey rate` : 'No data'}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <UserCheck className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Best Agent Efficiency</p>
              <p className="text-xl font-bold">AC {topByEfficiency?.acNumber || '-'}</p>
              <p className="text-xs text-muted-foreground">
                {topByEfficiency ? `${topByEfficiency.votersPerAgent} voters/agent` : 'No data'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Chart */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Survey Rate Comparison</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="Survey Rate %" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Detailed Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rank</TableHead>
              <TableHead>AC</TableHead>
              <TableHead className="text-right">Voters</TableHead>
              <TableHead className="text-right">Families</TableHead>
              <TableHead className="text-right">Surveys</TableHead>
              <TableHead className="text-right">Survey Rate</TableHead>
              <TableHead className="text-right">Booths</TableHead>
              <TableHead className="text-right">Agents</TableHead>
              <TableHead className="text-right">Voters/Booth</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparisons.map((comparison) => (
              <TableRow key={comparison.acNumber}>
                <TableCell>
                  <Badge variant={comparison.rank <= 3 ? 'default' : 'secondary'}>
                    #{comparison.rank}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">AC {comparison.acNumber}</p>
                    <p className="text-xs text-muted-foreground">{comparison.name}</p>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {comparison.voters.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {comparison.families.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {comparison.surveys.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <span className={
                    comparison.surveyRate >= 1 ? 'text-green-500' :
                    comparison.surveyRate >= 0.1 ? 'text-yellow-500' : 'text-red-500'
                  }>
                    {comparison.surveyRate}%
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {comparison.booths}
                </TableCell>
                <TableCell className="text-right">
                  {comparison.agents}
                </TableCell>
                <TableCell className="text-right">
                  {comparison.votersPerBooth}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {comparison.surveyRate >= avgSurveyRate ? (
                      <>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-500">Above Avg</span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="h-4 w-4 text-red-500" />
                        <span className="text-sm text-red-500">Below Avg</span>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Summary Stats */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Overall Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <Users className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{totalVoters.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Voters</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <FileCheck className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{totalSurveys.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Surveys</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <TrendingUp className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{avgSurveyRate.toFixed(2)}%</p>
            <p className="text-xs text-muted-foreground">Avg Survey Rate</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <MapPin className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{comparisons.length}</p>
            <p className="text-xs text-muted-foreground">ACs with Data</p>
          </div>
        </div>
      </Card>
    </div>
  );
};
