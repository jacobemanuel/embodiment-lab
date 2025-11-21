import { supabase } from "@/integrations/supabase/client";
import { StudyMode } from "@/types/study";

export const createStudySession = async (mode: StudyMode) => {
  const { data, error } = await supabase.functions.invoke('save-study-data', {
    body: { 
      action: 'create_session',
      mode
    }
  });
  
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  
  // Return the server-generated session ID
  return data.sessionId as string;
};

export const saveDemographics = async (sessionId: string, demographics: Record<string, string>) => {
  const { data, error } = await supabase.functions.invoke('save-study-data', {
    body: {
      action: 'save_demographics',
      sessionId,
      demographics
    }
  });
  
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
};

export const savePreTestResponses = async (sessionId: string, responses: Record<string, string>) => {
  const preTestResponses = Object.entries(responses).map(([questionId, answer]) => ({
    questionId,
    answer
  }));

  const { data, error } = await supabase.functions.invoke('save-study-data', {
    body: {
      action: 'save_pre_test',
      sessionId,
      preTestResponses
    }
  });
  
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
};

export const saveScenarioData = async (
  sessionId: string,
  scenarioId: string,
  messages: Array<{ role: string; content: string; timestamp: number }>,
  confidenceRating: number,
  trustRating: number,
  engagementRating: boolean
) => {
  const { data, error } = await supabase.functions.invoke('save-study-data', {
    body: {
      action: 'save_scenario',
      sessionId,
      scenarioData: {
        scenarioId,
        messages,
        confidenceRating,
        trustRating,
        engagementRating
      }
    }
  });
  
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
};

export const savePostTestResponses = async (sessionId: string, responses: Record<string, string>) => {
  const postTestResponses = Object.entries(responses).map(([questionId, answer]) => ({
    questionId,
    answer
  }));

  const { data, error } = await supabase.functions.invoke('save-study-data', {
    body: {
      action: 'save_post_test',
      sessionId,
      postTestResponses
    }
  });
  
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
};

export const completeStudySession = async (sessionId: string) => {
  const { data, error } = await supabase.functions.invoke('complete-session', {
    body: { sessionId }
  });
  
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
};
