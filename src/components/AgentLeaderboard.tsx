import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Trophy, Medal, Award, TrendingUp, Star, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface AgentLeaderboardProps {
  acNumber?: string;
}

interface Agent {
  id: string;
  name: string;
  surveys: number;
  responseTime: number;
  qualityScore: number;
  rank: number;
  trend: string;
}

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Trophy className="h-5 w-5 text-yellow-500" />;
    case 2:
      return <Medal className="h-5 w-5 text-gray-400" />;
    case 3:
      return <Award className="h-5 w-5 text-orange-600" />;
    default:
      return <span className="text-sm font-bold text-muted-foreground">#{rank}</span>;
  }
};

const getRankBadge = (rank: number) => {
  if (rank === 1) return 'Gold';
  if (rank === 2) return 'Silver';
  if (rank === 3) return 'Bronze';
  return null;
};

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();
};

export const AgentLeaderboard = ({ acNumber }: AgentLeaderboardProps) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        setIsLoading(true);
        // Fetch booth agents for the AC
        const params = new URLSearchParams();
        if (acNumber) {
          params.append('ac', acNumber);
        }

        const data = await api.get(`/rbac/booth-agents?${params.toString()}`);

        // Transform the data - use actual data fields when available
        const agentList: Agent[] = (data.agents || data || [])
          .filter((a: any) => a.isActive !== false)
          .map((agent: any, idx: number) => ({
            id: agent._id || agent.id || idx.toString(),
            name: agent.name || 'Unknown Agent',
            surveys: agent.surveyCount || 0, // Show 0 if no survey data
            responseTime: agent.avgResponseTime || 0,
            qualityScore: agent.qualityScore || 0,
            rank: 0,
            trend: '+0%',
          }))
          .sort((a: Agent, b: Agent) => b.surveys - a.surveys)
          .slice(0, 10)
          .map((agent: Agent, idx: number) => ({
            ...agent,
            rank: idx + 1,
          }));

        setAgents(agentList);
      } catch (error) {
        console.error('Error fetching agents:', error);
        setAgents([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgents();
  }, [acNumber]);

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading agents...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Top {agents.length > 0 ? Math.min(agents.length, 10) : 0} Agent Performers
        </h3>
        <Badge variant="outline" className="gap-1">
          <Star className="h-3 w-3 fill-primary text-primary" />
          {acNumber ? `AC ${acNumber}` : 'All ACs'}
        </Badge>
      </div>

      <div className="space-y-3">
        {agents.length > 0 ? agents.map((agent) => {
          const badge = getRankBadge(agent.rank);
          return (
            <div
              key={agent.id}
              className={`flex items-center gap-4 p-4 rounded-lg transition-all hover:scale-[1.02] ${
                agent.rank <= 3 ? 'bg-primary/5 border-2 border-primary/20' : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {/* Rank */}
              <div className="flex items-center justify-center w-10">
                {getRankIcon(agent.rank)}
              </div>

              {/* Avatar */}
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {getInitials(agent.name)}
                </AvatarFallback>
              </Avatar>

              {/* Agent Info */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{agent.name}</p>
                  {badge && (
                    <Badge
                      variant={agent.rank === 1 ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {badge}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                  <span>{agent.surveys} surveys</span>
                  <span>•</span>
                  <span>{agent.responseTime} min avg</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    Quality: {agent.qualityScore}%
                  </span>
                </div>
              </div>

              {/* Trend */}
              <div className="flex items-center gap-2">
                <TrendingUp
                  className={`h-4 w-4 ${
                    agent.trend.startsWith('+') ? 'text-success' : agent.trend.startsWith('-') ? 'text-destructive' : 'text-muted-foreground'
                  }`}
                />
                <span
                  className={`text-sm font-medium ${
                    agent.trend.startsWith('+') ? 'text-success' : agent.trend.startsWith('-') ? 'text-destructive' : 'text-muted-foreground'
                  }`}
                >
                  {agent.trend}
                </span>
              </div>
            </div>
          );
        }) : (
          <div className="text-center py-8 text-muted-foreground">
            No agents found {acNumber ? `for AC ${acNumber}` : ''}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t">
        <p className="text-xs text-muted-foreground text-center">
          Rankings based on survey completion, response time, and quality scores
        </p>
      </div>
    </Card>
  );
};
