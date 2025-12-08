// static/js/borrow_items.js - Updated: fixes for sort (most recent / oldest)
document.addEventListener('DOMContentLoaded', function () {
  // ---------- Basic element refs ----------
  const borrowModal = document.getElementById('borrowModal');
  const cancelBorrowBtn = document.getElementById('cancelBorrow');
  const borrowForm = document.getElementById('borrowForm');
  const modalItemName = document.getElementById('modalItemName');
  const modalOwnerName = document.getElementById('modalOwnerName');
  const borrowStartEl = document.getElementById('borrowStart');
  const borrowEndEl = document.getElementById('borrowEnd');

  const modalImage = document.getElementById('modalImage');
  const modalImagePlaceholder = document.getElementById('modalImagePlaceholder');
  const modalCategory = document.getElementById('modalCategory');
  const modalCondition = document.getElementById('modalCondition');
  const modalDescription = document.getElementById('modalDescription');
  const modalItemIdInput = document.getElementById('modalItemId');

  const modalDetailsView = document.getElementById('modalDetailsView');
  const modalRequestView = document.getElementById('modalRequestView');
  const showRequestFormBtn = document.getElementById('showRequestForm');
  const backToDetailsBtn = document.getElementById('backToDetails');
  const sendRequestBtn = document.getElementById('sendRequestBtn');
  const modalTitle = document.getElementById('modalTitle');
  const modalSubtitle = document.getElementById('modalSubtitle');

  const modalItemName2 = document.getElementById('modalItemName2');
  const modalOwnerName2 = document.getElementById('modalOwnerName2');
  const modalCategory2 = document.getElementById('modalCategory2');
  const modalCondition2 = document.getElementById('modalCondition2');

  const REQUEST_BORROW_URL = window.REQUEST_BORROW_URL || '/request-borrow/';

  let currentItem = null;
  let cameFromDetailsView = false;

  // popup wrappers (use custom popup if present)
  function showMessagePopupWrapper(title, message, opts = {}) {
    if (typeof window.showMessagePopup === 'function') {
      window.showMessagePopup(title, message, opts);
    } else {
      alert((title ? title + '\n\n' : '') + (message || ''));
    }
  }
  async function showConfirmPopupWrapper(title, message, yesLabel = 'OK', noLabel = 'Cancel') {
    if (typeof window.showConfirmPopup === 'function') {
      return await window.showConfirmPopup(title, message, yesLabel, noLabel);
    } else {
      return Promise.resolve(confirm(message));
    }
  }

  function getCookie(name) {
    const v = `; ${document.cookie}`;
    const parts = v.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  // ---------- Borrow modal helpers ----------
  function openBorrowModal() {
    if (!borrowModal) return;
    borrowModal.style.display = 'flex';
    borrowModal.style.alignItems = 'center';
    borrowModal.style.justifyContent = 'center';
    document.body.style.overflow = 'hidden';
    borrowModal.classList.add('active');
  }

  function hideBorrowModal() {
    if (!borrowModal) return;
    borrowModal.style.display = 'none';
    document.body.style.overflow = '';
    borrowModal.classList.remove('active');
  }

  function resetBorrowForm() {
    if (borrowForm) borrowForm.reset();
  }

  function resetModalToDetailsView() {
    if (modalDetailsView) modalDetailsView.classList.remove('hidden');
    if (modalRequestView) modalRequestView.classList.remove('active');
    if (modalTitle) modalTitle.textContent = 'Item Details';
    if (modalSubtitle) modalSubtitle.textContent = 'View item information';
    if (cancelBorrowBtn) cancelBorrowBtn.style.display = 'block';
    if (showRequestFormBtn) showRequestFormBtn.style.display = 'block';
    if (backToDetailsBtn) backToDetailsBtn.style.display = 'none';
    if (sendRequestBtn) sendRequestBtn.style.display = 'none';
  }

  function showRequestFormView() {
    if (modalDetailsView) modalDetailsView.classList.add('hidden');
    if (modalRequestView) modalRequestView.classList.add('active');
    if (modalTitle) modalTitle.textContent = 'Request to Borrow';
    if (modalSubtitle) modalSubtitle.textContent = 'Send a borrow request to the item owner';
    if (cancelBorrowBtn) cancelBorrowBtn.style.display = 'none';
    if (showRequestFormBtn) showRequestFormBtn.style.display = 'none';
    if (backToDetailsBtn) {
      backToDetailsBtn.style.display = 'block';
      backToDetailsBtn.textContent = cameFromDetailsView ? 'Back' : 'Cancel';
    }
    if (sendRequestBtn) sendRequestBtn.style.display = 'block';
    if (modalItemName2 && modalItemName) modalItemName2.textContent = modalItemName.textContent;
    if (modalOwnerName2 && modalOwnerName) modalOwnerName2.textContent = modalOwnerName.textContent;
    if (modalCategory2 && modalCategory) modalCategory2.textContent = modalCategory.textContent;
    if (modalCondition2 && modalCondition) modalCondition2.textContent = modalCondition.textContent;
  }

  function closeBorrowModal() {
    hideBorrowModal();
    resetBorrowForm();
    resetModalToDetailsView();
    currentItem = null;
    cameFromDetailsView = false;
  }

  function openBorrowModalFromElement(el, skipToRequestForm = false) {
    const itemBox = el.closest('.item-box') || el.closest('.item-card') || el;
    if (!itemBox) return;

    const itemId = itemBox.dataset.itemId || itemBox.getAttribute('data-item-id') || null;
    const titleAttr = itemBox.dataset.title || itemBox.getAttribute('data-title') || null;
    const imageAttr = itemBox.dataset.image || itemBox.getAttribute('data-image') || null;
    const ownerAttr = itemBox.dataset.ownerName || itemBox.getAttribute('data-owner-name') || null;
    const categoryAttr = itemBox.dataset.category || itemBox.getAttribute('data-category') || null;
    const conditionAttr = itemBox.dataset.condition || itemBox.getAttribute('data-condition') || null;
    const descriptionAttr = itemBox.dataset.description || itemBox.getAttribute('data-description') || null;

    const titleFromDOM = titleAttr ||
      (itemBox.querySelector('.item-title') && itemBox.querySelector('.item-title').textContent.trim()) ||
      (itemBox.querySelector('h3') && itemBox.querySelector('h3').textContent.trim()) ||
      'Item';

    const ownerFromDOM = ownerAttr || (itemBox.getAttribute('data-owner-name')) || null;

    if (modalItemName) modalItemName.textContent = titleFromDOM;
    if (modalOwnerName) modalOwnerName.textContent = ownerFromDOM || ownerAttr || 'Unknown';
    if (modalCategory) modalCategory.textContent = categoryAttr || 'N/A';
    if (modalCondition) modalCondition.textContent = conditionAttr || 'N/A';
    if (modalDescription) modalDescription.textContent = descriptionAttr || 'No description provided';
    if (modalItemIdInput) modalItemIdInput.value = itemId || '';

    if (modalImage && modalImagePlaceholder) {
      if (imageAttr) {
        modalImage.src = imageAttr;
        modalImage.style.display = 'block';
        modalImagePlaceholder.style.display = 'none';
      } else {
        modalImage.src = '';
        modalImage.style.display = 'none';
        modalImagePlaceholder.style.display = 'flex';
      }
    }

    currentItem = {
      item_id: itemId || null,
      name: titleFromDOM,
      owner: (ownerFromDOM || ownerAttr) || null,
      element: itemBox
    };

    if (borrowStartEl && borrowEndEl) {
      const today = new Date();
      const iso = d => d.toISOString().slice(0, 10);
      const future = new Date(today);
      future.setDate(future.getDate() + 7);
      borrowStartEl.value = iso(today);
      borrowStartEl.min = iso(today);
      borrowEndEl.value = iso(future);
      borrowEndEl.min = iso(today);
    }

    openBorrowModal();

    if (skipToRequestForm) {
      cameFromDetailsView = false;
      showRequestFormView();
    } else {
      cameFromDetailsView = false;
      resetModalToDetailsView();
    }
  }

  // wire opening interactions
  // In borrow_items.js, update the click handler:
  document.querySelectorAll('.item-box').forEach(function (card) {
    card.addEventListener('click', function (ev) {
      const t = ev.target;

      // Don't trigger if clicking on report dots, report dropdown, or report button
      if (
        t.closest('.report-dots') ||
        t.closest('.report-dropdown') ||
        t.closest('.report-issue-btn') ||
        t.closest('button')  // Also don't trigger on any button
      ) {
        return;
      }

      openBorrowModalFromElement(card, false);
    });
  });

  const requestButtons = Array.from(document.querySelectorAll('.request-btn'));
  requestButtons.forEach(button => {
    button.addEventListener('click', function (ev) {
      ev.stopPropagation();
      openBorrowModalFromElement(this, true);
    });
  });

  if (showRequestFormBtn) {
    showRequestFormBtn.addEventListener('click', function (e) {
      e.preventDefault();
      cameFromDetailsView = true;
      showRequestFormView();
    });
  }

  if (backToDetailsBtn) {
    backToDetailsBtn.addEventListener('click', function (e) {
      e.preventDefault();
      if (cameFromDetailsView) resetModalToDetailsView();
      else closeBorrowModal();
    });
  }

  if (cancelBorrowBtn) cancelBorrowBtn.addEventListener('click', closeBorrowModal);
  if (borrowModal) {
    borrowModal.addEventListener('click', function (e) {
      if (e.target === borrowModal) closeBorrowModal();
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && borrowModal && borrowModal.classList.contains('active')) {
      closeBorrowModal();
    }
  });

  // form submit (request)
  if (borrowForm) {
    borrowForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const startDate = borrowStartEl ? borrowStartEl.value : null;
      const endDate = borrowEndEl ? borrowEndEl.value : null;

      if (!startDate || !endDate) {
        showMessagePopupWrapper('Missing Dates', 'Please select both start and return dates.', { autoCloseMs: 3000 });
        return;
      }

      const startTs = new Date(startDate);
      const endTs = new Date(endDate);
      if (isNaN(startTs.getTime()) || isNaN(endTs.getTime())) {
        showMessagePopupWrapper('Invalid Dates', 'Invalid dates. Please use the date picker.', { autoCloseMs: 3000 });
        return;
      }
      if (endTs <= startTs) {
        showMessagePopupWrapper('Date Error', 'Return date must be after the start date.', { autoCloseMs: 3000 });
        return;
      }

      if (!currentItem || !currentItem.item_id) {
        showMessagePopupWrapper('Missing Item', 'Missing item. Try again.', { autoCloseMs: 3000 });
        return;
      }

      const submitBtn = document.getElementById('sendRequestBtn');
      const originalText = submitBtn ? submitBtn.textContent : null;
      if (submitBtn) {
        submitBtn.innerHTML = '<span class="spinner"></span> Sending...';
        submitBtn.disabled = true;
        submitBtn.classList.add('btn-spinner');
      }

      try {
        const res = await fetch(REQUEST_BORROW_URL, {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            item_id: currentItem.item_id,
            start_date: startDate,
            end_date: endDate
          })
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok && (data.success === undefined || data.success)) {
          const successMsg = data.message || `Borrow request sent successfully for ${currentItem.name}!`;
          showMessagePopupWrapper('Request Sent', successMsg, { autoCloseMs: 3000 });

          try {
            const btn = currentItem.element.querySelector('.request-btn');
            if (btn) {
              btn.textContent = 'Request Sent';
              btn.disabled = true;
              btn.style.background = '#999';
              btn.style.cursor = 'not-allowed';
            }
          } catch (e) { }

          closeBorrowModal();
        } else {
          let msg = 'Failed to send request. Please try again.';
          if (data && data.errors) {
            try {
              const firstKey = Object.keys(data.errors)[0];
              msg = data.errors[firstKey][0].message || JSON.stringify(data.errors);
            } catch (err) {
              msg = JSON.stringify(data.errors);
            }
          } else if (data && data.message) {
            msg = data.message;
          }
          showMessagePopupWrapper('Error', msg, { autoCloseMs: 4000 });
        }
      } catch (err) {
        console.error(err);
        showMessagePopupWrapper('Network Error', 'Network error. Please try again.', { autoCloseMs: 4000 });
      } finally {
        if (submitBtn) {
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
          submitBtn.classList.remove('btn-spinner');
        }
      }
    });
  }

  // ---------- Simple search filtering ----------
  const searchInput = document.querySelector('.search-input');
  const itemCards = Array.from(document.querySelectorAll('.item-box, .item-card'));
  if (searchInput && itemCards.length) {
    searchInput.addEventListener('input', function () {
      const searchTerm = this.value.toLowerCase().trim();
      itemCards.forEach(card => {
        const itemName = (card.querySelector('.item-title')?.textContent || card.querySelector('h3')?.textContent || '').toLowerCase();
        const ownerName = (card.getAttribute('data-owner-name') || card.querySelector('.item-owner')?.textContent || '').toLowerCase();
        const description = (card.getAttribute('data-description') || card.querySelector('.item-description')?.textContent || '').toLowerCase();
        const matches = itemName.includes(searchTerm) || ownerName.includes(searchTerm) || description.includes(searchTerm);
        card.style.display = matches ? '' : 'none';
      });
      const found = itemCards.some(c => c.style.display !== 'none');
      window.hideTemplateNoResults && window.hideTemplateNoResults(!found);
      maybeShowJSNoResults(!found);
    });
  }

  // ---------- FILTER POPUP + FILTERING LOGIC (POPUP BELOW BUTTON) ----------
  (function setupFilterPopupAndLogic() {
    const filterBtn = document.querySelector('.search-filter-btn');
    const filterPopup = document.getElementById('filterPopup');
    const filterClose = document.getElementById('filterClose');
    const filterApplyBtn = document.getElementById('filterApplyBtn');
    const filterClearBtn = document.getElementById('filterClearBtn');
    const noResultsTemplate = document.getElementById('noResultsTemplate');

    if (!filterPopup) return;

    filterPopup.classList.remove('active');
    filterPopup.style.display = 'none';
    filterPopup.setAttribute('aria-hidden', 'true');
    filterPopup.style.left = 'auto';
    filterPopup.style.top = 'auto';
    filterPopup.style.right = '24px';
    filterPopup.style.bottom = 'auto';

    const categoryCheckboxes = Array.from(filterPopup.querySelectorAll('[id^="cat-"]'));
    const conditionCheckboxes = Array.from(filterPopup.querySelectorAll('[id^="cond-"]'));
    const sortSelect = document.getElementById('sortSelect');

    let jsNoResultsEl = null;
    function ensureJsNoResults() {
      if (!jsNoResultsEl) {
        jsNoResultsEl = document.createElement('p');
        jsNoResultsEl.id = 'noResultsJS';
        jsNoResultsEl.textContent = 'No items match your filters.';
        jsNoResultsEl.style.fontStyle = 'italic';
        jsNoResultsEl.style.color = '#666';
        const container = document.querySelector('.available-items') || document.querySelector('.borrow-grid');
        if (container) container.appendChild(jsNoResultsEl);
        jsNoResultsEl.style.display = 'none';
      }
      return jsNoResultsEl;
    }

    function hideTemplateNoResults(shouldHide) {
      if (!noResultsTemplate) return;
      noResultsTemplate.style.display = shouldHide ? 'none' : '';
    }
    window.hideTemplateNoResults = hideTemplateNoResults;

    function maybeShowJSNoResults(show) {
      const el = ensureJsNoResults();
      el.style.display = show ? '' : 'none';
      if (show) hideTemplateNoResults(true);
      else hideTemplateNoResults(false);
    }

    function applyFilters() {
      const selectedCats = categoryCheckboxes.filter(ch => ch.checked).map(ch => ch.value);
      const selectedConds = conditionCheckboxes.filter(ch => ch.checked).map(ch => ch.value);
      const sortVal = sortSelect ? sortSelect.value : 'recent';

      let anyVisible = false;
      const cards = itemCards.length ? itemCards : Array.from(document.querySelectorAll('.item-box, .item-card'));
      cards.forEach(card => {
        const cardCat = (card.getAttribute('data-category') || '').toLowerCase();
        const cardCond = (card.getAttribute('data-condition') || '').toLowerCase();

        let catOk = true;
        if (selectedCats.length) {
          catOk = selectedCats.includes(cardCat);
        }
        let condOk = true;
        if (selectedConds.length) {
          condOk = selectedConds.includes(cardCond);
        }

        let searchOk = true;
        if (searchInput && searchInput.value.trim()) {
          const term = searchInput.value.toLowerCase().trim();
          const itemName = (card.querySelector('.item-title')?.textContent || card.querySelector('h3')?.textContent || '').toLowerCase();
          const ownerName = (card.getAttribute('data-owner-name') || card.querySelector('.item-owner')?.textContent || '').toLowerCase();
          const description = (card.getAttribute('data-description') || card.querySelector('.item-description')?.textContent || '').toLowerCase();
          searchOk = itemName.includes(term) || ownerName.includes(term) || description.includes(term);
        }

        const visible = catOk && condOk && searchOk;
        card.style.display = visible ? '' : 'none';
        if (visible) anyVisible = true;
      });

      // --- Robust sorting: read multiple possible attributes and parse dates safely ---
      if (sortVal && (sortVal === 'recent' || sortVal === 'oldest')) {
        const grid = document.querySelector('.available-items.borrow-grid') || document.querySelector('.available-items') || document.querySelector('.borrow-grid');
        if (grid) {
          const visibleCards = Array.from(grid.querySelectorAll('.item-box, .item-card')).filter(n => n.style.display !== 'none');

          function getCardTimestamp(card) {
            // try dataset.createdAt, data-created-at, data-created_at, attribute, or .item-date inner text
            const candidates = [
              card.dataset.createdAt,
              card.getAttribute('data-created-at'),
              card.getAttribute('data-created_at'),
              card.getAttribute('data_created_at'),
              card.getAttribute('data_created-at'),
              (card.querySelector('.item-date') && card.querySelector('.item-date').textContent),
              (card.querySelector('.created-at') && card.querySelector('.created-at').textContent)
            ];
            for (let v of candidates) {
              if (!v) continue;
              const s = String(v).trim();
              if (!s) continue;
              const ts = Date.parse(s);
              if (!isNaN(ts)) return ts;
              // if looks like YYYY-MM-DD without time, Date.parse usually works; else try to normalize simple dates
              const maybeIso = s.replace(/\//g, '-'); // convert slashes to dashes
              const ts2 = Date.parse(maybeIso);
              if (!isNaN(ts2)) return ts2;
            }
            // fallback: return 0 so missing dates go to the bottom for "recent", top for "oldest" logic handled below
            return 0;
          }

          visibleCards.sort((a, b) => {
            const ta = getCardTimestamp(a);
            const tb = getCardTimestamp(b);

            // both 0 -> keep original order (stable)
            if (ta === 0 && tb === 0) return 0;
            if (ta === 0) return sortVal === 'recent' ? 1 : -1;
            if (tb === 0) return sortVal === 'recent' ? -1 : 1;

            return sortVal === 'recent' ? (tb - ta) : (ta - tb);
          });

          visibleCards.forEach(n => grid.appendChild(n));
        }
      }

      maybeShowJSNoResults(!anyVisible);
      hideTemplateNoResults(!anyVisible);
    }

    // small debounce helper for scroll/wheel/touchmove closing
    function debounce(fn, wait = 120) {
      let t = null;
      return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
      };
    }

    // Position popup BELOW the button (keeps your original logic but defensive)
    function openFilterPopup() {
      if (!filterBtn || !filterPopup) return;
      filterPopup.classList.add('active');
      filterPopup.style.display = 'flex';
      filterPopup.style.position = 'fixed';

      const rect = filterBtn.getBoundingClientRect();
      const margin = 8;

      // Position below the button
      const desiredTop = rect.bottom + margin;
      const desiredLeft = rect.left;

      // Measure popup dimensions (use min to avoid overflow)
      const popupW = Math.min(filterPopup.offsetWidth || 360, window.innerWidth - 40);
      const popupH = Math.min(filterPopup.offsetHeight || 600, window.innerHeight - desiredTop - 20);

      // Align with button's left edge
      let left = desiredLeft;

      // If popup would overflow right edge, align to right edge of button
      if (left + popupW > window.innerWidth - 20) {
        left = rect.right - popupW;
      }

      // Ensure it doesn't go off left edge
      left = Math.max(20, left);

      // Top position (below button), fallback above if not enough space
      let top = desiredTop;
      if (top + popupH > window.innerHeight - 20) {
        top = rect.top - popupH - margin;
        if (top < 20) top = 20;
      }

      filterPopup.style.left = `${Math.round(left)}px`;
      filterPopup.style.top = `${Math.round(top)}px`;
      filterPopup.style.right = 'auto';
      filterPopup.style.bottom = 'auto';
      filterPopup.setAttribute('aria-hidden', 'false');
    }

    function closeFilterPopup() {
      if (!filterPopup) return;
      filterPopup.classList.remove('active');
      filterPopup.style.display = 'none';
      filterPopup.setAttribute('aria-hidden', 'true');
    }

    // wire events
    if (filterBtn) {
      filterBtn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (!filterPopup) return;
        const isOpen = filterPopup.classList.contains('active');
        if (isOpen) closeFilterPopup();
        else openFilterPopup();
      });
    }
    if (filterClose) filterClose.addEventListener('click', function (e) { e.preventDefault(); closeFilterPopup(); });

    if (filterApplyBtn) {
      filterApplyBtn.addEventListener('click', function (e) {
        e.preventDefault();
        applyFilters();
        closeFilterPopup();
      });
    }

    if (filterClearBtn) {
      filterClearBtn.addEventListener('click', function (e) {
        e.preventDefault();
        categoryCheckboxes.forEach(ch => ch.checked = false);
        conditionCheckboxes.forEach(ch => ch.checked = false);
        if (sortSelect) sortSelect.value = 'recent';
        itemCards.forEach(c => c.style.display = '');
        maybeShowJSNoResults(false);
        hideTemplateNoResults(false);
      });
    }

    document.addEventListener('click', function (e) {
      if (!filterPopup) return;
      if (filterPopup.contains(e.target) || (filterBtn && filterBtn.contains(e.target))) return;
      closeFilterPopup();
    });

    // recalc position when layout changes, but only if popup is open
    window.addEventListener('resize', function () {
      if (filterPopup.classList.contains('active')) openFilterPopup();
    });

    // Close popup on scroll/wheel/touchmove (debounced)
    const closeOnScroll = debounce(function () {
      if (filterPopup && filterPopup.classList.contains('active')) {
        closeFilterPopup();
      }
    }, 120);

    window.addEventListener('scroll', closeOnScroll, { passive: true });
    window.addEventListener('wheel', closeOnScroll, { passive: true });
    window.addEventListener('touchmove', closeOnScroll, { passive: true });
    window.addEventListener('orientationchange', closeOnScroll);

    ensureJsNoResults();
    hideTemplateNoResults(false);
  })();
});
