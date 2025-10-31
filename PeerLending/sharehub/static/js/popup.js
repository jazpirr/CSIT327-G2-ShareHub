// static/js/popup.js
// Shared custom popup helpers — reuses #errorPopup & #errorOverlay from login.html
// Exposes window.showMessagePopup(title, message, {autoCloseMs})
// and window.showConfirmPopup(title, message, yesLabel, noLabel)

(function () {
  // run when DOM is available (safe even if script is at body end)
  function _ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  _ready(function () {
    const popup = document.getElementById("errorPopup");
    const overlay = document.getElementById("errorOverlay");
    const header = document.getElementById("popupHeader");
    const body = document.getElementById("popupBody");
    // close button inside popup (login template used inline onclick; we'll attach too)
    const closeBtn = popup && popup.querySelector(".close-btn");

    // fallback small API if markup isn't present (so other scripts don't break)
    if (!popup || !header || !body) {
      window.showMessagePopup = (title, msg, opts = {}) => { alert(msg); };
      window.showConfirmPopup = async (title, msg, yesLabel = 'Yes', noLabel = 'Cancel') => confirm(msg);
      return;
    }

    // init hidden state & pointer-events so it doesn't block clicks when hidden
    popup.style.display = popup.style.display || "none";
    popup.setAttribute("aria-hidden", popup.style.display === "none" ? "true" : "false");
    if (popup.style.display === "none") popup.style.pointerEvents = "none";

    if (overlay) {
      overlay.style.display = overlay.style.display || "none";
      overlay.setAttribute("aria-hidden", overlay.style.display === "none" ? "true" : "false");
      if (overlay.style.display === "none") overlay.style.pointerEvents = "none";
      // clicking overlay will close the popup
      overlay.addEventListener("click", () => hidePopup());
    }

    if (closeBtn) {
      // remove any inline onclick to avoid duplicate handlers (optional)
      try { closeBtn.removeAttribute && closeBtn.removeAttribute("onclick"); } catch (e) {}
      closeBtn.addEventListener("click", () => hidePopup());
    }

    function showOverlay() {
      if (!overlay) return;
      overlay.style.display = "block";
      // small timeout to allow CSS transition if you use classes
      setTimeout(() => {
        overlay.classList.add("show");
        overlay.setAttribute("aria-hidden", "false");
        overlay.style.pointerEvents = "auto";
      }, 10);
    }

    function hideOverlay() {
      if (!overlay) return;
      overlay.classList.remove("show");
      overlay.setAttribute("aria-hidden", "true");
      overlay.style.pointerEvents = "none";
      // match CSS: hide after transition (safe short delay)
      setTimeout(() => {
        overlay.style.display = "none";
      }, 250);
    }

    function showPopup() {
      popup.style.display = "flex";
      // allow layout paint then set show state
      setTimeout(() => {
        popup.classList.add("show");
        popup.style.pointerEvents = "auto";
        popup.setAttribute("aria-hidden", "false");
      }, 10);
      showOverlay();
    }

    function hidePopup() {
      popup.classList.remove("show");
      popup.setAttribute("aria-hidden", "true");
      popup.style.pointerEvents = "none";
      // allow CSS transition then hide completely
      setTimeout(() => {
        popup.style.display = "none";
        body.innerHTML = "";
      }, 250);
      hideOverlay();
    }

    function escapeHtml(str) {
      if (!str && str !== 0) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    // Public API: message popup (auto-closes by default)
    window.showMessagePopup = function (title, message, { autoCloseMs = 3000 } = {}) {
      header.textContent = title || "Message";
      body.innerHTML = `<div class="popup-message">${escapeHtml(String(message))}</div>`;
      showPopup();
      if (autoCloseMs && autoCloseMs > 0) {
        setTimeout(() => {
          hidePopup();
        }, autoCloseMs);
      }
    };

    // Public API: confirm popup returning Promise<boolean>
    window.showConfirmPopup = function (title, message, yesLabel = "Yes", noLabel = "Cancel") {
      return new Promise((resolve) => {
        header.textContent = title || "Confirm";
        body.innerHTML = `
          <div class="popup-message" style="margin-bottom:12px;">${escapeHtml(String(message))}</div>
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button id="__popupNoBtn" class="btn btn-secondary" style="padding:8px 12px;border-radius:6px;border:1px solid #ccc;background:#fff;">
              ${escapeHtml(noLabel)}
            </button>
            <button id="__popupYesBtn" class="btn btn-primary" style="padding:8px 12px;border-radius:6px;background:#7b1e1e;color:#fff;border:none;">
              ${escapeHtml(yesLabel)}
            </button>
          </div>
        `;
        showPopup();

        const yesBtn = document.getElementById("__popupYesBtn");
        const noBtn = document.getElementById("__popupNoBtn");

        function cleanup(result) {
          if (yesBtn) yesBtn.removeEventListener("click", onYes);
          if (noBtn) noBtn.removeEventListener("click", onNo);
          hidePopup();
          resolve(result);
        }
        function onYes() { cleanup(true); }
        function onNo() { cleanup(false); }

        if (yesBtn) yesBtn.addEventListener("click", onYes);
        if (noBtn) noBtn.addEventListener("click", onNo);

        // allow keyboard esc to cancel
        function onKey(e) {
          if (e.key === "Escape") {
            cleanup(false);
          }
        }
        document.addEventListener("keydown", onKey, { once: true });
      });
    };

  }); // _ready
})();
