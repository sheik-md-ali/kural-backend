import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';

interface ExportStats {
  totalVoters: number;
  totalFamilies: number;
  totalSurveys: number;
}

export const VoterData = () => {
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [exportStats, setExportStats] = useState<ExportStats>({ totalVoters: 0, totalFamilies: 0, totalSurveys: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchExportStats();
  }, []);

  const fetchExportStats = async () => {
    try {
      setIsLoadingStats(true);
      const response = await api.get('/rbac/dashboard/ac-overview');
      if (response.success && response.totals) {
        setExportStats({
          totalVoters: response.totals.totalVoters || 0,
          totalFamilies: response.totals.totalFamilies || 0,
          totalSurveys: response.totals.totalSurveyedMembers || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching export stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      // Validate file type
      const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      if (!validTypes.includes(file.type) && !file.name.endsWith('.csv') && !file.name.endsWith('.xls') && !file.name.endsWith('.xlsx')) {
        toast({
          title: 'Invalid File Type',
          description: 'Please upload a CSV, XLS, or XLSX file.',
          variant: 'destructive'
        });
        return;
      }
      
      // Validate file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        toast({
          title: 'File Too Large',
          description: 'Please upload a file smaller than 50MB.',
          variant: 'destructive'
        });
        return;
      }
      
      // Simulate import process
      setIsImporting(true);
      toast({
        title: 'Import Started',
        description: `Importing ${file.name}...`
      });
      
      // Simulate processing time
      setTimeout(() => {
        setIsImporting(false);
        toast({
          title: 'Import Successful',
          description: `${file.name} has been imported successfully with 1,247 records.`
        });
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 2000);
    }
  };

  const handleExportClick = () => {
    setIsExporting(true);
    toast({
      title: 'Export Started',
      description: 'Preparing voter data for export...'
    });
    
    // Simulate export process
    setTimeout(() => {
      // Create dummy CSV data
      const csvContent = generateDummyVoterData();
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `voter_data_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setIsExporting(false);
      toast({
        title: 'Export Completed',
        description: 'Voter data has been downloaded successfully.'
      });
    }, 1500);
  };

  const generateDummyVoterData = (): string => {
    // Create CSV header
    let csv = 'id,name,age,gender,ac_number,booth_number,phone,email,address\n';
    
    // Generate dummy data
    const genders = ['Male', 'Female', 'Other'];
    const acNumbers = [101, 102, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126]; // AC 101-126
    
    for (let i = 1; i <= 100; i++) {
      const acNumber = acNumbers[Math.floor(Math.random() * acNumbers.length)];
      const boothNumber = Math.floor(Math.random() * 20) + 1;
      
      csv += `${i},Voter ${i},${20 + Math.floor(Math.random() * 60)},${genders[Math.floor(Math.random() * genders.length)]},${acNumber},${boothNumber},98765432${Math.floor(Math.random() * 100)},voter${i}@example.com,"${Math.floor(Math.random() * 1000)} Main Street, City"\n`;
    }
    
    return csv;
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Voter Data Management</h1>
          <p className="text-muted-foreground">Import and export voter data for all 26 Assembly Constituencies</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-full bg-primary/10">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Import Voter Data</h2>
                  <p className="text-sm text-muted-foreground">Upload CSV or Excel file</p>
                </div>
              </div>
              
              <div 
                className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
                onClick={handleImportClick}
              >
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm font-medium mb-2">Click to upload or drag and drop</p>
                <p className="text-xs text-muted-foreground">CSV, XLS, XLSX (Max 50MB)</p>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv,.xls,.xlsx"
                className="hidden"
              />

              <Button 
                className="w-full" 
                onClick={handleImportClick}
                disabled={isImporting}
              >
                {isImporting ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Import Data
                  </>
                )}
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-full bg-success/10">
                  <Download className="h-6 w-6 text-success" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Export Voter Data</h2>
                  <p className="text-sm text-muted-foreground">Download complete voter database</p>
                </div>
              </div>

              <div className="space-y-3 pt-4">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">All Constituencies</span>
                  <span className="text-sm text-muted-foreground">
                    {isLoadingStats ? <Loader2 className="h-4 w-4 animate-spin inline" /> : `${exportStats.totalVoters.toLocaleString()} voters`}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Total Families</span>
                  <span className="text-sm text-muted-foreground">
                    {isLoadingStats ? <Loader2 className="h-4 w-4 animate-spin inline" /> : `${exportStats.totalFamilies.toLocaleString()} families`}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Total Surveys</span>
                  <span className="text-sm text-muted-foreground">
                    {isLoadingStats ? <Loader2 className="h-4 w-4 animate-spin inline" /> : `${exportStats.totalSurveys.toLocaleString()} completed`}
                  </span>
                </div>
              </div>

              <Button 
                className="w-full" 
                variant="default" 
                onClick={handleExportClick}
                disabled={isExporting}
              >
                {isExporting ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Export All Data
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Import History</h3>
          <div className="space-y-3">
            {[
              { date: '2024-03-15', file: 'ac_118_voters.csv', records: 1247, status: 'Success' },
              { date: '2024-03-14', file: 'ac_119_voters.xlsx', records: 2340, status: 'Success' },
              { date: '2024-03-13', file: 'bulk_import.csv', records: 15000, status: 'Failed' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{item.file}</p>
                    <p className="text-xs text-muted-foreground">{item.date} • {item.records} records</p>
                  </div>
                </div>
                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                  item.status === 'Success' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                }`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};