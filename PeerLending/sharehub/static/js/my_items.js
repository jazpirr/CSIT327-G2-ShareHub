/* ================================
   Helpers
================================ */

function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== "") {
    const cookies = document.cookie.split(";");
    for (let c of cookies) {
      const cookie = c.trim();
      if (cookie.substring(0, name.length + 1) === name + "=") {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

const csrftoken = getCookie("csrftoken");

// Prevent duplicate requests firing twice
const inflight = new Set();

/* ================================
   UI Helpers
================================ */

function updateStatCount(elId, delta) {
  const el = document.getElementById(elId);
  if (!el) return;
  const current = parseInt(el.textContent) || 0;
  el.textContent = Math.max(0, current + delta);
}

function removeRequestElement(reqId) {
  const el = document.querySelector(`#req-${reqId}`);
  if (!el) return;

  el.style.transition = "opacity 220ms ease, transform 220ms ease, height 220ms ease";
  el.style.opacity = "0";
  el.style.transform = "translateX(20px)";
  el.style.height = el.offsetHeight + "px";

  requestAnimationFrame(() => {
    el.style.height = "0px";
  });

  setTimeout(() => el.remove(), 260);
}

function adjustCardRequestCount(reqEl) {
  const card = reqEl.closest(".item-card-enhanced");
  if (!card) return;

  const badge = card.querySelector(".requests-badge, .requests-count-badge");
  if (badge) {
    let count = parseInt(badge.textContent) || 0;
    count = Math.max(0, count - 1);
    if (count > 0) {
      badge.textContent = count;
    } else {
      badge.remove();
      const reqSection = card.querySelector(".requests-section-enhanced");
      if (reqSection) {
        reqSection.innerHTML = `
          <div class="no-requests-state">
            <i class="fas fa-comment-alt-smile"></i>
            <p>No pending requests</p>
          </div>
        `;
      }
    }
  }
}

/* ================================
   Respond Request (Approve/Deny)
================================ */

async function respondRequest(requestId, action, btn) {
  if (!requestId) return;

  // Prevent same request firing twice
  if (inflight.has(requestId)) return;
  inflight.add(requestId);

  const oldHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML =
    action === "approve"
      ? '<i class="fas fa-spinner fa-spin"></i> Approving...'
      : '<i class="fas fa-spinner fa-spin"></i> Denying...';

  try {
    const resp = await fetch("/api/request/respond/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrftoken,
        Accept: "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({ request_id: requestId, action }),
    });

    const text = await resp.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }

    if (!resp.ok || !data.success) {
      const msg =
        data.message ||
        (data.errors ? JSON.stringify(data.errors) : "Failed to update request.");

      if (window.showMessagePopup) {
        showMessagePopup("Action failed", msg, { type: "error", autoCloseMs: 4500 });
      } else {
        alert("Failed: " + msg);
      }

      btn.disabled = false;
      btn.innerHTML = oldHTML;
      inflight.delete(requestId);
      return;
    }

    // SUCCESS
    const reqEl = document.querySelector(`#req-${requestId}`);
    if (reqEl) {
      adjustCardRequestCount(reqEl);
      removeRequestElement(requestId);
    }

    updateStatCount("pendingCount", -1);

    if (window.showMessagePopup) {
      showMessagePopup(
        "Success",
        action === "approve" ? "Request approved." : "Request denied.",
        { type: "success", autoCloseMs: 3000 }
      );
    }

  } catch (err) {
    console.error(err);
    if (window.showMessagePopup) {
      showMessagePopup("Network error", "Network error while processing action.", {
        type: "error",
        autoCloseMs: 4500,
      });
    } else {
      alert("Network error.");
    }
  }

  inflight.delete(requestId);
}

/* ================================
   Delegated Button Click Handler
================================ */

document.addEventListener("click", (e) => {
  const approve = e.target.closest(".btn-approve-new");
  const deny = e.target.closest(".btn-deny-new");

  if (approve) {
    respondRequest(approve.dataset.requestId, "approve", approve);
  } else if (deny) {
    respondRequest(deny.dataset.requestId, "deny", deny);
  }
});

/* ================================
   Filtering (All, Available, Borrowed, Returned)
================================ */

document.addEventListener("DOMContentLoaded", function () {
  const filterBtns = document.querySelectorAll(".filter-toggle-btn");
  const cards = document.querySelectorAll(".item-card-enhanced");

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const filter = btn.dataset.filter;

      cards.forEach((card) => {
        const status = (card.dataset.status || "").trim().toLowerCase();
        card.style.display =
          filter === "all" || filter === status ? "block" : "none";
      });
    });
  });
});

/* ================================
   Delete Item
================================ */

async function deleteItem(itemId, btnEl) {
  let ok = false;

  if (window.showConfirmPopup) {
    ok = await showConfirmPopup(
      "Delete this item?",
      "This action cannot be undone.",
      "Delete",
      "Cancel"
    );
  } else {
    ok = confirm("Delete this item? This action cannot be undone.");
  }

  if (!ok) return;

  const oldText = btnEl.innerHTML;
  btnEl.disabled = true;
  btnEl.innerHTML = "Deleting...";

  try {
    const resp = await fetch(btnEl.dataset.deleteUrl, {
      method: "POST",
      headers: {
        "X-CSRFToken": csrftoken,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({}),
    });

    const data = await resp.json().catch(() => ({}));

    if (resp.ok && data.success) {
      const card = document.querySelector(
        `.item-card-enhanced[data-item-id="${itemId}"]`
      );
      if (card) {
        card.style.transition = "opacity 240ms ease, transform 240ms ease";
        card.style.opacity = "0";
        card.style.transform = "translateY(12px)";
        setTimeout(() => card.remove(), 240);
      }

      if (window.showMessagePopup) {
        showMessagePopup("Deleted", "Item deleted successfully", {
          type: "success",
          autoCloseMs: 2500,
        });
      }

    } else {
      const msg = data.message || "Delete failed.";
      if (window.showMessagePopup)
        showMessagePopup("Delete failed", msg, { type: "error" });
      else alert("Delete failed: " + msg);

      btnEl.disabled = false;
      btnEl.innerHTML = oldText;
    }
  } catch (err) {
    console.error(err);
    if (window.showMessagePopup)
      showMessagePopup("Network error", "Failed to delete item", {
        type: "error",
      });
    else alert("Network error");

    btnEl.disabled = false;
    btnEl.innerHTML = oldText;
  }
}

document.addEventListener("click", (e) => {
  const delBtn = e.target.closest(".btn-delete-item");
  if (!delBtn) return;

  const id = delBtn.dataset.itemId;
  deleteItem(id, delBtn);
});
