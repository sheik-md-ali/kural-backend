import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FileCheck, Filter, Eye, Loader2, Building2, Calendar, Search, MapPin } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { SurveyDetailDrawer } from '@/components/SurveyDetailDrawer';
import { useToast } from '@/components/ui/use-toast';
import { fetchSurveys } from '@/lib/surveys';
import API_BASE_URL from '@/lib/api';
import { useBooths, getBoothLabel } from '@/hooks/use-booths';
import { CONSTITUENCIES } from '@/constants/constituencies';
import type { NormalizedSurveyResponse } from '@/utils/normalizedTypes';
import {
  normalizeSurveyResponse,
  formatDateTime,
  safeString,
} from '@/utils/universalMappers';

// Helper to format booth display - show booth_id if boothname is empty
const formatBooth = (boothname?: string, boothno?: string, booth_id?: string) => {
  if (boothname && boothname !== 'N/A') return boothname;
  if (boothno && boothno !== 'N/A') return boothno;
  if (booth_id) return booth_id;
  return 'N/A';
};

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

export const LiveSurveyMonitor = () => {
  const { toast } = useToast();
  const [selectedAC, setSelectedAC] = useState<number>(CONSTITUENCIES[0]?.number || 111);
  const [selectedSurvey, setSelectedSurvey] = useState<NormalizedSurveyResponse | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [formFilter, setFormFilter] = useState<string>('all');
  const [boothFilter, setBoothFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [assignedForms, setAssignedForms] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoadingForms, setIsLoadingForms] = useState(false);
  const [surveyResponses, setSurveyResponses] = useState<NormalizedSurveyResponse[]>([]);
  const [isLoadingResponses, setIsLoadingResponses] = useState(false);

  // Use centralized booth fetching hook
  const { booths, loading: loadingBooths, fetchBooths } = useBooths();

  // Get AC name from selected AC
  const acName = CONSTITUENCIES.find(c => c.number === selectedAC)?.name || 'Unknown';

  // Fetch booths when AC changes
  useEffect(() => {
    if (selectedAC) {
      fetchBooths(selectedAC);
      // Reset booth filter when AC changes
      setBoothFilter('all');
    }
  }, [selectedAC, fetchBooths]);

  // Fetch survey responses from the API
  const fetchSurveyResponses = useCallback(async () => {
    if (!selectedAC) return;

    setIsLoadingResponses(true);
    try {
      const params = new URLSearchParams();
      if (formFilter !== 'all') params.append('survey', formFilter);
      if (boothFilter !== 'all') params.append('booth', boothFilter);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());

      const response = await fetch(
        `${API_BASE_URL}/survey-responses/${selectedAC}?${params.toString()}`,
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
  }, [selectedAC, formFilter, boothFilter, searchTerm, toast]);

  useEffect(() => {
    const loadAssignedForms = async () => {
      if (!selectedAC) return;

      setIsLoadingForms(true);
      try {
        const surveys = await fetchSurveys({ assignedAC: selectedAC });
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
  }, [selectedAC, toast]);

  // Fetch survey responses when AC changes
  useEffect(() => {
    if (selectedAC) {
      fetchSurveyResponses();
    }
  }, [selectedAC]);

  // Handle filter application
  const handleApplyFilters = () => {
    fetchSurveyResponses();
  };

  // Handle AC change
  const handleACChange = (value: string) => {
    const acNum = parseInt(value, 10);
    setSelectedAC(acNum);
    setFormFilter('all');
    setBoothFilter('all');
    setSearchTerm('');
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
          <p className="text-muted-foreground">Review survey responses across all Assembly Constituencies</p>
        </div>

        <Card className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            {/* AC Dropdown */}
            <Select value={String(selectedAC)} onValueChange={handleACChange}>
              <SelectTrigger className="w-[220px]">
                <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Select AC" />
              </SelectTrigger>
              <SelectContent>
                {CONSTITUENCIES.map((ac) => (
                  <SelectItem key={ac.number} value={String(ac.number)}>
                    {ac.number} - {ac.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative flex-1 min-w-[200px] max-w-[300px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by voter name..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
              />
            </div>
            <Select value={formFilter} onValueChange={(val) => { setFormFilter(val); }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Survey Form" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Forms</SelectItem>
                {isLoadingForms ? (
                  <SelectItem value="loading" disabled>Loading...</SelectItem>
                ) : assignedForms.length > 0 ? (
                  assignedForms.map((form) => (
                    <SelectItem key={form.id} value={form.id}>{form.name}</SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>No forms</SelectItem>
                )}
              </SelectContent>
            </Select>
            <Select value={boothFilter} onValueChange={(val) => { setBoothFilter(val); }} disabled={loadingBooths}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={loadingBooths ? "Loading..." : "Booth"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Booths</SelectItem>
                {booths.map((booth) => (
                  <SelectItem key={booth._id || booth.boothCode} value={booth.booth_id || booth.boothCode}>
                    {getBoothLabel(booth)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="default" size="sm" onClick={handleApplyFilters} disabled={isLoadingResponses}>
              {isLoadingResponses ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
              <span className="ml-2">Apply</span>
            </Button>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Viewing: <span className="font-medium text-foreground">AC {selectedAC} - {acName}</span>
            </p>
            {surveyResponses.length > 0 && (
              <p className="text-sm text-muted-foreground">{surveyResponses.length} response(s) found</p>
            )}
          </div>
        </Card>

        <div className="space-y-2">
          {isLoadingResponses ? (
            <ResponseSkeleton />
          ) : surveyResponses.length > 0 ? (
            surveyResponses.map((survey) => (
              <Card key={survey.id} className="p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileCheck className={`h-4 w-4 flex-shrink-0 ${survey.status === 'Completed' ? 'text-green-500' : 'text-yellow-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{safeString(survey.respondent_name, 'Unknown')}</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {safeString(survey.voter_id || survey.voterId, '')}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                          survey.status === 'Completed'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300'
                        }`}>
                          {survey.status || 'Pending'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {formatBooth(survey.booth, survey.boothno, survey.booth_id)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDateTime(survey.survey_date)}
                        </span>
                        {survey.answers && survey.answers.length > 0 && (
                          <span className="text-muted-foreground">{survey.answers.length} answer(s)</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => handleViewDetails(survey)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-8 text-center">
              <FileCheck className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No survey responses found for AC {selectedAC}.</p>
              <p className="text-sm text-muted-foreground mt-1">Responses will appear here once submitted.</p>
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
