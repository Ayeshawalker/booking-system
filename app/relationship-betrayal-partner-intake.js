(function () {
  const form = document.querySelector("#initial-partner-form");
  const loading = document.querySelector("#initial-partner-loading");
  const errorBox = document.querySelector("#initial-partner-error");
  const message = document.querySelector("#initial-partner-message");
  const token = new URLSearchParams(location.search).get("token") || "";
  const config = window.BOOKING_CONFIG || {};

  function addChoices(target, name, choices) {
    const container = document.querySelector(target);
    choices.forEach((wording) => {
      const label = document.createElement("label");
      label.className = "agreement-choice";
      const input = document.createElement("input");
      input.type = "checkbox"; input.name = name; input.value = wording;
      label.append(input, document.createTextNode(wording)); container.append(label);
    });
  }
  addChoices("#current-feelings", "partner_initial_feelings", ["Guilt", "Shame", "Regret", "Remorse", "Anxiety", "Low mood", "Anger", "Fear of losing the relationship", "Grief", "Feeling overwhelmed", "Feeling numb or disconnected", "Sleep difficulties", "Appetite changes", "Difficulty concentrating", "Other"]);
  addChoices("#therapy-areas", "partner_initial_goals", ["Understanding what happened", "Managing guilt or shame", "Understanding patterns in myself", "Becoming more open and honest", "Managing difficult conversations and emotions", "Understanding the impact on my partner", "Rebuilding trust / repairing the relationship", "Understanding whether I want to remain in the relationship", "Changing sexual or pornography-related behaviours", "Preventing similar behaviour in the future", "Working on myself regardless of whether the relationship continues", "Other"]);
  form.elements.signedDate.value = new Date().toISOString().slice(0, 10);

  async function call(action, extra) {
    const response = await fetch(`${config.supabaseUrl}/functions/v1/intake-form`, { method: "POST", headers: { "Content-Type": "application/json", apikey: config.supabaseAnonKey, Authorization: `Bearer ${config.supabaseAnonKey}` }, body: JSON.stringify({ action, token, ...(extra || {}) }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "The intake form could not be opened.");
    return result;
  }
  function answers() {
    const output = {};
    for (const [key, value] of new FormData(form)) {
      if (["signerName", "signedDate", "confirmAccurate", "confirmNotEmergency", "confirmAssessment"].includes(key)) continue;
      output[key] = key in output ? (Array.isArray(output[key]) ? [...output[key], value] : [output[key], value]) : value;
    }
    return output;
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form); const button = form.querySelector("button[type=submit]");
    message.textContent = "Saving your form securely…"; button.disabled = true;
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
      if (intake.form_type !== "Partner initial intake") throw new Error("This link is for a different intake form.");
      loading.hidden = true;
      if (intake.status === "Completed") { errorBox.hidden = false; errorBox.innerHTML = "<h2>Already completed</h2><p>This signed form has already been received securely. Thank you.</p>"; return; }
      form.hidden = false;
    } catch (error) { loading.hidden = true; errorBox.hidden = false; errorBox.textContent = error.message; }
  })();
})();
