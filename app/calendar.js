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
    message: document.querySelector("#calendar-message"),
    surface: document.querySelector("#calendar-surface"),
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
  };
  const viewStorageKey = "ayesha-admin-calendar-view";
  const validViews = new Set(["day", "week", "month"]);
  const savedView = localStorage.getItem(viewStorageKey);
  const state = {
    view: validViews.has(savedView) ? savedView : "week",
    focusDate: startOfDay(new Date()),
    events: [],
    requestId: 0,
    selectedEvent: null,
  };

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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
      const start = startOfWeek(state.focusDate);
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
    };
  }

  async function loadUnsyncedBookingEvents(range) {
    const { data, error } = await supabaseClient
      .from("booking_requests")
      .select(
        "id, session_type, session_format, duration, preferred_date, preferred_time, first_name, surname, second_first_name, second_surname, calendar_sync_status",
      )
      .gte("preferred_date", localDateKey(range.start))
      .lt("preferred_date", localDateKey(range.end))
      .in("calendar_sync_status", ["pending", "failed"]);

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
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(event.start));
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
    const canReschedule =
      event.eventType === "booking" &&
      Boolean(event.bookingRequestId) &&
      !event.allDay;
    controls.rescheduleForm.hidden = !canReschedule;
    controls.rescheduleMessage.textContent = "";
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
    }
    controls.dialog.showModal();
    window.lucide?.createIcons();
  }

  function createEventButton(event, compact = false, showTime = true) {
    const button = document.createElement("button");
    button.type = "button";
    const isCoupleBooking =
      event.sessionType?.toLowerCase() === "joint session" ||
      /\s&\s/.test(event.title);
    const isInPerson =
      event.sessionFormat?.toLowerCase() === "in person" ||
      /cherry tree|henley-on-thames/i.test(event.location || "");
    button.className =
      `calendar-event calendar-event-${event.eventType}` +
      (isCoupleBooking ? " calendar-event-couple" : "") +
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
    const start = startOfWeek(state.focusDate);
    const grid = document.createElement("div");
    grid.className = "calendar-week-grid";

    for (let offset = 0; offset < 7; offset += 1) {
      const date = addDays(start, offset);
      const events = eventsForDate(date);
      const column = document.createElement("section");
      column.className = "calendar-week-day";
      if (isSameDay(date, new Date())) column.classList.add("calendar-day-today");

      const header = document.createElement("button");
      header.type = "button";
      header.className = "calendar-week-heading";
      header.textContent = dayHeading(date);
      header.addEventListener("click", () => switchToDay(date));
      column.append(header);

      const list = document.createElement("div");
      list.className = "calendar-week-events";
      if (events.length === 0) {
        list.append(createEmptyDay());
      } else {
        events.forEach((event) => list.append(createEventButton(event)));
      }
      column.append(list);
      grid.append(column);
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

  function render() {
    controls.periodTitle.textContent = periodTitle();
    controls.viewButtons.forEach((button) => {
      const selected = button.dataset.calendarView === state.view;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    controls.surface.replaceChildren();
    controls.surface.dataset.view = state.view;

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
        ),
        loadUnsyncedBookingEvents(range),
      ]);
      const { data, error } = calendarResult;
      if (error) throw error;
      if (requestId !== state.requestId) return;

      state.events = [
        ...(Array.isArray(data?.events) ? data.events : []),
        ...unsyncedBookings,
      ];
      controls.message.textContent =
        `${state.events.length} event${state.events.length === 1 ? "" : "s"}`;
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
    state.focusDate = startOfDay(new Date());
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
