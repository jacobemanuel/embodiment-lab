import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const completeSessionSchema = z.object({
  sessionId: z.string().min(10).max(100),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    let validated;
    try {
      validated = completeSessionSchema.parse(body);
    } catch (error) {
      console.error('Validation error:', error);
      return new Response(
        JSON.stringify({ error: "Invalid request data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { sessionId } = validated;

    // Create Supabase client with service role key to bypass RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify session exists and is not already completed
    const { data: session, error: fetchError } = await supabase
      .from('study_sessions')
      .select('session_id, completed_at')
      .eq('session_id', sessionId)
      .single();

    if (fetchError || !session) {
      console.error('Session not found:', fetchError);
      return new Response(
        JSON.stringify({ error: "Unable to complete session. Please try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (session.completed_at) {
      return new Response(
        JSON.stringify({ error: "Unable to complete session. Please try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark session as completed
    const { error: updateError } = await supabase
      .from('study_sessions')
      .update({ completed_at: new Date().toISOString() })
      .eq('session_id', sessionId);

    if (updateError) {
      console.error('Failed to complete session:', updateError);
      return new Response(
        JSON.stringify({ error: "Unable to complete session. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Session completed: ${sessionId}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error('Error in complete-session function:', error);
    return new Response(
      JSON.stringify({ error: "Unable to process request. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
