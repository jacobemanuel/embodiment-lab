import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Search, ChevronLeft, ChevronRight, Eye, RefreshCw, CheckCircle, XCircle, AlertTriangle, Info } from "lucide-react";
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
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessionDetails, setSessionDetails] = useState<SessionDetails | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [autoRefresh, setAutoRefresh] = useState(false);
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
  const updateValidationStatus = async (sessionId: string, status: 'accepted' | 'ignored') => {
    try {
      const { error } = await supabase
        .from('study_sessions')
        .update({
          validation_status: status,
          validated_by: userEmail,
          validated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) throw error;

      // Update local state
      setSessions(prev => prev.map(s => 
        s.id === sessionId 
          ? { ...s, validation_status: status, validated_by: userEmail, validated_at: new Date().toISOString() }
          : s
      ));

      toast.success(`Session ${status === 'accepted' ? 'accepted for statistics' : 'ignored from statistics'}`);
    } catch (error) {
      console.error('Error updating validation status:', error);
      toast.error('Failed to update session status');
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
    
    return matchesSearch && matchesMode && matchesStatus;
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
          </div>

          {/* Table */}
          <div className="rounded-md border border-slate-700">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 hover:bg-slate-700/50">
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
                      className={`border-slate-700 hover:bg-slate-700/50 ${isReset ? 'opacity-40' : isCompleted ? '' : 'opacity-50'}`}
                    >
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
                                    <TooltipContent>Accept for statistics</TooltipContent>
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
                                    <TooltipContent>Ignore from statistics</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
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
                            ) : (
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
                            )}
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
            <DialogTitle className="text-white">
              Session Details: {selectedSession?.session_id.slice(0, 12)}...
            </DialogTitle>
          </DialogHeader>
          
          {isDetailsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : sessionDetails ? (
            <div className="space-y-6">
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
