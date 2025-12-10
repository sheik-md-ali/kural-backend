import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Home, FileCheck, MapPin, Download, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import { CONSTITUENCIES } from '@/constants/constituencies';

interface ACData {
  acNumber: string;
  name: string;
  voters: number;
  families: number;
  surveys: number;
  booths: number;
  completion: number;
  agentCount: number;
}

export const ACComparison = () => {
  const [allACsData, setAllACsData] = useState<ACData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedACs, setSelectedACs] = useState<string[]>([]);

  useEffect(() => {
    const fetchACData = async () => {
      try {
        setIsLoading(true);
        const data = await api.get('/rbac/dashboard/ac-overview');

        if (data.success && data.acPerformance) {
          const mappedData: ACData[] = data.acPerformance.map((ac: {
            acNumber: number;
            acName: string | null;
            voters: number;
            surveyedMembers: number;
            completion: number;
            agents: number;
          }) => {
            const constituency = CONSTITUENCIES.find(c => c.number === ac.acNumber);
            return {
              acNumber: String(ac.acNumber),
              name: ac.acName || constituency?.name || `AC ${ac.acNumber}`,
              voters: ac.voters || 0,
              families: Math.round(ac.voters / 3.5) || 0,
              surveys: ac.surveyedMembers || 0,
              booths: Math.round(ac.voters / 25) || 0,
              completion: ac.completion || 0,
              agentCount: ac.agents || 0,
            };
          });

          setAllACsData(mappedData);

          // Set initial selection to first two ACs if available
          if (mappedData.length >= 2) {
            setSelectedACs([mappedData[0].acNumber, mappedData[1].acNumber]);
          } else if (mappedData.length === 1) {
            setSelectedACs([mappedData[0].acNumber]);
          }
        } else {
          // Fallback to constituency list with zeros
          const fallbackData: ACData[] = CONSTITUENCIES.map(c => ({
            acNumber: String(c.number),
            name: c.name,
            voters: 0,
            families: 0,
            surveys: 0,
            booths: 0,
            completion: 0,
            agentCount: 0,
          }));
          setAllACsData(fallbackData);
          if (fallbackData.length >= 2) {
            setSelectedACs([fallbackData[0].acNumber, fallbackData[1].acNumber]);
          }
        }
      } catch (error) {
        console.error('Error fetching AC data:', error);
        // Fallback to constituency list with zeros on error
        const fallbackData: ACData[] = CONSTITUENCIES.map(c => ({
          acNumber: String(c.number),
          name: c.name,
          voters: 0,
          families: 0,
          surveys: 0,
          booths: 0,
          completion: 0,
          agentCount: 0,
        }));
        setAllACsData(fallbackData);
        if (fallbackData.length >= 2) {
          setSelectedACs([fallbackData[0].acNumber, fallbackData[1].acNumber]);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchACData();
  }, []);

  const handleACSelection = (index: number, value: string) => {
    const newSelection = [...selectedACs];
    newSelection[index] = value;
    setSelectedACs(newSelection);
  };

  const addComparison = () => {
    if (selectedACs.length < 4 && allACsData.length > selectedACs.length) {
      const unusedAC = allACsData.find(ac => !selectedACs.includes(ac.acNumber));
      if (unusedAC) {
        setSelectedACs([...selectedACs, unusedAC.acNumber]);
      }
    }
  };

  const removeComparison = (index: number) => {
    if (selectedACs.length > 2) {
      setSelectedACs(selectedACs.filter((_, i) => i !== index));
    }
  };

  const comparisonData = selectedACs.map((acNum) => {
    const ac = allACsData.find((a) => a.acNumber === acNum);
    return ac || allACsData[0];
  }).filter(Boolean);

  // Prepare chart data
  const barChartData = comparisonData.length > 0 ? [
    {
      metric: 'Voters',
      ...comparisonData.reduce((acc, ac) => ({ ...acc, [ac.name]: ac.voters }), {}),
    },
    {
      metric: 'Families',
      ...comparisonData.reduce((acc, ac) => ({ ...acc, [ac.name]: ac.families }), {}),
    },
    {
      metric: 'Surveys',
      ...comparisonData.reduce((acc, ac) => ({ ...acc, [ac.name]: ac.surveys }), {}),
    },
    {
      metric: 'Booths',
      ...comparisonData.reduce((acc, ac) => ({ ...acc, [ac.name]: ac.booths }), {}),
    },
  ] : [];

  const radarChartData = comparisonData.map((ac) => {
    const maxVoters = Math.max(...allACsData.map(a => a.voters), 1);
    const maxFamilies = Math.max(...allACsData.map(a => a.families), 1);
    const maxSurveys = Math.max(...allACsData.map(a => a.surveys), 1);
    const maxAgents = Math.max(...allACsData.map(a => a.agentCount), 1);

    return {
      ac: `AC ${ac.acNumber}`,
      Voters: (ac.voters / maxVoters) * 100,
      Families: (ac.families / maxFamilies) * 100,
      Surveys: (ac.surveys / maxSurveys) * 100,
      Completion: ac.completion,
      Agents: (ac.agentCount / maxAgents) * 100,
    };
  });

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

  const handleExport = () => {
    const csvContent = [
      ['AC Number', 'Name', 'Voters', 'Families', 'Surveys', 'Booths', 'Completion %'],
      ...comparisonData.map((ac) => [
        ac.acNumber,
        ac.name,
        ac.voters,
        ac.families,
        ac.surveys,
        ac.booths,
        ac.completion,
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ac-comparison.csv';
    a.click();
  };

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">AC Comparison Dashboard</h1>
            <p className="text-xl text-muted-foreground">Compare up to 4 Assembly Constituencies side-by-side</p>
          </div>
          <Button onClick={handleExport} disabled={comparisonData.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export Comparison
          </Button>
        </div>

        {/* AC Selectors */}
        <Card className="p-6">
          <div className="flex flex-wrap gap-4 items-center">
            {selectedACs.map((acNum, index) => (
              <div key={index} className="flex items-center gap-2">
                <Select value={acNum} onValueChange={(value) => handleACSelection(index, value)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allACsData.map((ac) => (
                      <SelectItem key={ac.acNumber} value={ac.acNumber}>
                        AC {ac.acNumber} - {ac.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedACs.length > 2 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeComparison(index)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
            {selectedACs.length < 4 && allACsData.length > selectedACs.length && (
              <Button variant="outline" onClick={addComparison}>
                + Add AC
              </Button>
            )}
          </div>
        </Card>

        {comparisonData.length === 0 ? (
          <Card className="p-6">
            <p className="text-center text-muted-foreground">No AC data available for comparison</p>
          </Card>
        ) : (
          <>
            {/* Comparison Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {comparisonData.map((ac, index) => (
                <Card key={ac.acNumber} className="p-6 border-2" style={{ borderColor: colors[index] }}>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-bold">AC {ac.acNumber}</h3>
                      <p className="text-sm text-muted-foreground">{ac.name}</p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium">Completion</span>
                        <Badge variant={ac.completion >= 80 ? 'default' : ac.completion >= 60 ? 'secondary' : 'destructive'}>
                          {ac.completion}%
                        </Badge>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="h-2 rounded-full"
                          style={{ width: `${Math.min(ac.completion, 100)}%`, backgroundColor: colors[index] }}
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" style={{ color: colors[index] }} />
                          <span className="text-sm">Voters</span>
                        </div>
                        <span className="font-bold">{ac.voters.toLocaleString()}</span>
                      </div>

                      <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                          <Home className="h-4 w-4" style={{ color: colors[index] }} />
                          <span className="text-sm">Families</span>
                        </div>
                        <span className="font-bold">{ac.families.toLocaleString()}</span>
                      </div>

                      <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                          <FileCheck className="h-4 w-4" style={{ color: colors[index] }} />
                          <span className="text-sm">Surveys</span>
                        </div>
                        <span className="font-bold">{ac.surveys.toLocaleString()}</span>
                      </div>

                      <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" style={{ color: colors[index] }} />
                          <span className="text-sm">Booths</span>
                        </div>
                        <span className="font-bold">{ac.booths}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Bar Chart Comparison */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Comparative Metrics</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="metric" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {comparisonData.map((ac, index) => (
                    <Bar key={ac.acNumber} dataKey={ac.name} fill={colors[index]} radius={[8, 8, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Radar Chart Multi-Metric Comparison */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Multi-Metric Performance Radar</h3>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={radarChartData[0] ? [radarChartData[0]] : []}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="ac" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  {Object.keys(radarChartData[0] || {})
                    .filter((key) => key !== 'ac')
                    .map((key, index) => (
                      <Radar
                        key={key}
                        name={key}
                        dataKey={key}
                        stroke={colors[index % colors.length]}
                        fill={colors[index % colors.length]}
                        fillOpacity={0.3}
                      />
                    ))}
                </RadarChart>
              </ResponsiveContainer>
            </Card>

            {/* Difference Table */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Comparative Analysis</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Metric</th>
                      {comparisonData.map((ac) => (
                        <th key={ac.acNumber} className="text-right p-2">
                          AC {ac.acNumber}
                        </th>
                      ))}
                      <th className="text-right p-2">Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-2 font-medium">Voters</td>
                      {comparisonData.map((ac) => (
                        <td key={ac.acNumber} className="text-right p-2">
                          {ac.voters.toLocaleString()}
                        </td>
                      ))}
                      <td className="text-right p-2 text-muted-foreground">
                        {(Math.max(...comparisonData.map((a) => a.voters)) -
                          Math.min(...comparisonData.map((a) => a.voters))).toLocaleString()}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 font-medium">Families</td>
                      {comparisonData.map((ac) => (
                        <td key={ac.acNumber} className="text-right p-2">
                          {ac.families.toLocaleString()}
                        </td>
                      ))}
                      <td className="text-right p-2 text-muted-foreground">
                        {(Math.max(...comparisonData.map((a) => a.families)) -
                          Math.min(...comparisonData.map((a) => a.families))).toLocaleString()}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 font-medium">Surveys</td>
                      {comparisonData.map((ac) => (
                        <td key={ac.acNumber} className="text-right p-2">
                          {ac.surveys.toLocaleString()}
                        </td>
                      ))}
                      <td className="text-right p-2 text-muted-foreground">
                        {(Math.max(...comparisonData.map((a) => a.surveys)) -
                          Math.min(...comparisonData.map((a) => a.surveys))).toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 font-medium">Completion %</td>
                      {comparisonData.map((ac) => (
                        <td key={ac.acNumber} className="text-right p-2">
                          {ac.completion}%
                        </td>
                      ))}
                      <td className="text-right p-2 text-muted-foreground">
                        {Math.max(...comparisonData.map((a) => a.completion)) -
                          Math.min(...comparisonData.map((a) => a.completion))}
                        %
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};
