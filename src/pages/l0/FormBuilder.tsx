import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, GripVertical, Save } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { createSurvey, fetchSurvey, updateSurvey, SurveyStatus } from '@/lib/surveys';

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

type QuestionType = 'short-text' | 'paragraph' | 'yes-no' | 'multiple-choice' | 'checkboxes' | 'dropdown' | 'date' | 'number';

interface Question {
  id: string;
  text: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
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
          questions: survey.questions ?? [],
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
      type: 'short-text',
      required: false,
    };
    setFormData({
      ...formData,
      questions: [...formData.questions, newQuestion],
    });
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
    updateQuestion(questionId, { options: newOptions });
  };

  const deleteOption = (questionId: string, optionIndex: number) => {
    const question = formData.questions.find(q => q.id === questionId);
    if (!question || !question.options) return;
    
    const newOptions = question.options.filter((_, i) => i !== optionIndex);
    updateQuestion(questionId, { options: newOptions });
  };

  const needsOptions = (type: QuestionType) => {
    return ['multiple-choice', 'checkboxes', 'dropdown'].includes(type);
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
      const trimmedOptions = needsOptions(question.type)
        ? (question.options ?? [])
            .map((option) => option.trim())
            .filter((option) => option.length > 0)
        : undefined;

      return {
        ...question,
        text: question.text.trim() || `Question ${index + 1}`,
        options: trimmedOptions && trimmedOptions.length > 0 ? trimmedOptions : undefined,
      };
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
      if (isNewForm) {
        await createSurvey(payload);
        toast({
          title: 'Form Created',
          description: `"${title}" has been created successfully.`,
        });
      } else {
        await updateSurvey(resolvedFormId, payload);
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
          {formData.questions.map((question, index) => (
            <Card key={question.id} className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-3 cursor-move">
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-2">
                      <Label>Question {index + 1}</Label>
                      <Input
                        placeholder="Enter your question"
                        value={question.text}
                        onChange={(e) => updateQuestion(question.id, { text: e.target.value })}
                      />
                    </div>
                    <div className="w-48 space-y-2">
                      <Label>Question Type</Label>
                      <Select
                        value={question.type}
                        onValueChange={(value: QuestionType) => {
                          const updates: Partial<Question> = { type: value };
                          if (needsOptions(value) && !question.options) {
                            updates.options = ['Option 1'];
                          } else if (!needsOptions(value)) {
                            updates.options = undefined;
                          }
                          updateQuestion(question.id, updates);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="short-text">Short Text</SelectItem>
                          <SelectItem value="paragraph">Paragraph</SelectItem>
                          <SelectItem value="yes-no">Yes / No</SelectItem>
                          <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
                          <SelectItem value="checkboxes">Checkboxes</SelectItem>
                          <SelectItem value="dropdown">Dropdown</SelectItem>
                          <SelectItem value="date">Date</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Options for Multiple Choice, Checkboxes, Dropdown */}
                  {needsOptions(question.type) && (
                    <div className="space-y-3 pl-4 border-l-2 border-muted">
                      <Label className="text-sm text-muted-foreground">Options</Label>
                      {question.options?.map((option, optionIndex) => (
                        <div key={optionIndex} className="flex gap-2">
                          <Input
                            placeholder={`Option ${optionIndex + 1}`}
                            value={option}
                            onChange={(e) => updateOption(question.id, optionIndex, e.target.value)}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteOption(question.id, optionIndex)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addOption(question.id)}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Option
                      </Button>
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
          ))}
        </div>

        {/* Add Question Button */}
        <Button
          variant="outline"
          className="w-full"
          onClick={addQuestion}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Question
        </Button>
      </div>
    </DashboardLayout>
  );
};


