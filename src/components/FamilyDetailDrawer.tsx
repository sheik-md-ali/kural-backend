import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Users, Home, FileCheck, UserCircle, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import API_BASE_URL from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface FamilyMember {
  id: string;
  name: string;
  age: number;
  gender: string;
  relationship: string;
  phone: string;
  voterID: string;
  survey_status: boolean;
  surveyed: boolean;
}

interface FamilyDemographics {
  total: number;
  male: number;
  female: number;
  surveyed: number;
  pending: number;
}

interface FamilyDetail {
  id: string;
  family_head: string;
  address: string;
  booth: string;
  boothNo: number;
  members: FamilyMember[];
  demographics: FamilyDemographics;
}

interface FamilyDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  familyData: {
    id: string;
    family_head?: string;
    headName?: string;
    members: number;
    booth: string;
    surveyed?: number;
    address: string;
    boothNo?: number;
  } | null;
}

export const FamilyDetailDrawer = ({ open, onClose, familyData }: FamilyDetailDrawerProps) => {
  const { user } = useAuth();
  const acNumber = user?.assignedAC || 119;
  const [familyDetails, setFamilyDetails] = useState<FamilyDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && familyData) {
      fetchFamilyDetails();
    }
  }, [open, familyData, acNumber]);

  const fetchFamilyDetails = async () => {
    if (!familyData) return;

    console.log('Family data received:', familyData);
    console.log('AC Number:', acNumber);

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        address: familyData.address,
      });

      if (familyData.booth) {
        params.append('booth', familyData.booth);
      }

      const url = `${API_BASE_URL}/families/${acNumber}/detail?${params}`;
      console.log('Fetching family details from:', url);

      const response = await fetch(url, {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('API Error:', errorData);
        throw new Error(errorData.message || 'Failed to fetch family details');
      }

      const data = await response.json();
      setFamilyDetails(data);
    } catch (err) {
      console.error('Error fetching family details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load family details');
    } finally {
      setLoading(false);
    }
  };

  if (!familyData) return null;

  const headName = familyData.family_head || familyData.headName || 'N/A';
  const surveyedCount = familyDetails?.demographics?.surveyed || familyData.surveyed || 0;
  const totalMembers = familyDetails?.demographics?.total || familyData.members || 0;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Home className="h-5 w-5 text-primary" />
            {familyDetails?.id || familyData.id} - {headName}
          </SheetTitle>
          <SheetDescription>{familyData.address}</SheetDescription>
        </SheetHeader>

        {error && (
          <div className="mt-4 bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="space-y-6 mt-6">
          {/* Family Status */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Family Status</h3>
              <Badge variant={surveyedCount === totalMembers ? 'default' : surveyedCount > 0 ? 'secondary' : 'destructive'}>
                {surveyedCount}/{totalMembers} Surveyed
              </Badge>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  surveyedCount === totalMembers ? 'bg-success' : surveyedCount > 0 ? 'bg-warning' : 'bg-destructive'
                }`}
                style={{ width: `${totalMembers > 0 ? (surveyedCount / totalMembers) * 100 : 0}%` }}
              />
            </div>
          </Card>

          {/* Family Members */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Family Members
            </h3>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading family members...
              </div>
            ) : familyDetails?.members ? (
              <div className="space-y-3">
                {familyDetails.members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <UserCircle className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {member.age} years, {member.gender} ({member.relationship})
                        </p>
                      </div>
                    </div>
                    <Badge variant={member.survey_status ? 'default' : 'secondary'}>
                      {member.survey_status ? 'Surveyed' : 'Pending'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No family member details available
              </div>
            )}
          </Card>

          {/* Demographics */}
          {familyDetails?.demographics && (
            <Card className="p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Family Demographics
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">Total Members</p>
                  <p className="text-2xl font-bold text-primary">{familyDetails.demographics.total}</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">Male / Female</p>
                  <p className="text-lg font-bold">{familyDetails.demographics.male} / {familyDetails.demographics.female}</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-success" />
                    Surveyed
                  </p>
                  <p className="text-2xl font-bold text-success">{familyDetails.demographics.surveyed}</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <XCircle className="h-3 w-3 text-warning" />
                    Pending
                  </p>
                  <p className="text-2xl font-bold text-warning">{familyDetails.demographics.pending}</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};