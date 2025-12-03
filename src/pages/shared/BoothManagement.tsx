import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Edit2, Trash2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';
import { CONSTITUENCIES } from '@/constants/constituencies';

interface Booth {
  _id: string;
  booth_id: string;
  boothCode: string;
  boothNumber: number;
  boothName: string;
  ac_id: number;
  ac_name: string;
  address?: string;
  totalVoters: number;
  assignedAgents: string[];
  isActive: boolean;
}

export const BoothManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const getConstituencyName = (acId?: number | null) => {
    if (!acId) {
      return '';
    }
    return CONSTITUENCIES.find((c) => c.number === Number(acId))?.name || '';
  };

  const getDefaultAcId = () => {
    if (user?.role === 'L2' && user.assignedAC) {
      return user.assignedAC;
    }
    return 119;
  };

  const getDefaultAcName = () => {
    if (user?.role === 'L2') {
      return user.aciName || getConstituencyName(user.assignedAC) || '';
    }
    return getConstituencyName(119) || '';
  };

  const [booths, setBooths] = useState<Booth[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingBooth, setEditingBooth] = useState<Booth | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalBooths, setTotalBooths] = useState(0);
  
  // Form states
  const [newBooth, setNewBooth] = useState({
    boothName: '',
    acId: getDefaultAcId(),
    acName: getDefaultAcName(),
    address: '',
    totalVoters: 0,
  });
  
  const [editBooth, setEditBooth] = useState({
    boothNumber: '',
    boothName: '',
    ac_id: 119,
    ac_name: 'Thondamuthur',
    address: '',
    totalVoters: 0,
  });

  // Keep AC defaults in sync with authenticated user
  useEffect(() => {
    setNewBooth((prev) => {
      const updatedAcId = user?.role === 'L2' && user.assignedAC ? user.assignedAC : prev.acId;
      const updatedAcName =
        user?.role === 'L2'
          ? user.aciName || getConstituencyName(updatedAcId) || prev.acName
          : prev.acName || getConstituencyName(updatedAcId);
      return {
        ...prev,
        acId: updatedAcId,
        acName: updatedAcName,
      };
    });
  }, [user]);

  // Fetch booths on mount
  useEffect(() => {
    if (user) {
      fetchBooths();
    }
  }, [user]);

  const fetchBooths = async (page = 1) => {
    try {
      setLoading(true);
      const response = await api.get(`/rbac/booths?page=${page}&limit=50`);
      console.log('Fetched booths:', response);
      setBooths(response.booths || []);

      // Update pagination state from backend response
      if (response.pagination) {
        setCurrentPage(response.pagination.page);
        setTotalPages(response.pagination.totalPages);
        setTotalBooths(response.pagination.total);
      }
    } catch (error: any) {
      console.error('Error fetching booths:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch booths',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchBooths(newPage);
    }
  };

  const handleCreateBooth = async () => {
    if (!newBooth.boothName) {
      toast({
        title: 'Error',
        description: 'Booth name is required.',
        variant: 'destructive',
      });
      return;
    }

    const normalizedAcId = Number(newBooth.acId || user?.assignedAC || 0);
    const resolvedAcName =
      (newBooth.acName && newBooth.acName.trim()) ||
      user?.aciName ||
      getConstituencyName(normalizedAcId);

    if (!normalizedAcId || !resolvedAcName) {
      toast({
        title: 'Error',
        description: 'Assembly constituency details are missing. Please select an AC.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setCreating(true);
      console.log('Creating booth with data:', newBooth);
      
      const response = await api.post('/rbac/booths', {
        boothName: newBooth.boothName.trim(),
        ac_id: normalizedAcId,
        ac_name: resolvedAcName,
        address: newBooth.address?.trim() || undefined,
        totalVoters: Number(newBooth.totalVoters) || 0,
      });
      
      console.log('Booth created:', response);
      
      toast({
        title: 'Success',
        description: `Booth ${response.booth.boothCode} created successfully`,
      });
      
      // Refresh booth list
      await fetchBooths();
      
      // Reset form and close dialog
      setNewBooth({
        boothName: '',
        acId: getDefaultAcId(),
        acName: getDefaultAcName(),
        address: '',
        totalVoters: 0,
      });
      setIsOpen(false);
    } catch (error: any) {
      console.error('Error creating booth:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create booth',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleEditClick = (booth: Booth) => {
    setEditingBooth(booth);
    setEditBooth({
      boothNumber: booth.boothNumber.toString(),
      boothName: booth.boothName,
      ac_id: booth.ac_id,
      ac_name: booth.ac_name,
      address: booth.address || '',
      totalVoters: booth.totalVoters,
    });
    setIsEditOpen(true);
  };

  const handleUpdateBooth = async () => {
    if (!editingBooth || !editBooth.boothNumber || !editBooth.boothName) {
      toast({
        title: 'Error',
        description: 'Booth number and name are required.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUpdating(true);
      console.log('Updating booth:', editingBooth._id, editBooth);
      
      const response = await api.put(`/rbac/booths/${editingBooth._id}`, {
        boothNumber: parseInt(editBooth.boothNumber),
        boothName: editBooth.boothName,
        ac_id: parseInt(editBooth.ac_id.toString()),
        ac_name: editBooth.ac_name,
        address: editBooth.address || undefined,
        totalVoters: editBooth.totalVoters || 0,
      });
      
      console.log('Booth updated:', response);
      
      toast({
        title: 'Success',
        description: 'Booth updated successfully',
      });
      
      // Refresh booth list
      await fetchBooths();
      
      setIsEditOpen(false);
      setEditingBooth(null);
    } catch (error: any) {
      console.error('Error updating booth:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update booth',
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteBooth = async (booth: Booth) => {
    if (!confirm(`Are you sure you want to delete "${booth.boothName}"?`)) {
      return;
    }

    try {
      console.log('Deleting booth:', booth._id);
      await api.delete(`/rbac/booths/${booth._id}`);
      
      toast({
        title: 'Success',
        description: 'Booth deleted successfully',
      });
      
      // Refresh booth list
      await fetchBooths();
    } catch (error: any) {
      console.error('Error deleting booth:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete booth',
        variant: 'destructive',
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold mb-2">Booth Management</h1>
            <p className="text-muted-foreground">
              {user?.role === 'L2' 
                ? `Manage booths for AC ${user.assignedAC || '...'}`
                : 'Manage booths across all constituencies'}
            </p>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button>
                <Building2 className="mr-2 h-4 w-4" />
                Create New Booth
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Booth</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="boothName">Booth Name <span className="text-destructive">*</span></Label>
                  <Input 
                    id="boothName" 
                    placeholder="e.g., Government School, Main Road" 
                    value={newBooth.boothName}
                    onChange={(e) => setNewBooth({...newBooth, boothName: e.target.value})}
                  />
                  <p className="text-xs text-muted-foreground">
                    Booth number will be auto-generated based on existing booths in this AC
                  </p>
                </div>
                {user?.role !== 'L2' && (
                  <div className="space-y-2">
                    <Label htmlFor="ac">Assembly Constituency <span className="text-destructive">*</span></Label>
                    <Select 
                      value={newBooth.acId?.toString() || ''} 
                      onValueChange={(value) => {
                        const constituency = CONSTITUENCIES.find(c => c.number === parseInt(value));
                        setNewBooth({
                          ...newBooth, 
                          acId: parseInt(value, 10),
                          acName: constituency?.name || ''
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select AC" />
                      </SelectTrigger>
                      <SelectContent>
                        {CONSTITUENCIES.map(c => (
                          <SelectItem key={c.number} value={c.number.toString()}>
                            {c.number} - {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input 
                    id="address" 
                    placeholder="Enter full address" 
                    value={newBooth.address}
                    onChange={(e) => setNewBooth({...newBooth, address: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="voters">Total Registered Voters</Label>
                  <Input 
                    id="voters" 
                    type="number" 
                    placeholder="0" 
                    value={newBooth.totalVoters}
                    onChange={(e) => setNewBooth({...newBooth, totalVoters: parseInt(e.target.value) || 0})}
                  />
                </div>
                <Button className="w-full" onClick={handleCreateBooth} disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Booth'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <Card className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading booths...</p>
          </Card>
        ) : booths.length === 0 ? (
          <Card className="p-8 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Booths Found</h3>
            <p className="text-muted-foreground mb-4">Get started by creating your first booth</p>
            <Button onClick={() => setIsOpen(true)}>
              <Building2 className="mr-2 h-4 w-4" />
              Create New Booth
            </Button>
          </Card>
        ) : (
          <>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Booth ID</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
                      {user?.role !== 'L2' && (
                        <th className="px-4 py-3 text-left text-sm font-semibold">AC</th>
                      )}
                      <th className="px-4 py-3 text-left text-sm font-semibold">Address</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Voters</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Agents</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {booths.map((booth) => (
                      <tr key={booth._id} className="hover:bg-muted/50">
                        <td className="px-4 py-3 text-sm font-medium">{booth.boothCode}</td>
                        <td className="px-4 py-3 text-sm">{booth.boothName}</td>
                        {user?.role !== 'L2' && (
                          <td className="px-4 py-3 text-sm">{booth.ac_id}</td>
                        )}
                        <td className="px-4 py-3 text-sm max-w-xs truncate">{booth.address || '-'}</td>
                        <td className="px-4 py-3 text-sm">{booth.totalVoters}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                            {booth.assignedAgents?.length || 0} Agent{booth.assignedAgents?.length !== 1 ? 's' : ''}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditClick(booth)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteBooth(booth)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 bg-card border rounded-lg mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * 50) + 1} - {Math.min(currentPage * 50, totalBooths)} of {totalBooths} booths
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Edit Booth Dialog */}
        <Dialog open={isEditOpen} onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) setEditingBooth(null);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Booth</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editBoothNumber">Booth Number <span className="text-destructive">*</span></Label>
                <Input 
                  id="editBoothNumber" 
                  type="number"
                  placeholder="e.g., 1" 
                  value={editBooth.boothNumber}
                  onChange={(e) => setEditBooth({...editBooth, boothNumber: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editBoothName">Booth Name <span className="text-destructive">*</span></Label>
                <Input 
                  id="editBoothName" 
                  placeholder="e.g., Government School, Main Road" 
                  value={editBooth.boothName}
                  onChange={(e) => setEditBooth({...editBooth, boothName: e.target.value})}
                />
              </div>
              {user?.role !== 'L2' && (
                <div className="space-y-2">
                  <Label htmlFor="editAc">Assembly Constituency <span className="text-destructive">*</span></Label>
                  <Select 
                    value={editBooth.ac_id.toString()} 
                    onValueChange={(value) => {
                      const constituency = CONSTITUENCIES.find(c => c.number === parseInt(value));
                      setEditBooth({
                        ...editBooth, 
                        ac_id: parseInt(value),
                        ac_name: constituency?.name || ''
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select AC" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONSTITUENCIES.map(c => (
                        <SelectItem key={c.number} value={c.number.toString()}>
                          {c.number} - {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="editAddress">Address</Label>
                <Input 
                  id="editAddress" 
                  placeholder="Enter full address" 
                  value={editBooth.address}
                  onChange={(e) => setEditBooth({...editBooth, address: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editVoters">Total Registered Voters</Label>
                <Input 
                  id="editVoters" 
                  type="number" 
                  placeholder="0" 
                  value={editBooth.totalVoters}
                  onChange={(e) => setEditBooth({...editBooth, totalVoters: parseInt(e.target.value) || 0})}
                />
              </div>
              <Button className="w-full" onClick={handleUpdateBooth} disabled={updating}>
                {updating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Booth'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};