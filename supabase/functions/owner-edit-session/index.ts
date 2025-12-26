import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OWNER_EMAIL = "jakub.majewski@tum.de";
const MIN_EDIT_DATE = new Date("2025-12-24T00:00:00Z");
const OWNER_EDIT_ENABLED = Deno.env.get("OWNER_EDIT_ENABLED") === "true";

const pickFields = (source: Record<string, unknown>, fields: string[]) => {
  return fields.reduce<Record<string, unknown>>((acc, field) => {
    if (source[field] !== undefined) {
      acc[field] = source[field];
    }
    return acc;
  }, {});
};

const updateRows = async (
  supabase: ReturnType<typeof createClient>,
  table: string,
  rows: Array<Record<string, unknown>> | undefined,
  fields: string[]
) => {
  if (!rows || rows.length === 0) return;

  for (const row of rows) {
    const rowId = row.id;
    if (!rowId) continue;

    const payload = pickFields(row as Record<string, unknown>, fields);
    if (Object.keys(payload).length === 0) continue;

    const { error } = await supabase
      .from(table)
      .update(payload)
      .eq("id", rowId);

    if (error) {
      console.error(`Failed to update ${table} row`, { rowId, error });
      throw error;
    }
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
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

    if (user.email !== OWNER_EMAIL) {
      return new Response(JSON.stringify({ error: "Owner access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!OWNER_EDIT_ENABLED) {
      return new Response(JSON.stringify({ error: "Owner editor disabled" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: adminUser } = await supabase
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

    const { sessionId, updates } = await req.json();
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Missing sessionId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sessionRow, error: sessionError } = await supabase
      .from("study_sessions")
      .select("id, created_at")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError || !sessionRow) {
      console.error("Session lookup error:", sessionError);
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(sessionRow.created_at) < MIN_EDIT_DATE) {
      return new Response(JSON.stringify({ error: "Editing locked for this session" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (updates?.session) {
      const sessionPayload = pickFields(updates.session, [
        "started_at",
        "completed_at",
        "last_activity_at",
        "status",
        "mode",
        "modes_used",
        "suspicion_score",
        "suspicious_flags",
      ]);

      if (Object.keys(sessionPayload).length > 0) {
        const { error: sessionUpdateError } = await supabase
          .from("study_sessions")
          .update(sessionPayload)
          .eq("id", sessionId);

        if (sessionUpdateError) {
          console.error("Failed to update session:", sessionUpdateError);
          throw sessionUpdateError;
        }
      }
    }

    await updateRows(supabase, "demographic_responses", updates?.demographicResponses, ["answer"]);
    await updateRows(supabase, "pre_test_responses", updates?.preTest, ["answer"]);
    await updateRows(supabase, "post_test_responses", updates?.postTest, ["answer"]);
    await updateRows(supabase, "scenarios", updates?.scenarios, [
      "trust_rating",
      "confidence_rating",
      "engagement_rating",
      "completed_at",
    ]);
    if (updates?.avatarTimeTracking) {
      updates.avatarTimeTracking = updates.avatarTimeTracking.map((entry: Record<string, unknown>) => {
        const rawDuration = entry.duration_seconds;
        if (typeof rawDuration === "number") {
          return {
            ...entry,
            duration_seconds: Math.min(Math.max(rawDuration, 0), 180),
          };
        }
        return entry;
      });
    }

    await updateRows(supabase, "avatar_time_tracking", updates?.avatarTimeTracking, ["duration_seconds"]);
    await updateRows(supabase, "tutor_dialogue_turns", updates?.tutorDialogueTurns, ["content"]);
    await updateRows(supabase, "dialogue_turns", updates?.dialogueTurns, ["content"]);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Owner edit error:", error);
    return new Response(JSON.stringify({ error: "Failed to update session data" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
