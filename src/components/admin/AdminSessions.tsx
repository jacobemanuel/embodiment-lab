import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Search, ChevronLeft, ChevronRight, Eye, RefreshCw, CheckCircle, XCircle, AlertTriangle, Info, Clock, CheckSquare, Square, FileText, Trash2, EyeOff, Database, FileSpreadsheet } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import jsPDF from "jspdf";
import { format, startOfDay, endOfDay } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import DateRangeFilter from "./DateRangeFilter";
import { getPermissionLevel, getPermissions } from "@/lib/permissions";
import { describeSuspicionFlag, getSuspicionRequirements } from "@/lib/suspicion";
import { META_DIALOGUE_ID, META_TIMING_ID, isTelemetryMetaQuestionId } from "@/lib/sessionTelemetry";
import { buildSlideLookup, resolveSlideKey } from "@/lib/slideTiming";
import { canUseTutorDialogueTable } from "@/lib/tutorDialogueAvailability";
import { toast } from "sonner";

interface AdminSessionsProps {
  userEmail?: string;
}

const OWNER_EDIT_MIN_DATE = new Date("2025-12-24T00:00:00Z");
const MAX_AVATAR_SLIDE_SECONDS = 180;
const DEMO_FALLBACK_PREFIX = 'demo-';


const AdminSessions = ({ userEmail = '' }: AdminSessionsProps) => {
  const permissions = getPermissions(userEmail);
  const permissionLevel = getPermissionLevel(userEmail);
  const isOwner = permissionLevel === 'owner';
  const canManageValidation = permissions.canValidateSessionsDirectly || permissions.canRequestValidation;

interface Session {
  id: string;
  session_id: string;
  mode: 'text' | 'avatar' | 'voice';
  modes_used: string[] | null;
  started_at: string;
  completed_at: string | null;
  last_activity_at?: string | null;
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
  tutorDialogueTurns: any[];
  avatarTimeTracking: any[];
}

interface SessionDataStatus {
  hasDemographics: boolean;
  hasPreTest: boolean;
  hasPostTest: boolean;
  hasDialogue: boolean;
  isComplete: boolean;
  preTestExpected?: number | null;
  preTestAnswered?: number;
  postTestExpected?: number | null;
  postTestAnswered?: number;
}

interface StudyQuestion {
  question_id: string;
  question_text: string;
  question_type: string;
  is_active?: boolean;
  created_at?: string | null;
  mode_specific?: string | null;
}

interface BackfillAnswer {
  question_id: string;
  question_text: string;
  answer: string;
}

type AvatarGroup = {
  slideId: string;
  title: string;
  total: number;
  entryIds: string[];
};

interface SessionEditDraft {
  session: {
    started_at: string;
    completed_at: string | null;
    last_activity_at: string | null;
    status: string;
    mode: 'text' | 'avatar' | 'voice';
    modes_used: string[];
    suspicion_score: number | null;
    suspicious_flags: unknown;
  };
  demographicResponses: Array<{
    id: string;
    question_id: string;
    answer: string;
  }>;
  preTest: Array<{
    id: string;
    question_id: string;
    answer: string;
  }>;
  postTest: Array<{
    id: string;
    question_id: string;
    answer: string;
  }>;
  scenarios: Array<{
    id: string;
    scenario_id: string;
    trust_rating: number;
    confidence_rating: number;
    engagement_rating: boolean;
    completed_at: string;
  }>;
  avatarTimeTracking: Array<{
    id: string;
    slide_id: string;
    slide_title: string;
    duration_seconds: number | null;
  }>;
  tutorDialogueTurns: Array<{
    id: string;
    role: string;
    content: string;
    slide_id?: string | null;
    slide_title?: string | null;
  }>;
  dialogueTurns: Array<{
    id: string;
    role: string;
    content: string;
    scenario_name?: string;
  }>;
}

interface OwnerSessionOverride {
  session?: Partial<SessionEditDraft['session']>;
  demographicResponses?: Record<string, string>;
  preTest?: Record<string, string>;
  postTest?: Record<string, string>;
  scenarios?: Record<string, {
    trust_rating?: number;
    confidence_rating?: number;
    engagement_rating?: boolean;
    completed_at?: string;
  }>;
  avatarTimeTracking?: Record<string, { duration_seconds?: number | null }>;
  tutorDialogueTurns?: Record<string, string>;
  dialogueTurns?: Record<string, string>;
}

const OWNER_OVERRIDES_KEY = 'ownerSessionOverrides';


  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionDataStatuses, setSessionDataStatuses] = useState<Map<string, SessionDataStatus>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [validationFilter, setValidationFilter] = useState<string>("all");
  const [dataFilter, setDataFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessionDetails, setSessionDetails] = useState<SessionDetails | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [activeSlides, setActiveSlides] = useState<Array<{ slide_id: string; title: string; sort_order?: number; is_active?: boolean }>>([]);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<SessionEditDraft | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [restoringSessionId, setRestoringSessionId] = useState<string | null>(null);
  const [autoDistributeSlides, setAutoDistributeSlides] = useState(false);
  const [hasLocalOverride, setHasLocalOverride] = useState(false);
  const [questionBank, setQuestionBank] = useState<StudyQuestion[]>([]);
  const [isBackfillOpen, setIsBackfillOpen] = useState(false);
  const [backfillPreTest, setBackfillPreTest] = useState<BackfillAnswer[]>([]);
  const [backfillPostTest, setBackfillPostTest] = useState<BackfillAnswer[]>([]);
  const [isBackfillSaving, setIsBackfillSaving] = useState(false);
  const [isBackfillTiming, setIsBackfillTiming] = useState(false);
  const [startBackfillAtZero, setStartBackfillAtZero] = useState(false);
  const itemsPerPage = 10;
  const pendingStatusRefresh = useRef<Set<string>>(new Set());
  const pendingStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionsRef = useRef<Session[]>([]);

  const mergeSessionDataStatus = (sessionId: string, patch: Partial<SessionDataStatus>) => {
    setSessionDataStatuses((prev) => {
      const next = new Map(prev);
      const current = next.get(sessionId) || {
        hasDemographics: false,
        hasPreTest: false,
        hasPostTest: false,
        hasDialogue: false,
        isComplete: false,
        preTestExpected: null,
        preTestAnswered: 0,
        postTestExpected: null,
        postTestAnswered: 0,
      };
      const updated = { ...current, ...patch };
      updated.isComplete = updated.hasDemographics && updated.hasPreTest && updated.hasPostTest;
      next.set(sessionId, updated);
      return next;
    });
  };

  type SessionQuestionContext = {
    mode?: string;
    modes_used?: string[] | null;
    started_at?: string | null;
    created_at?: string | null;
    completed_at?: string | null;
  };

  const hasMeaningfulAnswer = (answer: unknown) =>
    typeof answer === 'string' ? answer.trim() !== '' : answer !== null && answer !== undefined;

  const resolveSessionModes = (session: SessionQuestionContext) => {
    if (session.mode) return new Set([session.mode]);
    const modes = session.modes_used && session.modes_used.length > 0
      ? session.modes_used
      : [];
    return new Set(modes);
  };

  const resolveSessionCutoff = (session: SessionQuestionContext) => {
    const raw = session.started_at || session.created_at || session.completed_at;
    if (!raw) return null;
    const value = Date.parse(raw);
    return Number.isNaN(value) ? null : value;
  };

  const filterQuestionsForSession = (
    questions: StudyQuestion[],
    session: SessionQuestionContext,
    questionType: 'pre_test' | 'post_test' | 'demographic'
  ) => {
    const cutoff = resolveSessionCutoff(session);
    const sessionModes = resolveSessionModes(session);
    return questions.filter((question) => {
      if (question.question_type !== questionType) return false;
      if (question.is_active === false) return false;
      const modeSpecific = question.mode_specific || 'both';
      if (modeSpecific !== 'both' && !sessionModes.has(modeSpecific)) return false;
      if (cutoff && question.created_at) {
        const questionTime = Date.parse(question.created_at);
        if (!Number.isNaN(questionTime) && questionTime > cutoff) return false;
      }
      return true;
    });
  };

  const computeResponseCounts = (
    session: SessionQuestionContext,
    questions: StudyQuestion[],
    questionType: 'pre_test' | 'post_test',
    responses: Array<{ question_id: string; answer?: string | null }>
  ) => {
    if (!questions.length) {
      const answered = responses.filter((r) => hasMeaningfulAnswer(r.answer)).length;
      return { expected: 0, answered, has: answered > 0 };
    }
    const expectedQuestions = filterQuestionsForSession(questions, session, questionType);
    if (expectedQuestions.length === 0) {
      return { expected: 0, answered: 0, has: true };
    }
    const expectedIds = new Set(expectedQuestions.map((q) => q.question_id));
    const answeredIds = new Set(
      responses
        .filter((r) => hasMeaningfulAnswer(r.answer) && expectedIds.has(r.question_id))
        .map((r) => r.question_id)
    );
    const answered = answeredIds.size;
    return { expected: expectedIds.size, answered, has: answered >= expectedIds.size };
  };

  const loadQuestionBank = useCallback(async (): Promise<StudyQuestion[]> => {
    try {
      const { data, error } = await supabase
        .from('study_questions')
        .select('question_id, question_text, question_type, is_active, created_at, mode_specific')
        .eq('is_active', true);
      if (error) throw error;
      const rows = (data || []) as StudyQuestion[];
      setQuestionBank(rows);
      return rows;
    } catch (error) {
      console.error('Failed to load questions:', error);
      return [];
    }
  }, []);

  const buildMissingBackfill = (
    draft: SessionEditDraft,
    questions: StudyQuestion[],
    sessionContext?: SessionQuestionContext | null
  ) => {
    const preQuestions = sessionContext
      ? filterQuestionsForSession(questions, sessionContext, 'pre_test')
      : questions.filter((q) => q.question_type === 'pre_test');
    const postQuestions = sessionContext
      ? filterQuestionsForSession(questions, sessionContext, 'post_test')
      : questions.filter((q) => q.question_type === 'post_test');
    const existingPre = new Set(draft.preTest.map((r) => r.question_id));
    const existingPost = new Set(draft.postTest.map((r) => r.question_id));

    const missingPre = preQuestions
      .filter((q) => !existingPre.has(q.question_id))
      .map((q) => ({
        question_id: q.question_id,
        question_text: q.question_text,
        answer: '',
      }));

    const missingPost = postQuestions
      .filter((q) => !existingPost.has(q.question_id))
      .map((q) => ({
        question_id: q.question_id,
        question_text: q.question_text,
        answer: '',
      }));

    return { missingPre, missingPost };
  };

  const openBackfillDialog = async () => {
    if (!isOwner || !editDraft) return;
    const questions = questionBank.length > 0 ? questionBank : await loadQuestionBank();
    const sessionContext: SessionQuestionContext | null = selectedSession
      ? {
          mode: selectedSession.mode,
          modes_used: selectedSession.modes_used,
          started_at: selectedSession.started_at,
          created_at: selectedSession.created_at,
          completed_at: selectedSession.completed_at,
        }
      : editDraft?.session
        ? {
            mode: editDraft.session.mode,
            modes_used: editDraft.session.modes_used,
            started_at: editDraft.session.started_at,
          }
        : null;
    const { missingPre, missingPost } = buildMissingBackfill(editDraft, questions, sessionContext);
    setBackfillPreTest(missingPre);
    setBackfillPostTest(missingPost);
    setIsBackfillOpen(true);
  };

  const submitBackfillResponses = async () => {
    if (!selectedSession) return;
    const preToInsert = backfillPreTest
      .filter((entry) => entry.answer.trim() !== '')
      .map((entry) => ({
        question_id: entry.question_id,
        answer: entry.answer,
        source: 'owner_backfill',
        is_imputed: true,
      }));
    const postToInsert = backfillPostTest
      .filter((entry) => entry.answer.trim() !== '')
      .map((entry) => ({
        question_id: entry.question_id,
        answer: entry.answer,
        source: 'owner_backfill',
        is_imputed: true,
      }));

    if (preToInsert.length === 0 && postToInsert.length === 0) {
      toast.error('Enter at least one missing response before saving.');
      return;
    }

    setIsBackfillSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('owner-edit-session', {
        body: {
          sessionId: selectedSession.id,
          updates: {
            insertPreTest: preToInsert,
            insertPostTest: postToInsert,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await fetchSessions();
      await fetchSessionDetails(selectedSession);
      setIsBackfillOpen(false);
      toast.success('Missing responses saved');
    } catch (error) {
      console.error('Backfill save failed:', error);
      toast.error('Failed to save missing responses');
    } finally {
      setIsBackfillSaving(false);
    }
  };

  const backfillAvatarTiming = async () => {
    if (!isOwner || !selectedSession || !editDraft) return;
    if (!sessionDurationSeconds) {
      toast.error('Session duration is required to backfill timing.');
      return;
    }
    if (!activeSlides || activeSlides.length === 0) {
      toast.error('No active slides available for timing backfill.');
      return;
    }

    const existingSlideIds = new Set(
      editDraft.avatarTimeTracking
        .filter((entry) => !isPageId(entry.slide_id))
        .map((entry) => entry.slide_id)
    );
    const missingSlides = activeSlides.filter((slide) => !existingSlideIds.has(slide.slide_id));
    if (missingSlides.length === 0) {
      toast('All active slides already have timing entries.');
      return;
    }

    const existingTotal = editDraft.avatarTimeTracking
      .filter((entry) => !isPageId(entry.slide_id))
      .reduce((sum, entry) => sum + (entry.duration_seconds || 0), 0);
    const remaining = Math.max(0, sessionDurationSeconds - existingTotal);
    const durations = startBackfillAtZero
      ? new Array(missingSlides.length).fill(0)
      : distributeSlideDurations(missingSlides.length, remaining || sessionDurationSeconds);

    const modeHint = editDraft.session.mode || 'avatar';
    const startedAt = editDraft.session.started_at || new Date().toISOString();

    const entries = missingSlides.map((slide, index) => ({
      slide_id: slide.slide_id,
      slide_title: slide.title,
      duration_seconds: durations[index] ?? 0,
      started_at: startedAt,
      mode: modeHint,
      source: 'owner_imputed',
      is_imputed: true,
    }));

    setIsBackfillTiming(true);
    try {
      const { data, error } = await supabase.functions.invoke('owner-edit-session', {
        body: {
          sessionId: selectedSession.id,
          updates: {
            insertAvatarTimeTracking: entries,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await fetchSessions();
      await fetchSessionDetails(selectedSession);
      toast.success('Slide timing backfilled');
    } catch (error) {
      console.error('Backfill timing failed:', error);
      toast.error('Failed to backfill slide timing');
    } finally {
      setIsBackfillTiming(false);
    }
  };

  const loadOwnerOverrides = () => {
    if (!isOwner || typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(OWNER_OVERRIDES_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return {};
      return parsed as Record<string, OwnerSessionOverride>;
    } catch (error) {
      console.error('Failed to load owner overrides:', error);
      return {};
    }
  };

  const saveOwnerOverrides = (overrides: Record<string, OwnerSessionOverride>) => {
    if (!isOwner || typeof window === 'undefined') return;
    try {
      localStorage.setItem(OWNER_OVERRIDES_KEY, JSON.stringify(overrides));
    } catch (error) {
      console.error('Failed to save owner overrides:', error);
    }
  };

  const clearOwnerOverride = (sessionId: string) => {
    if (!isOwner) return;
    const overrides = loadOwnerOverrides();
    if (!overrides[sessionId]) return;
    delete overrides[sessionId];
    saveOwnerOverrides(overrides);
  };

  const applySessionOverride = (session: Session, override?: OwnerSessionOverride) => {
    if (!override?.session) return session;
    return {
      ...session,
      started_at: override.session.started_at ?? session.started_at,
      completed_at: override.session.completed_at ?? session.completed_at,
      last_activity_at: override.session.last_activity_at ?? session.last_activity_at,
      status: override.session.status ?? session.status,
      mode: override.session.mode ?? session.mode,
      modes_used: override.session.modes_used ?? session.modes_used,
      suspicion_score: override.session.suspicion_score ?? session.suspicion_score,
      suspicious_flags: override.session.suspicious_flags ?? session.suspicious_flags,
    };
  };

  const applyAnswerOverrides = <T extends { id: string; answer?: string }>(
    list: T[],
    overrides?: Record<string, string>
  ) => {
    if (!overrides) return list;
    return list.map((item) =>
      Object.prototype.hasOwnProperty.call(overrides, item.id)
        ? { ...item, answer: overrides[item.id] }
        : item
    );
  };

  const applyContentOverrides = <T extends { id: string; content?: string }>(
    list: T[],
    overrides?: Record<string, string>
  ) => {
    if (!overrides) return list;
    return list.map((item) =>
      Object.prototype.hasOwnProperty.call(overrides, item.id)
        ? { ...item, content: overrides[item.id] }
        : item
    );
  };

  const applyScenarioOverrides = (list: SessionDetails['scenarios'], overrides?: OwnerSessionOverride['scenarios']) => {
    if (!overrides) return list;
    return list.map((item) => {
      const patch = overrides[item.id];
      if (!patch) return item;
      return {
        ...item,
        trust_rating: patch.trust_rating ?? item.trust_rating,
        confidence_rating: patch.confidence_rating ?? item.confidence_rating,
        engagement_rating: patch.engagement_rating ?? item.engagement_rating,
        completed_at: patch.completed_at ?? item.completed_at,
      };
    });
  };

  const applyAvatarOverrides = (
    list: SessionDetails['avatarTimeTracking'],
    overrides?: OwnerSessionOverride['avatarTimeTracking']
  ) => {
    if (!overrides) return list;
    return list.map((item) => {
      const patch = overrides[item.id];
      if (!patch || !Object.prototype.hasOwnProperty.call(patch, 'duration_seconds')) return item;
      return {
        ...item,
        duration_seconds: patch.duration_seconds ?? item.duration_seconds,
      };
    });
  };

  const applyDetailsOverride = (details: SessionDetails, override?: OwnerSessionOverride): SessionDetails => {
    if (!override) return details;
    return {
      ...details,
      demographicResponses: applyAnswerOverrides(details.demographicResponses, override.demographicResponses),
      preTest: applyAnswerOverrides(details.preTest, override.preTest),
      postTest: applyAnswerOverrides(details.postTest, override.postTest),
      scenarios: applyScenarioOverrides(details.scenarios, override.scenarios),
      avatarTimeTracking: applyAvatarOverrides(details.avatarTimeTracking, override.avatarTimeTracking),
      tutorDialogueTurns: applyContentOverrides(details.tutorDialogueTurns, override.tutorDialogueTurns),
      dialogueTurns: applyContentOverrides(details.dialogueTurns, override.dialogueTurns),
    };
  };

  const buildOverrideFromDraft = (draft: SessionEditDraft): OwnerSessionOverride => ({
    session: {
      started_at: draft.session.started_at,
      completed_at: draft.session.completed_at,
      last_activity_at: draft.session.last_activity_at,
      status: draft.session.status,
      mode: draft.session.mode,
      modes_used: draft.session.modes_used,
      suspicion_score: draft.session.suspicion_score,
      suspicious_flags: draft.session.suspicious_flags,
    },
    demographicResponses: Object.fromEntries(draft.demographicResponses.map((r) => [r.id, r.answer])),
    preTest: Object.fromEntries(draft.preTest.map((r) => [r.id, r.answer])),
    postTest: Object.fromEntries(draft.postTest.map((r) => [r.id, r.answer])),
    scenarios: Object.fromEntries(
      draft.scenarios.map((s) => [
        s.id,
        {
          trust_rating: s.trust_rating,
          confidence_rating: s.confidence_rating,
          engagement_rating: s.engagement_rating,
          completed_at: s.completed_at,
        },
      ])
    ),
    avatarTimeTracking: Object.fromEntries(
      draft.avatarTimeTracking.map((t) => [t.id, { duration_seconds: t.duration_seconds }])
    ),
    tutorDialogueTurns: Object.fromEntries(draft.tutorDialogueTurns.map((t) => [t.id, t.content])),
    dialogueTurns: Object.fromEntries(draft.dialogueTurns.map((t) => [t.id, t.content])),
  });

  // Fetch data completeness for sessions
  const fetchDataStatuses = useCallback(
    async (sessionInput: Session[] | string[], options?: { merge?: boolean }) => {
      if (!sessionInput || sessionInput.length === 0) return;
      const sessionList = typeof sessionInput[0] === 'string'
        ? sessionsRef.current.filter((session) => (sessionInput as string[]).includes(session.id))
        : (sessionInput as Session[]);
      if (sessionList.length === 0) return;
      const sessionIds = sessionList.map((session) => session.id);
      try {
        const canUseTutorDialogue = await canUseTutorDialogueTable();
        const questions = questionBank.length > 0 ? questionBank : await loadQuestionBank();
        const hasQuestionBank = questions.length > 0;
        const tutorDialogueQuery = canUseTutorDialogue
          ? (supabase.from('tutor_dialogue_turns' as any) as any)
              .select('session_id')
              .in('session_id', sessionIds)
          : Promise.resolve({ data: [] as any[] });

        // Fetch counts for each data type
        const [demoRes, oldDemoRes, preRes, postRes, scenarioRes, tutorRes] = await Promise.all([
          supabase.from('demographic_responses').select('session_id, question_id, answer').in('session_id', sessionIds),
          supabase.from('demographics').select('session_id').in('session_id', sessionIds),
          supabase.from('pre_test_responses').select('session_id, question_id, answer').in('session_id', sessionIds),
          supabase.from('post_test_responses').select('session_id, question_id, answer').in('session_id', sessionIds),
          supabase.from('scenarios').select('session_id').in('session_id', sessionIds),
          tutorDialogueQuery,
        ]);

        const demoSessions = new Set((demoRes.data || []).map(d => d.session_id));
        (oldDemoRes.data || []).forEach((d: any) => demoSessions.add(d.session_id));
        const scenarioSessions = new Set((scenarioRes.data || []).map(d => d.session_id));
        const tutorSessions = new Set(((tutorRes.data || []) as any[]).map((d: any) => d.session_id));

        const preResponsesBySession = new Map<string, Array<{ question_id: string; answer?: string | null }>>();
        (preRes.data || []).forEach((row: any) => {
          const list = preResponsesBySession.get(row.session_id) || [];
          list.push({ question_id: row.question_id, answer: row.answer });
          preResponsesBySession.set(row.session_id, list);
        });

        const postResponsesBySession = new Map<string, Array<{ question_id: string; answer?: string | null }>>();
        (postRes.data || []).forEach((row: any) => {
          if (isTelemetryMetaQuestionId(row.question_id)) return;
          const list = postResponsesBySession.get(row.session_id) || [];
          list.push({ question_id: row.question_id, answer: row.answer });
          postResponsesBySession.set(row.session_id, list);
        });

        const statusMap = new Map<string, SessionDataStatus>();
        sessionList.forEach((session) => {
          const hasDemographics = demoSessions.has(session.id);
          const preCounts = computeResponseCounts(
            {
              mode: session.mode,
              modes_used: session.modes_used,
              started_at: session.started_at,
              created_at: session.created_at,
              completed_at: session.completed_at,
            },
            questions,
            'pre_test',
            preResponsesBySession.get(session.id) || []
          );
          const postCounts = computeResponseCounts(
            {
              mode: session.mode,
              modes_used: session.modes_used,
              started_at: session.started_at,
              created_at: session.created_at,
              completed_at: session.completed_at,
            },
            questions,
            'post_test',
            postResponsesBySession.get(session.id) || []
          );
          const hasPreTest = hasQuestionBank ? preCounts.has : preCounts.answered > 0;
          const hasPostTest = hasQuestionBank ? postCounts.has : postCounts.answered > 0;
          const hasDialogue = scenarioSessions.has(session.id) || tutorSessions.has(session.id);
          statusMap.set(session.id, {
            hasDemographics,
            hasPreTest,
            hasPostTest,
            hasDialogue,
            isComplete: hasDemographics && hasPreTest && hasPostTest,
            preTestExpected: hasQuestionBank ? preCounts.expected : null,
            preTestAnswered: preCounts.answered,
            postTestExpected: hasQuestionBank ? postCounts.expected : null,
            postTestAnswered: postCounts.answered,
          });
        });

        setSessionDataStatuses((prev) => {
          if (!options?.merge) return statusMap;
          const next = new Map(prev);
          statusMap.forEach((value, key) => {
            next.set(key, value);
          });
          return next;
        });
      } catch (error) {
        console.error('Error fetching data statuses:', error);
      }
    },
    [loadQuestionBank, questionBank]
  );

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
      const overrides = loadOwnerOverrides();
      const resolvedSessions = (data || []).map((session) =>
        applySessionOverride(session, overrides[session.id])
      );
      setSessions(resolvedSessions);
      sessionsRef.current = resolvedSessions;
      
      // Fetch data completeness for all sessions
      if (data && data.length > 0) {
        await fetchDataStatuses(resolvedSessions);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [startDate, endDate, fetchDataStatuses]);

  const queueStatusRefresh = useCallback(
    (sessionId?: string | null) => {
      if (!sessionId) return;
      if (!sessionsRef.current.some((session) => session.id === sessionId)) return;
      pendingStatusRefresh.current.add(sessionId);
      if (pendingStatusTimer.current) return;
      pendingStatusTimer.current = setTimeout(() => {
        const ids = Array.from(pendingStatusRefresh.current);
        pendingStatusRefresh.current.clear();
        pendingStatusTimer.current = null;
        if (ids.length > 0) {
          fetchDataStatuses(ids, { merge: true });
        }
      }, 300);
    },
    [fetchDataStatuses]
  );

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    if (questionBank.length > 0) return;
    loadQuestionBank();
  }, [loadQuestionBank, questionBank.length]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    if (sessions.length === 0 || questionBank.length === 0) return;
    fetchDataStatuses(sessions);
  }, [fetchDataStatuses, questionBank.length, sessions]);

  // Real-time subscription for sessions
  useEffect(() => {
    const channel = supabase
      .channel('sessions-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'study_sessions' },
        () => {
          fetchSessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSessions]);

  useEffect(() => {
    let isActive = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      const canUseTutorDialogue = await canUseTutorDialogueTable();
      if (!isActive) return;

      let nextChannel = supabase
        .channel('sessions-data-statuses')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'demographic_responses' },
          (payload: { new?: Record<string, unknown>; old?: Record<string, unknown> }) => queueStatusRefresh((payload.new?.session_id ?? payload.old?.session_id) as string | null)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'pre_test_responses' },
          (payload: { new?: Record<string, unknown>; old?: Record<string, unknown> }) => queueStatusRefresh((payload.new?.session_id ?? payload.old?.session_id) as string | null)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'post_test_responses' },
          (payload: { new?: Record<string, unknown>; old?: Record<string, unknown> }) => queueStatusRefresh((payload.new?.session_id ?? payload.old?.session_id) as string | null)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'scenarios' },
          (payload: { new?: Record<string, unknown>; old?: Record<string, unknown> }) => queueStatusRefresh((payload.new?.session_id ?? payload.old?.session_id) as string | null)
        );

      if (canUseTutorDialogue) {
        nextChannel = nextChannel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tutor_dialogue_turns' },
          (payload: { new?: Record<string, unknown>; old?: Record<string, unknown> }) => queueStatusRefresh((payload.new?.session_id ?? payload.old?.session_id) as string | null)
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
      if (pendingStatusTimer.current) {
        clearTimeout(pendingStatusTimer.current);
        pendingStatusTimer.current = null;
      }
    };
  }, [queueStatusRefresh]);

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

      let tutorDialogueTurns: any[] = [];
      if (await canUseTutorDialogueTable()) {
        const { data } = await (supabase
          .from('tutor_dialogue_turns' as any) as any)
          .select('*')
          .eq('session_id', session.id)
          .order('timestamp', { ascending: true });
        tutorDialogueTurns = data || [];
      }

      const { data: avatarTimeTracking } = await supabase
        .from('avatar_time_tracking')
        .select('*')
        .eq('session_id', session.id)
        .order('started_at', { ascending: true });

      const { data: activeSlides } = await supabase
        .from('study_slides')
        .select('slide_id, title, is_active')
        .eq('is_active', true);

      const rawPreTest = preTest || [];
      const rawPostTest = postTest || [];

      const pickLatestMetaRow = (rows: any[], questionId: string) => {
        const candidates = rows.filter((row) => row.question_id === questionId);
        if (candidates.length === 0) return null;
        return candidates.reduce((latest, row) => {
          if (!latest) return row;
          const latestTime = latest.created_at ? new Date(latest.created_at).getTime() : 0;
          const rowTime = row.created_at ? new Date(row.created_at).getTime() : 0;
          return rowTime >= latestTime ? row : latest;
        }, null as any);
      };

      const extractMetaPayload = (rows: any[], baseId: string) => {
        const direct = pickLatestMetaRow(rows, baseId);
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

      const timingMetaPayload = extractMetaPayload(rawPostTest, META_TIMING_ID);
      const dialogueMetaPayload = extractMetaPayload(rawPostTest, META_DIALOGUE_ID);

      const filteredPostTest = rawPostTest.filter((row) => !isTelemetryMetaQuestionId(row.question_id));
      const demoFallbackRows = rawPreTest.filter((row) => isDemoFallbackQuestionId(row.question_id));
      const filteredPreTest = rawPreTest.filter((row) => !isDemoFallbackQuestionId(row.question_id));

      const fallbackDemographicResponses = demoFallbackRows.map((row) => ({
        ...row,
        question_id: normalizeDemoQuestionId(row.question_id),
      }));

      const resolvedDemographicResponses =
        demographicResponses && demographicResponses.length > 0
          ? demographicResponses
          : fallbackDemographicResponses;

      const fallbackAvatarTimeTracking = timingMetaPayload
        ? parseTimingMeta(timingMetaPayload).map((entry: any, index: number) => ({
            id: `meta:${session.id}:${index}`,
            session_id: session.id,
            slide_id: entry.slideId,
            slide_title: entry.slideTitle || entry.slideId,
            started_at: entry.startedAt || null,
            ended_at: entry.endedAt || null,
            duration_seconds: entry.durationSeconds ?? null,
            mode: entry.mode || null,
          }))
        : [];

      setActiveSlides(activeSlides || []);
      const slideLookup = buildSlideLookup(activeSlides || []);
      const resolvedAvatarTimeTracking = mergeAvatarTiming(
        avatarTimeTracking || [],
        fallbackAvatarTimeTracking,
        slideLookup
      );

      const fallbackTutorDialogueTurns = dialogueMetaPayload
        ? parseDialogueMeta(dialogueMetaPayload).map((entry: any, index: number) => ({
            id: `meta:${session.id}:${index}`,
            session_id: session.id,
            role: entry.role,
            content: entry.content,
            slide_id: entry.slideId || null,
            slide_title: entry.slideTitle || null,
            timestamp: entry.timestamp ? new Date(entry.timestamp).toISOString() : new Date().toISOString(),
          }))
        : [];

      const resolvedTutorDialogueTurns = mergeTutorDialogue(
        tutorDialogueTurns || [],
        fallbackTutorDialogueTurns
      );

      const overrides = loadOwnerOverrides();
      const sessionOverride = overrides[session.id];
      const resolvedSession = applySessionOverride(session, sessionOverride);
      const hasMeaningfulAnswer = (answer: string | null | undefined) =>
        typeof answer === 'string' ? answer.trim() !== '' : answer !== null && answer !== undefined;

      const resolvedDetails = applyDetailsOverride(
        {
          demographics: oldDemographics,
          demographicResponses: (resolvedDemographicResponses || []).filter((r) => hasMeaningfulAnswer(r.answer)),
          preTest: filteredPreTest.filter((r) => hasMeaningfulAnswer(r.answer)),
          postTest: filteredPostTest.filter((r) => hasMeaningfulAnswer(r.answer)),
          scenarios: scenarios || [],
          dialogueTurns,
          tutorDialogueTurns: resolvedTutorDialogueTurns || [],
          avatarTimeTracking: resolvedAvatarTimeTracking || [],
        },
        sessionOverride
      );

      const preCounts = questionBank.length
        ? computeResponseCounts(
            {
              mode: resolvedSession.mode,
              modes_used: resolvedSession.modes_used,
              started_at: resolvedSession.started_at,
              created_at: resolvedSession.created_at,
              completed_at: resolvedSession.completed_at,
            },
            questionBank,
            'pre_test',
            resolvedDetails.preTest || []
          )
        : { expected: 0, answered: resolvedDetails.preTest?.length || 0, has: (resolvedDetails.preTest?.length || 0) > 0 };
      const postCounts = questionBank.length
        ? computeResponseCounts(
            {
              mode: resolvedSession.mode,
              modes_used: resolvedSession.modes_used,
              started_at: resolvedSession.started_at,
              created_at: resolvedSession.created_at,
              completed_at: resolvedSession.completed_at,
            },
            questionBank,
            'post_test',
            resolvedDetails.postTest || []
          )
        : { expected: 0, answered: resolvedDetails.postTest?.length || 0, has: (resolvedDetails.postTest?.length || 0) > 0 };

      mergeSessionDataStatus(session.id, {
        hasDemographics:
          (resolvedDetails.demographicResponses?.length || 0) > 0 || Boolean(resolvedDetails.demographics),
        hasPreTest: questionBank.length ? preCounts.has : preCounts.answered > 0,
        hasPostTest: questionBank.length ? postCounts.has : postCounts.answered > 0,
        hasDialogue:
          (resolvedDetails.dialogueTurns?.length || 0) > 0 ||
          (resolvedDetails.tutorDialogueTurns?.length || 0) > 0,
        preTestExpected: questionBank.length ? preCounts.expected : null,
        preTestAnswered: preCounts.answered,
        postTestExpected: questionBank.length ? postCounts.expected : null,
        postTestAnswered: postCounts.answered,
      });

      setSelectedSession(resolvedSession);
      setSessionDetails(resolvedDetails);
      setHasLocalOverride(Boolean(sessionOverride));
    } catch (error) {
      console.error('Error fetching session details:', error);
    } finally {
      setIsDetailsLoading(false);
    }
  };

  const buildEditDraft = (session: Session, details: SessionDetails): SessionEditDraft => {
    return {
      session: {
        started_at: session.started_at || '',
        completed_at: session.completed_at || null,
        last_activity_at: session.last_activity_at || null,
        status: session.status || '',
        mode: session.mode,
        modes_used: session.modes_used || [],
        suspicion_score: session.suspicion_score ?? null,
        suspicious_flags: session.suspicious_flags ?? null,
      },
      demographicResponses: (details.demographicResponses || []).map((r) => ({
        id: r.id,
        question_id: r.question_id,
        answer: r.answer || '',
      })),
      preTest: (details.preTest || []).map((r) => ({
        id: r.id,
        question_id: r.question_id,
        answer: r.answer || '',
      })),
      postTest: (details.postTest || []).map((r) => ({
        id: r.id,
        question_id: r.question_id,
        answer: r.answer || '',
      })),
      scenarios: (details.scenarios || []).map((s) => ({
        id: s.id,
        scenario_id: s.scenario_id,
        trust_rating: s.trust_rating ?? 0,
        confidence_rating: s.confidence_rating ?? 0,
        engagement_rating: Boolean(s.engagement_rating),
        completed_at: s.completed_at || '',
      })),
      avatarTimeTracking: (details.avatarTimeTracking || [])
        .filter((t) => !isMetaRowId(String(t.id)))
        .map((t) => ({
        id: t.id,
        slide_id: t.slide_id,
        slide_title: t.slide_title,
        duration_seconds: t.duration_seconds ?? null,
      })),
      tutorDialogueTurns: (details.tutorDialogueTurns || [])
        .filter((t) => !isMetaRowId(String(t.id)))
        .map((t) => ({
        id: t.id,
        role: t.role,
        content: t.content || '',
        slide_id: t.slide_id ?? null,
        slide_title: t.slide_title ?? null,
      })),
      dialogueTurns: (details.dialogueTurns || []).map((t) => ({
        id: t.id,
        role: t.role,
        content: t.content || '',
        scenario_name: t.scenario_name,
      })),
    };
  };

  const updateListItem = <T extends Record<string, unknown>>(
    list: T[],
    index: number,
    patch: Partial<T>
  ) => {
    return list.map((item, i) => (i === index ? { ...item, ...patch } : item));
  };

  const isValidDateValue = (value: string | null) => {
    if (!value) return true;
    return !Number.isNaN(Date.parse(value));
  };

  const getSessionDurationSeconds = (draft: SessionEditDraft | null) => {
    if (!draft?.session.started_at || !draft.session.completed_at) return null;
    const started = Date.parse(draft.session.started_at);
    const completed = Date.parse(draft.session.completed_at);
    if (Number.isNaN(started) || Number.isNaN(completed)) return null;
    return Math.max(0, Math.round((completed - started) / 1000));
  };

  const distributeAvatarTime = (draft: SessionEditDraft) => {
    const totalSeconds = getSessionDurationSeconds(draft);
    if (!totalSeconds) return draft;
    if (draft.avatarTimeTracking.length === 0) return draft;

    const slideCount = draft.avatarTimeTracking.length;
    const maxTotal = slideCount * MAX_AVATAR_SLIDE_SECONDS;
    const targetTotal = Math.min(totalSeconds, maxTotal);
    if (targetTotal <= 0) {
      return {
        ...draft,
        avatarTimeTracking: draft.avatarTimeTracking.map((entry) => ({
          ...entry,
          duration_seconds: 0,
        })),
      };
    }

    const weights = draft.avatarTimeTracking.map(() => Math.random() + 0.2);
    const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
    const durations = weights.map((weight) =>
      Math.min(
        MAX_AVATAR_SLIDE_SECONDS,
        Math.max(0, Math.round((weight / weightSum) * targetTotal))
      )
    );
    let currentTotal = durations.reduce((sum, value) => sum + value, 0);

    while (currentTotal !== targetTotal) {
      if (currentTotal < targetTotal) {
        const candidates = durations
          .map((value, index) => ({ value, index }))
          .filter((entry) => entry.value < MAX_AVATAR_SLIDE_SECONDS);
        if (candidates.length === 0) break;
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        durations[pick.index] += 1;
        currentTotal += 1;
      } else {
        const candidates = durations
          .map((value, index) => ({ value, index }))
          .filter((entry) => entry.value > 0);
        if (candidates.length === 0) break;
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        durations[pick.index] -= 1;
        currentTotal -= 1;
      }
    }

    return {
      ...draft,
      avatarTimeTracking: draft.avatarTimeTracking.map((entry, index) => ({
        ...entry,
        duration_seconds: durations[index],
      })),
    };
  };

  const distributeSlideDurations = (slideCount: number, totalSeconds: number) => {
    if (slideCount <= 0) return [] as number[];
    const maxTotal = slideCount * MAX_AVATAR_SLIDE_SECONDS;
    const targetTotal = Math.min(totalSeconds, maxTotal);
    if (targetTotal <= 0) return new Array(slideCount).fill(0);

    const weights = Array.from({ length: slideCount }, () => Math.random() + 0.2);
    const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
    const durations = weights.map((weight) =>
      Math.min(
        MAX_AVATAR_SLIDE_SECONDS,
        Math.max(0, Math.round((weight / weightSum) * targetTotal))
      )
    );
    let currentTotal = durations.reduce((sum, value) => sum + value, 0);

    while (currentTotal !== targetTotal) {
      if (currentTotal < targetTotal) {
        const candidates = durations
          .map((value, index) => ({ value, index }))
          .filter((entry) => entry.value < MAX_AVATAR_SLIDE_SECONDS);
        if (candidates.length === 0) break;
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        durations[pick.index] += 1;
        currentTotal += 1;
      } else {
        const candidates = durations
          .map((value, index) => ({ value, index }))
          .filter((entry) => entry.value > 0);
        if (candidates.length === 0) break;
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        durations[pick.index] -= 1;
        currentTotal -= 1;
      }
    }

    return durations;
  };

  const buildAvatarGroups = (
    entries: SessionEditDraft['avatarTimeTracking'],
    resolveGroupKey: (entry: SessionEditDraft['avatarTimeTracking'][number]) => { key: string; title: string }
  ): AvatarGroup[] => {
    const groups = new Map<string, AvatarGroup>();
    entries.forEach((entry) => {
      const resolved = resolveGroupKey(entry);
      if (!resolved.key) return;
      const current = groups.get(resolved.key);
      const entryTitle = resolved.title || entry.slide_title || entry.slide_id;
      if (!current) {
        groups.set(resolved.key, {
          slideId: resolved.key,
          title: entryTitle,
          total: entry.duration_seconds || 0,
          entryIds: [entry.id],
        });
      } else {
        const bestTitle = entryTitle.length > current.title.length ? entryTitle : current.title;
        groups.set(resolved.key, {
          slideId: resolved.key,
          title: bestTitle,
          total: current.total + (entry.duration_seconds || 0),
          entryIds: [...current.entryIds, entry.id],
        });
      }
    });
    return Array.from(groups.values());
  };

  const updateGroupDuration = (entryIds: string[], nextTotalRaw: number, maxPerEntry: number) => {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const entries = prev.avatarTimeTracking.filter((entry) => entryIds.includes(entry.id));
      if (entries.length === 0) return prev;

      const maxTotal = entries.length * maxPerEntry;
      const targetTotal = Math.min(Math.max(0, Math.round(nextTotalRaw)), maxTotal);
      const currentTotal = entries.reduce((sum, entry) => sum + (entry.duration_seconds || 0), 0);

      let durations: number[] = [];
      if (currentTotal > 0) {
        durations = entries.map((entry) =>
          Math.min(
            maxPerEntry,
            Math.max(0, Math.round(((entry.duration_seconds || 0) / currentTotal) * targetTotal))
          )
        );
      } else {
        const base = Math.floor(targetTotal / entries.length);
        const remainder = targetTotal % entries.length;
        durations = entries.map((_, index) =>
          Math.min(maxPerEntry, base + (index < remainder ? 1 : 0))
        );
      }

      let adjustedTotal = durations.reduce((sum, value) => sum + value, 0);
      while (adjustedTotal !== targetTotal) {
        if (adjustedTotal < targetTotal) {
          const candidates = durations
            .map((value, index) => ({ value, index }))
            .filter((entry) => entry.value < maxPerEntry);
          if (candidates.length === 0) break;
          const pick = candidates[Math.floor(Math.random() * candidates.length)];
          durations[pick.index] += 1;
          adjustedTotal += 1;
        } else {
          const candidates = durations
            .map((value, index) => ({ value, index }))
            .filter((entry) => entry.value > 0);
          if (candidates.length === 0) break;
          const pick = candidates[Math.floor(Math.random() * candidates.length)];
          durations[pick.index] -= 1;
          adjustedTotal -= 1;
        }
      }

      const updatedTracking = prev.avatarTimeTracking.map((entry) => {
        const index = entries.findIndex((candidate) => candidate.id === entry.id);
        if (index === -1) return entry;
        return {
          ...entry,
          duration_seconds: durations[index],
        };
      });

      return {
        ...prev,
        avatarTimeTracking: updatedTracking,
      };
    });
  };

  const updateAvatarGroupDuration = (entryIds: string[], nextTotalRaw: number) =>
    updateGroupDuration(entryIds, nextTotalRaw, MAX_AVATAR_SLIDE_SECONDS);

  const updatePageGroupDuration = (entryIds: string[], nextTotalRaw: number) =>
    updateGroupDuration(entryIds, nextTotalRaw, 7200);

  const isPageId = (slideId: string) => slideId.startsWith('page:');
  const isDemoFallbackQuestionId = (questionId: string) => questionId.startsWith(DEMO_FALLBACK_PREFIX);
  const normalizeDemoQuestionId = (questionId: string) =>
    questionId.startsWith('demo-demo-') ? questionId.replace(/^demo-/, '') : questionId;
  const isMetaRowId = (id: string) => id.startsWith('meta:');
  const slideLookup = buildSlideLookup(activeSlides);
  const hasActiveSlides = slideLookup.byId.size > 0;
  const resolveSlideGroupKey = (entry: { slide_id: string; slide_title?: string | null }) =>
    (() => {
      const resolved = resolveSlideKey(entry.slide_id, entry.slide_title, slideLookup);
      if (!resolved.key) return { key: '', title: '' };
      if (hasActiveSlides && !slideLookup.byId.has(resolved.key)) return { key: '', title: '' };
      return resolved;
    })();
  const resolvePageGroupKey = (entry: { slide_id: string; slide_title?: string | null }) => ({
    key: entry.slide_id,
    title: (entry.slide_title || entry.slide_id).replace(/^Page:\s*/i, ''),
  });

  const mergeAvatarTiming = (
    rawEntries: any[],
    fallbackEntries: any[],
    slideLookup?: ReturnType<typeof buildSlideLookup>
  ) => {
    const merged: any[] = [];
    const rawSlideKeys = new Set<string>();
    const rawPageIds = new Set<string>();
    const hasActiveSlides = Boolean(slideLookup && slideLookup.byId.size > 0);

    const resolveSlide = (entry: any) =>
      resolveSlideKey(entry?.slide_id, entry?.slide_title, slideLookup);

    rawEntries.forEach((entry) => {
      if (!entry?.slide_id) return;
      if (isPageId(entry.slide_id)) {
        rawPageIds.add(entry.slide_id);
        merged.push(entry);
        return;
      }
      const resolved = resolveSlide(entry);
      if (!resolved.key) return;
      if (hasActiveSlides && slideLookup && !slideLookup.byId.has(resolved.key)) return;
      rawSlideKeys.add(resolved.key);
      merged.push({
        ...entry,
        slide_id: resolved.key,
        slide_title: resolved.title || entry.slide_title || entry.slide_id,
      });
    });

    fallbackEntries.forEach((entry) => {
      if (!entry?.slide_id) return;
      if (isPageId(entry.slide_id)) {
        if (!rawPageIds.has(entry.slide_id)) {
          merged.push(entry);
        }
        return;
      }
      const resolved = resolveSlide(entry);
      if (!resolved.key) return;
      if (hasActiveSlides && slideLookup && !slideLookup.byId.has(resolved.key)) return;
      if (!rawSlideKeys.has(resolved.key)) {
        merged.push({
          ...entry,
          slide_id: resolved.key,
          slide_title: resolved.title || entry.slide_title || entry.slide_id,
        });
      }
    });

    return merged;
  };

  const mergeTutorDialogue = (rawEntries: any[], fallbackEntries: any[]) => {
    if (rawEntries.length === 0) return fallbackEntries;
    if (fallbackEntries.length === 0) return rawEntries;

    const merged = [...rawEntries];
    const seen = new Set(
      rawEntries.map((entry) => `${entry.role}:${entry.content}:${entry.timestamp || ''}:${entry.slide_id || ''}`)
    );
    fallbackEntries.forEach((entry) => {
      const key = `${entry.role}:${entry.content}:${entry.timestamp || ''}:${entry.slide_id || ''}`;
      if (!seen.has(key)) {
        merged.push(entry);
      }
    });
    return merged;
  };

  const parseTimingMeta = (answer?: string | null) => {
    if (!answer) return [];
    try {
      const parsed = JSON.parse(answer);
      if (!parsed || !Array.isArray(parsed.entries)) return [];
      return parsed.entries;
    } catch {
      return [];
    }
  };

  const parseDialogueMeta = (answer?: string | null) => {
    if (!answer) return [];
    try {
      const parsed = JSON.parse(answer);
      if (!parsed || !Array.isArray(parsed.messages)) return [];
      return parsed.messages;
    } catch {
      return [];
    }
  };

  const openEditDialog = () => {
    if (!selectedSession || !sessionDetails) return;
    if (new Date(selectedSession.created_at) < OWNER_EDIT_MIN_DATE) {
      toast.error('Editing is only enabled for sessions from 24 Dec 2025');
      return;
    }
    if (isOwner && questionBank.length === 0) {
      loadQuestionBank();
    }
    setEditDraft(buildEditDraft(selectedSession, sessionDetails));
    setIsEditOpen(true);
  };

  useEffect(() => {
    if (!autoDistributeSlides || !editDraft) return;
    setEditDraft((prev) => {
      if (!prev) return prev;
      const updated = distributeAvatarTime(prev);
      const unchanged = prev.avatarTimeTracking.every((entry, index) => {
        return entry.duration_seconds === updated.avatarTimeTracking[index]?.duration_seconds;
      });
      return unchanged ? prev : updated;
    });
  }, [autoDistributeSlides, editDraft?.session.started_at, editDraft?.session.completed_at]);

  const saveOwnerEdits = async () => {
    if (!selectedSession || !editDraft) return;

    if (!isValidDateValue(editDraft.session.started_at) || !isValidDateValue(editDraft.session.completed_at)) {
      toast.error('Invalid date format. Use ISO like 2025-12-26T20:29:00Z');
      return;
    }

    if (editDraft.session.last_activity_at && !isValidDateValue(editDraft.session.last_activity_at)) {
      toast.error('Invalid last activity date. Use ISO like 2025-12-26T20:29:00Z');
      return;
    }

    if (editDraft.session.started_at && editDraft.session.completed_at) {
      const started = Date.parse(editDraft.session.started_at);
      const completed = Date.parse(editDraft.session.completed_at);
      if (!Number.isNaN(started) && !Number.isNaN(completed) && completed < started) {
        toast.error('Completed time cannot be earlier than started time.');
        return;
      }
    }

    setIsSavingEdit(true);
    try {
      const { data, error } = await supabase.functions.invoke('owner-edit-session', {
        body: {
          sessionId: selectedSession.id,
          updates: {
            session: {
              started_at: editDraft.session.started_at || selectedSession.started_at,
              completed_at: editDraft.session.completed_at || null,
              last_activity_at: editDraft.session.last_activity_at || null,
              status: editDraft.session.status || selectedSession.status,
              mode: editDraft.session.mode,
              modes_used: editDraft.session.modes_used,
              suspicion_score: editDraft.session.suspicion_score,
              suspicious_flags: editDraft.session.suspicious_flags,
            },
            demographicResponses: editDraft.demographicResponses.map((r) => ({
              id: r.id,
              answer: r.answer,
            })),
            preTest: editDraft.preTest.map((r) => ({
              id: r.id,
              answer: r.answer,
            })),
            postTest: editDraft.postTest.map((r) => ({
              id: r.id,
              answer: r.answer,
            })),
            scenarios: editDraft.scenarios.map((s) => ({
              id: s.id,
              trust_rating: s.trust_rating,
              confidence_rating: s.confidence_rating,
              engagement_rating: s.engagement_rating,
              completed_at: s.completed_at,
            })),
            avatarTimeTracking: editDraft.avatarTimeTracking.map((t) => ({
              id: t.id,
              duration_seconds: t.duration_seconds,
            })),
            tutorDialogueTurns: editDraft.tutorDialogueTurns.map((t) => ({
              id: t.id,
              content: t.content,
            })),
            dialogueTurns: editDraft.dialogueTurns.map((t) => ({
              id: t.id,
              content: t.content,
            })),
          },
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      clearOwnerOverride(selectedSession.id);
      setHasLocalOverride(false);

      const updatedSession: Session = {
        ...selectedSession,
        started_at: editDraft.session.started_at || selectedSession.started_at,
        completed_at: editDraft.session.completed_at || null,
        last_activity_at: editDraft.session.last_activity_at || null,
        status: editDraft.session.status || selectedSession.status,
        mode: editDraft.session.mode,
        modes_used: editDraft.session.modes_used,
        suspicion_score: editDraft.session.suspicion_score ?? selectedSession.suspicion_score,
        suspicious_flags: editDraft.session.suspicious_flags ?? selectedSession.suspicious_flags,
      };

      setSelectedSession(updatedSession);
      await fetchSessions();
      await fetchSessionDetails(updatedSession);
      toast.success('Session data updated');
      setIsEditOpen(false);
    } catch (error) {
      console.error('Owner edit failed:', error);
      const overrides = loadOwnerOverrides();
      const override = buildOverrideFromDraft(editDraft);
      overrides[selectedSession.id] = override;
      saveOwnerOverrides(overrides);
      setHasLocalOverride(true);

      const updatedSession = applySessionOverride(selectedSession, override);
      setSelectedSession(updatedSession);
      setSessions((prev) =>
        prev.map((session) =>
          session.id === selectedSession.id ? applySessionOverride(session, override) : session
        )
      );
      if (sessionDetails) {
        const nextDetails = applyDetailsOverride(sessionDetails, override);
        setSessionDetails(nextDetails);
        mergeSessionDataStatus(selectedSession.id, {
          hasDemographics:
            (nextDetails.demographicResponses?.length || 0) > 0 || Boolean(nextDetails.demographics),
          hasPreTest: (nextDetails.preTest?.length || 0) > 0,
          hasPostTest: (nextDetails.postTest?.length || 0) > 0,
          hasDialogue:
            (nextDetails.dialogueTurns?.length || 0) > 0 ||
            (nextDetails.tutorDialogueTurns?.length || 0) > 0,
        });
      }

      toast('Saved locally on this device (Supabase not available).');
      setIsEditOpen(false);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const clearLocalOverride = async () => {
    if (!selectedSession) return;
    clearOwnerOverride(selectedSession.id);
    setHasLocalOverride(false);
    await fetchSessions();
    await fetchSessionDetails(selectedSession);
    toast.success('Local override cleared.');
  };

  const restoreSession = async (session: Session) => {
    if (!isOwner) return;
    if (new Date(session.created_at) < OWNER_EDIT_MIN_DATE) {
      toast.error('Restoring is only enabled for sessions from 24 Dec 2025');
      return;
    }

    setRestoringSessionId(session.id);
    const restoredAt = new Date().toISOString();
    try {
      const { data, error } = await supabase.functions.invoke('owner-edit-session', {
        body: {
          sessionId: session.id,
          updates: {
            session: {
              status: 'active',
              last_activity_at: restoredAt,
            },
          },
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSessions((prev) =>
        prev.map((entry) =>
          entry.id === session.id
            ? { ...entry, status: 'active', last_activity_at: restoredAt }
            : entry
        )
      );

      setSelectedSession((prev) =>
        prev && prev.id === session.id
          ? { ...prev, status: 'active', last_activity_at: restoredAt }
          : prev
      );

      toast.success('Session restored');
    } catch (error) {
      console.error('Failed to restore session:', error);
      const message = String((error as Error)?.message || '');
      if (message.toLowerCase().includes('fetch') || message.toLowerCase().includes('cors')) {
        toast.error('Restore failed: owner-edit-session is not reachable. Deploy the Edge Function.');
      } else {
        toast.error('Failed to restore session');
      }
    } finally {
      setRestoringSessionId(null);
    }
  };

  // Update session validation status via edge function
  // Owner can directly accept/ignore, Admin can only request (goes to 'pending_approval')
  const updateValidationStatus = async (sessionId: string, status: 'accepted' | 'ignored') => {
    if (!canManageValidation) {
      toast.error('You do not have permission to manage validation');
      return;
    }
    try {
      console.log('updateValidationStatus called:', { sessionId, status });
      
      const { data, error } = await supabase.functions.invoke('update-session-validation', {
        body: { sessionId, status }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      console.log('Edge function response:', data);

      // Update local state with the actual status from the edge function
      setSessions(prev => prev.map(s => 
        s.id === sessionId 
          ? { ...s, validation_status: data.actualStatus, validated_by: userEmail, validated_at: new Date().toISOString() }
          : s
      ));

      toast.success(data.message);
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
      const { data, error } = await supabase.functions.invoke('update-session-validation', {
        body: { sessionId, approve }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      setSessions(prev => prev.map(s => 
        s.id === sessionId 
          ? { ...s, validation_status: data.actualStatus, validated_by: userEmail, validated_at: new Date().toISOString() }
          : s
      ));

      toast.success(data.message);
    } catch (error) {
      console.error('Error approving validation:', error);
      toast.error('Failed to process validation request');
    }
  };

  // Bulk validation for multiple sessions via edge function
  const bulkUpdateValidation = async (status: 'accepted' | 'ignored') => {
    if (!canManageValidation) {
      toast.error('You do not have permission to manage validation');
      return;
    }
    if (selectedSessionIds.size === 0) {
      toast.error('No sessions selected');
      return;
    }

    try {
      const sessionIdsArray = Array.from(selectedSessionIds);
      
      const { data, error } = await supabase.functions.invoke('update-session-validation', {
        body: { sessionIds: sessionIdsArray, status }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      setSessions(prev => prev.map(s => 
        selectedSessionIds.has(s.id)
          ? { ...s, validation_status: data.actualStatus, validated_by: userEmail, validated_at: new Date().toISOString() }
          : s
      ));
      
      setSelectedSessionIds(new Set());
      toast.success(data.message);
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

  // Select all sessions on current page
  const selectAllOnPage = () => {
    if (!canManageValidation) {
      return;
    }
    const allSelected = paginatedSessions.every(s => selectedSessionIds.has(s.id));
    
    if (allSelected) {
      // Deselect all
      setSelectedSessionIds(prev => {
        const next = new Set(prev);
        paginatedSessions.forEach(s => next.delete(s.id));
        return next;
      });
    } else {
      // Select all
      setSelectedSessionIds(prev => {
        const next = new Set(prev);
        paginatedSessions.forEach(s => next.add(s.id));
        return next;
      });
    }
  };

  // Hide session(s) from statistics (set validation_status to 'ignored')
  const hideSelectedSessions = async () => {
    if (!canManageValidation) {
      toast.error('You do not have permission to manage validation');
      return;
    }
    if (selectedSessionIds.size === 0) {
      toast.error('No sessions selected');
      return;
    }

    try {
      const sessionIdsArray = Array.from(selectedSessionIds);
      
      const { data, error } = await supabase.functions.invoke('update-session-validation', {
        body: { sessionIds: sessionIdsArray, status: 'ignored' }
      });

      if (error) throw error;

      setSessions(prev => prev.map(s => 
        selectedSessionIds.has(s.id)
          ? { ...s, validation_status: data.actualStatus, validated_by: userEmail, validated_at: new Date().toISOString() }
          : s
      ));
      
      setSelectedSessionIds(new Set());
      toast.success(data.message);
    } catch (error) {
      console.error('Error hiding sessions:', error);
      toast.error('Failed to hide sessions');
    }
  };

  // Restore session(s) to pending status
  const restoreSelectedSessions = async () => {
    if (!canManageValidation) {
      toast.error('You do not have permission to manage validation');
      return;
    }
    if (selectedSessionIds.size === 0) {
      toast.error('No sessions selected');
      return;
    }

    try {
      const sessionIdsArray = Array.from(selectedSessionIds);
      
      const { data, error } = await supabase.functions.invoke('update-session-validation', {
        body: { sessionIds: sessionIdsArray, status: 'pending' }
      });

      if (error) throw error;

      setSessions(prev => prev.map(s => 
        selectedSessionIds.has(s.id)
          ? { ...s, validation_status: data.actualStatus, validated_by: userEmail, validated_at: new Date().toISOString() }
          : s
      ));
      
      setSelectedSessionIds(new Set());
      toast.success(data.message);
    } catch (error) {
      console.error('Error restoring sessions:', error);
      toast.error('Failed to restore sessions');
    }
  };

  // Delete session(s) permanently (owner only)
  const deleteSelectedSessions = async () => {
    if (!permissions.canDeleteSessions) {
      toast.error('Only owner can delete sessions');
      return;
    }
    
    if (selectedSessionIds.size === 0) {
      toast.error('No sessions selected');
      return;
    }

    if (!confirm(`Are you sure you want to permanently delete ${selectedSessionIds.size} session(s)? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const sessionIdsArray = Array.from(selectedSessionIds);
      
      const { data, error } = await supabase.functions.invoke('update-session-validation', {
        body: { sessionIds: sessionIdsArray, action: 'delete' }
      });

      if (error) throw error;

      // Remove deleted sessions from local state
      setSessions(prev => prev.filter(s => !selectedSessionIds.has(s.id)));
      setSelectedSessionIds(new Set());
      toast.success(`${sessionIdsArray.length} session(s) permanently deleted`);
    } catch (error) {
      console.error('Error deleting sessions:', error);
      toast.error('Failed to delete sessions');
    } finally {
      setIsDeleting(false);
    }
  };

  const canEditSelectedSession = Boolean(
    isOwner &&
    selectedSession &&
    sessionDetails &&
    new Date(selectedSession.created_at) >= OWNER_EDIT_MIN_DATE
  );

  const filteredSessions = sessions.filter(session => {
    const matchesSearch = session.session_id.toLowerCase().includes(searchTerm.toLowerCase());
    const modesUsed = session.modes_used && session.modes_used.length > 0 ? session.modes_used : [session.mode];
    const sessionMode: string = modesUsed.includes('text') && modesUsed.includes('avatar')
      ? 'both'
      : modesUsed.includes('avatar')
        ? 'avatar'
        : 'text';
    const matchesMode = modeFilter === "all" || sessionMode === modeFilter;
    
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

    // Data completeness filter
    let matchesData = true;
    const dataStatus = sessionDataStatuses.get(session.id);
    if (dataFilter !== 'all' && dataStatus) {
      switch (dataFilter) {
        case 'complete':
          matchesData = dataStatus.isComplete;
          break;
        case 'missing':
          matchesData = !dataStatus.isComplete;
          break;
        case 'no_demographics':
          matchesData = !dataStatus.hasDemographics;
          break;
        case 'no_pretest':
          matchesData = !dataStatus.hasPreTest;
          break;
        case 'no_posttest':
          matchesData = !dataStatus.hasPostTest;
          break;
      }
    }
    
    return matchesSearch && matchesMode && matchesStatus && matchesValidation && matchesData;
  });

  const totalPages = Math.ceil(filteredSessions.length / itemsPerPage);
  const paginatedSessions = filteredSessions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const selectedFlags = Array.isArray(selectedSession?.suspicious_flags) ? selectedSession?.suspicious_flags : [];

  const exportToCSV = async () => {
    if (filteredSessions.length === 0) return;

    const sessionIds = filteredSessions.map((s) => s.id);
    const escapeCsv = (value: string | number) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    let rawAvatarTimeData: any[] = [];
    let timingMetaRows: any[] = [];
    let activeSlides: Array<{ slide_id: string; title: string; sort_order: number; is_active: boolean }> = [];

    try {
      const [avatarRes, postRes, slideRes] = await Promise.all([
        supabase.from('avatar_time_tracking').select('*').in('session_id', sessionIds),
        supabase.from('post_test_responses').select('session_id, question_id, answer, created_at').in('session_id', sessionIds),
        supabase.from('study_slides').select('slide_id, title, sort_order, is_active').order('sort_order'),
      ]);

      rawAvatarTimeData = avatarRes.data || [];
      timingMetaRows = (postRes.data || []).filter(
        (row) =>
          typeof row.question_id === 'string' &&
          (row.question_id === META_TIMING_ID || row.question_id.startsWith(`${META_TIMING_ID}__batch_`))
      );
      activeSlides = (slideRes.data || []).filter((slide) => slide.is_active);
    } catch (error) {
      console.error('Failed to load timing data for CSV export:', error);
    }

    const slideLookup = buildSlideLookup(activeSlides);
    const hasActiveSlides = slideLookup.byId.size > 0;
    const rawBySession = new Map<string, any[]>();
    rawAvatarTimeData.forEach((entry) => {
      const list = rawBySession.get(entry.session_id) || [];
      list.push(entry);
      rawBySession.set(entry.session_id, list);
    });

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

    const timingRowsBySession = new Map<string, any[]>();
    timingMetaRows.forEach((row: any) => {
      const list = timingRowsBySession.get(row.session_id) || [];
      list.push(row);
      timingRowsBySession.set(row.session_id, list);
    });

    const fallbackBySession = new Map<string, any[]>();
    timingRowsBySession.forEach((rows: any[], sessionId: string) => {
      const payload = extractMetaPayload(rows, META_TIMING_ID);
      if (!payload) return;
      const entries = parseTimingMeta(payload)
        .filter((entry: any) => entry?.slideId && typeof entry.durationSeconds === 'number')
        .map((entry: any, index: number) => ({
          id: `meta:${sessionId}:${index}`,
          session_id: sessionId,
          slide_id: entry.slideId,
          slide_title: entry.slideTitle || entry.slideId,
          duration_seconds: entry.durationSeconds ?? 0,
        }));
      const list = fallbackBySession.get(sessionId) || [];
      list.push(...entries);
      fallbackBySession.set(sessionId, list);
    });

    const mergedBySession = new Map<string, any[]>();
    const slideColumnMap = new Map<string, string>();
    const pageColumnMap = new Map<string, string>();

    filteredSessions.forEach((session) => {
      const merged = mergeAvatarTiming(
        rawBySession.get(session.id) || [],
        fallbackBySession.get(session.id) || [],
        slideLookup
      );
      mergedBySession.set(session.id, merged);
      merged.forEach((entry) => {
        if (!entry?.slide_id) return;
        if (isPageId(entry.slide_id)) {
          const label = (entry.slide_title || entry.slide_id).replace(/^Page:\s*/i, '');
          pageColumnMap.set(entry.slide_id, label);
        } else {
          const resolved = resolveSlideKey(entry.slide_id, entry.slide_title, slideLookup);
          if (!resolved.key) return;
          if (hasActiveSlides && !slideLookup.byId.has(resolved.key)) return;
          const label = resolved.title || entry.slide_title || entry.slide_id;
          if (!slideColumnMap.has(resolved.key) || label.length > (slideColumnMap.get(resolved.key) || '').length) {
            slideColumnMap.set(resolved.key, label);
          }
        }
      });
    });

    const slideColumns = activeSlides.length > 0
      ? activeSlides.map((slide) => ({ id: slide.slide_id, title: slide.title }))
      : Array.from(slideColumnMap.entries())
          .map(([id, title]) => ({ id, title }))
          .sort((a, b) => a.title.localeCompare(b.title));

    const pageColumns = Array.from(pageColumnMap.entries())
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title));

    const headers = [
      'Session ID',
      'Mode',
      'Started',
      'Completed',
      'Duration (min)',
      'Status',
      'Flags',
      ...slideColumns.map((slide) => `Slide: ${slide.title} (sec)`),
      ...pageColumns.map((page) => `Page: ${page.title} (sec)`),
      'Slide Total (sec)',
      'Page Total (sec)',
    ];

    const rows = filteredSessions.map((session) => {
      const duration = session.completed_at
        ? Math.round((new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 1000 / 60)
        : '';
      const flags = Array.isArray(session.suspicious_flags) ? session.suspicious_flags.join('; ') : '';
      const status = session.status === 'reset' ? 'Reset' : (session.completed_at ? 'Completed' : 'Incomplete');
      const modesUsed = session.modes_used && session.modes_used.length > 0 ? session.modes_used.join(' / ') : session.mode;

      const merged = mergedBySession.get(session.id) || [];
      const slideTimes: Record<string, number> = {};
      const pageTimes: Record<string, number> = {};
      merged.forEach((entry) => {
        if (!entry?.slide_id) return;
        const durationSeconds = Number(entry.duration_seconds || 0);
        if (durationSeconds <= 0) return;
        if (isPageId(entry.slide_id)) {
          pageTimes[entry.slide_id] = (pageTimes[entry.slide_id] || 0) + durationSeconds;
        } else {
          const resolved = resolveSlideKey(entry.slide_id, entry.slide_title, slideLookup);
          if (!resolved.key) return;
          slideTimes[resolved.key] = (slideTimes[resolved.key] || 0) + durationSeconds;
        }
      });

      const slideTotal = Object.values(slideTimes).reduce((sum, value) => sum + value, 0);
      const pageTotal = Object.values(pageTimes).reduce((sum, value) => sum + value, 0);

      return [
        session.session_id,
        modesUsed,
        session.started_at,
        session.completed_at || '',
        duration,
        status,
        flags,
        ...slideColumns.map((slide) => slideTimes[slide.id] ?? ''),
        ...pageColumns.map((page) => pageTimes[page.id] ?? ''),
        slideTotal,
        pageTotal,
      ];
    });

    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sessions_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const exportDialogueCSV = (session: Session, details: SessionDetails) => {
    const escapeCsv = (value: string | number) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const modeLabel = session.modes_used && session.modes_used.length > 0 ? session.modes_used.join(' / ') : (session.mode || '');

    const tutorEntries = (details.tutorDialogueTurns || []).map((turn) => ({
      source: 'Tutor',
      role: turn.role,
      content: turn.content,
      context: turn.slide_title || turn.slide_id || '',
      timestamp: turn.timestamp || turn.created_at || '',
    }));

    const scenarioEntries = (details.dialogueTurns || []).map((turn) => ({
      source: 'Scenario',
      role: turn.role,
      content: turn.content,
      context: turn.scenario_name || turn.scenario_id || '',
      timestamp: turn.timestamp || turn.created_at || '',
    }));

    const entries = [...tutorEntries, ...scenarioEntries];
    if (entries.length === 0) {
      toast.error('No dialogue recorded for this session.');
      return;
    }

    entries.sort((a, b) => {
      const aTime = a.timestamp ? Date.parse(a.timestamp) : 0;
      const bTime = b.timestamp ? Date.parse(b.timestamp) : 0;
      return aTime - bTime;
    });

    const headers = ['Session ID', 'Mode', 'Source', 'Role', 'Context', 'Timestamp', 'Message'];
    const rows = entries.map((entry) => [
      session.session_id,
      modeLabel,
      entry.source,
      entry.role,
      entry.context,
      entry.timestamp || '',
      entry.content,
    ]);

    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session_${session.session_id}_dialogue.csv`;
    a.click();
  };

  // Export individual session to PDF
  const exportSessionToPDF = async (session: Session, details: SessionDetails) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;
    const lineHeight = 7;
    const margin = 15;
    const maxWidth = pageWidth - margin * 2;
    const flagList = Array.isArray(session.suspicious_flags) ? session.suspicious_flags : [];
    const questionTextMap: Record<string, string> = {};

    const questionIds = Array.from(new Set([
      ...details.demographicResponses.map(r => r.question_id),
      ...details.preTest.map(r => r.question_id),
      ...details.postTest.map(r => r.question_id),
    ]));

    if (questionIds.length > 0) {
      const { data: questionRows } = await supabase
        .from('study_questions')
        .select('question_id, question_text')
        .in('question_id', questionIds);

      questionRows?.forEach((row) => {
        questionTextMap[row.question_id] = row.question_text;
      });
    }

    const formatQuestionText = (text: string) =>
      text.replace(/\bscenarios\b/gi, 'slides').replace(/\bscenario\b/gi, 'slide');

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

    if (flagList.length > 0) {
      doc.text(`Validation Status: ${session.validation_status || 'pending'}`, margin, y);
      y += lineHeight;
    }

    y += 5;

    // Demographics
    addText('DEMOGRAPHICS', 12, true);
    y += 2;
    if (details.demographicResponses.length > 0) {
      details.demographicResponses.forEach((r) => {
        const label = formatQuestionText(questionTextMap[r.question_id] || r.question_id);
        addText(`${label}: ${r.answer}`);
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
        const label = formatQuestionText(questionTextMap[r.question_id] || r.question_id);
        addText(`${label}: ${r.answer}`);
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
        const label = formatQuestionText(questionTextMap[r.question_id] || r.question_id);
        addText(`${label}: ${r.answer}`);
      });
    } else {
      addText('No responses');
    }
    y += 5;

    // Avatar interaction summary
    const avatarEntries = details.avatarTimeTracking || [];
    const slideEntries = avatarEntries.filter((entry) => !isPageId(entry.slide_id));
    const pageEntries = avatarEntries.filter((entry) => isPageId(entry.slide_id));
    const avatarSeconds = slideEntries.reduce((sum, entry) => sum + (entry.duration_seconds || 0), 0);
    if (session.mode === 'avatar' || slideEntries.length > 0) {
      addText('AVATAR INTERACTION SUMMARY', 12, true);
      y += 2;
      addText(`Total slide time: ${Math.round(avatarSeconds / 60)} minutes (${avatarSeconds}s)`);
      addText(`Slides tracked: ${slideEntries.length}`);
      y += 5;
    }

    const avatarGroups = buildAvatarGroups(
      slideEntries.map((entry) => ({
        id: entry.id,
        slide_id: entry.slide_id,
        slide_title: entry.slide_title,
        duration_seconds: entry.duration_seconds,
      })),
      resolveSlideGroupKey
    );

    if (avatarGroups.length > 0) {
      addText('SLIDE TIME BREAKDOWN', 12, true);
      y += 2;
      avatarGroups.forEach((group) => {
        addText(`${group.title}: ${Math.round(group.total)} sec`);
      });
      y += 5;
    }

    const pageGroups = buildAvatarGroups(
      pageEntries.map((entry) => ({
        id: entry.id,
        slide_id: entry.slide_id,
        slide_title: entry.slide_title,
        duration_seconds: entry.duration_seconds,
      })),
      resolvePageGroupKey
    );

    if (pageGroups.length > 0) {
      addText('PAGE TIME BREAKDOWN', 12, true);
      y += 2;
      pageGroups.forEach((group) => {
        const label = (group.title || group.slideId).replace(/^Page:\s*/i, '');
        addText(`${label}: ${Math.round(group.total)} sec`);
      });
      y += 5;
    }

    // Data quality flags
    addText('DATA QUALITY FLAGS', 12, true);
    y += 2;
    if (flagList.length > 0) {
      flagList.forEach((flag) => {
        const details = describeSuspicionFlag(String(flag));
        const label = String(details.flag).replace(/_/g, ' ');
        addText(`- ${label}`);
        if (details.reason) {
          addText(`  ${details.reason}`);
        }
      });
    } else {
      addText('No flags');
    }
    y += 5;

    // Data quality requirements
    addText('DATA QUALITY REQUIREMENTS', 12, true);
    y += 2;
    getSuspicionRequirements(activeSlides.length).forEach((req) => {
      addText(`- ${req.label}`);
    });
    y += 5;

    // Tutor dialogue (learning)
    addText('TUTOR DIALOGUE (LEARNING)', 12, true);
    y += 2;
    if (details.tutorDialogueTurns.length > 0) {
      let currentSlide: string | null = null;
      details.tutorDialogueTurns.forEach((turn) => {
        const slideLabel = turn.slide_title || turn.slide_id || '';
        if (slideLabel && slideLabel !== currentSlide) {
          currentSlide = slideLabel;
          addText(`Slide: ${currentSlide}`, 11, true);
        }
        const role = turn.role === 'user' ? 'User' : 'Alex (AI)';
        addText(`[${role}]: ${turn.content}`);
      });
    } else {
      addText('No tutor dialogue');
    }

    y += 5;

    if (details.dialogueTurns.length > 0) {
      addText('SCENARIO DIALOGUE (LEGACY)', 12, true);
      y += 2;
      let currentScenario: string | null = null;
      details.dialogueTurns.forEach((turn) => {
        const scenarioLabel = turn.scenario_name ? String(turn.scenario_name).replace(/_/g, ' ') : '';
        if (scenarioLabel && scenarioLabel !== currentScenario) {
          currentScenario = scenarioLabel;
          addText(`Scenario: ${currentScenario}`, 11, true);
        }
        const role = turn.role === 'user' ? 'User' : 'Alex (AI)';
        addText(`[${role}]: ${turn.content}`);
      });
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

  const sessionDurationSeconds = editDraft ? getSessionDurationSeconds(editDraft) : null;
  const missingBackfill =
    editDraft && questionBank.length > 0
      ? buildMissingBackfill(
          editDraft,
          questionBank,
          selectedSession
            ? {
                mode: selectedSession.mode,
                modes_used: selectedSession.modes_used,
                started_at: selectedSession.started_at,
                created_at: selectedSession.created_at,
                completed_at: selectedSession.completed_at,
              }
            : {
                mode: editDraft.session.mode,
                modes_used: editDraft.session.modes_used,
                started_at: editDraft.session.started_at,
              }
        )
      : { missingPre: [] as BackfillAnswer[], missingPost: [] as BackfillAnswer[] };
  const slideOrder = new Map<string, number>();
  activeSlides.forEach((slide, index) => {
    slideOrder.set(slide.slide_id, slide.sort_order ?? index);
  });
  const sortSlideGroups = <T extends { slideId: string; title: string }>(groups: T[]): T[] => {
    return [...groups].sort((a, b) => {
      const orderA = slideOrder.get(a.slideId);
      const orderB = slideOrder.get(b.slideId);
      if (orderA !== undefined && orderB !== undefined && orderA !== orderB) return orderA - orderB;
      if (orderA !== undefined && orderB === undefined) return -1;
      if (orderA === undefined && orderB !== undefined) return 1;
      return a.title.localeCompare(b.title);
    });
  };
  const avatarGroupsForDetails = sessionDetails
    ? sortSlideGroups(
        buildAvatarGroups(
          sessionDetails.avatarTimeTracking
            .filter((entry) => !isPageId(entry.slide_id))
            .map((entry) => ({
              id: entry.id,
              slide_id: entry.slide_id,
              slide_title: entry.slide_title,
              duration_seconds: entry.duration_seconds,
            })),
          resolveSlideGroupKey
        )
      )
    : [];
  const pageGroupsForDetails = sessionDetails
    ? buildAvatarGroups(
        sessionDetails.avatarTimeTracking
          .filter((entry) => isPageId(entry.slide_id))
          .map((entry) => ({
            id: entry.id,
            slide_id: entry.slide_id,
            slide_title: entry.slide_title,
            duration_seconds: entry.duration_seconds,
          })),
        resolvePageGroupKey
      )
    : [];
  const avatarGroupsForEdit = editDraft
    ? sortSlideGroups(
        buildAvatarGroups(editDraft.avatarTimeTracking.filter((entry) => !isPageId(entry.slide_id)), resolveSlideGroupKey)
      )
    : [];
  const pageGroupsForEdit = editDraft
    ? buildAvatarGroups(editDraft.avatarTimeTracking.filter((entry) => isPageId(entry.slide_id)), resolvePageGroupKey)
    : [];

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

      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Participant Sessions</CardTitle>
              <CardDescription className="text-muted-foreground">
                Browse and analyze individual study sessions ({filteredSessions.length} total)
              </CardDescription>
            </div>
            {permissions.canExportData && (
              <Button onClick={exportToCSV} variant="outline" className="border-border">
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
              <Input
                placeholder="Search by session ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-background border-border"
              />
            </div>
            <Select value={modeFilter} onValueChange={setModeFilter}>
              <SelectTrigger className="w-[150px] bg-background border-border">
                <SelectValue placeholder="Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modes</SelectItem>
                <SelectItem value="text">Text Mode</SelectItem>
                <SelectItem value="avatar">Avatar Mode</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] bg-background border-border">
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
              <SelectTrigger className="w-[180px] bg-background border-border">
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
            <Select value={dataFilter} onValueChange={setDataFilter}>
              <SelectTrigger className="w-[180px] bg-background border-border">
                <SelectValue placeholder="Data" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Data</SelectItem>
                <SelectItem value="complete">Complete Data</SelectItem>
                <SelectItem value="missing">Missing Data</SelectItem>
                <SelectItem value="no_demographics">No Demographics</SelectItem>
                <SelectItem value="no_pretest">No Pre-test</SelectItem>
                <SelectItem value="no_posttest">No Post-test</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bulk Actions */}
          {selectedSessionIds.size > 0 && canManageValidation && (
            <div className="flex items-center gap-4 p-3 bg-background/50 border border-border rounded-lg">
              <span className="text-sm text-foreground/80">
                {selectedSessionIds.size} session(s) selected
              </span>
              <div className="flex gap-2 flex-wrap">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="border-green-600 text-green-500 hover:bg-green-600/10"
                  onClick={() => bulkUpdateValidation('accepted')}
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  {permissions.canValidateSessionsDirectly ? 'Accept' : 'Request Accept'}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="border-yellow-600 text-yellow-500 hover:bg-yellow-600/10"
                  onClick={hideSelectedSessions}
                >
                  <EyeOff className="w-4 h-4 mr-1" />
                  Hide from Stats
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="border-blue-600 text-blue-500 hover:bg-blue-600/10"
                  onClick={restoreSelectedSessions}
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Restore to Pending
                </Button>
                {permissions.canDeleteSessions && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="border-red-600 text-red-500 hover:bg-red-600/10"
                    onClick={deleteSelectedSessions}
                    disabled={isDeleting}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    {isDeleting ? 'Deleting...' : 'Delete Permanently'}
                  </Button>
                )}
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="text-muted-foreground"
                  onClick={() => setSelectedSessionIds(new Set())}
                >
                  Clear
                </Button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-muted/50">
                  <TableHead className="text-muted-foreground w-10">
                    {canManageValidation && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-6 w-6 p-0"
                              onClick={selectAllOnPage}
                            >
                              {paginatedSessions.length > 0 && paginatedSessions.every(s => selectedSessionIds.has(s.id)) ? (
                                <CheckSquare className="w-4 h-4 text-primary" />
                              ) : (
                                <Square className="w-4 h-4 text-muted-foreground/70" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Select all sessions on this page</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </TableHead>
                  <TableHead className="text-muted-foreground">Session ID</TableHead>
                  <TableHead className="text-muted-foreground">Mode</TableHead>
                  <TableHead className="text-muted-foreground">Data</TableHead>
                  <TableHead className="text-muted-foreground">Started</TableHead>
                  <TableHead className="text-muted-foreground">Completed</TableHead>
                  <TableHead className="text-muted-foreground">Duration</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Flags</TableHead>
                  <TableHead className="text-muted-foreground">Validation</TableHead>
                  <TableHead className="text-muted-foreground">Actions</TableHead>
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
                  const showFlags = isSuspicious || suspiciousFlags.length > 0;
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

                  // Get data status for this session
                  const dataStatus = sessionDataStatuses.get(session.id);
                  const preExpected = dataStatus?.preTestExpected;
                  const postExpected = dataStatus?.postTestExpected;
                  const preAnswered = dataStatus?.preTestAnswered ?? 0;
                  const postAnswered = dataStatus?.postTestAnswered ?? 0;
                  const preStatusLabel = !dataStatus
                    ? 'Loading'
                    : preExpected === 0
                      ? 'Not required'
                      : dataStatus.hasPreTest
                        ? 'Yes'
                        : 'Missing';
                  const postStatusLabel = !dataStatus
                    ? 'Loading'
                    : postExpected === 0
                      ? 'Not required'
                      : dataStatus.hasPostTest
                        ? 'Yes'
                        : 'Missing';
                  const preCountLabel =
                    preExpected === 0
                      ? ''
                      : preExpected != null
                        ? `${preAnswered}/${preExpected}`
                        : preAnswered
                          ? `${preAnswered} answered`
                          : '';
                  const postCountLabel =
                    postExpected === 0
                      ? ''
                      : postExpected != null
                        ? `${postAnswered}/${postExpected}`
                        : postAnswered
                          ? `${postAnswered} answered`
                          : '';

                  return (
                    <TableRow
                      key={session.id}
                      className={`border-border hover:bg-muted/50 ${isReset ? 'opacity-40' : isCompleted ? '' : 'opacity-50'} ${selectedSessionIds.has(session.id) ? 'bg-muted/30' : ''}`}
                    >
                      <TableCell>
                        {canManageValidation ? (
                          <Checkbox
                            checked={selectedSessionIds.has(session.id)}
                            onCheckedChange={() => toggleSessionSelection(session.id)}
                            className="border-border/70"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground/60">-</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-foreground/80 break-all">
                        {session.session_id}
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
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex gap-1">
                                {dataStatus ? (
                                  <>
                                    <span className={`text-xs ${dataStatus.hasDemographics ? 'text-green-500' : 'text-red-500'}`}>
                                      D{dataStatus.hasDemographics ? '✓' : '✗'}
                                    </span>
                                    <span className={`text-xs ${dataStatus.hasPreTest ? 'text-green-500' : 'text-red-500'}`}>
                                      P{dataStatus.hasPreTest ? '✓' : '✗'}
                                    </span>
                                    <span className={`text-xs ${dataStatus.hasPostTest ? 'text-green-500' : 'text-red-500'}`}>
                                      T{dataStatus.hasPostTest ? '✓' : '✗'}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-xs text-muted-foreground/70">...</span>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="bg-background border-border">
                              <div className="text-xs space-y-1">
                                <p className={dataStatus?.hasDemographics ? 'text-green-400' : 'text-red-400'}>
                                  Demographics: {dataStatus?.hasDemographics ? 'Yes' : 'Missing'}
                                </p>
                                <p className={dataStatus?.hasPreTest ? 'text-green-400' : 'text-red-400'}>
                                  Pre-test: {preStatusLabel}
                                  {preCountLabel ? ` (${preCountLabel})` : ''}
                                </p>
                                <p className={dataStatus?.hasPostTest ? 'text-green-400' : 'text-red-400'}>
                                  Post-test: {postStatusLabel}
                                  {postCountLabel ? ` (${postCountLabel})` : ''}
                                </p>
                                <p className={dataStatus?.hasDialogue ? 'text-green-400' : 'text-yellow-400'}>
                                  Dialogue: {dataStatus?.hasDialogue ? 'Yes' : 'None'}
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-foreground/80">
                        {format(new Date(session.started_at), 'dd MMM yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="text-foreground/80">
                        {session.completed_at 
                          ? format(new Date(session.completed_at), 'dd MMM yyyy HH:mm')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-foreground/80">
                        {duration ? `${duration} min` : '-'}
                      </TableCell>
                      <TableCell>
                        {statusBadge}
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <div className="flex flex-col gap-1">
                            {showFlags && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="destructive" className="text-xs cursor-help">
                                    ⚠️ {suspiciousFlags.length > 0 ? `Flags: ${suspiciousFlags.length}` : 'Flagged'}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-md bg-background border-border p-3">
                                  <p className="font-semibold mb-2 text-white">Flag Reasons</p>
                                  <div className="text-xs space-y-2 text-foreground/80">
                                    <ul className="space-y-1">
                                      {suspiciousFlags.length > 0 ? (
                                        suspiciousFlags.map((flag, i) => {
                                          const details = describeSuspicionFlag(String(flag));
                                          const label = String(details.flag).replace(/_/g, ' ');
                                          return (
                                            <li key={i}>
                                              <div>• {label}</div>
                                              {details.reason && (
                                                <div className="text-[11px] text-muted-foreground/70 ml-3">{details.reason}</div>
                                              )}
                                            </li>
                                          );
                                        })
                                      ) : (
                                        <li className="italic">No detailed flags recorded</li>
                                      )}
                                    </ul>
                                    <hr className="border-border my-2" />
                                    <p className="font-semibold text-white">Requirements to avoid flags:</p>
                                    <ul className="space-y-1 text-[11px]">
                                      {getSuspicionRequirements(activeSlides.length).map((req) => (
                                        <li key={req.id}>• {req.label}</li>
                                      ))}
                                    </ul>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {!showFlags && (
                              <span className="text-xs text-muted-foreground/70">-</span>
                            )}
                          </div>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        {isSuspicious || suspiciousFlags.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {validationStatus === 'pending' ? (
                              (permissions.canValidateSessionsDirectly || permissions.canRequestValidation) ? (
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
                              ) : (
                                <Badge variant="outline" className="text-xs text-muted-foreground/70 border-border">
                                  Pending
                                </Badge>
                              )
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
                          <span className="text-xs text-muted-foreground/70">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => fetchSessionDetails(session)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {isOwner && isReset && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-emerald-400 hover:text-emerald-300"
                                    onClick={() => restoreSession(session)}
                                    disabled={restoringSessionId === session.id}
                                  >
                                    <RefreshCw className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Restore session</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredSessions.length)} of {filteredSessions.length}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="border-border"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="border-border"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session Details Dialog */}
      <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-white break-all">
                Session Details: {selectedSession?.session_id}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {isOwner && selectedSession?.status === 'reset' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-emerald-500/60 text-emerald-300 hover:text-emerald-200"
                    onClick={() => restoreSession(selectedSession)}
                    disabled={restoringSessionId === selectedSession.id}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Restore
                  </Button>
                )}
                {isOwner && selectedSession && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-border"
                    onClick={openEditDialog}
                    disabled={!canEditSelectedSession}
                  >
                    <Database className="w-4 h-4 mr-2" />
                    Edit Data
                  </Button>
                )}
                {permissions.canExportData && selectedSession && sessionDetails && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-border"
                      onClick={() => exportSessionToPDF(selectedSession, sessionDetails)}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Export PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-border"
                      onClick={() => exportDialogueCSV(selectedSession, sessionDetails)}
                    >
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Dialogue CSV
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogHeader>
          
          {isDetailsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : sessionDetails ? (
            <div className="space-y-6">
              {/* Session Summary */}
              <div className="bg-background p-4 rounded">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <h3 className="text-lg font-semibold text-white">Session Summary</h3>
                  {hasLocalOverride && (
                    <Badge variant="outline" className="border-blue-400 text-blue-300">
                      Local override
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground block">Mode</span>
                    <span className="text-white">{selectedSession?.modes_used?.join(', ') || selectedSession?.mode}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Started</span>
                    <span className="text-white">{selectedSession?.started_at ? format(new Date(selectedSession.started_at), 'dd MMM yyyy HH:mm') : '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Completed</span>
                    <span className="text-white">{selectedSession?.completed_at ? format(new Date(selectedSession.completed_at), 'dd MMM yyyy HH:mm') : 'Not completed'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Duration</span>
                    <span className="text-white">
                      {selectedSession?.completed_at && selectedSession?.started_at
                        ? `${Math.round((new Date(selectedSession.completed_at).getTime() - new Date(selectedSession.started_at).getTime()) / 1000 / 60)} min`
                        : '-'}
                    </span>
                  </div>
                  {selectedFlags.length > 0 && (
                    <div>
                      <span className="text-muted-foreground block">Validation</span>
                      <span className="text-white capitalize">{selectedSession?.validation_status || 'pending'}</span>
                    </div>
                  )}
                </div>
              </div>

              {sessionDetails.postTest.length === 0 && (
                <div className="bg-amber-900/20 border border-amber-600/40 text-amber-200 p-3 rounded text-sm flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold">Post-test not recorded</div>
                    <div className="text-amber-200/80">
                      This session likely ended before the post-test. Tutor dialogue and timing may be partial or missing.
                    </div>
                  </div>
                </div>
              )}

              {selectedFlags.length > 0 && (
                <div className="bg-background p-4 rounded">
                  <h3 className="text-lg font-semibold text-white mb-3">Data Quality Flags</h3>
                  <div className="space-y-2 text-sm text-foreground/80">
                    {selectedFlags.map((flag, i) => {
                      const details = describeSuspicionFlag(String(flag));
                      const label = String(details.flag).replace(/_/g, ' ');
                      return (
                        <div key={i}>
                          <div>• {label}</div>
                          {details.reason && (
                            <div className="text-xs text-muted-foreground/70 ml-3">{details.reason}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 text-xs text-muted-foreground">
                    <div className="font-semibold text-foreground/80 mb-1">Requirements to avoid flags:</div>
                    <ul className="space-y-1">
                      {getSuspicionRequirements(activeSlides.length).map((req) => (
                        <li key={req.id}>• {req.label}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Demographics */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Demographics ({sessionDetails.demographicResponses.length > 0 ? sessionDetails.demographicResponses.length : (sessionDetails.demographics ? 3 : 0)} responses)
                </h3>
                {sessionDetails.demographicResponses.length > 0 ? (
                  <div className="bg-background p-4 rounded max-h-40 overflow-y-auto">
                    {sessionDetails.demographicResponses.map((r, i) => (
                      <div key={i} className="text-sm mb-2 pb-2 border-b border-border last:border-0">
                        <span className="text-muted-foreground">{r.question_id}:</span>
                        <span className="text-white ml-2">{r.answer}</span>
                      </div>
                    ))}
                  </div>
                ) : sessionDetails.demographics ? (
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="bg-background p-3 rounded">
                      <span className="text-muted-foreground">Age:</span>
                      <span className="text-white ml-2">{sessionDetails.demographics.age_range || '-'}</span>
                    </div>
                    <div className="bg-background p-3 rounded">
                      <span className="text-muted-foreground">Education:</span>
                      <span className="text-white ml-2">{sessionDetails.demographics.education || '-'}</span>
                    </div>
                    <div className="bg-background p-3 rounded">
                      <span className="text-muted-foreground">Experience:</span>
                      <span className="text-white ml-2">{sessionDetails.demographics.digital_experience || '-'}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground/70">No demographic data</p>
                )}
              </div>

              {/* Pre-test Responses */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Pre-test ({sessionDetails.preTest.length} responses)</h3>
                {sessionDetails.preTest.length > 0 ? (
                  <div className="bg-background p-4 rounded max-h-40 overflow-y-auto">
                    {sessionDetails.preTest.map((r, i) => (
                      <div key={i} className="text-sm mb-2 pb-2 border-b border-border last:border-0">
                        <span className="text-muted-foreground">{r.question_id}:</span>
                        <span className="text-white ml-2">{r.answer}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground/70">No responses</p>
                )}
              </div>

              {/* Post-test Responses */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Post-test ({sessionDetails.postTest.length} responses)</h3>
                {sessionDetails.postTest.length > 0 ? (
                  <div className="bg-background p-4 rounded max-h-40 overflow-y-auto">
                    {sessionDetails.postTest.map((r, i) => (
                      <div key={i} className="text-sm mb-2 pb-2 border-b border-border last:border-0">
                        <span className="text-muted-foreground">{r.question_id}:</span>
                        <span className="text-white ml-2">{r.answer}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground/70">No responses</p>
                )}
              </div>

              {/* Avatar Interaction Summary */}
              {(selectedSession?.mode === 'avatar' || sessionDetails.avatarTimeTracking.length > 0) && (
                (() => {
                  const slideEntries = sessionDetails.avatarTimeTracking.filter((entry) => !isPageId(entry.slide_id));
                  const totalAvatarSeconds = slideEntries.reduce(
                    (sum, entry) => sum + (entry.duration_seconds || 0),
                    0
                  );
                  const sessionSeconds = selectedSession?.started_at && selectedSession?.completed_at
                    ? Math.max(
                        0,
                        Math.round(
                          (new Date(selectedSession.completed_at).getTime() -
                            new Date(selectedSession.started_at).getTime()) / 1000
                        )
                      )
                    : null;
                  const displayAvatarSeconds = sessionSeconds !== null
                    ? Math.min(totalAvatarSeconds, sessionSeconds)
                    : totalAvatarSeconds;

                  return (
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">Avatar Interaction Summary</h3>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="bg-background p-3 rounded text-sm">
                          <span className="text-muted-foreground">Slide time:</span>
                          <span className="text-white ml-2">
                            {Math.round(displayAvatarSeconds / 60)} min
                          </span>
                        </div>
                        <div className="bg-background p-3 rounded text-sm">
                          <span className="text-muted-foreground">Slides tracked:</span>
                          <span className="text-white ml-2">{avatarGroupsForDetails.length}</span>
                        </div>
                        <div className="bg-background p-3 rounded text-sm">
                          <span className="text-muted-foreground">Tutor messages:</span>
                          <span className="text-white ml-2">
                            {sessionDetails.tutorDialogueTurns.filter((turn) => turn.role === 'user').length} user / {sessionDetails.tutorDialogueTurns.filter((turn) => turn.role === 'ai').length} AI
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}

              {avatarGroupsForDetails.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Slide Time Breakdown</h3>
                  <p className="text-xs text-muted-foreground/70 mb-2">
                    Segments appear when a participant returns to the same slide (back/forward or refresh). Times are summed.
                  </p>
                  <div className="bg-background p-4 rounded max-h-48 overflow-y-auto">
                    {avatarGroupsForDetails.map((group) => (
                      <div key={group.slideId} className="text-sm mb-2 pb-2 border-b border-border last:border-0">
                        <span className="text-muted-foreground">{group.title}:</span>
                        <span className="text-white ml-2">{Math.round(group.total)} sec</span>
                        {group.entryIds.length > 1 && (
                          <span className="text-xs text-muted-foreground/70 ml-2">
                            ({group.entryIds.length} segments)
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pageGroupsForDetails.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Page Time Breakdown</h3>
                  <div className="bg-background p-4 rounded max-h-48 overflow-y-auto">
                    {pageGroupsForDetails.map((group) => (
                      <div key={group.slideId} className="text-sm mb-2 pb-2 border-b border-border last:border-0">
                        <span className="text-muted-foreground">
                          {(group.title || group.slideId).replace(/^Page:\s*/i, '')}:
                        </span>
                        <span className="text-white ml-2">{Math.round(group.total)} sec</span>
                        {group.entryIds.length > 1 && (
                          <span className="text-xs text-muted-foreground/70 ml-2">
                            ({group.entryIds.length} segments)
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tutor Dialogue (Learning) */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Tutor Dialogue (Learning) ({sessionDetails.tutorDialogueTurns.length} messages)
                </h3>
                <p className="text-xs text-muted-foreground mb-2">
                  Mode: {selectedSession?.mode || 'unknown'}
                </p>
                {sessionDetails.tutorDialogueTurns.length > 0 ? (
                  <div className="bg-background p-4 rounded max-h-60 overflow-y-auto">
                    {sessionDetails.tutorDialogueTurns.map((turn, i) => (
                      <div key={i} className={`text-sm mb-2 p-2 rounded ${turn.role === 'user' ? 'bg-blue-900/30' : 'bg-card'}`}>
                        <span className={`font-semibold ${turn.role === 'user' ? 'text-blue-400' : 'text-green-400'}`}>
                          {turn.role === 'user' ? 'User' : 'Alex (AI)'}:
                        </span>
                        {turn.slide_title || turn.slide_id ? (
                          <span className="text-muted-foreground ml-2">
                            [{turn.slide_title || turn.slide_id}]
                          </span>
                        ) : null}
                        <span className="text-white ml-2">{turn.content}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground/70">No tutor dialogue recorded</p>
                )}
              </div>

              {/* Scenario Dialogue (legacy, only shown if present) */}
              {sessionDetails.dialogueTurns.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Scenario Dialogue (Legacy) ({sessionDetails.dialogueTurns.length} messages)
                  </h3>
                  <div className="bg-background p-4 rounded max-h-60 overflow-y-auto">
                    {sessionDetails.dialogueTurns.map((turn, i) => (
                      <div key={i} className={`text-sm mb-2 p-2 rounded ${turn.role === 'user' ? 'bg-blue-900/30' : 'bg-card'}`}>
                        <span className={`font-semibold ${turn.role === 'user' ? 'text-blue-400' : 'text-green-400'}`}>
                          {turn.role === 'user' ? 'User' : 'Alex (AI)'}:
                        </span>
                        <span className="text-white ml-2">{turn.content}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {isOwner && (
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto bg-background border-border">
            <DialogHeader>
              <DialogTitle className="text-white">Owner Session Editor</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Hidden owner-only editor. Changes apply immediately to reports and statistics.
              </DialogDescription>
              {hasLocalOverride && (
                <div className="text-xs text-blue-300">
                  Local override active on this device (not synced to Supabase).
                </div>
              )}
            </DialogHeader>

            {!editDraft ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-card/60 p-4 rounded space-y-4">
                  <h3 className="text-lg font-semibold text-white">Session Timing</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Started At (ISO)</label>
                      <Input
                        value={editDraft.session.started_at}
                        onChange={(e) =>
                          setEditDraft((prev) =>
                            prev ? { ...prev, session: { ...prev.session, started_at: e.target.value } } : prev
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Completed At (ISO or blank)</label>
                      <Input
                        value={editDraft.session.completed_at || ''}
                        onChange={(e) =>
                          setEditDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  session: { ...prev.session, completed_at: e.target.value || null },
                                }
                              : prev
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Last Activity (ISO or blank)</label>
                      <Input
                        value={editDraft.session.last_activity_at || ''}
                        onChange={(e) =>
                          setEditDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  session: { ...prev.session, last_activity_at: e.target.value || null },
                                }
                              : prev
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Status</label>
                      <Input
                        value={editDraft.session.status}
                        onChange={(e) =>
                          setEditDraft((prev) =>
                            prev ? { ...prev, session: { ...prev.session, status: e.target.value } } : prev
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Mode</label>
                      <Select
                        value={editDraft.session.mode}
                        onValueChange={(value) =>
                          setEditDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  session: { ...prev.session, mode: value as SessionEditDraft['session']['mode'] },
                                }
                              : prev
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="avatar">Avatar</SelectItem>
                          <SelectItem value="voice">Voice</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Modes Used (comma separated)</label>
                      <Input
                        value={editDraft.session.modes_used.join(', ')}
                        onChange={(e) =>
                          setEditDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  session: {
                                    ...prev.session,
                                    modes_used: e.target.value
                                      .split(',')
                                      .map((value) => value.trim())
                                      .filter(Boolean),
                                  },
                                }
                              : prev
                          )
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-white">Demographics</h3>
                  {editDraft.demographicResponses.length === 0 ? (
                    <p className="text-muted-foreground/70 text-sm">No demographic responses recorded.</p>
                  ) : (
                    <div className="space-y-3">
                      {editDraft.demographicResponses.map((response, index) => (
                        <div key={response.id} className="bg-card/60 p-3 rounded space-y-2">
                          <div className="text-xs text-muted-foreground">{response.question_id}</div>
                          <Textarea
                            value={response.answer}
                            onChange={(e) =>
                              setEditDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      demographicResponses: updateListItem(prev.demographicResponses, index, {
                                        answer: e.target.value,
                                      }),
                                    }
                                  : prev
                              )
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-white">Pre-test</h3>
                  {editDraft.preTest.length === 0 ? (
                    <p className="text-muted-foreground/70 text-sm">No pre-test responses recorded.</p>
                  ) : (
                    <div className="space-y-3">
                      {editDraft.preTest.map((response, index) => (
                        <div key={response.id} className="bg-card/60 p-3 rounded space-y-2">
                          <div className="text-xs text-muted-foreground">{response.question_id}</div>
                          <Textarea
                            value={response.answer}
                            onChange={(e) =>
                              setEditDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      preTest: updateListItem(prev.preTest, index, { answer: e.target.value }),
                                    }
                                  : prev
                              )
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-white">Post-test</h3>
                  {editDraft.postTest.length === 0 ? (
                    <p className="text-muted-foreground/70 text-sm">No post-test responses recorded.</p>
                  ) : (
                    <div className="space-y-3">
                      {editDraft.postTest.map((response, index) => (
                        <div key={response.id} className="bg-card/60 p-3 rounded space-y-2">
                          <div className="text-xs text-muted-foreground">{response.question_id}</div>
                          <Textarea
                            value={response.answer}
                            onChange={(e) =>
                              setEditDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      postTest: updateListItem(prev.postTest, index, { answer: e.target.value }),
                                    }
                                  : prev
                              )
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {isOwner && (
                  <div className="space-y-3 bg-card/60 p-4 rounded border border-border/60">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-white">Owner Validation Tools</h3>
                      <Badge variant="outline" className="border-amber-500 text-amber-300">
                        Owner only
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground/80">
                      Use only when you have the participant’s actual answers. Backfilled responses are marked as owner-provided.
                    </p>
                    <div className="flex flex-wrap gap-3 items-center">
                      <Button size="sm" variant="outline" className="border-border" onClick={openBackfillDialog}>
                        Backfill missing pre/post answers
                      </Button>
                      <span className="text-xs text-muted-foreground/70">
                        Missing pre-test: {missingBackfill.missingPre.length} • Missing post-test: {missingBackfill.missingPost.length}
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-white">Scenarios</h3>
                  {editDraft.scenarios.length === 0 ? (
                    <p className="text-muted-foreground/70 text-sm">No scenario responses recorded.</p>
                  ) : (
                    <div className="space-y-3">
                      {editDraft.scenarios.map((scenario, index) => (
                        <div key={scenario.id} className="bg-card/60 p-3 rounded space-y-3">
                          <div className="text-xs text-muted-foreground">{scenario.scenario_id}</div>
                          <div className="grid md:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <label className="text-xs text-muted-foreground">Trust Rating</label>
                              <Input
                                type="number"
                                value={scenario.trust_rating}
                                onChange={(e) =>
                                  setEditDraft((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          scenarios: updateListItem(prev.scenarios, index, {
                                            trust_rating: Number(e.target.value || 0),
                                          }),
                                        }
                                      : prev
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-muted-foreground">Confidence</label>
                              <Input
                                type="number"
                                value={scenario.confidence_rating}
                                onChange={(e) =>
                                  setEditDraft((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          scenarios: updateListItem(prev.scenarios, index, {
                                            confidence_rating: Number(e.target.value || 0),
                                          }),
                                        }
                                      : prev
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-muted-foreground">Engagement</label>
                              <div className="flex items-center gap-2 pt-2">
                                <Checkbox
                                  checked={scenario.engagement_rating}
                                  onCheckedChange={(checked) =>
                                    setEditDraft((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            scenarios: updateListItem(prev.scenarios, index, {
                                              engagement_rating: Boolean(checked),
                                            }),
                                          }
                                        : prev
                                    )
                                  }
                                />
                                <span className="text-sm text-foreground/80">
                                  {scenario.engagement_rating ? 'Engaged' : 'Not engaged'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Completed At (ISO)</label>
                            <Input
                              value={scenario.completed_at}
                              onChange={(e) =>
                                setEditDraft((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        scenarios: updateListItem(prev.scenarios, index, {
                                          completed_at: e.target.value,
                                        }),
                                      }
                                    : prev
                                )
                              }
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-white">Avatar Slide Time</h3>
                  <div className="bg-card/60 p-3 rounded flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="text-sm text-foreground/80">
                      <div>
                        Session duration:{' '}
                        <span className="text-white">
                          {sessionDurationSeconds !== null
                            ? `${Math.round(sessionDurationSeconds / 60)} min`
                            : '—'}
                        </span>
                      </div>
                      <div>
                        Avatar total:{' '}
                        <span className="text-white">
                          {Math.round(
                            editDraft.avatarTimeTracking
                              .filter((entry) => !isPageId(entry.slide_id))
                              .reduce((sum, entry) => sum + (entry.duration_seconds || 0), 0) / 60
                          )}{' '}
                          min
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Auto-distribution caps each slide at {MAX_AVATAR_SLIDE_SECONDS}s.
                      </div>
                    </div>
                    <div className="flex flex-col items-start gap-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Checkbox
                          checked={autoDistributeSlides}
                          onCheckedChange={(checked) => setAutoDistributeSlides(Boolean(checked))}
                        />
                        <span>Auto-distribute when time changes</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-border"
                        disabled={!sessionDurationSeconds}
                        onClick={() =>
                          setEditDraft((prev) => (prev ? distributeAvatarTime(prev) : prev))
                        }
                      >
                        Auto-distribute slide time
                      </Button>
                      {isOwner && (
                        <div className="pt-2 border-t border-border/50 w-full space-y-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Checkbox
                              checked={startBackfillAtZero}
                              onCheckedChange={(checked) => setStartBackfillAtZero(Boolean(checked))}
                            />
                            <span>Start backfill at 0s (manual fill)</span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-border"
                            disabled={!sessionDurationSeconds || isBackfillTiming}
                            onClick={backfillAvatarTiming}
                          >
                            {isBackfillTiming ? 'Backfilling…' : 'Backfill missing slide timing'}
                          </Button>
                          <p className="text-[11px] text-muted-foreground/70">
                            Creates owner-imputed timing rows for active slides without entries.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  {avatarGroupsForEdit.length === 0 ? (
                    <p className="text-muted-foreground/70 text-sm">No avatar slide timing recorded.</p>
                  ) : (
                    <div className="space-y-3">
                      {avatarGroupsForEdit.map((group) => (
                        <div key={group.slideId} className="bg-card/60 p-3 rounded space-y-2">
                          <div className="text-xs text-muted-foreground">
                            {group.title}
                            {group.entryIds.length > 1 && (
                              <span className="text-xs text-muted-foreground/70 ml-2">
                                ({group.entryIds.length} segments)
                              </span>
                            )}
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Total Duration (seconds)</label>
                            <Input
                              type="number"
                              value={Math.round(group.total)}
                              onChange={(e) =>
                                updateAvatarGroupDuration(group.entryIds, Number(e.target.value || 0))
                              }
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-white">Page Time</h3>
                  {pageGroupsForEdit.length === 0 ? (
                    <p className="text-muted-foreground/70 text-sm">No page timing recorded.</p>
                  ) : (
                    <div className="space-y-3">
                      {pageGroupsForEdit.map((group) => (
                        <div key={group.slideId} className="bg-card/60 p-3 rounded space-y-2">
                          <div className="text-xs text-muted-foreground">
                            {(group.title || group.slideId).replace(/^Page:\s*/i, '')}
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Total Duration (seconds)</label>
                            <Input
                              type="number"
                              value={Math.round(group.total)}
                              onChange={(e) =>
                                updatePageGroupDuration(group.entryIds, Number(e.target.value || 0))
                              }
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-white">Tutor Dialogue</h3>
                  {editDraft.tutorDialogueTurns.length === 0 ? (
                    <p className="text-muted-foreground/70 text-sm">No tutor dialogue recorded.</p>
                  ) : (
                    <div className="space-y-3">
                      {editDraft.tutorDialogueTurns.map((turn, index) => (
                        <div key={turn.id} className="bg-card/60 p-3 rounded space-y-2">
                          <div className="text-xs text-muted-foreground">
                            {turn.role.toUpperCase()}
                            {turn.slide_title ? ` · ${turn.slide_title}` : ''}
                          </div>
                          <Textarea
                            value={turn.content}
                            onChange={(e) =>
                              setEditDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      tutorDialogueTurns: updateListItem(prev.tutorDialogueTurns, index, {
                                        content: e.target.value,
                                      }),
                                    }
                                  : prev
                              )
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-white">Scenario Dialogue</h3>
                  {editDraft.dialogueTurns.length === 0 ? (
                    <p className="text-muted-foreground/70 text-sm">No scenario dialogue recorded.</p>
                  ) : (
                    <div className="space-y-3">
                      {editDraft.dialogueTurns.map((turn, index) => (
                        <div key={turn.id} className="bg-card/60 p-3 rounded space-y-2">
                          <div className="text-xs text-muted-foreground">
                            {turn.role.toUpperCase()}
                            {turn.scenario_name ? ` · ${turn.scenario_name}` : ''}
                          </div>
                          <Textarea
                            value={turn.content}
                            onChange={(e) =>
                              setEditDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      dialogueTurns: updateListItem(prev.dialogueTurns, index, {
                                        content: e.target.value,
                                      }),
                                    }
                                  : prev
                              )
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              {hasLocalOverride && (
                <Button
                  variant="ghost"
                  className="text-blue-300 hover:text-blue-200"
                  onClick={clearLocalOverride}
                >
                  Reset local override
                </Button>
              )}
              <Button variant="outline" className="border-border" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveOwnerEdits} disabled={isSavingEdit}>
                {isSavingEdit ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {isOwner && (
        <Dialog open={isBackfillOpen} onOpenChange={setIsBackfillOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-background border-border">
            <DialogHeader>
              <DialogTitle className="text-white">Backfill Missing Responses</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Owner-only backfill. Use only when you have the participant’s actual answers.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {backfillPreTest.length === 0 && backfillPostTest.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  No missing pre-test or post-test questions detected for this session.
                </div>
              )}

              {backfillPreTest.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-white">
                    Pre-test (missing {backfillPreTest.length})
                  </h3>
                  <div className="space-y-3">
                    {backfillPreTest.map((entry, index) => (
                      <div key={entry.question_id} className="bg-card/60 p-3 rounded space-y-2">
                        <div className="text-xs text-muted-foreground">{entry.question_id}</div>
                        <div className="text-sm text-foreground/80">{entry.question_text}</div>
                        <Textarea
                          value={entry.answer}
                          onChange={(e) =>
                            setBackfillPreTest((prev) =>
                              prev.map((row, rowIndex) =>
                                rowIndex === index ? { ...row, answer: e.target.value } : row
                              )
                            )
                          }
                          placeholder="Enter participant answer"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {backfillPostTest.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-white">
                    Post-test (missing {backfillPostTest.length})
                  </h3>
                  <div className="space-y-3">
                    {backfillPostTest.map((entry, index) => (
                      <div key={entry.question_id} className="bg-card/60 p-3 rounded space-y-2">
                        <div className="text-xs text-muted-foreground">{entry.question_id}</div>
                        <div className="text-sm text-foreground/80">{entry.question_text}</div>
                        <Textarea
                          value={entry.answer}
                          onChange={(e) =>
                            setBackfillPostTest((prev) =>
                              prev.map((row, rowIndex) =>
                                rowIndex === index ? { ...row, answer: e.target.value } : row
                              )
                            )
                          }
                          placeholder="Enter participant answer"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsBackfillOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submitBackfillResponses} disabled={isBackfillSaving}>
                {isBackfillSaving ? 'Saving…' : 'Save responses'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default AdminSessions;
