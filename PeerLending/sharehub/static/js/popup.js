// static/js/popup.js
// Enhanced ShareHub popup with beautiful animations and icons
(function () {
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
    const closeBtn = popup && popup.querySelector(".close-btn");

    // Fallback if markup isn't present
    if (!popup || !header || !body) {
      window.showMessagePopup = (title, msg, opts = {}) => { alert(msg); };
      window.showConfirmPopup = async (title, msg, yesLabel = 'Yes', noLabel = 'Cancel') => confirm(msg);
      return;
    }

    // Initialize hidden state
    popup.style.display = "none";
    popup.setAttribute("aria-hidden", "true");
    popup.style.pointerEvents = "none";

    if (overlay) {
      overlay.style.display = "none";
      overlay.setAttribute("aria-hidden", "true");
      overlay.style.pointerEvents = "none";
      overlay.addEventListener("click", () => hidePopup());
    }

    if (closeBtn) {
      try { closeBtn.removeAttribute("onclick"); } catch (e) {}
      closeBtn.addEventListener("click", () => hidePopup());
    }

    // Icon SVGs
    const icons = {
      success: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:100%;height:100%;">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      `,
      error: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:100%;height:100%;">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      `,
      warning: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:100%;height:100%;">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      `,
      info: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:100%;height:100%;">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
      `
    };

    // expose a global pointer for confirm cleanup (null when no confirm pending)
    window.__popup_confirm_cleanup = null;
    let __popup_autoclose_timer = null;

    function showOverlay() {
      if (!overlay) return;
      overlay.style.display = "flex";
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
      setTimeout(() => {
        overlay.style.display = "none";
      }, 250);
    }

    function showPopup() {
      // Clear any existing auto-close timer when showing a popup
      if (__popup_autoclose_timer) { clearTimeout(__popup_autoclose_timer); __popup_autoclose_timer = null; }

      popup.style.display = "flex";
      setTimeout(() => {
        popup.classList.add("show");
        popup.style.pointerEvents = "auto";
        popup.setAttribute("aria-hidden", "false");
      }, 10);
      showOverlay();
    }

    function hidePopup() {
      // If a confirm is pending, cancel it (resolve false) so awaiting callers don't hang
      if (window.__popup_confirm_cleanup) {
        try { window.__popup_confirm_cleanup(false); } catch (e) { /* ignore */ }
        window.__popup_confirm_cleanup = null;
      }

      // clear any auto-close timer
      if (__popup_autoclose_timer) { clearTimeout(__popup_autoclose_timer); __popup_autoclose_timer = null; }

      popup.classList.remove("show");
      popup.setAttribute("aria-hidden", "true");
      popup.style.pointerEvents = "none";
      setTimeout(() => {
        popup.style.display = "none";
        body.innerHTML = "";
        // Remove type classes
        popup.classList.remove("popup-success", "popup-error", "popup-warning", "popup-info");
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

    // Enhanced message popup with icon support
    window.showMessagePopup = function (title, message, { 
      autoCloseMs = 3000, 
      type = 'info' // 'success', 'error', 'warning', 'info'
    } = {}) {
      // If a confirm is pending, cancel it — showing a message replaces confirm UI.
      if (window.__popup_confirm_cleanup) {
        try { window.__popup_confirm_cleanup(false); } catch(e) {}
        window.__popup_confirm_cleanup = null;
      }

      // Remove previous type classes from popup and its wrapper
      popup.classList.remove("popup-success", "popup-error", "popup-warning", "popup-info");
      const popupInner = popup.querySelector('.shared-popup-inner');
      if (popupInner) {
        popupInner.classList.remove("popup-success", "popup-error", "popup-warning", "popup-info");
      }
      
      // Add new type class to both popup and wrapper
      if (type) {
        popup.classList.add(`popup-${type}`);
        if (popupInner) {
          popupInner.classList.add(`popup-${type}`);
        }
      }

      header.textContent = title || "Message";
      
      const icon = icons[type] || icons.info;
      
      body.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:16px;">
          <div class="popup-message-icon" style="animation: icon-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);">
            ${icon}
          </div>
          <div class="popup-message">${escapeHtml(String(message))}</div>
        </div>
      `;
      
      showPopup();
      
      if (autoCloseMs && autoCloseMs > 0) {
        __popup_autoclose_timer = setTimeout(() => {
          hidePopup();
        }, autoCloseMs);
      }
    };

    // Enhanced confirm popup
    window.showConfirmPopup = function (title, message, yesLabel = "Yes", noLabel = "Cancel") {
      return new Promise((resolve) => {
        // If a previous confirm is pending, cancel it first (resolve false)
        if (window.__popup_confirm_cleanup) {
          try { window.__popup_confirm_cleanup(false); } catch(e) {}
          window.__popup_confirm_cleanup = null;
        }

        // Remove type classes for confirm dialogs
        popup.classList.remove("popup-success", "popup-error", "popup-warning", "popup-info");
        
        header.textContent = title || "Confirm";
        
        // Simple message without icon for confirm dialogs
        body.innerHTML = `
          <div class="popup-message">${escapeHtml(String(message))}</div>
          <div class="popup-buttons">
            <button id="__popupNoBtn" class="popup-secondary">
              ${escapeHtml(noLabel)}
            </button>
            <button id="__popupYesBtn" class="popup-primary">
              ${escapeHtml(yesLabel)}
            </button>
          </div>
        `;
        
        showPopup();

        const yesBtn = document.getElementById("__popupYesBtn");
        const noBtn = document.getElementById("__popupNoBtn");

        // cleanup resolves the pending confirm and removes listeners
        function cleanup(result) {
          try {
            if (yesBtn) yesBtn.removeEventListener("click", onYes);
            if (noBtn) noBtn.removeEventListener("click", onNo);
          } catch (e) { /* ignore */ }

          // clear global ref if still pointing to this cleanup
          if (window.__popup_confirm_cleanup === cleanup) window.__popup_confirm_cleanup = null;

          hidePopup();
          resolve(result);
        }
        
        function onYes() { cleanup(true); }
        function onNo() { cleanup(false); }

        if (yesBtn) yesBtn.addEventListener("click", onYes);
        if (noBtn) noBtn.addEventListener("click", onNo);

        function onKey(e) {
          if (e.key === "Escape") {
            cleanup(false);
          }
        }
        document.addEventListener("keydown", onKey, { once: true });

        // expose cleanup so other code (e.g. hidePopup) can cancel this pending confirm
        window.__popup_confirm_cleanup = cleanup;
      });
    };

    // Add CSS animation for icon
    if (!document.getElementById("popup-icon-animation")) {
      const style = document.createElement("style");
      style.id = "popup-icon-animation";
      style.textContent = `
        @keyframes icon-pop {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    // small init log
    console.log('[popup.js] initialized', { popup: !!popup, overlay: !!overlay, header: !!header, body: !!body, closeBtn: !!closeBtn });

  }); // _ready
})();
