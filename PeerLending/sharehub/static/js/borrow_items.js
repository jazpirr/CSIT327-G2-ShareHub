// static/js/borrow_items.js
document.addEventListener('DOMContentLoaded', function() {
  // DOM refs
  const requestButtons = Array.from(document.querySelectorAll('.request-btn'));
  const borrowModal = document.getElementById('borrowModal');
  const cancelBorrowBtn = document.getElementById('cancelBorrow');
  const borrowForm = document.getElementById('borrowForm');
  const modalItemName = document.getElementById('modalItemName');
  const modalOwnerName = document.getElementById('modalOwnerName');
  const borrowStartEl = document.getElementById('borrowStart');
  const borrowEndEl = document.getElementById('borrowEnd');

  // Modal elements
  const modalImage = document.getElementById('modalImage');
  const modalImagePlaceholder = document.getElementById('modalImagePlaceholder');
  const modalCategory = document.getElementById('modalCategory');
  const modalCondition = document.getElementById('modalCondition');
  const modalDescription = document.getElementById('modalDescription');
  const modalItemIdInput = document.getElementById('modalItemId');

  // Two-state modal elements
  const modalDetailsView = document.getElementById('modalDetailsView');
  const modalRequestView = document.getElementById('modalRequestView');
  const showRequestFormBtn = document.getElementById('showRequestForm');
  const backToDetailsBtn = document.getElementById('backToDetails');
  const sendRequestBtn = document.getElementById('sendRequestBtn');
  const modalTitle = document.getElementById('modalTitle');
  const modalSubtitle = document.getElementById('modalSubtitle');
  
  // Duplicate fields in request view
  const modalItemName2 = document.getElementById('modalItemName2');
  const modalOwnerName2 = document.getElementById('modalOwnerName2');
  const modalCategory2 = document.getElementById('modalCategory2');
  const modalCondition2 = document.getElementById('modalCondition2');

  // config provided by template
  const REQUEST_BORROW_URL = window.REQUEST_BORROW_URL || '/request-borrow/';

  let currentItem = null;
  let cameFromDetailsView = false; // Track if user came from details view

  // shared popups (fallbacks)
  const showMessagePopup = window.showMessagePopup || ((t,m,o={}) => alert(m));
  const showConfirmPopup = window.showConfirmPopup || (async (t,m,yl,nl) => confirm(m));

  // -----------------------
  // Helpers
  // -----------------------
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

  function closeBorrowModal() {
    hideBorrowModal();
    resetBorrowForm();
    resetModalToDetailsView();
    currentItem = null;
    cameFromDetailsView = false;
  }

  function resetBorrowForm() {
    if (!borrowForm) return;
    borrowForm.reset();
  }

  function getCookie(name) {
    const v = `; ${document.cookie}`;
    const parts = v.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
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
      const iso = d => d.toISOString().slice(0,10);
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

  // -----------------------
  // Wire click handlers
  // -----------------------
  document.querySelectorAll('.item-box').forEach(function(card) {
    card.addEventListener('click', function(ev) {
      const t = ev.target;
      if (t && (t.tagName === 'BUTTON' || t.closest('button'))) {
        return;
      }
      openBorrowModalFromElement(card, false);
    });
  });

  requestButtons.forEach(button => {
    button.addEventListener('click', function(ev) {
      ev.stopPropagation();
      openBorrowModalFromElement(this, true);
    });
  });

  if (showRequestFormBtn) {
    showRequestFormBtn.addEventListener('click', function(e) {
      e.preventDefault();
      cameFromDetailsView = true;
      showRequestFormView();
    });
  }

  if (backToDetailsBtn) {
    backToDetailsBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (cameFromDetailsView) resetModalToDetailsView();
      else closeBorrowModal();
    });
  }

  if (cancelBorrowBtn) cancelBorrowBtn.addEventListener('click', closeBorrowModal);
  if (borrowModal) {
    borrowModal.addEventListener('click', function(e) {
      if (e.target === borrowModal) closeBorrowModal();
    });
  }
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && borrowModal && borrowModal.classList.contains('active')) {
      closeBorrowModal();
    }
  });

  // -----------------------
  // Submit borrow form -> POST to Django endpoint
  // -----------------------
  if (borrowForm) {
    borrowForm.addEventListener('submit', async function(e) {
      e.preventDefault();

      const startDate = borrowStartEl ? borrowStartEl.value : null;
      const endDate = borrowEndEl ? borrowEndEl.value : null;

      if (!startDate || !endDate) {
        showMessagePopup('Missing Dates', 'Please select both start and return dates.', {autoCloseMs: 3000});
        return;
      }

      const startTs = new Date(startDate);
      const endTs = new Date(endDate);

      if (isNaN(startTs.getTime()) || isNaN(endTs.getTime())) {
        showMessagePopup('Invalid Dates', 'Invalid dates. Please use the date picker.', {autoCloseMs: 3000});
        return;
      }

      if (endTs <= startTs) {
        showMessagePopup('Date Error', 'Return date must be after the start date.', {autoCloseMs: 3000});
        return;
      }

      if (!currentItem || !currentItem.item_id) {
        showMessagePopup('Missing Item', 'Missing item. Try again.', {autoCloseMs: 3000});
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
          showMessagePopup('Request Sent', successMsg, { autoCloseMs: 3000 });

          try {
            const btn = currentItem.element.querySelector('.request-btn');
            if (btn) {
              btn.textContent = 'Request Sent';
              btn.disabled = true;
              btn.style.background = '#999';
              btn.style.cursor = 'not-allowed';
            }
          } catch (e) {}

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
          showMessagePopup('Error', msg, { autoCloseMs: 4000 });
        }
      } catch (err) {
        console.error(err);
        showMessagePopup('Network Error', 'Network error. Please try again.', { autoCloseMs: 4000 });
      } finally {
        if (submitBtn) { 
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
          submitBtn.classList.remove('btn-spinner');
        }
      }
    });
  }

  // -----------------------
  // Optional: search filtering
  // -----------------------
  const searchInput = document.querySelector('.search-input');
  const itemCards = document.querySelectorAll('.item-box, .item-card');
  if (searchInput && itemCards) {
    searchInput.addEventListener('input', function() {
      const searchTerm = this.value.toLowerCase().trim();
      itemCards.forEach(card => {
        const itemName = (card.querySelector('.item-title')?.textContent || card.querySelector('h3')?.textContent || '').toLowerCase();
        const ownerName = (card.getAttribute('data-owner-name') || card.querySelector('.item-owner')?.textContent || '').toLowerCase();
        const description = (card.getAttribute('data-description') || card.querySelector('.item-description')?.textContent || '').toLowerCase();
        const matches = itemName.includes(searchTerm) || ownerName.includes(searchTerm) || description.includes(searchTerm);
        card.style.display = matches ? '' : 'none';
      });
    });
  }
});
