const form = document.querySelector("#booking-form");
const dateInput = document.querySelector("#date");
const dateLabelText = document.querySelector("#date-label-text");
const timeSelect = document.querySelector("#time");
const availabilityMessage = document.querySelector("#availability-message");
const bookingList = document.querySelector("#booking-list");
const emptyState = document.querySelector("#empty-state");
const earningsToday = document.querySelector("#earnings-today");
const earningsWeek = document.querySelector("#earnings-week");
const earningsMonth = document.querySelector("#earnings-month");
const confirmation = document.querySelector("#confirmation");
const bookingDetails = document.querySelector("#booking-details");
const bookingTypeFieldset = document.querySelector("#booking-type-fieldset");
const sessionTypeFieldset = document.querySelector("#session-type-fieldset");
const blockBookingFields = document.querySelector("#block-booking-fields");
const blockFrequencyField = document.querySelector("#block-frequency-field");
const flexibleBlockPreferencesField = document.querySelector(
  "#flexible-block-preferences-field",
);
const exactBlockDatesField = document.querySelector("#exact-block-dates-field");
const exactBlockDatesList = document.querySelector("#exact-block-dates-list");
const formatFieldset = document.querySelector("#format-fieldset");
const formatCards = document.querySelectorAll(".format-card");
const onlinePriceLabel = document.querySelector("#online-price-label");
const inPersonPriceLabel = document.querySelector("#in-person-price-label");
const sessionTypeCards = document.querySelectorAll("[name='sessionType']");
const contactFields = document.querySelector("#contact-fields");
const newClientFields = document.querySelector("#new-client-fields");
const secondClientFields = document.querySelector("#second-client-fields");
const phoneField = document.querySelector("#phone-field");
const appointmentFields = document.querySelector("#appointment-fields");
const messageField = document.querySelector("#message-field");
const consentField = document.querySelector("#consent-field");
const consentLabelText = document.querySelector("#consent-label-text");
const submitButton = form.querySelector("button[type='submit']");
const clientTypeFieldset = document.querySelector("#client-type-fieldset");
const linkedClientBanner = document.querySelector("#linked-client-banner");
const linkedClientName = document.querySelector("#linked-client-name");
const linkedClientDetails = document.querySelector("#linked-client-details");
const adminClientPicker = document.querySelector("#admin-client-picker");
const adminClientSearch = document.querySelector("#admin-client-search");
const adminClientSelect = document.querySelector("#admin-client-select");
const chooseAnotherClient = document.querySelector("#choose-another-client");
const bookingFinanceFieldset = document.querySelector("#booking-finance-fieldset");
const bookingFeeOverride = document.querySelector("#booking-fee-override");
const bookingFeeNote = document.querySelector("#booking-fee-note");
const rememberedClientLists = {
  firstNames: document.querySelector("#remembered-client-first-names"),
  surnames: document.querySelector("#remembered-client-surnames"),
  emails: document.querySelector("#remembered-client-emails"),
};

const summary = {
  clientRow: document.querySelector("#summary-client-row"),
  client: document.querySelector("#summary-client"),
  session: document.querySelector("#summary-session"),
  duration: document.querySelector("#summary-duration"),
  format: document.querySelector("#summary-format"),
  price: document.querySelector("#summary-price"),
  date: document.querySelector("#summary-date"),
  time: document.querySelector("#summary-time"),
  totalCost: document.querySelector("#summary-total-cost"),
  payNow: document.querySelector("#summary-pay-now"),
  remainingBalance: document.querySelector("#summary-remaining-balance"),
  paymentReminder: document.querySelector("#summary-payment-reminder"),
  invoiceRow: document.querySelector("#summary-invoice-row"),
  invoice: document.querySelector("#summary-invoice"),
  blockDatesRow: document.querySelector("#summary-block-dates-row"),
  blockDates: document.querySelector("#summary-block-dates"),
  flexibleBlockNote: document.querySelector("#summary-flexible-block-note"),
};

const storageKey = "ayesha-booking-requests";
const rememberedClientsKey = "ayesha-remembered-clients";
const inPersonAvailabilityKey = "ayesha-in-person-availability";
const daysOffKey = "ayesha-public-unavailable-dates";
const maximumDailyBookings = 5;
const appointmentBufferMinutes = 15;
const inPersonBufferMinutes = 0;
const firstBookableTime = "09:00";
const lastBookableTime = "17:00";
const slotIntervalMinutes = 15;
const defaultTimeZone = "Europe/London";
const availabilityCache = new Map();
const inPersonAvailabilityCache = new Map();
const publicUnavailableDateCache = new Map();
const weekDayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
let availabilityRequestId = 0;
let datePickerRenderId = 0;
let linkedAdminClient = null;
let adminClients = [];
const datePicker = {
  root: null,
  title: null,
  grid: null,
  previousButton: null,
  nextButton: null,
  monthDate: null,
};

function getBookings() {
  return JSON.parse(localStorage.getItem(storageKey) || "[]");
}

function saveBookings(bookings) {
  localStorage.setItem(storageKey, JSON.stringify(bookings));
}

function getRememberedClients() {
  return JSON.parse(localStorage.getItem(rememberedClientsKey) || "[]");
}

function saveRememberedClients(clients) {
  localStorage.setItem(rememberedClientsKey, JSON.stringify(clients));
}

function getLocalInPersonAvailability() {
  return JSON.parse(localStorage.getItem(inPersonAvailabilityKey) || "{}");
}

function getLocalDaysOff() {
  return JSON.parse(localStorage.getItem(daysOffKey) || "[]");
}

function createLocalDate(dateValue) {
  return new Date(`${dateValue}T12:00:00`);
}

function dateToIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDaysToIsoDate(dateValue, days) {
  const date = createLocalDate(dateValue);
  date.setDate(date.getDate() + days);
  return dateToIsoDate(date);
}

function weekStartForDate(dateValue) {
  const date = createLocalDate(dateValue);
  const dayIndex = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - dayIndex);
  return dateToIsoDate(date);
}

function weekDatesFor(weekStart) {
  return weekDayLabels.map((_, index) => addDaysToIsoDate(weekStart, index));
}

function formatShortDate(dateValue) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(createLocalDate(dateValue));
}

function monthStartForDate(dateValue) {
  const date = createLocalDate(dateValue);
  date.setDate(1);
  return date;
}

function addMonths(date, months) {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + months);
  return nextDate;
}

function formatMonthTitle(date) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function datePickerGridDates(monthDate) {
  const firstOfMonth = new Date(monthDate);
  firstOfMonth.setDate(1);
  const gridStart = new Date(firstOfMonth);
  const dayIndex = (gridStart.getDay() + 6) % 7;
  gridStart.setDate(gridStart.getDate() - dayIndex);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return dateToIsoDate(date);
  });
}

function isBeforeMinimumDate(dateValue) {
  return Boolean(dateInput.min) && dateValue < dateInput.min;
}

async function availableInPersonDatesForGrid(dateValues) {
  if (isAyeshaBooking() || selectedSessionFormat() !== "In person") {
    return new Set(dateValues);
  }

  const weekStarts = [...new Set(dateValues.map(weekStartForDate))];
  const availableDateGroups = await Promise.all(
    weekStarts.map((weekStart) => loadInPersonAvailability(weekStart)),
  );

  return new Set(availableDateGroups.flat());
}

async function publicUnavailableDatesForGrid(dateValues, options = {}) {
  if (isAyeshaBooking()) return new Set();

  const sortedDates = [...dateValues].sort();
  const startDate = sortedDates[0];
  const endDate = sortedDates[sortedDates.length - 1];
  const cacheKey = `${startDate}|${endDate}`;

  if (!options.refresh && publicUnavailableDateCache.has(cacheKey)) {
    return publicUnavailableDateCache.get(cacheKey);
  }

  const supabaseClient = createSupabaseClient();

  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from("public_unavailable_dates")
      .select("unavailable_date")
      .gte("unavailable_date", startDate)
      .lte("unavailable_date", endDate);

    if (!error) {
      const dates = new Set(data.map((row) => row.unavailable_date));
      publicUnavailableDateCache.set(cacheKey, dates);
      return dates;
    }

    console.error(error);
  }

  const dates = new Set(
    getLocalDaysOff().filter((date) => date >= startDate && date <= endDate),
  );
  publicUnavailableDateCache.set(cacheKey, dates);
  return dates;
}

function setupDatePicker() {
  if (datePicker.root) return;

  const root = document.createElement("div");
  const header = document.createElement("div");
  const previousButton = document.createElement("button");
  const title = document.createElement("strong");
  const nextButton = document.createElement("button");
  const grid = document.createElement("div");

  root.className = "date-picker";
  header.className = "date-picker-header";
  previousButton.type = "button";
  previousButton.className = "date-picker-nav";
  previousButton.textContent = "<";
  previousButton.setAttribute("aria-label", "Previous month");
  title.className = "date-picker-title";
  nextButton.type = "button";
  nextButton.className = "date-picker-nav";
  nextButton.textContent = ">";
  nextButton.setAttribute("aria-label", "Next month");
  grid.className = "date-picker-grid";

  header.append(previousButton, title, nextButton);
  root.append(header, grid);
  dateInput.classList.add("native-date-input");
  dateInput.insertAdjacentElement("afterend", root);

  datePicker.root = root;
  datePicker.title = title;
  datePicker.grid = grid;
  datePicker.previousButton = previousButton;
  datePicker.nextButton = nextButton;
  datePicker.monthDate = monthStartForDate(
    dateInput.value || dateInput.min || dateToIsoDate(new Date()),
  );

  previousButton.addEventListener("click", () => {
    datePicker.monthDate = addMonths(datePicker.monthDate, -1);
    renderDatePicker();
  });
  nextButton.addEventListener("click", () => {
    datePicker.monthDate = addMonths(datePicker.monthDate, 1);
    renderDatePicker();
  });
}

function resetDatePickerToCurrentMonth() {
  datePicker.monthDate = monthStartForDate(dateToIsoDate(new Date()));
}

async function renderDatePicker() {
  if (!datePicker.root) return;

  const renderId = ++datePickerRenderId;
  const monthDate = datePicker.monthDate || monthStartForDate(
    dateInput.value || dateInput.min || dateToIsoDate(new Date()),
  );
  const dateValues = datePickerGridDates(monthDate);
  const [availableInPersonDates, publicUnavailableDates] = await Promise.all([
    availableInPersonDatesForGrid(dateValues),
    publicUnavailableDatesForGrid(dateValues),
  ]);

  if (renderId !== datePickerRenderId) return;

  datePicker.title.textContent = formatMonthTitle(monthDate);
  datePicker.grid.innerHTML = "";

  weekDayLabels.forEach((label) => {
    const dayLabel = document.createElement("span");
    dayLabel.className = "date-picker-weekday";
    dayLabel.textContent = label;
    datePicker.grid.append(dayLabel);
  });

  dateValues.forEach((dateValue) => {
    const date = createLocalDate(dateValue);
    const button = document.createElement("button");
    const outsideMonth = date.getMonth() !== monthDate.getMonth();
    const tooSoon = isBeforeMinimumDate(dateValue);
    const inPersonUnavailable =
      !isAyeshaBooking() &&
      selectedSessionFormat() === "In person" &&
      !availableInPersonDates.has(dateValue);
    const publicUnavailable =
      !isAyeshaBooking() && publicUnavailableDates.has(dateValue);
    const isDisabled = tooSoon || inPersonUnavailable || publicUnavailable;

    button.type = "button";
    button.className = "date-picker-day";
    button.textContent = String(date.getDate());
    button.disabled = isDisabled;
    button.dataset.date = dateValue;
    button.setAttribute("aria-label", formatDate(dateValue));
    if (outsideMonth) button.classList.add("is-outside-month");
    if (dateValue === dateInput.value) button.classList.add("is-selected");
    if (inPersonUnavailable) button.classList.add("is-unavailable");
    if (publicUnavailable) button.classList.add("is-day-off");

    button.addEventListener("click", () => {
      dateInput.value = dateValue;
      dateInput.dispatchEvent(new Event("change", { bubbles: true }));
      renderDatePicker();
    });

    datePicker.grid.append(button);
  });
}

function hasRememberedClientLists() {
  return Boolean(
    rememberedClientLists.firstNames &&
      rememberedClientLists.surnames &&
      rememberedClientLists.emails,
  );
}

function createDatalistOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  if (label) option.label = label;
  return option;
}

function renderRememberedClients() {
  if (!hasRememberedClientLists()) return;

  const clients = getRememberedClients();
  rememberedClientLists.firstNames.innerHTML = "";
  rememberedClientLists.surnames.innerHTML = "";
  rememberedClientLists.emails.innerHTML = "";

  clients.forEach((client) => {
    const fullName = `${client.firstName} ${client.surname}`.trim();

    if (client.firstName) {
      rememberedClientLists.firstNames.append(
        createDatalistOption(client.firstName, client.email),
      );
    }

    if (client.surname) {
      rememberedClientLists.surnames.append(
        createDatalistOption(client.surname, client.email),
      );
    }

    rememberedClientLists.emails.append(
      createDatalistOption(client.email, fullName),
    );
  });
}

function rememberClient(booking) {
  if (!isAyeshaBooking() || !booking.email) return;

  const rememberedClient = {
    firstName: booking.firstName,
    surname: booking.surname,
    secondFirstName: booking.secondFirstName,
    secondSurname: booking.secondSurname,
    email: booking.email.toLowerCase(),
    phone: booking.phone,
  };
  const clients = getRememberedClients().filter((client) => {
    return client.email.toLowerCase() !== rememberedClient.email;
  });

  saveRememberedClients([rememberedClient, ...clients].slice(0, 100));
  renderRememberedClients();
}

function fillRememberedClientDetails() {
  if (!hasRememberedClientLists() || !isAyeshaBooking()) return;

  const emailInput = form.elements.email;
  const firstNameInput = form.elements.firstName;
  const surnameInput = form.elements.surname;
  const secondFirstNameInput = form.elements.secondFirstName;
  const secondSurnameInput = form.elements.secondSurname;
  const phoneInput = form.elements.phone;
  const email = emailInput.value.trim().toLowerCase();
  const client = getRememberedClients().find((rememberedClient) => {
    return rememberedClient.email.toLowerCase() === email;
  });

  if (!client) return;

  firstNameInput.value = client.firstName || firstNameInput.value;
  surnameInput.value = client.surname || surnameInput.value;
  secondFirstNameInput.value = client.secondFirstName || secondFirstNameInput.value;
  secondSurnameInput.value = client.secondSurname || secondSurnameInput.value;
  phoneInput.value = client.phone || phoneInput.value;
}

function formatClientNames(booking) {
  const firstClient = `${booking.firstName || ""} ${booking.surname || ""}`.trim();
  const secondClient = `${booking.secondFirstName || ""} ${
    booking.secondSurname || ""
  }`.trim();

  if (firstClient && secondClient) return `${firstClient} and ${secondClient}`;
  if (firstClient) return firstClient;
  if (secondClient) return secondClient;
  return booking.email;
}

function createSupabaseClient() {
  if (window.ADMIN_SUPABASE) return window.ADMIN_SUPABASE;

  const config = window.BOOKING_CONFIG || {};
  const hasConfig = config.supabaseUrl && config.supabaseAnonKey;

  if (!hasConfig || !window.supabase) return null;

  return window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
}

function linkedClientDisplayName(client) {
  if (!client) return "";

  const first = [client.first_name, client.surname].filter(Boolean).join(" ");
  const second = [client.second_first_name, client.second_surname]
    .filter(Boolean)
    .join(" ");
  return [first, second].filter(Boolean).join(" and ");
}

function linkedClientAgreedFee() {
  if (!isAyeshaBooking() || !linkedAdminClient) return null;
  if (linkedAdminClient.fee_arrangement === "Complimentary") return 0;

  const format =
    selectedSessionFormat() ||
    (linkedAdminClient.preferred_format === "In person"
      ? "In person"
      : "Online");
  return clientFeeForFormat(format);
}

function clientFeeForFormat(format) {
  if (!isAyeshaBooking() || !linkedAdminClient) return null;
  if (linkedAdminClient.fee_arrangement === "Complimentary") return 0;
  const formatFee =
    format === "In person"
      ? linkedAdminClient.agreed_in_person_fee_gbp
      : linkedAdminClient.agreed_online_fee_gbp;
  const rawFee = formatFee ?? linkedAdminClient.agreed_session_fee_gbp;
  if (rawFee === null || rawFee === undefined || rawFee === "") return null;

  const fee = Number(rawFee);
  return Number.isFinite(fee) ? fee : null;
}

function appointmentFeeOverride() {
  if (!isAyeshaBooking() || !bookingFeeOverride || bookingFeeOverride.value === "") {
    return null;
  }
  const fee = Number(bookingFeeOverride.value);
  return Number.isFinite(fee) && fee >= 0 ? fee : null;
}

function syncAppointmentFeeField() {
  if (!bookingFeeOverride || !linkedAdminClient) return;
  const agreedFee = linkedClientAgreedFee();
  bookingFeeOverride.value = agreedFee === null ? "" : String(agreedFee);
  if (bookingFeeNote) {
    const format = selectedSessionFormat();
    bookingFeeNote.textContent =
      agreedFee === null
        ? `No ${format ? format.toLowerCase() : "format-specific"} client fee is recorded; the standard fee will be used.`
        : `${format || "Selected format"} client fee: ${formatSessionPrice(agreedFee)}. You can change it for this appointment.`;
  }
}

function linkedClientDetailText(client) {
  const details = [client.record_type];
  const onlineFee =
    client.agreed_online_fee_gbp ?? client.agreed_session_fee_gbp;
  const inPersonFee =
    client.agreed_in_person_fee_gbp ?? client.agreed_session_fee_gbp;

  details.push(
    onlineFee === null && inPersonFee === null
      ? "standard session prices"
      : `Online ${formatSessionPrice(onlineFee)} · In person ${formatSessionPrice(inPersonFee)}`,
  );

  if (client.preferred_format && client.preferred_format !== "Either") {
    details.push(client.preferred_format);
  }

  return details.join(" · ");
}

function selectRadioValue(name, value) {
  const input = Array.from(form.querySelectorAll(`[name='${name}']`))
    .find((candidate) => candidate.value === value);
  if (input) input.checked = true;
  return input;
}

function applyLinkedClientToForm() {
  if (!linkedAdminClient || !isAyeshaBooking()) return;

  form.elements.linkedClientId.value = linkedAdminClient.id;
  if (bookingFeeOverride) bookingFeeOverride.value = "";
  selectRadioValue("clientType", "Existing client");
  selectRadioValue("bookingType", "Single session");
  selectRadioValue(
    "sessionType",
    linkedAdminClient.record_type === "Couple"
      ? "Joint session"
      : "Individual session",
  );

  updateClientFields();

  form.elements.firstName.value = linkedAdminClient.first_name || "";
  form.elements.surname.value = linkedAdminClient.surname || "";
  form.elements.secondFirstName.value =
    linkedAdminClient.second_first_name || "";
  form.elements.secondSurname.value = linkedAdminClient.second_surname || "";
  form.elements.email.value =
    linkedAdminClient.email || linkedAdminClient.second_email || "";
  form.elements.phone.value =
    linkedAdminClient.phone || linkedAdminClient.second_phone || "";

  updateFormatOptions();
  if (
    linkedAdminClient.preferred_format === "Online" ||
    linkedAdminClient.preferred_format === "In person"
  ) {
    selectRadioValue("sessionFormat", linkedAdminClient.preferred_format);
  }
  syncAppointmentFeeField();

  if (clientTypeFieldset) clientTypeFieldset.hidden = true;
  if (adminClientPicker) adminClientPicker.hidden = true;
  if (bookingFinanceFieldset) bookingFinanceFieldset.hidden = false;
  if (linkedClientBanner) linkedClientBanner.hidden = false;
  if (linkedClientName) {
    linkedClientName.textContent = linkedClientDisplayName(linkedAdminClient);
  }
  if (linkedClientDetails) {
    linkedClientDetails.textContent = linkedClientDetailText(linkedAdminClient);
  }

  populateTimes();
  renderDatePicker();
  updateSummary();
  updateStepAvailability();
}

function renderAdminClientOptions() {
  if (!adminClientSelect) return;
  const query = (adminClientSearch?.value || "").trim().toLowerCase();
  const matches = adminClients.filter((client) =>
    linkedClientDisplayName(client).toLowerCase().includes(query)
  );
  adminClientSelect.replaceChildren();
  matches.forEach((client) => {
    const option = document.createElement("option");
    option.value = client.id;
    option.textContent = `${linkedClientDisplayName(client)} · ${
      client.agreed_online_fee_gbp === null &&
        client.agreed_in_person_fee_gbp === null &&
        client.agreed_session_fee_gbp === null
        ? "standard fees"
        : `Online ${formatSessionPrice(
          client.agreed_online_fee_gbp ?? client.agreed_session_fee_gbp,
        )} · In person ${formatSessionPrice(
          client.agreed_in_person_fee_gbp ?? client.agreed_session_fee_gbp,
        )}`
    }`;
    adminClientSelect.append(option);
  });
  if (matches.length === 0) {
    const option = document.createElement("option");
    option.textContent = "No matching clients";
    option.disabled = true;
    adminClientSelect.append(option);
  }
}

async function loadAdminClientPicker() {
  if (!isAyeshaBooking() || !adminClientSelect) return;
  try {
    const admin = await window.ADMIN_READY;
    const { data, error } = await admin.client
      .from("clients")
      .select([
        "id", "record_type", "first_name", "surname", "email", "phone",
        "second_first_name", "second_surname", "second_email", "second_phone",
        "preferred_format", "agreed_session_fee_gbp",
        "agreed_online_fee_gbp", "agreed_in_person_fee_gbp", "fee_arrangement",
      ].join(","))
      .eq("status", "Active")
      .order("surname");
    if (error) throw error;
    adminClients = data || [];
    renderAdminClientOptions();
  } catch (error) {
    console.error(error);
    adminClientSelect.innerHTML =
      '<option disabled>Clients could not be loaded</option>';
  }
}

async function loadLinkedClientFromQuery() {
  if (!isAyeshaBooking()) return;

  const clientId = new URLSearchParams(window.location.search).get("client");
  if (!clientId) return;

  try {
    const admin = await window.ADMIN_READY;
    const { data, error } = await admin.client
      .from("clients")
      .select([
        "id",
        "record_type",
        "first_name",
        "surname",
        "email",
        "phone",
        "second_first_name",
        "second_surname",
        "second_email",
        "second_phone",
        "preferred_format",
        "agreed_session_fee_gbp",
        "agreed_online_fee_gbp",
        "agreed_in_person_fee_gbp",
        "fee_arrangement",
      ].join(","))
      .eq("id", clientId)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("The selected client record was not found.");

    linkedAdminClient = data;
    applyLinkedClientToForm();
  } catch (error) {
    console.error(error);
    confirmation.hidden = false;
    confirmation.textContent =
      "That client record could not be loaded. Please return to Clients and try again.";
  }
}

async function loadInPersonAvailability(weekStart, options = {}) {
  if (!options.refresh && inPersonAvailabilityCache.has(weekStart)) {
    return inPersonAvailabilityCache.get(weekStart);
  }

  const supabaseClient = createSupabaseClient();

  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from("in_person_availability")
      .select("available_dates")
      .eq("week_start", weekStart)
      .maybeSingle();

    if (!error) {
      const dates = Array.isArray(data?.available_dates) ? data.available_dates : [];
      inPersonAvailabilityCache.set(weekStart, dates);
      return dates;
    }

    console.error(error);
  }

  const localAvailability = getLocalInPersonAvailability();
  const dates = Array.isArray(localAvailability[weekStart])
    ? localAvailability[weekStart]
    : [];

  inPersonAvailabilityCache.set(weekStart, dates);
  return dates;
}

function bookingConfig() {
  return window.BOOKING_CONFIG || {};
}

function configuredTimeZone() {
  return bookingConfig().timeZone || defaultTimeZone;
}

function formatDate(dateValue) {
  if (!dateValue) return "Not chosen yet";

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${dateValue}T12:00:00`));
}

function formatBlockDate(date, time) {
  const formattedDate = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);

  return `${formattedDate}, ${time}`;
}

function setMinimumDate() {
  if (isAyeshaBooking()) {
    dateInput.removeAttribute("min");
    return;
  }
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  dateInput.min = tomorrow.toISOString().slice(0, 10);
}

function isAdminHistoricalDate(dateValue) {
  return Boolean(
    isAyeshaBooking() &&
    dateValue &&
    dateValue < dateToIsoDate(new Date()),
  );
}

function durationToMinutes(duration) {
  const minutes = Number.parseInt(duration, 10);
  return Number.isNaN(minutes) ? 50 : minutes;
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function createTimeSlots() {
  const slots = [];
  const start = timeToMinutes(firstBookableTime);
  const end = timeToMinutes(lastBookableTime);

  for (let time = start; time <= end; time += slotIntervalMinutes) {
    slots.push(minutesToTime(time));
  }

  return slots;
}

function selectedAppointmentDuration() {
  return selectedSessionDuration() || 50;
}

function bufferMinutesForFormat(format) {
  return format === "In person" ? inPersonBufferMinutes : appointmentBufferMinutes;
}

function selectedAppointmentBufferMinutes() {
  return bufferMinutesForFormat(selectedSessionFormat());
}

function calendarAvailabilityCacheKey(date) {
  return [
    date,
    selectedAppointmentDuration(),
    selectedAppointmentBufferMinutes(),
    configuredTimeZone(),
  ].join("|");
}

async function fetchCalendarAvailability(date, options = {}) {
  const supabaseClient = createSupabaseClient();
  const functionName =
    bookingConfig().calendarAvailabilityFunction || "calendar-availability";

  if (!supabaseClient || !date) {
    return { busySlots: [], configured: false };
  }

  const cacheKey = calendarAvailabilityCacheKey(date);
  if (!options.refresh && availabilityCache.has(cacheKey)) {
    return availabilityCache.get(cacheKey);
  }

  const { data, error } = await supabaseClient.functions.invoke(functionName, {
    body: {
      date,
      slots: createTimeSlots(),
      durationMinutes: selectedAppointmentDuration(),
      bufferMinutes: selectedAppointmentBufferMinutes(),
      timeZone: configuredTimeZone(),
    },
  });

  if (error) throw error;

  const availability = {
    busySlots: Array.isArray(data?.busySlots) ? data.busySlots : [],
    configured: data?.configured !== false,
  };

  availabilityCache.set(cacheKey, availability);
  return availability;
}

async function describeCalendarAvailabilityError(error) {
  if (error?.context instanceof Response) {
    const status = error.context.status;
    let errorCode = "";

    try {
      const details = await error.context.clone().json();
      errorCode = details?.code || details?.error || "";
    } catch {
      errorCode = "";
    }

    if (status === 404 || errorCode === "NOT_FOUND") {
      return "Google Calendar availability is not connected yet. The calendar-availability Supabase function has not been deployed.";
    }

    if (status === 401 || status === 403) {
      return "Google Calendar availability is not authorised yet. Please check the Supabase function permissions and Google Calendar sharing.";
    }
  }

  return "Google Calendar availability could not be checked. Times below only reflect saved requests.";
}

function selectedSessionDuration() {
  const selectedSession = form.querySelector("[name='sessionType']:checked");
  if (!selectedSession) return null;
  return durationToMinutes(selectedSession.dataset.duration);
}

function selectedSessionFormat() {
  return form.querySelector("[name='sessionFormat']:checked")?.value || null;
}

async function isPublicInPersonDateAllowed(dateValue) {
  if (isAyeshaBooking() || selectedSessionFormat() !== "In person") return true;
  if (!dateValue) return false;

  const weekStart = weekStartForDate(dateValue);
  const availableDates = await loadInPersonAvailability(weekStart);
  return availableDates.includes(dateValue);
}

async function isPublicDateAvailable(dateValue) {
  if (isAyeshaBooking() || !dateValue) return true;

  const unavailableDates = await publicUnavailableDatesForGrid([dateValue], {
    refresh: true,
  });
  return !unavailableDates.has(dateValue);
}

function selectedSessionPrice() {
  const selectedSession = form.querySelector("[name='sessionType']:checked");
  const selectedFormat = form.querySelector("[name='sessionFormat']:checked");

  if (!selectedSession || !selectedFormat) return null;
  if (selectedSession.value === "Discovery call") return 0;

  return priceForSessionFormat(selectedSession.value, selectedFormat.value);
}

function priceForSessionFormat(sessionType, sessionFormat) {
  if (!sessionType || !sessionFormat) return null;
  if (sessionType === "Discovery call") return 0;

  const overrideFee = appointmentFeeOverride();
  if (overrideFee !== null) return overrideFee;

  const agreedFee = linkedClientAgreedFee();
  if (agreedFee !== null) return agreedFee;

  const priceKey =
    sessionType === "Individual session"
      ? "priceIndividual"
      : "priceJoint";
  const matchingFormat = Array.from(formatCards)
    .map((card) => card.querySelector("input"))
    .find((input) => input.value === sessionFormat);

  return Number(matchingFormat?.dataset[priceKey]);
}

function formatPrice(price) {
  if (price === null || Number.isNaN(price)) return "Not chosen yet";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: Number(price) % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Number(price));
}

function formatSessionPrice(price) {
  if (price === 0) return "Free";
  return formatPrice(price);
}

function formatPayNowButtonText(price) {
  if (price === null || Number.isNaN(price)) return "Choose session first";
  if (price === 0) return "No payment needed";
  return `Pay ${formatPrice(price)} now`;
}

function selectedBookingSource() {
  const bookingSource = form.elements.bookingSource;
  return form.querySelector("[name='bookingSource']:checked")?.value ||
    bookingSource?.value ||
    null;
}

function isAyeshaBooking() {
  return selectedBookingSource() === "Ayesha booking for client";
}

function isPendingAdminBooking() {
  return isAyeshaBooking() && form.elements.bookingStatus?.value === "pending";
}

function selectedBlockSessionCount() {
  const value = form.elements.blockSessionCount?.value;
  if (!value) return null;
  const count = Number(value);
  return Number.isNaN(count) ? null : count;
}

function selectedBlockPaymentPreference() {
  return form.elements.blockPaymentPreference?.value || null;
}

function selectedBlockDatePattern() {
  return form.querySelector("[name='blockDatePattern']:checked")?.value || null;
}

function isFlexibleBlockBooking() {
  return isBlockBooking() && selectedBlockDatePattern() === "Flexible dates";
}

function isRegularBlockBooking() {
  return isBlockBooking() && selectedBlockDatePattern() === "Regular pattern";
}

function usesExactFlexibleBlockDates() {
  return isAyeshaBooking() && isFlexibleBlockBooking() && Boolean(exactBlockDatesList);
}

function calculatePaymentSummary() {
  const sessionPrice = selectedSessionPrice();

  if (sessionPrice === null || Number.isNaN(sessionPrice)) {
    return {
      totalCost: null,
      payNow: null,
      remainingBalance: null,
    };
  }

  if (!isBlockBooking()) {
    return {
      totalCost: sessionPrice,
      payNow: isAyeshaBooking() ? 0 : sessionPrice,
      remainingBalance: isAyeshaBooking() ? sessionPrice : 0,
    };
  }

  const sessionCount = selectedBlockSessionCount();
  const paymentPreference = selectedBlockPaymentPreference();

  if (!sessionCount || !paymentPreference) {
    return {
      totalCost: null,
      payNow: null,
      remainingBalance: null,
    };
  }

  const exactBlockDates = getExactBlockDates();
  const exactBlockPrices =
    usesExactFlexibleBlockDates() && exactBlockDates.length === sessionCount
      ? exactBlockDates.map((blockDate) => {
          return priceForSessionFormat(
            form.querySelector("[name='sessionType']:checked")?.value,
            blockDate.format,
          );
        })
      : [];
  const hasExactBlockPrices =
    exactBlockPrices.length === sessionCount &&
    exactBlockPrices.every((price) => price !== null && !Number.isNaN(price));
  const totalCost = hasExactBlockPrices
    ? exactBlockPrices.reduce((total, price) => total + price, 0)
    : sessionPrice * sessionCount;
  const payNow = isAyeshaBooking() ? 0 : totalCost;

  return {
    totalCost,
    payNow,
    remainingBalance: isAyeshaBooking() ? totalCost : totalCost - payNow,
  };
}

function selectedFirstBlockSessionPrice() {
  const paymentSummary = calculatePaymentSummary();

  if (!isBlockBooking() || paymentSummary.totalCost === null) {
    return selectedSessionPrice();
  }

  const exactBlockDates = getExactBlockDates();
  if (usesExactFlexibleBlockDates() && exactBlockDates[0]?.format) {
    return priceForSessionFormat(
      form.querySelector("[name='sessionType']:checked")?.value,
      exactBlockDates[0].format,
    );
  }

  return selectedSessionPrice();
}

function calculatePaymentReminder() {
  const sessionPrice = selectedFirstBlockSessionPrice();
  const paymentPreference = selectedBlockPaymentPreference();

  if (!isBlockBooking()) return "Not needed";
  if (sessionPrice === null || Number.isNaN(sessionPrice)) return "Not chosen yet";
  if (isAyeshaBooking() && paymentPreference === "Pay all upfront") {
    return "Not needed after the full block payment is received";
  }
  if (paymentPreference === "Pay all upfront") {
    return "Not needed once paid in full";
  }

  return "Not chosen yet";
}

function calculateInvoiceSummary(paymentSummary) {
  if (!isAyeshaBooking()) return "Not needed";
  if (isPendingAdminBooking()) return "No invoice until the booking is confirmed";
  if (paymentSummary.totalCost === null || Number.isNaN(paymentSummary.totalCost)) {
    return "Choose session first";
  }
  if (paymentSummary.totalCost === 0) return "No invoice needed";

  return isBlockBooking()
    ? `One invoice for the full block: ${formatPrice(paymentSummary.totalCost)}`
    : `One invoice for this appointment: ${formatPrice(paymentSummary.totalCost)}`;
}

function calculateBlockDates() {
  if (usesExactFlexibleBlockDates()) {
    return getExactBlockDates()
      .filter((blockDate) => blockDate.date && blockDate.time)
      .map((blockDate) => {
        const formattedDate = formatBlockDate(
          new Date(`${blockDate.date}T12:00:00`),
          blockDate.time,
        );

        return blockDate.format ? `${formattedDate}, ${blockDate.format}` : formattedDate;
      });
  }

  if (!isRegularBlockBooking()) return [];

  const sessionCount = selectedBlockSessionCount();
  const frequency = form.elements.blockFrequency?.value;
  const startDate = dateInput.value;
  const startTime = timeSelect.value;

  if (!sessionCount || !frequency || !startDate || !startTime) return [];

  const gapDays = frequency === "Fortnightly" ? 14 : 7;
  const dates = [];

  for (let index = 0; index < sessionCount; index += 1) {
    const date = new Date(`${startDate}T12:00:00`);
    date.setDate(date.getDate() + gapDays * index);
    dates.push(formatBlockDate(date, startTime));
  }

  return dates;
}

function updateBlockDatesSummary() {
  const blockDates = calculateBlockDates();
  const showFlexibleNote = isFlexibleBlockBooking() && blockDates.length === 0;

  summary.blockDates.innerHTML = "";
  summary.blockDatesRow.hidden = blockDates.length === 0 && !showFlexibleNote;
  summary.flexibleBlockNote.hidden = !showFlexibleNote;

  blockDates.forEach((blockDate) => {
    const item = document.createElement("li");
    item.textContent = blockDate;
    summary.blockDates.append(item);
  });
}

function hasAppointmentBufferConflict(slot, bookingsForDate) {
  const currentDuration = selectedSessionDuration();
  const currentBuffer = selectedAppointmentBufferMinutes();

  if (!currentDuration) return false;

  const slotStart = timeToMinutes(slot);
  const slotEnd = slotStart + currentDuration;

  return bookingsForDate.some((booking) => {
    const bookingStart = timeToMinutes(booking.time);
    const bookingEnd = bookingStart + durationToMinutes(booking.duration);
    const bookingBuffer = bufferMinutesForFormat(booking.sessionFormat);

    return (
      slotStart < bookingEnd + bookingBuffer &&
      slotEnd + currentBuffer > bookingStart
    );
  });
}

async function populateTimes() {
  const selectedDate = dateInput.value;
  const historicalEntry = isAdminHistoricalDate(selectedDate);
  const requestId = ++availabilityRequestId;
  const bookings = getBookings();
  const bookingsForDate = bookings.filter(
    (booking) => booking.date === selectedDate,
  );
  const bookedTimes = bookingsForDate.map((booking) => booking.time);
  const dailyLimitReached = !historicalEntry && bookingsForDate.length >= maximumDailyBookings;
  let googleBusySlots = [];
  let calendarUnavailable = false;

  timeSelect.innerHTML = '<option value="">Choose a time</option>';
  timeSelect.disabled = dailyLimitReached;
  availabilityMessage.textContent = dailyLimitReached
    ? "This day already has the maximum of five booking requests."
    : "";

  if (!isAyeshaBooking() && selectedDate && !(await isPublicDateAvailable(selectedDate))) {
    timeSelect.disabled = false;
    availabilityMessage.textContent =
      "Ayesha is not available for public bookings on this date.";
    return;
  }

  if (!isAyeshaBooking() && selectedDate && !(await isPublicInPersonDateAllowed(selectedDate))) {
    timeSelect.disabled = false;
    availabilityMessage.textContent =
      "In-person sessions are not available for public booking on this date.";
    return;
  }

  if (selectedDate && !dailyLimitReached && !historicalEntry) {
    availabilityMessage.textContent = "Checking Google Calendar availability...";

    try {
      const calendarAvailability = await fetchCalendarAvailability(selectedDate);
      if (requestId !== availabilityRequestId) return;
      googleBusySlots = calendarAvailability.busySlots;
      calendarUnavailable = !calendarAvailability.configured;
      availabilityMessage.textContent = calendarUnavailable
        ? "Google Calendar is not configured yet. Times below only reflect saved requests."
        : "";
    } catch (error) {
      if (requestId !== availabilityRequestId) return;
      calendarUnavailable = true;
      availabilityMessage.textContent = await describeCalendarAvailabilityError(error);
      console.error(error);
    }
  }

  createTimeSlots().forEach((slot) => {
    const hasBufferConflict = hasAppointmentBufferConflict(slot, bookingsForDate);
    const hasGoogleConflict = googleBusySlots.includes(slot);

    const slotUnavailable = !historicalEntry && (
      dailyLimitReached ||
      bookedTimes.includes(slot) ||
      hasBufferConflict ||
      hasGoogleConflict
    );

    if (slotUnavailable) return;

    const option = document.createElement("option");
    option.value = slot;
    option.textContent = slot;
    timeSelect.append(option);
  });

  if (
    !dailyLimitReached &&
    selectedDate &&
    !Array.from(timeSelect.options).some((option) => option.value)
  ) {
    availabilityMessage.textContent = "No available times on this date.";
  }
}

function selectedSessionGroup() {
  const selectedSession = form.querySelector("[name='sessionType']:checked");
  if (!selectedSession) return null;
  return selectedSession.value === "Discovery call" ? "discovery" : "therapy";
}

function isJointSession() {
  return form.querySelector("[name='sessionType']:checked")?.value === "Joint session";
}

function updateFormatOptions() {
  const activeGroup = selectedSessionGroup();
  const selectedSession = form.querySelector("[name='sessionType']:checked");
  const onlineFee = clientFeeForFormat("Online");
  const inPersonFee = clientFeeForFormat("In person");

  formatFieldset.hidden = !activeGroup;

  if (
    (onlineFee !== null || inPersonFee !== null) &&
    selectedSession &&
    selectedSession.value !== "Discovery call"
  ) {
    onlinePriceLabel.textContent =
      onlineFee === null
        ? "Standard online fee"
        : `${formatSessionPrice(onlineFee)} agreed online fee`;
    inPersonPriceLabel.textContent =
      `${
        inPersonFee === null
          ? "Standard in-person fee"
          : `${formatSessionPrice(inPersonFee)} agreed in-person fee`
      }, Cherry Tree Therapy Centre, Henley-on-Thames`;
  } else if (selectedSession?.value === "Individual session") {
    onlinePriceLabel.textContent = "£80";
    inPersonPriceLabel.textContent =
      "£90, Cherry Tree Therapy Centre, Henley-on-Thames";
  } else if (selectedSession?.value === "Joint session") {
    onlinePriceLabel.textContent = "£150";
    inPersonPriceLabel.textContent =
      "£165, Cherry Tree Therapy Centre, Henley-on-Thames";
  } else {
    onlinePriceLabel.textContent = "Choose a session type to see price";
    inPersonPriceLabel.textContent = "Cherry Tree Therapy Centre, Henley-on-Thames";
  }

  formatCards.forEach((card) => {
    const input = card.querySelector("input");
    const isVisible = Boolean(activeGroup) && card.dataset.formatGroup === activeGroup;

    card.hidden = !isVisible;
    input.disabled = !isVisible;

    if (!isVisible && input.checked) input.checked = false;
  });
}

function updateSummary() {
  const selectedRadio = form.querySelector("[name='sessionType']:checked");
  const selectedFormat = form.querySelector("[name='sessionFormat']:checked");

  if (summary.clientRow && summary.client) {
    summary.clientRow.hidden = !linkedAdminClient;
    summary.client.textContent = linkedAdminClient
      ? linkedClientDisplayName(linkedAdminClient)
      : "";
  }
  summary.session.textContent = selectedRadio?.value || "Not chosen yet";
  summary.duration.textContent = selectedRadio?.dataset.duration || "Not chosen yet";
  summary.format.textContent = selectedFormat?.value || "Not chosen yet";
  summary.price.textContent = formatSessionPrice(selectedSessionPrice());
  summary.date.textContent = formatDate(dateInput.value);
  summary.time.textContent = timeSelect.value || "Not chosen yet";

  const paymentSummary = calculatePaymentSummary();
  summary.totalCost.textContent = formatPrice(paymentSummary.totalCost);
  summary.payNow.textContent = isAyeshaBooking()
    ? isPendingAdminBooking()
      ? "Pending — no invoice yet"
      : "Invoice after booking"
    : formatPayNowButtonText(paymentSummary.payNow);
  summary.payNow.disabled =
    isAyeshaBooking() ||
    paymentSummary.payNow === null ||
    paymentSummary.payNow === 0;
  summary.remainingBalance.textContent = formatPrice(paymentSummary.remainingBalance);
  summary.paymentReminder.textContent = calculatePaymentReminder();
  summary.invoiceRow.hidden = !isAyeshaBooking();
  summary.invoice.textContent = calculateInvoiceSummary(paymentSummary);
  updateBlockDatesSummary();
}

function selectedClientType() {
  return form.querySelector("[name='clientType']:checked")?.value || null;
}

function selectedBookingType() {
  return form.querySelector("[name='bookingType']:checked")?.value || "Single session";
}

function hasRequiredBookingTypeChoice() {
  const canChooseBlockBooking = selectedClientType() === "Existing client" || isAyeshaBooking();

  return !canChooseBlockBooking || Boolean(form.querySelector("[name='bookingType']:checked"));
}

function isBlockBooking() {
  return (
    (selectedClientType() === "Existing client" || isAyeshaBooking()) &&
    selectedBookingType() === "Block booking"
  );
}

function hasSelectedSessionType() {
  return Boolean(form.querySelector("[name='sessionType']:checked"));
}

function hasSelectedAppointment() {
  return Boolean(dateInput.value && timeSelect.value);
}

function blockBookingDetailsComplete() {
  if (!isBlockBooking()) return true;

  const hasCoreBlockDetails = Boolean(
    selectedBlockSessionCount() &&
      selectedBlockDatePattern() &&
      selectedBlockPaymentPreference() &&
      form.elements.blockCancellationAgreement?.checked,
  );

  if (!hasCoreBlockDetails) return false;
  if (isRegularBlockBooking()) return Boolean(form.elements.blockFrequency?.value);
  if (isFlexibleBlockBooking() && isAyeshaBooking()) return hasCompleteExactBlockDates();
  if (isFlexibleBlockBooking()) {
    return Boolean(form.elements.flexibleBlockPreferences?.value.trim());
  }

  return true;
}

function requiredContactFieldsComplete() {
  const isExistingClient = selectedClientType() === "Existing client";
  const isAyesha = isAyeshaBooking();
  const needsFullClientDetails =
    Boolean(selectedClientType()) && (!isExistingClient || isAyesha);
  const fields = isAyesha ? ["firstName", "surname"] : ["email"];

  if (needsFullClientDetails && !isAyesha) fields.push("firstName", "surname", "phone");
  if (needsFullClientDetails && isJointSession()) {
    fields.push("secondFirstName", "secondSurname");
  }

  return fields.every((field) => {
    return form.elements[field]?.value.trim();
  });
}

function setSectionLocked(section, locked) {
  if (!section) return;

  section.classList.toggle("step-locked", locked);
  const controls = section.matches?.("input, select, textarea, button")
    ? [section]
    : Array.from(section.querySelectorAll("input, select, textarea, button"));

  controls.forEach((control) => {
    if (locked) {
      control.dataset.stepLocked = "true";
      control.disabled = true;
      return;
    }

    const isUnavailableTimeSelect =
      control === timeSelect &&
      availabilityMessage.textContent.includes("maximum of five");

    if (
      control.dataset.stepLocked === "true" &&
      !control.closest("[hidden]") &&
      !isUnavailableTimeSelect
    ) {
      control.disabled = false;
    }

    delete control.dataset.stepLocked;
  });
}

function updateStepAvailability() {
  const hasClientType = Boolean(selectedClientType());
  const hasBookingType = hasRequiredBookingTypeChoice();
  const hasSessionType = hasSelectedSessionType();
  const hasFormat = Boolean(selectedSessionFormat());
  const hasAppointment = hasSelectedAppointment();
  const hasBlockDetails = blockBookingDetailsComplete();
  const hasContactDetails = requiredContactFieldsComplete();
  const hasConsent = isAyeshaBooking() || Boolean(form.elements.consent?.checked);

  setSectionLocked(bookingTypeFieldset, !hasClientType);
  setSectionLocked(sessionTypeFieldset, !hasClientType || !hasBookingType);
  setSectionLocked(formatFieldset, !hasSessionType);
  setSectionLocked(appointmentFields, !hasSessionType || !hasFormat);
  setSectionLocked(blockBookingFields, !hasAppointment);
  setSectionLocked(contactFields, !hasAppointment || !hasBlockDetails);
  setSectionLocked(messageField, !hasContactDetails);
  setSectionLocked(consentField, !hasContactDetails);
  setSectionLocked(submitButton, !hasContactDetails || !hasConsent);
}

function updateBlockBookingFields() {
  const isExistingClient = selectedClientType() === "Existing client";
  const canChooseBlockBooking = isExistingClient || isAyeshaBooking();
  const shouldShowBlockFields = isBlockBooking();
  const bookingTypeInputs = form.querySelectorAll("[name='bookingType']");
  const blockInputs = blockBookingFields.querySelectorAll("input, select");
  const blockDatePatternInputs = form.querySelectorAll("[name='blockDatePattern']");
  const blockFrequencyInput = form.elements.blockFrequency;
  const flexiblePreferencesInput = form.elements.flexibleBlockPreferences;

  bookingTypeFieldset.hidden = !canChooseBlockBooking;
  bookingTypeInputs.forEach((input) => {
    input.disabled = !canChooseBlockBooking;
    input.required = canChooseBlockBooking;
  });

  if (!canChooseBlockBooking) {
    bookingTypeInputs.forEach((input) => {
      input.checked = false;
    });
  }

  blockBookingFields.hidden = !shouldShowBlockFields;
  blockInputs.forEach((input) => {
    input.disabled = !shouldShowBlockFields;
    input.required = shouldShowBlockFields;
    if (!shouldShowBlockFields) {
      if (input.type === "checkbox" || input.type === "radio") input.checked = false;
      else input.value = "";
    }
  });

  blockDatePatternInputs.forEach((input) => {
    input.required = shouldShowBlockFields;
  });

  if (shouldShowBlockFields) {
    form.elements.blockPaymentPreference.value = "Pay all upfront";
  }

  blockFrequencyField.hidden = !isRegularBlockBooking();
  blockFrequencyInput.disabled = !isRegularBlockBooking();
  blockFrequencyInput.required = isRegularBlockBooking();
  if (!isRegularBlockBooking()) blockFrequencyInput.value = "";

  flexibleBlockPreferencesField.hidden = !isFlexibleBlockBooking();
  flexiblePreferencesInput.disabled = !isFlexibleBlockBooking();
  flexiblePreferencesInput.required = isFlexibleBlockBooking() && !isAyeshaBooking();
  if (!isFlexibleBlockBooking()) flexiblePreferencesInput.value = "";

  updateExactBlockDateFields();

  dateLabelText.textContent = shouldShowBlockFields
    ? "Preferred start date"
    : "Preferred date";
}

function getExactBlockDates() {
  if (!exactBlockDatesList) return [];

  return Array.from(exactBlockDatesList.querySelectorAll(".exact-block-date-row")).map(
    (row) => {
      return {
        date: row.querySelector("[name='exactBlockDate']")?.value || "",
        time: row.querySelector("[name='exactBlockTime']")?.value || "",
        format: row.querySelector("[name='exactBlockFormat']")?.value || "",
      };
    },
  );
}

function hasCompleteExactBlockDates() {
  if (!usesExactFlexibleBlockDates()) return true;

  const sessionCount = selectedBlockSessionCount();
  const exactBlockDates = getExactBlockDates();

  return (
    Boolean(sessionCount) &&
    exactBlockDates.length === sessionCount &&
    exactBlockDates.every((blockDate) => {
      return blockDate.date && blockDate.time && blockDate.format;
    })
  );
}

function createExactBlockFormatSelect(value) {
  const select = document.createElement("select");
  select.name = "exactBlockFormat";
  select.required = true;

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose format";
  select.append(placeholder);

  const activeGroup = selectedSessionGroup();
  formatCards.forEach((card) => {
    if (card.dataset.formatGroup !== activeGroup) return;

    const formatInput = card.querySelector("input");
    const option = document.createElement("option");
    option.value = formatInput.value;
    option.textContent = formatInput.value;
    option.selected = formatInput.value === value;
    select.append(option);
  });

  return select;
}

function createExactBlockTimeSelect(value) {
  const select = document.createElement("select");
  select.name = "exactBlockTime";
  select.required = true;

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose time";
  select.append(placeholder);

  createTimeSlots().forEach((slot) => {
    const option = document.createElement("option");
    option.value = slot;
    option.textContent = slot;
    option.selected = slot === value;
    select.append(option);
  });

  return select;
}

function updateExactBlockDateFields() {
  if (!exactBlockDatesField || !exactBlockDatesList) return;

  const shouldShowExactDates = usesExactFlexibleBlockDates();
  const sessionCount = selectedBlockSessionCount() || 0;
  const existingDates = getExactBlockDates();

  exactBlockDatesField.hidden = !shouldShowExactDates;

  if (!shouldShowExactDates || !sessionCount) {
    exactBlockDatesList.innerHTML = "";
    exactBlockDatesList.dataset.count = "0";
    return;
  }

  if (exactBlockDatesList.dataset.count === String(sessionCount)) {
    exactBlockDatesList
      .querySelectorAll("input, select")
      .forEach((input) => {
        input.disabled = false;
        input.required = true;
      });
    return;
  }

  exactBlockDatesList.innerHTML = "";

  for (let index = 0; index < sessionCount; index += 1) {
    const existingDate = existingDates[index] || {};
    const row = document.createElement("div");
    row.className = "exact-block-date-row";

    const dateLabel = document.createElement("label");
    dateLabel.textContent = `Session ${index + 1} date`;
    const dateInputForRow = document.createElement("input");
    dateInputForRow.name = "exactBlockDate";
    dateInputForRow.type = "date";
    dateInputForRow.required = true;
    if (dateInput.min) dateInputForRow.min = dateInput.min;
    dateInputForRow.value = existingDate.date || "";
    dateLabel.append(dateInputForRow);

    const timeLabel = document.createElement("label");
    timeLabel.textContent = "Time";
    timeLabel.append(createExactBlockTimeSelect(existingDate.time || ""));

    const formatLabel = document.createElement("label");
    formatLabel.textContent = "Format";
    formatLabel.append(
      createExactBlockFormatSelect(existingDate.format || selectedSessionFormat() || ""),
    );

    row.append(dateLabel, timeLabel, formatLabel);
    exactBlockDatesList.append(row);
  }

  exactBlockDatesList.dataset.count = String(sessionCount);
}

function updateClientFields() {
  const clientType = selectedClientType();
  const hasSelectedClientType = Boolean(clientType);
  const isExistingClient = clientType === "Existing client";
  const isAyesha = isAyeshaBooking();
  const needsFullClientDetails = hasSelectedClientType && (!isExistingClient || isAyesha);
  const bookingDetailFields = bookingDetails.querySelectorAll("input, select, textarea");
  const firstNameInput = form.elements.firstName;
  const surnameInput = form.elements.surname;
  const emailInput = form.elements.email;
  const phoneInput = form.elements.phone;
  const secondFirstNameInput = form.elements.secondFirstName;
  const secondSurnameInput = form.elements.secondSurname;
  const needsSecondClientNames = needsFullClientDetails && isJointSession();

  bookingDetails.hidden = !hasSelectedClientType;
  bookingDetailFields.forEach((field) => {
    field.disabled = !hasSelectedClientType;
  });

  updateBlockBookingFields();

  contactFields.hidden = !hasSelectedClientType;
  newClientFields.hidden = !needsFullClientDetails;
  secondClientFields.hidden = !needsSecondClientNames;
  phoneField.hidden = !needsFullClientDetails;

  firstNameInput.required = needsFullClientDetails;
  surnameInput.required = needsFullClientDetails;
  emailInput.required = hasSelectedClientType && !isAyesha;
  phoneInput.required = needsFullClientDetails && !isAyesha;
  secondFirstNameInput.required = needsSecondClientNames;
  secondSurnameInput.required = needsSecondClientNames;

  firstNameInput.disabled = !needsFullClientDetails;
  surnameInput.disabled = !needsFullClientDetails;
  emailInput.disabled = !hasSelectedClientType;
  phoneInput.disabled = !needsFullClientDetails;
  secondFirstNameInput.disabled = !needsSecondClientNames;
  secondSurnameInput.disabled = !needsSecondClientNames;

  if (!needsFullClientDetails) {
    firstNameInput.value = "";
    surnameInput.value = "";
    phoneInput.value = "";
  }

  if (!needsSecondClientNames) {
    secondFirstNameInput.value = "";
    secondSurnameInput.value = "";
  }

  if (!hasSelectedClientType) emailInput.value = "";

  consentLabelText.textContent = isAyesha
    ? "I confirm this client can be contacted about this booking and payment."
    : "I consent to being contacted about this booking.";
  consentField.hidden = isAyesha;
  form.elements.consent.required = !isAyesha;
  submitButton.textContent = isAyesha
    ? isPendingAdminBooking()
      ? "Save pending booking"
      : "Book session and create invoice"
    : "Request booking";

  sessionTypeCards.forEach((input) => {
    const card = input.closest(".session-card");
    const isNewOnly = input.dataset.clientGroup === "new";
    const shouldHide = !isAyesha && isExistingClient && isNewOnly;

    card.hidden = shouldHide;
    input.disabled = !hasSelectedClientType || shouldHide;

    if (shouldHide && input.checked) input.checked = false;
  });

  if (hasSelectedClientType) updateFormatOptions();
}

function renderBookings(sourceBookings = getBookings()) {
  const bookings = sourceBookings.slice(0, 5);
  bookingList.innerHTML = "";
  emptyState.hidden = bookings.length > 0;

  bookings.forEach((booking) => {
    const item = document.createElement("li");
    const session = document.createElement("strong");
    const when = document.createElement("small");
    const client = document.createElement("small");
    const invoice = document.createElement("small");
    const payment = document.createElement("small");
    const calendar = document.createElement("small");
    const paymentButton = document.createElement("button");
    const stripeLinkButton = document.createElement("button");
    const lineBreak = document.createElement("br");
    const secondLineBreak = document.createElement("br");
    const thirdLineBreak = document.createElement("br");

    session.textContent =
      booking.bookingType === "Block booking"
        ? `Block booking: ${booking.sessionType}`
        : booking.sessionType;
    when.textContent = `${booking.sessionFormat || "Format not recorded"}, ${formatDate(
      booking.date,
    )} at ${booking.time} - ${formatSessionPrice(booking.price ?? null)}`;
    client.textContent =
      booking.clientType === "Existing client" && !booking.invoiceRequired
        ? `Existing client: ${booking.email}`
        : formatClientNames(booking);
    invoice.textContent = booking.invoiceRequired
      ? `Ayesha booked this. Payment request: ${formatPrice(booking.invoiceAmount)}`
      : booking.bookingSource || "Client booking";
    const received = Number(booking.amountReceived || 0);
    const charged = Number(booking.totalCost || booking.price || 0);
    payment.textContent = booking.paymentStatus === "pending"
      ? "Payment: secure Stripe link ready — awaiting payment"
      : booking.paymentStatus === "failed"
        ? "Payment: failed — a new link is needed"
        : booking.paymentStatus === "expired"
          ? "Payment: link expired — a new link is needed"
          : received >= charged && charged > 0
        ? `Payment: paid ${formatPrice(received)}`
        : received > 0
          ? `Payment: part-paid ${formatPrice(received)} of ${formatPrice(charged)}`
          : `Payment: unpaid (${formatPrice(charged)} due)`;
    calendar.textContent =
      booking.calendarSyncStatus === "synced"
        ? "Google Calendar: added"
        : booking.calendarSyncStatus === "partial"
          ? "Google Calendar: known dates added; flexible dates remain"
          : booking.calendarSyncStatus === "failed"
            ? "Google Calendar: needs attention"
            : "Google Calendar: pending";
    paymentButton.type = "button";
    paymentButton.className = "booking-payment-button";
    paymentButton.textContent = received > 0 ? "Update payment" : "Record payment";
    paymentButton.addEventListener("click", () => updateBookingPayment(booking));
    stripeLinkButton.type = "button";
    stripeLinkButton.className = "booking-payment-button";
    stripeLinkButton.textContent = booking.stripeCheckoutUrl
      ? "Copy Stripe link"
      : "Create Stripe link";
    stripeLinkButton.addEventListener("click", async () => {
      try {
        const url = booking.stripeCheckoutUrl || await createStripeCheckout(booking);
        await navigator.clipboard.writeText(url);
        stripeLinkButton.textContent = "Stripe link copied";
      } catch (error) {
        console.error(error);
        window.alert("The Stripe payment link could not be created or copied.");
      }
    });

    item.append(
      session,
      when,
      lineBreak,
      client,
      secondLineBreak,
      invoice,
      thirdLineBreak,
      payment,
      document.createElement("br"),
      calendar,
      ...(charged > received && charged > 0 ? [stripeLinkButton] : []),
      paymentButton,
    );
    bookingList.append(item);
  });
}

async function loadRecentBookings() {
  if (!isAyeshaBooking()) return;
  const supabaseClient = createSupabaseClient();
  if (!supabaseClient) return;
  const { data, error } = await supabaseClient
    .from("booking_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) {
    console.error(error);
    return;
  }
  renderBookings((data || []).map((row) => ({
    id: row.id,
    sessionType: row.session_type,
    sessionFormat: row.session_format,
    bookingSource: row.booking_source,
    bookingType: row.booking_type,
    clientType: row.client_type,
    date: row.preferred_date,
    time: String(row.preferred_time || "").slice(0, 5),
    price: row.price,
    totalCost: row.total_cost,
    amountReceived: row.amount_received,
    paymentDate: row.payment_date,
    paymentStatus: row.payment_status,
    stripeCheckoutUrl: row.stripe_checkout_url,
    stripeCheckoutExpiresAt: row.stripe_checkout_expires_at,
    invoiceRequired: row.invoice_required,
    invoiceAmount: row.invoice_amount,
    firstName: row.first_name || "",
    surname: row.surname || "",
    secondFirstName: row.second_first_name || "",
    secondSurname: row.second_surname || "",
    email: row.email,
    calendarSyncStatus: row.calendar_sync_status,
  })));
}

async function updateBookingPayment(booking) {
  const amountText = window.prompt(
    `Amount received for ${formatClientNames(booking)} (£)`,
    String(booking.amountReceived || booking.price || 0),
  );
  if (amountText === null) return;
  const amount = Number(amountText);
  if (!Number.isFinite(amount) || amount < 0) {
    window.alert("Please enter a valid payment amount.");
    return;
  }
  const defaultDate = booking.paymentDate || dateToIsoDate(new Date());
  const paymentDate = window.prompt("Payment date (YYYY-MM-DD)", defaultDate);
  if (paymentDate === null) return;
  if (amount > 0 && !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
    window.alert("Please enter the payment date as YYYY-MM-DD.");
    return;
  }

  const supabaseClient = createSupabaseClient();
  const { error } = await supabaseClient
    .from("booking_requests")
    .update({
      amount_received: amount,
      payment_date: amount > 0 ? paymentDate : null,
      payment_status:
        amount <= 0
          ? "not_started"
          : amount >= Number(booking.totalCost || booking.price || 0)
            ? "paid"
            : "part_paid",
    })
    .eq("id", booking.id);
  if (error) {
    console.error(error);
    window.alert("The payment could not be updated.");
    return;
  }
  booking.amountReceived = amount;
  booking.paymentDate = amount > 0 ? paymentDate : null;
  booking.paymentStatus =
    amount <= 0
      ? "not_started"
      : amount >= Number(booking.totalCost || booking.price || 0)
        ? "paid"
        : "part_paid";
  updateStoredBooking(booking);
  renderBookings();
  loadRecentBookings();
  loadEarningsSummary();
}

async function loadEarningsSummary() {
  if (!isAyeshaBooking() || !earningsToday) return;
  const supabaseClient = createSupabaseClient();
  if (!supabaseClient) return;

  const now = new Date();
  const today = dateToIsoDate(now);
  const weekStart = addDaysToIsoDate(today, -((now.getDay() + 6) % 7));
  const monthStart = `${today.slice(0, 7)}-01`;
  const { data, error } = await supabaseClient
    .from("booking_requests")
    .select("amount_received,payment_date")
    .gte("payment_date", monthStart);
  if (error) {
    console.error(error);
    return;
  }
  const totalFrom = (start) => (data || [])
    .filter((payment) => payment.payment_date >= start)
    .reduce((total, payment) => total + Number(payment.amount_received || 0), 0);
  earningsToday.textContent = formatPrice(totalFrom(today));
  earningsWeek.textContent = formatPrice(totalFrom(weekStart));
  earningsMonth.textContent = formatPrice(totalFrom(monthStart));
}

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));

  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

function updateStoredBooking(booking) {
  const bookings = getBookings();
  const existingIndex = bookings.findIndex((item) => item.id === booking.id);

  if (existingIndex === -1) {
    saveBookings([booking, ...bookings]);
    return;
  }

  bookings[existingIndex] = booking;
  saveBookings(bookings);
}

async function saveBookingRequest(booking) {
  const supabaseClient = createSupabaseClient();

  if (!supabaseClient) {
    const bookings = [booking, ...getBookings()];
    saveBookings(bookings);
    return "local";
  }

  const bookingRow = {
    id: booking.id,
    client_id: booking.clientId,
    session_type: booking.sessionType,
    session_format: booking.sessionFormat,
    booking_source: booking.bookingSource,
    client_type: booking.clientType,
    booking_type: booking.bookingType,
    price: booking.price,
    amount_received: booking.amountReceived,
    payment_date: booking.paymentDate,
    payment_status: booking.paymentStatus,
    total_cost: booking.totalCost,
    pay_now_amount: booking.payNow,
    remaining_balance: booking.remainingBalance,
    invoice_required: booking.invoiceRequired,
    invoice_amount: booking.invoiceAmount,
    invoice_note: booking.invoiceNote,
    payment_reminder_required: booking.paymentReminderRequired,
    next_payment_due_amount: booking.nextPaymentDueAmount,
    payment_reminder_note: booking.paymentReminderNote,
    proposed_block_dates: booking.proposedBlockDates,
    exact_block_dates: booking.exactBlockDates,
    block_session_count: booking.blockSessionCount,
    block_date_pattern: booking.blockDatePattern,
    block_frequency: booking.blockFrequency,
    flexible_block_preferences: booking.flexibleBlockPreferences,
    block_payment_preference: booking.blockPaymentPreference,
    block_cancellation_agreement: booking.blockCancellationAgreement,
    duration: booking.duration,
    preferred_date: booking.date,
    preferred_time: booking.time,
    first_name: booking.firstName,
    surname: booking.surname,
    second_first_name: booking.secondFirstName,
    second_surname: booking.secondSurname,
    email: booking.email,
    phone: booking.phone,
    message: booking.message || null,
    consent_to_contact: true,
    status: booking.bookingStatus === "pending"
      ? "contacted"
      : booking.bookingStatus === "confirmed"
        ? "confirmed"
        : undefined,
  };

  // Some existing installations predate optional payment/invoice columns. If
  // PostgREST reports one of those fields as unknown, omit it and retry rather
  // than losing the whole booking.
  let insertError = null;
  const attemptedMissingColumns = new Set();
  while (true) {
    const { error } = await supabaseClient
      .from("booking_requests")
      .insert(bookingRow);
    insertError = error;
    if (!insertError) break;

    const missingColumn = String(insertError.message || "").match(
      /Could not find the ['"]([^'"]+)['"] column of ['"]booking_requests['"]/i,
    )?.[1];
    if (
      !missingColumn ||
      !(missingColumn in bookingRow) ||
      attemptedMissingColumns.has(missingColumn)
    ) {
      break;
    }

    attemptedMissingColumns.add(missingColumn);
    delete bookingRow[missingColumn];
    console.warn(`Booking field '${missingColumn}' is not available and was omitted.`);
  }

  if (insertError) throw insertError;

  if (isAyeshaBooking()) {
    const { error: invoiceError } = await supabaseClient.rpc(
      "ensure_booking_invoice",
      { p_booking_id: booking.id },
    );
    if (invoiceError) {
      booking.invoiceCreationError = invoiceError.message || "Invoice creation failed.";
      console.error("The booking was saved but its invoice could not be ensured.", invoiceError);
    } else {
      booking.invoiceCreationError = null;
    }
  }

  const bookings = [booking, ...getBookings()];
  saveBookings(bookings);
  return "supabase";
}

async function createStripeCheckout(booking) {
  const supabaseClient = createSupabaseClient();
  if (!supabaseClient) throw new Error("Stripe checkout needs the online booking service.");
  const functionName = bookingConfig().stripeCheckoutFunction || "stripe-create-checkout";
  const returnUrl = `${window.location.origin}${window.location.pathname}`;
  const { data, error } = await supabaseClient.functions.invoke(functionName, {
    body: { bookingId: booking.id, returnUrl },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("Stripe did not return a secure payment link.");
  booking.paymentStatus = "pending";
  booking.stripeCheckoutUrl = data.url;
  booking.stripeCheckoutExpiresAt = data.expiresAt || null;
  updateStoredBooking(booking);
  return data.url;
}

async function syncBookingToGoogleCalendar(booking) {
  const supabaseClient = createSupabaseClient();
  const functionName =
    bookingConfig().calendarCreateFunction || "calendar-create-booking";

  if (!supabaseClient) {
    return null;
  }

  const { data, error } = await supabaseClient.functions.invoke(functionName, {
    body: { bookingId: booking.id },
  });

  if (error) throw error;
  return data;
}

async function offerBookingEmails(booking) {
  const approved = window.confirm(
    `Send an email confirmation for this booking to the recorded client email address${booking.secondFirstName ? "es" : ""}?\n\n` +
    "This will also arrange a courtesy reminder by email on the day before the session.",
  );
  if (!approved) {
    confirmation.append(document.createElement("br"), document.createTextNode(
      "No confirmation email was sent and no email reminder was arranged.",
    ));
    return;
  }
  const supabaseClient = createSupabaseClient();
  const functionName = bookingConfig().appointmentRemindersFunction || "appointment-reminders";
  const { data, error } = await supabaseClient.functions.invoke(functionName, {
    body: { action: "send_confirmation", bookingId: booking.id },
  });
  if (error || data?.error) {
    confirmation.append(document.createElement("br"), document.createTextNode(
      `The email confirmation was not sent. ${data?.error || error?.message || "Please try again."}`,
    ));
    return;
  }
  const count = Number(data?.recipients?.length || data?.sent || 0);
  confirmation.append(document.createElement("br"), document.createTextNode(
    `Email confirmation sent to ${count} ${count === 1 ? "address" : "addresses"}; the day-before reminder is arranged. `,
  ));
  const testButton = document.createElement("button");
  testButton.type = "button";
  testButton.className = "secondary-button";
  testButton.textContent = "Send test reminder to me";
  testButton.addEventListener("click", async () => {
    testButton.disabled = true;
    testButton.textContent = "Sending test…";
    const { data: testData, error: testError } = await supabaseClient.functions.invoke(functionName, {
      body: { action: "test_reminder", bookingId: booking.id },
    });
    if (testError || testData?.error) {
      testButton.disabled = false;
      testButton.textContent = "Try test reminder again";
      return;
    }
    testButton.textContent = "Test reminder sent";
  });
  confirmation.append(testButton);
}

async function calendarSyncErrorDetails(error) {
  const fallback = {
    code: "calendar_create_failed",
    message: "Google Calendar could not add the booking.",
    conflicts: [],
  };

  if (!(error?.context instanceof Response)) return fallback;

  try {
    const details = await error.context.clone().json();
    return {
      code: details?.error || fallback.code,
      message: details?.message || fallback.message,
      conflicts: Array.isArray(details?.conflicts) ? details.conflicts : [],
    };
  } catch {
    return fallback;
  }
}

function calendarSyncConfirmation(calendarSync, calendarFailure, isAyeshaRequest) {
  if (calendarSync?.status === "synced") {
    const eventCount = Number(calendarSync.eventCount) || 1;
    return `${eventCount} Google Calendar appointment${
      eventCount === 1 ? " has" : "s have"
    } been added automatically.`;
  }

  if (calendarSync?.status === "partial") {
    return "The known session date has been added to Google Calendar. The remaining flexible dates can be added once they are agreed.";
  }

  if (calendarFailure?.code === "calendar_conflict") {
    const conflictDates = calendarFailure.conflicts
      .map((conflict) => {
        return conflict?.date && conflict?.time
          ? `${formatDate(conflict.date)} at ${conflict.time}`
          : "";
      })
      .filter(Boolean)
      .join(", ");
    return conflictDates
      ? `Google Calendar was already busy at ${conflictDates}, so those appointments were not added.`
      : "One or more appointments conflicted with Google Calendar and were not added.";
  }

  if (
    isAyeshaRequest &&
    calendarFailure?.code === "calendar_permission_required"
  ) {
    return "The booking was saved, but Google Calendar needs 'Make changes and see all event details' permission before it can add the appointment.";
  }

  if (calendarFailure) {
    return isAyeshaRequest
      ? "The booking was saved, but Google Calendar could not add it automatically. The recent bookings list marks it as needing attention."
      : "Your request was saved, but it could not be added to Google Calendar automatically. Ayesha will review it.";
  }

  return "";
}

async function handleSubmit(event) {
  event.preventDefault();

  const formData = new FormData(form);
  const isAyeshaBookingRequest =
    formData.get("bookingSource") === "Ayesha booking for client";
  const isExistingClient = formData.get("clientType") === "Existing client";
  const needsSecondClientNames =
    formData.get("sessionType") === "Joint session" &&
    (!isExistingClient || isAyeshaBookingRequest);
  const isBlockBookingRequest =
    (isExistingClient || isAyeshaBookingRequest) &&
    formData.get("bookingType") === "Block booking";
  const requiredTextFields = isAyeshaBookingRequest
    ? ["firstName", "surname"]
    : isExistingClient
      ? ["email"]
      : ["firstName", "surname", "email", "phone"];
  if (needsSecondClientNames) {
    requiredTextFields.push("secondFirstName", "secondSurname");
  }
  const hasBlankRequiredField = requiredTextFields.some((field) => {
    return formData.get(field).trim().length === 0;
  });

  if (hasBlankRequiredField) {
    confirmation.hidden = false;
    confirmation.textContent = "Please complete every field before requesting a booking.";
    return;
  }

  if (
    isBlockBookingRequest &&
    (!formData.get("blockSessionCount") ||
      !formData.get("blockDatePattern") ||
      !formData.get("blockPaymentPreference") ||
      formData.get("blockCancellationAgreement") !== "on" ||
      (formData.get("blockDatePattern") === "Regular pattern" &&
        !formData.get("blockFrequency")) ||
      (formData.get("blockDatePattern") === "Flexible dates" &&
        !isAyeshaBookingRequest &&
        !formData.get("flexibleBlockPreferences")?.trim()) ||
      (formData.get("blockDatePattern") === "Flexible dates" &&
        isAyeshaBookingRequest &&
        !hasCompleteExactBlockDates()))
  ) {
    confirmation.hidden = false;
    confirmation.textContent =
      "Please complete the block booking details, including each flexible date, time and format, and accept the 48-hour cancellation rule.";
    return;
  }

  const amountReceived = Number(formData.get("amountReceived")) || 0;
  const paymentDate =
    amountReceived > 0
      ? formData.get("paymentDate") || dateToIsoDate(new Date())
      : null;
  const booking = {
    id: createId(),
    createdAt: new Date().toISOString(),
    sessionType: formData.get("sessionType"),
    sessionFormat: formData.get("sessionFormat"),
    bookingSource: formData.get("bookingSource"),
    clientType: formData.get("clientType"),
    clientId: formData.get("linkedClientId") || null,
    bookingType: formData.get("bookingType") || "Single session",
    price: selectedSessionPrice(),
    amountReceived,
    paymentDate,
    blockSessionCount: formData.get("blockSessionCount") || null,
    blockDatePattern: formData.get("blockDatePattern") || null,
    blockFrequency: formData.get("blockFrequency") || null,
    flexibleBlockPreferences:
      formData.get("flexibleBlockPreferences")?.trim() || null,
    exactBlockDates: getExactBlockDates().filter((blockDate) => {
      return blockDate.date && blockDate.time && blockDate.format;
    }),
    blockPaymentPreference: formData.get("blockPaymentPreference") || null,
    blockCancellationAgreement:
      formData.get("blockCancellationAgreement") === "on",
    duration: form.querySelector("[name='sessionType']:checked").dataset.duration,
    date: formData.get("date"),
    time: formData.get("time"),
    firstName: formData.get("firstName")?.trim() || "",
    surname: formData.get("surname")?.trim() || "",
    secondFirstName: formData.get("secondFirstName")?.trim() || "",
    secondSurname: formData.get("secondSurname")?.trim() || "",
    email: formData.get("email")?.trim() || "",
    phone: formData.get("phone")?.trim() || "",
    message: formData.get("message").trim(),
    bookingStatus: formData.get("bookingStatus") || "confirmed",
  };
  const paymentSummary = calculatePaymentSummary();
  booking.totalCost = paymentSummary.totalCost;
  booking.payNow = paymentSummary.payNow;
  booking.remainingBalance = paymentSummary.remainingBalance;
  booking.invoiceRequired = isAyeshaBookingRequest &&
    booking.bookingStatus !== "pending" && paymentSummary.totalCost > 0;
  booking.invoiceAmount = booking.invoiceRequired ? paymentSummary.totalCost : null;
  booking.invoiceNote = booking.invoiceRequired
    ? isBlockBooking()
      ? "Create one invoice for the complete block total. Do not invoice each session separately."
      : "Create one invoice for this appointment."
    : null;
  booking.paymentReminderRequired = false;
  booking.nextPaymentDueAmount = null;
  booking.paymentReminderNote = null;
  booking.proposedBlockDates = calculateBlockDates();
  booking.paymentStatus =
    booking.amountReceived > 0 && booking.amountReceived >= Number(booking.payNow || 0)
      ? "paid"
      : Number(booking.payNow || 0) > 0
        ? "not_started"
        : "paid";
  const historicalEntry = isAdminHistoricalDate(booking.date);

  submitButton.disabled = true;
  submitButton.textContent = "Saving...";

  try {
    if (!isAyeshaBooking() && !(await isPublicDateAvailable(booking.date))) {
      confirmation.hidden = false;
      confirmation.textContent =
        "Ayesha is not available for public bookings on this date. Please choose another date.";
      populateTimes();
      renderDatePicker();
      return;
    }

    if (
      !isAyeshaBooking() &&
      booking.sessionFormat === "In person" &&
      !(await isPublicInPersonDateAllowed(booking.date))
    ) {
      confirmation.hidden = false;
      confirmation.textContent =
        "In-person sessions are not available for public booking on this date. Please choose another date.";
      populateTimes();
      return;
    }

    if (!historicalEntry) {
      const calendarAvailability = await fetchCalendarAvailability(booking.date, {
        refresh: true,
      });
      if (
        calendarAvailability.configured &&
        calendarAvailability.busySlots.includes(booking.time)
      ) {
        confirmation.hidden = false;
        confirmation.textContent =
          "That time is now unavailable in Google Calendar. Please choose another time.";
        populateTimes();
        return;
      }
    }

    const saveMode = await saveBookingRequest(booking);
    let calendarSync = null;
    let calendarFailure = null;
    let stripeCheckoutUrl = null;
    const paymentStillDue =
      Number(booking.payNow || 0) > Number(booking.amountReceived || 0);

    if (saveMode === "supabase") {
      if (
        isAyeshaBookingRequest &&
        booking.bookingStatus === "confirmed" &&
        booking.sessionFormat === "Online" &&
        !historicalEntry
      ) {
        const supabaseClient = createSupabaseClient();
        const { data: zoomData, error: zoomError } = await supabaseClient.functions.invoke(
          bookingConfig().zoomCreateMeetingFunction || "zoom-create-meeting",
          { body: { bookingId: booking.id } },
        );
        if (zoomData?.joinUrl) booking.zoomJoinUrl = zoomData.joinUrl;
        if (zoomError) console.error("The booking was saved but its Zoom link needs attention.", zoomError);
      }
      if (!historicalEntry && (isAyeshaBookingRequest || !paymentStillDue)) {
        try {
          calendarSync = await syncBookingToGoogleCalendar(booking);
          booking.calendarSyncStatus = calendarSync?.status || "synced";
          booking.calendarEventIds = calendarSync?.eventIds || [];
          booking.calendarSyncError = null;
        } catch (calendarError) {
          calendarFailure = await calendarSyncErrorDetails(calendarError);
          booking.calendarSyncStatus = "failed";
          booking.calendarEventIds = [];
          booking.calendarSyncError = calendarFailure.message;
          console.error(calendarError);
        }
      }

      if (paymentStillDue && !historicalEntry) {
        stripeCheckoutUrl = await createStripeCheckout(booking);
      }

      updateStoredBooking(booking);
    }

    rememberClient(booking);

    confirmation.hidden = false;
    const savedMessage =
      saveMode === "supabase"
        ? booking.bookingStatus === "pending"
          ? "The appointment has been saved as pending. No invoice has been created yet."
        : historicalEntry
          ? booking.invoiceCreationError
            ? "The past appointment has been recorded."
            : "The past appointment has been recorded and its draft invoice has been created."
          : isAyeshaBookingRequest
          ? booking.invoiceCreationError
            ? "The appointment has been saved."
            : "The appointment has been saved and its draft invoice has been created."
          : paymentStillDue
            ? "Your requested time is held for 30 minutes while you complete secure payment with Stripe."
            : "Your booking request has been sent. Ayesha will confirm it personally."
        : isAyeshaBookingRequest
          ? "The booking has been saved on this device with an invoice needed."
          : "Your booking request has been saved on this device. Add Supabase details to send it online.";
    const calendarMessage = calendarSyncConfirmation(
      calendarSync,
      calendarFailure,
      isAyeshaBookingRequest,
    );
    const invoiceMessage = booking.invoiceCreationError
      ? `The booking was saved, but its invoice could not be created: ${booking.invoiceCreationError}`
      : "";
    confirmation.textContent = [savedMessage, invoiceMessage, calendarMessage]
      .filter(Boolean)
      .join(" ");

    if (stripeCheckoutUrl && isAyeshaBookingRequest) {
      const paymentLink = document.createElement("a");
      paymentLink.className = "stripe-payment-link";
      paymentLink.href = stripeCheckoutUrl;
      paymentLink.target = "_blank";
      paymentLink.rel = "noopener";
      paymentLink.textContent = "Open secure Stripe payment link";
      confirmation.append(document.createElement("br"), paymentLink);
    }

    if (stripeCheckoutUrl && !isAyeshaBookingRequest) {
      window.location.assign(stripeCheckoutUrl);
      return;
    }

    if (
      saveMode === "supabase" && isAyeshaBookingRequest &&
      booking.bookingStatus === "confirmed" && !historicalEntry
    ) {
      await offerBookingEmails(booking);
    }

    form.reset();
    resetDatePickerToCurrentMonth();
    if (linkedAdminClient) {
      applyLinkedClientToForm();
    } else {
      updateFormatOptions();
      updateClientFields();
      populateTimes();
      renderDatePicker();
      updateSummary();
      updateStepAvailability();
    }
    renderBookings();
    loadRecentBookings();
    loadEarningsSummary();
  } catch (error) {
    confirmation.hidden = false;
    confirmation.textContent = isAyeshaBooking()
      ? `The booking was not saved. ${error?.message || "Please check the Supabase setup and try again."}`
      : "Sorry, the booking request could not be sent. Please check the details and try again.";
    console.error(error);
  } finally {
    submitButton.disabled = false;
    updateClientFields();
  }
}

setMinimumDate();
setupDatePicker();
renderRememberedClients();
updateFormatOptions();
updateClientFields();
populateTimes();
renderDatePicker();
updateSummary();
updateStepAvailability();
renderBookings();
loadRecentBookings();
loadEarningsSummary();
loadLinkedClientFromQuery();
loadAdminClientPicker();

adminClientSearch?.addEventListener("input", renderAdminClientOptions);
adminClientSelect?.addEventListener("change", () => {
  linkedAdminClient =
    adminClients.find((client) => client.id === adminClientSelect.value) || null;
  if (linkedAdminClient) applyLinkedClientToForm();
});
chooseAnotherClient?.addEventListener("click", () => {
  linkedAdminClient = null;
  form.reset();
  resetDatePickerToCurrentMonth();
  form.elements.linkedClientId.value = "";
  linkedClientBanner.hidden = true;
  adminClientPicker.hidden = false;
  clientTypeFieldset.hidden = false;
  bookingFinanceFieldset.hidden = true;
  adminClientSearch.value = "";
  renderAdminClientOptions();
  updateClientFields();
  updateSummary();
  updateStepAvailability();
});

form.addEventListener("input", () => {
  if (!confirmation.hidden) {
    confirmation.hidden = true;
    confirmation.textContent = "";
  }
  updateFormatOptions();
  updateClientFields();
  updateSummary();
  updateStepAvailability();
});
form.addEventListener("change", (event) => {
  updateFormatOptions();
  updateClientFields();
  if (event.target.name === "sessionFormat") {
    syncAppointmentFeeField();
  }
  if (event.target.name === "sessionType" || event.target.name === "sessionFormat") {
    populateTimes();
    renderDatePicker();
  }
  updateSummary();
  updateStepAvailability();
});
dateInput.addEventListener("change", () => {
  datePicker.monthDate = monthStartForDate(
    dateInput.value || dateToIsoDate(new Date()),
  );
  populateTimes();
  renderDatePicker();
  updateSummary();
  updateStepAvailability();
});
form.elements.email.addEventListener("change", () => {
  fillRememberedClientDetails();
  updateStepAvailability();
});
form.elements.email.addEventListener("input", () => {
  fillRememberedClientDetails();
  updateStepAvailability();
});
summary.payNow.addEventListener("click", () => {
  confirmation.hidden = false;
  confirmation.textContent =
    isAyeshaBooking()
      ? "Save the appointment to create a secure Stripe payment link for the client."
      : "After you submit the booking, Stripe will open a secure page for payment.";
});

function showStripeReturnMessage() {
  const params = new URLSearchParams(window.location.search);
  const payment = params.get("payment");
  if (!payment) return;
  confirmation.hidden = false;
  confirmation.textContent = payment === "success"
    ? "Thank you — Stripe has received the payment. Your appointment is being confirmed and added to the calendar."
    : "Payment was not completed and no charge was made. You can choose the booking details again when you are ready.";
  window.history.replaceState({}, "", window.location.pathname);
}

showStripeReturnMessage();
form.addEventListener("submit", handleSubmit);
