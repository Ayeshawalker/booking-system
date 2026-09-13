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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const authorization = request.headers.get("Authorization") || "";
    const body = await request.json().catch(() => ({}));
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

    const clientId = String(body.clientId || "").trim();
    if (clientId) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientId)) {
        return json({ error: "A valid client is required" }, 400);
      }
      const { data: notes, error: notesError } = await db.from("clinical_notes")
        .select("*")
        .eq("client_id", clientId)
        .order("note_date", { ascending: false })
        .order("updated_at", { ascending: false });
      if (notesError) throw notesError;
      return json({ notes: notes || [] });
    }

    const { data: clients, error } = await db.from("clients")
      .select("id,first_name,surname,second_first_name,second_surname,status")
      .order("first_name")
      .order("surname");
    if (error) throw error;
    return json({ clients: clients || [] });
  } catch (error) {
    console.error(error);
    return json({ error: "Clients could not be loaded" }, 500);
  }
});
