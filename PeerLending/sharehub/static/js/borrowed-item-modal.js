// borrowed-item-modal.js
(function() {
  const modal = document.getElementById('borrowedItemModal');
  if (!modal) return;

  const closeBtn = document.getElementById('closeBorrowedModal');

  const titleEl = document.getElementById('borrowedModalItemName');
  const ownerEl = document.getElementById('borrowedModalOwner');
  const descEl = document.getElementById('borrowedModalDescription');
  const borrowDateEl = document.getElementById('borrowedModalBorrowDate');
  const returnDateEl = document.getElementById('borrowedModalReturnDate');
  const statusEl = document.getElementById('borrowedModalStatus');

  // image nodes
  const imgEl = document.getElementById('borrowedModalImage');
  const imgPlaceholder = document.getElementById('borrowedModalImagePlaceholder');

  function readField(item, ...keys) {
    for (const k of keys) {
      if (item.dataset[k] && item.dataset[k].trim() !== '') return item.dataset[k].trim();
    }
    return '';
  }

  function formatDateField(raw) {
    if (!raw) return '—';
    const d = new Date(raw);
    if (isNaN(d)) {
      return raw;
    }
    const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${datePart} • ${timePart}`;
  }

  document.querySelectorAll('.borrowed-item').forEach(item => {
    item.style.cursor = 'pointer';
    item.addEventListener('click', () => {
      const title = readField(item, 'itemTitle', 'title', 'name');
      const owner = readField(item, 'itemOwner', 'owner', 'ownerName');
      const imageSrc = readField(item, 'itemImage', 'image', 'itemImageUrl');
      const desc = readField(item, 'description', 'itemDescription');

      const borrowHuman = readField(item, 'borrowDateHuman', 'borrowDate');
      const returnHuman = readField(item, 'returnDateHuman', 'returnDate');

      const status = readField(item, 'status', 'state');

      titleEl.textContent = title || '—';
      ownerEl.textContent = owner || '—';
      descEl.textContent = desc || 'No description provided';

      borrowDateEl.textContent = (item.dataset.borrowDateHuman && item.dataset.borrowDateHuman.trim() !== '')
                                   ? item.dataset.borrowDateHuman.trim()
                                   : formatDateField(readField(item, 'borrowDate'));
      returnDateEl.textContent = (item.dataset.returnDateHuman && item.dataset.returnDateHuman.trim() !== '')
                                   ? item.dataset.returnDateHuman.trim()
                                   : formatDateField(readField(item, 'returnDate'));

      statusEl.textContent = status || 'Borrowed';

      if (imageSrc) {
        imgEl.src = imageSrc;
        imgEl.style.display = 'block';
        imgPlaceholder.style.display = 'none';
        imgEl.onerror = function() {
          imgEl.style.display = 'none';
          imgPlaceholder.style.display = 'block';
          imgEl.onerror = null;
        };
      } else {
        imgEl.style.display = 'none';
        imgPlaceholder.style.display = 'block';
      }

      modal.style.display = 'flex';
      document.documentElement.style.overflow = 'hidden';
    });
  });

  closeBtn && closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    document.documentElement.style.overflow = '';
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
      document.documentElement.style.overflow = '';
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'flex') {
      modal.style.display = 'none';
      document.documentElement.style.overflow = '';
    }
  });

})();
