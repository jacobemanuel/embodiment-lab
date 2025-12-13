import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle, Clock, Download, Timer, BarChart3, TrendingUp, ArrowUp, ArrowDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import DateRangeFilter from "./DateRangeFilter";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
import { Button } from "@/components/ui/button";

interface AvatarTimeData {
  session_id: string;
  slide_id: string;
  slide_title: string;
  duration_seconds: number;
  started_at: string;
}

interface KnowledgeGainData {
  sessionId: string;
  mode: string;
  preScore: number;
  postScore: number;
  gain: number;
  preCorrect: number;
  preTotal: number;
  postCorrect: number;
  postTotal: number;
}

interface QuestionAnalysis {
  questionId: string;
  questionText: string;
  preCorrectRate: number;
  postCorrectRate: number;
  improvement: number;
}

interface StudyStats {
  totalCompleted: number;
  textModeCompleted: number;
  avatarModeCompleted: number;
  bothModesCompleted: number;
  avgSessionDuration: number;
  avgAvatarTime: number;
  totalAvatarTime: number;
  sessionsPerDay: { date: string; count: number }[];
  demographicBreakdown: { name: string; value: number }[];
  modeComparison: { name: string; count: number }[];
  avatarTimeBySlide: { slide: string; avgTime: number; totalTime: number }[];
  avatarTimeData: AvatarTimeData[];
  knowledgeGain: KnowledgeGainData[];
  avgPreScore: number;
  avgPostScore: number;
  avgGain: number;
  textModeGain: number;
  avatarModeGain: number;
  questionAnalysis: QuestionAnalysis[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const AdminOverview = () => {
  const [stats, setStats] = useState<StudyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Fetch ONLY completed sessions
      let query = supabase
        .from('study_sessions')
        .select('*')
        .not('completed_at', 'is', null)
        .order('created_at', { ascending: false });

      if (startDate) {
        query = query.gte('completed_at', startOfDay(startDate).toISOString());
      }
      if (endDate) {
        query = query.lte('completed_at', endOfDay(endDate).toISOString());
      }

      const { data: sessions, error: sessionsError } = await query;
      if (sessionsError) throw sessionsError;

      // Fetch demographics for completed sessions
      const sessionIds = sessions?.map(s => s.id) || [];
      let demographics: any[] = [];
      if (sessionIds.length > 0) {
        const { data: demoData } = await supabase
          .from('demographics')
          .select('*')
          .in('session_id', sessionIds);
        demographics = demoData || [];
      }

      // Fetch avatar time tracking
      let avatarTimeQuery = supabase
        .from('avatar_time_tracking')
        .select('*');
      
      if (sessionIds.length > 0) {
        avatarTimeQuery = avatarTimeQuery.in('session_id', sessionIds);
      }
      
      const { data: avatarTimeData } = await avatarTimeQuery;

      // Calculate stats - ONLY from completed sessions
      const totalCompleted = sessions?.length || 0;
      
      const textModeCompleted = sessions?.filter(s => 
        (s.modes_used?.length === 1 && s.modes_used.includes('text')) ||
        (!s.modes_used && s.mode === 'text')
      ).length || 0;
      
      const avatarModeCompleted = sessions?.filter(s => 
        (s.modes_used?.length === 1 && s.modes_used.includes('avatar')) ||
        (!s.modes_used && s.mode === 'avatar')
      ).length || 0;
      
      const bothModesCompleted = sessions?.filter(s => 
        s.modes_used?.includes('text') && s.modes_used?.includes('avatar')
      ).length || 0;

      // Average session duration
      const completedWithDuration = sessions?.filter(s => s.completed_at && s.started_at) || [];
      let avgDuration = 0;
      if (completedWithDuration.length > 0) {
        const totalDuration = completedWithDuration.reduce((sum, s) => {
          const start = new Date(s.started_at).getTime();
          const end = new Date(s.completed_at!).getTime();
          return sum + (end - start);
        }, 0);
        avgDuration = Math.round(totalDuration / completedWithDuration.length / 1000 / 60);
      }

      // Avatar time stats
      const totalAvatarTime = avatarTimeData?.reduce((sum, t) => sum + (t.duration_seconds || 0), 0) || 0;
      const avatarSessions = new Set(avatarTimeData?.map(t => t.session_id) || []);
      const avgAvatarTime = avatarSessions.size > 0 ? Math.round(totalAvatarTime / avatarSessions.size) : 0;

      // Avatar time by slide
      const slideTimeMap: Record<string, { total: number; count: number; title: string }> = {};
      avatarTimeData?.forEach(t => {
        if (!slideTimeMap[t.slide_id]) {
          slideTimeMap[t.slide_id] = { total: 0, count: 0, title: t.slide_title };
        }
        slideTimeMap[t.slide_id].total += t.duration_seconds || 0;
        slideTimeMap[t.slide_id].count += 1;
      });

      const avatarTimeBySlide = Object.entries(slideTimeMap).map(([slideId, data]) => ({
        slide: data.title || slideId,
        avgTime: Math.round(data.total / data.count),
        totalTime: data.total,
      }));

      // Sessions per day (completed only)
      const sessionsByDay: Record<string, number> = {};
      sessions?.forEach(s => {
        const dateStr = s.completed_at?.split('T')[0] || s.created_at.split('T')[0];
        sessionsByDay[dateStr] = (sessionsByDay[dateStr] || 0) + 1;
      });

      const sortedDates = Object.keys(sessionsByDay).sort();
      const sessionsPerDay = sortedDates.map(date => ({
        date: format(parseISO(date), 'MM-dd'),
        count: sessionsByDay[date]
      }));

      // Age breakdown
      const ageBreakdown: Record<string, number> = {};
      demographics.forEach(d => {
        if (d.age_range) {
          ageBreakdown[d.age_range] = (ageBreakdown[d.age_range] || 0) + 1;
        }
      });

      // Mode comparison (completed only)
      const modeComparison = [
        { name: 'Text Only', count: textModeCompleted },
        { name: 'Avatar Only', count: avatarModeCompleted },
        { name: 'Both Modes', count: bothModesCompleted },
      ];

      // Fetch questions with correct answers for scoring
      const { data: questionsData } = await supabase
        .from('study_questions')
        .select('question_id, question_text, correct_answer, question_type')
        .in('question_type', ['pre_test', 'post_test'])
        .eq('is_active', true);

      const questionMap = new Map(questionsData?.map(q => [q.question_id, q]) || []);

      // Fetch pre/post test responses for knowledge gain calculation
      let knowledgeGain: KnowledgeGainData[] = [];
      let questionAnalysis: QuestionAnalysis[] = [];
      let avgPreScore = 0;
      let avgPostScore = 0;
      let avgGain = 0;
      let textModeGain = 0;
      let avatarModeGain = 0;
      
      if (sessionIds.length > 0) {
        const { data: preTestResponses } = await supabase
          .from('pre_test_responses')
          .select('*')
          .in('session_id', sessionIds);
        
        const { data: postTestResponses } = await supabase
          .from('post_test_responses')
          .select('*')
          .in('session_id', sessionIds);

        // Calculate scores per session
        const sessionScores: Record<string, { preCorrect: number; preTotal: number; postCorrect: number; postTotal: number }> = {};
        
        // Process pre-test responses
        preTestResponses?.forEach(r => {
          if (!sessionScores[r.session_id]) {
            sessionScores[r.session_id] = { preCorrect: 0, preTotal: 0, postCorrect: 0, postTotal: 0 };
          }
          const question = questionMap.get(r.question_id);
          if (question?.correct_answer) {
            sessionScores[r.session_id].preTotal++;
            const correctAnswers = question.correct_answer.split('|||').map((a: string) => a.trim().toLowerCase());
            const userAnswers = r.answer.split('|||').map((a: string) => a.trim().toLowerCase());
            const isCorrect = correctAnswers.every((ca: string) => userAnswers.includes(ca)) && 
                             userAnswers.every((ua: string) => correctAnswers.includes(ua));
            if (isCorrect) {
              sessionScores[r.session_id].preCorrect++;
            }
          }
        });

        // Process post-test responses
        postTestResponses?.forEach(r => {
          if (!sessionScores[r.session_id]) {
            sessionScores[r.session_id] = { preCorrect: 0, preTotal: 0, postCorrect: 0, postTotal: 0 };
          }
          const question = questionMap.get(r.question_id);
          if (question?.correct_answer) {
            sessionScores[r.session_id].postTotal++;
            const correctAnswers = question.correct_answer.split('|||').map((a: string) => a.trim().toLowerCase());
            const userAnswers = r.answer.split('|||').map((a: string) => a.trim().toLowerCase());
            const isCorrect = correctAnswers.every((ca: string) => userAnswers.includes(ca)) && 
                             userAnswers.every((ua: string) => correctAnswers.includes(ua));
            if (isCorrect) {
              sessionScores[r.session_id].postCorrect++;
            }
          }
        });

        // Build knowledge gain array
        sessions?.forEach(s => {
          const scores = sessionScores[s.id];
          if (scores && scores.preTotal > 0 && scores.postTotal > 0) {
            const preScore = (scores.preCorrect / scores.preTotal) * 100;
            const postScore = (scores.postCorrect / scores.postTotal) * 100;
            const mode = s.modes_used?.includes('avatar') ? 'avatar' : s.mode;
            knowledgeGain.push({
              sessionId: s.session_id,
              mode,
              preScore: Math.round(preScore),
              postScore: Math.round(postScore),
              gain: Math.round(postScore - preScore),
              preCorrect: scores.preCorrect,
              preTotal: scores.preTotal,
              postCorrect: scores.postCorrect,
              postTotal: scores.postTotal,
            });
          }
        });

        // Calculate averages
        if (knowledgeGain.length > 0) {
          avgPreScore = Math.round(knowledgeGain.reduce((sum, k) => sum + k.preScore, 0) / knowledgeGain.length);
          avgPostScore = Math.round(knowledgeGain.reduce((sum, k) => sum + k.postScore, 0) / knowledgeGain.length);
          avgGain = Math.round(knowledgeGain.reduce((sum, k) => sum + k.gain, 0) / knowledgeGain.length);

          const textModeData = knowledgeGain.filter(k => k.mode === 'text');
          const avatarModeData = knowledgeGain.filter(k => k.mode === 'avatar');
          
          textModeGain = textModeData.length > 0 
            ? Math.round(textModeData.reduce((sum, k) => sum + k.gain, 0) / textModeData.length) 
            : 0;
          avatarModeGain = avatarModeData.length > 0 
            ? Math.round(avatarModeData.reduce((sum, k) => sum + k.gain, 0) / avatarModeData.length) 
            : 0;
        }

        // Question-level analysis
        const questionStats: Record<string, { preCorrect: number; preTotal: number; postCorrect: number; postTotal: number; text: string }> = {};
        
        preTestResponses?.forEach(r => {
          const question = questionMap.get(r.question_id);
          if (question?.correct_answer) {
            if (!questionStats[r.question_id]) {
              questionStats[r.question_id] = { preCorrect: 0, preTotal: 0, postCorrect: 0, postTotal: 0, text: question.question_text };
            }
            questionStats[r.question_id].preTotal++;
            const correctAnswers = question.correct_answer.split('|||').map((a: string) => a.trim().toLowerCase());
            const userAnswers = r.answer.split('|||').map((a: string) => a.trim().toLowerCase());
            const isCorrect = correctAnswers.every((ca: string) => userAnswers.includes(ca)) && 
                             userAnswers.every((ua: string) => correctAnswers.includes(ua));
            if (isCorrect) questionStats[r.question_id].preCorrect++;
          }
        });

        postTestResponses?.forEach(r => {
          const question = questionMap.get(r.question_id);
          if (question?.correct_answer) {
            if (!questionStats[r.question_id]) {
              questionStats[r.question_id] = { preCorrect: 0, preTotal: 0, postCorrect: 0, postTotal: 0, text: question.question_text };
            }
            questionStats[r.question_id].postTotal++;
            const correctAnswers = question.correct_answer.split('|||').map((a: string) => a.trim().toLowerCase());
            const userAnswers = r.answer.split('|||').map((a: string) => a.trim().toLowerCase());
            const isCorrect = correctAnswers.every((ca: string) => userAnswers.includes(ca)) && 
                             userAnswers.every((ua: string) => correctAnswers.includes(ua));
            if (isCorrect) questionStats[r.question_id].postCorrect++;
          }
        });

        questionAnalysis = Object.entries(questionStats)
          .filter(([_, stats]) => stats.preTotal > 0 || stats.postTotal > 0)
          .map(([questionId, stats]) => ({
            questionId,
            questionText: stats.text.length > 60 ? stats.text.substring(0, 60) + '...' : stats.text,
            preCorrectRate: stats.preTotal > 0 ? Math.round((stats.preCorrect / stats.preTotal) * 100) : 0,
            postCorrectRate: stats.postTotal > 0 ? Math.round((stats.postCorrect / stats.postTotal) * 100) : 0,
            improvement: stats.preTotal > 0 && stats.postTotal > 0 
              ? Math.round((stats.postCorrect / stats.postTotal) * 100) - Math.round((stats.preCorrect / stats.preTotal) * 100)
              : 0,
          }));
      }

      setStats({
        totalCompleted,
        textModeCompleted,
        avatarModeCompleted,
        bothModesCompleted,
        avgSessionDuration: avgDuration,
        avgAvatarTime,
        totalAvatarTime,
        sessionsPerDay,
        demographicBreakdown: Object.entries(ageBreakdown).map(([name, value]) => ({ name, value })),
        modeComparison,
        avatarTimeBySlide,
        avatarTimeData: avatarTimeData || [],
        knowledgeGain,
        avgPreScore,
        avgPostScore,
        avgGain,
        textModeGain,
        avatarModeGain,
        questionAnalysis,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => fetchStats(), 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchStats]);

  const exportAvatarTimeCSV = () => {
    if (!stats?.avatarTimeData.length) return;
    
    const headers = ['Session ID', 'Slide ID', 'Slide Title', 'Duration (seconds)', 'Started At'];
    const rows = stats.avatarTimeData.map(t => [
      t.session_id,
      t.slide_id,
      t.slide_title,
      t.duration_seconds.toString(),
      t.started_at,
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `avatar-time-tracking-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportKnowledgeGainCSV = () => {
    if (!stats?.knowledgeGain.length) return;
    
    const headers = ['Session ID', 'Mode', 'Pre-Test Score (%)', 'Post-Test Score (%)', 'Knowledge Gain (%)', 'Pre Correct', 'Pre Total', 'Post Correct', 'Post Total'];
    const rows = stats.knowledgeGain.map(k => [
      k.sessionId,
      k.mode,
      k.preScore.toString(),
      k.postScore.toString(),
      k.gain.toString(),
      k.preCorrect.toString(),
      k.preTotal.toString(),
      k.postCorrect.toString(),
      k.postTotal.toString(),
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `knowledge-gain-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!stats) {
    return <div className="text-slate-400">Error loading statistics</div>;
  }

  const modeComparisonData = [
    { name: 'Text Mode', gain: stats.textModeGain },
    { name: 'Avatar Mode', gain: stats.avatarModeGain },
  ];

  const prePostComparisonData = [
    { name: 'Pre-Test', score: stats.avgPreScore, fill: '#ef4444' },
    { name: 'Post-Test', score: stats.avgPostScore, fill: '#10b981' },
  ];

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onRefresh={fetchStats}
        isRefreshing={isRefreshing}
        autoRefreshEnabled={autoRefresh}
        onAutoRefreshToggle={setAutoRefresh}
      />

      {/* Info banner - completed only */}
      <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-3 text-sm text-blue-200">
        📊 Statistics show <strong>completed sessions only</strong> - participants who finished the entire study flow.
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Completed Sessions</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.totalCompleted}</div>
            <p className="text-xs text-slate-500 mt-1">fully completed studies</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Avg. Knowledge Gain</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white flex items-center gap-2">
              {stats.avgGain >= 0 ? '+' : ''}{stats.avgGain}%
              {stats.avgGain > 0 && <ArrowUp className="h-5 w-5 text-green-500" />}
              {stats.avgGain < 0 && <ArrowDown className="h-5 w-5 text-red-500" />}
            </div>
            <p className="text-xs text-slate-500 mt-1">post-test vs pre-test</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Avg. Session Time</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.avgSessionDuration} min</div>
            <p className="text-xs text-slate-500 mt-1">from start to completion</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Mode Distribution</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xs space-y-1">
              <div className="flex justify-between"><span className="text-blue-400">Text:</span><span className="text-white">{stats.textModeCompleted}</span></div>
              <div className="flex justify-between"><span className="text-green-400">Avatar:</span><span className="text-white">{stats.avatarModeCompleted}</span></div>
              <div className="flex justify-between"><span className="text-cyan-400">Both:</span><span className="text-white">{stats.bothModesCompleted}</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Knowledge Gain Section */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Knowledge Gain Analysis
            </CardTitle>
            <CardDescription className="text-slate-400">Pre-test vs Post-test score comparison</CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportKnowledgeGainCSV}
            disabled={!stats.knowledgeGain.length}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {stats.knowledgeGain.length > 0 ? (
            <div className="space-y-6">
              {/* Summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                  <div className="text-sm text-slate-400 mb-1">Avg. Pre-Test</div>
                  <div className="text-2xl font-bold text-red-400">{stats.avgPreScore}%</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                  <div className="text-sm text-slate-400 mb-1">Avg. Post-Test</div>
                  <div className="text-2xl font-bold text-green-400">{stats.avgPostScore}%</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                  <div className="text-sm text-slate-400 mb-1">Text Mode Gain</div>
                  <div className="text-2xl font-bold text-blue-400">{stats.textModeGain >= 0 ? '+' : ''}{stats.textModeGain}%</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                  <div className="text-sm text-slate-400 mb-1">Avatar Mode Gain</div>
                  <div className="text-2xl font-bold text-purple-400">{stats.avatarModeGain >= 0 ? '+' : ''}{stats.avatarModeGain}%</div>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-3">Pre-Test vs Post-Test Scores</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={prePostComparisonData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                      <YAxis stroke="#9ca3af" fontSize={12} domain={[0, 100]} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                        labelStyle={{ color: '#fff' }}
                        formatter={(value: number) => [`${value}%`, 'Score']}
                      />
                      <Bar dataKey="score" fill="#3b82f6">
                        {prePostComparisonData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-3">Knowledge Gain by Mode</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={modeComparisonData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                      <YAxis stroke="#9ca3af" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                        labelStyle={{ color: '#fff' }}
                        formatter={(value: number) => [`${value >= 0 ? '+' : ''}${value}%`, 'Knowledge Gain']}
                      />
                      <Bar dataKey="gain" name="Gain">
                        {modeComparisonData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#3b82f6' : '#8b5cf6'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Question-level analysis */}
              {stats.questionAnalysis.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-3">Question-Level Performance</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="text-left py-2 px-3 text-slate-400">Question</th>
                          <th className="text-center py-2 px-3 text-slate-400">Pre-Test %</th>
                          <th className="text-center py-2 px-3 text-slate-400">Post-Test %</th>
                          <th className="text-center py-2 px-3 text-slate-400">Improvement</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.questionAnalysis.map((q, i) => (
                          <tr key={q.questionId} className={i % 2 === 0 ? 'bg-slate-700/30' : ''}>
                            <td className="py-2 px-3 text-slate-300">{q.questionText}</td>
                            <td className="text-center py-2 px-3 text-red-400">{q.preCorrectRate}%</td>
                            <td className="text-center py-2 px-3 text-green-400">{q.postCorrectRate}%</td>
                            <td className="text-center py-2 px-3">
                              <span className={q.improvement >= 0 ? 'text-green-400' : 'text-red-400'}>
                                {q.improvement >= 0 ? '+' : ''}{q.improvement}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-slate-500">
              No knowledge gain data available yet (requires scored pre/post test questions)
            </div>
          )}
        </CardContent>
      </Card>

      {/* Avatar Time Tracking Section */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white">Avatar Interaction Time</CardTitle>
            <CardDescription className="text-slate-400">Time spent with avatar per slide (seconds)</CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportAvatarTimeCSV}
            disabled={!stats.avatarTimeData.length}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {stats.avatarTimeBySlide.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats.avatarTimeBySlide}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="slide" stroke="#9ca3af" fontSize={10} angle={-20} textAnchor="end" height={60} />
                <YAxis stroke="#9ca3af" fontSize={12} label={{ value: 'Avg seconds', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                  labelStyle={{ color: '#fff' }}
                  formatter={(value: number) => [`${value}s`, 'Avg Time']}
                />
                <Bar dataKey="avgTime" name="Avg Time" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-slate-500">
              No avatar interaction data available yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Completed Sessions Over Time</CardTitle>
            <CardDescription className="text-slate-400">Daily completed studies</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={stats.sessionsPerDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Mode Distribution</CardTitle>
            <CardDescription className="text-slate-400">Completed sessions by learning mode</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats.modeComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Bar dataKey="count" name="Completed" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Age Distribution</CardTitle>
            <CardDescription className="text-slate-400">Completed participants demographics</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.demographicBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={stats.demographicBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {stats.demographicBreakdown.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-slate-500">
                No demographic data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Summary</CardTitle>
            <CardDescription className="text-slate-400">Key metrics for completed participants only</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-slate-700">
              <span className="text-slate-400">Total completed</span>
              <span className="text-white font-semibold">{stats.totalCompleted}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-700">
              <span className="text-slate-400">Avg. pre-test score</span>
              <span className="text-red-400 font-semibold">{stats.avgPreScore}%</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-700">
              <span className="text-slate-400">Avg. post-test score</span>
              <span className="text-green-400 font-semibold">{stats.avgPostScore}%</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-700">
              <span className="text-slate-400">Avg. knowledge gain</span>
              <span className={`font-semibold ${stats.avgGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stats.avgGain >= 0 ? '+' : ''}{stats.avgGain}%
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-700">
              <span className="text-slate-400">Avg. learning time</span>
              <span className="text-yellow-400 font-semibold">{stats.avgSessionDuration} min</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-400">Avg. avatar interaction</span>
              <span className="text-purple-400 font-semibold">{Math.round(stats.avgAvatarTime / 60)} min</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminOverview;
