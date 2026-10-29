(async function setupSavedNotes() {
  const admin = await window.ADMIN_READY;
  const db = admin.client;
  const ui = {
    client: document.querySelector("#saved-note-client"),
    archived: document.querySelector("#saved-note-archived"),
    list: document.querySelector("#saved-note-list"),
    message: document.querySelector("#saved-note-message"),
    dialog: document.querySelector("#saved-note-history-dialog"),
    history: document.querySelector("#saved-note-history-list"),
  };
  let clients = [];
  let notes = [];
  const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
  const clientName = (client) => [[client?.first_name, client?.surname].filter(Boolean).join(" "), [client?.second_first_name, client?.second_surname].filter(Boolean).join(" ")].filter(Boolean).join(" and ");
  const formatDate = (date) => date ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(`${date}T12:00:00`)) : "No date";
  const statusLabel = (status) => status === "Final" ? "Completed" : "Unfinished draft";

  function setClientOptions() {
    ui.client.innerHTML = '<option value="">All clients</option>' + clients.map((client) => {
      const status = client.status && client.status !== "Active" ? ` — ${client.status}` : "";
      return `<option value="${client.id}">${escapeHtml(`${clientName(client)}${status}`)}</option>`;
    }).join("");
  }

  function render() {
    const clientId = ui.client.value;
    const showArchived = ui.archived.checked;
    const visible = notes.filter((note) => Boolean(note.archived_at) === showArchived && (!clientId || note.client_id === clientId));
    ui.list.innerHTML = "";
    visible.forEach((note) => {
      const client = clients.find((item) => item.id === note.client_id);
      const item = document.createElement("li");
      item.className = "secure-note-list-item";
      item.innerHTML = `<span><strong>${escapeHtml(clientName(client) || "Client record unavailable")}</strong><small>${formatDate(note.note_date)} · ${escapeHtml(note.note_type)} · <b>${escapeHtml(statusLabel(note.status))}</b>${note.archived_at ? " · Archived" : ""}${note.ai_assisted ? " · AI assisted" : ""}</small></span>`;
      const actions = document.createElement("span");
      actions.className = "settings-list-actions";
      const open = document.createElement("a");
      open.className = "button-link";
      open.href = `notes.html?note=${encodeURIComponent(note.id)}`;
      open.textContent = "Open note";
      const history = document.createElement("button");
      history.type = "button";
      history.textContent = "History";
      history.addEventListener("click", () => showHistory(note));
      const archive = document.createElement("button");
      archive.type = "button";
      archive.className = "secondary-button";
      archive.textContent = note.archived_at ? "Restore" : "Archive";
      archive.addEventListener("click", () => changeArchive(note));
      actions.append(open, history, archive);
      item.append(actions);
      ui.list.append(item);
    });
    if (!visible.length) ui.list.innerHTML = "<li>No saved notes were found for this selection.</li>";
    ui.message.textContent = `${visible.length} saved note${visible.length === 1 ? "" : "s"} shown.`;
  }

  async function showHistory(note) {
    ui.history.textContent = "Loading history…";
    ui.dialog.showModal();
    const { data, error } = await db.from("clinical_note_versions").select("version_number,final_note,rough_note,status,changed_at").eq("note_id", note.id).order("version_number", { ascending: false });
    if (error) { ui.history.textContent = "History could not be loaded."; return; }
    ui.history.innerHTML = data?.length ? data.map((version) => `<article class="note-version"><strong>Version ${version.version_number} · ${escapeHtml(statusLabel(version.status))}</strong><small>${new Date(version.changed_at).toLocaleString("en-GB")}</small><pre>${escapeHtml(version.final_note || version.rough_note)}</pre></article>`).join("") : "No earlier versions yet.";
  }

  async function changeArchive(note) {
    if (!note.archived_at && !window.confirm("Archive this note? It will remain available under Show archived notes.")) return;
    const changes = note.archived_at ? { archived_at: null, archived_by: null } : { archived_at: new Date().toISOString(), archived_by: admin.user.id };
    const { error } = await db.from("clinical_notes").update(changes).eq("id", note.id);
    if (error) { ui.message.textContent = "The note could not be updated."; return; }
    Object.assign(note, changes);
    render();
  }

  async function load() {
    const [clientResult, noteResult] = await Promise.all([
      db.from("clients").select("id,first_name,surname,second_first_name,second_surname,status").order("first_name").order("surname"),
      db.from("clinical_notes").select("id,client_id,note_date,note_type,status,archived_at,ai_assisted,updated_at").order("note_date", { ascending: false }).order("updated_at", { ascending: false }),
    ]);
    if (clientResult.error || noteResult.error) {
      ui.message.textContent = "Saved notes could not be loaded. Please refresh and try again.";
      return;
    }
    clients = clientResult.data || [];
    notes = noteResult.data || [];
    setClientOptions();
    render();
  }

  ui.client.addEventListener("change", render);
  ui.archived.addEventListener("change", render);
  document.querySelector("#close-saved-note-history").addEventListener("click", () => ui.dialog.close());
  load();
})();
