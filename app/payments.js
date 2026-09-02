(async function setupPaymentsPage() {
  const admin = await window.ADMIN_READY;
  const supabaseClient = admin.client;
  const controls = {
    addButton: document.querySelector("#add-payment"),
    periodFilter: document.querySelector("#payment-period-filter"),
    customDates: document.querySelector("#payment-custom-dates"),
    dateFrom: document.querySelector("#payment-date-from"),
    dateTo: document.querySelector("#payment-date-to"),
    search: document.querySelector("#payment-search"),
    statusFilter: document.querySelector("#payment-status-filter"),
    loading: document.querySelector("#payments-loading"),
    empty: document.querySelector("#payments-empty"),
    clientTableWrap: document.querySelector("#payment-client-table-wrap"),
    clientTableBody: document.querySelector("#payment-client-table-body"),
    historyPanel: document.querySelector("#payment-history-panel"),
    historyTitle: document.querySelector("#payment-history-title"),
    closeHistory: document.querySelector("#close-payment-history"),
    createHistoryInvoice: document.querySelector("#create-history-invoice"),
    tableWrap: document.querySelector("#payments-table-wrap"),
    tableBody: document.querySelector("#payments-table-body"),
    message: document.querySelector("#payments-message"),
    feeTotal: document.querySelector("#payments-fees-total"),
    receivedTotal: document.querySelector("#payments-received-total"),
    outstandingTotal: document.querySelector("#payments-outstanding-total"),
    creditTotal: document.querySelector("#payments-credit-total"),
    unpaidCount: document.querySelector("#payments-unpaid-count"),
    sentUnpaidSummary: document.querySelector("#sent-unpaid-summary"),
    sentUnpaidEmpty: document.querySelector("#sent-unpaid-empty"),
    sentUnpaidTableWrap: document.querySelector("#sent-unpaid-table-wrap"),
    sentUnpaidTableBody: document.querySelector("#sent-unpaid-table-body"),
    invoicesEmpty: document.querySelector("#invoices-empty"),
    invoicePeriodFilter: document.querySelector("#invoice-period-filter"),
    invoiceCustomDates: document.querySelector("#invoice-custom-dates"),
    invoiceDateFrom: document.querySelector("#invoice-date-from"),
    invoiceDateTo: document.querySelector("#invoice-date-to"),
    invoicesTableWrap: document.querySelector("#invoices-table-wrap"),
    invoicesTableBody: document.querySelector("#invoices-table-body"),
    sentInvoicesArchive: document.querySelector("#sent-invoices-archive"),
    sentInvoicesTableBody: document.querySelector("#sent-invoices-table-body"),
    dialog: document.querySelector("#payment-dialog"),
    dialogTitle: document.querySelector("#payment-dialog-title"),
    form: document.querySelector("#payment-form"),
    clientSelect: document.querySelector("#payment-client"),
    formMessage: document.querySelector("#payment-form-message"),
    saveButton: document.querySelector("#save-payment"),
  };
  let payments = [];
  let clients = [];
  let bookingRequests = [];
  let invoices = [];
  let editingId = null;
  let historyClient = null;
  let sentInvoiceOutstandingTotal = 0;
  let sentInvoiceUnpaidCount = 0;
  const selectedInvoicePaymentIds = new Set();

  function isoDate(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function clientName(client) {
    const first = [client.first_name, client.surname].filter(Boolean).join(" ").trim();
    const second = [client.second_first_name, client.second_surname]
      .filter(Boolean).join(" ").trim();
    return [first, second].filter(Boolean).join(" and ");
  }

  function normalisedName(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  async function importCompletedSessionsFor3To7August2026() {
    const schedule = [
      { date: "2026-08-03", time: "10:30", match: ["annabel"], format: "Not recorded" },
      { date: "2026-08-04", time: "09:00", match: ["natalie"], format: "Online" },
      { date: "2026-08-04", time: "10:30", match: ["emma", "piers"], format: "Online" },
      { date: "2026-08-04", time: "12:05", match: ["chris"], format: "Online" },
      { date: "2026-08-04", time: "14:00", match: ["steve"], recordType: "Individual", format: "Online" },
      { date: "2026-08-04", time: "15:30", match: ["judith"], format: "Online" },
      { date: "2026-08-05", time: "08:00", match: ["jacci"], format: "Online" },
      { date: "2026-08-05", time: "09:15", match: ["mary"], format: "Online" },
      { date: "2026-08-05", time: "10:30", match: ["chloe"], format: "Online" },
      { date: "2026-08-05", time: "11:45", match: ["george"], format: "Online" },
      { date: "2026-08-05", time: "15:00", match: ["ryan"], format: "Online", feeMultiplier: 1.5, minutes: 90 },
      { date: "2026-08-06", time: "16:00", match: ["daisy", "seymour"], format: "Online" },
      { date: "2026-08-06", time: "17:00", match: ["daisy", "faye"], format: "Online" },
      { date: "2026-08-06", time: "20:30", match: ["charlie"], format: "Online" },
      { date: "2026-08-07", time: "10:00", match: ["lucy"], format: "Online" },
      { date: "2026-08-07", time: "14:00", match: ["ellie", "william"], format: "Online" },
      { date: "2026-08-07", time: "16:00", match: ["russell"], format: "Online" },
    ];
    const added = [];
    const notMatched = [];

    for (const session of schedule) {
      const client = clients.find((item) => {
        const name = normalisedName(clientName(item));
        return session.match.every((part) => name.includes(part)) &&
          (!session.recordType || item.record_type === session.recordType);
      });
      if (!client) {
        notMatched.push(session.match.join(" and "));
        continue;
      }

      const alreadyRecorded = payments.some((payment) =>
        payment.session_date === session.date &&
        ((client._relatedClientIds || [client.id]).includes(payment.client_id) ||
          normalisedName(payment.client_name) === normalisedName(clientName(client)))
      );
      if (alreadyRecorded) continue;

      const preferredFee = session.format === "Online"
        ? client.agreed_online_fee_gbp
        : session.format === "In person"
          ? client.agreed_in_person_fee_gbp
          : null;
      const baseFee = preferredFee ?? client.agreed_session_fee_gbp ??
        client.agreed_online_fee_gbp ?? client.agreed_in_person_fee_gbp ?? 0;
      const payload = {
        client_id: client.id,
        client_name: clientName(client),
        session_date: session.date,
        session_type: client.record_type === "Couple" ? "Couple" : "Individual",
        session_format: session.format,
        fee_due: Number(baseFee) * Number(session.feeMultiplier || 1),
        amount_received: 0,
        invoice_sent_date: null,
        payment_date: null,
        notes: [
          `Completed at ${session.time}.`,
          session.minutes ? `${session.minutes}-minute session.` : "",
          session.format === "Not recorded" ? "Session format not recorded in the diary." : "",
        ].filter(Boolean).join(" "),
        source: "Manual",
        source_reference: `schedule-2026-08-${session.date}-${session.time}-${client.id}`,
      };
      const { data, error } = await supabaseClient
        .from("manual_payments")
        .insert(payload)
        .select("*")
        .single();
      if (!error && data) {
        payments.push(data);
        added.push(data);
      } else if (error?.code !== "23505") {
        console.error("A completed session could not be imported.", error);
      }
    }

    if (added.length > 0) {
      controls.message.textContent = `Added ${added.length} completed sessions from 3–7 August 2026.`;
    }
    if (notMatched.length > 0) {
      console.warn("These diary names could not be matched to clients:", notMatched);
    }
  }

  async function importConfirmedSessionsFor10To14August2026() {
    const schedule = [
      { date: "2026-08-10", time: "12:00", match: ["chloe"] },
      { date: "2026-08-11", time: "10:30", match: ["judith"] },
      { date: "2026-08-12", time: "08:00", match: ["jacci"] },
      { date: "2026-08-12", time: "09:30", match: ["lucy"] },
      { date: "2026-08-13", time: "10:00", match: ["ryan"] },
      { date: "2026-08-14", time: "10:00", match: ["emma", "piers"] },
    ];
    const added = [];

    for (const session of schedule) {
      const client = clients.find((item) => {
        const name = normalisedName(clientName(item));
        return session.match.every((part) => name.includes(part));
      });
      if (!client) {
        console.warn("Confirmed diary client could not be matched:", session.match);
        continue;
      }

      const alreadyRecorded = payments.some((payment) =>
        payment.session_date === session.date &&
        ((client._relatedClientIds || [client.id]).includes(payment.client_id) ||
          normalisedName(payment.client_name) === normalisedName(clientName(client)))
      );
      if (alreadyRecorded) continue;

      const fee = client.agreed_online_fee_gbp ??
        client.agreed_session_fee_gbp ?? client.agreed_in_person_fee_gbp ?? 0;
      const payload = {
        client_id: client.id,
        client_name: clientName(client),
        session_date: session.date,
        session_type: client.record_type === "Couple" ? "Couple" : "Individual",
        session_format: "Online",
        fee_due: Number(fee),
        amount_received: 0,
        invoice_sent_date: null,
        payment_date: null,
        notes: `Confirmed appointment at ${session.time}.`,
        source: "Manual",
        source_reference: `schedule-confirmed-${session.date}-${session.time}-${client.id}`,
      };
      const { data, error } = await supabaseClient
        .from("manual_payments")
        .insert(payload)
        .select("*")
        .single();
      if (!error && data) {
        payments.push(data);
        added.push(data);
      } else if (error?.code !== "23505") {
        console.error("A confirmed appointment could not be imported.", error);
      }
    }

    if (added.length > 0) {
      controls.message.textContent = `Added ${added.length} confirmed appointments for 10–14 August 2026.`;
    }
  }

  function currency(value) {
    return new Intl.NumberFormat("en-GB", {
      style: "currency", currency: "GBP",
      minimumFractionDigits: Number(value) % 1 === 0 ? 0 : 2,
    }).format(Number(value) || 0);
  }

  function displayDate(value) {
    if (!value) return "—";
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    }).format(new Date(`${value}T12:00:00`));
  }

  function invoiceReferenceForDate(value) {
    if (!value) return "";
    const [year, month, day] = value.split("-");
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    return `${day}${months[Number(month) - 1]}${String(year).slice(-2)}`;
  }

  function invoiceSessionDates(invoice) {
    const marker = String(invoice.description || "").match(/\[\[DATES:([^\]]+)\]\]/i);
    const dates = marker
      ? marker[1].split(",").map((date) => date.trim()).filter(Boolean)
      : [invoice.session_date].filter(Boolean);
    return [...new Set(dates)].sort();
  }

  function invoicePeriodBounds() {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const period = controls.invoicePeriodFilter.value;
    if (period === "all") return { start: "", end: "" };
    if (period === "custom") {
      return { start: controls.invoiceDateFrom.value, end: controls.invoiceDateTo.value };
    }
    if (period === "this-week" || period === "next-week") {
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      if (period === "next-week") monday.setDate(monday.getDate() + 7);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { start: isoDate(monday), end: isoDate(sunday) };
    }
    const end = new Date(today);
    end.setDate(today.getDate() + 6);
    return { start: isoDate(today), end: isoDate(end) };
  }

  function invoiceMatchesSelectedPeriod(invoice) {
    const { start, end } = invoicePeriodBounds();
    return invoiceSessionDates(invoice).some((date) =>
      (!start || date >= start) && (!end || date <= end)
    );
  }

  function paymentsLinkedToInvoice(invoice) {
    const direct = payments.filter((payment) =>
      payment.source_reference === `invoice:${invoice.id}`
    );
    const dates = new Set(invoiceSessionDates(invoice));
    const invoiceName = normalisedName(invoice.client_name);
    const dated = payments.filter((payment) =>
      dates.has(payment.session_date) &&
      (
        (invoice.client_id && payment.client_id === invoice.client_id) ||
        normalisedName(payment.client_name) === invoiceName
      )
    );
    return { direct, dated };
  }

  function invoiceOutstanding(invoice) {
    const { direct, dated } = paymentsLinkedToInvoice(invoice);
    const received = Math.max(
      direct.reduce((sum, payment) => sum + Number(payment.amount_received || 0), 0),
      dated.reduce((sum, payment) => sum + Number(payment.amount_received || 0), 0),
    );
    return Math.max(
      0,
      Number(invoice.amount || 0) + Number(invoice.extra_amount || 0) - received,
    );
  }

  function invoiceDueStatus(invoice) {
    if (!invoice.due_date) return "Awaiting payment";
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const due = new Date(`${invoice.due_date}T12:00:00`);
    const days = Math.round((due - today) / 86400000);
    if (days < 0) return `Overdue by ${Math.abs(days)} day${days === -1 ? "" : "s"}`;
    if (days === 0) return "Due today";
    return `Due in ${days} day${days === 1 ? "" : "s"}`;
  }

  async function markInvoicePaid(invoice, button) {
    const outstanding = invoiceOutstanding(invoice);
    if (!window.confirm(
      `Mark invoice ${invoice.invoice_number} for ${invoice.client_name} as paid?\n\n` +
      `${currency(outstanding)} will be recorded as received today and the related session history will be updated.`,
    )) return;
    button.disabled = true;
    button.textContent = "Saving…";
    const paymentDate = isoDate(new Date());
    const { error } = await supabaseClient.rpc("mark_invoice_paid", {
      p_invoice_id: invoice.id,
      p_payment_date: paymentDate,
    });
    if (error) {
      button.disabled = false;
      button.textContent = "Paid";
      controls.message.textContent =
        "The invoice could not be marked as paid. No payment information was changed.";
      console.error("Invoice payment update failed.", error);
      return;
    }
    const openHistoryClientId = historyClient?.id || null;
    await loadData();
    if (openHistoryClientId) {
      const refreshedClient = clients.find((item) =>
        (item._relatedClientIds || [item.id]).includes(openHistoryClientId)
      );
      if (refreshedClient) renderHistory(refreshedClient);
    }
    controls.message.textContent =
      `${invoice.invoice_number} has been marked as paid and the payment history has been updated.`;
  }

  function renderSentUnpaidInvoiceRow(invoice) {
    const row = document.createElement("tr");
    const dueStatus = invoiceDueStatus(invoice);
    if (dueStatus.startsWith("Overdue")) row.classList.add("invoice-row-overdue");
    appendCell(row, invoice.invoice_number);
    appendCell(row, invoice.client_name);
    appendCell(row, invoiceSessionDates(invoice).map(displayDate).join(" · "));
    appendCell(row, displayDate(invoice.due_date));
    appendCell(row, currency(invoiceOutstanding(invoice)));
    appendCell(row, dueStatus, dueStatus.startsWith("Overdue")
      ? "invoice-payment-overdue"
      : "invoice-payment-awaiting");
    const actions = document.createElement("td");
    actions.className = "payment-history-actions";
    const view = document.createElement("a");
    view.className = "payment-edit-button";
    view.href = `invoice.html?id=${encodeURIComponent(invoice.id)}`;
    view.textContent = "View";
    const reminder = document.createElement("button");
    reminder.type = "button";
    reminder.className = "payment-edit-button invoice-reminder-button";
    reminder.textContent = "Send reminder";
    reminder.addEventListener("click", () => {
      const firstName = String(invoice.client_name || "").trim().split(/\s+/)[0] || "there";
      const message = encodeURIComponent(
        `Hi ${firstName}, just a gentle reminder that invoice ${invoice.invoice_number} has a balance of ${currency(invoiceOutstanding(invoice))} outstanding. Please use ${invoice.invoice_number} as the payment reference. Thank you.`,
      );
      window.open(`https://wa.me/?text=${message}`, "_blank", "noopener");
    });
    const paid = document.createElement("button");
    paid.type = "button";
    paid.className = "payment-edit-button invoice-paid-button";
    paid.textContent = "Paid";
    paid.addEventListener("click", () => markInvoicePaid(invoice, paid));
    actions.append(view, reminder, paid);
    row.append(actions);
    return row;
  }

  async function deleteInvoice(invoice, button) {
    const sessionDates = invoiceSessionDates(invoice);
    const confirmed = window.confirm(
      `Delete invoice ${invoice.invoice_number} for ${invoice.client_name}?\n\n` +
      "The session and payment records will be kept so you can create a corrected invoice.",
    );
    if (!confirmed) return;
    button.disabled = true;
    const { data: deletedInvoices, error: deleteError } = await supabaseClient
      .from("invoices")
      .delete()
      .eq("id", invoice.id)
      .select("id");
    let removedPermanently = !deleteError && deletedInvoices?.length === 1;
    if (!removedPermanently) {
      const { data: cancelledInvoice, error: cancelError } = await supabaseClient
        .from("invoices")
        .update({ status: "Cancelled" })
        .eq("id", invoice.id)
        .select("id")
        .maybeSingle();
      if (cancelError || !cancelledInvoice) {
        button.disabled = false;
        const message = "The invoice could not be removed. Please try signing out and back in.";
        controls.message.textContent = message;
        window.alert(message);
        console.error("Invoice removal failed.", deleteError || cancelError);
        return;
      }
      removedPermanently = false;
    }
    await supabaseClient.from("manual_payments")
      .update({ invoice_sent_date: null })
      .eq("source_reference", `invoice:${invoice.id}`);
    if (invoice.client_id && sessionDates.length) {
      await supabaseClient.from("manual_payments")
        .update({ invoice_sent_date: null })
        .eq("client_id", invoice.client_id)
        .in("session_date", sessionDates);
    }
    await loadData();
    controls.message.textContent = removedPermanently
      ? `${invoice.invoice_number} was deleted. The session records were kept.`
      : `${invoice.invoice_number} was removed from the invoice list. The session records were kept.`;
  }

  function renderInvoiceRow(invoice, allowDelete = false) {
    const row = document.createElement("tr");
    appendCell(row, invoice.invoice_number);
    appendCell(row, invoice.client_name);
    appendCell(row, invoiceSessionDates(invoice).map(displayDate).join(" · "));
    appendCell(row, invoice.status === "Draft" ? "Set when sent" : displayDate(invoice.due_date));
    appendCell(row, currency(Number(invoice.amount) + Number(invoice.extra_amount || 0)));
    appendCell(
      row,
      invoice.status === "Draft" ? "Not sent yet" : invoice.status,
      `invoice-status invoice-status-${invoice.status.toLowerCase()}`,
    );
    const actions = document.createElement("td");
    actions.className = "payment-history-actions";
    const view = document.createElement("a");
    view.className = "payment-edit-button";
    view.href = `invoice.html?id=${encodeURIComponent(invoice.id)}`;
    view.textContent = "View invoice";
    actions.append(view);
    if (invoice.status === "Draft") {
      const markSent = document.createElement("button");
      markSent.type = "button";
      markSent.className = "payment-edit-button invoice-mark-sent-button";
      markSent.textContent = "Mark sent";
      markSent.addEventListener("click", async () => {
        markSent.disabled = true;
        const sentDate = isoDate(new Date());
        const { error } = await supabaseClient
          .from("invoices")
          .update({ status: "Sent", invoice_date: sentDate })
          .eq("id", invoice.id);
        if (error) {
          markSent.disabled = false;
          controls.message.textContent = "The invoice could not be marked as sent. Please try again.";
          return;
        }
        await supabaseClient.from("manual_payments")
          .update({ invoice_sent_date: sentDate })
          .eq("source_reference", `invoice:${invoice.id}`);
        const dateMarker = String(invoice.description || "").match(/\[\[DATES:([^\]]+)\]\]/i);
        if (dateMarker && invoice.client_id) {
          const coveredDates = dateMarker[1].split(",").map((date) => date.trim()).filter(Boolean);
          if (coveredDates.length) {
            await supabaseClient.from("manual_payments")
              .update({ invoice_sent_date: sentDate })
              .eq("client_id", invoice.client_id)
              .in("session_date", coveredDates);
          }
        }
        await loadData();
        controls.message.textContent = `${invoice.invoice_number} has been marked as sent.`;
      });
      actions.append(markSent);
    } else if (invoice.status === "Sent") {
      const sentNote = document.createElement("span");
      sentNote.className = "invoice-sent-note";
      sentNote.textContent = "Sent";
      actions.append(sentNote);
    }
    if (allowDelete) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "payment-delete-button invoice-delete-button";
      remove.textContent = "Delete invoice";
      remove.addEventListener("click", () => deleteInvoice(invoice, remove));
      actions.append(remove);
    }
    row.append(actions);
    return row;
  }

  function invoicePaymentPayload(invoice) {
    const description = String(invoice.description || "").toLowerCase();
    const invoiceTotal = Number(invoice.amount || 0) + Number(invoice.extra_amount || 0);
    return {
      client_id: invoice.client_id || null,
      client_name: invoice.client_name,
      session_date: invoice.session_date,
      session_type: description.includes("joint") || description.includes("couple")
        ? "Couple"
        : "Individual",
      session_format: description.startsWith("in person")
        ? "In person"
        : description.startsWith("online")
          ? "Online"
          : "Not recorded",
      fee_due: invoiceTotal,
      amount_received: invoice.status === "Paid" ? invoiceTotal : 0,
      invoice_sent_date: invoice.status === "Sent" || invoice.status === "Paid"
        ? invoice.invoice_date
        : null,
      payment_date: invoice.status === "Paid"
        ? String(invoice.updated_at || "").slice(0, 10) || isoDate(new Date())
        : null,
      notes: `Created automatically from invoice ${invoice.invoice_number}.`,
      source: "Manual",
      source_reference: `invoice:${invoice.id}`,
    };
  }

  async function syncInvoicesToPaymentHistory(invoices) {
    let changed = false;
    for (const invoice of invoices.filter((item) => item.status !== "Cancelled")) {
      const payload = invoicePaymentPayload(invoice);
      const linkedRecord = payments.find(
        (payment) => payment.source_reference === payload.source_reference,
      );
      if (linkedRecord) {
        if (linkedRecord.session_date !== invoice.session_date) {
          const correctedDate = linkedRecord.session_date;
          const { error: invoiceDateError } = await supabaseClient
            .from("invoices")
            .update({
              session_date: correctedDate,
              payment_reference: invoiceReferenceForDate(correctedDate),
            })
            .eq("id", invoice.id);
          if (!invoiceDateError) {
            invoice.session_date = correctedDate;
            invoice.payment_reference = invoiceReferenceForDate(correctedDate);
          } else {
            console.error("The linked invoice date could not be corrected.", invoiceDateError);
          }
        }
        if (Number(linkedRecord.fee_due) !== payload.fee_due) {
          const { data, error } = await supabaseClient
            .from("manual_payments")
            .update({ fee_due: payload.fee_due })
            .eq("id", linkedRecord.id)
            .select("*")
            .single();
          if (!error && data) {
            payments = payments.map((payment) => payment.id === data.id ? data : payment);
            changed = true;
          }
        }
        continue;
      }

      const matchingRecord = payments.find((payment) =>
        payment.session_date === payload.session_date &&
        (
          (payload.client_id && payment.client_id === payload.client_id) ||
          payment.client_name.toLowerCase() === payload.client_name.toLowerCase()
        ) &&
        Number(payment.fee_due) === payload.fee_due
      );
      if (matchingRecord) continue;

      const dateMarker = String(invoice.description || "")
        .match(/\[\[DATES:([^\]]+)\]\]/i);
      if (dateMarker) {
        const invoiceDates = dateMarker[1].split(",").map((date) => date.trim());
        const coveredRecords = payments.filter((payment) =>
          invoiceDates.includes(payment.session_date) &&
          (
            (payload.client_id && payment.client_id === payload.client_id) ||
            payment.client_name.toLowerCase() === payload.client_name.toLowerCase()
          )
        );
        const coveredOutstanding = coveredRecords.reduce(
          (sum, payment) => sum + Math.max(
            0,
            Number(payment.fee_due || 0) - Number(payment.amount_received || 0),
          ),
          0,
        );
        if (coveredRecords.length >= invoiceDates.length &&
          Math.abs(coveredOutstanding - payload.fee_due) < 0.01) continue;
      }

      const { data, error } = await supabaseClient
        .from("manual_payments")
        .insert(payload)
        .select("*")
        .single();
      if (!error && data) {
        payments = [data, ...payments];
        changed = true;
      } else if (error) {
        console.error("Invoice could not be added to payment history.", error);
      }
    }
    if (changed) render();
  }

  async function loadInvoices() {
    const { data, error } = await supabaseClient
      .from("invoices")
      .select("id,booking_id,client_id,invoice_number,client_name,invoice_date,due_date,session_date,description,amount,extra_amount,status,updated_at")
      .order("invoice_date", { ascending: false })
      .limit(500);
    if (error) {
      controls.invoicesEmpty.textContent = "Run the invoice Supabase setup to enable automatic draft invoices.";
      return;
    }
    const allInvoices = data || [];
    invoices = allInvoices;
    const nonInvoiceableBookingIds = new Set(
      bookingRequests
        .filter((booking) => ["contacted", "closed"].includes(booking.status))
        .map((booking) => booking.id),
    );
    const invalidDrafts = allInvoices.filter((invoice) =>
      invoice.status === "Draft" &&
      invoice.booking_id &&
      nonInvoiceableBookingIds.has(invoice.booking_id)
    );
    if (invalidDrafts.length) {
      const invalidDraftIds = invalidDrafts.map((invoice) => invoice.id);
      const { error: cancelError } = await supabaseClient
        .from("invoices")
        .update({ status: "Cancelled" })
        .in("id", invalidDraftIds);
      if (cancelError) {
        console.error("Pending booking drafts could not be cancelled.", cancelError);
      } else {
        invalidDrafts.forEach((invoice) => { invoice.status = "Cancelled"; });
      }
    }
    const invoicesAwaitingSending = allInvoices.filter((invoice) =>
      invoice.status === "Draft" &&
      !nonInvoiceableBookingIds.has(invoice.booking_id) &&
      invoiceMatchesSelectedPeriod(invoice)
    )
      .sort((first, second) =>
        String(invoiceSessionDates(second).at(-1) || "").localeCompare(
          String(invoiceSessionDates(first).at(-1) || ""),
        )
      );
    const sentUnpaidInvoices = allInvoices.filter((invoice) =>
      invoice.status === "Sent" && invoiceOutstanding(invoice) > 0.009
    ).sort((first, second) =>
      String(first.due_date || "").localeCompare(String(second.due_date || ""))
    );
    const sentInvoices = allInvoices.filter((invoice) =>
      invoice.status === "Paid" ||
      (invoice.status === "Sent" && invoiceOutstanding(invoice) <= 0.009)
    ).sort((first, second) =>
      String(second.invoice_number || "").localeCompare(
        String(first.invoice_number || ""),
        undefined,
        { numeric: true, sensitivity: "base" },
      )
    );
    controls.invoicesTableBody.replaceChildren(
      ...invoicesAwaitingSending.map((invoice) => renderInvoiceRow(invoice)),
    );
    controls.invoicesEmpty.textContent = "No outstanding invoices match these session dates.";
    controls.invoicesEmpty.hidden = invoicesAwaitingSending.length > 0;
    controls.invoicesTableWrap.hidden = invoicesAwaitingSending.length === 0;
    controls.sentInvoicesTableBody.replaceChildren(
      ...sentInvoices.map((invoice) => renderInvoiceRow(invoice, true)),
    );
    controls.sentInvoicesArchive.hidden = sentInvoices.length === 0;
    controls.sentUnpaidTableBody.replaceChildren(
      ...sentUnpaidInvoices.map(renderSentUnpaidInvoiceRow),
    );
    controls.sentUnpaidEmpty.hidden = sentUnpaidInvoices.length > 0;
    controls.sentUnpaidTableWrap.hidden = sentUnpaidInvoices.length === 0;
    sentInvoiceOutstandingTotal = sentUnpaidInvoices.reduce(
      (sum, invoice) => sum + invoiceOutstanding(invoice),
      0,
    );
    sentInvoiceUnpaidCount = sentUnpaidInvoices.length;
    controls.sentUnpaidSummary.textContent = `${currency(sentInvoiceOutstandingTotal)} outstanding`;
    await syncInvoicesToPaymentHistory(allInvoices);
    render();
  }

  function paymentStatus(payment) {
    const bookingState = paymentBookingState(payment);
    if (bookingState === "pending") return "Pending";
    if (bookingState === "cancelled") return "Cancelled";
    const due = Number(payment.fee_due || 0);
    const received = Number(payment.amount_received || 0);
    if (received <= 0 && due > 0) return "Unpaid";
    if (received < due) return "Part-paid";
    if (received > due) return "Credit added";
    return "Paid";
  }

  function bookingRequestClientName(booking) {
    const first = [booking.first_name, booking.surname].filter(Boolean).join(" ").trim();
    const second = [booking.second_first_name, booking.second_surname]
      .filter(Boolean).join(" ").trim();
    return [first, second].filter(Boolean).join(" and ");
  }

  function bookingsForPayment(payment) {
    const paymentClient = clients.find((client) =>
      (client._relatedClientIds || [client.id]).includes(payment.client_id)
    );
    const relatedIds = new Set(paymentClient?._relatedClientIds || [payment.client_id].filter(Boolean));
    const paymentName = normalisedName(payment.client_name);
    return bookingRequests.filter((booking) =>
      booking.preferred_date === payment.session_date &&
      (
        (booking.client_id && relatedIds.has(booking.client_id)) ||
        normalisedName(bookingRequestClientName(booking)) === paymentName
      )
    );
  }

  function paymentBookingState(payment) {
    const matches = bookingsForPayment(payment);
    if (matches.some((booking) => booking.status === "confirmed")) return "confirmed";
    if (matches.some((booking) => booking.status === "contacted")) return "pending";
    if (matches.length && matches.every((booking) => booking.status === "closed")) {
      return "cancelled";
    }
    return "unlinked";
  }

  function isPendingPayment(payment) {
    return paymentBookingState(payment) === "pending";
  }

  function isNonBillablePayment(payment) {
    return ["pending", "cancelled"].includes(paymentBookingState(payment));
  }

  function selectedPeriod() {
    const now = new Date();
    if (controls.periodFilter.value === "tax-year") {
      return { start: "2026-04-06", end: "2027-04-05" };
    }
    if (controls.periodFilter.value === "today") {
      const today = isoDate(now);
      return { start: today, end: today };
    }
    if (controls.periodFilter.value === "week") {
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { start: isoDate(monday), end: isoDate(sunday) };
    }
    if (controls.periodFilter.value === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: isoDate(start), end: isoDate(end) };
    }
    if (controls.periodFilter.value === "previous-month") {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: isoDate(start), end: isoDate(end) };
    }
    if (controls.periodFilter.value === "custom") {
      return { start: controls.dateFrom.value, end: controls.dateTo.value };
    }
    return { start: "", end: "" };
  }

  function paymentsForPeriod() {
    const { start, end } = selectedPeriod();
    return payments.filter((payment) =>
      (!start || payment.session_date >= start) &&
      (!end || payment.session_date <= end),
    );
  }

  function paymentsForClient(client, source = payments) {
    const name = clientName(client).toLowerCase();
    const relatedIds = new Set(client._relatedClientIds || [client.id]);
    return source.filter((payment) =>
      relatedIds.has(payment.client_id) ||
      (!payment.client_id && payment.client_name.toLowerCase() === name),
    );
  }

  function consolidateDuplicateCouples(rows) {
    const groups = new Map();
    const result = [];
    rows.forEach((client) => {
      if (client.record_type !== "Couple") {
        client._relatedClientIds = [client.id];
        result.push(client);
        return;
      }
      const partners = [client.first_name, client.second_first_name]
        .filter(Boolean)
        .map((name) => name.trim().toLowerCase())
        .sort();
      const key = partners.length === 2 ? partners.join("|") : `id:${client.id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(client);
    });
    groups.forEach((matches) => {
      const score = (client) => [
        client.surname,
        client.second_surname,
        client.bank_payment_name,
        client.agreed_online_fee_gbp,
        client.agreed_in_person_fee_gbp,
      ].filter((value) => value !== null && value !== undefined && value !== "").length;
      const canonical = matches.slice().sort((a, b) => score(b) - score(a))[0];
      canonical._relatedClientIds = matches.map((client) => client.id);
      result.push(canonical);
    });
    return result;
  }

  function clientFinancials(client, periodPayments) {
    const records = paymentsForClient(client, periodPayments);
    const billableRecords = records.filter((payment) => !isNonBillablePayment(payment));
    const net = billableRecords.reduce(
      (total, payment) => total + Number(payment.amount_received || 0) - Number(payment.fee_due || 0),
      0,
    );
    return {
      records,
      outstanding: Math.max(0, -net),
      credit: Math.max(0, net),
      position: billableRecords.length === 0
        ? "No records"
        : net < 0
          ? "Outstanding"
          : net > 0
            ? "In credit"
            : "Up to date",
    };
  }

  function clientPosition(client, periodPayments) {
    return clientFinancials(client, periodPayments).position;
  }

  function appendCell(row, text, className = "") {
    const cell = document.createElement("td");
    cell.textContent = text;
    if (className) cell.className = className;
    row.append(cell);
    return cell;
  }

  async function deletePayment(payment, button) {
    const confirmed = window.confirm(
      `Delete the ${displayDate(payment.session_date)} payment record for ${payment.client_name}?\n\nThis cannot be undone.`,
    );
    if (!confirmed) return;
    button.disabled = true;
    const { error } = await supabaseClient
      .from("manual_payments")
      .delete()
      .eq("id", payment.id);
    if (error) {
      button.disabled = false;
      controls.message.textContent = "The payment record could not be deleted.";
      console.error(error);
      return;
    }
    payments = payments.filter((record) => record.id !== payment.id);
    controls.message.textContent = `Deleted the ${displayDate(payment.session_date)} record for ${payment.client_name}.`;
    render();
  }

  async function markSessionAttended(payment, button) {
    const matches = bookingsForPayment(payment).filter((booking) => booking.status === "closed");
    if (!matches.length) {
      controls.message.textContent = "The cancelled booking could not be found.";
      return;
    }
    if (!window.confirm(
      `Mark the ${displayDate(payment.session_date)} session for ${payment.client_name} as attended?`,
    )) return;
    button.disabled = true;
    const ids = matches.map((booking) => booking.id);
    const { error } = await supabaseClient
      .from("booking_requests")
      .update({ status: "confirmed" })
      .in("id", ids);
    if (error) {
      button.disabled = false;
      controls.message.textContent = "The session status could not be corrected.";
      console.error(error);
      return;
    }
    bookingRequests = bookingRequests.map((booking) =>
      ids.includes(booking.id) ? { ...booking, status: "confirmed" } : booking
    );
    controls.message.textContent =
      `The ${displayDate(payment.session_date)} session for ${payment.client_name} is now marked as attended.`;
    render();
  }

  function renderRow(payment) {
    const row = document.createElement("tr");
    const bookingState = paymentBookingState(payment);
    const nonBillable = ["pending", "cancelled"].includes(bookingState);
    if (bookingState === "pending") row.classList.add("payment-row-pending");
    if (bookingState === "cancelled") row.classList.add("payment-row-cancelled");
    const balance = nonBillable
      ? 0
      : Math.max(0, Number(payment.fee_due) - Number(payment.amount_received));
    const status = paymentStatus(payment);
    appendCell(row, displayDate(payment.session_date));
    appendCell(row, payment.client_name);
    appendCell(row, `${payment.session_type} · ${payment.session_format}`);
    appendCell(row, currency(payment.fee_due));
    appendCell(row, currency(payment.amount_received));
    appendCell(row, nonBillable ? "Not due" : currency(balance));
    appendCell(
      row,
      status,
      `payment-status payment-status-${status.toLowerCase().replaceAll(" ", "-")}`,
    );
    appendCell(row, displayDate(payment.payment_date));
    const actions = document.createElement("td");
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "payment-edit-button";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => openEditor(payment));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "payment-delete-button";
    remove.textContent = "Delete";
    remove.addEventListener("click", () => deletePayment(payment, remove));
    if (bookingState === "cancelled") {
      const attended = document.createElement("button");
      attended.type = "button";
      attended.className = "payment-attended-button";
      attended.textContent = "Mark session as attended";
      attended.addEventListener("click", () => markSessionAttended(payment, attended));
      actions.append(attended);
    }
    const balanceForInvoice = Math.max(
      0,
      Number(payment.fee_due || 0) - Number(payment.amount_received || 0),
    );
    if (balanceForInvoice > 0 && !nonBillable) {
      const selectLabel = document.createElement("label");
      selectLabel.className = "payment-invoice-select";
      const select = document.createElement("input");
      select.type = "checkbox";
      select.checked = selectedInvoicePaymentIds.has(payment.id);
      select.addEventListener("change", () => {
        if (select.checked) selectedInvoicePaymentIds.add(payment.id);
        else selectedInvoicePaymentIds.delete(payment.id);
      });
      selectLabel.append(select, document.createTextNode("Include in invoice"));
      actions.append(selectLabel);
    }
    const invoiceId = String(payment.source_reference || "").startsWith("invoice:")
      ? String(payment.source_reference).slice("invoice:".length)
      : "";
    const relatedInvoice = invoiceId
      ? invoices.find((invoice) => invoice.id === invoiceId)
      : null;
    if (
      relatedInvoice?.status === "Sent" &&
      invoiceOutstanding(relatedInvoice) > 0.009 &&
      !nonBillable
    ) {
      const paid = document.createElement("button");
      paid.type = "button";
      paid.className = "payment-edit-button invoice-paid-button";
      paid.textContent = "Paid";
      paid.title = `Mark ${relatedInvoice.invoice_number} as paid`;
      paid.addEventListener("click", () => markInvoicePaid(relatedInvoice, paid));
      actions.append(paid);
    }
    actions.append(edit, remove);
    row.append(actions);
    return row;
  }

  function mostRecentDate(records, field) {
    return records.map((record) => record[field]).filter(Boolean).sort().at(-1) || "";
  }

  function weekStartDate() {
    const today = new Date();
    today.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return isoDate(today);
  }

  async function markClientReviewed(client, button) {
    button.disabled = true;
    const today = isoDate(new Date());
    const { error } = await supabaseClient
      .from("clients")
      .update({ payment_reviewed_at: today })
      .eq("id", client.id);
    if (error) {
      button.disabled = false;
      controls.message.textContent = "The weekly check could not be saved.";
      console.error(error);
      return;
    }
    client.payment_reviewed_at = today;
    controls.message.textContent = `${clientName(client)} marked as checked this week.`;
    render();
  }

  async function saveBankPaymentName(client, input, button) {
    const bankPaymentName = input.value.trim();
    button.disabled = true;
    const { error } = await supabaseClient
      .from("clients")
      .update({ bank_payment_name: bankPaymentName || null })
      .eq("id", client.id);
    if (error) {
      button.disabled = false;
      controls.message.textContent = "The bank payment name could not be saved.";
      console.error(error);
      return;
    }
    client.bank_payment_name = bankPaymentName || null;
    controls.message.textContent = bankPaymentName
      ? `Saved the bank payment name for ${clientName(client)}.`
      : `Removed the bank payment name for ${clientName(client)}.`;
    render();
  }

  function appendBankPaymentEditor(cell, client) {
    const editor = document.createElement("div");
    editor.className = "bank-payment-editor";
    const label = document.createElement("label");
    label.textContent = "Name on bank payment";
    const input = document.createElement("input");
    input.type = "text";
    input.value = client.bank_payment_name || "";
    input.placeholder = "For example: J Smith";
    input.setAttribute("aria-label", `Name shown on bank payment for ${clientName(client)}`);
    const save = document.createElement("button");
    save.type = "button";
    save.textContent = "Save";
    save.addEventListener("click", () => saveBankPaymentName(client, input, save));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        save.click();
      }
    });
    label.append(input);
    editor.append(label, save);
    cell.append(editor);
  }

  function renderHistory(client, shouldScroll = false) {
    historyClient = client;
    selectedInvoicePaymentIds.clear();
    controls.historyTitle.textContent = clientName(client);
    const records = paymentsForClient(client)
      .slice()
      .sort((a, b) => b.session_date.localeCompare(a.session_date));
    controls.tableBody.replaceChildren(...records.map(renderRow));
    controls.historyPanel.hidden = false;
    if (shouldScroll) {
      controls.historyPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function createInvoiceFromSelectedPayments() {
    if (!historyClient) return;
    const selected = paymentsForClient(historyClient)
      .filter((payment) => selectedInvoicePaymentIds.has(payment.id))
      .sort((a, b) => a.session_date.localeCompare(b.session_date));
    if (!selected.length) {
      controls.message.textContent =
        "Select at least one outstanding appointment using ‘Include in invoice’.";
      return;
    }
    const total = selected.reduce(
      (sum, payment) => sum + Math.max(
        0,
        Number(payment.fee_due || 0) - Number(payment.amount_received || 0),
      ),
      0,
    );
    if (total <= 0) return;
    const dates = [...new Set(selected.map((payment) => payment.session_date))];
    const couple = historyClient.record_type === "Couple";
    const formats = [...new Set(selected.map((payment) => payment.session_format))];
    const sessionFormat = formats.length === 1 && formats[0] !== "Not recorded"
      ? formats[0]
      : "Online";
    if (!window.confirm(
      `Create one invoice for ${clientName(historyClient)}?\n\n${selected.length} session${selected.length === 1 ? "" : "s"}\nTotal outstanding: ${currency(total)}`,
    )) return;
    controls.createHistoryInvoice.disabled = true;
    controls.message.textContent = "Creating invoice…";
    try {
      const bookingId = crypto.randomUUID();
      const booking = {
        id: bookingId,
        client_id: historyClient.id,
        session_type: couple ? "Joint session" : "Individual session",
        session_format: sessionFormat,
        booking_source: "Ayesha booking for client",
        client_type: "Existing client",
        booking_type: selected.length > 1 ? "Block booking" : "Single session",
        block_session_count: selected.length > 1 ? selected.length : null,
        price: total,
        total_cost: total,
        pay_now_amount: 0,
        remaining_balance: total,
        invoice_required: true,
        invoice_amount: total,
        duration: couple ? "80 minutes" : "50 minutes",
        preferred_date: dates[0],
        preferred_time: "09:00",
        first_name: historyClient.first_name || "",
        surname: historyClient.surname || "",
        second_first_name: historyClient.second_first_name || "",
        second_surname: historyClient.second_surname || "",
        email: historyClient.email || historyClient.second_email || "",
        phone: historyClient.phone || "",
        message: "Invoice created from outstanding Payment History appointments.",
        consent_to_contact: true,
        status: "confirmed",
        calendar_sync_status: "synced",
      };
      const { error: bookingError } = await supabaseClient
        .from("booking_requests").insert(booking);
      if (bookingError) throw bookingError;
      const { data: invoiceId, error: invoiceError } = await supabaseClient.rpc(
        "ensure_booking_invoice", { p_booking_id: bookingId },
      );
      if (invoiceError || !invoiceId) throw invoiceError || new Error("Invoice was not created");
      const description = `${sessionFormat} ${couple ? "joint" : "individual"} session [[DATES:${dates.join(",")}]]`;
      const { error: updateError } = await supabaseClient.from("invoices").update({
        session_date: dates[0],
        session_count: selected.length,
        amount: total,
        description,
        payment_reference: invoiceReferenceForDate(dates[0]),
      }).eq("id", invoiceId);
      if (updateError) throw updateError;
      window.location.href = `invoice.html?id=${encodeURIComponent(invoiceId)}`;
    } catch (error) {
      console.error(error);
      controls.message.textContent = `The invoice could not be created. ${error?.message || "Please try again."}`;
      controls.createHistoryInvoice.disabled = false;
    }
  }

  function openHistory(client) {
    renderHistory(client, true);
  }

  function renderClientRow(client, periodPayments) {
    const { records, outstanding, credit, position } = clientFinancials(client, periodPayments);
    const checked = client.payment_reviewed_at >= weekStartDate();
    const row = document.createElement("tr");
    const nameCell = appendCell(row, clientName(client));
    appendBankPaymentEditor(nameCell, client);
    const onlineFee = client.agreed_online_fee_gbp ?? client.agreed_session_fee_gbp;
    const inPersonFee = client.agreed_in_person_fee_gbp ?? client.agreed_session_fee_gbp;
    const currentFee = onlineFee == null && inPersonFee == null
      ? "Not recorded"
      : `Online ${onlineFee == null ? "—" : currency(onlineFee)} · In person ${
          inPersonFee == null ? "—" : currency(inPersonFee)
        }`;
    appendCell(row, currentFee, "payment-current-fee");
    appendCell(row, String(records.length));
    appendCell(row, displayDate(mostRecentDate(records, "session_date")));
    appendCell(row, displayDate(mostRecentDate(records, "payment_date")));
    appendCell(row, currency(outstanding));
    appendCell(row, currency(credit), credit > 0 ? "payment-credit" : "");
    appendCell(
      row,
      position,
      `payment-status payment-position-${position.toLowerCase().replaceAll(" ", "-")}`,
    );
    const reviewCell = appendCell(row, checked ? "Checked this week" : "Not checked");
    reviewCell.classList.add(checked ? "payment-reviewed" : "payment-not-reviewed");
    const actions = document.createElement("td");
    const history = document.createElement("button");
    history.type = "button";
    history.className = "payment-edit-button";
    history.textContent = "History";
    history.addEventListener("click", () => openHistory(client));
    const add = document.createElement("button");
    add.type = "button";
    add.className = "payment-edit-button";
    add.textContent = "Add";
    add.addEventListener("click", () => openEditor(null, client.id));
    const review = document.createElement("button");
    review.type = "button";
    review.className = "payment-review-button";
    review.textContent = "Checked";
    review.disabled = checked;
    review.addEventListener("click", () => markClientReviewed(client, review));
    actions.append(history, add, review);
    row.append(actions);
    return row;
  }

  function render() {
    controls.customDates.hidden = controls.periodFilter.value !== "custom";
    const periodPayments = paymentsForPeriod();
    const query = controls.search.value.trim().toLowerCase();
    const positionFilter = controls.statusFilter.value;
    const activeClients = clients
      .filter((client) => client.status === "Active")
      .filter((client) => !query || clientName(client).toLowerCase().includes(query))
      .filter((client) =>
        !positionFilter || clientPosition(client, periodPayments) === positionFilter,
      )
      .sort((a, b) => clientName(a).localeCompare(clientName(b), "en-GB", {
        sensitivity: "base",
      }));
    controls.clientTableBody.replaceChildren(
      ...activeClients.map((client) => renderClientRow(client, periodPayments)),
    );
    controls.loading.hidden = true;
    controls.empty.hidden = activeClients.length > 0;
    controls.clientTableWrap.hidden = activeClients.length === 0;
    const totals = periodPayments.reduce((result, payment) => {
      if (isNonBillablePayment(payment)) return result;
      const due = Number(payment.fee_due || 0);
      const received = Number(payment.amount_received || 0);
      result.fees += due;
      result.received += received;
      return result;
    }, { fees: 0, received: 0 });
    const clientTotals = clients
      .filter((client) => client.status === "Active")
      .map((client) => clientFinancials(client, periodPayments))
      .reduce((result, financials) => {
        result.outstanding += financials.outstanding;
        result.credit += financials.credit;
        if (financials.outstanding > 0) result.owing += 1;
        return result;
      }, { outstanding: 0, credit: 0, owing: 0 });
    controls.feeTotal.textContent = currency(totals.fees);
    controls.receivedTotal.textContent = currency(totals.received);
    controls.outstandingTotal.textContent = currency(sentInvoiceOutstandingTotal);
    controls.creditTotal.textContent = currency(clientTotals.credit);
    controls.unpaidCount.textContent = String(sentInvoiceUnpaidCount);
    if (historyClient) renderHistory(historyClient);
  }

  function fillClientOptions() {
    const options = clients
      .slice()
      .sort((a, b) => clientName(a).localeCompare(clientName(b), "en-GB"))
      .map((client) => {
        const option = document.createElement("option");
        option.value = client.id;
        option.textContent = clientName(client);
        option.dataset.name = clientName(client);
        option.dataset.type = client.record_type;
        option.dataset.onlineFee = client.agreed_online_fee_gbp ?? client.agreed_session_fee_gbp ?? "";
        option.dataset.inPersonFee = client.agreed_in_person_fee_gbp ?? client.agreed_session_fee_gbp ?? "";
        return option;
      });
    controls.clientSelect.append(...options);
  }

  function applyClientDefaults() {
    if (editingId) return;
    const option = controls.clientSelect.selectedOptions[0];
    if (!option?.value) return;
    controls.form.elements.sessionType.value = option.dataset.type || "Individual";
    const format = controls.form.elements.sessionFormat.value;
    const fee = format === "In person" ? option.dataset.inPersonFee : option.dataset.onlineFee;
    if (fee !== "") controls.form.elements.feeDue.value = fee;
  }

  function openEditor(payment = null, selectedClientId = "") {
    controls.form.reset();
    controls.formMessage.textContent = "";
    editingId = payment?.id || null;
    controls.dialogTitle.textContent = payment ? "Edit payment" : "Add payment";
    controls.form.elements.sessionDate.value = payment?.session_date || isoDate(new Date());
    controls.form.elements.amountReceived.value = payment?.amount_received ?? 0;
    if (!payment && selectedClientId) {
      controls.form.elements.clientId.value = selectedClientId;
      applyClientDefaults();
    }
    if (payment) {
      controls.form.elements.clientId.value = payment.client_id || "";
      controls.form.elements.sessionType.value = payment.session_type;
      controls.form.elements.sessionFormat.value = payment.session_format;
      controls.form.elements.feeDue.value = payment.fee_due;
      controls.form.elements.invoiceSentDate.value = payment.invoice_sent_date || "";
      controls.form.elements.paymentDate.value = payment.payment_date || "";
      controls.form.elements.notes.value = payment.notes || "";
    }
    controls.dialog.showModal();
  }

  function payloadFromForm() {
    const data = new FormData(controls.form);
    const option = controls.clientSelect.selectedOptions[0];
    return {
      client_id: data.get("clientId"),
      client_name: option?.dataset.name || option?.textContent || "Client",
      session_date: data.get("sessionDate"),
      session_type: data.get("sessionType"),
      session_format: data.get("sessionFormat"),
      fee_due: Number(data.get("feeDue")),
      amount_received: Number(data.get("amountReceived")),
      invoice_sent_date: data.get("invoiceSentDate") || null,
      payment_date: data.get("paymentDate") || null,
      notes: String(data.get("notes") || "").trim() || null,
      source: "Manual",
    };
  }

  async function loadData() {
    controls.loading.hidden = false;
    const [clientResult, paymentResult, bookingResult] = await Promise.all([
      supabaseClient.from("clients").select(
        "id, record_type, status, first_name, surname, second_first_name, second_surname, email, second_email, phone, bank_payment_name, agreed_session_fee_gbp, agreed_online_fee_gbp, agreed_in_person_fee_gbp, payment_reviewed_at",
      ),
      supabaseClient.from("manual_payments").select("*").order("session_date", { ascending: false }),
      supabaseClient.from("booking_requests").select(
        "id, client_id, first_name, surname, second_first_name, second_surname, preferred_date, status",
      ),
    ]);
    if (clientResult.error || paymentResult.error || bookingResult.error) {
      controls.loading.hidden = true;
      controls.message.textContent = "Payment records are not ready yet. Run the Supabase payment setup first.";
      console.error(clientResult.error || paymentResult.error || bookingResult.error);
      return;
    }
    clients = consolidateDuplicateCouples(clientResult.data || []);
    payments = paymentResult.data || [];
    bookingRequests = bookingResult.data || [];
    await importCompletedSessionsFor3To7August2026();
    await importConfirmedSessionsFor10To14August2026();
    fillClientOptions();
    render();
    await loadInvoices();
  }

  controls.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!controls.form.reportValidity()) return;
    controls.saveButton.disabled = true;
    try {
      const payload = payloadFromForm();
      const originalPayment = editingId
        ? payments.find((payment) => payment.id === editingId)
        : null;
      const query = editingId
        ? supabaseClient.from("manual_payments").update(payload).eq("id", editingId)
        : supabaseClient.from("manual_payments").insert(payload);
      const { data, error } = await query.select("*").single();
      if (error) throw error;
      if (originalPayment?.source_reference?.startsWith("invoice:")) {
        const invoiceId = originalPayment.source_reference.slice("invoice:".length);
        const { error: invoiceError } = await supabaseClient
          .from("invoices")
          .update({
            session_date: payload.session_date,
            payment_reference: invoiceReferenceForDate(payload.session_date),
          })
          .eq("id", invoiceId);
        if (invoiceError) throw invoiceError;
      }
      payments = editingId
        ? payments.map((payment) => payment.id === editingId ? data : payment)
        : [data, ...payments];
      controls.dialog.close();
      controls.message.textContent = editingId ? "Payment updated." : "Payment added.";
      render();
    } catch (error) {
      controls.formMessage.textContent = "The payment could not be saved.";
      console.error(error);
    } finally {
      controls.saveButton.disabled = false;
    }
  });

  controls.addButton.addEventListener("click", () => openEditor());
  document.querySelector("#close-payment-dialog").addEventListener("click", () => controls.dialog.close());
  document.querySelector("#cancel-payment").addEventListener("click", () => controls.dialog.close());
  controls.closeHistory.addEventListener("click", () => {
    historyClient = null;
    controls.historyPanel.hidden = true;
  });
  controls.createHistoryInvoice.addEventListener("click", createInvoiceFromSelectedPayments);
  controls.invoicePeriodFilter.addEventListener("change", async () => {
    controls.invoiceCustomDates.hidden = controls.invoicePeriodFilter.value !== "custom";
    await loadInvoices();
  });
  [controls.invoiceDateFrom, controls.invoiceDateTo].forEach((field) => {
    field.addEventListener("change", loadInvoices);
  });
  controls.clientSelect.addEventListener("change", applyClientDefaults);
  controls.form.elements.sessionFormat.addEventListener("change", applyClientDefaults);
  [
    controls.periodFilter,
    controls.dateFrom,
    controls.dateTo,
    controls.search,
    controls.statusFilter,
  ].forEach((field) => {
    field.addEventListener("input", render);
    field.addEventListener("change", render);
  });
  loadData();
})();
