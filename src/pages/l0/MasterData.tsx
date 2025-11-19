import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  addMasterQuestion,
  createMasterSection,
  deleteMasterQuestion,
  fetchMasterSections,
  MasterQuestion,
  MasterQuestionType,
  MasterSection,
  updateMasterQuestion,
} from "@/lib/masterData";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Loader2, PenLine, Plus, Trash2 } from "lucide-react";

type QuestionFormState = {
  prompt: string;
  type: MasterQuestionType;
  isRequired: boolean;
  isVisible: boolean;
  helperText: string;
  options: string[];
};

const defaultQuestionForm: QuestionFormState = {
  prompt: "",
  type: "short-answer",
  isRequired: false,
  isVisible: true,
  helperText: "",
  options: ["", ""],
};

export const MasterData = () => {
  const { toast } = useToast();
  const [sections, setSections] = useState<MasterSection[]>([]);
  const [allQuestions, setAllQuestions] = useState<Array<MasterQuestion & { sectionId: string; sectionName: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [questionForm, setQuestionForm] = useState<QuestionFormState>(defaultQuestionForm);
  const [editingQuestion, setEditingQuestion] = useState<{ sectionId: string; questionId: string } | null>(null);
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Flatten all questions from all sections
    const questions: Array<MasterQuestion & { sectionId: string; sectionName: string }> = [];
    sections.forEach((section) => {
      section.questions.forEach((question) => {
        questions.push({
          ...question,
          sectionId: section.id,
          sectionName: section.name,
        });
      });
    });
    setAllQuestions(questions);
  }, [sections]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const data = await fetchMasterSections();
      setSections(data);
    } catch (error) {
      console.error("Failed to load master data", error);
      toast({
        title: "Unable to fetch master data",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenQuestionDialog = (sectionId?: string, questionId?: string) => {
    if (sectionId && questionId) {
      // Edit existing question
      const section = sections.find((s) => s.id === sectionId);
      const question = section?.questions.find((q) => q.id === questionId);
      if (question) {
        const requiresOptions: MasterQuestionType[] = [
          "multiple-choice",
          "checkboxes",
          "dropdown",
          "rating",
        ];
        setEditingQuestion({ sectionId, questionId });
        setQuestionForm({
          prompt: question.prompt,
          type: question.type,
          isRequired: question.isRequired,
          isVisible: question.isVisible ?? true,
          helperText: question.helperText || "",
          options: requiresOptions.includes(question.type)
            ? question.options.map((option) => option.label || option.value || "")
            : ["", ""],
        });
      }
    } else {
      // Create new question
      setEditingQuestion(null);
      setQuestionForm(defaultQuestionForm);
    }
    setQuestionDialogOpen(true);
  };

  const ensureDefaultSection = async (): Promise<string> => {
    // Check if there's already a default section
    let defaultSection = sections.find((s) => s.name === "Default Questions");

    if (!defaultSection) {
      // Create a default section
      defaultSection = await createMasterSection({
        name: "Default Questions",
        description: "Default section for master data questions",
        isVisible: true,
      });
      setSections((prev) => [...prev, defaultSection!]);
    }

    return defaultSection.id;
  };

  const handleQuestionSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const trimmedPrompt = questionForm.prompt.trim();
    if (!trimmedPrompt) {
      toast({
        title: "Question prompt required",
        description: "Please provide a prompt for this question.",
        variant: "destructive",
      });
      return;
    }

    const normalizedOptions = optionRequiredTypes.includes(questionForm.type)
      ? questionForm.options
          .map((option) => (typeof option === 'string' ? option.trim() : ''))
          .filter((option) => option.length > 0)
      : [];

    if (optionRequiredTypes.includes(questionForm.type) && normalizedOptions.length === 0) {
      toast({
        title: "Add answer options",
        description: "This question type requires at least one answer option.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingQuestion(true);
    try {
      const payload = {
        prompt: trimmedPrompt,
        type: questionForm.type,
        isRequired: questionForm.isRequired,
        isVisible: questionForm.isVisible,
        helperText: questionForm.helperText.trim() || undefined,
        options: optionRequiredTypes.includes(questionForm.type) ? normalizedOptions : undefined,
      };

      let updatedSection: MasterSection;

      if (editingQuestion) {
        // Update existing question
        const response = await updateMasterQuestion(editingQuestion.sectionId, editingQuestion.questionId, payload);
        updatedSection = response.section;
      } else {
        // Create new question - ensure we have a default section
        const sectionId = await ensureDefaultSection();
        const response = await addMasterQuestion(sectionId, payload);
        updatedSection = response.section;
      }

      setSections((prev) =>
        prev.map((section) => (section.id === updatedSection.id ? updatedSection : section)),
      );

      toast({
        title: editingQuestion ? "Question updated" : "Question added",
        description: `"${payload.prompt}" saved successfully.`,
      });

      setQuestionDialogOpen(false);
      setEditingQuestion(null);
      setQuestionForm(defaultQuestionForm);
    } catch (error) {
      console.error("Failed to save question", error);
      toast({
        title: "Unable to save question",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSavingQuestion(false);
    }
  };

  const handleDeleteQuestion = async (sectionId: string, questionId: string, prompt: string) => {
    const confirmed = window.confirm(`Delete question "${prompt}"?`);
    if (!confirmed) return;

    try {
      const updatedSection = await deleteMasterQuestion(sectionId, questionId);
      setSections((prev) =>
        prev.map((section) => (section.id === updatedSection.id ? updatedSection : section)),
      );
      toast({
        title: "Question deleted",
        description: `"${prompt}" removed successfully.`,
      });
    } catch (error) {
      console.error("Failed to delete question", error);
      toast({
        title: "Unable to delete question",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    }
  };

  const optionRequiredTypes: MasterQuestionType[] = [
    "multiple-choice",
    "checkboxes",
    "dropdown",
    "rating",
  ];

  const getTypeLabel = (type: MasterQuestionType): string => {
    const labels: Record<MasterQuestionType, string> = {
      "short-answer": "Short Answer",
      "long-answer": "Long Answer",
      "multiple-choice": "Multiple Choice",
      "checkboxes": "Checkboxes",
      "dropdown": "Dropdown",
      "number": "Number",
      "date": "Date",
      "email": "Email",
      "phone": "Phone",
      "rating": "Rating",
    };
    return labels[type] || type;
  };

  const questionOptionsFields = optionRequiredTypes.includes(questionForm.type) ? (
    <div className="space-y-3">
      <Label>
        Answer options
        {questionForm.type === "rating" && (
          <span className="text-sm text-muted-foreground ml-2">
            (e.g., 1, 2, 3, 4, 5 or Poor, Fair, Good, Excellent)
          </span>
        )}
      </Label>
      {questionForm.options.map((option, index) => (
        <div key={index} className="flex gap-2">
          <Input
            placeholder={`Option ${index + 1}`}
            value={option}
            onChange={(event) => {
              const value = event.target.value;
              setQuestionForm((prev) => {
                const next = [...prev.options];
                next[index] = value;
                return { ...prev, options: next };
              });
            }}
          />
          {questionForm.options.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() =>
                setQuestionForm((prev) => ({
                  ...prev,
                  options: prev.options.filter((_, optIndex) => optIndex !== index),
                }))
              }
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          setQuestionForm((prev) => ({
            ...prev,
            options: [...prev.options, ""],
          }))
        }
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Option
      </Button>
    </div>
  ) : null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Master Data Questions</h1>
            <p className="text-muted-foreground">
              Manage reusable questions for surveys and forms
            </p>
          </div>
          <Button onClick={() => handleOpenQuestionDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Question
          </Button>
        </div>

        {/* Questions Table */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mb-2" />
            Loading questions...
          </div>
        ) : allQuestions.length === 0 ? (
          <div className="text-center py-16 space-y-3 border rounded-lg">
            <p className="text-xl font-semibold">No questions yet</p>
            <p className="text-muted-foreground">
              Click the "Add Question" button to create your first question.
            </p>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Options</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allQuestions.map((question) => (
                  <TableRow key={`${question.sectionId}-${question.id}`}>
                    <TableCell className="font-medium">
                      <div>
                        <p>{question.prompt}</p>
                        {question.helperText && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {question.helperText}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getTypeLabel(question.type)}
                      </Badge>
                    </TableCell>
                    <TableCell>{question.sectionName}</TableCell>
                    <TableCell>
                      {optionRequiredTypes.includes(question.type) && question.options.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {question.options.slice(0, 3).map((option, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {option.label || option.value}
                            </Badge>
                          ))}
                          {question.options.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{question.options.length - 3} more
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {question.isRequired && (
                          <Badge variant="secondary">Required</Badge>
                        )}
                        {!question.isVisible && (
                          <Badge variant="outline">Hidden</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenQuestionDialog(question.sectionId, question.id)}
                        >
                          <PenLine className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteQuestion(question.sectionId, question.id, question.prompt)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Add/Edit Question Dialog */}
      <Dialog
        open={questionDialogOpen}
        onOpenChange={(open) => {
          setQuestionDialogOpen(open);
          if (!open) {
            setQuestionForm(defaultQuestionForm);
            setEditingQuestion(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingQuestion ? "Edit Question" : "Add Question"}</DialogTitle>
            <DialogDescription>
              {editingQuestion
                ? "Update the question details below."
                : "Create a new master data question that can be reused across surveys."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleQuestionSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="question-prompt">Question Prompt</Label>
              <Input
                id="question-prompt"
                placeholder="e.g. What is your primary occupation?"
                required
                value={questionForm.prompt}
                onChange={(event) =>
                  setQuestionForm((prev) => ({ ...prev, prompt: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="question-helper">Helper Text (Optional)</Label>
              <Textarea
                id="question-helper"
                placeholder="Add optional context or instructions"
                value={questionForm.helperText}
                onChange={(event) =>
                  setQuestionForm((prev) => ({ ...prev, helperText: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Answer Type</Label>
              <Select
                value={questionForm.type}
                onValueChange={(value: MasterQuestionType) => {
                  const optionRequiredTypes: MasterQuestionType[] = [
                    "multiple-choice",
                    "checkboxes",
                    "dropdown",
                    "rating",
                  ];
                  setQuestionForm((prev) => ({
                    ...prev,
                    type: value,
                    options: optionRequiredTypes.includes(value) ? prev.options : ["", ""],
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select answer type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short-answer">Short Answer</SelectItem>
                  <SelectItem value="long-answer">Long Answer (Paragraph)</SelectItem>
                  <SelectItem value="multiple-choice">Multiple Choice (Radio)</SelectItem>
                  <SelectItem value="checkboxes">Checkboxes (Multiple Select)</SelectItem>
                  <SelectItem value="dropdown">Dropdown (Select)</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Phone Number</SelectItem>
                  <SelectItem value="rating">Rating/Scale</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {questionOptionsFields}

            <div className="flex items-center justify-between rounded-md border px-4 py-3">
              <div className="space-y-0.5">
                <Label className="text-base">Required</Label>
                <p className="text-sm text-muted-foreground">
                  Mark question as mandatory for respondents
                </p>
              </div>
              <Switch
                checked={questionForm.isRequired}
                onCheckedChange={(checked) =>
                  setQuestionForm((prev) => ({ ...prev, isRequired: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-md border px-4 py-3">
              <div className="space-y-0.5">
                <Label className="text-base">Visible</Label>
                <p className="text-sm text-muted-foreground">
                  Show this question in the master data list
                </p>
              </div>
              <Switch
                checked={questionForm.isVisible}
                onCheckedChange={(checked) =>
                  setQuestionForm((prev) => ({ ...prev, isVisible: checked }))
                }
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setQuestionDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingQuestion}>
                {isSavingQuestion && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingQuestion ? "Save Changes" : "Add Question"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default MasterData;
