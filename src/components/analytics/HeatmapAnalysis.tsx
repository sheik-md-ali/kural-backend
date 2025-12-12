import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { CONSTITUENCIES } from '@/constants/constituencies';
import { Loader2 } from 'lucide-react';

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

interface HeatmapData {
  acNumber: number;
  name: string;
  completion: number;
  surveys: number;
  voters: number;
  families: number;
  agents: number;
  category: 'excellent' | 'good' | 'average' | 'poor' | 'critical' | 'no-data';
}

const getCategoryColor = (category: HeatmapData['category']) => {
  switch (category) {
    case 'excellent':
      return 'bg-green-500 hover:bg-green-600';
    case 'good':
      return 'bg-blue-500 hover:bg-blue-600';
    case 'average':
      return 'bg-yellow-500 hover:bg-yellow-600';
    case 'poor':
      return 'bg-orange-500 hover:bg-orange-600';
    case 'critical':
      return 'bg-red-500 hover:bg-red-600';
    case 'no-data':
      return 'bg-gray-400 hover:bg-gray-500';
  }
};

// Survey rate thresholds for performance bands
const getPerformanceBand = (surveyRate: number, hasData: boolean): HeatmapData['category'] => {
  if (!hasData) return 'no-data';
  if (surveyRate >= 5) return 'excellent';     // 5%+ surveyed
  if (surveyRate >= 2) return 'good';          // 2-5% surveyed
  if (surveyRate >= 0.5) return 'average';     // 0.5-2% surveyed
  if (surveyRate >= 0.1) return 'poor';        // 0.1-0.5% surveyed
  return 'critical';                            // <0.1% surveyed
};

export const HeatmapAnalysis = () => {
  const navigate = useNavigate();
  const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAllACData = async () => {
      try {
        setIsLoading(true);

        // Use the batched ac-overview API for accurate data
        const data = await api.get('/rbac/dashboard/ac-overview');

        // Create a map of API data for quick lookup
        const apiDataMap = new Map<number, ACPerformance>();
        if (data.success && data.acPerformance) {
          data.acPerformance.forEach((ac: ACPerformance) => {
            apiDataMap.set(ac.acNumber, ac);
          });
        }

        // Merge with all CONSTITUENCIES to show complete picture
        const results: HeatmapData[] = CONSTITUENCIES.map(constituency => {
          const apiAC = apiDataMap.get(constituency.number);

          if (apiAC && apiAC.voters > 0) {
            const surveyRate = (apiAC.surveyedMembers / apiAC.voters) * 100;
            return {
              acNumber: constituency.number,
              name: apiAC.acName || constituency.name,
              completion: apiAC.completion || 0,
              surveys: apiAC.surveyedMembers,
              voters: apiAC.voters,
              families: apiAC.families,
              agents: apiAC.agents || 0,
              category: getPerformanceBand(surveyRate, true),
            };
          }

          // No data for this AC
          return {
            acNumber: constituency.number,
            name: constituency.name,
            completion: 0,
            surveys: 0,
            voters: 0,
            families: 0,
            agents: 0,
            category: 'no-data' as const,
          };
        });

        setHeatmapData(results);
      } catch (error) {
        console.error('Error fetching heatmap data:', error);
        // Fallback to showing all ACs with no data
        const fallback = CONSTITUENCIES.map(c => ({
          acNumber: c.number,
          name: c.name,
          completion: 0,
          surveys: 0,
          voters: 0,
          families: 0,
          agents: 0,
          category: 'no-data' as const,
        }));
        setHeatmapData(fallback);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllACData();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Performance Heatmap</h2>
          <p className="text-muted-foreground mt-1">Loading data for all ACs...</p>
        </div>
        <Card className="p-6">
          <div className="flex items-center justify-center min-h-[200px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </Card>
      </div>
    );
  }

  // Calculate survey rate for display
  const getSurveyRate = (ac: HeatmapData) => {
    if (ac.voters === 0) return 0;
    return Math.round((ac.surveys / ac.voters) * 10000) / 100;
  };

  // Category counts
  const categoryCounts = {
    excellent: heatmapData.filter(d => d.category === 'excellent').length,
    good: heatmapData.filter(d => d.category === 'good').length,
    average: heatmapData.filter(d => d.category === 'average').length,
    poor: heatmapData.filter(d => d.category === 'poor').length,
    critical: heatmapData.filter(d => d.category === 'critical').length,
    noData: heatmapData.filter(d => d.category === 'no-data').length,
  };

  // Summary stats (only from ACs with data)
  const acsWithData = heatmapData.filter(d => d.voters > 0);
  const totalVoters = acsWithData.reduce((sum, d) => sum + d.voters, 0);
  const totalSurveys = acsWithData.reduce((sum, d) => sum + d.surveys, 0);
  const avgSurveyRate = totalVoters > 0 ? (totalSurveys / totalVoters) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Performance Heatmap</h2>
        <p className="text-muted-foreground mt-1">
          Visual overview of survey rates across all ACs
        </p>
      </div>

      <Card className="p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {heatmapData.map((ac) => {
            const surveyRate = getSurveyRate(ac);
            return (
              <button
                key={ac.acNumber}
                onClick={() => navigate(`/l1/ac/${ac.acNumber}`)}
                className={`${getCategoryColor(
                  ac.category
                )} text-white rounded-lg p-4 transition-all hover:scale-105 cursor-pointer`}
                title={`${ac.name}\nVoters: ${ac.voters.toLocaleString()}\nSurveys: ${ac.surveys.toLocaleString()}\nRate: ${surveyRate}%`}
              >
                <p className="text-xs font-medium opacity-90 mb-1">AC {ac.acNumber}</p>
                <p className="text-2xl font-bold">
                  {ac.category === 'no-data' ? '-' : `${surveyRate}%`}
                </p>
                <p className="text-xs opacity-75 mt-1">
                  {ac.category === 'no-data' ? 'No data' : `${ac.surveys.toLocaleString()} surveys`}
                </p>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Performance Bands (by Survey Rate)</h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500" />
            <span className="text-sm">Excellent (≥5%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-500" />
            <span className="text-sm">Good (2-5%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-500" />
            <span className="text-sm">Average (0.5-2%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-orange-500" />
            <span className="text-sm">Poor (0.1-0.5%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500" />
            <span className="text-sm">Critical (&lt;0.1%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gray-400" />
            <span className="text-sm">No Data</span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Distribution Summary</h3>
          <div className="space-y-3">
            {[
              { label: 'Excellent', count: categoryCounts.excellent, color: 'text-green-500' },
              { label: 'Good', count: categoryCounts.good, color: 'text-blue-500' },
              { label: 'Average', count: categoryCounts.average, color: 'text-yellow-500' },
              { label: 'Poor', count: categoryCounts.poor, color: 'text-orange-500' },
              { label: 'Critical', count: categoryCounts.critical, color: 'text-red-500' },
              { label: 'No Data', count: categoryCounts.noData, color: 'text-gray-500' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className={`text-sm font-medium ${item.color}`}>{item.label}</span>
                <Badge variant="outline">{item.count} ACs</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4">Key Insights</h3>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              • <strong>{categoryCounts.excellent + categoryCounts.good}</strong> ACs performing above target (≥2% survey rate)
            </p>
            <p className="text-muted-foreground">
              • <strong>{categoryCounts.critical + categoryCounts.poor}</strong> ACs require immediate attention (&lt;0.5% rate)
            </p>
            <p className="text-muted-foreground">
              • <strong>{acsWithData.length}</strong> of {heatmapData.length} ACs have voter data
            </p>
            <p className="text-muted-foreground">
              • Average survey rate: <strong>{avgSurveyRate.toFixed(2)}%</strong>
            </p>
            <p className="text-muted-foreground">
              • Total surveys: <strong>{totalSurveys.toLocaleString()}</strong>
            </p>
            <p className="text-muted-foreground">
              • Total voters: <strong>{totalVoters.toLocaleString()}</strong>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};
