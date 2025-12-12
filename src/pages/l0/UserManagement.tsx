import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Search, Edit2, Trash2, Users, UserPlus, UserCog } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { CONSTITUENCIES } from "@/constants/constituencies";

interface User {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  assignedAC?: number;
  aci_name?: string;
  assignedBoothId?: {
    _id: string;
    boothName: string;
    boothCode: string;
    booth_id?: string;
  };
  booth_id?: string; // String booth ID (e.g., "BOOTH1-111") - fallback when assignedBoothId not populated
  booth_agent_id?: string; // Agent ID (e.g., "BOOTH1-111-1")
  createdBy?: {
    _id: string;
    name: string;
    role: string;
  };
  status: string;
  isActive: boolean;
  createdAt: string;
}

interface Booth {
  _id: string;
  boothName: string;
  boothCode: string;
  ac_id: number;
}

interface UserFormData {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: string;
  assignedAC: string;
  aci_name: string;
  assignedBoothId: string;
  status: string;
}

const UserManagement: React.FC = () => {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState<User[]>([]);
  const [booths, setBooths] = useState<Booth[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<string>("L0");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [acFilter, setAcFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // Get create role from URL params
  const createRole = searchParams.get('create');
  const initialRole = createRole === 'L1' || createRole === 'L2' ? createRole : "BoothAgent";
  
  const [formData, setFormData] = useState<UserFormData>({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: initialRole,
    assignedAC: currentUser?.assignedAC?.toString() || "",
    aci_name: currentUser?.aciName || "",
    assignedBoothId: "",
    status: "Active",
  });

  useEffect(() => {
    // For L2 and BoothAgent tabs, require AC selection before fetching
    const requiresACSelection = activeTab === "L2" || activeTab === "BoothAgent";
    if (requiresACSelection && acFilter === "all") {
      setUsers([]);
      setLoading(false);
      return;
    }
    fetchUsers();
    fetchBooths();
  }, [activeTab, statusFilter, acFilter]);

  // Handle URL parameter to auto-open dialog with pre-selected role
  useEffect(() => {
    const createRole = searchParams.get('create');
    if (createRole && (createRole === 'L1' || createRole === 'L2') && currentUser?.role === 'L0') {
      // Set the active tab to match the role
      if (createRole === 'L1') setActiveTab('L1');
      if (createRole === 'L2') setActiveTab('L2');
      
      setFormData(prev => ({
        ...prev,
        role: createRole,
      }));
      setIsDialogOpen(true);
      // Clear the URL parameter
      setSearchParams({});
    }
  }, [searchParams, currentUser, setSearchParams]);

  const fetchBooths = async (acId?: string) => {
    try {
      const params = acId ? `?ac=${acId}` : '';
      const response = await api.get(`/rbac/booths${params}`);
      setBooths(response.booths || []);
    } catch (error: any) {
      console.error("Failed to fetch booths:", error);
    }
  };

  // Fetch booths when AC is selected for BoothAgent role
  useEffect(() => {
    if (formData.role === 'BoothAgent' && formData.assignedAC) {
      // Clear booths first to prevent showing stale data
      setBooths([]);
      // Clear selected booth when AC changes
      setFormData(prev => ({ ...prev, assignedBoothId: '' }));
      fetchBooths(formData.assignedAC);
    } else if (!formData.assignedAC) {
      // Clear booths if no AC is selected
      setBooths([]);
    }
  }, [formData.assignedAC, formData.role]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      // Map tab to role
      const roleMap: { [key: string]: string } = {
        "L0": "L0",
        "L1": "L1",
        "L2": "L2",
        "BoothAgent": "BoothAgent"
      };

      if (activeTab && roleMap[activeTab]) {
        params.append("role", roleMap[activeTab]);
      }

      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      // Add AC filter for BoothAgent and L2 tabs
      if ((activeTab === "BoothAgent" || activeTab === "L2") && acFilter !== "all") {
        params.append("ac", acFilter);
      }

      const response = await api.get(`/rbac/users?${params.toString()}`);
      const usersList = response.users || [];

      // Log for debugging
      console.log(`[UserManagement] Fetched ${usersList.length} users for tab: ${activeTab}`);
      console.log(`[UserManagement] Total matching query: ${response.totalCount || response.count || usersList.length}`);

      setUsers(usersList);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (isEditMode && editingUser) {
        // Update user
        const updateData: any = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          role: formData.role,
          status: formData.status,
        };

        // Don't set assignedAC for L1 (ACIM) users
        if (formData.role !== "L1") {
          if (formData.assignedAC) {
            updateData.assignedAC = parseInt(formData.assignedAC);
          }
          if (formData.aci_name) {
            updateData.aci_name = formData.aci_name;
          }
        } else {
          // For L1 users, explicitly remove assignedAC if it exists
          updateData.assignedAC = undefined;
          updateData.aci_name = undefined;
        }
        if (formData.assignedBoothId) {
          updateData.assignedBoothId = formData.assignedBoothId;
        }
        if (formData.password) {
          updateData.password = formData.password;
        }

        await api.put(`/rbac/users/${editingUser._id}`, updateData);
        toast({
          title: "Success",
          description: "User updated successfully",
        });
      } else {
        // Create new user
        const createData: any = {
          name: formData.name,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          password: formData.password,
          role: formData.role,
          status: formData.status,
        };

        // Don't set assignedAC for L1 (ACIM) users
        if (formData.role !== "L1") {
          if (formData.assignedAC) {
            createData.assignedAC = parseInt(formData.assignedAC);
          }
          if (formData.aci_name) {
            createData.aci_name = formData.aci_name;
          }
        }
        if (formData.assignedBoothId) {
          createData.assignedBoothId = formData.assignedBoothId;
        }

        await api.post("/rbac/users", createData);
        toast({
          title: "Success",
          description: "User created successfully",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      console.error("Error saving user:", error);
      toast({
        title: "Error",
        description: error.message || error.toString() || "Failed to save user",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (user: User) => {
    setIsEditMode(true);
    setEditingUser(user);
    // Normalize role: "Booth Agent" -> "BoothAgent" for consistency
    const normalizedRole = user.role === "Booth Agent" ? "BoothAgent" : user.role;
    setFormData({
      name: user.name,
      email: user.email || "",
      phone: user.phone || "",
      password: "",
      role: normalizedRole,
      assignedAC: user.assignedAC?.toString() || "",
      aci_name: user.aci_name || "",
      assignedBoothId: user.assignedBoothId?._id || user.booth_id || "",
      status: user.status || "Active",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) {
      return;
    }

    try {
      await api.delete(`/rbac/users/${userId}`);
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    // Set default role based on active tab
    const defaultRole = activeTab === "L0" ? "L0" : 
                       activeTab === "L1" ? "L1" : 
                       activeTab === "L2" ? "L2" : 
                       "BoothAgent";
    
    setFormData({
      name: "",
      email: "",
      phone: "",
      password: "",
      role: defaultRole,
      assignedAC: currentUser?.assignedAC?.toString() || "",
      aci_name: currentUser?.aciName || "",
      assignedBoothId: "",
      status: "Active",
    });
    setIsEditMode(false);
    setEditingUser(null);
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone?.includes(searchTerm);
    
    // Also filter by active tab role (double-check)
    const roleMap: { [key: string]: string } = {
      "L0": "L0",
      "L1": "L1",
      "L2": "L2",
      "BoothAgent": "BoothAgent"
    };
    const matchesRole = !activeTab || !roleMap[activeTab] || user.role === roleMap[activeTab] || 
      (roleMap[activeTab] === "BoothAgent" && (user.role === "Booth Agent" || user.role === "BoothAgent"));
    
    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: string) => {
    const roleConfig: { [key: string]: { label: string; variant: any } } = {
      L0: { label: "System Admin", variant: "default" },
      L1: { label: "ACIM", variant: "default" },
      L2: { label: "ACI", variant: "secondary" },
      BoothAgent: { label: "Booth Agent", variant: "outline" },
      "Booth Agent": { label: "Booth Agent", variant: "outline" },
    };

    const config = roleConfig[role] || { label: role, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const renderUsersTable = () => {
    // Show Assigned AC column for L2 (ACI) and Booth Agents, hide for L0 (System Admin) and L1 (ACIM)
    const showAssignedAC = activeTab === "L2" || activeTab === "BoothAgent";
    // Show Booth Number column only for Booth Agents
    const showBoothNumber = activeTab === "BoothAgent";

    if (loading) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-muted-foreground">Loading users...</div>
        </div>
      );
    }

    if (filteredUsers.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No users found</p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Role</TableHead>
            {showAssignedAC && <TableHead>Assigned AC</TableHead>}
            {showBoothNumber && <TableHead>Booth Number</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredUsers.map((user) => (
            <TableRow key={user._id}>
              <TableCell className="font-medium">{user.name}</TableCell>
              <TableCell>
                <div className="space-y-1">
                  {user.email && (
                    <div className="text-sm">{user.email}</div>
                  )}
                  {user.phone && (
                    <div className="text-sm text-muted-foreground">
                      {user.phone}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>{getRoleBadge(user.role)}</TableCell>
              {showAssignedAC && (
                <TableCell>
                  {user.assignedAC ? (
                    <div>
                      <div className="font-medium">AC {user.assignedAC}</div>
                      {user.aci_name && (
                        <div className="text-sm text-muted-foreground">
                          {user.aci_name}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              )}
              {showBoothNumber && (
                <TableCell>
                  {user.assignedBoothId ? (
                    <div>
                      <div className="font-medium">{user.assignedBoothId.boothCode || user.assignedBoothId.booth_id || user.assignedBoothId.boothName}</div>
                      {user.assignedBoothId.boothName && (user.assignedBoothId.boothCode || user.assignedBoothId.booth_id) && (
                        <div className="text-sm text-muted-foreground">
                          {user.assignedBoothId.boothName}
                        </div>
                      )}
                    </div>
                  ) : user.booth_id ? (
                    <div>
                      <div className="font-medium">{user.booth_id}</div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              )}
              <TableCell>
                <Badge
                  variant={
                    user.status === "Active"
                      ? "default"
                      : user.status === "Inactive"
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {user.status || "Active"}
                </Badge>
              </TableCell>
              <TableCell>
                {new Date(user.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(user)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(user._id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">
            Manage ACIM, ACI, and Booth Agent users
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {isEditMode ? "Edit User" : "Create New User"}
              </DialogTitle>
              <DialogDescription>
                {isEditMode
                  ? "Update user information"
                  : "Add a new ACIM, ACI, or Booth Agent user"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role *</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          role: value,
                          // Clear AC assignment when switching to L1 or L0
                          assignedAC: (value === "L2" || value === "BoothAgent") ? prev.assignedAC : "",
                          aci_name: (value === "L2" || value === "BoothAgent") ? prev.aci_name : "",
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {/* L0 (Super Admin) can create all roles including other L0 users */}
                        {currentUser?.role === "L0" && (
                          <>
                            <SelectItem value="L0">System Admin</SelectItem>
                            <SelectItem value="L1">ACIM</SelectItem>
                            <SelectItem value="L2">ACI</SelectItem>
                            <SelectItem value="BoothAgent">Booth Agent</SelectItem>
                          </>
                        )}
                        {/* L1 (ACIM) can only create L2 and BoothAgent */}
                        {currentUser?.role === "L1" && (
                          <>
                            <SelectItem value="L2">ACI</SelectItem>
                            <SelectItem value="BoothAgent">Booth Agent</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                    />
                  </div>
                </div>

                {/* AC Assignment - Only for L2 (ACI) and BoothAgent, NOT for L1 (ACIM) */}
                {(formData.role === "L2" || formData.role === "BoothAgent") && (
                  <div className="space-y-2">
                    <Label htmlFor="assignedAC">Assigned AC {formData.role === "L2" ? "*" : ""}</Label>
                    <Select
                      value={formData.assignedAC}
                      onValueChange={(value) => {
                        const selected = CONSTITUENCIES.find(
                          (ac) => ac.number.toString() === value
                        );
                        setFormData((prev) => ({
                          ...prev,
                          assignedAC: value,
                          aci_name: selected?.name || "",
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select constituency" />
                      </SelectTrigger>
                      <SelectContent>
                        {CONSTITUENCIES.map((ac) => (
                          <SelectItem key={ac.number} value={ac.number.toString()}>
                            {ac.number} - {ac.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Booth Assignment - Only for BoothAgent */}
                {formData.role === "BoothAgent" && (
                  <div className="space-y-2">
                    <Label htmlFor="assignedBoothId">Assigned Booth</Label>
                    <select
                      id="assignedBoothId"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={formData.assignedBoothId || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          assignedBoothId: e.target.value || undefined,
                        })
                      }
                    >
                      <option value="">Select Booth (Optional)</option>
                      {booths.map((booth) => (
                          <option key={booth._id} value={booth._id}>
                            {booth.boothName} ({booth.boothCode})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {/* Status Selector */}
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as "Active" | "Inactive" | "Pending",
                      })
                    }
                    required
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">
                    Password {isEditMode ? "(leave blank to keep current)" : "*"}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    required={!isEditMode}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {isEditMode ? "Update User" : "Create User"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

        <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Users List</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  className="pl-8 w-[300px]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="L0">System Admin</TabsTrigger>
              <TabsTrigger value="L1">ACIM</TabsTrigger>
              <TabsTrigger value="L2">ACI</TabsTrigger>
              <TabsTrigger value="BoothAgent">Booth Agents</TabsTrigger>
            </TabsList>
            
            <TabsContent value="L0" className="mt-4">
              {renderUsersTable()}
            </TabsContent>
            
            <TabsContent value="L1" className="mt-4">
              {renderUsersTable()}
            </TabsContent>
            
            <TabsContent value="L2" className="mt-4">
              {/* Constituency Filter for ACI users */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium whitespace-nowrap">Filter by Constituency:</Label>
                  <Select
                    value={acFilter}
                    onValueChange={(value) => {
                      setAcFilter(value);
                    }}
                  >
                    <SelectTrigger className="w-[280px]">
                      <SelectValue placeholder="All Constituencies" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Constituencies</SelectItem>
                      {CONSTITUENCIES.map((ac) => (
                        <SelectItem key={ac.number} value={ac.number.toString()}>
                          AC {ac.number} - {ac.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {renderUsersTable()}
            </TabsContent>
            
            <TabsContent value="BoothAgent" className="mt-4">
              {/* Constituency Filter for Booth Agents */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium whitespace-nowrap">Filter by Constituency:</Label>
                  <Select
                    value={acFilter}
                    onValueChange={(value) => {
                      setAcFilter(value);
                    }}
                  >
                    <SelectTrigger className="w-[280px]">
                      <SelectValue placeholder="All Constituencies" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Constituencies</SelectItem>
                      {CONSTITUENCIES.map((ac) => (
                        <SelectItem key={ac.number} value={ac.number.toString()}>
                          AC {ac.number} - {ac.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {renderUsersTable()}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
    </DashboardLayout>
  );
};

export default UserManagement;
