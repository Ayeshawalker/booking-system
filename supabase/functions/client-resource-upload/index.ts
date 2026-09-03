import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://ayeshawalker.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const bucket = "client-resources";
const maximumSize = 15 * 1024 * 1024;
const mimeByExtension: Record<string, string> = {
  ".pdf": "application/pdf", ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".rtf": "application/rtf", ".txt": "text/plain",
  ".pages": "application/vnd.apple.pages", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function safeFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "document";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let storagePath = "";
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: userData } = await db.auth.getUser(token);
    if (!userData.user) return json({ error: "Your sign-in has expired. Please sign in again." }, 401);
    const { data: admin } = await db.from("admin_users").select("user_id").eq("user_id", userData.user.id).maybeSingle();
    if (!admin) return json({ error: "This upload is restricted to the approved administrator." }, 403);

    const contentType = (request.headers.get("Content-Type") || "").split(";", 1)[0].trim().toLowerCase();
    let fileName = "";
    let requestedTitle = "";
    let fileSize = 0;
    let fileBytes: ArrayBuffer;
    if (contentType === "multipart/form-data") {
      const form = await request.formData();
      const file = form.get("file");
      requestedTitle = String(form.get("title") || "").trim();
      if (!(file instanceof File) || !file.name) return json({ error: "Choose a document to upload." }, 400);
      fileName = file.name;
      fileSize = file.size;
      fileBytes = await file.arrayBuffer();
    } else {
      const url = new URL(request.url);
      fileName = String(url.searchParams.get("filename") || "").trim();
      requestedTitle = String(url.searchParams.get("title") || "").trim();
      fileBytes = await request.arrayBuffer();
      fileSize = fileBytes.byteLength;
    }
    if (!fileName) return json({ error: "Choose a document to upload." }, 400);
    if (fileSize < 1 || fileSize > maximumSize) return json({ error: "Please choose a file smaller than 15 MB." }, 400);
    const extension = fileName.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || "";
    const mimeType = mimeByExtension[extension];
    if (!mimeType) return json({ error: "Please use PDF, Word, Pages, RTF, text, PNG, JPEG or WebP." }, 400);
    const title = requestedTitle || fileName.replace(/\.[^.]+$/, "");
    if (!title || title.length > 200) return json({ error: "Please use a shorter sheet title." }, 400);

    storagePath = `${userData.user.id}/${crypto.randomUUID()}-${safeFileName(fileName)}`;
    const uploadBody = new Blob([fileBytes], { type: mimeType });
    const { data: uploaded, error: uploadError } = await db.storage.from(bucket).upload(
      storagePath, uploadBody, { contentType: mimeType, upsert: false },
    );
    if (uploadError || !uploaded?.path) throw uploadError || new Error("Storage did not confirm the uploaded file.");
    const { data: resource, error: rowError } = await db.from("client_resources").insert({
      title, storage_path: storagePath, file_name: fileName, mime_type: mimeType,
      file_size: fileSize, created_by: userData.user.id,
    }).select("*").single();
    if (rowError) throw rowError;
    return json({ uploaded: true, resource });
  } catch (error) {
    console.error(error);
    if (storagePath) {
      const url = Deno.env.get("SUPABASE_URL") || "";
      const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      await createClient(url, key).storage.from(bucket).remove([storagePath]).catch(() => undefined);
    }
    return json({ error: error instanceof Error ? error.message : "The document could not be uploaded." }, 500);
  }
});
