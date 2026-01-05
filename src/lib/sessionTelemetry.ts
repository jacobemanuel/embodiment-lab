import { supabase } from "@/integrations/supabase/client";
import { StudyMode } from "@/types/study";
import { getTutorDialogueLog } from "@/lib/tutorDialogue";
import { enqueueEdgeCall } from "@/lib/edgeQueue";

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

type SaveTelemetryOptions = {
  final?: boolean;
  throttleMs?: number;
};

const MAX_EDGE_RESPONSES = 200;
const CHUNK_LIMIT = 1800;

const chunkPayload = (baseId: string, payload: string) => {
  if (payload.length <= CHUNK_LIMIT) {
    return [{ questionId: baseId, answer: payload }];
  }
  const batchId = Date.now().toString(36);
  const chunks: Array<{ questionId: string; answer: string }> = [];
  for (let i = 0; i < payload.length; i += CHUNK_LIMIT) {
    const partIndex = Math.floor(i / CHUNK_LIMIT) + 1;
    chunks.push({
      questionId: `${baseId}__batch_${batchId}__part_${partIndex}`,
      answer: payload.slice(i, i + CHUNK_LIMIT),
    });
  }
  return chunks;
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

  const timingEntries = getTimingLog();
  const dialogueEntries = getTutorDialogueLog();
  const capturedAt = new Date().toISOString();

  const inserts: Array<{ questionId: string; answer: string }> = [];

  if (timingEntries.length > 0) {
    const payload = JSON.stringify({
      version: 1,
      capturedAt,
      mode,
      entries: timingEntries,
    });
    inserts.push(...chunkPayload(META_TIMING_ID, payload));
  }

  if (dialogueEntries.length > 0) {
    const payload = JSON.stringify({
      version: 1,
      capturedAt,
      mode,
      messages: dialogueEntries,
    });
    inserts.push(...chunkPayload(META_DIALOGUE_ID, payload));
  }

  if (inserts.length === 0) return;

  const batches: Array<typeof inserts> = [];
  for (let i = 0; i < inserts.length; i += MAX_EDGE_RESPONSES) {
    batches.push(inserts.slice(i, i + MAX_EDGE_RESPONSES));
  }

  try {
    for (const batch of batches) {
      const { data, error } = await supabase.functions.invoke('save-study-data', {
        body: {
          action: 'save_post_test',
          sessionId,
          postTestResponses: batch,
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    }
  } catch (error) {
    console.error('Failed to store telemetry via edge function:', error);
    batches.forEach((batch) => {
      enqueueEdgeCall('save-study-data', {
        action: 'save_post_test',
        sessionId,
        postTestResponses: batch,
      });
    });
  }

  sessionStorage.setItem(TELEMETRY_LAST_SAVED_AT, Date.now().toString());
  if (final) {
    sessionStorage.setItem(TELEMETRY_SAVED_KEY, 'true');
  }
};
