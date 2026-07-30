const inPersonAvailabilityControls = {
  weekDate: document.querySelector("#in-person-week-date"),
  dayOptions: document.querySelector("#in-person-day-options"),
  saveButton: document.querySelector("#save-in-person-availability"),
  message: document.querySelector("#in-person-availability-message"),
};
const daysOffControls = {
  startDate: document.querySelector("#day-off-start-date"),
  endDate: document.querySelector("#day-off-end-date"),
  addButton: document.querySelector("#add-day-off"),
  list: document.querySelector("#days-off-list"),
  message: document.querySelector("#days-off-message"),
};

const inPersonAvailabilityKey = "ayesha-in-person-availability";
const daysOffKey = "ayesha-public-unavailable-dates";
const weekDayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const inPersonAvailabilityCache = new Map();

function createSupabaseClient() {
  if (window.ADMIN_SUPABASE) return window.ADMIN_SUPABASE;

  const config = window.BOOKING_CONFIG || {};
  const hasConfig = config.supabaseUrl && config.supabaseAnonKey;

  if (!hasConfig || !window.supabase) return null;

  return window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
}

function getLocalInPersonAvailability() {
  return JSON.parse(localStorage.getItem(inPersonAvailabilityKey) || "{}");
}

function saveLocalInPersonAvailability(availability) {
  localStorage.setItem(inPersonAvailabilityKey, JSON.stringify(availability));
}

function getLocalDaysOff() {
  return JSON.parse(localStorage.getItem(daysOffKey) || "[]");
}

function saveLocalDaysOff(dates) {
  localStorage.setItem(daysOffKey, JSON.stringify([...new Set(dates)].sort()));
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
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(createLocalDate(dateValue));
}

function datesInRange(startDate, endDate) {
  const dates = [];
  let currentDate = startDate;

  while (currentDate <= endDate) {
    dates.push(currentDate);
    currentDate = addDaysToIsoDate(currentDate, 1);
  }

  return dates;
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

async function saveInPersonAvailability(weekStart, availableDates) {
  const dates = [...availableDates].sort();
  const supabaseClient = createSupabaseClient();

  if (supabaseClient) {
    const { error } = await supabaseClient
      .from("in_person_availability")
      .upsert(
        {
          week_start: weekStart,
          available_dates: dates,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "week_start" },
      );

    if (!error) {
      inPersonAvailabilityCache.set(weekStart, dates);
      return "supabase";
    }

    console.error(error);
  }

  const localAvailability = getLocalInPersonAvailability();
  localAvailability[weekStart] = dates;
  saveLocalInPersonAvailability(localAvailability);
  inPersonAvailabilityCache.set(weekStart, dates);
  return "local";
}

async function renderInPersonAvailabilityControls() {
  const selectedDate =
    inPersonAvailabilityControls.weekDate.value || new Date().toISOString().slice(0, 10);
  const weekStart = weekStartForDate(selectedDate);
  const availableDates = await loadInPersonAvailability(weekStart, { refresh: true });

  inPersonAvailabilityControls.weekDate.value = selectedDate;
  inPersonAvailabilityControls.dayOptions.innerHTML = "";

  weekDatesFor(weekStart).forEach((dateValue, index) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    const text = document.createElement("span");
    const day = document.createElement("strong");
    const date = document.createElement("small");

    label.className = "in-person-day-option";
    input.type = "checkbox";
    input.name = "inPersonAvailableDate";
    input.value = dateValue;
    input.checked = availableDates.includes(dateValue);
    day.textContent = weekDayLabels[index];
    date.textContent = formatShortDate(dateValue);
    text.append(day, date);
    label.append(input, text);
    inPersonAvailabilityControls.dayOptions.append(label);
  });

  inPersonAvailabilityControls.message.textContent =
    availableDates.length > 0
      ? "These dates are available to public clients for in-person sessions."
      : "No public in-person days are selected for this week.";
}

async function handleInPersonAvailabilitySave() {
  const weekStart = weekStartForDate(inPersonAvailabilityControls.weekDate.value);
  const selectedDates = Array.from(
    inPersonAvailabilityControls.dayOptions.querySelectorAll(
      "[name='inPersonAvailableDate']:checked",
    ),
  ).map((input) => input.value);

  inPersonAvailabilityControls.saveButton.disabled = true;
  inPersonAvailabilityControls.saveButton.textContent = "Saving...";

  try {
    const saveMode = await saveInPersonAvailability(weekStart, selectedDates);
    inPersonAvailabilityControls.message.textContent =
      saveMode === "supabase"
        ? "Saved. Public clients can now book in-person sessions on the selected dates."
        : "Saved on this browser only. Run the Supabase SQL setup so public clients can use these dates.";
  } catch (error) {
    inPersonAvailabilityControls.message.textContent =
      "Sorry, the in-person days could not be saved.";
    console.error(error);
  } finally {
    inPersonAvailabilityControls.saveButton.disabled = false;
    inPersonAvailabilityControls.saveButton.textContent = "Save in-person days";
  }
}

async function loadDaysOff() {
  const supabaseClient = createSupabaseClient();

  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from("public_unavailable_dates")
      .select("unavailable_date")
      .order("unavailable_date", { ascending: true });

    if (!error) {
      return data.map((row) => row.unavailable_date);
    }

    console.error(error);
  }

  return getLocalDaysOff();
}

async function saveDaysOff(dateValues) {
  const dates = [...new Set(dateValues)].sort();
  const supabaseClient = createSupabaseClient();

  if (supabaseClient) {
    const { error } = await supabaseClient
      .from("public_unavailable_dates")
      .upsert(
        dates.map((dateValue) => ({
          unavailable_date: dateValue,
          note: "Day off",
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "unavailable_date" },
      );

    if (!error) return "supabase";
    console.error(error);
  }

  saveLocalDaysOff([...getLocalDaysOff(), ...dates]);
  return "local";
}

async function deleteDayOff(dateValue) {
  const supabaseClient = createSupabaseClient();

  if (supabaseClient) {
    const { error } = await supabaseClient
      .from("public_unavailable_dates")
      .delete()
      .eq("unavailable_date", dateValue);

    if (!error) return "supabase";
    console.error(error);
  }

  saveLocalDaysOff(getLocalDaysOff().filter((date) => date !== dateValue));
  return "local";
}

async function renderDaysOff() {
  const dates = await loadDaysOff();

  daysOffControls.list.innerHTML = "";

  dates.forEach((dateValue) => {
    const item = document.createElement("li");
    const date = document.createElement("span");
    const removeButton = document.createElement("button");

    date.textContent = formatShortDate(dateValue);
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", async () => {
      removeButton.disabled = true;
      await deleteDayOff(dateValue);
      daysOffControls.message.textContent = "Day off removed.";
      renderDaysOff();
    });

    item.append(date, removeButton);
    daysOffControls.list.append(item);
  });

  if (dates.length === 0) {
    daysOffControls.message.textContent = "No public days off have been added.";
  }
}

async function handleDayOffAdd() {
  const startDate = daysOffControls.startDate.value;
  const endDate = daysOffControls.endDate.value || startDate;

  if (!startDate) {
    daysOffControls.message.textContent = "Choose the first date to block.";
    return;
  }

  if (endDate < startDate) {
    daysOffControls.message.textContent = "The last day off must be after the first day.";
    return;
  }

  const dates = datesInRange(startDate, endDate);

  daysOffControls.addButton.disabled = true;
  daysOffControls.addButton.textContent = "Saving...";

  try {
    const saveMode = await saveDaysOff(dates);
    daysOffControls.message.textContent =
      saveMode === "supabase"
        ? `Saved. Public clients cannot book on ${dates.length} selected date${dates.length === 1 ? "" : "s"}.`
        : `Saved ${dates.length} date${dates.length === 1 ? "" : "s"} on this browser only. Run the Supabase SQL setup so public clients can use these dates.`;
    daysOffControls.startDate.value = "";
    daysOffControls.endDate.value = "";
    renderDaysOff();
  } catch (error) {
    daysOffControls.message.textContent = "Sorry, the days off could not be saved.";
    console.error(error);
  } finally {
    daysOffControls.addButton.disabled = false;
    daysOffControls.addButton.textContent = "Block dates";
  }
}

inPersonAvailabilityControls.weekDate.addEventListener(
  "change",
  renderInPersonAvailabilityControls,
);
inPersonAvailabilityControls.saveButton.addEventListener(
  "click",
  handleInPersonAvailabilitySave,
);
daysOffControls.addButton.addEventListener("click", handleDayOffAdd);
renderInPersonAvailabilityControls();
renderDaysOff();
