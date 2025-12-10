// static/js/manage_users.js
// Manage users UI: filtering, search, toggles, details modal, counters
(function () {
  "use strict";

  function g(name, fallback) {
    return typeof window !== "undefined" && window[name] !== undefined ? window[name] : fallback;
  }

  const CSRF_TOKEN = g("CSRF_TOKEN", "");
  const TOGGLE_ADMIN_URL = g("TOGGLE_ADMIN_URL", "/toggle-user-admin/");
  const TOGGLE_BLOCK_URL = g("TOGGLE_BLOCK_URL", "/toggle-user-block/");
  const ADMIN_USER_DETAILS_URL = g("ADMIN_USER_DETAILS_URL", "/admin/api/user-details/");

  function loadUsersData() {
    const el = document.getElementById("users-data");
    if (!el) return [];
    const raw = (el.textContent || "").trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === "object") {
        if (Array.isArray(parsed.results)) return parsed.results;
        if (Array.isArray(parsed.data)) return parsed.data;
        if (Array.isArray(parsed.users)) return parsed.users;
      }
      return [];
    } catch (err) {
      console.error("manage_users.js parse error:", err);
      return [];
    }
  }

  async function postJson(url, bodyObj) {
    try {
      const resp = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": CSRF_TOKEN,
        },
        body: JSON.stringify(bodyObj),
      });
      let data = null;
      try { data = await resp.json(); } catch (_) { /* ignore */ }
      return { ok: resp.ok, status: resp.status, data };
    } catch (err) {
      console.error("manage_users.js network error", err);
      return { ok: false, error: err };
    }
  }

  function showMessage(msg, kind = "info") {
    const box = document.getElementById("user-messages");
    if (!box) return;
    const msgEl = document.createElement("div");
    msgEl.className = `user-msg user-msg-${kind}`;
    msgEl.innerHTML = `<span>${msg}</span>`;
    box.appendChild(msgEl);
    setTimeout(() => {
      msgEl.style.opacity = "0";
      msgEl.style.transform = "translateX(100%)";
      setTimeout(() => msgEl.remove(), 300);
    }, 4000);
  }

  function updateCountersFromCards() {
    const cards = Array.from(document.querySelectorAll(".user-card"));
    const visible = cards.filter(c => c.style.display !== "none");
    const total = visible.length;
    const adminCount = visible.filter(c => !!c.querySelector(".admin-badge")).length;
    const blockedCount = visible.filter(c => !!c.querySelector(".blocked-badge")).length;
    const activeCount = total - blockedCount;

    const elTotal = document.getElementById("total-users-count");
    const elAdmin = document.getElementById("admin-users-count");
    const elBlocked = document.getElementById("blocked-users-count");
    const elActive = document.getElementById("active-users-count");

    if (elTotal) elTotal.textContent = total;
    if (elAdmin) elAdmin.textContent = adminCount;
    if (elBlocked) elBlocked.textContent = blockedCount;
    if (elActive) elActive.textContent = activeCount;
  }

  function elementIsAdmin(card) {
    return !!card.querySelector(".admin-badge");
  }

  function elementIsBlocked(card) {
    return !!card.querySelector(".blocked-badge");
  }

  // Main filter logic: shows/hides .user-card elements based on select + search
  function applyFiltersAndSearch() {
    const roleSelect = document.getElementById("role-filter");
    const statusSelect = document.getElementById("status-filter");
    const searchInput = document.getElementById("search-users");

    const role = roleSelect ? roleSelect.value : "all";
    const status = statusSelect ? statusSelect.value : "all";
    const search = searchInput ? (searchInput.value || "").trim().toLowerCase() : "";

    const cards = Array.from(document.querySelectorAll(".user-card"));

    cards.forEach(card => {
      // derive properties from DOM
      const isAdmin = elementIsAdmin(card);
      const isBlocked = elementIsBlocked(card);
      const name = (card.querySelector(".user-name")?.textContent || "").toLowerCase();
      const email = (card.querySelector(".user-email")?.textContent || "").toLowerCase();

      let roleMatch = true;
      if (role === "admin") roleMatch = !!isAdmin;
      if (role === "user") roleMatch = !isAdmin;

      let statusMatch = true;
      if (status === "active") statusMatch = !isBlocked;
      if (status === "blocked") statusMatch = !!isBlocked;

      let searchMatch = true;
      if (search) {
        searchMatch = name.includes(search) || email.includes(search);
      }

      const show = roleMatch && statusMatch && searchMatch;
      card.style.display = show ? "" : "none";
    });

    // update counters to reflect visible set
    updateCountersFromCards();
  }

  // Simple debounce
  function debounce(fn, ms = 200) {
    let t = null;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  // Toggle admin / block functions (unchanged logic but calling updateCounters when done)
  async function toggleAdmin(userId, card) {
    if (!userId || !card) return;
    const btn = card.querySelector(".admin-toggle-btn");
    if (!btn) return;
    const wasAdmin = elementIsAdmin(card);
    btn.disabled = true;
    const priorHtml = btn.innerHTML;
    btn.innerHTML = "Processing...";

    const res = await postJson(TOGGLE_ADMIN_URL, { user_id: userId, make_admin: !wasAdmin });
    if (!res.ok || !res.data) {
      showMessage("Failed to update admin status", "error");
      btn.disabled = false;
      btn.innerHTML = priorHtml;
      return;
    }
    if (!res.data.success) {
      showMessage(res.data.message || "Failed to update admin status", "error");
      btn.disabled = false;
      btn.innerHTML = priorHtml;
      return;
    }

    // Update DOM badges + button
    const isAdminNow = !!res.data.is_admin;
    const badges = card.querySelector(".user-badges");
    const adminBadge = card.querySelector(".admin-badge");
    if (isAdminNow && !adminBadge) {
      const span = document.createElement("span");
      span.className = "badge admin-badge";
      span.innerHTML = `<i class="fas fa-shield-alt"></i> Admin`;
      badges.prepend(span);
    } else if (!isAdminNow && adminBadge) {
      adminBadge.remove();
    }

    btn.classList.toggle("demote", isAdminNow);
    btn.classList.toggle("promote", !isAdminNow);
    btn.innerHTML = isAdminNow ? "Demote" : "Promote";
    btn.disabled = false;

    showMessage(isAdminNow ? "User promoted to admin" : "User demoted from admin", "info");
    applyFiltersAndSearch(); // update visible counts
  }

  async function toggleBlock(userId, card) {
    if (!userId || !card) return;
    const btn = card.querySelector(".block-toggle-btn");
    if (!btn) return;
    const wasBlocked = elementIsBlocked(card);

    if (!wasBlocked) {
      if (!confirm("Block this user? They will lose access until unblocked.")) return;
    }

    btn.disabled = true;
    const priorHtml = btn.innerHTML;
    btn.innerHTML = "Processing...";

    const res = await postJson(TOGGLE_BLOCK_URL, { user_id: userId });
    if (!res.ok || !res.data) {
      showMessage("Failed to update block status", "error");
      btn.disabled = false;
      btn.innerHTML = priorHtml;
      return;
    }
    if (!res.data.success) {
      showMessage(res.data.message || "Failed to update block status", "error");
      btn.disabled = false;
      btn.innerHTML = priorHtml;
      return;
    }

    const isBlockedNow = !!res.data.is_block;
    const badges = card.querySelector(".user-badges");
    const blockedBadge = card.querySelector(".blocked-badge");
    const activeBadge = card.querySelector(".active-badge");

    if (isBlockedNow) {
      if (activeBadge) activeBadge.remove();
      if (!blockedBadge) {
        const span = document.createElement("span");
        span.className = "badge blocked-badge";
        span.innerHTML = `<i class="fas fa-user-slash"></i> Blocked`;
        badges.prepend(span);
      }
      btn.classList.remove("block");
      btn.classList.add("unblock");
      btn.innerHTML = "Unblock";
    } else {
      if (blockedBadge) blockedBadge.remove();
      if (!activeBadge) {
        const span = document.createElement("span");
        span.className = "badge active-badge";
        span.innerHTML = `<i class="fas fa-check-circle"></i> Active`;
        badges.prepend(span);
      }
      btn.classList.remove("unblock");
      btn.classList.add("block");
      btn.innerHTML = "Block";
    }

    btn.disabled = false;
    showMessage(isBlockedNow ? "User blocked" : "User unblocked", "info");
    applyFiltersAndSearch(); // update visible counts
  }

  // Details modal
  async function openUserDetails(userId, displayName, email, profile_picture) {
    const modal = document.getElementById("user-details-modal");
    if (!modal) return;
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
        udAvatar.appendChild(img);
      } else {
        udAvatar.textContent = (displayName || "U").slice(0,1).toUpperCase();
      }
    }

    if (owned) owned.innerHTML = "<div class='loading-state'>Loading owned items...</div>";
    if (borrowed) borrowed.innerHTML = "<div class='loading-state'>Loading borrowed items...</div>";

    modal.classList.remove("hidden");
    setTimeout(() => {
      modal.style.opacity = "1";
      modal.style.transform = "scale(1)";
    }, 20);

    const resp = await postJson(ADMIN_USER_DETAILS_URL, { user_id: userId });
    if (!resp.ok || !resp.data || !resp.data.success) {
      if (owned) owned.innerHTML = "<div class='empty-state'>Failed to load</div>";
      if (borrowed) borrowed.innerHTML = "<div class='empty-state'>Failed to load</div>";
      return;
    }

    const itemsOwned = resp.data.items_owned || [];
    const itemsBorrowed = resp.data.items_borrowed || [];
    const counts = resp.data.counts || {};

    if (owned) {
      if (itemsOwned.length === 0) owned.innerHTML = "<div class='empty-state'>No items owned.</div>";
      else {
        owned.innerHTML = "";
        itemsOwned.forEach(it => {
          const d = document.createElement("div");
          d.className = "mini-item";
          d.textContent = it.title || it.item_title || "Untitled";
          owned.appendChild(d);
        });
      }
    }

    if (borrowed) {
      if (itemsBorrowed.length === 0) borrowed.innerHTML = "<div class='empty-state'>No borrowed items.</div>";
      else {
        borrowed.innerHTML = "";
        itemsBorrowed.forEach(it => {
          const d = document.createElement("div");
          d.className = "mini-item";
          d.textContent = (it.item_title || it.title || "Untitled") + " — " + (it.status || "");
          borrowed.appendChild(d);
        });
      }
    }

    if (ownedCountEl) ownedCountEl.textContent = `Owned: ${counts.total_owned ?? itemsOwned.length}`;
    if (borrowedCountEl) borrowedCountEl.textContent = `Borrowed: ${counts.total_borrowed ?? itemsBorrowed.length}`;
  }

  function closeUserDetailsModal() {
    const modal = document.getElementById("user-details-modal");
    if (!modal) return;
    modal.style.opacity = "0";
    modal.style.transform = "scale(0.95)";
    setTimeout(() => {
      modal.classList.add("hidden");
      modal.style.opacity = "";
      modal.style.transform = "";
    }, 200);
  }

  // Create minimal styles used in the script for loading
  (function injectSmallStyles(){
    if (document.getElementById('manage-users-inline-styles')) return;
    const s = document.createElement('style');
    s.id = 'manage-users-inline-styles';
    s.textContent = `
      .loading-state { padding: 12px; color: #666; text-align:center; }
      .mini-item { padding:6px 8px; border-bottom:1px solid #f1f1f1; font-size:13px; color:#333; }
      .user-msg { margin:6px 0; padding:8px 12px; border-radius:6px; background:#f3f3f3; display:flex; gap:8px; align-items:center; }
      .user-msg-info { background:#eef6ff; color:#0b63d6; }
      .user-msg-error { background:#ffecec; color:#cc0000; }
    `;
    document.head.appendChild(s);
  })();

  // DOM ready wiring
  document.addEventListener("DOMContentLoaded", function () {
    const allUsers = loadUsersData();
    // initialize counters from DOM cards (not just JSON) so page initial state is correct
    updateCountersFromCards();

    // wire admin toggle
    document.querySelectorAll(".admin-toggle-btn").forEach(btn => {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        const id = this.dataset.userId || this.getAttribute('data-user-id');
        if (!id) return;
        const card = this.closest('.user-card');
        toggleAdmin(id, card);
      });
    });

    // wire block toggle
    document.querySelectorAll(".block-toggle-btn").forEach(btn => {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        const id = this.dataset.userId || this.getAttribute('data-user-id');
        if (!id) return;
        const card = this.closest('.user-card');
        toggleBlock(id, card);
      });
    });

    // wire details btns
    document.querySelectorAll(".details-btn").forEach(btn => {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        const id = this.dataset.userId || this.getAttribute('data-user-id');
        if (!id) return;
        const card = this.closest('.user-card');
        const displayName = card?.querySelector('.user-name')?.textContent?.trim() || "";
        const email = card?.querySelector('.user-email')?.textContent?.trim() || "";
        const profile = allUsers.find(u => String(u.id) === String(id))?.profile_picture || "";
        openUserDetails(id, displayName, email, profile);
      });
    });

    // modal close handlers
    document.getElementById("close-user-details")?.addEventListener("click", closeUserDetailsModal);
    document.getElementById("close-user-details-2")?.addEventListener("click", closeUserDetailsModal);
    document.querySelectorAll(".modal-backdrop").forEach(b => b.addEventListener("click", closeUserDetailsModal));

    // role/status filters + search
    const roleSelect = document.getElementById('role-filter');
    const statusSelect = document.getElementById('status-filter');
    const searchInput = document.getElementById('search-users');

    const debouncedApply = debounce(applyFiltersAndSearch, 180);

    if (roleSelect) roleSelect.addEventListener('change', applyFiltersAndSearch);
    if (statusSelect) statusSelect.addEventListener('change', applyFiltersAndSearch);
    if (searchInput) searchInput.addEventListener('input', debouncedApply);

    // initial apply (in case template rendered with values)
    applyFiltersAndSearch();

    // escape key to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeUserDetailsModal();
    });
  });

})();
