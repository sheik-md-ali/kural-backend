import { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
} from 'lucide-react';

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

export const MobileAppResponses = () => {
  const { toast } = useToast();
  const [responses, setResponses] = useState<MobileAppResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAC, setSelectedAC] = useState<string>('all');
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

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-10">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase font-semibold tracking-wide text-primary/80">Mobile App</p>
            <h1 className="text-3xl font-bold mt-1">Mobile App Responses</h1>
            <p className="text-muted-foreground">
              Review incoming submissions from the field app in real time.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Responses</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{pagination.total}</p>
              <p className="text-xs text-muted-foreground mt-1">Across all time</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Answers Captured</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{totalAnswers}</p>
              <p className="text-xs text-muted-foreground mt-1">Across visible responses</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Last Synced</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-balance text-left">
                {lastRefreshedAt ? formatDateTime(lastRefreshedAt) : 'Not yet synced'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Local time</p>
            </CardContent>
          </Card>
        </div>

        <Card className="p-6 space-y-4">
          <div className="flex flex-col gap-4">
            {/* Filter Row */}
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

          {loading && responses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Loading mobile app responses…</p>
            </div>
          ) : responses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <ClipboardList className="h-10 w-10 text-muted-foreground/50" />
              <p className="font-medium">No responses yet</p>
              <p className="text-sm text-muted-foreground">
                Once respondents submit answers through the mobile app, they will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {responses.map((response) => {
                const previewAnswers = response.answers.slice(0, 3);
                const remainingAnswers = response.answers.length - previewAnswers.length;
                const metadataEntries = response.metadata ? Object.entries(response.metadata).slice(0, 4) : [];

                return (
                  <Card key={response.id} className="border border-border/60 shadow-sm">
                    <div className="p-5 flex flex-col gap-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-xl font-semibold flex items-center gap-2">
                              <User className="h-5 w-5 text-primary" />
                              {response.respondentName || 'Unnamed respondent'}
                            </h3>
                            {response.status && (
                              <Badge variant="secondary" className="text-xs">
                                {response.status}
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                            {response.phoneNumber && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-4 w-4" />
                                {response.phoneNumber}
                              </span>
                            )}
                            {response.voterId && (
                              <span className="flex items-center gap-1">
                                <ClipboardList className="h-4 w-4" />
                                {response.voterId}
                              </span>
                            )}
                            {response.submittedAt && (
                              <span className="flex items-center gap-1">
                                <CalendarClock className="h-4 w-4" />
                                {formatDateTime(response.submittedAt)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => openResponseDialog(response)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                        </div>
                      </div>

                      {metadataEntries.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {metadataEntries.map(([key, value]) => (
                            <Badge key={key} variant="outline" className="text-xs gap-1">
                              <MapPin className="h-3 w-3" />
                              <span className="capitalize">{key}:</span>
                              <span className="font-semibold">{String(value)}</span>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <Separator />
                    <div className="p-5 space-y-3 bg-muted/30">
                      {previewAnswers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No answers captured.</p>
                      ) : (
                        previewAnswers.map((answer) => (
                          <div key={answer.id} className="rounded-lg bg-background border p-3">
                            <p className="text-sm font-medium">{answer.prompt}</p>
                            <AnswerValue value={answer.value} />
                          </div>
                        ))
                      )}
                      {remainingAnswers > 0 && (
                        <p className="text-xs text-muted-foreground">
                          +{remainingAnswers} more answer{remainingAnswers > 1 ? 's' : ''}
                        </p>
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


