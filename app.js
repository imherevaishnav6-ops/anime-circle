(function () {
  const state = {
    activeTab: "register",
    client: null,
    session: null,
    profile: null,
    members: [],
  };

  const registerForm = document.querySelector("#register-form");
  const loginForm = document.querySelector("#login-form");
  const favoriteForm = document.querySelector("#favorite-form");
  const authMessage = document.querySelector("#auth-message");
  const favoriteMessage = document.querySelector("#favorite-message");
  const memberGrid = document.querySelector("#member-grid");
  const memberCount = document.querySelector("#member-count");
  const favoriteCount = document.querySelector("#favorite-count");
  const sessionCard = document.querySelector("#session-card");
  const logoutButton = document.querySelector("#logout-button");
  const tabButtons = document.querySelectorAll(".tab-button");

  boot();

  function boot() {
    bindEvents();

    if (!window.APP_CONFIG?.supabaseUrl || !window.APP_CONFIG?.supabaseAnonKey) {
      showMessage(
        authMessage,
        "Add your Supabase URL and anon key in config.js before deploying.",
        true
      );
      renderLoggedOut();
      renderMembers([]);
      return;
    }

    state.client = window.supabase.createClient(
      window.APP_CONFIG.supabaseUrl,
      window.APP_CONFIG.supabaseAnonKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      }
    );

    state.client.auth.onAuthStateChange(async function (_event, session) {
      state.session = session;
      if (!session) {
        state.profile = null;
        renderLoggedOut();
        renderMembers([]);
        return;
      }

      await loadProfileAndMembers();
      render();
    });

    initializeSession();
  }

  function bindEvents() {
    tabButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        setTab(button.dataset.tab);
      });
    });

    registerForm.addEventListener("submit", handleRegister);
    loginForm.addEventListener("submit", handleLogin);
    favoriteForm.addEventListener("submit", handleFavoriteSave);
    logoutButton.addEventListener("click", handleLogout);
  }

  async function initializeSession() {
    const result = await state.client.auth.getSession();
    state.session = result.data.session;

    if (state.session) {
      await loadProfileAndMembers();
    }

    render();
  }

  async function handleRegister(event) {
    event.preventDefault();
    clearMessage(authMessage);

    const formData = new FormData(registerForm);
    const payload = {
      displayName: String(formData.get("displayName") || "").trim(),
      username: String(formData.get("username") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      password: String(formData.get("password") || ""),
    };

    const normalizedUsername = payload.username.toLowerCase().replace(/\s+/g, "");
    if (!payload.displayName || !normalizedUsername || !payload.email || !payload.password) {
      showMessage(authMessage, "Fill in every field to create your account.", true);
      return;
    }

    const { data, error } = await state.client.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          display_name: payload.displayName,
          username: normalizedUsername,
        },
      },
    });

    if (error) {
      showMessage(authMessage, error.message, true);
      return;
    }

    registerForm.reset();

    if (!data.session) {
      showMessage(
        authMessage,
        "Account created. Check your email to confirm, then log in.",
        false
      );
      setTab("login");
      return;
    }

    state.session = data.session;
    await loadProfileAndMembers();
    render();
    showMessage(authMessage, "Your account is ready.");
  }

  async function handleLogin(event) {
    event.preventDefault();
    clearMessage(authMessage);

    const formData = new FormData(loginForm);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    const { data, error } = await state.client.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      showMessage(authMessage, error.message, true);
      return;
    }

    loginForm.reset();
    state.session = data.session;
    await loadProfileAndMembers();
    render();
    showMessage(authMessage, "Welcome back to Anime Circle.");
  }

  async function handleFavoriteSave(event) {
    event.preventDefault();
    clearMessage(favoriteMessage);

    if (!state.session) {
      showMessage(favoriteMessage, "Log in before saving your anime.", true);
      return;
    }

    const formData = new FormData(favoriteForm);
    const favoriteAnime = String(formData.get("favoriteAnime") || "").trim();
    const animeReason = String(formData.get("animeReason") || "").trim();

    const { error } = await state.client
      .from("profiles")
      .update({
        favorite_anime: favoriteAnime,
        anime_reason: animeReason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", state.session.user.id);

    if (error) {
      showMessage(favoriteMessage, error.message, true);
      return;
    }

    await loadProfileAndMembers();
    render();
    showMessage(favoriteMessage, "Your favorite anime has been updated.");
  }

  async function handleLogout() {
    clearMessage(favoriteMessage);
    const { error } = await state.client.auth.signOut({ scope: "local" });
    if (error) {
      showMessage(authMessage, error.message, true);
      return;
    }

    state.session = null;
    state.profile = null;
    renderLoggedOut();
    renderMembers([]);
    showMessage(authMessage, "You have been logged out.");
  }

  async function loadProfileAndMembers() {
    const userId = state.session?.user?.id;
    if (!userId) {
      state.profile = null;
      state.members = [];
      return;
    }

    const profileQuery = state.client
      .from("profiles")
      .select("id, display_name, username, favorite_anime, anime_reason, created_at")
      .eq("id", userId)
      .single();

    const membersQuery = state.client
      .from("profiles")
      .select("id, display_name, username, favorite_anime, anime_reason, created_at")
      .order("display_name", { ascending: true });

    const [profileResult, membersResult] = await Promise.all([profileQuery, membersQuery]);

    if (profileResult.error) {
      showMessage(authMessage, profileResult.error.message, true);
      state.profile = null;
    } else {
      state.profile = profileResult.data;
    }

    if (membersResult.error) {
      showMessage(authMessage, membersResult.error.message, true);
      state.members = [];
    } else {
      state.members = membersResult.data || [];
    }
  }

  function render() {
    if (!state.session || !state.profile) {
      renderLoggedOut();
      renderMembers([]);
      return;
    }

    const favoriteInput = favoriteForm.elements.favoriteAnime;
    const reasonInput = favoriteForm.elements.animeReason;
    const saveButton = favoriteForm.querySelector(".primary-button");

    favoriteInput.disabled = false;
    reasonInput.disabled = false;
    saveButton.disabled = false;
    logoutButton.disabled = false;

    favoriteInput.value = state.profile.favorite_anime || "";
    reasonInput.value = state.profile.anime_reason || "";
    sessionCard.innerHTML = [
      '<p class="session-card__title">' + escapeHtml(state.profile.display_name) + "</p>",
      '<p class="session-card__copy">',
      "@" + escapeHtml(state.profile.username) + "<br />",
      state.profile.favorite_anime
        ? "Current favorite: " + escapeHtml(state.profile.favorite_anime)
        : "You have not picked an anime yet.",
      "</p>",
    ].join("");

    renderMembers(state.members);
    renderStats(state.members);
  }

  function renderLoggedOut() {
    const favoriteInput = favoriteForm.elements.favoriteAnime;
    const reasonInput = favoriteForm.elements.animeReason;
    const saveButton = favoriteForm.querySelector(".primary-button");

    favoriteInput.disabled = true;
    reasonInput.disabled = true;
    saveButton.disabled = true;
    logoutButton.disabled = true;
    favoriteInput.value = "";
    reasonInput.value = "";
    sessionCard.innerHTML = [
      '<p class="session-card__title">Not logged in yet</p>',
      '<p class="session-card__copy">Sign in to add your favorite anime and see the shared club feed.</p>',
    ].join("");

    renderStats([]);
  }

  function renderMembers(members) {
    if (!members.length) {
      memberGrid.innerHTML = [
        '<article class="member-card">',
        '<span class="badge">Waiting Room</span>',
        '<p class="member-card__empty">Log in to view the friend feed, or be the first person to join the club.</p>',
        "</article>",
      ].join("");
      return;
    }

    memberGrid.innerHTML = members
      .map(function (member) {
        const anime = member.favorite_anime
          ? '<p class="member-card__anime">' + escapeHtml(member.favorite_anime) + "</p>"
          : '<p class="member-card__empty">No favorite picked yet.</p>';
        const reason = member.anime_reason
          ? '<p class="member-card__reason">' + escapeHtml(member.anime_reason) + "</p>"
          : "";

        return [
          '<article class="member-card">',
          '<span class="badge">@' + escapeHtml(member.username) + "</span>",
          '<p class="member-card__name">' + escapeHtml(member.display_name) + "</p>",
          anime,
          reason,
          "</article>",
        ].join("");
      })
      .join("");
  }

  function renderStats(members) {
    memberCount.textContent = String(members.length);
    favoriteCount.textContent = String(
      members.filter(function (member) {
        return Boolean(member.favorite_anime);
      }).length
    );
  }

  function setTab(tabName) {
    state.activeTab = tabName;
    tabButtons.forEach(function (button) {
      button.classList.toggle("is-active", button.dataset.tab === tabName);
    });
    registerForm.classList.toggle("is-hidden", tabName !== "register");
    loginForm.classList.toggle("is-hidden", tabName !== "login");
    clearMessage(authMessage);
  }

  function showMessage(element, text, isError) {
    element.textContent = text;
    element.classList.toggle("is-error", Boolean(isError));
  }

  function clearMessage(element) {
    showMessage(element, "", false);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
})();
