import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json" },
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return respond({ error: "Method not allowed" }, 405);
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const openAiKey = Deno.env.get("OPENAI_API_KEY") || "";
    if (!openAiKey) return respond({ error: "AI note improvement has not been activated yet." }, 503);
    const bearer = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: userData } = await db.auth.getUser(bearer);
    if (!userData.user) return respond({ error: "Unauthorised" }, 401);
    const { data: admin } = await db.from("admin_users").select("user_id").eq("user_id", userData.user.id).maybeSingle();
    if (!admin) return respond({ error: "Forbidden" }, 403);

    const body = await request.json();
    const roughNote = String(body.roughNote || "").trim().slice(0, 12000);
    const noteType = String(body.noteType || "Session note").slice(0, 80);
    const instruction = String(body.instruction || "structure").slice(0, 80);
    if (!roughNote) return respond({ error: "Add a rough note first." }, 400);

    const model = Deno.env.get("OPENAI_NOTES_MODEL") || "gpt-5.6-terra";
    if (instruction === "extract-abc") {
      const abcInstructions = `You assist a UK therapist by extracting a draft CBT/REBT ABC formulation from their own session note. Use only information explicitly supported by the note. Never diagnose, infer motives, invent details, add treatment recommendations or make autonomous clinical decisions. If a component or belief category is absent or ambiguous, write exactly "Not clearly stated in the note." Keep each component concise and clinically neutral. Separate the four REBT belief categories rather than combining them. Separate emotional consequences from behavioural consequences. Return valid JSON only with this exact shape: {"activatingEvent":"...","beliefs":{"demands":"...","catastrophising":"...","lowFrustrationTolerance":"...","selfLifeOtherRating":"..."},"consequences":{"emotions":"...","behaviours":"..."}}. The output is a suggestion requiring mandatory clinician review.`;
      const abcResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST", headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, store: false, safety_identifier: userData.user.id, instructions: abcInstructions, reasoning: { effort: "low" }, max_output_tokens: 900, input: `SESSION NOTE:\n${roughNote}` }),
      });
      const abcResult = await abcResponse.json();
      if (!abcResponse.ok) return respond({ error: "The AI service could not prepare an ABC suggestion right now." }, 502);
      const abcText = abcResult.output_text || abcResult.output?.flatMap((item: any) => item.content || []).find((item: any) => item.type === "output_text")?.text;
      try { return respond({ abc: JSON.parse(String(abcText || "").replace(/^```json\s*|\s*```$/g, "")), model }); }
      catch { return respond({ error: "The AI service returned an ABC draft in an unexpected format." }, 502); }
    }

    const instructions = `You edit UK therapy notes for the therapist who wrote them. ` +
      `Preserve every material fact and the therapist's intended meaning. Use neutral, compassionate, professional language. Clearly distinguish client report, therapist observation, intervention, agreed action and risk/safeguarding information only when the source text supports that distinction. Be concise. Never diagnose, infer motives, invent quotations, add interventions, add a risk assessment, downgrade risk wording, or provide treatment recommendations. If wording is ambiguous, retain it cautiously rather than guessing. Do not include commentary about your editing. Return only the improved note.\n\n` +
      `The output is a suggestion for mandatory human review and must not be treated as an autonomous clinical decision.`;
    const prompt = `Task mode: ${instruction}. Note type: ${noteType}.\n\nROUGH NOTE:\n${roughNote}`;
    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, store: false, safety_identifier: userData.user.id, instructions, reasoning: { effort: "low" }, max_output_tokens: 2500, input: prompt }),
    });
    const result = await apiResponse.json();
    if (!apiResponse.ok) {
      console.error("OpenAI error", result?.error?.code || apiResponse.status);
      return respond({ error: "The AI service could not improve this note right now." }, 502);
    }
    const improvedNote = result.output_text || result.output?.flatMap((item: any) => item.content || [])
      .find((item: any) => item.type === "output_text")?.text;
    if (!improvedNote) return respond({ error: "The AI service returned no note." }, 502);
    return respond({ improvedNote, model });
  } catch (error) {
    console.error(error);
    return respond({ error: "The note could not be improved. No changes were saved." }, 500);
  }
});
