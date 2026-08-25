(async function setupAgreementPreview() {
  await window.ADMIN_READY;
  const card = document.querySelector("#agreement-preview-document");
  const status = document.querySelector("#agreement-preview-status");
  const tabs = [...document.querySelectorAll("[data-agreement]")];
  const sources = {
    individual: "contracts/individual-therapy-agreement-draft.md",
    betrayal: "contracts/betrayal-trauma-agreement-draft.md",
    couples: "contracts/couples-therapy-agreement-draft.md",
  };
  const secondSigner = document.querySelector("#agreement-preview-second-signer");
  const escapeHtml = (value) => String(value).replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const inline = (value) => escapeHtml(value).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  function renderMarkdown(markdown) {
    const output = [];
    let paragraph = [];
    let listOpen = false;
    const flush = () => {
      if (paragraph.length) output.push(`<p>${inline(paragraph.join(" "))}</p>`);
      paragraph = [];
    };
    const closeList = () => { if (listOpen) output.push("</ul>"); listOpen = false; };
    markdown.split(/\r?\n/).forEach((line) => {
      const text = line.trim();
      if (!text) { flush(); closeList(); return; }
      if (text.startsWith(">")) return;
      if (text.startsWith("# ")) {
        flush(); closeList();
        output.push(`<h1>${inline(text.slice(2).replace(" — review draft", ""))}</h1>`);
      } else if (text.startsWith("## ")) {
        flush(); closeList(); output.push(`<h2>${inline(text.slice(3))}</h2>`);
      } else if (text.startsWith("### ")) {
        flush(); closeList(); output.push(`<h3>${inline(text.slice(4))}</h3>`);
      } else if (text.startsWith("- [ ] ")) {
        flush();
        if (!listOpen) { output.push('<ul class="agreement-consent-options">'); listOpen = true; }
        output.push(`<li><label><input type="checkbox" disabled /> <span>${inline(text.slice(6))}</span></label></li>`);
      } else if (text.startsWith("- ")) {
        flush();
        if (!listOpen) { output.push("<ul>"); listOpen = true; }
        output.push(`<li>${inline(text.slice(2))}</li>`);
      } else paragraph.push(text);
    });
    flush(); closeList();
    return output.join("");
  }

  async function showAgreement(type) {
    tabs.forEach((tab) => tab.setAttribute("aria-selected", String(tab.dataset.agreement === type)));
    secondSigner.hidden = type !== "couples";
    status.textContent = "Loading agreement…";
    try {
      const response = await fetch(sources[type], { cache: "no-store" });
      if (!response.ok) throw new Error("Agreement draft not found");
      const sampleFees = type === "couples"
        ? "- Online 80-minute couples session: **fee recorded for this client**\n- In-person 80-minute couples session: **fee recorded for this client**\n\nThese are the fees agreed for you and may differ from fees agreed with other clients."
        : "- Online 50-minute individual session: **fee recorded for this client**\n- In-person 50-minute individual session: **fee recorded for this client**\n\nThese are the fees agreed for you and may differ from fees agreed with other clients.";
      const agreementText = (await response.text()).replace("{{AGREED_FEES}}", sampleFees);
      card.innerHTML = renderMarkdown(agreementText);
      status.textContent = "";
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error(error);
      status.textContent = "The agreement preview could not be opened.";
    }
  }
  tabs.forEach((tab) => tab.addEventListener("click", () => showAgreement(tab.dataset.agreement)));
  showAgreement("individual");
})();
