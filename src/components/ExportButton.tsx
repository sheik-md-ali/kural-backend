import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileText, FileSpreadsheet, FileJson } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ExportButtonProps {
  data: any;
  filename: string;
  acNumber?: string;
}

export const ExportButton = ({ data, filename, acNumber }: ExportButtonProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleExportCSV = () => {
    setIsExporting(true);
    try {
      // Convert data to CSV format
      let csvContent = '';

      // Add header information
      csvContent += 'AC Performance Report\n';
      csvContent += `AC Number,${acNumber || 'N/A'}\n`;
      if (data.filteredBooth) {
        csvContent += `Filtered Booth,"${data.filteredBooth}"\n`;
      }
      csvContent += `Report Generated,"${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}"\n\n`;

      // Key metrics section
      csvContent += '=== SUMMARY METRICS ===\n';
      csvContent += 'Metric,Value\n';
      csvContent += `Total Voters,${data.voters || 0}\n`;
      csvContent += `Total Families,${data.families || 0}\n`;
      csvContent += `Surveys Completed,${data.surveys || 0}\n`;
      csvContent += `Total Booths,${data.booths || 0}\n`;
      csvContent += `Completion Rate,${data.completion || 0}%\n\n`;

      // Gender distribution section
      if (data.maleVoters !== undefined || data.femaleVoters !== undefined) {
        csvContent += '=== GENDER DISTRIBUTION ===\n';
        csvContent += 'Gender,Count,Percentage\n';
        const total = (data.maleVoters || 0) + (data.femaleVoters || 0);
        const malePercent = total > 0 ? ((data.maleVoters || 0) / total * 100).toFixed(1) : '0';
        const femalePercent = total > 0 ? ((data.femaleVoters || 0) / total * 100).toFixed(1) : '0';
        csvContent += `Male,${data.maleVoters || 0},${malePercent}%\n`;
        csvContent += `Female,${data.femaleVoters || 0},${femalePercent}%\n\n`;
      }

      // Age distribution section
      if (data.ageDistribution && data.ageDistribution.length > 0) {
        csvContent += '=== AGE DISTRIBUTION ===\n';
        csvContent += 'Age Group,Total Count,Male,Female\n';
        data.ageDistribution.forEach((age: any) => {
          const ageGroup = age.ageGroup || age.group || 'Unknown';
          csvContent += `"${ageGroup}",${age.count},${age.male || age.maleCount || 0},${age.female || age.femaleCount || 0}\n`;
        });
        csvContent += '\n';
      }

      // Booth performance data section
      if (data.boothPerformance && data.boothPerformance.length > 0) {
        csvContent += '=== BOOTH-WISE PERFORMANCE ===\n';
        csvContent += 'S.No,Booth Name,Total Voters,Surveys Completed,Completion Rate\n';
        data.boothPerformance.forEach((booth: any, index: number) => {
          csvContent += `${index + 1},"${booth.booth}",${booth.voters},${booth.surveyed},${booth.completion}%\n`;
        });
        csvContent += '\n';
      }

      // Survey questions data
      if (data.surveyQuestions && data.surveyQuestions.length > 0) {
        csvContent += '=== SURVEY QUESTION COVERAGE ===\n';
        csvContent += 'Question,Responses,Percentage\n';
        data.surveyQuestions.forEach((q: any) => {
          csvContent += `"${q.question}",${q.responses},${q.percentage}%\n`;
        });
        csvContent += '\n';
      }

      // Agent performance data
      if (data.agentPerformance && data.agentPerformance.length > 0) {
        csvContent += '=== AGENT PERFORMANCE ===\n';
        csvContent += 'Agent Name,Surveys Completed,Quality Score\n';
        data.agentPerformance.forEach((agent: any) => {
          csvContent += `"${agent.name}",${agent.surveys},${agent.quality}%\n`;
        });
        csvContent += '\n';
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Export Successful',
        description: `CSV file with ${data.boothPerformance?.length || 0} booth records has been downloaded.`,
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'There was an error exporting the file.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = () => {
    setIsExporting(true);
    try {
      // Export as tab-separated values with Excel extension for proper Excel compatibility
      let tsvContent = '';

      // Add header information
      tsvContent += 'AC Performance Report\n';
      tsvContent += `AC Number\t${acNumber || 'N/A'}\n`;
      if (data.filteredBooth) {
        tsvContent += `Filtered Booth\t${data.filteredBooth}\n`;
      }
      tsvContent += `Report Generated\t${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n\n`;

      // Key metrics section
      tsvContent += '=== SUMMARY METRICS ===\n';
      tsvContent += 'Metric\tValue\n';
      tsvContent += `Total Voters\t${data.voters || 0}\n`;
      tsvContent += `Total Families\t${data.families || 0}\n`;
      tsvContent += `Surveys Completed\t${data.surveys || 0}\n`;
      tsvContent += `Total Booths\t${data.booths || 0}\n`;
      tsvContent += `Completion Rate\t${data.completion || 0}%\n\n`;

      // Gender distribution section
      if (data.maleVoters !== undefined || data.femaleVoters !== undefined) {
        tsvContent += '=== GENDER DISTRIBUTION ===\n';
        tsvContent += 'Gender\tCount\tPercentage\n';
        const total = (data.maleVoters || 0) + (data.femaleVoters || 0);
        const malePercent = total > 0 ? ((data.maleVoters || 0) / total * 100).toFixed(1) : '0';
        const femalePercent = total > 0 ? ((data.femaleVoters || 0) / total * 100).toFixed(1) : '0';
        tsvContent += `Male\t${data.maleVoters || 0}\t${malePercent}%\n`;
        tsvContent += `Female\t${data.femaleVoters || 0}\t${femalePercent}%\n\n`;
      }

      // Age distribution section
      if (data.ageDistribution && data.ageDistribution.length > 0) {
        tsvContent += '=== AGE DISTRIBUTION ===\n';
        tsvContent += 'Age Group\tTotal Count\tMale\tFemale\n';
        data.ageDistribution.forEach((age: any) => {
          const ageGroup = age.ageGroup || age.group || 'Unknown';
          tsvContent += `${ageGroup}\t${age.count}\t${age.male || age.maleCount || 0}\t${age.female || age.femaleCount || 0}\n`;
        });
        tsvContent += '\n';
      }

      // Booth performance data section
      if (data.boothPerformance && data.boothPerformance.length > 0) {
        tsvContent += '=== BOOTH-WISE PERFORMANCE ===\n';
        tsvContent += 'S.No\tBooth Name\tTotal Voters\tSurveys Completed\tCompletion Rate\n';
        data.boothPerformance.forEach((booth: any, index: number) => {
          tsvContent += `${index + 1}\t${booth.booth}\t${booth.voters}\t${booth.surveyed}\t${booth.completion}%\n`;
        });
        tsvContent += '\n';
      }

      // Survey questions data
      if (data.surveyQuestions && data.surveyQuestions.length > 0) {
        tsvContent += '=== SURVEY QUESTION COVERAGE ===\n';
        tsvContent += 'Question\tResponses\tPercentage\n';
        data.surveyQuestions.forEach((q: any) => {
          tsvContent += `${q.question}\t${q.responses}\t${q.percentage}%\n`;
        });
        tsvContent += '\n';
      }

      // Agent performance data
      if (data.agentPerformance && data.agentPerformance.length > 0) {
        tsvContent += '=== AGENT PERFORMANCE ===\n';
        tsvContent += 'Agent Name\tSurveys Completed\tQuality Score\n';
        data.agentPerformance.forEach((agent: any) => {
          tsvContent += `${agent.name}\t${agent.surveys}\t${agent.quality}%\n`;
        });
        tsvContent += '\n';
      }

      const blob = new Blob([tsvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.xls`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Export Successful',
        description: `Excel file with ${data.boothPerformance?.length || 0} booth records has been downloaded.`,
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'There was an error exporting the file.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = () => {
    setIsExporting(true);
    try {
      // Mock PDF export (in real app, use a library like jsPDF)
      toast({
        title: 'PDF Export',
        description: 'PDF export functionality would be implemented with jsPDF library in a production environment.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJSON = () => {
    setIsExporting(true);
    try {
      const jsonContent = JSON.stringify({ ...data, acNumber, generatedAt: new Date().toISOString() }, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.json`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Export Successful',
        description: 'JSON file has been downloaded.',
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'There was an error exporting the file.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isExporting}>
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? 'Exporting...' : 'Export'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Export Format</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleExportPDF}>
          <FileText className="mr-2 h-4 w-4" />
          Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportExcel}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Export as Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportCSV}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportJSON}>
          <FileJson className="mr-2 h-4 w-4" />
          Export as JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};