const bookingAppBaseUrl = new URL("./", window.location.href).href;

window.BOOKING_CONFIG = {
  supabaseUrl: "https://kxewsanwjfyitsdcvvzo.supabase.co",
  supabaseAnonKey: "sb_publishable_Ts6HJ1NM2pVkFO4eXbD1HA_kaqXpZ6A",
  // Use the address the site was opened on. This keeps today's GitHub address
  // working and automatically produces branded links after a custom domain is
  // connected, without exposing the old host in newly generated links.
  publicClientBaseUrl: bookingAppBaseUrl,
  calendarAvailabilityFunction: "calendar-availability",
  calendarCreateFunction: "calendar-create-booking",
  calendarEventsFunction: "calendar-events",
  calendarRescheduleFunction: "calendar-reschedule-booking",
  stripeCheckoutFunction: "stripe-create-checkout",
  adminRecoveryUrl: new URL("admin-login.html", bookingAppBaseUrl).href,
  clientNoteImproveFunction: "improve-client-note",
  zoomCreateMeetingFunction: "zoom-create-meeting",
  appointmentRemindersFunction: "appointment-reminders",
  timeZone: "Europe/London",
};
  
