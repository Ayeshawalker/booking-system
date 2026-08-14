(async function setupSupervisionPreparation() {
  const admin = await window.ADMIN_READY;
  const db = admin.client;
  const ui = {
    filter: document.querySelector("#supervision-filter"),
    list: document.querySelector("#supervision-list"),
    message: document.querySelector("#supervision-message"),
    print: document.querySelector("#print-supervision"),
  };
  let clients = [];
  let items = [];
  const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[c]);
  const clientName = (client) => [[client?.first_name, client?.surname].filter(Boolean).join(" "), [client?.second_first_name, client?.second_surname].filter(Boolean).join(" ")].filter(Boolean).join(" and ") || "Client";
  const formatDate = (date) => date ? new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(new Date(`${date}T12:00:00`)) : "Date not recorded";

  function render() {
    const filter = ui.filter.value;
    const visible = items.filter((item) => filter === "all" || item.supervision_status.toLowerCase() === filter);
    ui.list.innerHTML = visible.length ? visible.map((item) => {
      const client = clients.find((entry) => entry.id === item.client_id);
      return `<article class="supervision-item" data-id="${item.id}"><header><div><h2>${escapeHtml(clientName(client))}</h2><p>${formatDate(item.note_date)} · ${escapeHtml(item.note_type)}</p></div><span class="supervision-status ${item.supervision_status === "Discussed" ? "is-discussed" : ""}">${escapeHtml(item.supervision_status)}</span></header><p class="supervision-question">${escapeHtml(item.supervision_question)}</p>${item.supervision_status === "Discussed" ? `<small>Discussed ${item.supervision_discussed_at ? new Date(item.supervision_discussed_at).toLocaleDateString("en-GB") : ""}</small>` : `<div class="supervision-item-actions no-print"><button type="button" data-action="discussed">Mark as discussed</button><button class="secondary-button" type="button" data-action="open">Open note</button></div>`}</article>`;
    }).join("") : "<p class=\"supervision-empty\">There are no supervision items in this view.</p>";
  }

  async function load() {
    ui.message.textContent = "Loading supervision reminders…";
    const [clientResult, noteResult] = await Promise.all([
      db.from("clients").select("id,first_name,surname,second_first_name,second_surname"),
      db.from("clinical_notes").select("id,client_id,note_date,note_type,supervision_question,supervision_status,supervision_discussed_at").eq("supervision_required", true).is("archived_at", null).order("note_date", { ascending: false }),
    ]);
    if (clientResult.error || noteResult.error) { ui.message.textContent = "The supervision list could not be loaded. Run the latest Supabase notes update first."; return; }
    clients = clientResult.data || []; items = noteResult.data || []; ui.message.textContent = ""; render();
  }

  ui.filter.addEventListener("change", render);
  ui.print.addEventListener("click", () => window.print());
  ui.list.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]"); if (!button) return;
    const item = button.closest("[data-id]"); const id = item?.dataset.id; if (!id) return;
    if (button.dataset.action === "open") { window.location.href = `notes.html?note=${encodeURIComponent(id)}`; return; }
    button.disabled = true;
    const { error } = await db.from("clinical_notes").update({ supervision_status: "Discussed", supervision_discussed_at: new Date().toISOString(), updated_by: admin.user.id }).eq("id", id);
    if (error) { ui.message.textContent = "This item could not be marked as discussed."; button.disabled = false; return; }
    await load();
  });
  await load();
})();
