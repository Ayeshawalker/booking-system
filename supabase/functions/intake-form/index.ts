import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const allowedFields = new Set([
  "preferred_name", "pronouns", "date_of_birth", "address", "email", "phone",
  "safe_contact", "emergency_contact", "relationship_context", "what_happened",
  "betrayal_nature", "betrayal_nature_other", "discovery_timing", "discovery_pattern",
  "discovery_method", "betrayal_impact_summary", "current_contact", "children", "legal_processes",
  "living_arrangements", "daily_impact", "emotional_impact", "physical_impact",
  "work_impact", "safety_concerns", "contact_safety", "coping_responses",
  "support_network", "previous_therapy", "health_information", "medication",
  "risk_thoughts", "risk_details", "protective_factors", "therapy_hopes",
  "therapy_success_difference", "therapy_early_sign", "important_context", "access_needs",
  "attachment_distance_worry", "attachment_reassurance", "attachment_uncertainty",
  "attachment_self_reliance", "attachment_vulnerability", "attachment_push_pull",
  "attachment_pattern_notes", "attachment_security_needs", "childhood_environment",
  "family_origin_experiences", "family_origin_context",
  "impact_intention", "impact_distress_threshold", "impact_pause_plan", "impact_support_person",
  "impact_emotions", "impact_body", "impact_thoughts", "impact_trust_safety", "impact_self", "impact_daily_life",
  "impact_top_three", "impact_unseen", "impact_before_believed", "impact_discovery", "impact_hardest",
  "impact_now_find", "impact_losses", "impact_pain", "impact_reassurance", "impact_unsafe", "impact_safer",
  "impact_opening_sentence", "impact_key_sentence", "impact_sharing_needs", "impact_after_writing", "impact_reflections",
  "guide_gradually", "guide_therapist", "guide_grounding", "guide_draft", "guide_lived", "guide_included",
  "guide_language", "guide_questions", "guide_understand", "guide_timing",
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function clean(value: unknown, maximum = 4000) {
  return String(value || "").trim().slice(0, maximum);
}
function cleanAnswers(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const output: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!allowedFields.has(key)) continue;
    output[key] = Array.isArray(value)
      ? value.slice(0, key === "impact_reflections" ? 50 : 30).map((item) => clean(item, key === "impact_reflections" ? 6000 : 300)).filter(Boolean)
      : clean(value, 6000);
  }
  return output;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "", { auth: { persistSession: false } });
    const body = await request.json();
    const token = clean(body.token, 80);
    if (!token) return json({ error: "This intake link is incomplete." }, 400);
    const { data: intake, error } = await db.from("client_intake_forms")
      .select("id,client_id,form_type,form_version,status,answers,signer_name,signed_at,created_at")
      .eq("access_token", token).maybeSingle();
    if (error || !intake || intake.status === "Cancelled") return json({ error: "This intake link is invalid or is no longer active." }, 404);
    const { data: client } = await db.from("clients")
      .select("first_name,surname,second_first_name,second_surname")
      .eq("id", intake.client_id).maybeSingle();
    const clientName = client ? [client.first_name, client.surname].filter(Boolean).join(" ") : "Client";
    if (body.action === "view") return json({ intake: { ...intake, client_name: clientName } });
    if (intake.form_type === "Impact statement" && body.action === "save") {
      if (intake.status === "Completed") return json({ error: "This impact statement has already been submitted." }, 409);
      const { error: draftError } = await db.from("client_intake_forms").update({ answers: cleanAnswers(body.answers), updated_at: new Date().toISOString() }).eq("id", intake.id);
      if (draftError) throw draftError;
      return json({ success: true, saved: true });
    }
    if (body.action !== "submit") return json({ error: "Unknown action." }, 400);
    if (intake.status === "Completed") return json({ error: "This form has already been completed." }, 409);
    if (intake.form_type === "Impact statement") {
      const answers = cleanAnswers(body.answers);
      const hasWriting = Object.entries(answers).some(([key,value]) => key.startsWith("impact_") && (Array.isArray(value) ? value.length : String(value || "").trim()));
      if (!hasWriting) return json({ error: "Please add at least one written response before submitting." }, 400);
      const signerName = clean(body.signerName, 160);
      if (signerName.length < 2 || body.confirmReady !== true) return json({ error: "Please type your name and confirm that you are ready to submit." }, 400);
      const now = new Date().toISOString();
      const { error: impactError } = await db.from("client_intake_forms").update({ answers, signer_name: signerName, signed_at: now, status: "Completed", completed_at: now, updated_at: now }).eq("id", intake.id);
      if (impactError) throw impactError;
      return json({ success: true });
    }
    if (body.confirmAccurate !== true || body.confirmNotEmergency !== true || body.confirmAssessment !== true) {
      return json({ error: "Please tick all three confirmations before signing." }, 400);
    }
    const signerName = clean(body.signerName, 160);
    if (signerName.length < 2) return json({ error: "Please type your full name to sign the form." }, 400);
    const answers = cleanAnswers(body.answers);
    if (!answers.what_happened && !answers.therapy_hopes) return json({ error: "Please briefly tell me what brings you to therapy or what you hope for." }, 400);
    const now = new Date().toISOString();
    const { error: saveError } = await db.from("client_intake_forms").update({
      answers, signer_name: signerName, signed_at: now, status: "Completed",
      completed_at: now, updated_at: now,
    }).eq("id", intake.id);
    if (saveError) throw saveError;
    await db.from("clients").update({ intake_status: "Completed", intake_completed_date: now.slice(0, 10) }).eq("id", intake.client_id);
    return json({ success: true });
  } catch (error) {
    console.error(error);
    return json({ error: "The form could not be saved. Please try again." }, 500);
  }
});
