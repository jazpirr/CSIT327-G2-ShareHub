// home-search.js
document.addEventListener('DOMContentLoaded', () => {
  const notificationBtn = document.querySelector('.notification-btn');
  const notificationPopup = document.getElementById('notificationPopup');
  const notificationOverlay = document.getElementById('notificationOverlay');
  const notificationClose = document.getElementById('closePopup');

  const filterBtn = document.querySelector('.search-filter-btn');
  const filterPopup = document.getElementById('filterPopup');
  const filterClose = document.getElementById('filterClose');
  const filterApplyBtn = document.getElementById('filterApplyBtn');
  const filterClearBtn = document.getElementById('filterClearBtn');

  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');

  const availableWrapper = document.querySelector('.available-items');
  const sortSelect = document.getElementById('sortSelect'); // may live inside the popup

  /* -----------------------------
     Popups / Notification handlers
     ----------------------------- */
  if (notificationBtn) {
    notificationBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notificationPopup?.classList.toggle('active');
      notificationOverlay?.classList.toggle('active');
      filterPopup?.classList.remove('active');
    });
  }

  notificationClose?.addEventListener('click', (e) => {
    e.stopPropagation();
    notificationPopup?.classList.remove('active');
    notificationOverlay?.classList.remove('active');
  });

  notificationOverlay?.addEventListener('click', () => {
    notificationPopup?.classList.remove('active');
    notificationOverlay.classList.remove('active');
  });

  notificationPopup?.addEventListener('click', (e) => e.stopPropagation());

  if (filterBtn && filterPopup) {
    filterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      filterPopup.classList.toggle('active');
      notificationPopup?.classList.remove('active');
      notificationOverlay?.classList.remove('active');
    });

    filterClose?.addEventListener('click', (e) => {
      e.stopPropagation();
      filterPopup.classList.remove('active');
    });

    filterPopup.addEventListener('click', (e) => e.stopPropagation());

    document.addEventListener('click', (e) => {
      const isClickInside = filterPopup.contains(e.target) || filterBtn.contains(e.target);
      if (!isClickInside) filterPopup.classList.remove('active');
    });
  }

  /* -----------------------------
     Search input handlers
     ----------------------------- */
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      if (searchClear)
        searchClear.style.display = e.target.value.trim().length > 0 ? 'flex' : 'none';
    });

    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        updateVisibility(); // immediate filter on Enter
      }
    });
  }

  searchClear?.addEventListener('click', (e) => {
    e.preventDefault();
    if (searchInput) searchInput.value = '';
    if (searchClear) searchClear.style.display = 'none';
    updateVisibility();
    searchInput?.focus();
  });

  if (!availableWrapper) return;

  let noItemsEl = availableWrapper.querySelector('.no-items');
  if (!noItemsEl) {
    noItemsEl = document.createElement('div');
    noItemsEl.className = 'no-items';
    noItemsEl.textContent = 'No available items right now.';
  }

  /* -----------------------------
     Utilities to read card data
     ----------------------------- */
  function readBoxData(box) {
    const title =
      (box.dataset.title || box.querySelector('.item-title')?.textContent || '')
        .trim()
        .toLowerCase();
    const cat =
      (box.dataset.cat || box.querySelector('.item-cat')?.textContent || '')
        .trim()
        .toLowerCase();
    const cond = (box.dataset.cond || box.dataset.condition || '').trim().toLowerCase();
    const available = (box.dataset.available || '').trim().toLowerCase();

    // Robust created-at reading (dataset or attributes)
    const createdAt =
      (box.dataset.createdAt || box.getAttribute('data-created-at') || box.getAttribute('data-created_at') || '').trim();

    return { title, cat, cond, available, createdAt };
  }

  function getSelectedFilters() {
    const cats = Array.from(
      document.querySelectorAll('.filter-option input[id^="cat-"]:checked')
    ).map((i) => i.value.toLowerCase());
    const conds = Array.from(
      document.querySelectorAll('.filter-option input[id^="cond-"]:checked')
    ).map((i) => i.value.toLowerCase());
    const avails = Array.from(
      document.querySelectorAll('.filter-option input[id^="avail-"]:checked')
    ).map((i) => i.value.toLowerCase());
    return { cats, conds, avails };
  }

  function matches(boxData, q, filters) {
    if (q) {
      const found =
        (boxData.title && boxData.title.includes(q)) ||
        (boxData.cat && boxData.cat.includes(q)) ||
        (boxData.cond && boxData.cond.includes(q));
      if (!found) return false;
    }
    if (filters.cats.length && !filters.cats.includes(boxData.cat)) return false;
    if (filters.conds.length && !filters.conds.includes(boxData.cond)) return false;
    if (filters.avails.length && boxData.available) {
      if (!filters.avails.includes(boxData.available)) return false;
    }
    return true;
  }

  /* -----------------------------
     Sorting (only triggered when Apply Filters clicked)
     ----------------------------- */
  function applySort(order = (sortSelect?.value || 'recent')) {
    const grid = availableWrapper;
    if (!grid) return;

    // only re-order currently visible boxes
    const visibleBoxes = Array.from(grid.querySelectorAll('.item-box')).filter(b => b.style.display !== 'none');
    if (!visibleBoxes.length) return;

    visibleBoxes.sort((a, b) => {
      // try common attribute names
      const aAttr = (a.getAttribute('data-created-at') || a.getAttribute('data-created_at') || a.dataset.createdAt || '').trim();
      const bAttr = (b.getAttribute('data-created-at') || b.getAttribute('data-created_at') || b.dataset.createdAt || '').trim();

      // fallback to visible .item-date text if attribute not present
      const aDateText = aAttr || (a.querySelector('.item-date')?.textContent || '').trim();
      const bDateText = bAttr || (b.querySelector('.item-date')?.textContent || '').trim();

      const aTs = aDateText ? Date.parse(aDateText) : NaN;
      const bTs = bDateText ? Date.parse(bDateText) : NaN;

      // push invalid/empty timestamps to the bottom
      if (isNaN(aTs) && isNaN(bTs)) return 0;
      if (isNaN(aTs)) return 1;
      if (isNaN(bTs)) return -1;

      return order === 'recent' ? (bTs - aTs) : (aTs - bTs);
    });

    // re-append in sorted order (only the visible ones)
    visibleBoxes.forEach(box => grid.appendChild(box));
  }

  /* -----------------------------
     Filtering / visibility update (does NOT auto-sort)
     ----------------------------- */
  function updateVisibility() {
    const q = (searchInput?.value || '').trim().toLowerCase();
    const filters = getSelectedFilters();
    const boxes = Array.from(availableWrapper.querySelectorAll('.item-box'));
    let shown = 0;

    boxes.forEach((box) => {
      const data = readBoxData(box);
      if (matches(data, q, filters)) {
        box.style.display = '';
        shown++;
      } else {
        box.style.display = 'none';
      }
    });

    if (shown === 0) {
      if (!availableWrapper.contains(noItemsEl)) availableWrapper.appendChild(noItemsEl);
    } else {
      if (availableWrapper.contains(noItemsEl)) availableWrapper.removeChild(noItemsEl);
    }

    // IMPORTANT: Do NOT call applySort() here.
    // Sorting will only run when user clicks "Apply Filters".
  }

  function debounce(fn, wait = 150) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  const debouncedUpdate = debounce(updateVisibility, 180);
  searchInput?.addEventListener('input', debouncedUpdate);

  /* -----------------------------
     Buttons: Apply / Clear
     ----------------------------- */
  filterApplyBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    // apply filters (visibility)
    updateVisibility();

    // close popup
    filterPopup?.classList.remove('active');

    // then apply sort using chosen value (sortSelect may be inside popup)
    applySort(sortSelect?.value || 'recent');
  });

  filterClearBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.filter-option input[type="checkbox"]').forEach((c) => (c.checked = false));
    if (searchInput) searchInput.value = '';
    if (searchClear) searchClear.style.display = 'none';

    // reset sort select to default if you want
    if (sortSelect) sortSelect.value = 'recent';

    updateVisibility();
    // optionally re-sort using default:
    applySort('recent');
  });

  /* -----------------------------
     Initial render
     ----------------------------- */
  updateVisibility();

  /* -----------------------------
     Debug helper - call window.__debugBorrow() in console
     ----------------------------- */
  window.__debugBorrow = () => {
    console.log('sortSelect.value =', sortSelect?.value);
    const boxes = Array.from(availableWrapper.querySelectorAll('.item-box'));
    console.table(boxes.map(b => ({
      title: (b.querySelector('.item-title')?.textContent || '').trim(),
      created_attr: b.getAttribute('data-created-at') || b.getAttribute('data-created_at') || '',
      dataset_created: b.dataset.createdAt || '',
      date_text: (b.querySelector('.item-date')?.textContent || '').trim()
    })));
  };
});
