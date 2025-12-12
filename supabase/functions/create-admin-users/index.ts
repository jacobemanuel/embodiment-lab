import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { secret } = await req.json();
    
    // Simple secret check to prevent unauthorized calls
    if (secret !== 'create-study-admins-2024') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const adminEmails = [
      'zeynep.gurlek7@gmail.com',
      'jakub.majewski@tum.de',
      'Markus_Moenkhoff@hotmail.com',
      'michel.alexander017@gmail.com',
      'manuelpeichl@yahoo.com'
    ];

    const OWNER_EMAIL = 'jakub.majewski@tum.de';
    const OWNER_PASSWORD = 'MajonezWiniaryTUM98!';
    const DEFAULT_ADMIN_PASSWORD = 'AIDAStudyAdmin2026!';
    const results: Array<Record<string, unknown>> = [];

    for (const email of adminEmails) {
      console.log(`Processing admin: ${email}`);

      const password = email.toLowerCase() === OWNER_EMAIL.toLowerCase()
        ? OWNER_PASSWORD
        : DEFAULT_ADMIN_PASSWORD;
      
      // Check if user already exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
      
      if (existingUser) {
        console.log(`User ${email} already exists, updating password and ensuring role`);

        // Update password to the latest required value
        const { error: passwordError } = await supabase.auth.admin.updateUserById(existingUser.id, {
          password,
        });
        if (passwordError) {
          console.error(`Error updating password for ${email}:`, passwordError);
        }
        
        results.push({ email, status: 'already_exists', userId: existingUser.id });
        
        // Make sure they have the researcher role
        const { data: existingRole } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', existingUser.id)
          .eq('role', 'researcher')
          .single();
          
        if (!existingRole) {
          await supabase
            .from('user_roles')
            .insert({ user_id: existingUser.id, role: 'researcher' });
          console.log(`Added researcher role to ${email}`);
        }
        continue;
      }

      // Create new user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true // Auto-confirm the email
      });

      if (createError) {
        console.error(`Error creating user ${email}:`, createError);
        results.push({ email, status: 'error', error: createError.message });
        continue;
      }

      if (newUser?.user) {
        // Add researcher role
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({ user_id: newUser.user.id, role: 'researcher' });
          
        if (roleError) {
          console.error(`Error adding role for ${email}:`, roleError);
        }
        
        results.push({ email, status: 'created', userId: newUser.user.id });
        console.log(`Created admin user: ${email}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});