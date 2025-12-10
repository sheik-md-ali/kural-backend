import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FileCheck, Filter, Eye, Loader2, Building2, MapPin, Calendar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState, useCallback } from 'react';
import { SurveyDetailDrawer } from '@/components/SurveyDetailDrawer';
import { useToast } from '@/components/ui/use-toast';
import { fetchSurveys } from '@/lib/surveys';
import API_BASE_URL from '@/lib/api';
import { useBooths, getBoothLabel } from '@/hooks/use-booths';
import type { NormalizedSurveyResponse } from '@/utils/normalizedTypes';
import {
  normalizeSurveyResponse,
  formatDateTime,
  formatBoothDisplay,
  safeString,
} from '@/utils/universalMappers';

// Loading skeleton
const ResponseSkeleton = () => (
  <div className="space-y-4">
    {[...Array(3)].map((_, i) => (
      <Card key={i} className="p-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="grid grid-cols-4 gap-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      </Card>
    ))}
  </div>
);

export const SurveyManager = () => {
  const { user } = useAuth();
  const acNumber = user?.assignedAC || 119;
  const acName = user?.aciName || 'Assembly Constituency';
  const { toast } = useToast();
  const [selectedSurvey, setSelectedSurvey] = useState<NormalizedSurveyResponse | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [formFilter, setFormFilter] = useState<string>('all');
  const [boothFilter, setBoothFilter] = useState<string>('all');
  const [assignedForms, setAssignedForms] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoadingForms, setIsLoadingForms] = useState(false);
  const [surveyResponses, setSurveyResponses] = useState<NormalizedSurveyResponse[]>([]);
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
      // Normalize responses using universal mapper
      const normalizedResponses = (data.responses || []).map((r: any) => normalizeSurveyResponse(r));
      setSurveyResponses(normalizedResponses);
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

  const handleViewDetails = (survey: NormalizedSurveyResponse) => {
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
            <ResponseSkeleton />
          ) : surveyResponses.length > 0 ? (
            surveyResponses.map((survey) => (
              <Card key={survey.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center flex-wrap gap-3 mb-3">
                      <FileCheck className="h-5 w-5 text-green-500" />
                      <h3 className="text-lg font-semibold">{safeString(survey.respondent_name, 'Unknown')}</h3>
                      <span className="text-sm text-muted-foreground font-mono">
                        ({safeString(survey.voter_id || survey.voterId, 'N/A')})
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        survey.status === 'Completed'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}>
                        {survey.status || 'Unknown'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                      <div className="flex items-center gap-2">
                        <FileCheck className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="text-muted-foreground block text-xs">Survey</span>
                          <span className="font-medium font-mono text-xs">{safeString(survey.survey_id, 'N/A').slice(0, 10)}...</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="text-muted-foreground block text-xs">Booth</span>
                          <span className="font-medium">{formatBoothDisplay(survey.boothname, survey.boothno, survey.booth_id)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="text-muted-foreground block text-xs">Date</span>
                          <span className="font-medium">{formatDateTime(survey.survey_date)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="text-muted-foreground block text-xs">AC</span>
                          <span className="font-medium">AC {survey.ac_id || 'N/A'}</span>
                          {survey.aci_name && (
                            <span className="text-xs text-muted-foreground block">{survey.aci_name}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {survey.answers && survey.answers.length > 0 && (
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm font-medium text-muted-foreground mb-2">
                          {survey.answers.length} answer(s) recorded
                        </p>
                        {survey.answers.slice(0, 2).map((answer, index: number) => (
                          <p key={index} className="text-sm">
                            <span className="font-medium">{answer.questionText || answer.questionId || `Q${index + 1}`}:</span>{' '}
                            {safeString(answer.answerText || String(answer.answer), 'N/A')}
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
              <FileCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
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