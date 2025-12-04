import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Edit2, Trash2, Filter, Loader2, Users as UsersIcon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

interface BoothAgent {
  _id: string;
  username: string;
  fullName: string;
  phoneNumber: string;
  role: string;
  booth_id: string;
  booth_agent_id: string;
  boothCode?: string;
  boothName?: string;
  aci_id: number;
  aci_name: string;
  acim_id?: number;
  acim_name?: string;
  createdBy: string;
  isActive: boolean;
  createdAt: string;
}

interface Booth {
  _id: string;
  booth_id: string;
  boothCode: string;
  boothNumber: number;
  boothName: string;
  ac_id: number;
  ac_name: string;
  assignedAgents: string[];
}

export const BoothAgentManagementNew = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [agents, setAgents] = useState<BoothAgent[]>([]);
  const [booths, setBooths] = useState<Booth[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<BoothAgent | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [filterAC, setFilterAC] = useState<string>('all');
  
  // Form states
  const [newAgent, setNewAgent] = useState({
    username: '',
    password: '',
    fullName: '',
    phoneNumber: '',
    booth_id: '',
    aci_id: user?.role === 'L2' ? user.assignedAC : '',
    aci_name: user?.role === 'L2' ? (user.aciName || '') : '',
  });
  
  const [editForm, setEditForm] = useState({
    fullName: '',
    phoneNumber: '',
    booth_id: '',
  });

  // Fetch data on mount
  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [agentsResponse, boothsResponse] = await Promise.all([
        api.get('/rbac/users?role=Booth Agent'),
        api.get('/rbac/booths')
      ]);
      
      console.log('Fetched agents:', agentsResponse);
      console.log('Fetched booths:', boothsResponse);
      
      // Map backend fields to frontend interface
      const mappedAgents = (agentsResponse.users || []).map((agent: any) => ({
        ...agent,
        fullName: agent.name || agent.fullName || '',
        username: agent.email || agent.username || '',
        phoneNumber: agent.phone || agent.phoneNumber || '',
        aci_id: agent.aci_id || agent.assignedAC || 0,
        aci_name: agent.aci_name || '',
        booth_id: agent.booth_id || agent.assignedBoothId?._id || agent.assignedBoothId || '',
        boothCode: agent.assignedBoothId?.boothCode || agent.boothCode || '',
        boothName: agent.assignedBoothId?.boothName || agent.boothName || '',
      }));
      
      setAgents(mappedAgents);
      setBooths(boothsResponse.booths || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter agents based on role and AC filter
  const filteredAgents = (() => {
    let result = user?.role === 'L2' 
      ? agents.filter(agent => agent.aci_id === user.assignedAC)
      : agents;
      
    // Apply AC filter for L0/L1 users
    if (user?.role !== 'L2' && filterAC !== 'all') {
      result = result.filter(agent => agent.aci_id === parseInt(filterAC));
    }
    
    return result;
  })();

  // Get available booths for agent assignment
  const availableBooths = user?.role === 'L2' 
    ? booths.filter(booth => booth.ac_id === user.assignedAC)
    : newAgent.aci_id 
      ? booths.filter(booth => booth.ac_id === parseInt(newAgent.aci_id))
      : booths;

  const editAvailableBooths = editingAgent
    ? booths.filter(booth => booth.ac_id === editingAgent.aci_id)
    : [];

  const handleCreateAgent = async () => {
    // Validation
    if (!newAgent.username || !newAgent.password || !newAgent.fullName || !newAgent.phoneNumber || !newAgent.booth_id || !newAgent.aci_id) {
      toast({
        title: 'Validation Error',
        description: 'All fields are required',
        variant: 'destructive',
      });
      return;
    }

    try {
      setCreating(true);
      console.log('Creating booth agent:', newAgent);
      
      const response = await api.post('/rbac/users/booth-agent', {
        username: newAgent.username,
        password: newAgent.password,
        fullName: newAgent.fullName,
        phoneNumber: newAgent.phoneNumber,
        booth_id: newAgent.booth_id,
        aci_id: parseInt(newAgent.aci_id),
        aci_name: newAgent.aci_name,
      });
      
      console.log('Agent created:', response);
      
      toast({
        title: 'Success',
        description: 'Booth agent created successfully',
      });
      
      // Refresh data
      await fetchData();
      
      // Reset form and close dialog
      setNewAgent({
        username: '',
        password: '',
        fullName: '',
        phoneNumber: '',
        booth_id: '',
        aci_id: user?.role === 'L2' ? user.assignedAC : '',
        aci_name: user?.role === 'L2' ? (user.aciName || '') : '',
      });
      setIsOpen(false);
    } catch (error: any) {
      console.error('Error creating agent:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create booth agent',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleEditClick = (agent: BoothAgent) => {
    setEditingAgent(agent);
    setEditForm({
      fullName: agent.fullName,
      phoneNumber: agent.phoneNumber,
      booth_id: agent.booth_id,
    });
    setIsEditOpen(true);
  };

  const handleUpdateAgent = async () => {
    if (!editingAgent || !editForm.fullName || !editForm.phoneNumber || !editForm.booth_id) {
      toast({
        title: 'Validation Error',
        description: 'All fields are required',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUpdating(true);
      console.log('Updating agent:', editingAgent._id, editForm);
      
      const response = await api.put(`/rbac/users/${editingAgent._id}`, {
        fullName: editForm.fullName,
        phoneNumber: editForm.phoneNumber,
        booth_id: editForm.booth_id,
      });
      
      console.log('Agent updated:', response);
      
      toast({
        title: 'Success',
        description: 'Booth agent updated successfully',
      });
      
      // Refresh data
      await fetchData();
      
      setIsEditOpen(false);
      setEditingAgent(null);
    } catch (error: any) {
      console.error('Error updating agent:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update booth agent',
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteAgent = async (agent: BoothAgent) => {
    if (!confirm(`Are you sure you want to delete booth agent "${agent.fullName}"?`)) {
      return;
    }

    try {
      console.log('Deleting agent:', agent._id);
      await api.delete(`/rbac/users/${agent._id}`);
      
      toast({
        title: 'Success',
        description: 'Booth agent deleted successfully',
      });
      
      // Refresh data
      await fetchData();
    } catch (error: any) {
      console.error('Error deleting agent:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete booth agent',
        variant: 'destructive',
      });
    }
  };

  const getBoothInfo = (booth_id: string) => {
    const booth = booths.find(b => b._id === booth_id || b.booth_id === booth_id);
    return booth ? `${booth.boothCode} - ${booth.boothName}` : 'N/A';
  };

  // Get unique ACs for filter dropdown
  const uniqueACs = Array.from(new Set(agents.map(a => a.aci_id))).sort((a, b) => a - b);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold mb-2">Booth Agent Management</h1>
            <p className="text-muted-foreground">
              {user?.role === 'L2' 
                ? `Manage booth agents for AC ${user.assignedAC || '...'}`
                : 'Manage booth agents and their assignments'}
            </p>
          </div>
          <div className="flex gap-4">
            {user?.role !== 'L2' && (
              <Select value={filterAC} onValueChange={setFilterAC}>
                <SelectTrigger className="w-[200px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by AC" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Constituencies</SelectItem>
                  {uniqueACs.map(ac => (
                    <SelectItem key={ac} value={ac.toString()}>
                      AC {ac}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Booth Agent
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Booth Agent</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter email address"
                      value={newAgent.username}
                      onChange={(e) => setNewAgent({...newAgent, username: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password <span className="text-destructive">*</span></Label>
                    <Input 
                      id="password" 
                      type="password"
                      placeholder="Enter password" 
                      value={newAgent.password}
                      onChange={(e) => setNewAgent({...newAgent, password: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name <span className="text-destructive">*</span></Label>
                    <Input 
                      id="fullName" 
                      placeholder="Enter full name" 
                      value={newAgent.fullName}
                      onChange={(e) => setNewAgent({...newAgent, fullName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Phone Number <span className="text-destructive">*</span></Label>
                    <Input 
                      id="phoneNumber" 
                      placeholder="+91 98765 43210" 
                      value={newAgent.phoneNumber}
                      onChange={(e) => setNewAgent({...newAgent, phoneNumber: e.target.value})}
                    />
                  </div>
                  {user?.role !== 'L2' && (
                    <div className="space-y-2">
                      <Label htmlFor="aci">Assembly Constituency <span className="text-destructive">*</span></Label>
                      <Select 
                        value={newAgent.aci_id.toString()} 
                        onValueChange={(value) => {
                          const booth = booths.find(b => b.ac_id === parseInt(value));
                          setNewAgent({
                            ...newAgent, 
                            aci_id: value,
                            aci_name: booth?.ac_name || '',
                            booth_id: '' // Reset booth selection when AC changes
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select AC" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from(new Set(booths.map(b => b.ac_id))).sort((a, b) => a - b).map(ac => {
                            const booth = booths.find(b => b.ac_id === ac);
                            return (
                              <SelectItem key={ac} value={ac.toString()}>
                                {ac} - {booth?.ac_name}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="booth">Assign to Booth <span className="text-destructive">*</span></Label>
                    <Select 
                      value={newAgent.booth_id} 
                      onValueChange={(value) => setNewAgent({...newAgent, booth_id: value})}
                      disabled={!newAgent.aci_id && user?.role !== 'L2'}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select booth" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableBooths.map(booth => (
                          <SelectItem key={booth._id} value={booth._id}>
                            {booth.boothCode} - {booth.boothName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full" onClick={handleCreateAgent} disabled={creating}>
                    {creating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Booth Agent'
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {loading ? (
          <Card className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading booth agents...</p>
          </Card>
        ) : filteredAgents.length === 0 ? (
          <Card className="p-8 text-center">
            <UsersIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Booth Agents Found</h3>
            <p className="text-muted-foreground mb-4">Get started by adding your first booth agent</p>
            <Button onClick={() => setIsOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Booth Agent
            </Button>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Agent ID</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Email</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Phone</th>
                    {user?.role !== 'L2' && (
                      <th className="px-4 py-3 text-left text-sm font-semibold">AC</th>
                    )}
                    <th className="px-4 py-3 text-left text-sm font-semibold">Assigned Booth</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredAgents.map((agent) => (
                    <tr key={agent._id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 text-sm font-medium">{agent.booth_agent_id}</td>
                      <td className="px-4 py-3 text-sm">{agent.fullName}</td>
                      <td className="px-4 py-3 text-sm">{agent.username}</td>
                      <td className="px-4 py-3 text-sm">{agent.phoneNumber}</td>
                      {user?.role !== 'L2' && (
                        <td className="px-4 py-3 text-sm">{agent.aci_id}</td>
                      )}
                      <td className="px-4 py-3 text-sm max-w-xs truncate">
                        {getBoothInfo(agent.booth_id)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge variant={agent.isActive ? "default" : "secondary"}>
                          {agent.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex space-x-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEditClick(agent)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteAgent(agent)}
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
        )}

        {/* Edit Agent Dialog */}
        <Dialog open={isEditOpen} onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) setEditingAgent(null);
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Booth Agent</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editFullName">Full Name <span className="text-destructive">*</span></Label>
                <Input 
                  id="editFullName" 
                  placeholder="Enter full name" 
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({...editForm, fullName: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editPhoneNumber">Phone Number <span className="text-destructive">*</span></Label>
                <Input 
                  id="editPhoneNumber" 
                  placeholder="+91 98765 43210" 
                  value={editForm.phoneNumber}
                  onChange={(e) => setEditForm({...editForm, phoneNumber: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editBooth">Assign to Booth <span className="text-destructive">*</span></Label>
                <Select 
                  value={editForm.booth_id} 
                  onValueChange={(value) => setEditForm({...editForm, booth_id: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select booth" />
                  </SelectTrigger>
                  <SelectContent>
                    {editAvailableBooths.map(booth => (
                      <SelectItem key={booth._id} value={booth._id}>
                        {booth.boothCode} - {booth.boothName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handleUpdateAgent} disabled={updating}>
                {updating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Booth Agent'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};
