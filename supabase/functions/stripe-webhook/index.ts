type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature") || "";
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
  if (!webhookSecret || !(await validStripeSignature(rawBody, signature, webhookSecret))) {
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    const event = JSON.parse(rawBody) as StripeEvent;
    const object = event.data.object;
    const bookingId = String((object.metadata as Record<string, unknown> | undefined)?.booking_id || "");
    if (!bookingId) return new Response("ok");
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      if (object.payment_status !== "paid") return new Response("ok");
      const amountReceived = Number(object.amount_total || 0) / 100;
      const booking = await loadBooking(supabaseUrl, serviceRoleKey, bookingId);
      const fullyPaid = amountReceived >= Number(booking.total_cost || booking.price || 0);
      await updateBooking(supabaseUrl, serviceRoleKey, bookingId, {
        payment_status: fullyPaid ? "paid" : "part_paid",
        amount_received: amountReceived,
        payment_date: new Date().toISOString().slice(0, 10),
        stripe_paid_at: new Date().toISOString(),
        stripe_payment_intent_id: object.payment_intent || null,
        payment_failure_message: null,
      });
      await addToCalendar(supabaseUrl, serviceRoleKey, bookingId);
    } else if (event.type === "checkout.session.expired") {
      await updateBooking(supabaseUrl, serviceRoleKey, bookingId, {
        payment_status: "expired",
        payment_failure_message: "The secure payment link expired before payment was completed.",
      });
    } else if (event.type === "checkout.session.async_payment_failed") {
      await updateBooking(supabaseUrl, serviceRoleKey, bookingId, {
        payment_status: "failed",
        payment_failure_message: "Stripe reported that the payment failed.",
      });
    }
    return new Response("ok");
  } catch (error) {
    console.error(error);
    return new Response("Webhook processing failed", { status: 500 });
  }
});

async function validStripeSignature(body: string, header: string, secret: string) {
  const parts = header.split(",").map((part) => part.split("="));
  const timestamp = parts.find(([key]) => key === "t")?.[1] || "";
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
  const expected = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return signatures.some((candidate) => constantTimeEqual(candidate, expected));
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let different = 0;
  for (let index = 0; index < left.length; index += 1) {
    different |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return different === 0;
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name) || "";
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

async function loadBooking(url: string, key: string, id: string) {
  const response = await fetch(`${url}/rest/v1/booking_requests?id=eq.${id}&select=price,total_cost`, {
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
  if (!response.ok) throw new Error("Booking payment update failed");
}

async function addToCalendar(url: string, key: string, bookingId: string) {
  const response = await fetch(`${url}/functions/v1/calendar-create-booking`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ bookingId }),
  });
  if (!response.ok) console.error("Paid booking calendar sync failed", await response.text());
}
