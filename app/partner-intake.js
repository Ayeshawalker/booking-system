(function () {
  const form = document.querySelector("#partner-intake-form");
  const source = document.querySelector("#partner-intake-source");
  const loading = document.querySelector("#partner-intake-loading");
  const errorBox = document.querySelector("#partner-intake-error");
  const message = document.querySelector("#partner-intake-message");
  const token = new URLSearchParams(location.search).get("token") || "";
  const config = window.BOOKING_CONFIG || {};
  let questionNumber = 0;
  const nextName = () => `partner_q_${String(++questionNumber).padStart(3, "0")}`;
  const text = (node) => String(node.textContent || "").trim();
  const isLine = (node) => /^_{20,}$/.test(text(node));

  [...source.querySelectorAll("p")].forEach((node) => {
    if (/^\d+\.\s/.test(text(node))) { node.outerHTML = `<h2>${node.innerHTML}</h2>`; }
  });
  [...source.querySelectorAll("p")].forEach((line) => {
    if (!isLine(line)) return;
    let question = line.previousElementSibling;
    while (question && isLine(question)) question = question.previousElementSibling;
    if (!question || question.querySelector("textarea,input,select")) { line.remove(); return; }
    const label = document.createElement("label");
    question.replaceWith(label); label.append(...question.childNodes);
    const input = document.createElement(text(label).startsWith("Full name (electronic signature)") ? "input" : "textarea");
    input.name = text(label).startsWith("Full name (electronic signature)") ? "signerName" : nextName();
    if (input.tagName === "TEXTAREA") input.rows = 4;
    else { input.required = true; input.autocomplete = "name"; }
    label.append(input); line.remove();
  });
  [...source.querySelectorAll("p")].filter(isLine).forEach((line) => line.remove());

  [...source.querySelectorAll("table")].forEach((table) => {
    let prompt = table.previousElementSibling;
    while (prompt && !text(prompt)) prompt = prompt.previousElementSibling;
    const groupName = nextName();
    const choices = document.createElement("div"); choices.className = "form-grid";
    [...table.querySelectorAll("p")].forEach((item) => {
      const wording = text(item).replace(/^☐\s*/, "");
      if (!wording) return;
      const label = document.createElement("label"); label.className = "agreement-choice";
      const input = document.createElement("input"); input.type = "checkbox"; input.name = groupName; input.value = wording;
      if (wording.startsWith("I have shared what I feel able")) input.name = "confirmAccurate";
      if (wording.startsWith("I understand that submitting this form")) input.name = "confirmNotEmergency";
      if (wording.startsWith("I understand that this form supports assessment")) input.name = "confirmAssessment";
      if (["confirmAccurate", "confirmNotEmergency", "confirmAssessment"].includes(input.name) || wording.startsWith("I understand that exploring factors")) input.required = true;
      label.append(input, document.createTextNode(` ${wording}`)); choices.append(label);
    });
    table.replaceWith(choices);
  });

  async function call(action, extra) {
    const response = await fetch(`${config.supabaseUrl}/functions/v1/intake-form`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: config.supabaseAnonKey, Authorization: `Bearer ${config.supabaseAnonKey}` },
      body: JSON.stringify({ action, token, ...(extra || {}) }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "The intake form could not be opened.");
    return result;
  }
  function answers() {
    const output = {};
    for (const [key, value] of new FormData(form)) {
      if (["signerName", "confirmAccurate", "confirmNotEmergency", "confirmAssessment"].includes(key)) continue;
      output[key] = key in output ? (Array.isArray(output[key]) ? [...output[key], value] : [output[key], value]) : value;
    }
    return output;
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault(); const data = new FormData(form); message.textContent = "Saving your form securely…";
    const button = form.querySelector("button[type=submit]"); button.disabled = true;
    try {
      await call("submit", { answers: answers(), signerName: data.get("signerName"), confirmAccurate: data.has("confirmAccurate"), confirmNotEmergency: data.has("confirmNotEmergency"), confirmAssessment: data.has("confirmAssessment") });
      form.innerHTML = '<section class="agreement-public-state"><h2>Thank you</h2><p>Your signed intake form has been received securely by Ayesha.</p><p>You may now close this page.</p></section>';
      scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) { message.textContent = error.message; button.disabled = false; }
  });
  (async () => {
    try {
      if (!token) throw new Error("This intake link is incomplete.");
      const intake = (await call("view")).intake;
      if (intake.form_type !== "Partner betrayal trauma") throw new Error("This link is for a different intake form.");
      loading.hidden = true;
      if (intake.status === "Completed") { errorBox.hidden = false; errorBox.innerHTML = "<h2>Already completed</h2><p>This signed form has already been received securely. Thank you.</p>"; return; }
      form.hidden = false;
    } catch (error) { loading.hidden = true; errorBox.hidden = false; errorBox.textContent = error.message; }
  })();
})();
