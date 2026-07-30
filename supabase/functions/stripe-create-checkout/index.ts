const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Booking = {
  id: string;
  booking_source: string;
  booking_type: string;
  session_type: string;
  session_format: string;
  first_name: string | null;
  surname: string | null;
  second_first_name: string | null;
  second_surname: string | null;
  email: string;
  price: number | null;
  total_cost: number | null;
  pay_now_amount: number | null;
  invoice_amount: number | null;
  block_session_count: number | null;
  block_payment_preference: string | null;
  amount_received: number | null;
  payment_status: string;
  stripe_checkout_url: string | null;
  stripe_checkout_expires_at: string | null;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { bookingId, returnUrl } = await request.json() as {
      bookingId?: string;
      returnUrl?: string;
    };
    if (!bookingId || !/^[0-9a-f-]{36}$/i.test(bookingId)) {
      return json({ error: "Invalid booking reference" }, 400);
    }

    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const stripeSecretKey = requiredEnv("STRIPE_SECRET_KEY");
    const booking = await loadBooking(supabaseUrl, serviceRoleKey, bookingId);
    if (
      booking.booking_source === "Ayesha booking for client" &&
      !(await isApprovedAdmin(request, supabaseUrl, serviceRoleKey))
    ) {
      return json({ error: "Administrator access is required" }, 403);
    }
    const existingExpiry = booking.stripe_checkout_expires_at
      ? Date.parse(booking.stripe_checkout_expires_at)
      : 0;
    if (
      booking.payment_status === "pending" &&
      booking.stripe_checkout_url &&
      existingExpiry > Date.now() + 60_000
    ) {
      return json({ url: booking.stripe_checkout_url, reused: true });
    }

    const amountPounds = Number(booking.booking_source === "Ayesha booking for client"
      ? booking.invoice_amount ?? booking.pay_now_amount ?? booking.price
      : publicPayNowAmount(booking));
    const amountPence = Math.round(amountPounds * 100);
    if (!Number.isFinite(amountPence) || amountPence < 50) {
      return json({ error: "This booking does not require a Stripe payment" }, 400);
    }

    const configuredReturnUrl = booking.booking_source === "Ayesha booking for client"
      ? Deno.env.get("ADMIN_BOOKING_URL")
      : Deno.env.get("PUBLIC_BOOKING_URL");
    const approvedBaseUrl = configuredReturnUrl || safeReturnBase(returnUrl);
    if (!approvedBaseUrl) {
      return json({ error: "PUBLIC_BOOKING_URL is not configured" }, 500);
    }
    const expiresAt = Math.floor(Date.now() / 1000) + 30 * 60;
    const description = booking.booking_type === "Block booking"
      ? `${booking.session_type} block booking`
      : `${booking.session_type} · ${booking.session_format}`;
    const params = new URLSearchParams({
      mode: "payment",
      success_url: `${approvedBaseUrl}?payment=success&booking=${booking.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${approvedBaseUrl}?payment=cancelled&booking=${booking.id}`,
      customer_email: booking.email,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "gbp",
      "line_items[0][price_data][unit_amount]": String(amountPence),
      "line_items[0][price_data][product_data][name]": description,
      "metadata[booking_id]": booking.id,
      "payment_intent_data[metadata][booking_id]": booking.id,
      expires_at: String(expiresAt),
      "automatic_tax[enabled]": "false",
      "payment_intent_data[receipt_email]": booking.email,
    });

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `booking-${booking.id}-${amountPence}`,
      },
      body: params,
    });
    const session = await stripeResponse.json();
    if (!stripeResponse.ok || !session?.id || !session?.url) {
      console.error("Stripe session error", session?.error?.message || stripeResponse.status);
      return json({ error: "Stripe could not create the secure payment page" }, 502);
    }

    await updateBooking(supabaseUrl, serviceRoleKey, booking.id, {
      payment_status: "pending",
      stripe_checkout_session_id: session.id,
      stripe_checkout_url: session.url,
      stripe_checkout_expires_at: new Date(expiresAt * 1000).toISOString(),
      payment_failure_message: null,
    });
    return json({ url: session.url, expiresAt: new Date(expiresAt * 1000).toISOString() });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Payment setup failed" }, 500);
  }
});

function safeReturnBase(value?: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.hostname !== "localhost") return "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function publicPayNowAmount(booking: Booking) {
  const standardPrice = booking.session_type === "Discovery call"
    ? 0
    : booking.session_type === "Joint session"
      ? booking.session_format === "In person" ? 165 : 150
      : booking.session_format === "In person" ? 90 : 80;
  if (booking.booking_type !== "Block booking") return standardPrice;
  return standardPrice * Math.max(1, Number(booking.block_session_count || 1));
}

async function isApprovedAdmin(request: Request, url: string, serviceKey: string) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return false;
  if (token === serviceKey) return true;
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

function requiredEnv(name: string) {
  const value = Deno.env.get(name) || "";
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

async function loadBooking(url: string, key: string, id: string): Promise<Booking> {
  const response = await fetch(`${url}/rest/v1/booking_requests?id=eq.${id}&select=*`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const rows = await response.json();
  if (!response.ok || !rows?.[0]) throw new Error("Booking not found");
  return rows[0];
}

async function updateBooking(url: string, key: string, id: string, values: object) {
  const response = await fetch(`${url}/rest/v1/booking_requests?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(values),
  });
  if (!response.ok) throw new Error("The booking payment status could not be saved");
}

function json(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
