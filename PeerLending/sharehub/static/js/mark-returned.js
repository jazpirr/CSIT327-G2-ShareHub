(function () {
  "use strict";
  console.log("[mark-returned] loaded");

  function getCookie(name) {
    const c = document.cookie.split("; ").find(s => s.startsWith(name + "="));
    return c ? decodeURIComponent(c.split("=")[1]) : null;
  }

  // ensure popup fallbacks
  if (typeof window.showConfirmPopup !== "function") {
    window.showConfirmPopup = (title, msg, yes, no) => Promise.resolve(window.confirm(msg));
  }
  if (typeof window.showMessagePopup !== "function") {
    window.showMessagePopup = (title, msg, opts) => window.alert(msg);
  }

  document.addEventListener("click", async function (ev) {
    const btn = ev.target.closest("button[data-borrow-id]");
    if (!btn) return;

    if (!btn.classList.contains("mark-returned-btn") && !btn.textContent.toLowerCase().includes("mark as returned")) {
      return;
    }

    ev.preventDefault();

    const requestId = btn.getAttribute("data-borrow-id");
    if (!requestId) {
      console.warn("[mark-returned] missing data-borrow-id");
      return;
    }

    const confirmed = await window.showConfirmPopup(
      "Mark this item as returned?",
      "Mark this item as returned? This will notify the owner so they can confirm receipt.",
      "OK",
      "Cancel"
    );

    if (!confirmed) return;

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
          "X-CSRFToken": getCookie("csrftoken") || "",
          "X-Requested-With": "XMLHttpRequest",
          "Accept": "application/json"
        },
        body: JSON.stringify({ request_id: requestId })
      });

      let json = {};
      try { json = await res.json(); } catch (e) { json = {}; }

      if (!res.ok || json.errors) {
        let msg = "Failed to mark returned. Please try again.";
        if (json && json.errors && json.errors.general && json.errors.general[0] && json.errors.general[0].message) {
          msg = json.errors.general[0].message;
        } else if (json && json.message) {
          msg = json.message;
        }
        window.showMessagePopup("Error", msg, { autoCloseMs: 4000 });
        btn.disabled = false;
        btn.removeAttribute("aria-busy");
        btn.textContent = prevText;
        return;
      }

      // success — notify and remove row
      const row = btn.closest(".borrowed-item");
      window.showMessagePopup("Returned", json.message || "Item marked as returned. The owner has been notified.", { autoCloseMs: 2200 });

      if (row) {
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
        }, 300);
      } else {
        setTimeout(() => location.reload(), 600);
      }

    } catch (err) {
      console.error("[mark-returned] network error", err);
      window.showMessagePopup("Error", "Network error. Please try again.", { autoCloseMs: 3500 });
      btn.disabled = false;
      btn.removeAttribute("aria-busy");
      btn.textContent = prevText;
    }
  }, false);
})();
