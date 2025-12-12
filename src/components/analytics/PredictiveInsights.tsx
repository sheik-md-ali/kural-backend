import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { TrendingUp, TrendingDown, AlertTriangle, Target, Loader2 } from 'lucide-react';
import { Progress } from '../ui/progress';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { CONSTITUENCIES } from '@/constants/constituencies';

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

interface PredictionData {
  acNumber: number;
  name: string;
  currentCompletion: number;
  projected7Days: number;
  projected14Days: number;
  projected30Days: number;
  targetCompletion: number;
  onTrack: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  recommendation: string;
  velocity: number;
  voters: number;
  surveys: number;
  agents: number;
}

export const PredictiveInsights = () => {
  const [predictions, setPredictions] = useState<PredictionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPredictions = async () => {
      try {
        setIsLoading(true);

        // Use the batched ac-overview API for accurate data
        const data = await api.get('/rbac/dashboard/ac-overview');

        if (!data.success || !data.acPerformance) {
          setPredictions([]);
          return;
        }

        const predictionData: PredictionData[] = data.acPerformance
          .filter((ac: ACPerformance) => ac.voters > 0) // Only include ACs with data
          .map((ac: ACPerformance) => {
            const constituency = CONSTITUENCIES.find(c => c.number === ac.acNumber);
            const name = ac.acName || constituency?.name || `AC ${ac.acNumber}`;

            const totalVoters = ac.voters;
            const surveys = ac.surveyedMembers;
            const agents = ac.agents || 1;
            const currentCompletion = ac.completion || 0;

            // Calculate velocity: surveys per day per agent (assume 30-day data period)
            const surveysPerAgentPerDay = surveys / (agents * 30);
            const dailyVelocity = surveys / 30;

            // Project future completions based on current velocity
            const surveysIn7Days = surveys + (dailyVelocity * 7);
            const surveysIn14Days = surveys + (dailyVelocity * 14);
            const surveysIn30Days = surveys + (dailyVelocity * 30);

            const projected7Days = Math.min((surveysIn7Days / totalVoters) * 100, 100);
            const projected14Days = Math.min((surveysIn14Days / totalVoters) * 100, 100);
            const projected30Days = Math.min((surveysIn30Days / totalVoters) * 100, 100);

            const targetCompletion = 40.0;
            const onTrack = projected30Days >= targetCompletion;

            let riskLevel: 'low' | 'medium' | 'high' = 'low';
            let recommendation = 'On track: Maintain current pace';

            if (projected30Days < targetCompletion * 0.5) {
              riskLevel = 'high';
              recommendation = 'Critical: Double survey efforts, consider additional agents';
            } else if (projected30Days < targetCompletion * 0.75) {
              riskLevel = 'medium';
              recommendation = 'Increase agent allocation by 20% to meet target';
            } else if (projected30Days >= targetCompletion) {
              riskLevel = 'low';
              recommendation = 'On track: Maintain current pace';
            }

            return {
              acNumber: ac.acNumber,
              name,
              currentCompletion: parseFloat(currentCompletion.toFixed(2)),
              projected7Days: parseFloat(projected7Days.toFixed(2)),
              projected14Days: parseFloat(projected14Days.toFixed(2)),
              projected30Days: parseFloat(projected30Days.toFixed(2)),
              targetCompletion,
              onTrack,
              riskLevel,
              recommendation,
              velocity: parseFloat(surveysPerAgentPerDay.toFixed(2)),
              voters: totalVoters,
              surveys,
              agents,
            };
          });

        // Sort by risk level (high first) then by completion
        predictionData.sort((a, b) => {
          const riskOrder = { high: 0, medium: 1, low: 2 };
          if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel]) {
            return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
          }
          return a.currentCompletion - b.currentCompletion;
        });

        setPredictions(predictionData);
      } catch (error) {
        console.error('Error fetching prediction data:', error);
        setPredictions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPredictions();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Predictive Completion Forecasts</h2>
          <p className="text-muted-foreground mt-1">Loading predictions...</p>
        </div>
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (predictions.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Predictive Completion Forecasts</h2>
          <p className="text-muted-foreground mt-1">No AC data available for predictions</p>
        </div>
        <Card className="p-6">
          <p className="text-center text-muted-foreground">
            No ACs with voter data found. Add voter data to see predictions.
          </p>
        </Card>
      </div>
    );
  }

  // Summary stats
  const highRiskCount = predictions.filter(p => p.riskLevel === 'high').length;
  const mediumRiskCount = predictions.filter(p => p.riskLevel === 'medium').length;
  const onTrackCount = predictions.filter(p => p.onTrack).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Predictive Completion Forecasts</h2>
        <p className="text-muted-foreground mt-1">
          Projections based on current velocity and trends
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">High Risk</p>
              <p className="text-2xl font-bold">{highRiskCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Medium Risk</p>
              <p className="text-2xl font-bold">{mediumRiskCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">On Track</p>
              <p className="text-2xl font-bold">{onTrackCount}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {predictions.map((prediction) => (
          <Card key={prediction.acNumber} className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">AC {prediction.acNumber}</h3>
                <p className="text-sm text-muted-foreground">{prediction.name}</p>
              </div>
              <Badge
                variant={prediction.onTrack ? 'default' : 'destructive'}
                className="flex items-center gap-1"
              >
                {prediction.onTrack ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {prediction.onTrack ? 'On Track' : 'Behind'}
              </Badge>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Progress to Target</span>
                  <span className="font-medium">{prediction.currentCompletion}%</span>
                </div>
                <Progress value={Math.min(prediction.currentCompletion, 100)} className="h-2" />
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 bg-muted/50 rounded">
                  <p className="text-xs text-muted-foreground">Voters</p>
                  <p className="font-medium">{prediction.voters.toLocaleString()}</p>
                </div>
                <div className="p-2 bg-muted/50 rounded">
                  <p className="text-xs text-muted-foreground">Surveyed</p>
                  <p className="font-medium">{prediction.surveys.toLocaleString()}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Projected Completion</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">7 Days</span>
                  <span className="font-medium">{prediction.projected7Days}%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">14 Days</span>
                  <span className="font-medium">{prediction.projected14Days}%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">30 Days</span>
                  <span className="font-medium text-primary">{prediction.projected30Days}%</span>
                </div>
              </div>

              <div className="pt-3 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Target: {prediction.targetCompletion}%</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle
                    className={`h-4 w-4 ${
                      prediction.riskLevel === 'high'
                        ? 'text-red-500'
                        : prediction.riskLevel === 'medium'
                        ? 'text-yellow-500'
                        : 'text-green-500'
                    }`}
                  />
                  <span className="text-sm capitalize">{prediction.riskLevel} Risk</span>
                </div>
              </div>

              <div className="bg-accent/50 rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Recommendation</p>
                <p className="text-sm">{prediction.recommendation}</p>
              </div>

              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Velocity: {prediction.velocity} surveys/agent/day</span>
                <span>Agents: {prediction.agents}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
