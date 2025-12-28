import { supabase } from "@/integrations/supabase/client";
import { StudyMode } from "@/types/study";
import { getTutorDialogueLog } from "@/lib/tutorDialogue";

const TIMING_KEY = 'sessionTimingLog';
const TELEMETRY_SAVED_KEY = 'sessionTelemetrySaved';
const TELEMETRY_LAST_SAVED_AT = 'sessionTelemetryLastSavedAt';
const MAX_TIMING_ENTRIES = 600;

export const META_TIMING_ID = '__meta_timing_v1';
export const META_DIALOGUE_ID = '__meta_dialogue_v1';

export type TimingEntry = {
  kind: 'slide' | 'page';
  slideId: string;
  slideTitle: string;
  durationSeconds: number;
  mode: 'avatar' | 'text' | 'page';
  startedAt?: string;
  endedAt?: string;
};

const readTimingLog = (): TimingEntry[] => {
  try {
    const raw = sessionStorage.getItem(TIMING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const appendTimingEntry = (entry: TimingEntry) => {
  if (!entry?.slideId || !entry.slideTitle) return;
  if (Number.isNaN(entry.durationSeconds) || entry.durationSeconds <= 0) return;
  const existing = readTimingLog();
  const next = [...existing, entry].slice(-MAX_TIMING_ENTRIES);
  sessionStorage.setItem(TIMING_KEY, JSON.stringify(next));
};

export const getTimingLog = (): TimingEntry[] => readTimingLog();

export const clearTimingLog = () => {
  sessionStorage.removeItem(TIMING_KEY);
};

export const clearTelemetrySavedFlag = () => {
  sessionStorage.removeItem(TELEMETRY_SAVED_KEY);
  sessionStorage.removeItem(TELEMETRY_LAST_SAVED_AT);
};

export const isTelemetryMetaQuestionId = (questionId?: string | null) =>
  typeof questionId === 'string' && questionId.startsWith('__meta_');

const fetchSessionUuid = async (sessionId: string) => {
  if (!sessionId) return null;
  const { data, error } = await supabase
    .from('study_sessions')
    .select('id')
    .eq('session_id', sessionId)
    .maybeSingle();
  if (error) {
    console.error('Failed to load session UUID for telemetry:', error);
    return null;
  }
  return data?.id || null;
};

type SaveTelemetryOptions = {
  final?: boolean;
  throttleMs?: number;
};

export const saveTelemetryMeta = async (
  sessionId: string,
  mode: StudyMode | 'unknown',
  options: SaveTelemetryOptions = {}
) => {
  if (!sessionId) return;
  if (sessionStorage.getItem('studyExitRequested') === 'true') return;
  if (sessionStorage.getItem(TELEMETRY_SAVED_KEY) === 'true') return;

  const final = options.final ?? true;
  const throttleMs = options.throttleMs ?? 15000;
  const lastSavedRaw = sessionStorage.getItem(TELEMETRY_LAST_SAVED_AT);
  const lastSavedAt = lastSavedRaw ? Number(lastSavedRaw) : 0;
  if (!final && Date.now() - lastSavedAt < throttleMs) return;

  const sessionUuid = await fetchSessionUuid(sessionId);
  if (!sessionUuid) return;

  const timingEntries = getTimingLog();
  const dialogueEntries = getTutorDialogueLog();
  const capturedAt = new Date().toISOString();

  const inserts: Array<{ session_id: string; question_id: string; answer: string }> = [];

  if (timingEntries.length > 0) {
    inserts.push({
      session_id: sessionUuid,
      question_id: META_TIMING_ID,
      answer: JSON.stringify({
        version: 1,
        capturedAt,
        mode,
        entries: timingEntries,
      }),
    });
  }

  if (dialogueEntries.length > 0) {
    inserts.push({
      session_id: sessionUuid,
      question_id: META_DIALOGUE_ID,
      answer: JSON.stringify({
        version: 1,
        capturedAt,
        mode,
        messages: dialogueEntries,
      }),
    });
  }

  if (inserts.length === 0) return;

  const { error } = await supabase
    .from('post_test_responses')
    .insert(inserts);

  if (error) {
    console.error('Failed to store telemetry fallback:', error);
    return;
  }

  sessionStorage.setItem(TELEMETRY_LAST_SAVED_AT, Date.now().toString());
  if (final) {
    sessionStorage.setItem(TELEMETRY_SAVED_KEY, 'true');
  }
};
