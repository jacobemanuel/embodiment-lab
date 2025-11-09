import { supabase } from "@/integrations/supabase/client";
import { StudyMode } from "@/types/study";

export const createStudySession = async (sessionId: string, mode: StudyMode) => {
  const { data, error } = await supabase
    .from('study_sessions')
    .insert({
      session_id: sessionId,
      mode: mode
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const saveDemographics = async (sessionId: string, demographics: Record<string, string>) => {
  // First get the study session id
  const { data: session } = await supabase
    .from('study_sessions')
    .select('id')
    .eq('session_id', sessionId)
    .single();

  if (!session) throw new Error('Session not found');

  const { error } = await supabase
    .from('demographics')
    .insert({
      session_id: session.id,
      age_range: demographics['demo-age'],
      education: demographics['demo-education'],
      tax_experience: demographics['demo-tax-experience']
    });

  if (error) throw error;
};

export const savePreTestResponses = async (sessionId: string, responses: Record<string, string>) => {
  const { data: session } = await supabase
    .from('study_sessions')
    .select('id')
    .eq('session_id', sessionId)
    .single();

  if (!session) throw new Error('Session not found');

  const preTestData = Object.entries(responses).map(([questionId, answer]) => ({
    session_id: session.id,
    question_id: questionId,
    answer
  }));

  const { error } = await supabase
    .from('pre_test_responses')
    .insert(preTestData);

  if (error) throw error;
};

export const saveScenarioData = async (
  sessionId: string,
  scenarioId: string,
  messages: Array<{ role: string; content: string; timestamp: number }>,
  confidenceRating: number,
  trustRating: number,
  engagementRating: boolean
) => {
  const { data: session } = await supabase
    .from('study_sessions')
    .select('id')
    .eq('session_id', sessionId)
    .single();

  if (!session) throw new Error('Session not found');

  // Insert scenario
  const { data: scenario, error: scenarioError } = await supabase
    .from('scenarios')
    .insert({
      session_id: session.id,
      scenario_id: scenarioId,
      confidence_rating: confidenceRating,
      trust_rating: trustRating,
      engagement_rating: engagementRating
    })
    .select()
    .single();

  if (scenarioError) throw scenarioError;

  // Insert dialogue turns
  const dialogueData = messages.map(msg => ({
    scenario_id: scenario.id,
    role: msg.role,
    content: msg.content,
    timestamp: new Date(msg.timestamp).toISOString()
  }));

  const { error: dialogueError } = await supabase
    .from('dialogue_turns')
    .insert(dialogueData);

  if (dialogueError) throw dialogueError;
};

export const savePostTestResponses = async (sessionId: string, responses: Record<string, string>) => {
  const { data: session } = await supabase
    .from('study_sessions')
    .select('id')
    .eq('session_id', sessionId)
    .single();

  if (!session) throw new Error('Session not found');

  const postTestData = Object.entries(responses).map(([questionId, answer]) => ({
    session_id: session.id,
    question_id: questionId,
    answer
  }));

  const { error } = await supabase
    .from('post_test_responses')
    .insert(postTestData);

  if (error) throw error;
};

export const completeStudySession = async (sessionId: string) => {
  const { error } = await supabase
    .from('study_sessions')
    .update({ completed_at: new Date().toISOString() })
    .eq('session_id', sessionId);

  if (error) throw error;
};
