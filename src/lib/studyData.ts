import { supabase } from "@/integrations/supabase/client";
import { StudyMode } from "@/types/study";

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
  try {
    const { data, error } = await supabase.functions.invoke('save-study-data', {
      body: {
        action: 'create_session',
        mode,
      }
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    return data.sessionId as string;
  } catch (error) {
    console.warn('save-study-data create_session failed, falling back to direct insert:', error);
    return await fallbackCreateSession(mode);
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
    console.warn('save-study-data update_mode failed, falling back to direct update:', error);
    await fallbackUpdateMode(sessionId, mode);
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
    console.warn('save-study-data save_demographics failed, falling back to direct insert:', error);
    await fallbackSaveDemographics(sessionId, demographics);
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
    console.warn('save-study-data save_pre_test failed, falling back to direct insert:', error);
    await fallbackSavePreTest(sessionId, responses);
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
    console.warn('save-study-data save_scenario failed, falling back to direct insert:', error);
    await fallbackSaveScenario(sessionId, scenarioId, messages, confidenceRating, trustRating, engagementRating);
  }
};

export const savePostTestResponses = async (sessionId: string, responses: Record<string, string>) => {
  const postTestResponses = Object.entries(responses).map(([questionId, answer]) => ({
    questionId,
    answer
  }));

  try {
    const { data, error } = await supabase.functions.invoke('save-study-data', {
      body: {
        action: 'save_post_test',
        sessionId,
        postTestResponses,
      }
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  } catch (error) {
    console.warn('save-study-data save_post_test failed, falling back to direct insert:', error);
    await fallbackSavePostTest(sessionId, responses);
  }
};

export const completeStudySession = async (sessionId: string) => {
  try {
    const { data, error } = await supabase.functions.invoke('complete-session', {
      body: { sessionId }
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  } catch (error) {
    console.warn('complete-session failed, falling back to direct update:', error);
    await fallbackCompleteSession(sessionId);
  }
};

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
  if (!messages || messages.length === 0) return;
  const { data, error } = await supabase.functions.invoke('save-study-data', {
    body: {
      action: 'save_tutor_dialogue',
      sessionId,
      mode,
      messages,
    }
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
};
