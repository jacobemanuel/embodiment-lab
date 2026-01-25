import { supabase } from "@/integrations/supabase/client";
import { StudyMode } from "@/types/study";
import { getTimingLog, META_DIALOGUE_ID, META_TIMING_ID } from "@/lib/sessionTelemetry";
import { getTutorDialogueLog } from "@/lib/tutorDialogue";
import { enqueueEdgeCall } from "@/lib/edgeQueue";

const resolveSessionUuid = async (sessionId: string) => {
  const { data, error } = await supabase
    .from('study_sessions')
    .select('id')
    .eq('session_id', sessionId)
    .maybeSingle();
  if (error) throw error;
  return data?.id || null;
};

const fallbackCreateSession = async (mode: StudyMode) => {
  const sessionId = crypto.randomUUID();
  const { error } = await supabase
    .from('study_sessions')
    .insert({
      session_id: sessionId,
      mode,
      status: 'active',
      last_activity_at: new Date().toISOString(),
    });
  if (error) throw error;
  return sessionId;
};

const fallbackUpdateMode = async (sessionId: string, mode: StudyMode) => {
  const { error } = await supabase
    .from('study_sessions')
    .update({
      mode,
      last_activity_at: new Date().toISOString(),
    })
    .eq('session_id', sessionId);
  if (error) throw error;
};

const fallbackSaveDemographics = async (sessionId: string, demographics: Record<string, string>) => {
  const sessionUuid = await resolveSessionUuid(sessionId);
  if (!sessionUuid) throw new Error('Session not found');

  const demographicData = Object.entries(demographics).map(([questionId, answer]) => ({
    session_id: sessionUuid,
    question_id: questionId,
    answer: String(answer),
  }));

  const { error } = await supabase
    .from('demographic_responses')
    .insert(demographicData);

  if (!error) return;

  const preTestFallback = demographicData.map((row) => ({
    session_id: row.session_id,
    question_id: row.question_id.startsWith('demo-') ? row.question_id : `demo-${row.question_id}`,
    answer: row.answer,
  }));

  const { error: preError } = await supabase
    .from('pre_test_responses')
    .insert(preTestFallback);
  if (preError) throw preError;
};

const fallbackSavePreTest = async (sessionId: string, responses: Record<string, string>) => {
  const sessionUuid = await resolveSessionUuid(sessionId);
  if (!sessionUuid) throw new Error('Session not found');

  const preTestData = Object.entries(responses).map(([questionId, answer]) => ({
    session_id: sessionUuid,
    question_id: questionId,
    answer: String(answer),
  }));

  const { error } = await supabase
    .from('pre_test_responses')
    .insert(preTestData);
  if (error) throw error;
};

const fallbackSavePostTest = async (sessionId: string, responses: Record<string, string>) => {
  const sessionUuid = await resolveSessionUuid(sessionId);
  if (!sessionUuid) throw new Error('Session not found');

  const postTestData = Object.entries(responses).map(([questionId, answer]) => ({
    session_id: sessionUuid,
    question_id: questionId,
    answer: String(answer),
  }));

  const { error } = await supabase
    .from('post_test_responses')
    .insert(postTestData);
  if (error) throw error;
};

const fallbackSaveScenario = async (
  sessionId: string,
  scenarioId: string,
  messages: Array<{ role: string; content: string; timestamp: number }>,
  confidenceRating: number,
  trustRating: number,
  engagementRating: boolean
) => {
  const sessionUuid = await resolveSessionUuid(sessionId);
  if (!sessionUuid) throw new Error('Session not found');

  const { data: scenario, error: scenarioError } = await supabase
    .from('scenarios')
    .insert({
      session_id: sessionUuid,
      scenario_id: scenarioId,
      confidence_rating: confidenceRating,
      trust_rating: trustRating,
      engagement_rating: engagementRating,
      completed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (scenarioError || !scenario) throw scenarioError || new Error('Scenario insert failed');

  const dialogueData = messages.map((msg) => ({
    scenario_id: scenario.id,
    role: msg.role,
    content: msg.content,
    timestamp: new Date(msg.timestamp).toISOString(),
  }));

  if (dialogueData.length === 0) return;

  const { error: turnsError } = await supabase
    .from('dialogue_turns')
    .insert(dialogueData);
  if (turnsError) throw turnsError;
};

const fallbackCompleteSession = async (sessionId: string) => {
  const { error } = await supabase
    .from('study_sessions')
    .update({
      completed_at: new Date().toISOString(),
      status: 'completed',
    })
    .eq('session_id', sessionId);
  if (error) throw error;
};

export const createStudySession = async (mode: StudyMode) => {
  const localSessionId = crypto.randomUUID();
  try {
    const { data, error } = await supabase.functions.invoke('save-study-data', {
      body: {
        action: 'create_session',
        mode,
        sessionId: localSessionId,
      }
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    return (data?.sessionId as string) || localSessionId;
  } catch (error) {
    console.warn('save-study-data create_session failed, queueing retry:', error);
    enqueueEdgeCall(
      'save-study-data',
      { action: 'create_session', mode, sessionId: localSessionId },
      { dedupeKey: `create_session:${localSessionId}` }
    );
    return localSessionId;
  }
};

export const updateStudyMode = async (sessionId: string, mode: StudyMode) => {
  try {
    const { data, error } = await supabase.functions.invoke('save-study-data', {
      body: {
        action: 'update_mode',
        sessionId,
        mode,
      }
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  } catch (error) {
    console.warn('save-study-data update_mode failed, queueing retry:', error);
    enqueueEdgeCall(
      'save-study-data',
      { action: 'update_mode', sessionId, mode },
      { dedupeKey: `update_mode:${sessionId}` }
    );
  }
};

export const saveDemographics = async (sessionId: string, demographics: Record<string, string>) => {
  try {
    const { data, error } = await supabase.functions.invoke('save-study-data', {
      body: {
        action: 'save_demographics',
        sessionId,
        demographics,
      }
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  } catch (error) {
    console.warn('save-study-data save_demographics failed, queueing retry:', error);
    enqueueEdgeCall('save-study-data', {
      action: 'save_demographics',
      sessionId,
      demographics,
    });
  }
};

export const savePreTestResponses = async (sessionId: string, responses: Record<string, string>) => {
  const preTestResponses = Object.entries(responses).map(([questionId, answer]) => ({
    questionId,
    answer
  }));

  try {
    const { data, error } = await supabase.functions.invoke('save-study-data', {
      body: {
        action: 'save_pre_test',
        sessionId,
        preTestResponses,
      }
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  } catch (error) {
    console.warn('save-study-data save_pre_test failed, queueing retry:', error);
    enqueueEdgeCall('save-study-data', {
      action: 'save_pre_test',
      sessionId,
      preTestResponses,
    });
  }
};

export const saveScenarioData = async (
  sessionId: string,
  scenarioId: string,
  messages: Array<{ role: string; content: string; timestamp: number }>,
  confidenceRating: number,
  trustRating: number,
  engagementRating: boolean
) => {
  try {
    const { data, error } = await supabase.functions.invoke('save-study-data', {
      body: {
        action: 'save_scenario',
        sessionId,
        scenarioData: {
          scenarioId,
          messages,
          confidenceRating,
          trustRating,
          engagementRating,
        }
      }
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  } catch (error) {
    console.warn('save-study-data save_scenario failed, queueing retry:', error);
    enqueueEdgeCall('save-study-data', {
      action: 'save_scenario',
      sessionId,
      scenarioData: {
        scenarioId,
        messages,
        confidenceRating,
        trustRating,
        engagementRating,
      },
    });
  }
};

type SavePostTestOptions = {
  includeTelemetry?: boolean;
  mode?: StudyMode;
};

export const savePostTestResponses = async (
  sessionId: string,
  responses: Record<string, string>,
  options: SavePostTestOptions = {}
) => {
  const postTestResponses = Object.entries(responses).map(([questionId, answer]) => ({
    questionId,
    answer
  }));
  if (postTestResponses.length === 0) {
    throw new Error('No post-test responses to save');
  }
  const telemetryResponses: Array<{ questionId: string; answer: string }> = [];

  if (options.includeTelemetry) {
    const capturedAt = new Date().toISOString();
    const timingEntries = getTimingLog();
    const dialogueEntries = getTutorDialogueLog();
    const studyMode =
      options.mode ||
      (typeof sessionStorage !== 'undefined'
        ? (sessionStorage.getItem('studyMode') as StudyMode)
        : undefined) ||
      'text';
    const chunkLimit = 1800;
    const chunkPayload = (baseId: string, payload: string) => {
      if (payload.length <= chunkLimit) {
        return [{ questionId: baseId, answer: payload }];
      }
      const batchId = Date.now().toString(36);
      const chunks: Array<{ questionId: string; answer: string }> = [];
      for (let i = 0; i < payload.length; i += chunkLimit) {
        const partIndex = Math.floor(i / chunkLimit) + 1;
        chunks.push({
          questionId: `${baseId}__batch_${batchId}__part_${partIndex}`,
          answer: payload.slice(i, i + chunkLimit),
        });
      }
      return chunks;
    };

    if (timingEntries.length > 0) {
      const payload = JSON.stringify({
        version: 1,
        capturedAt,
        mode: studyMode,
        entries: timingEntries,
      });
      telemetryResponses.push(...chunkPayload(META_TIMING_ID, payload));
    }

    if (dialogueEntries.length > 0) {
      const sanitizedDialogue = dialogueEntries
        .filter((msg) => msg && (msg.role === 'ai' || msg.role === 'user') && msg.content?.trim())
        .slice(-500)
        .map((msg) => ({
          role: msg.role,
          content: msg.content.trim().slice(0, 10000),
          timestamp: typeof msg.timestamp === 'number' ? msg.timestamp : Date.now(),
          slideId: msg.slideId ? msg.slideId.slice(0, 100) : undefined,
          slideTitle: msg.slideTitle ? msg.slideTitle.slice(0, 300) : undefined,
          mode: msg.mode || studyMode,
        }));

      if (sanitizedDialogue.length > 0) {
        const payload = JSON.stringify({
          version: 1,
          capturedAt,
          mode: studyMode,
          messages: sanitizedDialogue,
        });
        telemetryResponses.push(...chunkPayload(META_DIALOGUE_ID, payload));
      }
    }
  }

  const maxEdgeResponses = 200;
  const allResponses = [...postTestResponses, ...telemetryResponses];
  const batches: Array<typeof postTestResponses> = [];
  for (let i = 0; i < allResponses.length; i += maxEdgeResponses) {
    batches.push(allResponses.slice(i, i + maxEdgeResponses));
  }

  let edgeError: unknown = null;
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
    edgeError = error;
  }

  if (!edgeError) return;

  try {
    await fallbackSavePostTest(sessionId, responses);
    return;
  } catch (fallbackError) {
    console.warn('fallback save_post_test failed, queueing retry:', fallbackError);
  }

  batches.forEach((batch) => {
    enqueueEdgeCall('save-study-data', {
      action: 'save_post_test',
      sessionId,
      postTestResponses: batch,
    });
  });

  throw edgeError;
};

export const completeStudySession = async (sessionId: string) => {
  try {
    const { data, error } = await supabase.functions.invoke('complete-session', {
      body: { sessionId }
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  } catch (error) {
    console.warn('complete-session failed, queueing retry:', error);
    enqueueEdgeCall('complete-session', { sessionId });
  }
};

const MAX_DIALOGUE_ENTRIES = 500;
const MAX_DIALOGUE_CONTENT = 10000;
const MAX_DIALOGUE_SLIDE_ID = 100;
const MAX_DIALOGUE_SLIDE_TITLE = 300;
const DIALOGUE_EDGE_DISABLED_KEY = 'dialogueEdgeDisabled';

const sanitizeTutorDialogue = (
  messages: Array<{
    role: 'ai' | 'user';
    content: string;
    timestamp?: number;
    slideId?: string;
    slideTitle?: string;
  }>
) =>
  (messages || [])
    .filter((msg) => msg && (msg.role === 'ai' || msg.role === 'user') && msg.content?.trim())
    .slice(-MAX_DIALOGUE_ENTRIES)
    .map((msg) => ({
      role: msg.role,
      content: msg.content.trim().slice(0, MAX_DIALOGUE_CONTENT),
      timestamp: typeof msg.timestamp === 'number' ? msg.timestamp : Date.now(),
      slideId: msg.slideId ? msg.slideId.slice(0, MAX_DIALOGUE_SLIDE_ID) : undefined,
      slideTitle: msg.slideTitle ? msg.slideTitle.slice(0, MAX_DIALOGUE_SLIDE_TITLE) : undefined,
    }));

export const saveTutorDialogue = async (
  sessionId: string,
  mode: StudyMode,
  messages: Array<{
    role: 'ai' | 'user';
    content: string;
    timestamp?: number;
    slideId?: string;
    slideTitle?: string;
  }>
) => {
  const sanitized = sanitizeTutorDialogue(messages);
  if (!sanitized.length) return;
  if (sessionStorage.getItem(DIALOGUE_EDGE_DISABLED_KEY) === 'true') {
    try {
      const { saveTelemetryMeta } = await import('@/lib/sessionTelemetry');
      await saveTelemetryMeta(sessionId, mode, { final: false });
    } catch (fallbackError) {
      console.error('Failed to store tutor dialogue fallback:', fallbackError);
    }
    return;
  }

  try {
    const { data, error } = await supabase.functions.invoke('save-study-data', {
      body: {
        action: 'save_tutor_dialogue',
        sessionId,
        mode,
        messages: sanitized,
      }
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  } catch (error) {
    console.warn('save-study-data save_tutor_dialogue failed, using telemetry fallback:', error);
    sessionStorage.setItem(DIALOGUE_EDGE_DISABLED_KEY, 'true');
    try {
      const { saveTelemetryMeta } = await import('@/lib/sessionTelemetry');
      await saveTelemetryMeta(sessionId, mode, { final: false });
    } catch (fallbackError) {
      console.error('Failed to store tutor dialogue fallback:', fallbackError);
    }
  }
};
