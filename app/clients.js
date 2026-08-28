(async function setupClientDirectory() {
  const admin = await window.ADMIN_READY;
  const supabaseClient = admin.client;
  const controls = {
    addButton: document.querySelector("#add-client"),
    formerClientsButton: document.querySelector("#former-clients"),
    search: document.querySelector("#client-search"),
    statusFilter: document.querySelector("#client-status-filter"),
    typeFilter: document.querySelector("#client-type-filter"),
    supportFilter: document.querySelector("#client-support-filter"),
    frequencyFilter: document.querySelector("#client-frequency-filter"),
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
    deleteButton: document.querySelector("#delete-client"),
    firstPersonLegend: document.querySelector("#first-person-legend"),
    secondPersonFields: document.querySelector("#second-person-fields"),
    agreedFeeLabel: document.querySelector("#agreed-fee-label"),
    contractDateField: document.querySelector("#contract-date-field"),
    intakeDateField: document.querySelector("#intake-date-field"),
    specialityOtherToggle: document.querySelector("#speciality-other-toggle"),
    specialityOtherField: document.querySelector("#speciality-other-field"),
    contractDialog: document.querySelector("#contract-dialog"),
    contractDialogTitle: document.querySelector("#contract-dialog-title"),
    contractExplanation: document.querySelector("#contract-explanation"),
    contractStatus: document.querySelector("#contract-current-status"),
    contractFeePreview: document.querySelector("#contract-fee-preview"),
    contractLinkPanel: document.querySelector("#contract-link-panel"),
    contractSigningLink: document.querySelector("#contract-signing-link"),
    contractMessage: document.querySelector("#contract-dialog-message"),
    createContractButton: document.querySelector("#create-contract-link"),
    cancelContractButton: document.querySelector("#cancel-current-contract"),
    contractType: document.querySelector("#contract-type"),
    contractTypeField: document.querySelector("#contract-type-field"),
    intakeDialog: document.querySelector("#intake-dialog"),
    intakeDialogTitle: document.querySelector("#intake-dialog-title"),
    intakeStatus: document.querySelector("#intake-current-status"),
    intakeLinkPanel: document.querySelector("#intake-link-panel"),
    intakeSigningLink: document.querySelector("#intake-signing-link"),
    intakeMessage: document.querySelector("#intake-dialog-message"),
    createIntakeButton: document.querySelector("#create-intake-link"),
    cancelIntakeButton: document.querySelector("#cancel-current-intake"),
    intakeResponsePanel: document.querySelector("#intake-response-panel"),
    intakeAnswers: document.querySelector("#intake-answers"),
    intakeSignedBy: document.querySelector("#intake-signed-by"),
    intakeFormType: document.querySelector("#intake-form-type"),
    intakeFormTypeField: document.querySelector("#intake-form-type-field"),
  };
  const counts = {
    all: document.querySelector("#client-count-all"),
    active: document.querySelector("#client-count-active"),
    paused: document.querySelector("#client-count-paused"),
    individuals: document.querySelector("#client-count-individuals"),
    couples: document.querySelector("#client-count-couples"),
    weekly: document.querySelector("#client-count-weekly"),
    fortnightly: document.querySelector("#client-count-fortnightly"),
    otherFrequency: document.querySelector("#client-count-other-frequency"),
  };
  const selectedColumns = [
    "id",
    "record_type",
    "status",
    "first_name",
    "surname",
    "email",
    "phone",
    "bank_payment_name",
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
  let contractClient = null;
  let currentAgreement = null;
  let intakeClient = null;
  let currentIntake = null;
  let intakeManagerType = null;

  function clientNames(client) {
    const first = [client.first_name, client.surname].filter(Boolean).join(" ");
    const second = [client.second_first_name, client.second_surname]
      .filter(Boolean)
      .join(" ");
    return [first, second].filter(Boolean).join(" and ");
  }

  function sortClientsAlphabetically() {
    clients.sort((first, second) => {
      const options = { sensitivity: "base" };
      return (
        String(first.first_name || "").localeCompare(
          String(second.first_name || ""),
          "en-GB",
          options,
        ) ||
        String(first.surname || "").localeCompare(
          String(second.surname || ""),
          "en-GB",
          options,
        ) ||
        clientNames(first).localeCompare(clientNames(second), "en-GB", options)
      );
    });
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
      client.bank_payment_name,
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
    if (client.bank_payment_name) {
      appendText(
        nameCell,
        "small",
        `Bank payment: ${client.bank_payment_name}`,
        "bank-payment-name",
      );
    }
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

    const contractButton = document.createElement("button");
    contractButton.type = "button";
    contractButton.className = "table-action-button";
    contractButton.textContent = client.contract_status === "Signed" ? "Contract ✓" : "Contract";
    contractButton.addEventListener("click", () => openContractManager(client));

    const formsMenu = document.createElement("select");
    formsMenu.className = "table-action-button table-forms-menu";
    formsMenu.setAttribute("aria-label", `Choose a form for ${clientNames(client)}`);
    [
      ["", "Forms ▾"],
      ["Individual", "General intake"],
      ["Betrayal trauma", "Betrayal trauma intake"],
      ["Impact statement", "Impact Statement"],
    ].forEach(([value, label]) => {
      const option = document.createElement("option"); option.value = value; option.textContent = label; formsMenu.append(option);
    });
    formsMenu.addEventListener("change", () => {
      const formType = formsMenu.value;
      formsMenu.value = "";
      if (formType) openIntakeManager(client, formType);
    });

    const actionGroup = document.createElement("div");
    actionGroup.className = "table-action-group";
    actionGroup.append(bookLink, contractButton, formsMenu, editButton);
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

  function agreementSigningUrl(token) {
    const baseUrl = window.BOOKING_CONFIG?.publicClientBaseUrl || window.location.href;
    const url = new URL("sign-agreement.html", baseUrl);
    url.searchParams.set("token", token);
    return url.href;
  }

  function agreedFeesForContract(client, type) {
    const onlineValue = client.agreed_online_fee_gbp ?? client.agreed_session_fee_gbp;
    const inPersonValue = client.agreed_in_person_fee_gbp;
    const hasOnlineFee = onlineValue !== null && onlineValue !== undefined && onlineValue !== "";
    const hasInPersonFee = inPersonValue !== null && inPersonValue !== undefined && inPersonValue !== "";
    if (!hasOnlineFee && !hasInPersonFee) {
      throw new Error("Please add this client's agreed fee before creating the agreement.");
    }
    const sessionLength = type === "Couple" ? "80-minute couples session" : "50-minute individual session";
    const feeLines = [];
    if (hasOnlineFee) {
      feeLines.push(`- Online ${sessionLength}: **${formatFee(onlineValue)}**`);
    }
    if (hasInPersonFee) {
      feeLines.push(`- In-person ${sessionLength}: **${formatFee(inPersonValue)}**`);
    }
    return [
      ...feeLines,
    ].join("\n");
  }

  function contractFeeSummary(client) {
    const onlineValue = client.agreed_online_fee_gbp ?? client.agreed_session_fee_gbp;
    const inPersonValue = client.agreed_in_person_fee_gbp;
    const fees = [];
    if (onlineValue !== null && onlineValue !== undefined && onlineValue !== "") {
      fees.push(`Online ${formatFee(onlineValue)}`);
    }
    if (inPersonValue !== null && inPersonValue !== undefined && inPersonValue !== "") {
      fees.push(`In person ${formatFee(inPersonValue)}`);
    }
    return fees.length ? fees.join(" · ") : "No fee is currently recorded";
  }

  function showContractFee(client) {
    controls.contractFeePreview.textContent = `Fee that will appear: ${contractFeeSummary(client)}`;
  }

  function showAgreement(agreement) {
    currentAgreement = agreement || null;
    const hasAgreement = Boolean(agreement);
    controls.contractFeePreview.hidden = hasAgreement;
    controls.contractLinkPanel.hidden = !hasAgreement;
    controls.cancelContractButton.hidden = !hasAgreement || agreement.status === "Signed";
    controls.createContractButton.hidden = hasAgreement;
    controls.contractTypeField.hidden = hasAgreement;
    if (!hasAgreement) {
      controls.contractStatus.textContent = "No active signing link has been created yet.";
      return;
    }
    const url = agreementSigningUrl(agreement.access_token);
    controls.contractSigningLink.value = url;
    document.querySelector("#preview-contract-link").href = url;
    const message = `Hello, here is your private ${agreement.agreement_type.toLowerCase()} therapy agreement to read and sign: ${url}`;
    document.querySelector("#whatsapp-contract-link").href = `https://wa.me/?text=${encodeURIComponent(message)}`;
    const signed = agreement.status === "Signed" ? "Complete" : agreement.status;
    controls.contractStatus.textContent = `${agreement.agreement_type} agreement · ${signed}`;
  }

  async function openContractManager(client) {
    contractClient = client;
    showContractFee(client);
    controls.contractMessage.textContent = "";
    controls.contractDialogTitle.textContent = clientNames(client);
    controls.contractExplanation.textContent = client.record_type === "Couple"
      ? "This couples agreement requires a separate electronic signature from each person. Both can use the same private link."
      : "This individual agreement records the client's electronic signature and communication preference.";
    const isCouple = client.record_type === "Couple";
    [...controls.contractType.options].forEach((option) => {
      option.hidden = isCouple ? option.value !== "Couple" : option.value === "Couple";
    });
    controls.contractType.value = isCouple
      ? "Couple"
      : (client.specialities || []).includes("Betrayal trauma")
        ? "Betrayal trauma"
        : "Standard individual";
    showAgreement(null);
    controls.contractDialog.showModal();
    const { data, error } = await supabaseClient.from("client_agreements")
      .select("id,agreement_type,agreement_version,access_token,status,signer_one_signed_at,signer_two_signed_at,created_at")
      .eq("client_id", client.id).neq("status", "Cancelled")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) {
      controls.contractMessage.textContent = error.message.includes("client_agreements")
        ? "Agreement setup has not been run in Supabase yet."
        : "The agreement status could not be loaded.";
      return;
    }
    showAgreement(data);
  }

  async function createContractLink() {
    if (!contractClient) return;
    controls.createContractButton.disabled = true;
    controls.contractMessage.textContent = "Checking the latest saved fee…";
    try {
      const type = controls.contractType.value;
      const { data: latestClient, error: clientError } = await supabaseClient
        .from("clients")
        .select(selectedColumns)
        .eq("id", contractClient.id)
        .single();
      if (clientError) throw new Error("The latest saved client fee could not be checked.");
      contractClient = latestClient;
      clients = clients.map((client) => client.id === latestClient.id ? latestClient : client);
      showContractFee(latestClient);
      agreedFeesForContract(latestClient, type);
      const confirmed = window.confirm(
        `The agreement will show:\n\n${contractFeeSummary(latestClient)}\n\nCreate this signing link?`,
      );
      if (!confirmed) {
        controls.contractMessage.textContent = "No signing link was created.";
        return;
      }
      controls.contractMessage.textContent = "Creating the private signing link…";
      const files = {
        "Standard individual": "contracts/individual-therapy-agreement-draft.md",
        "Betrayal trauma": "contracts/betrayal-trauma-agreement-draft.md",
        Couple: "contracts/couples-therapy-agreement-draft.md",
      };
      const file = files[type];
      const response = await fetch(file, { cache: "no-store" });
      if (!response.ok) throw new Error("The agreement draft could not be loaded.");
      const agreementTemplate = await response.text();
      const agreementText = agreementTemplate.replace(
        "{{AGREED_FEES}}",
        agreedFeesForContract(contractClient, type),
      );
      const firstName = [contractClient.first_name, contractClient.surname].filter(Boolean).join(" ");
      const secondName = [contractClient.second_first_name, contractClient.second_surname].filter(Boolean).join(" ");
      const { data, error } = await supabaseClient.from("client_agreements").insert({
        client_id: contractClient.id, agreement_type: type,
        agreement_version: "2026-08-25", agreement_text: agreementText,
        signer_one_expected_name: firstName,
        signer_two_expected_name: type === "Couple" ? secondName : null,
        created_by: admin.user.id,
      }).select("id,agreement_type,agreement_version,access_token,status,created_at").single();
      if (error) throw error;
      await supabaseClient.from("clients").update({ contract_status: "Sent", contract_signed_date: null }).eq("id", contractClient.id);
      contractClient.contract_status = "Sent";
      contractClient.contract_signed_date = null;
      showAgreement(data);
      controls.contractMessage.textContent = "The signing link is ready to send.";
      renderClients();
    } catch (error) {
      controls.contractMessage.textContent = error.message || "The signing link could not be created.";
    } finally { controls.createContractButton.disabled = false; }
  }

  async function cancelContractLink() {
    if (!currentAgreement || !window.confirm("Cancel this signing link? It will stop working immediately.")) return;
    const { error } = await supabaseClient.from("client_agreements").update({ status: "Cancelled", updated_at: new Date().toISOString() }).eq("id", currentAgreement.id);
    if (error) { controls.contractMessage.textContent = "The link could not be cancelled."; return; }
    await supabaseClient.from("clients").update({ contract_status: "Not sent", contract_signed_date: null }).eq("id", contractClient.id);
    contractClient.contract_status = "Not sent";
    showAgreement(null); renderClients();
    controls.contractMessage.textContent = "The old link has been cancelled. You can create a new one.";
  }

  function intakeSigningUrl(token, formType) {
    const baseUrl = window.BOOKING_CONFIG?.publicClientBaseUrl || window.location.href;
    const url = new URL(formType === "Impact statement" ? "impact-statement.html" : "sign-intake.html", baseUrl);
    url.searchParams.set("token", token);
    return url.href;
  }

  const intakeLabels = {
    preferred_name: "What name would you prefer me to use?", pronouns: "What pronouns do you use?",
    date_of_birth: "What is your date of birth?", address: "What is your address?",
    email: "What is your email address?", phone: "What is your telephone number?",
    safe_contact: "Is it safe to contact you by WhatsApp, telephone or email?",
    emergency_contact: "Who is your emergency contact, what is their relationship to you, and what is their telephone number?",
    relationship_context: "What is the present relationship situation?",
    what_happened: "Please tell me, in your own words, what has brought you to therapy.",
    discovery_timing: "How long ago did you become aware of the betrayal, or how long have these difficulties been affecting you?",
    betrayal_nature: "Which betrayal experiences are relevant to you?",
    betrayal_nature_other: "If you selected ‘Other’, how would you describe the betrayal experience?",
    discovery_pattern: "Was there one main discovery or disclosure, or have there been several?",
    discovery_method: "Was the betrayal disclosed by your partner, discovered by you, or did you become aware in another way?",
    betrayal_impact_summary: "How would you describe the impact of the betrayal on you?",
    current_contact: "Are you currently in contact with the other person?",
    children: "Are there children or dependants affected by the situation?",
    legal_processes: "Are there legal, separation or divorce processes underway?",
    living_arrangements: "What are your current living arrangements?",
    daily_impact: "How is this affecting your day-to-day life and relationships?",
    emotional_impact: "How is this affecting you emotionally?",
    physical_impact: "How is this affecting you physically, including your sleep or appetite?",
    work_impact: "How is this affecting your work, study or caring responsibilities?",
    sexual_wellbeing_impact: "Has the betrayal affected your sexual wellbeing, sexual relationship, sense of sexual safety, desire, confidence or how you experience your sexuality?",
    safety_concerns: "Is there anything about your current relationship or home situation that leaves you feeling unsafe, frightened, pressured or unable to make your own choices?",
    contact_safety: "Is there anything that would help me contact or support you safely?",
    coping_responses: "What have you found yourself doing to cope or get through this?",
    support_network: "Who, if anyone, currently supports you?",
    partner_support: "If you know, is your partner currently receiving any support connected with the betrayal or related behaviours?",
    partner_support_details: "Is there anything relevant you would like me to know about your partner’s support, recovery work or willingness to seek help?",
    attachment_distance_worry: "When someone important feels distant, do you worry about rejection or losing the relationship?",
    attachment_reassurance: "Do you look for reassurance that the relationship is secure?",
    attachment_uncertainty: "How difficult does uncertainty in a relationship feel to tolerate?",
    attachment_self_reliance: "When you feel hurt or overwhelmed, do you tend to pull back or manage things on your own?",
    attachment_vulnerability: "Does depending on others or being emotionally vulnerable feel uncomfortable?",
    attachment_push_pull: "Do you sometimes want closeness and, at other times, feel a strong need for distance?",
    attachment_pattern_notes: "When relationships feel uncertain, what do you notice in your thoughts, feelings or actions?",
    attachment_security_needs: "What helps you feel safe, connected and able to trust?",
    childhood_environment: "How would you describe your childhood environment?",
    family_origin_experiences: "Which of these experiences were present in your family while you were growing up?",
    family_origin_context: "Is there anything about your early relationships or caregiving that feels relevant to your support now?",
    previous_therapy: "What previous counselling, therapy or other support have you had?",
    health_information: "Is there any physical or mental-health information that may be helpful for me to know?",
    medication: "Are you taking any current medication that may be relevant?",
    risk_thoughts: "Have you recently had thoughts of harming yourself, ending your life, or harming someone else?",
    risk_details: "What would be helpful for me to understand about those thoughts or concerns?",
    protective_factors: "What helps you stay safe, and who could you contact if things became more difficult?",
    therapy_hopes: "What are you hoping for from therapy?",
    therapy_success_difference: "If therapy were helpful or successful, what differences would you notice in yourself, your relationships or your life?",
    therapy_early_sign: "What might be the first small sign that things were beginning to improve?",
    important_context: "Is there anything else that feels important for me to know before we begin?",
    access_needs: "Are there any accessibility, communication or cultural needs you would like me to know about?",
  };

  function renderIntakeAnswers(answers) {
    controls.intakeAnswers.replaceChildren();
    Object.entries(answers || {}).forEach(([key, value]) => {
      if (value === "" || (Array.isArray(value) && !value.length)) return;
      const item = document.createElement("div");
      item.className = "intake-answer-item";
      const heading = document.createElement("h4");
      heading.textContent = intakeLabels[key] || key.replaceAll("_", " ");
      const copy = document.createElement("p");
      copy.textContent = Array.isArray(value) ? value.join(", ") : String(value);
      item.append(heading, copy); controls.intakeAnswers.append(item);
    });
  }

  function showIntake(intake) {
    currentIntake = intake || null;
    const exists = Boolean(intake);
    controls.intakeLinkPanel.hidden = !exists;
    controls.createIntakeButton.hidden = exists;
    controls.intakeFormTypeField.hidden = exists;
    controls.cancelIntakeButton.hidden = !exists || intake.status === "Completed";
    controls.intakeResponsePanel.hidden = !exists || intake.status !== "Completed";
    if (!exists) { controls.intakeStatus.textContent = "No active intake link has been created yet."; return; }
    const url = intakeSigningUrl(intake.access_token, intake.form_type);
    controls.intakeSigningLink.value = url;
    document.querySelector("#open-intake-link").href = url;
    const firstName = intakeClient.first_name || "there";
    const formLabel = intake.form_type === "Impact statement" ? "Impact Statement" : intake.form_type === "Betrayal trauma" ? "betrayal trauma therapy intake form" : "therapy intake form";
    const text = `Hi ${firstName}, here is your private ${formLabel} to complete: ${url}`;
    document.querySelector("#whatsapp-intake-link").href = `https://wa.me/?text=${encodeURIComponent(text)}`;
    controls.intakeStatus.textContent = `${intake.form_type}${intake.form_type === "Impact statement" ? "" : " intake"} · ${intake.status}`;
    if (intake.status === "Completed") {
      const signedDate = intake.signed_at ? new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(new Date(intake.signed_at)) : "date unavailable";
      controls.intakeSignedBy.textContent = `Electronically signed by ${intake.signer_name || "client"} on ${signedDate}.`;
      renderIntakeAnswers(intake.answers);
    }
  }

  async function openIntakeManager(client, requestedType = null) {
    intakeClient = client; controls.intakeMessage.textContent = "";
    intakeManagerType = requestedType;
    const specialities = Array.isArray(client.specialities) ? client.specialities : [];
    controls.intakeFormType.value = requestedType || (specialities.includes("Betrayal trauma") ? "Betrayal trauma" : "Individual");
    const documentLabel = requestedType === "Impact statement" ? "Impact Statement" : requestedType === "Betrayal trauma" ? "Betrayal trauma intake" : requestedType === "Individual" ? "General intake" : "Intake form";
    controls.intakeDialogTitle.textContent = `${documentLabel} · ${clientNames(client)}`; showIntake(null);
    controls.intakeFormTypeField.hidden = requestedType === "Impact statement";
    controls.intakeDialog.showModal();
    let query = supabaseClient.from("client_intake_forms")
      .select("id,form_type,form_version,access_token,status,answers,signer_name,signed_at,created_at")
      .eq("client_id", client.id).neq("status", "Cancelled")
      .order("created_at", { ascending: false }).limit(1);
    query = requestedType ? query.eq("form_type", requestedType) : query.neq("form_type", "Impact statement");
    const { data: rows, error } = await query;
    const data = rows?.[0] || null;
    if (error) {
      controls.intakeMessage.textContent = error.message.includes("client_intake_forms")
        ? "The one-time intake setup has not been run in Supabase yet."
        : "The intake status could not be loaded.";
      return;
    }
    showIntake(data);
  }

  async function createIntakeLink() {
    if (!intakeClient) return;
    controls.createIntakeButton.disabled = true; controls.intakeMessage.textContent = "Creating the private form link…";
    const { data, error } = await supabaseClient.from("client_intake_forms").insert({
      client_id: intakeClient.id, form_type: intakeManagerType || controls.intakeFormType.value, form_version: "2026-08-27", created_by: admin.user.id,
    }).select("id,form_type,form_version,access_token,status,answers,signer_name,signed_at,created_at").single();
    if (error) controls.intakeMessage.textContent = "The link could not be created. " + error.message;
    else {
      if ((intakeManagerType || controls.intakeFormType.value) !== "Impact statement") {
        await supabaseClient.from("clients").update({ intake_status: "Sent", intake_completed_date: null }).eq("id", intakeClient.id);
        intakeClient.intake_status = "Sent"; intakeClient.intake_completed_date = null;
      }
      showIntake(data); controls.intakeMessage.textContent = "The private intake link is ready to test or send."; renderClients();
    }
    controls.createIntakeButton.disabled = false;
  }

  async function cancelIntakeLink() {
    if (!currentIntake || !window.confirm("Cancel this intake link? It will stop working immediately.")) return;
    const { error } = await supabaseClient.from("client_intake_forms").update({ status: "Cancelled", updated_at: new Date().toISOString() }).eq("id", currentIntake.id);
    if (error) { controls.intakeMessage.textContent = "The link could not be cancelled."; return; }
    if (currentIntake.form_type !== "Impact statement") {
      await supabaseClient.from("clients").update({ intake_status: "Not sent", intake_completed_date: null }).eq("id", intakeClient.id);
      intakeClient.intake_status = "Not sent";
    }
    showIntake(null); renderClients();
    controls.intakeMessage.textContent = "The old link has been cancelled. You can create a new one.";
  }

  function updateCounts() {
    const formerCount = clients.filter((client) => client.status === "Former").length;
    counts.all.textContent = String(clients.length);
    counts.active.textContent = String(
      clients.filter((client) => client.status === "Active").length,
    );
    counts.paused.textContent = String(
      clients.filter((client) => client.status === "Paused").length,
    );
    counts.individuals.textContent = String(
      clients.filter((client) => client.record_type === "Individual").length,
    );
    counts.couples.textContent = String(
      clients.filter((client) => client.record_type === "Couple").length,
    );
    counts.weekly.textContent = String(
      clients.filter((client) => client.session_frequency === "Weekly").length,
    );
    counts.fortnightly.textContent = String(
      clients.filter((client) => client.session_frequency === "Fortnightly")
        .length,
    );
    counts.otherFrequency.textContent = String(
      clients.filter(
        (client) =>
          !["Weekly", "Fortnightly"].includes(client.session_frequency),
      ).length,
    );
    controls.formerClientsButton.textContent = `Former clients (${formerCount})`;
  }

  function renderClients() {
    const query = controls.search.value.trim().toLowerCase();
    const status = controls.statusFilter.value;
    const type = controls.typeFilter.value;
    const support = controls.supportFilter.value;
    const frequency = controls.frequencyFilter.value;
    const filteredClients = clients.filter((client) => {
      const frequencyMatches =
        !frequency ||
        client.session_frequency === frequency ||
        (frequency === "Other" &&
          !["Weekly", "Fortnightly"].includes(client.session_frequency));
      return (
        (!query || normalisedSearchText(client).includes(query)) &&
        (status ? client.status === status : client.status !== "Former") &&
        (!type || client.record_type === type) &&
        (!support || (client.specialities || []).includes(support)) &&
        frequencyMatches
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
    const showingFormer = status === "Former";
    controls.formerClientsButton.setAttribute("aria-pressed", String(showingFormer));
    controls.formerClientsButton.classList.toggle("is-active", showingFormer);
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
      .order("first_name", { ascending: true })
      .order("surname", { ascending: true });

    if (error) {
      controls.loading.hidden = true;
      controls.message.textContent =
        "Client records could not be loaded. Please sign out and try again.";
      console.error(error);
      return;
    }

    clients = data || [];
    sortClientsAlphabetically();
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
    controls.deleteButton.hidden = !client;

    if (client) {
      const typeInput = controls.form.querySelector(
        `[name='recordType'][value='${client.record_type}']`,
      );
      if (typeInput) typeInput.checked = true;
      setFormValue("firstName", client.first_name);
      setFormValue("surname", client.surname);
      setFormValue("email", client.email);
      setFormValue("phone", client.phone);
      setFormValue("bankPaymentName", client.bank_payment_name);
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
      bank_payment_name:
        String(formData.get("bankPaymentName") || "").trim() || null,
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

      sortClientsAlphabetically();
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

  controls.deleteButton.addEventListener("click", async () => {
    const client = clients.find((item) => item.id === editingClientId);
    if (!client) {
      window.alert("This client record could not be found. Please close the box, refresh the page and try again.");
      return;
    }
    const name = clientNames(client);
    const confirmed = window.confirm(
      `Permanently delete ${name}?\n\nOnly continue if this is the duplicate record. This cannot be undone.`,
    );
    if (!confirmed) return;
    controls.deleteButton.disabled = true;
    controls.deleteButton.textContent = "Deleting...";
    controls.formMessage.textContent = "";
    try {
      const { error } = await supabaseClient
        .from("clients")
        .delete()
        .eq("id", client.id);
      if (error) throw error;
      clients = clients.filter((item) => item.id !== client.id);
      controls.dialog.close();
      controls.message.textContent = `${name} was deleted.`;
      renderClients();
    } catch (error) {
      controls.deleteButton.disabled = false;
      controls.deleteButton.textContent = "Delete client";
      controls.formMessage.textContent =
        "This client could not be deleted, usually because sessions, notes or payments are attached to this record.";
      console.error("Client deletion failed.", error);
      window.alert(
        `${name} could not be deleted because this record appears to have sessions, notes or payments attached. No information has been removed.`,
      );
    }
  });

  controls.addButton.addEventListener("click", () => openClientEditor());
  controls.formerClientsButton.addEventListener("click", () => {
    const showingFormer = controls.statusFilter.value === "Former";
    controls.statusFilter.value = showingFormer ? "" : "Former";
    renderClients();
  });
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
  document.querySelector("#close-contract-dialog").addEventListener("click", () => controls.contractDialog.close());
  controls.contractDialog.addEventListener("click", (event) => {
    if (event.target === controls.contractDialog) controls.contractDialog.close();
  });
  controls.createContractButton.addEventListener("click", createContractLink);
  controls.cancelContractButton.addEventListener("click", cancelContractLink);
  document.querySelector("#copy-contract-link").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(controls.contractSigningLink.value);
      controls.contractMessage.textContent = "Signing link copied. You can now paste it into WhatsApp or an email.";
    } catch (_) {
      controls.contractSigningLink.select();
      controls.contractMessage.textContent = "The link is selected. Press Command and C to copy it.";
    }
  });
  document.querySelector("#close-intake-dialog").addEventListener("click", () => controls.intakeDialog.close());
  controls.intakeDialog.addEventListener("click", (event) => { if (event.target === controls.intakeDialog) controls.intakeDialog.close(); });
  controls.createIntakeButton.addEventListener("click", createIntakeLink);
  controls.cancelIntakeButton.addEventListener("click", cancelIntakeLink);
  document.querySelector("#copy-intake-link").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(controls.intakeSigningLink.value);
      controls.intakeMessage.textContent = `${currentIntake?.form_type === "Impact statement" ? "Impact Statement" : "Intake"} link copied. You can now paste it into WhatsApp or an email.`;
    } catch (_) {
      controls.intakeSigningLink.select();
      controls.intakeMessage.textContent = "The link is selected. Press Command and C to copy it.";
    }
  });
  controls.form
    .querySelectorAll(
      "[name='recordType'], [name='contractStatus'], [name='intakeStatus'], #speciality-other-toggle",
    )
    .forEach((field) => {
      field.addEventListener("change", updateConditionalFields);
    });
  [
    controls.search,
    controls.statusFilter,
    controls.typeFilter,
    controls.supportFilter,
    controls.frequencyFilter,
  ].forEach(
    (field) => {
      field.addEventListener("input", renderClients);
      field.addEventListener("change", renderClients);
    },
  );

  loadClients();
})();
