(async function setupAdminCalendar() {
  const admin = await window.ADMIN_READY;
  const supabaseClient = admin.client;
  const controls = {
    previous: document.querySelector("#calendar-previous"),
    today: document.querySelector("#calendar-today"),
    next: document.querySelector("#calendar-next"),
    refresh: document.querySelector("#calendar-refresh"),
    viewButtons: Array.from(
      document.querySelectorAll("[data-calendar-view]"),
    ),
    periodTitle: document.querySelector("#calendar-period-title"),
    individualSessions: document.querySelector("#calendar-individual-sessions"),
    coupleSessions: document.querySelector("#calendar-couple-sessions"),
    onlineSessions: document.querySelector("#calendar-online-sessions"),
    inPersonSessions: document.querySelector("#calendar-in-person-sessions"),
    sessionEarnings: document.querySelector("#calendar-session-earnings"),
    message: document.querySelector("#calendar-message"),
    surface: document.querySelector("#calendar-surface"),
    clientChecklist: document.querySelector("#calendar-client-checklist"),
    clientChecklistWeek: document.querySelector("#calendar-client-checklist-week"),
    clientChecklistList: document.querySelector("#calendar-client-checklist-list"),
    clientChecklistEmpty: document.querySelector("#calendar-client-checklist-empty"),
    dialog: document.querySelector("#calendar-event-dialog"),
    closeDialog: document.querySelector("#close-event-dialog"),
    eventSource: document.querySelector("#event-source"),
    eventTitle: document.querySelector("#event-title"),
    eventWhen: document.querySelector("#event-when"),
    eventLocationRow: document.querySelector("#event-location-row"),
    eventLocation: document.querySelector("#event-location"),
    eventGoogleLink: document.querySelector("#event-google-link"),
    rescheduleForm: document.querySelector("#event-reschedule-form"),
    newDate: document.querySelector("#event-new-date"),
    newTime: document.querySelector("#event-new-time"),
    newFormat: document.querySelector("#event-new-format"),
    rescheduleMessage: document.querySelector("#event-reschedule-message"),
    bookingDetailsForm: document.querySelector("#event-booking-details-form"),
    bookingStatus: document.querySelector("#event-booking-status"),
    bookingNote: document.querySelector("#event-booking-note"),
    bookingDetailsMessage: document.querySelector("#event-booking-details-message"),
    quickBookDialog: document.querySelector("#calendar-quick-book-dialog"),
    quickBookForm: document.querySelector("#calendar-quick-book-form"),
    closeQuickBook: document.querySelector("#close-quick-book-dialog"),
    cancelQuickBook: document.querySelector("#cancel-quick-book"),
    quickBookClient: document.querySelector("#quick-book-client"),
    quickBookDate: document.querySelector("#quick-book-date"),
    quickBookTime: document.querySelector("#quick-book-time"),
    quickBookFormat: document.querySelector("#quick-book-format"),
    quickBookStatus: document.querySelector("#quick-book-status"),
    quickBookFee: document.querySelector("#quick-book-fee"),
    quickBookNote: document.querySelector("#quick-book-note"),
    quickBookMessage: document.querySelector("#quick-book-message"),
    quickBookHeading: document.querySelector("#quick-book-heading"),
    quickBookKind: Array.from(document.querySelectorAll("[name='quick-book-kind']")),
    quickBookClientFields: document.querySelector("#quick-book-client-fields"),
    quickBookPrivateFields: document.querySelector("#quick-book-private-fields"),
    quickBookPrivateTitle: document.querySelector("#quick-book-private-title"),
    quickBookPrivateDate: document.querySelector("#quick-book-private-date"),
    quickBookPrivateTime: document.querySelector("#quick-book-private-time"),
    quickBookPrivateEndDate: document.querySelector("#quick-book-private-end-date"),
    quickBookPrivateEndTime: document.querySelector("#quick-book-private-end-time"),
    cancelBooking: document.querySelector("#cancel-event-booking"),
    repeatBooking: document.querySelector("#repeat-event-booking"),
    colourForm: document.querySelector("#event-colour-form"),
    displayColour: document.querySelector("#event-display-colour"),
    privateDetailsForm: document.querySelector("#event-private-details-form"),
    privateTitle: document.querySelector("#event-private-title"),
    privateTimeFields: document.querySelector("#event-private-time-fields"),
    privateStartDate: document.querySelector("#event-private-start-date"),
    privateStartTime: document.querySelector("#event-private-start-time"),
    privateEndDate: document.querySelector("#event-private-end-date"),
    privateEndTime: document.querySelector("#event-private-end-time"),
    privateMessage: document.querySelector("#event-private-message"),
    deletePrivateEvent: document.querySelector("#delete-private-event"),
  };
  const viewStorageKey = "ayesha-admin-calendar-view";
  const colourStorageKey = "ayesha-admin-calendar-colours";
  const titleStorageKey = "ayesha-admin-calendar-personal-titles";
  const clientCheckNotesStorageKey = "ayesha-admin-calendar-client-check-notes";
  const privateEventStorageKey = "ayesha-admin-private-calendar-events";
  const zoomLinkStorageKey = "ayesha-whatsapp-zoom-link";
  const validViews = new Set(["day", "week", "month"]);
  const savedView = localStorage.getItem(viewStorageKey);
  const state = {
    view: validViews.has(savedView) ? savedView : "week",
    focusDate: defaultCalendarFocusDate(),
    events: [],
    requestId: 0,
    selectedEvent: null,
    clientDetailsByName: new Map(),
    bookingFeeById: new Map(),
    bookingDetailsById: new Map(),
    summaryBookings: [],
    summaryPayments: [],
    bookingClients: [],
    diaryImportAttempted: false,
    draggedEvent: null,
    localPrivateEvents: (() => {
      try {
        return JSON.parse(localStorage.getItem(privateEventStorageKey) || "[]")
          .map((event) => {
            if (!event.allDay) return event;
            const startDate = String(event.start).slice(0, 10);
            const endDate = String(event.end).slice(0, 10);
            return {
              ...event,
              start: new Date(`${startDate}T08:00:00`).toISOString(),
              end: new Date(`${endDate}T00:00:00`).toISOString(),
              allDay: false,
              blocksDay: false,
            };
          });
      }
      catch { return []; }
    })(),
    colourOverrides: (() => {
      try { return JSON.parse(localStorage.getItem(colourStorageKey) || "{}"); }
      catch { return {}; }
    })(),
    titleOverrides: (() => {
      try { return JSON.parse(localStorage.getItem(titleStorageKey) || "{}"); }
      catch { return {}; }
    })(),
    clientCheckNotes: (() => {
      try {
        const savedNotes = JSON.parse(
          localStorage.getItem(clientCheckNotesStorageKey) || "{}",
        );
        // Older versions stored a separate note for every week. Keep the most
        // recent one for each client and carry it forward until it is cleared.
        Object.entries(savedNotes)
          .filter(([key, value]) => /^\d{4}-\d{2}-\d{2}:/.test(key) && String(value).trim())
          .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
          .forEach(([key, value]) => {
            const clientId = key.slice(11);
            savedNotes[`client:${clientId}`] = value;
          });
        localStorage.setItem(clientCheckNotesStorageKey, JSON.stringify(savedNotes));
        return savedNotes;
      }
      catch { return {}; }
    })(),
  };

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function defaultCalendarFocusDate() {
    const today = startOfDay(new Date());
    return today.getDay() === 0 ? addDays(today, 1) : today;
  }

  function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  function startOfWeek(date) {
    const result = startOfDay(date);
    const dayOffset = (result.getDay() + 6) % 7;
    return addDays(result, -dayOffset);
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function endOfMonthGrid(date) {
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return addDays(startOfWeek(lastDay), 7);
  }

  function localDateKey(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function dateFromKey(value) {
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function rangeForView() {
    if (state.view === "day") {
      const start = startOfDay(state.focusDate);
      return { start, end: addDays(start, 1) };
    }

    if (state.view === "week") {
      const today = startOfDay(new Date());
      const focus = today.getDay() === 0 && isSameDay(state.focusDate, today)
        ? addDays(today, 1)
        : state.focusDate;
      const start = startOfWeek(focus);
      return { start, end: addDays(start, 7) };
    }

    const start = startOfWeek(startOfMonth(state.focusDate));
    return { start, end: endOfMonthGrid(state.focusDate) };
  }

  function periodTitle() {
    const fullDate = new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    if (state.view === "day") return fullDate.format(state.focusDate);

    if (state.view === "month") {
      return new Intl.DateTimeFormat("en-GB", {
        month: "long",
        year: "numeric",
      }).format(state.focusDate);
    }

    const start = startOfWeek(state.focusDate);
    const end = addDays(start, 6);
    const startText = new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: start.getMonth() === end.getMonth() ? undefined : "short",
      year: start.getFullYear() === end.getFullYear() ? undefined : "numeric",
    }).format(start);
    const endText = new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(end);
    return `${startText} to ${endText}`;
  }

  function isSameDay(first, second) {
    return localDateKey(first) === localDateKey(second);
  }

  function eventDates(event) {
    if (event.allDay) {
      return {
        start: dateFromKey(event.start),
        end: dateFromKey(event.end),
      };
    }

    return {
      start: new Date(event.start),
      end: new Date(event.end),
    };
  }

  function bookingClientName(booking) {
    const firstClient = [booking.first_name, booking.surname]
      .filter(Boolean)
      .join(" ")
      .trim();
    const secondClient = [booking.second_first_name, booking.second_surname]
      .filter(Boolean)
      .join(" ")
      .trim();
    return [firstClient, secondClient].filter(Boolean).join(" & ") || "Booking";
  }

  function clientGreetingName(client) {
    const first = String(client?.first_name || "").trim();
    const second = String(client?.second_first_name || "").trim();
    return [first, second].filter(Boolean).join(" and ") || "there";
  }

  function whatsappPhone(value) {
    let digits = String(value || "").replace(/[^0-9]/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (digits.startsWith("0")) digits = `44${digits.slice(1)}`;
    return digits;
  }

  function bookingConfirmationMessage(client, booking) {
    const start = new Date(`${booking.preferred_date}T${String(booking.preferred_time).slice(0, 5)}:00`);
    const minutes = Number.parseInt(booking.duration, 10) || (client.record_type === "Couple" ? 80 : 50);
    const end = new Date(start.getTime() + minutes * 60000);
    const date = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(start);
    const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
    const format = String(booking.session_format || "online").toLowerCase();
    const zoomLink = format === "online" ? String(booking.zoom_join_url || "").trim() : "";
    const formatDetails = format === "online"
      ? (zoomLink ? ` Your Zoom link is: ${zoomLink}.` : "")
      : " This session will be at Cherry Tree Therapy Centre, and I’ll let you know which room you’ll be in nearer the time.";
    const noticeReminder = format === "online"
      ? " Just a gentle reminder that I need at least 48 hours’ notice if you wish to change or cancel this appointment; otherwise, the agreed session fee will still be charged."
      : "";
    return `Hi ${clientGreetingName(client)}, confirming your appointment with me on ${date} at ${time.format(start)}–${time.format(end)}, ${format}.${formatDetails} Please let me know if anything needs changing.${noticeReminder}`;
  }

  async function zoomErrorMessage(error, data) {
    if (data?.error) return data.error;
    try {
      const body = await error?.context?.clone?.().json();
      if (body?.error) return body.error;
    } catch (_) {}
    return error?.message || "Zoom could not create the link.";
  }

  async function ensureBookingZoomLink(booking) {
    const sessionFormat = booking.session_format || booking.sessionFormat || "";
    if (String(sessionFormat).toLowerCase() !== "online") return "";
    const existingLink = booking.zoom_join_url || booking.zoomJoinUrl;
    if (existingLink) return existingLink;
    const bookingId = booking.id || booking.bookingRequestId;
    if (!bookingId) throw new Error("This booking has no saved reference for Zoom.");
    const { data, error } = await supabaseClient.functions.invoke(
      window.BOOKING_CONFIG?.zoomCreateMeetingFunction || "zoom-create-meeting",
      { body: { bookingId } },
    );
    if (error || data?.error || !data?.joinUrl) {
      throw new Error(await zoomErrorMessage(error, data));
    }
    booking.zoom_join_url = data.joinUrl;
    booking.zoomJoinUrl = data.joinUrl;
    return data.joinUrl;
  }

  function showWhatsAppConfirmation(client, booking, successText) {
    controls.message.textContent = successText;
    const button = document.createElement("button");
    button.type = "button"; button.className = "calendar-whatsapp-confirmation";
    button.textContent = "Send WhatsApp confirmation";
    button.addEventListener("click", async () => {
      button.disabled = true;
      if (String(booking.session_format || "").toLowerCase() === "online" && !booking.zoom_join_url) {
        button.textContent = "Creating Zoom link…";
        try {
          await ensureBookingZoomLink(booking);
        } catch (error) {
          controls.message.textContent = `The WhatsApp confirmation was not opened because the Zoom link could not be created. ${error.message}`;
          button.disabled = false;
          button.textContent = "Try Zoom and WhatsApp again";
          return;
        }
      }
      const message = bookingConfirmationMessage(client, booking);
      button.disabled = false;
      button.textContent = "Send WhatsApp confirmation";
      if (client.record_type === "Couple") {
        try { await navigator.clipboard.writeText(message); }
        catch (_) {
          window.prompt("Copy this confirmation, then paste it into the couple’s WhatsApp group:", message);
          return;
        }
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
        controls.message.firstChild.textContent = `${successText} Confirmation copied—choose the couple’s WhatsApp group and press Command+V.`;
        return;
      }
      const phone = whatsappPhone(client.phone);
      if (!phone) {
        window.prompt("No mobile number is saved for this client. Copy this confirmation into WhatsApp:", message);
        return;
      }
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
    });
    controls.message.append(document.createTextNode(" "), button);
  }

  function normalisePersonName(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function addClientName(name, details) {
    const key = normalisePersonName(name);
    if (key) state.clientDetailsByName.set(key, details);
  }

  async function loadClientNames() {
    const { data, error } = await supabaseClient
      .from("clients")
      .select(
        "id, record_type, status, first_name, surname, second_first_name, second_surname, email, second_email, phone, preferred_format, session_frequency, frequency_notes, agreed_session_fee_gbp, agreed_online_fee_gbp, agreed_in_person_fee_gbp",
      );

    if (error) {
      console.error("Could not load client names for calendar totals", error);
      return;
    }

    state.clientDetailsByName.clear();
    state.bookingClients = (data || []).filter((client) => client.status === "Active");
    (data || []).forEach((client) => {
      const details = {
        id: client.id,
        recordType: client.record_type,
        onlineFee:
          client.agreed_online_fee_gbp ?? client.agreed_session_fee_gbp,
        inPersonFee:
          client.agreed_in_person_fee_gbp ?? client.agreed_session_fee_gbp,
      };
      const firstFullName = [client.first_name, client.surname]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (client.record_type === "Couple") {
        const secondFullName = [client.second_first_name, client.second_surname]
          .filter(Boolean)
          .join(" ")
          .trim();
        addClientName(`${firstFullName} and ${secondFullName}`, details);
        addClientName(`${client.first_name} and ${client.second_first_name}`, details);
      } else {
        addClientName(firstFullName, details);
        addClientName(client.first_name, details);
      }
    });
  }

  function bookingClientDisplayName(client) {
    const first = [client.first_name, client.surname].filter(Boolean).join(" ").trim();
    const second = [client.second_first_name, client.second_surname]
      .filter(Boolean).join(" ").trim();
    return [first, second].filter(Boolean).join(" and ");
  }

  function fillQuickBookClients() {
    const selected = controls.quickBookClient.value;
    const options = state.bookingClients
      .slice()
      .sort((a, b) => bookingClientDisplayName(a).localeCompare(
        bookingClientDisplayName(b), "en-GB", { sensitivity: "base" },
      ))
      .map((client) => {
        const option = document.createElement("option");
        option.value = client.id;
        option.textContent = bookingClientDisplayName(client);
        return option;
      });
    controls.quickBookClient.replaceChildren(new Option("Choose client", ""), ...options);
    if (state.bookingClients.some((client) => client.id === selected)) {
      controls.quickBookClient.value = selected;
    }
  }

  function selectedQuickBookClient() {
    return state.bookingClients.find((client) => client.id === controls.quickBookClient.value);
  }

  function applyQuickBookClientDefaults() {
    const client = selectedQuickBookClient();
    if (!client) return;
    const format = client.preferred_format === "In person" ? "In person" : "Online";
    controls.quickBookFormat.value = format;
    const fee = format === "In person"
      ? client.agreed_in_person_fee_gbp ?? client.agreed_session_fee_gbp
      : client.agreed_online_fee_gbp ?? client.agreed_session_fee_gbp;
    controls.quickBookFee.value = fee ?? "";
  }

  function openQuickBook(date, time) {
    controls.quickBookForm.reset();
    setQuickBookKind("client");
    controls.quickBookMessage.textContent = "";
    fillQuickBookClients();
    controls.quickBookDate.value = localDateKey(date);
    controls.quickBookTime.value = time;
    controls.quickBookPrivateDate.value = localDateKey(date);
    controls.quickBookPrivateTime.value = time;
    const defaultStart = new Date(`${localDateKey(date)}T${time}:00`);
    const defaultEnd = new Date(defaultStart.getTime() + 60 * 60000);
    controls.quickBookPrivateEndDate.value = localDateKey(defaultEnd);
    controls.quickBookPrivateEndTime.value = [
      String(defaultEnd.getHours()).padStart(2, "0"),
      String(defaultEnd.getMinutes()).padStart(2, "0"),
    ].join(":");
    controls.quickBookStatus.value = "confirmed";
    controls.quickBookDialog.showModal();
    window.lucide?.createIcons();
  }

  function quickBookKind() {
    return controls.quickBookKind.find((input) => input.checked)?.value || "client";
  }

  function setQuickBookKind(kind) {
    controls.quickBookKind.forEach((input) => { input.checked = input.value === kind; });
    const privateEvent = kind === "private";
    controls.quickBookClientFields.hidden = privateEvent;
    controls.quickBookPrivateFields.hidden = !privateEvent;
    controls.quickBookClient.required = !privateEvent;
    controls.quickBookFee.required = !privateEvent;
    controls.quickBookDate.required = !privateEvent;
    controls.quickBookTime.required = !privateEvent;
    controls.quickBookPrivateTitle.required = privateEvent;
    controls.quickBookPrivateDate.required = privateEvent;
    controls.quickBookPrivateTime.required = privateEvent;
    controls.quickBookPrivateEndDate.required = privateEvent;
    controls.quickBookPrivateEndTime.required = privateEvent;
    controls.quickBookHeading.textContent = privateEvent
      ? "Add a private event"
      : "Book this time";
    document.querySelector("#save-quick-book").textContent = privateEvent
      ? "Save private event"
      : "Save client booking";
    controls.quickBookMessage.textContent = "";
  }

  function privateDurationMinutes() {
    const start = new Date(
      `${controls.quickBookPrivateDate.value}T${controls.quickBookPrivateTime.value}:00`,
    );
    const end = new Date(
      `${controls.quickBookPrivateEndDate.value}T${controls.quickBookPrivateEndTime.value}:00`,
    );
    return Math.round((end - start) / 60000);
  }

  async function importDiaryWeekStarting17August2026() {
    if (state.diaryImportAttempted) return;
    state.diaryImportAttempted = true;
    const diary = [
      { date: "2026-08-10", time: "12:00", match: ["chloe"], status: "confirmed" },
      { date: "2026-08-11", time: "10:30", match: ["judith"], status: "confirmed" },
      { date: "2026-08-12", time: "08:00", match: ["jacci"], status: "confirmed" },
      { date: "2026-08-12", time: "09:30", match: ["lucy"], status: "confirmed" },
      { date: "2026-08-13", time: "10:00", match: ["ryan"], status: "confirmed" },
      { date: "2026-08-14", time: "10:00", match: ["emma", "piers"], status: "confirmed" },
      { date: "2026-08-14", time: "14:00", match: ["ellie", "william"], status: "pending", note: "Waiting to hear back from Ellie and William." },
      { date: "2026-08-14", time: "16:00", match: ["russell"], status: "pending", note: "Time was to be confirmed depending on Ellie and William." },
      { date: "2026-08-17", time: "12:00", match: ["chloe"], status: "confirmed" },
      { date: "2026-08-18", time: "09:00", match: ["natalie"], status: "confirmed" },
      { date: "2026-08-18", time: "12:00", match: ["steve"], recordType: "Individual", status: "confirmed" },
      { date: "2026-08-18", time: "17:00", match: ["emma", "marcus"], status: "pending", note: "Waiting to hear back from Emma and Marcus." },
      { date: "2026-08-19", time: "08:00", match: ["jacci"], status: "pending", note: "Awaiting confirmation." },
      { date: "2026-08-19", time: "09:15", match: ["mary"], status: "confirmed" },
      { date: "2026-08-19", time: "11:00", match: ["george"], status: "pending", note: "Waiting to hear back from George." },
      { date: "2026-08-19", time: "12:30", match: ["chris"], status: "pending", note: "Waiting to hear back; session format may still need confirming." },
      { date: "2026-08-20", time: "13:30", match: ["claudia", "martin"], status: "pending", note: "Waiting to hear back from Claudia and Martin." },
      { date: "2026-08-21", time: "14:00", match: ["daisy", "seymour"], status: "pending", note: "Waiting to hear back from Daisy Seymour." },
    ];
    const [{ data: clientRows, error: clientError }, { data: existingRows, error: bookingError }] =
      await Promise.all([
        supabaseClient.from("clients").select(
          "id, record_type, first_name, surname, second_first_name, second_surname, email, second_email, phone, agreed_session_fee_gbp, agreed_online_fee_gbp, agreed_in_person_fee_gbp",
        ),
        supabaseClient.from("booking_requests")
          .select("id, client_id, preferred_date, preferred_time")
          .gte("preferred_date", "2026-08-10")
          .lte("preferred_date", "2026-08-21"),
      ]);
    if (clientError || bookingError) {
      console.error("The diary week could not be prepared.", clientError || bookingError);
      state.diaryImportAttempted = false;
      return;
    }

    for (const entry of diary) {
      const client = (clientRows || []).find((item) => {
        const name = normalisePersonName([
          item.first_name, item.surname, item.second_first_name, item.second_surname,
        ].filter(Boolean).join(" "));
        return entry.match.every((part) => name.includes(part)) &&
          (!entry.recordType || item.record_type === entry.recordType);
      });
      if (!client) {
        console.warn("Diary client could not be matched:", entry.match);
        continue;
      }
      const exists = (existingRows || []).some((booking) =>
        booking.client_id === client.id &&
        booking.preferred_date === entry.date &&
        String(booking.preferred_time || "").slice(0, 5) === entry.time
      );
      if (exists) continue;

      const couple = client.record_type === "Couple";
      const fee = Number(client.agreed_online_fee_gbp ??
        client.agreed_session_fee_gbp ?? client.agreed_in_person_fee_gbp ?? 0);
      const pending = entry.status === "pending";
      const bookingId = crypto.randomUUID();
      const row = {
        id: bookingId,
        client_id: client.id,
        session_type: couple ? "Joint session" : "Individual session",
        session_format: "Online",
        booking_source: "Ayesha booking for client",
        client_type: "Existing client",
        booking_type: "Single session",
        price: fee,
        total_cost: fee,
        pay_now_amount: 0,
        remaining_balance: fee,
        invoice_required: !pending && fee > 0,
        invoice_amount: !pending && fee > 0 ? fee : null,
        duration: couple ? "80 minutes" : "50 minutes",
        preferred_date: entry.date,
        preferred_time: entry.time,
        first_name: client.first_name || "",
        surname: client.surname || "",
        second_first_name: client.second_first_name || "",
        second_surname: client.second_surname || "",
        email: client.email || client.second_email || "",
        phone: client.phone || "",
        message: entry.note || "Confirmed from Ayesha's diary.",
        consent_to_contact: true,
        status: pending ? "contacted" : "confirmed",
        calendar_sync_status: "pending",
      };
      const { error } = await supabaseClient.from("booking_requests").insert(row);
      if (error) {
        console.error("A diary booking could not be added.", entry, error);
        continue;
      }
      if (!pending && fee > 0) {
        const { error: invoiceError } = await supabaseClient.rpc(
          "ensure_booking_invoice",
          { p_booking_id: bookingId },
        );
        if (invoiceError) console.error("The diary invoice could not be created.", invoiceError);
      }
    }
  }

  async function loadBookingFees() {
    const [bookingResult, paymentResult] = await Promise.all([
      supabaseClient
        .from("booking_requests")
        .select("id, client_id, first_name, surname, second_first_name, second_surname, booking_type, session_type, session_format, duration, preferred_date, preferred_time, price, total_cost, status, message, block_session_count, block_date_pattern, block_frequency, exact_block_dates"),
      supabaseClient
        .from("manual_payments")
        .select("id, client_id, client_name, session_date, session_type, session_format, fee_due"),
    ]);
    if (bookingResult.error || paymentResult.error) {
      console.error(
        "Could not load session records for calendar totals",
        bookingResult.error || paymentResult.error,
      );
      return;
    }
    const data = bookingResult.data || [];
    state.bookingFeeById.clear();
    state.bookingDetailsById.clear();
    state.summaryBookings = data;
    state.summaryPayments = paymentResult.data || [];
    data.forEach((booking) => {
      if (booking.price !== null) {
        state.bookingFeeById.set(booking.id, Number(booking.price));
      }
      state.bookingDetailsById.set(booking.id, {
        status: booking.status,
        note: booking.message || "",
        invoiceAmount: Number(booking.total_cost ?? booking.price ?? 0),
        bookingType: booking.booking_type,
        sessionType: booking.session_type,
        sessionFormat: booking.session_format,
        duration: booking.duration,
        preferredDate: booking.preferred_date,
        preferredTime: booking.preferred_time,
      });
    });
  }

  function isPendingEvent(event) {
    return event.bookingStatus === "contacted";
  }

  function displayColourForEvent(event) {
    return state.colourOverrides[event.id] || "automatic";
  }

  function summaryRange() {
    if (state.view !== "month") return rangeForView();
    const start = startOfMonth(state.focusDate);
    return {
      start,
      end: new Date(start.getFullYear(), start.getMonth() + 1, 1),
    };
  }

  function clientDetailsForEvent(event) {
    const eventName = normalisePersonName(event.title)
      .replace(/^(individual|joint|solo|couple) session /, "")
      .replace(/^zoom meeting /, "")
      .trim();
    const exactMatch = state.clientDetailsByName.get(eventName);
    if (exactMatch) return exactMatch;

    // Zoom and Google can prefix a client's name with a meeting/session label.
    // Prefer the longest matching saved name to avoid a first-name match
    // winning over the client's full name.
    const matches = [...state.clientDetailsByName.entries()]
      .filter(([savedName]) => savedName.length >= 4 &&
        (` ${eventName} `).includes(` ${savedName} `))
      .sort(([first], [second]) => second.length - first.length);
    return matches[0]?.[1];
  }

  function clientEventIdentity(event) {
    const client = clientDetailsForEvent(event);
    if (client?.id) return `client:${client.id}`;
    return `title:${normalisePersonName(event.title)
      .replace(/^(individual|joint|solo|couple) session /, "")
      .replace(/^zoom meeting /, "")}`;
  }

  function clientEventOccurrenceKey(event) {
    const start = eventDates(event).start;
    return `${clientEventIdentity(event)}:${localDateKey(start)}:${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
  }

  function removeExternalBookingCopies(events) {
    const linkedOccurrences = new Set(
      events
        .filter((event) => event.bookingRequestId && isClientEvent(event))
        .map(clientEventOccurrenceKey),
    );
    const seenLinkedBookingIds = new Set();
    const seenUnlinkedOccurrences = new Set();

    return events.filter((event) => {
      if (!isClientEvent(event)) return true;
      if (event.bookingRequestId) {
        if (seenLinkedBookingIds.has(event.bookingRequestId)) return false;
        seenLinkedBookingIds.add(event.bookingRequestId);
        return true;
      }
      const occurrence = clientEventOccurrenceKey(event);
      if (linkedOccurrences.has(occurrence) || seenUnlinkedOccurrences.has(occurrence)) {
        return false;
      }
      seenUnlinkedOccurrences.add(occurrence);
      return true;
    });
  }

  function isClientEvent(event) {
    if (event.allDay) return false;
    const clientDetails = clientDetailsForEvent(event);
    const matchesClient =
      event.eventType === "booking" || Boolean(event.sessionType) || clientDetails;
    return Boolean(matchesClient);
  }

  function isCoupleEvent(event) {
    const clientDetails = clientDetailsForEvent(event);
    return clientDetails?.recordType === "Couple" ||
      event.sessionType?.toLowerCase() === "joint session" ||
      /\s(?:&|and)\s/i.test(event.title);
  }

  function isInPersonEvent(event) {
    return event.sessionFormat?.toLowerCase() === "in person" ||
      /cherry tree|henley-on-thames/i.test(event.location || "");
  }

  function feeForEvent(event) {
    if (event.bookingRequestId && state.bookingFeeById.has(event.bookingRequestId)) {
      return state.bookingFeeById.get(event.bookingRequestId);
    }
    const clientDetails = clientDetailsForEvent(event);
    if (!clientDetails) return 0;
    const fee = isInPersonEvent(event)
      ? clientDetails.inPersonFee
      : clientDetails.onlineFee;
    return fee === null || fee === undefined ? 0 : Number(fee);
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    }).format(value);
  }

  function renderPeopleTotals() {
    const range = summaryRange();
    let individuals = 0;
    let couples = 0;
    let online = 0;
    let inPerson = 0;
    let earnings = 0;

    // Once a whole week is in the past, use the payment/session ledger. It is
    // the durable record of sessions that took place (including unpaid ones),
    // whereas old Google Calendar entries can later be moved or duplicated.
    const isCompletedPastPeriod = range.end <= startOfWeek(new Date());
    if (isCompletedPastPeriod) {
      const counted = new Set();
      state.summaryPayments.forEach((payment) => {
        const sessionDate = dateFromKey(payment.session_date);
        if (sessionDate < range.start || sessionDate >= range.end) return;
        const identity = payment.client_id || normalisePersonName(payment.client_name);
        const key = `${identity}:${payment.session_date}`;
        if (counted.has(key)) return;
        counted.add(key);
        if (String(payment.session_type).toLowerCase() === "couple") couples += 1;
        else individuals += 1;
        if (String(payment.session_format).toLowerCase() === "in person") inPerson += 1;
        else online += 1;
        earnings += Number(payment.fee_due || 0);
      });

      controls.individualSessions.textContent = String(individuals);
      controls.coupleSessions.textContent = String(couples);
      controls.onlineSessions.textContent = String(online);
      controls.inPersonSessions.textContent = String(inPerson);
      controls.sessionEarnings.textContent = formatCurrency(earnings);
      return;
    }

    // For current and future periods, make the totals agree with the confirmed
    // sessions actually shown in this calendar period. Expanding every saved
    // block-booking pattern here can count a projected occurrence after that
    // occurrence has been moved, removed or was never added to the calendar.
    const countedOccurrences = new Set();
    state.events.forEach((event) => {
      // Only booking-system records are authoritative. An ordinary Google
      // event can contain a saved client's name and must not become a session
      // merely because its title happens to match that client.
      if (!event.bookingRequestId || !isClientEvent(event) || isPendingEvent(event)) return;
      const start = eventDates(event).start;
      if (start < range.start || start >= range.end) return;
      // One therapist cannot conduct two sessions in the same appointment
      // slot. If separate saved records overlap at the exact same start time,
      // count the slot once rather than inflating the weekly totals.
      const key = `${localDateKey(start)}:${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
      if (countedOccurrences.has(key)) return;
      countedOccurrences.add(key);
      if (isCoupleEvent(event)) couples += 1;
      else individuals += 1;
      if (isInPersonEvent(event)) inPerson += 1;
      else online += 1;
      earnings += feeForEvent(event);
    });

    controls.individualSessions.textContent = String(individuals);
    controls.coupleSessions.textContent = String(couples);
    controls.onlineSessions.textContent = String(online);
    controls.inPersonSessions.textContent = String(inPerson);
    controls.sessionEarnings.textContent = formatCurrency(earnings);
  }

  function bookingOccurrences(booking) {
    const defaultOccurrence = {
      date: booking.preferred_date,
      time: String(booking.preferred_time || "").slice(0, 5),
      format: booking.session_format,
    };
    if (booking.booking_type !== "Block booking") return [defaultOccurrence];

    if (booking.block_date_pattern === "Flexible dates" && Array.isArray(booking.exact_block_dates)) {
      const exactDates = booking.exact_block_dates
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          date: String(item.date || ""),
          time: String(item.time || "").slice(0, 5),
          format: String(item.format || booking.session_format || ""),
        }))
        .filter((item) => item.date && item.time);
      if (exactDates.length) return exactDates;
    }

    if (booking.block_date_pattern === "Regular pattern") {
      const count = Math.min(Math.max(Number(booking.block_session_count) || 1, 1), 20);
      const gapDays = booking.block_frequency === "Fortnightly" ? 14 : 7;
      const firstDate = dateFromKey(booking.preferred_date);
      return Array.from({ length: count }, (_, index) => ({
        ...defaultOccurrence,
        date: localDateKey(addDays(firstDate, gapDays * index)),
      }));
    }

    return [defaultOccurrence];
  }

  function savedBookingEvent(booking) {
    const start = new Date(
      `${booking.preferred_date}T${String(booking.preferred_time).slice(0, 8)}`,
    );
    const durationMinutes =
      Number.parseInt(booking.duration, 10) ||
      (booking.session_type === "Joint session" ? 80 : 50);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    return {
      id: `booking-request-${booking.id}`,
      title: bookingClientName(booking),
      start: start.toISOString(),
      end: end.toISOString(),
      allDay: false,
      location:
        booking.session_format === "In person"
          ? "Cherry Tree Therapy Centre, Henley-on-Thames"
          : "",
      htmlLink: "",
      eventType: "booking",
      bookingRequestId: booking.id,
      sessionType: booking.session_type,
      sessionFormat: booking.session_format,
      calendarSyncStatus: booking.calendar_sync_status,
      bookingStatus: booking.status,
      bookingNote: booking.message || "",
    };
  }

  async function loadSavedBookingEvents(range) {
    const { data, error } = await supabaseClient
      .from("booking_requests")
      .select(
        "id, session_type, session_format, duration, preferred_date, preferred_time, first_name, surname, second_first_name, second_surname, calendar_sync_status, status, message",
      )
      .gte("preferred_date", localDateKey(range.start))
      .lt("preferred_date", localDateKey(range.end))
      .neq("status", "closed");

    if (error) {
      console.error("Could not load unsynced booking requests", error);
      return [];
    }
    return (data || []).map(savedBookingEvent);
  }

  function eventOccursOnDate(event, date) {
    const dayStart = startOfDay(date);
    const dayEnd = addDays(dayStart, 1);
    const eventRange = eventDates(event);
    return eventRange.start < dayEnd && eventRange.end > dayStart;
  }

  function eventsForDate(date) {
    return state.events
      .filter((event) => eventOccursOnDate(event, date))
      .sort((first, second) => {
        if (first.allDay !== second.allDay) return first.allDay ? -1 : 1;
        return eventDates(first).start - eventDates(second).start;
      });
  }

  function eventTime(event) {
    if (event.allDay) return "All day";
    const formatter = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const start = formatter.format(new Date(event.start));
    const end = formatter.format(new Date(event.end));
    return `${start}–${end}`;
  }

  function eventWhen(event) {
    if (event.allDay) {
      const start = dateFromKey(event.start);
      const inclusiveEnd = addDays(dateFromKey(event.end), -1);
      if (isSameDay(start, inclusiveEnd)) {
        return `${new Intl.DateTimeFormat("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(start)}, all day`;
      }
      return `${formatLongDate(start)} to ${formatLongDate(inclusiveEnd)}, all day`;
    }

    const start = new Date(event.start);
    const end = new Date(event.end);
    const dateText = formatLongDate(start);
    const timeFormatter = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${dateText}, ${timeFormatter.format(start)} to ${timeFormatter.format(end)}`;
  }

  function formatLongDate(date) {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  }

  function dayHeading(date, includeMonth = true) {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: includeMonth ? "short" : undefined,
    }).format(date);
  }

  function showEvent(event) {
    state.selectedEvent = event;
    controls.eventSource.textContent =
      event.eventType === "booking" ? "Booking" : "Personal";
    controls.eventTitle.textContent = event.title;
    controls.eventWhen.textContent = eventWhen(event);
    controls.eventLocationRow.hidden = !event.location;
    controls.eventLocation.textContent = event.location || "";
    controls.eventGoogleLink.hidden = !event.htmlLink;
    controls.eventGoogleLink.href = event.htmlLink || "#";
    controls.displayColour.value = displayColourForEvent(event);
    const canReschedule =
      event.eventType === "booking" &&
      Boolean(event.bookingRequestId) &&
      !event.allDay;
    const isLocalPrivate = event.id.startsWith("local-private-");
    const canEditPrivate = event.eventType !== "booking" && !event.allDay;
    controls.rescheduleForm.hidden = !canReschedule;
    controls.bookingDetailsForm.hidden = !canReschedule;
    controls.privateDetailsForm.hidden = !canEditPrivate;
    controls.privateTimeFields.hidden = !isLocalPrivate;
    controls.deletePrivateEvent.hidden = !canEditPrivate;
    [
      controls.privateStartDate,
      controls.privateStartTime,
      controls.privateEndDate,
      controls.privateEndTime,
    ].forEach((input) => {
      input.disabled = !isLocalPrivate;
      input.required = isLocalPrivate;
    });
    controls.cancelBooking.hidden = !canReschedule;
    controls.repeatBooking.hidden = !canReschedule;
    controls.rescheduleMessage.textContent = "";
    controls.bookingDetailsMessage.textContent = "";
    controls.privateMessage.textContent = "";
    if (canEditPrivate) {
      controls.privateTitle.value = event.title;
    }
    if (isLocalPrivate) {
      const start = new Date(event.start);
      const end = new Date(event.end);
      controls.privateStartDate.value = localDateKey(start);
      controls.privateStartTime.value = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
      controls.privateEndDate.value = localDateKey(end);
      controls.privateEndTime.value = `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
    }
    if (canReschedule) {
      const start = new Date(event.start);
      controls.newDate.value = localDateKey(start);
      controls.newTime.value = [
        String(start.getHours()).padStart(2, "0"),
        String(start.getMinutes()).padStart(2, "0"),
      ].join(":");
      controls.newFormat.value =
        event.sessionFormat ||
        (/cherry tree|henley-on-thames/i.test(event.location || "")
          ? "In person"
          : "Online");
      controls.bookingStatus.value = isPendingEvent(event) ? "pending" : "confirmed";
      controls.bookingNote.value = event.bookingNote || "";
    }
    controls.dialog.showModal();
    window.lucide?.createIcons();
  }

  async function moveBookingByDrag(booking, date, time) {
    if (booking.id.startsWith("local-private-")) {
      const oldStart = new Date(booking.start);
      const duration = new Date(booking.end) - oldStart;
      const newStart = new Date(`${localDateKey(date)}T${time}:00`);
      if (!window.confirm(
        `Move ${booking.title}?\n\nFrom: ${eventWhen(booking)}\nTo: ${formatLongDate(date)} at ${time}`,
      )) return;
      booking.start = newStart.toISOString();
      booking.end = new Date(newStart.getTime() + duration).toISOString();
      localStorage.setItem(privateEventStorageKey, JSON.stringify(state.localPrivateEvents));
      await loadEvents();
      controls.message.textContent = "Private event moved.";
      return;
    }
    const newDate = localDateKey(date);
    const sessionFormat = booking.sessionFormat ||
      (/cherry tree|henley-on-thames/i.test(booking.location || "")
        ? "In person"
        : "Online");
    if (!window.confirm(
      `Move ${booking.title}?\n\nFrom: ${eventWhen(booking)}\nTo: ${formatLongDate(date)} at ${time}`,
    )) {
      state.draggedEvent = null;
      return;
    }
    controls.message.textContent = "Moving booking…";
    try {
      const { data, error } = await supabaseClient.functions.invoke(
        window.BOOKING_CONFIG?.calendarRescheduleFunction ||
          "calendar-reschedule-booking",
        { body: {
          bookingId: booking.bookingRequestId,
          eventId: booking.id.startsWith("booking-request-") ? "" : booking.id,
          date: newDate,
          time,
          sessionFormat,
        } },
      );
      if (error) throw error;
      await loadEvents();
      controls.message.textContent = data?.message || "Booking moved.";
    } catch (error) {
      console.error(error);
      controls.message.textContent = "The booking could not be moved. No changes were made.";
    } finally {
      state.draggedEvent = null;
    }
  }

  async function resizeTimedEvent(event, durationMinutes) {
    const start = new Date(event.start);
    const currentMinutes = Math.round((new Date(event.end) - start) / 60000);
    if (durationMinutes === currentMinutes || !window.confirm(
      `Change ${event.title} from ${currentMinutes} minutes to ${durationMinutes} minutes?`,
    )) return;
    controls.message.textContent = "Updating event length…";
    if (event.id.startsWith("local-private-")) {
      event.end = new Date(start.getTime() + durationMinutes * 60000).toISOString();
      localStorage.setItem(privateEventStorageKey, JSON.stringify(state.localPrivateEvents));
      await loadEvents();
      controls.message.textContent = "Private event length updated.";
      return;
    }
    const date = localDateKey(start);
    const time = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
    const sessionFormat = event.sessionFormat ||
      (/cherry tree|henley-on-thames/i.test(event.location || "") ? "In person" : "Online");
    try {
      const body = event.bookingRequestId
        ? {
            bookingId: event.bookingRequestId,
            eventId: event.id.startsWith("booking-request-") ? "" : event.id,
            date, time, sessionFormat, durationMinutes,
          }
        : { action: "resize_event", eventId: event.id, date, time, durationMinutes };
      const { data, error } = await supabaseClient.functions.invoke(
        window.BOOKING_CONFIG?.calendarRescheduleFunction || "calendar-reschedule-booking",
        { body },
      );
      if (error) throw error;
      await loadEvents();
      controls.message.textContent = data?.message || "Event length updated.";
    } catch (error) {
      console.error(error);
      controls.message.textContent = "The event length could not be changed.";
    }
  }

  function createEventButton(event, compact = false, showTime = true) {
    const button = document.createElement("button");
    button.type = "button";
    const displayColour = displayColourForEvent(event);
    const automaticCouple = event.sessionType?.toLowerCase() === "joint session" ||
      /\s&\s/.test(event.title);
    const isCoupleBooking = displayColour === "couple" ||
      (displayColour === "automatic" && automaticCouple);
    const displayEventType = displayColour === "personal"
      ? "personal"
      : ["solo", "couple", "pending"].includes(displayColour)
        ? "booking"
        : event.eventType;
    const displayPending = displayColour === "pending" ||
      (displayColour === "automatic" && isPendingEvent(event));
    const isInPerson =
      event.sessionFormat?.toLowerCase() === "in person" ||
      /cherry tree|henley-on-thames/i.test(event.location || "");
    button.className =
      `calendar-event calendar-event-${displayEventType}` +
      (isCoupleBooking ? " calendar-event-couple" : "") +
      (displayPending ? " calendar-event-pending" : "") +
      (isInPerson ? " calendar-event-in-person" : "") +
      (compact ? " calendar-event-compact" : "");
    button.title =
      `${eventTime(event)}: ${event.title}` +
      (isInPerson ? " (In person)" : "");

    const time = document.createElement("span");
    time.className = "calendar-event-time";
    time.textContent = eventTime(event);

    const title = document.createElement("strong");
    title.textContent = event.title;
    if (showTime) button.append(time);
    button.append(title);
    if (isInPerson) {
      const formatTab = document.createElement("span");
      formatTab.className = "calendar-event-format-tab";
      formatTab.textContent = "IP";
      formatTab.setAttribute("aria-label", "In person");
      button.append(formatTab);
    }
    if ((event.bookingRequestId || event.id.startsWith("local-private-")) && !event.allDay) {
      button.draggable = true;
      button.title += " — drag to move";
      button.addEventListener("dragstart", (dragEvent) => {
        state.draggedEvent = event;
        button.classList.add("is-dragging");
        dragEvent.dataTransfer.effectAllowed = "move";
        dragEvent.dataTransfer.setData("text/plain", event.bookingRequestId || event.id);
      });
      button.addEventListener("dragend", () => {
        state.draggedEvent = null;
        button.classList.remove("is-dragging");
        document.querySelectorAll(".calendar-week-slot.is-drop-target")
          .forEach((slot) => slot.classList.remove("is-drop-target"));
      });
    }
    button.addEventListener("click", () => showEvent(event));
    return button;
  }

  function createEmptyDay() {
    const empty = document.createElement("span");
    empty.className = "calendar-empty-day";
    empty.textContent = "No events";
    return empty;
  }

  function switchToDay(date) {
    state.focusDate = startOfDay(date);
    state.view = "day";
    localStorage.setItem(viewStorageKey, state.view);
    loadEvents();
  }

  function renderMonth() {
    const range = rangeForView();
    const grid = document.createElement("div");
    grid.className = "calendar-month-grid";
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach((label) => {
      const heading = document.createElement("div");
      heading.className = "calendar-month-weekday";
      heading.textContent = label;
      grid.append(heading);
    });

    for (let date = range.start; date < range.end; date = addDays(date, 1)) {
      const day = new Date(date);
      const events = eventsForDate(day);
      const cell = document.createElement("section");
      cell.className = "calendar-month-day";
      if (day.getMonth() !== state.focusDate.getMonth()) {
        cell.classList.add("calendar-day-outside");
      }
      if (isSameDay(day, new Date())) cell.classList.add("calendar-day-today");

      const dayButton = document.createElement("button");
      dayButton.type = "button";
      dayButton.className = "calendar-day-number";
      dayButton.textContent = String(day.getDate());
      dayButton.title = `Open ${formatLongDate(day)}`;
      dayButton.setAttribute("aria-label", `Open ${formatLongDate(day)}`);
      dayButton.addEventListener("click", () => switchToDay(day));
      cell.append(dayButton);

      const eventList = document.createElement("div");
      eventList.className = "calendar-month-events";
      events.slice(0, 3).forEach((event) => {
        eventList.append(createEventButton(event, true));
      });
      if (events.length > 3) {
        const more = document.createElement("button");
        more.type = "button";
        more.className = "calendar-more-events";
        more.textContent = `+${events.length - 3} more`;
        more.addEventListener("click", () => switchToDay(day));
        eventList.append(more);
      }
      cell.append(eventList);
      grid.append(cell);
    }

    controls.surface.append(grid);
  }

  function renderWeek() {
    const start = rangeForView().start;
    const allDayEvents = state.events.filter((event) => {
      if (!event.allDay || !(event.blocksDay || event.id.startsWith("local-private-"))) {
        return false;
      }
      const dates = eventDates(event);
      return dates.start < addDays(start, 7) && dates.end > start;
    });
    const grid = document.createElement("div");
    grid.className = "calendar-week-timetable";
    const firstHour = 7;
    const lastHour = 24;
    const slotMinutes = 30;
    const slotCount = ((lastHour - firstHour) * 60) / slotMinutes;

    const corner = document.createElement("div");
    corner.className = "calendar-week-time-corner";
    corner.textContent = "Time";
    grid.append(corner);

    for (let offset = 0; offset < 7; offset += 1) {
      const date = addDays(start, offset);
      const header = document.createElement("button");
      header.type = "button";
      header.className = "calendar-week-timetable-heading";
      if (isSameDay(date, new Date())) header.classList.add("calendar-day-today");
      if (allDayEvents.some((event) => eventOccursOnDate(event, date))) {
        header.classList.add("calendar-day-blocked");
      }
      header.style.gridColumn = String(offset + 2);
      header.textContent = dayHeading(date);
      header.addEventListener("click", () => switchToDay(date));
      grid.append(header);
    }

    for (let slot = 0; slot < slotCount; slot += 1) {
      const minutes = firstHour * 60 + slot * slotMinutes;
      const time = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
      const row = slot + 2;
      const label = document.createElement("time");
      label.className = "calendar-week-time-label";
      label.classList.add(slot % 2 === 0 ? "calendar-week-hour-row" : "calendar-week-half-hour-row");
      label.style.gridRow = String(row);
      label.textContent = time;
      grid.append(label);
      for (let offset = 0; offset < 7; offset += 1) {
        const date = addDays(start, offset);
        const slotButton = document.createElement("button");
        slotButton.type = "button";
        slotButton.className = "calendar-week-slot";
        slotButton.classList.add(slot % 2 === 0 ? "calendar-week-hour-row" : "calendar-week-half-hour-row");
        slotButton.style.gridColumn = String(offset + 2);
        slotButton.style.gridRow = String(row);
        const blockingEvent = allDayEvents.find((event) => eventOccursOnDate(event, date));
        slotButton.title = blockingEvent
          ? `${formatLongDate(date)} is blocked by ${blockingEvent.title}`
          : `Book ${formatLongDate(date)} at ${time}`;
        slotButton.setAttribute("aria-label", slotButton.title);
        if (blockingEvent) {
          slotButton.classList.add("calendar-week-slot-blocked");
          slotButton.disabled = true;
        } else {
          slotButton.addEventListener("click", () => openQuickBook(date, time));
        }
        slotButton.addEventListener("dragover", (dragEvent) => {
          if (!state.draggedEvent) return;
          dragEvent.preventDefault();
          dragEvent.dataTransfer.dropEffect = "move";
          slotButton.classList.add("is-drop-target");
        });
        slotButton.addEventListener("dragleave", () => {
          slotButton.classList.remove("is-drop-target");
        });
        slotButton.addEventListener("drop", (dragEvent) => {
          dragEvent.preventDefault();
          slotButton.classList.remove("is-drop-target");
          if (state.draggedEvent) moveBookingByDrag(state.draggedEvent, date, time);
        });
        grid.append(slotButton);
      }
    }

    state.events.forEach((event) => {
      if (event.allDay) return;
      const dates = eventDates(event);
      const singleDay = isSameDay(dates.start, new Date(dates.end.getTime() - 1));
      for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
        const day = addDays(start, dayOffset);
        const dayStart = startOfDay(day);
        const dayEnd = addDays(dayStart, 1);
        if (dates.start >= dayEnd || dates.end <= dayStart) continue;
        const visibleStart = new Date(Math.max(
          dates.start.getTime(),
          new Date(day.getFullYear(), day.getMonth(), day.getDate(), firstHour).getTime(),
        ));
        const visibleEnd = new Date(Math.min(dates.end.getTime(), dayEnd.getTime()));
        if (visibleEnd <= visibleStart) continue;
        const startMinutes = visibleStart.getHours() * 60 + visibleStart.getMinutes();
        const endMinutes = visibleEnd.getTime() === dayEnd.getTime()
          ? 24 * 60
          : visibleEnd.getHours() * 60 + visibleEnd.getMinutes();
        const startSlot = Math.max(0, Math.floor((startMinutes - firstHour * 60) / slotMinutes));
        const span = Math.max(1, Math.ceil((endMinutes - startMinutes) / slotMinutes));
        const eventButton = createEventButton(event, true);
        eventButton.classList.add("calendar-week-timed-event");
        eventButton.style.gridColumn = String(dayOffset + 2);
        eventButton.style.gridRow = `${startSlot + 2} / span ${span}`;
        if (singleDay) {
          const resizeGrip = document.createElement("span");
          resizeGrip.className = "calendar-event-resize-grip";
          resizeGrip.title = "Drag to change the finishing time";
          resizeGrip.addEventListener("click", (pointerEvent) => pointerEvent.stopPropagation());
          resizeGrip.addEventListener("pointerdown", (pointerEvent) => {
            pointerEvent.preventDefault();
            pointerEvent.stopPropagation();
            const startY = pointerEvent.clientY;
            const originalSpan = span;
            const slotHeight = Number.parseFloat(getComputedStyle(grid).gridAutoRows) || 34;
            resizeGrip.setPointerCapture(pointerEvent.pointerId);
            const move = (moveEvent) => {
              const change = Math.round((moveEvent.clientY - startY) / slotHeight);
              const nextSpan = Math.max(1, Math.min(slotCount - startSlot, originalSpan + change));
              eventButton.dataset.resizeSpan = String(nextSpan);
              eventButton.style.gridRow = `${startSlot + 2} / span ${nextSpan}`;
            };
            const finish = () => {
              resizeGrip.removeEventListener("pointermove", move);
              resizeGrip.removeEventListener("pointerup", finish);
              const nextSpan = Number(eventButton.dataset.resizeSpan || originalSpan);
              delete eventButton.dataset.resizeSpan;
              if (nextSpan !== originalSpan) resizeTimedEvent(event, nextSpan * slotMinutes);
            };
            resizeGrip.addEventListener("pointermove", move);
            resizeGrip.addEventListener("pointerup", finish);
          });
          eventButton.append(resizeGrip);
        }
        grid.append(eventButton);
      }
    });

    if (allDayEvents.length) {
      const strip = document.createElement("div");
      strip.className = "calendar-week-all-day-events";
      const label = document.createElement("strong");
      label.textContent = "All day";
      strip.append(label);
      allDayEvents.forEach((event) => strip.append(createEventButton(event, true, false)));
      controls.surface.append(strip);
    }
    controls.surface.append(grid);
  }

  function renderDay() {
    const events = eventsForDate(state.focusDate);
    const agenda = document.createElement("div");
    agenda.className = "calendar-day-agenda";

    if (events.length === 0) {
      const empty = document.createElement("div");
      empty.className = "calendar-day-empty-state";
      empty.textContent = "No events on this day.";
      agenda.append(empty);
    } else {
      events.forEach((event) => {
        const row = document.createElement("div");
        row.className = "calendar-agenda-row";
        const time = document.createElement("time");
        time.textContent = eventTime(event);
        row.append(time, createEventButton(event, false, false));
        agenda.append(row);
      });
    }

    controls.surface.append(agenda);
  }

  function renderClientChecklist() {
    const isWeekView = state.view === "week";
    controls.clientChecklist.hidden = !isWeekView;
    if (!isWeekView) return;

    const weekStart = startOfWeek(state.focusDate);
    const weekEnd = addDays(weekStart, 7);
    controls.clientChecklistWeek.textContent = `${dayHeading(weekStart)} – ${dayHeading(addDays(weekStart, 6))}`;

    const bookedClientIds = new Set();
    const pendingClientIds = new Set();
    state.events.forEach((event) => {
      const dates = eventDates(event);
      if (dates.start >= weekEnd || dates.end <= weekStart) return;
      if (!isClientEvent(event)) return;
      const clientId = clientDetailsForEvent(event)?.id;
      if (!clientId) return;
      if (isPendingEvent(event)) pendingClientIds.add(clientId);
      else bookedClientIds.add(clientId);
    });

    const currentClients = state.bookingClients
      .sort((first, second) => bookingClientDisplayName(first).localeCompare(
        bookingClientDisplayName(second), "en-GB", { sensitivity: "base" },
      ));

    const rows = currentClients.map((client) => {
      const noteKey = `client:${client.id}`;
      const row = document.createElement("div");
      row.className = "calendar-client-check-row";
      const heading = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = bookingClientDisplayName(client);
      const frequency = document.createElement("span");
      const bookingPosition = bookedClientIds.has(client.id)
        ? "Booked"
        : pendingClientIds.has(client.id)
          ? "Pending"
          : "Not booked";
      frequency.textContent = `${client.session_frequency || "To be agreed"} · ${bookingPosition}`;
      frequency.classList.add(`is-${bookingPosition.toLowerCase().replace(" ", "-")}`);
      heading.append(name, frequency);
      const note = document.createElement("input");
      note.type = "text";
      const hasLocalDraft = Object.prototype.hasOwnProperty.call(
        state.clientCheckNotes,
        noteKey,
      );
      note.value = hasLocalDraft
        ? state.clientCheckNotes[noteKey]
        : client.frequency_notes || "";
      note.placeholder = "Brief note — carries forward until cleared…";
      note.setAttribute("aria-label", `Ongoing calendar note for ${bookingClientDisplayName(client)}`);
      let lastSavedValue = String(client.frequency_notes || "").trim();
      note.addEventListener("input", () => {
        const value = note.value.trim();
        // Keep even an empty draft until the database confirms the save. This
        // prevents an older saved note reappearing when the week is changed.
        state.clientCheckNotes[noteKey] = value;
        localStorage.setItem(
          clientCheckNotesStorageKey,
          JSON.stringify(state.clientCheckNotes),
        );
      });
      const save = document.createElement("button");
      save.type = "button";
      save.className = "calendar-client-note-save";
      save.textContent = "Save";
      const saveNote = async () => {
        const value = note.value.trim();
        if (value === lastSavedValue) return;
        save.disabled = true;
        save.textContent = "Saving…";
        const { error } = await supabaseClient
          .from("clients")
          .update({ frequency_notes: value || null })
          .eq("id", client.id);
        save.disabled = false;
        if (error) {
          console.error("Calendar client note could not be saved", error);
          save.textContent = "Try again";
          controls.message.textContent = `The note for ${bookingClientDisplayName(client)} could not be saved.`;
          return;
        }
        client.frequency_notes = value || null;
        lastSavedValue = value;
        delete state.clientCheckNotes[noteKey];
        localStorage.setItem(
          clientCheckNotesStorageKey,
          JSON.stringify(state.clientCheckNotes),
        );
        save.textContent = "Saved";
        window.setTimeout(() => { save.textContent = "Save"; }, 1600);
      };
      save.addEventListener("click", saveNote);
      note.addEventListener("change", saveNote);
      const noteControls = document.createElement("div");
      noteControls.className = "calendar-client-note-controls";
      noteControls.append(note, save);
      row.append(heading, noteControls);
      return row;
    });
    controls.clientChecklistList.replaceChildren(...rows);
    controls.clientChecklistEmpty.hidden = currentClients.length > 0;
  }

  function render() {
    controls.periodTitle.textContent = periodTitle();
    renderPeopleTotals();
    renderClientChecklist();
    controls.viewButtons.forEach((button) => {
      const selected = button.dataset.calendarView === state.view;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    controls.surface.replaceChildren();
    controls.surface.dataset.view = state.view;
    controls.surface.closest(".calendar-work-area").dataset.view = state.view;

    if (state.view === "day") renderDay();
    else if (state.view === "week") renderWeek();
    else renderMonth();
  }

  async function errorMessage(error) {
    if (!(error?.context instanceof Response)) {
      return "The calendar could not be loaded. Please refresh and try again.";
    }
    try {
      const body = await error.context.clone().json();
      return body?.message ||
        "The calendar could not be loaded. Please refresh and try again.";
    } catch {
      return "The calendar could not be loaded. Please refresh and try again.";
    }
  }

  async function loadEvents() {
    const requestId = ++state.requestId;
    const range = rangeForView();
    controls.surface.setAttribute("aria-busy", "true");
    controls.message.textContent = "Loading calendar...";
    controls.refresh.disabled = true;

    try {
      await importDiaryWeekStarting17August2026();
      const [calendarResult, unsyncedBookings] = await Promise.all([
        supabaseClient.functions.invoke(
          window.BOOKING_CONFIG?.calendarEventsFunction || "calendar-events",
          {
            body: {
              timeMin: range.start.toISOString(),
              timeMax: range.end.toISOString(),
              timeZone: window.BOOKING_CONFIG?.timeZone || "Europe/London",
            },
          },
        ).catch((error) => ({ data: null, error })),
        loadSavedBookingEvents(range),
        loadClientNames(),
        loadBookingFees(),
      ]);
      const { data, error } = calendarResult;
      if (requestId !== state.requestId) return;

      if (error) {
        console.error("Google Calendar events could not be loaded", error);
      }

      const seenGoogleBookingIds = new Set();
      const googleEvents = (Array.isArray(data?.events) ? data.events : []).filter((event) => {
        if (!event.bookingRequestId) return true;
        if (seenGoogleBookingIds.has(event.bookingRequestId)) return false;
        seenGoogleBookingIds.add(event.bookingRequestId);
        return true;
      });
      const googleBookingIds = new Set(
        googleEvents.map((event) => event.bookingRequestId).filter(Boolean),
      );
      const locallyNeededBookings = unsyncedBookings.filter(
        (event) => !googleBookingIds.has(event.bookingRequestId),
      );
      state.events = removeExternalBookingCopies([
        ...googleEvents,
        ...locallyNeededBookings,
        ...state.localPrivateEvents,
      ].map((event) => {
        const titleOverride = state.titleOverrides[event.id];
        const titledEvent = titleOverride ? { ...event, title: titleOverride } : event;
        if (!titledEvent.bookingRequestId) return titledEvent;
        const details = state.bookingDetailsById.get(titledEvent.bookingRequestId);
        if (!details) return titledEvent;
        if (details.status === "closed") return null;
        let authoritativeTimes = {};
        if (details.bookingType === "Single session" && details.preferredDate && details.preferredTime) {
          const start = new Date(`${details.preferredDate}T${String(details.preferredTime).slice(0, 8)}`);
          const minutes = Number.parseInt(details.duration, 10) ||
            (details.sessionType === "Joint session" ? 80 : 50);
          authoritativeTimes = {
            start: start.toISOString(),
            end: new Date(start.getTime() + minutes * 60000).toISOString(),
          };
        }
        return {
          ...titledEvent,
          ...authoritativeTimes,
          sessionType: details.sessionType || titledEvent.sessionType,
          sessionFormat: details.sessionFormat || titledEvent.sessionFormat,
          bookingStatus: details.status,
          bookingNote: details.note,
          invoiceAmount: details.invoiceAmount,
        };
      }).filter(Boolean));
      controls.message.textContent = error
        ? `Google Calendar is temporarily unavailable — showing ${state.events.length} saved booking${state.events.length === 1 ? "" : "s"}`
        : `${state.events.length} event${state.events.length === 1 ? "" : "s"}`;
      render();
    } catch (error) {
      if (requestId !== state.requestId) return;
      console.error(error);
      controls.message.textContent = await errorMessage(error);
      controls.surface.replaceChildren();
      const errorState = document.createElement("div");
      errorState.className = "calendar-load-error";
      errorState.textContent = "Calendar unavailable";
      controls.surface.append(errorState);
    } finally {
      if (requestId === state.requestId) {
        controls.surface.setAttribute("aria-busy", "false");
        controls.refresh.disabled = false;
      }
    }
  }

  function movePeriod(direction) {
    if (state.view === "day") {
      state.focusDate = addDays(state.focusDate, direction);
    } else if (state.view === "week") {
      state.focusDate = addDays(state.focusDate, direction * 7);
    } else {
      state.focusDate = new Date(
        state.focusDate.getFullYear(),
        state.focusDate.getMonth() + direction,
        1,
      );
    }
    loadEvents();
  }

  controls.previous.addEventListener("click", () => movePeriod(-1));
  controls.next.addEventListener("click", () => movePeriod(1));
  controls.today.addEventListener("click", () => {
    state.focusDate = defaultCalendarFocusDate();
    loadEvents();
  });
  controls.refresh.addEventListener("click", loadEvents);
  controls.viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.calendarView;
      localStorage.setItem(viewStorageKey, state.view);
      loadEvents();
    });
  });
  controls.closeDialog.addEventListener("click", () => controls.dialog.close());
  controls.dialog.addEventListener("click", (event) => {
    if (event.target === controls.dialog) controls.dialog.close();
  });
  controls.colourForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const selected = state.selectedEvent;
    if (!selected) return;
    const colour = controls.displayColour.value;
    if (colour === "automatic") delete state.colourOverrides[selected.id];
    else state.colourOverrides[selected.id] = colour;
    localStorage.setItem(colourStorageKey, JSON.stringify(state.colourOverrides));
    controls.dialog.close();
    render();
  });
  controls.privateDetailsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const privateEvent = state.selectedEvent;
    if (!privateEvent || privateEvent.eventType === "booking") return;
    const updatedTitle = controls.privateTitle.value.trim();
    if (!updatedTitle) return;
    state.titleOverrides[privateEvent.id] = updatedTitle;
    localStorage.setItem(titleStorageKey, JSON.stringify(state.titleOverrides));
    privateEvent.title = updatedTitle;
    if (!privateEvent.id.startsWith("local-private-")) {
      controls.dialog.close();
      render();
      controls.message.textContent = `${updatedTitle} updated.`;
      return;
    }
    const start = new Date(
      `${controls.privateStartDate.value}T${controls.privateStartTime.value}:00`,
    );
    const end = new Date(
      `${controls.privateEndDate.value}T${controls.privateEndTime.value}:00`,
    );
    if (end <= start) {
      controls.privateMessage.textContent =
        "The finish date and time must be after the start date and time.";
      return;
    }
    privateEvent.title = updatedTitle;
    privateEvent.start = start.toISOString();
    privateEvent.end = end.toISOString();
    privateEvent.allDay = false;
    localStorage.setItem(privateEventStorageKey, JSON.stringify(state.localPrivateEvents));
    controls.dialog.close();
    state.focusDate = startOfDay(start);
    await loadEvents();
    controls.message.textContent = `${privateEvent.title} updated.`;
  });

  controls.deletePrivateEvent.addEventListener("click", async () => {
    const privateEvent = state.selectedEvent;
    if (!privateEvent || privateEvent.eventType === "booking") return;
    if (!window.confirm(
      `Cancel ${privateEvent.title}?\n\nThis private event will be removed from the calendar.`,
    )) return;
    if (privateEvent.id.startsWith("local-private-")) {
      state.localPrivateEvents = state.localPrivateEvents.filter(
        (item) => item.id !== privateEvent.id,
      );
      localStorage.setItem(privateEventStorageKey, JSON.stringify(state.localPrivateEvents));
    } else {
      controls.privateMessage.textContent = "Cancelling private event…";
      const { data, error } = await supabaseClient.functions.invoke(
        "calendar-reschedule-booking",
        { body: { action: "delete_private", eventId: privateEvent.id } },
      );
      if (error || data?.error) {
        controls.privateMessage.textContent =
          data?.message || data?.error || "The private event could not be cancelled. Please try again.";
        return;
      }
    }
    delete state.colourOverrides[privateEvent.id];
    localStorage.setItem(colourStorageKey, JSON.stringify(state.colourOverrides));
    delete state.titleOverrides[privateEvent.id];
    localStorage.setItem(titleStorageKey, JSON.stringify(state.titleOverrides));
    controls.dialog.close();
    await loadEvents();
    controls.message.textContent = `${privateEvent.title} cancelled.`;
  });
  controls.quickBookKind.forEach((input) => {
    input.addEventListener("change", () => setQuickBookKind(input.value));
  });
  controls.quickBookClient.addEventListener("change", applyQuickBookClientDefaults);
  controls.quickBookFormat.addEventListener("change", () => {
    const client = selectedQuickBookClient();
    if (!client) return;
    const fee = controls.quickBookFormat.value === "In person"
      ? client.agreed_in_person_fee_gbp ?? client.agreed_session_fee_gbp
      : client.agreed_online_fee_gbp ?? client.agreed_session_fee_gbp;
    controls.quickBookFee.value = fee ?? "";
  });
  controls.closeQuickBook.addEventListener("click", () => controls.quickBookDialog.close());
  controls.cancelQuickBook.addEventListener("click", () => controls.quickBookDialog.close());
  controls.quickBookDialog.addEventListener("click", (event) => {
    if (event.target === controls.quickBookDialog) controls.quickBookDialog.close();
  });

  controls.quickBookForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!controls.quickBookForm.reportValidity()) return;
    const saveButton = document.querySelector("#save-quick-book");
    if (quickBookKind() === "private") {
      const durationMinutes = privateDurationMinutes();
      if (!Number.isFinite(durationMinutes) || durationMinutes < 1) {
        controls.quickBookMessage.textContent =
          "The finish date and time must be after the start date and time.";
        return;
      }
      if (durationMinutes > 525600) {
        controls.quickBookMessage.textContent =
          "Please keep this private event within one year.";
        return;
      }
      saveButton.disabled = true;
      controls.quickBookMessage.textContent = "Saving private event…";
      try {
        const { data, error } = await supabaseClient.functions.invoke(
          window.BOOKING_CONFIG?.calendarRescheduleFunction ||
            "calendar-reschedule-booking",
          { body: {
            action: "create_private",
            title: controls.quickBookPrivateTitle.value.trim(),
            date: controls.quickBookPrivateDate.value,
            time: controls.quickBookPrivateTime.value,
            durationMinutes,
            allDay: false,
            note: controls.quickBookNote.value.trim(),
          } },
        );
        if (error) throw error;
        if (data?.eventId) {
          state.colourOverrides[data.eventId] = "personal";
          localStorage.setItem(colourStorageKey, JSON.stringify(state.colourOverrides));
        }
        controls.quickBookDialog.close();
        await loadEvents();
        controls.message.textContent = "Private event added.";
      } catch (error) {
        console.error(error);
        const date = controls.quickBookPrivateDate.value;
        const start = new Date(`${date}T${controls.quickBookPrivateTime.value}:00`);
        const end = new Date(
          `${controls.quickBookPrivateEndDate.value}T${controls.quickBookPrivateEndTime.value}:00`,
        );
        const localEvent = {
          id: `local-private-${crypto.randomUUID()}`,
          title: controls.quickBookPrivateTitle.value.trim(),
          start: start.toISOString(),
          end: end.toISOString(),
          allDay: false,
          location: "",
          htmlLink: "",
          eventType: "personal",
          bookingNote: controls.quickBookNote.value.trim(),
          blocksDay: false,
        };
        state.localPrivateEvents.push(localEvent);
        localStorage.setItem(privateEventStorageKey, JSON.stringify(state.localPrivateEvents));
        state.colourOverrides[localEvent.id] = "personal";
        localStorage.setItem(colourStorageKey, JSON.stringify(state.colourOverrides));
        controls.quickBookDialog.close();
        await loadEvents();
        controls.message.textContent =
          "Private event saved. Google Calendar synchronisation is still pending.";
      } finally {
        saveButton.disabled = false;
      }
      return;
    }
    const client = selectedQuickBookClient();
    if (!client) return;
    const pending = controls.quickBookStatus.value === "pending";
    const couple = client.record_type === "Couple";
    const fee = Number(controls.quickBookFee.value || 0);
    const bookingId = crypto.randomUUID();
    const row = {
      id: bookingId,
      client_id: client.id,
      session_type: couple ? "Joint session" : "Individual session",
      session_format: controls.quickBookFormat.value,
      booking_source: "Ayesha booking for client",
      client_type: "Existing client",
      booking_type: "Single session",
      price: fee,
      total_cost: fee,
      pay_now_amount: 0,
      remaining_balance: fee,
      invoice_required: !pending && fee > 0,
      invoice_amount: !pending && fee > 0 ? fee : null,
      invoice_note: !pending && fee > 0 ? "Create one invoice for this appointment." : null,
      duration: couple ? "80 minutes" : "50 minutes",
      preferred_date: controls.quickBookDate.value,
      preferred_time: controls.quickBookTime.value,
      first_name: client.first_name || "",
      surname: client.surname || "",
      second_first_name: client.second_first_name || "",
      second_surname: client.second_surname || "",
      email: client.email || client.second_email || "",
      phone: client.phone || "",
      message: controls.quickBookNote.value.trim() || null,
      consent_to_contact: true,
      status: pending ? "contacted" : "confirmed",
      calendar_sync_status: "pending",
    };
    saveButton.disabled = true;
    controls.quickBookMessage.textContent = "Saving booking…";
    try {
      const { error } = await supabaseClient.from("booking_requests").insert(row);
      if (error) throw error;

      if (!pending && controls.quickBookFormat.value === "Online") {
        const { data: zoomData, error: zoomError } = await supabaseClient.functions.invoke(
          window.BOOKING_CONFIG?.zoomCreateMeetingFunction || "zoom-create-meeting",
          { body: { bookingId } },
        );
        if (zoomData?.joinUrl) row.zoom_join_url = zoomData.joinUrl;
        if (zoomError) console.error("The booking was saved but its unique Zoom link needs attention.", zoomError);
      }

      if (!pending && fee > 0) {
        const { error: invoiceError } = await supabaseClient.rpc(
          "ensure_booking_invoice",
          { p_booking_id: bookingId },
        );
        if (invoiceError) console.error("The invoice could not be created.", invoiceError);
      }

      const { error: calendarError } = await supabaseClient.functions.invoke(
        window.BOOKING_CONFIG?.calendarCreateFunction || "calendar-create-booking",
        { body: { bookingId } },
      );
      if (calendarError) {
        console.error("The booking was saved but Google Calendar needs attention.", calendarError);
      }
      controls.quickBookDialog.close();
      await loadEvents();
      if (pending) controls.message.textContent = `${bookingClientDisplayName(client)} saved as pending.`;
      else showWhatsAppConfirmation(client, row, `${bookingClientDisplayName(client)} booked successfully${controls.quickBookFormat.value === "Online" && !row.zoom_join_url ? "; Zoom link needs attention" : ""}.`);
    } catch (error) {
      console.error(error);
      controls.quickBookMessage.textContent =
        `The booking could not be saved. ${error?.message || "Please try again."}`;
    } finally {
      saveButton.disabled = false;
    }
  });

  controls.cancelBooking.addEventListener("click", async () => {
    const booking = state.selectedEvent;
    if (!booking?.bookingRequestId) return;
    if (!window.confirm(
      `Cancel ${booking.title}?\n\nThis removes it from the calendar and cancels any unpaid draft invoice.`,
    )) return;
    controls.cancelBooking.disabled = true;
    controls.bookingDetailsMessage.textContent = "Cancelling booking…";
    try {
      const { data, error } = await supabaseClient.functions.invoke(
        window.BOOKING_CONFIG?.calendarRescheduleFunction ||
          "calendar-reschedule-booking",
        { body: {
          action: "cancel",
          bookingId: booking.bookingRequestId,
          eventId: booking.id.startsWith("booking-request-") ? "" : booking.id,
        } },
      );
      if (error) {
        // Older bookings which were never added to Google Calendar have no
        // external event to remove. If the deployed calendar function cannot
        // handle one of those records, close it directly so it does not remain
        // on the calendar or become invoiceable.
        if (!booking.id.startsWith("booking-request-")) throw error;
        const { error: closeError } = await supabaseClient
          .from("booking_requests")
          .update({
            status: "closed",
            calendar_event_ids: [],
            calendar_sync_status: "synced",
            calendar_sync_error: null,
            invoice_required: false,
          })
          .eq("id", booking.bookingRequestId);
        if (closeError) throw closeError;
        const { data: relatedInvoices } = await supabaseClient
          .from("invoices")
          .select("id, status")
          .eq("booking_id", booking.bookingRequestId);
        const cancellableInvoiceIds = (relatedInvoices || [])
          .filter((invoice) => String(invoice.status).toLowerCase() !== "paid")
          .map((invoice) => invoice.id);
        if (cancellableInvoiceIds.length) {
          await supabaseClient
            .from("invoices")
            .update({ status: "Cancelled" })
            .in("id", cancellableInvoiceIds);
        }
      }
      controls.dialog.close();
      await loadEvents();
      controls.message.textContent = data?.message || "Booking cancelled.";
    } catch (error) {
      console.error(error);
      controls.bookingDetailsMessage.textContent =
        "The booking could not be cancelled. No changes were made.";
    } finally {
      controls.cancelBooking.disabled = false;
    }
  });

  controls.repeatBooking.addEventListener("click", async () => {
    const booking = state.selectedEvent;
    if (!booking?.bookingRequestId) return;
    controls.repeatBooking.disabled = true;
    controls.bookingDetailsMessage.textContent = "Creating next week's booking…";
    try {
      const { data: original, error: loadError } = await supabaseClient
        .from("booking_requests")
        .select("*")
        .eq("id", booking.bookingRequestId)
        .single();
      if (loadError || !original) throw loadError || new Error("Booking not found");
      const repeatedStart = addDays(dateFromKey(original.preferred_date), 7);
      const repeatedDate = localDateKey(repeatedStart);
      const repeatedTime = String(original.preferred_time || "").slice(0, 5);
      if (!window.confirm(
        `Repeat ${booking.title} on ${formatLongDate(repeatedStart)} at ${repeatedTime}?`,
      )) return;
      const { data: duplicates, error: duplicateError } = await supabaseClient
        .from("booking_requests")
        .select("id")
        .eq("client_id", original.client_id)
        .eq("preferred_date", repeatedDate)
        .eq("preferred_time", repeatedTime)
        .neq("status", "closed")
        .limit(1);
      if (duplicateError) throw duplicateError;
      if (duplicates?.length) throw new Error("That client already has a booking at this time.");

      const repeatedId = crypto.randomUUID();
      const repeated = {
        id: repeatedId,
        client_id: original.client_id,
        session_type: original.session_type,
        session_format: original.session_format,
        booking_source: "Ayesha booking for client",
        client_type: original.client_type || "Existing client",
        booking_type: "Single session",
        price: Number(original.price || 0),
        total_cost: Number(original.total_cost ?? original.price ?? 0),
        pay_now_amount: 0,
        remaining_balance: Number(original.total_cost ?? original.price ?? 0),
        invoice_required: Boolean(original.invoice_required),
        invoice_amount: original.invoice_required
          ? Number(original.invoice_amount ?? original.total_cost ?? original.price ?? 0)
          : null,
        invoice_note: original.invoice_note || null,
        payment_reminder_required: false,
        duration: original.duration,
        preferred_date: repeatedDate,
        preferred_time: repeatedTime,
        first_name: original.first_name || "",
        surname: original.surname || "",
        second_first_name: original.second_first_name || "",
        second_surname: original.second_surname || "",
        email: original.email || "",
        phone: original.phone || "",
        message: original.message || null,
        consent_to_contact: Boolean(original.consent_to_contact),
        status: original.status === "contacted" ? "contacted" : "confirmed",
        calendar_sync_status: "pending",
        calendar_event_ids: [],
        payment_status: "not_started",
        amount_received: 0,
        payment_date: null,
        stripe_checkout_session_id: null,
        stripe_payment_intent_id: null,
        stripe_checkout_url: null,
        stripe_checkout_expires_at: null,
        stripe_paid_at: null,
        payment_failure_message: null,
      };
      // Older installations may not yet have every optional payment field.
      // If PostgREST identifies one as unavailable, omit just that field and
      // retry so the repeated appointment itself is not lost.
      let insertError = null;
      const attemptedMissingColumns = new Set();
      while (true) {
        const { error } = await supabaseClient
          .from("booking_requests").insert(repeated);
        insertError = error;
        if (!insertError) break;

        const missingColumn = String(insertError.message || "").match(
          /Could not find the ['"]([^'"]+)['"] column of ['"]booking_requests['"]/i,
        )?.[1];
        if (
          !missingColumn ||
          !(missingColumn in repeated) ||
          attemptedMissingColumns.has(missingColumn)
        ) {
          break;
        }

        attemptedMissingColumns.add(missingColumn);
        delete repeated[missingColumn];
        console.warn(`Repeated-booking field '${missingColumn}' is not available and was omitted.`);
      }
      if (insertError) throw insertError;
      if (repeated.invoice_required && Number(repeated.invoice_amount || 0) > 0) {
        const { error: invoiceError } = await supabaseClient.rpc(
          "ensure_booking_invoice", { p_booking_id: repeatedId },
        );
        if (invoiceError) console.error("Invoice could not be created.", invoiceError);
      }
      let zoomNeedsAttention = false;
      if (
        String(repeated.session_format || "").toLowerCase() === "online" &&
        repeated.status === "confirmed"
      ) {
        const { data: zoomData, error: zoomError } = await supabaseClient.functions.invoke(
          window.BOOKING_CONFIG?.zoomCreateMeetingFunction || "zoom-create-meeting",
          { body: { bookingId: repeatedId } },
        );
        if (zoomData?.joinUrl) repeated.zoom_join_url = zoomData.joinUrl;
        if (zoomError || zoomData?.error || !zoomData?.joinUrl) {
          zoomNeedsAttention = true;
          console.error("Zoom link needs attention.", zoomError || zoomData?.error);
        }
      }
      const { error: calendarError } = await supabaseClient.functions.invoke(
        window.BOOKING_CONFIG?.calendarCreateFunction || "calendar-create-booking",
        { body: { bookingId: repeatedId } },
      );
      if (calendarError) console.error("Google Calendar needs attention.", calendarError);
      controls.dialog.close();
      state.focusDate = startOfDay(repeatedStart);
      await loadEvents();
      const client = state.bookingClients.find(
        (candidate) => candidate.id === repeated.client_id,
      ) || {
        record_type: repeated.second_first_name ? "Couple" : "Individual",
        first_name: repeated.first_name,
        surname: repeated.surname,
        second_first_name: repeated.second_first_name,
        second_surname: repeated.second_surname,
        phone: repeated.phone,
      };
      showWhatsAppConfirmation(
        client,
        repeated,
        `${booking.title} repeated for next week${zoomNeedsAttention ? "; Zoom link needs attention" : ""}.`,
      );
    } catch (error) {
      console.error(error);
      controls.bookingDetailsMessage.textContent = error?.message ||
        "The repeat booking could not be created.";
    } finally {
      controls.repeatBooking.disabled = false;
    }
  });

  controls.bookingDetailsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const booking = state.selectedEvent;
    if (!booking?.bookingRequestId) return;
    const pending = controls.bookingStatus.value === "pending";
    const becomingConfirmed = isPendingEvent(booking) && !pending;
    const update = {
      status: pending ? "contacted" : "confirmed",
      message: controls.bookingNote.value.trim() || null,
    };
    if (pending) {
      update.invoice_required = false;
    }
    if (!pending && Number(booking.invoiceAmount || 0) > 0) {
      update.invoice_required = true;
      update.invoice_amount = Number(booking.invoiceAmount);
    }
    const button = controls.bookingDetailsForm.querySelector("button[type='submit']");
    button.disabled = true;
    controls.bookingDetailsMessage.textContent = "Saving…";
    try {
      const { data: savedBooking, error } = await supabaseClient
        .from("booking_requests")
        .update(update)
        .eq("id", booking.bookingRequestId)
        .select("*")
        .single();
      if (error) throw error;
      if (pending) {
        const { data: pendingDrafts } = await supabaseClient
          .from("invoices")
          .select("id, status")
          .eq("booking_id", booking.bookingRequestId)
          .eq("status", "Draft");
        const pendingDraftIds = (pendingDrafts || []).map((invoice) => invoice.id);
        if (pendingDraftIds.length) {
          const { error: cancelInvoiceError } = await supabaseClient
            .from("invoices")
            .update({ status: "Cancelled" })
            .in("id", pendingDraftIds);
          if (cancelInvoiceError) {
            console.error("Pending invoice could not be cancelled.", cancelInvoiceError);
          }
        }
      }
      if (!pending && Number(booking.invoiceAmount || 0) > 0) {
        const { data: cancelledDrafts } = await supabaseClient
          .from("invoices")
          .select("id, status")
          .eq("booking_id", booking.bookingRequestId)
          .eq("status", "Cancelled");
        const cancelledDraftIds = (cancelledDrafts || []).map((invoice) => invoice.id);
        if (cancelledDraftIds.length) {
          const { error: restoreInvoiceError } = await supabaseClient
            .from("invoices")
            .update({ status: "Draft" })
            .in("id", cancelledDraftIds);
          if (restoreInvoiceError) {
            console.error("Confirmed invoice could not be restored.", restoreInvoiceError);
          }
        }
        const { error: invoiceError } = await supabaseClient.rpc(
          "ensure_booking_invoice",
          { p_booking_id: booking.bookingRequestId },
        );
        if (invoiceError) console.error("Invoice could not be ensured.", invoiceError);
      }

      let zoomNeedsAttention = false;
      if (becomingConfirmed && String(savedBooking?.session_format || "").toLowerCase() === "online") {
        try {
          await ensureBookingZoomLink(savedBooking);
        } catch (zoomError) {
          zoomNeedsAttention = true;
          console.error("The booking was confirmed but its Zoom link needs attention.", zoomError);
        }
      }

      await loadEvents();
      controls.dialog.close();
      if (pending) {
        controls.message.textContent = "Saved as pending.";
      } else if (becomingConfirmed) {
        const client = state.bookingClients.find(
          (candidate) => candidate.id === savedBooking?.client_id,
        ) || {
          record_type: savedBooking?.second_first_name ? "Couple" : "Individual",
          first_name: savedBooking?.first_name || "",
          surname: savedBooking?.surname || "",
          second_first_name: savedBooking?.second_first_name || "",
          second_surname: savedBooking?.second_surname || "",
          phone: savedBooking?.phone || "",
        };
        const clientName = bookingClientDisplayName(client) || booking.title;
        showWhatsAppConfirmation(
          client,
          savedBooking,
          `${clientName} confirmed successfully${zoomNeedsAttention ? "; Zoom link needs attention" : ""}.`,
        );
      } else {
        controls.message.textContent = "Saved as confirmed.";
      }
    } catch (error) {
      console.error(error);
      controls.bookingDetailsMessage.textContent = "The status and note could not be saved.";
    } finally {
      button.disabled = false;
    }
  });

  controls.rescheduleForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const booking = state.selectedEvent;
    if (!booking?.bookingRequestId) return;

    const newDate = controls.newDate.value;
    const newTime = controls.newTime.value;
    const newFormat = controls.newFormat.value;
    const oldWhen = eventWhen(booking);
    const newStart = new Date(`${newDate}T${newTime}:00`);
    const newWhen = `${formatLongDate(newStart)} at ${newTime}`;
    if (!window.confirm(
      `Update ${booking.title}?\n\nFrom: ${oldWhen}\nTo: ${newWhen}\nFormat: ${newFormat}`,
    )) {
      return;
    }

    const submitButton = controls.rescheduleForm.querySelector("button");
    submitButton.disabled = true;
    controls.rescheduleMessage.textContent = "Rescheduling...";
    try {
      const { data, error } = await supabaseClient.functions.invoke(
        window.BOOKING_CONFIG?.calendarRescheduleFunction ||
          "calendar-reschedule-booking",
        {
          body: {
            bookingId: booking.bookingRequestId,
            eventId: booking.id.startsWith("booking-request-") ? "" : booking.id,
            date: newDate,
            time: newTime,
            sessionFormat: newFormat,
          },
        },
      );
      if (error) throw error;
      controls.rescheduleMessage.textContent =
        data?.message || "Booking rescheduled.";
      await loadEvents();
      controls.dialog.close();
    } catch (error) {
      console.error(error);
      let message = "This booking could not be rescheduled. No changes were made.";
      if (error?.context instanceof Response) {
        if (error.context.status === 404) {
          message =
            "Rescheduling is not connected yet. The secure calendar service needs to be deployed.";
        } else {
          try {
            const details = await error.context.clone().json();
            message = details?.message || message;
          } catch {
            // Keep the safe fallback message.
          }
        }
      }
      controls.rescheduleMessage.textContent = message;
    } finally {
      submitButton.disabled = false;
    }
  });

  window.lucide?.createIcons();
  render();
  loadEvents();
})();
