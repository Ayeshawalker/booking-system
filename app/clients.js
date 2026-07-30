(async function setupClientDirectory() {
  const admin = await window.ADMIN_READY;
  const supabaseClient = admin.client;
  const controls = {
    addButton: document.querySelector("#add-client"),
    search: document.querySelector("#client-search"),
    statusFilter: document.querySelector("#client-status-filter"),
    typeFilter: document.querySelector("#client-type-filter"),
    loading: document.querySelector("#clients-loading"),
    empty: document.querySelector("#clients-empty"),
    tableWrap: document.querySelector("#clients-table-wrap"),
    tableBody: document.querySelector("#clients-table-body"),
    message: document.querySelector("#clients-message"),
    dialog: document.querySelector("#client-dialog"),
    dialogTitle: document.querySelector("#client-dialog-title"),
    form: document.querySelector("#client-form"),
    formMessage: document.querySelector("#client-form-message"),
    saveButton: document.querySelector("#save-client"),
    firstPersonLegend: document.querySelector("#first-person-legend"),
    secondPersonFields: document.querySelector("#second-person-fields"),
    agreedFeeLabel: document.querySelector("#agreed-fee-label"),
    contractDateField: document.querySelector("#contract-date-field"),
    intakeDateField: document.querySelector("#intake-date-field"),
    specialityOtherToggle: document.querySelector("#speciality-other-toggle"),
    specialityOtherField: document.querySelector("#speciality-other-field"),
  };
  const counts = {
    all: document.querySelector("#client-count-all"),
    active: document.querySelector("#client-count-active"),
    individuals: document.querySelector("#client-count-individuals"),
    couples: document.querySelector("#client-count-couples"),
  };
  const selectedColumns = [
    "id",
    "record_type",
    "status",
    "first_name",
    "surname",
    "email",
    "phone",
    "second_first_name",
    "second_surname",
    "second_email",
    "second_phone",
    "contract_status",
    "contract_signed_date",
    "intake_status",
    "intake_completed_date",
    "specialities",
    "speciality_other",
    "session_frequency",
    "frequency_notes",
    "preferred_format",
    "agreed_session_fee_gbp",
    "agreed_online_fee_gbp",
    "agreed_in_person_fee_gbp",
    "fee_arrangement",
    "fee_notes",
    "created_at",
    "updated_at",
  ].join(",");
  let clients = [];
  let editingClientId = null;

  function clientNames(client) {
    const first = [client.first_name, client.surname].filter(Boolean).join(" ");
    const second = [client.second_first_name, client.second_surname]
      .filter(Boolean)
      .join(" ");
    return [first, second].filter(Boolean).join(" and ");
  }

  function normalisedSearchText(client) {
    return [
      clientNames(client),
      client.email,
      client.second_email,
      ...(client.specialities || []),
      client.speciality_other,
      client.fee_arrangement,
      client.fee_notes,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function appendText(parent, tagName, text, className = "") {
    const element = document.createElement(tagName);
    element.textContent = text;
    if (className) element.className = className;
    parent.append(element);
    return element;
  }

  function paperworkText(label, status, date) {
    if (!date || !["Signed", "Completed"].includes(status)) {
      return `${label}: ${status}`;
    }

    const formattedDate = new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(`${date}T12:00:00`));
    return `${label}: ${status} ${formattedDate}`;
  }

  function statusClass(status) {
    return `client-status client-status-${status.toLowerCase()}`;
  }

  function formatFee(value) {
    if (value === null || value === undefined || value === "") {
      return "Not recorded";
    }

    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: Number(value) % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(Number(value));
  }

  function renderClientRow(client) {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    const typeCell = document.createElement("td");
    const paperworkCell = document.createElement("td");
    const supportCell = document.createElement("td");
    const sessionsCell = document.createElement("td");
    const feeCell = document.createElement("td");
    const statusCell = document.createElement("td");
    const actionCell = document.createElement("td");

    appendText(nameCell, "strong", clientNames(client));
    appendText(
      nameCell,
      "small",
      [client.email, client.second_email].filter(Boolean).join(" / ") ||
        "No email recorded",
    );
    appendText(typeCell, "span", client.record_type);

    appendText(
      paperworkCell,
      "small",
      paperworkText(
        "Contract",
        client.contract_status,
        client.contract_signed_date,
      ),
    );
    appendText(
      paperworkCell,
      "small",
      paperworkText(
        "Intake",
        client.intake_status,
        client.intake_completed_date,
      ),
    );

    const supportItems = [
      ...(client.specialities || []).filter((item) => item !== "Other"),
      client.speciality_other,
    ].filter(Boolean);
    if (supportItems.length === 0) {
      appendText(supportCell, "small", "Not recorded");
    } else {
      const tags = document.createElement("div");
      tags.className = "client-tags";
      supportItems.forEach((item) => appendText(tags, "span", item));
      supportCell.append(tags);
    }

    appendText(sessionsCell, "span", client.session_frequency);
    appendText(sessionsCell, "small", client.preferred_format);
    if (client.frequency_notes) {
      appendText(sessionsCell, "small", client.frequency_notes);
    }

    if (client.fee_arrangement === "Complimentary") {
      appendText(feeCell, "strong", "Complimentary");
    } else {
      appendText(
        feeCell,
        "strong",
        `Online ${formatFee(client.agreed_online_fee_gbp ?? client.agreed_session_fee_gbp)}`,
      );
      appendText(
        feeCell,
        "small",
        `In person ${formatFee(client.agreed_in_person_fee_gbp ?? client.agreed_session_fee_gbp)}`,
      );
    }
    if (client.fee_arrangement !== "Complimentary") {
      appendText(feeCell, "small", client.fee_arrangement);
    }
    if (client.fee_notes) {
      appendText(feeCell, "small", client.fee_notes);
    }

    appendText(statusCell, "span", client.status, statusClass(client.status));

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "table-action-button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => openClientEditor(client));

    const bookLink = document.createElement("a");
    bookLink.className = "table-action-button table-book-link";
    bookLink.href = `ayesha.html?client=${encodeURIComponent(client.id)}`;
    bookLink.textContent = "Book";

    const actionGroup = document.createElement("div");
    actionGroup.className = "table-action-group";
    actionGroup.append(bookLink, editButton);
    actionCell.append(actionGroup);

    row.append(
      nameCell,
      typeCell,
      paperworkCell,
      supportCell,
      sessionsCell,
      feeCell,
      statusCell,
      actionCell,
    );
    return row;
  }

  function updateCounts() {
    counts.all.textContent = String(clients.length);
    counts.active.textContent = String(
      clients.filter((client) => client.status === "Active").length,
    );
    counts.individuals.textContent = String(
      clients.filter((client) => client.record_type === "Individual").length,
    );
    counts.couples.textContent = String(
      clients.filter((client) => client.record_type === "Couple").length,
    );
  }

  function renderClients() {
    const query = controls.search.value.trim().toLowerCase();
    const status = controls.statusFilter.value;
    const type = controls.typeFilter.value;
    const filteredClients = clients.filter((client) => {
      return (
        (!query || normalisedSearchText(client).includes(query)) &&
        (!status || client.status === status) &&
        (!type || client.record_type === type)
      );
    });

    controls.tableBody.replaceChildren(
      ...filteredClients.map(renderClientRow),
    );
    controls.loading.hidden = true;
    controls.empty.hidden = filteredClients.length > 0;
    controls.tableWrap.hidden = filteredClients.length === 0;
    controls.empty.textContent =
      clients.length === 0
        ? "No client records yet. Use Add client to create the first one."
        : "No clients match these filters.";
    updateCounts();
  }

  async function loadClients() {
    controls.loading.hidden = false;
    controls.empty.hidden = true;
    controls.tableWrap.hidden = true;
    controls.message.textContent = "";

    const { data, error } = await supabaseClient
      .from("clients")
      .select(selectedColumns)
      .order("surname", { ascending: true })
      .order("first_name", { ascending: true });

    if (error) {
      controls.loading.hidden = true;
      controls.message.textContent =
        "Client records could not be loaded. Please sign out and try again.";
      console.error(error);
      return;
    }

    clients = data || [];
    renderClients();
  }

  function updateConditionalFields() {
    const isCouple = controls.form.elements.recordType.value === "Couple";
    controls.secondPersonFields.hidden = !isCouple;
    controls.firstPersonLegend.textContent = isCouple
      ? "First person in couple"
      : "Individual";
    controls.agreedFeeLabel.textContent = isCouple
      ? "Online fee for the couple (£)"
      : "Online fee per session (£)";
    controls.form.elements.secondFirstName.required = isCouple;
    controls.form.elements.secondSurname.required = isCouple;

    const contractSigned =
      controls.form.elements.contractStatus.value === "Signed";
    controls.contractDateField.hidden = !contractSigned;
    controls.form.elements.contractSignedDate.required = contractSigned;
    if (!contractSigned) controls.form.elements.contractSignedDate.value = "";

    const intakeCompleted =
      controls.form.elements.intakeStatus.value === "Completed";
    controls.intakeDateField.hidden = !intakeCompleted;
    controls.form.elements.intakeCompletedDate.required = intakeCompleted;
    if (!intakeCompleted) controls.form.elements.intakeCompletedDate.value = "";

    controls.specialityOtherField.hidden =
      !controls.specialityOtherToggle.checked;
    controls.form.elements.specialityOther.required =
      controls.specialityOtherToggle.checked;
    if (!controls.specialityOtherToggle.checked) {
      controls.form.elements.specialityOther.value = "";
    }
  }

  function setFormValue(name, value) {
    const field = controls.form.elements[name];
    if (field) field.value = value || "";
  }

  function openClientEditor(client = null) {
    controls.form.reset();
    controls.formMessage.textContent = "";
    editingClientId = client?.id || null;
    controls.dialogTitle.textContent = client ? "Edit client" : "Add client";

    if (client) {
      const typeInput = controls.form.querySelector(
        `[name='recordType'][value='${client.record_type}']`,
      );
      if (typeInput) typeInput.checked = true;
      setFormValue("firstName", client.first_name);
      setFormValue("surname", client.surname);
      setFormValue("email", client.email);
      setFormValue("phone", client.phone);
      setFormValue("secondFirstName", client.second_first_name);
      setFormValue("secondSurname", client.second_surname);
      setFormValue("secondEmail", client.second_email);
      setFormValue("secondPhone", client.second_phone);
      setFormValue("contractStatus", client.contract_status);
      setFormValue("contractSignedDate", client.contract_signed_date);
      setFormValue("intakeStatus", client.intake_status);
      setFormValue("intakeCompletedDate", client.intake_completed_date);
      setFormValue("specialityOther", client.speciality_other);
      setFormValue("sessionFrequency", client.session_frequency);
      setFormValue("preferredFormat", client.preferred_format);
      setFormValue("frequencyNotes", client.frequency_notes);
      setFormValue(
        "agreedOnlineFee",
        client.agreed_online_fee_gbp ?? client.agreed_session_fee_gbp,
      );
      setFormValue(
        "agreedInPersonFee",
        client.agreed_in_person_fee_gbp ?? client.agreed_session_fee_gbp,
      );
      setFormValue("feeArrangement", client.fee_arrangement);
      setFormValue("feeNotes", client.fee_notes);
      setFormValue("status", client.status);
      controls.form
        .querySelectorAll("[name='specialities']")
        .forEach((checkbox) => {
          checkbox.checked = (client.specialities || []).includes(checkbox.value);
        });
    }

    updateConditionalFields();
    controls.dialog.showModal();
    window.setTimeout(() => controls.form.elements.firstName.focus(), 0);
  }

  function clientPayload() {
    const formData = new FormData(controls.form);
    const specialities = formData.getAll("specialities");
    const isCouple = formData.get("recordType") === "Couple";
    const feeArrangement = formData.get("feeArrangement");
    const onlineFeeInput = String(formData.get("agreedOnlineFee") || "").trim();
    const inPersonFeeInput =
      String(formData.get("agreedInPersonFee") || "").trim();

    return {
      record_type: formData.get("recordType"),
      status: formData.get("status"),
      first_name: String(formData.get("firstName") || "").trim(),
      surname: String(formData.get("surname") || "").trim(),
      email: String(formData.get("email") || "").trim() || null,
      phone: String(formData.get("phone") || "").trim() || null,
      second_first_name: isCouple
        ? String(formData.get("secondFirstName") || "").trim()
        : null,
      second_surname: isCouple
        ? String(formData.get("secondSurname") || "").trim()
        : null,
      second_email: isCouple
        ? String(formData.get("secondEmail") || "").trim() || null
        : null,
      second_phone: isCouple
        ? String(formData.get("secondPhone") || "").trim() || null
        : null,
      contract_status: formData.get("contractStatus"),
      contract_signed_date: formData.get("contractSignedDate") || null,
      intake_status: formData.get("intakeStatus"),
      intake_completed_date: formData.get("intakeCompletedDate") || null,
      specialities,
      speciality_other:
        String(formData.get("specialityOther") || "").trim() || null,
      session_frequency: formData.get("sessionFrequency"),
      frequency_notes:
        String(formData.get("frequencyNotes") || "").trim() || null,
      preferred_format: formData.get("preferredFormat"),
      agreed_online_fee_gbp:
        feeArrangement === "Complimentary"
          ? 0
          : onlineFeeInput
            ? Number(onlineFeeInput)
            : null,
      agreed_in_person_fee_gbp:
        feeArrangement === "Complimentary"
          ? 0
          : inPersonFeeInput
            ? Number(inPersonFeeInput)
            : null,
      fee_arrangement: feeArrangement,
      fee_notes: String(formData.get("feeNotes") || "").trim() || null,
    };
  }

  controls.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!controls.form.reportValidity()) return;

    controls.saveButton.disabled = true;
    controls.saveButton.textContent = "Saving...";
    controls.formMessage.textContent = "";

    try {
      const payload = clientPayload();
      const query = editingClientId
        ? supabaseClient
            .from("clients")
            .update(payload)
            .eq("id", editingClientId)
        : supabaseClient.from("clients").insert(payload);
      const { data, error } = await query
        .select(selectedColumns)
        .single();

      if (error) throw error;

      if (editingClientId) {
        clients = clients.map((client) =>
          client.id === editingClientId ? data : client,
        );
      } else {
        clients.push(data);
      }

      clients.sort((first, second) => {
        return `${first.surname} ${first.first_name}`.localeCompare(
          `${second.surname} ${second.first_name}`,
        );
      });
      controls.dialog.close();
      controls.message.textContent = editingClientId
        ? "Client record updated."
        : "Client record added.";
      renderClients();
    } catch (error) {
      controls.formMessage.textContent =
        "The client record could not be saved. Please check the fields and try again.";
      console.error(error);
    } finally {
      controls.saveButton.disabled = false;
      controls.saveButton.textContent = "Save client";
    }
  });

  controls.addButton.addEventListener("click", () => openClientEditor());
  document.querySelector("#close-client-dialog").addEventListener(
    "click",
    () => controls.dialog.close(),
  );
  document.querySelector("#cancel-client").addEventListener(
    "click",
    () => controls.dialog.close(),
  );
  controls.dialog.addEventListener("click", (event) => {
    if (event.target === controls.dialog) controls.dialog.close();
  });
  controls.form
    .querySelectorAll(
      "[name='recordType'], [name='contractStatus'], [name='intakeStatus'], #speciality-other-toggle",
    )
    .forEach((field) => {
      field.addEventListener("change", updateConditionalFields);
    });
  [controls.search, controls.statusFilter, controls.typeFilter].forEach(
    (field) => {
      field.addEventListener("input", renderClients);
      field.addEventListener("change", renderClients);
    },
  );

  loadClients();
})();
