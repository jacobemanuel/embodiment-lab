import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Validation schemas
const modeSchema = z.enum(['text', 'voice', 'avatar']);

const createSessionSchema = z.object({
  action: z.literal('create_session'),
  mode: modeSchema,
});

const demographicsSchema = z.object({
  action: z.literal('save_demographics'),
  sessionId: z.string().min(10).max(100),
  demographics: z.record(z.string().max(500)),
});

const preTestSchema = z.object({
  action: z.literal('save_pre_test'),
  sessionId: z.string().min(10).max(100),
  preTestResponses: z.array(z.object({
    questionId: z.string().max(100),
    answer: z.string().max(2000),
  })).max(200),
});

const scenarioSchema = z.object({
  action: z.literal('save_scenario'),
  sessionId: z.string().min(10).max(100),
  scenarioData: z.object({
    scenarioId: z.string().max(100),
    messages: z.array(z.object({
      role: z.string().max(50),
      content: z.string().max(10000),
      timestamp: z.number(),
    })).max(200),
    confidenceRating: z.number().min(0).max(100),
    trustRating: z.number().min(0).max(10),
    engagementRating: z.boolean(),
  }),
});

const postTestSchema = z.object({
  action: z.literal('save_post_test'),
  sessionId: z.string().min(10).max(100),
  postTestResponses: z.array(z.object({
    questionId: z.string().max(100),
    answer: z.string().max(2000),
  })).max(200),
});

const updateModeSchema = z.object({
  action: z.literal('update_mode'),
  sessionId: z.string().min(10).max(100),
  mode: modeSchema,
});

const resetSessionSchema = z.object({
  action: z.literal('reset_session'),
  sessionId: z.string().min(10).max(100),
  reason: z.enum(['mode_switch', 'user_request', 'timeout', 'abandoned']).optional().default('mode_switch'),
});

const updateActivitySchema = z.object({
  action: z.literal('update_activity'),
  sessionId: z.string().min(10).max(100),
});

// Rate limiting
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60000;
const MAX_REQUESTS_PER_WINDOW = 10;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const requests = rateLimitMap.get(ip) || [];
  const recentRequests = requests.filter(time => now - time < RATE_LIMIT_WINDOW);
  if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) return false;
  recentRequests.push(now);
  rateLimitMap.set(ip, recentRequests);
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    
    if (!checkRateLimit(clientIp)) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action } = body;

    if (!action) {
      return new Response(
        JSON.stringify({ error: "Invalid request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    switch (action) {
      case 'create_session': {
        let validated;
        try {
          validated = createSessionSchema.parse(body);
        } catch (error) {
          console.error('Validation error:', error);
          return new Response(
            JSON.stringify({ error: "Invalid request data" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const sessionId = crypto.randomUUID();
        const { error } = await supabase
          .from('study_sessions')
          .insert({ 
            session_id: sessionId, 
            mode: validated.mode,
            modes_used: [validated.mode]
          });

        if (error) {
          console.error('Failed to create session:', error);
          return new Response(
            JSON.stringify({ error: "Unable to create session. Please try again." }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, sessionId }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'save_demographics': {
        let validated;
        try {
          validated = demographicsSchema.parse(body);
        } catch (error) {
          console.error('Validation error:', error);
          return new Response(
            JSON.stringify({ error: "Invalid request data" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: session, error: sessionError } = await supabase
          .from('study_sessions')
          .select('id')
          .eq('session_id', validated.sessionId)
          .single();

        if (sessionError || !session) {
          console.error('Session not found:', sessionError);
          return new Response(
            JSON.stringify({ error: "Unable to save data. Please try again." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Convert demographics object to array of question_id/answer pairs
        const demographicData = Object.entries(validated.demographics).map(([questionId, answer]) => ({
          session_id: session.id,
          question_id: questionId,
          answer: answer as string
        }));

        const { error: insertError } = await supabase
          .from('demographic_responses')
          .insert(demographicData);

        if (insertError) {
          console.error('Failed to save demographics:', insertError);
          return new Response(
            JSON.stringify({ error: "Unable to save data. Please try again." }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'save_pre_test': {
        let validated;
        try {
          validated = preTestSchema.parse(body);
        } catch (error) {
          console.error('Validation error:', error);
          return new Response(
            JSON.stringify({ error: "Invalid request data" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: session, error: sessionError } = await supabase
          .from('study_sessions')
          .select('id')
          .eq('session_id', validated.sessionId)
          .single();

        if (sessionError || !session) {
          console.error('Session not found:', sessionError);
          return new Response(
            JSON.stringify({ error: "Unable to save data. Please try again." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const preTestData = validated.preTestResponses.map(r => ({
          session_id: session.id,
          question_id: r.questionId,
          answer: r.answer
        }));

        const { error: insertError } = await supabase
          .from('pre_test_responses')
          .insert(preTestData);

        if (insertError) {
          console.error('Failed to save pre-test:', insertError);
          return new Response(
            JSON.stringify({ error: "Unable to save data. Please try again." }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'save_scenario': {
        let validated;
        try {
          validated = scenarioSchema.parse(body);
        } catch (error) {
          console.error('Validation error:', error);
          return new Response(
            JSON.stringify({ error: "Invalid request data" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: session, error: sessionError } = await supabase
          .from('study_sessions')
          .select('id')
          .eq('session_id', validated.sessionId)
          .single();

        if (sessionError || !session) {
          console.error('Session not found:', sessionError);
          return new Response(
            JSON.stringify({ error: "Unable to save data. Please try again." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: scenario, error: scenarioError } = await supabase
          .from('scenarios')
          .insert({
            session_id: session.id,
            scenario_id: validated.scenarioData.scenarioId,
            confidence_rating: validated.scenarioData.confidenceRating,
            trust_rating: validated.scenarioData.trustRating,
            engagement_rating: validated.scenarioData.engagementRating,
            completed_at: new Date().toISOString()
          })
          .select()
          .single();

        if (scenarioError) {
          console.error('Failed to save scenario:', scenarioError);
          return new Response(
            JSON.stringify({ error: "Unable to save data. Please try again." }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const dialogueData = validated.scenarioData.messages.map(msg => ({
          scenario_id: scenario.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp).toISOString()
        }));

        const { error: turnsError } = await supabase
          .from('dialogue_turns')
          .insert(dialogueData);

        if (turnsError) {
          console.error('Failed to save dialogue turns:', turnsError);
          return new Response(
            JSON.stringify({ error: "Unable to save data. Please try again." }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'save_post_test': {
        let validated;
        try {
          validated = postTestSchema.parse(body);
        } catch (error) {
          console.error('Validation error:', error);
          return new Response(
            JSON.stringify({ error: "Invalid request data" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: session, error: sessionError } = await supabase
          .from('study_sessions')
          .select('id')
          .eq('session_id', validated.sessionId)
          .single();

        if (sessionError || !session) {
          console.error('Session not found:', sessionError);
          return new Response(
            JSON.stringify({ error: "Unable to save data. Please try again." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const postTestData = validated.postTestResponses.map(r => ({
          session_id: session.id,
          question_id: r.questionId,
          answer: r.answer
        }));

        const { error: insertError } = await supabase
          .from('post_test_responses')
          .insert(postTestData);

        if (insertError) {
          console.error('Failed to save post-test:', insertError);
          return new Response(
            JSON.stringify({ error: "Unable to save data. Please try again." }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'update_mode': {
        let validated;
        try {
          validated = updateModeSchema.parse(body);
        } catch (error) {
          console.error('Validation error:', error);
          return new Response(
            JSON.stringify({ error: "Invalid request data" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: session, error: sessionError } = await supabase
          .from('study_sessions')
          .select('id, modes_used')
          .eq('session_id', validated.sessionId)
          .single();

        if (sessionError || !session) {
          console.error('Session not found:', sessionError);
          return new Response(
            JSON.stringify({ error: "Session not found" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Replace modes_used with ONLY the selected mode (not append)
        // This ensures we track only what mode the user actually chose
        const updatedModes = [validated.mode];

        const { error: updateError } = await supabase
          .from('study_sessions')
          .update({ 
            mode: validated.mode,
            modes_used: updatedModes,
            last_activity_at: new Date().toISOString()
          })
          .eq('id', session.id);

        if (updateError) {
          console.error('Failed to update mode:', updateError);
          return new Response(
            JSON.stringify({ error: "Unable to update mode" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, modesUsed: updatedModes }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'reset_session': {
        let validated;
        try {
          validated = resetSessionSchema.parse(body);
        } catch (error) {
          console.error('Validation error:', error);
          return new Response(
            JSON.stringify({ error: "Invalid request data" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Mark session as reset - it will be excluded from statistics
        const { error: updateError } = await supabase
          .from('study_sessions')
          .update({ 
            status: 'reset',
            last_activity_at: new Date().toISOString()
          })
          .eq('session_id', validated.sessionId);

        if (updateError) {
          console.error('Failed to reset session:', updateError);
          return new Response(
            JSON.stringify({ error: "Unable to reset session" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log(`Session ${validated.sessionId} marked as reset. Reason: ${validated.reason}`);

        return new Response(
          JSON.stringify({ success: true, reason: validated.reason }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'update_activity': {
        let validated;
        try {
          validated = updateActivitySchema.parse(body);
        } catch (error) {
          return new Response(
            JSON.stringify({ error: "Invalid request data" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error: updateError } = await supabase
          .from('study_sessions')
          .update({ last_activity_at: new Date().toISOString() })
          .eq('session_id', validated.sessionId);

        if (updateError) {
          console.error('Failed to update activity:', updateError);
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid request" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error('Error in save-study-data function:', error);
    return new Response(
      JSON.stringify({ error: "Unable to process request. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
