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
const defaultTimeZone = "Europe/London";

type CalendarRequest = {
  timeMin?: string;
  timeMax?: string;
  timeZone?: string;
};

type GoogleEvent = {
  id?: string;
  status?: string;
  summary?: string;
  location?: string;
  htmlLink?: string;
  start?: {
    date?: string;
    dateTime?: string;
  };
  end?: {
    date?: string;
    dateTime?: string;
  };
  extendedProperties?: {
    private?: Record<string, string>;
  };
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Server configuration is missing" }, 500);
    }

    const token = bearerToken(request.headers.get("Authorization"));
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
    const { data: userData, error: userError } =
      await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return jsonResponse({ error: "Unauthorised" }, 401);
    }

    const { data: membership, error: membershipError } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (membershipError || !membership) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const body = await request.json() as CalendarRequest;
    const timeMin = parseDateTime(body.timeMin);
    const timeMax = parseDateTime(body.timeMax);
    if (!timeMin || !timeMax || timeMin >= timeMax) {
      return jsonResponse({ error: "Invalid calendar date range" }, 400);
    }
    if (timeMax.getTime() - timeMin.getTime() > 370 * 24 * 60 * 60 * 1000) {
      return jsonResponse({ error: "Calendar date range is too large" }, 400);
    }

    const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID") || "";
    const clientEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL") || "";
    const privateKey =
      Deno.env.get("GOOGLE_PRIVATE_KEY")?.replace(/\\n/g, "\n") || "";
    if (!calendarId || !clientEmail || !privateKey) {
      return jsonResponse({
        error: "calendar_not_configured",
        message: "Google Calendar credentials are not configured.",
      }, 503);
    }

    const accessToken = await createGoogleAccessToken(clientEmail, privateKey);
    const events = await fetchCalendarEvents(
      accessToken,
      calendarId,
      timeMin,
      timeMax,
      body.timeZone || defaultTimeZone,
    );

    return jsonResponse({
      events: events
        .filter((event) => event.status !== "cancelled")
        .map(toCalendarEvent)
        .filter(Boolean),
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({
      error: "calendar_events_failed",
      message: "Google Calendar events could not be loaded.",
    }, 500);
  }
});

function bearerToken(authorization: string | null) {
  if (!authorization?.startsWith("Bearer ")) return "";
  return authorization.slice("Bearer ".length).trim();
}

function parseDateTime(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toCalendarEvent(event: GoogleEvent) {
  const start = event.start?.dateTime || event.start?.date;
  const end = event.end?.dateTime || event.end?.date;
  if (!event.id || !start || !end) return null;

  const bookingRequestId =
    event.extendedProperties?.private?.bookingRequestId || null;
  const sessionType =
    event.extendedProperties?.private?.sessionType ||
    (event.summary?.toLowerCase().startsWith("joint session")
      ? "Joint session"
      : "");
  const sessionFormat =
    event.extendedProperties?.private?.sessionFormat ||
    (/cherry tree|henley-on-thames/i.test(event.location || "")
      ? "In person"
      : "");

  return {
    id: event.id,
    title: event.summary?.trim() || "Untitled event",
    start,
    end,
    allDay: Boolean(event.start?.date),
    location: event.location?.trim() || "",
    htmlLink: event.htmlLink || "",
    eventType: bookingRequestId ? "booking" : "personal",
    bookingRequestId,
    sessionType,
    sessionFormat,
  };
}

async function fetchCalendarEvents(
  accessToken: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
  timeZone: string,
) {
  const events: GoogleEvent[] = [];
  let pageToken = "";

  do {
    const url = new URL(
      `${googleEventsUrl}/${encodeURIComponent(calendarId)}/events`,
    );
    url.searchParams.set("timeMin", timeMin.toISOString());
    url.searchParams.set("timeMax", timeMax.toISOString());
    url.searchParams.set("timeZone", timeZone);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("showDeleted", "false");
    url.searchParams.set("maxResults", "2500");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`Google Calendar event list failed: ${response.status}`);
    }

    const body = await response.json();
    events.push(...(body.items || []));
    pageToken = body.nextPageToken || "";
  } while (pageToken);

  return events;
}

async function createGoogleAccessToken(
  clientEmail: string,
  privateKey: string,
) {
  const now = Math.floor(Date.now() / 1000);
  const unsignedJwt = [
    base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" })),
    base64UrlEncode(JSON.stringify({
      iss: clientEmail,
      scope: googleCalendarScope,
      aud: googleTokenUrl,
      exp: now + 3600,
      iat: now,
    })),
  ].join(".");
  const signature = await signJwt(unsignedJwt, privateKey);
  const response = await fetch(googleTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsignedJwt}.${signature}`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token request failed: ${response.status}`);
  }

  const body = await response.json();
  return body.access_token as string;
}

async function signJwt(unsignedJwt: string, privateKey: string) {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKey),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedJwt),
  );
  return base64UrlEncode(signature);
}

function base64UrlEncode(value: string | ArrayBuffer) {
  const bytes = typeof value === "string"
    ? new TextEncoder().encode(value)
    : new Uint8Array(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string) {
  const base64 = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
