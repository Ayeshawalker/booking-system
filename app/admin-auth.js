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
    "reminders.html",
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

    let reminderNotificationTimer = null;
    async function checkTimedReminderNotifications() {
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      const formatter = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23",
      });
      const parts = Object.fromEntries(
        formatter.formatToParts(new Date()).filter((part) => part.type !== "literal")
          .map((part) => [part.type, part.value]),
      );
      const today = `${parts.year}-${parts.month}-${parts.day}`;
      const currentMinutes = Number(parts.hour) * 60 + Number(parts.minute);
      const { data, error } = await supabaseClient.from("admin_reminders")
        .select("id,title,due_date,due_time,status")
        .neq("status", "Completed")
        .eq("due_date", today);
      if (error) {
        console.error("Timed reminders could not be checked.", error);
        return;
      }
      const notify = (item, alertType, body) => {
        const key = `reminder-notification-${alertType}-${item.id}-${today}`;
        if (window.localStorage.getItem(key)) return;
        const notification = new Notification(item.title, { body, tag: key });
        notification.onclick = () => {
          window.focus();
          window.location.href = "reminders.html";
          notification.close();
        };
        window.localStorage.setItem(key, new Date().toISOString());
      };
      (data || []).forEach((item) => {
        if (currentMinutes >= 8 * 60) notify(item, "8am", "This reminder is due today.");
        if (!item.due_time) return;
        const [hours, minutes] = String(item.due_time).split(":").map(Number);
        const targetMinutes = hours * 60 + minutes;
        if (currentMinutes >= targetMinutes - 30 && currentMinutes < targetMinutes) {
          notify(item, "30min", `Due at ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")} — in 30 minutes or less.`);
        }
      });
    }
    window.startReminderNotificationChecks = () => {
      if (reminderNotificationTimer) return;
      checkTimedReminderNotifications();
      reminderNotificationTimer = window.setInterval(checkTimedReminderNotifications, 60 * 1000);
    };
    window.startReminderNotificationChecks();

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
