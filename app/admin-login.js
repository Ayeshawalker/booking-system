(function setupAdminLogin() {
  const config = window.BOOKING_CONFIG || {};
  const loginView = document.querySelector("#login-view");
  const resetRequestView = document.querySelector("#reset-request-view");
  const passwordUpdateView = document.querySelector("#password-update-view");
  const loginForm = document.querySelector("#admin-login-form");
  const resetRequestForm = document.querySelector("#reset-request-form");
  const passwordUpdateForm = document.querySelector("#password-update-form");
  const message = document.querySelector("#auth-message");
  const allowedReturnPages = new Set([
    "ayesha.html",
    "clients.html",
    "calendar.html",
    "payments.html",
    "invoice.html",
    "settings.html",
    "notes.html",
  ]);
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const requestedReturn = searchParams.get("return");
  const activationToken = searchParams.get("token_hash");
  const activationType = searchParams.get("type");
  const recoveryCode = searchParams.get("code");
  const recoveryAccessToken = hashParams.get("access_token");
  const recoveryRefreshToken = hashParams.get("refresh_token");
  const recoveryType = hashParams.get("type");
  const validActivationTypes = new Set(["invite", "recovery", "magiclink"]);
  const returnPage = allowedReturnPages.has(requestedReturn)
    ? requestedReturn
    : "clients.html";

  function showView(view) {
    [loginView, resetRequestView, passwordUpdateView].forEach((element) => {
      element.hidden = element !== view;
    });
    message.textContent = "";
  }

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
    message.textContent = "The Supabase login configuration is missing.";
    loginForm.querySelector("button").disabled = true;
    return;
  }

  const supabaseClient = window.supabase.createClient(
    config.supabaseUrl,
    config.supabaseAnonKey,
    {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: false,
      },
    },
  );
  let isPasswordRecovery = false;

  async function isApprovedAdmin(userId) {
    const { data, error } = await supabaseClient
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return Boolean(data);
  }

  async function continueAfterPassword(user) {
    if (!(await isApprovedAdmin(user.id))) {
      await supabaseClient.auth.signOut();
      throw new Error("This account is not approved for the Ayesha admin area.");
    }

    redirectTo(returnPage);
  }

  function clearRecoveryAddress() {
    const cleanUrl = new URL(window.location.href);
    cleanUrl.search = "";
    cleanUrl.hash = "";
    window.history.replaceState({}, document.title, cleanUrl.href);
  }

  async function showVerifiedPasswordUpdate(user) {
    if (!user || !(await isApprovedAdmin(user.id))) {
      await supabaseClient.auth.signOut();
      throw new Error("This account is not approved for the Ayesha admin area.");
    }

    isPasswordRecovery = true;
    clearRecoveryAddress();
    showView(passwordUpdateView);
    message.textContent = "Recovery link accepted. Please choose your new password.";
    document.querySelector("#new-admin-password").focus();
  }

  async function acceptRecoveryLink() {
    if (recoveryCode) {
      showView(passwordUpdateView);
      message.textContent = "Checking your secure recovery link...";
      const { data, error } =
        await supabaseClient.auth.exchangeCodeForSession(recoveryCode);
      if (error) throw error;
      await showVerifiedPasswordUpdate(data.user || data.session?.user);
      return true;
    }

    if (
      recoveryType === "recovery" &&
      recoveryAccessToken &&
      recoveryRefreshToken
    ) {
      showView(passwordUpdateView);
      message.textContent = "Checking your secure recovery link...";
      const { data, error } = await supabaseClient.auth.setSession({
        access_token: recoveryAccessToken,
        refresh_token: recoveryRefreshToken,
      });
      if (error) throw error;
      await showVerifiedPasswordUpdate(data.user || data.session?.user);
      return true;
    }

    return false;
  }

  async function acceptActivationLink() {
    if (
      !activationToken ||
      !validActivationTypes.has(activationType)
    ) {
      return false;
    }

    showView(passwordUpdateView);
    message.textContent = "Checking your secure setup link...";

    const { data, error } = await supabaseClient.auth.verifyOtp({
      token_hash: activationToken,
      type: activationType,
    });
    if (error) throw error;
    if (!data.user || !(await isApprovedAdmin(data.user.id))) {
      await supabaseClient.auth.signOut();
      throw new Error("This account is not approved for the Ayesha admin area.");
    }

    await showVerifiedPasswordUpdate(data.user);
    return true;
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "";
    setBusy(loginForm, true, "Signing in...");

    try {
      const formData = new FormData(loginForm);
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: String(formData.get("email") || "").trim(),
        password: String(formData.get("password") || ""),
      });

      if (error) throw error;
      await continueAfterPassword(data.user);
    } catch (error) {
      message.textContent =
        error.message === "Invalid login credentials"
          ? "The email address or password was not recognised."
          : error.message;
      setBusy(loginForm, false);
    }
  });

  document.querySelector("#show-reset-form").addEventListener("click", () => {
    document.querySelector("#reset-email").value =
      document.querySelector("#admin-email").value;
    showView(resetRequestView);
  });

  document.querySelector("#back-to-login").addEventListener("click", () => {
    showView(loginView);
  });

  resetRequestForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "";
    setBusy(resetRequestForm, true, "Sending...");

    try {
      const redirectUrl = new URL(
        config.adminRecoveryUrl || "admin-login.html",
        window.location.href,
      );
      redirectUrl.search = "";
      redirectUrl.hash = "";
      const { error } = await supabaseClient.auth.resetPasswordForEmail(
        document.querySelector("#reset-email").value.trim(),
        { redirectTo: redirectUrl.href },
      );

      if (error) throw error;
      message.textContent =
        "Reset requested. Please allow a few minutes and check your spam folder for an email from Supabase.";
    } catch (error) {
      message.textContent = error.message;
    } finally {
      setBusy(resetRequestForm, false);
    }
  });

  passwordUpdateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "";
    const password = document.querySelector("#new-admin-password").value;
    const confirmation = document.querySelector("#confirm-admin-password").value;

    if (password !== confirmation) {
      message.textContent = "The two passwords do not match.";
      return;
    }

    setBusy(passwordUpdateForm, true, "Updating...");
    try {
      const { data, error } = await supabaseClient.auth.updateUser({ password });
      if (error) throw error;
      isPasswordRecovery = false;
      await continueAfterPassword(data.user);
    } catch (error) {
      message.textContent = error.message;
      setBusy(passwordUpdateForm, false);
    }
  });

  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") {
      isPasswordRecovery = true;
      showView(passwordUpdateView);
    }
  });

  async function initialise() {
    const errorCode = searchParams.get("error");
    const errorMessages = {
      configuration: "The Supabase login configuration is missing.",
      setup: "The private admin database has not been activated yet.",
      unauthorised: "This account is not approved for the private admin area.",
      authentication: "Your secure session could not be checked. Please sign in again.",
      idle: "You were signed out after 30 minutes without activity.",
    };

    if (errorMessages[errorCode]) {
      message.textContent = errorMessages[errorCode];
    } else if (searchParams.get("signedOut") === "true") {
      message.textContent = "You have signed out securely.";
    }

    try {
      if (await acceptActivationLink()) {
        return;
      }
      if (await acceptRecoveryLink()) {
        return;
      }
    } catch (error) {
      await supabaseClient.auth.signOut();
      showView(loginView);
      message.textContent =
        recoveryCode || recoveryType === "recovery"
          ? "That recovery link is invalid, expired, or was opened in a different browser. Please request a new link here and open it in this browser."
          : "That setup link is invalid or has expired. Please generate a new one.";
      console.error(error);
      return;
    }

    const linkError =
      searchParams.get("error_description") ||
      hashParams.get("error_description");
    if (linkError) {
      message.textContent =
        "Supabase could not accept that email link. Please request a new one and open it in this browser.";
      return;
    }

    const { data } = await supabaseClient.auth.getSession();
    if (data.session) {
      try {
        await continueAfterPassword(data.session.user);
      } catch {
        await supabaseClient.auth.signOut();
      }
    }
  }

  initialise();
})();
