import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit, Trash2, Database, Save, X, Search, Filter, Users, Eye, Info } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import API_BASE_URL from '@/lib/api';

interface VoterField {
  name: string;
  type: 'String' | 'Number' | 'Boolean' | 'Date' | 'Object';
  required: boolean;
  default?: any;
  label?: string;
  description?: string;
  visible?: boolean;
  isReserved?: boolean;
}

interface Voter {
  id: string;
  name: string;
  voterId: string;
  familyId: string;
  booth: string;
  boothNo: number;
  phone: string;
  status: string;
  age?: number;
  gender?: string;
  verified?: boolean;
  surveyed?: boolean;
  [key: string]: any; // For custom fields
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// AC list for selector
const AC_LIST = [
  { value: '101', label: '101 - Dharapuram (SC)' },
  { value: '102', label: '102 - Kangayam' },
  { value: '108', label: '108 - Udhagamandalam' },
  { value: '109', label: '109 - Gudalur (SC)' },
  { value: '110', label: '110 - Coonoor' },
  { value: '111', label: '111 - Mettupalayam' },
  { value: '112', label: '112 - Avanashi (SC)' },
  { value: '113', label: '113 - Tiruppur North' },
  { value: '114', label: '114 - Tiruppur South' },
  { value: '115', label: '115 - Palladam' },
  { value: '116', label: '116 - Sulur' },
  { value: '117', label: '117 - Kavundampalayam' },
  { value: '118', label: '118 - Coimbatore North' },
  { value: '119', label: '119 - Thondamuthur' },
  { value: '120', label: '120 - Coimbatore South' },
  { value: '121', label: '121 - Singanallur' },
  { value: '122', label: '122 - Kinathukadavu' },
  { value: '123', label: '123 - Pollachi' },
  { value: '124', label: '124 - Valparai' },
  { value: '125', label: '125 - Udumalpet' },
  { value: '126', label: '126 - Madathukulam' },
];

// Reserved field names (same as backend)
const RESERVED_FIELDS = [
  '_id',
  'name',
  'voterID',
  'address',
  'DOB',
  'fathername',
  'doornumber',
  'fatherless',
  'guardian',
  'age',
  'gender',
  'mobile',
  'emailid',
  'aadhar',
  'PAN',
  'religion',
  'caste',
  'subcaste',
  'booth_id',
  'boothname',
  'boothno',
  'status',
  'verified',
  'verifiedAt',
  'surveyed',
  'aci_id',
  'aci_name',
  'createdAt',
  'updatedAt',
];

// Helper function to safely render values that might be objects (e.g., {english, tamil})
const renderValue = (value: any): string => {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'object') {
    // Handle bilingual objects like {english, tamil}
    if (value.english && value.tamil) {
      return value.english || value.tamil || 'N/A';
    }
    // Handle other objects
    return JSON.stringify(value);
  }
  return String(value);
};

export const VoterFieldManager = () => {
  const { toast } = useToast();
  const [fields, setFields] = useState<VoterField[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<VoterField | null>(null);
  const [formData, setFormData] = useState<VoterField>({
    name: '',
    type: 'String',
    required: false,
    default: '',
    label: '',
    description: '',
  });

  // Voter data management state
  const [selectedAC, setSelectedAC] = useState<string>('119');
  const [voters, setVoters] = useState<Voter[]>([]);
  const [booths, setBooths] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [boothFilter, setBoothFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [votersLoading, setVotersLoading] = useState(false);
  const [votersError, setVotersError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  });
  const [selectedVoter, setSelectedVoter] = useState<any>(null);
  const [isVoterEditDialogOpen, setIsVoterEditDialogOpen] = useState(false);
  const [editingVoterData, setEditingVoterData] = useState<any>({});
  const [isAddFieldDialogOpen, setIsAddFieldDialogOpen] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<'String' | 'Number' | 'Boolean' | 'Date' | 'Object'>('String');
  const [newFieldValue, setNewFieldValue] = useState<any>('');
  const [existingFieldsFromVoters, setExistingFieldsFromVoters] = useState<{[key: string]: {type: string, samples: any[], visible?: boolean}}>({});
  const [loadingExistingFields, setLoadingExistingFields] = useState(false);
  const [isEditExistingFieldDialogOpen, setIsEditExistingFieldDialogOpen] = useState(false);
  const [editingExistingField, setEditingExistingField] = useState<{name: string, type: string} | null>(null);
  const [editExistingFieldName, setEditExistingFieldName] = useState('');
  const [editExistingFieldType, setEditExistingFieldType] = useState<'String' | 'Number' | 'Boolean' | 'Date' | 'Object'>('String');

  useEffect(() => {
    fetchFields();
    fetchExistingFieldsFromVoters();
  }, []);

  const fetchExistingFieldsFromVoters = async () => {
    try {
      setLoadingExistingFields(true);
      const data = await api.get('/voters/fields/existing');
      console.log('Existing fields data:', data);
      if (data && data.fields) {
        setExistingFieldsFromVoters(data.fields);
      } else {
        setExistingFieldsFromVoters({});
        console.warn('No fields data in response:', data);
      }
    } catch (error: any) {
      console.error('Error fetching existing fields:', error);
      toast({
        title: 'Warning',
        description: 'Could not load existing field reference. Using defined schema only.',
        variant: 'default',
      });
    } finally {
      setLoadingExistingFields(false);
    }
  };

  useEffect(() => {
    if (selectedAC) {
      fetchBooths();
      fetchVoters();
    }
  }, [selectedAC, boothFilter, statusFilter, pagination.page]);

  const fetchBooths = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/voters/${encodeURIComponent(selectedAC)}/booths`,
        {
          credentials: 'include',
        },
      );

      if (!response.ok) {
        throw new Error('Failed to fetch booths');
      }

      const data = await response.json();
      setBooths(data.booths || []);
    } catch (err) {
      console.error('Error fetching booths:', err);
    }
  };

  const fetchVoters = async () => {
    try {
      setVotersLoading(true);
      setVotersError(null);
      
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (boothFilter && boothFilter !== 'all') {
        params.append('booth', boothFilter);
      }

      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      const response = await fetch(
        `${API_BASE_URL}/voters/${encodeURIComponent(selectedAC)}?${params}`,
        {
          credentials: 'include',
        },
      );

      if (!response.ok) {
        throw new Error('Failed to fetch voters');
      }

      const data = await response.json();
      setVoters(data.voters || []);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error fetching voters:', err);
      setVotersError(err instanceof Error ? err.message : 'Failed to load voters');
    } finally {
      setVotersLoading(false);
    }
  };

  const handleVoterSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchVoters();
  };

  const handleEditIndividualVoter = async (voter: Voter) => {
    try {
      // Fetch full voter details
      const fullVoterData = await api.get(`/voters/details/${voter.id}`);
      setSelectedVoter(voter);
      setEditingVoterData({ ...fullVoterData });
      setIsVoterEditDialogOpen(true);
    } catch (error) {
      // Fallback to basic voter data
      setSelectedVoter(voter);
      setEditingVoterData({ ...voter });
      setIsVoterEditDialogOpen(true);
    }
  };

  const handleSaveIndividualVoter = async () => {
    if (!selectedVoter?.id) return;

    try {
      await api.put(`/voters/${selectedVoter.id}`, editingVoterData);
      toast({
        title: 'Voter Updated',
        description: 'Voter fields have been successfully updated.',
      });
      setIsVoterEditDialogOpen(false);
      setSelectedVoter(null);
      fetchVoters();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update voter',
        variant: 'destructive',
      });
    }
  };

  const fetchFields = async () => {
    try {
      setLoading(true);
      const data = await api.get('/voters/fields');
      setFields(data.fields || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch fields',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddField = () => {
    setEditingField(null);
    setFormData({
      name: '',
      type: 'String',
      required: false,
      default: '',
      label: '',
      description: '',
    });
    setIsDialogOpen(true);
  };

  const handleEditField = (field: VoterField) => {
    setEditingField(field);
    setFormData({ ...field });
    setIsDialogOpen(true);
  };

  const handleDeleteField = async (fieldName: string) => {
    if (!confirm(`⚠️ WARNING: Are you sure you want to delete the field "${fieldName}"?\n\nThis will:\n- Remove the field from ALL voters in the database\n- Delete the field definition permanently\n\nThis action cannot be undone!`)) {
      return;
    }

    try {
      const response = await api.delete(`/voters/fields/${fieldName}`);
      toast({
        title: 'Field Deleted',
        description: response.message || `Field "${fieldName}" has been successfully deleted from all voters.`,
      });
      fetchFields();
      fetchExistingFieldsFromVoters();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete field',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteExistingField = async (fieldName: string) => {
    if (!confirm(`⚠️ WARNING: Are you sure you want to delete the field "${fieldName}"?\n\nThis will:\n- Remove the field from ALL voters in the database\n- Delete the field definition permanently (if it exists in schema)\n\nThis action cannot be undone!`)) {
      return;
    }

    try {
      const response = await api.delete(`/voters/fields/${fieldName}`);
      toast({
        title: 'Field Deleted',
        description: response.message || `Field "${fieldName}" has been successfully deleted from all voters.`,
      });
      fetchFields();
      fetchExistingFieldsFromVoters();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete field',
        variant: 'destructive',
      });
    }
  };

  const handleToggleFieldVisibility = async (fieldName: string, newVisible: boolean) => {
    // Store the previous state for potential rollback
    const previousState = existingFieldsFromVoters[fieldName]?.visible !== undefined 
      ? existingFieldsFromVoters[fieldName].visible 
      : true;
    
    // Optimistically update UI immediately
    setExistingFieldsFromVoters(prev => ({
      ...prev,
      [fieldName]: {
        ...prev[fieldName],
        visible: newVisible
      }
    }));

    try {
      const response = await api.put(`/voters/fields/${fieldName}/visibility`, {
        visible: newVisible,
      });
      
      toast({
        title: newVisible ? 'Field Visible' : 'Field Hidden',
        description: response.message || `Field "${fieldName}" visibility is being updated. Updates are processing in the background.`,
      });
      
      // Refresh data asynchronously in the background without blocking
      setTimeout(() => {
        fetchFields().catch(console.error);
        fetchExistingFieldsFromVoters().catch(console.error);
      }, 2000); // Refresh after 2 seconds to allow updates to process
    } catch (error: any) {
      // Revert optimistic update on error
      setExistingFieldsFromVoters(prev => ({
        ...prev,
        [fieldName]: {
          ...prev[fieldName],
          visible: previousState
        }
      }));
      
      toast({
        title: 'Error',
        description: error.message || 'Failed to toggle field visibility',
        variant: 'destructive',
      });
    }
  };

  const handleSaveExistingFieldEdit = async () => {
    if (!editingExistingField) return;

    const { name: oldFieldName } = editingExistingField;
    const newFieldName = editExistingFieldName.trim();
    const newType = editExistingFieldType;

    if (!newFieldName) {
      toast({
        title: 'Validation Error',
        description: 'Field name is required',
        variant: 'destructive',
      });
      return;
    }

    // Validate field name
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newFieldName)) {
      toast({
        title: 'Validation Error',
        description: 'Field name must start with a letter or underscore and contain only letters, numbers, and underscores',
        variant: 'destructive',
      });
      return;
    }

    try {
      const targetFieldName = newFieldName !== oldFieldName ? newFieldName : oldFieldName;
      let renamed = false;
      let typeUpdated = false;
      let messages: string[] = [];
      
      // If field name changed, rename the field
      if (newFieldName !== oldFieldName) {
        const renameResponse = await api.post(`/voters/fields/${oldFieldName}/rename`, {
          newFieldName: newFieldName,
        });
        renamed = true;
        messages.push(renameResponse.message || `Field "${oldFieldName}" has been renamed to "${newFieldName}"`);
        
        // Refresh fields list after rename
        await fetchFields();
      }

      // Fetch fresh fields list to check if field exists in schema
      const fieldsData = await api.get('/voters/fields');
      const fieldInSchema = (fieldsData.fields || []).find((f: VoterField) => f.name === targetFieldName);
      
      // Check if type actually changed
      const oldTypeInferred = editingExistingField.type;
      let oldTypeSchema = 'String';
      if (oldTypeInferred === 'Number') oldTypeSchema = 'Number';
      else if (oldTypeInferred === 'Boolean') oldTypeSchema = 'Boolean';
      else if (oldTypeInferred === 'Date') oldTypeSchema = 'Date';
      else if (oldTypeInferred === 'Object' || oldTypeInferred === 'Array') oldTypeSchema = 'Object';
      
      const typeChanged = newType !== oldTypeSchema;
      
      // If field is in schema, update its type if changed
      if (fieldInSchema) {
        if (typeChanged) {
          await api.put(`/voters/fields/${targetFieldName}`, {
            type: newType,
          });
          typeUpdated = true;
          messages.push(`Field type has been updated to "${newType}"`);
        }
      } else {
        // If field is not in schema, try to create it with the new type
        // This will only succeed if the field doesn't already exist
        try {
          await api.post('/voters/fields', {
            name: targetFieldName,
            type: newType,
            required: false,
          });
          typeUpdated = true;
          messages.push(`Field has been added to schema with type "${newType}"`);
        } catch (createError: any) {
          // Field might already exist in voters but not in schema - that's okay
          // Still update type if it's different
          if (typeChanged) {
            // Try to add it anyway or just log
            console.log('Field not added to schema (may already exist in voters):', createError.message);
          }
        }
      }

      // Always show success message if we got here without errors
      const successMessage = messages.length > 0 
        ? messages.join('. ') 
        : (renamed || typeUpdated 
          ? `Field "${targetFieldName}" has been updated successfully.` 
          : `Field "${targetFieldName}" has been saved successfully.`);
      
      toast({
        title: renamed ? 'Field Renamed' : typeUpdated ? 'Field Updated' : 'Changes Saved',
        description: successMessage,
      });

      setIsEditExistingFieldDialogOpen(false);
      setEditingExistingField(null);
      await fetchFields();
      await fetchExistingFieldsFromVoters();
    } catch (error: any) {
      console.error('Error saving field:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update field',
        variant: 'destructive',
      });
    }
  };

  const handleSaveField = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Field name is required',
        variant: 'destructive',
      });
      return;
    }

    // Validate field name (alphanumeric and underscore only)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(formData.name)) {
      toast({
        title: 'Validation Error',
        description: 'Field name must start with a letter or underscore and contain only letters, numbers, and underscores',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingField) {
        // Update existing field
        await api.put(`/voters/fields/${editingField.name}`, formData);
        toast({
          title: 'Field Updated',
          description: `Field "${formData.name}" has been successfully updated.`,
        });
      } else {
        // Add new field
        const response = await api.post('/voters/fields', formData);
        toast({
          title: 'Field Added to All Voters',
          description: response.message || `Field "${formData.name}" has been successfully added to all voters.`,
        });
      }
      setIsDialogOpen(false);
      fetchFields();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || `Failed to ${editingField ? 'update' : 'add'} field`,
        variant: 'destructive',
      });
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'String':
        return 'bg-blue-500/10 text-blue-600';
      case 'Number':
        return 'bg-green-500/10 text-green-600';
      case 'Boolean':
        return 'bg-purple-500/10 text-purple-600';
      case 'Date':
        return 'bg-orange-500/10 text-orange-600';
      case 'Object':
        return 'bg-pink-500/10 text-pink-600';
      case 'Array':
        return 'bg-indigo-500/10 text-indigo-600';
      case 'Null':
        return 'bg-gray-500/10 text-gray-600';
      case 'Unknown':
        return 'bg-yellow-500/10 text-yellow-600';
      default:
        return 'bg-gray-500/10 text-gray-600';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Voter Field Manager</h1>
            <p className="text-muted-foreground">Manage fields in the voter collection schema and individual voter data</p>
          </div>
        </div>

        <Tabs defaultValue="fields" className="w-full">
          <TabsList>
            <TabsTrigger value="fields">Field Schema Management</TabsTrigger>
            <TabsTrigger value="voters">Voter Data Management</TabsTrigger>
          </TabsList>

          <TabsContent value="fields" className="space-y-6">
            <div className="flex items-center justify-end">
              <Button onClick={handleAddField} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Field
              </Button>
            </div>

            {/* Existing Fields Reference Section */}
            <Card className="border-blue-200 bg-blue-50/50">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-blue-600" />
                    <h2 className="text-xl font-semibold">Existing Fields in Voter Records</h2>
                    <Badge variant="outline" className="ml-2 bg-blue-100">
                      Reference
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const response = await api.post('/voters/fields/convert-all');
                        toast({
                          title: 'Fields Converted',
                          description: response.message || 'All fields have been converted to object format {' + '{ value, visible }' + '}',
                        });
                        await fetchExistingFieldsFromVoters();
                        await fetchFields();
                      } catch (error: any) {
                        toast({
                          title: 'Error',
                          description: error.message || 'Failed to convert fields',
                          variant: 'destructive',
                        });
                      }
                    }}
                    className="gap-2"
                  >
                    <Database className="h-4 w-4" />
                    Convert All to Object Format
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Fields currently found in voter documents with sample data. Click Edit to rename or change data type, or Delete to remove from all voters. Use "Convert All" to ensure all fields are in object format {'{ value, visible }'}.
                </p>
                
                {loadingExistingFields ? (
                  <div className="text-center py-4">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
                    <p className="mt-2 text-sm text-muted-foreground">Analyzing voter records...</p>
                  </div>
                ) : Object.keys(existingFieldsFromVoters).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(existingFieldsFromVoters).map(([fieldName, fieldInfo]) => {
                      // Case-insensitive check for reserved fields
                      const isReserved = RESERVED_FIELDS.some(rf => rf.toLowerCase() === fieldName.toLowerCase());
                      const isInSchema = fields.find(f => f.name === fieldName || f.name?.toLowerCase() === fieldName.toLowerCase());
                      // Critical fields that should never be deleted (but can be edited)
                      const criticalFields = ['_id', 'name', 'voterID', 'voterId', 'createdAt', 'updatedAt'];
                      const isCritical = criticalFields.some(cf => cf.toLowerCase() === fieldName.toLowerCase());
                      
                      return (
                        <Card key={fieldName} className="p-3 bg-white">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-sm">{fieldName}</span>
                                {isReserved && (
                                  <Badge variant="outline" className="text-xs">System</Badge>
                                )}
                                {isInSchema && (
                                  <Badge variant="secondary" className="text-xs">In Schema</Badge>
                                )}
                              </div>
                              <Badge className={`text-xs ${getTypeColor(fieldInfo.type)}`}>
                                {fieldInfo.type}
                              </Badge>
                            </div>
                          </div>
                          
                          {/* Visibility Toggle and Action Buttons */}
                          <div className="flex items-center justify-between mt-2 pt-2 border-t">
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`visibility-${fieldName}`} className="text-xs text-muted-foreground cursor-pointer">
                                Visible in Frontend:
                              </Label>
                              <Switch
                                id={`visibility-${fieldName}`}
                                checked={fieldInfo.visible !== undefined ? fieldInfo.visible : true}
                                onCheckedChange={(checked) => handleToggleFieldVisibility(fieldName, checked)}
                                title={fieldInfo.visible !== undefined && !fieldInfo.visible ? 'Field is hidden in frontend' : 'Field is visible in frontend'}
                              />
                              {fieldInfo.visible !== undefined && !fieldInfo.visible && (
                                <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700">
                                  Hidden
                                </Badge>
                              )}
                            </div>
                            <div className="flex gap-1">
                              {/* Edit button - available for all fields */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingExistingField({ name: fieldName, type: fieldInfo.type });
                                  setEditExistingFieldName(fieldName);
                                  // Map inferred type to schema type
                                  let schemaType: 'String' | 'Number' | 'Boolean' | 'Date' | 'Object' = 'String';
                                  if (fieldInfo.type === 'Number') schemaType = 'Number';
                                  else if (fieldInfo.type === 'Boolean') schemaType = 'Boolean';
                                  else if (fieldInfo.type === 'Date') schemaType = 'Date';
                                  else if (fieldInfo.type === 'Object' || fieldInfo.type === 'Array') schemaType = 'Object';
                                  setEditExistingFieldType(schemaType);
                                  setIsEditExistingFieldDialogOpen(true);
                                }}
                                className="h-6 w-6 p-0"
                                title="Edit field name or data type"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              {/* Delete button - hidden only for critical/system fields */}
                              {!isCritical && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteExistingField(fieldName)}
                                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                  title={isReserved ? `Delete field "${fieldName}" from ALL voters (Warning: System field)` : `Delete field "${fieldName}" from ALL voters`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                          
                          {fieldInfo.samples && fieldInfo.samples.length > 0 && (
                            <div className="mt-2 space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">Sample Values:</p>
                              <div className="space-y-1">
                                {fieldInfo.samples.slice(0, 3).map((sample: any, idx: number) => (
                                  <div key={idx} className="text-xs text-muted-foreground bg-muted/50 p-1.5 rounded truncate">
                                    {sample.value !== null && sample.value !== undefined ? String(sample.value) : 'null'}
                                  </div>
                                ))}
                                {fieldInfo.samples.length > 3 && (
                                  <p className="text-xs text-muted-foreground italic">
                                    +{fieldInfo.samples.length - 3} more...
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No voter records found to analyze.
                  </p>
                )}
              </div>
            </Card>

            {loading ? (
              <Card className="p-8 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
                <p className="mt-4 text-muted-foreground">Loading fields...</p>
              </Card>
            ) : (
              <Card>
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <Database className="h-5 w-5 text-primary" />
                    <h2 className="text-2xl font-semibold">Defined Field Schema</h2>
                    <Badge variant="outline" className="ml-2">
                      {fields.length} {fields.length === 1 ? 'field' : 'fields'}
                    </Badge>
                  </div>

                  {fields.length === 0 ? (
                    <div className="text-center py-12">
                      <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground mb-4">No custom fields defined</p>
                      <Button onClick={handleAddField} variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Your First Field
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {fields.map((field) => (
                        <Card key={field.name} className="p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-lg">{field.name}</h3>
                                {field.required && (
                                  <Badge variant="destructive" className="text-xs">Required</Badge>
                                )}
                              </div>
                              <Badge className={getTypeColor(field.type)}>
                                {field.type}
                              </Badge>
                            </div>
                            <div className="flex gap-1">
                              {!field.isReserved && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditField(field)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              {!field.isReserved && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteField(field.name)}
                                  className="text-destructive hover:text-destructive"
                                  title={`Delete field "${field.name}" from ALL voters`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                              {field.isReserved && (
                                <Badge variant="outline" className="text-xs">System Field</Badge>
                              )}
                            </div>
                          </div>
                          {field.label && (
                            <p className="text-sm text-muted-foreground mb-2">
                              <strong>Label:</strong> {field.label}
                            </p>
                          )}
                          {field.description && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {field.description}
                            </p>
                          )}
                          {field.default !== undefined && field.default !== '' && (
                            <p className="text-xs text-muted-foreground">
                              <strong>Default:</strong> {String(field.default)}
                            </p>
                          )}
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="voters" className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Select value={selectedAC} onValueChange={setSelectedAC}>
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder="Select Assembly Constituency" />
                  </SelectTrigger>
                  <SelectContent>
                    {AC_LIST.map((ac) => (
                      <SelectItem key={ac.value} value={ac.value}>{ac.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {votersError && (
              <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded">
                {votersError}
              </div>
            )}

            <Card className="p-4">
              <div className="flex flex-wrap gap-4">
                <div className="relative flex-1 min-w-[250px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or voter ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleVoterSearch()}
                    className="pl-10"
                  />
                </div>
                <Select value={boothFilter} onValueChange={setBoothFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Booths" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Booths</SelectItem>
                    {booths.map((booth) => (
                      <SelectItem key={booth} value={booth}>{booth}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Surveyed">Surveyed</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Not Contacted">Not Contacted</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={handleVoterSearch}>
                  <Filter className="mr-2 h-4 w-4" />
                  Apply
                </Button>
              </div>
            </Card>

            {!votersLoading && pagination.total > 0 && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div>
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total.toLocaleString()} voters
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

            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Voter ID</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Age</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Gender</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Booth</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Phone</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {votersLoading ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                          Loading voters...
                        </td>
                      </tr>
                    ) : voters.length > 0 ? (
                      voters.map((voter) => (
                        <tr key={voter.id} className="hover:bg-muted/50">
                          <td className="px-4 py-3 text-sm font-medium">{renderValue(voter.name)}</td>
                          <td className="px-4 py-3 text-sm">{renderValue(voter.voterId)}</td>
                          <td className="px-4 py-3 text-sm">{renderValue(voter.age)}</td>
                          <td className="px-4 py-3 text-sm">{renderValue(voter.gender)}</td>
                          <td className="px-4 py-3 text-sm">{renderValue(voter.booth)}</td>
                          <td className="px-4 py-3 text-sm">{renderValue(voter.phone)}</td>
                          <td className="px-4 py-3 text-sm">
                            <Badge variant={voter.status === 'Surveyed' ? "default" : "secondary"}>
                              {renderValue(voter.status || (voter.surveyed ? 'Surveyed' : 'Pending'))}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Button variant="ghost" size="sm" onClick={() => handleEditIndividualVoter(voter)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                          No voters found for the selected filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Field Schema Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                {editingField ? 'Edit Field' : 'Add New Field'}
              </DialogTitle>
              <DialogDescription>
                {editingField
                  ? 'Update the field configuration below. Changes will be applied to the voter collection schema.'
                  : '⚠️ This will add a new field to ALL voters in the database. If you provide a default value, it will be applied to all existing voters that don\'t already have this field.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Field Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="e.g., occupation, qualification"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={!!editingField}
                />
                <p className="text-xs text-muted-foreground">
                  Field name must be unique and contain only letters, numbers, and underscores
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">
                    Field Type <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: VoterField['type']) =>
                      setFormData({ ...formData, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="String">String</SelectItem>
                      <SelectItem value="Number">Number</SelectItem>
                      <SelectItem value="Boolean">Boolean</SelectItem>
                      <SelectItem value="Date">Date</SelectItem>
                      <SelectItem value="Object">Object</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 flex items-end">
                  <div className="flex items-center space-x-2 h-10">
                    <input
                      type="checkbox"
                      id="required"
                      checked={formData.required}
                      onChange={(e) =>
                        setFormData({ ...formData, required: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="required" className="cursor-pointer">
                      Required Field
                    </Label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="label">Display Label</Label>
                <Input
                  id="label"
                  placeholder="e.g., Occupation, Qualification"
                  value={formData.label || ''}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  User-friendly label for displaying this field
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Brief description of this field"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {formData.type !== 'Boolean' && (
                <div className="space-y-2">
                  <Label htmlFor="default">Default Value</Label>
                  <Input
                    id="default"
                    placeholder="Default value (optional)"
                    value={formData.default || ''}
                    onChange={(e) => {
                      let value: any = e.target.value;
                      if (formData.type === 'Number') {
                        value = value ? Number(value) : undefined;
                      }
                      setFormData({ ...formData, default: value });
                    }}
                    type={formData.type === 'Number' ? 'number' : 'text'}
                  />
                  <p className="text-xs text-muted-foreground">
                    Default value that will be added to ALL existing voter records. If left empty, the field will be added with null value to all voters.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSaveField}>
                <Save className="h-4 w-4 mr-2" />
                {editingField ? 'Update Field' : `Add Field to All Voters ${editingField ? '' : '⚠️'}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Individual Voter Edit Dialog */}
        <Dialog open={isVoterEditDialogOpen} onOpenChange={setIsVoterEditDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5" />
                Edit Voter Fields
              </DialogTitle>
              <DialogDescription>
                Add or edit custom fields for this individual voter. Changes only apply to this voter record.
              </DialogDescription>
            </DialogHeader>

            {selectedVoter && (
              <div className="space-y-4 py-4">
                <div className="p-4 bg-muted rounded-lg mb-4">
                  <p className="font-semibold text-sm mb-1">Voter: {selectedVoter.name}</p>
                  <p className="text-xs text-muted-foreground">Voter ID: {selectedVoter.voterId}</p>
                </div>

                {/* Standard Fields */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">Standard Fields</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={editingVoterData.name?.english || editingVoterData.name || ''}
                        onChange={(e) => {
                          setEditingVoterData({
                            ...editingVoterData,
                            name: typeof editingVoterData.name === 'object'
                              ? { ...editingVoterData.name, english: e.target.value }
                              : e.target.value
                          });
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="voterID">Voter ID</Label>
                      <Input
                        id="voterID"
                        value={editingVoterData.voterID || editingVoterData.voterId || ''}
                        onChange={(e) => setEditingVoterData({ ...editingVoterData, voterID: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="age">Age</Label>
                      <Input
                        id="age"
                        type="number"
                        value={editingVoterData.age || ''}
                        onChange={(e) => setEditingVoterData({ ...editingVoterData, age: e.target.value ? parseInt(e.target.value) : undefined })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gender">Gender</Label>
                      <Select
                        value={editingVoterData.gender || ''}
                        onValueChange={(value) => setEditingVoterData({ ...editingVoterData, gender: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mobile">Mobile</Label>
                      <Input
                        id="mobile"
                        value={editingVoterData.mobile?.toString().replace('+91 ', '') || editingVoterData.phone?.toString().replace('+91 ', '') || ''}
                        onChange={(e) => setEditingVoterData({ ...editingVoterData, mobile: e.target.value ? parseInt(e.target.value.replace(/\D/g, '')) : undefined })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        value={editingVoterData.address || ''}
                        onChange={(e) => setEditingVoterData({ ...editingVoterData, address: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fathername">Father's Name</Label>
                      <Input
                        id="fathername"
                        value={editingVoterData.fathername || ''}
                        onChange={(e) => setEditingVoterData({ ...editingVoterData, fathername: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="guardian">Guardian</Label>
                      <Input
                        id="guardian"
                        value={editingVoterData.guardian || ''}
                        onChange={(e) => setEditingVoterData({ ...editingVoterData, guardian: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emailid">Email</Label>
                      <Input
                        id="emailid"
                        type="email"
                        value={editingVoterData.emailid || ''}
                        onChange={(e) => setEditingVoterData({ ...editingVoterData, emailid: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="aadhar">Aadhar</Label>
                      <Input
                        id="aadhar"
                        value={editingVoterData.aadhar || ''}
                        onChange={(e) => setEditingVoterData({ ...editingVoterData, aadhar: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="PAN">PAN</Label>
                      <Input
                        id="PAN"
                        value={editingVoterData.PAN || ''}
                        onChange={(e) => setEditingVoterData({ ...editingVoterData, PAN: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="religion">Religion</Label>
                      <Input
                        id="religion"
                        value={editingVoterData.religion || ''}
                        onChange={(e) => setEditingVoterData({ ...editingVoterData, religion: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="caste">Caste</Label>
                      <Input
                        id="caste"
                        value={editingVoterData.caste || ''}
                        onChange={(e) => setEditingVoterData({ ...editingVoterData, caste: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subcaste">Subcaste</Label>
                      <Input
                        id="subcaste"
                        value={editingVoterData.subcaste || ''}
                        onChange={(e) => setEditingVoterData({ ...editingVoterData, subcaste: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="doornumber">Door Number</Label>
                      <Input
                        id="doornumber"
                        type="number"
                        value={editingVoterData.doornumber || ''}
                        onChange={(e) => setEditingVoterData({ ...editingVoterData, doornumber: e.target.value ? parseInt(e.target.value) : undefined })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="DOB">Date of Birth</Label>
                      <Input
                        id="DOB"
                        type="date"
                        value={editingVoterData.DOB ? (typeof editingVoterData.DOB === 'string' ? editingVoterData.DOB.split('T')[0] : new Date(editingVoterData.DOB).toISOString().split('T')[0]) : ''}
                        onChange={(e) => setEditingVoterData({ ...editingVoterData, DOB: e.target.value ? new Date(e.target.value) : undefined })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={editingVoterData.status || ''}
                        onValueChange={(value) => setEditingVoterData({ ...editingVoterData, status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Surveyed">Surveyed</SelectItem>
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Not Contacted">Not Contacted</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fatherless">Fatherless</Label>
                      <Select
                        value={editingVoterData.fatherless === undefined ? '' : String(editingVoterData.fatherless)}
                        onValueChange={(value) => setEditingVoterData({ ...editingVoterData, fatherless: value === 'true' })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Yes</SelectItem>
                          <SelectItem value="false">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="verified">Verified</Label>
                      <Select
                        value={editingVoterData.verified === undefined ? '' : String(editingVoterData.verified)}
                        onValueChange={(value) => setEditingVoterData({ ...editingVoterData, verified: value === 'true' })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Yes</SelectItem>
                          <SelectItem value="false">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="surveyed">Surveyed</Label>
                      <Select
                        value={editingVoterData.surveyed === undefined ? '' : String(editingVoterData.surveyed)}
                        onValueChange={(value) => setEditingVoterData({ ...editingVoterData, surveyed: value === 'true' })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Yes</SelectItem>
                          <SelectItem value="false">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Custom Fields Section */}
                {fields.filter(f => !f.isReserved).length > 0 && (
                  <div className="space-y-4 mt-6">
                    <h3 className="font-semibold text-lg border-b pb-2">Custom Fields</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {fields.filter(f => !f.isReserved).map((field) => {
                        const fieldValue = editingVoterData[field.name];
                        return (
                          <div key={field.name} className="space-y-2">
                            <Label htmlFor={`custom_${field.name}`}>
                              {field.label || field.name}
                              {field.required && <span className="text-destructive ml-1">*</span>}
                            </Label>
                            {field.type === 'Boolean' ? (
                              <Select
                                value={fieldValue === undefined ? '' : String(fieldValue)}
                                onValueChange={(value) => {
                                  setEditingVoterData({
                                    ...editingVoterData,
                                    [field.name]: value === 'true'
                                  });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select value" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="true">True</SelectItem>
                                  <SelectItem value="false">False</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : field.type === 'Number' ? (
                              <Input
                                id={`custom_${field.name}`}
                                type="number"
                                value={fieldValue || ''}
                                onChange={(e) => setEditingVoterData({
                                  ...editingVoterData,
                                  [field.name]: e.target.value ? Number(e.target.value) : undefined
                                })}
                                placeholder={field.description || `Enter ${field.label || field.name}`}
                              />
                            ) : field.type === 'Date' ? (
                              <Input
                                id={`custom_${field.name}`}
                                type="date"
                                value={fieldValue ? (typeof fieldValue === 'string' ? fieldValue.split('T')[0] : new Date(fieldValue).toISOString().split('T')[0]) : ''}
                                onChange={(e) => setEditingVoterData({
                                  ...editingVoterData,
                                  [field.name]: e.target.value ? new Date(e.target.value) : undefined
                                })}
                              />
                            ) : field.type === 'Object' ? (
                              <div className="space-y-2">
                                <Input
                                  id={`custom_${field.name}`}
                                  value={fieldValue !== null && fieldValue !== undefined ? (typeof fieldValue === 'object' ? JSON.stringify(fieldValue) : String(fieldValue)) : ''}
                                  onChange={(e) => {
                                    try {
                                      const parsed = JSON.parse(e.target.value);
                                      setEditingVoterData({
                                        ...editingVoterData,
                                        [field.name]: parsed
                                      });
                                    } catch {
                                      // If not valid JSON, treat as string
                                      setEditingVoterData({
                                        ...editingVoterData,
                                        [field.name]: e.target.value
                                      });
                                    }
                                  }}
                                  placeholder={field.description || `Enter JSON object (e.g., {'english': 'value', 'tamil': 'value'})`}
                                />
                                {typeof fieldValue === 'object' && fieldValue !== null && (
                                  <div className="text-xs text-muted-foreground">
                                    {fieldValue.english && fieldValue.tamil ? (
                                      <span>English: {fieldValue.english} | Tamil: {fieldValue.tamil}</span>
                                    ) : (
                                      <span>Object: {JSON.stringify(fieldValue)}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <Input
                                id={`custom_${field.name}`}
                                value={fieldValue !== null && fieldValue !== undefined ? (typeof fieldValue === 'object' ? JSON.stringify(fieldValue) : String(fieldValue)) : ''}
                                onChange={(e) => setEditingVoterData({
                                  ...editingVoterData,
                                  [field.name]: e.target.value
                                })}
                                placeholder={field.description || `Enter ${field.label || field.name}`}
                              />
                            )}
                            {field.description && (
                              <p className="text-xs text-muted-foreground">{field.description}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* All Fields Section - Editable */}
                <div className="space-y-4 mt-6">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="font-semibold text-lg">All Fields</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setNewFieldName('');
                        setNewFieldType('String');
                        setNewFieldValue('');
                        setIsAddFieldDialogOpen(true);
                      }}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add Field
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(editingVoterData)
                      .filter(([key]) => {
                        const standardFields = ['name', 'voterID', 'voterId', 'age', 'gender', 'mobile', 'address', 
                          'fathername', 'guardian', 'emailid', 'aadhar', 'PAN', 'religion', 'caste', 'subcaste', 
                          'doornumber', 'DOB', 'status', 'fatherless', 'verified', 'surveyed'];
                        return !['_id', 'id', 'createdAt', 'updatedAt', '__v'].includes(key) &&
                          !standardFields.includes(key) &&
                          !fields.find(f => f.name === key); // Exclude fields already shown in custom fields section
                      })
                      .map(([key, value]) => {
                        // Determine field type based on value
                        let inferredType: 'String' | 'Number' | 'Boolean' | 'Date' | 'Object' = 'String';
                        if (typeof value === 'number') inferredType = 'Number';
                        else if (typeof value === 'boolean') inferredType = 'Boolean';
                        else if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)) && value.includes('-'))) inferredType = 'Date';
                        else if (typeof value === 'object' && value !== null) inferredType = 'Object';

                        return (
                          <div key={key} className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`dynamic_${key}`} className="flex-1">{key}</Label>
                              <Badge variant="outline" className="text-xs">{inferredType}</Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const newData = { ...editingVoterData };
                                  delete newData[key];
                                  setEditingVoterData(newData);
                                }}
                                className="text-destructive h-6 w-6 p-0"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                            {inferredType === 'Boolean' ? (
                              <Select
                                value={value === undefined ? '' : String(value)}
                                onValueChange={(val) => {
                                  setEditingVoterData({
                                    ...editingVoterData,
                                    [key]: val === 'true'
                                  });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select value" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="true">True</SelectItem>
                                  <SelectItem value="false">False</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : inferredType === 'Number' ? (
                              <Input
                                id={`dynamic_${key}`}
                                type="number"
                                value={value !== null && value !== undefined ? String(value) : ''}
                                onChange={(e) => {
                                  const numValue = e.target.value ? Number(e.target.value) : undefined;
                                  setEditingVoterData({
                                    ...editingVoterData,
                                    [key]: numValue
                                  });
                                }}
                              />
                            ) : inferredType === 'Date' ? (
                              <Input
                                id={`dynamic_${key}`}
                                type="date"
                                value={value ? (typeof value === 'string' ? value.split('T')[0] : new Date(value).toISOString().split('T')[0]) : ''}
                                onChange={(e) => {
                                  setEditingVoterData({
                                    ...editingVoterData,
                                    [key]: e.target.value ? new Date(e.target.value) : undefined
                                  });
                                }}
                              />
                            ) : inferredType === 'Object' ? (
                              <div className="space-y-2">
                                <Input
                                  id={`dynamic_${key}`}
                                  value={value !== null && value !== undefined ? (typeof value === 'object' ? JSON.stringify(value) : String(value)) : ''}
                                  onChange={(e) => {
                                    try {
                                      const parsed = JSON.parse(e.target.value);
                                      setEditingVoterData({
                                        ...editingVoterData,
                                        [key]: parsed
                                      });
                                    } catch {
                                      // If not valid JSON, treat as string
                                      setEditingVoterData({
                                        ...editingVoterData,
                                        [key]: e.target.value
                                      });
                                    }
                                  }}
                                  placeholder="Enter JSON object (e.g., {'english': 'value', 'tamil': 'value'})"
                                />
                                {typeof value === 'object' && value !== null && (
                                  <div className="text-xs text-muted-foreground">
                                    {value.english && value.tamil ? (
                                      <span>English: {value.english} | Tamil: {value.tamil}</span>
                                    ) : (
                                      <span>Object: {JSON.stringify(value)}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <Input
                                id={`dynamic_${key}`}
                                value={value !== null && value !== undefined ? String(value) : ''}
                                onChange={(e) => setEditingVoterData({
                                  ...editingVoterData,
                                  [key]: e.target.value
                                })}
                              />
                            )}
                          </div>
                        );
                      })}
                    {Object.keys(editingVoterData).filter(key => {
                      const standardFields = ['name', 'voterID', 'voterId', 'age', 'gender', 'mobile', 'address', 
                        'fathername', 'guardian', 'emailid', 'aadhar', 'PAN', 'religion', 'caste', 'subcaste', 
                        'doornumber', 'DOB', 'status', 'fatherless', 'verified', 'surveyed'];
                      return !['_id', 'id', 'createdAt', 'updatedAt', '__v'].includes(key) &&
                        !standardFields.includes(key) &&
                        !fields.find(f => f.name === key);
                    }).length === 0 && (
                      <div className="col-span-2 text-center py-8 text-muted-foreground">
                        <p>No additional fields. Click "Add Field" to add a new field.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsVoterEditDialogOpen(false)}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSaveIndividualVoter}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Field Dialog */}
        <Dialog open={isAddFieldDialogOpen} onOpenChange={setIsAddFieldDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add New Field to Voter
              </DialogTitle>
              <DialogDescription>
                Add a custom field with a specific data type to this voter record.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="addFieldName">
                  Field Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="addFieldName"
                  placeholder="e.g., occupation, qualification"
                  value={newFieldName}
                  onChange={(e) => {
                    const name = e.target.value.trim().replace(/[^a-zA-Z0-9_]/g, '');
                    setNewFieldName(name);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Field name must contain only letters, numbers, and underscores
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="addFieldType">
                  Data Type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={newFieldType}
                  onValueChange={(value: 'String' | 'Number' | 'Boolean' | 'Date' | 'Object') => {
                    setNewFieldType(value);
                    setNewFieldValue('');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="String">String</SelectItem>
                    <SelectItem value="Number">Number</SelectItem>
                    <SelectItem value="Boolean">Boolean</SelectItem>
                    <SelectItem value="Date">Date</SelectItem>
                    <SelectItem value="Object">Object</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="addFieldValue">
                  Field Value {newFieldType === 'Boolean' && '(Optional)'}
                </Label>
                {newFieldType === 'Boolean' ? (
                  <Select
                    value={newFieldValue === '' ? '' : String(newFieldValue)}
                    onValueChange={(value) => setNewFieldValue(value === 'true')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select value" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">True</SelectItem>
                      <SelectItem value="false">False</SelectItem>
                    </SelectContent>
                  </Select>
                ) : newFieldType === 'Number' ? (
                  <Input
                    id="addFieldValue"
                    type="number"
                    placeholder="Enter number"
                    value={newFieldValue}
                    onChange={(e) => setNewFieldValue(e.target.value ? Number(e.target.value) : '')}
                  />
                ) : newFieldType === 'Date' ? (
                  <Input
                    id="addFieldValue"
                    type="date"
                    value={newFieldValue ? (typeof newFieldValue === 'string' ? newFieldValue.split('T')[0] : new Date(newFieldValue).toISOString().split('T')[0]) : ''}
                    onChange={(e) => setNewFieldValue(e.target.value ? new Date(e.target.value) : '')}
                  />
                ) : (
                  <Input
                    id="addFieldValue"
                    placeholder="Enter value"
                    value={newFieldValue}
                    onChange={(e) => setNewFieldValue(e.target.value)}
                  />
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsAddFieldDialogOpen(false);
                setNewFieldName('');
                setNewFieldType('String');
                setNewFieldValue('');
              }}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!newFieldName.trim()) {
                    toast({
                      title: 'Validation Error',
                      description: 'Field name is required',
                      variant: 'destructive',
                    });
                    return;
                  }

                  // Validate field name
                  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newFieldName)) {
                    toast({
                      title: 'Validation Error',
                      description: 'Field name must start with a letter or underscore and contain only letters, numbers, and underscores',
                      variant: 'destructive',
                    });
                    return;
                  }

                  // Add field to editing voter data
                  setEditingVoterData({
                    ...editingVoterData,
                    [newFieldName]: newFieldValue !== '' ? newFieldValue : (newFieldType === 'Number' ? undefined : newFieldType === 'Boolean' ? false : '')
                  });

                  toast({
                    title: 'Field Added',
                    description: `Field "${newFieldName}" has been added to this voter.`,
                  });

                  setIsAddFieldDialogOpen(false);
                  setNewFieldName('');
                  setNewFieldType('String');
                  setNewFieldValue('');
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Field
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Existing Field Dialog */}
        <Dialog open={isEditExistingFieldDialogOpen} onOpenChange={setIsEditExistingFieldDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5" />
                Edit Field
              </DialogTitle>
              <DialogDescription>
                Change the field name (rename) or data type. Changes will apply to all voter documents.
              </DialogDescription>
            </DialogHeader>

            {editingExistingField && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="editExistingFieldName">
                    Field Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="editExistingFieldName"
                    placeholder="e.g., occupation, qualification"
                    value={editExistingFieldName}
                    onChange={(e) => {
                      const name = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
                      setEditExistingFieldName(name);
                    }}
                    disabled={false}
                  />
                  <p className="text-xs text-muted-foreground">
                    Current name: <strong>{editingExistingField.name}</strong>. Change this to rename the field across all voters.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editExistingFieldType">
                    Data Type <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={editExistingFieldType}
                    onValueChange={(value: 'String' | 'Number' | 'Boolean' | 'Date' | 'Object') => {
                      setEditExistingFieldType(value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="String">String</SelectItem>
                      <SelectItem value="Number">Number</SelectItem>
                      <SelectItem value="Boolean">Boolean</SelectItem>
                      <SelectItem value="Date">Date</SelectItem>
                      <SelectItem value="Object">Object</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Current type: <strong>{editingExistingField.type}</strong>. This updates the field type metadata in the schema.
                  </p>
                </div>

                {editExistingFieldName !== editingExistingField.name && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-xs text-yellow-800">
                      ⚠️ <strong>Field will be renamed:</strong> "{editingExistingField.name}" → "{editExistingFieldName}". This will update all voter documents.
                    </p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsEditExistingFieldDialogOpen(false);
                setEditingExistingField(null);
                setEditExistingFieldName('');
                setEditExistingFieldType('String');
              }}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSaveExistingFieldEdit}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

