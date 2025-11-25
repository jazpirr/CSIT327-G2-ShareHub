// static/js/manage_users.js
// Drop this entire file into static/js/manage_users.js

(function () {
  "use strict";

  // Utility: safe get global, with fallback
  function g(name, fallback) {
    return typeof window !== "undefined" && window[name] !== undefined ? window[name] : fallback;
  }

  // Globals expected from template:
  const CSRF_TOKEN = g("CSRF_TOKEN", "");
  const TOGGLE_ADMIN_URL = g("TOGGLE_ADMIN_URL", "/toggle-user-admin/");
  const TOGGLE_BLOCK_URL = g("TOGGLE_BLOCK_URL", "/toggle-user-block/");
  const ADMIN_USER_DETAILS_URL = g("ADMIN_USER_DETAILS_URL", "/admin/api/user-details/");

  // Safe parse of users-data (json_script in template)
  function loadUsersData() {
    const el = document.getElementById("users-data");
    if (!el) {
      console.warn("manage_users.js: #users-data element not found");
      return [];
    }
    const raw = (el.textContent || "").trim();
    if (!raw) {
      console.warn("manage_users.js: users-data is empty");
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      // if parsed is array -> ok
      if (Array.isArray(parsed)) return parsed;
      // common shapes
      if (parsed && typeof parsed === "object") {
        if (Array.isArray(parsed.results)) return parsed.results;
        if (Array.isArray(parsed.data)) return parsed.data;
        if (Array.isArray(parsed.users)) return parsed.users;
        // numeric keys -> coerce
        const numericKeys = Object.keys(parsed).filter(k => /^\d+$/.test(k));
        if (numericKeys.length) {
          return numericKeys.sort((a,b)=>a-b).map(k => parsed[k]);
        }
      }
      console.warn("manage_users.js: parsed users-data not an array; returning []", parsed);
      return [];
    } catch (err) {
      console.error("manage_users.js: error parsing users-data JSON:", err);
      return [];
    }
  }

  // POST helper with CSRF
  async function postJson(url, bodyObj) {
    try {
      const resp = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": CSRF_TOKEN
        },
        body: JSON.stringify(bodyObj)
      });
      let data = null;
      try { data = await resp.json(); } catch (e) { /* ignore JSON parse error */ }
      return { ok: resp.ok, status: resp.status, data };
    } catch (err) {
      console.error("manage_users.js: network error", err);
      return { ok: false, error: err };
    }
  }

  // Flash message UI
  function showMessage(msg, kind = "info") {
    const box = document.getElementById("user-messages");
    if (!box) return;
    const msgEl = document.createElement("div");
    msgEl.className = `user-msg user-msg-${kind}`;
    msgEl.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        ${kind === "error"
          ? '<path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
          : '<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
        }
      </svg>
      <span>${msg}</span>
    `;
    box.appendChild(msgEl);
    setTimeout(() => {
      msgEl.style.opacity = "0";
      msgEl.style.transform = "translateY(-8px)";
      setTimeout(() => msgEl.remove(), 300);
    }, 3500);
  }

  // Update counters in DOM
  function updateCounters(allUsers) {
    const total = allUsers.length;
    const adminCount = allUsers.filter(u => !!u.is_admin).length;
    const blockedCount = allUsers.filter(u => !!u.is_block).length;
    const elTotal = document.getElementById("total-users-count");
    const elAdmin = document.getElementById("admin-users-count");
    const elBlocked = document.getElementById("blocked-users-count");
    if (elTotal) elTotal.textContent = total;
    if (elAdmin) elAdmin.textContent = adminCount;
    if (elBlocked) elBlocked.textContent = blockedCount;
  }

  // Toggle Admin
  async function toggleAdmin(userId, row, allUsers) {
    if (!userId) return;
    const currentlyAdmin = row.querySelector(".is-admin")?.textContent?.includes("Admin");
    const resp = await postJson(TOGGLE_ADMIN_URL, { user_id: userId, make_admin: !currentlyAdmin });
    if (!resp.ok || !resp.data) {
      showMessage("Network or server error while updating admin status", "error");
      return;
    }
    if (!resp.data.success) {
      showMessage("Failed to change admin status: " + (resp.data.error || resp.data.message || "unknown"), "error");
      return;
    }

    const isAdmin = !!resp.data.is_admin;
    // update DOM status cell
    const statusCell = row.querySelector(".is-admin");
    if (statusCell) {
      statusCell.className = `is-admin status-indicator ${isAdmin ? "status-active" : "status-inactive"}`;
      statusCell.innerHTML = isAdmin
        ? '<svg width="14" height="14" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2.5"/></svg> Admin'
        : '<svg width="14" height="14" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/></svg> User';
    }

    // update button text / class
    const btn = row.querySelector(".toggle-admin-btn");
    if (btn) {
      btn.innerHTML = isAdmin
        ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 2l7 3v5c0 5-3.58 9.74-7 11-3.42-1.26-7-6-7-11V5l7-3z" stroke="currentColor" stroke-width="2"/></svg> Demote'
        : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 2l7 3v5c0 5-3.58 9.74-7 11-3.42-1.26-7-6-7-11V5l7-3z" stroke="currentColor" stroke-width="2"/></svg> Promote';
    }

    // update local allUsers array
    const userObj = allUsers.find(u => String(u.id) === String(userId));
    if (userObj) userObj.is_admin = isAdmin;

    updateCounters(allUsers);
    showMessage(isAdmin ? "User promoted to admin" : "User demoted from admin", "info");
  }

  // Toggle Block
  async function toggleBlock(userId, row, allUsers) {
    if (!userId) return;
    const currentlyBlocked = row.querySelector(".is-block")?.textContent?.includes("Blocked");
    if (!currentlyBlocked) {
      if (!confirm("Are you sure you want to block this user? Blocking prevents login.")) return;
    }

    const resp = await postJson(TOGGLE_BLOCK_URL, { user_id: userId });
    if (!resp.ok || !resp.data) {
      showMessage("Network or server error while updating block status", "error");
      return;
    }
    if (!resp.data.success) {
      showMessage("Failed to change block status: " + (resp.data.error || resp.data.message || "unknown"), "error");
      return;
    }

    const newBlocked = !!resp.data.is_block;
    const statusCell = row.querySelector(".is-block");
    if (statusCell) {
      statusCell.className = `is-block status-indicator ${newBlocked ? "status-blocked" : "status-active-account"}`;
      statusCell.innerHTML = newBlocked
        ? '<svg width="14" height="14" viewBox="0 0 24 24"><path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" stroke="currentColor" stroke-width="2"/></svg> Blocked'
        : '<svg width="14" height="14" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2.5"/></svg> Active';
    }

    const btn = row.querySelector(".toggle-block-btn");
    if (btn) {
      btn.innerHTML = newBlocked
        ? '<svg width="15" height="15" viewBox="0 0 24 24"><path d="M8 7h12l-4-4m4 4l-4 4M4 17h12l-4 4m4-4l-4-4" stroke="currentColor" stroke-width="2"/></svg> Unblock'
        : '<svg width="15" height="15" viewBox="0 0 24 24"><path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" stroke="currentColor" stroke-width="2"/></svg> Block';
    }

    const userObj = allUsers.find(u => String(u.id) === String(userId));
    if (userObj) userObj.is_block = newBlocked;

    updateCounters(allUsers);
    showMessage(newBlocked ? "User blocked" : "User unblocked", "info");
  }

  // Render helpers for modal content
  function createItemCard(item) {
    const card = document.createElement("div");
    card.className = "item-card";

    const thumb = document.createElement("img");
    thumb.className = "item-thumb";
    thumb.src = item.thumbnail_url || item._item?.thumbnail_url || "";
    thumb.alt = item.title || (item._item && item._item.title) || "Item";
    card.appendChild(thumb);

    const info = document.createElement("div");
    info.style.flex = "1";
    info.innerHTML = `<strong>${(item.title || (item._item && item._item.title) || "(no title)")}</strong>
                      <div style="font-size:13px;color:var(--color-slate-500);margin-top:6px;">
                        ${item.description ? (item.description.length > 120 ? item.description.slice(0,120) + "…" : item.description) : ""}
                      </div>`;
    card.appendChild(info);
    return card;
  }

  async function openUserDetails(userId, displayName, email, profile_picture) {
    const modal = document.getElementById("user-details-modal");
    if (!modal) {
      console.warn("manage_users.js: user-details-modal not found");
      return;
    }
    const udName = document.getElementById("ud-name");
    const udEmail = document.getElementById("ud-email");
    const udAvatar = document.getElementById("ud-avatar");
    const owned = document.getElementById("ud-items-owned");
    const borrowed = document.getElementById("ud-items-borrowed");
    const ownedCountEl = document.getElementById("ud-total-owned");
    const borrowedCountEl = document.getElementById("ud-total-borrowed");

    if (udName) udName.textContent = displayName || "";
    if (udEmail) udEmail.textContent = email || "";
    if (udAvatar) {
      udAvatar.innerHTML = "";
      if (profile_picture) {
        const img = document.createElement("img");
        img.src = profile_picture;
        img.alt = displayName || "Avatar";
        img.style.width = "48px";
        img.style.height = "48px";
        img.style.borderRadius = "50%";
        img.style.objectFit = "cover";
        udAvatar.appendChild(img);
      } else {
        // fallback initial
        const span = document.createElement("span");
        span.textContent = (displayName || "").slice(0,1).toUpperCase();
        span.style.display = "inline-flex";
        span.style.width = "48px";
        span.style.height = "48px";
        span.style.alignItems = "center";
        span.style.justifyContent = "center";
        span.style.borderRadius = "50%";
        span.style.background = "var(--color-primary)";
        span.style.color = "white";
        udAvatar.appendChild(span);
      }
    }

    owned.innerHTML = "Loading…";
    borrowed.innerHTML = "Loading…";
    modal.classList.remove("hidden");

    // Fetch details from server
    const resp = await postJson(ADMIN_USER_DETAILS_URL, { user_id: userId });
    if (!resp.ok || !resp.data) {
      owned.innerHTML = "<div class='empty-state'>Failed to load details</div>";
      borrowed.innerHTML = "";
      return;
    }
    if (!resp.data.success) {
      owned.innerHTML = "<div class='empty-state'>No details</div>";
      borrowed.innerHTML = "";
      return;
    }

    const itemsOwned = resp.data.items_owned || [];
    const itemsBorrowed = resp.data.items_borrowed || [];
    const counts = resp.data.counts || {};

    owned.innerHTML = "";
    if (itemsOwned.length === 0) {
      owned.innerHTML = "<div class='empty-state'>No items owned.</div>";
    } else {
      itemsOwned.forEach(it => owned.appendChild(createItemCard(it)));
    }

    borrowed.innerHTML = "";
    if (itemsBorrowed.length === 0) {
      borrowed.innerHTML = "<div class='empty-state'>No borrowed items / requests.</div>";
    } else {
      itemsBorrowed.forEach(r => {
        // r may have _item attached by server
        const card = document.createElement("div");
        card.className = "item-card";
        const thumb = document.createElement("img");
        thumb.className = "item-thumb";
        thumb.src = (r._item && r._item.thumbnail_url) || r.thumbnail_url || "";
        card.appendChild(thumb);
        const info = document.createElement("div");
        info.innerHTML = `<strong>${(r._item && r._item.title) || r.item_title || "(item)"}</strong>
                          <div style="font-size:13px;color:var(--color-slate-500);margin-top:6px;">
                            Status: ${r.status || "N/A"} ${r.borrowed_at ? " • borrowed: " + r.borrowed_at : ""}
                          </div>`;
        card.appendChild(info);
        borrowed.appendChild(card);
      });
    }

    if (ownedCountEl) ownedCountEl.textContent = `Owned: ${counts.total_owned ?? itemsOwned.length}`;
    if (borrowedCountEl) borrowedCountEl.textContent = `Borrowed: ${counts.total_borrowed ?? itemsBorrowed.length}`;
  }

  function closeUserDetailsModal() {
    const modal = document.getElementById("user-details-modal");
    if (modal) modal.classList.add("hidden");
  }

  // Wire up everything on DOM ready
  document.addEventListener("DOMContentLoaded", function () {
    console.log("manage_users.js: DOMContentLoaded");
    const allUsers = loadUsersData();
    console.log("manage_users.js: loaded users count:", allUsers.length);

    // initialize counters
    updateCounters(allUsers);

    // Bind admin toggle buttons
    document.querySelectorAll(".toggle-admin-btn").forEach(btn => {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        const userId = this.dataset.userId || this.getAttribute("data-user-id");
        if (!userId) return;
        const row = document.querySelector(`tr[data-user-id="${userId}"]`);
        this.disabled = true;
        toggleAdmin(userId, row, allUsers).finally(() => this.disabled = false);
      });
    });

    // Bind block toggle buttons
    document.querySelectorAll(".toggle-block-btn").forEach(btn => {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        const userId = this.dataset.userId || this.getAttribute("data-user-id");
        if (!userId) return;
        const row = document.querySelector(`tr[data-user-id="${userId}"]`);
        this.disabled = true;
        toggleBlock(userId, row, allUsers).finally(() => this.disabled = false);
      });
    });

    // Bind Details buttons
    document.querySelectorAll(".details-btn").forEach(btn => {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        const userId = this.dataset.userId || this.getAttribute("data-user-id");
        if (!userId) return;
        const row = document.querySelector(`tr[data-user-id="${userId}"]`);
        const displayName = row?.querySelector(".user-display-name")?.textContent?.trim() || "";
        const email = row?.querySelector(".user-email")?.textContent?.trim() || "";
        const profile = allUsers.find(u => String(u.id) === String(userId))?.profile_picture || "";
        openUserDetails(userId, displayName, email, profile);
      });
    });

    // Modal close handlers
    document.getElementById("close-user-details")?.addEventListener("click", closeUserDetailsModal);
    document.getElementById("close-user-details-2")?.addEventListener("click", closeUserDetailsModal);
    document.querySelectorAll(".modal-backdrop").forEach(back => back.addEventListener("click", closeUserDetailsModal));
  });

})();
