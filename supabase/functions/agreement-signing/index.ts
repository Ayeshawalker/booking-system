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

async function sendSigningNotification(
  agreement: Record<string, unknown>,
  signerName: string,
  signedAt: string,
  complete: boolean,
) {
  const apiKey = Deno.env.get("RESEND_API_KEY") || "";
  const recipient = Deno.env.get("AGREEMENT_NOTIFICATION_EMAIL") || "info@ayeshajane.com";
  if (!apiKey) {
    console.warn("Agreement notification skipped because RESEND_API_KEY is not configured.");
    return;
  }
  const agreementType = agreement.agreement_type === "Couple"
    ? "couples counselling agreement"
    : agreement.agreement_type === "Betrayal trauma"
      ? "betrayal trauma therapy agreement"
      : "individual therapy agreement";
  const status = complete
    ? "The agreement is now complete."
    : "The first signature has been received and the second signature is still awaited.";
  const date = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(signedAt));
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: Deno.env.get("AGREEMENT_NOTIFICATION_FROM") || "Ayesha Jane <info@ayeshajane.com>",
      reply_to: "info@ayeshajane.com",
      to: [recipient],
      subject: complete
        ? `Agreement completed: ${signerName}`
        : `Agreement signed by ${signerName}`,
      text: [
        `${signerName} signed the ${agreementType} on ${date}.`,
        "",
        status,
        "",
        "You can view the signed agreement from the client’s record in your booking system.",
      ].join("\n"),
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend returned ${response.status}: ${detail.slice(0, 300)}`);
  }
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
    try {
      await sendSigningNotification(agreement, name, now, complete);
    } catch (notificationError) {
      console.error("Agreement was signed, but its email notification could not be sent.", notificationError);
    }
    return json({ success: true, complete });
  } catch (error) {
    console.error(error);
    return json({ error: "The signature could not be saved. Please try again." }, 500);
  }
});
