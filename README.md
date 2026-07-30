# Ayesha Jane Booking System

This is the first simple version of the booking system.

It lets someone:

* choose an individual session, joint session or discovery call
* choose online or in-person for therapy sessions
* see the session price before submitting
* choose telephone or Zoom for discovery calls
* collect both people's names for joint sessions
* move through the form in order, with later sections greyed out until earlier required details are complete
* choose a preferred date and time, with start times offered every 15 minutes
* show in-person times to public clients only on the days Ayesha selects for that week
* let Ayesha book in-person sessions on any day from her internal page
* choose whether they are a new or existing client
* let existing clients request a single session or block booking
* let Ayesha use a separate internal page to book single or block sessions on behalf of a client
* remember client names, emails and phone numbers on Ayesha's internal page after they have been entered once
* record block booking frequency, number of sessions, payment preference and cancellation-policy acknowledgement
* let block bookings use either a regular weekly/fortnightly pattern or flexible dates to be agreed
* let Ayesha enter exact dates, times and formats for flexible block bookings when they are already known
* show total cost, pay-now amount and remaining balance for block bookings
* create a secure Stripe payment link for bookings entered by Ayesha
* flag block bookings that need a payment reminder before each upcoming unpaid session
* show proposed weekly or fortnightly block dates in the booking summary
* draft client notes on a separate internal notes page and automatically tidy rough notes into a clearer structure
* keep a private, searchable client directory for individuals and couples
* track contract and intake-form progress, support areas, usual frequency, preferred format and the agreed fee for each individual or couple
* start a private booking directly from a client record, with contact details, individual/couple session type, usual format and agreed fee prefilled
* protect every internal page with Ayesha's approved Supabase account and password
* show connected Google Calendar events in private day, week and month views, with bookings distinguished from personal events
* enter their contact details
* submit a booking request
* keep at least 15 minutes between online, telephone and Zoom appointments
* allow in-person appointments without an extra buffer
* block out start times that overlap busy events in Ayesha's Google Calendar when the Supabase calendar function is configured

Supabase is configured for this project. Booking requests are sent to the
`booking_requests` table and new bookings are added to Google Calendar by the
deployed Edge Functions. Browser storage remains as a local fallback.

Stripe Checkout payment support is implemented. See
`docs/stripe-setup.md` for the protected account connection and test steps.
Automated email sending is not connected yet.

## Current prices

* Individual online session: £80
* Individual in-person session: £90 at Cherry Tree Therapy Centre, Henley-on-Thames
* Joint online session: £150
* Joint in-person session: £165 at Cherry Tree Therapy Centre, Henley-on-Thames
* Discovery call: free

## How to open it

Double-click `Open Client Booking Page.command` for the public booking form.

Double-click `Open Ayesha Admin.command` for the private admin area. Sign in
with `ayeshajane67@gmail.com` and your private password. The admin navigation
contains:

* **Clients** - private client directory and paperwork/session preferences
* **Calendar** - day, week and month views of bookings and personal Google Calendar events
* **Bookings** - book single or block sessions on a client's behalf
* **Settings** - in-person availability and days off
* **Notes** - local notes prototype
* **Public page** - the client-facing booking form

The `.command` files start a small local web server automatically and open the
correct page in the browser.

## Client notes prototype

The notes page lets Ayesha enter a client reference, note type, rough note and improved note. The "Improve note" button currently tidies the rough text locally by grouping lines into summary, follow-up, admin/practical and review-before-filing sections.

Because this page is intended for Ayesha only, the day-to-day screen has one private-use acknowledgement before saving or improving notes:

* the notes page is private and for Ayesha only
* AI-improved text will be reviewed before saving

There is also an optional review date field for retention housekeeping.

Saved notes are stored in this browser's local storage only. They are not secure clinical records, are not shared across devices and should not be used with real client information until authentication, storage security, retention rules, consent/privacy information and GDPR handling have been properly reviewed.

See `docs/gdpr-client-notes.md` for the project checklist and production direction.

If a secure server-side AI function is added later, set `clientNoteImproveFunction` in `app/config.js` to the Supabase Edge Function name. Keep any AI provider API keys server-side; never paste them into browser files.

## Supabase

The app is linked to Supabase project `kxewsanwjfyitsdcvvzo`. Its public Project
URL and anon key are already in `app/config.js`. Database changes are kept in
`supabase/migrations`.

The file should look like this:

```js
window.BOOKING_CONFIG = {
  supabaseUrl: "https://your-project-id.supabase.co",
  supabaseAnonKey: "your-public-anon-key",
  calendarAvailabilityFunction: "calendar-availability",
  calendarCreateFunction: "calendar-create-booking",
  calendarEventsFunction: "calendar-events",
  clientNoteImproveFunction: "improve-client-note",
  timeZone: "Europe/London",
};
```

Never paste the Supabase `service_role` or secret key into any file under
`app/`. Browser code must contain only the public anon key.

## Private admin security

The approved administrator is `ayeshajane67@gmail.com`. Internal pages check:

* that the user is signed into Supabase Auth
* that the account appears in `admin_users`

Client records are stored in `clients` with Row Level Security. Anonymous
visitors have no table privileges. Changes are recorded in
`client_audit_log`, and the admin session signs out after 30 minutes without
activity.

## Google Calendar availability setup

Google Calendar credentials must stay server-side. This project includes a Supabase Edge Function at `supabase/functions/calendar-availability/index.ts` that uses Google Calendar FreeBusy to return blocked booking times to the browser.

1. Create a Google Cloud service account.
2. Enable the Google Calendar API for the Google Cloud project.
3. Create a service account JSON key.
4. Share Ayesha's Google Calendar with the service account email and choose **Make changes and see all event details**. This lets the booking system check availability and add appointments, but it does not invite clients or email them from Google.
5. In Supabase, set these Edge Function secrets:

```sh
supabase secrets set GOOGLE_CALENDAR_ID="your-calendar-id"
supabase secrets set GOOGLE_SERVICE_ACCOUNT_EMAIL="service-account@project.iam.gserviceaccount.com"
supabase secrets set GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

6. Deploy the function:

```sh
supabase functions deploy calendar-availability
supabase functions deploy calendar-create-booking
supabase functions deploy calendar-events
```

7. Check that Supabase can see the function:

```sh
supabase functions list
```

If the booking form says the `calendar-availability` Supabase function has not been deployed, run the deploy command again for the Supabase project used in `app/config.js`.

The browser config in `app/config.js` already points to the availability, calendar creation and private calendar-reading functions and uses `Europe/London` as the booking time zone. The Calendar admin page requires an approved signed-in administrator. It shows event titles, times and locations but does not read descriptions. Booking events use deterministic IDs to prevent duplicates and do not include the optional client message.

## In-person availability setup

Ayesha's internal settings page includes an in-person days panel. Choose a week, tick the dates when public clients can book in-person sessions, then save. The public booking page only offers in-person times on those selected dates.

The settings page also includes a days-off panel. Add a single date or a date range when public clients should not be able to book any sessions. Those dates are greyed out on the public calendar.

This uses the `in_person_availability` and `public_unavailable_dates` tables.
Only the authenticated, approved administrator can change these settings. The
public page can read only the availability needed to present bookable dates.

## Current limitations

* Bookings started with **Book** on the Clients page are linked to that Supabase client record. Contacts typed manually into `app/ayesha.html` are still remembered only in that browser and do not automatically create or update a client record.
* Client notes on `app/notes.html` are stored in this browser only for now. This is not enough for production GDPR compliance or clinical record keeping.
* The 15-minute appointment buffer is checked against bookings saved on this device and Google Calendar events for online, telephone and Zoom sessions. For example, a 9:00 50-minute online session blocks starts until 10:15 because the session ends at 9:50, then a 15-minute buffer is required, and starts are offered on quarter-hour times. In-person sessions do not add this extra buffer, so a 9:00 50-minute in-person session can be followed by a 10:00 session.
* Block booking payment can be taken through Stripe. Flexible blocks still require every date to be agreed before all calendar appointments can be created.
* Proposed block dates are calculated for regular-pattern block bookings. On Ayesha's internal page, flexible block bookings can also store exact agreed dates and times.
* Secure Stripe payment links are created, avoiding Stripe Invoicing. Automated delivery of those links still needs an email provider.
* Payment reminders are currently recorded as data only. The system does not yet send reminder emails automatically.
* Ayesha is not emailed automatically yet.
* There is no discount-code system yet.

## Sensible next step

The next useful step would be to show each linked client's upcoming and previous
appointments, invoice status and calendar sync status from their client record.
