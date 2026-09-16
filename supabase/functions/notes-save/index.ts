import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isUuid(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const authorization = request.headers.get("Authorization") || "";
    if (!url || !serviceKey || !authorization.startsWith("Bearer ")) {
      return json({ error: "Authorisation is required" }, 401);
    }

    const db = createClient(url, serviceKey, { auth: { persistSession: false } });
    const token = authorization.slice("Bearer ".length);
    const { data: userData, error: userError } = await db.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Your sign-in has expired" }, 401);

    const { data: membership, error: membershipError } = await db
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (membershipError || !membership) return json({ error: "Administrator access is required" }, 403);

    const body = await request.json().catch(() => ({}));
    const noteId = body.noteId ? String(body.noteId) : "";
    const input = body.note || {};
    if (noteId && !isUuid(noteId)) return json({ error: "The note identifier is invalid" }, 400);
    if (!isUuid(input.client_id)) return json({ error: "Choose the client this note belongs to" }, 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.note_date || ""))) return json({ error: "Choose a valid note date" }, 400);

    const allowedTypes = new Set(["Session note", "Admin note", "Follow-up note", "Risk/admin flag"]);
    const allowedStatuses = new Set(["Draft", "Final"]);
    if (!allowedTypes.has(input.note_type)) return json({ error: "Choose a valid note type" }, 400);
    if (!allowedStatuses.has(input.status)) return json({ error: "Choose a valid note status" }, 400);

    const note = {
      client_id: input.client_id,
      note_date: input.note_date,
      note_type: input.note_type,
      retention_review_date: input.retention_review_date || null,
      rough_note: String(input.rough_note || ""),
      final_note: String(input.final_note || ""),
      status: input.status,
      ai_assisted: Boolean(input.ai_assisted),
      ai_model: input.ai_assisted ? String(input.ai_model || "") || null : null,
      updated_by: userData.user.id,
      finalised_at: input.status === "Final" ? (input.finalised_at || new Date().toISOString()) : null,
      interventions: Array.isArray(input.interventions) ? input.interventions.map(String) : [],
      resources_shared: Array.isArray(input.resources_shared) ? input.resources_shared.map(String) : [],
      supervision_required: Boolean(input.supervision_required),
      supervision_question: input.supervision_required ? String(input.supervision_question || "") : "",
      supervision_status: input.supervision_required && input.supervision_status === "Discussed" ? "Discussed" : input.supervision_required ? "Outstanding" : "Not required",
      supervision_discussed_at: input.supervision_required && input.supervision_status === "Discussed" ? input.supervision_discussed_at || null : null,
    };
    if (!note.rough_note.trim() && !note.final_note.trim()) return json({ error: "Write a note before saving" }, 400);

    const result = noteId
      ? await db.from("clinical_notes").update(note).eq("id", noteId).select("*").single()
      : await db.from("clinical_notes").insert({ ...note, created_by: userData.user.id }).select("*").single();
    if (result.error) throw result.error;
    return json({ saved: true, note: result.data });
  } catch (error) {
    console.error(error);
    return json({ error: String(error?.message || "The note could not be saved") }, 500);
  }
});
