import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileCheck, Eye, Loader2, Download } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { SurveyDetailDrawer } from '@/components/SurveyDetailDrawer';
import API_BASE_URL from '@/lib/api';

interface SurveyResponse {
  id: string;
  survey_id: string;
  respondent_name: string;
  voter_id: string;
  booth: string;
  booth_id: string | null;
  survey_date: string;
  status: string;
  answers: any[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export const ACSurveyManager = () => {
  const { acNumber } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [boothFilter, setBoothFilter] = useState('all');
  const [selectedSurvey, setSelectedSurvey] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // API state
  const [surveys, setSurveys] = useState<SurveyResponse[]>([]);
  const [booths, setBooths] = useState<{ boothId: string; boothNo: number; boothName: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  });

  // Fetch booths on mount
  useEffect(() => {
    if (acNumber) {
      fetchBooths();
    }
  }, [acNumber]);

  // Fetch survey responses when filters change
  useEffect(() => {
    if (acNumber) {
      fetchSurveyResponses();
    }
  }, [acNumber, boothFilter, pagination.page]);

  const fetchBooths = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/voters/${acNumber}/booths`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch booths');
      }

      const data = await response.json();
      setBooths(data.booths || []);
    } catch (err) {
      console.error('Error fetching booths:', err);
    }
  };

  const fetchSurveyResponses = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (boothFilter && boothFilter !== 'all') {
        params.append('booth', boothFilter);
      }

      const response = await fetch(`${API_BASE_URL}/survey-responses/${acNumber}?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch survey responses');
      }

      const data = await response.json();
      setSurveys(data.responses || []);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error fetching survey responses:', err);
      setError(err instanceof Error ? err.message : 'Failed to load survey responses');
    } finally {
      setLoading(false);
    }
  };

  const handleExportResults = () => {
    toast({
      title: 'Export Started',
      description: 'Survey results export has been initiated. The file will be downloaded shortly.',
    });

    setTimeout(() => {
      const csvContent = [
        ['Respondent', 'Voter ID', 'Booth', 'Date', 'Status'],
        ...surveys.map(survey => [
          survey.respondent_name,
          survey.voter_id,
          survey.booth,
          new Date(survey.survey_date).toLocaleDateString(),
          survey.status
        ])
      ]
        .map(row => row.join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AC-${acNumber}-Survey-Results.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Export Complete',
        description: 'Survey results have been successfully exported.',
      });
    }, 1000);
  };

  const handleViewDetails = (survey: SurveyResponse) => {
    setSelectedSurvey({
      id: survey.id,
      voter: survey.respondent_name,
      voterId: survey.voter_id,
      booth: survey.booth,
      date: new Date(survey.survey_date).toLocaleDateString(),
      status: survey.status,
      answers: survey.answers
    });
    setIsDrawerOpen(true);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/l1/ac/${acNumber}`)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-4xl font-bold">Survey Manager</h1>
              <p className="text-muted-foreground">AC {acNumber} - Review survey responses</p>
            </div>
          </div>
          <Button variant="outline" className="gap-2" onClick={handleExportResults} disabled={surveys.length === 0}>
            <Download className="h-4 w-4" />
            Export Results
          </Button>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded">
            {error}
          </div>
        )}

        <Card className="p-4">
          <div className="flex flex-wrap gap-4">
            <Select value={boothFilter} onValueChange={setBoothFilter}>
              <SelectTrigger className="w-[350px]">
                <SelectValue placeholder="All Booths" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Booths ({booths.length})</SelectItem>
                {booths.map((booth) => (
                  <SelectItem key={booth.boothId} value={booth.boothId}>
                    {booth.boothName || booth.label} ({booth.boothNo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Pagination Info */}
        {!loading && pagination.total > 0 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total.toLocaleString()} responses
            </div>
            {pagination.pages > 1 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                >
                  Previous
                </Button>
                <span className="flex items-center px-3">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page === pagination.pages}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <Card className="p-8">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading survey responses...</span>
            </div>
          </Card>
        ) : surveys.length > 0 ? (
          <div className="space-y-4">
            {surveys.map((survey) => (
              <Card key={survey.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg">{survey.respondent_name}</h3>
                      <Badge variant="outline">{survey.booth}</Badge>
                      <span className="text-sm text-muted-foreground">{formatDate(survey.survey_date)}</span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Voter ID: {survey.voter_id}</p>
                      <Badge variant={survey.status === 'Completed' ? 'default' : 'secondary'}>
                        {survey.status}
                      </Badge>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleViewDetails(survey)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <FileCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No survey responses found for the selected filters.</p>
          </Card>
        )}
      </div>

      <SurveyDetailDrawer
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        surveyData={selectedSurvey}
      />
    </DashboardLayout>
  );
};
