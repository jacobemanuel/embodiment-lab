import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Search, ChevronLeft, ChevronRight, Eye, RefreshCw } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DateRangeFilter from "./DateRangeFilter";

interface Session {
  id: string;
  session_id: string;
  mode: 'text' | 'avatar' | 'voice';
  modes_used: string[] | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

interface SessionDetails {
  demographics: any;
  demographicResponses: any[];
  preTest: any[];
  postTest: any[];
  scenarios: any[];
  dialogueTurns: any[];
}

const AdminSessions = () => {
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

  const filteredSessions = sessions.filter(session => {
    const matchesSearch = session.session_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMode = modeFilter === "all" || session.mode === modeFilter;
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "completed" && session.completed_at) ||
      (statusFilter === "incomplete" && !session.completed_at);
    return matchesSearch && matchesMode && matchesStatus;
  });

  const totalPages = Math.ceil(filteredSessions.length / itemsPerPage);
  const paginatedSessions = filteredSessions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const exportToCSV = () => {
    const headers = ['Session ID', 'Mode', 'Started', 'Completed', 'Duration (min)', 'Status'];
    const rows = filteredSessions.map(s => {
      const duration = s.completed_at 
        ? Math.round((new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()) / 1000 / 60)
        : '';
      return [
        s.session_id,
        s.mode,
        s.started_at,
        s.completed_at || '',
        duration,
        s.completed_at ? 'Completed' : 'In Progress'
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
            <Button onClick={exportToCSV} variant="outline" className="border-slate-600">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
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
                  <TableHead className="text-slate-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSessions.map((session) => {
                  const duration = session.completed_at
                    ? Math.round((new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 1000 / 60)
                    : null;

                  const isCompleted = !!session.completed_at;

                  return (
                    <TableRow
                      key={session.id}
                      className={`border-slate-700 hover:bg-slate-700/50 ${isCompleted ? '' : 'opacity-50'}`}
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
                        <Badge variant={session.completed_at ? 'default' : 'outline'} 
                               className={session.completed_at ? 'bg-green-600' : 'border-orange-500 text-orange-500'}>
                          {session.completed_at ? 'Completed' : 'Incomplete'}
                        </Badge>
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
