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
  const ADMIN_USER_DETAILS_URL = g("ADMIN_USER_DETAILS_URL", "/api/user-details/");

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
      try { data = await resp.json(); } catch (_) { /* ignore non-json */ }
      return { ok: resp.ok, status: resp.status, data, rawText: await resp.text().catch(()=>"") };
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
    msgEl.innerHTML = `<span>${escapeHtml(String(msg))}</span>`;
    box.appendChild(msgEl);
    setTimeout(() => {
      msgEl.style.opacity = "0";
      msgEl.style.transform = "translateX(100%)";
      setTimeout(() => msgEl.remove(), 300);
    }, 4000);
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (m) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m];
    });
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

  // Main filter logic
  function applyFiltersAndSearch() {
    const roleSelect = document.getElementById("role-filter");
    const statusSelect = document.getElementById("status-filter");
    const searchInput = document.getElementById("search-users");

    const role = roleSelect ? roleSelect.value : "all";
    const status = statusSelect ? statusSelect.value : "all";
    const search = searchInput ? (searchInput.value || "").trim().toLowerCase() : "";

    const cards = Array.from(document.querySelectorAll(".user-card"));

    cards.forEach(card => {
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
      if (search) searchMatch = name.includes(search) || email.includes(search);

      const show = roleMatch && statusMatch && searchMatch;
      card.style.display = show ? "" : "none";
    });

    updateCountersFromCards();
  }

  // debounce
  function debounce(fn, ms = 200) {
    let t = null;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  // Toggle admin
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
    applyFiltersAndSearch();
  }

  // Toggle block
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
    applyFiltersAndSearch();
  }

  // Helper: extract title from many shapes
  function extractTitleFromItem(it) {
    if (!it) return "";
    const tries = [
      it.title,
      it.item_title,
      it._title,
      it.name,
      it.item_name,
      it.display_name,
      (it._item && it._item.title),
      (it._item && it._item.item_title),
      (it._item && it._item._title),
      (it.raw && (it.raw.title || it.raw.item_title || it.raw.name)),
      (it.raw && it.raw.item_name),
    ];
    for (const t of tries) {
      if (typeof t === "string" && t.trim()) return t.trim();
    }
    return "";
  }

  // Helper: extract thumbnail from many shapes
  function extractThumbnailFromItem(it) {
    if (!it) return "";
    const tries = [
      it.thumbnail_url,
      it._thumbnail,
      it.image_url,
      it.image,
      it.image_path,
      (it._item && it._item.thumbnail_url),
      (it._item && it._item.raw && (it._item.raw.thumbnail_url || it._item.raw.image_url)),
      (it.raw && (it.raw.thumbnail_url || it.raw.image_url || it.raw.image)),
    ];
    for (const t of tries) {
      if (typeof t === "string" && t.trim()) return t.trim();
    }
    return "";
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
        img.className = "ud-avatar-img";
        udAvatar.appendChild(img);
      } else {
        udAvatar.textContent = (displayName || "U").slice(0,1).toUpperCase();
      }
    }

    if (owned) owned.innerHTML = "<div class='loading-state'>Loading owned items...</div>";
    if (borrowed) borrowed.innerHTML = "<div class='loading-state'>Loading borrowed items...</div>";

    modal.style.display = "block";
    modal.classList.remove("hidden");
    // allow CSS transition to run
    setTimeout(() => {
      modal.style.opacity = "1";
      modal.style.transform = "scale(1)";
    }, 20);

    if (!ADMIN_USER_DETAILS_URL) {
      const err = "User details endpoint not configured.";
      if (owned) owned.innerHTML = `<div class='empty-state'>${escapeHtml(err)}</div>`;
      if (borrowed) borrowed.innerHTML = `<div class='empty-state'>${escapeHtml(err)}</div>`;
      return;
    }

    const resp = await postJson(ADMIN_USER_DETAILS_URL, { user_id: userId });
    if (!resp.ok || !resp.data) {
      const message = (resp && resp.rawText) || "Failed to fetch user details";
      if (owned) owned.innerHTML = `<div class='empty-state'>${escapeHtml(message)}</div>`;
      if (borrowed) borrowed.innerHTML = `<div class='empty-state'>${escapeHtml(message)}</div>`;
      console.error("manage_users: user details request failed", resp);
      return;
    }

    const payload = resp.data;
    if (!payload || payload.success !== true) {
      const message = payload?.message || payload?.error || "Unexpected response from server";
      if (owned) owned.innerHTML = `<div class='empty-state'>${escapeHtml(message)}</div>`;
      if (borrowed) borrowed.innerHTML = `<div class='empty-state'>${escapeHtml(message)}</div>`;
      console.warn("manage_users: unexpected payload", payload);
      return;
    }

    const itemsOwned = payload.items_owned || [];
    const itemsBorrowed = payload.items_borrowed || [];
    const counts = payload.counts || {};

    // Render owned
    if (owned) {
      if (!itemsOwned.length) {
        owned.innerHTML = "<div class='empty-state'>No items owned.</div>";
      } else {
        owned.innerHTML = "";
        itemsOwned.forEach(it => {
          const title = extractTitleFromItem(it) || `Item ${it.item_id || it.id || ""}`.trim();
          const thumb = extractThumbnailFromItem(it);
          const wrapper = document.createElement(it.item_id ? "a" : "div");
          wrapper.className = "mini-item-card";
          if (it.item_id) {
            wrapper.href = `/items/${encodeURIComponent(it.item_id)}/`;
            wrapper.target = "_blank";
            wrapper.rel = "noopener noreferrer";
          }
          const thumbDiv = document.createElement("div");
          thumbDiv.className = "mini-item-thumb";
          if (thumb) {
            const img = document.createElement("img");
            img.src = thumb;
            img.alt = title;
            img.loading = "lazy";
            thumbDiv.appendChild(img);
          } else {
            thumbDiv.textContent = (title || "I").slice(0,1).toUpperCase();
          }
          const meta = document.createElement("div");
          meta.className = "mini-item-meta";
          const t = document.createElement("div");
          t.className = "mini-item-title";
          t.textContent = title;
          meta.appendChild(t);
          wrapper.appendChild(thumbDiv);
          wrapper.appendChild(meta);
          owned.appendChild(wrapper);
        });
      }
    }

    // Render borrowed/requests
    if (borrowed) {
      if (!itemsBorrowed.length) {
        borrowed.innerHTML = "<div class='empty-state'>No borrowed items.</div>";
      } else {
        borrowed.innerHTML = "";
        itemsBorrowed.forEach(req => {
          // req may already include enriched _item
          const itemCandidate = req._item || req.item || req;
          const title = extractTitleFromItem(req) || extractTitleFromItem(itemCandidate) || `Request ${req.id || req.request_id || ""}`.trim();
          const thumb = extractThumbnailFromItem(req) || extractThumbnailFromItem(itemCandidate);
          const status = req.status || req.request_status || (req._item && req._item.raw && req._item.raw.status) || "";
          const itemId = (req._item && req._item.item_id) || req.item_id || req.itemId || req.item_id || null;

          const wrapper = document.createElement(itemId ? "a" : "div");
          wrapper.className = "mini-item-card";
          if (itemId) {
            wrapper.href = `/items/${encodeURIComponent(itemId)}/`;
            wrapper.target = "_blank";
            wrapper.rel = "noopener noreferrer";
          }
          const thumbDiv = document.createElement("div");
          thumbDiv.className = "mini-item-thumb";
          if (thumb) {
            const img = document.createElement("img");
            img.src = thumb;
            img.alt = title;
            img.loading = "lazy";
            thumbDiv.appendChild(img);
          } else {
            thumbDiv.textContent = (title || "I").slice(0,1).toUpperCase();
          }
          const meta = document.createElement("div");
          meta.className = "mini-item-meta";
          const t = document.createElement("div");
          t.className = "mini-item-title";
          t.textContent = title;
          meta.appendChild(t);
          if (status) {
            const s = document.createElement("div");
            s.className = "mini-item-status";
            s.textContent = status;
            meta.appendChild(s);
          }
          wrapper.appendChild(thumbDiv);
          wrapper.appendChild(meta);
          borrowed.appendChild(wrapper);
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
    modal.style.pointerEvents = "none";
    modal.setAttribute("aria-hidden", "true");
    setTimeout(() => {
      modal.classList.add("hidden");
      modal.style.opacity = "";
      modal.style.transform = "";
      modal.style.pointerEvents = "";
    }, 200);
  }

  // Inject small styles and ensure hidden modal doesn't block
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

      #user-details-modal.hidden { display: none !important; pointer-events: none !important; opacity: 0 !important; transform: scale(0.95) !important; }
      #user-details-modal { display: block; position: fixed; inset: 0; z-index: 1000; transition: opacity 180ms ease, transform 180ms ease; pointer-events: auto; }
      #user-details-modal .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 1001; pointer-events: auto; }
      #user-details-modal .modal-panel { position: relative; z-index: 1002; max-width: 980px; margin: 48px auto; border-radius: 10px; background: #fff; overflow: hidden; }

      .mini-item-card { display: flex; gap: 10px; align-items: center; padding: 8px; border-bottom: 1px solid #f1f1f1; text-decoration: none; color: inherit; }
      .mini-item-card:hover { background: #fafafa; }
      .mini-item-thumb { width: 56px; height: 56px; flex: 0 0 56px; display:flex; align-items:center; justify-content:center; background:#f7f7f7; border-radius:6px; overflow:hidden; }
      .mini-item-thumb img { width:100%; height:100%; object-fit: cover; display:block; }
      .mini-item-meta { display:flex; flex-direction:column; gap:4px; }
      .mini-item-title { font-size: 14px; font-weight: 600; }
      .mini-item-status { font-size: 12px; color: #666; }
      .ud-avatar-img { width:56px; height:56px; border-radius:50%; object-fit:cover; }
      .empty-state { padding:16px; color:#777; }
    `;
    document.head.appendChild(s);
  })();

  // DOM ready wiring (defensive)
  document.addEventListener("DOMContentLoaded", function () {
    // defensive: ensure modal hidden does not block the page on load
    const modal = document.getElementById("user-details-modal");
    if (modal && modal.classList.contains("hidden")) {
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
      modal.style.pointerEvents = "none";
    }

    const allUsers = loadUsersData();
    updateCountersFromCards();

    // admin toggles
    document.querySelectorAll(".admin-toggle-btn").forEach(btn => {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        const id = this.dataset.userId || this.getAttribute('data-user-id');
        if (!id) return;
        const card = this.closest('.user-card');
        toggleAdmin(id, card);
      });
    });

    // block toggles
    document.querySelectorAll(".block-toggle-btn").forEach(btn => {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        const id = this.dataset.userId || this.getAttribute('data-user-id');
        if (!id) return;
        const card = this.closest('.user-card');
        toggleBlock(id, card);
      });
    });

    // details buttons
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

    // modal close handlers (safe)
    const closeTop = document.getElementById("close-user-details");
    if (closeTop) closeTop.addEventListener("click", closeUserDetailsModal);
    const closeFoot = document.getElementById("close-user-details-2");
    if (closeFoot) closeFoot.addEventListener("click", closeUserDetailsModal);
    document.querySelectorAll("#user-details-modal .modal-backdrop").forEach(b => {
      if (b) b.addEventListener("click", closeUserDetailsModal);
    });

    // filters + search
    const roleSelect = document.getElementById('role-filter');
    const statusSelect = document.getElementById('status-filter');
    const searchInput = document.getElementById('search-users');

    const debouncedApply = debounce(applyFiltersAndSearch, 180);

    if (roleSelect) roleSelect.addEventListener('change', applyFiltersAndSearch);
    if (statusSelect) statusSelect.addEventListener('change', applyFiltersAndSearch);
    if (searchInput) searchInput.addEventListener('input', debouncedApply);

    // initial apply
    try { applyFiltersAndSearch(); } catch (err) { console.warn("applyFiltersAndSearch error:", err); updateCountersFromCards(); }

    // escape to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeUserDetailsModal();
    });
  });

})();
