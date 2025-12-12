import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users, Home, FileCheck, MapPin, Download, Loader2, UserCheck,
  TrendingUp, TrendingDown, BarChart3, PieChart as PieChartIcon,
  ArrowUpRight, ArrowDownRight, Minus, Plus, X
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

interface DerivedMetrics {
  votersPerBooth: number;
  votersPerFamily: number;
  surveysPerAgent: number;
  familiesPerBooth: number;
  surveyRate: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
const CHART_COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  pink: '#ec4899',
  cyan: '#06b6d4',
  orange: '#f97316'
};

export const ACComparison = () => {
  const [allACsData, setAllACsData] = useState<ACData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedACs, setSelectedACs] = useState<string[]>([]);

  useEffect(() => {
    const fetchACData = async () => {
      try {
        setIsLoading(true);
        const data = await api.get('/rbac/dashboard/ac-overview');

        // Create a map from API data for quick lookup
        const apiDataMap = new Map<number, {
          voters: number;
          families: number;
          surveys: number;
          booths: number;
          completion: number;
          agents: number;
        }>();

        if (data.success && data.acPerformance) {
          data.acPerformance.forEach((ac: {
            acNumber: number;
            voters: number;
            surveyedMembers: number;
            families: number;
            booths: number;
            completion: number;
            agents: number;
          }) => {
            apiDataMap.set(ac.acNumber, {
              voters: ac.voters || 0,
              families: ac.families || 0,
              surveys: ac.surveyedMembers || 0,
              booths: ac.booths || 0,
              completion: ac.completion || 0,
              agents: ac.agents || 0,
            });
          });
        }

        // Merge all CONSTITUENCIES with API data (use zeros for ACs without data)
        const mergedData: ACData[] = CONSTITUENCIES.map(c => {
          const apiAC = apiDataMap.get(c.number);
          return {
            acNumber: String(c.number),
            name: c.name,
            voters: apiAC?.voters || 0,
            families: apiAC?.families || 0,
            surveys: apiAC?.surveys || 0,
            booths: apiAC?.booths || 0,
            completion: apiAC?.completion || 0,
            agentCount: apiAC?.agents || 0,
          };
        });

        setAllACsData(mergedData);

        // Default: select first two ACs that have data, or first two overall
        const acsWithData = mergedData.filter(ac => ac.voters > 0);
        if (acsWithData.length >= 2) {
          setSelectedACs([acsWithData[0].acNumber, acsWithData[1].acNumber]);
        } else if (acsWithData.length === 1) {
          // One AC with data, pick another one for comparison
          const otherAC = mergedData.find(ac => ac.acNumber !== acsWithData[0].acNumber);
          setSelectedACs([acsWithData[0].acNumber, otherAC?.acNumber || mergedData[1].acNumber]);
        } else if (mergedData.length >= 2) {
          setSelectedACs([mergedData[0].acNumber, mergedData[1].acNumber]);
        }
      } catch (error) {
        console.error('Error fetching AC data:', error);
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

  // Calculate derived metrics
  const getDerivedMetrics = (ac: ACData): DerivedMetrics => ({
    votersPerBooth: ac.booths > 0 ? Math.round(ac.voters / ac.booths) : 0,
    votersPerFamily: ac.families > 0 ? Math.round((ac.voters / ac.families) * 10) / 10 : 0,
    surveysPerAgent: ac.agentCount > 0 ? Math.round((ac.surveys / ac.agentCount) * 10) / 10 : 0,
    familiesPerBooth: ac.booths > 0 ? Math.round(ac.families / ac.booths) : 0,
    // Show more precision for survey rate (2 decimal places)
    surveyRate: ac.voters > 0 ? Math.round((ac.surveys / ac.voters) * 10000) / 100 : 0,
  });

  // Prepare bar chart data for primary metrics
  const primaryBarChartData = [
    { metric: 'Voters', ...comparisonData.reduce((acc, ac) => ({ ...acc, [ac.name]: ac.voters }), {}) },
    { metric: 'Families', ...comparisonData.reduce((acc, ac) => ({ ...acc, [ac.name]: ac.families }), {}) },
    { metric: 'Surveys', ...comparisonData.reduce((acc, ac) => ({ ...acc, [ac.name]: ac.surveys }), {}) },
    { metric: 'Booths', ...comparisonData.reduce((acc, ac) => ({ ...acc, [ac.name]: ac.booths }), {}) },
  ];

  // Prepare efficiency metrics bar chart
  const efficiencyBarChartData = comparisonData.map(ac => {
    const metrics = getDerivedMetrics(ac);
    return {
      name: ac.name,
      'Voters/Booth': metrics.votersPerBooth,
      'Families/Booth': metrics.familiesPerBooth,
      'Survey Rate %': metrics.surveyRate,
    };
  });

  // Prepare radar chart data - normalized to 100 for comparison
  const radarChartData = (() => {
    const maxVoters = Math.max(...comparisonData.map(a => a.voters), 1);
    const maxFamilies = Math.max(...comparisonData.map(a => a.families), 1);
    const maxSurveys = Math.max(...comparisonData.map(a => a.surveys), 1);
    const maxBooths = Math.max(...comparisonData.map(a => a.booths), 1);
    const maxAgents = Math.max(...comparisonData.map(a => a.agentCount), 1);

    const metrics = ['Voters', 'Families', 'Surveys', 'Booths', 'Agents', 'Completion'];

    return metrics.map(metric => {
      const dataPoint: Record<string, string | number> = { metric };
      comparisonData.forEach(ac => {
        let value = 0;
        switch (metric) {
          case 'Voters': value = (ac.voters / maxVoters) * 100; break;
          case 'Families': value = (ac.families / maxFamilies) * 100; break;
          case 'Surveys': value = (ac.surveys / maxSurveys) * 100; break;
          case 'Booths': value = (ac.booths / maxBooths) * 100; break;
          case 'Agents': value = (ac.agentCount / maxAgents) * 100; break;
          case 'Completion': value = ac.completion; break;
        }
        dataPoint[`AC ${ac.acNumber}`] = Math.round(value * 10) / 10;
      });
      return dataPoint;
    });
  })();

  // Prepare pie chart data for survey completion
  const pieChartData = comparisonData.map((ac, index) => {
    const total = ac.voters;
    const surveyed = ac.surveys;
    const pending = Math.max(0, total - surveyed);
    const percentage = total > 0 ? Math.round((surveyed / total) * 10000) / 100 : 0;
    return {
      name: `AC ${ac.acNumber}`,
      surveyed,
      pending,
      total,
      percentage,
      color: COLORS[index],
    };
  });

  // Get trend indicator
  const getTrendIndicator = (value1: number, value2: number) => {
    if (value1 > value2) return { icon: ArrowUpRight, color: 'text-green-500', label: 'Higher' };
    if (value1 < value2) return { icon: ArrowDownRight, color: 'text-red-500', label: 'Lower' };
    return { icon: Minus, color: 'text-gray-500', label: 'Equal' };
  };

  const handleExport = () => {
    const csvContent = [
      ['AC Number', 'Name', 'Voters', 'Families', 'Surveys', 'Booths', 'Agents', 'Completion %', 'Voters/Booth', 'Survey Rate %'],
      ...comparisonData.map((ac) => {
        const metrics = getDerivedMetrics(ac);
        return [
          ac.acNumber,
          ac.name,
          ac.voters,
          ac.families,
          ac.surveys,
          ac.booths,
          ac.agentCount,
          ac.completion,
          metrics.votersPerBooth,
          metrics.surveyRate,
        ];
      }),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ac-comparison-${new Date().toISOString().split('T')[0]}.csv`;
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-1">AC Comparison Dashboard</h1>
            <p className="text-muted-foreground">Compare up to 4 Assembly Constituencies side-by-side</p>
          </div>
          <Button onClick={handleExport} disabled={comparisonData.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>

        {/* AC Selectors */}
        <Card className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            {selectedACs.map((acNum, index) => (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[index] }}
                />
                <Select value={acNum} onValueChange={(value) => handleACSelection(index, value)}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allACsData.map((ac) => (
                      <SelectItem
                        key={ac.acNumber}
                        value={ac.acNumber}
                        disabled={selectedACs.includes(ac.acNumber) && ac.acNumber !== acNum}
                      >
                        AC {ac.acNumber} - {ac.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedACs.length > 2 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeComparison(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {selectedACs.length < 4 && allACsData.length > selectedACs.length && (
              <Button variant="outline" size="sm" onClick={addComparison}>
                <Plus className="mr-1 h-4 w-4" />
                Add AC
              </Button>
            )}
          </div>
        </Card>

        {comparisonData.length === 0 ? (
          <Card className="p-8">
            <p className="text-center text-muted-foreground">No AC data available for comparison</p>
          </Card>
        ) : (
          <>
            {/* Summary Stats Cards - 3 per row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {comparisonData.map((ac, index) => {
                const metrics = getDerivedMetrics(ac);
                return (
                  <Card
                    key={ac.acNumber}
                    className="p-5"
                  >
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-bold">AC {ac.acNumber}</h3>
                          <p className="text-sm text-muted-foreground">{ac.name}</p>
                        </div>
                        <Badge
                          variant={ac.completion >= 75 ? 'default' : ac.completion >= 50 ? 'secondary' : 'destructive'}
                          className="text-xs"
                        >
                          {ac.completion}% Complete
                        </Badge>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.min(ac.completion, 100)}%`,
                            backgroundColor: COLORS[index]
                          }}
                        />
                      </div>

                      {/* Primary Stats */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                          <Users className="h-4 w-4" style={{ color: COLORS[index] }} />
                          <div>
                            <p className="text-xs text-muted-foreground">Voters</p>
                            <p className="text-sm font-bold">{ac.voters.toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                          <Home className="h-4 w-4" style={{ color: COLORS[index] }} />
                          <div>
                            <p className="text-xs text-muted-foreground">Families</p>
                            <p className="text-sm font-bold">{ac.families.toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                          <FileCheck className="h-4 w-4" style={{ color: COLORS[index] }} />
                          <div>
                            <p className="text-xs text-muted-foreground">Surveys</p>
                            <p className="text-sm font-bold">{ac.surveys.toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                          <MapPin className="h-4 w-4" style={{ color: COLORS[index] }} />
                          <div>
                            <p className="text-xs text-muted-foreground">Booths</p>
                            <p className="text-sm font-bold">{ac.booths}</p>
                          </div>
                        </div>
                      </div>

                      {/* Derived Metrics */}
                      <div className="pt-2 border-t space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Voters/Booth</span>
                          <span className="font-medium">{metrics.votersPerBooth}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Avg Family Size</span>
                          <span className="font-medium">{metrics.votersPerFamily}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Survey Rate</span>
                          <span className="font-medium">{metrics.surveyRate}%</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Agents</span>
                          <span className="font-medium">{ac.agentCount}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Charts Row 1: Primary Metrics & Efficiency */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Primary Metrics Grouped Bar Chart */}
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Primary Metrics Comparison</h3>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={comparisonData.map(ac => ({
                      name: `AC ${ac.acNumber}`,
                      Voters: ac.voters,
                      Families: ac.families,
                      Surveys: ac.surveys,
                      Booths: ac.booths,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis
                      tickFormatter={(value) => {
                        if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
                        return value;
                      }}
                    />
                    <Tooltip
                      formatter={(value: number) => value.toLocaleString()}
                      contentStyle={{ borderRadius: '8px' }}
                    />
                    <Legend />
                    <Bar dataKey="Voters" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Families" fill={CHART_COLORS.success} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Surveys" fill={CHART_COLORS.warning} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Booths" fill={CHART_COLORS.purple} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Radar Chart */}
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Performance Radar</h3>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarChartData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value: number) => `${value}%`} />
                    <Legend />
                    {comparisonData.map((ac, index) => (
                      <Radar
                        key={ac.acNumber}
                        name={`AC ${ac.acNumber}`}
                        dataKey={`AC ${ac.acNumber}`}
                        stroke={COLORS[index]}
                        fill={COLORS[index]}
                        fillOpacity={0.2}
                        strokeWidth={2}
                      />
                    ))}
                  </RadarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* Charts Row 2: Survey Distribution & Efficiency Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Survey Completion Pie Charts */}
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <PieChartIcon className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Survey Completion Rate</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {pieChartData.map((data, index) => (
                    <div key={data.name} className="text-center">
                      <ResponsiveContainer width="100%" height={150}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Surveyed', value: data.surveyed || 0.01 },
                              { name: 'Pending', value: data.pending > 0 ? data.pending : 0.01 },
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={35}
                            outerRadius={55}
                            paddingAngle={data.surveyed > 0 && data.pending > 0 ? 2 : 0}
                            dataKey="value"
                          >
                            <Cell fill={COLORS[index]} />
                            <Cell fill="#e5e7eb" />
                          </Pie>
                          <Tooltip
                            formatter={(value: number, name: string) => [
                              `${Math.round(value).toLocaleString()} voters`,
                              name
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <p className="text-sm font-medium">{data.name}</p>
                      <p className="text-xs font-semibold" style={{ color: COLORS[index] }}>
                        {data.percentage}% surveyed
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {data.surveyed.toLocaleString()} of {data.total.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Efficiency Metrics */}
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <UserCheck className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Efficiency Metrics</h3>
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={efficiencyBarChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Voters/Booth" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Families/Booth" fill={CHART_COLORS.success} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Survey Rate %" fill={CHART_COLORS.warning} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* Detailed Comparison Table */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Detailed Comparison Analysis</h3>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Metric</TableHead>
                      {comparisonData.map((ac, index) => (
                        <TableHead key={ac.acNumber} className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: COLORS[index] }}
                            />
                            AC {ac.acNumber}
                          </div>
                        </TableHead>
                      ))}
                      <TableHead className="text-right">Range</TableHead>
                      <TableHead className="text-right">Leader</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Voters */}
                    <TableRow>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          Total Voters
                        </div>
                      </TableCell>
                      {comparisonData.map((ac) => (
                        <TableCell key={ac.acNumber} className="text-right font-mono">
                          {ac.voters.toLocaleString()}
                        </TableCell>
                      ))}
                      <TableCell className="text-right text-muted-foreground font-mono">
                        {(Math.max(...comparisonData.map(a => a.voters)) -
                          Math.min(...comparisonData.map(a => a.voters))).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">
                          AC {comparisonData.reduce((a, b) => a.voters > b.voters ? a : b).acNumber}
                        </Badge>
                      </TableCell>
                    </TableRow>

                    {/* Families */}
                    <TableRow>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Home className="h-4 w-4 text-muted-foreground" />
                          Total Families
                        </div>
                      </TableCell>
                      {comparisonData.map((ac) => (
                        <TableCell key={ac.acNumber} className="text-right font-mono">
                          {ac.families.toLocaleString()}
                        </TableCell>
                      ))}
                      <TableCell className="text-right text-muted-foreground font-mono">
                        {(Math.max(...comparisonData.map(a => a.families)) -
                          Math.min(...comparisonData.map(a => a.families))).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">
                          AC {comparisonData.reduce((a, b) => a.families > b.families ? a : b).acNumber}
                        </Badge>
                      </TableCell>
                    </TableRow>

                    {/* Surveys */}
                    <TableRow>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileCheck className="h-4 w-4 text-muted-foreground" />
                          Surveys Completed
                        </div>
                      </TableCell>
                      {comparisonData.map((ac) => (
                        <TableCell key={ac.acNumber} className="text-right font-mono">
                          {ac.surveys.toLocaleString()}
                        </TableCell>
                      ))}
                      <TableCell className="text-right text-muted-foreground font-mono">
                        {(Math.max(...comparisonData.map(a => a.surveys)) -
                          Math.min(...comparisonData.map(a => a.surveys))).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">
                          AC {comparisonData.reduce((a, b) => a.surveys > b.surveys ? a : b).acNumber}
                        </Badge>
                      </TableCell>
                    </TableRow>

                    {/* Booths */}
                    <TableRow>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          Total Booths
                        </div>
                      </TableCell>
                      {comparisonData.map((ac) => (
                        <TableCell key={ac.acNumber} className="text-right font-mono">
                          {ac.booths}
                        </TableCell>
                      ))}
                      <TableCell className="text-right text-muted-foreground font-mono">
                        {Math.max(...comparisonData.map(a => a.booths)) -
                          Math.min(...comparisonData.map(a => a.booths))}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">
                          AC {comparisonData.reduce((a, b) => a.booths > b.booths ? a : b).acNumber}
                        </Badge>
                      </TableCell>
                    </TableRow>

                    {/* Agents */}
                    <TableRow>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4 text-muted-foreground" />
                          Active Agents
                        </div>
                      </TableCell>
                      {comparisonData.map((ac) => (
                        <TableCell key={ac.acNumber} className="text-right font-mono">
                          {ac.agentCount}
                        </TableCell>
                      ))}
                      <TableCell className="text-right text-muted-foreground font-mono">
                        {Math.max(...comparisonData.map(a => a.agentCount)) -
                          Math.min(...comparisonData.map(a => a.agentCount))}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">
                          AC {comparisonData.reduce((a, b) => a.agentCount > b.agentCount ? a : b).acNumber}
                        </Badge>
                      </TableCell>
                    </TableRow>

                    {/* Completion */}
                    <TableRow>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                          Completion %
                        </div>
                      </TableCell>
                      {comparisonData.map((ac) => (
                        <TableCell key={ac.acNumber} className="text-right">
                          <Badge
                            variant={ac.completion >= 75 ? 'default' : ac.completion >= 50 ? 'secondary' : 'destructive'}
                          >
                            {ac.completion}%
                          </Badge>
                        </TableCell>
                      ))}
                      <TableCell className="text-right text-muted-foreground font-mono">
                        {Math.max(...comparisonData.map(a => a.completion)) -
                          Math.min(...comparisonData.map(a => a.completion))}%
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">
                          AC {comparisonData.reduce((a, b) => a.completion > b.completion ? a : b).acNumber}
                        </Badge>
                      </TableCell>
                    </TableRow>

                    {/* Derived Metrics Section */}
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={comparisonData.length + 3} className="font-semibold text-muted-foreground">
                        Efficiency Metrics
                      </TableCell>
                    </TableRow>

                    {/* Voters per Booth */}
                    <TableRow>
                      <TableCell className="font-medium pl-6">Voters per Booth</TableCell>
                      {comparisonData.map((ac) => {
                        const metrics = getDerivedMetrics(ac);
                        return (
                          <TableCell key={ac.acNumber} className="text-right font-mono">
                            {metrics.votersPerBooth}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right text-muted-foreground font-mono">
                        {Math.max(...comparisonData.map(a => getDerivedMetrics(a).votersPerBooth)) -
                          Math.min(...comparisonData.map(a => getDerivedMetrics(a).votersPerBooth))}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">
                          AC {comparisonData.reduce((a, b) =>
                            getDerivedMetrics(a).votersPerBooth > getDerivedMetrics(b).votersPerBooth ? a : b
                          ).acNumber}
                        </Badge>
                      </TableCell>
                    </TableRow>

                    {/* Avg Family Size */}
                    <TableRow>
                      <TableCell className="font-medium pl-6">Avg Family Size</TableCell>
                      {comparisonData.map((ac) => {
                        const metrics = getDerivedMetrics(ac);
                        return (
                          <TableCell key={ac.acNumber} className="text-right font-mono">
                            {metrics.votersPerFamily}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right text-muted-foreground font-mono">
                        {(Math.max(...comparisonData.map(a => getDerivedMetrics(a).votersPerFamily)) -
                          Math.min(...comparisonData.map(a => getDerivedMetrics(a).votersPerFamily))).toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">
                          AC {comparisonData.reduce((a, b) =>
                            getDerivedMetrics(a).votersPerFamily > getDerivedMetrics(b).votersPerFamily ? a : b
                          ).acNumber}
                        </Badge>
                      </TableCell>
                    </TableRow>

                    {/* Survey Rate */}
                    <TableRow>
                      <TableCell className="font-medium pl-6">Survey Rate</TableCell>
                      {comparisonData.map((ac) => {
                        const metrics = getDerivedMetrics(ac);
                        return (
                          <TableCell key={ac.acNumber} className="text-right font-mono">
                            {metrics.surveyRate}%
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right text-muted-foreground font-mono">
                        {(Math.max(...comparisonData.map(a => getDerivedMetrics(a).surveyRate)) -
                          Math.min(...comparisonData.map(a => getDerivedMetrics(a).surveyRate))).toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">
                          AC {comparisonData.reduce((a, b) =>
                            getDerivedMetrics(a).surveyRate > getDerivedMetrics(b).surveyRate ? a : b
                          ).acNumber}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};
