// static/js/manage_users.js
// Enhanced version with modern UI interactions

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

  // Enhanced Flash message UI
  function showMessage(msg, kind = "info") {
    const box = document.getElementById("user-messages");
    if (!box) return;
    
    const msgEl = document.createElement("div");
    msgEl.className = `user-msg user-msg-${kind}`;
    msgEl.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        ${kind === "error"
          ? '<path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
          : '<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
        }
      </svg>
      <span>${msg}</span>
    `;
    box.appendChild(msgEl);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      msgEl.style.opacity = "0";
      msgEl.style.transform = "translateX(100%)";
      setTimeout(() => msgEl.remove(), 300);
    }, 5000);
  }

  // Update counters in DOM
  function updateCounters(allUsers) {
    const total = allUsers.length;
    const adminCount = allUsers.filter(u => !!u.is_admin).length;
    const blockedCount = allUsers.filter(u => !!u.is_block).length;
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

  // Enhanced Toggle Admin with loading states
  async function toggleAdmin(userId, card, allUsers) {
    if (!userId) return;
    
    const currentlyAdmin = card.querySelector('.admin-badge') !== null;
    const button = card.querySelector('.admin-toggle-btn');
    
    // Show loading state
    button.disabled = true;
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" class="loading-spinner">
        <path d="M12 2v4m0 12v4m8-10h4M2 12h4m13.364-5.636l2.828 2.828M5.636 18.364l2.828 2.828M18.364 18.364l2.828-2.828M5.636 5.636l2.828-2.828" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      Processing...
    `;
    
    const resp = await postJson(TOGGLE_ADMIN_URL, { user_id: userId, make_admin: !currentlyAdmin });
    
    if (!resp.ok || !resp.data) {
      showMessage("Network or server error while updating admin status", "error");
      resetButtonState(button, currentlyAdmin ? "Demote" : "Promote", currentlyAdmin);
      return;
    }
    
    if (!resp.data.success) {
      showMessage("Failed to change admin status: " + (resp.data.error || resp.data.message || "unknown"), "error");
      resetButtonState(button, currentlyAdmin ? "Demote" : "Promote", currentlyAdmin);
      return;
    }

    const isAdmin = !!resp.data.is_admin;
    
    // Update badges
    const badgesContainer = card.querySelector('.user-badges');
    const adminBadge = card.querySelector('.admin-badge');
    
    if (isAdmin && !adminBadge) {
      const newAdminBadge = document.createElement('span');
      newAdminBadge.className = 'badge admin-badge';
      newAdminBadge.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M12 2l7 3v5c0 5-3.58 9.74-7 11-3.42-1.26-7-6-7-11V5l7-3z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        </svg>
        Admin
      `;
      badgesContainer.appendChild(newAdminBadge);
    } else if (!isAdmin && adminBadge) {
      adminBadge.remove();
    }
    
    // Update button
    button.className = `action-btn admin-toggle-btn ${isAdmin ? 'demote' : 'promote'}`;
    button.innerHTML = isAdmin ? 
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2l7 3v5c0 5-3.58 9.74-7 11-3.42-1.26-7-6-7-11V5l7-3z" stroke="currentColor" stroke-width="2"/></svg> Demote' :
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2l7 3v5c0 5-3.58 9.74-7 11-3.42-1.26-7-6-7-11V5l7-3z" stroke="currentColor" stroke-width="2"/></svg> Promote';
    button.disabled = false;

    // Update local allUsers array
    const userObj = allUsers.find(u => String(u.id) === String(userId));
    if (userObj) userObj.is_admin = isAdmin;

    updateCounters(allUsers);
    showMessage(isAdmin ? "User promoted to administrator" : "User demoted from administrator", "info");
    
    // Add success animation
    card.style.animation = 'pulseSuccess 0.6s ease';
    setTimeout(() => card.style.animation = '', 600);
  }

  // Enhanced Toggle Block with confirmation and loading states
  async function toggleBlock(userId, card, allUsers) {
    if (!userId) return;
    
    const currentlyBlocked = card.querySelector('.blocked-badge') !== null;
    const button = card.querySelector('.block-toggle-btn');
    
    if (!currentlyBlocked) {
      if (!confirm("Are you sure you want to block this user? Blocking prevents login and access to the system.")) return;
    }

    // Show loading state
    button.disabled = true;
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" class="loading-spinner">
        <path d="M12 2v4m0 12v4m8-10h4M2 12h4m13.364-5.636l2.828 2.828M5.636 18.364l2.828 2.828M18.364 18.364l2.828-2.828M5.636 5.636l2.828-2.828" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      Processing...
    `;
    
    const resp = await postJson(TOGGLE_BLOCK_URL, { user_id: userId });
    
    if (!resp.ok || !resp.data) {
      showMessage("Network or server error while updating block status", "error");
      resetBlockButtonState(button, currentlyBlocked);
      return;
    }
    
    if (!resp.data.success) {
      showMessage("Failed to change block status: " + (resp.data.error || resp.data.message || "unknown"), "error");
      resetBlockButtonState(button, currentlyBlocked);
      return;
    }

    const newBlocked = !!resp.data.is_block;
    
    // Update badges
    const badgesContainer = card.querySelector('.user-badges');
    const blockedBadge = card.querySelector('.blocked-badge');
    const activeBadge = card.querySelector('.active-badge');
    
    if (newBlocked) {
      if (activeBadge) activeBadge.remove();
      if (!blockedBadge) {
        const newBlockedBadge = document.createElement('span');
        newBlockedBadge.className = 'badge blocked-badge';
        newBlockedBadge.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          Blocked
        `;
        badgesContainer.appendChild(newBlockedBadge);
      }
    } else {
      if (blockedBadge) blockedBadge.remove();
      if (!activeBadge) {
        const newActiveBadge = document.createElement('span');
        newActiveBadge.className = 'badge active-badge';
        newActiveBadge.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Active
        `;
        badgesContainer.appendChild(newActiveBadge);
      }
    }
    
    // Update button
    button.className = `action-btn block-toggle-btn ${newBlocked ? 'unblock' : 'block'}`;
    button.innerHTML = newBlocked ? 
      '<svg width="16" height="16" viewBox="0 0 24 24"><path d="M8 7h12l-4-4m4 4l-4 4M4 17h12l-4 4m4-4l-4-4" stroke="currentColor" stroke-width="2"/></svg> Unblock' :
      '<svg width="16" height="16" viewBox="0 0 24 24"><path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" stroke="currentColor" stroke-width="2"/></svg> Block';
    button.disabled = false;

    // Update local allUsers array
    const userObj = allUsers.find(u => String(u.id) === String(userId));
    if (userObj) userObj.is_block = newBlocked;

    updateCounters(allUsers);
    showMessage(newBlocked ? "User has been blocked" : "User has been unblocked", "info");
    
    // Add appropriate animation
    card.style.animation = newBlocked ? 'pulseWarning 0.6s ease' : 'pulseSuccess 0.6s ease';
    setTimeout(() => card.style.animation = '', 600);
  }

  // Helper to reset button state
  function resetButtonState(button, text, isAdmin) {
    button.disabled = false;
    button.innerHTML = isAdmin ? 
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2l7 3v5c0 5-3.58 9.74-7 11-3.42-1.26-7-6-7-11V5l7-3z" stroke="currentColor" stroke-width="2"/></svg> Demote' :
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2l7 3v5c0 5-3.58 9.74-7 11-3.42-1.26-7-6-7-11V5l7-3z" stroke="currentColor" stroke-width="2"/></svg> Promote';
  }

  function resetBlockButtonState(button, isBlocked) {
    button.disabled = false;
    button.innerHTML = isBlocked ? 
      '<svg width="16" height="16" viewBox="0 0 24 24"><path d="M8 7h12l-4-4m4 4l-4 4M4 17h12l-4 4m4-4l-4-4" stroke="currentColor" stroke-width="2"/></svg> Unblock' :
      '<svg width="16" height="16" viewBox="0 0 24 24"><path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" stroke="currentColor" stroke-width="2"/></svg> Block';
  }

  // Enhanced User Details Modal
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

    // Set basic user info
    if (udName) udName.textContent = displayName || "";
    if (udEmail) udEmail.textContent = email || "";
    
    // Set avatar
    if (udAvatar) {
      udAvatar.innerHTML = "";
      udAvatar.className = "user-avatar-large";
      
      if (profile_picture) {
        const img = document.createElement("img");
        img.src = profile_picture;
        img.alt = displayName || "Avatar";
        udAvatar.appendChild(img);
      } else {
        const span = document.createElement("span");
        span.textContent = (displayName || "U").slice(0,1).toUpperCase();
        span.style.display = "flex";
        span.style.alignItems = "center";
        span.style.justifyContent = "center";
        span.style.width = "100%";
        span.style.height = "100%";
        span.style.background = "var(--color-primary)";
        span.style.color = "white";
        span.style.fontWeight = "700";
        span.style.fontSize = "18px";
        udAvatar.appendChild(span);
      }
    }

    // Show loading states
    owned.innerHTML = '<div class="loading-state">Loading owned items...</div>';
    borrowed.innerHTML = '<div class="loading-state">Loading borrowed items...</div>';
    
    // Show modal with animation
    modal.classList.remove("hidden");
    modal.style.opacity = "0";
    modal.style.transform = "scale(0.9)";
    
    setTimeout(() => {
      modal.style.opacity = "1";
      modal.style.transform = "scale(1)";
    }, 10);

    // Fetch details from server
    const resp = await postJson(ADMIN_USER_DETAILS_URL, { user_id: userId });
    
    if (!resp.ok || !resp.data) {
      owned.innerHTML = "<div class='empty-state'>Failed to load user details</div>";
      borrowed.innerHTML = "<div class='empty-state'>Network error occurred</div>";
      return;
    }
    
    if (!resp.data.success) {
      owned.innerHTML = "<div class='empty-state'>Unable to load user information</div>";
      borrowed.innerHTML = "<div class='empty-state'>Please try again later</div>";
      return;
    }

    const itemsOwned = resp.data.items_owned || [];
    const itemsBorrowed = resp.data.items_borrowed || [];
    const counts = resp.data.counts || {};

    // Update owned items
    owned.innerHTML = "";
    if (itemsOwned.length === 0) {
      owned.innerHTML = "<div class='empty-state'>No items owned by this user.</div>";
    } else {
      itemsOwned.forEach(item => {
        owned.appendChild(createEnhancedItemCard(item, 'owned'));
      });
    }

    // Update borrowed items
    borrowed.innerHTML = "";
    if (itemsBorrowed.length === 0) {
      borrowed.innerHTML = "<div class='empty-state'>No active borrow requests or items.</div>";
    } else {
      itemsBorrowed.forEach(request => {
        borrowed.appendChild(createEnhancedItemCard(request, 'borrowed'));
      });
    }

    // Update counts
    if (ownedCountEl) ownedCountEl.textContent = `Owned: ${counts.total_owned ?? itemsOwned.length}`;
    if (borrowedCountEl) borrowedCountEl.textContent = `Borrowed: ${counts.total_borrowed ?? itemsBorrowed.length}`;
  }

  // Enhanced item card creation
  function createEnhancedItemCard(data, type) {
    const card = document.createElement("div");
    card.className = "item-card";
    
    const item = data._item || data;
    const title = item.title || data.item_title || "Untitled Item";
    const description = item.description || "";
    const thumbnail = item.thumbnail_url || data.thumbnail_url || "";
    const status = data.status || "";

    // Thumbnail
    const thumb = document.createElement("div");
    thumb.className = "item-thumb";
    
    if (thumbnail) {
      const img = document.createElement("img");
      img.src = thumbnail;
      img.alt = title;
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";
      img.style.borderRadius = "8px";
      thumb.appendChild(img);
    } else {
      thumb.style.background = "var(--color-background)";
      thumb.style.display = "flex";
      thumb.style.alignItems = "center";
      thumb.style.justifyContent = "center";
      thumb.style.color = "var(--color-text-tertiary)";
      thumb.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
    
    card.appendChild(thumb);

    // Info section
    const info = document.createElement("div");
    info.style.flex = "1";
    info.style.minWidth = "0";
    
    const titleEl = document.createElement("div");
    titleEl.style.fontWeight = "600";
    titleEl.style.color = "var(--color-text-primary)";
    titleEl.style.marginBottom = "4px";
    titleEl.textContent = title.length > 30 ? title.slice(0, 30) + "..." : title;
    
    const descEl = document.createElement("div");
    descEl.style.fontSize = "13px";
    descEl.style.color = "var(--color-text-secondary)";
    descEl.style.marginBottom = "6px";
    descEl.textContent = description.length > 60 ? description.slice(0, 60) + "..." : description || "No description";
    
    info.appendChild(titleEl);
    info.appendChild(descEl);
    
    // Status badge for borrowed items
    if (type === 'borrowed' && status) {
      const statusEl = document.createElement("div");
      statusEl.style.fontSize = "11px";
      statusEl.style.fontWeight = "600";
      statusEl.style.padding = "2px 6px";
      statusEl.style.borderRadius = "8px";
      statusEl.style.display = "inline-block";
      
      if (status.toLowerCase() === 'pending') {
        statusEl.style.background = "var(--color-warning-light)";
        statusEl.style.color = "var(--color-warning)";
      } else if (status.toLowerCase() === 'approved') {
        statusEl.style.background = "var(--color-success-light)";
        statusEl.style.color = "var(--color-success)";
      } else if (status.toLowerCase() === 'denied') {
        statusEl.style.background = "var(--color-error-light)";
        statusEl.style.color = "var(--color-error)";
      } else {
        statusEl.style.background = "var(--color-background)";
        statusEl.style.color = "var(--color-text-secondary)";
      }
      
      statusEl.textContent = status;
      info.appendChild(statusEl);
    }
    
    card.appendChild(info);
    return card;
  }

  function closeUserDetailsModal() {
    const modal = document.getElementById("user-details-modal");
    if (modal) {
      modal.style.opacity = "0";
      modal.style.transform = "scale(0.9)";
      setTimeout(() => {
        modal.classList.add("hidden");
        modal.style.opacity = "";
        modal.style.transform = "";
      }, 300);
    }
  }

  // Filter users based on criteria
  function filterUsers(allUsers, roleFilter, statusFilter) {
    return allUsers.filter(user => {
      const roleMatch = roleFilter === 'all' || 
                       (roleFilter === 'admin' && user.is_admin) ||
                       (roleFilter === 'user' && !user.is_admin);
      
      const statusMatch = statusFilter === 'all' ||
                         (statusFilter === 'active' && !user.is_block) ||
                         (statusFilter === 'blocked' && user.is_block);
      
      return roleMatch && statusMatch;
    });
  }

  // Wire up everything on DOM ready
  document.addEventListener("DOMContentLoaded", function () {
    console.log("manage_users.js: DOMContentLoaded");
    const allUsers = loadUsersData();
    console.log("manage_users.js: loaded users count:", allUsers.length);

    // initialize counters
    updateCounters(allUsers);

    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulseSuccess {
        0% { box-shadow: 0 0 0 0 rgba(39, 174, 96, 0.4); }
        70% { box-shadow: 0 0 0 10px rgba(39, 174, 96, 0); }
        100% { box-shadow: 0 0 0 0 rgba(39, 174, 96, 0); }
      }
      @keyframes pulseWarning {
        0% { box-shadow: 0 0 0 0 rgba(255, 84, 89, 0.4); }
        70% { box-shadow: 0 0 0 10px rgba(255, 84, 89, 0); }
        100% { box-shadow: 0 0 0 0 rgba(255, 84, 89, 0); }
      }
      .loading-spinner {
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .loading-state {
        text-align: center;
        padding: 20px;
        color: var(--color-text-tertiary);
      }
    `;
    document.head.appendChild(style);

    // Bind admin toggle buttons
    document.querySelectorAll(".admin-toggle-btn").forEach(btn => {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        const userId = this.dataset.userId || this.getAttribute("data-user-id");
        if (!userId) return;
        const card = this.closest('.user-card');
        toggleAdmin(userId, card, allUsers);
      });
    });

    // Bind block toggle buttons
    document.querySelectorAll(".block-toggle-btn").forEach(btn => {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        const userId = this.dataset.userId || this.getAttribute("data-user-id");
        if (!userId) return;
        const card = this.closest('.user-card');
        toggleBlock(userId, card, allUsers);
      });
    });

    // Bind Details buttons
    document.querySelectorAll(".details-btn").forEach(btn => {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        const userId = this.dataset.userId || this.getAttribute("data-user-id");
        if (!userId) return;
        const card = this.closest('.user-card');
        const displayName = card?.querySelector(".user-name")?.textContent?.trim() || "";
        const email = card?.querySelector(".user-email")?.textContent?.trim() || "";
        const profile = allUsers.find(u => String(u.id) === String(userId))?.profile_picture || "";
        openUserDetails(userId, displayName, email, profile);
      });
    });

    // Modal close handlers
    document.getElementById("close-user-details")?.addEventListener("click", closeUserDetailsModal);
    document.getElementById("close-user-details-2")?.addEventListener("click", closeUserDetailsModal);
    document.querySelectorAll(".modal-backdrop").forEach(back => back.addEventListener("click", closeUserDetailsModal));

    // Filter functionality
    const roleFilter = document.getElementById('role-filter');
    const statusFilter = document.getElementById('status-filter');
    
    if (roleFilter && statusFilter) {
      const applyFilters = () => {
        const roleValue = roleFilter.value;
        const statusValue = statusFilter.value;
        // In a real implementation, you would filter and re-render the user cards here
        console.log('Applying filters:', { role: roleValue, status: statusValue });
      };
      
      roleFilter.addEventListener('change', applyFilters);
      statusFilter.addEventListener('change', applyFilters);
    }

    // Search functionality
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        // In a real implementation, you would filter user cards based on search term
        console.log('Searching for:', searchTerm);
      });
    }

    // Add hover effects to cards
    document.querySelectorAll('.user-card').forEach(card => {
      card.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-4px)';
      });
      
      card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
      });
    });

    // Escape key to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeUserDetailsModal();
      }
    });
  });

})();