import { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  fetchMobileAppResponses,
  MobileAppResponse,
  MobileAppResponsesResponse,
} from '@/lib/mobileAppResponses';
import { api } from '@/lib/api';
import { CONSTITUENCIES } from '@/constants/constituencies';
import {
  CalendarClock,
  ClipboardList,
  Eye,
  Filter,
  Loader2,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  User,
  BarChart3,
  List,
  EyeOff,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

// Chart colors
const CHART_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const ITEMS_PER_PAGE = 25;

interface PaginationState {
  hasMore: boolean;
  nextCursor: string | null;
  limit: number;
  total: number;
}

interface LoadParams {
  reset: boolean;
  cursor?: string | null;
  search?: string;
  acId?: string | null;
  boothId?: string | null;
}

interface BoothOption {
  boothNo: number;
  boothName: string;
  booth_id?: string;
  displayName?: string;
}

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return 'Not available';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const AnswerValue = ({ value }: { value: unknown }) => {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground">No response</span>;
  }

  if (Array.isArray(value)) {
    return (
      <div className="space-y-1">
        {value.map((item, index) => (
          <div key={`${index}-${String(item)}`} className="text-sm text-muted-foreground">
            • {typeof item === 'object' ? JSON.stringify(item) : String(item)}
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === 'object') {
    return (
      <pre className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground overflow-auto max-h-48">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  return <span className="text-sm text-muted-foreground break-words">{String(value)}</span>;
};

// Helper to check if a value is NA/empty
const isNAValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && (value.trim() === '' || value.toLowerCase() === 'na' || value.toLowerCase() === 'n/a')) return true;
  return false;
};

// Answer distribution chart data type
interface AnswerDistribution {
  questionId: string;
  prompt: string;
  data: { name: string; value: number; percent: number }[];
  totalResponses: number;
  naCount: number;
}

export const MobileAppResponses = () => {
  const { toast } = useToast();
  const [responses, setResponses] = useState<MobileAppResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  // Default to AC 111 for auto-show behavior
  const [selectedAC, setSelectedAC] = useState<string>('111');
  const [selectedBooth, setSelectedBooth] = useState<string>('all');
  const [booths, setBooths] = useState<BoothOption[]>([]);
  const [loadingBooths, setLoadingBooths] = useState(false);
  const [pagination, setPagination] = useState<PaginationState>({
    hasMore: false,
    nextCursor: null,
    limit: ITEMS_PER_PAGE,
    total: 0,
  });
  const [selectedResponse, setSelectedResponse] = useState<MobileAppResponse | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [hideNA, setHideNA] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('list');

  // Fetch booths when AC changes
  useEffect(() => {
    if (selectedAC && selectedAC !== 'all') {
      fetchBooths(selectedAC);
    } else {
      setBooths([]);
      setSelectedBooth('all');
    }
  }, [selectedAC]);

  const fetchBooths = async (acId: string) => {
    try {
      setLoadingBooths(true);
      const response = await api.get(`/voters/${acId}/booths`);
      setBooths(response.booths || []);
    } catch (error) {
      console.error('Error fetching booths:', error);
      setBooths([]);
    } finally {
      setLoadingBooths(false);
    }
  };

  const loadResponses = useCallback(async ({ reset, cursor, search, acId, boothId }: LoadParams) => {
    try {
      setLoading(true);
      const data: MobileAppResponsesResponse = await fetchMobileAppResponses({
        limit: ITEMS_PER_PAGE,
        cursor: reset ? null : cursor ?? null,
        search,
        acId: acId && acId !== 'all' ? acId : null,
        boothId: boothId && boothId !== 'all' ? boothId : null,
      });

      setResponses((prev) => (reset ? data.responses : [...prev, ...data.responses]));

      setPagination((prev) => ({
        limit: data.pagination?.limit ?? ITEMS_PER_PAGE,
        hasMore: data.pagination?.hasMore ?? false,
        nextCursor: data.pagination?.nextCursor ?? null,
        total:
          typeof data.total === 'number'
            ? data.total
            : reset
              ? data.responses.length
              : prev.total + data.responses.length,
      }));

      setLastRefreshedAt(new Date().toISOString());
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Please try again later.';
      toast({
        title: 'Failed to load responses',
        description,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadResponses({
      reset: true,
      search: undefined,
      acId: selectedAC,
      boothId: selectedBooth,
    });
  }, [loadResponses, selectedAC, selectedBooth]);

  const handleSearch = () => {
    void loadResponses({
      reset: true,
      search: searchTerm.trim() || undefined,
      acId: selectedAC,
      boothId: selectedBooth,
    });
  };

  const handleRefresh = () => {
    setSearchTerm('');
    void loadResponses({
      reset: true,
      search: undefined,
      acId: selectedAC,
      boothId: selectedBooth,
    });
  };

  const handleLoadMore = () => {
    if (!pagination.hasMore || !pagination.nextCursor) {
      return;
    }

    void loadResponses({
      reset: false,
      cursor: pagination.nextCursor,
      search: searchTerm.trim() || undefined,
      acId: selectedAC,
      boothId: selectedBooth,
    });
  };

  const handleACChange = (value: string) => {
    setSelectedAC(value);
    setSelectedBooth('all');
  };

  const handleBoothChange = (value: string) => {
    setSelectedBooth(value);
  };

  const openResponseDialog = (response: MobileAppResponse) => {
    setSelectedResponse(response);
    setIsDialogOpen(true);
  };

  const closeDialog = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setSelectedResponse(null);
    }
  };

  const totalAnswers = useMemo(() => responses.reduce((sum, resp) => sum + resp.answers.length, 0), [responses]);

  // Compute answer distributions for charts
  const answerDistributions = useMemo((): AnswerDistribution[] => {
    const questionMap = new Map<string, { prompt: string; answers: Map<string, number>; naCount: number }>();

    responses.forEach((response) => {
      response.answers.forEach((answer) => {
        const key = answer.questionId || answer.prompt;
        if (!questionMap.has(key)) {
          questionMap.set(key, { prompt: answer.prompt, answers: new Map(), naCount: 0 });
        }
        const q = questionMap.get(key)!;

        const answerStr = isNAValue(answer.value) ? '__NA__' : String(answer.value);
        if (answerStr === '__NA__') {
          q.naCount++;
        } else {
          q.answers.set(answerStr, (q.answers.get(answerStr) || 0) + 1);
        }
      });
    });

    const distributions: AnswerDistribution[] = [];
    questionMap.forEach((value, questionId) => {
      const totalWithData = Array.from(value.answers.values()).reduce((a, b) => a + b, 0);
      const total = totalWithData + value.naCount;
      const data: { name: string; value: number; percent: number }[] = [];

      value.answers.forEach((count, answerValue) => {
        data.push({
          name: answerValue.length > 20 ? answerValue.slice(0, 20) + '...' : answerValue,
          value: count,
          percent: total > 0 ? Math.round((count / total) * 100) : 0,
        });
      });

      // Add NA if not hidden
      if (!hideNA && value.naCount > 0) {
        data.push({
          name: 'N/A',
          value: value.naCount,
          percent: total > 0 ? Math.round((value.naCount / total) * 100) : 0,
        });
      }

      // Sort by count descending
      data.sort((a, b) => b.value - a.value);

      distributions.push({
        questionId,
        prompt: value.prompt,
        data,
        totalResponses: total,
        naCount: value.naCount,
      });
    });

    return distributions;
  }, [responses, hideNA]);

  // Filter responses for display (remove NA answers if hideNA is true)
  const filteredResponsesForDisplay = useMemo(() => {
    if (!hideNA) return responses;
    return responses.map((response) => ({
      ...response,
      answers: response.answers.filter((answer) => !isNAValue(answer.value)),
    }));
  }, [responses, hideNA]);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-4 pb-10">
        {/* Compact Header with inline stats */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Mobile App Responses</h1>
            <p className="text-sm text-muted-foreground">
              Real-time submissions from the field app
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Compact inline stats */}
            <div className="hidden md:flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-md">
                <span className="text-muted-foreground">Responses:</span>
                <span className="font-semibold">{pagination.total}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-md">
                <span className="text-muted-foreground">Answers:</span>
                <span className="font-semibold">{totalAnswers}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-md">
                <span className="text-muted-foreground">Synced:</span>
                <span className="font-semibold text-xs">
                  {lastRefreshedAt ? new Date(lastRefreshedAt).toLocaleTimeString() : 'Never'}
                </span>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Mobile-only stats row */}
        <div className="flex md:hidden items-center gap-2 text-xs overflow-x-auto pb-1">
          <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded shrink-0">
            <span className="text-muted-foreground">Responses:</span>
            <span className="font-semibold">{pagination.total}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded shrink-0">
            <span className="text-muted-foreground">Answers:</span>
            <span className="font-semibold">{totalAnswers}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded shrink-0">
            <span className="text-muted-foreground">Synced:</span>
            <span className="font-semibold">
              {lastRefreshedAt ? new Date(lastRefreshedAt).toLocaleTimeString() : 'Never'}
            </span>
          </div>
        </div>

        <Card className="p-6 space-y-4">
          <div className="flex flex-col gap-4">
            {/* Filter Row */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <Select value={selectedAC} onValueChange={handleACChange}>
                  <SelectTrigger className="w-full md:w-[250px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Select AC" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Constituencies</SelectItem>
                    {CONSTITUENCIES.map((ac) => (
                      <SelectItem key={ac.number} value={String(ac.number)}>
                        {ac.number} - {ac.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={selectedBooth}
                  onValueChange={handleBoothChange}
                  disabled={selectedAC === 'all' || loadingBooths}
                >
                  <SelectTrigger className="w-full md:w-[300px]">
                    <SelectValue placeholder={loadingBooths ? 'Loading booths...' : 'Select Booth'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Booths</SelectItem>
                    {booths.map((booth) => (
                      <SelectItem key={booth.booth_id || booth.boothNo} value={booth.booth_id || String(booth.boothNo)}>
                        {booth.boothName || `Booth ${booth.boothNo}`} ({booth.booth_id?.split('-')[0] || `BOOTH${booth.boothNo}`})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Hide NA Toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  id="hide-na"
                  checked={hideNA}
                  onCheckedChange={setHideNA}
                />
                <Label htmlFor="hide-na" className="text-sm flex items-center gap-1 cursor-pointer">
                  <EyeOff className="h-4 w-4" />
                  Hide N/A
                </Label>
              </div>
            </div>
            {/* Search Row */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex w-full gap-2">
                <Input
                  placeholder="Search by respondent, phone, voter ID or booth…"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={loading}>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>
              <div className="text-sm text-muted-foreground whitespace-nowrap">
                {pagination.total > 0 ? `${pagination.total} records matched` : 'No results yet'}
              </div>
            </div>
          </div>

          <Separator />

          {/* Tabs: List and Charts View */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="list" className="flex items-center gap-2">
                <List className="h-4 w-4" />
                Responses
              </TabsTrigger>
              <TabsTrigger value="charts" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Charts ({answerDistributions.length})
              </TabsTrigger>
            </TabsList>

            {/* Charts View */}
            <TabsContent value="charts" className="mt-4">
              {loading && responses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-muted-foreground">Loading response data…</p>
                </div>
              ) : answerDistributions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                  <BarChart3 className="h-10 w-10 text-muted-foreground/50" />
                  <p className="font-medium">No data for charts</p>
                  <p className="text-sm text-muted-foreground">
                    Select an AC with responses to view answer distributions.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {answerDistributions.map((dist) => (
                    <Card key={dist.questionId} className="p-4">
                      <h4 className="font-semibold text-sm mb-2 line-clamp-2">{dist.prompt}</h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        {dist.totalResponses} responses{dist.naCount > 0 && !hideNA && ` (${dist.naCount} N/A)`}
                      </p>
                      {dist.data.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
                      ) : (
                        <div className="h-[180px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={dist.data}
                                cx="50%"
                                cy="50%"
                                innerRadius={35}
                                outerRadius={60}
                                dataKey="value"
                                label={false}
                                labelLine={false}
                              >
                                {dist.data.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(value: number, name: string) => [`${value} (${dist.data.find(d => d.name === name)?.percent || 0}%)`, name]}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      {/* Answer breakdown */}
                      <div className="mt-3 space-y-1">
                        {dist.data.slice(0, 5).map((item, idx) => (
                          <div key={item.name} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                              />
                              <span className="truncate max-w-[150px]">{item.name}</span>
                            </div>
                            <span className="font-medium">{item.value} ({item.percent}%)</span>
                          </div>
                        ))}
                        {dist.data.length > 5 && (
                          <p className="text-xs text-muted-foreground">+{dist.data.length - 5} more options</p>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* List View */}
            <TabsContent value="list" className="mt-4">
              {loading && filteredResponsesForDisplay.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-muted-foreground">Loading mobile app responses…</p>
                </div>
              ) : filteredResponsesForDisplay.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                  <ClipboardList className="h-10 w-10 text-muted-foreground/50" />
                  <p className="font-medium">No responses yet</p>
                  <p className="text-sm text-muted-foreground">
                    Once respondents submit answers through the mobile app, they will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredResponsesForDisplay.map((response) => {
                    const previewAnswers = response.answers.slice(0, 2);
                    const remainingAnswers = response.answers.length - previewAnswers.length;
                    // Filter out duplicate booth fields - keep only boothName or booth, exclude booth_id and boothNumber
                    const metadataEntries = response.metadata
                      ? Object.entries(response.metadata)
                          .filter(([key]) => !['booth_id', 'boothNumber', 'booth_no'].includes(key))
                          .slice(0, 3)
                      : [];

                    return (
                      <Card key={response.id} className="border border-border/60 shadow-sm">
                        <div className="p-4 flex flex-col gap-3">
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-semibold flex items-center gap-2">
                                  <User className="h-4 w-4 text-primary" />
                                  {response.respondentName || 'Unnamed respondent'}
                                </h3>
                                {response.status && (
                                  <Badge variant="secondary" className="text-xs">
                                    {response.status}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                {response.phoneNumber && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {response.phoneNumber}
                                  </span>
                                )}
                                {response.voterId && (
                                  <span className="flex items-center gap-1">
                                    <ClipboardList className="h-3 w-3" />
                                    {response.voterId}
                                  </span>
                                )}
                                {response.submittedAt && (
                                  <span className="flex items-center gap-1">
                                    <CalendarClock className="h-3 w-3" />
                                    {formatDateTime(response.submittedAt)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => openResponseDialog(response)}>
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </div>

                          {metadataEntries.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {metadataEntries.map(([key, value]) => (
                                <Badge key={key} variant="outline" className="text-xs gap-1 py-0.5">
                                  <span className="capitalize">{key}:</span>
                                  <span className="font-medium">{String(value)}</span>
                                </Badge>
                              ))}
                            </div>
                          )}

                          {previewAnswers.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-2 border-t">
                              {previewAnswers.map((answer) => (
                                <div key={answer.id} className="text-xs bg-muted/50 rounded px-2 py-1 max-w-[200px]">
                                  <span className="text-muted-foreground">{answer.prompt}: </span>
                                  <span className="font-medium truncate">
                                    {isNAValue(answer.value) ? 'N/A' : String(answer.value).slice(0, 30)}
                                    {String(answer.value).length > 30 ? '...' : ''}
                                  </span>
                                </div>
                              ))}
                              {remainingAnswers > 0 && (
                                <span className="text-xs text-muted-foreground self-center">
                                  +{remainingAnswers} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}

                  {pagination.hasMore && (
                    <div className="flex justify-center">
                      <Button onClick={handleLoadMore} disabled={loading}>
                        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Load more responses
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={closeDialog}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-2xl">
                <User className="h-6 w-6 text-primary" />
                Response Details
              </DialogTitle>
              <DialogDescription>Full submission from the mobile app.</DialogDescription>
            </DialogHeader>

            {selectedResponse && (
              <ScrollArea className="max-h-[65vh] pr-4">
                <div className="space-y-6 pb-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Respondent</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Name</p>
                        <p className="text-sm font-semibold">{selectedResponse.respondentName || 'Unknown'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Phone</p>
                        <p className="text-sm font-semibold">{selectedResponse.phoneNumber || 'Not provided'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Voter ID</p>
                        <p className="text-sm font-semibold">{selectedResponse.voterId || 'Not provided'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Submitted At</p>
                        <p className="text-sm font-semibold">{formatDateTime(selectedResponse.submittedAt)}</p>
                      </div>
                      {selectedResponse.status && (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Status</p>
                          <Badge variant="secondary" className="w-max">{selectedResponse.status}</Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {selectedResponse.metadata && Object.keys(selectedResponse.metadata).length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Context</CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(selectedResponse.metadata).map(([key, value]) => (
                          <div key={key} className="rounded-lg border p-3">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">{key}</p>
                            <p className="text-sm font-semibold break-words">{String(value)}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Answers ({selectedResponse.answers.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedResponse.answers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No answers captured for this submission.</p>
                      ) : (
                        selectedResponse.answers.map((answer, index) => (
                          <div key={answer.id || `${answer.prompt}-${index}`} className="rounded-lg border p-4 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium">{answer.prompt}</p>
                              {answer.type && (
                                <Badge variant="outline" className="text-xs">
                                  {answer.type}
                                </Badge>
                              )}
                            </div>
                            <AnswerValue value={answer.value} />
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};


