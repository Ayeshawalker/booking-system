# PROJECT AUTOMATE — BOOKING SYSTEM BUILD BRIEF

## Project name

**Project Automate**

**Tagline:**
Where Great Therapy Meets Intelligent Automation.

## Overall objective

Build the first working version of a calm, professional and easy-to-use therapy booking system for Ayesha Jane’s private practice.

The application should be a secure, responsive web application that works on desktop computers, tablets and mobile phones.

This first version should focus only on:

* public appointment booking
* appointment availability
* session types
* Google Calendar preparation
* online and in-person appointment rules
* payment preparation
* therapist manual overrides
* booking confirmations
* reminders
* waiting-list functionality
* a simple therapist dashboard

Do not build clinical notes, AI clinical tools or medical record storage in this stage.

---

# 1. Technical approach

Please use:

* Next.js with TypeScript
* App Router
* Tailwind CSS
* Supabase for the database and future authentication
* Stripe as the first payment provider
* Google Calendar integration prepared but initially mocked if credentials are unavailable
* Zoom integration prepared but initially mocked if credentials are unavailable
* Zod for data validation
* date-fns for dates and times

Use the current stable versions of all packages.

The code must be:

* clearly organised
* easy for a beginner to understand
* strongly typed
* commented only where comments are genuinely useful
* accessible
* responsive
* easy to extend later

Do not add unnecessary packages.

---

# 2. Important working instructions

The project owner has no coding experience.

Therefore:

1. Explain each major action in plain English.
2. Before making a large change, briefly state what you are about to do.
3. Make changes in small, testable stages.
4. Run the application after each major stage.
5. Fix TypeScript, linting and build errors before continuing.
6. Do not delete or overwrite working files without explaining why.
7. Do not expose API keys or secrets in source code.
8. Use environment variables and provide an `.env.example` file.
9. Create a clear `README.md` containing installation and running instructions.
10. Use placeholder integrations where live account credentials are not yet available.
11. Do not claim that security, GDPR compliance or payment processing is complete until it has been properly configured and reviewed.
12. Ask before making any major architectural change that conflicts with this brief.

---

# 3. Branding and visual style

The system should feel like a natural extension of Ayesha Jane’s current therapy website.

The visual tone should be:

* warm
* calm
* approachable
* reassuring
* professional
* uncluttered
* human rather than medical or corporate

Avoid:

* hospital-style design
* harsh colours
* crowded dashboards
* excessive icons
* unnecessary animation
* overly technical language

Use:

* generous spacing
* rounded but professional cards
* clear headings
* accessible contrast
* readable typography
* simple step-by-step booking screens

Create the visual system using reusable design tokens so that exact colours and fonts can be adjusted later.

---

# 4. User roles

The first version has three user types.

## Public visitor

A person visiting the website who may:

* book a free discovery call
* book a first therapy session
* join the waiting list

## Existing client

For Version 1, an existing client may book through a secure or personalised booking link.

Full client accounts can be added later.

## Therapist administrator

Ayesha can:

* see bookings
* create bookings manually
* override normal availability
* mark an appointment as paid
* create and manage discount codes for selected clients
* cancel or reschedule an appointment
* enter an in-person room number
* view items needing attention
* manage the waiting list

---

# 5. Appointment types

Create the following appointment types.

## Discovery call

* Duration: 30 minutes
* Format: online
* Price: free
* Available to new clients
* Zoom meeting required
* No payment required

## Individual therapy — online

* Duration: 50 minutes
* Format: online
* Payment required before confirmation
* Zoom meeting required

## Individual therapy — in person

* Duration: 50 minutes
* Format: in person
* Location: Cherry Tree Therapy Centre, Henley-on-Thames
* Normally available on Thursdays only
* Payment required before confirmation
* Room number may be added later by Ayesha

## Couples therapy — online

* Duration: 80 minutes
* Format: online
* Payment required before confirmation
* Zoom meeting required

## Couples therapy — in person

* Duration: 80 minutes
* Format: in person
* Location: Cherry Tree Therapy Centre, Henley-on-Thames
* Normally available on Thursdays only
* Payment required before confirmation
* Room number may be added later by Ayesha

Store appointment types in the database rather than hard-coding all details throughout the application.

Prices must be editable from an administrator settings page.

Do not include a separate public booking option for betrayal trauma therapy in Version 1. Clients should choose either individual therapy or couples therapy.

---

# 6. Public availability rules

## Standard online availability

Clients may publicly book online appointments:

* Monday to Friday
* no earlier than 9:00 am
* no later than 6:00 pm

Interpret 6:00 pm as the latest permitted appointment start time unless changed later in administrator settings.

## Hidden therapist-only availability

Ayesha must be able to create appointments outside public availability.

Examples:

* an 8:00 am online appointment
* an occasional in-person appointment on a day other than Thursday
* an appointment during a normally blocked period

These exceptional times must never appear automatically on the public booking page.

## In-person availability

Thursday is the normal in-person day.

Public users should only be shown in-person availability on Thursdays.

Ayesha can manually override this and create an in-person booking on another day.

## Maximum weekly workload

No more than 20 therapy sessions may be publicly booked in one calendar week.

Discovery calls should be counted separately from the 20 therapy-session limit.

When the maximum has been reached:

* no further therapy slots should be shown for that week
* the client should be offered later availability
* the client should also be offered the waiting list

Ayesha must be able to override this limit manually, but the system must display a clear warning.

## Maximum daily workload

No more than 5 sessions may be booked on any one calendar day.

This daily limit should include:

* individual therapy sessions
* couples therapy sessions
* discovery calls

When the maximum has been reached:

* no further public booking slots should be shown for that day
* the client should be offered later availability
* the client should also be offered the waiting list

Ayesha must be able to override this limit manually, but the system must display a clear warning.

---

# 7. Calendar logic

The booking system must avoid double-bookings.

It should eventually check Ayesha’s Google Calendar so that personal appointments, holidays, supervision, workshops and other commitments block availability.

For the first local version:

* create a calendar service abstraction
* create a mocked calendar provider
* make it easy to replace the mock with Google Calendar later
* store the external calendar event ID when an event is created
* include buffers as configurable settings

Add configurable settings for:

* minimum time between appointments
* lunch or unavailable periods
* public working hours
* in-person day
* maximum daily sessions
* maximum weekly therapy sessions
* booking notice period
* how far into the future clients may book

Use Europe/London as the default time zone.

Handle British daylight-saving time correctly.

---

# 8. Booking journey

Create a simple, step-by-step booking journey.

## Step 1: Choose appointment

Display:

* Discovery call
* Individual therapy
* Couples therapy

## Step 2: Choose format

Where relevant, allow:

* Online
* In person

Only show valid formats and days.

## Step 3: Choose date and time

Display only genuine available appointments.

The calendar should:

* clearly show the selected date
* disable unavailable dates
* display appointment times in UK format
* work well on mobile devices
* include an empty-state message when no times are available

## Step 4: Client details

Collect:

* first name
* surname
* email address
* telephone number
* whether they are a new or existing client
* brief optional message
* consent to receive necessary booking communications
* acknowledgement of the 48-hour cancellation policy

For couples bookings, also collect:

* second partner’s first name
* second partner’s surname
* second partner’s email address

Do not collect detailed clinical or highly sensitive information in the public booking form.

## Step 5: Payment

For paid appointments:

* show the appointment price clearly
* allow the client to enter a valid discount code before payment
* show the discounted total clearly when a discount code is applied
* explain that payment is required to confirm the booking
* use a Stripe Checkout placeholder initially if Stripe is not configured
* never collect card information directly within our own forms
* confirm the booking only after successful payment

For free discovery calls, skip payment.

## Step 6: Confirmation

Display:

* appointment type
* date
* time
* time zone
* online or in-person format
* payment status
* next steps
* cancellation policy

For online sessions:

* show that a Zoom link will be emailed
* eventually display the confirmed Zoom link

For in-person sessions:

* show the Cherry Tree Therapy Centre location
* state that the room number will be confirmed separately
* do not invent a room number

---

# 9. Payment rules

The normal rule is payment before each session.

For new clients:

* payment is taken during booking
* the appointment is not confirmed until payment succeeds

For existing clients:

* payment should also normally be taken during booking
* Ayesha may manually create or confirm an appointment without immediate payment

Record:

* amount
* discount code, where used
* discount amount, where used
* final amount charged
* currency
* payment provider
* payment status
* payment reference
* date paid
* refund status

Use GBP.

## Discount codes

Ayesha must be able to offer discount codes to selected clients.

Discount codes should support:

* a readable code entered by the client
* percentage discount
* fixed amount discount
* optional expiry date
* optional maximum number of uses
* active or inactive status
* private administrator notes

Discount codes must be validated before payment.

When a discount code is used:

* show the original price
* show the discount applied
* show the final amount due
* store the code and discount amount with the payment record

Discovery calls are already free and should not need a discount code.

Supported statuses should include:

* not required
* pending
* paid
* failed
* refunded
* waived
* payment required

Prepare the data model so GoCardless can be added later, but do not build the GoCardless integration yet.

---

# 10. Cancellation and rescheduling rules

Ayesha has a 48-hour cancellation policy.

When a client tries to cancel or reschedule:

## More than 48 hours before the appointment

Allow cancellation or rescheduling according to available slots.

## Less than 48 hours before the appointment

Display a clear message explaining that the session remains payable under the cancellation policy.

Do not automatically issue a refund.

Ayesha must be able to:

* waive the charge
* retain the charge
* move the appointment as an exception
* add an administrative note explaining the exception

Keep an audit history of appointment changes.

---

# 11. Recurring and block bookings

Version 1 should prepare for three booking arrangements.

## Regular protected slot

An established client may have the same weekly or fortnightly slot reserved.

Store:

* frequency
* usual day
* usual time
* appointment type
* online or in-person format
* start date
* optional end date
* active or inactive status

## Flexible ongoing client

A client may need weekly or fortnightly therapy without using the same time.

For Version 1:

* store their desired frequency
* store preferred days or time periods
* allow them to self-book from available appointments

Advanced automatic slot recommendations can be added later.

## Block commitment

A client may commit to a defined block of sessions while paying session by session.

Store:

* number of sessions committed to
* sessions completed
* sessions remaining
* start date
* block status
* missed sessions
* cancellation terms accepted

A missed or late-cancelled session should still count as one session in the block unless Ayesha manually waives it.

Do not require clients to pay for the complete block in advance.

---

# 12. Waiting list

Add a waiting-list form.

Collect:

* name
* email
* telephone number
* therapy type
* online or in-person preference
* preferred days
* preferred time periods
* desired frequency
* optional short message
* date joined

Administrator functionality should allow Ayesha to:

* view waiting-list entries
* change their status
* add private notes
* send or copy a personalised booking link
* remove an entry
* mark an entry as converted to a client

Statuses:

* new
* contacted
* awaiting response
* offered appointment
* converted
* closed

Do not automatically send appointments to waiting-list clients in Version 1.

---

# 13. Therapist dashboard

Create a simple administrator dashboard.

The first screen should show:

## Today’s appointments

For each appointment display:

* time
* client name
* appointment type
* online or in person
* payment status
* readiness status

## Needs attention

Examples:

* payment outstanding
* room not allocated
* Zoom link missing
* booking awaiting confirmation
* agreement not yet signed in a future version
* calendar synchronisation failed

## This week

Display:

* sessions booked today out of 5
* therapy sessions booked this week out of 20
* discovery calls booked
* online sessions
* in-person sessions
* payments received
* payments outstanding

## Waiting list

Display the number of:

* new entries
* people awaiting contact
* appointments offered

Keep the dashboard calm and concise.

---

# 14. Cherry Tree room workflow

When an in-person appointment is booked:

1. Confirm the client’s appointment and payment.
2. Create a “Needs attention” item for Ayesha:
   “Book Cherry Tree room.”
3. Show the appointment in the administrator dashboard.
4. Provide a room-number field.
5. Allow Ayesha to enter the room number.
6. Once saved, mark the room task as complete.
7. Prepare an automatic client email confirming the room number.
8. Record the date and time the room notification was sent.

Use wording similar to:

“Your session will take place in Room [number] at Cherry Tree Therapy Centre.”

Do not send the message until a real room number has been entered.

---

# 15. Zoom workflow

For an online booking:

1. Create the appointment.
2. Prepare to create a unique Zoom meeting.
3. Store the Zoom meeting ID and join URL.
4. Add the same Zoom link to:

   * the booking confirmation
   * the calendar event
   * reminder emails
   * the administrator appointment record

For the first version, create a mocked Zoom service if credentials are not available.

Do not generate fake Zoom URLs that could be mistaken for real links. Clearly label test links as placeholders.

---

# 16. Notifications and reminders

Create an email service abstraction with a development mode that logs emails safely instead of sending them.

Prepare the following emails:

## Booking confirmation

Sent immediately after confirmation.

## Payment receipt or payment confirmation

Sent after successful payment.

## Appointment reminder

Prepare configurable reminders, initially:

* 48 hours before
* 24 hours before

Each online reminder must include the same Zoom link.

Each in-person reminder must include:

* Cherry Tree Therapy Centre
* date and time
* room number, when available

## Room confirmation

Sent when Ayesha adds the room number.

## Cancellation confirmation

Sent when an appointment is cancelled.

## Rescheduling confirmation

Sent when an appointment is moved.

Use warm, professional language and UK spelling.

---

# 17. Database entities

Create a clear Supabase-compatible schema for:

* clients
* couple_members
* appointment_types
* appointments
* availability_rules
* blocked_times
* recurring_arrangements
* therapy_blocks
* payments
* discount_codes
* discount_code_redemptions
* waiting_list_entries
* attention_items
* notification_logs
* appointment_change_history
* system_settings

Use UUID primary keys.

Include:

* created_at
* updated_at
* appropriate foreign keys
* sensible database constraints
* indexes for common queries

Do not store payment card data.

Do not store unnecessary sensitive information.

Include a database migration or SQL setup file.

---

# 18. Appointment statuses

Support:

* provisional
* awaiting_payment
* confirmed
* completed
* cancelled_by_client
* cancelled_by_therapist
* late_cancelled
* did_not_attend
* rescheduled

Readiness status should be calculated from outstanding requirements rather than manually typed.

Possible readiness display:

* Ready
* Needs attention
* Cancelled
* Completed

---

# 19. Administrator pages

Create these initial administrator pages:

* Dashboard
* Appointments
* Appointment details
* Create manual booking
* Waiting list
* Appointment types and prices
* Discount codes
* Availability settings
* General booking settings

The manual booking page must allow Ayesha to:

* book an 8:00 am appointment
* book outside public availability
* book an in-person appointment outside Thursday
* override the daily maximum
* override the weekly maximum
* bypass immediate payment
* record the reason for an override

Show warnings, but allow authorised overrides.

The discount-code page must allow Ayesha to:

* create a discount code
* choose a percentage or fixed amount discount
* set an optional expiry date
* set an optional maximum number of uses
* activate or deactivate a code
* view whether a code has been used
* add private notes explaining who the code is intended for

---

# 20. Public pages

Create:

* Booking home page
* Appointment-type selection
* Format selection
* Date-and-time selection
* Client-details form
* Discount-code entry during payment
* Payment placeholder or Stripe Checkout stage
* Booking confirmation
* Waiting-list page
* Cancellation-policy page

Use routes that are clear and readable.

---

# 21. Security and privacy foundations

This stage is not to be described as fully GDPR compliant until professional review and production configuration have taken place.

However, build sensible foundations:

* server-side validation
* secure environment variables
* no API keys committed to Git
* no card information stored
* minimal data collection
* clear privacy acknowledgement
* input sanitisation
* rate limiting prepared for public forms
* database access through secure server-side code
* Supabase Row Level Security preparation
* audit history for important appointment changes
* error messages that do not reveal private information

Use fictional seed data only.

Never add real client information during development or testing.

---

# 22. Accessibility

Aim for WCAG 2.2 AA.

Include:

* keyboard-accessible controls
* proper labels
* useful error messages
* visible focus states
* sufficient colour contrast
* semantic HTML
* accessible date and time selection
* no essential information conveyed only through colour

---

# 23. Testing requirements

Add tests for the most important rules.

At minimum test:

* public appointments cannot be booked before 9:00 am
* administrator appointments can be created at 8:00 am
* public in-person appointments are normally restricted to Thursday
* administrator in-person overrides work
* double-bookings are rejected
* the 20-session weekly public limit works
* discovery calls do not count towards the 20-session limit
* paid sessions remain provisional until payment succeeds
* appointments inside 48 hours are flagged as late cancellations
* room numbers are not sent until entered
* unavailable Google Calendar times are excluded when the real integration is added

Include unit tests and appropriate integration tests.

---

# 24. Seed data

Create fictional development data only.

Examples:

* one discovery call
* one online individual appointment
* one online couples appointment
* one Thursday in-person appointment requiring a room
* one paid booking
* one payment-pending booking
* three waiting-list entries

Do not use realistic full personal details.

---

# 25. Definition of done for the first build

The first booking-system milestone is complete when:

1. The application runs locally without errors.
2. A visitor can choose an appointment type.
3. A visitor can select online or in-person where relevant.
4. Valid available appointments are displayed.
5. Invalid or blocked appointments are not displayed.
6. The visitor can submit contact details.
7. A free discovery call can be confirmed.
8. A paid booking can pass through a clearly marked development payment flow.
9. The appointment appears on the administrator dashboard.
10. Ayesha can manually create an appointment outside normal public hours.
11. Ayesha can add a Cherry Tree room number.
12. The relevant “Needs attention” item clears.
13. The waiting-list form works.
14. Data is saved in the development database.
15. The project includes a README and `.env.example`.
16. Type checking, linting, tests and production build all pass.

---

# 26. Build order

Please build this in the following stages.

## Stage 1: Project foundation

* inspect the existing repository
* report what is already present
* install only necessary dependencies
* establish the app structure
* create the branding shell
* create environment-variable examples
* create the README

Stop and report progress.

## Stage 2: Data model

* create TypeScript types
* create validation schemas
* create database schema or migrations
* add fictional seed data
* include discount-code tables and validation rules
* create service interfaces

Stop and report progress.

## Stage 3: Public booking interface

* appointment selection
* format selection
* availability calendar
* client details
* confirmation page

Use mocked services first.

Stop and test the full flow.

## Stage 4: Administrator dashboard

* today’s appointments
* Needs Attention
* weekly capacity
* manual booking
* discount-code management
* room-number workflow
* waiting list

Stop and test.

## Stage 5: Payment integration

* add Stripe Checkout
* use Stripe test mode only
* validate and apply discount codes before checkout
* add webhook handling
* confirm appointments only after verified payment
* document required environment variables

Stop and test using Stripe test data.

## Stage 6: Google Calendar integration

* replace the mock calendar provider
* read busy periods
* create and update events
* prevent double-bookings
* document Google setup steps

Stop and test.

## Stage 7: Zoom integration

* replace the mock Zoom provider
* create unique meetings
* store the link
* include the same link in confirmations and reminders

Stop and test.

## Stage 8: Final quality checks

Run:

* TypeScript checks
* linting
* automated tests
* production build
* accessibility review
* security review
* README review

Provide a concise report listing:

* completed features
* mocked features
* credentials still required
* known limitations
* recommended next task

---

# 27. Begin now

First inspect the current VS Code workspace.

Do not immediately generate the whole application.

Start by reporting:

1. What files and frameworks already exist.
2. Whether this is a new or existing Next.js project.
3. Which required packages are already installed.
4. Any conflicts or missing setup.
5. The precise work you recommend for Stage 1.

Then complete Stage 1 only.

After Stage 1, run the project and all available checks, fix any errors, and give me a brief progress report before moving to Stage 2.
