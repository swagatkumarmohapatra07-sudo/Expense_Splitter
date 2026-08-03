(function () {
  "use strict";

  const FRIENDS_KEY = "splitmate_friends";
  const EXPENSES_KEY = "splitmate_expenses";
  const CREDS_KEY = "splitmate_creds";
  const SESSION_KEY = "splitmate_session";
  const GROUP_KEY = "splitmate_group";

  const $ = (id) => document.getElementById(id);

  let friends = [];
  let expenses = [];
  let creds = {};
  let group = null;
  let currentUser = null;
  let isAdmin = false;
  let toastTimer = null;

  const uid = () =>
    (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random());

  const fmt = (n) =>
    "₹" + Number(n || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });

  const escapeHtml = (str) =>
    String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const round2 = (n) => Math.round(n * 100) / 100;

  /* ---------- Credentials ---------- */

  function readCreds() {
    try {
      const c = JSON.parse(localStorage.getItem(CREDS_KEY));
      return c && typeof c === "object" && !Array.isArray(c) ? c : {};
    } catch (e) {
      return {};
    }
  }

  function saveCreds() {
    localStorage.setItem(CREDS_KEY, JSON.stringify(creds));
  }

  function secureRand(n) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] % n;
  }

  function generatePassword(len) {
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lower = "abcdefghijkmnpqrstuvwxyz";
    const digits = "23456789";
    const symbols = "!@#$%";
    const all = upper + lower + digits + symbols;
    let pw = "";
    pw += upper[secureRand(upper.length)];
    pw += lower[secureRand(lower.length)];
    pw += digits[secureRand(digits.length)];
    pw += symbols[secureRand(symbols.length)];
    for (let i = 0; i < len - 4; i++) pw += all[secureRand(all.length)];
    return pw;
  }

  function generateUsername(name) {
    const base =
      name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "") || "user";
    let username = base;
    let i = 2;
    const taken = Object.values(creds).map((c) => c.username.toLowerCase());
    while (taken.indexOf(username.toLowerCase()) !== -1) {
      username = base + i++;
    }
    return username;
  }

  function generateCredential(name) {
    return { username: generateUsername(name), password: generatePassword(10) };
  }

  function ensureCreds() {
    let changed = false;
    friends.forEach((f) => {
      if (!creds[f.id]) {
        const c = generateCredential(f.name);
        creds[f.id] = { username: c.username, password: c.password, name: f.name };
        changed = true;
      }
    });
    if (changed) saveCreds();
  }

  function showCredModal(name, username, password) {
    $("credName").textContent = name;
    $("credUser").textContent = username;
    $("credPass").textContent = password;
    $("credModal").hidden = false;
  }

  function closeCredModal() {
    $("credModal").hidden = true;
  }

  function copyCred(id) {
    const val = $(id).textContent;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(val);
      toast("Copied to clipboard.");
    }
  }

  /* ---------- Persistence ---------- */

  function loadData() {
    try {
      friends = JSON.parse(localStorage.getItem(FRIENDS_KEY)) || [];
      expenses = JSON.parse(localStorage.getItem(EXPENSES_KEY)) || [];
    } catch (e) {
      friends = [];
      expenses = [];
    }
    if (!Array.isArray(friends)) friends = [];
    if (!Array.isArray(expenses)) expenses = [];
    creds = readCreds();
    try {
      const g = JSON.parse(localStorage.getItem(GROUP_KEY));
      group = g && g.id && g.name ? g : null;
    } catch (e) {
      group = null;
    }
  }

  function saveFriends() {
    localStorage.setItem(FRIENDS_KEY, JSON.stringify(friends));
  }

  function saveExpenses() {
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
  }

  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  /* ---------- Friends ---------- */

  function addFriend() {
    if (!isAdmin) {
      toast("Only the admin can add members.");
      return;
    }
    const input = $("friendName");
    const name = input.value.trim().replace(/\s+/g, " ");
    if (!name) {
      toast("Enter a friend's name first.");
      input.focus();
      return;
    }
    if (friends.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      toast('"' + name + '" is already in the group.');
      return;
    }
    const id = uid();
    friends.push({ id: id, name: name });
    const cred = generateCredential(name);
    creds[id] = { username: cred.username, password: cred.password, name: name };
    saveFriends();
    saveCreds();
    input.value = "";
    input.focus();
    renderAll();
    showCredModal(name, cred.username, cred.password);
  }

  function removeFriend(id) {
    if (!isAdmin) {
      toast("Only the admin can remove members.");
      return;
    }
    const friend = friends.find((f) => f.id === id);
    if (!friend) return;
    const used = expenses.some((e) => e.paidBy === id || e.shares.indexOf(id) !== -1);
    if (used) {
      toast('"' + friend.name + '" is used in expenses. Delete those first.');
      return;
    }
    friends = friends.filter((f) => f.id !== id);
    delete creds[id];
    saveFriends();
    saveCreds();
    renderAll();
    toast(friend.name + " removed from the group.");
  }

  function renderFriends() {
    const box = $("friendList");
    $("friendCount").textContent = friends.length;
    if (!friends.length) {
      box.innerHTML = '<div class="empty">No friends yet — add someone to start splitting.</div>';
      return;
    }
    box.innerHTML = friends
      .map(
        (f) =>
          '<span class="friend-tag">' +
          '<span class="initial">' + escapeHtml(f.name.charAt(0).toUpperCase()) + "</span>" +
          escapeHtml(f.name) +
          '<button class="btn-icon" title="Remove" onclick="removeFriend(\'' + f.id + '\')">✕</button>' +
          "</span>"
      )
      .join("");
  }

  function renderPaidBy() {
    $("expPaidBy").innerHTML =
      '<option value="">— Select who paid —</option>' +
      friends
        .map((f) => '<option value="' + f.id + '">' + escapeHtml(f.name) + "</option>")
        .join("");
  }

  function renderSplitList() {
    const box = $("splitList");
    if (!friends.length) {
      box.innerHTML = '<div class="empty">Add friends to choose who shares the cost.</div>';
      return;
    }
    box.innerHTML = friends
      .map(
        (f) =>
          '<div class="split-item">' +
          '<input type="checkbox" id="split-' + f.id + '" value="' + f.id + '">' +
          '<label for="split-' + f.id + '">' + escapeHtml(f.name) + "</label>" +
          "</div>"
      )
      .join("");
  }

  /* ---------- Expenses ---------- */

  function addExpense() {
    const desc = $("expDesc").value.trim().replace(/\s+/g, " ");
    const amount = parseFloat($("expAmount").value);
    const paidBy = $("expPaidBy").value;
    const shares = Array.from(
      document.querySelectorAll("#splitList input:checked")
    ).map((cb) => cb.value);

    if (!desc) { toast("Enter a description."); $("expDesc").focus(); return; }
    if (!(amount > 0)) { toast("Enter a valid amount greater than 0."); $("expAmount").focus(); return; }
    if (!paidBy) { toast("Select who paid."); $("expPaidBy").focus(); return; }
    if (!shares.length) { toast("Select at least one person to split with."); return; }

    expenses.push({
      id: uid(),
      desc: desc,
      amount: round2(amount),
      paidBy: paidBy,
      shares: shares,
      date: new Date().toISOString()
    });

    saveExpenses();
    $("expDesc").value = "";
    $("expAmount").value = "";
    $("expPaidBy").value = "";
    document.querySelectorAll("#splitList input:checked").forEach((cb) => (cb.checked = false));
    renderAll();
    toast("Expense added.");
  }

  function removeExpense(id) {
    expenses = expenses.filter((e) => e.id !== id);
    saveExpenses();
    renderAll();
    toast("Expense deleted.");
  }

  function renderHistory() {
    const body = $("historyBody");
    $("expenseCount").textContent = expenses.length;

    if (!expenses.length) {
      body.innerHTML =
        '<tr><td colspan="5"><div class="empty">No expenses yet. Log your first one!</div></td></tr>';
      return;
    }

    body.innerHTML = expenses
      .map((e) => {
        const payer = friends.find((f) => f.id === e.paidBy);
        const payerName = payer ? payer.name : "Unknown";
        const shareNames = e.shares
          .map((id) => {
            const f = friends.find((x) => x.id === id);
            return f ? f.name : "?";
          })
          .join(", ");
        return (
          "<tr>" +
          "<td>" + escapeHtml(e.desc) + "</td>" +
          '<td class="amount-cell">' + fmt(e.amount) + "</td>" +
          '<td><span class="paid-badge">' + escapeHtml(payerName) + "</span></td>" +
          '<td class="share-list">' + escapeHtml(shareNames) + "</td>" +
          '<td style="text-align:right;">' +
          '<button class="btn-icon" title="Delete" onclick="removeExpense(\'' + e.id + '\')">🗑</button>' +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  /* ---------- Settlement ---------- */

  function computeBalances() {
    const balance = {};
    friends.forEach((f) => (balance[f.id] = 0));

    expenses.forEach((e) => {
      if (balance[e.paidBy] === undefined || !e.shares.length) return;
      const share = round2(e.amount / e.shares.length);
      balance[e.paidBy] = round2(balance[e.paidBy] + e.amount);
      e.shares.forEach((id) => {
        if (balance[id] !== undefined) {
          balance[id] = round2(balance[id] - share);
        }
      });
    });

    const sum = round2(Object.values(balance).reduce((a, b) => a + b, 0));
    if (Math.abs(sum) > 0.004) {
      const payer = friends.find((f) => balance[f.id] !== 0);
      if (payer) balance[payer.id] = round2(balance[payer.id] - sum);
    }

    return balance;
  }

  function computeSettlements(balance) {
    const debtors = Object.keys(balance)
      .map((id) => ({ id, amt: -balance[id] }))
      .filter((d) => d.amt > 0.004)
      .sort((a, b) => b.amt - a.amt);

    const creditors = Object.keys(balance)
      .map((id) => ({ id, amt: balance[id] }))
      .filter((c) => c.amt > 0.004)
      .sort((a, b) => b.amt - a.amt);

    const transfers = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const pay = Math.min(debtors[i].amt, creditors[j].amt);
      transfers.push({
        from: debtors[i].id,
        to: creditors[j].id,
        amount: round2(pay)
      });
      debtors[i].amt = round2(debtors[i].amt - pay);
      creditors[j].amt = round2(creditors[j].amt - pay);
      if (debtors[i].amt <= 0.004) i++;
      if (creditors[j].amt <= 0.004) j++;
    }
    return transfers;
  }

  function renderSettlements() {
    const grid = $("balanceGrid");
    const list = $("settlementList");

    if (!friends.length) {
      grid.innerHTML = '<div class="empty">Add friends to see balances.</div>';
      list.innerHTML = '<div class="empty">Nothing to settle yet.</div>';
      return;
    }

    const balance = computeBalances();

    grid.innerHTML = friends
      .map((f) => {
        const b = round2(balance[f.id] || 0);
        const cls = b > 0.004 ? "pos" : b < -0.004 ? "neg" : "zero";
        const sign = b > 0 ? "+" : "";
        return (
          '<div class="balance-card">' +
          '<div class="name">' + escapeHtml(f.name) + "</div>" +
          '<div class="val ' + cls + '">' + sign + fmt(b) + "</div>" +
          "</div>"
        );
      })
      .join("");

    const transfers = computeSettlements(balance);

    if (!transfers.length) {
      list.innerHTML = '<div class="empty">All settled up — no one owes anyone.</div>';
      return;
    }

    list.innerHTML = transfers
      .map((t) => {
        const from = friends.find((f) => f.id === t.from);
        const to = friends.find((f) => f.id === t.to);
        return (
          "<li>" +
          "<strong>" + escapeHtml(from ? from.name : "?") + "</strong>" +
          '<span class="arrow">owes →</span>' +
          "<strong>" + escapeHtml(to ? to.name : "?") + "</strong>" +
          '<span class="amnt">' + fmt(t.amount) + "</span>" +
          "</li>"
        );
      })
      .join("");
  }

  /* ---------- Wiring ---------- */

  function renderUserBar() {
    const label = (currentUser.name || currentUser.username) + (isAdmin ? " · Admin" : "");
    $("currentUser").textContent = label;
    $("groupChip").textContent = group ? "🏠 " + group.name : "";
    $("addFriendRow").hidden = !isAdmin;
    $("adminNote").hidden = isAdmin;
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    location.href = "login.html";
  }

  function renderAll() {
    renderUserBar();
    renderFriends();
    renderPaidBy();
    renderSplitList();
    renderHistory();
    renderSettlements();
  }

  function resetAll() {
    if (!isAdmin) {
      toast("Only the admin can reset data.");
      return;
    }
    if (!confirm("Remove ALL friends, expenses and member accounts? This cannot be undone.")) return;
    friends = [];
    expenses = [];
    Object.keys(creds).forEach((id) => {
      if (!creds[id].isAdmin) delete creds[id];
    });
    saveFriends();
    saveExpenses();
    saveCreds();
    renderAll();
    toast("All data cleared.");
  }

  $("friendName").addEventListener("keydown", (e) => {
    if (e.key === "Enter") addFriend();
  });
  $("expDesc").addEventListener("keydown", (e) => {
    if (e.key === "Enter") addExpense();
  });

  window.addFriend = addFriend;
  window.removeFriend = removeFriend;
  window.addExpense = addExpense;
  window.removeExpense = removeExpense;
  window.resetAll = resetAll;
  window.logout = logout;
  window.closeCredModal = closeCredModal;
  window.copyCred = copyCred;

  loadData();
  ensureCreds();

  const sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId || !creds[sessionId]) {
    location.href = "login.html";
    return;
  }
  currentUser = creds[sessionId];
  isAdmin = !!currentUser.isAdmin;

  renderAll();
})();
