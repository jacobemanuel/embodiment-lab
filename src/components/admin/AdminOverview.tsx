import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, Download, Timer, TrendingUp, FileSpreadsheet, AlertTriangle, Filter, Info, RefreshCw, BarChart2, FileText } from "lucide-react";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, Cell, Legend, ScatterChart, Scatter, ZAxis, LineChart, Line } from "recharts";
import DateRangeFilter from "./DateRangeFilter";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";

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
  hasCorrectAnswer: boolean;
}

interface LikertAnalysis {
  questionId: string;
  questionText: string;
  category: 'trust' | 'engagement' | 'satisfaction';
  mean: number;
  median: number;
  std: number;
  distribution: { [key: number]: number };
  totalResponses: number;
  responses: number[];
}

interface CorrelationData {
  avatarTimeVsGain: { x: number; y: number; mode: string }[];
  sessionTimeVsGain: { x: number; y: number; mode: string }[];
}

interface StatisticalTest {
  textVsAvatar: { 
    tStatistic: number; 
    pValue: number; 
    significant: boolean; 
    textN: number; 
    avatarN: number; 
    textMean: number; 
    avatarMean: number; 
    textStd: number; 
    avatarStd: number;
    cohensD: number;
    effectSize: 'negligible' | 'small' | 'medium' | 'large';
    ci95Lower: number;
    ci95Upper: number;
  };
  textVsBoth: { tStatistic: number; pValue: number; significant: boolean; textN: number; bothN: number; textMean: number; bothMean: number; cohensD: number; effectSize: 'negligible' | 'small' | 'medium' | 'large'; };
  avatarVsBoth: { tStatistic: number; pValue: number; significant: boolean; avatarN: number; bothN: number; avatarMean: number; bothMean: number; cohensD: number; effectSize: 'negligible' | 'small' | 'medium' | 'large'; };
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
  missingCorrectAnswers: { preTest: number; postTest: number };
  statisticalTests: StatisticalTest | null;
  likertAnalysis: LikertAnalysis[];
  likertByMode: {
    text: LikertAnalysis[];
    avatar: LikertAnalysis[];
    both: LikertAnalysis[];
  };
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

type StatusFilter = 'completed' | 'all' | 'incomplete';

// Sorting helpers
const AGE_ORDER = ['Under 18', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const EXPERIENCE_ORDER = ['1 - No Experience', '2 - Limited Experience', '3 - Moderate Experience', '4 - Good Experience', '5 - Extensive Experience'];
const EDUCATION_ORDER = ['High school or less', 'Some college', "Bachelor's degree", "Master's degree", 'Doctoral degree'];

const sortByOrder = (data: { name: string; value: number }[], order: string[]) => {
  return [...data].sort((a, b) => {
    const aIdx = order.findIndex(o => a.name.includes(o) || o.includes(a.name));
    const bIdx = order.findIndex(o => b.name.includes(o) || o.includes(b.name));
    if (aIdx === -1 && bIdx === -1) return a.name.localeCompare(b.name);
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });
};

// Helper component for section CSV export
const ExportButton = ({ onClick, label, size = "sm" }: { onClick: () => void; label: string; size?: "sm" | "xs" }) => (
  <Button 
    variant="ghost" 
    size={size === "xs" ? "sm" : size}
    onClick={onClick} 
    className={`gap-1 text-slate-400 hover:text-white ${size === "xs" ? "h-6 px-2 text-xs" : ""}`}
  >
    <Download className={size === "xs" ? "w-3 h-3" : "w-4 h-4"} />
    {label}
  </Button>
);

const AdminOverview = () => {
  const [stats, setStats] = useState<StudyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('completed');

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

      // Filter sessions based on status filter
      const completedSessions = allSessions?.filter(s => s.completed_at) || [];
      const incompleteSessions = allSessions?.filter(s => !s.completed_at) || [];
      
      let sessionsToAnalyze = completedSessions;
      if (statusFilter === 'all') {
        sessionsToAnalyze = allSessions || [];
      } else if (statusFilter === 'incomplete') {
        sessionsToAnalyze = incompleteSessions;
      }
      
      const sessionIds = sessionsToAnalyze.map(s => s.id);

      // Fetch all related data for sessions
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
      
      // Count missing correct answers
      const preTestQuestions = questionsData?.filter(q => q.question_type === 'pre_test') || [];
      const postTestKnowledgeQuestions = questionsData?.filter(q => q.question_id.startsWith('knowledge-')) || [];
      const missingPreTest = preTestQuestions.filter(q => !q.correct_answer).length;
      const missingPostTest = postTestKnowledgeQuestions.filter(q => !q.correct_answer).length;

      // Calculate mode distribution
      const getSessionMode = (s: any): 'text' | 'avatar' | 'both' => {
        const modesUsed = s.modes_used && s.modes_used.length > 0 ? s.modes_used : [s.mode];
        if (modesUsed.includes('text') && modesUsed.includes('avatar')) return 'both';
        if (modesUsed.includes('avatar')) return 'avatar';
        return 'text';
      };
      
      const textModeCompleted = sessionsToAnalyze.filter(s => getSessionMode(s) === 'text').length;
      const avatarModeCompleted = sessionsToAnalyze.filter(s => getSessionMode(s) === 'avatar').length;
      const bothModesCompleted = sessionsToAnalyze.filter(s => getSessionMode(s) === 'both').length;

      // Average session duration
      let avgDuration = 0;
      const sessionsWithDuration = sessionsToAnalyze.filter(s => s.completed_at);
      if (sessionsWithDuration.length > 0) {
        const totalDuration = sessionsWithDuration.reduce((sum, s) => {
          const start = new Date(s.started_at).getTime();
          const end = new Date(s.completed_at!).getTime();
          return sum + (end - start);
        }, 0);
        avgDuration = Math.round(totalDuration / sessionsWithDuration.length / 1000 / 60);
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
      sessionsToAnalyze.forEach(s => {
        const dateStr = (s.completed_at || s.created_at).split('T')[0];
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
      sessionsToAnalyze.forEach(s => {
        const preScores = sessionPreScores[s.id];
        const postScores = sessionPostScores[s.id];
        
        if (preScores && preScores.total > 0 && postScores && postScores.total > 0) {
          const preScore = (preScores.correct / preScores.total) * 100;
          const postScore = (postScores.correct / postScores.total) * 100;
          
          const mode = getSessionMode(s);
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

      // Statistical significance testing (Welch's t-test)
      const welchTTest = (group1: number[], group2: number[]): { tStatistic: number; pValue: number; significant: boolean } => {
        if (group1.length < 2 || group2.length < 2) {
          return { tStatistic: 0, pValue: 1, significant: false };
        }
        
        const mean1 = group1.reduce((a, b) => a + b, 0) / group1.length;
        const mean2 = group2.reduce((a, b) => a + b, 0) / group2.length;
        
        const var1 = group1.reduce((sum, x) => sum + Math.pow(x - mean1, 2), 0) / (group1.length - 1);
        const var2 = group2.reduce((sum, x) => sum + Math.pow(x - mean2, 2), 0) / (group2.length - 1);
        
        const se = Math.sqrt(var1 / group1.length + var2 / group2.length);
        if (se === 0) return { tStatistic: 0, pValue: 1, significant: false };
        
        const t = (mean1 - mean2) / se;
        
        // Welch-Satterthwaite degrees of freedom
        const df = Math.pow(var1 / group1.length + var2 / group2.length, 2) / 
          (Math.pow(var1 / group1.length, 2) / (group1.length - 1) + Math.pow(var2 / group2.length, 2) / (group2.length - 1));
        
        // Approximate p-value using normal distribution for large df (simplified)
        // For proper implementation would need t-distribution CDF
        const absT = Math.abs(t);
        let pValue = 2 * (1 - normalCDF(absT));
        pValue = Math.max(0.0001, Math.min(1, pValue));
        
        return { tStatistic: Math.round(t * 100) / 100, pValue: Math.round(pValue * 10000) / 10000, significant: pValue < 0.05 };
      };
      
      // Normal CDF approximation
      const normalCDF = (x: number): number => {
        const a1 =  0.254829592;
        const a2 = -0.284496736;
        const a3 =  1.421413741;
        const a4 = -1.453152027;
        const a5 =  1.061405429;
        const p  =  0.3275911;
        const sign = x < 0 ? -1 : 1;
        x = Math.abs(x) / Math.sqrt(2);
        const t = 1.0 / (1.0 + p * x);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
        return 0.5 * (1.0 + sign * y);
      };

      // Calculate standard deviation
      const calcStd = (arr: number[]): number => {
        if (arr.length < 2) return 0;
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        const variance = arr.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / (arr.length - 1);
        return Math.round(Math.sqrt(variance) * 100) / 100;
      };

      // Cohen's d effect size calculation
      const calcCohensD = (group1: number[], group2: number[]): { d: number; effectSize: 'negligible' | 'small' | 'medium' | 'large' } => {
        if (group1.length < 2 || group2.length < 2) return { d: 0, effectSize: 'negligible' };
        
        const mean1 = group1.reduce((a, b) => a + b, 0) / group1.length;
        const mean2 = group2.reduce((a, b) => a + b, 0) / group2.length;
        
        const var1 = group1.reduce((sum, x) => sum + Math.pow(x - mean1, 2), 0) / (group1.length - 1);
        const var2 = group2.reduce((sum, x) => sum + Math.pow(x - mean2, 2), 0) / (group2.length - 1);
        
        // Pooled standard deviation
        const pooledSD = Math.sqrt(((group1.length - 1) * var1 + (group2.length - 1) * var2) / (group1.length + group2.length - 2));
        
        if (pooledSD === 0) return { d: 0, effectSize: 'negligible' };
        
        const d = Math.abs(mean1 - mean2) / pooledSD;
        const roundedD = Math.round(d * 100) / 100;
        
        // Interpret effect size (Cohen's conventions)
        let effectSize: 'negligible' | 'small' | 'medium' | 'large';
        if (d < 0.2) effectSize = 'negligible';
        else if (d < 0.5) effectSize = 'small';
        else if (d < 0.8) effectSize = 'medium';
        else effectSize = 'large';
        
        return { d: roundedD, effectSize };
      };

      // 95% Confidence Interval for mean difference
      const calc95CI = (group1: number[], group2: number[]): { lower: number; upper: number } => {
        if (group1.length < 2 || group2.length < 2) return { lower: 0, upper: 0 };
        
        const mean1 = group1.reduce((a, b) => a + b, 0) / group1.length;
        const mean2 = group2.reduce((a, b) => a + b, 0) / group2.length;
        const meanDiff = mean1 - mean2;
        
        const var1 = group1.reduce((sum, x) => sum + Math.pow(x - mean1, 2), 0) / (group1.length - 1);
        const var2 = group2.reduce((sum, x) => sum + Math.pow(x - mean2, 2), 0) / (group2.length - 1);
        
        const se = Math.sqrt(var1 / group1.length + var2 / group2.length);
        
        // Using 1.96 for 95% CI (normal approximation)
        const margin = 1.96 * se;
        
        return {
          lower: Math.round((meanDiff - margin) * 100) / 100,
          upper: Math.round((meanDiff + margin) * 100) / 100,
        };
      };

      // Perform statistical tests
      const textGains = textModeData.map(k => k.gain);
      const avatarGains = avatarModeData.map(k => k.gain);
      const bothGains = bothModesData.map(k => k.gain);
      
      const textVsAvatarTest = welchTTest(textGains, avatarGains);
      const textVsBothTest = welchTTest(textGains, bothGains);
      const avatarVsBothTest = welchTTest(avatarGains, bothGains);
      
      const textVsAvatarCohenD = calcCohensD(textGains, avatarGains);
      const textVsBothCohenD = calcCohensD(textGains, bothGains);
      const avatarVsBothCohenD = calcCohensD(avatarGains, bothGains);
      
      const textVsAvatarCI = calc95CI(textGains, avatarGains);
      
      const statisticalTests: StatisticalTest | null = (textGains.length >= 2 || avatarGains.length >= 2) ? {
        textVsAvatar: {
          ...textVsAvatarTest,
          textN: textGains.length,
          avatarN: avatarGains.length,
          textMean: calcAvg(textModeData, 'gain'),
          avatarMean: calcAvg(avatarModeData, 'gain'),
          textStd: calcStd(textGains),
          avatarStd: calcStd(avatarGains),
          cohensD: textVsAvatarCohenD.d,
          effectSize: textVsAvatarCohenD.effectSize,
          ci95Lower: textVsAvatarCI.lower,
          ci95Upper: textVsAvatarCI.upper,
        },
        textVsBoth: {
          ...textVsBothTest,
          textN: textGains.length,
          bothN: bothGains.length,
          textMean: calcAvg(textModeData, 'gain'),
          bothMean: calcAvg(bothModesData, 'gain'),
          cohensD: textVsBothCohenD.d,
          effectSize: textVsBothCohenD.effectSize,
        },
        avatarVsBoth: {
          ...avatarVsBothTest,
          avatarN: avatarGains.length,
          bothN: bothGains.length,
          avatarMean: calcAvg(avatarModeData, 'gain'),
          bothMean: calcAvg(bothModesData, 'gain'),
          cohensD: avatarVsBothCohenD.d,
          effectSize: avatarVsBothCohenD.effectSize,
        },
      } : null;

      // Pre-test question analysis
      const preTestQuestionStats: Record<string, { correct: number; total: number; text: string; hasCorrectAnswer: boolean }> = {};
      preTestResponses.forEach(r => {
        const question = questionMap.get(r.question_id);
        if (question) {
          if (!preTestQuestionStats[r.question_id]) {
            preTestQuestionStats[r.question_id] = { 
              correct: 0, 
              total: 0, 
              text: question.question_text,
              hasCorrectAnswer: !!question.correct_answer
            };
          }
          preTestQuestionStats[r.question_id].total++;
          
          if (question.correct_answer) {
            const correctAnswers = question.correct_answer.split('|||').map((a: string) => a.trim().toLowerCase());
            const userAnswers = r.answer.split('|||').map((a: string) => a.trim().toLowerCase());
            const isCorrect = correctAnswers.every((ca: string) => userAnswers.includes(ca)) && 
                             userAnswers.every((ua: string) => correctAnswers.includes(ua));
            if (isCorrect) preTestQuestionStats[r.question_id].correct++;
          }
        }
      });

      // Post-test question analysis (knowledge questions only)
      const postTestQuestionStats: Record<string, { correct: number; total: number; text: string; hasCorrectAnswer: boolean }> = {};
      postTestResponses.forEach(r => {
        if (r.question_id.startsWith('knowledge-')) {
          const question = questionMap.get(r.question_id);
          if (question) {
            if (!postTestQuestionStats[r.question_id]) {
              postTestQuestionStats[r.question_id] = { 
                correct: 0, 
                total: 0, 
                text: question.question_text,
                hasCorrectAnswer: !!question.correct_answer
              };
            }
            postTestQuestionStats[r.question_id].total++;
            
            if (question.correct_answer) {
              const correctAnswers = question.correct_answer.split('|||').map((a: string) => a.trim().toLowerCase());
              const userAnswers = r.answer.split('|||').map((a: string) => a.trim().toLowerCase());
              const isCorrect = correctAnswers.every((ca: string) => userAnswers.includes(ca)) && 
                               userAnswers.every((ua: string) => correctAnswers.includes(ua));
              if (isCorrect) postTestQuestionStats[r.question_id].correct++;
            }
          }
        }
      });

      const preTestQuestionAnalysis = Object.entries(preTestQuestionStats).map(([qId, stats]) => ({
        questionId: qId,
        questionText: stats.text.length > 80 ? stats.text.substring(0, 80) + '...' : stats.text,
        questionType: 'pre_test',
        correctRate: stats.hasCorrectAnswer && stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
        totalResponses: stats.total,
        hasCorrectAnswer: stats.hasCorrectAnswer,
      }));

      const postTestQuestionAnalysis = Object.entries(postTestQuestionStats).map(([qId, stats]) => ({
        questionId: qId,
        questionText: stats.text.length > 80 ? stats.text.substring(0, 80) + '...' : stats.text,
        questionType: 'post_test',
        correctRate: stats.hasCorrectAnswer && stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
        totalResponses: stats.total,
        hasCorrectAnswer: stats.hasCorrectAnswer,
      }));

      // Correlation data - include ALL sessions with knowledge gain data
      const correlations: CorrelationData = {
        avatarTimeVsGain: knowledgeGain.filter(k => k.avatarTime > 0).map(k => ({
          x: Math.round((k.avatarTime / 60) * 100) / 100,
          y: k.gain,
          mode: k.mode,
        })),
        sessionTimeVsGain: knowledgeGain.map(k => {
          const session = sessionsToAnalyze.find(s => s.session_id === k.sessionId);
          const duration = session?.completed_at 
            ? (new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 1000 / 60 
            : 0;
          return {
            x: Math.round(duration * 10) / 10,
            y: k.gain,
            mode: k.mode,
          };
        }),
      };

      // Likert Scale Analysis (trust, engagement, satisfaction questions)
      const LIKERT_QUESTIONS: { id: string; text: string; category: 'trust' | 'engagement' | 'satisfaction' }[] = [
        { id: 'trust-1', text: 'I trust the AI system to provide accurate information', category: 'trust' },
        { id: 'trust-2', text: 'I would rely on this AI system for learning complex topics', category: 'trust' },
        { id: 'trust-3', text: "The AI system's explanations were credible and trustworthy", category: 'trust' },
        { id: 'engagement-1', text: 'The learning experience kept me engaged throughout', category: 'engagement' },
        { id: 'engagement-2', text: 'I felt motivated to complete all the scenarios', category: 'engagement' },
        { id: 'engagement-3', text: 'The interactive format was more engaging than traditional reading', category: 'engagement' },
        { id: 'satisfaction-1', text: 'Overall, I am satisfied with this learning experience', category: 'satisfaction' },
        { id: 'satisfaction-2', text: 'I would recommend this learning format to other students', category: 'satisfaction' },
        { id: 'satisfaction-3', text: 'The learning mode I used was effective for understanding AI concepts', category: 'satisfaction' },
      ];

      const analyzeLikertForSessions = (sessionIds: string[]): LikertAnalysis[] => {
        const relevantResponses = postTestResponses.filter(r => 
          sessionIds.includes(r.session_id) && 
          LIKERT_QUESTIONS.some(q => q.id === r.question_id)
        );

        return LIKERT_QUESTIONS.map(q => {
          const responses = relevantResponses
            .filter(r => r.question_id === q.id)
            .map(r => parseInt(r.answer, 10))
            .filter(n => !isNaN(n) && n >= 1 && n <= 5);

          const distribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
          responses.forEach(r => { distribution[r] = (distribution[r] || 0) + 1; });

          const mean = responses.length > 0 
            ? Math.round((responses.reduce((a, b) => a + b, 0) / responses.length) * 100) / 100 
            : 0;
          
          const sorted = [...responses].sort((a, b) => a - b);
          const median = responses.length > 0
            ? sorted.length % 2 === 0
              ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
              : sorted[Math.floor(sorted.length / 2)]
            : 0;

          const variance = responses.length > 1
            ? responses.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / (responses.length - 1)
            : 0;
          const std = Math.round(Math.sqrt(variance) * 100) / 100;

          return {
            questionId: q.id,
            questionText: q.text,
            category: q.category,
            mean,
            median,
            std,
            distribution,
            totalResponses: responses.length,
            responses,
          };
        }).filter(a => a.totalResponses > 0);
      };

      const allSessionIds = sessionsToAnalyze.map(s => s.id);
      const textSessionIds = sessionsToAnalyze.filter(s => getSessionMode(s) === 'text').map(s => s.id);
      const avatarSessionIds = sessionsToAnalyze.filter(s => getSessionMode(s) === 'avatar').map(s => s.id);
      const bothSessionIds = sessionsToAnalyze.filter(s => getSessionMode(s) === 'both').map(s => s.id);

      const likertAnalysis = analyzeLikertForSessions(allSessionIds);
      const likertByMode = {
        text: analyzeLikertForSessions(textSessionIds),
        avatar: analyzeLikertForSessions(avatarSessionIds),
        both: analyzeLikertForSessions(bothSessionIds),
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
        demographicBreakdown: sortByOrder(Object.entries(ageBreakdown).map(([name, value]) => ({ name, value })), AGE_ORDER),
        educationBreakdown: sortByOrder(Object.entries(educationBreakdown).map(([name, value]) => ({ name, value })), EDUCATION_ORDER),
        experienceBreakdown: sortByOrder(Object.entries(experienceBreakdown).map(([name, value]) => ({ name, value })), EXPERIENCE_ORDER),
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
        rawSessions: sessionsToAnalyze,
        rawDemographics: demographicResponses,
        rawPreTest: preTestResponses,
        rawPostTest: postTestResponses,
        missingCorrectAnswers: { preTest: missingPreTest, postTest: missingPostTest },
        statisticalTests,
        likertAnalysis,
        likertByMode,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [startDate, endDate, statusFilter]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchStats]);

  // Export CSV helper
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

  // Export comprehensive CSV with each session as a row
  const exportComprehensiveCSV = async () => {
    if (!stats) return;

    const { data: questions } = await supabase
      .from('study_questions')
      .select('question_id, question_text, correct_answer, question_type')
      .eq('is_active', true)
      .order('sort_order');
    
    const questionTextMap: Record<string, string> = {};
    const correctAnswerMap: Record<string, string> = {};
    questions?.forEach(q => {
      questionTextMap[q.question_id] = q.question_text;
      correctAnswerMap[q.question_id] = q.correct_answer || '';
    });

    const demoQuestionIds = [...new Set(stats.rawDemographics.map(r => r.question_id))].sort();
    const preTestQuestionIds = [...new Set(stats.rawPreTest.map(r => r.question_id))].sort();
    const postTestQuestionIds = [...new Set(stats.rawPostTest.map(r => r.question_id))].sort();

    let csv = '';
    
    const headers = [
      'Session ID',
      'Mode',
      'Modes Used',
      'Status',
      'Started At',
      'Completed At',
      'Duration (min)',
      'Pre-Test Score (%)',
      'Post-Test Score (%)',
      'Knowledge Gain (%)',
      'Avatar Time (sec)',
      ...demoQuestionIds.map(qId => `DEMO: ${questionTextMap[qId] || qId}`),
      ...preTestQuestionIds.map(qId => `PRE: ${questionTextMap[qId] || qId}`),
      ...preTestQuestionIds.map(qId => `PRE_CORRECT: ${qId}`),
      ...postTestQuestionIds.map(qId => `POST: ${questionTextMap[qId] || qId}`),
      ...postTestQuestionIds.map(qId => `POST_CORRECT: ${qId}`),
    ];
    csv += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',') + '\n';

    stats.rawSessions.forEach(session => {
      const kg = stats.knowledgeGain.find(k => k.sessionId === session.session_id);
      const duration = session.completed_at 
        ? Math.round((new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 1000 / 60) 
        : 0;
      
      const demoResponses = stats.rawDemographics.filter(r => r.session_id === session.id);
      const preTestResponses = stats.rawPreTest.filter(r => r.session_id === session.id);
      const postTestResponses = stats.rawPostTest.filter(r => r.session_id === session.id);
      
      const avatarTime = stats.avatarTimeData
        .filter(t => t.session_id === session.id)
        .reduce((sum, t) => sum + (t.duration_seconds || 0), 0);

      const row = [
        session.session_id,
        session.mode,
        (session.modes_used || []).join('; '),
        session.completed_at ? 'Completed' : 'Incomplete',
        session.started_at,
        session.completed_at || '',
        duration,
        kg?.preScore ?? '',
        kg?.postScore ?? '',
        kg?.gain ?? '',
        avatarTime,
        ...demoQuestionIds.map(qId => {
          const resp = demoResponses.find(r => r.question_id === qId);
          return resp?.answer || '';
        }),
        ...preTestQuestionIds.map(qId => {
          const resp = preTestResponses.find(r => r.question_id === qId);
          return resp?.answer || '';
        }),
        ...preTestQuestionIds.map(qId => {
          const resp = preTestResponses.find(r => r.question_id === qId);
          if (!resp) return '';
          const correct = correctAnswerMap[qId];
          if (!correct) return 'N/A';
          const correctAnswers = correct.split('|||').map(a => a.trim().toLowerCase());
          const userAnswers = resp.answer.split('|||').map((a: string) => a.trim().toLowerCase());
          const isCorrect = correctAnswers.every(ca => userAnswers.includes(ca)) && 
                           userAnswers.every(ua => correctAnswers.includes(ua));
          return isCorrect ? 'Yes' : 'No';
        }),
        ...postTestQuestionIds.map(qId => {
          const resp = postTestResponses.find(r => r.question_id === qId);
          return resp?.answer || '';
        }),
        ...postTestQuestionIds.map(qId => {
          const resp = postTestResponses.find(r => r.question_id === qId);
          if (!resp) return '';
          const correct = correctAnswerMap[qId];
          if (!correct) return 'N/A';
          const correctAnswers = correct.split('|||').map(a => a.trim().toLowerCase());
          const userAnswers = resp.answer.split('|||').map((a: string) => a.trim().toLowerCase());
          const isCorrect = correctAnswers.every(ca => userAnswers.includes(ca)) && 
                           userAnswers.every(ua => correctAnswers.includes(ua));
          return isCorrect ? 'Yes' : 'No';
        }),
      ];
      
      csv += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `full_study_data_${statusFilter}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
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
      filter: statusFilter,
      dateRange: {
        start: startDate?.toISOString() || 'all',
        end: endDate?.toISOString() || 'all',
      },
      summary: {
        totalCompleted: stats.totalCompleted,
        totalIncomplete: stats.totalIncomplete,
        sessionsAnalyzed: stats.rawSessions.length,
        sessionsWithKnowledgeGainData: stats.knowledgeGain.length,
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
        avatarTime: stats.avatarTimeData.filter(t => t.session_id === s.id),
        demographicResponses: stats.rawDemographics.filter(r => r.session_id === s.id),
        preTestResponses: stats.rawPreTest.filter(r => r.session_id === s.id),
        postTestResponses: stats.rawPostTest.filter(r => r.session_id === s.id),
      })),
      avatarTracking: {
        bySlide: stats.avatarTimeBySlide,
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
    a.download = `full_study_data_${statusFilter}_${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export section-specific CSV
  const exportDemographicsCSV = () => {
    if (!stats) return;
    const data = [
      ...stats.demographicBreakdown.map(d => ({ Category: 'Age', Name: d.name, Count: d.value })),
      ...stats.educationBreakdown.map(d => ({ Category: 'Education', Name: d.name, Count: d.value })),
      ...stats.experienceBreakdown.map(d => ({ Category: 'Digital Experience', Name: d.name, Count: d.value })),
    ];
    downloadCSV(data, 'demographics');
  };

  const exportKnowledgeGainCSV = () => {
    if (!stats) return;
    const data = stats.knowledgeGain.map(k => ({
      SessionID: k.sessionId,
      Mode: k.mode,
      PreTestScore: k.preScore,
      PostTestScore: k.postScore,
      KnowledgeGain: k.gain,
      PreCorrect: k.preCorrect,
      PreTotal: k.preTotal,
      PostCorrect: k.postCorrect,
      PostTotal: k.postTotal,
      AvatarTimeSeconds: k.avatarTime,
    }));
    downloadCSV(data, 'knowledge_gain');
  };

  const exportCorrelationCSV = () => {
    if (!stats) return;
    const data = stats.correlations.sessionTimeVsGain.map(c => ({
      SessionDurationMinutes: c.x,
      KnowledgeGainPercent: c.y,
      Mode: c.mode,
    }));
    downloadCSV(data, 'correlation_session_time_vs_gain');
  };

  const exportQuestionPerformanceCSV = () => {
    if (!stats) return;
    const data = [
      ...stats.preTestQuestionAnalysis.map(q => ({
        TestType: 'Pre-Test',
        QuestionID: q.questionId,
        QuestionText: q.questionText,
        CorrectRate: q.correctRate,
        TotalResponses: q.totalResponses,
        HasCorrectAnswerSet: q.hasCorrectAnswer ? 'Yes' : 'No',
      })),
      ...stats.postTestQuestionAnalysis.map(q => ({
        TestType: 'Post-Test',
        QuestionID: q.questionId,
        QuestionText: q.questionText,
        CorrectRate: q.correctRate,
        TotalResponses: q.totalResponses,
        HasCorrectAnswerSet: q.hasCorrectAnswer ? 'Yes' : 'No',
      })),
    ];
    downloadCSV(data, 'question_performance');
  };

  const exportLikertCSV = () => {
    if (!stats) return;
    const data = stats.likertAnalysis.map(l => ({
      Category: l.category.charAt(0).toUpperCase() + l.category.slice(1),
      QuestionID: l.questionId,
      QuestionText: l.questionText,
      Mean: l.mean,
      Median: l.median,
      StdDev: l.std,
      TotalResponses: l.totalResponses,
      'Score_1': l.distribution[1],
      'Score_2': l.distribution[2],
      'Score_3': l.distribution[3],
      'Score_4': l.distribution[4],
      'Score_5': l.distribution[5],
    }));
    downloadCSV(data, 'likert_perception_analysis');
  };

  const exportLikertByModeCSV = () => {
    if (!stats) return;
    const data: any[] = [];
    
    ['text', 'avatar'].forEach(mode => {
      const modeData = stats.likertByMode[mode as 'text' | 'avatar'];
      modeData.forEach(l => {
        data.push({
          Mode: mode.charAt(0).toUpperCase() + mode.slice(1),
          Category: l.category.charAt(0).toUpperCase() + l.category.slice(1),
          QuestionID: l.questionId,
          QuestionText: l.questionText,
          Mean: l.mean,
          Median: l.median,
          StdDev: l.std,
          TotalResponses: l.totalResponses,
          'Score_1': l.distribution[1],
          'Score_2': l.distribution[2],
          'Score_3': l.distribution[3],
          'Score_4': l.distribution[4],
          'Score_5': l.distribution[5],
        });
      });
    });
    downloadCSV(data, 'likert_by_mode');
  };

  // Publication-ready PDF report export
  const exportPublicationReport = async () => {
    if (!stats) return;

    const dateRange = startDate && endDate 
      ? `${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}` 
      : 'All time';

    const textKG = stats.knowledgeGain.filter(k => k.mode === 'text');
    const avatarKG = stats.knowledgeGain.filter(k => k.mode === 'avatar');

    // Create PDF
    const doc = new jsPDF();
    let yPos = 20;

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('AI Image Generation Learning Study', 105, yPos, { align: 'center' });
    yPos += 8;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text('Summary Report', 105, yPos, { align: 'center' });
    yPos += 10;
    
    // Metadata
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')}  |  Date Range: ${dateRange}  |  Status: ${statusFilter}`, 105, yPos, { align: 'center' });
    yPos += 15;
    doc.setTextColor(0);

    // Sample Characteristics
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Sample Characteristics', 14, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    autoTable(doc, {
      startY: yPos,
      head: [['Metric', 'Value']],
      body: [
        ['Total Participants', stats.rawSessions.length.toString()],
        ['Completed Sessions', stats.totalCompleted.toString()],
        ['Text Mode Participants', `${stats.textModeCompleted} (${Math.round((stats.textModeCompleted / stats.rawSessions.length) * 100) || 0}%)`],
        ['Avatar Mode Participants', `${stats.avatarModeCompleted} (${Math.round((stats.avatarModeCompleted / stats.rawSessions.length) * 100) || 0}%)`],
        ['Avg Session Duration', `${stats.avgSessionDuration} min`],
        ['Avg Avatar Interaction', `${Math.round(stats.avgAvatarTime / 60)} min`],
      ],
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 14, right: 14 },
    });
    yPos = (doc as any).lastAutoTable.finalY + 15;

    // Learning Outcomes
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Learning Outcomes', 14, yPos);
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [['Mode', 'Pre-Test %', 'Post-Test %', 'Knowledge Gain', 'n']],
      body: [
        ['Overall', `${stats.avgPreScore}%`, `${stats.avgPostScore}%`, `${stats.avgGain >= 0 ? '+' : ''}${stats.avgGain}%`, stats.knowledgeGain.length.toString()],
        ['Text Mode', `${stats.textModePreScore}%`, `${stats.textModePostScore}%`, `${stats.textModeGain >= 0 ? '+' : ''}${stats.textModeGain}%`, textKG.length.toString()],
        ['Avatar Mode', `${stats.avatarModePreScore}%`, `${stats.avatarModePostScore}%`, `${stats.avatarModeGain >= 0 ? '+' : ''}${stats.avatarModeGain}%`, avatarKG.length.toString()],
      ],
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] },
      margin: { left: 14, right: 14 },
    });
    yPos = (doc as any).lastAutoTable.finalY + 15;

    // Statistical Analysis
    if (stats.statisticalTests) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('3. Statistical Analysis (Text vs Avatar)', 14, yPos);
      yPos += 8;

      const significant = stats.statisticalTests.textVsAvatar.significant;
      autoTable(doc, {
        startY: yPos,
        head: [['Statistic', 'Value', 'Interpretation']],
        body: [
          ['t-statistic', stats.statisticalTests.textVsAvatar.tStatistic.toString(), ''],
          ['p-value', stats.statisticalTests.textVsAvatar.pValue < 0.001 ? '<0.001' : stats.statisticalTests.textVsAvatar.pValue.toString(), significant ? 'Significant (p < 0.05)' : 'Not significant'],
          ["Cohen's d", stats.statisticalTests.textVsAvatar.cohensD.toString(), `${stats.statisticalTests.textVsAvatar.effectSize} effect size`],
          ['95% CI', `[${stats.statisticalTests.textVsAvatar.ci95Lower}, ${stats.statisticalTests.textVsAvatar.ci95Upper}]`, ''],
          ['Text Mean (SD)', `${stats.statisticalTests.textVsAvatar.textMean}% (±${stats.statisticalTests.textVsAvatar.textStd})`, `n=${stats.statisticalTests.textVsAvatar.textN}`],
          ['Avatar Mean (SD)', `${stats.statisticalTests.textVsAvatar.avatarMean}% (±${stats.statisticalTests.textVsAvatar.avatarStd})`, `n=${stats.statisticalTests.textVsAvatar.avatarN}`],
        ],
        theme: 'striped',
        headStyles: { fillColor: [139, 92, 246] },
        margin: { left: 14, right: 14 },
      });
      yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    // Perception Analysis
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('4. Perception Analysis (Likert 1-5)', 14, yPos);
    yPos += 8;

    const trustAvg = stats.likertAnalysis.filter(l => l.category === 'trust').reduce((sum, l) => sum + l.mean, 0) / Math.max(stats.likertAnalysis.filter(l => l.category === 'trust').length, 1);
    const engagementAvg = stats.likertAnalysis.filter(l => l.category === 'engagement').reduce((sum, l) => sum + l.mean, 0) / Math.max(stats.likertAnalysis.filter(l => l.category === 'engagement').length, 1);
    const satisfactionAvg = stats.likertAnalysis.filter(l => l.category === 'satisfaction').reduce((sum, l) => sum + l.mean, 0) / Math.max(stats.likertAnalysis.filter(l => l.category === 'satisfaction').length, 1);

    autoTable(doc, {
      startY: yPos,
      head: [['Category', 'Overall Mean', 'Text Mode', 'Avatar Mode']],
      body: [
        ['Trust', trustAvg.toFixed(2), 
          (stats.likertByMode.text.filter(l => l.category === 'trust').reduce((sum, l) => sum + l.mean, 0) / Math.max(stats.likertByMode.text.filter(l => l.category === 'trust').length, 1)).toFixed(2),
          (stats.likertByMode.avatar.filter(l => l.category === 'trust').reduce((sum, l) => sum + l.mean, 0) / Math.max(stats.likertByMode.avatar.filter(l => l.category === 'trust').length, 1)).toFixed(2)
        ],
        ['Engagement', engagementAvg.toFixed(2),
          (stats.likertByMode.text.filter(l => l.category === 'engagement').reduce((sum, l) => sum + l.mean, 0) / Math.max(stats.likertByMode.text.filter(l => l.category === 'engagement').length, 1)).toFixed(2),
          (stats.likertByMode.avatar.filter(l => l.category === 'engagement').reduce((sum, l) => sum + l.mean, 0) / Math.max(stats.likertByMode.avatar.filter(l => l.category === 'engagement').length, 1)).toFixed(2)
        ],
        ['Satisfaction', satisfactionAvg.toFixed(2),
          (stats.likertByMode.text.filter(l => l.category === 'satisfaction').reduce((sum, l) => sum + l.mean, 0) / Math.max(stats.likertByMode.text.filter(l => l.category === 'satisfaction').length, 1)).toFixed(2),
          (stats.likertByMode.avatar.filter(l => l.category === 'satisfaction').reduce((sum, l) => sum + l.mean, 0) / Math.max(stats.likertByMode.avatar.filter(l => l.category === 'satisfaction').length, 1)).toFixed(2)
        ],
      ],
      theme: 'striped',
      headStyles: { fillColor: [236, 72, 153] },
      margin: { left: 14, right: 14 },
    });
    yPos = (doc as any).lastAutoTable.finalY + 15;

    // Check if we need a new page
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    // Question Performance
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('5. Question Performance', 14, yPos);
    yPos += 8;

    const questionData = [
      ...stats.preTestQuestionAnalysis.slice(0, 5).map(q => ['Pre-Test', q.questionText.slice(0, 50) + '...', `${q.correctRate}%`, q.totalResponses.toString()]),
      ...stats.postTestQuestionAnalysis.slice(0, 5).map(q => ['Post-Test', q.questionText.slice(0, 50) + '...', `${q.correctRate}%`, q.totalResponses.toString()]),
    ];

    if (questionData.length > 0) {
      autoTable(doc, {
        startY: yPos,
        head: [['Test', 'Question (truncated)', 'Correct %', 'n']],
        body: questionData,
        theme: 'striped',
        headStyles: { fillColor: [245, 158, 11] },
        margin: { left: 14, right: 14 },
        columnStyles: {
          1: { cellWidth: 80 },
        },
      });
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Generated by AI Image Generation Learning Study Dashboard', 105, 285, { align: 'center' });

    // Save PDF
    doc.save(`publication_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
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
    { name: 'Text Mode', gain: stats.textModeGain, preScore: stats.textModePreScore, postScore: stats.textModePostScore, count: stats.textModeCompleted },
    { name: 'Avatar Mode', gain: stats.avatarModeGain, preScore: stats.avatarModePreScore, postScore: stats.avatarModePostScore, count: stats.avatarModeCompleted },
  ];

  return (
    <div className="space-y-6">
      {/* Filters & Export Section */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="pt-4 space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
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
            
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
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
          </div>

          {/* Export Buttons */}
          <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-slate-700">
            <span className="text-xs text-slate-500 uppercase tracking-wider mr-2">Export:</span>
            <Button variant="outline" size="sm" onClick={exportComprehensiveCSV} className="gap-2 border-slate-600 h-8 text-xs">
              <FileSpreadsheet className="w-3 h-3" />
              Full CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportComprehensiveJSON} className="gap-2 border-slate-600 h-8 text-xs">
              <Download className="w-3 h-3" />
              Full JSON
            </Button>
            <Button variant="default" size="sm" onClick={exportPublicationReport} className="gap-2 h-8 text-xs bg-emerald-600 hover:bg-emerald-700">
              <FileText className="w-3 h-3" />
              PDF Report
            </Button>
            <Badge variant="secondary" className="ml-auto">
              {stats.rawSessions.length} sessions • {stats.knowledgeGain.length} with scores
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      {(stats.missingCorrectAnswers.preTest > 0 || stats.missingCorrectAnswers.postTest > 0) && (
        <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-4 text-sm text-amber-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Missing Correct Answers:</strong> Knowledge gain analysis requires correct answers to be set.
            {stats.missingCorrectAnswers.preTest > 0 && (
              <span className="block">• {stats.missingCorrectAnswers.preTest} pre-test questions missing correct answers</span>
            )}
            {stats.missingCorrectAnswers.postTest > 0 && (
              <span className="block">• {stats.missingCorrectAnswers.postTest} post-test knowledge questions missing correct answers</span>
            )}
            <span className="block mt-1 text-amber-300">Go to Questions tab to set correct answers.</span>
          </div>
        </div>
      )}

      {/* Summary Stats - Combined */}
      <Card className="bg-gradient-to-r from-slate-800 to-slate-800/80 border-slate-700">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-primary" />
              Summary Statistics
            </CardTitle>
            <Badge variant="outline" className="text-slate-400">
              {statusFilter === 'completed' ? 'Completed sessions' : statusFilter === 'incomplete' ? 'Incomplete sessions' : 'All sessions'}
            </Badge>
          </div>
          <CardDescription className="text-slate-400">
            Key metrics for {stats.rawSessions.length} sessions in selected range
            {stats.knowledgeGain.length < stats.rawSessions.length && (
              <span className="text-amber-400"> • {stats.rawSessions.length - stats.knowledgeGain.length} sessions missing score data</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-400 mb-1">Sessions</div>
              <div className="text-2xl font-bold text-white">{stats.rawSessions.length}</div>
              <div className="text-[10px] text-slate-500 mt-1">{statusFilter}</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-400 mb-1">Avg Pre-Test</div>
              <div className="text-2xl font-bold text-red-400">{stats.avgPreScore || 0}%</div>
              <div className="text-[10px] text-slate-500 mt-1">n={stats.knowledgeGain.length}</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-400 mb-1">Avg Post-Test</div>
              <div className="text-2xl font-bold text-green-400">{stats.avgPostScore || 0}%</div>
              <div className="text-[10px] text-slate-500 mt-1">n={stats.knowledgeGain.length}</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-400 mb-1">Avg Gain</div>
              <div className={`text-2xl font-bold ${stats.avgGain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {stats.avgGain >= 0 ? '+' : ''}{stats.avgGain || 0}%
              </div>
              <div className="text-[10px] text-slate-500 mt-1">learning effect</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-400 mb-1">Avg Session</div>
              <div className="text-2xl font-bold text-yellow-400">{stats.avgSessionDuration} min</div>
              <div className="text-[10px] text-slate-500 mt-1">duration</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-400 mb-1">Avg Avatar</div>
              <div className="text-2xl font-bold text-purple-400">{Math.round(stats.avgAvatarTime / 60)} min</div>
              <div className="text-[10px] text-slate-500 mt-1">interaction</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-2">Mode Distribution</div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-blue-400">Text:</span><span>{stats.textModeCompleted}</span></div>
                <div className="flex justify-between"><span className="text-purple-400">Avatar:</span><span>{stats.avatarModeCompleted}</span></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Knowledge Gain Analysis */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                Knowledge Gain Analysis
              </CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 text-slate-500 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">Post-Test Score minus Pre-Test Score. Only sessions with BOTH pre-test AND post-test scored responses are included. If you have {stats.rawSessions.length} sessions but only {stats.knowledgeGain.length} with scores, some sessions are missing pre-test or post-test answers, or questions don't have correct answers set.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <ExportButton onClick={exportKnowledgeGainCSV} label="CSV" />
          </div>
          <CardDescription className="text-slate-400">
            Based on {stats.knowledgeGain.length} of {stats.rawSessions.length} sessions with complete scored data
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats.knowledgeGain.length > 0 ? (
            <div className="space-y-6">
              {/* Mode-specific breakdown - Only Text and Avatar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Text Mode */}
                <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
                  <div className="text-sm font-medium text-blue-400 mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-400" />
                      Text Mode
                    </div>
                    <span className="text-slate-500 text-xs">n={stats.knowledgeGain.filter(k => k.mode === 'text').length}</span>
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

                {/* Avatar Mode */}
                <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-4">
                  <div className="text-sm font-medium text-purple-400 mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-400" />
                      Avatar Mode
                    </div>
                    <span className="text-slate-500 text-xs">n={stats.knowledgeGain.filter(k => k.mode === 'avatar').length}</span>
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
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-3">Pre-Test vs Post-Test (Overall)</h4>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={prePostComparisonData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                      <YAxis stroke="#9ca3af" fontSize={12} domain={[0, 100]} />
                      <ChartTooltip 
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                        formatter={(value: number) => [`${value}%`, 'Avg Score']}
                      />
                      <Bar dataKey="score">
                        {prePostComparisonData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-slate-300 mb-3">Pre vs Post by Mode</h4>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={modeGainData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} />
                      <YAxis stroke="#9ca3af" fontSize={12} domain={[0, 100]} />
                      <ChartTooltip 
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                        formatter={(value: number, name: string) => [`${value}%`, name]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="preScore" name="Pre-Test" fill="#ef4444" />
                      <Bar dataKey="postScore" name="Post-Test" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Statistical Significance Testing */}
              {stats.statisticalTests && (
                <div className="border-t border-slate-700 pt-4">
                  <div className="flex items-center gap-2 mb-4">
                    <h4 className="text-sm font-medium text-slate-300">Statistical Analysis (Welch's t-test + Effect Size)</h4>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-slate-500 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm">
                          <p className="text-xs">
                            <strong>p-value:</strong> &lt;0.05 = significant difference.<br/>
                            <strong>Cohen's d:</strong> Effect magnitude (0.2=small, 0.5=medium, 0.8=large).<br/>
                            <strong>95% CI:</strong> Range within which true mean difference likely falls.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  
                  {/* Main comparison: Text vs Avatar */}
                  <div className={`rounded-lg p-4 border mb-4 ${stats.statisticalTests.textVsAvatar.significant ? 'bg-green-900/20 border-green-700/50' : 'bg-slate-700/30 border-slate-600'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-medium text-slate-200">Text Mode vs Avatar Mode</div>
                      <div className={`px-2 py-0.5 rounded text-xs font-medium ${
                        stats.statisticalTests.textVsAvatar.effectSize === 'large' ? 'bg-purple-500/30 text-purple-300' :
                        stats.statisticalTests.textVsAvatar.effectSize === 'medium' ? 'bg-blue-500/30 text-blue-300' :
                        stats.statisticalTests.textVsAvatar.effectSize === 'small' ? 'bg-yellow-500/30 text-yellow-300' :
                        'bg-slate-600/50 text-slate-400'
                      }`}>
                        {stats.statisticalTests.textVsAvatar.effectSize} effect
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {/* Left: Descriptive stats */}
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Text Mean (SD):</span>
                          <span className="text-blue-400">{stats.statisticalTests.textVsAvatar.textMean}% (±{stats.statisticalTests.textVsAvatar.textStd})</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Avatar Mean (SD):</span>
                          <span className="text-purple-400">{stats.statisticalTests.textVsAvatar.avatarMean}% (±{stats.statisticalTests.textVsAvatar.avatarStd})</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Sample sizes:</span>
                          <span className="text-slate-300">n₁={stats.statisticalTests.textVsAvatar.textN}, n₂={stats.statisticalTests.textVsAvatar.avatarN}</span>
                        </div>
                      </div>
                      
                      {/* Right: Inferential stats */}
                      <div className="space-y-2 text-xs border-l border-slate-600 pl-4">
                        <div className="flex justify-between">
                          <span className="text-slate-400">t-statistic:</span>
                          <span className="text-white font-medium">{stats.statisticalTests.textVsAvatar.tStatistic}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">p-value:</span>
                          <span className={stats.statisticalTests.textVsAvatar.significant ? 'text-green-400 font-medium' : 'text-slate-300'}>
                            {stats.statisticalTests.textVsAvatar.pValue < 0.001 ? '<0.001' : stats.statisticalTests.textVsAvatar.pValue}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Cohen's d:</span>
                          <span className="text-white font-medium">{stats.statisticalTests.textVsAvatar.cohensD}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">95% CI:</span>
                          <span className="text-cyan-400">[{stats.statisticalTests.textVsAvatar.ci95Lower}, {stats.statisticalTests.textVsAvatar.ci95Upper}]</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className={`mt-3 text-xs text-center py-1.5 rounded ${stats.statisticalTests.textVsAvatar.significant ? 'bg-green-500/20 text-green-400' : 'bg-slate-600/50 text-slate-400'}`}>
                      {stats.statisticalTests.textVsAvatar.significant 
                        ? `✓ Significant (p < 0.05) with ${stats.statisticalTests.textVsAvatar.effectSize} effect size` 
                        : 'Not statistically significant'}
                    </div>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[150px] text-slate-500">
              <AlertTriangle className="w-8 h-8 mb-2 text-amber-500" />
              <p>No knowledge gain data available</p>
              <p className="text-xs mt-1">Requires both pre-test and post-test questions to have correct answers set</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Question Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-white text-sm">Pre-Test Performance</CardTitle>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-slate-500 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">% of participants who answered correctly BEFORE learning. Low scores = knowledge gaps.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <ExportButton onClick={exportQuestionPerformanceCSV} label="CSV" size="xs" />
            </div>
          </CardHeader>
          <CardContent>
            {stats.preTestQuestionAnalysis.length > 0 ? (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {stats.preTestQuestionAnalysis.map(q => (
                  <div key={q.questionId} className="bg-slate-700/30 rounded-lg p-3">
                    <div className="text-xs text-slate-300 mb-2 line-clamp-2" title={q.questionText}>
                      {q.questionText}
                    </div>
                    <div className="flex items-center gap-3">
                      {q.hasCorrectAnswer ? (
                        <>
                          <Progress value={q.correctRate} className="h-2 flex-1" />
                          <span className={`text-sm font-medium min-w-[40px] text-right ${q.correctRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                            {q.correctRate}%
                          </span>
                        </>
                      ) : (
                        <span className="text-amber-400 text-xs">⚠ No correct answer set</span>
                      )}
                      <span className="text-slate-500 text-xs">n={q.totalResponses}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-8 text-sm">No pre-test data</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-white text-sm">Post-Test Performance</CardTitle>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-slate-500 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">% of participants who answered correctly AFTER learning. Compare with pre-test to measure effectiveness.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <ExportButton onClick={exportQuestionPerformanceCSV} label="CSV" size="xs" />
            </div>
          </CardHeader>
          <CardContent>
            {stats.postTestQuestionAnalysis.length > 0 ? (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {stats.postTestQuestionAnalysis.map(q => (
                  <div key={q.questionId} className="bg-slate-700/30 rounded-lg p-3">
                    <div className="text-xs text-slate-300 mb-2 line-clamp-2" title={q.questionText}>
                      {q.questionText}
                    </div>
                    <div className="flex items-center gap-3">
                      {q.hasCorrectAnswer ? (
                        <>
                          <Progress value={q.correctRate} className="h-2 flex-1" />
                          <span className={`text-sm font-medium min-w-[40px] text-right ${q.correctRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                            {q.correctRate}%
                          </span>
                        </>
                      ) : (
                        <span className="text-amber-400 text-xs">⚠ No correct answer set</span>
                      )}
                      <span className="text-slate-500 text-xs">n={q.totalResponses}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-8 text-sm">No post-test data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Likert Scale Perception Analysis - Trust, Engagement, Satisfaction */}
      {stats.likertAnalysis.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-white">Perception Analysis (Trust, Engagement, Satisfaction)</CardTitle>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-slate-500 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p className="text-xs">5-point Likert scale responses (1=Strongly Disagree, 5=Strongly Agree). Mean closer to 5 = positive perception. Shows participant attitudes toward the learning experience.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex gap-2">
                <ExportButton onClick={exportLikertCSV} label="CSV" size="xs" />
                <ExportButton onClick={exportLikertByModeCSV} label="By Mode" size="xs" />
              </div>
            </div>
            <CardDescription className="text-slate-400">
              Participant attitudes and perceptions measured on 5-point Likert scale
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Overall Summary by Category */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(['trust', 'engagement', 'satisfaction'] as const).map(category => {
                  const categoryData = stats.likertAnalysis.filter(l => l.category === category);
                  const avgMean = categoryData.length > 0
                    ? Math.round((categoryData.reduce((sum, l) => sum + l.mean, 0) / categoryData.length) * 100) / 100
                    : 0;
                  const totalResponses = categoryData.reduce((sum, l) => sum + l.totalResponses, 0);
                  
                  const categoryColors = {
                    trust: { bg: 'bg-blue-900/20', border: 'border-blue-700/50', text: 'text-blue-400', dot: 'bg-blue-400' },
                    engagement: { bg: 'bg-green-900/20', border: 'border-green-700/50', text: 'text-green-400', dot: 'bg-green-400' },
                    satisfaction: { bg: 'bg-purple-900/20', border: 'border-purple-700/50', text: 'text-purple-400', dot: 'bg-purple-400' },
                  };
                  const colors = categoryColors[category];
                  
                  return (
                    <div key={category} className={`${colors.bg} border ${colors.border} rounded-lg p-4`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                          <span className={`text-sm font-medium ${colors.text} capitalize`}>{category}</span>
                        </div>
                        <span className="text-slate-500 text-xs">n={totalResponses / categoryData.length || 0}</span>
                      </div>
                      <div className="text-3xl font-bold text-white mb-2">{avgMean.toFixed(2)}</div>
                      <div className="flex items-center gap-2">
                        <Progress value={(avgMean / 5) * 100} className="h-2 flex-1" />
                        <span className="text-xs text-slate-400">/5.0</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        {avgMean >= 4 ? 'Very positive' : avgMean >= 3 ? 'Moderately positive' : avgMean >= 2 ? 'Neutral' : 'Needs improvement'}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* By Mode Comparison */}
              <div className="border-t border-slate-700 pt-4">
                <h4 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
                  Perception by Learning Mode
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3 h-3 text-slate-500 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Compare how participants in each learning mode rated their experience</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(['text', 'avatar'] as const).map(mode => {
                    const modeData = stats.likertByMode[mode];
                    const trustAvg = modeData.filter(l => l.category === 'trust').reduce((sum, l) => sum + l.mean, 0) / Math.max(modeData.filter(l => l.category === 'trust').length, 1);
                    const engagementAvg = modeData.filter(l => l.category === 'engagement').reduce((sum, l) => sum + l.mean, 0) / Math.max(modeData.filter(l => l.category === 'engagement').length, 1);
                    const satisfactionAvg = modeData.filter(l => l.category === 'satisfaction').reduce((sum, l) => sum + l.mean, 0) / Math.max(modeData.filter(l => l.category === 'satisfaction').length, 1);
                    const sampleSize = modeData.length > 0 ? modeData[0].totalResponses : 0;

                    const modeColors = {
                      text: 'border-blue-600',
                      avatar: 'border-purple-600',
                    };

                    return (
                      <div key={mode} className={`bg-slate-700/30 rounded-lg p-4 border-l-4 ${modeColors[mode]}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-200 capitalize">{mode} Mode</span>
                          </div>
                          <span className="text-slate-500 text-xs">n={sampleSize}</span>
                        </div>
                        {modeData.length > 0 ? (
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between items-center">
                              <span className="text-blue-400">Trust:</span>
                              <div className="flex items-center gap-2">
                                <Progress value={(trustAvg / 5) * 100} className="h-1.5 w-16" />
                                <span className="text-white font-medium w-8 text-right">{trustAvg.toFixed(1)}</span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-green-400">Engagement:</span>
                              <div className="flex items-center gap-2">
                                <Progress value={(engagementAvg / 5) * 100} className="h-1.5 w-16" />
                                <span className="text-white font-medium w-8 text-right">{engagementAvg.toFixed(1)}</span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-purple-400">Satisfaction:</span>
                              <div className="flex items-center gap-2">
                                <Progress value={(satisfactionAvg / 5) * 100} className="h-1.5 w-16" />
                                <span className="text-white font-medium w-8 text-right">{satisfactionAvg.toFixed(1)}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-slate-500 text-xs">No data</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Individual Questions */}
              <div className="border-t border-slate-700 pt-4">
                <h4 className="text-sm font-medium text-slate-300 mb-4">Individual Question Responses</h4>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {stats.likertAnalysis.map(l => {
                    const categoryColors = {
                      trust: 'border-l-blue-500',
                      engagement: 'border-l-green-500',
                      satisfaction: 'border-l-purple-500',
                    };
                    
                    return (
                      <div key={l.questionId} className={`bg-slate-700/30 rounded-lg p-3 border-l-4 ${categoryColors[l.category]}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{l.category}</div>
                            <div className="text-sm text-slate-200 mb-2">{l.questionText}</div>
                            <div className="flex items-center gap-4 text-xs">
                              <span className="text-slate-400">Mean: <span className="text-white font-medium">{l.mean.toFixed(2)}</span></span>
                              <span className="text-slate-400">Median: <span className="text-white font-medium">{l.median}</span></span>
                              <span className="text-slate-400">SD: <span className="text-white font-medium">{l.std.toFixed(2)}</span></span>
                              <span className="text-slate-500">n={l.totalResponses}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map(score => (
                              <div key={score} className="text-center">
                                <div className="text-[10px] text-slate-500 mb-0.5">{score}</div>
                                <div 
                                  className="w-6 bg-slate-600 rounded-sm" 
                                  style={{ height: `${Math.max(4, (l.distribution[score] / l.totalResponses) * 40)}px` }}
                                  title={`${score}: ${l.distribution[score]} responses (${Math.round((l.distribution[score] / l.totalResponses) * 100)}%)`}
                                />
                                <div className="text-[9px] text-slate-500 mt-0.5">{l.distribution[score]}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">Demographic Distribution</CardTitle>
            <ExportButton onClick={exportDemographicsCSV} label="CSV" />
          </div>
          <CardDescription className="text-slate-400">Participant background data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Age */}
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                Age Distribution
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3 h-3 text-slate-500 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Participant age groups (sorted youngest to oldest)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </h4>
              {stats.demographicBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={stats.demographicBreakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                    <XAxis type="number" stroke="#9ca3af" fontSize={11} />
                    <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={10} width={50} />
                    <ChartTooltip 
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                      formatter={(value: number) => [`${value}`, 'Count']}
                    />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[180px] text-slate-500 text-sm">No data</div>
              )}
            </div>

            {/* Education */}
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                Education Level
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3 h-3 text-slate-500 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Highest education level completed</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </h4>
              {stats.educationBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={stats.educationBreakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                    <XAxis type="number" stroke="#9ca3af" fontSize={11} />
                    <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={9} width={70} tick={{ fontSize: 9 }} />
                    <ChartTooltip 
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                      formatter={(value: number) => [`${value}`, 'Count']}
                    />
                    <Bar dataKey="value" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[180px] text-slate-500 text-sm">No data</div>
              )}
            </div>

            {/* Digital Experience */}
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                Digital Experience
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3 h-3 text-slate-500 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Self-reported digital/AI experience (1=None, 5=Extensive)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </h4>
              {stats.experienceBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={stats.experienceBreakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                    <XAxis type="number" stroke="#9ca3af" fontSize={11} />
                    <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={8} width={80} tick={{ fontSize: 8 }} />
                    <ChartTooltip 
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                      formatter={(value: number) => [`${value}`, 'Count']}
                    />
                    <Bar dataKey="value" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[180px] text-slate-500 text-sm">No data</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Correlation: Session Time vs Knowledge Gain */}
      {stats.correlations.sessionTimeVsGain.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-white">Session Duration vs Knowledge Gain</CardTitle>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-slate-500 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">Each dot = 1 session. Shows relationship between total study time and learning improvement. Positive correlation would suggest longer study = more learning.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <ExportButton onClick={exportCorrelationCSV} label="CSV" />
            </div>
            <CardDescription className="text-slate-400">
              {stats.correlations.sessionTimeVsGain.length} sessions with scored data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  type="number" 
                  dataKey="x" 
                  name="Session Time" 
                  stroke="#9ca3af"
                  fontSize={11}
                  label={{ value: 'Session Duration (minutes)', position: 'bottom', offset: 20, fill: '#9ca3af', fontSize: 11 }}
                />
                <YAxis 
                  type="number" 
                  dataKey="y" 
                  name="Knowledge Gain" 
                  stroke="#9ca3af"
                  fontSize={11}
                  label={{ value: 'Knowledge Gain (%)', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11, dx: -10 }}
                />
                <ZAxis range={[60, 60]} />
                <ChartTooltip 
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                  formatter={(value: number, name: string) => {
                    if (name === 'Session Time') return [`${value} min`, 'Duration'];
                    if (name === 'Knowledge Gain') return [`${value}%`, 'Gain'];
                    return [value, name];
                  }}
                />
                <Scatter 
                  name="Sessions" 
                  data={stats.correlations.sessionTimeVsGain} 
                  fill="#10b981"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Avatar Time by Slide */}
      {stats.avatarTimeBySlide.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white">Avatar Interaction by Slide</CardTitle>
                <CardDescription className="text-slate-400">
                  Avg time participants spent with avatar on each slide
                </CardDescription>
              </div>
              <ExportButton 
                onClick={() => downloadCSV(stats.avatarTimeBySlide.map(s => ({ Slide: s.slide, AvgTimeSeconds: s.avgTime, TotalTimeSeconds: s.totalTime, SessionCount: s.count })), 'avatar_time_by_slide')} 
                label="CSV" 
              />
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.avatarTimeBySlide}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="slide" stroke="#9ca3af" fontSize={9} angle={-15} textAnchor="end" height={50} />
                <YAxis stroke="#9ca3af" fontSize={11} label={{ value: 'Avg seconds', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 10 }} />
                <ChartTooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                  formatter={(value: number, name: string) => {
                    if (name === 'avgTime') return [`${value}s`, 'Avg Time'];
                    if (name === 'count') return [value, 'Sessions'];
                    return [value, name];
                  }}
                />
                <Bar dataKey="avgTime" name="Avg Time (s)" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
              <div className="bg-slate-700/50 rounded p-2 text-center">
                <div className="text-slate-400 text-xs">Total Time</div>
                <div className="text-white font-medium">{Math.round(stats.totalAvatarTime / 60)} min</div>
              </div>
              <div className="bg-slate-700/50 rounded p-2 text-center">
                <div className="text-slate-400 text-xs">Avg per Session</div>
                <div className="text-white font-medium">{Math.round(stats.avgAvatarTime / 60)} min</div>
              </div>
              <div className="bg-slate-700/50 rounded p-2 text-center">
                <div className="text-slate-400 text-xs">Sessions Tracked</div>
                <div className="text-white font-medium">{Object.keys(stats.avatarTimeBySlide).length > 0 ? new Set(stats.avatarTimeData.map(t => t.session_id)).size : 0}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sessions per Day */}
      {stats.sessionsPerDay.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white">Sessions Over Time</CardTitle>
                <CardDescription className="text-slate-400">Daily session count</CardDescription>
              </div>
              <ExportButton 
                onClick={() => downloadCSV(stats.sessionsPerDay.map(s => ({ Date: s.date, SessionCount: s.count })), 'sessions_per_day')} 
                label="CSV" 
              />
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={stats.sessionsPerDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} />
                <YAxis stroke="#9ca3af" fontSize={11} allowDecimals={false} />
                <ChartTooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                  formatter={(value: number) => [value, 'Sessions']}
                />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminOverview;
