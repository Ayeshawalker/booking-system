const clientNoteControls = {
  client: document.querySelector("#client-note-client"),
  date: document.querySelector("#client-note-date"),
  privateSetup: document.querySelector("#client-note-private-setup"),
  retentionDate: document.querySelector("#client-note-retention-date"),
  type: document.querySelector("#client-note-type"),
  rough: document.querySelector("#client-note-rough"),
  improved: document.querySelector("#client-note-improved"),
  improveButton: document.querySelector("#improve-client-note"),
  saveButton: document.querySelector("#save-client-note"),
  clearButton: document.querySelector("#clear-client-note"),
  exportButton: document.querySelector("#export-client-notes"),
  deleteAllButton: document.querySelector("#delete-all-client-notes"),
  message: document.querySelector("#client-note-message"),
  list: document.querySelector("#client-notes-list"),
};

const clientNotesKey = "ayesha-client-notes";
let activeClientNoteId = null;

function createSupabaseClient() {
  if (window.ADMIN_SUPABASE) return window.ADMIN_SUPABASE;

  const config = window.BOOKING_CONFIG || {};
  const hasConfig = config.supabaseUrl && config.supabaseAnonKey;

  if (!hasConfig || !window.supabase) return null;

  return window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
}

function getLocalClientNotes() {
  return JSON.parse(localStorage.getItem(clientNotesKey) || "[]");
}

function saveLocalClientNotes(notes) {
  localStorage.setItem(clientNotesKey, JSON.stringify(notes));
}

function createClientNoteId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createLocalDate(dateValue) {
  return new Date(`${dateValue}T12:00:00`);
}

function formatNoteDate(dateValue) {
  if (!dateValue) return "No date";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(createLocalDate(dateValue));
}

function clientNoteSetupError() {
  if (!clientNoteControls.privateSetup.checked) {
    return "Tick the private notes acknowledgement before improving or saving notes.";
  }

  return "";
}

function noteLineItems(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*.\d)\s]+/, "").trim())
    .filter(Boolean);
}

function tidyNoteLine(line) {
  const withoutExtraSpace = line.replace(/\s+/g, " ").trim();
  if (!withoutExtraSpace) return "";

  const withCapital =
    withoutExtraSpace.charAt(0).toUpperCase() + withoutExtraSpace.slice(1);

  return /[.!?]$/.test(withCapital) ? withCapital : `${withCapital}.`;
}

function addNoteSection(sections, title, lines) {
  if (lines.length === 0) return;

  sections.push(title);
  sections.push(...lines.map((line) => `- ${tidyNoteLine(line)}`));
  sections.push("");
}

function locallyImproveClientNote({ clientReference, noteDate, noteType, roughNote }) {
  const lines = noteLineItems(roughNote);
  const grouped = {
    summary: [],
    followUp: [],
    admin: [],
    review: [],
  };

  lines.forEach((line) => {
    const lowercaseLine = line.toLowerCase();

    if (/(risk|safety|safeguard|harm|crisis|concern)/.test(lowercaseLine)) {
      grouped.review.push(line);
      return;
    }

    if (/(follow|next|action|homework|send|email|call|book|review)/.test(lowercaseLine)) {
      grouped.followUp.push(line);
      return;
    }

    if (/(invoice|payment|cancel|room|admin|form|letter|document)/.test(lowercaseLine)) {
      grouped.admin.push(line);
      return;
    }

    grouped.summary.push(line);
  });

  const sections = [
    `${noteType} - ${formatNoteDate(noteDate)}`,
    `Client reference: ${clientReference || "Not added"}`,
    "",
  ];

  addNoteSection(sections, "Summary", grouped.summary);
  addNoteSection(sections, "Follow-up", grouped.followUp);
  addNoteSection(sections, "Admin / practical", grouped.admin);
  addNoteSection(sections, "Review before filing", grouped.review);

  if (lines.length === 0) {
    sections.push("Add a rough note first, then improve it.");
  } else {
    sections.push(
      "Clinical caution: check this wording before filing. This tool improves structure only and does not assess, diagnose or replace professional judgement.",
    );
  }

  return sections.join("\n").trim();
}

async function improveClientNoteWithConfiguredAi(payload) {
  const config = window.BOOKING_CONFIG || {};
  const functionName = config.clientNoteImproveFunction;

  if (!functionName) return null;

  const supabaseClient = createSupabaseClient();
  if (!supabaseClient) return null;

  const { data, error } = await supabaseClient.functions.invoke(functionName, {
    body: payload,
  });

  if (error) throw error;
  return typeof data?.improvedNote === "string" ? data.improvedNote : null;
}

function clearClientNoteForm() {
  activeClientNoteId = null;
  clientNoteControls.client.value = "";
  clientNoteControls.date.value = new Date().toISOString().slice(0, 10);
  clientNoteControls.retentionDate.value = "";
  clientNoteControls.type.value = "Session note";
  clientNoteControls.rough.value = "";
  clientNoteControls.improved.value = "";
  clientNoteControls.message.textContent = "";
  clientNoteControls.saveButton.textContent = "Save note";
}

async function handleClientNoteImprove() {
  const payload = {
    clientReference: clientNoteControls.client.value.trim(),
    noteDate: clientNoteControls.date.value,
    noteType: clientNoteControls.type.value,
    roughNote: clientNoteControls.rough.value.trim(),
  };
  const setupError = clientNoteSetupError();

  if (!payload.roughNote) {
    clientNoteControls.message.textContent = "Add a rough note before improving it.";
    return;
  }

  if (setupError) {
    clientNoteControls.message.textContent = setupError;
    return;
  }

  clientNoteControls.improveButton.disabled = true;
  clientNoteControls.improveButton.textContent = "Improving...";

  try {
    const aiImprovedNote = await improveClientNoteWithConfiguredAi(payload);
    clientNoteControls.improved.value =
      aiImprovedNote || locallyImproveClientNote(payload);
    clientNoteControls.message.textContent = aiImprovedNote
      ? "Improved using the configured AI function. Review before saving."
      : "Improved locally. Add a secure AI function later for richer rewriting.";
  } catch (error) {
    console.error(error);
    clientNoteControls.improved.value = locallyImproveClientNote(payload);
    clientNoteControls.message.textContent =
      "The AI function could not be reached, so this was improved locally.";
  } finally {
    clientNoteControls.improveButton.disabled = false;
    clientNoteControls.improveButton.textContent = "Improve note";
  }
}

function handleClientNoteSave() {
  const clientReference = clientNoteControls.client.value.trim();
  const roughNote = clientNoteControls.rough.value.trim();
  const improvedNote = clientNoteControls.improved.value.trim();
  const setupError = clientNoteSetupError();

  if (setupError) {
    clientNoteControls.message.textContent = setupError;
    return;
  }

  if (!clientReference) {
    clientNoteControls.message.textContent = "Add a client reference before saving.";
    return;
  }

  if (!roughNote && !improvedNote) {
    clientNoteControls.message.textContent = "Add a note before saving.";
    return;
  }

  const notes = getLocalClientNotes();
  const existingNote = notes.find((note) => note.id === activeClientNoteId);
  const savedNote = {
    id: activeClientNoteId || createClientNoteId(),
    clientReference,
    noteDate: clientNoteControls.date.value,
    noteType: clientNoteControls.type.value,
    retentionReviewDate: clientNoteControls.retentionDate.value,
    privateWorkspaceConfirmed: clientNoteControls.privateSetup.checked,
    humanReviewConfirmed: clientNoteControls.privateSetup.checked,
    roughNote,
    improvedNote,
    updatedAt: new Date().toISOString(),
    createdAt: existingNote?.createdAt || new Date().toISOString(),
  };
  const nextNotes = [
    savedNote,
    ...notes.filter((note) => note.id !== savedNote.id),
  ].slice(0, 50);

  saveLocalClientNotes(nextNotes);
  activeClientNoteId = savedNote.id;
  clientNoteControls.saveButton.textContent = "Update note";
  clientNoteControls.message.textContent = "Saved in this browser only.";
  renderClientNotes();
}

function loadClientNoteIntoForm(note) {
  activeClientNoteId = note.id;
  clientNoteControls.client.value = note.clientReference || "";
  clientNoteControls.date.value = note.noteDate || new Date().toISOString().slice(0, 10);
  clientNoteControls.retentionDate.value = note.retentionReviewDate || "";
  clientNoteControls.privateSetup.checked = Boolean(
    note.privateWorkspaceConfirmed ||
      note.secureWorkspaceConfirmed ||
      note.humanReviewConfirmed,
  );
  clientNoteControls.type.value = note.noteType || "Session note";
  clientNoteControls.rough.value = note.roughNote || "";
  clientNoteControls.improved.value = note.improvedNote || "";
  clientNoteControls.saveButton.textContent = "Update note";
  clientNoteControls.message.textContent = "Loaded note for editing.";
}

function deleteClientNote(noteId) {
  saveLocalClientNotes(getLocalClientNotes().filter((note) => note.id !== noteId));

  if (activeClientNoteId === noteId) {
    clearClientNoteForm();
  }

  clientNoteControls.message.textContent = "Note deleted.";
  renderClientNotes();
}

function exportClientNotes() {
  const notes = getLocalClientNotes();

  if (notes.length === 0) {
    clientNoteControls.message.textContent = "There are no notes to export.";
    return;
  }

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    warning:
      "Client notes may contain sensitive health information. Store this export securely and delete it when no longer needed.",
    notes,
  };
  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
    type: "application/json",
  });
  const exportLink = document.createElement("a");

  exportLink.href = URL.createObjectURL(blob);
  exportLink.download = `ayesha-client-notes-${new Date().toISOString().slice(0, 10)}.json`;
  exportLink.click();
  URL.revokeObjectURL(exportLink.href);
  clientNoteControls.message.textContent =
    "Notes exported. Store the file securely and delete copies that are no longer needed.";
}

function deleteAllClientNotes() {
  const notes = getLocalClientNotes();

  if (notes.length === 0) {
    clientNoteControls.message.textContent = "There are no notes to delete.";
    return;
  }

  const confirmed = window.confirm(
    "Delete all locally saved client notes from this browser? This cannot be undone.",
  );

  if (!confirmed) return;

  saveLocalClientNotes([]);
  clearClientNoteForm();
  clientNoteControls.message.textContent = "All locally saved client notes were deleted.";
  renderClientNotes();
}

function noteMetaText(note) {
  const reviewText = note.retentionReviewDate
    ? `review by ${formatNoteDate(note.retentionReviewDate)}`
    : "no review date";

  return `Updated ${formatNoteDate(note.noteDate)} - ${reviewText} - saved locally`;
}

function renderClientNotes() {
  const notes = getLocalClientNotes();

  clientNoteControls.list.innerHTML = "";

  notes.forEach((note) => {
    const item = document.createElement("li");
    const details = document.createElement("span");
    const meta = document.createElement("small");
    const actions = document.createElement("span");
    const editButton = document.createElement("button");
    const deleteButton = document.createElement("button");

    actions.className = "settings-list-actions";
    details.textContent = `${note.clientReference || "No reference"} - ${note.noteType || "Note"}`;
    meta.textContent = noteMetaText(note);
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => loadClientNoteIntoForm(note));
    deleteButton.type = "button";
    deleteButton.className = "secondary-button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteClientNote(note.id));

    actions.append(editButton, deleteButton);
    item.append(details, meta, actions);
    clientNoteControls.list.append(item);
  });

  if (notes.length === 0) {
    clientNoteControls.message.textContent =
      clientNoteControls.message.textContent || "No client notes have been saved yet.";
  }
}

clientNoteControls.improveButton.addEventListener("click", handleClientNoteImprove);
clientNoteControls.saveButton.addEventListener("click", handleClientNoteSave);
clientNoteControls.clearButton.addEventListener("click", clearClientNoteForm);
clientNoteControls.exportButton.addEventListener("click", exportClientNotes);
clientNoteControls.deleteAllButton.addEventListener("click", deleteAllClientNotes);
clearClientNoteForm();
renderClientNotes();
