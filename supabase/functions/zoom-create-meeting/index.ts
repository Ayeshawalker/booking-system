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
    const accountId = Deno.env.get("ZOOM_ACCOUNT_ID") || "";
    const clientId = Deno.env.get("ZOOM_CLIENT_ID") || "";
    const clientSecret = Deno.env.get("ZOOM_CLIENT_SECRET") || "";
    if (!accountId || !clientId || !clientSecret) return respond({ error: "Zoom has not been connected yet." }, 503);

    const bearer = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: userData } = await db.auth.getUser(bearer);
    if (!userData.user) return respond({ error: "Unauthorised" }, 401);
    const { data: admin } = await db.from("admin_users").select("user_id").eq("user_id", userData.user.id).maybeSingle();
    if (!admin) return respond({ error: "Forbidden" }, 403);

    const { bookingId } = await request.json();
    if (!/^[0-9a-f-]{36}$/i.test(String(bookingId || ""))) return respond({ error: "Invalid booking reference" }, 400);
    const { data: booking, error: bookingError } = await db.from("booking_requests").select("*").eq("id", bookingId).single();
    if (bookingError || !booking) return respond({ error: "Booking not found" }, 404);
    if (String(booking.session_format).toLowerCase() !== "online") return respond({ status: "not_required" });
    if (booking.status !== "confirmed") return respond({ status: "pending_booking" });
    if (booking.zoom_join_url) return respond({ status: "created", joinUrl: booking.zoom_join_url, meetingId: booking.zoom_meeting_id });

    await db.from("booking_requests").update({ zoom_sync_status: "pending", zoom_sync_error: null }).eq("id", bookingId);
    const credentials = btoa(`${clientId}:${clientSecret}`);
    const tokenResponse = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`, {
      method: "POST", headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
    });
    const tokenBody = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenBody.access_token) {
      const tokenMessage = String(
        tokenBody?.reason || tokenBody?.error_description || tokenBody?.error || "Zoom account authorisation failed.",
      );
      console.error("Zoom token request failed", tokenResponse.status, tokenBody);
      throw new Error(`Zoom account authorisation failed: ${tokenMessage}`);
    }

    const duration = Number.parseInt(String(booking.duration || ""), 10) || (booking.session_type === "Joint session" ? 80 : 50);
    const meetingTitle = [booking.first_name, booking.second_first_name]
      .map((name) => String(name || "").trim())
      .filter(Boolean)
      .join(" and ") || "Online appointment";
    const zoomHost = Deno.env.get("ZOOM_HOST_EMAIL") || userData.user.email || "me";
    const meetingResponse = await fetch(`https://api.zoom.us/v2/users/${encodeURIComponent(zoomHost)}/meetings`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenBody.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: meetingTitle,
        type: 2,
        start_time: `${booking.preferred_date}T${String(booking.preferred_time).slice(0, 8)}`,
        duration,
        timezone: "Europe/London",
        agenda: "Private online appointment",
        settings: { waiting_room: true, join_before_host: false, mute_upon_entry: true, auto_recording: "none", approval_type: 2 },
      }),
    });
    const meeting = await meetingResponse.json();
    if (!meetingResponse.ok || !meeting.join_url || !meeting.id) {
      const zoomMessage = String(meeting?.message || meeting?.error || "Zoom could not create the meeting.");
      await db.from("booking_requests").update({
        zoom_sync_status: "failed", zoom_sync_error: zoomMessage,
      }).eq("id", bookingId);
      throw new Error(`Zoom said: ${zoomMessage}`);
    }
    const { error: updateError } = await db.from("booking_requests").update({
      zoom_meeting_id: String(meeting.id), zoom_join_url: meeting.join_url,
      zoom_sync_status: "created", zoom_sync_error: null, zoom_created_at: new Date().toISOString(),
    }).eq("id", bookingId);
    if (updateError) throw updateError;
    return respond({ status: "created", joinUrl: meeting.join_url, meetingId: String(meeting.id) });
  } catch (error) {
    console.error(error);
    return respond({ error: error instanceof Error ? error.message : "Zoom meeting creation failed." }, 502);
  }
});
