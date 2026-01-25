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
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import QuestionPerformanceByMode from "./QuestionPerformanceByMode";
import { describeSuspicionFlag, getSuspicionRequirements } from "@/lib/suspicion";
import { META_DIALOGUE_ID, META_TIMING_ID, isTelemetryMetaQuestionId } from "@/lib/sessionTelemetry";
import { buildSlideLookup, resolveSlideKey } from "@/lib/slideTiming";
import { canUseTutorDialogueTable } from "@/lib/tutorDialogueAvailability";

interface AvatarTimeData {
  session_id: string;
  slide_id: string;
  slide_title: string;
  duration_seconds: number;
  started_at: string;
  mode?: string | null;
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
  learningTime: number;
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
  learningTimeVsGain: { x: number; y: number; mode: string }[];
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
  noModeCount: number;
  avgSessionDuration: number;
  avgAvatarTime: number;
  avgTextTime: number;
  totalAvatarTime: number;
  totalTextTime: number;
  avatarSessionsTracked: number;
  textSessionsTracked: number;
  sessionsPerDay: { date: string; count: number }[];
  demographicBreakdown: { name: string; value: number }[];
  educationBreakdown: { name: string; value: number }[];
  experienceBreakdown: { name: string; value: number }[];
  modeComparison: { name: string; count: number }[];
  avatarTimeBySlide: { slideId: string; slide: string; avgTime: number; totalTime: number; count: number }[];
  textTimeBySlide: { slideId: string; slide: string; avgTime: number; totalTime: number; count: number }[];
  pageTimeByPage: { page: string; avgTime: number; totalTime: number; count: number }[];
  avatarTimeData: AvatarTimeData[];
  pageTimeData: AvatarTimeData[];
  knowledgeGain: KnowledgeGainData[];
  missingScoreSessions: Array<{ sessionId: string; mode: string; reasons: string[] }>;
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
  // Suspicious session stats
  suspiciousCount: number;
  avgSuspicionScore: number;
  suspiciousFlags: { flag: string; count: number }[];
  resetCount: number;
  ignoredCount: number;
  acceptedCount: number;
  pendingCount: number;
  awaitingApprovalCount: number;
  dialogueByMode: {
    mode: 'text' | 'avatar' | 'both' | 'none';
    label: string;
    messages: number;
    sessions: number;
  }[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

type StatusFilter = 'completed' | 'all' | 'incomplete' | 'reset';

// Sorting helpers
const AGE_ORDER = ['18-24', '25-34', '35-44', '45-54', '55-64', '65-69', '70+', 'Prefer not to say'];
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

const resolveSessionMode = (session: { modes_used?: string[] | null; mode?: string | null }) => {
  const modesUsed = session.modes_used && session.modes_used.length > 0
    ? session.modes_used
    : (session.mode ? [session.mode] : []);
  if (modesUsed.length === 0) return 'none';
  if (modesUsed.includes('text') && modesUsed.includes('avatar')) return 'both';
  if (modesUsed.includes('avatar')) return 'avatar';
  if (modesUsed.includes('text')) return 'text';
  return 'none';
};

const hasMeaningfulAnswer = (answer: unknown) => {
  if (answer === null || answer === undefined) return false;
  if (typeof answer === 'string') return answer.trim() !== '';
  return true;
};

const isPageEntry = (entry: { slide_id?: string }) =>
  typeof entry.slide_id === 'string' && entry.slide_id.startsWith('page:');
const resolveTimingMode = (
  entryMode: unknown,
  sessionMode: 'text' | 'avatar' | 'both' | 'none'
): 'text' | 'avatar' | 'page' | null => {
  if (entryMode === 'text' || entryMode === 'avatar' || entryMode === 'page') {
    return entryMode;
  }
  if (sessionMode === 'text' || sessionMode === 'avatar') {
    return sessionMode;
  }
  return null;
};
const isDemoFallbackQuestionId = (questionId: string) => questionId.startsWith('demo-');
const normalizeDemoQuestionId = (questionId: string) =>
  questionId.startsWith('demo-demo-') ? questionId.replace(/^demo-/, '') : questionId;

const parseTimingMetaEntries = (answer?: string | null) => {
  if (!answer) return [] as any[];
  try {
    const parsed = JSON.parse(answer);
    return Array.isArray(parsed?.entries) ? parsed.entries : [];
  } catch {
    return [];
  }
};

const parseDialogueMetaEntries = (answer?: string | null) => {
  if (!answer) return [] as any[];
  try {
    const parsed = JSON.parse(answer);
    return Array.isArray(parsed?.messages) ? parsed.messages : [];
  } catch {
    return [];
  }
};

const extractMetaPayload = (rows: any[], baseId: string) => {
  const direct = rows
    .filter((row) => row.question_id === baseId)
    .reduce((latest, row) => {
      if (!latest) return row;
      const latestTime = latest.created_at ? new Date(latest.created_at).getTime() : 0;
      const rowTime = row.created_at ? new Date(row.created_at).getTime() : 0;
      return rowTime >= latestTime ? row : latest;
    }, null as any);

  const directPayload = direct?.answer ? String(direct.answer) : null;
  const directTime = direct?.created_at ? new Date(direct.created_at).getTime() : 0;

  const partPrefix = `${baseId}__batch_`;
  const partRegex = new RegExp(`^${baseId}__batch_(.+)__part_(\\d+)$`);
  const partRows = rows.filter(
    (row) => typeof row.question_id === 'string' && row.question_id.startsWith(partPrefix)
  );
  if (partRows.length === 0) return directPayload;

  const batches = new Map<string, { createdAt: number; parts: Map<number, string> }>();
  partRows.forEach((row) => {
    const match = String(row.question_id).match(partRegex);
    if (!match) return;
    const batchId = match[1];
    const index = Number(match[2]);
    if (!Number.isFinite(index)) return;
    const createdAt = row.created_at ? new Date(row.created_at).getTime() : 0;
    const bucket = batches.get(batchId) || { createdAt, parts: new Map<number, string>() };
    bucket.createdAt = Math.max(bucket.createdAt, createdAt);
    bucket.parts.set(index, row.answer || '');
    batches.set(batchId, bucket);
  });

  let latestBatch: { createdAt: number; parts: Map<number, string> } | null = null;
  batches.forEach((batch) => {
    if (!latestBatch || batch.createdAt >= latestBatch.createdAt) {
      latestBatch = batch;
    }
  });
  if (!latestBatch) return directPayload;

  const combined = Array.from(latestBatch.parts.entries())
    .sort((a, b) => a[0] - b[0])
    .map((entry) => entry[1])
    .join('');
  if (!combined) return directPayload;
  if (!directPayload) return combined;
  return latestBatch.createdAt >= directTime ? combined : directPayload;
};

// Helper component for section CSV export - accepts canExport to hide for viewers
const ExportButton = ({ onClick, label, size = "sm", canExport = true }: { onClick: () => void; label: string; size?: "sm" | "xs"; canExport?: boolean }) => {
  if (!canExport) return null;
  return (
    <Button 
      variant="ghost" 
      size={size === "xs" ? "sm" : size}
      onClick={onClick} 
      className={`gap-1 text-muted-foreground hover:text-white ${size === "xs" ? "h-6 px-2 text-xs" : ""}`}
    >
      <Download className={size === "xs" ? "w-3 h-3" : "w-4 h-4"} />
      {label}
    </Button>
  );
};

import { getPermissions } from "@/lib/permissions";

interface AdminOverviewProps {
  userEmail?: string;
}

const AdminOverview = ({ userEmail = '' }: AdminOverviewProps) => {
  const permissions = getPermissions(userEmail);
  const [stats, setStats] = useState<StudyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('completed');
  const [activeSlideCount, setActiveSlideCount] = useState(0);
  const [includeFlagged, setIncludeFlagged] = useState(false);
  const [includeImputed, setIncludeImputed] = useState(true);
  const [showMissingScores, setShowMissingScores] = useState(false);
  const [likertView, setLikertView] = useState<'overall' | 'text' | 'avatar' | 'both'>('overall');

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

      // IMPORTANT: Filter out reset/invalid sessions AND ignored sessions from statistics by default
      // Reset sessions are those where users tried to switch modes or other invalid actions
      // Ignored sessions are those manually marked as invalid by admins
      // CRITICAL: Suspicious sessions (suspicion_score > 0) must be explicitly ACCEPTED to be included
      const validSessions = allSessions?.filter(s => {
        // Exclude reset sessions
        if (s.status === 'reset') return false;
        // Exclude ignored sessions
        if (s.validation_status === 'ignored') return false;
        // For suspicious sessions (flagged), only include if explicitly accepted (unless override enabled)
        const isFlagged =
          (s.suspicion_score || 0) > 0 ||
          (Array.isArray(s.suspicious_flags) && s.suspicious_flags.length > 0);
        if (isFlagged && s.validation_status !== 'accepted' && !includeFlagged) return false;
        return true;
      }) || [];
      const resetSessions = allSessions?.filter(s => s.status === 'reset') || [];
      const ignoredSessions = allSessions?.filter(s => s.validation_status === 'ignored') || [];

      // Filter sessions based on status filter
      const completedSessions = validSessions.filter(s => s.completed_at);
      const incompleteSessions = validSessions.filter(s => !s.completed_at);
      
      let sessionsToAnalyze = completedSessions;
      if (statusFilter === 'all') {
        sessionsToAnalyze = validSessions;
      } else if (statusFilter === 'incomplete') {
        sessionsToAnalyze = incompleteSessions;
      } else if (statusFilter === 'reset') {
        sessionsToAnalyze = resetSessions;
      }
      
      const sessionIds = sessionsToAnalyze.map(s => s.id);

      // Fetch all related data for sessions
      let demographicResponses: any[] = [];
      let preTestResponses: any[] = [];
      let postTestResponses: any[] = [];
      let avatarTimeData: any[] = [];
      let tutorDialogueRows: any[] = [];

      let activeSlides: { slide_id: string; title: string; sort_order: number; is_active: boolean }[] = [];
      let latestDialogueBySession = new Map<string, any>();
      if (sessionIds.length > 0) {
        const canUseTutorDialogue = await canUseTutorDialogueTable();
        const [demoRes, preRes, postRes, avatarRes, slideRes, tutorDialogueRes] = await Promise.all([
          supabase.from('demographic_responses').select('*').in('session_id', sessionIds),
          supabase.from('pre_test_responses').select('*').in('session_id', sessionIds),
          supabase.from('post_test_responses').select('*').in('session_id', sessionIds),
          supabase.from('avatar_time_tracking').select('*').in('session_id', sessionIds),
          supabase.from('study_slides').select('slide_id, title, sort_order, is_active').order('sort_order'),
          canUseTutorDialogue
            ? (supabase.from('tutor_dialogue_turns' as any) as any)
                .select('session_id')
                .in('session_id', sessionIds)
            : Promise.resolve({ data: [] as any[] }),
        ]);
        
        const rawDemographicResponses = demoRes.data || [];
        const rawPreTestResponses = preRes.data || [];
        const rawPostTestResponses = postRes.data || [];
        const rawAvatarTimeData = avatarRes.data || [];
        const rawTutorDialogueRows = tutorDialogueRes.data || [];
        const includeRow = (row: any) => includeImputed || !row?.is_imputed;
        const filteredPreTestRaw = rawPreTestResponses.filter(includeRow);
        const filteredPostTestRaw = rawPostTestResponses.filter(includeRow);
        const filteredAvatarRaw = rawAvatarTimeData.filter(includeRow);

        const demoFallbackRows = filteredPreTestRaw.filter((r) => isDemoFallbackQuestionId(r.question_id));
        const normalizedDemoFallback = demoFallbackRows.map((row) => ({
          ...row,
          question_id: normalizeDemoQuestionId(row.question_id),
        }));

        const demographicMap = new Map<string, any>();
        rawDemographicResponses.forEach((row: any) => {
          demographicMap.set(`${row.session_id}:${row.question_id}`, row);
        });
        normalizedDemoFallback.forEach((row: any) => {
          const key = `${row.session_id}:${row.question_id}`;
          if (!demographicMap.has(key)) {
            demographicMap.set(key, row);
          }
        });

        demographicResponses = Array.from(demographicMap.values());
        preTestResponses = filteredPreTestRaw.filter((r) => !isDemoFallbackQuestionId(r.question_id));
        postTestResponses = filteredPostTestRaw.filter((r) => !isTelemetryMetaQuestionId(r.question_id));

        const timingMetaRows = filteredPostTestRaw.filter(
          (r) =>
            typeof r.question_id === 'string' &&
            (r.question_id === META_TIMING_ID || r.question_id.startsWith(`${META_TIMING_ID}__batch_`))
        );
        const dialogueMetaRows = filteredPostTestRaw.filter(
          (r) =>
            typeof r.question_id === 'string' &&
            (r.question_id === META_DIALOGUE_ID || r.question_id.startsWith(`${META_DIALOGUE_ID}__batch_`))
        );

        const timingRowsBySession = new Map<string, any[]>();
        timingMetaRows.forEach((row: any) => {
          const bucket = timingRowsBySession.get(row.session_id) || [];
          bucket.push(row);
          timingRowsBySession.set(row.session_id, bucket);
        });

        const dialogueRowsBySession = new Map<string, any[]>();
        dialogueMetaRows.forEach((row: any) => {
          const bucket = dialogueRowsBySession.get(row.session_id) || [];
          bucket.push(row);
          dialogueRowsBySession.set(row.session_id, bucket);
        });

        const timingPayloadBySession = new Map<string, string>();
        timingRowsBySession.forEach((rows: any[], sessionId: string) => {
          const payload = extractMetaPayload(rows, META_TIMING_ID);
          if (payload) timingPayloadBySession.set(sessionId, payload);
        });

        latestDialogueBySession = new Map<string, any>();
        dialogueRowsBySession.forEach((rows: any[], sessionId: string) => {
          const payload = extractMetaPayload(rows, META_DIALOGUE_ID);
          if (payload) {
            latestDialogueBySession.set(sessionId, { session_id: sessionId, answer: payload });
          }
        });

        const fallbackAvatarTimeData = Array.from(timingPayloadBySession.entries()).flatMap(([sessionId, payload]) =>
          parseTimingMetaEntries(payload)
            .filter((entry: any) => entry?.slideId && typeof entry.durationSeconds === 'number')
            .map((entry: any) => ({
              session_id: sessionId,
              slide_id: entry.slideId,
              slide_title: entry.slideTitle || entry.slideId,
              duration_seconds: entry.durationSeconds ?? 0,
              started_at: entry.startedAt || null,
              mode: entry.mode || null,
            }))
        );

        const rawSlideIdsBySession = new Map<string, Set<string>>();
        const rawPageIdsBySession = new Map<string, Set<string>>();
        filteredAvatarRaw.forEach((entry: any) => {
          const targetMap = isPageEntry(entry) ? rawPageIdsBySession : rawSlideIdsBySession;
          const slideId = entry.slide_id;
          if (!slideId) return;
          const existing = targetMap.get(entry.session_id) || new Set<string>();
          existing.add(slideId);
          targetMap.set(entry.session_id, existing);
        });

        avatarTimeData = [...filteredAvatarRaw];
        fallbackAvatarTimeData.forEach((entry: any) => {
          const slideId = entry.slide_id;
          if (!slideId) return;
          if (isPageEntry(entry)) {
            const seenPages = rawPageIdsBySession.get(entry.session_id);
            if (!seenPages || !seenPages.has(slideId)) {
              avatarTimeData.push(entry);
            }
            return;
          }
          const seenSlides = rawSlideIdsBySession.get(entry.session_id);
          if (!seenSlides || !seenSlides.has(slideId)) {
            avatarTimeData.push(entry);
          }
        });
        activeSlides = (slideRes.data || []).filter((slide) => slide.is_active);
        setActiveSlideCount(activeSlides.length);
        tutorDialogueRows = rawTutorDialogueRows;
      }

      // Fetch questions referenced by current responses (include inactive ones for scoring consistency)
      const responseQuestionIds = Array.from(
        new Set([
          ...preTestResponses.map((r) => r.question_id),
          ...postTestResponses.map((r) => r.question_id),
        ])
      );
      const { data: questionsData } = responseQuestionIds.length > 0
        ? await supabase
            .from('study_questions')
            .select('question_id, question_text, correct_answer, question_type, category')
            .in('question_id', responseQuestionIds)
        : { data: [] };

      const questionMap = new Map(questionsData?.map(q => [q.question_id, q]) || []);
      
      // Count missing correct answers
      const preTestQuestions = questionsData?.filter(q => q.question_type === 'pre_test') || [];
      const postTestKnowledgeQuestions =
        questionsData?.filter(
          (q) =>
            q.question_type === 'post_test' &&
            (q.category === 'knowledge' || Boolean(q.correct_answer) || q.question_id.startsWith('knowledge-'))
        ) || [];
      const missingPreTest = preTestQuestions.filter(q => !q.correct_answer).length;
      const missingPostTest = postTestKnowledgeQuestions.filter(q => !q.correct_answer).length;

      // Calculate mode distribution - properly handle sessions with no mode
      const textModeCompleted = sessionsToAnalyze.filter(s => resolveSessionMode(s) === 'text').length;
      const avatarModeCompleted = sessionsToAnalyze.filter(s => resolveSessionMode(s) === 'avatar').length;
      const bothModesCompleted = sessionsToAnalyze.filter(s => resolveSessionMode(s) === 'both').length;
      const noModeCount = sessionsToAnalyze.filter(s => resolveSessionMode(s) === 'none').length;

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

      const sessionModeById = new Map<string, 'text' | 'avatar' | 'both' | 'none'>();
      sessionsToAnalyze.forEach((session) => {
        sessionModeById.set(session.id, resolveSessionMode(session));
      });

      const dialogueCountBySession: Record<string, number> = {};
      tutorDialogueRows.forEach((row: any) => {
        dialogueCountBySession[row.session_id] = (dialogueCountBySession[row.session_id] || 0) + 1;
      });

      const fallbackDialogueCountBySession = new Map<string, number>();
      latestDialogueBySession.forEach((row: any, sessionId: string) => {
        const count = parseDialogueMetaEntries(row?.answer).length;
        if (count > 0) {
          fallbackDialogueCountBySession.set(sessionId, count);
        }
      });

      const dialogueMessageTotals: Record<'text' | 'avatar' | 'both' | 'none', number> = {
        text: 0,
        avatar: 0,
        both: 0,
        none: 0,
      };
      const dialogueSessionTotals: Record<'text' | 'avatar' | 'both' | 'none', number> = {
        text: 0,
        avatar: 0,
        both: 0,
        none: 0,
      };

      sessionsToAnalyze.forEach((session) => {
        const mode = sessionModeById.get(session.id) || 'none';
        const dbCount = dialogueCountBySession[session.id] || 0;
        const fallbackCount = fallbackDialogueCountBySession.get(session.id) || 0;
        const count = dbCount > 0 ? dbCount : fallbackCount;
        if (count > 0) {
          dialogueMessageTotals[mode] += count;
          dialogueSessionTotals[mode] += 1;
        }
      });

      const dialogueByMode = (['text', 'avatar', 'both', 'none'] as const).map((mode) => ({
        mode,
        label: mode === 'text' ? 'Text' : mode === 'avatar' ? 'Avatar' : mode === 'both' ? 'Both' : 'No Mode',
        messages: dialogueMessageTotals[mode],
        sessions: dialogueSessionTotals[mode],
      }));

      const slideLookup = buildSlideLookup(activeSlides);
      const hasActiveSlides = slideLookup.byId.size > 0;
      const pageTimeEntries = avatarTimeData.filter((entry) => isPageEntry(entry));
      const slideTimeEntries = avatarTimeData.filter((entry) => {
        if (isPageEntry(entry)) return false;
        const resolved = resolveSlideKey(entry.slide_id, entry.slide_title, slideLookup);
        if (!resolved.key) return false;
        if (hasActiveSlides && !slideLookup.byId.has(resolved.key)) return false;
        return true;
      });

      const dedupeSlideEntries = <T extends { session_id: string; slide_id?: string; started_at?: string | null; ended_at?: string | null; created_at?: string | null }>(entries: T[]) => {
        const seen = new Set<string>();
        return entries.filter((entry) => {
          const stamp = entry.started_at || entry.ended_at || entry.created_at || '';
          const key = `${entry.session_id}:${entry.slide_id}:${stamp}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      };

      const dedupedSlideTimeEntries = dedupeSlideEntries(slideTimeEntries);

      // Avatar & text time calculation - group by session (slides only)
      const avatarTimeBySession: Record<string, number> = {};
      const textTimeBySession: Record<string, number> = {};
      const learningTimeBySession: Record<string, number> = {};
      dedupedSlideTimeEntries.forEach(t => {
        const duration = t.duration_seconds || 0;
        learningTimeBySession[t.session_id] = (learningTimeBySession[t.session_id] || 0) + duration;
        const sessionMode = sessionModeById.get(t.session_id) || 'none';
        const resolvedMode = resolveTimingMode(t.mode, sessionMode);
        if (resolvedMode === 'avatar') {
          avatarTimeBySession[t.session_id] = (avatarTimeBySession[t.session_id] || 0) + duration;
        }
        if (resolvedMode === 'text') {
          textTimeBySession[t.session_id] = (textTimeBySession[t.session_id] || 0) + duration;
        }
      });
      
      const totalAvatarTime = Object.values(avatarTimeBySession).reduce((a, b) => a + b, 0);
      const avgAvatarTime = Object.keys(avatarTimeBySession).length > 0 
        ? Math.round(totalAvatarTime / Object.keys(avatarTimeBySession).length) 
        : 0;

      const totalTextTime = Object.values(textTimeBySession).reduce((a, b) => a + b, 0);
      const avgTextTime = Object.keys(textTimeBySession).length > 0
        ? Math.round(totalTextTime / Object.keys(textTimeBySession).length)
        : 0;

      // Avatar/text time by slide
      const avatarSlideMap: Record<string, { total: number; sessionIds: Set<string>; title: string }> = {};
      const textSlideMap: Record<string, { total: number; sessionIds: Set<string>; title: string }> = {};
      dedupedSlideTimeEntries.forEach(t => {
        const sessionMode = sessionModeById.get(t.session_id) || 'none';
        const resolvedMode = resolveTimingMode(t.mode, sessionMode);
        const resolved = resolveSlideKey(t.slide_id, t.slide_title, slideLookup);
        if (!resolved.key) return;
        const key = resolved.key;
        const title = resolved.title || t.slide_title || t.slide_id;

        if (resolvedMode === 'avatar') {
          if (!avatarSlideMap[key]) {
            avatarSlideMap[key] = { total: 0, sessionIds: new Set(), title };
          }
          avatarSlideMap[key].total += t.duration_seconds || 0;
          avatarSlideMap[key].sessionIds.add(t.session_id);
          if (title.length > avatarSlideMap[key].title.length) {
            avatarSlideMap[key].title = title;
          }
        }

        if (resolvedMode === 'text') {
          if (!textSlideMap[key]) {
            textSlideMap[key] = { total: 0, sessionIds: new Set(), title };
          }
          textSlideMap[key].total += t.duration_seconds || 0;
          textSlideMap[key].sessionIds.add(t.session_id);
          if (title.length > textSlideMap[key].title.length) {
            textSlideMap[key].title = title;
          }
        }
      });

      const slideOrder = new Map<string, number>();
      activeSlides.forEach((slide, index) => {
        slideOrder.set(slide.slide_id, slide.sort_order ?? index);
      });

      const compareSlideOrder = (a: { slideId: string; slide: string }, b: { slideId: string; slide: string }) => {
        const orderA = slideOrder.get(a.slideId);
        const orderB = slideOrder.get(b.slideId);
        if (orderA !== undefined && orderB !== undefined && orderA !== orderB) {
          return orderA - orderB;
        }
        if (orderA !== undefined && orderB === undefined) return -1;
        if (orderA === undefined && orderB !== undefined) return 1;
        return a.slide.localeCompare(b.slide);
      };

      const avatarTimeBySlide = Object.entries(avatarSlideMap).map(([slideId, data]) => ({
        slideId,
        slide: data.title,
        avgTime: Math.round(data.total / Math.max(1, data.sessionIds.size)),
        totalTime: data.total,
        count: data.sessionIds.size,
      })).sort(compareSlideOrder);

      const textTimeBySlide = Object.entries(textSlideMap).map(([slideId, data]) => ({
        slideId,
        slide: data.title,
        avgTime: Math.round(data.total / Math.max(1, data.sessionIds.size)),
        totalTime: data.total,
        count: data.sessionIds.size,
      })).sort(compareSlideOrder);

      const pageTimeMap: Record<string, { total: number; count: number; title: string }> = {};
      pageTimeEntries.forEach((entry) => {
        const key = entry.slide_id;
        const title = (entry.slide_title || entry.slide_id).replace(/^Page:\s*/i, '');
        if (!pageTimeMap[key]) {
          pageTimeMap[key] = { total: 0, count: 0, title };
        }
        pageTimeMap[key].total += entry.duration_seconds || 0;
        pageTimeMap[key].count += 1;
        if (title.length > pageTimeMap[key].title.length) {
          pageTimeMap[key].title = title;
        }
      });

      const pageOrder = new Map<string, number>([
        ['page:welcome', 0],
        ['page:consent', 1],
        ['page:study-entry-text', 2],
        ['page:study-entry-avatar', 3],
        ['page:mode-assignment', 4],
        ['page:demographics', 5],
        ['page:pre-test', 6],
        ['page:learning-text', 7],
        ['page:learning-avatar', 8],
        ['page:post-test-1', 9],
        ['page:post-test-2', 10],
        ['page:post-test-3', 11],
        ['page:completion', 12],
        ['page:scenario', 13],
        ['page:scenario-feedback', 14],
      ]);

      const pageTimeByPage = Object.entries(pageTimeMap)
        .map(([pageId, data]) => ({
          pageId,
          page: data.title,
          avgTime: Math.round(data.total / data.count),
          totalTime: data.total,
          count: data.count,
        }))
        .sort((a, b) => {
          const orderA = pageOrder.get(a.pageId);
          const orderB = pageOrder.get(b.pageId);
          if (orderA !== undefined && orderB !== undefined && orderA !== orderB) {
            return orderA - orderB;
          }
          if (orderA !== undefined && orderB === undefined) return -1;
          if (orderA === undefined && orderB !== undefined) return 1;
          return a.page.localeCompare(b.page);
        })
        .map(({ pageId, ...rest }) => rest);

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

      // Demographics breakdown - Age (10-year ranges, 70+ for elderly, include "Prefer not to say")
      const ageBreakdown: Record<string, number> = {};
      demographicResponses
        .filter(r => r.question_id === 'demo-age')
        .forEach(r => {
          const age = r.answer;
          if (age) {
            // Handle "Prefer not to say" explicitly
            if (age.toLowerCase().includes('prefer') || age === 'Prefer not to say') {
              ageBreakdown['Prefer not to say'] = (ageBreakdown['Prefer not to say'] || 0) + 1;
            } else {
              const ageNum = parseInt(age, 10);
              let ageRange = age;
              if (!isNaN(ageNum)) {
                if (ageNum < 18) ageRange = 'Under 18'; // Should not happen (blocked at demographics)
                else if (ageNum <= 24) ageRange = '18-24';
                else if (ageNum <= 34) ageRange = '25-34';
                else if (ageNum <= 44) ageRange = '35-44';
                else if (ageNum <= 54) ageRange = '45-54';
                else if (ageNum <= 64) ageRange = '55-64';
                else if (ageNum <= 69) ageRange = '65-69';
                else ageRange = '70+';
              }
              ageBreakdown[ageRange] = (ageBreakdown[ageRange] || 0) + 1;
            }
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
        const question = questionMap.get(r.question_id);
        if (question?.question_type !== 'post_test') return;
        if (!(question.category === 'knowledge' || question.question_id.startsWith('knowledge-') || question.correct_answer)) return;
        if (!question.correct_answer) return;
        if (!sessionPostScores[r.session_id]) {
          sessionPostScores[r.session_id] = { correct: 0, total: 0 };
        }
        sessionPostScores[r.session_id].total++;
        
        const correctAnswers = question.correct_answer.split('|||').map((a: string) => a.trim().toLowerCase());
        const userAnswers = String(r.answer ?? '')
          .split('|||')
          .map((a: string) => a.trim().toLowerCase())
          .filter((a: string) => a.length > 0);
        
        const allCorrect = correctAnswers.every((ca: string) => userAnswers.includes(ca));
        const noExtra = userAnswers.every((ua: string) => correctAnswers.includes(ua));
        
        if (allCorrect && noExtra) {
          sessionPostScores[r.session_id].correct++;
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
          
          const mode = resolveSessionMode(s);
          const avatarTime = avatarTimeBySession[s.id] || 0;
          const learningTime = learningTimeBySession[s.id] || 0;
          
          // Skip sessions with no mode for knowledge gain analysis
          if (mode === 'none') return;
          
          knowledgeGain.push({
            sessionId: s.session_id,
            mode: mode as 'text' | 'avatar' | 'both',
            preScore: Math.round(preScore),
            postScore: Math.round(postScore),
            gain: Math.round(postScore - preScore),
            preCorrect: preScores.correct,
            preTotal: preScores.total,
            postCorrect: postScores.correct,
            postTotal: postScores.total,
            avatarTime,
            learningTime,
          });
        }
      });

      const preAnswerCountBySession = new Map<string, number>();
      preTestResponses.forEach((row) => {
        if (!hasMeaningfulAnswer(row.answer)) return;
        preAnswerCountBySession.set(
          row.session_id,
          (preAnswerCountBySession.get(row.session_id) || 0) + 1
        );
      });

      const postAnswerCountBySession = new Map<string, number>();
      postTestResponses.forEach((row) => {
        if (isTelemetryMetaQuestionId(row.question_id)) return;
        if (!hasMeaningfulAnswer(row.answer)) return;
        postAnswerCountBySession.set(
          row.session_id,
          (postAnswerCountBySession.get(row.session_id) || 0) + 1
        );
      });

      const missingScoreSessions = sessionsToAnalyze.flatMap((session) => {
        const preScores = sessionPreScores[session.id];
        const postScores = sessionPostScores[session.id];
        const preTotal = preScores?.total ?? 0;
        const postTotal = postScores?.total ?? 0;

        if (preTotal > 0 && postTotal > 0) return [];

        const reasons: string[] = [];
        const preAnswers = preAnswerCountBySession.get(session.id) || 0;
        const postAnswers = postAnswerCountBySession.get(session.id) || 0;

        if (preTotal === 0) {
          reasons.push(preAnswers === 0 ? 'No pre-test answers' : 'Pre-test answers not scorable');
        }
        if (postTotal === 0) {
          reasons.push(postAnswers === 0 ? 'No post-test answers' : 'Post-test answers not scorable');
        }

        if (reasons.length === 0) return [];
        return [
          {
            sessionId: session.session_id,
            mode: resolveSessionMode(session),
            reasons,
          },
        ];
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
        const question = questionMap.get(r.question_id);
        if (!question || question.question_type !== 'post_test') return;
        if (!(question.category === 'knowledge' || question.question_id.startsWith('knowledge-') || question.correct_answer)) return;
        if (!postTestQuestionStats[r.question_id]) {
          postTestQuestionStats[r.question_id] = {
            correct: 0,
            total: 0,
            text: question.question_text,
            hasCorrectAnswer: !!question.correct_answer,
          };
        }
        postTestQuestionStats[r.question_id].total++;
        
        if (question.correct_answer) {
          const correctAnswers = question.correct_answer.split('|||').map((a: string) => a.trim().toLowerCase());
          const userAnswers = String(r.answer ?? '')
            .split('|||')
            .map((a: string) => a.trim().toLowerCase())
            .filter((a: string) => a.length > 0);
          const isCorrect = correctAnswers.every((ca: string) => userAnswers.includes(ca)) &&
                           userAnswers.every((ua: string) => correctAnswers.includes(ua));
          if (isCorrect) postTestQuestionStats[r.question_id].correct++;
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
        avatarTimeVsGain: knowledgeGain
          .filter(k => k.avatarTime > 0)
          .map(k => ({
            x: Math.round((k.avatarTime / 60) * 100) / 100,
            y: k.gain,
            mode: k.mode,
          })),
        learningTimeVsGain: knowledgeGain
          .filter(k => k.learningTime > 0)
          .map(k => ({
            x: Math.round((k.learningTime / 60) * 100) / 100,
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
        { id: 'engagement-2', text: 'I felt motivated to complete all the slides', category: 'engagement' },
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
      const textSessionIds = sessionsToAnalyze.filter(s => resolveSessionMode(s) === 'text').map(s => s.id);
      const avatarSessionIds = sessionsToAnalyze.filter(s => resolveSessionMode(s) === 'avatar').map(s => s.id);
      const bothSessionIds = sessionsToAnalyze.filter(s => resolveSessionMode(s) === 'both').map(s => s.id);

      const likertAnalysis = analyzeLikertForSessions(allSessionIds);
      const likertByMode = {
        text: analyzeLikertForSessions(textSessionIds),
        avatar: analyzeLikertForSessions(avatarSessionIds),
        both: analyzeLikertForSessions(bothSessionIds),
      };

      // Calculate suspicious session statistics from ALL sessions (not filtered)
      const suspiciousSessions = (allSessions || []).filter(s => (s.suspicion_score || 0) > 0 || (Array.isArray(s.suspicious_flags) && s.suspicious_flags.length > 0));
      const suspiciousCount = suspiciousSessions.length;
      const avgSuspicionScore = suspiciousCount > 0 
        ? Math.round(suspiciousSessions.reduce((sum, s) => sum + (s.suspicion_score || 0), 0) / suspiciousCount)
        : 0;
      
      // Count validation statuses for suspicious sessions
      const acceptedCount = suspiciousSessions.filter(s => s.validation_status === 'accepted').length;
      const ignoredCount = suspiciousSessions.filter(s => s.validation_status === 'ignored').length;
      const pendingCount = suspiciousSessions.filter(s => !s.validation_status || s.validation_status === 'pending').length;
      const awaitingApprovalCount = suspiciousSessions.filter(s => 
        s.validation_status === 'pending_accepted' || s.validation_status === 'pending_ignored'
      ).length;
      
      // Count flag occurrences
      const flagCounts: Record<string, number> = {};
      (allSessions || []).forEach(s => {
        const flags = (s.suspicious_flags as string[]) || [];
        flags.forEach(flag => {
          flagCounts[flag] = (flagCounts[flag] || 0) + 1;
        });
      });
      const suspiciousFlags = Object.entries(flagCounts)
        .map(([flag, count]) => ({ flag, count }))
        .sort((a, b) => b.count - a.count);

      setStats({
        totalCompleted: completedSessions.length,
        totalIncomplete: incompleteSessions.length,
        textModeCompleted,
        avatarModeCompleted,
        bothModesCompleted,
        noModeCount,
        avgSessionDuration: avgDuration,
        avgAvatarTime,
        avgTextTime,
        totalAvatarTime,
        totalTextTime,
        avatarSessionsTracked: Object.keys(avatarTimeBySession).length,
        textSessionsTracked: Object.keys(textTimeBySession).length,
        sessionsPerDay,
        demographicBreakdown: sortByOrder(Object.entries(ageBreakdown).map(([name, value]) => ({ name, value })), AGE_ORDER),
        educationBreakdown: sortByOrder(Object.entries(educationBreakdown).map(([name, value]) => ({ name, value })), EDUCATION_ORDER),
        experienceBreakdown: sortByOrder(Object.entries(experienceBreakdown).map(([name, value]) => ({ name, value })), EXPERIENCE_ORDER),
        modeComparison: [
          { name: 'Text Only', count: textModeCompleted },
          { name: 'Avatar Only', count: avatarModeCompleted },
          { name: 'Both Modes', count: bothModesCompleted },
          { name: 'No Mode', count: noModeCount },
        ],
        avatarTimeBySlide,
        textTimeBySlide,
        pageTimeByPage,
        avatarTimeData,
        pageTimeData: pageTimeEntries,
        knowledgeGain,
        missingScoreSessions,
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
        // Suspicious session stats
        suspiciousCount,
        avgSuspicionScore,
        suspiciousFlags,
        resetCount: resetSessions.length,
        ignoredCount,
        acceptedCount,
        pendingCount,
        awaitingApprovalCount,
        dialogueByMode,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [startDate, endDate, statusFilter, includeFlagged, includeImputed]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Real-time subscription for all relevant tables
  useEffect(() => {
    let isActive = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      const canUseTutorDialogue = await canUseTutorDialogueTable();
      if (!isActive) return;

      let nextChannel = supabase
        .channel('overview-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'study_sessions' }, () => fetchStats())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'demographic_responses' }, () => fetchStats())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pre_test_responses' }, () => fetchStats())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'post_test_responses' }, () => fetchStats())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'study_questions' }, () => fetchStats())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'avatar_time_tracking' }, () => fetchStats());

      if (canUseTutorDialogue) {
        nextChannel = nextChannel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tutor_dialogue_turns' },
          () => fetchStats()
        );
      }

      channel = nextChannel.subscribe();
    };

    setup();

    return () => {
      isActive = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
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

    const demoQuestionIds = [...new Set(stats.rawDemographics.map(r => r.question_id))].sort();
    const preTestQuestionIds = [...new Set(stats.rawPreTest.map(r => r.question_id))].sort();
    const postTestQuestionIds = [...new Set(stats.rawPostTest.map(r => r.question_id))].sort();

    const allQuestionIds = Array.from(new Set([
      ...demoQuestionIds,
      ...preTestQuestionIds,
      ...postTestQuestionIds,
    ]));

    const { data: questions } = allQuestionIds.length > 0
      ? await supabase
          .from('study_questions')
          .select('question_id, question_text, correct_answer, question_type')
          .in('question_id', allQuestionIds)
          .order('sort_order')
      : { data: [] };

    const questionTextMap: Record<string, string> = {};
    const correctAnswerMap: Record<string, string> = {};
    questions?.forEach(q => {
      questionTextMap[q.question_id] = q.question_text;
      correctAnswerMap[q.question_id] = q.correct_answer || '';
    });

    const { data: slideRows } = await supabase
      .from('study_slides')
      .select('slide_id, title, sort_order, is_active')
      .order('sort_order');

    const activeSlides = (slideRows || []).filter((slide) => slide.is_active);
    const slideLookup = buildSlideLookup(activeSlides);
    const hasActiveSlides = slideLookup.byId.size > 0;

    const slideTimeEntries = stats.avatarTimeData
      .filter((entry) => !isPageEntry(entry))
      .map((entry) => {
        const resolved = resolveSlideKey(entry.slide_id, entry.slide_title, slideLookup);
        if (!resolved.key) return null;
        if (hasActiveSlides && !slideLookup.byId.has(resolved.key)) return null;
        return {
          ...entry,
          canonical_slide_id: resolved.key,
          canonical_title: resolved.title,
        };
      })
      .filter(Boolean) as Array<any>;

    const slideIds = hasActiveSlides
      ? activeSlides.map((slide) => slide.slide_id)
      : Array.from(new Set(slideTimeEntries.map((t) => t.canonical_slide_id))).sort();
    const slideTitleMap: Record<string, string> = {};
    activeSlides.forEach((slide) => {
      slideTitleMap[slide.slide_id] = slide.title;
    });
    slideTimeEntries.forEach((entry) => {
      const key = entry.canonical_slide_id;
      if (!slideTitleMap[key]) {
        slideTitleMap[key] = entry.canonical_title || entry.slide_title || entry.slide_id;
      }
    });
    const pageTimeEntries = stats.pageTimeData;

    const pageIds = Array.from(new Set(pageTimeEntries.map((entry) => entry.slide_id))).sort();
    const pageTitleMap: Record<string, string> = {};
    pageTimeEntries.forEach((entry) => {
      pageTitleMap[entry.slide_id] = (entry.slide_title || entry.slide_id).replace(/^Page:\s*/i, '');
    });

    const slideTimeBySession: Record<string, Record<string, number>> = {};
    slideTimeEntries.forEach((entry) => {
      if (!slideTimeBySession[entry.session_id]) {
        slideTimeBySession[entry.session_id] = {};
      }
      slideTimeBySession[entry.session_id][entry.canonical_slide_id] =
        (slideTimeBySession[entry.session_id][entry.canonical_slide_id] || 0) + (entry.duration_seconds || 0);
    });

    const pageTimeBySession: Record<string, Record<string, number>> = {};
    pageTimeEntries.forEach((entry) => {
      if (!pageTimeBySession[entry.session_id]) {
        pageTimeBySession[entry.session_id] = {};
      }
      pageTimeBySession[entry.session_id][entry.slide_id] =
        (pageTimeBySession[entry.session_id][entry.slide_id] || 0) + (entry.duration_seconds || 0);
    });

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
      'Text Slide Time (sec)',
      ...slideIds.map((slideId) => `SLIDE: ${slideTitleMap[slideId] || slideId}`),
      ...pageIds.map((pageId) => `PAGE: ${pageTitleMap[pageId] || pageId}`),
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
      
      const sessionMode = resolveSessionMode(session);
      const avatarTime = sessionMode === 'avatar' || sessionMode === 'both'
        ? slideTimeEntries
            .filter(t => t.session_id === session.id)
            .reduce((sum, t) => sum + (t.duration_seconds || 0), 0)
        : 0;

      const textSlideTime = sessionMode === 'text'
        ? slideTimeEntries
            .filter(t => t.session_id === session.id)
            .reduce((sum, t) => sum + (t.duration_seconds || 0), 0)
        : 0;

      const slideTimesForSession = slideTimeBySession[session.id] || {};
      const pageTimesForSession = pageTimeBySession[session.id] || {};

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
        textSlideTime,
        ...slideIds.map((slideId) => slideTimesForSession[slideId] ?? ''),
        ...pageIds.map((pageId) => pageTimesForSession[pageId] ?? ''),
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

    const demoQuestionIds = [...new Set(stats.rawDemographics.map(r => r.question_id))].sort();
    const preTestQuestionIds = [...new Set(stats.rawPreTest.map(r => r.question_id))].sort();
    const postTestQuestionIds = [...new Set(stats.rawPostTest.map(r => r.question_id))].sort();

    const allQuestionIds = Array.from(new Set([
      ...demoQuestionIds,
      ...preTestQuestionIds,
      ...postTestQuestionIds,
    ]));

    const { data: questions } = allQuestionIds.length > 0
      ? await supabase
          .from('study_questions')
          .select('*')
          .in('question_id', allQuestionIds)
      : { data: [] };

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
        avgTextTime: stats.avgTextTime,
        totalAvatarTime: stats.totalAvatarTime,
        totalTextTime: stats.totalTextTime,
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
        slideTimes: stats.avatarTimeData
          .filter(t => t.session_id === s.id && !isPageEntry(t))
          .reduce((acc: Record<string, number>, entry) => {
            acc[entry.slide_id] = (acc[entry.slide_id] || 0) + (entry.duration_seconds || 0);
            return acc;
          }, {}),
        pageTimes: stats.pageTimeData
          .filter(t => t.session_id === s.id)
          .reduce((acc: Record<string, number>, entry) => {
            acc[entry.slide_id] = (acc[entry.slide_id] || 0) + (entry.duration_seconds || 0);
            return acc;
          }, {}),
        demographicResponses: stats.rawDemographics.filter(r => r.session_id === s.id),
        preTestResponses: stats.rawPreTest.filter(r => r.session_id === s.id),
        postTestResponses: stats.rawPostTest.filter(r => r.session_id === s.id),
      })),
      avatarTracking: {
        bySlide: stats.avatarTimeBySlide,
        textBySlide: stats.textTimeBySlide,
        pageByPage: stats.pageTimeByPage,
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
      LearningSlidesSeconds: k.learningTime,
    }));
    downloadCSV(data, 'knowledge_gain');
  };

  const exportCorrelationCSV = () => {
    if (!stats) return;
    const sessionDurationById = new Map(
      stats.rawSessions.map((s) => [
        s.session_id,
        s.completed_at
          ? Math.round(((new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()) / 1000 / 60) * 10) / 10
          : 0,
      ])
    );
    const toMinutes = (seconds: number) => Math.round((seconds / 60) * 100) / 100;
    const data = stats.knowledgeGain.map((k) => ({
      SessionID: k.sessionId,
      Mode: k.mode,
      KnowledgeGainPercent: k.gain,
      AvatarTimeMinutes: toMinutes(k.avatarTime),
      LearningSlidesMinutes: toMinutes(k.learningTime),
      SessionDurationMinutes: sessionDurationById.get(k.sessionId) || 0,
    }));
    downloadCSV(data, 'correlation_metrics');
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

  const renderTimeGainTooltip =
    (timeLabel: string) =>
    ({ active, payload }: { active?: boolean; payload?: Array<{ payload?: { x?: number; y?: number } }> }) => {
      if (!active || !payload || payload.length === 0) return null;
      const point = payload.find((entry) => typeof entry?.payload?.x === 'number')?.payload ?? payload[0]?.payload;
      const x = typeof point?.x === 'number' ? point.x : 0;
      const y = typeof point?.y === 'number' ? point.y : 0;
      return (
        <div className="rounded-md border border-slate-700/80 bg-slate-900/95 px-3 py-2 text-xs text-white shadow-lg">
          <div className="text-muted-foreground">{timeLabel}: <span className="text-white">{x.toFixed(1)} min</span></div>
          <div className="text-muted-foreground">Knowledge Gain: <span className="text-white">{y.toFixed(1)}%</span></div>
        </div>
      );
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

  // Draw a simple bar chart in PDF
  const drawBarChart = (doc: jsPDF, data: { name: string; value: number }[], startX: number, startY: number, width: number, height: number, title: string, colors: string[]) => {
    if (data.length === 0) return startY;
    
    const maxValue = Math.max(...data.map(d => d.value), 1);
    const barHeight = Math.min(12, (height - 20) / data.length);
    const barGap = 3;
    const labelWidth = 70;
    const barAreaWidth = width - labelWidth - 30;
    
    // Title
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text(title, startX, startY);
    startY += 8;
    
    // Draw bars
    data.forEach((item, index) => {
      const y = startY + index * (barHeight + barGap);
      const barWidth = (item.value / maxValue) * barAreaWidth;
      
      // Label
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60);
      const label = item.name.length > 15 ? item.name.substring(0, 14) + '...' : item.name;
      doc.text(label, startX, y + barHeight / 2 + 1);
      
      // Bar background
      doc.setFillColor(230, 230, 230);
      doc.rect(startX + labelWidth, y, barAreaWidth, barHeight, 'F');
      
      // Bar fill
      const colorIndex = index % colors.length;
      const color = colors[colorIndex];
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      doc.setFillColor(r, g, b);
      doc.rect(startX + labelWidth, y, barWidth, barHeight, 'F');
      
      // Value
      doc.setFontSize(8);
      doc.setTextColor(0);
      doc.text(item.value.toString(), startX + labelWidth + barWidth + 3, y + barHeight / 2 + 1);
    });
    
    return startY + data.length * (barHeight + barGap) + 5;
  };

  // Draw a scatter plot in PDF
  const drawScatterPlot = (doc: jsPDF, data: { x: number; y: number; mode?: string }[], startX: number, startY: number, width: number, height: number, title: string, xLabel: string, yLabel: string) => {
    if (data.length === 0) return startY;
    
    // Title
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text(title, startX, startY);
    startY += 10;
    
    const plotWidth = width - 30;
    const plotHeight = height - 25;
    const plotX = startX + 25;
    const plotY = startY;
    
    // Calculate ranges
    const xValues = data.map(d => d.x);
    const yValues = data.map(d => d.y);
    const minX = Math.min(...xValues, 0);
    const maxX = Math.max(...xValues, 1);
    const minY = Math.min(...yValues, -50);
    const maxY = Math.max(...yValues, 50);
    const xRange = maxX - minX || 1;
    const yRange = maxY - minY || 1;
    
    // Draw axes
    doc.setDrawColor(100);
    doc.setLineWidth(0.5);
    // Y axis
    doc.line(plotX, plotY, plotX, plotY + plotHeight);
    // X axis
    doc.line(plotX, plotY + plotHeight, plotX + plotWidth, plotY + plotHeight);
    
    // Axis labels
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    
    // X axis label
    doc.text(xLabel, plotX + plotWidth / 2, plotY + plotHeight + 12, { align: 'center' });
    
    // Y axis label (rotated text not easily supported, use horizontal)
    doc.text(yLabel, startX, plotY + plotHeight / 2 - 5);
    
    // Axis tick labels
    doc.setFontSize(6);
    doc.text(minX.toFixed(0), plotX, plotY + plotHeight + 5);
    doc.text(maxX.toFixed(0), plotX + plotWidth - 5, plotY + plotHeight + 5);
    doc.text(minY.toFixed(0), plotX - 12, plotY + plotHeight);
    doc.text(maxY.toFixed(0), plotX - 12, plotY + 3);
    
    // Zero line if applicable
    if (minY < 0 && maxY > 0) {
      const zeroY = plotY + plotHeight - ((0 - minY) / yRange) * plotHeight;
      doc.setDrawColor(200);
      doc.setLineDashPattern([2, 2], 0);
      doc.line(plotX, zeroY, plotX + plotWidth, zeroY);
      doc.setLineDashPattern([], 0);
    }
    
    // Calculate linear regression for trend line
    let slope = 0;
    let intercept = 0;
    let r = 0;
    
    if (data.length >= 2) {
      const n = data.length;
      const sumX = xValues.reduce((a, b) => a + b, 0);
      const sumY = yValues.reduce((a, b) => a + b, 0);
      const sumXY = data.reduce((a, d) => a + d.x * d.y, 0);
      const sumX2 = xValues.reduce((a, b) => a + b * b, 0);
      const sumY2 = yValues.reduce((a, b) => a + b * b, 0);
      
      // Calculate slope and intercept
      const denomSlope = n * sumX2 - sumX * sumX;
      if (denomSlope !== 0) {
        slope = (n * sumXY - sumX * sumY) / denomSlope;
        intercept = (sumY - slope * sumX) / n;
      }
      
      // Calculate correlation coefficient
      const numerator = n * sumXY - sumX * sumY;
      const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
      r = denominator !== 0 ? numerator / denominator : 0;
      
      // Draw trend line
      const trendY1 = slope * minX + intercept;
      const trendY2 = slope * maxX + intercept;
      
      // Clamp to plot area
      const clampedY1 = Math.max(minY, Math.min(maxY, trendY1));
      const clampedY2 = Math.max(minY, Math.min(maxY, trendY2));
      
      const lineX1 = plotX + ((minX - minX) / xRange) * plotWidth;
      const lineY1 = plotY + plotHeight - ((clampedY1 - minY) / yRange) * plotHeight;
      const lineX2 = plotX + ((maxX - minX) / xRange) * plotWidth;
      const lineY2 = plotY + plotHeight - ((clampedY2 - minY) / yRange) * plotHeight;
      
      // Draw trend line in red
      doc.setDrawColor(239, 68, 68);
      doc.setLineWidth(1);
      doc.line(lineX1, lineY1, lineX2, lineY2);
      doc.setLineWidth(0.5);
    }
    
    // Draw points (after trend line so they appear on top)
    data.forEach(point => {
      const px = plotX + ((point.x - minX) / xRange) * plotWidth;
      const py = plotY + plotHeight - ((point.y - minY) / yRange) * plotHeight;
      
      // Color based on mode
      if (point.mode === 'text') {
        doc.setFillColor(59, 130, 246); // blue
      } else if (point.mode === 'avatar') {
        doc.setFillColor(139, 92, 246); // purple
      } else {
        doc.setFillColor(100, 100, 100);
      }
      
      doc.circle(px, py, 1.5, 'F');
    });
    
    // Legend
    doc.setFontSize(7);
    const legendY = plotY + 5;
    doc.setFillColor(59, 130, 246);
    doc.circle(plotX + plotWidth - 55, legendY, 2, 'F');
    doc.setTextColor(60);
    doc.text('Text', plotX + plotWidth - 50, legendY + 1);
    doc.setFillColor(139, 92, 246);
    doc.circle(plotX + plotWidth - 33, legendY, 2, 'F');
    doc.text('Avatar', plotX + plotWidth - 28, legendY + 1);
    // Trend line legend
    doc.setDrawColor(239, 68, 68);
    doc.setLineWidth(1);
    doc.line(plotX + plotWidth - 12, legendY, plotX + plotWidth - 2, legendY);
    doc.setLineWidth(0.5);
    
    // Show correlation coefficient and regression equation
    if (data.length >= 2) {
      doc.setFontSize(8);
      doc.setTextColor(0);
      doc.text(`r = ${r.toFixed(3)} | y = ${slope.toFixed(2)}x + ${intercept.toFixed(1)} | n=${data.length}`, plotX, plotY + plotHeight + 18);
    }
    
    return startY + plotHeight + 25;
  };

  // Draw a comparison bar chart (pre vs post)
  const drawComparisonChart = (doc: jsPDF, startX: number, startY: number, width: number, title: string, data: { label: string; value1: number; value2: number }[], legend: { label1: string; label2: string }) => {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text(title, startX, startY);
    startY += 8;
    
    const maxValue = Math.max(...data.flatMap(d => [d.value1, d.value2]), 100);
    const barHeight = 10;
    const barGap = 2;
    const groupGap = 8;
    const labelWidth = 50;
    const barAreaWidth = width - labelWidth - 40;
    
    // Legend
    doc.setFontSize(7);
    doc.setFillColor(239, 68, 68);
    doc.rect(startX + width - 80, startY - 6, 8, 4, 'F');
    doc.text(legend.label1, startX + width - 70, startY - 3);
    doc.setFillColor(16, 185, 129);
    doc.rect(startX + width - 40, startY - 6, 8, 4, 'F');
    doc.text(legend.label2, startX + width - 30, startY - 3);
    startY += 5;
    
    data.forEach((item, index) => {
      const baseY = startY + index * (2 * barHeight + barGap + groupGap);
      
      // Label
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60);
      doc.text(item.label, startX, baseY + barHeight);
      
      // Bar 1 (pre)
      const barWidth1 = (item.value1 / maxValue) * barAreaWidth;
      doc.setFillColor(239, 68, 68);
      doc.rect(startX + labelWidth, baseY, barWidth1, barHeight, 'F');
      doc.setTextColor(0);
      doc.text(`${item.value1}%`, startX + labelWidth + barWidth1 + 3, baseY + barHeight / 2 + 1);
      
      // Bar 2 (post)
      const barWidth2 = (item.value2 / maxValue) * barAreaWidth;
      doc.setFillColor(16, 185, 129);
      doc.rect(startX + labelWidth, baseY + barHeight + barGap, barWidth2, barHeight, 'F');
      doc.setTextColor(0);
      doc.text(`${item.value2}%`, startX + labelWidth + barWidth2 + 3, baseY + barHeight + barGap + barHeight / 2 + 1);
    });
    
    return startY + data.length * (2 * barHeight + barGap + groupGap) + 5;
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
    doc.text('Comprehensive Research Report', 105, yPos, { align: 'center' });
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
    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Demographic Charts - Side by side
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Demographic Distribution', 14, yPos);
    yPos += 8;
    
    // Age Distribution (left)
    const ageData = stats.demographicBreakdown.map(d => ({ name: d.name, value: d.value }));
    yPos = drawBarChart(doc, ageData, 14, yPos, 85, 60, 'Age Groups', ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe', '#1d4ed8', '#1e40af']);
    
    // Education Distribution (right side of same row - draw on a new row for simplicity)
    const educationData = stats.educationBreakdown.map(d => ({ name: d.name, value: d.value }));
    yPos = drawBarChart(doc, educationData, 14, yPos + 5, 85, 60, 'Education Level', ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5']);
    
    // Digital Experience
    const experienceData = stats.experienceBreakdown.map(d => ({ name: d.name, value: d.value }));
    yPos = drawBarChart(doc, experienceData, 14, yPos + 5, 85, 60, 'Digital Experience', ['#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe']);

    // Check page break
    if (yPos > 230) {
      doc.addPage();
      yPos = 20;
    }

    // Learning Outcomes with Chart
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('3. Learning Outcomes', 14, yPos);
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
    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Pre vs Post Comparison Chart
    const comparisonData = [
      { label: 'Text Mode', value1: stats.textModePreScore, value2: stats.textModePostScore },
      { label: 'Avatar Mode', value1: stats.avatarModePreScore, value2: stats.avatarModePostScore },
    ];
    yPos = drawComparisonChart(doc, 14, yPos, 180, 'Pre-Test vs Post-Test Comparison', comparisonData, { label1: 'Pre-Test', label2: 'Post-Test' });

    // Check page break
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    // Statistical Analysis
    if (stats.statisticalTests) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('4. Statistical Analysis (Text vs Avatar)', 14, yPos);
      yPos += 8;

      const significant = stats.statisticalTests.textVsAvatar.significant;
      autoTable(doc, {
        startY: yPos,
        head: [['Statistic', 'Value', 'Interpretation']],
        body: [
          ['t-statistic', stats.statisticalTests.textVsAvatar.tStatistic.toString(), ''],
          ['p-value', stats.statisticalTests.textVsAvatar.pValue < 0.001 ? '<0.001' : stats.statisticalTests.textVsAvatar.pValue.toString(), significant ? 'Significant (p < 0.05)' : 'Not significant'],
          ["Cohen's d", stats.statisticalTests.textVsAvatar.cohensD.toString(), `${stats.statisticalTests.textVsAvatar.effectSize} effect size`],
          ['95% CI', `[${stats.statisticalTests.textVsAvatar.ci95Lower}, ${stats.statisticalTests.textVsAvatar.ci95Upper}]`, 'Mean difference confidence interval'],
          ['Text Mean (SD)', `${stats.statisticalTests.textVsAvatar.textMean}% (±${stats.statisticalTests.textVsAvatar.textStd})`, `n=${stats.statisticalTests.textVsAvatar.textN}`],
          ['Avatar Mean (SD)', `${stats.statisticalTests.textVsAvatar.avatarMean}% (±${stats.statisticalTests.textVsAvatar.avatarStd})`, `n=${stats.statisticalTests.textVsAvatar.avatarN}`],
        ],
        theme: 'striped',
        headStyles: { fillColor: [139, 92, 246] },
        margin: { left: 14, right: 14 },
      });
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // Check page break
    if (yPos > 180) {
      doc.addPage();
      yPos = 20;
    }

    // Correlation Scatter Plot - Avatar Time vs Knowledge Gain
    if (stats.correlations.avatarTimeVsGain.length > 0) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('5. Correlation Analysis', 14, yPos);
      yPos += 8;
      
      const avatarTimeData = stats.correlations.avatarTimeVsGain.filter(d => d.x > 0);
      yPos = drawScatterPlot(
        doc, 
        avatarTimeData, 
        14, 
        yPos, 
        180, 
        70, 
        'Avatar Slide Time vs Knowledge Gain', 
        'Avatar Slide Time (minutes)', 
        'Knowledge Gain (%)'
      );
      
      // Add interpretation
      if (avatarTimeData.length >= 3) {
        const xValues = avatarTimeData.map(d => d.x);
        const yValues = avatarTimeData.map(d => d.y);
        const n = avatarTimeData.length;
        const sumX = xValues.reduce((a, b) => a + b, 0);
        const sumY = yValues.reduce((a, b) => a + b, 0);
        const sumXY = avatarTimeData.reduce((a, d) => a + d.x * d.y, 0);
        const sumX2 = xValues.reduce((a, b) => a + b * b, 0);
        const sumY2 = yValues.reduce((a, b) => a + b * b, 0);
        
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        const r = denominator !== 0 ? numerator / denominator : 0;
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(80);
        const interpretation = Math.abs(r) >= 0.7 ? 'strong' : Math.abs(r) >= 0.4 ? 'moderate' : Math.abs(r) >= 0.2 ? 'weak' : 'negligible';
        const direction = r > 0 ? 'positive' : r < 0 ? 'negative' : 'no';
        doc.text(`Interpretation: ${interpretation} ${direction} correlation between avatar slide time and learning outcomes.`, 14, yPos);
        yPos += 8;
      }
    }

    // Learning Slides Time vs Knowledge Gain Scatter Plot
    if (stats.correlations.learningTimeVsGain.length > 0) {
      // Check page break
      if (yPos > 180) {
        doc.addPage();
        yPos = 20;
      }

      const learningTimeData = stats.correlations.learningTimeVsGain.filter(d => d.x > 0);
      yPos = drawScatterPlot(
        doc,
        learningTimeData,
        14,
        yPos,
        180,
        70,
        'Learning Slides Time vs Knowledge Gain',
        'Learning Slides Time (minutes)',
        'Knowledge Gain (%)'
      );

      if (learningTimeData.length >= 3) {
        const xValues = learningTimeData.map(d => d.x);
        const yValues = learningTimeData.map(d => d.y);
        const n = learningTimeData.length;
        const sumX = xValues.reduce((a, b) => a + b, 0);
        const sumY = yValues.reduce((a, b) => a + b, 0);
        const sumXY = learningTimeData.reduce((a, d) => a + d.x * d.y, 0);
        const sumX2 = xValues.reduce((a, b) => a + b * b, 0);
        const sumY2 = yValues.reduce((a, b) => a + b * b, 0);

        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        const r = denominator !== 0 ? numerator / denominator : 0;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(80);
        const interpretation = Math.abs(r) >= 0.7 ? 'strong' : Math.abs(r) >= 0.4 ? 'moderate' : Math.abs(r) >= 0.2 ? 'weak' : 'negligible';
        const direction = r > 0 ? 'positive' : r < 0 ? 'negative' : 'no';
        doc.text(`Interpretation: ${interpretation} ${direction} correlation between learning slides time and learning outcomes.`, 14, yPos);
        yPos += 8;
      }
    }

    // Session Duration vs Knowledge Gain Scatter Plot
    if (stats.correlations.sessionTimeVsGain.length > 0) {
      // Check page break
      if (yPos > 180) {
        doc.addPage();
        yPos = 20;
      }
      
      yPos = drawScatterPlot(
        doc, 
        stats.correlations.sessionTimeVsGain, 
        14, 
        yPos, 
        180, 
        70, 
        'Full Session Duration vs Knowledge Gain', 
        'Session Duration (minutes, full)', 
        'Knowledge Gain (%)'
      );
      
      // Add interpretation
      if (stats.correlations.sessionTimeVsGain.length >= 3) {
        const xValues = stats.correlations.sessionTimeVsGain.map(d => d.x);
        const yValues = stats.correlations.sessionTimeVsGain.map(d => d.y);
        const n = stats.correlations.sessionTimeVsGain.length;
        const sumX = xValues.reduce((a, b) => a + b, 0);
        const sumY = yValues.reduce((a, b) => a + b, 0);
        const sumXY = stats.correlations.sessionTimeVsGain.reduce((a, d) => a + d.x * d.y, 0);
        const sumX2 = xValues.reduce((a, b) => a + b * b, 0);
        const sumY2 = yValues.reduce((a, b) => a + b * b, 0);
        
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        const r = denominator !== 0 ? numerator / denominator : 0;
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(80);
        const interpretation = Math.abs(r) >= 0.7 ? 'strong' : Math.abs(r) >= 0.4 ? 'moderate' : Math.abs(r) >= 0.2 ? 'weak' : 'negligible';
        const direction = r > 0 ? 'positive' : r < 0 ? 'negative' : 'no';
        doc.text(`Interpretation: ${interpretation} ${direction} correlation between full session duration and learning outcomes.`, 14, yPos);
        yPos += 8;
      }
    }

    // Check page break
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    // Mode Comparison Chart
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('6. Mode Distribution', 14, yPos);
    yPos += 8;
    
    const modeData = [
      { name: 'Text Mode', value: stats.textModeCompleted },
      { name: 'Avatar Mode', value: stats.avatarModeCompleted },
    ];
    yPos = drawBarChart(doc, modeData, 14, yPos, 100, 40, '', ['#3b82f6', '#8b5cf6']);

    // Perception Analysis
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('7. Perception Analysis (Likert 1-5)', 14, yPos);
    yPos += 8;

    const trustAvg = stats.likertAnalysis.filter(l => l.category === 'trust').reduce((sum, l) => sum + l.mean, 0) / Math.max(stats.likertAnalysis.filter(l => l.category === 'trust').length, 1);
    const engagementAvg = stats.likertAnalysis.filter(l => l.category === 'engagement').reduce((sum, l) => sum + l.mean, 0) / Math.max(stats.likertAnalysis.filter(l => l.category === 'engagement').length, 1);
    const satisfactionAvg = stats.likertAnalysis.filter(l => l.category === 'satisfaction').reduce((sum, l) => sum + l.mean, 0) / Math.max(stats.likertAnalysis.filter(l => l.category === 'satisfaction').length, 1);

    const textTrust = stats.likertByMode.text.filter(l => l.category === 'trust');
    const textEngagement = stats.likertByMode.text.filter(l => l.category === 'engagement');
    const textSatisfaction = stats.likertByMode.text.filter(l => l.category === 'satisfaction');
    const avatarTrust = stats.likertByMode.avatar.filter(l => l.category === 'trust');
    const avatarEngagement = stats.likertByMode.avatar.filter(l => l.category === 'engagement');
    const avatarSatisfaction = stats.likertByMode.avatar.filter(l => l.category === 'satisfaction');

    autoTable(doc, {
      startY: yPos,
      head: [['Category', 'Overall Mean', 'Text Mode', 'Avatar Mode']],
      body: [
        ['Trust', trustAvg.toFixed(2), 
          (textTrust.reduce((sum, l) => sum + l.mean, 0) / Math.max(textTrust.length, 1)).toFixed(2),
          (avatarTrust.reduce((sum, l) => sum + l.mean, 0) / Math.max(avatarTrust.length, 1)).toFixed(2)
        ],
        ['Engagement', engagementAvg.toFixed(2),
          (textEngagement.reduce((sum, l) => sum + l.mean, 0) / Math.max(textEngagement.length, 1)).toFixed(2),
          (avatarEngagement.reduce((sum, l) => sum + l.mean, 0) / Math.max(avatarEngagement.length, 1)).toFixed(2)
        ],
        ['Satisfaction', satisfactionAvg.toFixed(2),
          (textSatisfaction.reduce((sum, l) => sum + l.mean, 0) / Math.max(textSatisfaction.length, 1)).toFixed(2),
          (avatarSatisfaction.reduce((sum, l) => sum + l.mean, 0) / Math.max(avatarSatisfaction.length, 1)).toFixed(2)
        ],
      ],
      theme: 'striped',
      headStyles: { fillColor: [236, 72, 153] },
      margin: { left: 14, right: 14 },
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Perception Chart
    const perceptionData = [
      { name: 'Trust', value: Math.round(trustAvg * 20) },
      { name: 'Engagement', value: Math.round(engagementAvg * 20) },
      { name: 'Satisfaction', value: Math.round(satisfactionAvg * 20) },
    ];
    yPos = drawBarChart(doc, perceptionData, 14, yPos, 100, 50, 'Perception Scores (% of max)', ['#ec4899', '#f472b6', '#f9a8d4']);

    // Check page break
    if (yPos > 180) {
      doc.addPage();
      yPos = 20;
    }

    // Avatar Time by Slide
    if (stats.avatarTimeBySlide.length > 0) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('8. Avatar Interaction Time by Slide', 14, yPos);
      yPos += 8;

      const slideTimeData = stats.avatarTimeBySlide.slice(0, 7).map(s => ({
        name: s.slide.length > 20 ? s.slide.substring(0, 18) + '...' : s.slide,
        value: Math.round(s.avgTime / 60),
      }));
      yPos = drawBarChart(doc, slideTimeData, 14, yPos, 180, 70, 'Average Time per Slide (minutes)', ['#06b6d4', '#22d3ee', '#67e8f9', '#a5f3fc', '#cffafe', '#0891b2', '#0e7490']);
    }

    if (stats.textTimeBySlide.length > 0) {
      if (yPos > 180) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('9. Text Mode Time by Slide', 14, yPos);
      yPos += 8;

      const slideTimeData = stats.textTimeBySlide.slice(0, 7).map(s => ({
        name: s.slide.length > 20 ? s.slide.substring(0, 18) + '...' : s.slide,
        value: Math.round(s.avgTime / 60),
      }));
      yPos = drawBarChart(doc, slideTimeData, 14, yPos, 180, 70, 'Average Time per Slide (minutes)', ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5', '#059669', '#047857']);
    }

    if (stats.pageTimeByPage.length > 0) {
      if (yPos > 180) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('10. Time by Page', 14, yPos);
      yPos += 8;

      const pageTimeData = stats.pageTimeByPage.slice(0, 7).map(p => ({
        name: p.page.length > 20 ? p.page.substring(0, 18) + '...' : p.page,
        value: Math.round(p.avgTime / 60),
      }));
      yPos = drawBarChart(doc, pageTimeData, 14, yPos, 180, 70, 'Average Time per Page (minutes)', ['#f59e0b', '#fbbf24', '#fcd34d', '#fde68a', '#fef3c7', '#d97706', '#b45309']);
    }

    // Check page break
    if (yPos > 180) {
      doc.addPage();
      yPos = 20;
    }

    // Question Performance
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('11. Question Performance', 14, yPos);
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
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // Question Performance Chart
    const preTestPerformance = stats.preTestQuestionAnalysis.slice(0, 5).map((q, i) => ({
      name: `Pre Q${i + 1}`,
      value: q.correctRate,
    }));
    const postTestPerformance = stats.postTestQuestionAnalysis.slice(0, 5).map((q, i) => ({
      name: `Post Q${i + 1}`,
      value: q.correctRate,
    }));
    
    if (preTestPerformance.length > 0 || postTestPerformance.length > 0) {
      // Check page break
      if (yPos > 200) {
        doc.addPage();
        yPos = 20;
      }
      
      yPos = drawBarChart(doc, [...preTestPerformance, ...postTestPerformance], 14, yPos, 180, 80, 'Question Correct Rate (%)', ['#ef4444', '#f87171', '#fca5a5', '#fecaca', '#fee2e2', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5']);
    }

    // Sessions per Day Chart
    if (stats.sessionsPerDay.length > 0) {
      // Check page break
      if (yPos > 200) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('10. Data Collection Timeline', 14, yPos);
      yPos += 8;
      
      const timelineData = stats.sessionsPerDay.slice(-14).map(s => ({
        name: s.date,
        value: s.count,
      }));
      yPos = drawBarChart(doc, timelineData, 14, yPos, 180, 80, 'Sessions per Day (last 14 days)', ['#3b82f6']);
    }

    // Engagement Metrics Correlation Comparison Summary
    if (stats.correlations.avatarTimeVsGain.length >= 2 || stats.correlations.learningTimeVsGain.length >= 2 || stats.correlations.sessionTimeVsGain.length >= 2) {
      // Check page break
      if (yPos > 180) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('11. Engagement Metrics Comparison Summary', 14, yPos);
      yPos += 8;
      
      // Calculate correlations
      const calcCorrelation = (data: { x: number; y: number }[]) => {
        if (data.length < 2) return { r: 0, r2: 0, slope: 0, intercept: 0 };
        const n = data.length;
        const xValues = data.map(d => d.x);
        const yValues = data.map(d => d.y);
        const sumX = xValues.reduce((a, b) => a + b, 0);
        const sumY = yValues.reduce((a, b) => a + b, 0);
        const sumXY = data.reduce((a, d) => a + d.x * d.y, 0);
        const sumX2 = xValues.reduce((a, b) => a + b * b, 0);
        const sumY2 = yValues.reduce((a, b) => a + b * b, 0);
        
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        const r = denominator !== 0 ? numerator / denominator : 0;
        
        const denomSlope = n * sumX2 - sumX * sumX;
        const slope = denomSlope !== 0 ? (n * sumXY - sumX * sumY) / denomSlope : 0;
        const intercept = (sumY - slope * sumX) / n;
        
        return { r, r2: r * r, slope, intercept };
      };
      
      const avatarTimeData = stats.correlations.avatarTimeVsGain.filter(d => d.x > 0);
      const learningTimeData = stats.correlations.learningTimeVsGain.filter(d => d.x > 0);
      const sessionTimeData = stats.correlations.sessionTimeVsGain;
      const avatarCorr = calcCorrelation(avatarTimeData);
      const learningCorr = calcCorrelation(learningTimeData);
      const sessionCorr = calcCorrelation(sessionTimeData);
      
      const getInterpretation = (r: number) => {
        const absR = Math.abs(r);
        if (absR >= 0.7) return 'Strong';
        if (absR >= 0.4) return 'Moderate';
        if (absR >= 0.2) return 'Weak';
        return 'Negligible';
      };
      
      const getDirection = (r: number) => r > 0 ? 'Positive' : r < 0 ? 'Negative' : 'None';
      
      const metrics = [
        { label: 'Avatar Slide Time', corr: avatarCorr, data: avatarTimeData },
        { label: 'Learning Slides Time', corr: learningCorr, data: learningTimeData },
        { label: 'Session Duration', corr: sessionCorr, data: sessionTimeData },
      ];

      const metricsWithData = metrics.filter(m => m.data.length >= 2);
      const maxStrength = metricsWithData.length > 0
        ? Math.max(...metricsWithData.map(m => Math.abs(m.corr.r)))
        : 0;
      const eps = 1e-6;
      const strongestMetrics = metricsWithData.filter(m => Math.abs(Math.abs(m.corr.r) - maxStrength) < eps);
      const strongerMetric = strongestMetrics.length === 1 ? strongestMetrics[0].label : 'Equal';
      const strongestEntry = strongerMetric === 'Equal' ? null : metrics.find(m => m.label === strongerMetric);
      
      autoTable(doc, {
        startY: yPos,
        head: [['Metric', 'Pearson r', 'R²', 'Direction', 'Strength', 'Sample Size']],
        body: metrics.map((metric) => {
          const hasData = metric.data.length >= 2;
          return [
            metric.label,
            hasData ? metric.corr.r.toFixed(3) : 'n/a',
            hasData ? (metric.corr.r2 * 100).toFixed(1) + '%' : 'n/a',
            hasData ? getDirection(metric.corr.r) : 'n/a',
            hasData ? getInterpretation(metric.corr.r) : 'n/a',
            metric.data.length.toString(),
          ];
        }),
        theme: 'striped',
        headStyles: { fillColor: [6, 182, 212] },
        margin: { left: 14, right: 14 },
      });
      yPos = (doc as any).lastAutoTable.finalY + 8;
      
      // Summary interpretation
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0);
      doc.text('Key Finding:', 14, yPos);
      yPos += 5;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      if (metricsWithData.length === 0) {
        doc.text('Not enough data to compare engagement metrics.', 14, yPos);
      } else if (strongerMetric === 'Equal') {
        doc.text('Engagement metrics show similar correlation strength with learning outcomes.', 14, yPos);
      } else {
        const variance = strongestEntry ? (strongestEntry.corr.r2 * 100).toFixed(1) : '0';
        doc.text(`${strongerMetric} shows the stronger correlation with knowledge gain (R² = ${variance}%),`, 14, yPos);
        yPos += 5;
        doc.text(`explaining ${variance}% of the variance in learning outcomes.`, 14, yPos);
      }
      yPos += 10;
      
      // Recommendations
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Implications:', 14, yPos);
      yPos += 5;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      if (maxStrength > 0.3) {
        doc.text('• Engagement time is a meaningful predictor of learning success.', 14, yPos);
        yPos += 4;
        doc.text('• Consider strategies to increase participant engagement duration.', 14, yPos);
      } else {
        doc.text('• Engagement duration shows limited predictive value for learning outcomes.', 14, yPos);
        yPos += 4;
        doc.text('• Other factors (e.g., prior knowledge, learning style) may be more influential.', 14, yPos);
      }
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
      doc.text('AI Image Generation Learning Study - Research Report', 14, 290);
    }

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
    return <div className="text-muted-foreground">Error loading statistics</div>;
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
      <Card className="bg-card/50 border-border">
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
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="w-[160px] bg-background border-border">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed Only</SelectItem>
                  <SelectItem value="incomplete">Incomplete Only</SelectItem>
                  <SelectItem value="all">All Sessions</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                checked={includeFlagged}
                onCheckedChange={(checked) => setIncludeFlagged(Boolean(checked))}
              />
              <span className="text-sm text-foreground/80">Include flagged (pending)</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground/90 transition"
                      aria-label="About flagged sessions"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    Adds suspicious sessions to charts and exports. Ignored and reset sessions remain excluded.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                checked={includeImputed}
                onCheckedChange={(checked) => setIncludeImputed(Boolean(checked))}
              />
              <span className="text-sm text-foreground/80">Include owner backfills</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground/90 transition"
                      aria-label="About owner backfills"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    Includes owner-imputed timing and manually backfilled pre/post answers in charts and exports.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground/70 uppercase tracking-wider mr-2">Export:</span>
            <Button variant="outline" size="sm" onClick={exportComprehensiveCSV} className="gap-2 border-border h-8 text-xs">
              <FileSpreadsheet className="w-3 h-3" />
              Full CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportComprehensiveJSON} className="gap-2 border-border h-8 text-xs">
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
      <Card className="bg-gradient-to-r from-card to-card/80 border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-primary" />
              Summary Statistics
            </CardTitle>
            <Badge variant="outline" className="text-muted-foreground">
              {statusFilter === 'completed' ? 'Completed sessions' : statusFilter === 'incomplete' ? 'Incomplete sessions' : 'All sessions'}
            </Badge>
          </div>
          <CardDescription className="text-muted-foreground">
            Key metrics for {stats.rawSessions.length} sessions in selected range
            {stats.missingScoreSessions.length > 0 && (
              <span className="text-amber-400"> • {stats.missingScoreSessions.length} sessions missing score data</span>
            )}
          </CardDescription>
          <div className="mt-1 text-xs text-muted-foreground/70">
            Sample sizes: Pre/Post/Gain use sessions with scored knowledge answers (n={stats.knowledgeGain.length}). Avatar time uses sessions with slide timing (n={stats.avatarSessionsTracked}). Session duration uses completed sessions (n={stats.totalCompleted}).
            {!includeImputed && <span> Owner backfills excluded.</span>}
          </div>
          {stats.missingScoreSessions.length > 0 && (
            <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-100">
              <div className="flex items-center justify-between gap-2">
                <span>Missing score data sessions (n={stats.missingScoreSessions.length})</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-amber-100"
                  onClick={() => setShowMissingScores((prev) => !prev)}
                >
                  {showMissingScores ? 'Hide' : 'Show'}
                </Button>
              </div>
              {showMissingScores && (
                <div className="mt-2 space-y-1 text-[11px] text-amber-100/90">
                  {stats.missingScoreSessions.map((entry) => (
                    <div key={entry.sessionId} className="flex flex-wrap gap-x-2">
                      <span className="font-mono">{entry.sessionId}</span>
                      <span className="uppercase text-[10px] text-amber-200/70">{entry.mode}</span>
                      <span>{entry.reasons.join(' • ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">Sessions</div>
              <div className="text-2xl font-bold text-white">{stats.rawSessions.length}</div>
              <div className="text-[10px] text-muted-foreground/70 mt-1">{statusFilter}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">Avg Pre-Test</div>
              <div className="text-2xl font-bold text-red-400">{stats.avgPreScore || 0}%</div>
              <div className="text-[10px] text-muted-foreground/70 mt-1">n={stats.knowledgeGain.length}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">Avg Post-Test</div>
              <div className="text-2xl font-bold text-green-400">{stats.avgPostScore || 0}%</div>
              <div className="text-[10px] text-muted-foreground/70 mt-1">n={stats.knowledgeGain.length}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">Avg Gain</div>
              <div className={`text-2xl font-bold ${stats.avgGain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {stats.avgGain >= 0 ? '+' : ''}{stats.avgGain || 0}%
              </div>
              <div className="text-[10px] text-muted-foreground/70 mt-1">learning effect</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">Avg Session</div>
              <div className="text-2xl font-bold text-yellow-400">{stats.avgSessionDuration} min</div>
              <div className="text-[10px] text-muted-foreground/70 mt-1">duration</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">Avg Avatar</div>
              <div className="text-2xl font-bold text-purple-400">{Math.round(stats.avgAvatarTime / 60)} min</div>
              <div className="text-[10px] text-muted-foreground/70 mt-1">interaction</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-2">Mode Distribution</div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-blue-400">Text:</span><span>{stats.textModeCompleted}</span></div>
                <div className="flex justify-between"><span className="text-purple-400">Avatar:</span><span>{stats.avatarModeCompleted}</span></div>
                {stats.bothModesCompleted > 0 && (
                  <div className="flex justify-between"><span className="text-green-400">Both:</span><span>{stats.bothModesCompleted}</span></div>
                )}
                {stats.noModeCount > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">No Mode:</span><span>{stats.noModeCount}</span></div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Quality & Suspicious Activity */}
      {(stats.suspiciousCount > 0 || stats.resetCount > 0) && (() => {
        // Check if there are any unresolved alerts
        const hasUnresolvedAlerts = stats.pendingCount > 0 || stats.awaitingApprovalCount > 0;
        const allResolved = stats.pendingCount === 0 && stats.awaitingApprovalCount === 0;
        
        return (
          <Card className={`transition-all duration-300 ${
            hasUnresolvedAlerts 
              ? 'bg-gradient-to-r from-amber-900/30 to-red-900/30 border-amber-700/50' 
              : 'bg-card/30 border-border/50 opacity-75'
          }`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <AlertTriangle className={`w-5 h-5 ${hasUnresolvedAlerts ? 'text-amber-400' : 'text-muted-foreground/70'}`} />
                Data Quality Alerts
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-muted-foreground/70 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <div className="text-xs space-y-2">
                        <p className="font-semibold">Requirements to avoid flags</p>
                        <ul className="space-y-1">
                          {getSuspicionRequirements(activeSlideCount).map((req) => (
                            <li key={req.id}>• {req.label}</li>
                          ))}
                        </ul>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {hasUnresolvedAlerts && (
                  <Badge variant="destructive" className="ml-2 animate-pulse bg-red-600">
                    {stats.pendingCount + stats.awaitingApprovalCount} New
                  </Badge>
                )}
                {allResolved && (
                  <Badge variant="outline" className="ml-2 text-green-400 border-green-600">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    All Resolved
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {hasUnresolvedAlerts 
                  ? 'Sessions flagged for potential data quality issues. Manage validation in the Sessions tab.'
                  : 'All flagged sessions have been reviewed.'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-card/50 rounded-lg p-4 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Flagged</div>
                  <div className={`text-2xl font-bold ${hasUnresolvedAlerts ? 'text-amber-400' : 'text-muted-foreground/70'}`}>{stats.suspiciousCount}</div>
                  <div className="text-[10px] text-muted-foreground/70 mt-1">total alerts</div>
                </div>
                <div className={`rounded-lg p-4 text-center ${stats.pendingCount > 0 ? 'bg-yellow-900/30 border border-yellow-600/50' : 'bg-card/50'}`}>
                  <div className="text-xs text-muted-foreground mb-1">Pending</div>
                  <div className={`text-2xl font-bold ${stats.pendingCount > 0 ? 'text-yellow-400 animate-pulse' : 'text-muted-foreground/70'}`}>{stats.pendingCount}</div>
                  <div className="text-[10px] text-muted-foreground/70 mt-1">needs review</div>
                </div>
                <div className="bg-card/50 rounded-lg p-4 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Accepted</div>
                  <div className="text-2xl font-bold text-green-400">{stats.acceptedCount}</div>
                  <div className="text-[10px] text-muted-foreground/70 mt-1">in statistics</div>
                </div>
                <div className="bg-card/50 rounded-lg p-4 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Ignored</div>
                  <div className="text-2xl font-bold text-red-400">{stats.ignoredCount}</div>
                  <div className="text-[10px] text-muted-foreground/70 mt-1">excluded</div>
                </div>
                <div className="bg-card/50 rounded-lg p-4">
                  <div className="text-xs text-muted-foreground mb-2">Top Flags</div>
                  <div className="space-y-1 text-xs max-h-16 overflow-y-auto">
                    {stats.suspiciousFlags.slice(0, 3).map(f => {
                      const details = describeSuspicionFlag(f.flag);
                      return (
                      <TooltipProvider key={f.flag}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex justify-between cursor-help">
                              <span className="text-amber-400 truncate mr-2">{f.flag.replace(/_/g, ' ').slice(0, 20)}...</span>
                              <span className="text-foreground/80">{f.count}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="text-xs space-y-1">
                              <p className="font-medium">{f.flag.replace(/_/g, ' ')}</p>
                              {details.summary && (
                                <p className="text-foreground/80">{details.summary}</p>
                              )}
                              {details.reason && (
                                <p className="text-muted-foreground">{details.reason}</p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      );
                    })}
                    {stats.suspiciousFlags.length === 0 && (
                      <div className="text-muted-foreground/70">No flags</div>
                    )}
                  </div>
                </div>
              </div>
              {stats.awaitingApprovalCount > 0 && (
                <div className="mt-3 bg-orange-900/30 border border-orange-600/50 rounded-lg p-3 text-center">
                  <div className="text-xs text-orange-300 mb-1">Awaiting Owner Approval</div>
                  <div className="text-2xl font-bold text-orange-400 animate-pulse">{stats.awaitingApprovalCount}</div>
                  <div className="text-[10px] text-orange-300/70 mt-1">admin validations pending owner review</div>
                </div>
              )}
              {stats.resetCount > 0 && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <div className="flex items-center gap-2 text-sm text-red-400">
                    <span className="font-medium">{stats.resetCount}</span>
                    <span className="text-muted-foreground">session(s) were reset due to invalid actions (e.g., mode switching attempts)</span>
                  </div>
                </div>
              )}
              {hasUnresolvedAlerts && (
                <p className="text-xs text-muted-foreground/70 mt-3">
                  💡 Tip: Go to the <strong>Sessions</strong> tab, filter by "Suspicious" status, and click the ✓ or ✗ buttons to accept or ignore flagged sessions.
                </p>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Knowledge Gain Analysis */}
      <Card className="bg-card border-border">
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
                    <Info className="w-4 h-4 text-muted-foreground/70 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">Post-Test Score minus Pre-Test Score. Only sessions with BOTH pre-test AND post-test scored responses are included. If you have {stats.rawSessions.length} sessions but only {stats.knowledgeGain.length} with scores, some sessions are missing pre-test or post-test answers, or questions don't have correct answers set.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <ExportButton onClick={exportKnowledgeGainCSV} label="CSV" canExport={permissions.canExportData} />
          </div>
          <CardDescription className="text-muted-foreground">
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
                    <span className="text-muted-foreground/70 text-xs">n={stats.knowledgeGain.filter(k => k.mode === 'text').length}</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pre-Test:</span>
                      <span className="text-red-400">{stats.textModePreScore}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Post-Test:</span>
                      <span className="text-green-400">{stats.textModePostScore}%</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2 mt-2">
                      <span className="text-foreground/80 font-medium">Gain:</span>
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
                    <span className="text-muted-foreground/70 text-xs">n={stats.knowledgeGain.filter(k => k.mode === 'avatar').length}</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pre-Test:</span>
                      <span className="text-red-400">{stats.avatarModePreScore}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Post-Test:</span>
                      <span className="text-green-400">{stats.avatarModePostScore}%</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2 mt-2">
                      <span className="text-foreground/80 font-medium">Gain:</span>
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
                  <h4 className="text-sm font-medium text-foreground/80 mb-3">Pre-Test vs Post-Test (Overall)</h4>
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
                  <h4 className="text-sm font-medium text-foreground/80 mb-3">Pre vs Post by Mode</h4>
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
                <div className="border-t border-border pt-4">
                  <div className="flex items-center gap-2 mb-4">
                    <h4 className="text-sm font-medium text-foreground/80">Statistical Analysis (Welch's t-test + Effect Size)</h4>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-muted-foreground/70 cursor-help" />
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
                  <div className={`rounded-lg p-4 border mb-4 ${stats.statisticalTests.textVsAvatar.significant ? 'bg-green-900/20 border-green-700/50' : 'bg-muted/30 border-border'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-medium text-foreground/90">Text Mode vs Avatar Mode</div>
                      <div className={`px-2 py-0.5 rounded text-xs font-medium ${
                        stats.statisticalTests.textVsAvatar.effectSize === 'large' ? 'bg-purple-500/30 text-purple-300' :
                        stats.statisticalTests.textVsAvatar.effectSize === 'medium' ? 'bg-blue-500/30 text-blue-300' :
                        stats.statisticalTests.textVsAvatar.effectSize === 'small' ? 'bg-yellow-500/30 text-yellow-300' :
                        'bg-muted-foreground/30 text-muted-foreground'
                      }`}>
                        {stats.statisticalTests.textVsAvatar.effectSize} effect
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {/* Left: Descriptive stats */}
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Text Mean (SD):</span>
                          <span className="text-blue-400">{stats.statisticalTests.textVsAvatar.textMean}% (±{stats.statisticalTests.textVsAvatar.textStd})</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Avatar Mean (SD):</span>
                          <span className="text-purple-400">{stats.statisticalTests.textVsAvatar.avatarMean}% (±{stats.statisticalTests.textVsAvatar.avatarStd})</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Sample sizes:</span>
                          <span className="text-foreground/80">n₁={stats.statisticalTests.textVsAvatar.textN}, n₂={stats.statisticalTests.textVsAvatar.avatarN}</span>
                        </div>
                      </div>
                      
                      {/* Right: Inferential stats */}
                      <div className="space-y-2 text-xs border-l border-border pl-4">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">t-statistic:</span>
                          <span className="text-white font-medium">{stats.statisticalTests.textVsAvatar.tStatistic}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">p-value:</span>
                          <span className={stats.statisticalTests.textVsAvatar.significant ? 'text-green-400 font-medium' : 'text-foreground/80'}>
                            {stats.statisticalTests.textVsAvatar.pValue < 0.001 ? '<0.001' : stats.statisticalTests.textVsAvatar.pValue}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cohen's d:</span>
                          <span className="text-white font-medium">{stats.statisticalTests.textVsAvatar.cohensD}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">95% CI:</span>
                          <span className="text-cyan-400">[{stats.statisticalTests.textVsAvatar.ci95Lower}, {stats.statisticalTests.textVsAvatar.ci95Upper}]</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className={`mt-3 text-xs text-center py-1.5 rounded ${stats.statisticalTests.textVsAvatar.significant ? 'bg-green-500/20 text-green-400' : 'bg-muted-foreground/30 text-muted-foreground'}`}>
                      {stats.statisticalTests.textVsAvatar.significant 
                        ? `✓ Significant (p < 0.05) with ${stats.statisticalTests.textVsAvatar.effectSize} effect size` 
                        : 'Not statistically significant'}
                    </div>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[150px] text-muted-foreground/70">
              <AlertTriangle className="w-8 h-8 mb-2 text-amber-500" />
              <p>No knowledge gain data available</p>
              <p className="text-xs mt-1">Requires both pre-test and post-test questions to have correct answers set</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Correlation Analysis - Scatter Plots */}
      {(stats.correlations.avatarTimeVsGain.length > 0 || stats.correlations.learningTimeVsGain.length > 0 || stats.correlations.sessionTimeVsGain.length > 0) && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-white">Correlation Analysis</CardTitle>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-muted-foreground/70 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p className="text-xs">
                        Time-based engagement vs learning outcomes.<br/>
                        Avatar Time = slide time while avatar is active (per-entry mode).<br/>
                        Learning Slides Time = sum of slide time across modes.<br/>
                        Session Duration = full session (start to completion).<br/>
                        <strong>r:</strong> Correlation coefficient (-1 to 1).<br/>
                        <strong>R²:</strong> Variance explained by the relationship.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <ExportButton onClick={exportCorrelationCSV} label="CSV" size="xs" canExport={permissions.canExportData} />
            </div>
            <CardDescription className="text-muted-foreground">
              Time metrics vs knowledge gain with trend lines
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="text-xs text-muted-foreground space-y-1">
                <p><span className="text-foreground/80">Avatar Time:</span> sum of slide time while avatar is active (multiple passes add up).</p>
                <p><span className="text-foreground/80">Learning Slides Time:</span> sum of slide time across modes (slides only, pages excluded).</p>
                <p><span className="text-foreground/80">Session Duration:</span> full session time from start to completion (includes consent/pre/post).</p>
                <p>Only sessions with both pre-test and post-test scores are included; each plot's n counts sessions with non-zero time for that metric.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {/* Avatar Time vs Knowledge Gain */}
              <div>
                <h4 className="text-sm font-medium text-foreground/80 mb-3">Avatar Slide Time vs Knowledge Gain</h4>
                {stats.correlations.avatarTimeVsGain.filter(d => d.x > 0).length > 0 ? (
                  (() => {
                    const data = stats.correlations.avatarTimeVsGain.filter(d => d.x > 0);
                    // Calculate trend line
                    let trendLine: { x: number; y: number }[] = [];
                    if (data.length >= 2) {
                      const n = data.length;
                      const xVals = data.map(d => d.x);
                      const yVals = data.map(d => d.y);
                      const sumX = xVals.reduce((a, b) => a + b, 0);
                      const sumY = yVals.reduce((a, b) => a + b, 0);
                      const sumXY = data.reduce((a, d) => a + d.x * d.y, 0);
                      const sumX2 = xVals.reduce((a, b) => a + b * b, 0);
                      const denomSlope = n * sumX2 - sumX * sumX;
                      if (denomSlope !== 0) {
                        const slope = (n * sumXY - sumX * sumY) / denomSlope;
                        const intercept = (sumY - slope * sumX) / n;
                        const minX = Math.min(...xVals);
                        const maxX = Math.max(...xVals);
                        trendLine = [
                          { x: minX, y: slope * minX + intercept },
                          { x: maxX, y: slope * maxX + intercept }
                        ];
                      }
                    }
                    return (
                      <ResponsiveContainer width="100%" height={220}>
                        <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis 
                            type="number" 
                            dataKey="x" 
                            name="Avatar Slide Time" 
                            stroke="#9ca3af" 
                            fontSize={11}
                            label={{ value: 'Avatar Slide Time (min)', position: 'bottom', offset: 0, style: { fill: '#9ca3af', fontSize: 10 } }}
                          />
                          <YAxis 
                            type="number" 
                            dataKey="y" 
                            name="Knowledge Gain" 
                            stroke="#9ca3af" 
                            fontSize={11}
                            label={{ value: 'Gain %', angle: -90, position: 'insideLeft', style: { fill: '#9ca3af', fontSize: 10 } }}
                          />
                          <ZAxis range={[50, 50]} />
                          <ChartTooltip content={renderTimeGainTooltip('Avatar Slide Time')} />
                          <Scatter 
                            data={data} 
                            fill="#8b5cf6"
                          />
                          {trendLine.length === 2 && (
                            <Scatter 
                              data={trendLine} 
                              fill="none"
                              line={{ stroke: '#ef4444', strokeWidth: 2 }}
                              shape={() => null}
                            />
                          )}
                        </ScatterChart>
                      </ResponsiveContainer>
                    );
                  })()
                ) : (
                  <div className="h-[220px] flex items-center justify-center text-muted-foreground/70 text-sm">
                    No avatar-only slide timing data
                  </div>
                )}
                {(() => {
                  const data = stats.correlations.avatarTimeVsGain.filter(d => d.x > 0);
                  if (data.length < 2) return null;
                  const n = data.length;
                  const xVals = data.map(d => d.x);
                  const yVals = data.map(d => d.y);
                  const sumX = xVals.reduce((a, b) => a + b, 0);
                  const sumY = yVals.reduce((a, b) => a + b, 0);
                  const sumXY = data.reduce((a, d) => a + d.x * d.y, 0);
                  const sumX2 = xVals.reduce((a, b) => a + b * b, 0);
                  const sumY2 = yVals.reduce((a, b) => a + b * b, 0);
                  const num = n * sumXY - sumX * sumY;
                  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
                  const r = den !== 0 ? num / den : 0;
                  const r2 = r * r;
                  const strength = Math.abs(r) >= 0.7 ? 'Strong' : Math.abs(r) >= 0.4 ? 'Moderate' : Math.abs(r) >= 0.2 ? 'Weak' : 'Negligible';
                  return (
                    <div className="mt-2 text-xs text-muted-foreground flex items-center gap-4">
                      <span>r = <span className="text-white font-medium">{r.toFixed(3)}</span></span>
                      <span>R² = <span className="text-cyan-400 font-medium">{(r2 * 100).toFixed(1)}%</span></span>
                      <span className={`px-2 py-0.5 rounded ${Math.abs(r) >= 0.4 ? 'bg-green-900/30 text-green-400' : 'bg-muted text-muted-foreground'}`}>
                        {strength}
                      </span>
                      <span className="text-muted-foreground/70">n={n}</span>
                    </div>
                  );
                })()}
              </div>

              {/* Learning Slides Time vs Knowledge Gain */}
              <div>
                <h4 className="text-sm font-medium text-foreground/80 mb-3">Learning Slides Time vs Knowledge Gain</h4>
                {stats.correlations.learningTimeVsGain.filter(d => d.x > 0).length > 0 ? (
                  (() => {
                    const data = stats.correlations.learningTimeVsGain.filter(d => d.x > 0);
                    let trendLine: { x: number; y: number }[] = [];
                    if (data.length >= 2) {
                      const n = data.length;
                      const xVals = data.map(d => d.x);
                      const yVals = data.map(d => d.y);
                      const sumX = xVals.reduce((a, b) => a + b, 0);
                      const sumY = yVals.reduce((a, b) => a + b, 0);
                      const sumXY = data.reduce((a, d) => a + d.x * d.y, 0);
                      const sumX2 = xVals.reduce((a, b) => a + b * b, 0);
                      const denomSlope = n * sumX2 - sumX * sumX;
                      if (denomSlope !== 0) {
                        const slope = (n * sumXY - sumX * sumY) / denomSlope;
                        const intercept = (sumY - slope * sumX) / n;
                        const minX = Math.min(...xVals);
                        const maxX = Math.max(...xVals);
                        trendLine = [
                          { x: minX, y: slope * minX + intercept },
                          { x: maxX, y: slope * maxX + intercept }
                        ];
                      }
                    }
                    return (
                      <ResponsiveContainer width="100%" height={220}>
                        <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis 
                            type="number" 
                            dataKey="x" 
                            name="Learning Slides Time" 
                            stroke="#9ca3af" 
                            fontSize={11}
                            label={{ value: 'Learning Slides Time (min)', position: 'bottom', offset: 0, style: { fill: '#9ca3af', fontSize: 10 } }}
                          />
                          <YAxis 
                            type="number" 
                            dataKey="y" 
                            name="Knowledge Gain" 
                            stroke="#9ca3af" 
                            fontSize={11}
                            label={{ value: 'Gain %', angle: -90, position: 'insideLeft', style: { fill: '#9ca3af', fontSize: 10 } }}
                          />
                          <ZAxis range={[50, 50]} />
                          <ChartTooltip content={renderTimeGainTooltip('Learning Slides Time')} />
                          <Scatter 
                            data={data} 
                            fill="#10b981"
                          />
                          {trendLine.length === 2 && (
                            <Scatter 
                              data={trendLine} 
                              fill="none"
                              line={{ stroke: '#ef4444', strokeWidth: 2 }}
                              shape={() => null}
                            />
                          )}
                        </ScatterChart>
                      </ResponsiveContainer>
                    );
                  })()
                ) : (
                  <div className="h-[220px] flex items-center justify-center text-muted-foreground/70 text-sm">
                    No learning slides timing data
                  </div>
                )}
                {(() => {
                  const data = stats.correlations.learningTimeVsGain.filter(d => d.x > 0);
                  if (data.length < 2) return null;
                  const n = data.length;
                  const xVals = data.map(d => d.x);
                  const yVals = data.map(d => d.y);
                  const sumX = xVals.reduce((a, b) => a + b, 0);
                  const sumY = yVals.reduce((a, b) => a + b, 0);
                  const sumXY = data.reduce((a, d) => a + d.x * d.y, 0);
                  const sumX2 = xVals.reduce((a, b) => a + b * b, 0);
                  const sumY2 = yVals.reduce((a, b) => a + b * b, 0);
                  const num = n * sumXY - sumX * sumY;
                  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
                  const r = den !== 0 ? num / den : 0;
                  const r2 = r * r;
                  const strength = Math.abs(r) >= 0.7 ? 'Strong' : Math.abs(r) >= 0.4 ? 'Moderate' : Math.abs(r) >= 0.2 ? 'Weak' : 'Negligible';
                  return (
                    <div className="mt-2 text-xs text-muted-foreground flex items-center gap-4">
                      <span>r = <span className="text-white font-medium">{r.toFixed(3)}</span></span>
                      <span>R² = <span className="text-cyan-400 font-medium">{(r2 * 100).toFixed(1)}%</span></span>
                      <span className={`px-2 py-0.5 rounded ${Math.abs(r) >= 0.4 ? 'bg-green-900/30 text-green-400' : 'bg-muted text-muted-foreground'}`}>
                        {strength}
                      </span>
                      <span className="text-muted-foreground/70">n={n}</span>
                    </div>
                  );
                })()}
              </div>

              {/* Session Duration vs Knowledge Gain */}
              <div>
                <h4 className="text-sm font-medium text-foreground/80 mb-3">Full Session Duration vs Knowledge Gain</h4>
                {stats.correlations.sessionTimeVsGain.length > 0 ? (
                  (() => {
                    const data = stats.correlations.sessionTimeVsGain;
                    // Calculate trend line
                    let trendLine: { x: number; y: number }[] = [];
                    if (data.length >= 2) {
                      const n = data.length;
                      const xVals = data.map(d => d.x);
                      const yVals = data.map(d => d.y);
                      const sumX = xVals.reduce((a, b) => a + b, 0);
                      const sumY = yVals.reduce((a, b) => a + b, 0);
                      const sumXY = data.reduce((a, d) => a + d.x * d.y, 0);
                      const sumX2 = xVals.reduce((a, b) => a + b * b, 0);
                      const denomSlope = n * sumX2 - sumX * sumX;
                      if (denomSlope !== 0) {
                        const slope = (n * sumXY - sumX * sumY) / denomSlope;
                        const intercept = (sumY - slope * sumX) / n;
                        const minX = Math.min(...xVals);
                        const maxX = Math.max(...xVals);
                        trendLine = [
                          { x: minX, y: slope * minX + intercept },
                          { x: maxX, y: slope * maxX + intercept }
                        ];
                      }
                    }
                    return (
                      <ResponsiveContainer width="100%" height={220}>
                        <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis 
                            type="number" 
                            dataKey="x" 
                            name="Session Duration" 
                            stroke="#9ca3af" 
                            fontSize={11}
                            label={{ value: 'Session Duration (min, full)', position: 'bottom', offset: 0, style: { fill: '#9ca3af', fontSize: 10 } }}
                          />
                          <YAxis 
                            type="number" 
                            dataKey="y" 
                            name="Knowledge Gain" 
                            stroke="#9ca3af" 
                            fontSize={11}
                            label={{ value: 'Gain %', angle: -90, position: 'insideLeft', style: { fill: '#9ca3af', fontSize: 10 } }}
                          />
                          <ZAxis range={[50, 50]} />
                          <ChartTooltip content={renderTimeGainTooltip('Session Duration')} />
                          <Scatter 
                            data={data} 
                            fill="#3b82f6"
                          />
                          {trendLine.length === 2 && (
                            <Scatter 
                              data={trendLine} 
                              fill="none"
                              line={{ stroke: '#ef4444', strokeWidth: 2 }}
                              shape={() => null}
                            />
                          )}
                        </ScatterChart>
                      </ResponsiveContainer>
                    );
                  })()
                ) : (
                  <div className="h-[220px] flex items-center justify-center text-muted-foreground/70 text-sm">
                    No session duration data
                  </div>
                )}
                {(() => {
                  const data = stats.correlations.sessionTimeVsGain;
                  if (data.length < 2) return null;
                  const n = data.length;
                  const xVals = data.map(d => d.x);
                  const yVals = data.map(d => d.y);
                  const sumX = xVals.reduce((a, b) => a + b, 0);
                  const sumY = yVals.reduce((a, b) => a + b, 0);
                  const sumXY = data.reduce((a, d) => a + d.x * d.y, 0);
                  const sumX2 = xVals.reduce((a, b) => a + b * b, 0);
                  const sumY2 = yVals.reduce((a, b) => a + b * b, 0);
                  const num = n * sumXY - sumX * sumY;
                  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
                  const r = den !== 0 ? num / den : 0;
                  const r2 = r * r;
                  const strength = Math.abs(r) >= 0.7 ? 'Strong' : Math.abs(r) >= 0.4 ? 'Moderate' : Math.abs(r) >= 0.2 ? 'Weak' : 'Negligible';
                  return (
                    <div className="mt-2 text-xs text-muted-foreground flex items-center gap-4">
                      <span>r = <span className="text-white font-medium">{r.toFixed(3)}</span></span>
                      <span>R² = <span className="text-cyan-400 font-medium">{(r2 * 100).toFixed(1)}%</span></span>
                      <span className={`px-2 py-0.5 rounded ${Math.abs(r) >= 0.4 ? 'bg-green-900/30 text-green-400' : 'bg-muted text-muted-foreground'}`}>
                        {strength}
                      </span>
                      <span className="text-muted-foreground/70">n={n}</span>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Correlation Comparison Summary */}
            <div className="mt-6 border-t border-border pt-4">
              <h4 className="text-sm font-medium text-foreground/80 mb-3 flex items-center gap-2">
                Engagement Metrics Comparison
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3 h-3 text-muted-foreground/70 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">
                        Compares correlations between time metrics and learning gain. "Strongest" means the highest
                        absolute |r| among these metrics (relative comparison), even if the absolute strength is weak.
                        Sample sizes can differ by metric.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </h4>
              {(() => {
                const calcCorr = (data: { x: number; y: number }[]) => {
                  if (data.length < 2) return { r: 0, r2: 0 };
                  const n = data.length;
                  const xVals = data.map(d => d.x);
                  const yVals = data.map(d => d.y);
                  const sumX = xVals.reduce((a, b) => a + b, 0);
                  const sumY = yVals.reduce((a, b) => a + b, 0);
                  const sumXY = data.reduce((a, d) => a + d.x * d.y, 0);
                  const sumX2 = xVals.reduce((a, b) => a + b * b, 0);
                  const sumY2 = yVals.reduce((a, b) => a + b * b, 0);
                  const num = n * sumXY - sumX * sumY;
                  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
                  const r = den !== 0 ? num / den : 0;
                  return { r, r2: r * r };
                };

                const avatarData = stats.correlations.avatarTimeVsGain.filter(d => d.x > 0);
                const learningData = stats.correlations.learningTimeVsGain.filter(d => d.x > 0);
                const sessionData = stats.correlations.sessionTimeVsGain;
                const avatarCorr = calcCorr(avatarData);
                const learningCorr = calcCorr(learningData);
                const sessionCorr = calcCorr(sessionData);

                const getStrength = (r: number) => Math.abs(r) >= 0.7 ? 'Strong' : Math.abs(r) >= 0.4 ? 'Moderate' : Math.abs(r) >= 0.2 ? 'Weak' : 'Negligible';
                const getDirection = (r: number) => r > 0 ? 'Positive' : r < 0 ? 'Negative' : 'None';

                const metrics = [
                  {
                    key: 'avatar',
                    label: 'Avatar Slide Time',
                    dotClass: 'bg-purple-400',
                    highlightClass: 'bg-purple-900/20 border-purple-600',
                    badgeClass: 'border-purple-500 text-purple-400',
                    data: avatarData,
                    corr: avatarCorr,
                  },
                  {
                    key: 'learning',
                    label: 'Learning Slides Time',
                    dotClass: 'bg-emerald-400',
                    highlightClass: 'bg-emerald-900/20 border-emerald-600',
                    badgeClass: 'border-emerald-500 text-emerald-400',
                    data: learningData,
                    corr: learningCorr,
                  },
                  {
                    key: 'session',
                    label: 'Session Duration',
                    dotClass: 'bg-blue-400',
                    highlightClass: 'bg-blue-900/20 border-blue-600',
                    badgeClass: 'border-blue-500 text-blue-400',
                    data: sessionData,
                    corr: sessionCorr,
                  },
                ];

                const metricsWithData = metrics.filter(m => m.data.length >= 2);
                const maxAbs = metricsWithData.length > 0
                  ? Math.max(...metricsWithData.map(m => Math.abs(m.corr.r)))
                  : 0;
                const eps = 1e-6;
                const strongestMetrics = metricsWithData.filter(m => Math.abs(Math.abs(m.corr.r) - maxAbs) < eps);
                const strongestKey = strongestMetrics.length === 1 ? strongestMetrics[0].key : null;
                const hasTie = strongestMetrics.length > 1;
                const strongestMetric = metrics.find(m => m.key === strongestKey);

                let keyFinding = 'Not enough data to compare metrics.';
                if (metricsWithData.length === 1) {
                  keyFinding = `Only ${metricsWithData[0].label} has enough data for correlation.`;
                } else if (metricsWithData.length > 1) {
                  keyFinding = hasTie
                    ? 'Metrics show similar correlation strength with learning outcomes.'
                    : `${strongestMetric?.label} has the highest |r| among these metrics (R²=${((strongestMetric?.corr.r2 || 0) * 100).toFixed(1)}%), indicating the strongest relative association in this set.`;
                }

                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {metrics.map((metric) => {
                        const hasData = metric.data.length >= 2;
                        const isStrongest = strongestKey === metric.key;
                        return (
                          <div
                            key={metric.key}
                            className={`rounded-lg p-3 border ${isStrongest ? metric.highlightClass : 'bg-muted/30 border-border'}`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <div className={`w-2 h-2 rounded-full ${metric.dotClass}`} />
                              <span className="text-sm font-medium text-foreground/90">{metric.label}</span>
                              {isStrongest && !hasTie && (
                                <Badge variant="outline" className={`text-[10px] ${metric.badgeClass}`}>Strongest (relative)</Badge>
                              )}
                            </div>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Pearson r:</span>
                                <span className="text-white">{hasData ? metric.corr.r.toFixed(3) : 'n/a'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">R² (variance):</span>
                                <span className="text-cyan-400">{hasData ? `${(metric.corr.r2 * 100).toFixed(1)}%` : 'n/a'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Direction:</span>
                                <span className="text-foreground/80">{hasData ? getDirection(metric.corr.r) : 'n/a'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Strength:</span>
                                <span className="text-foreground/80">{hasData ? getStrength(metric.corr.r) : 'n/a'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Sample:</span>
                                <span className="text-muted-foreground/70">n={metric.data.length}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Key Finding */}
                    <div className="bg-muted/30 rounded-lg p-3 border border-border">
                      <div className="text-xs font-medium text-foreground/80 mb-1">Key Finding</div>
                      <p className="text-xs text-muted-foreground">{keyFinding}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Question Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-white text-sm">Pre-Test Performance</CardTitle>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-muted-foreground/70 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">% of participants who answered correctly BEFORE learning. Low scores = knowledge gaps.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <ExportButton onClick={exportQuestionPerformanceCSV} label="CSV" size="xs" canExport={permissions.canExportData} />
            </div>
          </CardHeader>
          <CardContent>
            {stats.preTestQuestionAnalysis.length > 0 ? (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {stats.preTestQuestionAnalysis.map(q => (
                  <div key={q.questionId} className="bg-muted/30 rounded-lg p-3">
                    <div className="text-xs text-foreground/80 mb-2 line-clamp-2" title={q.questionText}>
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
                      <span className="text-muted-foreground/70 text-xs">n={q.totalResponses}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground/70 text-center py-8 text-sm">No pre-test data</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-white text-sm">Post-Test Performance</CardTitle>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-muted-foreground/70 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">% of participants who answered correctly AFTER learning. Compare with pre-test to measure effectiveness.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <ExportButton onClick={exportQuestionPerformanceCSV} label="CSV" size="xs" canExport={permissions.canExportData} />
            </div>
          </CardHeader>
          <CardContent>
            {stats.postTestQuestionAnalysis.length > 0 ? (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {stats.postTestQuestionAnalysis.map(q => (
                  <div key={q.questionId} className="bg-muted/30 rounded-lg p-3">
                    <div className="text-xs text-foreground/80 mb-2 line-clamp-2" title={q.questionText}>
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
                      <span className="text-muted-foreground/70 text-xs">n={q.totalResponses}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground/70 text-center py-8 text-sm">No post-test data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Likert Scale Perception Analysis - Trust, Engagement, Satisfaction */}
      {stats.likertAnalysis.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-white">Perception Analysis (Trust, Engagement, Satisfaction)</CardTitle>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-muted-foreground/70 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p className="text-xs">5-point Likert scale responses (1=Strongly Disagree, 5=Strongly Agree). Mean closer to 5 = positive perception. Shows participant attitudes toward the learning experience.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center gap-2">
                <Select value={likertView} onValueChange={(value) => setLikertView(value as 'overall' | 'text' | 'avatar' | 'both')}>
                  <SelectTrigger className="w-[140px] bg-background border-border h-7 text-xs">
                    <SelectValue placeholder="View mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="overall">Overall</SelectItem>
                    <SelectItem value="text">Text only</SelectItem>
                    <SelectItem value="avatar">Avatar only</SelectItem>
                    <SelectItem value="both">Both modes</SelectItem>
                  </SelectContent>
                </Select>
                <ExportButton onClick={exportLikertCSV} label="CSV" size="xs" canExport={permissions.canExportData} />
                <ExportButton onClick={exportLikertByModeCSV} label="By Mode" size="xs" canExport={permissions.canExportData} />
              </div>
            </div>
            <CardDescription className="text-muted-foreground">
              Participant attitudes and perceptions measured on 5-point Likert scale
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Overall Summary by Category */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(['trust', 'engagement', 'satisfaction'] as const).map(category => {
                  const currentLikert = likertView === 'overall' ? stats.likertAnalysis : stats.likertByMode[likertView];
                  const categoryData = currentLikert.filter(l => l.category === category);
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
                        <span className="text-muted-foreground/70 text-xs">n={totalResponses / categoryData.length || 0}</span>
                      </div>
                      <div className="text-3xl font-bold text-white mb-2">{avgMean.toFixed(2)}</div>
                      <div className="flex items-center gap-2">
                        <Progress value={(avgMean / 5) * 100} className="h-2 flex-1" />
                        <span className="text-xs text-muted-foreground">/5.0</span>
                      </div>
                      <p className="text-xs text-muted-foreground/70 mt-2">
                        {avgMean >= 4 ? 'Very positive' : avgMean >= 3 ? 'Moderately positive' : avgMean >= 2 ? 'Neutral' : 'Needs improvement'}
                      </p>
                      </div>
                    );
                  })}
              </div>

              {/* By Mode Comparison */}
              {likertView === 'overall' && (
                <div className="border-t border-border pt-4">
                <h4 className="text-sm font-medium text-foreground/80 mb-4 flex items-center gap-2">
                  Perception by Learning Mode
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3 h-3 text-muted-foreground/70 cursor-help" />
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
                      <div key={mode} className={`bg-muted/30 rounded-lg p-4 border-l-4 ${modeColors[mode]}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground/90 capitalize">{mode} Mode</span>
                          </div>
                          <span className="text-muted-foreground/70 text-xs">n={sampleSize}</span>
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
                          <p className="text-muted-foreground/70 text-xs">No data</p>
                        )}
                      </div>
                    );
                  })}
                </div>
                </div>
              )}

              {/* Individual Questions */}
              <div className="border-t border-border pt-4">
                <h4 className="text-sm font-medium text-foreground/80 mb-4">Individual Question Responses</h4>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {(likertView === 'overall' ? stats.likertAnalysis : stats.likertByMode[likertView]).map(l => {
                    const categoryColors = {
                      trust: 'border-l-blue-500',
                      engagement: 'border-l-green-500',
                      satisfaction: 'border-l-purple-500',
                    };
                    
                    return (
                      <div key={l.questionId} className={`bg-muted/30 rounded-lg p-3 border-l-4 ${categoryColors[l.category]}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{l.category}</div>
                            <div className="text-sm text-foreground/90 mb-2">{l.questionText}</div>
                            <div className="flex items-center gap-4 text-xs">
                              <span className="text-muted-foreground">Mean: <span className="text-white font-medium">{l.mean.toFixed(2)}</span></span>
                              <span className="text-muted-foreground">Median: <span className="text-white font-medium">{l.median}</span></span>
                              <span className="text-muted-foreground">SD: <span className="text-white font-medium">{l.std.toFixed(2)}</span></span>
                              <span className="text-muted-foreground/70">n={l.totalResponses}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map(score => (
                              <div key={score} className="text-center">
                                <div className="text-[10px] text-muted-foreground/70 mb-0.5">{score}</div>
                                <div 
                                  className="w-6 bg-muted-foreground/40 rounded-sm" 
                                  style={{ height: `${Math.max(4, (l.distribution[score] / l.totalResponses) * 40)}px` }}
                                  title={`${score}: ${l.distribution[score]} responses (${Math.round((l.distribution[score] / l.totalResponses) * 100)}%)`}
                                />
                                <div className="text-[9px] text-muted-foreground/70 mt-0.5">{l.distribution[score]}</div>
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
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">Demographic Distribution</CardTitle>
            <ExportButton onClick={exportDemographicsCSV} label="CSV" canExport={permissions.canExportData} />
          </div>
          <CardDescription className="text-muted-foreground">Participant background data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Age */}
            <div>
              <h4 className="text-sm font-medium text-foreground/80 mb-3 flex items-center gap-2">
                Age Distribution
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3 h-3 text-muted-foreground/70 cursor-help" />
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
                <div className="flex items-center justify-center h-[180px] text-muted-foreground/70 text-sm">No data</div>
              )}
            </div>

            {/* Education */}
            <div>
              <h4 className="text-sm font-medium text-foreground/80 mb-3 flex items-center gap-2">
                Education Level
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3 h-3 text-muted-foreground/70 cursor-help" />
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
                <div className="flex items-center justify-center h-[180px] text-muted-foreground/70 text-sm">No data</div>
              )}
            </div>

            {/* Digital Experience */}
            <div>
              <h4 className="text-sm font-medium text-foreground/80 mb-3 flex items-center gap-2">
                Digital Experience
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3 h-3 text-muted-foreground/70 cursor-help" />
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
                <div className="flex items-center justify-center h-[180px] text-muted-foreground/70 text-sm">No data</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Avatar Time by Slide */}
      {stats.avatarTimeBySlide.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white">Avatar Interaction by Slide</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Avg time participants spent with avatar on each slide
                </CardDescription>
              </div>
              <ExportButton 
                onClick={() => downloadCSV(stats.avatarTimeBySlide.map(s => ({ Slide: s.slide, AvgTimeSeconds: s.avgTime, TotalTimeSeconds: s.totalTime, SessionCount: s.count })), 'avatar_time_by_slide')} 
                label="CSV"
                canExport={permissions.canExportData}
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
              <div className="bg-muted/50 rounded p-2 text-center">
                <div className="text-muted-foreground text-xs">Total Time</div>
                <div className="text-white font-medium">{Math.round(stats.totalAvatarTime / 60)} min</div>
              </div>
              <div className="bg-muted/50 rounded p-2 text-center">
                <div className="text-muted-foreground text-xs">Avg per Session</div>
                <div className="text-white font-medium">{Math.round(stats.avgAvatarTime / 60)} min</div>
              </div>
              <div className="bg-muted/50 rounded p-2 text-center">
                <div className="text-muted-foreground text-xs">Sessions Tracked</div>
                <div className="text-white font-medium">{stats.avatarSessionsTracked}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Text Time by Slide */}
      {stats.textTimeBySlide.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white">Text Mode Time by Slide</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Avg time participants spent reading each slide (text mode)
                </CardDescription>
              </div>
              <ExportButton
                onClick={() => downloadCSV(stats.textTimeBySlide.map(s => ({ Slide: s.slide, AvgTimeSeconds: s.avgTime, TotalTimeSeconds: s.totalTime, SessionCount: s.count })), 'text_time_by_slide')}
                label="CSV"
                canExport={permissions.canExportData}
              />
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.textTimeBySlide}>
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
                <Bar dataKey="avgTime" name="Avg Time (s)" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
              <div className="bg-muted/50 rounded p-2 text-center">
                <div className="text-muted-foreground text-xs">Total Time</div>
                <div className="text-white font-medium">{Math.round(stats.totalTextTime / 60)} min</div>
              </div>
              <div className="bg-muted/50 rounded p-2 text-center">
                <div className="text-muted-foreground text-xs">Avg per Session</div>
                <div className="text-white font-medium">{Math.round(stats.avgTextTime / 60)} min</div>
              </div>
              <div className="bg-muted/50 rounded p-2 text-center">
                <div className="text-muted-foreground text-xs">Sessions Tracked</div>
                <div className="text-white font-medium">{stats.textSessionsTracked}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {stats.pageTimeByPage.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white">Time by Page</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Avg time participants spent on each study page
                </CardDescription>
              </div>
              <ExportButton
                onClick={() => downloadCSV(stats.pageTimeByPage.map(p => ({ Page: p.page, AvgTimeSeconds: p.avgTime, TotalTimeSeconds: p.totalTime, SessionCount: p.count })), 'page_time_by_page')}
                label="CSV"
                canExport={permissions.canExportData}
              />
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.pageTimeByPage}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="page" stroke="#9ca3af" fontSize={9} angle={-15} textAnchor="end" height={50} />
                <YAxis stroke="#9ca3af" fontSize={11} label={{ value: 'Avg seconds', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 10 }} />
                <ChartTooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                  formatter={(value: number, name: string) => {
                    if (name === 'avgTime') return [`${value}s`, 'Avg Time'];
                    if (name === 'count') return [value, 'Sessions'];
                    return [value, name];
                  }}
                />
                <Bar dataKey="avgTime" name="Avg Time (s)" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
              <div className="bg-muted/50 rounded p-2 text-center">
                <div className="text-muted-foreground text-xs">Total Time</div>
                <div className="text-white font-medium">
                  {Math.round(stats.pageTimeData.reduce((sum, entry) => sum + (entry.duration_seconds || 0), 0) / 60)} min
                </div>
              </div>
              <div className="bg-muted/50 rounded p-2 text-center">
                <div className="text-muted-foreground text-xs">Avg per Session</div>
                <div className="text-white font-medium">
                  {(() => {
                    const sessionsTracked = new Set(stats.pageTimeData.map(entry => entry.session_id)).size;
                    const totalSeconds = stats.pageTimeData.reduce((sum, entry) => sum + (entry.duration_seconds || 0), 0);
                    return sessionsTracked > 0 ? `${Math.round(totalSeconds / sessionsTracked / 60)} min` : '0 min';
                  })()}
                </div>
              </div>
              <div className="bg-muted/50 rounded p-2 text-center">
                <div className="text-muted-foreground text-xs">Sessions Tracked</div>
                <div className="text-white font-medium">
                  {new Set(stats.pageTimeData.map(entry => entry.session_id)).size}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {stats.dialogueByMode.some((entry) => entry.messages > 0) && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white">Dialogue Volume by Mode</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Total tutor messages logged per session mode (user + AI)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.dialogueByMode}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="label" stroke="#9ca3af" fontSize={11} />
                <YAxis stroke="#9ca3af" fontSize={11} label={{ value: 'Messages', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 10 }} />
                <ChartTooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const data = payload[0].payload as { messages: number; sessions: number };
                    return (
                      <div className="bg-card border border-border p-2 text-xs rounded">
                        <div className="text-foreground/90 font-medium">{label}</div>
                        <div className="text-foreground/80">Messages: {data.messages}</div>
                        <div className="text-muted-foreground">Sessions with dialogue: {data.sessions}</div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="messages" name="Messages" fill="#38bdf8" />
              </BarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
              <div className="bg-muted/50 rounded p-2 text-center">
                <div className="text-muted-foreground text-xs">Total Messages</div>
                <div className="text-white font-medium">
                  {stats.dialogueByMode.reduce((sum, entry) => sum + entry.messages, 0)}
                </div>
              </div>
              <div className="bg-muted/50 rounded p-2 text-center">
                <div className="text-muted-foreground text-xs">Sessions with Dialogue</div>
                <div className="text-white font-medium">
                  {stats.dialogueByMode.reduce((sum, entry) => sum + entry.sessions, 0)}
                </div>
              </div>
              <div className="bg-muted/50 rounded p-2 text-center">
                <div className="text-muted-foreground text-xs">Avg Messages/Session</div>
                <div className="text-white font-medium">
                  {(() => {
                    const totalMessages = stats.dialogueByMode.reduce((sum, entry) => sum + entry.messages, 0);
                    const totalSessions = stats.dialogueByMode.reduce((sum, entry) => sum + entry.sessions, 0);
                    return totalSessions > 0 ? Math.round(totalMessages / totalSessions) : 0;
                  })()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sessions per Day */}
      {stats.sessionsPerDay.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white">Sessions Over Time</CardTitle>
                <CardDescription className="text-muted-foreground">Daily session count</CardDescription>
              </div>
              <ExportButton 
                onClick={() => downloadCSV(stats.sessionsPerDay.map(s => ({ Date: s.date, SessionCount: s.count })), 'sessions_per_day')} 
                label="CSV"
                canExport={permissions.canExportData}
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

      {/* Question Performance by Mode */}
      <QuestionPerformanceByMode startDate={startDate} endDate={endDate} userEmail={userEmail} />
    </div>
  );
};

export default AdminOverview;
