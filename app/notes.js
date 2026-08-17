(async function setupSecureClientNotes() {
  const admin = await window.ADMIN_READY;
  const db = admin.client;
  const ui = {
    client: document.querySelector("#client-note-client"), date: document.querySelector("#client-note-date"),
    type: document.querySelector("#client-note-type"), review: document.querySelector("#client-note-retention-date"),
    rough: document.querySelector("#client-note-rough"), final: document.querySelector("#client-note-improved"),
    aiMode: document.querySelector("#client-note-ai-mode"), improve: document.querySelector("#improve-client-note"),
    save: document.querySelector("#save-client-note"), finalise: document.querySelector("#finalise-client-note"),
    clear: document.querySelector("#clear-client-note"), message: document.querySelector("#client-note-message"),
    list: document.querySelector("#client-notes-list"), filter: document.querySelector("#client-note-list-filter"),
    showArchived: document.querySelector("#show-archived-notes"),
    historyDialog: document.querySelector("#note-history-dialog"), historyList: document.querySelector("#note-history-list"),
    interventions: document.querySelector("#client-note-interventions"), resources: document.querySelector("#client-note-resources"),
    needsSupervision: document.querySelector("#client-note-needs-supervision"), supervisionWrap: document.querySelector("#client-note-supervision-wrap"),
    supervisionQuestion: document.querySelector("#client-note-supervision-question"), workOverview: document.querySelector("#client-work-overview"),
    imageFields: document.querySelector(".note-image-fields"), imageDropzone: document.querySelector("#note-image-dropzone"),
    imageInput: document.querySelector("#note-image-input"), addImage: document.querySelector("#add-note-image"), imageList: document.querySelector("#note-image-list"),
    abcSuggest: document.querySelector("#suggest-note-abc"), abcReview: document.querySelector("#note-abc-review"),
    abcA: document.querySelector("#note-abc-a"), abcB: document.querySelector("#note-abc-b"), abcC: document.querySelector("#note-abc-c"),
    abcTitle: document.querySelector("#note-abc-diagram-title"), abcCreate: document.querySelector("#create-note-abc"), abcCancel: document.querySelector("#cancel-note-abc"),
  };
  let clients = [];
  let notes = [];
  let activeId = null;
  let aiUsed = false;
  let aiModel = null;
  let supervisionStatus = "Not required";
  let supervisionDiscussedAt = null;
  let structuredFieldsReady = false;
  let imageFieldsReady = false;
  let noteImages = [];
  let stagedImages = [];
  const imageBucket = "clinical-note-images";

  const name = (client) => [[client.first_name, client.surname].filter(Boolean).join(" "), [client.second_first_name, client.second_surname].filter(Boolean).join(" ")].filter(Boolean).join(" and ");
  const formatDate = (date) => date ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(`${date}T12:00:00`)) : "No date";
  const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[c]);
  const lines = (value) => String(value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  const joinLines = (value) => Array.isArray(value) ? value.join("\n") : "";

  function safeFileName(value) {
    return String(value || "image").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "image";
  }
  function escapeXml(value) { return String(value || "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"})[c]); }
  function svgLines(value, width = 34) {
    const words = String(value || "").trim().split(/\s+/).filter(Boolean); const rows = []; let row = "";
    words.forEach((word) => { const next = row ? `${row} ${word}` : word; if (next.length > width && row) { rows.push(row); row = word; } else row = next; });
    if (row) rows.push(row); return rows.slice(0, 10);
  }
  function abcSvg(title, sections) {
    const cards = sections.map((section, index) => {
      const x = 54 + (index * 382); const lines = svgLines(section.text);
      return `<rect x="${x}" y="190" width="338" height="420" rx="28" fill="${section.fill}" stroke="${section.stroke}" stroke-width="4"/><circle cx="${x + 48}" cy="242" r="27" fill="${section.stroke}"/><text x="${x + 48}" y="252" text-anchor="middle" font-family="Arial, sans-serif" font-size="29" font-weight="700" fill="white">${section.letter}</text><text x="${x + 88}" y="250" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#4f1531">${escapeXml(section.heading)}</text>${lines.map((line, lineIndex) => `<text x="${x + 28}" y="${315 + lineIndex * 31}" font-family="Arial, sans-serif" font-size="22" fill="#5f4550">${escapeXml(line)}</text>`).join("")}`;
    }).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720"><defs><linearGradient id="accent" x1="0" x2="1"><stop stop-color="#ed168c"/><stop offset="1" stop-color="#f6a623"/></linearGradient></defs><rect width="1200" height="720" rx="38" fill="#fffaf1"/><rect x="0" y="0" width="1200" height="18" rx="9" fill="url(#accent)"/><text x="600" y="88" text-anchor="middle" font-family="Georgia, serif" font-size="42" font-weight="700" fill="#8a5808">${escapeXml(title || "ABC explored in session")}</text><text x="600" y="132" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#806873">Clinician-reviewed therapeutic working diagram</text>${cards}<text x="600" y="672" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" letter-spacing="3" fill="#8a5808">AYESHA JANE · THERAPY · COUNSELLING · COACHING</text></svg>`;
  }
  async function suggestAbc() {
    const source = (ui.final.value || ui.rough.value).trim();
    if (!source) { ui.message.textContent = "Add a session note before asking for an ABC suggestion."; return; }
    ui.abcSuggest.disabled = true; ui.abcSuggest.textContent = "Preparing suggestion…"; ui.message.textContent = "Preparing an ABC draft for your review…";
    try {
      const { data, error } = await db.functions.invoke(window.BOOKING_CONFIG.clientNoteImproveFunction, { body: { roughNote: source, noteType: ui.type.value, instruction: "extract-abc" } });
      if (error) throw error;
      if (!data?.abc) throw new Error(data?.error || "No ABC suggestion was returned.");
      ui.abcA.value = data.abc.activatingEvent || "Not clearly stated in the note.";
      ui.abcB.value = data.abc.beliefs || "Not clearly stated in the note.";
      ui.abcC.value = data.abc.consequences || "Not clearly stated in the note.";
      ui.abcReview.hidden = false; ui.abcReview.scrollIntoView({ behavior: "smooth", block: "center" });
      ui.message.textContent = "ABC suggestion ready. Review and edit all three boxes before creating the diagram.";
    } catch (error) {
      console.error(error); let reason = String(error?.message || "The AI service could not be reached.");
      if (error?.context?.json) { try { const details = await error.context.json(); reason = String(details?.error || reason); } catch (_) {} }
      ui.message.textContent = `The ABC suggestion could not be created. AI service message: ${reason}`; ui.message.classList.add("note-save-error");
    } finally { ui.abcSuggest.disabled = false; ui.abcSuggest.textContent = "Suggest ABC from note"; }
  }
  async function createAbcDiagram() {
    if (![ui.abcA, ui.abcB, ui.abcC].every((field) => field.value.trim())) { ui.message.textContent = "Review and complete all three ABC boxes first."; return; }
    const svg = abcSvg(ui.abcTitle.value.trim(), [
      { letter: "A", heading: "Activating event", text: ui.abcA.value.trim(), fill: "#fff2f8", stroke: "#ed168c" },
      { letter: "B", heading: "Beliefs", text: ui.abcB.value.trim(), fill: "#fff8e9", stroke: "#d88b12" },
      { letter: "C", heading: "Consequences", text: ui.abcC.value.trim(), fill: "#f5efff", stroke: "#7653c6" },
    ]);
    ui.abcCreate.disabled = true; ui.abcCreate.textContent = "Creating diagram…";
    try {
      const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      const image = new Image();
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = svgUrl; });
      const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 720;
      canvas.getContext("2d").drawImage(image, 0, 0); URL.revokeObjectURL(svgUrl);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
      if (!blob) throw new Error("The diagram image could not be prepared.");
      const file = new File([blob], `abc-diagram-${ui.date.value || "session"}.png`, { type: "image/png" });
      stagedImages.push({ file, file_name: file.name, caption: ui.abcTitle.value.trim() || "ABC explored in session", previewUrl: URL.createObjectURL(file) });
    } catch (error) { console.error(error); ui.message.textContent = "The reviewed wording is safe, but the diagram image could not be created. Please try again."; return; }
    finally { ui.abcCreate.disabled = false; ui.abcCreate.textContent = "Create reviewed diagram"; }
    ui.abcReview.hidden = true; renderImages(); ui.imageFields.scrollIntoView({ behavior: "smooth", block: "center" });
    ui.message.textContent = "Reviewed ABC diagram created. Save or update the note to store it securely.";
  }
  function revokeStagedUrls() { stagedImages.forEach((item) => URL.revokeObjectURL(item.previewUrl)); }
  async function signedImageUrl(path) {
    const { data, error } = await db.storage.from(imageBucket).createSignedUrl(path, 3600);
    return error ? "" : data.signedUrl;
  }
  async function renderImages() {
    if (!imageFieldsReady) return;
    const saved = await Promise.all(noteImages.map(async (item) => ({ ...item, previewUrl: await signedImageUrl(item.storage_path) })));
    const all = [...saved.map((item) => ({ ...item, saved: true })), ...stagedImages.map((item) => ({ ...item, saved: false }))];
    if (!all.length) { ui.imageList.innerHTML = "<p>No images added to this note.</p>"; return; }
    ui.imageList.innerHTML = all.map((item, index) => `<figure class="note-image-card" data-image-index="${index}" data-image-saved="${item.saved}"><img src="${escapeHtml(item.previewUrl)}" alt="${escapeHtml(item.caption || item.file_name || "Note image")}" /><figcaption><input class="note-image-caption" type="text" value="${escapeHtml(item.caption || "")}" placeholder="Caption, for example: ABC explored in session" /><button class="secondary-button note-image-remove" type="button">Remove</button></figcaption></figure>`).join("");
    ui.imageList.querySelectorAll(".note-image-card").forEach((card) => {
      const index = Number(card.dataset.imageIndex); const savedItem = card.dataset.imageSaved === "true";
      card.querySelector(".note-image-caption").addEventListener("change", async (event) => {
        if (!savedItem) { stagedImages[index - saved.length].caption = event.target.value.trim(); return; }
        noteImages[index].caption = event.target.value.trim();
        const { error } = await db.from("clinical_note_attachments").update({ caption: noteImages[index].caption }).eq("id", noteImages[index].id);
        ui.message.textContent = error ? "The image caption could not be saved." : "Image caption saved.";
      });
      card.querySelector(".note-image-remove").addEventListener("click", async () => {
        if (!savedItem) { const stagedIndex = index - saved.length; URL.revokeObjectURL(stagedImages[stagedIndex].previewUrl); stagedImages.splice(stagedIndex, 1); await renderImages(); return; }
        if (!confirm("Remove this image from the clinical note?")) return;
        const item = noteImages[index];
        const { error: storageError } = await db.storage.from(imageBucket).remove([item.storage_path]);
        if (storageError) { ui.message.textContent = "The image could not be removed."; return; }
        await db.from("clinical_note_attachments").delete().eq("id", item.id); await loadImages(activeId);
      });
    });
  }
  function stageFiles(fileList) {
    const files = [...fileList].filter((file) => file.type.startsWith("image/"));
    const tooLarge = files.find((file) => file.size > 8 * 1024 * 1024);
    if (tooLarge) { ui.message.textContent = `${tooLarge.name} is larger than 8 MB. Please use a smaller image.`; return; }
    files.forEach((file) => stagedImages.push({ file, file_name: file.name || "pasted-image.png", caption: "", previewUrl: URL.createObjectURL(file) }));
    renderImages();
  }
  async function loadImages(noteId) {
    noteImages = [];
    if (!imageFieldsReady || !noteId) { await renderImages(); return; }
    const { data, error } = await db.from("clinical_note_attachments").select("*").eq("note_id", noteId).order("display_order").order("created_at");
    if (error) { ui.message.textContent = "Images for this note could not be loaded."; return; }
    noteImages = data || []; await renderImages();
  }
  async function uploadStagedImages(noteId) {
    if (!imageFieldsReady || !stagedImages.length) return;
    const pending = [...stagedImages];
    for (let index = 0; index < pending.length; index += 1) {
      const item = pending[index];
      const path = `${admin.user.id}/${noteId}/${crypto.randomUUID()}-${safeFileName(item.file_name)}`;
      const { error: uploadError } = await db.storage.from(imageBucket).upload(path, item.file, { contentType: item.file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { error: rowError } = await db.from("clinical_note_attachments").insert({ note_id: noteId, storage_path: path, file_name: item.file_name, mime_type: item.file.type, file_size: item.file.size, caption: item.caption, display_order: noteImages.length + index, created_by: admin.user.id });
      if (rowError) { await db.storage.from(imageBucket).remove([path]); throw rowError; }
    }
    revokeStagedUrls(); stagedImages = []; await loadImages(noteId);
  }

  function setOptions(select, includeAll) {
    const first = includeAll ? '<option value="">All clients</option>' : '<option value="">Choose client</option>';
    select.innerHTML = first + clients.map((client) => {
      const status = client.status && client.status !== "Active" ? ` — ${client.status}` : "";
      return `<option value="${client.id}">${escapeHtml(`${name(client)}${status}`)}</option>`;
    }).join("");
  }
  function clearForm() {
    revokeStagedUrls(); stagedImages = []; noteImages = [];
    activeId = null; aiUsed = false; aiModel = null; supervisionStatus = "Not required"; supervisionDiscussedAt = null;
    ui.client.value = ""; ui.date.value = new Date().toISOString().slice(0, 10);
    ui.type.value = "Session note"; ui.review.value = ""; ui.rough.value = ""; ui.final.value = "";
    ui.interventions.value = ""; ui.resources.value = ""; ui.needsSupervision.checked = false;
    ui.supervisionQuestion.value = ""; ui.supervisionWrap.hidden = true;
    ui.abcA.value = ""; ui.abcB.value = ""; ui.abcC.value = ""; ui.abcTitle.value = "ABC explored in session"; ui.abcReview.hidden = true;
    ui.save.textContent = "Save draft"; ui.message.textContent = "";
    renderImages();
    [ui.client, ui.date, ui.type, ui.review, ui.rough, ui.final, ui.improve, ui.save, ui.finalise].forEach((element) => element.disabled = false);
  }
  function currentPayload(status) {
    const payload = {
      client_id: ui.client.value, note_date: ui.date.value, note_type: ui.type.value,
      retention_review_date: ui.review.value || null, rough_note: ui.rough.value.trim(),
      final_note: ui.final.value.trim(), status, ai_assisted: aiUsed,
      ai_model: aiUsed ? aiModel : null, updated_by: admin.user.id,
      finalised_at: status === "Final" ? new Date().toISOString() : null,
      interventions: lines(ui.interventions.value), resources_shared: lines(ui.resources.value),
      supervision_required: ui.needsSupervision.checked,
      supervision_question: ui.needsSupervision.checked ? ui.supervisionQuestion.value.trim() : "",
      supervision_status: ui.needsSupervision.checked ? (supervisionStatus === "Discussed" ? "Discussed" : "Outstanding") : "Not required",
      supervision_discussed_at: ui.needsSupervision.checked && supervisionStatus === "Discussed" ? supervisionDiscussedAt : null,
    };
    if (!structuredFieldsReady) {
      delete payload.interventions; delete payload.resources_shared; delete payload.supervision_required;
      delete payload.supervision_question; delete payload.supervision_status; delete payload.supervision_discussed_at;
    }
    return payload;
  }
  function validate() {
    if (!ui.client.value) return "Choose the client this note belongs to.";
    if (!ui.date.value) return "Choose the note date.";
    if (!ui.rough.value.trim() && !ui.final.value.trim()) return "Write a note before saving.";
    if (ui.needsSupervision.checked && !ui.supervisionQuestion.value.trim()) return "Add a brief supervision question or reminder.";
    return "";
  }
  async function save(status) {
    const problem = validate(); if (problem) { ui.message.textContent = problem; return; }
    if (status === "Final" && !ui.final.value.trim()) ui.final.value = ui.rough.value.trim();
    if (status === "Final" && !confirm("Finalise this note? Its wording will be preserved in the audit history if it is amended later.")) return;
    ui.save.disabled = true; ui.finalise.disabled = true; ui.message.textContent = "Saving securely…";
    const payload = currentPayload(status);
    try {
      const query = activeId ? db.from("clinical_notes").update(payload).eq("id", activeId) : db.from("clinical_notes").insert({ ...payload, created_by: admin.user.id });
      const { data, error } = await query.select("*").single();
      if (error) throw error;
      activeId = data.id;
      await uploadStagedImages(data.id);
      await loadNotes();
      await loadIntoForm(data);
      ui.message.textContent = status === "Final" ? "Final note saved securely." : "Draft saved securely.";
    } catch (error) {
      console.error(error);
      const technicalReason = String(error.message || error.details || "Unknown database error");
      ui.message.textContent = `The note was not saved. Your text remains above. Technical reason: ${technicalReason}`;
      ui.message.classList.add("note-save-error");
    } finally { ui.save.disabled = false; ui.finalise.disabled = false; }
  }
  async function improve() {
    if (!ui.rough.value.trim()) { ui.message.textContent = "Add a rough note first."; return; }
    ui.improve.disabled = true; ui.improve.textContent = "Improving…"; ui.message.textContent = "Creating a suggestion. Nothing will be saved automatically…";
    try {
      const { data, error } = await db.functions.invoke(window.BOOKING_CONFIG.clientNoteImproveFunction, { body: { roughNote: ui.rough.value.trim(), noteType: ui.type.value, instruction: ui.aiMode.value } });
      if (error) throw error;
      if (!data?.improvedNote) throw new Error(data?.error || "No suggestion was returned.");
      ui.final.value = data.improvedNote; aiUsed = true; aiModel = data.model || null;
      ui.message.textContent = "AI suggestion ready. Compare it carefully with the rough note before saving.";
    } catch (error) {
      console.error(error);
      let technicalReason = String(error?.message || "The AI service could not be reached.");
      if (error?.context?.json) {
        try {
          const details = await error.context.json();
          technicalReason = String(details?.error || technicalReason);
        } catch (_) {}
      }
      ui.message.textContent = `The note was not changed. AI service message: ${technicalReason}`;
      ui.message.classList.add("note-save-error");
    } finally { ui.improve.disabled = false; ui.improve.textContent = "Improve note"; }
  }
  async function loadIntoForm(note) {
    activeId = note.id; aiUsed = Boolean(note.ai_assisted); aiModel = note.ai_model;
    ui.client.value = note.client_id; ui.date.value = note.note_date; ui.type.value = note.note_type;
    ui.review.value = note.retention_review_date || ""; ui.rough.value = note.rough_note || ""; ui.final.value = note.final_note || "";
    ui.interventions.value = joinLines(note.interventions); ui.resources.value = joinLines(note.resources_shared);
    ui.needsSupervision.checked = Boolean(note.supervision_required);
    ui.supervisionQuestion.value = note.supervision_question || ""; ui.supervisionWrap.hidden = !ui.needsSupervision.checked;
    supervisionStatus = note.supervision_status || (note.supervision_required ? "Outstanding" : "Not required");
    supervisionDiscussedAt = note.supervision_discussed_at || null;
    ui.save.textContent = "Update draft";
    const final = note.status === "Final";
    ui.message.classList.remove("note-save-error");
    ui.message.textContent = final ? "This is a final note. Any later change will preserve the earlier wording in its history." : "Draft loaded.";
    revokeStagedUrls(); stagedImages = []; await loadImages(note.id);
  }
  async function openNote(note) {
    await loadIntoForm(note);
    ui.message.textContent = `${note.status === "Final" ? "Final note" : "Draft"} opened. You can read it below or make changes and save again.`;
    document.querySelector("#client-notes-panel").scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => ui.rough.focus({ preventScroll: true }), 450);
  }
  async function archive(note) {
    if (!confirm("Archive this note? It will disappear from the active list but remain in the audit record.")) return;
    const { error } = await db.from("clinical_notes").update({ archived_at: new Date().toISOString(), archived_by: admin.user.id }).eq("id", note.id);
    if (error) { ui.message.textContent = "The note could not be archived."; return; }
    if (activeId === note.id) clearForm(); await loadNotes();
  }
  async function restore(note) {
    const { error } = await db.from("clinical_notes").update({ archived_at: null, archived_by: null }).eq("id", note.id);
    if (error) { ui.message.textContent = "The note could not be restored."; return; }
    await loadNotes();
    ui.message.textContent = "The note has been restored to Saved notes.";
  }
  async function showHistory(note) {
    ui.historyList.textContent = "Loading history…"; ui.historyDialog.showModal();
    const { data, error } = await db.from("clinical_note_versions").select("version_number,final_note,rough_note,status,changed_at,structured_details").eq("note_id", note.id).order("version_number", { ascending: false });
    if (error) { ui.historyList.textContent = "History could not be loaded."; return; }
    const versions = data || [];
    ui.historyList.innerHTML = versions.length ? versions.map((version) => { const details = version.structured_details || {}; const extras = [...(details.interventions || []).map((item) => `Intervention: ${item}`), ...(details.resources_shared || []).map((item) => `Resource: ${item}`), ...(details.supervision_question ? [`Supervision: ${details.supervision_question} (${details.supervision_status || ""})`] : [])]; return `<article class="note-version"><strong>Version ${version.version_number} · ${escapeHtml(version.status)}</strong><small>${new Date(version.changed_at).toLocaleString("en-GB")}</small><pre>${escapeHtml(version.final_note || version.rough_note)}</pre>${extras.length ? `<ul>${extras.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}</article>`; }).join("") : "No earlier versions yet.";
  }
  function render() {
    const filter = ui.filter.value;
    const archivedView = ui.showArchived.checked;
    const visible = notes.filter((note) => Boolean(note.archived_at) === archivedView && (!filter || note.client_id === filter));
    ui.list.innerHTML = "";
    visible.forEach((note) => {
      const client = clients.find((item) => item.id === note.client_id);
      const item = document.createElement("li"); item.className = "secure-note-list-item";
      const tags = [...(note.interventions || []), ...(note.resources_shared || [])];
      const clientName = client ? name(client) : "Client record unavailable";
      const clientStatus = client?.status && client.status !== "Active" ? ` · ${client.status} client` : "";
      item.innerHTML = `<span><strong>${escapeHtml(clientName)}</strong><small>${formatDate(note.note_date)} · ${escapeHtml(note.note_type)} · <b>${escapeHtml(note.status)}</b>${escapeHtml(clientStatus)}${note.archived_at ? " · Archived" : ""}${note.ai_assisted ? " · AI assisted" : ""}${note.supervision_status === "Outstanding" ? " · Supervision flagged" : ""}</small>${tags.length ? `<small>${escapeHtml(tags.join(" · "))}</small>` : ""}</span>`;
      const actions = document.createElement("span"); actions.className = "settings-list-actions";
      const finalAction = note.archived_at ? ["Restore", () => restore(note)] : ["Archive", () => archive(note)];
      [["Open note", () => openNote(note)], ["History", () => showHistory(note)], finalAction].forEach(([label, handler]) => { const button = document.createElement("button"); button.type = "button"; button.textContent = label; if (label === "Archive" || label === "Restore") button.className = "secondary-button"; button.addEventListener("click", handler); actions.append(button); });
      item.append(actions); ui.list.append(item);
    });
    if (!visible.length) ui.list.innerHTML = "<li>No secure notes have been saved for this selection.</li>";
    renderWorkOverview();
  }
  function renderWorkOverview() {
    const clientId = ui.client.value;
    if (!clientId) { ui.workOverview.innerHTML = "<p>No client selected.</p>"; return; }
    const clientNotes = notes.filter((note) => note.client_id === clientId && !note.archived_at).sort((a, b) => String(b.note_date).localeCompare(String(a.note_date)));
    const renderItems = (field, empty) => {
      const items = clientNotes.flatMap((note) => (note[field] || []).map((text) => ({ text, date: note.note_date })));
      return items.length ? `<ul>${items.map((item) => `<li><strong>${escapeHtml(item.text)}</strong><small>${formatDate(item.date)}</small></li>`).join("")}</ul>` : `<p>${empty}</p>`;
    };
    ui.workOverview.innerHTML = `<section><h4>Interventions and strategies</h4>${renderItems("interventions", "None recorded yet.")}</section><section><h4>Resources shared</h4>${renderItems("resources_shared", "None recorded yet.")}</section>`;
  }
  async function loadNotes() {
    const { data, error } = await db.from("clinical_notes").select("*").order("note_date", { ascending: false }).order("updated_at", { ascending: false });
    if (error) { notes = []; ui.message.textContent = "Secure notes are ready locally but still need activating in Supabase."; }
    else notes = data || [];
    render();
  }
  async function initialise() {
    const capability = await db.from("clinical_notes").select("interventions,resources_shared,supervision_required,supervision_status").limit(1);
    structuredFieldsReady = !capability.error;
    const imageCapability = await db.from("clinical_note_attachments").select("id").limit(1);
    imageFieldsReady = !imageCapability.error;
    document.querySelector(".note-structured-fields").hidden = !structuredFieldsReady;
    document.querySelector(".note-supervision-fields").hidden = !structuredFieldsReady;
    ui.imageFields.hidden = !imageFieldsReady;
    const { data, error } = await db.from("clients").select("id,first_name,surname,second_first_name,second_surname,status").order("first_name");
    if (error) { ui.message.textContent = "Clients could not be loaded."; return; }
    clients = data || []; setOptions(ui.client, false); setOptions(ui.filter, true); clearForm(); await loadNotes();
    if (!structuredFieldsReady) ui.message.textContent = "Your existing notes are working. The new interventions and supervision fields still need the one-time Supabase update.";
    else if (!imageFieldsReady) ui.message.textContent = "Your notes are working. Images and diagrams need the one-time Supabase attachment update before they appear.";
    const requestedId = new URLSearchParams(window.location.search).get("note");
    const requestedNote = notes.find((note) => note.id === requestedId);
    if (requestedNote) openNote(requestedNote);
  }
  ui.improve.addEventListener("click", improve); ui.save.addEventListener("click", () => save("Draft")); ui.finalise.addEventListener("click", () => save("Final"));
  ui.clear.addEventListener("click", clearForm); ui.filter.addEventListener("change", render); ui.showArchived.addEventListener("change", render);
  ui.client.addEventListener("change", renderWorkOverview);
  ui.needsSupervision.addEventListener("change", () => { ui.supervisionWrap.hidden = !ui.needsSupervision.checked; supervisionStatus = ui.needsSupervision.checked ? "Outstanding" : "Not required"; supervisionDiscussedAt = null; if (ui.needsSupervision.checked) ui.supervisionQuestion.focus(); });
  ui.addImage.addEventListener("click", () => ui.imageInput.click());
  ui.abcSuggest.addEventListener("click", suggestAbc);
  ui.abcCreate.addEventListener("click", createAbcDiagram);
  ui.abcCancel.addEventListener("click", () => { ui.abcReview.hidden = true; });
  ui.imageInput.addEventListener("change", () => { stageFiles(ui.imageInput.files); ui.imageInput.value = ""; });
  ui.imageDropzone.addEventListener("paste", (event) => { const files = [...event.clipboardData.items].filter((item) => item.kind === "file").map((item) => item.getAsFile()).filter(Boolean); if (files.length) { event.preventDefault(); stageFiles(files); } });
  ui.imageDropzone.addEventListener("dragover", (event) => { event.preventDefault(); ui.imageDropzone.classList.add("is-dragging"); });
  ui.imageDropzone.addEventListener("dragleave", () => ui.imageDropzone.classList.remove("is-dragging"));
  ui.imageDropzone.addEventListener("drop", (event) => { event.preventDefault(); ui.imageDropzone.classList.remove("is-dragging"); stageFiles(event.dataTransfer.files); });
  document.querySelector("#close-note-history").addEventListener("click", () => ui.historyDialog.close());
  window.addEventListener("beforeunload", (event) => {
    if (!ui.rough.value.trim() && !ui.final.value.trim()) return;
    const saved = notes.find((note) => note.id === activeId);
    const unchanged = saved && saved.rough_note === ui.rough.value.trim() && saved.final_note === ui.final.value.trim();
    if (unchanged) return;
    event.preventDefault(); event.returnValue = "";
  });
  await initialise();
})();
