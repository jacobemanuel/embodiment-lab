import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, slideId, slideTitle, startedAt, endedAt, durationSeconds } = await req.json();

    if (!sessionId || !slideId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: sessionId and slideId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Saving avatar time tracking:', { sessionId, slideId, slideTitle, durationSeconds });

    // First, find the UUID id from the session_id string
    const { data: session, error: sessionError } = await supabase
      .from('study_sessions')
      .select('id')
      .eq('session_id', sessionId)
      .single();

    if (sessionError || !session) {
      console.error('Session not found:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data, error } = await supabase
      .from('avatar_time_tracking')
      .insert({
        session_id: session.id, // Use the UUID id, not the string session_id
        slide_id: slideId,
        slide_title: slideTitle || slideId,
        started_at: startedAt,
        ended_at: endedAt,
        duration_seconds: durationSeconds,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving avatar time:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to save time tracking' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Avatar time saved successfully:', data.id);

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in save-avatar-time:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
