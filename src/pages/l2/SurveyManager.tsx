import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { FileCheck, Filter, Eye, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState, useCallback } from 'react';
import { SurveyDetailDrawer } from '@/components/SurveyDetailDrawer';
import { useToast } from '@/components/ui/use-toast';
import { fetchSurveys } from '@/lib/surveys';
import API_BASE_URL from '@/lib/api';
import { useBooths, getBoothLabel } from '@/hooks/use-booths';

interface SurveyResponse {
  id: string;
  survey_id: string;
  respondent_name: string;
  voter_id: string;
  voterId: string;
  booth: string;
  booth_id: string | null;
  boothno: string | null;
  ac_id: number | null;
  survey_date: string;
  status: string;
  answers: any[];
}

export const SurveyManager = () => {
  const { user } = useAuth();
  const acNumber = user?.assignedAC || 119;
  const acName = user?.aciName || 'Assembly Constituency';
  const { toast } = useToast();
  const [selectedSurvey, setSelectedSurvey] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [formFilter, setFormFilter] = useState<string>('all');
  const [boothFilter, setBoothFilter] = useState<string>('all');
  const [assignedForms, setAssignedForms] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoadingForms, setIsLoadingForms] = useState(false);
  const [surveyResponses, setSurveyResponses] = useState<SurveyResponse[]>([]);
  const [isLoadingResponses, setIsLoadingResponses] = useState(false);

  // Use centralized booth fetching hook
  const { booths, loading: loadingBooths, fetchBooths } = useBooths();

  // Fetch booths when AC changes
  useEffect(() => {
    if (acNumber) {
      fetchBooths(acNumber);
    }
  }, [acNumber, fetchBooths]);

  // Fetch survey responses from the API
  const fetchSurveyResponses = useCallback(async () => {
    setIsLoadingResponses(true);
    try {
      const params = new URLSearchParams();
      if (formFilter !== 'all') params.append('survey', formFilter);
      if (boothFilter !== 'all') params.append('booth', boothFilter);

      const response = await fetch(
        `${API_BASE_URL}/survey-responses/${acNumber}?${params.toString()}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch survey responses');
      }

      const data = await response.json();
      setSurveyResponses(data.responses || []);
    } catch (error) {
      console.error('Failed to load survey responses', error);
      toast({
        title: 'Unable to load survey responses',
        description: error instanceof Error ? error.message : 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingResponses(false);
    }
  }, [acNumber, formFilter, boothFilter, toast]);

  useEffect(() => {
    const loadAssignedForms = async () => {
      setIsLoadingForms(true);
      try {
        const surveys = await fetchSurveys({ assignedAC: acNumber });
        setAssignedForms(
          surveys
            .filter((survey) => survey.status === 'Active')
            .map((survey) => ({
              id: survey.id,
              name: survey.title,
            })),
        );
      } catch (error) {
        console.error('Failed to load assigned survey forms', error);
        toast({
          title: 'Unable to load survey forms',
          description: error instanceof Error ? error.message : 'Please try again later.',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingForms(false);
      }
    };

    loadAssignedForms();
  }, [acNumber, toast]);

  // Fetch survey responses on mount
  useEffect(() => {
    fetchSurveyResponses();
  }, [acNumber]);

  // Handle filter application
  const handleApplyFilters = () => {
    fetchSurveyResponses();
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const handleViewDetails = (survey: SurveyResponse) => {
    setSelectedSurvey(survey);
    setIsDrawerOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Survey Manager</h1>
          <p className="text-muted-foreground">Review survey responses for AC {acNumber} - {acName}</p>
        </div>

        <Card className="p-4">
          <div className="flex flex-wrap gap-4">
            <Select value={formFilter} onValueChange={setFormFilter}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select Survey Form to View" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Survey Forms</SelectItem>
                {isLoadingForms ? (
                  <SelectItem value="loading" disabled>
                    Loading forms...
                  </SelectItem>
                ) : assignedForms.length > 0 ? (
                  assignedForms.map((form) => (
                    <SelectItem key={form.id} value={form.id}>
                      {form.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    No active forms assigned
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <Select value={boothFilter} onValueChange={setBoothFilter} disabled={loadingBooths}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder={loadingBooths ? "Loading booths..." : "Filter by Booth"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Booths ({booths.length})</SelectItem>
                {booths.map((booth) => (
                  <SelectItem key={booth._id || booth.boothCode} value={booth.boothName || booth.boothCode}>
                    {getBoothLabel(booth)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleApplyFilters} disabled={isLoadingResponses}>
              {isLoadingResponses ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Filter className="mr-2 h-4 w-4" />
              )}
              Apply Filters
            </Button>
          </div>
        </Card>

        <div className="space-y-4">
          {isLoadingResponses ? (
            <Card className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading survey responses...</p>
            </Card>
          ) : surveyResponses.length > 0 ? (
            surveyResponses.map((survey) => (
              <Card key={survey.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <FileCheck className="h-5 w-5 text-success" />
                      <h3 className="text-lg font-semibold">{survey.respondent_name || 'Unknown'}</h3>
                      <span className="text-sm text-muted-foreground">({survey.voterId || survey.voter_id || 'N/A'})</span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Survey:</span>
                        <span className="ml-2 font-medium">{survey.survey_id || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Booth:</span>
                        <span className="ml-2 font-medium">{survey.booth || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Date:</span>
                        <span className="ml-2 font-medium">{formatDate(survey.survey_date)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status:</span>
                        <span className={`ml-2 font-medium ${survey.status === 'Completed' ? 'text-green-600' : 'text-yellow-600'}`}>
                          {survey.status || 'Unknown'}
                        </span>
                      </div>
                    </div>

                    {survey.answers && survey.answers.length > 0 && (
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm font-medium text-muted-foreground mb-2">
                          {survey.answers.length} answer(s) recorded
                        </p>
                        {survey.answers.slice(0, 2).map((answer: any, index: number) => (
                          <p key={index} className="text-sm">
                            <span className="font-medium">{answer.question || answer.questionId || `Q${index + 1}`}:</span>{' '}
                            {answer.answer || answer.value || 'N/A'}
                          </p>
                        ))}
                        {survey.answers.length > 2 && (
                          <p className="text-sm text-muted-foreground mt-1">
                            +{survey.answers.length - 2} more answers...
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleViewDetails(survey)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No survey responses found for this constituency.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Survey responses will appear here once booth agents submit surveys.
              </p>
            </Card>
          )}
        </div>
      </div>

      <SurveyDetailDrawer
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        surveyData={selectedSurvey}
      />
    </DashboardLayout>
  );
};