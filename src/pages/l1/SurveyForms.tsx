import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Edit2, Trash2, FileText, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Switch } from '@/components/ui/switch';
import { fetchSurveys, deleteSurvey, Survey, updateSurveyStatus } from '@/lib/surveys';

export const SurveyForms = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [forms, setForms] = useState<Survey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  useEffect(() => {
    const loadSurveys = async () => {
      setIsLoading(true);
      try {
        // L1 (ACIM) should see all surveys from all roles (L0, L1, L2) like admin
        const data = await fetchSurveys();
        setForms(data);
      } catch (error) {
        console.error('Failed to load surveys', error);
        toast({
          title: 'Unable to load surveys',
          description: error instanceof Error ? error.message : 'Please try again later.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadSurveys();
  }, [toast]);

  const handleCreateNewForm = () => {
    navigate('/l1/surveys/builder/new');
  };

  const handleEditForm = (formId: string) => {
    navigate(`/l1/surveys/builder/${formId}`);
  };

  const handleViewForm = (formId: string) => {
    navigate(`/l1/surveys/preview/${formId}`);
  };

  const handleDeleteForm = async (formId: string, formName: string) => {
    try {
      await deleteSurvey(formId);
      setForms((prev) => prev.filter((form) => form.id !== formId));
      toast({
        title: 'Form Deleted',
        description: `"${formName}" has been deleted successfully.`,
      });
    } catch (error) {
      console.error('Failed to delete survey', error);
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Please try again later.',
        variant: 'destructive',
      });
    }
  };

  const handleStatusToggle = async (form: Survey, checked: boolean) => {
    const nextStatus = checked ? 'Active' : 'Draft';
    setUpdatingStatusId(form.id);
    try {
      const updated = await updateSurveyStatus(form.id, nextStatus);
      setForms((prev) =>
        prev.map((item) => (item.id === updated.id ? { ...item, status: updated.status } : item)),
      );
      toast({
        title: 'Status Updated',
        description: `"${updated.title}" is now ${updated.status}.`,
      });
    } catch (error) {
      console.error('Failed to update survey status', error);
      toast({
        title: 'Unable to update status',
        description: error instanceof Error ? error.message : 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingStatusId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold mb-2">Survey Forms Management</h1>
            <p className="text-muted-foreground">Create and manage survey forms</p>
          </div>
          <Button onClick={handleCreateNewForm}>
            <Plus className="mr-2 h-4 w-4" />
            Create New Form
          </Button>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Form Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Scope</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Questions</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Date Created</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                      Loading surveys...
                    </td>
                  </tr>
                ) : forms.length > 0 ? (
                  forms.map((form) => (
                    <tr key={form.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <span>{form.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {form.assignedACs && form.assignedACs.length > 0 ? (
                          form.assignedACs.length === 1 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              AC {form.assignedACs[0]}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              {form.assignedACs.length} ACs
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                            Universal
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">{form.questions.length} questions</td>
                      <td className="px-4 py-3 text-sm">
                        {form.createdAt ? new Date(form.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              form.status === 'Active'
                                ? 'bg-success/10 text-success'
                                : 'bg-warning/10 text-warning'
                            }`}
                          >
                            {form.status}
                          </span>
                          <Switch
                            checked={form.status === 'Active'}
                            onCheckedChange={(checked) => handleStatusToggle(form, Boolean(checked))}
                            disabled={updatingStatusId === form.id}
                            aria-label={`Toggle status for ${form.title}`}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEditForm(form.id)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleViewForm(form.id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteForm(form.id, form.title)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                      No surveys found. Create your first form to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};
