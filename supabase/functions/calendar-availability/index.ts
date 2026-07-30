const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const googleTokenUrl = "https://oauth2.googleapis.com/token";
const googleFreeBusyUrl = "https://www.googleapis.com/calendar/v3/freeBusy";
const googleCalendarScope = "https://www.googleapis.com/auth/calendar.freebusy";

type AvailabilityRequest = {
  date?: string;
  slots?: string[];
  durationMinutes?: number;
  bufferMinutes?: number;
  timeZone?: string;
};

type BusyPeriod = {
  start: string;
  end: string;
};

Deno.serve(async (request) => {
  try {
    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID");
    const clientEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
    const privateKey = Deno.env.get("GOOGLE_PRIVATE_KEY")?.replace(/\\n/g, "\n");

    if (!calendarId || !clientEmail || !privateKey) {
      return jsonResponse({ configured: false, busySlots: [] });
    }

    const body = await request.json() as AvailabilityRequest;
    const date = body.date || "";
    const slots = Array.isArray(body.slots) ? body.slots : [];
    const durationMinutes = Number(body.durationMinutes || 50);
    const bufferMinutes = Number(body.bufferMinutes || 15);
    const timeZone = body.timeZone || "Europe/London";

    if (!isIsoDate(date) || slots.some((slot) => !isTime(slot))) {
      return jsonResponse({ error: "Invalid date or slot format" }, 400);
    }

    const dayStart = zonedDateTimeToUtc(date, "00:00", timeZone);
    const nextDay = addDays(date, 1);
    const dayEnd = zonedDateTimeToUtc(nextDay, "00:00", timeZone);
    const accessToken = await createGoogleAccessToken(clientEmail, privateKey);
    const busyPeriods = await fetchBusyPeriods(
      accessToken,
      calendarId,
      dayStart,
      dayEnd,
      timeZone,
    );
    const bookingPeriods = await fetchReservedBookingPeriods(date, timeZone);
    busyPeriods.push(...bookingPeriods);

    const busySlots = slots.filter((slot) => {
      const slotStart = zonedDateTimeToUtc(date, slot, timeZone);
      const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);

      return busyPeriods.some((busyPeriod) => {
        const busyStart = new Date(busyPeriod.start);
        const busyEnd = new Date(busyPeriod.end);
        const bufferedBusyEnd = new Date(
          busyEnd.getTime() + bufferMinutes * 60 * 1000,
        );
        const bufferedSlotEnd = new Date(
          slotEnd.getTime() + bufferMinutes * 60 * 1000,
        );

        return slotStart < bufferedBusyEnd && bufferedSlotEnd > busyStart;
      });
    });

    return jsonResponse({ configured: true, busySlots });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Calendar availability check failed" }, 500);
  }
});

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function fetchReservedBookingPeriods(date: string, timeZone: string): Promise<BusyPeriod[]> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) return [];
  const select = "preferred_date,preferred_time,duration,payment_status,stripe_checkout_expires_at,calendar_sync_status";
  const response = await fetch(
    `${supabaseUrl}/rest/v1/booking_requests?preferred_date=eq.${date}&select=${select}`,
    { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } },
  );
  if (!response.ok) return [];
  const rows = await response.json() as Array<Record<string, unknown>>;
  return rows.filter((row) => {
    if (["synced", "partial"].includes(String(row.calendar_sync_status))) return true;
    return row.payment_status === "pending" &&
      Date.parse(String(row.stripe_checkout_expires_at || "")) > Date.now();
  }).map((row) => {
    const start = zonedDateTimeToUtc(date, String(row.preferred_time).slice(0, 5), timeZone);
    const minutes = Number(String(row.duration || "50").match(/\d+/)?.[0] || 50);
    return { start: start.toISOString(), end: new Date(start.getTime() + minutes * 60_000).toISOString() };
  });
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const nextDate = new Date(Date.UTC(year, month - 1, day + days, 12));
  return nextDate.toISOString().slice(0, 10);
}

async function createGoogleAccessToken(clientEmail: string, privateKey: string) {
  const now = Math.floor(Date.now() / 1000);
  const jwtHeader = { alg: "RS256", typ: "JWT" };
  const jwtClaim = {
    iss: clientEmail,
    scope: googleCalendarScope,
    aud: googleTokenUrl,
    exp: now + 3600,
    iat: now,
  };
  const unsignedJwt = [
    base64UrlEncode(JSON.stringify(jwtHeader)),
    base64UrlEncode(JSON.stringify(jwtClaim)),
  ].join(".");
  const signature = await signJwt(unsignedJwt, privateKey);
  const jwt = `${unsignedJwt}.${signature}`;
  const tokenResponse = await fetch(googleTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Google token request failed: ${tokenResponse.status}`);
  }

  const tokenBody = await tokenResponse.json();
  return tokenBody.access_token as string;
}

async function fetchBusyPeriods(
  accessToken: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
  timeZone: string,
) {
  const freeBusyResponse = await fetch(googleFreeBusyUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      timeZone,
      items: [{ id: calendarId }],
    }),
  });

  if (!freeBusyResponse.ok) {
    throw new Error(`Google free/busy request failed: ${freeBusyResponse.status}`);
  }

  const freeBusyBody = await freeBusyResponse.json();
  return (freeBusyBody.calendars?.[calendarId]?.busy || []) as BusyPeriod[];
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

function zonedDateTimeToUtc(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const firstOffset = getTimeZoneOffset(utcGuess, timeZone);
  const firstResult = new Date(utcGuess.getTime() - firstOffset);
  const secondOffset = getTimeZoneOffset(firstResult, timeZone);

  return new Date(utcGuess.getTime() - secondOffset);
}

function getTimeZoneOffset(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const localAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );

  return localAsUtc - date.getTime();
}
