import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OWNER_EMAIL = "jakub.majewski@tum.de";

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header to identify the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create client with user's auth to get their email
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin
    const { data: adminUser } = await supabaseClient
      .from("admin_users")
      .select("email")
      .eq("email", user.email)
      .maybeSingle();

    if (!adminUser) {
      return new Response(JSON.stringify({ error: "Not an admin" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { sessionId, sessionIds, status, approve, action } = await req.json();
    const isOwner = user.email === OWNER_EMAIL;
    
    console.log("Update validation request:", { 
      userEmail: user.email, 
      isOwner, 
      sessionId, 
      sessionIds,
      status, 
      approve,
      action 
    });

    // Handle delete action (owner only)
    if (action === 'delete') {
      if (!isOwner) {
        return new Response(JSON.stringify({ error: "Only owner can delete sessions" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const idsToDelete = sessionIds || (sessionId ? [sessionId] : []);
      if (idsToDelete.length === 0) {
        return new Response(JSON.stringify({ error: "No sessions to delete" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete related data first (cascade doesn't work through all tables)
      // Delete in order: dialogue_turns -> scenarios, then other responses, then session
      const { data: scenarios } = await supabaseClient
        .from("scenarios")
        .select("id")
        .in("session_id", idsToDelete);

      if (scenarios && scenarios.length > 0) {
        const scenarioIds = scenarios.map(s => s.id);
        await supabaseClient.from("dialogue_turns").delete().in("scenario_id", scenarioIds);
        await supabaseClient.from("scenarios").delete().in("session_id", idsToDelete);
      }

      // Delete other related data
      await Promise.all([
        supabaseClient.from("demographic_responses").delete().in("session_id", idsToDelete),
        supabaseClient.from("demographics").delete().in("session_id", idsToDelete),
        supabaseClient.from("pre_test_responses").delete().in("session_id", idsToDelete),
        supabaseClient.from("post_test_responses").delete().in("session_id", idsToDelete),
        supabaseClient.from("avatar_time_tracking").delete().in("session_id", idsToDelete),
      ]);

      // Finally delete the sessions
      const { error } = await supabaseClient
        .from("study_sessions")
        .delete()
        .in("id", idsToDelete);

      if (error) {
        console.error("Delete error:", error);
        throw error;
      }

      console.log("Sessions deleted successfully:", idsToDelete);

      return new Response(JSON.stringify({ 
        success: true, 
        deletedCount: idsToDelete.length,
        message: `${idsToDelete.length} session(s) permanently deleted` 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle bulk updates
    if (sessionIds && Array.isArray(sessionIds)) {
      let actualStatus = status;
      
      if (isOwner) {
        // Owner can directly set status
        actualStatus = status;
      } else {
        // Admin can only request (pending_accepted or pending_ignored)
        actualStatus = status === 'accepted' ? 'pending_accepted' : 'pending_ignored';
      }

      const { error } = await supabaseClient
        .from("study_sessions")
        .update({
          validation_status: actualStatus,
          validated_by: user.email,
          validated_at: new Date().toISOString(),
        })
        .in("id", sessionIds);

      if (error) {
        console.error("Bulk update error:", error);
        throw error;
      }

      return new Response(JSON.stringify({ 
        success: true, 
        actualStatus,
        message: isOwner ? `${sessionIds.length} sessions ${status}` : `Requested ${status} for ${sessionIds.length} sessions` 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle single session update
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Missing sessionId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle owner approving/rejecting pending requests
    if (approve !== undefined && isOwner) {
      // Get current session status
      const { data: session } = await supabaseClient
        .from("study_sessions")
        .select("validation_status")
        .eq("id", sessionId)
        .single();

      let finalStatus: string;
      if (approve) {
        finalStatus = session?.validation_status === 'pending_accepted' ? 'accepted' : 'ignored';
      } else {
        finalStatus = 'pending';
      }

      const { error } = await supabaseClient
        .from("study_sessions")
        .update({
          validation_status: finalStatus,
          validated_by: user.email,
          validated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      if (error) {
        console.error("Approve update error:", error);
        throw error;
      }

      return new Response(JSON.stringify({ 
        success: true, 
        actualStatus: finalStatus,
        message: approve ? `Approved - session ${finalStatus}` : 'Request rejected' 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Regular status update
    let actualStatus = status;
    
    if (isOwner) {
      // Owner can directly set status
      actualStatus = status;
    } else {
      // Admin can only request (pending_accepted or pending_ignored)
      actualStatus = status === 'accepted' ? 'pending_accepted' : 'pending_ignored';
    }

    const { error } = await supabaseClient
      .from("study_sessions")
      .update({
        validation_status: actualStatus,
        validated_by: user.email,
        validated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (error) {
      console.error("Update error:", error);
      throw error;
    }

    console.log("Session updated successfully:", { sessionId, actualStatus });

    return new Response(JSON.stringify({ 
      success: true, 
      actualStatus,
      message: isOwner 
        ? (status === 'accepted' ? 'Session accepted for statistics' : 'Session ignored from statistics')
        : (status === 'accepted' ? 'Requested acceptance - awaiting owner approval' : 'Requested ignore - awaiting owner approval')
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
