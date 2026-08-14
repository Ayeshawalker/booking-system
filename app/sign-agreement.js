(function setupAgreementSigning() {
  const loading = document.querySelector("#agreement-loading");
  const errorBox = document.querySelector("#agreement-error");
  const documentPanel = document.querySelector("#agreement-document");
  const copy = document.querySelector("#agreement-copy");
  const form = document.querySelector("#agreement-sign-form");
  const message = document.querySelector("#agreement-form-message");
  const signerChoice = document.querySelector("#agreement-signer-choice");
  const signerStatus = document.querySelector("#agreement-signer-status");
  const alternativeWrap = document.querySelector("#agreement-alternative-wrap");
  const feesPolicyAccept = document.querySelector("#agreement-fees-policy-accept");
  const token = new URLSearchParams(location.search).get("token") || "";
  const config = window.BOOKING_CONFIG || {};
  let agreement;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
  }
  function markdown(text) {
    const lines = String(text || "").split(/\r?\n/);
    let html = "";
    let listOpen = false;
    const closeList = () => { if (listOpen) { html += "</ul>"; listOpen = false; } };
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) { closeList(); continue; }
      if (line.startsWith("### ")) { closeList(); html += `<h3>${escapeHtml(line.slice(4))}</h3>`; }
      else if (line.startsWith("## ")) { closeList(); html += `<h2>${escapeHtml(line.slice(3))}</h2>`; }
      else if (line.startsWith("# ")) { closeList(); html += `<h1>${escapeHtml(line.slice(2))}</h1>`; }
      else if (/^[-*] /.test(line)) { if (!listOpen) { html += "<ul>"; listOpen = true; } html += `<li>${escapeHtml(line.slice(2))}</li>`; }
      else { closeList(); html += `<p>${escapeHtml(line).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</p>`; }
    }
    closeList();
    return html;
  }
  async function call(action, extra = {}) {
    const response = await fetch(`${config.supabaseUrl}/functions/v1/agreement-signing`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: config.supabaseAnonKey },
      body: JSON.stringify({ action, token, ...extra }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "The agreement could not be opened.");
    return result;
  }
  function signedLabel(name, date) {
    if (!date) return "Not signed yet";
    return `Signed by ${name} on ${new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(new Date(date))}`;
  }
  function render() {
    copy.innerHTML = markdown(agreement.agreement_text);
    document.querySelector("#agreement-signing-intro").textContent = agreement.agreement_type === "Couple"
      ? "Each person should sign separately. The agreement is complete after both signatures."
      : "Please type your full name to sign this agreement.";
    signerChoice.hidden = agreement.agreement_type !== "Couple";
    const usesPersonalisedFees = agreement.agreement_version >= "2026-08-14";
    feesPolicyAccept.hidden = !usesPersonalisedFees;
    feesPolicyAccept.querySelector("input").required = usesPersonalisedFees;
    const signerSelect = form.elements.signer;
    signerSelect.options[0].textContent = agreement.signer_one_expected_name;
    signerSelect.options[1].textContent = agreement.signer_two_expected_name || "Second person";
    signerSelect.options[0].disabled = Boolean(agreement.signer_one_signed_at);
    signerSelect.options[1].disabled = Boolean(agreement.signer_two_signed_at);
    if (signerSelect.options[0].disabled && !signerSelect.options[1].disabled) signerSelect.value = "2";
    signerStatus.innerHTML = `<p>${escapeHtml(agreement.signer_one_expected_name)}: ${escapeHtml(signedLabel(agreement.signer_one_name, agreement.signer_one_signed_at))}</p>` +
      (agreement.agreement_type === "Couple" ? `<p>${escapeHtml(agreement.signer_two_expected_name)}: ${escapeHtml(signedLabel(agreement.signer_two_name, agreement.signer_two_signed_at))}</p>` : "");
    if (agreement.status === "Signed") {
      form.hidden = true;
      signerStatus.insertAdjacentHTML("beforeend", "<strong>This agreement is complete. Thank you.</strong>");
    }
  }
  form.addEventListener("change", () => {
    alternativeWrap.hidden = form.elements.communicationChoice.value !== "alternative";
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "Saving your signature…";
    const data = new FormData(form);
    try {
      const result = await call("sign", {
        signer: agreement.agreement_type === "Couple" ? Number(data.get("signer")) : 1,
        name: data.get("name"), accepted: data.get("accepted") === "on",
        feesAndCancellationAccepted: data.get("feesAndCancellationAccepted") === "on",
        communicationChoice: data.get("communicationChoice"), contactAlternative: data.get("contactAlternative"),
      });
      message.textContent = result.complete ? "Thank you. The agreement is now complete." : "Thank you. Your signature is saved; the other person can now use this same link to sign.";
      const refreshed = await call("view"); agreement = refreshed.agreement; render();
    } catch (error) { message.textContent = error.message; }
  });
  (async () => {
    try {
      if (!token) throw new Error("This signing link is incomplete.");
      agreement = (await call("view")).agreement;
      loading.hidden = true; documentPanel.hidden = false; render();
    } catch (error) { loading.hidden = true; errorBox.hidden = false; errorBox.textContent = error.message; }
  })();
})();
