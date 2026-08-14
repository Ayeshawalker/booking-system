(function protectAdminPage() {
  const config = window.BOOKING_CONFIG || {};
  const currentPage =
    window.location.pathname.split("/").pop() || "ayesha.html";
  const allowedReturnPages = new Set([
    "ayesha.html",
    "clients.html",
    "calendar.html",
    "payments.html",
    "invoice.html",
    "settings.html",
    "notes.html",
  ]);
  const returnPage = allowedReturnPages.has(currentPage)
    ? currentPage
    : "clients.html";

  function redirectTo(page, params = {}) {
    const target = new URL(page, window.location.href);
    target.search = new URLSearchParams(params).toString();
    window.location.replace(target.href);
  }

  function stopUntilRedirect() {
    return new Promise(() => {});
  }

  if (
    !window.supabase ||
    !config.supabaseUrl ||
    !config.supabaseAnonKey
  ) {
    redirectTo("admin-login.html", {
      error: "configuration",
      return: returnPage,
    });
    window.ADMIN_READY = stopUntilRedirect();
    return;
  }

  const supabaseClient = window.supabase.createClient(
    config.supabaseUrl,
    config.supabaseAnonKey,
  );
  window.ADMIN_SUPABASE = supabaseClient;

  window.ADMIN_READY = (async () => {
    const { data: sessionData, error: sessionError } =
      await supabaseClient.auth.getSession();
    const session = sessionData?.session;

    if (sessionError || !session) {
      redirectTo("admin-login.html", { return: returnPage });
      return stopUntilRedirect();
    }

    const { data: membership, error: membershipError } = await supabaseClient
      .from("admin_users")
      .select("user_id, email, display_name")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      await supabaseClient.auth.signOut();
      redirectTo("admin-login.html", {
        error: membershipError ? "setup" : "unauthorised",
        return: returnPage,
      });
      return stopUntilRedirect();
    }

    const { data: factors, error: factorsError } =
      await supabaseClient.auth.mfa.listFactors();
    if (factorsError) {
      redirectTo("admin-security.html", { return: returnPage });
      return stopUntilRedirect();
    }
    const verifiedTotp = (factors.totp || factors.all || []).find(
      (factor) => factor.factor_type === "totp" && factor.status === "verified",
    );
    if (!verifiedTotp) {
      redirectTo("admin-security.html", { return: returnPage });
      return stopUntilRedirect();
    }
    const { data: assurance, error: assuranceError } =
      await supabaseClient.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError || assurance.currentLevel !== "aal2") {
      redirectTo("admin-security.html", { return: returnPage });
      return stopUntilRedirect();
    }

    document.querySelectorAll("[data-admin-email]").forEach((element) => {
      element.textContent = membership.email || session.user.email || "";
    });

    document.querySelectorAll("[data-admin-sign-out]").forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        await supabaseClient.auth.signOut();
        redirectTo("admin-login.html", { signedOut: "true" });
      });
    });

    // Keep this trusted browser signed in for a working day. MFA is still
    // required after a manual sign-out, an expired/revoked session, or on a
    // different browser/device.
    const idleLimitMilliseconds = 10 * 60 * 60 * 1000;
    let idleTimer = null;
    const resetIdleTimer = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(async () => {
        await supabaseClient.auth.signOut();
        redirectTo("admin-login.html", { error: "idle" });
      }, idleLimitMilliseconds);
    };

    ["pointerdown", "keydown", "scroll", "touchstart"].forEach((eventName) => {
      window.addEventListener(eventName, resetIdleTimer, { passive: true });
    });
    resetIdleTimer();

    supabaseClient.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        redirectTo("admin-login.html", { signedOut: "true" });
      }
    });

    document.documentElement.classList.remove("admin-auth-checking");
    return {
      client: supabaseClient,
      session,
      user: session.user,
      membership,
    };
  })().catch((error) => {
    console.error(error);
    redirectTo("admin-login.html", {
      error: "authentication",
      return: returnPage,
    });
    return stopUntilRedirect();
  });
})();
