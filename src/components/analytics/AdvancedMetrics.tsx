import { Card } from '../ui/card';
import { Progress } from '../ui/progress';
import { Users, Zap, Home, UserCheck, Clock, Award, Loader2, MapPin, FileCheck } from 'lucide-react';
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

interface MetricData {
  label: string;
  value: number;
  unit: string;
  icon: React.ElementType;
  description: string;
  benchmark: number;
  color: string;
  rawValue?: string;
}

export const AdvancedMetrics = () => {
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [acStats, setACStats] = useState<{ withData: number; total: number }>({ withData: 0, total: CONSTITUENCIES.length });

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setIsLoading(true);

        // Use the batched ac-overview API for accurate data
        const data = await api.get('/rbac/dashboard/ac-overview');

        let totalVoters = 0;
        let totalSurveys = 0;
        let totalFamilies = 0;
        let totalBooths = 0;
        let totalAgents = 0;
        let acsWithData = 0;

        if (data.success && data.acPerformance) {
          data.acPerformance.forEach((ac: ACPerformance) => {
            if (ac.voters > 0) {
              acsWithData++;
              totalVoters += ac.voters;
              totalSurveys += ac.surveyedMembers;
              totalFamilies += ac.families;
              totalBooths += ac.booths;
              totalAgents += ac.agents || 0;
            }
          });
        }

        setACStats({ withData: acsWithData, total: CONSTITUENCIES.length });

        // Calculate metrics based on real aggregated data
        const surveyCompletionRate = totalVoters > 0 ? (totalSurveys / totalVoters) * 100 : 0;
        const familyCoverage = totalFamilies > 0 ? Math.min((totalSurveys / totalFamilies) * 100, 100) : 0;
        const avgVotersPerBooth = totalBooths > 0 ? Math.round(totalVoters / totalBooths) : 0;
        const avgVotersPerAgent = totalAgents > 0 ? Math.round(totalVoters / totalAgents) : 0;
        const avgSurveysPerAgent = totalAgents > 0 ? Math.round((totalSurveys / totalAgents) * 10) / 10 : 0;
        const boothAgentRatio = totalBooths > 0 && totalAgents > 0 ? Math.round((totalAgents / totalBooths) * 100) / 100 : 0;

        const calculatedMetrics: MetricData[] = [
          {
            label: 'Survey Completion Rate',
            value: parseFloat(surveyCompletionRate.toFixed(2)),
            unit: '%',
            icon: Award,
            description: `${totalSurveys.toLocaleString()} of ${totalVoters.toLocaleString()} voters surveyed`,
            benchmark: 10,
            color: 'text-green-500',
            rawValue: `${totalSurveys.toLocaleString()} surveys`,
          },
          {
            label: 'Family Coverage',
            value: parseFloat(familyCoverage.toFixed(1)),
            unit: '%',
            icon: Home,
            description: `Surveys per family across ${totalFamilies.toLocaleString()} families`,
            benchmark: 50,
            color: 'text-blue-500',
            rawValue: `${totalFamilies.toLocaleString()} families`,
          },
          {
            label: 'Avg Voters per Booth',
            value: avgVotersPerBooth,
            unit: '',
            icon: MapPin,
            description: `Distribution across ${totalBooths.toLocaleString()} booths`,
            benchmark: 150,
            color: 'text-purple-500',
            rawValue: `${totalBooths} booths`,
          },
          {
            label: 'Surveys per Agent',
            value: avgSurveysPerAgent,
            unit: '',
            icon: UserCheck,
            description: `Average productivity across ${totalAgents} agents`,
            benchmark: 50,
            color: 'text-cyan-500',
            rawValue: `${totalAgents} agents`,
          },
          {
            label: 'Voters per Agent',
            value: avgVotersPerAgent,
            unit: '',
            icon: Users,
            description: 'Workload distribution per agent',
            benchmark: 1000,
            color: 'text-yellow-500',
            rawValue: `${totalVoters.toLocaleString()} voters`,
          },
          {
            label: 'Active ACs',
            value: acsWithData,
            unit: `/${CONSTITUENCIES.length}`,
            icon: Clock,
            description: 'Assembly Constituencies with voter data',
            benchmark: CONSTITUENCIES.length,
            color: 'text-pink-500',
            rawValue: `${acsWithData} active`,
          },
        ];

        setMetrics(calculatedMetrics);
      } catch (error) {
        console.error('Error fetching advanced metrics:', error);
        setMetrics([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Advanced Performance Metrics</h2>
          <p className="text-muted-foreground mt-1">Loading metrics...</p>
        </div>
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Advanced Performance Metrics</h2>
          <p className="text-muted-foreground mt-1">No data available</p>
        </div>
        <Card className="p-6">
          <p className="text-center text-muted-foreground">
            No metrics data available. Add voter data to see performance metrics.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Advanced Performance Metrics</h2>
        <p className="text-muted-foreground mt-1">
          Deep dive into efficiency and quality indicators across {acStats.withData} ACs
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          const progressValue = metric.label === 'Active ACs'
            ? (metric.value / metric.benchmark) * 100
            : Math.min((metric.value / metric.benchmark) * 100, 100);
          const isAboveBenchmark = metric.value >= metric.benchmark;

          return (
            <Card key={index} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg bg-accent ${metric.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold">
                    {metric.value.toLocaleString()}
                    <span className="text-lg text-muted-foreground ml-1">{metric.unit}</span>
                  </p>
                </div>
              </div>

              <h3 className="font-semibold mb-2">{metric.label}</h3>
              <p className="text-sm text-muted-foreground mb-4">{metric.description}</p>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">vs Target</span>
                  <span className={isAboveBenchmark ? 'text-green-500' : 'text-yellow-500'}>
                    {metric.benchmark}{metric.unit}
                  </span>
                </div>
                <Progress
                  value={progressValue}
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground">
                  {isAboveBenchmark ? '✓ Target met' : `△ ${Math.round(progressValue)}% of target`}
                </p>
              </div>

              {metric.rawValue && (
                <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
                  {metric.rawValue}
                </p>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Metric Definitions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <p className="font-medium">Survey Completion Rate</p>
            <p className="text-muted-foreground">
              (Total Surveys / Total Voters) × 100. Measures overall progress toward complete voter coverage.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-medium">Family Coverage</p>
            <p className="text-muted-foreground">
              (Surveys / Total Families) × 100. Shows engagement at the family level.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-medium">Avg Voters per Booth</p>
            <p className="text-muted-foreground">
              Total Voters / Total Booths. Indicates voter distribution and booth load.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-medium">Surveys per Agent</p>
            <p className="text-muted-foreground">
              Total Surveys / Total Agents. Measures average agent productivity.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
