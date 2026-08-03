(function () {
  "use strict";

  const FRIENDS_KEY = "splitmate_friends";
  const EXPENSES_KEY = "splitmate_expenses";
  const CREDS_KEY = "splitmate_creds";
  const SESSION_KEY = "splitmate_session";
  const GROUP_KEY = "splitmate_group";
  const SETTLED_KEY = "splitmate_settled";

  const $ = (id) => document.getElementById(id);

  const PAGE =
    (document.body && document.body.dataset && document.body.dataset.page) || "";

  let friends = [];
  let expenses = [];
  let creds = {};
  let settled = new Set();
  let group = null;
  let currentUser = null;
  let currentUserId = null;
  let isAdmin = false;
  let toastTimer = null;
  let selectedFriendId = null;

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

  const ME_ID = "me";

  const formatDate = (iso) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
      });
    } catch (e) {
      return "—";
    }
  };

  const formatDateShort = (iso) => {
    if (!iso) return "—";
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      const parts = iso.split("-").map(Number);
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      return parts[2] + " " + months[parts[1] - 1] + " " + parts[0];
    }
    const dt = new Date(iso);
    if (isNaN(dt.getTime())) return iso;
    return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  const getName = (id) => {
    if (id === ME_ID) return currentUser ? currentUser.name || currentUser.username : "Me";
    const f = friends.find((x) => x.id === id);
    return f ? f.name : "?";
  };

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
        creds[f.id] = {
          username: c.username,
          password: c.password,
          name: f.name,
          createdBy: group ? group.name : "Admin",
          createdAt: new Date().toISOString()
        };
        changed = true;
      } else {
        const c = creds[f.id];
        if (!c.createdAt || !c.createdBy) {
          c.createdBy = c.createdBy || (group ? group.name : "Admin");
          c.createdAt = c.createdAt || new Date().toISOString();
          changed = true;
        }
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
    if ($("credModal")) $("credModal").hidden = true;
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
      const arr = JSON.parse(localStorage.getItem(SETTLED_KEY));
      settled = new Set(Array.isArray(arr) ? arr : []);
    } catch (e) {
      settled = new Set();
    }
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

  function saveSettled() {
    localStorage.setItem(SETTLED_KEY, JSON.stringify(Array.from(settled)));
  }

  function toast(msg) {
    const el = $("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  /* ---------- Member tags ---------- */

  function buildMemberTags(staticMode) {
    const meLabel = currentUser ? currentUser.name || currentUser.username : "Me";
    const meAttrs = staticMode
      ? ""
      : 'onclick="openFriend(\'' + ME_ID + '\')" title="View your details"';
    let html =
      '<span class="friend-tag you" ' + meAttrs + ">" +
      '<span class="initial">' + escapeHtml(meLabel.charAt(0).toUpperCase()) + "</span>" +
      escapeHtml(meLabel) +
      '<span class="you-badge">You</span>' +
      "</span>";
    if (!friends.length) {
      return staticMode
        ? html
        : html + '<div class="empty">No friends yet — add someone to start splitting.</div>';
    }
    return (
      html +
      friends
        .map((f) => {
          const attrs = staticMode
            ? ""
            : 'onclick="openFriend(\'' + f.id + '\')" title="View details"';
          return (
            '<span class="friend-tag" ' + attrs + ">" +
            '<span class="initial">' + escapeHtml(f.name.charAt(0).toUpperCase()) + "</span>" +
            escapeHtml(f.name) +
            "</span>"
          );
        })
        .join("")
    );
  }

  /* ---------- Friends ---------- */

  function renderFriends() {
    const box = $("friendList");
    if (!box) return;
    $("friendCount").textContent = friends.length;
    const sub = $("memberSub");
    if (sub) {
      sub.textContent =
        friends.length === 0
          ? "Add members to start splitting"
          : "You + " + friends.length + (friends.length === 1 ? " member" : " members");
    }
    box.innerHTML = buildMemberTags(false);
  }

  function renderPaidBy() {
    const meLabel = currentUser ? currentUser.name || currentUser.username : "Me";
    $("expPaidBy").innerHTML =
      '<option value="">— Select who paid —</option>' +
      '<option value="' + ME_ID + '">Me (' + escapeHtml(meLabel) + ')</option>' +
      friends
        .map((f) => '<option value="' + f.id + '">' + escapeHtml(f.name) + "</option>")
        .join("");
  }

  function renderSplitList() {
    const box = $("splitList");
    const meLabel = currentUser ? currentUser.name || currentUser.username : "Me";
    const ownItem =
      '<div class="split-item">' +
      '<input type="checkbox" id="split-own" value="__own__">' +
      '<label for="split-own">Only me (' + escapeHtml(meLabel) + ")</label>" +
      "</div>";

    if (!friends.length) {
      box.innerHTML =
        '<div class="empty">Add friends to choose who shares the cost.</div>' +
        ownItem;
      return;
    }
    box.innerHTML =
      ownItem +
      friends
        .map(
          (f) =>
            '<div class="split-item">' +
            '<input type="checkbox" id="split-' + f.id + '" value="' + f.id + '">' +
            '<label for="split-' + f.id + '">' + escapeHtml(f.name) + "</label>" +
            "</div>"
        )
        .join("");
  }

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
    creds[id] = {
      username: cred.username,
      password: cred.password,
      name: name,
      createdBy: currentUser ? currentUser.name || currentUser.username : "Admin",
      createdAt: new Date().toISOString()
    };
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
      return false;
    }
    const friend = friends.find((f) => f.id === id);
    if (!friend) return false;
    const used = expenses.some((e) => e.paidBy === id || e.shares.indexOf(id) !== -1);
    if (used) {
      toast('"' + friend.name + '" is used in expenses. Delete those first.');
      return false;
    }
    friends = friends.filter((f) => f.id !== id);
    delete creds[id];
    saveFriends();
    saveCreds();
    renderAll();
    toast(friend.name + " removed from the group.");
    return true;
  }

  /* ---------- Member details ---------- */

  function openFriend(id) {
    const isSelf = id === ME_ID;
    const f = isSelf ? null : friends.find((x) => x.id === id);
    const cred = isSelf ? creds[currentUserId] || {} : creds[id] || {};
    const name = isSelf
      ? currentUser.name || currentUser.username || "You"
      : f
        ? f.name
        : "";
    if (!isSelf && !f) return;
    selectedFriendId = id;
    $("fdAvatar").textContent = name.charAt(0).toUpperCase();
    $("fdName").textContent = name;
    $("fdSub").textContent = cred.username || "";
    $("fdUsername").textContent = cred.username || "—";
    $("fdPassword").textContent = cred.password || "—";
    $("fdCreated").textContent = formatDate(cred.createdAt);
    $("fdCreatedBy").textContent = cred.createdBy || "—";
    $("fdNewPass").value = "";
    $("fdConfirm").value = "";
    $("fdMsg").textContent = "";
    const canEdit = isAdmin || isSelf;
    $("fdPassSection").hidden = false;
    $("fdPermNote").hidden = canEdit;
    $("fdNewPass").disabled = !canEdit;
    $("fdConfirm").disabled = !canEdit;
    $("fdSaveBtn").disabled = !canEdit;
    $("fdRemoveSection").hidden = !isAdmin || isSelf;
    $("friendModal").hidden = false;
  }

  function closeFriendModal() {
    if ($("friendModal")) $("friendModal").hidden = true;
  }

  function deleteSelectedFriend() {
    if (!selectedFriendId) return;
    if (selectedFriendId === ME_ID) return;
    const f = friends.find((x) => x.id === selectedFriendId);
    if (!f) return;
    if (!confirm('Remove "' + f.name + '" and their login account? This cannot be undone.')) return;
    if (removeFriend(selectedFriendId)) closeFriendModal();
  }

  function changePassword() {
    if (!selectedFriendId) return;
    const isSelf = selectedFriendId === ME_ID;
    const cred = isSelf ? creds[currentUserId] : creds[selectedFriendId];
    if (!cred) return;
    if (!(isAdmin || isSelf)) {
      toast("You can't change this password.");
      return;
    }
    const np = $("fdNewPass").value;
    const cf = $("fdConfirm").value;
    if (np.length < 6) { $("fdMsg").textContent = "New password must be at least 6 characters."; return; }
    if (np !== cf) { $("fdMsg").textContent = "Passwords do not match."; return; }
    cred.password = np;
    saveCreds();
    $("fdPassword").textContent = np;
    $("fdNewPass").value = "";
    $("fdConfirm").value = "";
    $("fdMsg").textContent = "";
    const f = friends.find((x) => x.id === selectedFriendId);
    toast("Password updated for " + (f ? f.name : "your account") + ".");
  }

  function copyCred(id) {
    const el = $(id);
    if (!el) return;
    const val = el.textContent.trim();
    const done = () => toast("Copied to clipboard.");
    const fallback = () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = val;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, 9999);
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (ok) done();
        else toast("Copy failed — select the text manually.");
      } catch (e) {
        toast("Copy failed — select the text manually.");
      }
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(val).then(done, fallback);
    } else {
      fallback();
    }
  }

  /* ---------- Expenses ---------- */

  function addExpense() {
    const desc = $("expDesc").value.trim().replace(/\s+/g, " ");
    const amount = parseFloat($("expAmount").value);
    const paidBy = $("expPaidBy").value;
    const own = $("split-own") ? $("split-own").checked : false;
    const shares = Array.from(
      document.querySelectorAll("#splitList input:checked")
    )
      .map((cb) => cb.value)
      .filter((v) => v !== "__own__");

    if (!desc) { toast("Enter a description."); $("expDesc").focus(); return; }
    if (!(amount > 0)) { toast("Enter a valid amount greater than 0."); $("expAmount").focus(); return; }
    if (!paidBy) { toast("Select who paid."); $("expPaidBy").focus(); return; }
    if (!own && !shares.length) { toast("Select at least one person to split with."); return; }

    const dateVal = $("expDate").value || new Date().toISOString().slice(0, 10);

    expenses.push({
      id: uid(),
      desc: desc,
      amount: round2(amount),
      paidBy: paidBy,
      shares: own ? [] : shares,
      own: own,
      date: dateVal
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

  function buildStatusBadge(e, unpaidMatrix) {
    let ok = true;
    if (!e.own && e.shares && e.shares.length) {
      for (let i = 0; i < e.shares.length; i++) {
        const sid = e.shares[i];
        if (sid === e.paidBy) continue;
        const k = sid + "|" + e.paidBy;
        if ((unpaidMatrix[k] || 0) > 0.005) {
          ok = false;
          break;
        }
      }
    }
    return ok
      ? '<span class="status-badge ok">Successful</span>'
      : '<span class="status-badge pending">Pending</span>';
  }

  function renderHistory() {
    const body = $("historyBody");
    if (!body) return;
    $("expenseCount").textContent = expenses.length;
    $("navExpenseCount").textContent = expenses.length;

    if (!expenses.length) {
      body.innerHTML =
        '<tr><td colspan="7"><div class="empty">No expenses yet. Log your first one!</div></td></tr>';
      return;
    }

    const balance = computeBalances();
    const allTransfers = computeSettlements(balance);
    const unpaidMatrix = {};
    allTransfers.forEach((t) => {
      if (!settled.has(transferKey(t))) {
        const k = t.from + "|" + t.to;
        unpaidMatrix[k] = (unpaidMatrix[k] || 0) + t.amount;
      }
    });

    body.innerHTML = expenses
      .slice()
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .map((e) => {
        const payerName = getName(e.paidBy);
        const isSplit = !e.own && e.shares && e.shares.length > 0;
        const badge = isSplit
          ? '<span class="split-badge split">Split</span>'
          : '<span class="split-badge own">Not split</span>';
        const shareNames = e.own
          ? ""
          : e.shares
              .map((id) => getName(id))
              .join(", ");
        const status = buildStatusBadge(e, unpaidMatrix);
        return (
          "<tr>" +
          "<td>" + escapeHtml(e.desc) + "</td>" +
          '<td class="date-cell">' + formatDateShort(e.date) + "</td>" +
          '<td class="amount-cell">' + fmt(e.amount) + "</td>" +
          '<td><span class="paid-badge">' + escapeHtml(payerName) + "</span></td>" +
          '<td class="share-list">' + badge +
          (shareNames ? " " + escapeHtml(shareNames) : "") + "</td>" +
          "<td>" + status + "</td>" +
          '<td style="text-align:right;">' +
          '<button class="btn-icon" title="Delete" onclick="removeExpense(\'' + e.id + '\')">🗑</button>' +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  /* ---------- Split preview ---------- */

  function updateSplitPreview() {
    const el = $("splitPreview");
    if (!el) return;
    const amount = parseFloat($("expAmount").value);
    const ownBox = $("split-own");
    const own = ownBox ? ownBox.checked : false;
    const selected = Array.from(
      document.querySelectorAll("#splitList input:checked")
    )
      .map((cb) => cb.value)
      .filter((v) => v !== "__own__");

    if (own) {
      el.innerHTML = "<span>Paying for yourself only</span><strong>No split</strong>";
      return;
    }
    if (!selected.length) {
      el.innerHTML = "";
      return;
    }
    const share = round2(amount / selected.length);
    const selNames = selected.map((id) => getName(id)).join(", ");
    el.innerHTML =
      "<span>" + selected.length + " person split (" + escapeHtml(selNames) + ")</span>" +
      "<strong>" + (amount > 0 ? fmt(share) + " each" : "enter amount") + "</strong>";
  }

  /* ---------- Settlement ---------- */

  function computeBalances() {
    const balance = {};
    friends.forEach((f) => (balance[f.id] = 0));
    balance[ME_ID] = 0;

    expenses.forEach((e) => {
      const payer = e.paidBy === ME_ID ? ME_ID : e.paidBy;
      if (balance[payer] === undefined || !e.shares.length) return;
      const share = round2(e.amount / e.shares.length);
      balance[payer] = round2(balance[payer] + e.amount);
      e.shares.forEach((id) => {
        if (balance[id] !== undefined) {
          balance[id] = round2(balance[id] - share);
        }
      });
    });

    const sum = round2(Object.values(balance).reduce((a, b) => a + b, 0));
    if (Math.abs(sum) > 0.004) {
      const nonzero = Object.keys(balance).filter((id) => balance[id] !== 0);
      if (nonzero.length) balance[nonzero[0]] = round2(balance[nonzero[0]] - sum);
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

  const transferKey = (t) => t.from + "|" + t.to + "|" + t.amount;

  const ordinal = (d) => {
    const r = d % 100;
    if (r > 10 && r < 14) return d + "th";
    const s = d % 10;
    return d + (s === 1 ? "st" : s === 2 ? "nd" : s === 3 ? "rd" : "th");
  };

  const formatSettleDate = (iso) => {
    if (!iso) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      const parts = iso.split("-").map(Number);
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      return ordinal(parts[2]) + " " + months[parts[1] - 1];
    }
    const dt = new Date(iso);
    if (isNaN(dt.getTime())) return "";
    return ordinal(dt.getDate()) + " " + dt.toLocaleDateString("en-IN", { month: "short" });
  };

  const transferDate = (t) => {
    let latest = "";
    expenses.forEach((e) => {
      if (e.own || !e.shares || !e.shares.length) return;
      const involves =
        e.paidBy === t.from ||
        e.paidBy === t.to ||
        e.shares.indexOf(t.from) !== -1 ||
        e.shares.indexOf(t.to) !== -1;
      if (involves && e.date && e.date > latest) latest = e.date;
    });
    return latest;
  };

  function computeOutstanding(balance, settledSet) {
    const out = Object.assign({}, balance);
    settledSet.forEach((key) => {
      const parts = key.split("|");
      const from = parts[0];
      const to = parts[1];
      const amt = parseFloat(parts[2]);
      if (isNaN(amt)) return;
      if (out[from] !== undefined) out[from] = round2(out[from] + amt);
      if (out[to] !== undefined) out[to] = round2(out[to] - amt);
    });
    return out;
  }

  function computeSettlementData() {
    const balance = computeBalances();
    const baseTransfers = computeSettlements(balance);
    const validKeys = baseTransfers.map(transferKey);
    let pruned = false;
    settled.forEach((k) => {
      if (validKeys.indexOf(k) === -1) {
        settled.delete(k);
        pruned = true;
      }
    });
    if (pruned) saveSettled();
    const activeSettled = baseTransfers.filter((t) => settled.has(transferKey(t)));
    const outstanding = computeOutstanding(balance, activeSettled.map(transferKey));
    return { balance, baseTransfers, activeSettled, outstanding };
  }

  function flashBalance() {
    [$("balanceGrid"), $("sumStrip")].forEach((el) => {
      if (!el) return;
      el.classList.remove("flash");
      void el.offsetWidth;
      el.classList.add("flash");
    });
  }

  function togglePaid(key) {
    const wasPaid = settled.has(key);
    if (wasPaid) {
      settled.delete(key);
      toast("Settlement restored.");
    } else {
      settled.add(key);
      toast("Marked as paid — balances updated.");
    }
    saveSettled();
    renderAll();
    flashBalance();
  }

  function undoPaid() {
    settled.clear();
    saveSettled();
    renderAll();
    flashBalance();
  }

  /* ---------- Balances page ---------- */

  function renderBalances() {
    const data = computeSettlementData();
    renderSumStrip(data);
    renderSplitStats(data);
    renderBalanceGrid(data);
    renderSettlementsList(data);
  }

  function renderSumStrip(data) {
    const strip = $("sumStrip");
    if (!strip) return;
    data = data || computeSettlementData();
    const meBalance = round2(data.outstanding[ME_ID] || 0);
    const totalSpent = round2(expenses.reduce((a, e) => a + e.amount, 0));
    const settledTotal = round2(data.activeSettled.reduce((a, t) => a + t.amount, 0));
    const youGet = meBalance > 0.004 ? meBalance : 0;
    const youOwe = meBalance < -0.004 ? -meBalance : 0;

    strip.innerHTML =
      '<div class="sum-item"><span>Total spent</span><strong>' + fmt(totalSpent) + "</strong></div>" +
      '<div class="sum-item"><span>Settled</span><strong class="' + (settledTotal > 0.004 ? "pos" : "zero") + '">' + fmt(settledTotal) + "</strong></div>" +
      '<div class="sum-item"><span>You get back</span><strong class="' + (youGet > 0 ? "pos" : "zero") + '">' + fmt(youGet) + "</strong></div>" +
      '<div class="sum-item"><span>You owe</span><strong class="' + (youOwe > 0 ? "neg" : "zero") + '">' + fmt(youOwe) + "</strong></div>";
  }

  function renderSplitStats(data) {
    const stats = $("splitStats");
    if (!stats) return;
    data = data || computeSettlementData();
    const paidTotals = {};
    friends.forEach((f) => (paidTotals[f.id] = 0));
    paidTotals[ME_ID] = 0;
    expenses.forEach((e) => {
      const payer = e.paidBy === ME_ID ? ME_ID : e.paidBy;
      if (paidTotals[payer] !== undefined) paidTotals[payer] = round2(paidTotals[payer] + e.amount);
    });

    const paidCount = Object.keys(paidTotals).filter((id) => (paidTotals[id] || 0) > 0.004).length;
    const totalMembers = friends.length + 1;
    const notPaid = friends.filter((f) => (paidTotals[f.id] || 0) <= 0.004);
    let html =
      "<span>" + paidCount + " of " + totalMembers + " members have paid</span>";
    if (notPaid.length) {
      html +=
        "<span>Yet to pay: " +
        notPaid.map((f) => escapeHtml(f.name)).join(", ") +
        "</span>";
    }
    stats.innerHTML = html;
  }

  function renderBalanceGrid(data) {
    const grid = $("balanceGrid");
    if (!grid) return;
    data = data || computeSettlementData();
    const outstanding = data.outstanding;
    const activeSettled = data.activeSettled;

    const paidTotals = {};
    friends.forEach((f) => (paidTotals[f.id] = 0));
    paidTotals[ME_ID] = 0;
    expenses.forEach((e) => {
      const payer = e.paidBy === ME_ID ? ME_ID : e.paidBy;
      if (paidTotals[payer] !== undefined) paidTotals[payer] = round2(paidTotals[payer] + e.amount);
    });

    const settledIds = new Set();
    activeSettled.forEach((t) => {
      settledIds.add(t.from);
      settledIds.add(t.to);
    });

    const meLabel = currentUser ? currentUser.name || currentUser.username : "Me";

    const balanceCard = (id, label) => {
      const b = round2(outstanding[id] || 0);
      const cls = b > 0.004 ? "pos" : b < -0.004 ? "neg" : "zero";
      const bCls = b > 0.004 ? "b-pos" : b < -0.004 ? "b-neg" : "b-zero";
      const sign = b > 0 ? "+" : "";
      const tagCls = b > 0.004 ? "gets" : b < -0.004 ? "owes" : "even";
      const tagTxt = b > 0.004 ? "gets back" : b < -0.004 ? "owes" : "even";
      const settledMark =
        settledIds.has(id) && Math.abs(b) <= 0.004
          ? '<div class="card-settled">✓ settled</div>'
          : "";
      return (
        '<div class="balance-card ' + bCls + '">' +
        '<div class="name">' + escapeHtml(label) + "</div>" +
        '<div class="val ' + cls + '">' + sign + fmt(b) + "</div>" +
        '<div class="tag ' + tagCls + '">' + tagTxt + "</div>" +
        settledMark +
        '<div class="paid">paid ' + fmt(paidTotals[id] || 0) + "</div>" +
        "</div>"
      );
    };

    grid.innerHTML =
      balanceCard(ME_ID, "Me (" + meLabel + ")") +
      friends.map((f) => balanceCard(f.id, f.name)).join("");
  }

  function renderSettlementsList(data) {
    const list = $("settlementList");
    if (!list) return;
    data = data || computeSettlementData();
    const outstanding = data.outstanding;
    const activeSettled = data.activeSettled;

    const settledBlock = (paidTransfers) => {
      if (!paidTransfers.length) return "";
      const items = paidTransfers
        .map((t) => {
          const key = transferKey(t);
          return (
            '<div class="settled-item">' +
            "<strong>" + escapeHtml(getName(t.from)) + "</strong>" +
            '<span class="arrow">pays →</span>' +
            "<strong>" + escapeHtml(getName(t.to)) + "</strong>" +
            '<span class="amnt">' + fmt(t.amount) + "</span>" +
            '<button class="btn-icon btn-del" title="Delete settled payment" onclick="togglePaid(\'' + key + '\')">🗑</button>' +
            '<button class="btn-undo" title="Restore" onclick="togglePaid(\'' + key + '\')">Restore</button>' +
            "</div>"
          );
        })
        .join("");
      return (
        '<div class="settled-block">' +
        '<div class="settled-head">Settled — ' + paidTransfers.length + " payment" +
        (paidTransfers.length > 1 ? "s" : "") + "</div>" +
        items +
        '<button class="btn-undo btn-clear" onclick="undoPaid()">Clear all paid marks</button>' +
        "</div>"
      );
    };

    const transfers = computeSettlements(outstanding);

    if (!transfers.length) {
      if (!expenses.length) {
        list.innerHTML =
          '<div class="empty">No expenses yet — log your first one to see who owes whom.</div>';
      } else if (activeSettled.length) {
        list.innerHTML =
          '<div class="empty">All cleared — every settlement is marked as paid.</div>' +
          settledBlock(activeSettled);
      } else {
        list.innerHTML = '<div class="empty">All settled up — no one owes anyone.</div>';
      }
      return;
    }

    list.innerHTML =
      transfers
        .map((t) => {
          const from = getName(t.from);
          const to = getName(t.to);
          const key = transferKey(t);
          const d = transferDate(t);
          const dateHtml = d ? '<span class="settle-date">' + formatSettleDate(d) + "</span>" : "";
          return (
            '<li class="settle-item">' +
            '<div class="settle-main">' +
            "<strong>" + escapeHtml(from) + "</strong>" +
            '<span class="arrow">pays →</span>' +
            "<strong>" + escapeHtml(to) + "</strong>" +
            "</div>" +
            dateHtml +
            '<span class="amnt">' + fmt(t.amount) + "</span>" +
            '<button class="btn-paid" onclick="togglePaid(\'' + key + '\')">Mark paid</button>' +
            "</li>"
          );
        })
        .join("") +
      settledBlock(activeSettled);
  }

  /* ---------- Home dashboard ---------- */

  function renderRecent() {
    const box = $("recentList");
    if (!box) return;
    if (!expenses.length) {
      box.innerHTML = '<div class="empty">No expenses yet — log your first one!</div>';
      return;
    }
    const data = computeSettlementData();
    const allTransfers = computeSettlements(data.balance);
    const unpaidMatrix = {};
    allTransfers.forEach((t) => {
      if (!settled.has(transferKey(t))) {
        const k = t.from + "|" + t.to;
        unpaidMatrix[k] = (unpaidMatrix[k] || 0) + t.amount;
      }
    });
    const recent = expenses
      .slice()
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .slice(0, 5);
    box.innerHTML = recent
      .map((e) => {
        const status = buildStatusBadge(e, unpaidMatrix);
        return (
          '<div class="recent-item">' +
          '<div class="recent-main">' +
          "<strong>" + escapeHtml(e.desc) + "</strong>" +
          '<span class="recent-date">' + formatDateShort(e.date) + " · " + escapeHtml(getName(e.paidBy)) + "</span>" +
          "</div>" +
          '<span class="recent-amt">' + fmt(e.amount) + "</span>" +
          status +
          "</div>"
        );
      })
      .join("");
  }

  function renderHome() {
    const name = currentUser ? currentUser.name || currentUser.username : "";
    if ($("homeName")) $("homeName").textContent = name;
    if ($("homeGroup")) $("homeGroup").textContent = group ? "🏠 " + group.name : "SplitMate Group";
    if ($("homeSub")) {
      const data = computeSettlementData();
      const me = round2(data.outstanding[ME_ID] || 0);
      $("homeSub").textContent =
        me > 0.004
          ? "You get back " + fmt(me)
          : me < -0.004
            ? "You owe " + fmt(-me)
            : "You're all settled up";
    }
    if ($("friendCount")) $("friendCount").textContent = friends.length;
    const box = $("friendList");
    if (box) box.innerHTML = buildMemberTags(true);
    renderSumStrip();
    renderSplitStats();
    renderRecent();
  }

  /* ---------- Wiring ---------- */

  function updateNavCounts() {
    if ($("navFriendCount")) $("navFriendCount").textContent = friends.length;
    if ($("navExpenseCount")) $("navExpenseCount").textContent = expenses.length;
  }

  function renderUserBar() {
    const label = (currentUser.name || currentUser.username) + (isAdmin ? " · Admin" : "");
    if ($("currentUser")) $("currentUser").textContent = label;
    if ($("groupChip")) $("groupChip").textContent = group ? "🏠 " + group.name : "";
    if ($("addFriendRow")) $("addFriendRow").hidden = !isAdmin;
    if ($("adminNote")) $("adminNote").hidden = isAdmin;
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    location.href = "login.html";
  }

  function renderAll() {
    renderUserBar();
    updateNavCounts();
    if (PAGE === "home") {
      renderHome();
      renderPaidBy();
      renderSplitList();
      updateSplitPreview();
    } else if (PAGE === "friends") renderFriends();
    else if (PAGE === "balances") renderBalances();
    else if (PAGE === "history") renderHistory();
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

  /* ---------- Wiring listeners ---------- */

  if ($("credModal")) {
    $("credModal").addEventListener("click", (e) => {
      if (e.target === $("credModal")) closeCredModal();
    });
  }
  if ($("friendModal")) {
    $("friendModal").addEventListener("click", (e) => {
      if (e.target === $("friendModal")) closeFriendModal();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if ($("credModal") && !$("credModal").hidden) closeCredModal();
    if ($("friendModal") && !$("friendModal").hidden) closeFriendModal();
  });

  if ($("friendName")) {
    $("friendName").addEventListener("keydown", (e) => {
      if (e.key === "Enter") addFriend();
    });
  }
  if ($("expDesc")) {
    $("expDesc").addEventListener("keydown", (e) => {
      if (e.key === "Enter") addExpense();
    });
  }
  if ($("expAmount")) {
    $("expAmount").addEventListener("input", updateSplitPreview);
  }
  if ($("splitList")) {
    $("splitList").addEventListener("change", updateSplitPreview);
  }

  /* ---------- Exports ---------- */

  window.addFriend = addFriend;
  window.removeFriend = removeFriend;
  window.addExpense = addExpense;
  window.removeExpense = removeExpense;
  window.resetAll = resetAll;
  window.logout = logout;
  window.closeCredModal = closeCredModal;
  window.copyCred = copyCred;
  window.openFriend = openFriend;
  window.closeFriendModal = closeFriendModal;
  window.changePassword = changePassword;
  window.deleteSelectedFriend = deleteSelectedFriend;
  window.togglePaid = togglePaid;
  window.undoPaid = undoPaid;

  /* ---------- Init ---------- */

  loadData();
  ensureCreds();

  const sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId || !creds[sessionId]) {
    location.href = "login.html";
    return;
  }
  currentUserId = sessionId;
  currentUser = creds[sessionId];
  isAdmin = !!currentUser.isAdmin;

  if ($("expDate") && !$("expDate").value) {
    $("expDate").value = new Date().toISOString().slice(0, 10);
  }

  renderAll();
})();
