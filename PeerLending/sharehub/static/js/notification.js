// notification.js (debug-enabled)
(function () {
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  function getCSRFCookie(name = 'csrftoken') {
    const m = document.cookie.match(new RegExp('(^|; )' + name + '=([^;]+)'));
    return m ? m[2] : '';
  }

  ready(function () {
    console.log('[notification.js] loaded');

    const notifBtn = document.querySelector('.notification-btn');
    const popup = document.getElementById('notificationPopup');
    let overlay = document.getElementById('notificationOverlay');
    const closeBtn = document.getElementById('closePopup');
    const markReadBtn = document.querySelector('.mark-read-btn');
    const badge = document.getElementById('notificationBadge');

    console.log('[notification.js] elements:', { notifBtn, popup, overlay, closeBtn, markReadBtn, badge });

    // If popup or button missing, show meaningful console message and return
    if (!notifBtn) {
      console.warn('[notification.js] .notification-btn not found — nothing to bind.');
      return;
    }
    if (!popup) {
      console.warn('[notification.js] #notificationPopup not found — nothing to bind.');
      return;
    }

    // create overlay if not present
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'notificationOverlay';
      overlay.className = 'notification-overlay';
      document.body.appendChild(overlay);
      console.log('[notification.js] created overlay element');
    }

    // quick helper to inspect listeners
    try {
      // show listeners for debugging in Chrome only (will throw in other browsers)
      // eslint-disable-next-line no-undef
      if (window.getEventListeners) {
        console.log('[notification.js] event listeners on button:', getEventListeners(notifBtn));
      }
    } catch (e) { /* ignore */ }

    function positionPopup() {
      const btnRect = notifBtn.getBoundingClientRect();
      const popupRect = popup.getBoundingClientRect();
      const popupW = popupRect.width || popup.offsetWidth || 400;
      const popupH = popupRect.height || popup.offsetHeight || 520;

      // target coordinates: place popup so its top is just under the button
      let top = Math.round(btnRect.bottom + 8); // 8px gap
      let left = Math.round(btnRect.left + btnRect.width - popupW); // align right edge of popup to button right

      // clamp horizontally so popup never goes offscreen
      const minLeft = 8;
      const maxLeft = Math.max(8, window.innerWidth - popupW - 8);
      if (left < minLeft) left = minLeft;
      if (left > maxLeft) left = maxLeft;

      // clamp vertically so popup doesn't overflow bottom
      const bottomOverflow = (top + popupH) - window.innerHeight;
      if (bottomOverflow > 0) {
        top = Math.max(8, top - bottomOverflow - 8);
      }

      popup.style.position = 'fixed';
      popup.style.left = `${left}px`;
      popup.style.top = `${top}px`;
    }



    // when opening:
    function openPopup() {
      popup.classList.add('active');
      overlay.classList.add('active');
      popup.setAttribute('aria-hidden', 'false');      // accessibility
      document.body.classList.add('modal-open');        // freeze page scroll
      // allow inner list to scroll
      const list = popup.querySelector('.notification-list');
      if (list) list.style.overflowY = 'auto';
      positionPopup();
    }

    // when closing:
    function closePopup() {
      popup.classList.remove('active');
      overlay.classList.remove('active');
      popup.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
      overlay.classList.remove('ignore-under-popup');
    }
    function togglePopup() { popup.classList.contains('active') ? closePopup() : openPopup(); }

    // bind handlers
    notifBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      console.log('[notification.js] bell clicked (toggling popup).');
      togglePopup();
      setTimeout(positionPopup, 0);
    });

    // overlay click closes
    overlay.addEventListener('click', function () {
      console.log('[notification.js] overlay clicked -> closing popup.');
      closePopup();
    });

    if (closeBtn) closeBtn.addEventListener('click', function (e) { e.stopPropagation(); closePopup(); });

    // stop propagation inside popup
    popup.addEventListener('click', function (e) { e.stopPropagation(); });

    // close on Esc and outside click
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && popup.classList.contains('active')) { closePopup(); } });
    document.addEventListener('click', function (e) {
      if (!popup.classList.contains('active')) return;
      if (popup.contains(e.target) || notifBtn.contains(e.target)) return;
      console.log('[notification.js] document click outside popup -> closing.');
      closePopup();
    });

    window.addEventListener('resize', positionPopup, { passive: true });
    window.addEventListener('scroll', positionPopup, { passive: true });

    if (markReadBtn) {
      markReadBtn.addEventListener('click', async function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        const prev = markReadBtn.textContent;
        markReadBtn.disabled = true;
        markReadBtn.textContent = 'Marking...';
        const url = window.NOTIF_MARK_READ_URL;
        if (!url) {
          console.error('[notification.js] NOTIF_MARK_READ_URL not defined on window.');
          markReadBtn.textContent = prev;
          markReadBtn.disabled = false;
          return;
        }
        try {
          const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRFToken': getCSRFCookie() },
            body: JSON.stringify({})
          });
          if (!resp.ok) throw new Error('Status ' + resp.status);
          const data = await resp.json();
          console.log('[notification.js] mark-read response', data);
          popup.querySelectorAll('.notification-item.unread').forEach(it => {
            it.classList.remove('unread');
            const st = it.querySelector('.notification-status'); if (st) st.remove();
          });
          if (badge) { badge.textContent = '0'; badge.style.display = 'none'; }
          setTimeout(closePopup, 120);
        } catch (err) {
          console.error('[notification.js] mark-read failed', err);
          alert('Failed to mark notifications read. See console for details.');
        } finally {
          markReadBtn.disabled = false;
          markReadBtn.textContent = prev;
        }
      });
    }

    // ensure list scroll
    const listEl = popup.querySelector('.notification-list');
    if (listEl) { listEl.style.maxHeight = listEl.style.maxHeight || '500px'; listEl.style.overflowY = listEl.style.overflowY || 'auto'; }

    // final position call
    positionPopup();
    console.log('[notification.js] initialized OK');
  });
})();
