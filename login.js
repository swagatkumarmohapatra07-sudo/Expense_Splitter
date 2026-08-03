(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const CREDS_KEY = "splitmate_creds";
  const SESSION_KEY = "splitmate_session";
  const GROUP_KEY = "splitmate_group";

  const uid = () =>
    (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random());

  function readCreds() {
    try {
      const c = JSON.parse(localStorage.getItem(CREDS_KEY));
      return c && typeof c === "object" && !Array.isArray(c) ? c : {};
    } catch (e) {
      return {};
    }
  }

  function hasGroup() {
    try {
      const g = JSON.parse(localStorage.getItem(GROUP_KEY));
      return !!(g && g.id && g.name);
    } catch (e) {
      return false;
    }
  }

  function setError(msg) {
    $("loginError").textContent = msg || "";
  }

  function redirect() {
    location.href = "index.html";
  }

  function showTab(which) {
    const login = which === "login";
    $("loginForm").hidden = !login;
    $("signupForm").hidden = login;
    $("tabLogin").classList.toggle("active", login);
    $("tabSignup").classList.toggle("active", !login);
    if (login) {
      $("authTitle").textContent = "Welcome back";
      $("authSub").textContent = "Log in to your roommate group.";
    } else {
      $("authTitle").textContent = "Start your group";
      $("authSub").textContent = "Create a roommate group and become its admin.";
    }
    setError("");
  }

  function doLogin() {
    const u = $("username").value.trim();
    const p = $("password").value;
    if (!u || !p) {
      setError("Enter your username and password.");
      return;
    }
    const creds = readCreds();
    const entry = Object.entries(creds).find(
      ([id, c]) => c.username.toLowerCase() === u.toLowerCase()
    );
    if (!entry || entry[1].password !== p) {
      setError("Invalid username or password.");
      return;
    }
    localStorage.setItem(SESSION_KEY, entry[0]);
    redirect();
  }

  function doSignup() {
    const gname = $("gName").value.trim().replace(/\s+/g, " ");
    const name = $("signupName").value.trim().replace(/\s+/g, " ");
    const u = $("signupUser").value.trim();
    const p = $("signupPass").value;
    if (!gname) { setError("Enter a group name."); return; }
    if (!name) { setError("Enter your name."); return; }
    if (u.length < 3) { setError("Username must be at least 3 characters."); return; }
    if (p.length < 6) { setError("Password must be at least 6 characters."); return; }
    const creds = readCreds();
    if (Object.values(creds).some((c) => c.username.toLowerCase() === u.toLowerCase())) {
      setError("That username is already taken.");
      return;
    }
    creds["admin"] = { username: u, password: p, isAdmin: true, name: name };
    localStorage.setItem(CREDS_KEY, JSON.stringify(creds));
    localStorage.setItem(GROUP_KEY, JSON.stringify({ id: uid(), name: gname }));
    localStorage.setItem(SESSION_KEY, "admin");
    redirect();
  }

  $("loginBtn").addEventListener("click", doLogin);
  $("signupBtn").addEventListener("click", doSignup);
  $("password").addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
  $("signupPass").addEventListener("keydown", (e) => { if (e.key === "Enter") doSignup(); });
  $("tabLogin").addEventListener("click", () => showTab("login"));
  $("tabSignup").addEventListener("click", () => showTab("signup"));

  if (localStorage.getItem(SESSION_KEY)) {
    redirect();
    return;
  }

  showTab(hasGroup() ? "login" : "signup");
})();
