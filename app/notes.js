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
    previousNotes: document.querySelector("#client-previous-notes"),
    intakeStatus: document.querySelector("#notes-intake-status"), intakeButton: document.querySelector("#view-notes-intake"),
    intakeAnswers: document.querySelector("#notes-intake-answers"),
    impactStatus: document.querySelector("#notes-impact-status"), impactButton: document.querySelector("#view-notes-impact"),
    impactAnswers: document.querySelector("#notes-impact-answers"),
    imageFields: document.querySelector(".note-image-fields"), imageDropzone: document.querySelector("#note-image-dropzone"),
    imageInput: document.querySelector("#note-image-input"), addImage: document.querySelector("#add-note-image"), imageList: document.querySelector("#note-image-list"),
    abcSuggest: document.querySelector("#suggest-note-abc"), abcReview: document.querySelector("#note-abc-review"),
    abcA: document.querySelector("#note-abc-a"), abcB: document.querySelector("#note-abc-b"), abcC: document.querySelector("#note-abc-c"),
    abcTitle: document.querySelector("#note-abc-diagram-title"), abcCreate: document.querySelector("#create-note-abc"), abcCancel: document.querySelector("#cancel-note-abc"),
    resourcePanel: document.querySelector("#client-resource-panel"), resourceUpload: document.querySelector("#client-resource-upload"),
    resourceTitle: document.querySelector("#client-resource-title-input"), resourceFile: document.querySelector("#client-resource-file"),
    resourceMessage: document.querySelector("#client-resource-message"), resourceLibrary: document.querySelector("#client-resource-library"),
    resourceHistory: document.querySelector("#client-resource-history"),
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
  let resourceLibraryReady = false;
  let noteImages = [];
  let stagedImages = [];
  let clientResources = [];
  let resourceShares = [];
  const intakeByClient = new Map();
  const impactByClient = new Map();
  const imageBucket = "clinical-note-images";
  const resourceBucket = "client-resources";

  const name = (client) => [[client.first_name, client.surname].filter(Boolean).join(" "), [client.second_first_name, client.second_surname].filter(Boolean).join(" ")].filter(Boolean).join(" and ");
  const formatDate = (date) => date ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(`${date}T12:00:00`)) : "No date";
  const statusLabel = (status) => status === "Final" ? "Completed" : "Unfinished draft";
  const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[c]);
  const lines = (value) => String(value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  const joinLines = (value) => Array.isArray(value) ? value.join("\n") : "";

  function intakeQuestion(key) {
    const importantLabels = {
      preferred_name: "Preferred name", pronouns: "Pronouns", date_of_birth: "Date of birth",
      safe_contact: "Safe contact preference", emergency_contact: "Emergency contact",
      what_happened: "What brought the client to therapy", therapy_hopes: "What the client hopes for from therapy",
      risk_thoughts: "Recent risk thoughts", risk_details: "Risk details", protective_factors: "Protective factors",
      important_context: "Other important context", access_needs: "Accessibility, communication or cultural needs",
    };
    if (importantLabels[key]) return importantLabels[key];
    const words = String(key || "").replaceAll("_", " ");
    return words ? words[0].toUpperCase() + words.slice(1) : "Answer";
  }

  function showIntakeReference(intake) {
    ui.intakeAnswers.hidden = true; ui.intakeAnswers.innerHTML = "";
    if (!ui.client.value) {
      ui.intakeStatus.textContent = "Choose a client to see their intake form.";
      ui.intakeButton.hidden = true; return;
    }
    if (!intake) {
      ui.intakeStatus.textContent = "No completed intake form is recorded for this client.";
      ui.intakeButton.hidden = true; return;
    }
    const signed = intake.signed_at
      ? new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(new Date(intake.signed_at))
      : "date unavailable";
    ui.intakeStatus.textContent = `${intake.form_type || "Therapy"} intake completed by ${intake.signer_name || "the client"} on ${signed}.`;
    ui.intakeButton.hidden = false; ui.intakeButton.textContent = "View intake form";
    const answers = Object.entries(intake.answers || {}).filter(([, value]) =>
      value !== "" && value !== null && value !== undefined && (!Array.isArray(value) || value.length)
    );
    ui.intakeAnswers.innerHTML = answers.length
      ? answers.map(([key, value]) => `<article><h4>${escapeHtml(intakeQuestion(key))}</h4><p>${escapeHtml(Array.isArray(value) ? value.join(", ") : value)}</p></article>`).join("")
      : "<p>No answers were recorded on this intake form.</p>";
  }

  async function loadIntakeReference() {
    const clientId = ui.client.value;
    if (!clientId) { showIntakeReference(null); return; }
    ui.intakeStatus.textContent = "Loading completed intake form…"; ui.intakeButton.hidden = true;
    if (intakeByClient.has(clientId)) { showIntakeReference(intakeByClient.get(clientId)); return; }
    const { data, error } = await db.from("client_intake_forms")
      .select("id,form_type,status,answers,signer_name,signed_at,created_at")
      .eq("client_id", clientId).eq("status", "Completed").neq("form_type", "Impact statement")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) {
      console.error(error); ui.intakeStatus.textContent = "The intake form could not be loaded."; return;
    }
    intakeByClient.set(clientId, data || null); showIntakeReference(data || null);
  }

  function showImpactReference(statement) {
    ui.impactAnswers.hidden = true; ui.impactAnswers.innerHTML = "";
    if (!ui.client.value) { ui.impactStatus.textContent = "Choose a client to see their Impact Statement."; ui.impactButton.hidden = true; return; }
    if (!statement) { ui.impactStatus.textContent = "No submitted Impact Statement is recorded for this client."; ui.impactButton.hidden = true; return; }
    const date = statement.signed_at ? new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(new Date(statement.signed_at)) : "date unavailable";
    ui.impactStatus.textContent = `Submitted by ${statement.signer_name || "the client"} on ${date}.`;
    ui.impactButton.hidden = false; ui.impactButton.textContent = "View Impact Statement";
    const labels = { impact_intention: "Intention for writing", impact_pause_plan: "Pause plan", impact_support_person: "Support person", impact_reflections: "Reflections" };
    ui.impactAnswers.innerHTML = Object.entries(statement.answers || {}).filter(([,v])=>v && (!Array.isArray(v)||v.length)).map(([key,value])=>`<article><h4>${escapeHtml(labels[key]||key)}</h4>${Array.isArray(value)?value.map((item,index)=>`<p><strong>${index+1}.</strong> ${escapeHtml(item)}</p>`).join(""):`<p>${escapeHtml(value)}</p>`}</article>`).join("") || "<p>No written responses were recorded.</p>";
  }

  async function loadImpactReference() {
    const clientId = ui.client.value;
    if (!clientId) { showImpactReference(null); return; }
    if (impactByClient.has(clientId)) { showImpactReference(impactByClient.get(clientId)); return; }
    ui.impactStatus.textContent = "Loading Impact Statement…"; ui.impactButton.hidden = true;
    const { data, error } = await db.from("client_intake_forms").select("id,status,answers,signer_name,signed_at,created_at").eq("client_id",clientId).eq("form_type","Impact statement").eq("status","Completed").order("created_at",{ascending:false}).limit(1).maybeSingle();
    if (error) { console.error(error); ui.impactStatus.textContent = "The Impact Statement could not be loaded."; return; }
    impactByClient.set(clientId,data||null); showImpactReference(data||null);
  }

  function clientGreeting(client) {
    return [client?.first_name, client?.second_first_name].filter(Boolean).join(" and ") || "there";
  }
  function readableSize(bytes) {
    const size = Number(bytes || 0);
    return size >= 1048576 ? `${(size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`;
  }
  async function signedResourceUrl(resource) {
    const { data, error } = await db.storage.from(resourceBucket).createSignedUrl(resource.storage_path, 60 * 60 * 24 * 14);
    if (error || !data?.signedUrl) throw error || new Error("A secure sharing link could not be created.");
    return data.signedUrl;
  }
  async function viewResource(resource) {
    const target = window.open("about:blank", "_blank");
    try {
      const url = await signedResourceUrl(resource);
      if (target) target.location.href = url; else window.location.href = url;
    } catch (error) {
      if (target) target.close();
      console.error(error); ui.resourceMessage.textContent = "The information sheet could not be opened.";
    }
  }
  async function shareResource(resource) {
    const client = clients.find((item) => item.id === ui.client.value);
    if (!client) { ui.resourceMessage.textContent = "Choose a client before sharing an information sheet."; return; }
    const target = window.open("about:blank", "_blank");
    ui.resourceMessage.textContent = "Preparing a secure WhatsApp link…";
    try {
      const url = await signedResourceUrl(resource);
      const { error } = await db.from("client_resource_shares").insert({ client_id: client.id, resource_id: resource.id, sharing_method: "WhatsApp secure link", shared_by: admin.user.id });
      if (error) throw error;
      const message = `Hi ${clientGreeting(client)}, here is the information sheet we discussed: ${resource.title}. This secure link will remain available for 14 days: ${url}`;
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      if (target) target.location.href = whatsappUrl; else window.location.href = whatsappUrl;
      ui.resourceMessage.textContent = `${resource.title} has been recorded as sent to ${name(client)}. WhatsApp has been opened for you to choose the chat.`;
      await loadResourceShares();
    } catch (error) {
      if (target) target.close();
      console.error(error); ui.resourceMessage.textContent = `The sheet was not recorded as sent. ${String(error?.message || "Please try again.")}`;
    }
  }
  function renderResourceLibrary() {
    if (!resourceLibraryReady) { ui.resourcePanel.hidden = true; return; }
    ui.resourcePanel.hidden = false;
    const active = clientResources.filter((resource) => resource.active);
    ui.resourceLibrary.innerHTML = "";
    active.forEach((resource) => {
      const card = document.createElement("article"); card.className = "client-resource-card";
      card.innerHTML = `<strong>${escapeHtml(resource.title)}</strong><small>${escapeHtml(resource.file_name)} · ${readableSize(resource.file_size)}</small>`;
      const actions = document.createElement("div"); actions.className = "client-resource-card-actions";
      const view = document.createElement("button"); view.type = "button"; view.className = "secondary-button"; view.textContent = "View"; view.addEventListener("click", () => viewResource(resource));
      const share = document.createElement("button"); share.type = "button"; share.textContent = "Share with selected client"; share.disabled = !ui.client.value; share.addEventListener("click", () => shareResource(resource));
      actions.append(view, share); card.append(actions); ui.resourceLibrary.append(card);
    });
    if (!active.length) ui.resourceLibrary.innerHTML = "<p>No information sheets uploaded yet.</p>";
  }
  function renderResourceHistory() {
    const clientId = ui.client.value;
    if (!clientId) { ui.resourceHistory.innerHTML = "<p>Choose a client to see their history.</p>"; return; }
    const items = resourceShares.filter((share) => share.client_id === clientId);
    ui.resourceHistory.innerHTML = items.map((share) => {
      const resource = clientResources.find((item) => item.id === share.resource_id);
      return `<article class="client-resource-history-item"><strong>${escapeHtml(resource?.title || "Resource")}</strong><small>Sent ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(share.shared_at))} · ${escapeHtml(share.sharing_method)}</small></article>`;
    }).join("") || "<p>No information sheets have been recorded as sent to this client yet.</p>";
  }
  async function loadResourceShares() {
    if (!resourceLibraryReady) return;
    const { data, error } = await db.from("client_resource_shares").select("id,client_id,resource_id,sharing_method,shared_at").order("shared_at", { ascending: false });
    resourceShares = error ? [] : (data || []); renderResourceHistory();
  }
  async function uploadResource(event) {
    event.preventDefault();
    const file = ui.resourceFile.files?.[0];
    if (!file) { ui.resourceMessage.textContent = "Choose the information-sheet file first."; return; }
    const title = ui.resourceTitle.value.trim() || String(file.name || "Information sheet").replace(/\.[^.]+$/, "");
    ui.resourceTitle.value = title;
    if (file.size > 15728640) { ui.resourceMessage.textContent = "Please choose a file smaller than 15 MB."; return; }
    const extension = String(file.name || "").toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || "";
    const mimeByExtension = {
      ".pdf": "application/pdf", ".doc": "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".rtf": "application/rtf", ".txt": "text/plain",
      ".pages": "application/vnd.apple.pages", ".png": "image/png",
      ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
    };
    const mimeType = mimeByExtension[extension];
    if (!mimeType) {
      ui.resourceMessage.textContent = "That file type is not supported. Please use PDF, Word, Pages, RTF, text, PNG, JPEG or WebP.";
      return;
    }
    const submit = ui.resourceUpload.querySelector("button[type='submit']");
    submit.disabled = true; submit.textContent = "Uploading…"; ui.resourceMessage.textContent = `Uploading ${file.name} securely…`;
    const path = `${admin.user.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    try {
      // Safari sometimes reports Word, Pages and RTF files as an unknown MIME
      // type. Rebuilding the upload body with the verified extension's type
      // keeps the storage request consistent across browsers.
      const uploadBody = new Blob([await file.arrayBuffer()], { type: mimeType });
      let { data: uploadedFile, error: uploadError } = await db.storage
        .from(resourceBucket)
        .upload(path, uploadBody, { contentType: mimeType, upsert: false });
      if (uploadError && ["401", "403"].includes(String(uploadError.statusCode || uploadError.status || ""))) {
        await db.auth.refreshSession();
        ({ data: uploadedFile, error: uploadError } = await db.storage
          .from(resourceBucket)
          .upload(path, uploadBody, { contentType: mimeType, upsert: false }));
      }
      if (uploadError) throw uploadError;
      if (!uploadedFile?.path) throw new Error("The storage service did not confirm the uploaded file.");
      submit.textContent = "Adding to library…";
      ui.resourceMessage.textContent = "File uploaded. Adding it to the information-sheet library…";
      const { error: rowError } = await db.from("client_resources").insert({ title, storage_path: path, file_name: file.name, mime_type: mimeType, file_size: file.size, created_by: admin.user.id });
      if (rowError) { await db.storage.from(resourceBucket).remove([path]); throw rowError; }
      ui.resourceUpload.reset(); ui.resourceMessage.textContent = `${title} is now in your reusable information-sheet library.`; await loadResources();
    } catch (error) {
      console.error(error); ui.resourceMessage.textContent = `The sheet could not be uploaded. ${String(error?.message || error?.error || "Please try again.")}`;
    } finally { submit.disabled = false; submit.textContent = "Upload sheet"; }
  }
  async function loadResources() {
    if (!resourceLibraryReady) return;
    const { data, error } = await db.from("client_resources").select("*").order("title");
    clientResources = error ? [] : (data || []); renderResourceLibrary(); renderResourceHistory();
  }

  function safeFileName(value) {
    return String(value || "image").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "image";
  }
  function escapeXml(value) { return String(value || "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"})[c]); }
  function svgLines(value, width = 34) {
    const rows = [];
    String(value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((line) => {
      const words = line.split(/\s+/).filter(Boolean); let row = "";
      words.forEach((word) => {
        const next = row ? `${row} ${word}` : word;
        if (next.length > width && row) { rows.push(row); row = `   ${word}`; }
        else row = next;
      });
      if (row) rows.push(row);
    });
    return rows.slice(0, 11);
  }
  function abcSvg(title, sections) {
    const cards = sections.map((section, index) => {
      const x = 54 + (index * 382); const lines = svgLines(section.text);
      return `<rect x="${x}" y="190" width="338" height="420" rx="28" fill="${section.fill}" stroke="${section.stroke}" stroke-width="4"/><circle cx="${x + 48}" cy="242" r="27" fill="${section.stroke}"/><text x="${x + 48}" y="252" text-anchor="middle" font-family="Arial, sans-serif" font-size="29" font-weight="700" fill="white">${section.letter}</text><text x="${x + 88}" y="250" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#4f1531">${escapeXml(section.heading)}</text>${lines.map((line, lineIndex) => `<text x="${x + 28}" y="${310 + lineIndex * 27}" font-family="Arial, sans-serif" font-size="19" fill="#5f4550">${escapeXml(line)}</text>`).join("")}`;
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
      const missing = "Not clearly stated in the note.";
      const beliefs = data.abc.beliefs;
      const consequences = data.abc.consequences;
      ui.abcA.value = data.abc.activatingEvent || missing;
      ui.abcB.value = beliefs && typeof beliefs === "object"
        ? [
            `1. Demand: ${beliefs.demands || missing}`,
            `2. Catastrophising: ${beliefs.catastrophising || missing}`,
            `3. I can’t cope / low frustration tolerance: ${beliefs.lowFrustrationTolerance || missing}`,
            `4. Self, life or other rating: ${beliefs.selfLifeOtherRating || missing}`,
          ].join("\n")
        : String(beliefs || missing);
      ui.abcC.value = consequences && typeof consequences === "object"
        ? `Emotions: ${consequences.emotions || missing}\nBehaviours: ${consequences.behaviours || missing}`
        : String(consequences || missing);
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
  async function downloadNoteImage(item) {
    ui.message.textContent = "Preparing image download…";
    try {
      const blob = item.file || await fetch(item.previewUrl).then((response) => {
        if (!response.ok) throw new Error("The secure image could not be opened.");
        return response.blob();
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = safeFileName(item.file_name || `${item.caption || "note-image"}.png`);
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      ui.message.textContent = `${item.file_name || "Image"} downloaded.`;
    } catch (error) {
      console.error(error);
      ui.message.textContent = "The image could not be downloaded. Please try again.";
    }
  }
  async function renderImages() {
    if (!imageFieldsReady) return;
    const saved = await Promise.all(noteImages.map(async (item) => ({ ...item, previewUrl: await signedImageUrl(item.storage_path) })));
    const all = [...saved.map((item) => ({ ...item, saved: true })), ...stagedImages.map((item) => ({ ...item, saved: false }))];
    if (!all.length) { ui.imageList.innerHTML = "<p>No images added to this note.</p>"; return; }
    ui.imageList.innerHTML = all.map((item, index) => `<figure class="note-image-card" data-image-index="${index}" data-image-saved="${item.saved}"><img src="${escapeHtml(item.previewUrl)}" alt="${escapeHtml(item.caption || item.file_name || "Note image")}" /><figcaption><input class="note-image-caption" type="text" value="${escapeHtml(item.caption || "")}" placeholder="Caption, for example: ABC explored in session" /><button class="secondary-button note-image-download" type="button">Download image</button><button class="secondary-button note-image-remove" type="button">Remove</button></figcaption></figure>`).join("");
    ui.imageList.querySelectorAll(".note-image-card").forEach((card) => {
      const index = Number(card.dataset.imageIndex); const savedItem = card.dataset.imageSaved === "true";
      card.querySelector(".note-image-download").addEventListener("click", () => downloadNoteImage(all[index]));
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
    ui.save.textContent = "Save unfinished draft"; ui.message.textContent = "";
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
    if (status === "Final" && !confirm("Save this as the completed note? The original working notes and any earlier wording will remain safely available in its history.")) return;
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
      ui.message.textContent = status === "Final" ? "Completed note saved securely." : "Unfinished draft saved securely.";
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
    } finally { ui.improve.disabled = false; ui.improve.textContent = "Improve with AI"; }
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
    ui.save.textContent = "Update unfinished draft";
    const final = note.status === "Final";
    ui.message.classList.remove("note-save-error");
    ui.message.textContent = final ? "Completed note opened. The improved wording is your main record; the original working notes remain available above." : "Unfinished draft loaded.";
    revokeStagedUrls(); stagedImages = []; await loadImages(note.id);
  }
  async function openNote(note) {
    await loadIntoForm(note);
    renderClientReference();
    ui.message.textContent = `${statusLabel(note.status)} opened. You can read the improved note below or make changes and save again.`;
    document.querySelector("#client-notes-panel").scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => (note.status === "Final" ? ui.final : ui.rough).focus({ preventScroll: true }), 450);
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
    ui.historyList.innerHTML = versions.length ? versions.map((version) => { const details = version.structured_details || {}; const extras = [...(details.interventions || []).map((item) => `Intervention: ${item}`), ...(details.resources_shared || []).map((item) => `Resource: ${item}`), ...(details.supervision_question ? [`Supervision: ${details.supervision_question} (${details.supervision_status || ""})`] : [])]; return `<article class="note-version"><strong>Version ${version.version_number} · ${escapeHtml(statusLabel(version.status))}</strong><small>${new Date(version.changed_at).toLocaleString("en-GB")}</small><pre>${escapeHtml(version.final_note || version.rough_note)}</pre>${extras.length ? `<ul>${extras.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}</article>`; }).join("") : "No earlier versions yet.";
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
      item.innerHTML = `<span><strong>${escapeHtml(clientName)}</strong><small>${formatDate(note.note_date)} · ${escapeHtml(note.note_type)} · <b>${escapeHtml(statusLabel(note.status))}</b>${escapeHtml(clientStatus)}${note.archived_at ? " · Archived" : ""}${note.ai_assisted ? " · AI assisted" : ""}${note.supervision_status === "Outstanding" ? " · Supervision flagged" : ""}</small>${tags.length ? `<small>${escapeHtml(tags.join(" · "))}</small>` : ""}</span>`;
      const actions = document.createElement("span"); actions.className = "settings-list-actions";
      const finalAction = note.archived_at ? ["Restore", () => restore(note)] : ["Archive", () => archive(note)];
      [["Open note", () => openNote(note)], ["History", () => showHistory(note)], finalAction].forEach(([label, handler]) => { const button = document.createElement("button"); button.type = "button"; button.textContent = label; if (label === "Archive" || label === "Restore") button.className = "secondary-button"; button.addEventListener("click", handler); actions.append(button); });
      item.append(actions); ui.list.append(item);
    });
    if (!visible.length) ui.list.innerHTML = "<li>No secure notes have been saved for this selection.</li>";
    renderClientReference();
  }
  function renderPreviousNotes() {
    const clientId = ui.client.value;
    if (!clientId) { ui.previousNotes.innerHTML = "<p>Choose a client to see their earlier notes.</p>"; return; }
    const previous = notes
      .filter((note) => note.client_id === clientId && note.id !== activeId)
      .sort((a, b) => String(b.note_date || "").localeCompare(String(a.note_date || "")) || String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
    ui.previousNotes.innerHTML = "";
    previous.forEach((note) => {
      const article = document.createElement("article");
      article.className = "previous-client-note-card";
      if (note.archived_at) article.classList.add("is-archived");
      const heading = document.createElement("header");
      heading.innerHTML = `<span><strong>${formatDate(note.note_date)}</strong><small>${escapeHtml(note.note_type)} · ${escapeHtml(statusLabel(note.status))}${note.archived_at ? " · Archived" : ""}</small></span>`;
      const openButton = document.createElement("button");
      openButton.type = "button"; openButton.className = "secondary-button"; openButton.textContent = "Open";
      openButton.addEventListener("click", () => openNote(note)); heading.append(openButton);
      const content = document.createElement("div");
      content.className = "previous-client-note-text";
      content.textContent = note.final_note || note.rough_note || "No note wording recorded.";
      article.append(heading, content); ui.previousNotes.append(article);
    });
    if (!previous.length) ui.previousNotes.innerHTML = "<p>No earlier notes have been saved for this client yet.</p>";
  }
  function renderClientReference() {
    renderPreviousNotes();
    renderWorkOverview();
    renderResourceLibrary();
    renderResourceHistory();
    loadIntakeReference();
    loadImpactReference();
  }
  function renderWorkOverview() {
    const clientId = ui.client.value;
    if (!clientId) { ui.workOverview.innerHTML = "<p>No client selected.</p>"; return; }
    const clientNotes = notes.filter((note) => note.client_id === clientId && !note.archived_at).sort((a, b) => String(b.note_date).localeCompare(String(a.note_date)));
    const renderItems = (field, empty) => {
      const items = clientNotes.flatMap((note) => (note[field] || []).map((text) => ({ text, date: note.note_date })));
      return items.length ? `<ul>${items.map((item) => `<li><strong>${escapeHtml(item.text)}</strong><small>${formatDate(item.date)}</small></li>`).join("")}</ul>` : `<p>${empty}</p>`;
    };
    ui.workOverview.innerHTML = `<section><h4>Strategies and interventions used</h4>${renderItems("interventions", "None recorded yet.")}</section><section><h4>Documents, diagrams and resources sent</h4>${renderItems("resources_shared", "None recorded yet.")}</section>`;
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
    const resourceCapability = await db.from("client_resources").select("id").limit(1);
    resourceLibraryReady = !resourceCapability.error;
    document.querySelector(".note-structured-fields").hidden = !structuredFieldsReady;
    document.querySelector(".note-supervision-fields").hidden = !structuredFieldsReady;
    ui.imageFields.hidden = !imageFieldsReady;
    const { data, error } = await db.from("clients").select("id,first_name,surname,second_first_name,second_surname,status").order("first_name");
    if (error) { ui.message.textContent = "Clients could not be loaded."; return; }
    clients = data || []; setOptions(ui.client, false); setOptions(ui.filter, true); clearForm(); await Promise.all([loadNotes(), loadResources(), loadResourceShares()]);
    if (!structuredFieldsReady) ui.message.textContent = "Your existing notes are working. The new interventions and supervision fields still need the one-time Supabase update.";
    else if (!imageFieldsReady) ui.message.textContent = "Your notes are working. Images and diagrams need the one-time Supabase attachment update before they appear.";
    if (!resourceLibraryReady) ui.resourcePanel.hidden = true;
    const requestedId = new URLSearchParams(window.location.search).get("note");
    const requestedNote = notes.find((note) => note.id === requestedId);
    if (requestedNote) openNote(requestedNote);
  }
  ui.improve.addEventListener("click", improve); ui.save.addEventListener("click", () => save("Draft")); ui.finalise.addEventListener("click", () => save("Final"));
  ui.clear.addEventListener("click", clearForm); ui.filter.addEventListener("change", render); ui.showArchived.addEventListener("change", render);
  ui.client.addEventListener("change", renderClientReference);
  ui.intakeButton.addEventListener("click", () => {
    const opening = ui.intakeAnswers.hidden;
    ui.intakeAnswers.hidden = !opening;
    ui.intakeButton.textContent = opening ? "Hide intake form" : "View intake form";
  });
  ui.impactButton.addEventListener("click", () => {
    const opening = ui.impactAnswers.hidden;
    ui.impactAnswers.hidden = !opening;
    ui.impactButton.textContent = opening ? "Hide Impact Statement" : "View Impact Statement";
  });
  ui.resourceUpload.addEventListener("submit", uploadResource);
  ui.resourceFile.addEventListener("change", () => {
    const file = ui.resourceFile.files?.[0];
    if (!file) return;
    ui.resourceMessage.textContent = `${file.name} is ready. Select “Upload sheet” to add it securely.`;
    if (!ui.resourceTitle.value.trim()) {
      ui.resourceTitle.value = String(file.name || "Information sheet").replace(/\.[^.]+$/, "");
    }
    ui.resourceMessage.textContent = `${file.name} selected. Choose Upload sheet to add it to the library.`;
  });
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
