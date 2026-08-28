import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const googleTokenUrl = "https://oauth2.googleapis.com/token";
const googleEventsUrl = "https://www.googleapis.com/calendar/v3/calendars";
const googleCalendarScope = "https://www.googleapis.com/auth/calendar.events";
const timeZone = "Europe/London";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Server configuration is missing" }, 500);
    }

    const authorization = request.headers.get("Authorization") || "";
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Unauthorised" }, 401);

    const { data: membership } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!membership) return json({ error: "Forbidden" }, 403);

    const body = await request.json() as {
      action?: "reschedule" | "cancel" | "create_private" | "update_private" | "resize_event" | "delete_private";
      bookingId?: string;
      eventId?: string;
      date?: string;
      time?: string;
      sessionFormat?: string;
      title?: string;
      durationMinutes?: number;
      allDay?: boolean;
      note?: string;
    };
    const action = body.action || "reschedule";
    const bookingId = body.bookingId || "";
    const eventId = body.eventId || "";
    const date = body.date || "";
    const time = body.time || "";
    const sessionFormat = body.sessionFormat || "";
    const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID") || "";
    const clientEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL") || "";
    const privateKey =
      Deno.env.get("GOOGLE_PRIVATE_KEY")?.replace(/\\n/g, "\n") || "";

    if (action === "delete_private") {
      if (!eventId) return json({ error: "Invalid private event reference" }, 400);
      if (!calendarId || !clientEmail || !privateKey) {
        return json({ error: "Google Calendar is not configured" }, 503);
      }
      const accessToken = await createGoogleAccessToken(clientEmail, privateKey);
      const response = await fetch(
        `${googleEventsUrl}/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
        { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!response.ok && ![404, 410].includes(response.status)) {
        return json({ error: "Google Calendar could not remove the private event" }, 502);
      }
      return json({
        status: "cancelled",
        message: "Private event cancelled and removed from Google Calendar.",
      });
    }

    if (action === "resize_event") {
      const durationMinutes = Number(body.durationMinutes || 0);
      if (!eventId || !isDate(date) || !isTime(time) || durationMinutes < 30 || durationMinutes > 720) {
        return json({ error: "Invalid event length" }, 400);
      }
      if (!calendarId || !clientEmail || !privateKey) {
        return json({ error: "Google Calendar is not configured" }, 503);
      }
      const start = zonedDateTimeToUtc(date, time, timeZone);
      const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
      const accessToken = await createGoogleAccessToken(clientEmail, privateKey);
      const response = await fetch(
        `${googleEventsUrl}/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ end: { dateTime: end.toISOString(), timeZone } }),
        },
      );
      if (!response.ok) return json({ error: "Google Calendar rejected the new length" }, 502);
      return json({ status: "resized", message: "Private event length updated." });
    }

    if (action === "update_private") {
      const title = String(body.title || "").trim();
      const durationMinutes = Number(body.durationMinutes || 0);
      if (!eventId || !title || title.length > 160 || !isDate(date) || !isTime(time) || durationMinutes < 1 || durationMinutes > 525600) {
        return json({ error: "Invalid private event details" }, 400);
      }
      if (!calendarId || !clientEmail || !privateKey) {
        return json({ error: "Google Calendar is not configured" }, 503);
      }
      const start = zonedDateTimeToUtc(date, time, timeZone);
      const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
      const accessToken = await createGoogleAccessToken(clientEmail, privateKey);
      const response = await fetch(
        `${googleEventsUrl}/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            summary: title,
            start: { dateTime: start.toISOString(), timeZone },
            end: { dateTime: end.toISOString(), timeZone },
          }),
        },
      );
      if (!response.ok) return json({ error: "Google Calendar rejected the event changes" }, 502);
      return json({ status: "updated", message: "Private event updated in Google Calendar." });
    }

    if (action === "create_private") {
      const title = String(body.title || "").trim();
      const durationMinutes = Number(body.durationMinutes || 60);
      const allDay = Boolean(body.allDay);
      if (
        !title || title.length > 160 || !isDate(date) ||
        (!allDay && !isTime(time)) || durationMinutes < 1 || durationMinutes > 525600
      ) return json({ error: "Invalid private event details" }, 400);
      if (!calendarId || !clientEmail || !privateKey) {
        return json({ error: "Google Calendar is not configured" }, 503);
      }
      const start = allDay ? dateFromDateKey(date) : zonedDateTimeToUtc(date, time, timeZone);
      const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
      const accessToken = await createGoogleAccessToken(clientEmail, privateKey);
      const response = await fetch(
        `${googleEventsUrl}/${encodeURIComponent(calendarId)}/events?sendUpdates=none`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary: title,
            description: String(body.note || "").trim(),
            start: allDay
              ? { date }
              : { dateTime: start.toISOString(), timeZone },
            end: allDay
              ? { date: utcDateKey(end) }
              : { dateTime: end.toISOString(), timeZone },
            extendedProperties: { private: { ayeshaEventType: "personal" } },
          }),
        },
      );
      if (!response.ok) return json({ error: "Google Calendar rejected the event" }, 502);
      const created = await response.json();
      return json({ status: "created", eventId: created.id, message: "Private event added." });
    }

    if (!isUuid(bookingId)) return json({ error: "Invalid booking reference" }, 400);
    if (
      action === "reschedule" &&
      (!isDate(date) || !isTime(time) || !["Online", "In person"].includes(sessionFormat))
    ) {
      return json({ error: "Invalid reschedule details" }, 400);
    }

    const { data: booking, error: bookingError } = await supabase
      .from("booking_requests")
      .select(
        "id, booking_type, session_type, duration, calendar_event_ids, calendar_sync_status",
      )
      .eq("id", bookingId)
      .maybeSingle();
    if (bookingError || !booking) return json({ error: "Booking not found" }, 404);
    if (action === "reschedule" && booking.booking_type !== "Single session") {
      return json({
        error: "block_booking_not_supported",
        message: "Block bookings must currently be rescheduled one session at a time in Google Calendar.",
      }, 409);
    }

    const savedEventIds = Array.isArray(booking.calendar_event_ids)
      ? booking.calendar_event_ids.filter((item): item is string =>
        typeof item === "string"
      )
      : [];
    if (eventId && !savedEventIds.includes(eventId)) {
      return json({ error: "The calendar event does not belong to this booking" }, 403);
    }

    if (action === "cancel") {
      if (savedEventIds.length && (!calendarId || !clientEmail || !privateKey)) {
        return json({ error: "Google Calendar is not configured" }, 503);
      }
      if (savedEventIds.length) {
        const accessToken = await createGoogleAccessToken(clientEmail, privateKey);
        for (const savedEventId of savedEventIds) {
          const response = await fetch(
            `${googleEventsUrl}/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(savedEventId)}?sendUpdates=none`,
            { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
          );
          if (!response.ok && ![404, 410].includes(response.status)) {
            return json({ error: "Google Calendar could not remove the booking" }, 502);
          }
        }
      }
      const { error: closeError } = await supabase.from("booking_requests").update({
        status: "closed",
        calendar_event_ids: [],
        calendar_sync_status: "synced",
        calendar_sync_error: null,
        invoice_required: false,
      }).eq("id", bookingId);
      if (closeError) return json({ error: "The booking record could not be cancelled" }, 500);
      const { data: invoices } = await supabase.from("invoices")
        .select("id, status").eq("booking_id", bookingId);
      const cancellableIds = (invoices || [])
        .filter((invoice) => String(invoice.status).toLowerCase() !== "paid")
        .map((invoice) => invoice.id);
      if (cancellableIds.length) {
        await supabase.from("invoices").update({ status: "Cancelled" })
          .in("id", cancellableIds);
      }
      return json({ status: "cancelled", message: "Booking cancelled and removed from Google Calendar." });
    }

    const requestedDuration = Number(body.durationMinutes || 0);
    const duration =
      (requestedDuration >= 30 && requestedDuration <= 720 ? requestedDuration : 0) ||
      Number.parseInt(booking.duration, 10) ||
      (booking.session_type === "Joint session" ? 80 : 50);
    const start = zonedDateTimeToUtc(date, time, timeZone);
    const end = new Date(start.getTime() + duration * 60 * 1000);

    if (eventId) {
      if (!calendarId || !clientEmail || !privateKey) {
        return json({ error: "Google Calendar is not configured" }, 503);
      }
      const accessToken = await createGoogleAccessToken(clientEmail, privateKey);
      const response = await fetch(
        `${googleEventsUrl}/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            start: { dateTime: start.toISOString(), timeZone },
            end: { dateTime: end.toISOString(), timeZone },
            location: sessionFormat === "In person"
              ? "Cherry Tree Therapy Centre, Henley-on-Thames"
              : "Online",
          }),
        },
      );
      if (!response.ok) {
        return json({ error: "Google Calendar rejected the new time" }, 502);
      }
    }

    const { error: updateError } = await supabase
      .from("booking_requests")
      .update({
        preferred_date: date,
        preferred_time: time,
        session_format: sessionFormat,
        duration: `${duration} minutes`,
        calendar_sync_error: eventId ? null : "Waiting to be added to Google Calendar.",
      })
      .eq("id", bookingId);
    if (updateError) return json({ error: "The booking record could not be updated" }, 500);

    return json({
      status: "rescheduled",
      message: eventId
        ? "Booking and Google Calendar updated."
        : "Booking updated. Google Calendar still needs attention.",
    });
  } catch (error) {
    console.error(error);
    return json({ error: "The booking could not be rescheduled" }, 500);
  }
});

async function createGoogleAccessToken(clientEmail: string, privateKey: string) {
  const now = Math.floor(Date.now() / 1000);
  const unsignedJwt = [
    base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" })),
    base64Url(JSON.stringify({
      iss: clientEmail,
      scope: googleCalendarScope,
      aud: googleTokenUrl,
      exp: now + 3600,
      iat: now,
    })),
  ].join(".");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemBuffer(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedJwt),
  );
  const response = await fetch(googleTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsignedJwt}.${base64Url(signature)}`,
    }),
  });
  if (!response.ok) throw new Error("Google authentication failed");
  return (await response.json()).access_token as string;
}

function zonedDateTimeToUtc(date: string, time: string, zone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const first = new Date(guess.getTime() - zoneOffset(guess, zone));
  return new Date(guess.getTime() - zoneOffset(first, zone));
}

function dateFromDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function utcDateKey(value: Date) {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

function zoneOffset(date: Date, zone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  ) - date.getTime();
}

function base64Url(value: string | ArrayBuffer) {
  const bytes = typeof value === "string"
    ? new TextEncoder().encode(value)
    : new Uint8Array(value);
  let binary = "";
  bytes.forEach((byte) => binary += String.fromCharCode(byte));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemBuffer(pem: string) {
  const binary = atob(
    pem.replace("-----BEGIN PRIVATE KEY-----", "")
      .replace("-----END PRIVATE KEY-----", "")
      .replace(/\s/g, ""),
  );
  return Uint8Array.from(binary, (character) => character.charCodeAt(0)).buffer;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value);
}

function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
