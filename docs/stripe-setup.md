# Stripe setup for Ayesha Jane bookings

The website code is ready for Stripe Checkout. The remaining steps connect Ayesha's
own Stripe account without exposing its secret key in the browser.

## 1. Create or finish the Stripe account

In Stripe, finish business verification and set the public business name, support
email, bank account and statement descriptor. Under **Settings → Branding**, upload
`app/assets/aj-logo-stripe.png` as the non-square **Logo**. It is an 800 × 433 PNG
prepared below Stripe's 512 KB limit. Start in Stripe test mode.

## 2. Apply the database update

From this project folder run:

```sh
/tmp/supabase db push
```

This adds payment states and Stripe references to `booking_requests`.

## 3. Store protected secrets in Supabase

Copy the test secret key from **Stripe → Developers → API keys**. Enter it only in
the terminal prompt or Supabase secret screen; never add it to `app/config.js`.

```sh
/tmp/supabase secrets set STRIPE_SECRET_KEY="sk_test_..."
/tmp/supabase secrets set PUBLIC_BOOKING_URL="https://YOUR-BOOKING-PAGE/index.html"
/tmp/supabase secrets set ADMIN_BOOKING_URL="https://YOUR-BOOKING-PAGE/ayesha.html"
```

For local testing, the two URLs may use `http://localhost:4175/index.html` and
`http://localhost:4175/ayesha.html`.

## 4. Deploy the payment and calendar functions

```sh
/tmp/supabase functions deploy stripe-create-checkout
/tmp/supabase functions deploy stripe-webhook --no-verify-jwt
/tmp/supabase functions deploy calendar-create-booking
/tmp/supabase functions deploy calendar-availability
```

The webhook deliberately uses `--no-verify-jwt` because Stripe—not a signed-in
browser—calls it. Its Stripe signature is checked before any booking is updated.

## 5. Add the Stripe webhook

In **Stripe → Developers → Webhooks**, add this endpoint:

```text
https://kxewsanwjfyitsdcvvzo.supabase.co/functions/v1/stripe-webhook
```

Subscribe to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

Copy the endpoint signing secret (`whsec_...`) and store it:

```sh
/tmp/supabase secrets set STRIPE_WEBHOOK_SECRET="whsec_..."
```

## 6. Test before accepting real money

Use Stripe test mode and card number `4242 4242 4242 4242`, any future expiry and
any three-digit CVC. Check that:

1. The requested slot is held for 30 minutes.
2. The client reaches Stripe Checkout.
3. A successful payment changes the booking to paid.
4. The appointment appears in Google Calendar only after payment.
5. A booking made from the private page reserves the appointment immediately and
   shows a Stripe payment link to send to the client.

After the test succeeds, replace `sk_test_...` with the live `sk_live_...` secret,
create the equivalent live webhook, store its live `whsec_...`, and repeat one
small live payment test.

## What is included now

- Stripe-hosted card payment page
- Stripe receipt email after successful payment (when enabled in Stripe settings)
- 30-minute slot hold while payment is pending
- paid, part-paid, pending, failed and expired booking states
- automatic payment recording and earnings totals
- Google Calendar confirmation after successful client payment
- secure payment link for bookings Ayesha creates

Automated payment-request emails and reminder emails need an email delivery
provider (for example Resend or Postmark). The Stripe link and payment status are
ready, but the current version does not email that link or chase an unpaid client
by itself.
