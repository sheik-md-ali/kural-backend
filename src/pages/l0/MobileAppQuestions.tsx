import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Trash2, Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { fetchMasterSections, MasterQuestion } from '@/lib/masterData';

export const MobileAppQuestions = () => {
  const { toast } = useToast();
  const [selectedQuestions, setSelectedQuestions] = useState<MasterQuestion[]>([]);
  const [masterQuestions, setMasterQuestions] = useState<MasterQuestion[]>([]);
  const [loadingMasterQuestions, setLoadingMasterQuestions] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadMasterQuestions = async () => {
      try {
        setLoadingMasterQuestions(true);
        const sections = await fetchMasterSections();

        // Gather all questions from all sections
        const allQuestions: MasterQuestion[] = [];
        sections.forEach((section) => {
          const questions = section.questions
            .filter((q) => q.isVisible)
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

  const importQuestion = (masterQuestion: MasterQuestion) => {
    // Check if already selected
    if (selectedQuestions.find(q => q.id === masterQuestion.id)) {
      toast({
        title: 'Already added',
        description: 'This question is already in your list.',
        variant: 'destructive',
      });
      return;
    }

    setSelectedQuestions([...selectedQuestions, masterQuestion]);
    setSearchQuery('');

    toast({
      title: 'Question added',
      description: `"${masterQuestion.prompt}" has been added to the form.`,
    });
  };

  const removeQuestion = (questionId: string) => {
    setSelectedQuestions(selectedQuestions.filter(q => q.id !== questionId));
    toast({
      title: 'Question removed',
      description: 'The question has been removed from the form.',
    });
  };

  const getTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      'short-answer': 'Short Answer',
      'long-answer': 'Long Answer',
      'multiple-choice': 'Multiple Choice',
      'checkboxes': 'Checkboxes',
      'dropdown': 'Dropdown',
      'number': 'Number',
      'date': 'Date',
      'email': 'Email',
      'phone': 'Phone',
      'rating': 'Rating',
    };
    return labels[type] || type;
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Mobile App Additional Details Form</h1>
            <p className="text-muted-foreground">
              Select questions from master data to include in the mobile app form
            </p>
          </div>
          <Button onClick={() => setImportDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Import Question
          </Button>
        </div>

        {/* Selected Questions List */}
        <div className="space-y-4">
          {selectedQuestions.length === 0 ? (
            <Card className="p-12">
              <div className="text-center">
                <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground font-medium">No questions added yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Click "Import Question" to add questions from master data
                </p>
              </div>
            </Card>
          ) : (
            selectedQuestions.map((question, index) => (
              <Card key={question.id} className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">{index + 1}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h3 className="text-lg font-medium">{question.prompt}</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeQuestion(question.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    {question.helperText && (
                      <p className="text-sm text-muted-foreground mb-3">
                        {question.helperText}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline" className="text-xs">
                        {getTypeLabel(question.type)}
                      </Badge>
                      {question.isRequired && (
                        <Badge variant="secondary" className="text-xs">
                          Required
                        </Badge>
                      )}
                      {question.options && question.options.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {question.options.length} option(s)
                        </Badge>
                      )}
                    </div>
                    {question.options && question.options.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {question.options.map((opt, idx) => {
                          const optionLabel = String.fromCharCode(65 + idx);
                          return (
                            <Badge key={opt.id || idx} variant="outline" className="text-xs">
                              {optionLabel}: {opt.label || opt.value}
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Import Question Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Import Question from Master Data</DialogTitle>
            <DialogDescription>
              Search and select questions to add to the mobile app form.
            </DialogDescription>
          </DialogHeader>

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
                  (q.options && q.options.some(opt => (opt.label || opt.value).toLowerCase().includes(searchQuery.toLowerCase())))
                );

                return filteredQuestions.length > 0 ? (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg max-h-[400px] overflow-y-auto z-20">
                    <div className="p-2 border-b bg-muted/30">
                      <p className="text-xs text-muted-foreground">
                        Found {filteredQuestions.length} question{filteredQuestions.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {filteredQuestions.map((masterQ) => {
                      const isSelected = selectedQuestions.find(q => q.id === masterQ.id);
                      return (
                        <div
                          key={masterQ.id}
                          className={`p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0 transition-colors ${
                            isSelected ? 'bg-primary/5' : ''
                          }`}
                          onClick={() => {
                            importQuestion(masterQ);
                            setImportDialogOpen(false);
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-medium truncate">{masterQ.prompt}</p>
                                {isSelected && (
                                  <Badge variant="secondary" className="text-xs">
                                    Added
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {getTypeLabel(masterQ.type)}
                                </Badge>
                                {masterQ.options && masterQ.options.length > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    {masterQ.options.length} option{masterQ.options.length !== 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};
