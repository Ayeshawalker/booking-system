(function setupAdminSecurity() {
  const config = window.BOOKING_CONFIG || {};
  const enrolView = document.querySelector("#mfa-enrol-view");
  const challengeView = document.querySelector("#mfa-challenge-view");
  const message = document.querySelector("#mfa-message");
  const allowedReturnPages = new Set([
    "ayesha.html",
    "clients.html",
    "calendar.html",
    "payments.html",
    "invoice.html",
    "settings.html",
    "notes.html",
  ]);
  const requestedReturn = new URLSearchParams(window.location.search).get("return");
  const returnPage = allowedReturnPages.has(requestedReturn)
    ? requestedReturn
    : "clients.html";
  let activeFactorId = null;

  function redirectTo(page, params = {}) {
    const target = new URL(page, window.location.href);
    target.search = new URLSearchParams(params).toString();
    target.hash = "";
    window.location.replace(target.href);
  }

  function setBusy(form, busy, busyText) {
    const button = form.querySelector("button[type='submit']");
    if (!button.dataset.defaultText) {
      button.dataset.defaultText = button.textContent;
    }
    button.disabled = busy;
    button.textContent = busy ? busyText : button.dataset.defaultText;
  }

  if (
    !window.supabase ||
    !config.supabaseUrl ||
    !config.supabaseAnonKey
  ) {
    redirectTo("admin-login.html", { error: "configuration" });
    return;
  }

  const supabaseClient = window.supabase.createClient(
    config.supabaseUrl,
    config.supabaseAnonKey,
  );

  async function verifyCode(code, form) {
    setBusy(form, true, "Verifying...");
    message.textContent = "";

    try {
      const { error } = await supabaseClient.auth.mfa.challengeAndVerify({
        factorId: activeFactorId,
        code,
      });
      if (error) throw error;

      await supabaseClient.auth.refreshSession();
      redirectTo(returnPage);
    } catch (error) {
      console.error(error);
      message.textContent =
        "That code could not be verified. Wait for a fresh code and try again.";
      setBusy(form, false);
    }
  }

  document.querySelector("#mfa-enrol-form").addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      verifyCode(
        document.querySelector("#mfa-enrol-code").value.trim(),
        event.currentTarget,
      );
    },
  );

  document.querySelector("#mfa-challenge-form").addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      verifyCode(
        document.querySelector("#mfa-challenge-code").value.trim(),
        event.currentTarget,
      );
    },
  );

  document.querySelector("#mfa-sign-out").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    redirectTo("admin-login.html", { signedOut: "true" });
  });

  async function initialise() {
    try {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      if (!sessionData.session) {
        redirectTo("admin-login.html", { return: returnPage });
        return;
      }

      const { data: membership, error: membershipError } = await supabaseClient
        .from("admin_users")
        .select("user_id")
        .eq("user_id", sessionData.session.user.id)
        .maybeSingle();

      if (membershipError || !membership) {
        await supabaseClient.auth.signOut();
        redirectTo("admin-login.html", {
          error: membershipError ? "setup" : "unauthorised",
        });
        return;
      }

      const { data: factors, error: factorsError } =
        await supabaseClient.auth.mfa.listFactors();
      if (factorsError) throw factorsError;

      const unverifiedFactors = (factors.all || []).filter(
        (factor) => factor.status === "unverified",
      );
      for (const factor of unverifiedFactors) {
        await supabaseClient.auth.mfa.unenroll({ factorId: factor.id });
      }

      const verifiedFactor = (factors.totp || factors.all || []).find(
        (factor) => factor.factor_type === "totp" && factor.status === "verified",
      );
      if (verifiedFactor) {
        const { data: assurance, error: assuranceError } =
          await supabaseClient.auth.mfa.getAuthenticatorAssuranceLevel();
        if (assuranceError) throw assuranceError;
        if (assurance.currentLevel === "aal2") {
          redirectTo(returnPage);
          return;
        }
        activeFactorId = verifiedFactor.id;
        document.documentElement.classList.remove("admin-auth-checking");
        challengeView.hidden = false;
        document.querySelector("#mfa-challenge-code").focus();
        return;
      }

      const { data: enrolment, error: enrolmentError } =
        await supabaseClient.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "Ayesha Jane Admin",
        });
      if (enrolmentError) throw enrolmentError;
      activeFactorId = enrolment.id;
      document.querySelector("#mfa-qr-code").src = enrolment.totp.qr_code;
      document.querySelector("#mfa-secret-value").textContent = enrolment.totp.secret;
      document.documentElement.classList.remove("admin-auth-checking");
      enrolView.hidden = false;
    } catch (error) {
      console.error(error);
      document.documentElement.classList.remove("admin-auth-checking");
      message.textContent =
        "Your secure session could not be checked. Please sign out and try again.";
    }
  }

  initialise();
})();
