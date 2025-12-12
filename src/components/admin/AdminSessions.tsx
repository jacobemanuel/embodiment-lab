import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Search, Filter, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Session {
  id: string;
  session_id: string;
  mode: 'text' | 'avatar' | 'voice';
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

interface SessionDetails {
  demographics: any;
  preTest: any[];
  postTest: any[];
  scenarios: any[];
  dialogueTurns: any[];
}

const AdminSessions = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessionDetails, setSessionDetails] = useState<SessionDetails | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('study_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSessionDetails = async (session: Session) => {
    setIsDetailsLoading(true);
    setSelectedSession(session);

    try {
      // Fetch demographics
      const { data: demographics } = await supabase
        .from('demographics')
        .select('*')
        .eq('session_id', session.id)
        .single();

      // Fetch pre-test responses
      const { data: preTest } = await supabase
        .from('pre_test_responses')
        .select('*')
        .eq('session_id', session.id);

      // Fetch post-test responses
      const { data: postTest } = await supabase
        .from('post_test_responses')
        .select('*')
        .eq('session_id', session.id);

      // Fetch scenarios
      const { data: scenarios } = await supabase
        .from('scenarios')
        .select('*')
        .eq('session_id', session.id);

      // Fetch dialogue turns for each scenario
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
        demographics,
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
      (statusFilter === "in-progress" && !session.completed_at);
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
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Sesje uczestników</CardTitle>
              <CardDescription className="text-slate-400">
                Przeglądaj i analizuj indywidualne sesje badawcze
              </CardDescription>
            </div>
            <Button onClick={exportToCSV} variant="outline" className="border-slate-600">
              <Download className="w-4 h-4 mr-2" />
              Eksportuj CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Szukaj po ID sesji..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-900 border-slate-600"
              />
            </div>
            <Select value={modeFilter} onValueChange={setModeFilter}>
              <SelectTrigger className="w-[150px] bg-slate-900 border-slate-600">
                <SelectValue placeholder="Tryb" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie tryby</SelectItem>
                <SelectItem value="text">Text Mode</SelectItem>
                <SelectItem value="avatar">Avatar Mode</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] bg-slate-900 border-slate-600">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie</SelectItem>
                <SelectItem value="completed">Ukończone</SelectItem>
                <SelectItem value="in-progress">W trakcie</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border border-slate-700">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 hover:bg-slate-700/50">
                  <TableHead className="text-slate-400">ID Sesji</TableHead>
                  <TableHead className="text-slate-400">Tryb</TableHead>
                  <TableHead className="text-slate-400">Rozpoczęcie</TableHead>
                  <TableHead className="text-slate-400">Zakończenie</TableHead>
                  <TableHead className="text-slate-400">Czas trwania</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-slate-400">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSessions.map((session) => {
                  const duration = session.completed_at
                    ? Math.round((new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 1000 / 60)
                    : null;

                  return (
                    <TableRow key={session.id} className="border-slate-700 hover:bg-slate-700/50">
                      <TableCell className="font-mono text-sm text-slate-300">
                        {session.session_id.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <Badge variant={session.mode === 'text' ? 'default' : 'secondary'}>
                          {session.mode === 'text' ? 'Text' : 'Avatar'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {format(new Date(session.started_at), 'dd MMM yyyy HH:mm', { locale: pl })}
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {session.completed_at 
                          ? format(new Date(session.completed_at), 'dd MMM yyyy HH:mm', { locale: pl })
                          : '-'}
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {duration ? `${duration} min` : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={session.completed_at ? 'default' : 'outline'} 
                               className={session.completed_at ? 'bg-green-600' : 'border-yellow-500 text-yellow-500'}>
                          {session.completed_at ? 'Ukończona' : 'W trakcie'}
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
              Pokazuje {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredSessions.length)} z {filteredSessions.length}
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
              Szczegóły sesji: {selectedSession?.session_id.slice(0, 12)}...
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
                <h3 className="text-lg font-semibold text-white mb-2">Demografia</h3>
                {sessionDetails.demographics ? (
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="bg-slate-900 p-3 rounded">
                      <span className="text-slate-400">Wiek:</span>
                      <span className="text-white ml-2">{sessionDetails.demographics.age_range || '-'}</span>
                    </div>
                    <div className="bg-slate-900 p-3 rounded">
                      <span className="text-slate-400">Wykształcenie:</span>
                      <span className="text-white ml-2">{sessionDetails.demographics.education || '-'}</span>
                    </div>
                    <div className="bg-slate-900 p-3 rounded">
                      <span className="text-slate-400">Doświadczenie:</span>
                      <span className="text-white ml-2">{sessionDetails.demographics.digital_experience || '-'}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500">Brak danych demograficznych</p>
                )}
              </div>

              {/* Pre-test Responses */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Pre-test ({sessionDetails.preTest.length} odpowiedzi)</h3>
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
                  <p className="text-slate-500">Brak odpowiedzi</p>
                )}
              </div>

              {/* Post-test Responses */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Post-test ({sessionDetails.postTest.length} odpowiedzi)</h3>
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
                  <p className="text-slate-500">Brak odpowiedzi</p>
                )}
              </div>

              {/* Dialogue */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Dialog ({sessionDetails.dialogueTurns.length} wiadomości)</h3>
                {sessionDetails.dialogueTurns.length > 0 ? (
                  <div className="bg-slate-900 p-4 rounded max-h-60 overflow-y-auto">
                    {sessionDetails.dialogueTurns.map((turn, i) => (
                      <div key={i} className={`text-sm mb-2 p-2 rounded ${turn.role === 'user' ? 'bg-blue-900/30' : 'bg-slate-800'}`}>
                        <span className={`font-semibold ${turn.role === 'user' ? 'text-blue-400' : 'text-green-400'}`}>
                          {turn.role === 'user' ? 'Użytkownik' : 'AI'}:
                        </span>
                        <span className="text-white ml-2">{turn.content}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500">Brak dialogów</p>
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
