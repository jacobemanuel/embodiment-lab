import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle, Clock, Download, Timer, BarChart3, TrendingUp, ArrowUp, ArrowDown, FileSpreadsheet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, ScatterChart, Scatter, ZAxis } from "recharts";
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
  mode: 'text' | 'avatar' | 'both';
  preScore: number;
  postScore: number;
  gain: number;
  preCorrect: number;
  preTotal: number;
  postCorrect: number;
  postTotal: number;
  avatarTime: number;
}

interface QuestionAnalysis {
  questionId: string;
  questionText: string;
  questionType: string;
  correctRate: number;
  totalResponses: number;
}

interface CorrelationData {
  avatarTimeVsGain: { x: number; y: number; mode: string }[];
  sessionTimeVsGain: { x: number; y: number; mode: string }[];
}

interface StudyStats {
  totalCompleted: number;
  totalIncomplete: number;
  textModeCompleted: number;
  avatarModeCompleted: number;
  bothModesCompleted: number;
  avgSessionDuration: number;
  avgAvatarTime: number;
  totalAvatarTime: number;
  sessionsPerDay: { date: string; count: number }[];
  demographicBreakdown: { name: string; value: number }[];
  educationBreakdown: { name: string; value: number }[];
  experienceBreakdown: { name: string; value: number }[];
  modeComparison: { name: string; count: number }[];
  avatarTimeBySlide: { slide: string; avgTime: number; totalTime: number; count: number }[];
  avatarTimeData: AvatarTimeData[];
  knowledgeGain: KnowledgeGainData[];
  avgPreScore: number;
  avgPostScore: number;
  avgGain: number;
  textModeGain: number;
  avatarModeGain: number;
  bothModesGain: number;
  textModePreScore: number;
  textModePostScore: number;
  avatarModePreScore: number;
  avatarModePostScore: number;
  bothModesPreScore: number;
  bothModesPostScore: number;
  preTestQuestionAnalysis: QuestionAnalysis[];
  postTestQuestionAnalysis: QuestionAnalysis[];
  correlations: CorrelationData;
  rawSessions: any[];
  rawDemographics: any[];
  rawPreTest: any[];
  rawPostTest: any[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

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
      // Fetch ALL sessions first
      let sessionQuery = supabase
        .from('study_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (startDate) {
        sessionQuery = sessionQuery.gte('created_at', startOfDay(startDate).toISOString());
      }
      if (endDate) {
        sessionQuery = sessionQuery.lte('created_at', endOfDay(endDate).toISOString());
      }

      const { data: allSessions, error: sessionsError } = await sessionQuery;
      if (sessionsError) throw sessionsError;

      // Filter for completed sessions
      const completedSessions = allSessions?.filter(s => s.completed_at) || [];
      const incompleteSessions = allSessions?.filter(s => !s.completed_at) || [];
      
      const sessionIds = completedSessions.map(s => s.id);
      const allSessionIds = allSessions?.map(s => s.id) || [];

      // Fetch all related data for completed sessions
      let demographicResponses: any[] = [];
      let preTestResponses: any[] = [];
      let postTestResponses: any[] = [];
      let avatarTimeData: any[] = [];

      if (sessionIds.length > 0) {
        const [demoRes, preRes, postRes, avatarRes] = await Promise.all([
          supabase.from('demographic_responses').select('*').in('session_id', sessionIds),
          supabase.from('pre_test_responses').select('*').in('session_id', sessionIds),
          supabase.from('post_test_responses').select('*').in('session_id', sessionIds),
          supabase.from('avatar_time_tracking').select('*').in('session_id', sessionIds),
        ]);
        
        demographicResponses = demoRes.data || [];
        preTestResponses = preRes.data || [];
        postTestResponses = postRes.data || [];
        avatarTimeData = avatarRes.data || [];
      }

      // Fetch questions with correct answers
      const { data: questionsData } = await supabase
        .from('study_questions')
        .select('question_id, question_text, correct_answer, question_type')
        .eq('is_active', true);

      const questionMap = new Map(questionsData?.map(q => [q.question_id, q]) || []);

      // Calculate mode distribution
      const textModeCompleted = completedSessions.filter(s => 
        (s.modes_used?.length === 1 && s.modes_used.includes('text')) ||
        (!s.modes_used?.length && s.mode === 'text')
      ).length;
      
      const avatarModeCompleted = completedSessions.filter(s => 
        (s.modes_used?.length === 1 && s.modes_used.includes('avatar')) ||
        (!s.modes_used?.length && s.mode === 'avatar')
      ).length;
      
      const bothModesCompleted = completedSessions.filter(s => 
        s.modes_used?.includes('text') && s.modes_used?.includes('avatar')
      ).length;

      // Average session duration
      let avgDuration = 0;
      if (completedSessions.length > 0) {
        const totalDuration = completedSessions.reduce((sum, s) => {
          const start = new Date(s.started_at).getTime();
          const end = new Date(s.completed_at!).getTime();
          return sum + (end - start);
        }, 0);
        avgDuration = Math.round(totalDuration / completedSessions.length / 1000 / 60);
      }

      // Avatar time calculation - group by session
      const avatarTimeBySession: Record<string, number> = {};
      avatarTimeData.forEach(t => {
        if (!avatarTimeBySession[t.session_id]) {
          avatarTimeBySession[t.session_id] = 0;
        }
        avatarTimeBySession[t.session_id] += t.duration_seconds || 0;
      });
      
      const totalAvatarTime = Object.values(avatarTimeBySession).reduce((a, b) => a + b, 0);
      const avgAvatarTime = Object.keys(avatarTimeBySession).length > 0 
        ? Math.round(totalAvatarTime / Object.keys(avatarTimeBySession).length) 
        : 0;

      // Avatar time by slide
      const slideTimeMap: Record<string, { total: number; count: number; title: string }> = {};
      avatarTimeData.forEach(t => {
        const key = t.slide_id;
        if (!slideTimeMap[key]) {
          slideTimeMap[key] = { total: 0, count: 0, title: t.slide_title || t.slide_id };
        }
        slideTimeMap[key].total += t.duration_seconds || 0;
        slideTimeMap[key].count += 1;
      });

      const avatarTimeBySlide = Object.entries(slideTimeMap).map(([slideId, data]) => ({
        slide: data.title,
        avgTime: Math.round(data.total / data.count),
        totalTime: data.total,
        count: data.count,
      }));

      // Sessions per day
      const sessionsByDay: Record<string, number> = {};
      completedSessions.forEach(s => {
        const dateStr = s.completed_at?.split('T')[0] || s.created_at.split('T')[0];
        sessionsByDay[dateStr] = (sessionsByDay[dateStr] || 0) + 1;
      });
      const sessionsPerDay = Object.keys(sessionsByDay).sort().map(date => ({
        date: format(parseISO(date), 'MM-dd'),
        count: sessionsByDay[date]
      }));

      // Demographics breakdown - Age
      const ageBreakdown: Record<string, number> = {};
      demographicResponses
        .filter(r => r.question_id === 'demo-age')
        .forEach(r => {
          const age = r.answer;
          if (age && age !== 'Prefer not to say') {
            const ageNum = parseInt(age, 10);
            let ageRange = age;
            if (!isNaN(ageNum)) {
              if (ageNum < 18) ageRange = 'Under 18';
              else if (ageNum <= 24) ageRange = '18-24';
              else if (ageNum <= 34) ageRange = '25-34';
              else if (ageNum <= 44) ageRange = '35-44';
              else if (ageNum <= 54) ageRange = '45-54';
              else if (ageNum <= 64) ageRange = '55-64';
              else ageRange = '65+';
            }
            ageBreakdown[ageRange] = (ageBreakdown[ageRange] || 0) + 1;
          }
        });

      // Education breakdown
      const educationBreakdown: Record<string, number> = {};
      demographicResponses
        .filter(r => r.question_id === 'demo-education')
        .forEach(r => {
          if (r.answer && r.answer !== 'Prefer not to say') {
            educationBreakdown[r.answer] = (educationBreakdown[r.answer] || 0) + 1;
          }
        });

      // Digital experience breakdown
      const experienceBreakdown: Record<string, number> = {};
      demographicResponses
        .filter(r => r.question_id === 'demo-digital-experience')
        .forEach(r => {
          if (r.answer) {
            experienceBreakdown[r.answer] = (experienceBreakdown[r.answer] || 0) + 1;
          }
        });

      // Calculate scores per session - PRE-TEST scoring
      const sessionPreScores: Record<string, { correct: number; total: number }> = {};
      preTestResponses.forEach(r => {
        const question = questionMap.get(r.question_id);
        if (question?.correct_answer) {
          if (!sessionPreScores[r.session_id]) {
            sessionPreScores[r.session_id] = { correct: 0, total: 0 };
          }
          sessionPreScores[r.session_id].total++;
          
          const correctAnswers = question.correct_answer.split('|||').map((a: string) => a.trim().toLowerCase());
          const userAnswers = r.answer.split('|||').map((a: string) => a.trim().toLowerCase());
          
          // Check if user got all correct answers and only correct answers
          const allCorrect = correctAnswers.every((ca: string) => userAnswers.includes(ca));
          const noExtra = userAnswers.every((ua: string) => correctAnswers.includes(ua));
          
          if (allCorrect && noExtra) {
            sessionPreScores[r.session_id].correct++;
          }
        }
      });

      // POST-TEST scoring (knowledge questions)
      const sessionPostScores: Record<string, { correct: number; total: number }> = {};
      postTestResponses.forEach(r => {
        // Only score knowledge questions (knowledge-X)
        if (r.question_id.startsWith('knowledge-')) {
          const question = questionMap.get(r.question_id);
          if (question?.correct_answer) {
            if (!sessionPostScores[r.session_id]) {
              sessionPostScores[r.session_id] = { correct: 0, total: 0 };
            }
            sessionPostScores[r.session_id].total++;
            
            const correctAnswers = question.correct_answer.split('|||').map((a: string) => a.trim().toLowerCase());
            const userAnswers = r.answer.split('|||').map((a: string) => a.trim().toLowerCase());
            
            const allCorrect = correctAnswers.every((ca: string) => userAnswers.includes(ca));
            const noExtra = userAnswers.every((ua: string) => correctAnswers.includes(ua));
            
            if (allCorrect && noExtra) {
              sessionPostScores[r.session_id].correct++;
            }
          }
        }
      });

      // Build knowledge gain array
      const knowledgeGain: KnowledgeGainData[] = [];
      completedSessions.forEach(s => {
        const preScores = sessionPreScores[s.id];
        const postScores = sessionPostScores[s.id];
        
        if (preScores && preScores.total > 0 && postScores && postScores.total > 0) {
          const preScore = (preScores.correct / preScores.total) * 100;
          const postScore = (postScores.correct / postScores.total) * 100;
          
          let mode: 'text' | 'avatar' | 'both' = 'text';
          if (s.modes_used?.includes('text') && s.modes_used?.includes('avatar')) {
            mode = 'both';
          } else if ((s.modes_used?.length === 1 && s.modes_used.includes('avatar')) || (!s.modes_used?.length && s.mode === 'avatar')) {
            mode = 'avatar';
          }
          
          const avatarTime = avatarTimeBySession[s.id] || 0;
          
          knowledgeGain.push({
            sessionId: s.session_id,
            mode,
            preScore: Math.round(preScore),
            postScore: Math.round(postScore),
            gain: Math.round(postScore - preScore),
            preCorrect: preScores.correct,
            preTotal: preScores.total,
            postCorrect: postScores.correct,
            postTotal: postScores.total,
            avatarTime,
          });
        }
      });

      // Calculate averages
      let avgPreScore = 0, avgPostScore = 0, avgGain = 0;
      if (knowledgeGain.length > 0) {
        avgPreScore = Math.round(knowledgeGain.reduce((sum, k) => sum + k.preScore, 0) / knowledgeGain.length);
        avgPostScore = Math.round(knowledgeGain.reduce((sum, k) => sum + k.postScore, 0) / knowledgeGain.length);
        avgGain = Math.round(knowledgeGain.reduce((sum, k) => sum + k.gain, 0) / knowledgeGain.length);
      }

      // Per-mode averages
      const textModeData = knowledgeGain.filter(k => k.mode === 'text');
      const avatarModeData = knowledgeGain.filter(k => k.mode === 'avatar');
      const bothModesData = knowledgeGain.filter(k => k.mode === 'both');
      
      const calcAvg = (arr: KnowledgeGainData[], key: keyof KnowledgeGainData) => 
        arr.length > 0 ? Math.round(arr.reduce((sum, k) => sum + (k[key] as number), 0) / arr.length) : 0;

      // Pre-test question analysis
      const preTestQuestionStats: Record<string, { correct: number; total: number; text: string }> = {};
      preTestResponses.forEach(r => {
        const question = questionMap.get(r.question_id);
        if (question?.correct_answer) {
          if (!preTestQuestionStats[r.question_id]) {
            preTestQuestionStats[r.question_id] = { correct: 0, total: 0, text: question.question_text };
          }
          preTestQuestionStats[r.question_id].total++;
          
          const correctAnswers = question.correct_answer.split('|||').map((a: string) => a.trim().toLowerCase());
          const userAnswers = r.answer.split('|||').map((a: string) => a.trim().toLowerCase());
          const isCorrect = correctAnswers.every((ca: string) => userAnswers.includes(ca)) && 
                           userAnswers.every((ua: string) => correctAnswers.includes(ua));
          if (isCorrect) preTestQuestionStats[r.question_id].correct++;
        }
      });

      // Post-test question analysis (knowledge questions only)
      const postTestQuestionStats: Record<string, { correct: number; total: number; text: string }> = {};
      postTestResponses.forEach(r => {
        if (r.question_id.startsWith('knowledge-')) {
          const question = questionMap.get(r.question_id);
          if (question?.correct_answer) {
            if (!postTestQuestionStats[r.question_id]) {
              postTestQuestionStats[r.question_id] = { correct: 0, total: 0, text: question.question_text };
            }
            postTestQuestionStats[r.question_id].total++;
            
            const correctAnswers = question.correct_answer.split('|||').map((a: string) => a.trim().toLowerCase());
            const userAnswers = r.answer.split('|||').map((a: string) => a.trim().toLowerCase());
            const isCorrect = correctAnswers.every((ca: string) => userAnswers.includes(ca)) && 
                             userAnswers.every((ua: string) => correctAnswers.includes(ua));
            if (isCorrect) postTestQuestionStats[r.question_id].correct++;
          }
        }
      });

      const preTestQuestionAnalysis = Object.entries(preTestQuestionStats).map(([qId, stats]) => ({
        questionId: qId,
        questionText: stats.text.length > 60 ? stats.text.substring(0, 60) + '...' : stats.text,
        questionType: 'pre_test',
        correctRate: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
        totalResponses: stats.total,
      }));

      const postTestQuestionAnalysis = Object.entries(postTestQuestionStats).map(([qId, stats]) => ({
        questionId: qId,
        questionText: stats.text.length > 60 ? stats.text.substring(0, 60) + '...' : stats.text,
        questionType: 'post_test',
        correctRate: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
        totalResponses: stats.total,
      }));

      // Correlation data
      const correlations: CorrelationData = {
        avatarTimeVsGain: knowledgeGain.filter(k => k.avatarTime > 0).map(k => ({
          x: Math.round(k.avatarTime / 60), // minutes
          y: k.gain,
          mode: k.mode,
        })),
        sessionTimeVsGain: completedSessions.map(s => {
          const gain = knowledgeGain.find(k => k.sessionId === s.session_id);
          const duration = s.completed_at ? (new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()) / 1000 / 60 : 0;
          return {
            x: Math.round(duration),
            y: gain?.gain || 0,
            mode: gain?.mode || 'text',
          };
        }).filter(d => d.y !== 0),
      };

      setStats({
        totalCompleted: completedSessions.length,
        totalIncomplete: incompleteSessions.length,
        textModeCompleted,
        avatarModeCompleted,
        bothModesCompleted,
        avgSessionDuration: avgDuration,
        avgAvatarTime,
        totalAvatarTime,
        sessionsPerDay,
        demographicBreakdown: Object.entries(ageBreakdown).map(([name, value]) => ({ name, value })),
        educationBreakdown: Object.entries(educationBreakdown).map(([name, value]) => ({ name, value })),
        experienceBreakdown: Object.entries(experienceBreakdown).map(([name, value]) => ({ name, value })),
        modeComparison: [
          { name: 'Text Only', count: textModeCompleted },
          { name: 'Avatar Only', count: avatarModeCompleted },
          { name: 'Both Modes', count: bothModesCompleted },
        ],
        avatarTimeBySlide,
        avatarTimeData,
        knowledgeGain,
        avgPreScore,
        avgPostScore,
        avgGain,
        textModeGain: calcAvg(textModeData, 'gain'),
        avatarModeGain: calcAvg(avatarModeData, 'gain'),
        bothModesGain: calcAvg(bothModesData, 'gain'),
        textModePreScore: calcAvg(textModeData, 'preScore'),
        textModePostScore: calcAvg(textModeData, 'postScore'),
        avatarModePreScore: calcAvg(avatarModeData, 'preScore'),
        avatarModePostScore: calcAvg(avatarModeData, 'postScore'),
        bothModesPreScore: calcAvg(bothModesData, 'preScore'),
        bothModesPostScore: calcAvg(bothModesData, 'postScore'),
        preTestQuestionAnalysis,
        postTestQuestionAnalysis,
        correlations,
        rawSessions: completedSessions,
        rawDemographics: demographicResponses,
        rawPreTest: preTestResponses,
        rawPostTest: postTestResponses,
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
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchStats]);

  // Comprehensive CSV export
  const exportComprehensiveCSV = async () => {
    if (!stats) return;

    // Fetch ALL data for export including question texts
    const { data: questions } = await supabase
      .from('study_questions')
      .select('question_id, question_text, correct_answer, question_type')
      .eq('is_active', true);
    
    const questionTextMap: Record<string, string> = {};
    questions?.forEach(q => {
      questionTextMap[q.question_id] = q.question_text;
    });

    // Create comprehensive CSV with multiple sheets worth of data
    let csv = '';
    
    // Sheet 1: Summary Statistics
    csv += '=== SUMMARY STATISTICS ===\n';
    csv += 'Metric,Value\n';
    csv += `Total Completed Sessions,${stats.totalCompleted}\n`;
    csv += `Total Incomplete Sessions,${stats.totalIncomplete}\n`;
    csv += `Text Mode Only,${stats.textModeCompleted}\n`;
    csv += `Avatar Mode Only,${stats.avatarModeCompleted}\n`;
    csv += `Both Modes,${stats.bothModesCompleted}\n`;
    csv += `Average Session Duration (min),${stats.avgSessionDuration}\n`;
    csv += `Average Avatar Interaction Time (sec),${stats.avgAvatarTime}\n`;
    csv += `Average Pre-Test Score (%),${stats.avgPreScore}\n`;
    csv += `Average Post-Test Score (%),${stats.avgPostScore}\n`;
    csv += `Average Knowledge Gain (%),${stats.avgGain}\n`;
    csv += `Text Mode Pre-Test (%),${stats.textModePreScore}\n`;
    csv += `Text Mode Post-Test (%),${stats.textModePostScore}\n`;
    csv += `Text Mode Gain (%),${stats.textModeGain}\n`;
    csv += `Avatar Mode Pre-Test (%),${stats.avatarModePreScore}\n`;
    csv += `Avatar Mode Post-Test (%),${stats.avatarModePostScore}\n`;
    csv += `Avatar Mode Gain (%),${stats.avatarModeGain}\n`;
    csv += `Both Modes Pre-Test (%),${stats.bothModesPreScore}\n`;
    csv += `Both Modes Post-Test (%),${stats.bothModesPostScore}\n`;
    csv += `Both Modes Gain (%),${stats.bothModesGain}\n`;
    csv += '\n';

    // Sheet 2: Session Details
    csv += '=== SESSION DETAILS ===\n';
    csv += 'Session ID,Mode,Modes Used,Started At,Completed At,Duration (min),Pre-Test Score (%),Post-Test Score (%),Knowledge Gain (%),Avatar Time (sec)\n';
    stats.rawSessions.forEach(s => {
      const kg = stats.knowledgeGain.find(k => k.sessionId === s.session_id);
      const duration = s.completed_at ? Math.round((new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()) / 1000 / 60) : 0;
      csv += `${s.session_id},${s.mode},"${(s.modes_used || []).join(', ')}",${s.started_at},${s.completed_at || ''},${duration},${kg?.preScore || ''},${kg?.postScore || ''},${kg?.gain || ''},${kg?.avatarTime || 0}\n`;
    });
    csv += '\n';

    // Sheet 3: Demographic Responses
    csv += '=== DEMOGRAPHIC RESPONSES ===\n';
    csv += 'Session ID,Question ID,Question Text,Answer\n';
    stats.rawDemographics.forEach(r => {
      const qText = questionTextMap[r.question_id] || r.question_id;
      csv += `${r.session_id},${r.question_id},"${qText.replace(/"/g, '""')}","${r.answer.replace(/"/g, '""')}"\n`;
    });
    csv += '\n';

    // Sheet 4: Pre-Test Responses
    csv += '=== PRE-TEST RESPONSES ===\n';
    csv += 'Session ID,Question ID,Question Text,Answer,Is Correct\n';
    const { data: preQuestions } = await supabase
      .from('study_questions')
      .select('question_id, question_text, correct_answer')
      .eq('question_type', 'pre_test')
      .eq('is_active', true);
    const preCorrectMap: Record<string, string> = {};
    preQuestions?.forEach(q => {
      preCorrectMap[q.question_id] = q.correct_answer || '';
    });
    
    stats.rawPreTest.forEach(r => {
      const qText = questionTextMap[r.question_id] || r.question_id;
      const correct = preCorrectMap[r.question_id];
      let isCorrect = 'N/A';
      if (correct) {
        const correctAnswers = correct.split('|||').map((a: string) => a.trim().toLowerCase());
        const userAnswers = r.answer.split('|||').map((a: string) => a.trim().toLowerCase());
        isCorrect = (correctAnswers.every((ca: string) => userAnswers.includes(ca)) && 
                    userAnswers.every((ua: string) => correctAnswers.includes(ua))) ? 'Yes' : 'No';
      }
      csv += `${r.session_id},${r.question_id},"${qText.replace(/"/g, '""')}","${r.answer.replace(/"/g, '""')}",${isCorrect}\n`;
    });
    csv += '\n';

    // Sheet 5: Post-Test Responses
    csv += '=== POST-TEST RESPONSES ===\n';
    csv += 'Session ID,Question ID,Question Text,Answer,Is Correct\n';
    const { data: postQuestions } = await supabase
      .from('study_questions')
      .select('question_id, question_text, correct_answer')
      .eq('question_type', 'post_test')
      .eq('is_active', true);
    const postCorrectMap: Record<string, string> = {};
    postQuestions?.forEach(q => {
      postCorrectMap[q.question_id] = q.correct_answer || '';
    });
    
    stats.rawPostTest.forEach(r => {
      const qText = questionTextMap[r.question_id] || r.question_id;
      const correct = postCorrectMap[r.question_id];
      let isCorrect = 'N/A';
      if (correct) {
        const correctAnswers = correct.split('|||').map((a: string) => a.trim().toLowerCase());
        const userAnswers = r.answer.split('|||').map((a: string) => a.trim().toLowerCase());
        isCorrect = (correctAnswers.every((ca: string) => userAnswers.includes(ca)) && 
                    userAnswers.every((ua: string) => correctAnswers.includes(ua))) ? 'Yes' : 'No';
      }
      csv += `${r.session_id},${r.question_id},"${qText.replace(/"/g, '""')}","${r.answer.replace(/"/g, '""')}",${isCorrect}\n`;
    });
    csv += '\n';

    // Sheet 6: Avatar Time Tracking
    csv += '=== AVATAR TIME TRACKING ===\n';
    csv += 'Session ID,Slide ID,Slide Title,Duration (sec),Started At\n';
    stats.avatarTimeData.forEach(t => {
      csv += `${t.session_id},${t.slide_id},"${t.slide_title}",${t.duration_seconds},${t.started_at}\n`;
    });
    csv += '\n';

    // Sheet 7: Question-Level Analysis
    csv += '=== QUESTION ANALYSIS ===\n';
    csv += 'Question Type,Question ID,Question Text,Correct Rate (%),Total Responses\n';
    stats.preTestQuestionAnalysis.forEach(q => {
      csv += `Pre-Test,${q.questionId},"${q.questionText.replace(/"/g, '""')}",${q.correctRate},${q.totalResponses}\n`;
    });
    stats.postTestQuestionAnalysis.forEach(q => {
      csv += `Post-Test,${q.questionId},"${q.questionText.replace(/"/g, '""')}",${q.correctRate},${q.totalResponses}\n`;
    });
    csv += '\n';

    // Sheet 8: Correlations
    csv += '=== CORRELATION DATA ===\n';
    csv += 'Type,X Value,Y Value (Knowledge Gain %),Mode\n';
    stats.correlations.avatarTimeVsGain.forEach(c => {
      csv += `Avatar Time (min),${c.x},${c.y},${c.mode}\n`;
    });
    stats.correlations.sessionTimeVsGain.forEach(c => {
      csv += `Session Time (min),${c.x},${c.y},${c.mode}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comprehensive_study_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // JSON export with all data
  const exportComprehensiveJSON = async () => {
    if (!stats) return;

    const { data: questions } = await supabase
      .from('study_questions')
      .select('*')
      .eq('is_active', true);

    const exportData = {
      exportedAt: new Date().toISOString(),
      dateRange: {
        start: startDate?.toISOString() || 'all',
        end: endDate?.toISOString() || 'all',
      },
      summary: {
        totalCompleted: stats.totalCompleted,
        totalIncomplete: stats.totalIncomplete,
        textModeCompleted: stats.textModeCompleted,
        avatarModeCompleted: stats.avatarModeCompleted,
        bothModesCompleted: stats.bothModesCompleted,
        avgSessionDuration: stats.avgSessionDuration,
        avgAvatarTime: stats.avgAvatarTime,
        avgPreScore: stats.avgPreScore,
        avgPostScore: stats.avgPostScore,
        avgGain: stats.avgGain,
      },
      modeBreakdown: {
        textMode: {
          preScore: stats.textModePreScore,
          postScore: stats.textModePostScore,
          gain: stats.textModeGain,
          count: stats.textModeCompleted,
        },
        avatarMode: {
          preScore: stats.avatarModePreScore,
          postScore: stats.avatarModePostScore,
          gain: stats.avatarModeGain,
          count: stats.avatarModeCompleted,
        },
        bothModes: {
          preScore: stats.bothModesPreScore,
          postScore: stats.bothModesPostScore,
          gain: stats.bothModesGain,
          count: stats.bothModesCompleted,
        },
      },
      demographics: {
        ageBreakdown: stats.demographicBreakdown,
        educationBreakdown: stats.educationBreakdown,
        experienceBreakdown: stats.experienceBreakdown,
      },
      sessions: stats.rawSessions.map(s => ({
        ...s,
        knowledgeGain: stats.knowledgeGain.find(k => k.sessionId === s.session_id),
      })),
      responses: {
        demographics: stats.rawDemographics,
        preTest: stats.rawPreTest,
        postTest: stats.rawPostTest,
      },
      avatarTracking: {
        bySlide: stats.avatarTimeBySlide,
        rawData: stats.avatarTimeData,
      },
      questionAnalysis: {
        preTest: stats.preTestQuestionAnalysis,
        postTest: stats.postTestQuestionAnalysis,
      },
      correlations: stats.correlations,
      questions: questions,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comprehensive_study_export_${new Date().toISOString().split('T')[0]}.json`;
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

  const prePostComparisonData = [
    { name: 'Pre-Test', score: stats.avgPreScore, fill: '#ef4444' },
    { name: 'Post-Test', score: stats.avgPostScore, fill: '#10b981' },
  ];

  const modeGainData = [
    { name: 'Text Only', gain: stats.textModeGain, preScore: stats.textModePreScore, postScore: stats.textModePostScore, count: stats.textModeCompleted },
    { name: 'Avatar Only', gain: stats.avatarModeGain, preScore: stats.avatarModePreScore, postScore: stats.avatarModePostScore, count: stats.avatarModeCompleted },
    { name: 'Both Modes', gain: stats.bothModesGain, preScore: stats.bothModesPreScore, postScore: stats.bothModesPostScore, count: stats.bothModesCompleted },
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

      {/* Export Actions */}
      <div className="flex flex-wrap gap-3 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
        <span className="text-sm text-slate-400 self-center mr-2">Export Full Data:</span>
        <Button variant="outline" size="sm" onClick={exportComprehensiveCSV} className="gap-2">
          <FileSpreadsheet className="w-4 h-4" />
          Comprehensive CSV
        </Button>
        <Button variant="outline" size="sm" onClick={exportComprehensiveJSON} className="gap-2">
          <Download className="w-4 h-4" />
          Comprehensive JSON
        </Button>
      </div>

      {/* Info banner */}
      <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-3 text-sm text-blue-200">
        📊 Statistics show <strong>completed sessions only</strong> ({stats.totalCompleted} completed, {stats.totalIncomplete} incomplete)
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
            <p className="text-xs text-slate-500 mt-1">post vs pre-test</p>
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
              <div className="flex justify-between"><span className="text-purple-400">Avatar:</span><span className="text-white">{stats.avatarModeCompleted}</span></div>
              <div className="flex justify-between"><span className="text-cyan-400">Both:</span><span className="text-white">{stats.bothModesCompleted}</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Knowledge Gain Section */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Knowledge Gain Analysis
          </CardTitle>
          <CardDescription className="text-slate-400">
            Pre-test vs Post-test comparison (based on {stats.knowledgeGain.length} sessions with complete data)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats.knowledgeGain.length > 0 ? (
            <div className="space-y-6">
              {/* Overall Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                  <div className="text-sm text-slate-400 mb-1">Overall Avg. Pre-Test</div>
                  <div className="text-2xl font-bold text-red-400">{stats.avgPreScore}%</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                  <div className="text-sm text-slate-400 mb-1">Overall Avg. Post-Test</div>
                  <div className="text-2xl font-bold text-green-400">{stats.avgPostScore}%</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                  <div className="text-sm text-slate-400 mb-1">Overall Avg. Gain</div>
                  <div className="text-2xl font-bold text-white">{stats.avgGain >= 0 ? '+' : ''}{stats.avgGain}%</div>
                </div>
              </div>

              {/* Mode-specific breakdown */}
              <div className="border-t border-slate-700 pt-4">
                <h4 className="text-sm font-medium text-slate-300 mb-4">Knowledge Gain by Learning Mode</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Text Only */}
                  <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
                    <div className="text-sm font-medium text-blue-400 mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-400" />
                        Text Only
                      </div>
                      <span className="text-slate-500 text-xs">n={stats.textModeCompleted}</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Pre-Test:</span>
                        <span className="text-red-400">{stats.textModePreScore}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Post-Test:</span>
                        <span className="text-green-400">{stats.textModePostScore}%</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-700 pt-2 mt-2">
                        <span className="text-slate-300 font-medium">Gain:</span>
                        <span className={`font-bold ${stats.textModeGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {stats.textModeGain >= 0 ? '+' : ''}{stats.textModeGain}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Avatar Only */}
                  <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-4">
                    <div className="text-sm font-medium text-purple-400 mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-400" />
                        Avatar Only
                      </div>
                      <span className="text-slate-500 text-xs">n={stats.avatarModeCompleted}</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Pre-Test:</span>
                        <span className="text-red-400">{stats.avatarModePreScore}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Post-Test:</span>
                        <span className="text-green-400">{stats.avatarModePostScore}%</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-700 pt-2 mt-2">
                        <span className="text-slate-300 font-medium">Gain:</span>
                        <span className={`font-bold ${stats.avatarModeGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {stats.avatarModeGain >= 0 ? '+' : ''}{stats.avatarModeGain}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Both Modes */}
                  <div className="bg-cyan-900/20 border border-cyan-700/50 rounded-lg p-4">
                    <div className="text-sm font-medium text-cyan-400 mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-cyan-400" />
                        Both Modes
                      </div>
                      <span className="text-slate-500 text-xs">n={stats.bothModesCompleted}</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Pre-Test:</span>
                        <span className="text-red-400">{stats.bothModesPreScore}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Post-Test:</span>
                        <span className="text-green-400">{stats.bothModesPostScore}%</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-700 pt-2 mt-2">
                        <span className="text-slate-300 font-medium">Gain:</span>
                        <span className={`font-bold ${stats.bothModesGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {stats.bothModesGain >= 0 ? '+' : ''}{stats.bothModesGain}%
                        </span>
                      </div>
                    </div>
                  </div>
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
                    <BarChart data={modeGainData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                      <YAxis stroke="#9ca3af" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                        formatter={(value: number, name: string) => {
                          if (name === 'gain') return [`${value >= 0 ? '+' : ''}${value}%`, 'Gain'];
                          return [`${value}%`, name];
                        }}
                      />
                      <Legend />
                      <Bar dataKey="preScore" name="Pre-Test" fill="#ef4444" />
                      <Bar dataKey="postScore" name="Post-Test" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-slate-500">
              No knowledge gain data available yet (requires scored pre/post test questions)
            </div>
          )}
        </CardContent>
      </Card>

      {/* Question Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-sm">Pre-Test Question Performance</CardTitle>
            <CardDescription className="text-slate-400">Correct answer rate per question</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.preTestQuestionAnalysis.length > 0 ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {stats.preTestQuestionAnalysis.map(q => (
                  <div key={q.questionId} className="flex items-center gap-2 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-slate-300" title={q.questionText}>{q.questionText}</div>
                    </div>
                    <div className="w-16 text-right">
                      <span className={q.correctRate >= 50 ? 'text-green-400' : 'text-red-400'}>
                        {q.correctRate}%
                      </span>
                    </div>
                    <div className="w-12 text-right text-slate-500 text-xs">
                      n={q.totalResponses}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-4">No pre-test data</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-sm">Post-Test Question Performance</CardTitle>
            <CardDescription className="text-slate-400">Correct answer rate per knowledge question</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.postTestQuestionAnalysis.length > 0 ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {stats.postTestQuestionAnalysis.map(q => (
                  <div key={q.questionId} className="flex items-center gap-2 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-slate-300" title={q.questionText}>{q.questionText}</div>
                    </div>
                    <div className="w-16 text-right">
                      <span className={q.correctRate >= 50 ? 'text-green-400' : 'text-red-400'}>
                        {q.correctRate}%
                      </span>
                    </div>
                    <div className="w-12 text-right text-slate-500 text-xs">
                      n={q.totalResponses}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-4">No post-test knowledge data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Avatar Time Tracking */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Avatar Interaction Time</CardTitle>
          <CardDescription className="text-slate-400">
            Time spent with avatar per slide ({stats.avatarTimeData.length} records from {Object.keys(stats.avatarTimeBySlide).length > 0 ? 'multiple' : '0'} sessions)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats.avatarTimeBySlide.length > 0 ? (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.avatarTimeBySlide}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="slide" stroke="#9ca3af" fontSize={10} angle={-20} textAnchor="end" height={60} />
                  <YAxis stroke="#9ca3af" fontSize={12} label={{ value: 'Avg seconds', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                    formatter={(value: number, name: string) => {
                      if (name === 'avgTime') return [`${value}s`, 'Avg Time'];
                      if (name === 'count') return [value, 'Sessions'];
                      return [value, name];
                    }}
                  />
                  <Legend />
                  <Bar dataKey="avgTime" name="Avg Time (s)" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="bg-slate-700/50 rounded p-3">
                  <div className="text-slate-400">Total Time</div>
                  <div className="text-xl font-bold text-purple-400">{Math.round(stats.totalAvatarTime / 60)} min</div>
                </div>
                <div className="bg-slate-700/50 rounded p-3">
                  <div className="text-slate-400">Avg per Session</div>
                  <div className="text-xl font-bold text-purple-400">{Math.round(stats.avgAvatarTime / 60)} min</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-slate-500">
              No avatar interaction data available yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* Correlations */}
      {stats.correlations.avatarTimeVsGain.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Correlation: Avatar Time vs Knowledge Gain</CardTitle>
            <CardDescription className="text-slate-400">Each dot represents one session</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  type="number" 
                  dataKey="x" 
                  name="Avatar Time" 
                  unit=" min" 
                  stroke="#9ca3af"
                  label={{ value: 'Avatar Time (min)', position: 'bottom', fill: '#9ca3af' }}
                />
                <YAxis 
                  type="number" 
                  dataKey="y" 
                  name="Knowledge Gain" 
                  unit="%" 
                  stroke="#9ca3af"
                  label={{ value: 'Knowledge Gain (%)', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
                />
                <ZAxis range={[60, 60]} />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                  formatter={(value: number, name: string) => {
                    if (name === 'Avatar Time') return [`${value} min`, name];
                    if (name === 'Knowledge Gain') return [`${value}%`, name];
                    return [value, name];
                  }}
                />
                <Scatter 
                  name="Sessions" 
                  data={stats.correlations.avatarTimeVsGain} 
                  fill="#8b5cf6"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
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
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
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
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                <Bar dataKey="count" name="Completed" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Demographics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-sm">Age Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.demographicBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={stats.demographicBreakdown}
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {stats.demographicBreakdown.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-slate-500">No data</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-sm">Education Level</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.educationBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={stats.educationBreakdown}
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name.length > 10 ? name.substring(0, 10) + '...' : name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {stats.educationBreakdown.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-slate-500">No data</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-sm">Digital Experience</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.experienceBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={stats.experienceBreakdown}
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name.length > 15 ? name.substring(0, 15) + '...' : name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {stats.experienceBreakdown.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-slate-500">No data</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Summary Statistics</CardTitle>
          <CardDescription className="text-slate-400">Key metrics for completed participants</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-400">Total Completed</div>
              <div className="text-xl font-bold text-white">{stats.totalCompleted}</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-400">Avg Pre-Test</div>
              <div className="text-xl font-bold text-red-400">{stats.avgPreScore}%</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-400">Avg Post-Test</div>
              <div className="text-xl font-bold text-green-400">{stats.avgPostScore}%</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-400">Avg Gain</div>
              <div className={`text-xl font-bold ${stats.avgGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stats.avgGain >= 0 ? '+' : ''}{stats.avgGain}%
              </div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-400">Avg Session Time</div>
              <div className="text-xl font-bold text-yellow-400">{stats.avgSessionDuration} min</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-400">Avg Avatar Time</div>
              <div className="text-xl font-bold text-purple-400">{Math.round(stats.avgAvatarTime / 60)} min</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminOverview;
