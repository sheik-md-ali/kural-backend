import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, GripVertical, Save, Link2, Download, ArrowRight, Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { createSurvey, fetchSurvey, updateSurvey, SurveyStatus } from '@/lib/surveys';
import { fetchMasterSections, MasterQuestion } from '@/lib/masterData';

const constituencies = [
  { number: 101, name: 'Dharapuram (SC)' },
  { number: 102, name: 'Kangayam' },
  { number: 108, name: 'Udhagamandalam' },
  { number: 109, name: 'Gudalur (SC)' },
  { number: 110, name: 'Coonoor' },
  { number: 111, name: 'Mettupalayam' },
  { number: 112, name: 'Avanashi (SC)' },
  { number: 113, name: 'Tiruppur North' },
  { number: 114, name: 'Tiruppur South' },
  { number: 115, name: 'Palladam' },
  { number: 116, name: 'Sulur' },
  { number: 117, name: 'Kavundampalayam' },
  { number: 118, name: 'Coimbatore North' },
  { number: 119, name: 'Thondamuthur' },
  { number: 120, name: 'Coimbatore South' },
  { number: 121, name: 'Singanallur' },
  { number: 122, name: 'Kinathukadavu' },
  { number: 123, name: 'Pollachi' },
  { number: 124, name: 'Valparai (SC)' },
  { number: 125, name: 'Udumalaipettai' },
  { number: 126, name: 'Madathukulam' },
];

interface OptionMapping {
  surveyOptionIndex: number;
  masterQuestionId: string;
  masterOptionValue: string;
}

interface Question {
  id: string;
  text: string;
  type: 'multiple-choice';
  required: boolean;
  options?: string[];
  optionMappings?: OptionMapping[];
}

interface FormData {
  title: string;
  description: string;
  questions: Question[];
  assignedACs: number[];
  status: SurveyStatus;
}

export const FormBuilder = () => {
  const { formId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const resolvedFormId = formId ?? 'new';
  const isNewForm = resolvedFormId === 'new';
  const redirectPath =
    user?.role === 'L0' ? '/l0/surveys' : user?.role === 'L1' ? '/l1/surveys' : '/l2/surveys';

  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    assignedACs: [],
    questions: [],
    status: 'Draft',
  });
  const [isLoading, setIsLoading] = useState(!isNewForm);
  const [isSaving, setIsSaving] = useState(false);
  const [masterQuestions, setMasterQuestions] = useState<MasterQuestion[]>([]);
  const [loadingMasterQuestions, setLoadingMasterQuestions] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importStep, setImportStep] = useState<'search' | 'customize'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMasterQuestion, setSelectedMasterQuestion] = useState<MasterQuestion | null>(null);
  const [customQuestion, setCustomQuestion] = useState({
    text: '',
    options: [] as string[],
    required: false,
  });

  useEffect(() => {
    const loadMasterQuestions = async () => {
      try {
        setLoadingMasterQuestions(true);
        const sections = await fetchMasterSections();

        // Gather all questions from all sections that have options
        const optionBasedTypes = ['multiple-choice', 'checkboxes', 'dropdown', 'rating'];
        const allQuestions: MasterQuestion[] = [];

        sections.forEach((section) => {
          const questions = section.questions
            .filter((q) => optionBasedTypes.includes(q.type) && q.isVisible && q.options.length > 0)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          allQuestions.push(...questions);
        });

        setMasterQuestions(allQuestions);
      } catch (error) {
        console.error('Failed to load master questions', error);
      } finally {
        setLoadingMasterQuestions(false);
      }
    };

    loadMasterQuestions();
  }, []);

  useEffect(() => {
    if (isNewForm) {
      setIsLoading(false);
      setFormData({
        title: '',
        description: '',
        assignedACs: [],
        questions: [],
        status: 'Draft',
      });
      return;
    }

    const loadSurvey = async () => {
      setIsLoading(true);
      try {
        const survey = await fetchSurvey(resolvedFormId);
        setFormData({
          title: survey.title ?? '',
          description: survey.description ?? '',
          assignedACs: Array.isArray(survey.assignedACs) ? survey.assignedACs : [],
          questions: (survey.questions ?? []).map((q) => ({
            ...q,
            type: 'multiple-choice' as const,
            optionMappings: (q as any).optionMappings || undefined,
          })),
          status: survey.status ?? 'Draft',
        });
      } catch (error) {
        console.error('Failed to load survey form', error);
        toast({
          title: 'Unable to load form',
          description: error instanceof Error ? error.message : 'Please try again later.',
          variant: 'destructive',
        });
        navigate(redirectPath);
      } finally {
        setIsLoading(false);
      }
    };

    loadSurvey();
  }, [isNewForm, resolvedFormId, navigate, redirectPath, toast]);

  const addQuestion = () => {
    const newQuestion: Question = {
      id: Date.now().toString(),
      text: '',
      type: 'multiple-choice',
      required: false,
      options: ['Option 1', 'Option 2'],
      optionMappings: [],
    };
    setFormData({
      ...formData,
      questions: [...formData.questions, newQuestion],
    });
  };

  const selectMasterQuestion = (masterQuestion: MasterQuestion) => {
    setSelectedMasterQuestion(masterQuestion);
    setCustomQuestion({
      text: masterQuestion.prompt,
      options: masterQuestion.options.map(opt => opt.label || opt.value),
      required: masterQuestion.isRequired || false,
    });
    setImportStep('customize');
  };

  const finalizeImport = () => {
    if (!selectedMasterQuestion) return;

    // Auto-map each customized survey option to the original master option
    // Only create mappings for options that have corresponding master options
    const autoMappings: OptionMapping[] = customQuestion.options
      .map((_, index) => {
        const masterOption = selectedMasterQuestion.options[index];
        if (!masterOption) return null; // Skip if no corresponding master option

        return {
          surveyOptionIndex: index,
          masterQuestionId: selectedMasterQuestion.id,
          masterOptionValue: masterOption.value || masterOption.label || '',
        };
      })
      .filter((mapping): mapping is OptionMapping => mapping !== null);

    const importedQuestion: Question = {
      id: Date.now().toString(),
      text: customQuestion.text,
      type: 'multiple-choice',
      required: customQuestion.required,
      options: customQuestion.options,
      optionMappings: autoMappings,
    };

    setFormData({
      ...formData,
      questions: [...formData.questions, importedQuestion],
    });

    // Reset import dialog state
    setImportDialogOpen(false);
    setImportStep('search');
    setSearchQuery('');
    setSelectedMasterQuestion(null);
    setCustomQuestion({ text: '', options: [], required: false });

    toast({
      title: 'Question imported',
      description: `"${customQuestion.text}" has been added to your survey.`,
    });
  };

  const closeImportDialog = () => {
    setImportDialogOpen(false);
    setImportStep('search');
    setSearchQuery('');
    setSelectedMasterQuestion(null);
    setCustomQuestion({ text: '', options: [], required: false });
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setFormData({
      ...formData,
      questions: formData.questions.map(q => 
        q.id === id ? { ...q, ...updates } : q
      ),
    });
  };

  const deleteQuestion = (id: string) => {
    setFormData({
      ...formData,
      questions: formData.questions.filter(q => q.id !== id),
    });
  };

  const addOption = (questionId: string) => {
    const question = formData.questions.find(q => q.id === questionId);
    if (!question) return;
    
    const newOptions = [...(question.options || []), ''];
    updateQuestion(questionId, { options: newOptions });
  };

  const updateOption = (questionId: string, optionIndex: number, value: string) => {
    const question = formData.questions.find(q => q.id === questionId);
    if (!question || !question.options) return;
    
    const newOptions = [...question.options];
    newOptions[optionIndex] = value;
    
    // Preserve mappings - don't clear them when option text changes
    // User can still edit the mapping if needed
    updateQuestion(questionId, { options: newOptions });
  };

  const updateOptionMapping = (
    questionId: string,
    optionIndex: number,
    masterQuestionId: string | null,
    masterOptionValue: string | null
  ) => {
    const question = formData.questions.find(q => q.id === questionId);
    if (!question) return;

    let updatedMappings = [...(question.optionMappings || [])];
    
    // Remove existing mapping for this option
    updatedMappings = updatedMappings.filter(m => m.surveyOptionIndex !== optionIndex);
    
    // Add new mapping if provided
    if (masterQuestionId && masterOptionValue) {
      updatedMappings.push({
        surveyOptionIndex: optionIndex,
        masterQuestionId,
        masterOptionValue,
      });
    }
    
    updateQuestion(questionId, { optionMappings: updatedMappings });
  };

  const deleteOption = (questionId: string, optionIndex: number) => {
    const question = formData.questions.find(q => q.id === questionId);
    if (!question || !question.options) return;
    
    const newOptions = question.options.filter((_, i) => i !== optionIndex);
    
    // Remove mappings for deleted option and adjust indices for options after it
    const updatedMappings = (question.optionMappings || [])
      .filter(m => m.surveyOptionIndex !== optionIndex)
      .map(m => ({
        ...m,
        surveyOptionIndex: m.surveyOptionIndex > optionIndex 
          ? m.surveyOptionIndex - 1 
          : m.surveyOptionIndex
      }));
    
    updateQuestion(questionId, { options: newOptions, optionMappings: updatedMappings });
  };

  const toggleAC = (acNumber: number) => {
    setFormData(prev => ({
      ...prev,
      assignedACs: prev.assignedACs.includes(acNumber)
        ? prev.assignedACs.filter(n => n !== acNumber)
        : [...prev.assignedACs, acNumber]
    }));
  };

  const handleSave = async () => {
    const title = formData.title.trim() || 'Untitled Form';
    const normalizedQuestions = formData.questions.map((question, index) => {
      const trimmedOptions = (question.options ?? [])
        .map((option) => option.trim())
        .filter((option) => option.length > 0);

      if (trimmedOptions.length === 0) {
        toast({
          title: 'Question options required',
          description: `Question ${index + 1} must have at least one option.`,
          variant: 'destructive',
        });
        throw new Error('Validation failed');
      }

      const result = {
        ...question,
        text: question.text.trim() || `Question ${index + 1}`,
        options: trimmedOptions,
      };
      
      // Always include optionMappings if it exists (even if empty array)
      if (question.optionMappings !== undefined) {
        result.optionMappings = question.optionMappings;
      }
      
      return result;
    });

    if (!formData.assignedACs.length) {
      toast({
        title: 'Select constituencies',
        description: 'Assign the form to at least one assembly constituency.',
        variant: 'destructive',
      });
      return;
    }

    if (normalizedQuestions.length === 0) {
      toast({
        title: 'Add at least one question',
        description: 'Please create a question before saving the survey form.',
        variant: 'destructive',
      });
      return;
    }

    const payload = {
      title,
      description: formData.description,
      status: formData.status,
      questions: normalizedQuestions,
      assignedACs: formData.assignedACs,
      createdBy: isNewForm ? user?.id : undefined,
      createdByRole: isNewForm ? user?.role : undefined,
    };

    setIsSaving(true);
    try {
      // Debug: Log the payload to see if optionMappings are included
      console.log('Saving survey with payload:', JSON.stringify(payload, null, 2));
      
      if (isNewForm) {
        const created = await createSurvey(payload);
        console.log('Created survey:', JSON.stringify(created, null, 2));
        toast({
          title: 'Form Created',
          description: `"${title}" has been created successfully.`,
        });
      } else {
        const updated = await updateSurvey(resolvedFormId, payload);
        console.log('Updated survey:', JSON.stringify(updated, null, 2));
        toast({
          title: 'Form Updated',
          description: `"${title}" has been updated successfully.`,
        });
      }
      navigate(redirectPath);
    } catch (error) {
      console.error('Failed to save survey form', error);
      toast({
        title: 'Unable to save form',
        description: error instanceof Error ? error.message : 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 pb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">
              {isNewForm ? 'Create New Form' : 'Edit Form'}
            </h1>
            <p className="text-muted-foreground">Build your survey form</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(redirectPath)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Form'}
            </Button>
          </div>
        </div>

        {/* Form Details */}
        <Card className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="formTitle">Form Title</Label>
            <Input
              id="formTitle"
              placeholder="e.g., Voter Intake Form 2025"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="text-lg font-semibold"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="formDescription">Form Description</Label>
            <Textarea
              id="formDescription"
              placeholder="Describe the purpose of this form..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
        </Card>

        {/* Status */}
        <Card className="p-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Survey Status</h2>
            <p className="text-sm text-muted-foreground">
              Toggle to publish the survey immediately or keep it in draft.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Switch
              id="surveyStatus"
              checked={formData.status === 'Active'}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({
                  ...prev,
                  status: checked ? 'Active' : 'Draft',
                }))
              }
            />
            <Label htmlFor="surveyStatus" className="text-sm font-medium uppercase tracking-wide">
              {formData.status}
            </Label>
          </div>
        </Card>

        {/* AC Assignment */}
        <Card className="p-6 space-y-4">
          <div className="space-y-2">
            <Label>Assign to Assembly Constituencies</Label>
            <p className="text-sm text-muted-foreground">
              Select which constituencies will have access to this form
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto p-4 border rounded-md">
            {constituencies.map((ac) => (
              <div key={ac.number} className="flex items-center space-x-2">
                <Checkbox
                  id={`ac-${ac.number}`}
                  checked={formData.assignedACs.includes(ac.number)}
                  onCheckedChange={() => toggleAC(ac.number)}
                />
                <label
                  htmlFor={`ac-${ac.number}`}
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  {ac.number} - {ac.name}
                </label>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {formData.assignedACs.length} constituency(ies) selected
          </p>
        </Card>

        {/* Questions */}
        <div className="space-y-4">
          {formData.questions.map((question, index) => {
            // Check if this question is mapped to master data
            const hasMasterDataMapping = question.optionMappings && question.optionMappings.length > 0;
            const masterQuestionId = hasMasterDataMapping ? question.optionMappings[0].masterQuestionId : null;
            const mappedMasterQuestion = masterQuestionId
              ? masterQuestions.find(q => q.id === masterQuestionId)
              : null;

            return (
              <Card key={question.id} className="p-6 space-y-4 relative">
                {/* Master Data Badge */}
                {hasMasterDataMapping && (
                  <Badge
                    variant="secondary"
                    className="absolute top-4 right-4 bg-primary/10 text-primary border-primary/20"
                  >
                    Master Data
                  </Badge>
                )}

                <div className="flex items-start gap-3">
                  <div className="mt-3 cursor-move">
                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="space-y-2">
                      <Label>Question {index + 1}</Label>
                      <Input
                        placeholder="Enter your question"
                        value={question.text}
                        onChange={(e) => updateQuestion(question.id, { text: e.target.value })}
                      />
                    </div>

                  {/* Options for Multiple Choice */}
                  <div className="space-y-3 pl-4 border-l-2 border-muted">
                    <Label className="text-sm text-muted-foreground">Answer Options</Label>
                    {question.options?.map((option, optionIndex) => {
                      const optionLabel = String.fromCharCode(65 + optionIndex); // A, B, C, etc.

                      return (
                        <div key={optionIndex} className="flex gap-2 items-center">
                          <span className="text-xs font-medium text-muted-foreground w-16">
                            Option {optionLabel}:
                          </span>
                          <Input
                            placeholder={`Option ${optionIndex + 1}`}
                            value={option}
                            onChange={(e) => updateOption(question.id, optionIndex, e.target.value)}
                            className="flex-1"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteOption(question.id, optionIndex)}
                            disabled={question.options && question.options.length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addOption(question.id)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Option
                    </Button>
                  </div>

                  {/* Master Question Reference */}
                  {mappedMasterQuestion && (
                    <div className="mt-4 p-4 bg-muted/30 rounded-md border border-primary/20">
                      <div className="flex items-start gap-2">
                        <Link2 className="h-4 w-4 text-primary mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-primary mb-1">
                            Mapped to Master Question:
                          </p>
                          <p className="text-sm font-medium mb-2">{mappedMasterQuestion.prompt}</p>
                          <div className="flex flex-wrap gap-2">
                            {question.optionMappings?.map((mapping, idx) => {
                              const masterOption = mappedMasterQuestion.options.find(
                                opt => (opt.value || opt.label) === mapping.masterOptionValue
                              );
                              const surveyOptionLabel = String.fromCharCode(65 + mapping.surveyOptionIndex);
                              const masterOptionLabel = String.fromCharCode(65 + mappedMasterQuestion.options.findIndex(
                                opt => (opt.value || opt.label) === mapping.masterOptionValue
                              ));

                              return masterOption ? (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {surveyOptionLabel} → {masterOptionLabel}: {masterOption.label || masterOption.value}
                                </Badge>
                              ) : null;
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id={`required-${question.id}`}
                        checked={question.required}
                        onCheckedChange={(checked) => updateQuestion(question.id, { required: checked })}
                      />
                      <Label htmlFor={`required-${question.id}`} className="text-sm">
                        Required
                      </Label>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteQuestion(question.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
          })}
        </div>

        {/* Add Question Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={addQuestion}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Question
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setImportDialogOpen(true)}
            disabled={masterQuestions.length === 0 || loadingMasterQuestions}
          >
            <Download className="mr-2 h-4 w-4" />
            Import from Master Data
          </Button>
        </div>
      </div>

      {/* Import from Master Data Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={closeImportDialog}>
        <DialogContent className={importStep === 'search' ? 'max-w-2xl max-h-[80vh]' : 'max-w-6xl max-h-[90vh]'}>
          <DialogHeader>
            <DialogTitle>
              {importStep === 'search' ? 'Import Question from Master Data' : 'Customize & Map Question'}
            </DialogTitle>
            <DialogDescription>
              {importStep === 'search'
                ? 'Search and select a master question to import into your survey.'
                : 'Edit the question and answers for your survey. They will be mapped to the master data options.'}
            </DialogDescription>
          </DialogHeader>

          {/* SEARCH PHASE */}
          {importStep === 'search' && (
            <div className="space-y-4">
              {/* Search Box with Dropdown */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                <Input
                  placeholder="Type at least 3 characters to search questions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />

                {/* Dropdown Suggestions */}
                {searchQuery.trim().length >= 3 && (() => {
                  const filteredQuestions = masterQuestions.filter((q) =>
                    q.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    q.options.some(opt => (opt.label || opt.value).toLowerCase().includes(searchQuery.toLowerCase()))
                  );

                  return filteredQuestions.length > 0 ? (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg max-h-[400px] overflow-y-auto z-20">
                      <div className="p-2 border-b bg-muted/30">
                        <p className="text-xs text-muted-foreground">
                          Found {filteredQuestions.length} question{filteredQuestions.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      {filteredQuestions.map((masterQ) => (
                        <div
                          key={masterQ.id}
                          className="p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0 transition-colors"
                          onClick={() => selectMasterQuestion(masterQ)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{masterQ.prompt}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {masterQ.type.replace('-', ' ')}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {masterQ.options.length} option{masterQ.options.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : searchQuery.trim().length >= 3 ? (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg z-20">
                      <div className="p-4 text-center">
                        <p className="text-sm text-muted-foreground">No questions found matching "{searchQuery}"</p>
                        <p className="text-xs text-muted-foreground mt-1">Try a different search term</p>
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>

              {/* Empty State */}
              {loadingMasterQuestions ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-muted-foreground">Loading master questions...</p>
                </div>
              ) : masterQuestions.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No master questions available.</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Create master questions in the Master Data page first.
                  </p>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground font-medium">Type at least 3 characters to search</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Search by question text or answer options
                  </p>
                </div>
              )}
            </div>
          )}

          {/* CUSTOMIZE PHASE */}
          {importStep === 'customize' && selectedMasterQuestion && (
            <div className="space-y-4">
              {/* Split View: Original (Left) and Custom (Right) */}
              <div className="grid grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto">
                {/* LEFT: Original Master Data (Read-only) */}
                <div className="space-y-4 border-r pr-6">
                  <div className="sticky top-0 bg-background pb-2">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                      Master Data (Original)
                    </h3>
                  </div>

                  {/* Original Question */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Question</Label>
                    <div className="p-3 bg-muted/30 rounded-md border">
                      <p className="text-sm">{selectedMasterQuestion.prompt}</p>
                    </div>
                  </div>

                  {/* Original Options */}
                  <div className="space-y-3">
                    <Label className="text-xs text-muted-foreground">Answer Options</Label>
                    {selectedMasterQuestion.options.map((opt, index) => {
                      const optionLabel = String.fromCharCode(65 + index);
                      return (
                        <div key={opt.id || index} className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-semibold text-primary">{optionLabel}</span>
                          </div>
                          <div className="flex-1 p-3 bg-muted/30 rounded-md border">
                            <p className="text-sm">{opt.label || opt.value}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* RIGHT: Customizable Survey Version */}
                <div className="space-y-4 pl-6">
                  <div className="sticky top-0 bg-background pb-2">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                      Your Survey (Editable)
                    </h3>
                  </div>

                  {/* Custom Question */}
                  <div className="space-y-2">
                    <Label htmlFor="custom-question" className="text-xs text-muted-foreground">
                      Question Text
                    </Label>
                    <Textarea
                      id="custom-question"
                      value={customQuestion.text}
                      onChange={(e) => setCustomQuestion({ ...customQuestion, text: e.target.value })}
                      placeholder="Enter your survey question"
                      className="min-h-[80px]"
                    />
                  </div>

                  {/* Custom Options with Mapping Indicators */}
                  <div className="space-y-3">
                    <Label className="text-xs text-muted-foreground">Answer Options</Label>
                    {customQuestion.options.map((option, index) => {
                      const optionLabel = String.fromCharCode(65 + index);
                      const hasMasterOption = selectedMasterQuestion.options[index];

                      return (
                        <div key={index} className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                            <span className="text-xs font-semibold text-primary-foreground">{optionLabel}</span>
                          </div>
                          <div className="flex-1 flex gap-2 items-center">
                            <Input
                              value={option}
                              onChange={(e) => {
                                const newOptions = [...customQuestion.options];
                                newOptions[index] = e.target.value;
                                setCustomQuestion({ ...customQuestion, options: newOptions });
                              }}
                              placeholder={`Option ${optionLabel}`}
                              className={hasMasterOption ? 'border-primary/50' : ''}
                            />
                            {customQuestion.options.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  const newOptions = customQuestion.options.filter((_, i) => i !== index);
                                  setCustomQuestion({ ...customQuestion, options: newOptions });
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          {hasMasterOption && (
                            <div className="flex-shrink-0">
                              <ArrowRight className="h-4 w-4 text-primary" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCustomQuestion({
                          ...customQuestion,
                          options: [...customQuestion.options, ''],
                        });
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Option
                    </Button>
                    {customQuestion.options.length > selectedMasterQuestion.options.length && (
                      <p className="text-xs text-amber-600">
                        Extra options (beyond master data) won't be mapped to master categories.
                      </p>
                    )}
                  </div>

                  {/* Required Toggle */}
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Required</Label>
                      <p className="text-xs text-muted-foreground">
                        Mark this question as mandatory
                      </p>
                    </div>
                    <Switch
                      checked={customQuestion.required}
                      onCheckedChange={(checked) =>
                        setCustomQuestion({ ...customQuestion, required: checked })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-4 border-t">
                <Button
                  variant="ghost"
                  onClick={() => setImportStep('search')}
                >
                  ← Back to Search
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={closeImportDialog}>
                    Cancel
                  </Button>
                  <Button
                    onClick={finalizeImport}
                    disabled={!customQuestion.text.trim() || customQuestion.options.filter(o => o.trim()).length === 0}
                  >
                    Import Question
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};


