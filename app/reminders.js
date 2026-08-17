(async function setupReminders() {
  const admin = await window.ADMIN_READY;
  const db = admin.client;
  const form = document.querySelector("#reminder-form");
  const message = document.querySelector("#reminder-message");
  const list = document.querySelector("#reminder-list");
  const filter = document.querySelector("#reminder-filter");
  const clientSelect = form.elements.clientId;
  let reminders = [];
  let clients = [];

  const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
  const dateKey = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const clientName = (client) => [[client?.first_name, client?.surname].filter(Boolean).join(" "), [client?.second_first_name, client?.second_surname].filter(Boolean).join(" ")].filter(Boolean).join(" and ");
  const formatDate = (value) => value ? new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`)) : "No due date";

  function selectedReminders() {
    const today = dateKey();
    return reminders.filter((item) => {
      if (filter.value === "all") return true;
      if (filter.value === "completed") return item.status === "Completed";
      if (item.status === "Completed") return false;
      if (filter.value === "waiting") return item.status === "Waiting";
      if (filter.value === "due") return Boolean(item.due_date && item.due_date <= today);
      if (filter.value === "upcoming") return Boolean(item.due_date && item.due_date > today);
      if (filter.value === "no-date") return !item.due_date;
      return true;
    });
  }

  function updateStats() {
    const today = dateKey();
    document.querySelector("#reminder-due-count").textContent = reminders.filter((item) => item.status !== "Completed" && item.due_date && item.due_date <= today).length;
    document.querySelector("#reminder-upcoming-count").textContent = reminders.filter((item) => item.status !== "Completed" && item.due_date && item.due_date > today).length;
    document.querySelector("#reminder-no-date-count").textContent = reminders.filter((item) => item.status !== "Completed" && !item.due_date).length;
    document.querySelector("#reminder-completed-count").textContent = reminders.filter((item) => item.status === "Completed").length;
  }

  function render() {
    const today = dateKey();
    const visible = selectedReminders();
    updateStats();
    if (!visible.length) { list.innerHTML = '<p class="admin-state">There are no reminders in this view.</p>'; return; }
    list.innerHTML = visible.map((item) => {
      const client = clients.find((candidate) => candidate.id === item.client_id);
      const overdue = item.status !== "Completed" && item.due_date && item.due_date < today;
      const dueToday = item.status !== "Completed" && item.due_date === today;
      const waiting = item.status === "Waiting";
      return `<article class="reminder-card ${item.status === "Completed" ? "is-completed" : ""} ${waiting ? "is-waiting" : ""} ${overdue ? "is-overdue" : ""}" data-reminder-id="${item.id}"><div class="reminder-card-main"><div class="reminder-card-heading"><strong>${escapeHtml(item.title)}</strong>${waiting ? '<span class="reminder-status-waiting">Waiting to hear back</span>' : ''}<span class="reminder-priority reminder-priority-${item.priority.toLowerCase()}">${escapeHtml(item.priority)}</span></div><small>${overdue ? "Overdue · " : dueToday ? "Due today · " : ""}${escapeHtml(formatDate(item.due_date))}${client ? ` · ${escapeHtml(clientName(client))}` : ""}</small>${item.details ? `<p>${escapeHtml(item.details)}</p>` : ""}</div><div class="settings-list-actions">${item.status === "Completed" ? '<button type="button" data-action="reopen">Reopen</button>' : waiting ? '<button type="button" data-action="pending">Move to to-do</button><button type="button" data-action="complete">Complete</button>' : '<button type="button" data-action="waiting">Waiting</button><button type="button" data-action="complete">Complete</button>'}<button class="secondary-button" type="button" data-action="delete">Delete</button></div></article>`;
    }).join("");
  }

  async function load() {
    const { data, error } = await db.from("admin_reminders").select("*").order("status").order("due_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
    if (error) {
      reminders = []; render();
      message.textContent = error.message.includes("admin_reminders") ? "Reminders need the one-time Supabase setup before they can be saved." : "Reminders could not be loaded.";
      return;
    }
    reminders = data || []; render();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault(); if (!form.reportValidity()) return;
    const submit = form.querySelector('[type="submit"]'); submit.disabled = true; submit.textContent = "Adding…"; message.textContent = "";
    const payload = { title: form.elements.title.value.trim(), details: form.elements.details.value.trim(), client_id: form.elements.clientId.value || null, due_date: form.elements.dueDate.value || null, priority: form.elements.priority.value, status: form.elements.status.value, created_by: admin.user.id };
    const { error } = await db.from("admin_reminders").insert(payload);
    if (error) message.textContent = error.message.includes("admin_reminders") ? "Please run the one-time Reminders setup in Supabase first." : "The reminder could not be saved.";
    else { form.reset(); form.elements.priority.value = "Normal"; message.textContent = "Reminder added."; await load(); }
    submit.disabled = false; submit.textContent = "Add reminder";
  });

  list.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]"); if (!button) return;
    const card = button.closest("[data-reminder-id]"); const id = card?.dataset.reminderId; if (!id) return;
    button.disabled = true;
    if (button.dataset.action === "delete") {
      if (!window.confirm("Delete this reminder permanently?")) { button.disabled = false; return; }
      const { error } = await db.from("admin_reminders").delete().eq("id", id);
      if (error) { message.textContent = "The reminder could not be deleted."; button.disabled = false; return; }
    } else {
      const completed = button.dataset.action === "complete";
      const nextStatus = completed ? "Completed" : button.dataset.action === "waiting" ? "Waiting" : "Pending";
      const { error } = await db.from("admin_reminders").update({ status: nextStatus, completed_at: completed ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) { message.textContent = "The reminder could not be updated."; button.disabled = false; return; }
    }
    await load();
  });

  filter.addEventListener("change", render);
  document.querySelector("#clear-reminder").addEventListener("click", () => { form.reset(); form.elements.priority.value = "Normal"; message.textContent = ""; });
  const { data: clientData } = await db.from("clients").select("id,first_name,surname,second_first_name,second_surname,status").neq("status", "Former").order("first_name");
  clients = clientData || [];
  clientSelect.innerHTML = '<option value="">No client</option>' + clients.map((client) => `<option value="${client.id}">${escapeHtml(clientName(client))}</option>`).join("");
  await load();
})();
