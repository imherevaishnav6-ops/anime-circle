(function () {
  const JIKAN_BASE_URL = "https://api.jikan.moe/v4";
  const FALLBACK_HERO_IMAGES = [
    "https://cdn.myanimelist.net/images/anime/1208/94745.jpg",
    "https://cdn.myanimelist.net/images/anime/1015/138006.jpg",
    "https://cdn.myanimelist.net/images/anime/1935/127974.jpg",
  ];
  const FALLBACK_AVATARS = [
    {
      id: 1,
      name: "Monkey D. Luffy",
      image: "https://cdn.myanimelist.net/images/characters/9/310307.jpg",
    },
    {
      id: 2,
      name: "Levi Ackerman",
      image: "https://cdn.myanimelist.net/images/characters/2/241413.jpg",
    },
    {
      id: 3,
      name: "Itachi Uchiha",
      image: "https://cdn.myanimelist.net/images/characters/11/284121.jpg",
    },
    {
      id: 4,
      name: "Killua Zoldyck",
      image: "https://cdn.myanimelist.net/images/characters/11/215101.jpg",
    },
    {
      id: 5,
      name: "Gojo Satoru",
      image: "https://cdn.myanimelist.net/images/characters/14/435481.jpg",
    },
    {
      id: 6,
      name: "Mikasa Ackerman",
      image: "https://cdn.myanimelist.net/images/characters/9/215563.jpg",
    },
    {
      id: 7,
      name: "L Lawliet",
      image: "https://cdn.myanimelist.net/images/characters/10/249703.jpg",
    },
    {
      id: 8,
      name: "Naruto Uzumaki",
      image: "https://cdn.myanimelist.net/images/characters/6/284129.jpg",
    },
  ];

  const state = {
    activeTab: "register",
    client: null,
    session: null,
    profile: null,
    members: [],
    avatarChoices: [],
    animeResults: [],
    animeSuggestions: [],
    selectedAnime: null,
    feedQuery: "",
    isAdmin: false,
    adminProfiles: [],
  };

  const registerForm = document.querySelector("#register-form");
  const loginForm = document.querySelector("#login-form");
  const profileForm = document.querySelector("#profile-form");
  const authMessage = document.querySelector("#auth-message");
  const profileMessage = document.querySelector("#profile-message");
  const memberGrid = document.querySelector("#member-grid");
  const memberCount = document.querySelector("#member-count");
  const favoriteCount = document.querySelector("#favorite-count");
  const avatarCount = document.querySelector("#avatar-count");
  const sessionCard = document.querySelector("#session-card");
  const logoutButton = document.querySelector("#logout-button");
  const tabButtons = document.querySelectorAll(".tab-button");
  const avatarGrid = document.querySelector("#avatar-grid");
  const animeResults = document.querySelector("#anime-results");
  const animeSuggestions = document.querySelector("#anime-suggestions");
  const selectedAnime = document.querySelector("#selected-anime");
  const animeSearchInput = document.querySelector("#anime-search-input");
  const animeSearchButton = document.querySelector("#anime-search-button");
  const reloadAvatarsButton = document.querySelector("#reload-avatars");
  const clearAnimeButton = document.querySelector("#clear-anime");
  const hero = document.querySelector("#hero");
  const heroChips = document.querySelector("#hero-chips");
  const memberSearch = document.querySelector("#member-search");
  const saveProfileButton = document.querySelector("#save-profile-button");
  const adminPanel = document.querySelector("#admin-panel");
  const adminGrid = document.querySelector("#admin-grid");
  let animeSuggestionTimer = null;

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
      renderHero([]);
      return;
    }

    state.client = window.supabase.createClient(
      window.APP_CONFIG.supabaseUrl,
      window.APP_CONFIG.supabaseAnonKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      }
    );

    state.client.auth.onAuthStateChange(async function (_event, session) {
      state.session = session;
      if (!session) {
        state.profile = null;
        state.selectedAnime = null;
        state.members = [];
        state.isAdmin = false;
        state.adminProfiles = [];
        renderLoggedOut();
        renderMembers([]);
        renderStats([]);
        renderAdminPanel();
        return;
      }

      await loadProfileAndMembers();
      render();
    });

    initializeSession();
    loadAvatarChoices();
    loadTrendingHero();
  }

  function bindEvents() {
    tabButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        setTab(button.dataset.tab);
      });
    });

    registerForm.addEventListener("submit", handleRegister);
    loginForm.addEventListener("submit", handleLogin);
    profileForm.addEventListener("submit", handleProfileSave);
    logoutButton.addEventListener("click", handleLogout);
    animeSearchButton.addEventListener("click", handleAnimeSearch);
    reloadAvatarsButton.addEventListener("click", loadAvatarChoices);
    clearAnimeButton.addEventListener("click", clearSelectedAnime);
    memberSearch.addEventListener("input", function (event) {
      state.feedQuery = String(event.target.value || "").trim().toLowerCase();
      renderMembers(state.members);
    });
    animeSearchInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        handleAnimeSearch();
      }
    });
    animeSearchInput.addEventListener("input", handleAnimeSuggest);
  }

  async function initializeSession() {
    const result = await state.client.auth.getSession();
    state.session = result.data.session;
    state.isAdmin = isCurrentUserAdmin();

    if (state.session) {
      await loadProfileAndMembers();
    } else {
      await loadMembersOnly();
    }

    render();
  }

  async function handleRegister(event) {
    event.preventDefault();
    clearMessage(authMessage);

    const formData = new FormData(registerForm);
    const payload = {
      username: normalizeUsername(formData.get("username")),
      email: String(formData.get("email") || "").trim(),
      password: String(formData.get("password") || ""),
    };

    if (!payload.username || !payload.email || !payload.password) {
      showMessage(authMessage, "Fill in username, email, and password.", true);
      return;
    }

    const { data, error } = await state.client.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          username: payload.username,
          display_name: payload.username,
        },
      },
    });

    if (error) {
      showMessage(authMessage, error.message, true);
      return;
    }

    registerForm.reset();

    if (!data.session) {
      showMessage(authMessage, "Account created. Log in when your account is ready.", false);
      setTab("login");
      return;
    }

    state.session = data.session;
    await loadProfileAndMembers();
    render();
    showMessage(authMessage, "Your anime account is ready.");
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

    if (!data.session) {
      showMessage(authMessage, "Login did not return a session. Try again.", true);
      return;
    }

    loginForm.reset();
    state.session = data.session;
    await loadProfileAndMembers();
    render();
    showMessage(authMessage, "Welcome back to Anime Circle.");
  }

  async function handleProfileSave(event) {
    event.preventDefault();
    clearMessage(profileMessage);

    if (!state.session) {
      showMessage(profileMessage, "Log in before saving your profile.", true);
      return;
    }

    const bio = String(profileForm.elements.bio.value || "").trim();
    const selectedAvatar = state.profile?.avatar_image_url || "";

    const updates = {
      bio: bio,
      avatar_image_url: selectedAvatar,
      favorite_anime: state.selectedAnime?.title || "",
      favorite_anime_image_url: state.selectedAnime?.image || "",
      favorite_anime_mal_id: state.selectedAnime?.malId || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await state.client
      .from("profiles")
      .update(updates)
      .eq("id", state.session.user.id);

    if (error) {
      showMessage(profileMessage, error.message, true);
      return;
    }

    await loadProfileAndMembers();
    render();
    showMessage(profileMessage, "Profile updated with your latest anime vibe.");
  }

  async function handleLogout() {
    clearMessage(profileMessage);
    const { error } = await state.client.auth.signOut({ scope: "local" });
    if (error) {
      showMessage(authMessage, error.message, true);
      return;
    }

    state.session = null;
    state.profile = null;
    state.selectedAnime = null;
    state.members = [];
    renderLoggedOut();
    renderMembers([]);
    renderStats([]);
    showMessage(authMessage, "You have been logged out.");
  }

  async function handleAnimeSearch() {
    clearMessage(profileMessage);
    const query = String(animeSearchInput.value || "").trim();

    if (!query) {
      showMessage(profileMessage, "Type an anime title to search.", true);
      return;
    }

    animeResults.innerHTML = '<div class="empty-state">Searching anime...</div>';

    try {
      const response = await fetch(
        JIKAN_BASE_URL + "/anime?q=" + encodeURIComponent(query) + "&limit=6&sfw"
      );
      const payload = await response.json();
      state.animeResults = Array.isArray(payload.data) ? payload.data : [];
      state.animeSuggestions = state.animeResults.slice(0, 5);
      renderAnimeSuggestions();
      renderAnimeResults();
      if (!state.animeResults.length) {
        showMessage(profileMessage, "No anime found for that search.", true);
      }
    } catch {
      animeResults.innerHTML = '<div class="empty-state">Anime search failed. Try again.</div>';
      showMessage(profileMessage, "Could not load anime results right now.", true);
    }
  }

  async function loadAvatarChoices() {
    avatarGrid.classList.add("is-disabled");
    avatarGrid.innerHTML = '<div class="empty-state">Loading character avatars...</div>';

    try {
      const response = await fetch(JIKAN_BASE_URL + "/top/characters?limit=8");
      const payload = await response.json();
      const choices = Array.isArray(payload.data) ? payload.data : [];
      state.avatarChoices = choices
        .map(function (character) {
          return {
            id: character.mal_id,
            name: character.name,
            image:
              character.images?.jpg?.image_url ||
              character.images?.webp?.image_url ||
              "",
          };
        })
        .filter(function (choice) {
          return choice.image;
        });
      if (state.avatarChoices.length < 4) {
        state.avatarChoices = FALLBACK_AVATARS;
      }
      renderAvatarChoices();
    } catch {
      state.avatarChoices = FALLBACK_AVATARS;
      renderAvatarChoices();
    }
  }

  async function loadTrendingHero() {
    try {
      const response = await fetch(JIKAN_BASE_URL + "/top/anime?limit=3&sfw");
      const payload = await response.json();
      const anime = Array.isArray(payload.data) ? payload.data : [];
      renderHero(anime);
    } catch {
      renderHero([]);
    }
  }

  async function loadMembersOnly() {
    const result = await state.client
      .from("profiles")
      .select("id, username, bio, avatar_image_url, favorite_anime, favorite_anime_image_url, favorite_anime_mal_id, created_at")
      .order("username", { ascending: true });

    if (result.error) {
      state.members = [];
      return;
    }

    state.members = result.data || [];
    renderMembers(state.members);
    renderStats(state.members);
  }

  async function loadProfileAndMembers() {
    const userId = state.session?.user?.id;
    if (!userId) {
      state.profile = null;
      state.members = [];
      state.adminProfiles = [];
      return;
    }

    state.isAdmin = isCurrentUserAdmin();

    const profileQuery = state.client
      .from("profiles")
      .select("id, username, bio, avatar_image_url, favorite_anime, favorite_anime_image_url, favorite_anime_mal_id, created_at")
      .eq("id", userId)
      .single();

    const membersQuery = state.client
      .from("profiles")
      .select("id, username, bio, avatar_image_url, favorite_anime, favorite_anime_image_url, favorite_anime_mal_id, created_at")
      .order("username", { ascending: true });
    const adminQuery = state.isAdmin
      ? state.client
          .from("profiles")
          .select("id, username, bio, avatar_image_url, favorite_anime, favorite_anime_image_url, favorite_anime_mal_id, created_at, updated_at")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null });

    const [profileResult, membersResult, adminResult] = await Promise.all([
      profileQuery,
      membersQuery,
      adminQuery,
    ]);

    if (profileResult.error) {
      showMessage(authMessage, profileResult.error.message, true);
      state.profile = null;
    } else {
      state.profile = profileResult.data;
      state.selectedAnime = profileToAnime(state.profile);
    }

    if (membersResult.error) {
      showMessage(authMessage, membersResult.error.message, true);
      state.members = [];
    } else {
      state.members = membersResult.data || [];
    }

    if (adminResult.error) {
      state.adminProfiles = [];
    } else {
      state.adminProfiles = adminResult.data || [];
    }
  }

  function render() {
    if (!state.session || !state.profile) {
      renderLoggedOut();
      renderMembers(state.members);
      renderStats(state.members);
      return;
    }

    profileForm.elements.bio.disabled = false;
    animeSearchInput.disabled = false;
    animeSearchButton.disabled = false;
    reloadAvatarsButton.disabled = false;
    clearAnimeButton.disabled = false;
    saveProfileButton.disabled = false;
    logoutButton.disabled = false;
    avatarGrid.classList.remove("is-disabled");

    profileForm.elements.bio.value = state.profile.bio || "";

    sessionCard.className = "session-card";
    sessionCard.innerHTML = [
      state.profile.avatar_image_url
        ? '<img class="session-card__avatar" src="' +
          escapeHtml(state.profile.avatar_image_url) +
          '" alt="' +
          escapeHtml(state.profile.username) +
          ' avatar" />'
        : "",
      "<div>",
      '<p class="session-card__title">@' + escapeHtml(state.profile.username) + "</p>",
      '<p class="session-card__copy">' +
        escapeHtml(state.profile.bio || "No bio yet. Add your anime energy here.") +
        "</p>",
      state.selectedAnime?.title
        ? '<p class="session-card__subcopy">Current favorite: ' +
          escapeHtml(state.selectedAnime.title) +
          "</p>"
        : '<p class="session-card__subcopy">No favorite anime picked yet.</p>',
      "</div>",
    ].join("");

    renderAvatarChoices();
    renderSelectedAnime();
    renderAnimeResults();
    renderMembers(state.members);
    renderStats(state.members);
    renderAdminPanel();
  }

  function renderLoggedOut() {
    profileForm.elements.bio.disabled = true;
    profileForm.elements.bio.value = "";
    animeSearchInput.disabled = true;
    animeSearchInput.value = "";
    animeSearchButton.disabled = true;
    reloadAvatarsButton.disabled = true;
    clearAnimeButton.disabled = true;
    saveProfileButton.disabled = true;
    logoutButton.disabled = true;
    avatarGrid.classList.add("is-disabled");
    animeResults.innerHTML =
      '<div class="empty-state">Log in to search anime and build your profile.</div>';
    selectedAnime.className = "selected-anime is-empty";
    selectedAnime.innerHTML =
      '<p class="selected-anime__empty">No anime selected yet.</p>';
    animeSuggestions.innerHTML =
      '<div class="empty-state">Type letters like "o" or "nar" to get anime suggestions after login.</div>';
    sessionCard.className = "session-card session-card--empty";
    sessionCard.innerHTML = [
      '<p class="session-card__title">Not logged in yet</p>',
      '<p class="session-card__copy">Log in to set your avatar, write a bio, and choose your favorite anime with poster art.</p>',
    ].join("");
  }

  function renderAnimeSuggestions() {
    if (!state.animeSuggestions.length) {
      animeSuggestions.innerHTML =
        '<div class="empty-state">Type letters like "o" or "nar" to get anime suggestions after login.</div>';
      return;
    }

    animeSuggestions.innerHTML = state.animeSuggestions
      .map(function (anime) {
        const title = anime.title || anime.title_english || "Unknown title";
        const image =
          anime.images?.jpg?.image_url || anime.images?.webp?.image_url || "";
        return [
          '<button class="suggestion-card" type="button" data-anime-id="' + anime.mal_id + '">',
          '<img src="' + escapeHtml(image) + '" alt="' + escapeHtml(title) + '" />',
          "<div>",
          '<p class="suggestion-card__title">' + escapeHtml(title) + "</p>",
          '<p class="suggestion-card__meta">' + escapeHtml(String(anime.year || "Unknown year")) + "</p>",
          "</div>",
          "</button>",
        ].join("");
      })
      .join("");

    Array.from(animeSuggestions.querySelectorAll(".suggestion-card")).forEach(function (button) {
      button.addEventListener("click", function () {
        const animeId = Number(button.dataset.animeId);
        const anime = state.animeSuggestions.find(function (entry) {
          return entry.mal_id === animeId;
        });
        if (!anime) {
          return;
        }
        applySelectedAnime(anime);
      });
    });
  }

  function renderAvatarChoices() {
    if (!state.avatarChoices.length) {
      avatarGrid.innerHTML =
        '<div class="empty-state">Avatar picks are not ready yet.</div>';
      return;
    }

    avatarGrid.innerHTML = state.avatarChoices
      .map(function (choice) {
        const selected = state.profile?.avatar_image_url === choice.image;
        return [
          '<button class="avatar-option ' +
            (selected ? "is-selected" : "") +
            '" type="button" data-avatar-image="' +
            escapeHtml(choice.image) +
            '" data-name="' +
            escapeHtml(choice.name) +
            '">',
          '<img src="' +
            escapeHtml(choice.image) +
            '" alt="' +
            escapeHtml(choice.name) +
            '" />',
          "</button>",
        ].join("");
      })
      .join("");

    Array.from(avatarGrid.querySelectorAll(".avatar-option")).forEach(function (button) {
      button.addEventListener("click", function () {
        if (!state.profile) {
          return;
        }
        state.profile.avatar_image_url = button.dataset.avatarImage;
        renderAvatarChoices();
        render();
      });
    });
  }

  function renderAnimeResults() {
    if (!state.animeResults.length) {
      animeResults.innerHTML =
        '<div class="empty-state">Search for anime to pick a poster and title.</div>';
      return;
    }

    animeResults.innerHTML = state.animeResults
      .map(function (anime) {
        const title = anime.title || anime.title_english || "Unknown title";
        const image =
          anime.images?.jpg?.image_url || anime.images?.webp?.image_url || "";
        const score = anime.score ? "Score " + anime.score : "No score";
        const year = anime.year || "Unknown year";
        return [
          '<article class="anime-card">',
          '<img class="anime-card__poster" src="' +
            escapeHtml(image) +
            '" alt="' +
            escapeHtml(title) +
            '" />',
          "<div>",
          '<p class="anime-card__title">' + escapeHtml(title) + "</p>",
          '<p class="anime-card__meta">' +
            escapeHtml(year + " • " + score) +
            "</p>",
          "</div>",
          '<button class="pick-button" type="button" data-anime-id="' +
            anime.mal_id +
            '">Pick</button>',
          "</article>",
        ].join("");
      })
      .join("");

    Array.from(animeResults.querySelectorAll(".pick-button")).forEach(function (button) {
      button.addEventListener("click", function () {
        const animeId = Number(button.dataset.animeId);
        const anime = state.animeResults.find(function (entry) {
          return entry.mal_id === animeId;
        });
        if (!anime) {
          return;
        }
        applySelectedAnime(anime);
      });
    });
  }

  function renderSelectedAnime() {
    if (!state.selectedAnime?.title) {
      selectedAnime.className = "selected-anime is-empty";
      selectedAnime.innerHTML =
        '<p class="selected-anime__empty">No anime selected yet.</p>';
      return;
    }

    selectedAnime.className = "selected-anime is-filled";
    selectedAnime.innerHTML = [
      '<img class="selected-anime__poster" src="' +
        escapeHtml(state.selectedAnime.image || "") +
        '" alt="' +
        escapeHtml(state.selectedAnime.title) +
        '" />',
      "<div>",
      '<p class="selected-anime__title">' +
        escapeHtml(state.selectedAnime.title) +
        "</p>",
      '<p class="selected-anime__meta">This poster will be used across your profile and the squad feed.</p>',
      "</div>",
    ].join("");
  }

  function renderMembers(members) {
    const filteredMembers = members.filter(function (member) {
      if (!state.feedQuery) {
        return true;
      }
      const haystack = [member.username, member.bio, member.favorite_anime]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(state.feedQuery);
    });

    if (!filteredMembers.length) {
      memberGrid.innerHTML =
        '<div class="empty-state">No members match that search yet.</div>';
      return;
    }

    memberGrid.innerHTML = filteredMembers
      .map(function (member) {
        const backgroundImage =
          member.favorite_anime_image_url || randomFallbackImage(member.username);
        const avatar =
          member.avatar_image_url ||
          randomFallbackImage((member.favorite_anime || "") + member.username);
        return [
          '<article class="member-card" style="background-image: linear-gradient(180deg, rgba(5, 7, 18, 0.12) 0%, rgba(5, 7, 18, 0.92) 100%), url(\'' +
            escapeHtml(backgroundImage) +
            '\');">',
          '<div class="member-card__top">',
          '<img class="member-card__avatar" src="' +
            escapeHtml(avatar) +
            '" alt="' +
            escapeHtml(member.username) +
            ' avatar" />',
          "<div>",
          '<span class="badge">@' + escapeHtml(member.username) + "</span>",
          '<p class="member-card__name">@' + escapeHtml(member.username) + "</p>",
          "</div>",
          "</div>",
          member.favorite_anime
            ? '<p class="member-card__anime">' +
              escapeHtml(member.favorite_anime) +
              "</p>"
            : '<p class="member-card__empty">Still deciding on a favorite anime.</p>',
          member.bio
            ? '<p class="member-card__bio">' + escapeHtml(member.bio) + "</p>"
            : '<p class="member-card__bio">No bio yet.</p>',
          '<div class="member-card__footer">',
          member.avatar_image_url
            ? '<span class="tag">Avatar picked</span>'
            : '<span class="tag">No avatar yet</span>',
          member.favorite_anime_image_url
            ? '<span class="tag">Poster mode</span>'
            : '<span class="tag">Text only</span>',
          "</div>",
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
    avatarCount.textContent = String(
      members.filter(function (member) {
        return Boolean(member.avatar_image_url);
      }).length
    );
  }

  function renderHero(animeList) {
    const backgroundImage =
      animeList[0]?.images?.jpg?.large_image_url || FALLBACK_HERO_IMAGES[0];
    hero.querySelector(".hero__overlay").style.backgroundImage =
      "linear-gradient(90deg, rgba(9, 8, 20, 0.86), rgba(9, 8, 20, 0.38)), url('" +
      backgroundImage +
      "')";

    const chips = animeList.length
      ? animeList
          .map(function (anime) {
            return '<span class="hero-chip">' + escapeHtml(anime.title || "Anime pick") + "</span>";
          })
          .join("")
      : FALLBACK_HERO_IMAGES.map(function (_image, index) {
          return '<span class="hero-chip">Top anime ' + (index + 1) + "</span>";
        }).join("");
    heroChips.innerHTML = chips;
  }

  function renderAdminPanel() {
    adminPanel.classList.toggle("is-hidden", !state.isAdmin);

    if (!state.isAdmin) {
      adminGrid.innerHTML = "";
      return;
    }

    if (!state.adminProfiles.length) {
      adminGrid.innerHTML =
        '<div class="empty-state">No profile data available for admin view yet.</div>';
      return;
    }

    adminGrid.innerHTML = state.adminProfiles
      .map(function (profile) {
        return [
          '<article class="admin-card">',
          '<p class="admin-card__title">@' + escapeHtml(profile.username) + "</p>",
          '<p class="admin-card__meta">Created: ' + escapeHtml(formatDate(profile.created_at)) + "<br />Updated: " + escapeHtml(formatDate(profile.updated_at || profile.created_at)) + "</p>",
          '<p class="admin-card__meta">Bio: ' + escapeHtml(profile.bio || "No bio yet.") + "</p>",
          '<p class="admin-card__meta">Favorite anime: ' + escapeHtml(profile.favorite_anime || "Not selected") + "</p>",
          '<p class="admin-card__meta">Avatar saved: ' + escapeHtml(profile.avatar_image_url ? "Yes" : "No") + "</p>",
          "</article>",
        ].join("");
      })
      .join("");
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

  function clearSelectedAnime() {
    state.selectedAnime = null;
    renderSelectedAnime();
  }

  function applySelectedAnime(anime) {
    state.selectedAnime = {
      malId: anime.mal_id,
      title: anime.title || anime.title_english || "Unknown title",
      image:
        anime.images?.jpg?.large_image_url ||
        anime.images?.jpg?.image_url ||
        anime.images?.webp?.large_image_url ||
        "",
    };
    animeSearchInput.value = state.selectedAnime.title;
    renderSelectedAnime();
  }

  async function handleAnimeSuggest() {
    clearTimeout(animeSuggestionTimer);
    const query = String(animeSearchInput.value || "").trim();

    if (!query) {
      state.animeSuggestions = [];
      renderAnimeSuggestions();
      return;
    }

    animeSuggestionTimer = setTimeout(async function () {
      try {
        const response = await fetch(
          JIKAN_BASE_URL + "/anime?q=" + encodeURIComponent(query) + "&limit=5&sfw"
        );
        const payload = await response.json();
        state.animeSuggestions = Array.isArray(payload.data) ? payload.data : [];
        renderAnimeSuggestions();
      } catch {
        state.animeSuggestions = [];
        renderAnimeSuggestions();
      }
    }, 280);
  }

  function profileToAnime(profile) {
    if (!profile?.favorite_anime) {
      return null;
    }

    return {
      malId: profile.favorite_anime_mal_id || null,
      title: profile.favorite_anime,
      image: profile.favorite_anime_image_url || "",
    };
  }

  function normalizeUsername(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");
  }

  function isCurrentUserAdmin() {
    const email = state.session?.user?.email || "";
    const adminEmail = window.APP_CONFIG?.adminEmail || "";
    return Boolean(email && adminEmail && email.toLowerCase() === adminEmail.toLowerCase());
  }

  function formatDate(value) {
    if (!value) {
      return "Unknown";
    }

    try {
      return new Date(value).toLocaleString();
    } catch {
      return String(value);
    }
  }

  function randomFallbackImage(seed) {
    const index = Math.abs(hashCode(seed || "anime-circle")) % FALLBACK_HERO_IMAGES.length;
    return FALLBACK_HERO_IMAGES[index];
  }

  function hashCode(value) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(index);
      hash |= 0;
    }
    return hash;
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
