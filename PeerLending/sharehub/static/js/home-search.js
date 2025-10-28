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


  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      if (searchClear)
        searchClear.style.display = e.target.value.trim().length > 0 ? 'flex' : 'none';
    });

    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        updateVisibility(); 
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
    return { title, cat, cond, available };
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
      if (!availableWrapper.contains(noItemsEl))
        availableWrapper.appendChild(noItemsEl);
    } else {
      if (availableWrapper.contains(noItemsEl))
        availableWrapper.removeChild(noItemsEl);
    }
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

    //buttons
  filterApplyBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    updateVisibility();
    filterPopup?.classList.remove('active');
  });


  filterClearBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    document
      .querySelectorAll('.filter-option input[type="checkbox"]')
      .forEach((c) => (c.checked = false));
    if (searchInput) searchInput.value = '';
    if (searchClear) searchClear.style.display = 'none';
    updateVisibility();
  });

  updateVisibility();
});
