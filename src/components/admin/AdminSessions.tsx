import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Search, ChevronLeft, ChevronRight, Eye, RefreshCw, CheckCircle, XCircle, AlertTriangle, Info, Clock, CheckSquare, Square, FileText } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import jsPDF from "jspdf";
import { format, startOfDay, endOfDay } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import DateRangeFilter from "./DateRangeFilter";
import { getPermissions } from "@/lib/permissions";
import { toast } from "sonner";

interface AdminSessionsProps {
  userEmail?: string;
}

const AdminSessions = ({ userEmail = '' }: AdminSessionsProps) => {
  const permissions = getPermissions(userEmail);

interface Session {
  id: string;
  session_id: string;
  mode: 'text' | 'avatar' | 'voice';
  modes_used: string[] | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  status?: string;
  suspicion_score?: number;
  suspicious_flags?: unknown;
  validation_status?: string;
  validated_by?: string | null;
  validated_at?: string | null;
}

interface SessionDetails {
  demographics: any;
  demographicResponses: any[];
  preTest: any[];
  postTest: any[];
  scenarios: any[];
  dialogueTurns: any[];
}


  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [validationFilter, setValidationFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessionDetails, setSessionDetails] = useState<SessionDetails | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const itemsPerPage = 10;

  const fetchSessions = useCallback(async () => {
    setIsRefreshing(true);
    try {
      let query = supabase
        .from('study_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (startDate) {
        query = query.gte('created_at', startOfDay(startDate).toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', endOfDay(endDate).toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Auto-refresh every 30 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      fetchSessions();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchSessions]);

  const fetchSessionDetails = async (session: Session) => {
    setIsDetailsLoading(true);
    setSelectedSession(session);

    try {
      // Fetch new demographic_responses (flexible schema)
      const { data: demographicResponses } = await supabase
        .from('demographic_responses')
        .select('*')
        .eq('session_id', session.id);

      // Also fetch old demographics table for backwards compatibility
      const { data: oldDemographics } = await supabase
        .from('demographics')
        .select('*')
        .eq('session_id', session.id)
        .maybeSingle();

      const { data: preTest } = await supabase
        .from('pre_test_responses')
        .select('*')
        .eq('session_id', session.id);

      const { data: postTest } = await supabase
        .from('post_test_responses')
        .select('*')
        .eq('session_id', session.id);

      const { data: scenarios } = await supabase
        .from('scenarios')
        .select('*')
        .eq('session_id', session.id);

      let dialogueTurns: any[] = [];
      if (scenarios && scenarios.length > 0) {
        for (const scenario of scenarios) {
          const { data: turns } = await supabase
            .from('dialogue_turns')
            .select('*')
            .eq('scenario_id', scenario.id)
            .order('timestamp', { ascending: true });
          
          if (turns) {
            dialogueTurns = [...dialogueTurns, ...turns.map(t => ({ ...t, scenario_name: scenario.scenario_id }))];
          }
        }
      }

      setSessionDetails({
        demographics: oldDemographics,
        demographicResponses: demographicResponses || [],
        preTest: preTest || [],
        postTest: postTest || [],
        scenarios: scenarios || [],
        dialogueTurns,
      });
    } catch (error) {
      console.error('Error fetching session details:', error);
    } finally {
      setIsDetailsLoading(false);
    }
  };

  // Update session validation status
  // Owner can directly accept/ignore, Admin can only request (goes to 'pending_approval')
  const updateValidationStatus = async (sessionId: string, status: 'accepted' | 'ignored') => {
    try {
      // Determine the actual status to save based on permissions
      let actualStatus = status;
      let toastMessage = '';
      
      if (permissions.canValidateSessionsDirectly) {
        // Owner - directly accept/ignore
        actualStatus = status;
        toastMessage = status === 'accepted' 
          ? 'Session accepted for statistics' 
          : 'Session ignored from statistics';
      } else if (permissions.canRequestValidation) {
        // Admin - request approval (pending_accepted or pending_ignored)
        actualStatus = status === 'accepted' ? 'pending_accepted' : 'pending_ignored' as any;
        toastMessage = status === 'accepted'
          ? 'Requested acceptance - awaiting owner approval'
          : 'Requested ignore - awaiting owner approval';
      } else {
        toast.error('You do not have permission to validate sessions');
        return;
      }

      const { error } = await supabase
        .from('study_sessions')
        .update({
          validation_status: actualStatus,
          validated_by: userEmail,
          validated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) throw error;

      // Update local state
      setSessions(prev => prev.map(s => 
        s.id === sessionId 
          ? { ...s, validation_status: actualStatus, validated_by: userEmail, validated_at: new Date().toISOString() }
          : s
      ));

      toast.success(toastMessage);
    } catch (error) {
      console.error('Error updating validation status:', error);
      toast.error('Failed to update session status');
    }
  };

  // Owner can approve pending validation requests
  const approveValidationRequest = async (sessionId: string, approve: boolean) => {
    if (!permissions.canValidateSessionsDirectly) {
      toast.error('Only owner can approve validation requests');
      return;
    }

    try {
      const session = sessions.find(s => s.id === sessionId);
      if (!session) return;

      // Determine final status based on what was requested
      let finalStatus: string;
      if (approve) {
        finalStatus = session.validation_status === 'pending_accepted' ? 'accepted' : 'ignored';
      } else {
        // Rejected - reset to pending
        finalStatus = 'pending';
      }

      const { error } = await supabase
        .from('study_sessions')
        .update({
          validation_status: finalStatus,
          validated_by: userEmail,
          validated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) throw error;

      setSessions(prev => prev.map(s => 
        s.id === sessionId 
          ? { ...s, validation_status: finalStatus, validated_by: userEmail, validated_at: new Date().toISOString() }
          : s
      ));

      toast.success(approve 
        ? `Validation request approved - session ${finalStatus}` 
        : 'Validation request rejected');
    } catch (error) {
      console.error('Error approving validation:', error);
      toast.error('Failed to process validation request');
    }
  };

  // Bulk validation for multiple sessions
  const bulkUpdateValidation = async (status: 'accepted' | 'ignored') => {
    if (selectedSessionIds.size === 0) {
      toast.error('No sessions selected');
      return;
    }

    try {
      let actualStatus = status;
      let toastMessage = '';
      
      if (permissions.canValidateSessionsDirectly) {
        actualStatus = status;
        toastMessage = `${selectedSessionIds.size} session(s) ${status}`;
      } else if (permissions.canRequestValidation) {
        actualStatus = status === 'accepted' ? 'pending_accepted' : 'pending_ignored' as any;
        toastMessage = `Requested ${status} for ${selectedSessionIds.size} session(s) - awaiting owner approval`;
      } else {
        toast.error('You do not have permission to validate sessions');
        return;
      }

      const sessionIdsArray = Array.from(selectedSessionIds);
      
      const { error } = await supabase
        .from('study_sessions')
        .update({
          validation_status: actualStatus,
          validated_by: userEmail,
          validated_at: new Date().toISOString()
        })
        .in('id', sessionIdsArray);

      if (error) throw error;

      setSessions(prev => prev.map(s => 
        selectedSessionIds.has(s.id)
          ? { ...s, validation_status: actualStatus, validated_by: userEmail, validated_at: new Date().toISOString() }
          : s
      ));
      
      setSelectedSessionIds(new Set());
      toast.success(toastMessage);
    } catch (error) {
      console.error('Error bulk updating validation status:', error);
      toast.error('Failed to update sessions');
    }
  };

  // Toggle session selection
  const toggleSessionSelection = (sessionId: string) => {
    setSelectedSessionIds(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  // Select all flagged sessions on current page
  const selectAllFlagged = () => {
    const flaggedOnPage = paginatedSessions.filter(s => 
      (s.suspicion_score || 0) >= 40 || (Array.isArray(s.suspicious_flags) && s.suspicious_flags.length > 0)
    );
    const allSelected = flaggedOnPage.every(s => selectedSessionIds.has(s.id));
    
    if (allSelected) {
      // Deselect all
      setSelectedSessionIds(prev => {
        const next = new Set(prev);
        flaggedOnPage.forEach(s => next.delete(s.id));
        return next;
      });
    } else {
      // Select all
      setSelectedSessionIds(prev => {
        const next = new Set(prev);
        flaggedOnPage.forEach(s => next.add(s.id));
        return next;
      });
    }
  };

  const filteredSessions = sessions.filter(session => {
    const matchesSearch = session.session_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMode = modeFilter === "all" || session.mode === modeFilter;
    
    // Enhanced status filter
    let matchesStatus = false;
    switch (statusFilter) {
      case 'all':
        matchesStatus = true;
        break;
      case 'completed':
        matchesStatus = !!session.completed_at && session.status !== 'reset';
        break;
      case 'incomplete':
        matchesStatus = !session.completed_at && session.status !== 'reset';
        break;
      case 'reset':
        matchesStatus = session.status === 'reset';
        break;
      case 'suspicious':
        matchesStatus = (session.suspicion_score || 0) >= 40;
        break;
      default:
        matchesStatus = true;
    }

    // Validation status filter
    let matchesValidation = false;
    const validationStatus = session.validation_status || 'pending';
    switch (validationFilter) {
      case 'all':
        matchesValidation = true;
        break;
      case 'pending':
        matchesValidation = validationStatus === 'pending';
        break;
      case 'awaiting':
        matchesValidation = validationStatus === 'pending_accepted' || validationStatus === 'pending_ignored';
        break;
      case 'accepted':
        matchesValidation = validationStatus === 'accepted';
        break;
      case 'ignored':
        matchesValidation = validationStatus === 'ignored';
        break;
      default:
        matchesValidation = true;
    }
    
    return matchesSearch && matchesMode && matchesStatus && matchesValidation;
  });

  const totalPages = Math.ceil(filteredSessions.length / itemsPerPage);
  const paginatedSessions = filteredSessions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const exportToCSV = () => {
    const headers = ['Session ID', 'Mode', 'Started', 'Completed', 'Duration (min)', 'Status', 'Suspicion Score', 'Flags'];
    const rows = filteredSessions.map(s => {
      const duration = s.completed_at 
        ? Math.round((new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()) / 1000 / 60)
        : '';
      const flags = Array.isArray(s.suspicious_flags) ? s.suspicious_flags.join('; ') : '';
      const status = s.status === 'reset' ? 'Reset' : (s.completed_at ? 'Completed' : 'Incomplete');
      return [
        s.session_id,
        s.mode,
        s.started_at,
        s.completed_at || '',
        duration,
        status,
        s.suspicion_score || 0,
        flags
      ];
    });

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sessions_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Export individual session to PDF
  const exportSessionToPDF = (session: Session, details: SessionDetails) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;
    const lineHeight = 7;
    const margin = 15;
    const maxWidth = pageWidth - margin * 2;

    // Helper to add text with word wrap
    const addText = (text: string, fontSize: number = 10, isBold: boolean = false) => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      const lines = doc.splitTextToSize(text, maxWidth);
      lines.forEach((line: string) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, margin, y);
        y += lineHeight;
      });
    };

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Session Report', margin, y);
    y += 10;

    // Session info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Session ID: ${session.session_id}`, margin, y);
    y += lineHeight;
    doc.text(`Mode: ${session.modes_used?.join(', ') || session.mode}`, margin, y);
    y += lineHeight;
    doc.text(`Started: ${session.started_at ? format(new Date(session.started_at), 'dd MMM yyyy HH:mm') : '-'}`, margin, y);
    y += lineHeight;
    doc.text(`Completed: ${session.completed_at ? format(new Date(session.completed_at), 'dd MMM yyyy HH:mm') : 'Not completed'}`, margin, y);
    y += lineHeight;
    
    if (session.completed_at && session.started_at) {
      const duration = Math.round((new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 1000 / 60);
      doc.text(`Duration: ${duration} minutes`, margin, y);
      y += lineHeight;
    }

    if ((session.suspicion_score || 0) > 0) {
      doc.text(`Suspicion Score: ${session.suspicion_score}/100`, margin, y);
      y += lineHeight;
      doc.text(`Validation Status: ${session.validation_status || 'pending'}`, margin, y);
      y += lineHeight;
    }

    y += 5;

    // Demographics
    addText('DEMOGRAPHICS', 12, true);
    y += 2;
    if (details.demographicResponses.length > 0) {
      details.demographicResponses.forEach((r) => {
        addText(`${r.question_id}: ${r.answer}`);
      });
    } else if (details.demographics) {
      addText(`Age: ${details.demographics.age_range || '-'}`);
      addText(`Education: ${details.demographics.education || '-'}`);
      addText(`Experience: ${details.demographics.digital_experience || '-'}`);
    } else {
      addText('No demographic data');
    }
    y += 5;

    // Pre-test
    addText('PRE-TEST RESPONSES', 12, true);
    y += 2;
    if (details.preTest.length > 0) {
      details.preTest.forEach((r) => {
        addText(`${r.question_id}: ${r.answer}`);
      });
    } else {
      addText('No responses');
    }
    y += 5;

    // Post-test
    addText('POST-TEST RESPONSES', 12, true);
    y += 2;
    if (details.postTest.length > 0) {
      details.postTest.forEach((r) => {
        addText(`${r.question_id}: ${r.answer}`);
      });
    } else {
      addText('No responses');
    }
    y += 5;

    // Dialogue
    addText('DIALOGUE', 12, true);
    y += 2;
    if (details.dialogueTurns.length > 0) {
      details.dialogueTurns.forEach((turn) => {
        const role = turn.role === 'user' ? 'User' : 'AI';
        addText(`[${role}]: ${turn.content}`);
      });
    } else {
      addText('No dialogues');
    }

    // Footer
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, margin, 285);

    doc.save(`session_${session.session_id.slice(0, 8)}_report.pdf`);
    toast.success('PDF report downloaded');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onRefresh={fetchSessions}
        isRefreshing={isRefreshing}
        autoRefreshEnabled={autoRefresh}
        onAutoRefreshToggle={setAutoRefresh}
      />

      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Participant Sessions</CardTitle>
              <CardDescription className="text-slate-400">
                Browse and analyze individual study sessions ({filteredSessions.length} total)
              </CardDescription>
            </div>
            {permissions.canExportData && (
              <Button onClick={exportToCSV} variant="outline" className="border-slate-600">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Search by session ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-900 border-slate-600"
              />
            </div>
            <Select value={modeFilter} onValueChange={setModeFilter}>
              <SelectTrigger className="w-[150px] bg-slate-900 border-slate-600">
                <SelectValue placeholder="Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modes</SelectItem>
                <SelectItem value="text">Text Mode</SelectItem>
                <SelectItem value="avatar">Avatar Mode</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] bg-slate-900 border-slate-600">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="incomplete">Incomplete</SelectItem>
                <SelectItem value="reset">Reset/Invalid</SelectItem>
                <SelectItem value="suspicious">Suspicious</SelectItem>
              </SelectContent>
            </Select>
            <Select value={validationFilter} onValueChange={setValidationFilter}>
              <SelectTrigger className="w-[180px] bg-slate-900 border-slate-600">
                <SelectValue placeholder="Validation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Validation</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="awaiting">Awaiting Approval</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="ignored">Ignored</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bulk Actions */}
          {selectedSessionIds.size > 0 && (
            <div className="flex items-center gap-4 p-3 bg-slate-900/50 border border-slate-700 rounded-lg">
              <span className="text-sm text-slate-300">
                {selectedSessionIds.size} session(s) selected
              </span>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="border-green-600 text-green-500 hover:bg-green-600/10"
                  onClick={() => bulkUpdateValidation('accepted')}
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  {permissions.canValidateSessionsDirectly ? 'Accept All' : 'Request Accept'}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="border-red-600 text-red-500 hover:bg-red-600/10"
                  onClick={() => bulkUpdateValidation('ignored')}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  {permissions.canValidateSessionsDirectly ? 'Ignore All' : 'Request Ignore'}
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="text-slate-400"
                  onClick={() => setSelectedSessionIds(new Set())}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="rounded-md border border-slate-700">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 hover:bg-slate-700/50">
                  <TableHead className="text-slate-400 w-10">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 w-6 p-0"
                            onClick={selectAllFlagged}
                          >
                            {paginatedSessions.filter(s => 
                              (s.suspicion_score || 0) >= 40 || (Array.isArray(s.suspicious_flags) && s.suspicious_flags.length > 0)
                            ).every(s => selectedSessionIds.has(s.id)) && paginatedSessions.some(s => 
                              (s.suspicion_score || 0) >= 40 || (Array.isArray(s.suspicious_flags) && s.suspicious_flags.length > 0)
                            ) ? (
                              <CheckSquare className="w-4 h-4 text-primary" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-500" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Select all flagged sessions on this page</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead className="text-slate-400">Session ID</TableHead>
                  <TableHead className="text-slate-400">Mode</TableHead>
                  <TableHead className="text-slate-400">Started</TableHead>
                  <TableHead className="text-slate-400">Completed</TableHead>
                  <TableHead className="text-slate-400">Duration</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-slate-400">Flags</TableHead>
                  <TableHead className="text-slate-400">Validation</TableHead>
                  <TableHead className="text-slate-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSessions.map((session) => {
                  const duration = session.completed_at
                    ? Math.round((new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 1000 / 60)
                    : null;

                  const isCompleted = !!session.completed_at;
                  const isReset = session.status === 'reset';
                  const isSuspicious = (session.suspicion_score || 0) >= 40 || (Array.isArray(session.suspicious_flags) && session.suspicious_flags.length > 0);
                  const suspiciousFlags = Array.isArray(session.suspicious_flags) ? session.suspicious_flags : [];
                  const validationStatus = session.validation_status || 'pending';

                  // Determine status display
                  let statusBadge;
                  if (isReset) {
                    statusBadge = <Badge variant="destructive">Reset</Badge>;
                  } else if (isCompleted) {
                    statusBadge = <Badge className="bg-green-600">Completed</Badge>;
                  } else {
                    statusBadge = <Badge variant="outline" className="border-orange-500 text-orange-500">Incomplete</Badge>;
                  }

                  return (
                    <TableRow
                      key={session.id}
                      className={`border-slate-700 hover:bg-slate-700/50 ${isReset ? 'opacity-40' : isCompleted ? '' : 'opacity-50'} ${selectedSessionIds.has(session.id) ? 'bg-slate-700/30' : ''}`}
                    >
                      <TableCell>
                        {isSuspicious ? (
                          <Checkbox
                            checked={selectedSessionIds.has(session.id)}
                            onCheckedChange={() => toggleSessionSelection(session.id)}
                            className="border-slate-500"
                          />
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-slate-300">
                        {session.session_id.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(session.modes_used && session.modes_used.length > 0 
                            ? session.modes_used 
                            : [session.mode]
                          ).map((m) => (
                            <Badge key={m} variant={m === 'text' ? 'default' : 'secondary'}>
                              {m === 'text' ? 'Text' : 'Avatar'}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {format(new Date(session.started_at), 'dd MMM yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {session.completed_at 
                          ? format(new Date(session.completed_at), 'dd MMM yyyy HH:mm')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {duration ? `${duration} min` : '-'}
                      </TableCell>
                      <TableCell>
                        {statusBadge}
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <div className="flex flex-col gap-1">
                            {isSuspicious && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="destructive" className="text-xs cursor-help">
                                    ⚠️ Score: {session.suspicion_score || 0}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-md bg-slate-900 border-slate-700 p-3">
                                  <p className="font-semibold mb-2 text-white">Suspicion Score Explanation</p>
                                  <div className="text-xs space-y-2 text-slate-300">
                                    <p><strong>Score {session.suspicion_score || 0}/100</strong> - Higher = more suspicious</p>
                                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                                      <span>0-19: Normal</span><span className="text-green-400">✓ Valid</span>
                                      <span>20-39: Low risk</span><span className="text-yellow-400">⚠ Minor flags</span>
                                      <span>40-59: Medium risk</span><span className="text-orange-400">⚠ Review needed</span>
                                      <span>60+: High risk</span><span className="text-red-400">⚠ Likely bot/inattentive</span>
                                    </div>
                                    <hr className="border-slate-700 my-2" />
                                    <p className="font-semibold text-white">Detected Issues:</p>
                                    <ul className="space-y-1">
                                      {suspiciousFlags.map((flag, i) => (
                                        <li key={i}>• {String(flag).replace(/_/g, ' ')}</li>
                                      ))}
                                      {suspiciousFlags.length === 0 && <li className="italic">Score based on overall timing patterns</li>}
                                    </ul>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {!isSuspicious && suspiciousFlags.length > 0 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-xs text-yellow-500 cursor-help">
                                    {suspiciousFlags.length} flag{suspiciousFlags.length > 1 ? 's' : ''}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <ul className="text-xs space-y-1">
                                    {suspiciousFlags.map((flag, i) => (
                                      <li key={i}>• {String(flag).replace(/_/g, ' ')}</li>
                                    ))}
                                  </ul>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {!isSuspicious && suspiciousFlags.length === 0 && (
                              <span className="text-xs text-slate-500">-</span>
                            )}
                          </div>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        {isSuspicious || suspiciousFlags.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {validationStatus === 'pending' ? (
                              <div className="flex gap-1">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button 
                                        size="sm" 
                                        variant="ghost"
                                        className="h-7 w-7 p-0 text-green-500 hover:text-green-400 hover:bg-green-500/10"
                                        onClick={() => updateValidationStatus(session.id, 'accepted')}
                                      >
                                        <CheckCircle className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {permissions.canValidateSessionsDirectly 
                                        ? 'Accept for statistics' 
                                        : 'Request acceptance (needs owner approval)'}
                                    </TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button 
                                        size="sm" 
                                        variant="ghost"
                                        className="h-7 w-7 p-0 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                                        onClick={() => updateValidationStatus(session.id, 'ignored')}
                                      >
                                        <XCircle className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {permissions.canValidateSessionsDirectly 
                                        ? 'Ignore from statistics' 
                                        : 'Request ignore (needs owner approval)'}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            ) : validationStatus === 'pending_accepted' || validationStatus === 'pending_ignored' ? (
                              // Pending approval from owner
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600/50 cursor-help">
                                      <Clock className="w-3 h-3 mr-1" />
                                      {validationStatus === 'pending_accepted' ? 'Awaiting Accept' : 'Awaiting Ignore'}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Requested by {session.validated_by}</p>
                                    {session.validated_at && <p className="text-xs text-muted-foreground">{format(new Date(session.validated_at), 'dd MMM yyyy HH:mm')}</p>}
                                  </TooltipContent>
                                </Tooltip>
                                {permissions.canValidateSessionsDirectly && (
                                  <div className="flex gap-1 mt-1">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button 
                                          size="sm" 
                                          variant="ghost"
                                          className="h-6 w-6 p-0 text-green-500 hover:text-green-400 hover:bg-green-500/10"
                                          onClick={() => approveValidationRequest(session.id, true)}
                                        >
                                          <CheckCircle className="w-3 h-3" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Approve request</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button 
                                          size="sm" 
                                          variant="ghost"
                                          className="h-6 w-6 p-0 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                                          onClick={() => approveValidationRequest(session.id, false)}
                                        >
                                          <XCircle className="w-3 h-3" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Reject request</TooltipContent>
                                    </Tooltip>
                                  </div>
                                )}
                              </TooltipProvider>
                            ) : validationStatus === 'accepted' ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge className="bg-green-600/20 text-green-400 border-green-600/50 cursor-help">
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Accepted
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Accepted by {session.validated_by}</p>
                                    {session.validated_at && <p className="text-xs text-muted-foreground">{format(new Date(session.validated_at), 'dd MMM yyyy HH:mm')}</p>}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : validationStatus === 'ignored' ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge className="bg-red-600/20 text-red-400 border-red-600/50 cursor-help">
                                      <XCircle className="w-3 h-3 mr-1" />
                                      Ignored
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Ignored by {session.validated_by}</p>
                                    {session.validated_at && <p className="text-xs text-muted-foreground">{format(new Date(session.validated_at), 'dd MMM yyyy HH:mm')}</p>}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => fetchSessionDetails(session)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">
              Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredSessions.length)} of {filteredSessions.length}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="border-slate-600"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="border-slate-600"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session Details Dialog */}
      <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-slate-800 border-slate-700">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-white">
                Session Details: {selectedSession?.session_id.slice(0, 12)}...
              </DialogTitle>
              {permissions.canExportData && selectedSession && sessionDetails && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-slate-600"
                  onClick={() => exportSessionToPDF(selectedSession, sessionDetails)}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Export PDF
                </Button>
              )}
            </div>
          </DialogHeader>
          
          {isDetailsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : sessionDetails ? (
            <div className="space-y-6">
              {/* Session Summary */}
              <div className="bg-slate-900 p-4 rounded">
                <h3 className="text-lg font-semibold text-white mb-3">Session Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400 block">Mode</span>
                    <span className="text-white">{selectedSession?.modes_used?.join(', ') || selectedSession?.mode}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Started</span>
                    <span className="text-white">{selectedSession?.started_at ? format(new Date(selectedSession.started_at), 'dd MMM yyyy HH:mm') : '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Completed</span>
                    <span className="text-white">{selectedSession?.completed_at ? format(new Date(selectedSession.completed_at), 'dd MMM yyyy HH:mm') : 'Not completed'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Duration</span>
                    <span className="text-white">
                      {selectedSession?.completed_at && selectedSession?.started_at
                        ? `${Math.round((new Date(selectedSession.completed_at).getTime() - new Date(selectedSession.started_at).getTime()) / 1000 / 60)} min`
                        : '-'}
                    </span>
                  </div>
                  {(selectedSession?.suspicion_score || 0) > 0 && (
                    <>
                      <div>
                        <span className="text-slate-400 block">Suspicion Score</span>
                        <span className="text-orange-400">{selectedSession?.suspicion_score}/100</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Validation</span>
                        <span className="text-white capitalize">{selectedSession?.validation_status || 'pending'}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Demographics */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Demographics ({sessionDetails.demographicResponses.length > 0 ? sessionDetails.demographicResponses.length : (sessionDetails.demographics ? 3 : 0)} responses)
                </h3>
                {sessionDetails.demographicResponses.length > 0 ? (
                  <div className="bg-slate-900 p-4 rounded max-h-40 overflow-y-auto">
                    {sessionDetails.demographicResponses.map((r, i) => (
                      <div key={i} className="text-sm mb-2 pb-2 border-b border-slate-700 last:border-0">
                        <span className="text-slate-400">{r.question_id}:</span>
                        <span className="text-white ml-2">{r.answer}</span>
                      </div>
                    ))}
                  </div>
                ) : sessionDetails.demographics ? (
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="bg-slate-900 p-3 rounded">
                      <span className="text-slate-400">Age:</span>
                      <span className="text-white ml-2">{sessionDetails.demographics.age_range || '-'}</span>
                    </div>
                    <div className="bg-slate-900 p-3 rounded">
                      <span className="text-slate-400">Education:</span>
                      <span className="text-white ml-2">{sessionDetails.demographics.education || '-'}</span>
                    </div>
                    <div className="bg-slate-900 p-3 rounded">
                      <span className="text-slate-400">Experience:</span>
                      <span className="text-white ml-2">{sessionDetails.demographics.digital_experience || '-'}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500">No demographic data</p>
                )}
              </div>

              {/* Pre-test Responses */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Pre-test ({sessionDetails.preTest.length} responses)</h3>
                {sessionDetails.preTest.length > 0 ? (
                  <div className="bg-slate-900 p-4 rounded max-h-40 overflow-y-auto">
                    {sessionDetails.preTest.map((r, i) => (
                      <div key={i} className="text-sm mb-2 pb-2 border-b border-slate-700 last:border-0">
                        <span className="text-slate-400">{r.question_id}:</span>
                        <span className="text-white ml-2">{r.answer}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500">No responses</p>
                )}
              </div>

              {/* Post-test Responses */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Post-test ({sessionDetails.postTest.length} responses)</h3>
                {sessionDetails.postTest.length > 0 ? (
                  <div className="bg-slate-900 p-4 rounded max-h-40 overflow-y-auto">
                    {sessionDetails.postTest.map((r, i) => (
                      <div key={i} className="text-sm mb-2 pb-2 border-b border-slate-700 last:border-0">
                        <span className="text-slate-400">{r.question_id}:</span>
                        <span className="text-white ml-2">{r.answer}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500">No responses</p>
                )}
              </div>

              {/* Dialogue */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Dialogue ({sessionDetails.dialogueTurns.length} messages)</h3>
                {sessionDetails.dialogueTurns.length > 0 ? (
                  <div className="bg-slate-900 p-4 rounded max-h-60 overflow-y-auto">
                    {sessionDetails.dialogueTurns.map((turn, i) => (
                      <div key={i} className={`text-sm mb-2 p-2 rounded ${turn.role === 'user' ? 'bg-blue-900/30' : 'bg-slate-800'}`}>
                        <span className={`font-semibold ${turn.role === 'user' ? 'text-blue-400' : 'text-green-400'}`}>
                          {turn.role === 'user' ? 'User' : 'AI'}:
                        </span>
                        <span className="text-white ml-2">{turn.content}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500">No dialogues</p>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSessions;
