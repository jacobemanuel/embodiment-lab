import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Search, ChevronLeft, ChevronRight, Eye, RefreshCw, CheckCircle, XCircle, AlertTriangle, Info, Clock, CheckSquare, Square, FileText, Trash2, EyeOff, Database } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import jsPDF from "jspdf";
import { format, startOfDay, endOfDay } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import DateRangeFilter from "./DateRangeFilter";
import { getPermissionLevel, getPermissions } from "@/lib/permissions";
import { describeSuspicionFlag, SUSPICION_REQUIREMENTS } from "@/lib/suspicion";
import { toast } from "sonner";

interface AdminSessionsProps {
  userEmail?: string;
}

const OWNER_EDIT_MIN_DATE = new Date("2025-12-24T00:00:00Z");

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
}

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
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<SessionEditDraft | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
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
      
      // Fetch data completeness for all sessions
      if (data && data.length > 0) {
        await fetchDataStatuses(data.map(s => s.id));
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [startDate, endDate]);

  // Fetch data completeness for sessions
  const fetchDataStatuses = async (sessionIds: string[]) => {
    try {
      // Fetch counts for each data type
      const [demoRes, preRes, postRes, scenarioRes, tutorRes] = await Promise.all([
        supabase.from('demographic_responses').select('session_id').in('session_id', sessionIds),
        supabase.from('pre_test_responses').select('session_id').in('session_id', sessionIds),
        supabase.from('post_test_responses').select('session_id').in('session_id', sessionIds),
        supabase.from('scenarios').select('session_id').in('session_id', sessionIds),
        supabase.from('tutor_dialogue_turns').select('session_id').in('session_id', sessionIds),
      ]);

      const demoSessions = new Set((demoRes.data || []).map(d => d.session_id));
      const preSessions = new Set((preRes.data || []).map(d => d.session_id));
      const postSessions = new Set((postRes.data || []).map(d => d.session_id));
      const scenarioSessions = new Set((scenarioRes.data || []).map(d => d.session_id));
      const tutorSessions = new Set((tutorRes.data || []).map(d => d.session_id));

      const statusMap = new Map<string, SessionDataStatus>();
      sessionIds.forEach(id => {
        const hasDemographics = demoSessions.has(id);
        const hasPreTest = preSessions.has(id);
        const hasPostTest = postSessions.has(id);
        const hasDialogue = scenarioSessions.has(id) || tutorSessions.has(id);
        statusMap.set(id, {
          hasDemographics,
          hasPreTest,
          hasPostTest,
          hasDialogue,
          isComplete: hasDemographics && hasPreTest && hasPostTest,
        });
      });
      setSessionDataStatuses(statusMap);
    } catch (error) {
      console.error('Error fetching data statuses:', error);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

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

      const { data: tutorDialogueTurns } = await supabase
        .from('tutor_dialogue_turns')
        .select('*')
        .eq('session_id', session.id)
        .order('timestamp', { ascending: true });

      const { data: avatarTimeTracking } = await supabase
        .from('avatar_time_tracking')
        .select('*')
        .eq('session_id', session.id)
        .order('started_at', { ascending: true });

      setSessionDetails({
        demographics: oldDemographics,
        demographicResponses: demographicResponses || [],
        preTest: preTest || [],
        postTest: postTest || [],
        scenarios: scenarios || [],
        dialogueTurns,
        tutorDialogueTurns: tutorDialogueTurns || [],
        avatarTimeTracking: avatarTimeTracking || [],
      });
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
      avatarTimeTracking: (details.avatarTimeTracking || []).map((t) => ({
        id: t.id,
        slide_id: t.slide_id,
        slide_title: t.slide_title,
        duration_seconds: t.duration_seconds ?? null,
      })),
      tutorDialogueTurns: (details.tutorDialogueTurns || []).map((t) => ({
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

  const openEditDialog = () => {
    if (!selectedSession || !sessionDetails) return;
    if (new Date(selectedSession.created_at) < OWNER_EDIT_MIN_DATE) {
      toast.error('Editing is only enabled for sessions from 24 Dec 2025');
      return;
    }
    setEditDraft(buildEditDraft(selectedSession, sessionDetails));
    setIsEditOpen(true);
  };

  const saveOwnerEdits = async () => {
    if (!selectedSession || !editDraft) return;

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
      toast.error('Failed to update session data');
    } finally {
      setIsSavingEdit(false);
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

  const exportToCSV = () => {
    const headers = ['Session ID', 'Mode', 'Started', 'Completed', 'Duration (min)', 'Status', 'Flags'];
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
        addText(`${questionTextMap[r.question_id] || r.question_id}: ${r.answer}`);
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
        addText(`${questionTextMap[r.question_id] || r.question_id}: ${r.answer}`);
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
        addText(`${questionTextMap[r.question_id] || r.question_id}: ${r.answer}`);
      });
    } else {
      addText('No responses');
    }
    y += 5;

    // Avatar interaction summary
    const avatarEntries = details.avatarTimeTracking || [];
    const avatarSeconds = avatarEntries.reduce((sum, entry) => sum + (entry.duration_seconds || 0), 0);
    if (session.mode === 'avatar' || avatarEntries.length > 0) {
      addText('AVATAR INTERACTION SUMMARY', 12, true);
      y += 2;
      addText(`Total slide time: ${Math.round(avatarSeconds / 60)} minutes (${avatarSeconds}s)`);
      addText(`Slides tracked: ${avatarEntries.length}`);
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
    SUSPICION_REQUIREMENTS.forEach((req) => {
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
        const role = turn.role === 'user' ? 'User' : 'AI';
        addText(`[${role}]: ${turn.content}`);
      });
    } else {
      addText('No tutor dialogue');
    }

    y += 5;

    // Scenario dialogue
    addText('SCENARIO DIALOGUE', 12, true);
    y += 2;
    if (details.dialogueTurns.length > 0) {
      let currentScenario: string | null = null;
      details.dialogueTurns.forEach((turn) => {
        const scenarioLabel = turn.scenario_name ? String(turn.scenario_name).replace(/_/g, ' ') : '';
        if (scenarioLabel && scenarioLabel !== currentScenario) {
          currentScenario = scenarioLabel;
          addText(`Scenario: ${currentScenario}`, 11, true);
        }
        const role = turn.role === 'user' ? 'User' : 'AI';
        addText(`[${role}]: ${turn.content}`);
      });
    } else {
      addText('No dialogues');
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
            <Select value={validationFilter} onValueChange={setValidationFilter}>
              <SelectTrigger className="w-[180px] bg-slate-900 border-slate-600">
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
              <SelectTrigger className="w-[180px] bg-slate-900 border-slate-600">
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
            <div className="flex items-center gap-4 p-3 bg-slate-900/50 border border-slate-700 rounded-lg">
              <span className="text-sm text-slate-300">
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
                  className="text-slate-400"
                  onClick={() => setSelectedSessionIds(new Set())}
                >
                  Clear
                </Button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="rounded-md border border-slate-700">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 hover:bg-slate-700/50">
                  <TableHead className="text-slate-400 w-10">
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
                                <Square className="w-4 h-4 text-slate-500" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Select all sessions on this page</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </TableHead>
                  <TableHead className="text-slate-400">Session ID</TableHead>
                  <TableHead className="text-slate-400">Mode</TableHead>
                  <TableHead className="text-slate-400">Data</TableHead>
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

                  return (
                    <TableRow
                      key={session.id}
                      className={`border-slate-700 hover:bg-slate-700/50 ${isReset ? 'opacity-40' : isCompleted ? '' : 'opacity-50'} ${selectedSessionIds.has(session.id) ? 'bg-slate-700/30' : ''}`}
                    >
                      <TableCell>
                        {canManageValidation ? (
                          <Checkbox
                            checked={selectedSessionIds.has(session.id)}
                            onCheckedChange={() => toggleSessionSelection(session.id)}
                            className="border-slate-500"
                          />
                        ) : (
                          <span className="text-xs text-slate-600">-</span>
                        )}
                      </TableCell>
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
                                  <span className="text-xs text-slate-500">...</span>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 border-slate-700">
                              <div className="text-xs space-y-1">
                                <p className={dataStatus?.hasDemographics ? 'text-green-400' : 'text-red-400'}>
                                  Demographics: {dataStatus?.hasDemographics ? 'Yes' : 'Missing'}
                                </p>
                                <p className={dataStatus?.hasPreTest ? 'text-green-400' : 'text-red-400'}>
                                  Pre-test: {dataStatus?.hasPreTest ? 'Yes' : 'Missing'}
                                </p>
                                <p className={dataStatus?.hasPostTest ? 'text-green-400' : 'text-red-400'}>
                                  Post-test: {dataStatus?.hasPostTest ? 'Yes' : 'Missing'}
                                </p>
                                <p className={dataStatus?.hasDialogue ? 'text-green-400' : 'text-yellow-400'}>
                                  Dialogue: {dataStatus?.hasDialogue ? 'Yes' : 'None'}
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
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
                            {showFlags && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="destructive" className="text-xs cursor-help">
                                    ⚠️ {suspiciousFlags.length > 0 ? `Flags: ${suspiciousFlags.length}` : 'Flagged'}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-md bg-slate-900 border-slate-700 p-3">
                                  <p className="font-semibold mb-2 text-white">Flag Reasons</p>
                                  <div className="text-xs space-y-2 text-slate-300">
                                    <ul className="space-y-1">
                                      {suspiciousFlags.length > 0 ? (
                                        suspiciousFlags.map((flag, i) => {
                                          const details = describeSuspicionFlag(String(flag));
                                          const label = String(details.flag).replace(/_/g, ' ');
                                          return (
                                            <li key={i}>
                                              <div>• {label}</div>
                                              {details.reason && (
                                                <div className="text-[11px] text-slate-500 ml-3">{details.reason}</div>
                                              )}
                                            </li>
                                          );
                                        })
                                      ) : (
                                        <li className="italic">No detailed flags recorded</li>
                                      )}
                                    </ul>
                                    <hr className="border-slate-700 my-2" />
                                    <p className="font-semibold text-white">Requirements to avoid flags:</p>
                                    <ul className="space-y-1 text-[11px]">
                                      {SUSPICION_REQUIREMENTS.map((req) => (
                                        <li key={req.id}>• {req.label}</li>
                                      ))}
                                    </ul>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {!showFlags && (
                              <span className="text-xs text-slate-500">-</span>
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
                                <Badge variant="outline" className="text-xs text-slate-500 border-slate-600">
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
            <div className="flex items-center justify-between">
              <DialogTitle className="text-white">
                Session Details: {selectedSession?.session_id.slice(0, 12)}...
              </DialogTitle>
              <div className="flex items-center gap-2">
                {isOwner && selectedSession && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-600"
                    onClick={openEditDialog}
                    disabled={!canEditSelectedSession}
                  >
                    <Database className="w-4 h-4 mr-2" />
                    Edit Data
                  </Button>
                )}
                {permissions.canExportData && selectedSession && sessionDetails && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-600"
                    onClick={() => exportSessionToPDF(selectedSession, sessionDetails)}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Export PDF
                  </Button>
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
              <div className="bg-slate-900 p-4 rounded">
                <h3 className="text-lg font-semibold text-white mb-3">Session Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400 block">Mode</span>
                    <span className="text-white">{selectedSession?.modes_used?.join(', ') || selectedSession?.mode}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Started</span>
                    <span className="text-white">{selectedSession?.started_at ? format(new Date(selectedSession.started_at), 'dd MMM yyyy HH:mm') : '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Completed</span>
                    <span className="text-white">{selectedSession?.completed_at ? format(new Date(selectedSession.completed_at), 'dd MMM yyyy HH:mm') : 'Not completed'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Duration</span>
                    <span className="text-white">
                      {selectedSession?.completed_at && selectedSession?.started_at
                        ? `${Math.round((new Date(selectedSession.completed_at).getTime() - new Date(selectedSession.started_at).getTime()) / 1000 / 60)} min`
                        : '-'}
                    </span>
                  </div>
                  {selectedFlags.length > 0 && (
                    <div>
                      <span className="text-slate-400 block">Validation</span>
                      <span className="text-white capitalize">{selectedSession?.validation_status || 'pending'}</span>
                    </div>
                  )}
                </div>
              </div>

              {selectedFlags.length > 0 && (
                <div className="bg-slate-900 p-4 rounded">
                  <h3 className="text-lg font-semibold text-white mb-3">Data Quality Flags</h3>
                  <div className="space-y-2 text-sm text-slate-300">
                    {selectedFlags.map((flag, i) => {
                      const details = describeSuspicionFlag(String(flag));
                      const label = String(details.flag).replace(/_/g, ' ');
                      return (
                        <div key={i}>
                          <div>• {label}</div>
                          {details.reason && (
                            <div className="text-xs text-slate-500 ml-3">{details.reason}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 text-xs text-slate-400">
                    <div className="font-semibold text-slate-300 mb-1">Requirements to avoid flags:</div>
                    <ul className="space-y-1">
                      {SUSPICION_REQUIREMENTS.map((req) => (
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

              {/* Avatar Interaction Summary */}
              {(selectedSession?.mode === 'avatar' || sessionDetails.avatarTimeTracking.length > 0) && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Avatar Interaction Summary</h3>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="bg-slate-900 p-3 rounded text-sm">
                      <span className="text-slate-400">Slide time:</span>
                      <span className="text-white ml-2">
                        {Math.round(sessionDetails.avatarTimeTracking.reduce((sum, entry) => sum + (entry.duration_seconds || 0), 0) / 60)} min
                      </span>
                    </div>
                    <div className="bg-slate-900 p-3 rounded text-sm">
                      <span className="text-slate-400">Slides tracked:</span>
                      <span className="text-white ml-2">{sessionDetails.avatarTimeTracking.length}</span>
                    </div>
                    <div className="bg-slate-900 p-3 rounded text-sm">
                      <span className="text-slate-400">Tutor messages:</span>
                      <span className="text-white ml-2">
                        {sessionDetails.tutorDialogueTurns.filter((turn) => turn.role === 'user').length} user / {sessionDetails.tutorDialogueTurns.filter((turn) => turn.role === 'ai').length} AI
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tutor Dialogue (Learning) */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Tutor Dialogue (Learning) ({sessionDetails.tutorDialogueTurns.length} messages)</h3>
                {sessionDetails.tutorDialogueTurns.length > 0 ? (
                  <div className="bg-slate-900 p-4 rounded max-h-60 overflow-y-auto">
                    {sessionDetails.tutorDialogueTurns.map((turn, i) => (
                      <div key={i} className={`text-sm mb-2 p-2 rounded ${turn.role === 'user' ? 'bg-blue-900/30' : 'bg-slate-800'}`}>
                        <span className={`font-semibold ${turn.role === 'user' ? 'text-blue-400' : 'text-green-400'}`}>
                          {turn.role === 'user' ? 'User' : 'AI'}:
                        </span>
                        {turn.slide_title || turn.slide_id ? (
                          <span className="text-slate-400 ml-2">
                            [{turn.slide_title || turn.slide_id}]
                          </span>
                        ) : null}
                        <span className="text-white ml-2">{turn.content}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500">No tutor dialogue recorded</p>
                )}
              </div>

              {/* Scenario Dialogue */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Scenario Dialogue ({sessionDetails.dialogueTurns.length} messages)</h3>
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
                  <p className="text-slate-500">No scenario dialogue recorded</p>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {isOwner && (
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto bg-slate-900 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">Owner Session Editor</DialogTitle>
              <DialogDescription className="text-slate-400">
                Hidden owner-only editor. Changes apply immediately to reports and statistics.
              </DialogDescription>
            </DialogHeader>

            {!editDraft ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-slate-800/60 p-4 rounded space-y-4">
                  <h3 className="text-lg font-semibold text-white">Session Timing</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400">Started At (ISO)</label>
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
                      <label className="text-xs text-slate-400">Completed At (ISO or blank)</label>
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
                      <label className="text-xs text-slate-400">Last Activity (ISO or blank)</label>
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
                      <label className="text-xs text-slate-400">Status</label>
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
                      <label className="text-xs text-slate-400">Mode</label>
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
                      <label className="text-xs text-slate-400">Modes Used (comma separated)</label>
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
                    <p className="text-slate-500 text-sm">No demographic responses recorded.</p>
                  ) : (
                    <div className="space-y-3">
                      {editDraft.demographicResponses.map((response, index) => (
                        <div key={response.id} className="bg-slate-800/60 p-3 rounded space-y-2">
                          <div className="text-xs text-slate-400">{response.question_id}</div>
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
                    <p className="text-slate-500 text-sm">No pre-test responses recorded.</p>
                  ) : (
                    <div className="space-y-3">
                      {editDraft.preTest.map((response, index) => (
                        <div key={response.id} className="bg-slate-800/60 p-3 rounded space-y-2">
                          <div className="text-xs text-slate-400">{response.question_id}</div>
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
                    <p className="text-slate-500 text-sm">No post-test responses recorded.</p>
                  ) : (
                    <div className="space-y-3">
                      {editDraft.postTest.map((response, index) => (
                        <div key={response.id} className="bg-slate-800/60 p-3 rounded space-y-2">
                          <div className="text-xs text-slate-400">{response.question_id}</div>
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

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-white">Scenarios</h3>
                  {editDraft.scenarios.length === 0 ? (
                    <p className="text-slate-500 text-sm">No scenario responses recorded.</p>
                  ) : (
                    <div className="space-y-3">
                      {editDraft.scenarios.map((scenario, index) => (
                        <div key={scenario.id} className="bg-slate-800/60 p-3 rounded space-y-3">
                          <div className="text-xs text-slate-400">{scenario.scenario_id}</div>
                          <div className="grid md:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <label className="text-xs text-slate-400">Trust Rating</label>
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
                              <label className="text-xs text-slate-400">Confidence</label>
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
                              <label className="text-xs text-slate-400">Engagement</label>
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
                                <span className="text-sm text-slate-300">
                                  {scenario.engagement_rating ? 'Engaged' : 'Not engaged'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-slate-400">Completed At (ISO)</label>
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
                  {editDraft.avatarTimeTracking.length === 0 ? (
                    <p className="text-slate-500 text-sm">No avatar slide timing recorded.</p>
                  ) : (
                    <div className="space-y-3">
                      {editDraft.avatarTimeTracking.map((entry, index) => (
                        <div key={entry.id} className="bg-slate-800/60 p-3 rounded space-y-2">
                          <div className="text-xs text-slate-400">{entry.slide_title}</div>
                          <div className="space-y-1">
                            <label className="text-xs text-slate-400">Duration (seconds)</label>
                            <Input
                              type="number"
                              value={entry.duration_seconds ?? ''}
                              onChange={(e) =>
                                setEditDraft((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        avatarTimeTracking: updateListItem(prev.avatarTimeTracking, index, {
                                          duration_seconds: e.target.value ? Number(e.target.value) : null,
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
                  <h3 className="text-lg font-semibold text-white">Tutor Dialogue</h3>
                  {editDraft.tutorDialogueTurns.length === 0 ? (
                    <p className="text-slate-500 text-sm">No tutor dialogue recorded.</p>
                  ) : (
                    <div className="space-y-3">
                      {editDraft.tutorDialogueTurns.map((turn, index) => (
                        <div key={turn.id} className="bg-slate-800/60 p-3 rounded space-y-2">
                          <div className="text-xs text-slate-400">
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
                    <p className="text-slate-500 text-sm">No scenario dialogue recorded.</p>
                  ) : (
                    <div className="space-y-3">
                      {editDraft.dialogueTurns.map((turn, index) => (
                        <div key={turn.id} className="bg-slate-800/60 p-3 rounded space-y-2">
                          <div className="text-xs text-slate-400">
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
              <Button variant="outline" className="border-slate-600" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveOwnerEdits} disabled={isSavingEdit}>
                {isSavingEdit ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default AdminSessions;
