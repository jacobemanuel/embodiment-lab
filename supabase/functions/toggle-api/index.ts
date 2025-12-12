import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Only this email can toggle API
const OWNER_EMAIL = 'jakub.majewski@tum.de';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the user from the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is the owner
    if (user.email !== OWNER_EMAIL) {
      console.log(`Unauthorized attempt by ${user.email}`);
      return new Response(
        JSON.stringify({ error: 'Only the owner can toggle API status' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action } = await req.json();

    if (action === 'get') {
      // Get current status
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'api_enabled')
        .single();

      if (error) {
        console.error('Error fetching setting:', error);
        throw error;
      }

      return new Response(
        JSON.stringify({ enabled: data?.value?.enabled ?? false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'toggle') {
      // Get current status
      const { data: current, error: fetchError } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'api_enabled')
        .single();

      if (fetchError) {
        console.error('Error fetching current setting:', fetchError);
        throw fetchError;
      }

      const currentEnabled = current?.value?.enabled ?? false;
      const newEnabled = !currentEnabled;

      // Update status
      const { error: updateError } = await supabase
        .from('app_settings')
        .update({ 
          value: { enabled: newEnabled },
          updated_at: new Date().toISOString(),
          updated_by: user.email
        })
        .eq('key', 'api_enabled');

      if (updateError) {
        console.error('Error updating setting:', updateError);
        throw updateError;
      }

      console.log(`API toggled to ${newEnabled ? 'ENABLED' : 'DISABLED'} by ${user.email}`);

      return new Response(
        JSON.stringify({ enabled: newEnabled, message: `API ${newEnabled ? 'enabled' : 'disabled'} successfully` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in toggle-api function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
