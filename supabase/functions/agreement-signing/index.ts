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

function clean(value: unknown, maximum = 200) {
  return String(value || "").trim().slice(0, maximum);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const db = createClient(url, key, { auth: { persistSession: false } });
    const body = await request.json();
    const token = clean(body.token, 80);
    if (!token) return json({ error: "This signing link is incomplete." }, 400);

    const { data: agreement, error } = await db.from("client_agreements")
      .select("id,client_id,agreement_type,agreement_version,agreement_text,status,signer_one_expected_name,signer_two_expected_name,signer_one_name,signer_one_signed_at,signer_two_name,signer_two_signed_at,created_at")
      .eq("access_token", token).maybeSingle();
    if (error || !agreement || agreement.status === "Cancelled") {
      return json({ error: "This signing link is invalid or is no longer active." }, 404);
    }

    if (body.action === "view") {
      return json({ agreement });
    }
    if (body.action !== "sign") return json({ error: "Unknown action." }, 400);
    if (agreement.status === "Signed") return json({ error: "This agreement has already been fully signed." }, 409);
    if (body.accepted !== true) return json({ error: "Please confirm that you agree to the agreement." }, 400);
    if (agreement.agreement_version >= "2026-08-14" && body.feesAndCancellationAccepted !== true) {
      return json({ error: "Please confirm that you understand your fees and the 48-hour policy." }, 400);
    }

    const signer = Number(body.signer);
    if (![1, 2].includes(signer) || (signer === 2 && agreement.agreement_type !== "Couple")) {
      return json({ error: "Please choose the correct signer." }, 400);
    }
    const name = clean(body.name, 160);
    if (name.length < 2) return json({ error: "Please type your full name." }, 400);
    const choice = body.communicationChoice === "whatsapp" ? "whatsapp" : "alternative";
    const alternative = clean(body.contactAlternative, 300);
    if (choice === "alternative" && !alternative) {
      return json({ error: "Please tell Ayesha how you would prefer to receive administrative messages." }, 400);
    }
    const field = signer === 1 ? "one" : "two";
    if (agreement[`signer_${field}_signed_at`]) return json({ error: "That person has already signed." }, 409);
    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      [`signer_${field}_name`]: name,
      [`signer_${field}_signed_at`]: now,
      [`signer_${field}_whatsapp_consent`]: choice === "whatsapp",
      [`signer_${field}_contact_alternative`]: choice === "alternative" ? alternative : null,
      updated_at: now,
    };
    const otherSigned = signer === 1 ? agreement.signer_two_signed_at : agreement.signer_one_signed_at;
    const complete = agreement.agreement_type !== "Couple" || Boolean(otherSigned);
    update.status = complete ? "Signed" : "Partially signed";
    if (complete) update.completed_at = now;
    const { error: updateError } = await db.from("client_agreements").update(update).eq("id", agreement.id);
    if (updateError) throw updateError;

    await db.from("clients").update({
      contract_status: complete ? "Signed" : "Sent",
      contract_signed_date: complete ? now.slice(0, 10) : null,
    }).eq("id", agreement.client_id);
    return json({ success: true, complete });
  } catch (error) {
    console.error(error);
    return json({ error: "The signature could not be saved. Please try again." }, 500);
  }
});
