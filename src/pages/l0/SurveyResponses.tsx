import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';
import { fetchSurvey, Survey } from '@/lib/surveys';
import { useState, useEffect } from 'react';
import { Search, Download, RefreshCw, Eye, FileText, User, Calendar, CheckCircle2, Hash, Building2, Filter } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CONSTITUENCIES } from '@/constants/constituencies';

interface SurveyResponse {
  id: string;
  survey_id: string;
  respondent_name: string;
  voter_id: string;
  booth: string;
  survey_date: string;
  status: string;
  answers: any;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface Booth {
  _id: string;
  boothCode: string;
  boothName: string;
  ac_id: number;
}

export const SurveyResponses = () => {
  const { toast } = useToast();
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [acFilter, setAcFilter] = useState<string>('all');
  const [boothFilter, setBoothFilter] = useState<string>('all');
  const [surveyFilter, setSurveyFilter] = useState<string>('all');
  const [booths, setBooths] = useState<Booth[]>([]);
  const [loadingBooths, setLoadingBooths] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState<SurveyResponse | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [surveyQuestions, setSurveyQuestions] = useState<Survey | null>(null);
  const [loadingSurvey, setLoadingSurvey] = useState(false);

  useEffect(() => {
    fetchResponses();
  }, [pagination.page, acFilter, boothFilter, surveyFilter]);

  // Fetch booths when constituency changes
  useEffect(() => {
    if (acFilter && acFilter !== 'all') {
      fetchBoothsForAC(parseInt(acFilter));
    } else {
      setBooths([]);
      setBoothFilter('all');
    }
  }, [acFilter]);

  const fetchBoothsForAC = async (acId: number) => {
    try {
      setLoadingBooths(true);
      const response = await api.get(`/rbac/booths?ac=${acId}&limit=100`);
      setBooths(response.booths || []);
    } catch (error: any) {
      console.error('Error fetching booths:', error);
      setBooths([]);
    } finally {
      setLoadingBooths(false);
    }
  };

  const fetchResponses = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (acFilter && acFilter !== 'all') {
        params.append('ac', acFilter);
      }

      if (boothFilter && boothFilter !== 'all') {
        params.append('booth', boothFilter);
      }

      if (surveyFilter && surveyFilter !== 'all') {
        params.append('survey', surveyFilter);
      }

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      const data = await api.get(`/survey-responses?${params.toString()}`);
      setResponses(data.responses || []);
      setPagination(prev => ({
        ...prev,
        total: data.pagination?.total || 0,
        pages: data.pagination?.pages || 0,
      }));
    } catch (error: any) {
      console.error('Error fetching survey responses:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch survey responses',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchResponses();
  };

  const handleViewDetails = async (response: SurveyResponse) => {
    setSelectedResponse(response);
    setIsDetailDialogOpen(true);
    
    // Fetch survey questions to display question text
    if (response.survey_id && response.survey_id !== 'N/A') {
      try {
        setLoadingSurvey(true);
        const survey = await fetchSurvey(response.survey_id);
        setSurveyQuestions(survey);
      } catch (error: any) {
        console.error('Error fetching survey:', error);
        // Don't show error toast, just continue without question text
        setSurveyQuestions(null);
      } finally {
        setLoadingSurvey(false);
      }
    } else {
      setSurveyQuestions(null);
    }
  };

  const handleExport = () => {
    toast({
      title: 'Export Started',
      description: 'Preparing survey responses for export...',
    });
    
    // Create CSV content
    const headers = ['ID', 'Survey ID', 'Respondent Name', 'Voter ID', 'Booth', 'Survey Date', 'Status'];
    let csv = headers.join(',') + '\n';
    
    responses.forEach(response => {
      const row = [
        response.id,
        response.survey_id,
        response.respondent_name,
        response.voter_id,
        response.booth,
        new Date(response.survey_date).toLocaleDateString(),
        response.status,
      ];
      csv += row.map(cell => `"${cell}"`).join(',') + '\n';
    });
    
    // Create and download file
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `survey_responses_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: 'Export Completed',
      description: 'Survey responses have been downloaded successfully.',
    });
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Survey Responses</h1>
            <p className="text-muted-foreground mt-2">
              View and manage all survey responses from the database
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExport} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button onClick={fetchResponses} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Card className="p-6">
          <div className="space-y-4">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Search by respondent name, voter ID, or survey ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button onClick={handleSearch}>
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                </div>
              </div>
              <Select value={acFilter} onValueChange={(value) => {
                setAcFilter(value);
                setBoothFilter('all'); // Reset booth filter when AC changes
                setPagination(prev => ({ ...prev, page: 1 }));
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Constituency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Constituencies</SelectItem>
                  {CONSTITUENCIES.map((constituency) => (
                    <SelectItem key={constituency.number} value={String(constituency.number)}>
                      AC {constituency.number} - {constituency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={boothFilter}
                onValueChange={(value) => {
                  setBoothFilter(value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                disabled={acFilter === 'all' || loadingBooths}
              >
                <SelectTrigger>
                  <SelectValue placeholder={acFilter === 'all' ? 'Select Constituency First' : loadingBooths ? 'Loading...' : 'Filter by Booth'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Booths</SelectItem>
                  {booths.map((booth) => (
                    <SelectItem key={booth._id} value={booth.boothCode}>
                      {booth.boothName || booth.boothCode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={surveyFilter} onValueChange={setSurveyFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Survey" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Surveys</SelectItem>
                  {/* Add survey options dynamically if needed */}
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p className="text-muted-foreground">Loading survey responses...</p>
              </div>
            ) : responses.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No survey responses found</p>
              </div>
            ) : (
              <>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Survey ID</TableHead>
                        <TableHead>Respondent Name</TableHead>
                        <TableHead>Voter ID</TableHead>
                        <TableHead>Booth</TableHead>
                        <TableHead>Survey Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {responses.map((response) => (
                        <TableRow key={response.id}>
                          <TableCell className="font-medium">
                            {response.survey_id}
                          </TableCell>
                          <TableCell>{response.respondent_name}</TableCell>
                          <TableCell>{response.voter_id}</TableCell>
                          <TableCell>{response.booth}</TableCell>
                          <TableCell>{formatDate(response.survey_date)}</TableCell>
                          <TableCell>
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${
                                response.status === 'Completed'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                              }`}
                            >
                              {response.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(response)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                    {pagination.total} responses
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                      }
                      disabled={pagination.page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                      }
                      disabled={pagination.page >= pagination.pages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={isDetailDialogOpen} onOpenChange={(open) => {
          setIsDetailDialogOpen(open);
          if (!open) {
            setSurveyQuestions(null);
            setSelectedResponse(null);
          }
        }}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-2xl">
                <FileText className="h-6 w-6 text-primary" />
                Survey Response Details
              </DialogTitle>
              <DialogDescription className="text-base">
                Complete details of the survey response
              </DialogDescription>
            </DialogHeader>
            {selectedResponse && (
              <div className="space-y-6 mt-4">
                {/* Survey Information Card */}
                <Card className="p-6 border-2">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Survey Information</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                      <FileText className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Survey ID</p>
                        <p className="text-sm font-semibold break-all">{selectedResponse.survey_id}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                      <User className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Respondent Name</p>
                        <p className="text-sm font-semibold">{selectedResponse.respondent_name}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                      <Hash className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Voter ID</p>
                        <p className="text-sm font-semibold">{selectedResponse.voter_id}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                      <Building2 className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Booth</p>
                        <p className="text-sm font-semibold">{selectedResponse.booth}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                      <Calendar className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Survey Date</p>
                        <p className="text-sm font-semibold">{formatDate(selectedResponse.survey_date)}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                      <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Status</p>
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                            selectedResponse.status === 'Completed'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                          }`}
                        >
                          {selectedResponse.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Answers Card */}
                <Card className="p-6 border-2">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Answers</h3>
                    {loadingSurvey && (
                      <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground ml-2" />
                    )}
                  </div>
                  <div className="space-y-3">
                    {Array.isArray(selectedResponse.answers) && selectedResponse.answers.length > 0 ? (
                      selectedResponse.answers.map((answer: any, index: number) => {
                        // Find the question text from survey questions
                        const question = surveyQuestions?.questions?.find(
                          (q) => q.id === answer.questionId
                        );
                        
                        return (
                          <Card key={index} className="p-4 bg-muted/30 border">
                            <div className="space-y-3">
                              {question && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Question</p>
                                  <p className="text-sm font-semibold bg-background p-3 rounded-lg border text-foreground">
                                    {question.text}
                                  </p>
                                </div>
                              )}
                              {answer.questionId && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-muted-foreground">Question ID:</span>
                                  <span className="text-xs font-mono bg-background px-2 py-1 rounded">{answer.questionId}</span>
                                </div>
                              )}
                              {answer.answer && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Answer</p>
                                  <p className="text-sm font-semibold bg-background p-3 rounded-lg border">
                                    {answer.answer}
                                  </p>
                                </div>
                              )}
                              {answer.answerText && answer.answerText !== answer.answer && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Answer Text</p>
                                  <p className="text-sm bg-background p-3 rounded-lg border">
                                    {answer.answerText}
                                  </p>
                                </div>
                              )}
                              {answer.selectedOptions && Array.isArray(answer.selectedOptions) && answer.selectedOptions.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Selected Options</p>
                                  <div className="flex flex-wrap gap-2">
                                    {answer.selectedOptions.map((option: string, optIndex: number) => (
                                      <span
                                        key={optIndex}
                                        className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                                      >
                                        {option}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {answer.submittedAt && (
                                <div className="flex items-center gap-2 pt-2 border-t">
                                  <Calendar className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">
                                    Submitted: {new Date(answer.submittedAt).toLocaleString()}
                                  </span>
                                </div>
                              )}
                          </div>
                        </Card>
                        );
                      })
                    ) : typeof selectedResponse.answers === 'object' && selectedResponse.answers !== null ? (
                      <div className="bg-muted/50 p-4 rounded-lg border">
                        <pre className="text-xs overflow-auto font-mono">
                          {JSON.stringify(selectedResponse.answers, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        <p className="text-sm">No answers available</p>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

