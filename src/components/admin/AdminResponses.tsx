import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Filter, MessageSquare, FileSpreadsheet, CheckCircle, XCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import DateRangeFilter from "./DateRangeFilter";
import { startOfDay, endOfDay, format } from "date-fns";
import { Badge } from "@/components/ui/badge";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

interface ResponseData {
  question_id: string;
  answer: string;
  count: number;
}

type ModeFilter = 'all' | 'text' | 'avatar' | 'both';
type StatusFilter = 'all' | 'completed' | 'incomplete';

const AdminResponses = () => {
  const [preTestData, setPreTestData] = useState<Record<string, ResponseData[]>>({});
  const [postTestData, setPostTestData] = useState<Record<string, ResponseData[]>>({});
  const [demographicsData, setDemographicsData] = useState<Record<string, ResponseData[]>>({});
  const [openFeedbackData, setOpenFeedbackData] = useState<Array<{session_id: string; question_id: string; answer: string; created_at: string}>>([]);
  const [rawResponses, setRawResponses] = useState<{pre: any[], post: any[], demo: any[]}>({ pre: [], post: [], demo: [] });
  const [sessionCount, setSessionCount] = useState({ total: 0, completed: 0, incomplete: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [questionTexts, setQuestionTexts] = useState<Record<string, string>>({});
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('completed');

  const fetchQuestionTexts = async () => {
    try {
      const { data } = await supabase
        .from('study_questions')
        .select('question_id, question_text');
      
      const texts: Record<string, string> = {};
      data?.forEach(q => {
        texts[q.question_id] = q.question_text;
      });
      setQuestionTexts(texts);
    } catch (error) {
      console.error('Error fetching question texts:', error);
    }
  };

  const fetchAllResponses = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // First get session IDs that match the date filter, mode filter, and status filter
      let sessionQuery = supabase.from('study_sessions').select('id, mode, modes_used, completed_at');
      if (startDate) {
        sessionQuery = sessionQuery.gte('created_at', startOfDay(startDate).toISOString());
      }
      if (endDate) {
        sessionQuery = sessionQuery.lte('created_at', endOfDay(endDate).toISOString());
      }
      const { data: sessions } = await sessionQuery;
      
      // Count sessions by status
      const completedCount = sessions?.filter(s => s.completed_at).length || 0;
      const incompleteCount = sessions?.filter(s => !s.completed_at).length || 0;
      setSessionCount({ total: sessions?.length || 0, completed: completedCount, incomplete: incompleteCount });
      
      // Filter sessions by status
      let filteredSessions = sessions || [];
      if (statusFilter === 'completed') {
        filteredSessions = filteredSessions.filter(s => s.completed_at);
      } else if (statusFilter === 'incomplete') {
        filteredSessions = filteredSessions.filter(s => !s.completed_at);
      }
      
      // Filter sessions by mode
      if (modeFilter !== 'all') {
        filteredSessions = filteredSessions.filter(s => {
          const modesUsed = s.modes_used && s.modes_used.length > 0 ? s.modes_used : [s.mode];
          if (modeFilter === 'text') {
            return modesUsed.length === 1 && modesUsed.includes('text');
          } else if (modeFilter === 'avatar') {
            return modesUsed.length === 1 && modesUsed.includes('avatar');
          } else if (modeFilter === 'both') {
            return modesUsed.includes('text') && modesUsed.includes('avatar');
          }
          return true;
        });
      }
      
      const sessionIds = filteredSessions.map(s => s.id);

      // Build queries with date filter
      let preTestQuery = supabase.from('pre_test_responses').select('question_id, answer, session_id');
      let postTestQuery = supabase.from('post_test_responses').select('question_id, answer, session_id');
      let demoQuery = supabase.from('demographic_responses').select('question_id, answer, session_id');

      if (sessionIds.length > 0) {
        preTestQuery = preTestQuery.in('session_id', sessionIds);
        postTestQuery = postTestQuery.in('session_id', sessionIds);
        demoQuery = demoQuery.in('session_id', sessionIds);
      } else if (startDate || endDate || modeFilter !== 'all' || statusFilter !== 'all') {
        // No matching sessions, return empty
        setPreTestData({});
        setPostTestData({});
        setDemographicsData({});
        setOpenFeedbackData([]);
        setRawResponses({ pre: [], post: [], demo: [] });
        setIsRefreshing(false);
        return;
      }

      const { data: preTest } = await preTestQuery;
      const { data: postTest } = await postTestQuery;
      const { data: demographics } = await demoQuery;

      // Store raw responses for CSV export
      setRawResponses({ pre: preTest || [], post: postTest || [], demo: demographics || [] });

      // Aggregate pre-test responses
      const preTestAggregated: Record<string, ResponseData[]> = {};
      preTest?.forEach(r => {
        if (!preTestAggregated[r.question_id]) {
          preTestAggregated[r.question_id] = [];
        }
        const existing = preTestAggregated[r.question_id].find(x => x.answer === r.answer);
        if (existing) {
          existing.count++;
        } else {
          preTestAggregated[r.question_id].push({ question_id: r.question_id, answer: r.answer, count: 1 });
        }
      });

      // Aggregate post-test responses
      const postTestAggregated: Record<string, ResponseData[]> = {};
      postTest?.forEach(r => {
        if (!postTestAggregated[r.question_id]) {
          postTestAggregated[r.question_id] = [];
        }
        const existing = postTestAggregated[r.question_id].find(x => x.answer === r.answer);
        if (existing) {
          existing.count++;
        } else {
          postTestAggregated[r.question_id].push({ question_id: r.question_id, answer: r.answer, count: 1 });
        }
      });

      // Aggregate demographic responses
      const demoAggregated: Record<string, ResponseData[]> = {};
      demographics?.forEach(r => {
        if (!demoAggregated[r.question_id]) {
          demoAggregated[r.question_id] = [];
        }
        const existing = demoAggregated[r.question_id].find(x => x.answer === r.answer);
        if (existing) {
          existing.count++;
        } else {
          demoAggregated[r.question_id].push({ question_id: r.question_id, answer: r.answer, count: 1 });
        }
      });

      // Filter open feedback from post-test responses
      const openFeedback = (postTest || []).filter(r => 
        r.question_id.startsWith('open_')
      ).map(r => ({
        session_id: r.session_id,
        question_id: r.question_id,
        answer: r.answer,
        created_at: ''
      }));

      setPreTestData(preTestAggregated);
      setPostTestData(postTestAggregated);
      setDemographicsData(demoAggregated);
      setOpenFeedbackData(openFeedback);
    } catch (error) {
      console.error('Error fetching responses:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [startDate, endDate, modeFilter, statusFilter]);

  useEffect(() => {
    fetchQuestionTexts();
  }, []);

  useEffect(() => {
    fetchAllResponses();
  }, [startDate, endDate, fetchAllResponses]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchAllResponses();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchAllResponses]);

  // CSV Export helpers
  const downloadCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csv = [
      headers.map(h => `"${h}"`).join(','),
      ...data.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportDemographicsCSV = () => {
    const data = rawResponses.demo.map(r => ({
      SessionID: r.session_id,
      QuestionID: r.question_id,
      Question: questionTexts[r.question_id] || r.question_id,
      Answer: r.answer
    }));
    downloadCSV(data, 'demographics_responses');
  };

  const exportPreTestCSV = () => {
    const data = rawResponses.pre.map(r => ({
      SessionID: r.session_id,
      QuestionID: r.question_id,
      Question: questionTexts[r.question_id] || r.question_id,
      Answer: r.answer
    }));
    downloadCSV(data, 'pretest_responses');
  };

  const exportPostTestCSV = () => {
    const data = rawResponses.post.map(r => ({
      SessionID: r.session_id,
      QuestionID: r.question_id,
      Question: questionTexts[r.question_id] || r.question_id,
      Answer: r.answer
    }));
    downloadCSV(data, 'posttest_responses');
  };

  const exportOpenFeedbackCSV = () => {
    const data = openFeedbackData.map(r => ({
      SessionID: r.session_id,
      QuestionID: r.question_id,
      Question: questionTexts[r.question_id] || r.question_id,
      Answer: r.answer
    }));
    downloadCSV(data, 'open_feedback');
  };

  const exportAllData = async () => {
    try {
      let sessionQuery = supabase.from('study_sessions').select('*');
      if (startDate) {
        sessionQuery = sessionQuery.gte('created_at', startOfDay(startDate).toISOString());
      }
      if (endDate) {
        sessionQuery = sessionQuery.lte('created_at', endOfDay(endDate).toISOString());
      }
      // Apply status filter
      if (statusFilter === 'completed') {
        sessionQuery = sessionQuery.not('completed_at', 'is', null);
      } else if (statusFilter === 'incomplete') {
        sessionQuery = sessionQuery.is('completed_at', null);
      }
      
      const { data: sessions } = await sessionQuery;
      const sessionIds = sessions?.map(s => s.id) || [];

      let demographicsQuery = supabase.from('demographic_responses').select('*');
      let preTestQuery = supabase.from('pre_test_responses').select('*');
      let postTestQuery = supabase.from('post_test_responses').select('*');
      let scenariosQuery = supabase.from('scenarios').select('*');

      if (sessionIds.length > 0) {
        demographicsQuery = demographicsQuery.in('session_id', sessionIds);
        preTestQuery = preTestQuery.in('session_id', sessionIds);
        postTestQuery = postTestQuery.in('session_id', sessionIds);
        scenariosQuery = scenariosQuery.in('session_id', sessionIds);
      }

      const { data: demographics } = await demographicsQuery;
      const { data: preTest } = await preTestQuery;
      const { data: postTest } = await postTestQuery;
      const { data: scenarios } = await scenariosQuery;
      
      const scenarioIds = scenarios?.map(s => s.id) || [];
      let dialoguesQuery = supabase.from('dialogue_turns').select('*');
      if (scenarioIds.length > 0) {
        dialoguesQuery = dialoguesQuery.in('scenario_id', scenarioIds);
      }
      const { data: dialogues } = await dialoguesQuery;

      const exportData = {
        sessions,
        demographicResponses: demographics,
        preTestResponses: preTest,
        postTestResponses: postTest,
        scenarios,
        dialogueTurns: dialogues,
        filters: {
          dateRange: {
            start: startDate?.toISOString() || 'all',
            end: endDate?.toISOString() || 'all'
          },
          status: statusFilter,
          mode: modeFilter
        },
        exportedAt: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `study_export_${statusFilter}_${format(new Date(), 'yyyy-MM-dd')}.json`;
      a.click();
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  const getQuestionText = (questionId: string): string => {
    return questionTexts[questionId] || questionId;
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
      {/* Filters Card */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="pt-4 space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <DateRangeFilter
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onRefresh={fetchAllResponses}
              isRefreshing={isRefreshing}
              autoRefreshEnabled={autoRefresh}
              onAutoRefreshToggle={setAutoRefresh}
            />
            
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-slate-400" />
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="w-[160px] bg-slate-900 border-slate-600">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed Only</SelectItem>
                  <SelectItem value="incomplete">Incomplete Only</SelectItem>
                  <SelectItem value="all">All Sessions</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Mode Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <Select value={modeFilter} onValueChange={(v) => setModeFilter(v as ModeFilter)}>
                <SelectTrigger className="w-[160px] bg-slate-900 border-slate-600">
                  <SelectValue placeholder="Filter by mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modes</SelectItem>
                  <SelectItem value="text">Text Only</SelectItem>
                  <SelectItem value="avatar">Avatar Only</SelectItem>
                  <SelectItem value="both">Both Modes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Session counts & Export buttons */}
          <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-slate-700">
            <Badge variant="outline" className="text-green-400 border-green-700">
              <CheckCircle className="w-3 h-3 mr-1" /> {sessionCount.completed} completed
            </Badge>
            <Badge variant="outline" className="text-amber-400 border-amber-700">
              <XCircle className="w-3 h-3 mr-1" /> {sessionCount.incomplete} incomplete
            </Badge>
            <div className="ml-auto flex gap-2">
              <Button onClick={exportAllData} variant="outline" size="sm" className="border-slate-600 h-8 text-xs gap-1">
                <Download className="w-3 h-3" />
                Full JSON
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="demographics" className="space-y-6">
        <TabsList className="bg-slate-800 border border-slate-700">
          <TabsTrigger value="demographics">Demographics</TabsTrigger>
          <TabsTrigger value="pretest">Pre-test</TabsTrigger>
          <TabsTrigger value="posttest">Post-test</TabsTrigger>
          <TabsTrigger value="openfeedback" className="flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            Open Feedback
          </TabsTrigger>
        </TabsList>

        <TabsContent value="demographics" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-sm text-slate-400">Demographic responses ({rawResponses.demo.length} total)</h3>
            <Button onClick={exportDemographicsCSV} variant="ghost" size="sm" className="gap-1 text-slate-400 hover:text-white h-7 text-xs">
              <FileSpreadsheet className="w-3 h-3" /> Export CSV
            </Button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Object.entries(demographicsData).map(([questionId, responses]) => {
              const questionText = getQuestionText(questionId);
              const chartData = responses.map(r => ({ name: r.answer, value: r.count }));
              const totalResponses = responses.reduce((sum, r) => sum + r.count, 0);
              
              return (
                <Card key={questionId} className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white text-sm">{questionText}</CardTitle>
                    <CardDescription className="text-slate-400">{totalResponses} responses</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            outerRadius={60}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, percent }) => `${name.length > 15 ? name.slice(0, 15) + '...' : name} (${(percent * 100).toFixed(0)}%)`}
                          >
                            {chartData.map((_, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-slate-500 text-center py-8">No data</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {Object.keys(demographicsData).length === 0 && (
            <p className="text-slate-500 text-center py-8">No demographic data</p>
          )}
        </TabsContent>

        <TabsContent value="pretest" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-sm text-slate-400">Pre-test responses ({rawResponses.pre.length} total)</h3>
            <Button onClick={exportPreTestCSV} variant="ghost" size="sm" className="gap-1 text-slate-400 hover:text-white h-7 text-xs">
              <FileSpreadsheet className="w-3 h-3" /> Export CSV
            </Button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Object.entries(preTestData).map(([questionId, responses]) => {
              const questionText = getQuestionText(questionId);
              return (
                <Card key={questionId} className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white text-sm">{questionText}</CardTitle>
                    <CardDescription className="text-slate-400">{responses.reduce((sum, r) => sum + r.count, 0)} responses</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={150}>
                      <BarChart data={responses} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis type="number" stroke="#9ca3af" />
                        <YAxis 
                          dataKey="answer" 
                          type="category" 
                          stroke="#9ca3af" 
                          width={150}
                          fontSize={10}
                          tickFormatter={(value) => value.length > 25 ? value.slice(0, 25) + '...' : value}
                        />
                        <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                        <Bar dataKey="count" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {Object.keys(preTestData).length === 0 && (
            <p className="text-slate-500 text-center py-8">No pre-test data</p>
          )}
        </TabsContent>

        <TabsContent value="posttest" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-sm text-slate-400">Post-test responses ({rawResponses.post.length} total)</h3>
            <Button onClick={exportPostTestCSV} variant="ghost" size="sm" className="gap-1 text-slate-400 hover:text-white h-7 text-xs">
              <FileSpreadsheet className="w-3 h-3" /> Export CSV
            </Button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Object.entries(postTestData).map(([questionId, responses]) => {
              const questionText = getQuestionText(questionId);
              return (
                <Card key={questionId} className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white text-sm">{questionText}</CardTitle>
                    <CardDescription className="text-slate-400">{responses.reduce((sum, r) => sum + r.count, 0)} responses</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={150}>
                      <BarChart data={responses} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis type="number" stroke="#9ca3af" />
                        <YAxis 
                          dataKey="answer" 
                          type="category" 
                          stroke="#9ca3af" 
                          width={150}
                          fontSize={10}
                          tickFormatter={(value) => value.length > 25 ? value.slice(0, 25) + '...' : value}
                        />
                        <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                        <Bar dataKey="count" fill="#10b981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {Object.keys(postTestData).length === 0 && (
            <p className="text-slate-500 text-center py-8">No post-test data</p>
          )}
        </TabsContent>

        <TabsContent value="openfeedback" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-sm text-slate-400">Open feedback ({openFeedbackData.length} total)</h3>
            <Button onClick={exportOpenFeedbackCSV} variant="ghost" size="sm" className="gap-1 text-slate-400 hover:text-white h-7 text-xs">
              <FileSpreadsheet className="w-3 h-3" /> Export CSV
            </Button>
          </div>
          {['open_liked', 'open_frustrating', 'open_improvement'].map(questionId => {
            const questionText = getQuestionText(questionId);
            const questionResponses = openFeedbackData.filter(r => r.question_id === questionId);
            
            return (
              <Card key={questionId} className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-purple-400" />
                    <CardTitle className="text-white text-sm">{questionText}</CardTitle>
                  </div>
                  <CardDescription className="text-slate-400">{questionResponses.length} responses</CardDescription>
                </CardHeader>
                <CardContent>
                  {questionResponses.length > 0 ? (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {questionResponses.map((response, idx) => (
                        <div key={idx} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                          <p className="text-slate-300 text-sm whitespace-pre-wrap">{response.answer}</p>
                          <p className="text-slate-500 text-xs mt-1">Session: {response.session_id.slice(0, 8)}...</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-center py-4">No responses yet</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {openFeedbackData.length === 0 && (
            <p className="text-slate-500 text-center py-8">No open feedback data</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminResponses;
