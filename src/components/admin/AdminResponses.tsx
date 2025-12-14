import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Filter, MessageSquare, FileSpreadsheet, CheckCircle, XCircle, Award, Brain, ThumbsUp, Users, ClipboardList } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, ReferenceLine } from "recharts";
import DateRangeFilter from "./DateRangeFilter";
import { startOfDay, endOfDay, format } from "date-fns";
import { Badge } from "@/components/ui/badge";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
const CORRECT_COLOR = '#22c55e';
const INCORRECT_COLOR = '#64748b';

interface ResponseData {
  question_id: string;
  answer: string;
  count: number;
}

interface QuestionData {
  question_id: string;
  question_text: string;
  correct_answer: string | null;
  question_type: string;
  category: string | null;
}

type ModeFilter = 'all' | 'text' | 'avatar' | 'both';
type StatusFilter = 'all' | 'completed' | 'incomplete' | 'reset';

import { getPermissions } from "@/lib/permissions";

interface AdminResponsesProps {
  userEmail?: string;
}

const AdminResponses = ({ userEmail = '' }: AdminResponsesProps) => {
  const permissions = getPermissions(userEmail);
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
  const [questionData, setQuestionData] = useState<Record<string, QuestionData>>({});
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('completed');

  const fetchQuestionData = async () => {
    try {
      // Only fetch ACTIVE questions - hidden/disabled questions should not appear in stats
      const { data } = await supabase
        .from('study_questions')
        .select('question_id, question_text, correct_answer, question_type, category, is_active')
        .eq('is_active', true);
      
      const questions: Record<string, QuestionData> = {};
      data?.forEach(q => {
        questions[q.question_id] = {
          question_id: q.question_id,
          question_text: q.question_text,
          correct_answer: q.correct_answer,
          question_type: q.question_type,
          category: q.category
        };
      });
      setQuestionData(questions);
    } catch (error) {
      console.error('Error fetching question data:', error);
    }
  };

  const fetchAllResponses = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // First get session IDs that match the date filter, mode filter, and status filter
      let sessionQuery = supabase.from('study_sessions').select('id, mode, modes_used, completed_at, created_at, status, suspicion_score, validation_status');
      if (startDate) {
        sessionQuery = sessionQuery.gte('created_at', startOfDay(startDate).toISOString());
      }
      if (endDate) {
        sessionQuery = sessionQuery.lte('created_at', endOfDay(endDate).toISOString());
      }
      const { data: sessions } = await sessionQuery;
      
      // IMPORTANT: Filter out reset sessions, ignored sessions, and unvalidated suspicious sessions from main statistics
      // Suspicious sessions (suspicion_score > 0) must be explicitly ACCEPTED to be included
      const validSessions = sessions?.filter(s => {
        // Exclude reset sessions
        if (s.status === 'reset') return false;
        // Exclude ignored sessions
        if (s.validation_status === 'ignored') return false;
        // For suspicious sessions (flagged), only include if explicitly accepted
        if ((s.suspicion_score || 0) > 0 && s.validation_status !== 'accepted') return false;
        return true;
      }) || [];
      const resetSessions = sessions?.filter(s => s.status === 'reset') || [];
      
      // Count sessions by status (only valid sessions)
      const completedCount = validSessions.filter(s => s.completed_at).length;
      const incompleteCount = validSessions.filter(s => !s.completed_at).length;
      const resetCount = resetSessions.length;
      setSessionCount({ total: validSessions.length, completed: completedCount, incomplete: incompleteCount });
      
      // Filter sessions by status
      let filteredSessions = validSessions;
      if (statusFilter === 'completed') {
        filteredSessions = validSessions.filter(s => s.completed_at);
      } else if (statusFilter === 'incomplete') {
        filteredSessions = validSessions.filter(s => !s.completed_at);
      } else if (statusFilter === 'reset') {
        filteredSessions = resetSessions;
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
        setIsLoading(false);
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
    fetchQuestionData();
  }, []);

  useEffect(() => {
    fetchAllResponses();
  }, [fetchAllResponses]);

  // Real-time subscription for responses
  useEffect(() => {
    const channel = supabase
      .channel('responses-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'study_sessions' }, () => fetchAllResponses())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'demographic_responses' }, () => fetchAllResponses())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pre_test_responses' }, () => fetchAllResponses())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_test_responses' }, () => fetchAllResponses())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'study_questions' }, () => fetchQuestionData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAllResponses]);

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
    // Only export responses for ACTIVE questions
    const activeQuestionIds = Object.keys(questionData);
    const filteredData = rawResponses.demo.filter(r => activeQuestionIds.includes(r.question_id));
    
    const data = filteredData.map(r => ({
      SessionID: r.session_id,
      QuestionID: r.question_id,
      Question: questionData[r.question_id]?.question_text || r.question_id,
      Answer: r.answer
    }));
    downloadCSV(data, 'demographics_responses');
  };

  const exportPreTestCSV = () => {
    // Only export responses for ACTIVE questions
    const activeQuestionIds = Object.keys(questionData);
    const filteredData = rawResponses.pre.filter(r => activeQuestionIds.includes(r.question_id));
    
    const data = filteredData.map(r => ({
      SessionID: r.session_id,
      QuestionID: r.question_id,
      Question: questionData[r.question_id]?.question_text || r.question_id,
      Answer: r.answer,
      CorrectAnswer: questionData[r.question_id]?.correct_answer || '',
      IsCorrect: isAnswerCorrect(r.question_id, r.answer) ? 'Yes' : 'No'
    }));
    downloadCSV(data, 'pretest_responses');
  };

  const exportPostTestKnowledgeCSV = () => {
    // Only export responses for ACTIVE knowledge questions
    const activeQuestionIds = Object.keys(questionData);
    const knowledgeResponses = rawResponses.post.filter(r => {
      if (!activeQuestionIds.includes(r.question_id)) return false;
      return r.question_id.startsWith('knowledge-') || 
        (questionData[r.question_id]?.category === 'knowledge' && questionData[r.question_id]?.correct_answer);
    });
    const data = knowledgeResponses.map(r => ({
      SessionID: r.session_id,
      QuestionID: r.question_id,
      Question: questionData[r.question_id]?.question_text || r.question_id,
      Answer: r.answer,
      CorrectAnswer: questionData[r.question_id]?.correct_answer || '',
      IsCorrect: isAnswerCorrect(r.question_id, r.answer) ? 'Yes' : 'No'
    }));
    downloadCSV(data, 'posttest_knowledge_responses');
  };

  const exportPostTestPerceptionCSV = () => {
    // Only export responses for ACTIVE perception questions
    const activeQuestionIds = Object.keys(questionData);
    const perceptionCategories = ['expectations', 'avatar-qualities', 'realism', 'trust', 'engagement', 'satisfaction'];
    const perceptionResponses = rawResponses.post.filter(r => {
      if (!activeQuestionIds.includes(r.question_id)) return false;
      const category = questionData[r.question_id]?.category;
      return category && perceptionCategories.includes(category);
    });
    const data = perceptionResponses.map(r => ({
      SessionID: r.session_id,
      QuestionID: r.question_id,
      Category: questionData[r.question_id]?.category || '',
      Question: questionData[r.question_id]?.question_text || r.question_id,
      Answer: r.answer
    }));
    downloadCSV(data, 'posttest_perception_responses');
  };

  const exportOpenFeedbackCSV = () => {
    // Only export responses for ACTIVE open feedback questions
    const activeQuestionIds = Object.keys(questionData);
    const filteredData = openFeedbackData.filter(r => activeQuestionIds.includes(r.question_id));
    
    const data = filteredData.map(r => ({
      SessionID: r.session_id,
      QuestionID: r.question_id,
      Question: questionData[r.question_id]?.question_text || r.question_id,
      Answer: r.answer
    }));
    downloadCSV(data, 'open_feedback');
  };

  const exportAllData = async () => {
    try {
      // Get active questions to filter responses
      const activeQuestionIds = Object.keys(questionData);
      
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
      
      const { data: allSessions } = await sessionQuery;
      
      // IMPORTANT: Filter out reset, ignored, and unvalidated suspicious sessions from exports
      // Suspicious sessions (suspicion_score > 0) must be explicitly ACCEPTED to be included
      const sessions = allSessions?.filter(s => {
        // Exclude reset sessions (unless specifically filtering for them)
        if (statusFilter !== 'reset' && s.status === 'reset') return false;
        // Exclude ignored sessions
        if (s.validation_status === 'ignored') return false;
        // For suspicious sessions (flagged), only include if explicitly accepted
        if ((s.suspicion_score || 0) > 0 && s.validation_status !== 'accepted') return false;
        return true;
      }) || [];
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

      // Filter responses to only include active questions
      const filteredDemographics = demographics?.filter(r => activeQuestionIds.includes(r.question_id)) || [];
      const filteredPreTest = preTest?.filter(r => activeQuestionIds.includes(r.question_id)) || [];
      const filteredPostTest = postTest?.filter(r => activeQuestionIds.includes(r.question_id)) || [];

      const exportData = {
        sessions,
        demographicResponses: filteredDemographics,
        preTestResponses: filteredPreTest,
        postTestResponses: filteredPostTest,
        scenarios,
        dialogueTurns: dialogues,
        activeQuestions: Object.values(questionData), // Include active question definitions
        filters: {
          dateRange: {
            start: startDate?.toISOString() || 'all',
            end: endDate?.toISOString() || 'all'
          },
          status: statusFilter,
          mode: modeFilter,
          hiddenQuestionsExcluded: true
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
    return questionData[questionId]?.question_text || questionId;
  };

  const isAnswerCorrect = (questionId: string, answer: string): boolean => {
    const question = questionData[questionId];
    if (!question?.correct_answer) return false;
    
    const correctAnswers = question.correct_answer.split('|||').map(a => a.trim().toLowerCase());
    return correctAnswers.includes(answer.trim().toLowerCase());
  };

  const getCorrectPercentage = (questionId: string, responses: ResponseData[]): number => {
    const question = questionData[questionId];
    if (!question?.correct_answer) return 0;
    
    const total = responses.reduce((sum, r) => sum + r.count, 0);
    if (total === 0) return 0;
    
    const correctCount = responses.reduce((sum, r) => {
      if (isAnswerCorrect(questionId, r.answer)) {
        return sum + r.count;
      }
      return sum;
    }, 0);
    
    return Math.round((correctCount / total) * 100);
  };

  // Separate post-test questions by category
  const knowledgeQuestions = Object.entries(postTestData).filter(([qId]) => 
    questionData[qId]?.category === 'knowledge' || qId.startsWith('knowledge-')
  );
  
  const perceptionQuestions = Object.entries(postTestData).filter(([qId]) => {
    const category = questionData[qId]?.category;
    return category && ['expectations', 'avatar-qualities', 'realism', 'trust', 'engagement', 'satisfaction'].includes(category);
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const renderBarChartWithCorrectAnswer = (questionId: string, responses: ResponseData[], barColor: string) => {
    const correctAnswer = questionData[questionId]?.correct_answer;
    const correctAnswers = correctAnswer?.split('|||').map(a => a.trim().toLowerCase()) || [];
    const correctPct = getCorrectPercentage(questionId, responses);
    
    const chartData = responses.map(r => ({
      answer: r.answer,
      count: r.count,
      isCorrect: correctAnswers.includes(r.answer.trim().toLowerCase())
    }));

    return (
      <div className="space-y-2">
        {correctAnswer && (
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 text-green-400">
              <CheckCircle className="w-3 h-3" />
              <span>Correct: {correctPct}%</span>
            </div>
            <Badge variant="outline" className="text-green-400 border-green-600 text-[10px]">
              {correctAnswer.length > 40 ? correctAnswer.slice(0, 40) + '...' : correctAnswer}
            </Badge>
          </div>
        )}
        <ResponsiveContainer width="100%" height={Math.max(150, responses.length * 35)}>
          <BarChart data={chartData} layout="vertical">
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
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
              formatter={(value, name, props) => [
                `${value} responses${props.payload.isCorrect ? ' ✓ Correct' : ''}`,
                'Count'
              ]}
            />
            <Bar 
              dataKey="count" 
              fill={barColor}
              shape={(props: any) => {
                const { x, y, width, height, payload } = props;
                const fill = payload.isCorrect ? CORRECT_COLOR : INCORRECT_COLOR;
                return <rect x={x} y={y} width={width} height={height} fill={fill} rx={2} />;
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

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
            {permissions.canExportData && (
              <div className="ml-auto flex gap-2">
                <Button onClick={exportAllData} variant="outline" size="sm" className="border-slate-600 h-8 text-xs gap-1">
                  <Download className="w-3 h-3" />
                  Full JSON (Raw)
                </Button>
                <Button onClick={exportPostTestKnowledgeCSV} variant="outline" size="sm" className="border-slate-600 h-8 text-xs gap-1">
                  <FileSpreadsheet className="w-3 h-3" />
                  Knowledge CSV
                </Button>
                <Button onClick={exportPostTestPerceptionCSV} variant="outline" size="sm" className="border-slate-600 h-8 text-xs gap-1">
                  <FileSpreadsheet className="w-3 h-3" />
                  Perception CSV
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="demographics" className="space-y-6">
        <TabsList className="bg-slate-800 border border-slate-700">
          <TabsTrigger value="demographics" className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            Demographics
          </TabsTrigger>
          <TabsTrigger value="pretest" className="flex items-center gap-1">
            <ClipboardList className="w-3 h-3" />
            Pre-test
          </TabsTrigger>
          <TabsTrigger value="posttest-knowledge" className="flex items-center gap-1">
            <Brain className="w-3 h-3" />
            Post-test (Knowledge)
          </TabsTrigger>
          <TabsTrigger value="posttest-perception" className="flex items-center gap-1">
            <ThumbsUp className="w-3 h-3" />
            Post-test (Perception)
          </TabsTrigger>
          <TabsTrigger value="openfeedback" className="flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            Open Feedback
          </TabsTrigger>
        </TabsList>

        <TabsContent value="demographics" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-sm text-slate-400">Demographic responses ({sessionCount.completed} completed participants)</h3>
            {permissions.canExportData && (
              <Button onClick={exportDemographicsCSV} variant="ghost" size="sm" className="gap-1 text-slate-400 hover:text-white h-7 text-xs">
                <FileSpreadsheet className="w-3 h-3" /> Export CSV
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Object.entries(demographicsData).map(([questionId, responses]) => {
              const questionText = getQuestionText(questionId);
              
              // Group age responses into 10-year ranges for demo-age question
              let chartData: { name: string; value: number }[];
              if (questionId === 'demo-age') {
                const ageGroups: Record<string, number> = {};
                const AGE_ORDER = ['18-24', '25-34', '35-44', '45-54', '55-64', '65-69', '70+', 'Prefer not to say'];
                
                responses.forEach(r => {
                  const age = r.answer;
                  if (age) {
                    if (age.toLowerCase().includes('prefer') || age === 'Prefer not to say') {
                      ageGroups['Prefer not to say'] = (ageGroups['Prefer not to say'] || 0) + r.count;
                    } else {
                      const ageNum = parseInt(age, 10);
                      let ageRange = age;
                      if (!isNaN(ageNum)) {
                        if (ageNum < 18) ageRange = 'Under 18';
                        else if (ageNum <= 24) ageRange = '18-24';
                        else if (ageNum <= 34) ageRange = '25-34';
                        else if (ageNum <= 44) ageRange = '35-44';
                        else if (ageNum <= 54) ageRange = '45-54';
                        else if (ageNum <= 64) ageRange = '55-64';
                        else if (ageNum <= 69) ageRange = '65-69';
                        else ageRange = '70+';
                      }
                      ageGroups[ageRange] = (ageGroups[ageRange] || 0) + r.count;
                    }
                  }
                });
                
                // Sort by AGE_ORDER
                chartData = AGE_ORDER
                  .filter(range => ageGroups[range] > 0)
                  .map(range => ({ name: range, value: ageGroups[range] }));
              } else {
                chartData = responses.map(r => ({ name: r.answer, value: r.count }));
              }
              
              const totalResponses = chartData.reduce((sum, r) => sum + r.value, 0);
              
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
            <h3 className="text-sm text-slate-400">Pre-test responses ({sessionCount.completed} completed participants)</h3>
            {permissions.canExportData && (
              <Button onClick={exportPreTestCSV} variant="ghost" size="sm" className="gap-1 text-slate-400 hover:text-white h-7 text-xs">
                <FileSpreadsheet className="w-3 h-3" /> Export CSV
              </Button>
            )}
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
                    {renderBarChartWithCorrectAnswer(questionId, responses, '#3b82f6')}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {Object.keys(preTestData).length === 0 && (
            <p className="text-slate-500 text-center py-8">No pre-test data</p>
          )}
        </TabsContent>

        <TabsContent value="posttest-knowledge" className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm text-slate-400">Knowledge Check Questions ({sessionCount.completed} completed participants)</h3>
            </div>
            {permissions.canExportData && (
              <Button onClick={exportPostTestKnowledgeCSV} variant="ghost" size="sm" className="gap-1 text-slate-400 hover:text-white h-7 text-xs">
                <FileSpreadsheet className="w-3 h-3" /> Export CSV
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {knowledgeQuestions.map(([questionId, responses]) => {
              const questionText = getQuestionText(questionId);
              return (
                <Card key={questionId} className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-purple-400" />
                      <CardTitle className="text-white text-sm">{questionText}</CardTitle>
                    </div>
                    <CardDescription className="text-slate-400">{responses.reduce((sum, r) => sum + r.count, 0)} responses</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {renderBarChartWithCorrectAnswer(questionId, responses, '#10b981')}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {knowledgeQuestions.length === 0 && (
            <p className="text-slate-500 text-center py-8">No knowledge check questions</p>
          )}
        </TabsContent>

        <TabsContent value="posttest-perception" className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <ThumbsUp className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm text-slate-400">Perception & Experience Questions ({sessionCount.completed} completed participants)</h3>
            </div>
            {permissions.canExportData && (
              <Button onClick={exportPostTestPerceptionCSV} variant="ghost" size="sm" className="gap-1 text-slate-400 hover:text-white h-7 text-xs">
                <FileSpreadsheet className="w-3 h-3" /> Export CSV
              </Button>
            )}
          </div>
          
          {/* Group by category */}
          {['expectations', 'avatar-qualities', 'realism', 'trust', 'engagement', 'satisfaction'].map(category => {
            const categoryQuestions = perceptionQuestions.filter(([qId]) => 
              questionData[qId]?.category === category
            );
            
            if (categoryQuestions.length === 0) return null;
            
            const categoryLabel = category.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            
            return (
              <div key={category} className="space-y-4">
                <h4 className="text-sm font-medium text-slate-300 border-b border-slate-700 pb-2 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  {categoryLabel}
                </h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {categoryQuestions.map(([questionId, responses]) => {
                    const questionText = getQuestionText(questionId);
                    return (
                      <Card key={questionId} className="bg-slate-800 border-slate-700">
                        <CardHeader>
                          <CardTitle className="text-white text-sm">{questionText}</CardTitle>
                          <CardDescription className="text-slate-400">{responses.reduce((sum, r) => sum + r.count, 0)} responses</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={Math.max(150, responses.length * 35)}>
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
              </div>
            );
          })}
          
          {perceptionQuestions.length === 0 && (
            <p className="text-slate-500 text-center py-8">No perception questions</p>
          )}
        </TabsContent>

        <TabsContent value="openfeedback" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-sm text-slate-400">Open feedback ({sessionCount.completed} completed participants)</h3>
            {permissions.canExportData && (
              <Button onClick={exportOpenFeedbackCSV} variant="ghost" size="sm" className="gap-1 text-slate-400 hover:text-white h-7 text-xs">
                <FileSpreadsheet className="w-3 h-3" /> Export CSV
              </Button>
            )}
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
