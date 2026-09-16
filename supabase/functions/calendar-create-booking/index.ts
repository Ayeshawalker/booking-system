const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const googleTokenUrl = "https://oauth2.googleapis.com/token";
const googleFreeBusyUrl = "https://www.googleapis.com/calendar/v3/freeBusy";
const googleEventsUrl = "https://www.googleapis.com/calendar/v3/calendars";
const googleCalendarScopes = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
].join(" ");
const bookingTimeZone = "Europe/London";

type BookingRow = {
  id: string;
  session_type: string;
  session_format: string;
  booking_source: string;
  client_type: string;
  booking_type: string;
  block_session_count: number | null;
  block_date_pattern: string | null;
  block_frequency: string | null;
  block_payment_preference: string | null;
  invoice_required: boolean;
  invoice_amount: number | null;
  payment_reminder_required: boolean;
  next_payment_due_amount: number | null;
  pay_now_amount: number | null;
  payment_status?: string;
  stripe_paid_at?: string | null;
  exact_block_dates: unknown;
  duration: string;
  preferred_date: string;
  preferred_time: string;
  first_name: string | null;
  surname: string | null;
  second_first_name: string | null;
  second_surname: string | null;
  email: string;
  phone: string | null;
  message?: string | null;
  calendar_sync_status?: string;
  calendar_event_ids?: unknown;
  zoom_join_url?: string | null;
};

type CalendarSession = {
  date: string;
  time: string;
  format: string;
  durationMinutes: number;
  position: number;
  total: number;
};

type BusyPeriod = {
  start: string;
  end: string;
};

type GoogleEvent = {
  id: string;
  htmlLink?: string;
};

class GoogleApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let bookingId = "";
  let supabaseUrl = "";
  let serviceRoleKey = "";

  try {
    const body = await request.json() as { bookingId?: string };
    bookingId = body.bookingId || "";

    if (!isUuid(bookingId)) {
      return jsonResponse({ error: "Invalid booking reference" }, 400);
    }

    supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID") || "";
    const clientEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL") || "";
    const privateKey = Deno.env.get("GOOGLE_PRIVATE_KEY")?.replace(/\\n/g, "\n") || "";

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Supabase service configuration is missing" }, 500);
    }

    if (!calendarId || !clientEmail || !privateKey) {
      await updateCalendarStatus(
        supabaseUrl,
        serviceRoleKey,
        bookingId,
        "failed",
        [],
        "Google Calendar credentials are not configured.",
      );
      return jsonResponse({
        error: "calendar_not_configured",
        message: "Google Calendar credentials are not configured.",
      }, 503);
    }

    const booking = await loadBooking(supabaseUrl, serviceRoleKey, bookingId);
    const serviceRequest = request.headers.get("authorization") === `Bearer ${serviceRoleKey}`;
    if (
      booking.booking_source === "Ayesha booking for client" &&
      !serviceRequest &&
      !(await isApprovedAdmin(request, supabaseUrl, serviceRoleKey))
    ) {
      return jsonResponse({ error: "calendar_permission_required" }, 403);
    }
    if (
      booking.booking_source !== "Ayesha booking for client" &&
      booking.session_type !== "Discovery call" &&
      !booking.stripe_paid_at
    ) {
      return jsonResponse({
        error: "payment_required",
        message: "Payment must be completed before this appointment is added to the calendar.",
      }, 402);
    }
    const savedEventIds = stringArray(booking.calendar_event_ids);

    if (
      (booking.calendar_sync_status === "synced" ||
        booking.calendar_sync_status === "partial") &&
      savedEventIds.length > 0
    ) {
      return jsonResponse({
        status: booking.calendar_sync_status,
        eventIds: savedEventIds,
        eventCount: savedEventIds.length,
        createdCount: 0,
      });
    }

    const { sessions, incompleteFlexibleBlock } = buildCalendarSessions(booking);
    const accessToken = await createGoogleAccessToken(clientEmail, privateKey);
    const plannedEvents = await Promise.all(
      sessions.map(async (session, index) => {
        const eventId = await eventIdForBooking(booking.id, index);
        const existingEvent = await fetchGoogleEvent(
          accessToken,
          calendarId,
          eventId,
        );
        return { session, eventId, existingEvent };
      }),
    );

    const conflicts = await findCalendarConflicts(
      accessToken,
      calendarId,
      plannedEvents,
    );

    if (conflicts.length > 0) {
      const conflictText = conflicts
        .map((session) => `${session.date} at ${session.time}`)
        .join(", ");
      await updateCalendarStatus(
        supabaseUrl,
        serviceRoleKey,
        bookingId,
        "failed",
        savedEventIds,
        `Calendar conflict: ${conflictText}`,
      );
      return jsonResponse({
        error: "calendar_conflict",
        message: "One or more requested times are already busy in Google Calendar.",
        conflicts: conflicts.map((session) => ({
          date: session.date,
          time: session.time,
        })),
      }, 409);
    }

    const calendarEvents: GoogleEvent[] = [];
    let createdCount = 0;

    for (const plannedEvent of plannedEvents) {
      if (plannedEvent.existingEvent) {
        calendarEvents.push(plannedEvent.existingEvent);
        continue;
      }

      const calendarEvent = await insertGoogleEvent(
        accessToken,
        calendarId,
        plannedEvent.eventId,
        booking,
        plannedEvent.session,
      );
      calendarEvents.push(calendarEvent);
      createdCount += 1;
    }

    const eventIds = calendarEvents.map((event) => event.id);
    const status = incompleteFlexibleBlock ? "partial" : "synced";
    await updateCalendarStatus(
      supabaseUrl,
      serviceRoleKey,
      bookingId,
      status,
      eventIds,
      null,
    );

    return jsonResponse({
      status,
      eventIds,
      eventLinks: calendarEvents
        .map((event) => event.htmlLink)
        .filter(Boolean),
      eventCount: eventIds.length,
      createdCount,
      incompleteFlexibleBlock,
    });
  } catch (error) {
    console.error(error);

    const message = error instanceof Error ? error.message : "Unknown calendar error";
    if (supabaseUrl && serviceRoleKey && isUuid(bookingId)) {
      await updateCalendarStatus(
        supabaseUrl,
        serviceRoleKey,
        bookingId,
        "failed",
        [],
        message.slice(0, 500),
      ).catch(console.error);
    }

    if (error instanceof GoogleApiError && error.status === 403) {
      return jsonResponse({
        error: "calendar_permission_required",
        message:
          "The Google service account needs 'Make changes and see all event details' permission on this calendar.",
      }, 403);
    }

    if (error instanceof GoogleApiError) {
      return jsonResponse({
        error: "calendar_write_failed",
        message: "Google Calendar rejected the event.",
      }, 502);
    }

    return jsonResponse({
      error: "calendar_create_failed",
      message: "The booking was saved, but its calendar event could not be created.",
    }, 500);
  }
});

async function isApprovedAdmin(request: Request, url: string, serviceKey: string) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const userResponse = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${token}` },
  });
  const user = await userResponse.json();
  if (!userResponse.ok || !user?.id) return false;
  const adminResponse = await fetch(`${url}/rest/v1/admin_users?user_id=eq.${user.id}&select=user_id`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  const admins = await adminResponse.json();
  return adminResponse.ok && Boolean(admins?.[0]);
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

async function loadBooking(
  supabaseUrl: string,
  serviceRoleKey: string,
  bookingId: string,
) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/booking_requests?id=eq.${encodeURIComponent(bookingId)}&select=*`,
    {
      headers: serviceHeaders(serviceRoleKey),
    },
  );

  if (!response.ok) {
    throw new Error(`Booking lookup failed: ${response.status}`);
  }

  const rows = await response.json() as BookingRow[];
  if (!rows[0]) {
    throw new Error("Booking request was not found.");
  }

  return rows[0];
}

async function updateCalendarStatus(
  supabaseUrl: string,
  serviceRoleKey: string,
  bookingId: string,
  status: string,
  eventIds: string[],
  errorMessage: string | null,
) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/booking_requests?id=eq.${encodeURIComponent(bookingId)}`,
    {
      method: "PATCH",
      headers: {
        ...serviceHeaders(serviceRoleKey),
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        calendar_sync_status: status,
        calendar_event_ids: eventIds,
        calendar_sync_error: errorMessage,
        calendar_synced_at: status === "synced" || status === "partial"
          ? new Date().toISOString()
          : null,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Calendar status update failed: ${response.status}`);
  }
}

function serviceHeaders(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };
}

function buildCalendarSessions(booking: BookingRow) {
  const durationMinutes = durationForSession(booking.session_type, booking.duration);
  const exactDates = parseExactBlockDates(booking.exact_block_dates);
  const sessionCount = Math.min(Math.max(Number(booking.block_session_count) || 1, 1), 20);
  let rawSessions: Array<{ date: string; time: string; format: string }> = [];
  let incompleteFlexibleBlock = false;

  if (booking.booking_type !== "Block booking") {
    rawSessions = [{
      date: booking.preferred_date,
      time: booking.preferred_time,
      format: booking.session_format,
    }];
  } else if (booking.block_date_pattern === "Flexible dates" && exactDates.length > 0) {
    rawSessions = exactDates;
  } else if (booking.block_date_pattern === "Regular pattern") {
    const gapDays = booking.block_frequency === "Fortnightly" ? 14 : 7;
    rawSessions = Array.from({ length: sessionCount }, (_, index) => ({
      date: addDays(booking.preferred_date, gapDays * index),
      time: booking.preferred_time,
      format: booking.session_format,
    }));
  } else {
    rawSessions = [{
      date: booking.preferred_date,
      time: booking.preferred_time,
      format: booking.session_format,
    }];
    incompleteFlexibleBlock = sessionCount > 1;
  }

  const sessions = rawSessions.map((session, index) => {
    if (
      !isIsoDate(session.date) ||
      !isTime(session.time) ||
      !isAllowedFormat(session.format)
    ) {
      throw new Error("The booking contains an invalid date, time or format.");
    }

    return {
      ...session,
      durationMinutes,
      position: index + 1,
      total: rawSessions.length,
    };
  });

  const uniqueSlots = new Set(
    sessions.map((session) => `${session.date}|${session.time}`),
  );
  if (uniqueSlots.size !== sessions.length) {
    throw new Error("The block booking contains duplicate dates and times.");
  }

  return { sessions, incompleteFlexibleBlock };
}

function parseExactBlockDates(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const dateItem = item as Record<string, unknown>;
      return {
        date: String(dateItem.date || ""),
        time: String(dateItem.time || ""),
        format: String(dateItem.format || ""),
      };
    })
    .filter((item) => item.date && item.time && item.format);
}

function durationForSession(sessionType: string, storedDuration: string) {
  if (sessionType === "Discovery call") return 15;
  if (sessionType === "Joint session") return 80;
  if (sessionType === "Individual session") return 50;

  const fallback = Number.parseInt(storedDuration, 10);
  if (!Number.isFinite(fallback) || fallback < 5 || fallback > 120) {
    throw new Error("The booking contains an invalid duration.");
  }
  return fallback;
}

async function findCalendarConflicts(
  accessToken: string,
  calendarId: string,
  plannedEvents: Array<{
    session: CalendarSession;
    eventId: string;
    existingEvent: GoogleEvent | null;
  }>,
) {
  const sessionsToCheck = plannedEvents.filter((event) => !event.existingEvent);
  if (sessionsToCheck.length === 0) return [];

  const sortedDates = sessionsToCheck
    .map((event) => event.session.date)
    .sort();
  const timeMin = zonedDateTimeToUtc(sortedDates[0], "00:00", bookingTimeZone);
  const timeMax = zonedDateTimeToUtc(
    addDays(sortedDates[sortedDates.length - 1], 1),
    "00:00",
    bookingTimeZone,
  );
  const busyPeriods = await fetchBusyPeriods(
    accessToken,
    calendarId,
    timeMin,
    timeMax,
  );
  const conflicts = new Map<string, CalendarSession>();

  sessionsToCheck.forEach(({ session }) => {
    const sessionStart = zonedDateTimeToUtc(
      session.date,
      session.time,
      bookingTimeZone,
    );
    const sessionEnd = new Date(
      sessionStart.getTime() + session.durationMinutes * 60 * 1000,
    );
    const bufferMinutes = bufferForFormat(session.format);

    const hasBusyConflict = busyPeriods.some((busyPeriod) => {
      const busyStart = new Date(busyPeriod.start);
      const busyEnd = new Date(busyPeriod.end);
      return overlapsWithBuffer(
        sessionStart,
        sessionEnd,
        bufferMinutes,
        busyStart,
        busyEnd,
      );
    });

    if (hasBusyConflict) {
      conflicts.set(`${session.date}|${session.time}`, session);
    }
  });

  for (let firstIndex = 0; firstIndex < sessionsToCheck.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < sessionsToCheck.length;
      secondIndex += 1
    ) {
      const first = sessionsToCheck[firstIndex].session;
      const second = sessionsToCheck[secondIndex].session;
      const firstStart = zonedDateTimeToUtc(first.date, first.time, bookingTimeZone);
      const secondStart = zonedDateTimeToUtc(second.date, second.time, bookingTimeZone);
      const firstEnd = new Date(
        firstStart.getTime() + first.durationMinutes * 60 * 1000,
      );
      const secondEnd = new Date(
        secondStart.getTime() + second.durationMinutes * 60 * 1000,
      );
      const bufferMinutes = Math.max(
        bufferForFormat(first.format),
        bufferForFormat(second.format),
      );

      if (
        overlapsWithBuffer(
          firstStart,
          firstEnd,
          bufferMinutes,
          secondStart,
          secondEnd,
        )
      ) {
        conflicts.set(`${first.date}|${first.time}`, first);
        conflicts.set(`${second.date}|${second.time}`, second);
      }
    }
  }

  return Array.from(conflicts.values());
}

function overlapsWithBuffer(
  firstStart: Date,
  firstEnd: Date,
  bufferMinutes: number,
  secondStart: Date,
  secondEnd: Date,
) {
  const bufferMilliseconds = bufferMinutes * 60 * 1000;
  return (
    firstStart.getTime() < secondEnd.getTime() + bufferMilliseconds &&
    firstEnd.getTime() + bufferMilliseconds > secondStart.getTime()
  );
}

function bufferForFormat(format: string) {
  return format === "In person" ? 0 : 15;
}

async function fetchBusyPeriods(
  accessToken: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
) {
  const response = await fetch(googleFreeBusyUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      timeZone: bookingTimeZone,
      items: [{ id: calendarId }],
    }),
  });

  if (!response.ok) {
    throw await googleApiError(response, "Google Calendar availability check failed");
  }

  const body = await response.json();
  return (body.calendars?.[calendarId]?.busy || []) as BusyPeriod[];
}

async function fetchGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
) {
  const response = await fetch(
    `${googleEventsUrl}/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (response.status === 404 || response.status === 410) return null;
  if (!response.ok) {
    throw await googleApiError(response, "Google Calendar event lookup failed");
  }

  return await response.json() as GoogleEvent;
}

async function insertGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  booking: BookingRow,
  session: CalendarSession,
) {
  const start = zonedDateTimeToUtc(session.date, session.time, bookingTimeZone);
  const end = new Date(start.getTime() + session.durationMinutes * 60 * 1000);
  const response = await fetch(
    `${googleEventsUrl}/${encodeURIComponent(calendarId)}/events?sendUpdates=none`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: eventId,
        summary: calendarEventSummary(booking),
        description: calendarEventDescription(booking, session),
        location: calendarEventLocation(session.format),
        start: {
          dateTime: start.toISOString(),
          timeZone: bookingTimeZone,
        },
        end: {
          dateTime: end.toISOString(),
          timeZone: bookingTimeZone,
        },
        visibility: "private",
        transparency: "opaque",
        reminders: { useDefault: true },
        extendedProperties: {
          private: {
            bookingRequestId: booking.id,
            bookingSource: booking.booking_source,
            sessionType: booking.session_type,
            sessionFormat: session.format,
          },
        },
      }),
    },
  );

  if (response.status === 409) {
    const existingEvent = await fetchGoogleEvent(accessToken, calendarId, eventId);
    if (existingEvent) return existingEvent;
  }

  if (!response.ok) {
    throw await googleApiError(response, "Google Calendar event creation failed");
  }

  return await response.json() as GoogleEvent;
}

function calendarEventSummary(booking: BookingRow) {
  const clientName = formatClientNames(booking) || booking.email || "Client";
  if (String(booking.message || "").startsWith("Solo session within couples work.")) {
    return `Solo session (couples work): ${clientName}`;
  }
  return `${booking.session_type}: ${clientName}`;
}

function calendarEventDescription(
  booking: BookingRow,
  session: CalendarSession,
) {
  const details = [
    `Client: ${formatClientNames(booking) || "Name not supplied"}`,
    `Email: ${booking.email}`,
    booking.phone ? `Telephone: ${booking.phone}` : "",
    `Format: ${session.format}`,
    session.format === "Online" && booking.zoom_join_url ? `Zoom: ${booking.zoom_join_url}` : "",
    `Duration: ${session.durationMinutes} minutes`,
    `Booked via: ${booking.booking_source}`,
    `Booking reference: ${booking.id}`,
  ];

  if (booking.booking_type === "Block booking") {
    details.push(`Block session: ${session.position} of ${session.total}`);
    if (booking.block_payment_preference) {
      details.push(`Payment preference: ${booking.block_payment_preference}`);
    }
  }

  if (booking.invoice_required && booking.invoice_amount !== null) {
    details.push(`Invoice required: GBP ${booking.invoice_amount}`);
  }

  if (
    booking.payment_reminder_required &&
    booking.next_payment_due_amount !== null
  ) {
    details.push(
      `Next-session payment reminder: GBP ${booking.next_payment_due_amount}`,
    );
  }

  return details.filter(Boolean).join("\n");
}

function calendarEventLocation(format: string) {
  if (format === "In person") {
    return "Cherry Tree Therapy Centre, Henley-on-Thames";
  }
  if (format === "Telephone call") return "Telephone";
  return "Online";
}

function formatClientNames(booking: BookingRow) {
  const firstClient = [booking.first_name, booking.surname]
    .filter(Boolean)
    .join(" ")
    .trim();
  const secondClient = [booking.second_first_name, booking.second_surname]
    .filter(Boolean)
    .join(" ")
    .trim();

  return [firstClient, secondClient].filter(Boolean).join(" and ");
}

async function createGoogleAccessToken(clientEmail: string, privateKey: string) {
  const now = Math.floor(Date.now() / 1000);
  const jwtHeader = { alg: "RS256", typ: "JWT" };
  const jwtClaim = {
    iss: clientEmail,
    scope: googleCalendarScopes,
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
  const response = await fetch(googleTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    throw new GoogleApiError(response.status, "Google access token request failed");
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

async function eventIdForBooking(bookingId: string, index: number) {
  const source = new TextEncoder().encode(`${bookingId}:${index}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", source));
  return `b${Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function googleApiError(response: Response, fallback: string) {
  let details = "";
  try {
    const body = await response.clone().json();
    details = body?.error?.message || body?.error_description || "";
  } catch {
    details = "";
  }

  return new GoogleApiError(
    response.status,
    details ? `${fallback}: ${details}` : `${fallback}: ${response.status}`,
  );
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

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const nextDate = new Date(Date.UTC(year, month - 1, day + days, 12));
  return nextDate.toISOString().slice(0, 10);
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value);
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

function isAllowedFormat(value: string) {
  return ["Online", "In person", "Telephone call", "Zoom call"].includes(value);
}
