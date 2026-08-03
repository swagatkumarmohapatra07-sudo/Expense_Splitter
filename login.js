(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const CREDS_KEY = "splitmate_creds";
  const SESSION_KEY = "splitmate_session";

  function readCreds() {
    try {
      const c = JSON.parse(localStorage.getItem(CREDS_KEY));
      return c && typeof c === "object" && !Array.isArray(c) ? c : {};
    } catch (e) {
      return {};
    }
  }

  function setError(msg) {
    $("loginError").textContent = msg || "";
  }

  function redirect() {
    location.href = "index.html";
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

  function doSetup() {
    const u = $("adminUser").value.trim();
    const p = $("adminPass").value;
    if (u.length < 3) { setError("Username must be at least 3 characters."); return; }
    if (p.length < 6) { setError("Password must be at least 6 characters."); return; }
    const creds = readCreds();
    if (Object.values(creds).some((c) => c.username.toLowerCase() === u.toLowerCase())) {
      setError("That username is already taken.");
      return;
    }
    creds["admin"] = { username: u, password: p, isAdmin: true, name: "Admin" };
    localStorage.setItem(CREDS_KEY, JSON.stringify(creds));
    localStorage.setItem(SESSION_KEY, "admin");
    redirect();
  }

  $("loginBtn").addEventListener("click", doLogin);
  $("setupBtn").addEventListener("click", doSetup);
  $("password").addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
  $("adminPass").addEventListener("keydown", (e) => { if (e.key === "Enter") doSetup(); });

  if (localStorage.getItem(SESSION_KEY)) {
    redirect();
    return;
  }

  const hasAdmin = Object.values(readCreds()).some((c) => c.isAdmin);
  if (hasAdmin) {
    $("loginForm").hidden = false;
    $("setupForm").hidden = true;
    $("loginHint").textContent = "Members log in with the credentials shared by the admin.";
  } else {
    $("loginForm").hidden = true;
    $("setupForm").hidden = false;
    $("loginHint").textContent = "First-time setup — create the admin account.";
  }
})();
