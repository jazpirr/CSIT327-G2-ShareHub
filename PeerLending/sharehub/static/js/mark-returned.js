(function () {
  "use strict";
  console.log("[mark-returned] loaded");

  function getCookie(name) {
    const c = document.cookie.split("; ").find(s => s.trim().startsWith(name + "="));
    return c ? decodeURIComponent(c.split("=")[1]) : null;
  }

  // ensure popup fallbacks
  if (typeof window.showConfirmPopup !== "function") {
    window.showConfirmPopup = (title, msg, yes, no) => Promise.resolve(window.confirm(msg));
  }
  if (typeof window.showMessagePopup !== "function") {
    window.showMessagePopup = (title, msg, opts) => window.alert(msg);
  }

  // prefer explicit CSRF token if provided globally
  function getCSRFForRequest() {
    if (window.CSRF_TOKEN) return window.CSRF_TOKEN;
    return getCookie("csrftoken") || "";
  }

  document.addEventListener("click", async function (ev) {
    const btn = ev.target.closest && ev.target.closest("button[data-borrow-id]");
    if (!btn) return;

    // require explicit class to avoid affecting other buttons
    if (!btn.classList.contains("mark-returned-btn")) return;

    ev.preventDefault();
    ev.stopPropagation();

    // double submit guard
    if (btn.dataset.busy === "1") return;
    btn.dataset.busy = "1";

    const requestId = btn.getAttribute("data-borrow-id");
    if (!requestId) {
      console.warn("[mark-returned] missing data-borrow-id");
      btn.dataset.busy = "0";
      return;
    }

    // Confirmation (uses fallback to window.confirm if showConfirmPopup isn't available)
    const confirmed = await window.showConfirmPopup(
      "Mark this item as returned?",
      "Mark this item as returned? This will notify the owner so they can confirm receipt.",
      "OK",
      "Cancel"
    );

    if (!confirmed) {
      btn.dataset.busy = "0";
      return;
    }

    const prevText = btn.textContent;
    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");
    btn.textContent = "Processing...";

    const url = window.MARK_RETURNED_URL || "/mark-returned/";
    try {
      const res = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFForRequest(),
          "X-Requested-With": "XMLHttpRequest",
          "Accept": "application/json"
        },
        body: JSON.stringify({ request_id: requestId })
      });

      let json = {};
      try { json = await res.json(); } catch (e) { json = {}; }

      // treat non-2xx or explicit errors as failures
      if (!res.ok || (json && (json.errors || json.success === false))) {
        let msg = "Failed to mark returned. Please try again.";
        if (json && json.errors) {
          // try to extract useful message
          if (Array.isArray(json.errors.general) && json.errors.general[0] && json.errors.general[0].message) {
            msg = json.errors.general[0].message;
          } else {
            msg = JSON.stringify(json.errors);
          }
        } else if (json && json.message) {
          msg = json.message;
        }
        window.showMessagePopup("Error", msg, { autoCloseMs: 4000, type: "error" });
        btn.disabled = false;
        btn.removeAttribute("aria-busy");
        btn.textContent = prevText;
        btn.dataset.busy = "0";
        return;
      }

      // success — notify and remove row
      const row = btn.closest(".borrowed-item");
      window.showMessagePopup("Returned", json.message || "Item marked as returned. The owner has been notified.", { autoCloseMs: 2200, type: "success" });

      if (row) {
        // nice collapse animation then remove
        row.style.transition = "opacity .22s ease, transform .22s ease, height .28s ease, margin .22s ease";
        const height = row.offsetHeight + "px";
        row.style.height = height;
        row.style.opacity = "1";
        requestAnimationFrame(() => {
          row.style.opacity = "0";
          row.style.transform = "translateY(6px)";
          row.style.height = "0px";
          row.style.margin = "0px";
        });
        setTimeout(() => {
          if (row && row.parentNode) row.parentNode.removeChild(row);
        }, 320);
      } else {
        setTimeout(() => location.reload(), 600);
      }

    } catch (err) {
      console.error("[mark-returned] network error", err);
      window.showMessagePopup("Error", "Network error. Please try again.", { autoCloseMs: 3500, type: "error" });
      btn.disabled = false;
      btn.removeAttribute("aria-busy");
      btn.textContent = prevText;
      btn.dataset.busy = "0";
    }
  }, false);
})();
