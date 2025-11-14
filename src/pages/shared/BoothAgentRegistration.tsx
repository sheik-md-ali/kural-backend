import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserPlus, Loader2, RefreshCw, Plus, Building2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Booth {
  _id: string;
  booth_id: string;
  boothName: string;
  boothCode: string;
  boothNumber: number;
  ac_id: number;
  ac_name?: string;
  address?: string;
  totalVoters?: number;
}

interface ACI {
  _id: string;
  name: string;
  assignedAC: number;
  aci_name: string;
}

interface FormData {
  name: string;
  phone: string;
  password: string;
  booth_id: string;
  aci_id: string;
  aci_name: string;
}

interface NewBoothData {
  boothNumber: string;
  boothName: string;
  address: string;
  totalVoters: string;
}

export default function BoothAgentRegistration() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<FormData>({
    name: "",
    phone: "",
    password: "",
    booth_id: "",
    aci_id: "",
    aci_name: "",
  });
  
  const [newBoothData, setNewBoothData] = useState<NewBoothData>({
    boothNumber: "",
    boothName: "",
    address: "",
    totalVoters: "",
  });
  
  const [booths, setBooths] = useState<Booth[]>([]);
  const [acis, setACIs] = useState<ACI[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingBooths, setFetchingBooths] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showNewBoothDialog, setShowNewBoothDialog] = useState(false);
  const [creatingBooth, setCreatingBooth] = useState(false);

  // Auto-fill ACI details if user is L1 (ACIM)
  useEffect(() => {
    if (currentUser?.role === "L1") {
      setFormData((prev) => ({
        ...prev,
        aci_id: currentUser.assignedAC?.toString() || "",
        aci_name: currentUser.aciName || "",
      }));
    }
  }, [currentUser]);

  // Fetch ACIs (for L0 users only)
  useEffect(() => {
    if (currentUser?.role === "L0") {
      fetchACIs();
    }
  }, [currentUser]);

  // Fetch booths when ACI is selected
  useEffect(() => {
    if (formData.aci_id) {
      fetchBooths(parseInt(formData.aci_id));
    }
  }, [formData.aci_id]);

  const fetchACIs = async () => {
    try {
      const response = await api.get("/rbac/users");
      const aciUsers = response.users.filter((u: any) => u.role === "L2");
      setACIs(aciUsers);
    } catch (error: any) {
      console.error("Error fetching ACIs:", error);
    }
  };

  const fetchBooths = async (acId: number) => {
    setFetchingBooths(true);
    try {
      const response = await api.get(`/rbac/booths?ac_id=${acId}`);
      setBooths(response.booths || []);
    } catch (error: any) {
      console.error("Error fetching booths:", error);
      toast({
        title: "Error",
        description: "Failed to fetch booths",
        variant: "destructive",
      });
    } finally {
      setFetchingBooths(false);
    }
  };

  const handleCreateBooth = async () => {
    // Validation
    if (!newBoothData.boothNumber || !newBoothData.boothName) {
      toast({
        title: "Validation Error",
        description: "Booth number and name are required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.aci_id || !formData.aci_name) {
      toast({
        title: "Validation Error",
        description: "Please select an ACI first",
        variant: "destructive",
      });
      return;
    }

    setCreatingBooth(true);
    try {
      const boothData = {
        boothNumber: parseInt(newBoothData.boothNumber),
        boothName: newBoothData.boothName,
        ac_id: parseInt(formData.aci_id),
        ac_name: formData.aci_name,
        address: newBoothData.address || undefined,
        totalVoters: newBoothData.totalVoters ? parseInt(newBoothData.totalVoters) : 0,
      };

      console.log("Creating booth with data:", boothData);
      const response = await api.post("/rbac/booths", boothData);
      console.log("Booth creation response:", response);

      toast({
        title: "Success",
        description: `Booth created: ${response.booth.boothCode}`,
      });

      // Refresh booth list
      console.log("Refreshing booth list for AC:", formData.aci_id);
      await fetchBooths(parseInt(formData.aci_id));

      // Select the newly created booth
      if (response.booth && response.booth._id) {
        console.log("Selecting newly created booth:", response.booth._id);
        setFormData({ ...formData, booth_id: response.booth._id });
      }

      // Close dialog and reset form
      setShowNewBoothDialog(false);
      setNewBoothData({
        boothNumber: "",
        boothName: "",
        address: "",
        totalVoters: "",
      });
    } catch (error: any) {
      console.error("Error creating booth:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create booth",
        variant: "destructive",
      });
    } finally {
      setCreatingBooth(false);
    }
  };

  const generateBoothAgentId = (phone: string, existingAgents: number = 0): string => {
    const sequence = String(existingAgents + 1).padStart(3, "0");
    return `${phone}-${sequence}`;
  };

  const generatePassword = (): string => {
    const length = 10;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  };

  const handleGeneratePassword = () => {
    const newPassword = generatePassword();
    setFormData({ ...formData, password: newPassword });
    toast({
      title: "Password Generated",
      description: "A secure password has been generated",
    });
  };

  const handleACIChange = (aciId: string) => {
    const selectedACI = acis.find((a) => a._id === aciId);
    setFormData({
      ...formData,
      aci_id: selectedACI?.assignedAC.toString() || "",
      aci_name: selectedACI?.aci_name || "",
      booth_id: "", // Reset booth selection
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Agent name is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.phone.trim() || formData.phone.length < 10) {
      toast({
        title: "Validation Error",
        description: "Valid phone number (10 digits) is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.password.trim() || formData.password.length < 6) {
      toast({
        title: "Validation Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    if (!formData.booth_id) {
      toast({
        title: "Validation Error",
        description: "Please select a booth",
        variant: "destructive",
      });
      return;
    }

    if (!formData.aci_id || !formData.aci_name) {
      toast({
        title: "Validation Error",
        description: "ACI information is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setSuccessMessage("");

    try {
      // Get the selected booth details
      const selectedBooth = booths.find((b) => b._id === formData.booth_id);
      
      // Check existing agents to generate unique booth_agent_id
      let agentCount = 0;
      try {
        const existingAgents = await api.get(
          `/rbac/users?role=BoothAgent&phone=${formData.phone}`
        );
        agentCount = existingAgents.users?.length || 0;
      } catch (error) {
        console.log("No existing agents found");
      }

      const booth_agent_id = generateBoothAgentId(formData.phone, agentCount);

      // Prepare request data
      const requestData = {
        role: "BoothAgent",
        aci_id: parseInt(formData.aci_id),
        aci_name: formData.aci_name,
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        password: formData.password,
        booth_id: selectedBooth?.booth_id || formData.booth_id,
        booth_agent_id: booth_agent_id,
        assignedAC: parseInt(formData.aci_id),
        assignedBoothId: formData.booth_id,
        status: "Active",
      };

      console.log("Creating booth agent:", requestData);

      // Create booth agent
      const response = await api.post("/rbac/users", requestData);

      // Success
      setSuccessMessage(
        `Booth Agent Registered! Agent ID: ${booth_agent_id}`
      );
      
      toast({
        title: "Success",
        description: "Booth Agent registered successfully",
      });

      // Clear form
      resetForm();

    } catch (error: any) {
      console.error("Error creating booth agent:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to register booth agent",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      phone: "",
      password: "",
      booth_id: "",
      aci_id: currentUser?.role === "L1" ? currentUser.assignedAC?.toString() || "" : "",
      aci_name: currentUser?.role === "L1" ? currentUser.aciName || "" : "",
    });
    
    // Refetch booths if ACI is still selected
    if (formData.aci_id) {
      fetchBooths(parseInt(formData.aci_id));
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-6 w-6" />
            Register Booth Agent
          </CardTitle>
          <CardDescription>
            Create a new booth agent and assign them to a specific booth
          </CardDescription>
        </CardHeader>
        <CardContent>
          {successMessage && (
            <Alert className="mb-6 border-green-500 bg-green-50">
              <AlertDescription className="text-green-800">
                {successMessage}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* ACI Selection (Only for L0) */}
            {currentUser?.role === "L0" && (
              <div className="space-y-2">
                <Label htmlFor="aci">Select ACI *</Label>
                <Select
                  value={acis.find((a) => a.assignedAC.toString() === formData.aci_id)?._id || ""}
                  onValueChange={handleACIChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an ACI" />
                  </SelectTrigger>
                  <SelectContent>
                    {acis.map((aci) => (
                      <SelectItem key={aci._id} value={aci._id}>
                        AC {aci.assignedAC} - {aci.aci_name} ({aci.name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* ACI Info Display (For L1) */}
            {currentUser?.role === "L1" && (
              <div className="space-y-2">
                <Label>Assigned Constituency</Label>
                <div className="p-3 border rounded-md bg-muted">
                  <p className="font-medium">
                    AC {formData.aci_id} - {formData.aci_name}
                  </p>
                </div>
              </div>
            )}

            {/* Agent Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Agent Name *</Label>
              <Input
                id="name"
                placeholder="Enter agent's full name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>

            {/* Phone Number */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="10-digit phone number"
                value={formData.phone}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setFormData({ ...formData, phone: value });
                }}
                required
                maxLength={10}
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <div className="flex gap-2">
                <Input
                  id="password"
                  type="text"
                  placeholder="Enter password (min 6 characters)"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required
                  minLength={6}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGeneratePassword}
                  title="Generate secure password"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Booth Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="booth">Assign Booth *</Label>
                {formData.aci_id && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNewBoothDialog(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Create New Booth
                  </Button>
                )}
              </div>
              {fetchingBooths ? (
                <div className="flex items-center justify-center p-4 border rounded-md">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Loading booths...
                </div>
              ) : !formData.aci_id ? (
                <div className="p-3 border rounded-md bg-muted text-sm text-muted-foreground">
                  Please select an ACI first to load available booths
                </div>
              ) : booths.length === 0 ? (
                <div className="space-y-2">
                  <div className="p-3 border rounded-md bg-muted text-sm text-muted-foreground">
                    No booths available for this constituency
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowNewBoothDialog(true)}
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    Create First Booth
                  </Button>
                </div>
              ) : (
                <Select
                  value={formData.booth_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, booth_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a booth" />
                  </SelectTrigger>
                  <SelectContent>
                    {booths.map((booth) => (
                      <SelectItem key={booth._id} value={booth._id}>
                        {booth.boothName} ({booth.boothCode || booth.booth_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Hidden Fields Info */}
            <div className="p-4 border rounded-md bg-muted space-y-1 text-sm">
              <p className="font-medium">Auto-generated fields:</p>
              <p className="text-muted-foreground">
                • Role: <span className="font-medium">Booth Agent</span>
              </p>
              <p className="text-muted-foreground">
                • Agent ID: <span className="font-medium">{formData.phone ? `${formData.phone}-00X` : "Will be generated"}</span>
              </p>
              <p className="text-muted-foreground">
                • Status: <span className="font-medium">Active</span>
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={loading || !formData.aci_id}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registering...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Register Booth Agent
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
                disabled={loading}
              >
                Clear Form
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Create New Booth Dialog */}
      <Dialog open={showNewBoothDialog} onOpenChange={setShowNewBoothDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Booth</DialogTitle>
            <DialogDescription>
              Add a new booth to AC {formData.aci_id} - {formData.aci_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="boothNumber">Booth Number *</Label>
              <Input
                id="boothNumber"
                type="number"
                placeholder="e.g., 1, 2, 3..."
                value={newBoothData.boothNumber}
                onChange={(e) =>
                  setNewBoothData({ ...newBoothData, boothNumber: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="boothName">Booth Name *</Label>
              <Input
                id="boothName"
                placeholder="e.g., Government Primary School"
                value={newBoothData.boothName}
                onChange={(e) =>
                  setNewBoothData({ ...newBoothData, boothName: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address (Optional)</Label>
              <Input
                id="address"
                placeholder="Full booth address"
                value={newBoothData.address}
                onChange={(e) =>
                  setNewBoothData({ ...newBoothData, address: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="totalVoters">Total Voters (Optional)</Label>
              <Input
                id="totalVoters"
                type="number"
                placeholder="e.g., 1000"
                value={newBoothData.totalVoters}
                onChange={(e) =>
                  setNewBoothData({ ...newBoothData, totalVoters: e.target.value })
                }
              />
            </div>

            <div className="p-3 bg-muted rounded-md text-sm">
              <p className="font-medium mb-1">Auto-generated:</p>
              <p className="text-muted-foreground">
                Booth Code: AC{formData.aci_id}-B{String(newBoothData.boothNumber || "XXX").padStart(3, "0")}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowNewBoothDialog(false);
                setNewBoothData({
                  boothNumber: "",
                  boothName: "",
                  address: "",
                  totalVoters: "",
                });
              }}
              disabled={creatingBooth}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateBooth}
              disabled={creatingBooth || !newBoothData.boothNumber || !newBoothData.boothName}
            >
              {creatingBooth ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Building2 className="mr-2 h-4 w-4" />
                  Create Booth
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
