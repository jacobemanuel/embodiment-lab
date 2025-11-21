import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limiting: store last request timestamps per IP
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const requests = rateLimitMap.get(ip) || [];
  
  // Remove old requests outside the window
  const recentRequests = requests.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  
  recentRequests.push(now);
  rateLimitMap.set(ip, recentRequests);
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting
    const clientIP = req.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(clientIP)) {
      console.warn(`Rate limit exceeded for IP: ${clientIP}`);
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { 
      action, 
      sessionId, 
      mode,
      demographics,
      preTestResponses,
      scenarioData,
      postTestResponses 
    } = await req.json();

    // Validate required fields
    if (!action || !sessionId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role key to bypass RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let result;

    switch (action) {
      case "create_session":
        if (!mode || !['text', 'voice', 'avatar'].includes(mode)) {
          return new Response(
            JSON.stringify({ error: "Invalid mode" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error: sessionError } = await supabase
          .from('study_sessions')
          .insert({ session_id: sessionId, mode });

        if (sessionError) throw sessionError;
        result = { success: true };
        break;

      case "save_demographics":
        if (!demographics) {
          return new Response(
            JSON.stringify({ error: "Missing demographics data" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Validate demographics data
        const { age_range, education, digital_experience } = demographics;
        if (!age_range || !education || !digital_experience) {
          return new Response(
            JSON.stringify({ error: "Incomplete demographics data" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get session UUID from session_id string
        const { data: demoSession, error: demoSessionError } = await supabase
          .from('study_sessions')
          .select('id')
          .eq('session_id', sessionId)
          .single();

        if (demoSessionError || !demoSession) {
          console.error('Session not found for demographics:', demoSessionError);
          return new Response(
            JSON.stringify({ error: "Session not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error: demoError } = await supabase
          .from('demographics')
          .insert({ session_id: demoSession.id, ...demographics });

        if (demoError) throw demoError;
        result = { success: true };
        break;

      case "save_pre_test":
        if (!Array.isArray(preTestResponses) || preTestResponses.length === 0) {
          return new Response(
            JSON.stringify({ error: "Invalid pre-test responses" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get session UUID from session_id string
        const { data: preSession, error: preSessionError } = await supabase
          .from('study_sessions')
          .select('id')
          .eq('session_id', sessionId)
          .single();

        if (preSessionError || !preSession) {
          console.error('Session not found for pre-test:', preSessionError);
          return new Response(
            JSON.stringify({ error: "Session not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const preTestData = preTestResponses.map(r => ({
          session_id: preSession.id,
          question_id: r.questionId,
          answer: r.answer
        }));

        const { error: preTestError } = await supabase
          .from('pre_test_responses')
          .insert(preTestData);

        if (preTestError) throw preTestError;
        result = { success: true };
        break;

      case "save_scenario":
        if (!scenarioData) {
          return new Response(
            JSON.stringify({ error: "Missing scenario data" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { 
          scenarioId, 
          messages, 
          confidenceRating, 
          trustRating, 
          engagementRating 
        } = scenarioData;

        // Validate scenario data
        if (!scenarioId || !Array.isArray(messages) || 
            confidenceRating === undefined || trustRating === undefined || 
            engagementRating === undefined) {
          return new Response(
            JSON.stringify({ error: "Invalid scenario data" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get session UUID from session_id string
        const { data: scenarioSession, error: scenarioSessionError } = await supabase
          .from('study_sessions')
          .select('id')
          .eq('session_id', sessionId)
          .single();

        if (scenarioSessionError || !scenarioSession) {
          console.error('Session not found for scenario:', scenarioSessionError);
          return new Response(
            JSON.stringify({ error: "Session not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Insert scenario
        const { data: scenario, error: scenarioError } = await supabase
          .from('scenarios')
          .insert({
            session_id: scenarioSession.id,
            scenario_id: scenarioId,
            confidence_rating: confidenceRating,
            trust_rating: trustRating,
            engagement_rating: engagementRating,
            completed_at: new Date().toISOString()
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
        result = { success: true };
        break;

      case "save_post_test":
        if (!Array.isArray(postTestResponses) || postTestResponses.length === 0) {
          return new Response(
            JSON.stringify({ error: "Invalid post-test responses" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get session UUID from session_id string
        const { data: postSession, error: postSessionError } = await supabase
          .from('study_sessions')
          .select('id')
          .eq('session_id', sessionId)
          .single();

        if (postSessionError || !postSession) {
          console.error('Session not found for post-test:', postSessionError);
          return new Response(
            JSON.stringify({ error: "Session not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const postTestData = postTestResponses.map(r => ({
          session_id: postSession.id,
          question_id: r.questionId,
          answer: r.answer
        }));

        const { error: postTestError } = await supabase
          .from('post_test_responses')
          .insert(postTestData);

        if (postTestError) throw postTestError;
        result = { success: true };
        break;

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    console.log(`Successfully processed ${action} for session: ${sessionId}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error('Error in save-study-data function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
