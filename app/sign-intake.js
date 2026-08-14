(function setupIntakeSigning() {
  const loading = document.querySelector("#intake-loading");
  const errorBox = document.querySelector("#intake-error");
  const form = document.querySelector("#intake-form");
  const message = document.querySelector("#intake-form-message");
  const token = new URLSearchParams(location.search).get("token") || "";
  const config = window.BOOKING_CONFIG || {};
  let intake;

  async function call(action, extra = {}) {
    const response = await fetch(`${config.supabaseUrl}/functions/v1/intake-form`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
      },
      body: JSON.stringify({ action, token, ...extra }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "The intake form could not be opened.");
    return result;
  }
  function answersFromForm() {
    const data = new FormData(form);
    const answers = {};
    for (const [key, value] of data.entries()) {
      if (["signerName", "confirmAccurate", "confirmNotEmergency", "confirmAssessment"].includes(key)) continue;
      if (Object.prototype.hasOwnProperty.call(answers, key)) {
        answers[key] = Array.isArray(answers[key]) ? [...answers[key], value] : [answers[key], value];
      } else answers[key] = value;
    }
    return answers;
  }
  function clearCoreAnswerErrors() {
    ["#what-happened-field", "#therapy-hopes-field"].forEach((selector) => {
      form.querySelector(selector)?.classList.remove("intake-field-invalid");
    });
    ["#intake-core-answer-help", "#intake-goal-answer-help"].forEach((selector) => {
      const help = form.querySelector(selector);
      if (help) help.hidden = true;
    });
  }
  function validateCoreAnswer() {
    clearCoreAnswerErrors();
    const first = form.elements.what_happened;
    const second = form.elements.therapy_hopes;
    if (String(first.value || "").trim() || String(second.value || "").trim()) return true;
    ["#what-happened-field", "#therapy-hopes-field"].forEach((selector) => {
      form.querySelector(selector)?.classList.add("intake-field-invalid");
    });
    ["#intake-core-answer-help", "#intake-goal-answer-help"].forEach((selector) => {
      const help = form.querySelector(selector);
      if (help) help.hidden = false;
    });
    message.textContent = "Please answer one of the two highlighted questions before submitting.";
    first.focus({ preventScroll: true });
    form.querySelector("#what-happened-field")?.scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  }
  form.elements.what_happened.addEventListener("input", clearCoreAnswerErrors);
  form.elements.therapy_hopes.addEventListener("input", clearCoreAnswerErrors);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!validateCoreAnswer()) return;
    const data = new FormData(form);
    message.textContent = "Saving your form securely…";
    form.querySelector("button[type='submit']").disabled = true;
    try {
      await call("submit", {
        answers: answersFromForm(), signerName: data.get("signerName"),
        confirmAccurate: data.get("confirmAccurate") === "on",
        confirmNotEmergency: data.get("confirmNotEmergency") === "on",
        confirmAssessment: data.get("confirmAssessment") === "on",
      });
      form.innerHTML = `<section class="agreement-public-state"><h2>Thank you</h2><p>Your signed intake form has been received securely by Ayesha.</p><p>You may now close this page.</p></section>`;
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      message.textContent = error.message;
      if (/what brings you to therapy|what you hope for/i.test(error.message)) validateCoreAnswer();
      form.querySelector("button[type='submit']").disabled = false;
    }
  });
  (async () => {
    try {
      if (!token) throw new Error("This intake link is incomplete.");
      intake = (await call("view")).intake;
      loading.hidden = true;
      if (intake.status === "Completed") {
        errorBox.hidden = false;
        errorBox.classList.remove("agreement-public-error");
        errorBox.innerHTML = "<h2>Already completed</h2><p>This signed form has already been received securely. Thank you.</p>";
        return;
      }
      form.hidden = false;
      form.elements.preferred_name.value = String(intake.client_name || "").split(" ")[0] || "";
    } catch (error) {
      loading.hidden = true; errorBox.hidden = false; errorBox.textContent = error.message;
    }
  })();
})();
