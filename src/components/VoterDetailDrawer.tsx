import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Users, Home, FileCheck, User, Clock, CheckCircle, XCircle, Phone, Calendar, AlertCircle } from 'lucide-react';

interface VoterDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  voterData: {
    id: number | string;
    name: string;
    age: number;
    gender: string;
    booth: string;
    boothNo?: number | string;
    family: string;
    phone: string;
    surveyed: boolean;
    voterID?: string;
    relationship?: string;
    religion?: string;
    caste?: string;
  } | null;
}

export const VoterDetailDrawer = ({ open, onClose, voterData }: VoterDetailDrawerProps) => {
  if (!voterData) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            {voterData.name}
          </SheetTitle>
          <SheetDescription>
            {voterData.voterID ? `Voter ID: ${voterData.voterID}` : `ID: ${voterData.id}`}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Voter Status */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Voter Status</h3>
              <Badge variant={voterData.surveyed ? 'default' : 'secondary'}>
                {voterData.surveyed ? 'Surveyed' : 'Pending'}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{voterData.family}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{voterData.booth}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{voterData.phone || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{voterData.age} years, {voterData.gender}</span>
              </div>
            </div>
          </Card>

          {/* Additional Voter Details */}
          {(voterData.relationship || voterData.religion || voterData.caste) && (
            <Card className="p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <User className="h-4 w-4" />
                Voter Details
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {voterData.relationship && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Relationship</p>
                    <p className="text-sm font-medium">{voterData.relationship}</p>
                  </div>
                )}
                {voterData.religion && voterData.religion !== 'N/A' && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Religion</p>
                    <p className="text-sm font-medium">{voterData.religion}</p>
                  </div>
                )}
                {voterData.caste && voterData.caste !== 'N/A' && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Caste</p>
                    <p className="text-sm font-medium">{voterData.caste}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          <Separator />

          {/* Survey Status Info */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <FileCheck className="h-4 w-4" />
              Survey Information
            </h3>
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              {voterData.surveyed ? (
                <>
                  <CheckCircle className="h-5 w-5 text-success" />
                  <div>
                    <p className="font-medium text-success">Survey Completed</p>
                    <p className="text-xs text-muted-foreground">This voter has completed the survey</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-warning" />
                  <div>
                    <p className="font-medium text-warning">Survey Pending</p>
                    <p className="text-xs text-muted-foreground">This voter has not been surveyed yet</p>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
};