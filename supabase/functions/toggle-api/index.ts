import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Owner has full control, admins can only toggle Anam
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

    // Check if user has researcher role (admin access)
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const isResearcher = roleData?.role === 'researcher' || roleData?.role === 'admin';
    const isOwner = user.email === OWNER_EMAIL;

    if (!isResearcher && !isOwner) {
      console.log(`Unauthorized attempt by ${user.email}`);
      return new Response(
        JSON.stringify({ error: 'Only admins can access API controls' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, apiType, newApiKey } = await req.json();

    // ACTION: get - fetch all API statuses
    if (action === 'get') {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value, updated_at, updated_by')
        .in('key', ['api_enabled', 'openai_api_enabled', 'anam_api_enabled', 'anam_api_key']);

      if (error) {
        console.error('Error fetching settings:', error);
        throw error;
      }

      const settings: Record<string, any> = {};
      for (const row of data || []) {
        settings[row.key] = {
          ...row.value,
          updated_at: row.updated_at,
          updated_by: row.updated_by
        };
      }

      // For non-owners, hide the actual API key value
      if (!isOwner && settings.anam_api_key) {
        const keyValue = settings.anam_api_key.key || '';
        settings.anam_api_key.key = keyValue ? `***${keyValue.slice(-4)}` : '';
      }

      return new Response(
        JSON.stringify({ 
          settings,
          isOwner,
          userEmail: user.email
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: toggle - toggle a specific API
    if (action === 'toggle') {
      // Validate apiType
      const validTypes = ['openai', 'anam', 'master'];
      if (!validTypes.includes(apiType)) {
        return new Response(
          JSON.stringify({ error: 'Invalid API type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Only owner can toggle OpenAI or master switch
      if ((apiType === 'openai' || apiType === 'master') && !isOwner) {
        return new Response(
          JSON.stringify({ error: 'Only owner can toggle OpenAI or master switch' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const settingKey = apiType === 'master' ? 'api_enabled' : `${apiType}_api_enabled`;

      // Get current status
      const { data: current, error: fetchError } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', settingKey)
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
        .eq('key', settingKey);

      if (updateError) {
        console.error('Error updating setting:', updateError);
        throw updateError;
      }

      // Log to audit
      await supabase.from('admin_audit_log').insert({
        admin_email: user.email,
        action_type: 'toggle',
        entity_type: 'api_setting',
        entity_id: settingKey,
        entity_name: `${apiType.toUpperCase()} API`,
        changes: { from: currentEnabled, to: newEnabled }
      });

      console.log(`${apiType.toUpperCase()} API toggled to ${newEnabled ? 'ENABLED' : 'DISABLED'} by ${user.email}`);

      return new Response(
        JSON.stringify({ 
          enabled: newEnabled, 
          message: `${apiType.toUpperCase()} API ${newEnabled ? 'enabled' : 'disabled'} successfully`,
          apiType
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: update_key - update Anam API key (all admins can update)
    if (action === 'update_key') {
      // All authenticated admins can update the key

      if (!newApiKey || typeof newApiKey !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Invalid API key' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get old key for audit (just last 4 chars)
      const { data: oldData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'anam_api_key')
        .single();

      const oldKeyPreview = oldData?.value?.key ? `***${oldData.value.key.slice(-4)}` : 'none';

      // Update the key
      const { error: updateError } = await supabase
        .from('app_settings')
        .update({ 
          value: { key: newApiKey },
          updated_at: new Date().toISOString(),
          updated_by: user.email
        })
        .eq('key', 'anam_api_key');

      if (updateError) {
        console.error('Error updating API key:', updateError);
        throw updateError;
      }

      // Log to audit
      await supabase.from('admin_audit_log').insert({
        admin_email: user.email,
        action_type: 'update',
        entity_type: 'api_key',
        entity_id: 'anam_api_key',
        entity_name: 'ANAM API Key',
        changes: { from: oldKeyPreview, to: `***${newApiKey.slice(-4)}` }
      });

      console.log(`ANAM API key updated by ${user.email}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'ANAM API key updated successfully'
        }),
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
