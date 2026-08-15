(async function setupInvoice() {
  const admin = await window.ADMIN_READY;
  const client = admin.client;
  const invoiceId = new URLSearchParams(window.location.search).get("id");
  const loading = document.querySelector("#invoice-loading");
  const errorMessage = document.querySelector("#invoice-error");

  function setText(id, value) {
    document.querySelector(id).textContent = value || "—";
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" })
      .format(new Date(`${value}T12:00:00`));
  }

  function formatMoney(value) {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(value));
  }

  function invoiceSessionDates(invoice) {
    const itemMarker = String(invoice.description || "").match(/\[\[ITEMS:([^\]]+)\]\]/i);
    if (itemMarker) {
      try {
        const items = JSON.parse(decodeURIComponent(itemMarker[1]));
        const dates = items.map((item) => item.date).filter(Boolean);
        if (dates.length) return dates;
      } catch (error) {
        console.error("Could not read itemised invoice sessions.", error);
      }
    }
    const marker = String(invoice.description || "").match(/\[\[DATES:([^\]]+)\]\]/i);
    return marker
      ? marker[1].split(",").map((date) => date.trim()).filter(Boolean)
      : [invoice.session_date];
  }

  function cleanInvoiceDescription(value) {
    return String(value || "")
      .replace(/\s*\[\[(?:DATES|ITEMS):[^\]]+\]\]\s*/gi, " ")
      .trim();
  }

  function invoiceLineItems(invoice) {
    const defaultFormat = /^in person/i.test(cleanInvoiceDescription(invoice.description))
      ? "In person"
      : "Online";
    const marker = String(invoice.description || "").match(/\[\[ITEMS:([^\]]+)\]\]/i);
    if (marker) {
      try {
        const savedItems = JSON.parse(decodeURIComponent(marker[1]));
        if (Array.isArray(savedItems) && savedItems.length) {
          return savedItems.map((item) => ({
            date: String(item.date || invoice.session_date),
            type: item.type === "Joint session" ? "Joint session" : "Individual session",
            format: item.format === "In person"
              ? "In person"
              : item.format === "Online"
                ? "Online"
                : defaultFormat,
            fee: Number(item.fee || 0),
            itemised: true,
          }));
        }
      } catch (error) {
        console.error("Could not read itemised invoice sessions.", error);
      }
    }
    const dates = invoiceSessionDates(invoice);
    const count = Math.max(1, dates.length, Number(invoice.session_count || 1));
    const type = /joint|couple/i.test(cleanInvoiceDescription(invoice.description))
      ? "Joint session"
      : "Individual session";
    const format = defaultFormat;
    const fee = Number(invoice.amount || 0) / count;
    return Array.from({ length: count }, (_, index) => ({
      date: dates[index] || dates.at(-1) || invoice.session_date,
      type,
      format,
      fee,
      itemised: false,
    }));
  }

  function parseEnteredDates(value) {
    return String(value).split(",").map((entry) => {
      const text = entry.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
      const match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
      return match
        ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`
        : "";
    }).filter(Boolean);
  }

  if (!invoiceId) {
    loading.hidden = true;
    errorMessage.hidden = false;
    errorMessage.textContent = "No invoice was selected.";
    return;
  }

  const [invoiceResult, profileResult, bankResult] = await Promise.all([
    client.from("invoices").select("*").eq("id", invoiceId).maybeSingle(),
    client.from("invoice_profile").select("*").eq("profile_key", "default").maybeSingle(),
    client.rpc("get_invoice_bank_details"),
  ]);
  if (invoiceResult.error || profileResult.error || !invoiceResult.data) {
    loading.hidden = true;
    errorMessage.hidden = false;
    errorMessage.textContent = "This invoice could not be loaded.";
    console.error(invoiceResult.error || profileResult.error);
    return;
  }

  const invoice = invoiceResult.data;
  const profile = profileResult.data;
  const bank = bankResult.data?.[0] || {};
  setText("#invoice-issuer", profile.issuer_name);
  setText("#invoice-address", [profile.address_line_1, profile.address_line_2, profile.city_postcode].filter(Boolean).join("\n"));
  setText("#invoice-client", invoice.client_name);
  setText("#invoice-client-contact", invoice.client_email || "");
  setText("#invoice-number", invoice.invoice_number);
  setText("#invoice-date", formatDate(invoice.invoice_date));
  setText("#invoice-due", formatDate(invoice.due_date));
  const sessionDates = invoiceSessionDates(invoice);
  const lineItems = invoiceLineItems(invoice);
  const durationText = invoice.session_duration
    ? `${String(invoice.session_duration).replace(/\s*minutes?$/i, "")}-minute `
    : "";
  const sessionDescription = `${durationText}${cleanInvoiceDescription(invoice.description)}`
    .replace(/\bsession\s+session\b/i, "session");
  const itemsBody = document.querySelector("#invoice-items-body");
  const originalRow = document.querySelector("#invoice-session-row");
  const extraRow = document.querySelector("#invoice-extra-row");
  originalRow.remove();
  lineItems.forEach((item) => {
      const row = document.createElement("tr");
      const descriptionCell = document.createElement("td");
      const description = document.createElement("strong");
      const date = document.createElement("small");
      description.textContent = item.itemised
        ? `${item.type === "Joint session" ? "80-minute " : "50-minute "}${item.format} ${item.type.toLowerCase()}`
        : sessionDescription;
      date.textContent = `Session date: ${formatDate(item.date)}`;
      descriptionCell.append(description, date);
      const quantityCell = document.createElement("td");
      quantityCell.textContent = "1 session";
      const amountCell = document.createElement("td");
      amountCell.textContent = formatMoney(item.fee);
      row.append(descriptionCell, quantityCell, amountCell);
      itemsBody.insertBefore(row, extraRow);
    });
  const extraMinutes = Number(invoice.extra_minutes || 0);
  const extraAmount = Number(invoice.extra_amount || 0);
  if (extraMinutes > 0 && extraAmount > 0) {
    setText("#invoice-extra-description", `Additional ${extraMinutes} minutes`);
    setText("#invoice-extra-amount", formatMoney(extraAmount));
    document.querySelector("#invoice-extra-row").hidden = false;
  }
  setText("#invoice-total", formatMoney(Number(invoice.amount) + extraAmount));
  setText("#invoice-account-name", bank.account_name || "Add securely in Settings");
  setText("#invoice-sort-code", bank.sort_code || "Add securely in Settings");
  setText("#invoice-account-number", bank.account_number || "Add securely in Settings");
  setText("#invoice-reference", invoice.invoice_number);
  document.title = `${formatDate(sessionDates[0])} · Invoice · ${invoice.client_name}`;
  loading.hidden = true;
  document.querySelector("#invoice-document").hidden = false;

  const safeFilePart = (value) => String(value || "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  const invoiceFilename = [
    safeFilePart(formatDate(sessionDates[0])),
    "Invoice",
    safeFilePart(invoice.client_name),
  ].filter(Boolean).join(" - ");
  const invoiceDocument = document.querySelector("#invoice-document");
  const pdfOptions = {
    margin: 0,
    filename: `${invoiceFilename}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["css", "legacy"] },
  };

  async function createInvoicePdfBlob() {
    invoiceDocument.classList.add("is-pdf-export");
    try {
      return await window.html2pdf()
        .set(pdfOptions)
        .from(invoiceDocument)
        .toPdf()
        .outputPdf("blob");
    } finally {
      invoiceDocument.classList.remove("is-pdf-export");
    }
  }

  const downloadButton = document.querySelector("#invoice-download");
  downloadButton.addEventListener("click", async () => {
    if (typeof window.html2pdf !== "function") {
      document.querySelector("#invoice-page-message").textContent =
        "The PDF download tool could not load. Please check your internet connection and try again.";
      return;
    }

    downloadButton.disabled = true;
    downloadButton.textContent = "Preparing PDF…";
    try {
      invoiceDocument.classList.add("is-pdf-export");
      await window.html2pdf()
        .set(pdfOptions)
        .from(invoiceDocument)
        .save();
    } catch (error) {
      console.error(error);
      document.querySelector("#invoice-page-message").textContent =
        "The PDF could not be downloaded. Please try again.";
    } finally {
      invoiceDocument.classList.remove("is-pdf-export");
      downloadButton.disabled = false;
      downloadButton.textContent = "Download PDF";
    }
  });
  const whatsappButton = document.querySelector("#invoice-whatsapp");
  whatsappButton.addEventListener("click", async () => {
    const message = `Hello, your invoice ${invoice.invoice_number} for ${formatMoney(Number(invoice.amount) + extraAmount)} is ready. Please use ${invoice.invoice_number} as the payment reference.`;
    if (typeof window.html2pdf !== "function") {
      document.querySelector("#invoice-page-message").textContent =
        "The PDF sharing tool could not load. Please refresh the page and try again.";
      return;
    }
    whatsappButton.disabled = true;
    whatsappButton.textContent = "Preparing PDF…";
    try {
      const blob = await createInvoicePdfBlob();
      const file = new File([blob], `${invoiceFilename}.pdf`, { type: "application/pdf" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Invoice ${invoice.invoice_number}`,
          text: message,
        });
      } else {
        const downloadLink = document.createElement("a");
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = file.name;
        downloadLink.click();
        setTimeout(() => URL.revokeObjectURL(downloadLink.href), 1000);
        window.location.assign(`https://wa.me/?text=${encodeURIComponent(message)}`);
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error(error);
        document.querySelector("#invoice-page-message").textContent =
          "The invoice could not be shared. Please use Download PDF instead.";
      }
    } finally {
      whatsappButton.disabled = false;
      whatsappButton.textContent = "Share PDF to WhatsApp";
    }
  });
  const markSent = document.querySelector("#invoice-mark-sent");
  if (invoice.status === "Sent" || invoice.status === "Paid") {
    markSent.textContent = invoice.status;
    markSent.disabled = true;
  }
  markSent.addEventListener("click", async () => {
    markSent.disabled = true;
    const { error } = await client.from("invoices").update({ status: "Sent" }).eq("id", invoice.id);
    if (error) {
      markSent.disabled = false;
      document.querySelector("#invoice-page-message").textContent = "The invoice status could not be updated.";
      return;
    }
    markSent.textContent = "Sent";
    document.querySelector("#invoice-page-message").textContent = "Invoice marked as sent.";
  });

  const detailsEditor = document.querySelector("#invoice-details-editor");
  const editDetailsButton = document.querySelector("#invoice-edit-details");
  const editSessionLines = document.querySelector("#invoice-edit-session-lines");

  function addInvoiceEditorLine(item = {}) {
    const row = document.createElement("div");
    row.className = "invoice-edit-session-line";
    const dateLabel = document.createElement("label");
    dateLabel.textContent = "Session date";
    const dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.required = true;
    dateInput.value = item.date || sessionDates[0] || invoice.session_date;
    dateLabel.append(dateInput);
    const typeLabel = document.createElement("label");
    typeLabel.textContent = "Session type";
    const typeSelect = document.createElement("select");
    typeSelect.required = true;
    ["Joint session", "Individual session"].forEach((type) => {
      typeSelect.add(new Option(type, type));
    });
    typeSelect.value = item.type || "Joint session";
    typeLabel.append(typeSelect);
    const formatLabel = document.createElement("label");
    formatLabel.textContent = "Format";
    const formatSelect = document.createElement("select");
    formatSelect.required = true;
    ["Online", "In person"].forEach((format) => {
      formatSelect.add(new Option(format, format));
    });
    formatSelect.value = item.format || "Online";
    formatLabel.append(formatSelect);
    const feeLabel = document.createElement("label");
    feeLabel.textContent = "Fee (£)";
    const feeInput = document.createElement("input");
    feeInput.type = "number";
    feeInput.min = "0";
    feeInput.step = "0.01";
    feeInput.required = true;
    feeInput.value = Number(item.fee ?? 0).toFixed(2);
    feeLabel.append(feeInput);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "payment-delete-button invoice-remove-session-line";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      if (editSessionLines.children.length > 1) row.remove();
    });
    row.append(dateLabel, typeLabel, formatLabel, feeLabel, remove);
    editSessionLines.append(row);
  }

  lineItems.forEach(addInvoiceEditorLine);
  document.querySelector("#invoice-add-session-line").addEventListener("click", () => {
    addInvoiceEditorLine({
      date: editSessionLines.lastElementChild?.querySelector("input[type='date']")?.value || sessionDates[0],
      type: "Joint session",
      format: "Online",
      fee: 0,
    });
  });
  editDetailsButton.addEventListener("click", () => {
    detailsEditor.hidden = false;
    editSessionLines.querySelector("input")?.focus();
  });
  document.querySelector("#invoice-cancel-edit").addEventListener("click", () => {
    detailsEditor.hidden = true;
  });
  detailsEditor.addEventListener("submit", async (event) => {
    event.preventDefault();
    const enteredItems = Array.from(editSessionLines.querySelectorAll(".invoice-edit-session-line"))
      .map((row) => ({
        date: row.querySelector("input[type='date']").value,
        type: row.querySelectorAll("select")[0].value,
        format: row.querySelectorAll("select")[1].value,
        fee: Number(row.querySelector("input[type='number']").value),
      }));
    if (!enteredItems.length || enteredItems.some((item) => !item.date || !Number.isFinite(item.fee))) {
      document.querySelector("#invoice-edit-message").textContent =
        "Complete the date, type and fee for every session.";
      return;
    }
    const enteredDates = enteredItems.map((item) => item.date);
    const sessionDate = enteredDates[0];
    const sessionCount = enteredItems.length;
    const amount = enteredItems.reduce((sum, item) => sum + item.fee, 0);
    const submit = detailsEditor.querySelector("button[type='submit']");
    submit.disabled = true;
    const itemMarker = encodeURIComponent(JSON.stringify(enteredItems));
    const description = `Mixed-format joint and individual sessions ` +
      `[[ITEMS:${itemMarker}]] [[DATES:${enteredDates.join(",")}]]`;
    const { error } = await client.from("invoices").update({
      session_date: sessionDate,
      session_count: sessionCount,
      amount,
      description,
      session_duration: null,
      payment_reference: invoice.invoice_number,
      status: "Draft",
    }).eq("id", invoice.id);
    if (error) {
      submit.disabled = false;
      document.querySelector("#invoice-edit-message").textContent =
        "The invoice details could not be saved.";
      return;
    }
    await client.from("manual_payments").update({
      session_date: sessionDate,
      fee_due: amount + extraAmount,
    }).eq("source_reference", `invoice:${invoice.id}`);
    window.location.reload();
  });

  const extraForm = document.querySelector("#invoice-extra-form");
  extraForm.elements.extraMinutes.value = extraMinutes || 30;
  extraForm.elements.extraAmount.value = extraAmount || "";
  extraForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(extraForm);
    const minutes = Number(formData.get("extraMinutes"));
    const amount = Number(formData.get("extraAmount"));
    const submit = extraForm.querySelector("button[type='submit']");
    submit.disabled = true;
    const { error } = await client
      .from("invoices")
      .update({ extra_minutes: minutes, extra_amount: amount, status: "Draft" })
      .eq("id", invoice.id);
    if (error) {
      submit.disabled = false;
      document.querySelector("#invoice-extra-message").textContent = "The extra time could not be saved.";
      return;
    }
    window.location.reload();
  });
})();
