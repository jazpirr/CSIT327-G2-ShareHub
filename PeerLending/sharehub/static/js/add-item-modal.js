// static/js/add-item-modal.js
// Copy-paste ready — single popup implementation, no duplicates.
// Requires popup.js to be loaded BEFORE this file (preferred).
// IDs expected in HTML: addItemModal, addItemForm, uploadArea, itemImage,
// errorPopup, errorOverlay, popupHeader, popupBody (popup.js markup).
// If popup.js isn't present, this falls back to DOM errorPopup or alert.

(function(){
  // ---- Popup helper IIFE (single source of truth) ----
  function _hideDomPopup() {
    try {
      const popup = document.getElementById('errorPopup');
      const overlay = document.getElementById('errorOverlay');
      if (popup) {
        popup.classList.remove('show');
        popup.setAttribute('aria-hidden','true');
        popup.style.pointerEvents = 'none';
        setTimeout(()=> {
          popup.style.display = 'none';
          const body = popup.querySelector('#popupBody') || popup.querySelector('.popup-body');
          if (body) body.innerHTML = '';
        }, 250);
      }
      if (overlay) {
        overlay.classList.remove('show');
        overlay.setAttribute('aria-hidden','true');
        overlay.style.pointerEvents = 'none';
        setTimeout(()=> { overlay.style.display = 'none'; }, 250);
      }
    } catch (e) { console.warn('hideDomPopup error', e); }
  }

  window.closeActionPopup = function closeActionPopup() {
    try {
      _hideDomPopup();
    } catch(e){ console.warn('closeActionPopup error', e); }

    // hide addItem-specific overlay/popup if present
    try {
      const addOv = document.getElementById('addItemOverlay');
      const addPop = document.getElementById('addItemPopup');
      if (addPop) { addPop.classList.remove('show'); addPop.style.pointerEvents='none'; setTimeout(()=>addPop.style.display='none',200); }
      if (addOv) { addOv.classList.remove('show'); addOv.style.pointerEvents='none'; setTimeout(()=>addOv.style.display='none',200); }
    } catch(e){}
  };

  window.showAddItemPopup = function showAddItemPopup(message, isSuccess = true) {
    // prefer shared API (popup.js)
    if (window.showMessagePopup) {
      const title = isSuccess ? 'Success!' : 'Error';
      const autoCloseMs = isSuccess ? 3000 : 0;
      window.showMessagePopup(title, message, { autoCloseMs });
      return;
    }

    // DOM fallback using errorPopup / errorOverlay
    const popup = document.getElementById('errorPopup');
    const overlay = document.getElementById('errorOverlay');
    const header = document.getElementById('popupHeader');
    const body = document.getElementById('popupBody');

    if (!popup || !overlay || !header || !body) {
      try { alert((isSuccess ? 'Success: ' : 'Error: ') + message); } catch(e){ console.log(message); }
      return;
    }

    try {
      header.textContent = isSuccess ? 'Success!' : 'Error';
      body.innerText = (typeof message === 'string') ? message : JSON.stringify(message);

      overlay.style.display = 'block';
      setTimeout(()=>{ overlay.classList.add('show'); overlay.setAttribute('aria-hidden','false'); overlay.style.pointerEvents='auto'; }, 10);

      popup.style.display = 'flex';
      setTimeout(()=>{ popup.classList.add('show'); popup.style.pointerEvents='auto'; popup.setAttribute('aria-hidden','false'); }, 10);

      const closeBtn = popup.querySelector('.close-btn');
      if (closeBtn) closeBtn.onclick = () => { window.closeActionPopup(); };

      if (isSuccess) setTimeout(()=>{ window.closeActionPopup(); }, 3000);
    } catch(e) {
      console.error('showAddItemPopup error', e);
      try { alert((isSuccess ? 'Success: ' : 'Error: ') + message); }catch(_) {}
    }
  };

  window.showActionPopupWithType = function(headerText, messages, type) {
    const text = Array.isArray(messages) ? messages.join('\n') : String(messages || headerText || '');
    const isSuccess = String(headerText||'').toLowerCase().includes('success') || type === 'success';
    window.showAddItemPopup(text, isSuccess);
  };
})();

document.addEventListener('DOMContentLoaded', function () {
  const openModalBtn = document.querySelector('.add-item-btn');
  const modal = document.getElementById('addItemModal');            // overlay modal
  const cancelBtn = document.getElementById('cancelAddItem');
  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('itemImage');

  const actionOverlay = document.getElementById('actionOverlay') || document.getElementById('errorOverlay');
  const actionPopup   = document.getElementById('actionPopup')   || document.getElementById('errorPopup');

  let addItemForm = document.getElementById('addItemForm') || (modal ? modal.querySelector('form') : null);

  function resetFileInputUI() {
    try { if (fileInput) fileInput.value = ''; } catch (_) {}
    if (!uploadArea) return;
    const preview = uploadArea.querySelector('.image-preview');
    if (preview) preview.remove();
    const uploadIcon = uploadArea.querySelector('.upload-icon');
    const uploadText = uploadArea.querySelector('.upload-text');
    const uploadSubtext = uploadArea.querySelector('.upload-subtext');
    if (uploadIcon) uploadIcon.style.display = 'block';
    if (uploadText) uploadText.textContent = 'Click to upload image';
    if (uploadSubtext) uploadSubtext.textContent = 'PNG, JPG up to 10MB';
  }

  function safeResetForm() {
    try { if (addItemForm) addItemForm.reset(); } catch (_) {}
    resetFileInputUI();
  }

  if (openModalBtn && modal) {
    openModalBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      modal.classList.add('active');
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (modal) {
        modal.classList.remove('active');
        modal.style.display = '';
      }
      document.body.style.overflow = '';
      safeResetForm();
    });
  }

  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) {
        modal.classList.remove('active');
        modal.style.display = '';
        document.body.style.overflow = '';
        safeResetForm();
      }
    });
  }

  if (uploadArea) {
    uploadArea.addEventListener('click', () => { if (fileInput) fileInput.click(); });

    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = '#7a0019';
      uploadArea.style.background = 'rgba(122,0,25,0.04)';
    });

    uploadArea.addEventListener('dragleave', () => {
      uploadArea.style.borderColor = '#ddd';
      uploadArea.style.background = '';
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = '#ddd';
      uploadArea.style.background = '';
      const f = (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) ? e.dataTransfer.files[0] : null;
      if (f) handleFileSelect(f);
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) handleFileSelect(e.target.files[0]);
    });
  }

  let selectedFile = null;
  function handleFileSelect(file) {
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      window.showActionPopupWithType && window.showActionPopupWithType('Invalid file', ['Please select PNG or JPG image.'], 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      window.showActionPopupWithType && window.showActionPopupWithType('File too large', ['Image must be smaller than 10MB.'], 'error');
      return;
    }
    selectedFile = file;

    const reader = new FileReader();
    reader.onload = function (ev) {
      const existing = uploadArea.querySelector('.image-preview');
      if (existing) existing.remove();

      const uploadIcon = uploadArea.querySelector('.upload-icon');
      const uploadText = uploadArea.querySelector('.upload-text');
      const uploadSubtext = uploadArea.querySelector('.upload-subtext');
      if (uploadIcon) uploadIcon.style.display = 'none';
      if (uploadText) uploadText.textContent = 'Image Selected';
      if (uploadSubtext) uploadSubtext.textContent = file.name;

      const previewContainer = document.createElement('div');
      previewContainer.className = 'image-preview';
      const img = document.createElement('img');
      img.src = ev.target.result;
      img.alt = 'Selected item image';
      img.style.maxWidth = '220px';
      img.style.maxHeight = '160px';
      img.style.display = 'block';
      img.style.borderRadius = '8px';
      img.style.marginBottom = '8px';

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'remove-image';
      removeBtn.textContent = 'Remove Image';
      removeBtn.style.marginTop = '4px';
      removeBtn.addEventListener('click', function (ev2) {
        ev2.stopPropagation();
        selectedFile = null;
        resetFileInputUI();
      });

      previewContainer.appendChild(img);
      previewContainer.appendChild(removeBtn);
      uploadArea.appendChild(previewContainer);
    };
    reader.readAsDataURL(file);
  }

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  function getSubmitBtn(formElem) {
    return document.querySelector('button[form="addItemForm"], .btn-add') || (formElem ? formElem.querySelector('button[type="submit"]') : null);
  }

  async function submitAddItemToServer(formData) {
    const csrftoken = getCookie('csrftoken');
    const resp = await fetch('/add-item/', {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRFToken': csrftoken
      },
      body: formData
    });
    let data;
    try { data = await resp.json(); } catch (err) { throw new Error('Invalid JSON from server'); }
    if (!resp.ok) {
      const msg = (data && data.errors) ? JSON.stringify(data.errors) : 'Server error';
      const err = new Error(msg);
      err._serverData = data;
      throw err;
    }
    return data;
  }

  // ===== add-item popup (UI for form validation/result) =====
  // This uses window.showAddItemPopup (above) or popup.js showMessagePopup when available.
  let handlersAttached = false;

  function attachHandlers(formElem) {
    if (!formElem) return;
    if (handlersAttached) return;
    handlersAttached = true;

    const submitBtn = getSubmitBtn(formElem) || formElem.querySelector('button[type="submit"]');

    formElem.addEventListener('submit', async function (e) {
      e.preventDefault();

      const itemName = (document.getElementById('itemName') || {}).value?.trim?.() || '';
      const category = (document.getElementById('itemCategory') || {}).value || '';
      const condition = (document.getElementById('itemCondition') || {}).value || '';
      const description = (document.getElementById('itemDescription') || {}).value?.trim?.() || '';

      if (!itemName) {
          window.showAddItemPopup('Please fill in the Item Name field.', false);
          return;
      }
      if (!category || category === 'Select Category') {
          window.showAddItemPopup('Please select a Category.', false);
          return;
      }
      if (!condition || condition === 'Select Condition') {
          window.showAddItemPopup('Please select a Condition.', false);
          return;
      }
      if (!description) {
          window.showAddItemPopup('Please fill in the Description field.', false);
          return;
      }
      if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
          window.showAddItemPopup('Please upload an image of the item.', false);
          return;
      }

      const btn = submitBtn;
      const origText = btn ? btn.innerHTML : null;
      if (btn) {
        btn.disabled = true;
        btn.classList.add('btn-spinner');
        btn.innerHTML = '<span class="spinner"></span> Adding...';
      }

      try {
        const formData = new FormData();
        formData.append('itemName', itemName);
        formData.append('category', category);
        formData.append('condition', condition);
        formData.append('description', description);
        const availRadio = document.querySelector('input[name="availability"]:checked');
        formData.append('availability', availRadio ? availRadio.value : 'available');
        if (fileInput && fileInput.files && fileInput.files.length > 0) {
            formData.append('image', fileInput.files[0], fileInput.files[0].name);
        } else if (selectedFile) {
            formData.append('image', selectedFile, selectedFile.name);
        }

        const result = await submitAddItemToServer(formData);

        if (result && result.success) {
            if (modal) {
                modal.classList.remove('active');
                modal.style.display = '';
                document.body.style.overflow = '';
            }

            safeResetForm();

            // show success popup (will auto-close)
            window.showAddItemPopup('Your item has been added successfully and is now available for borrowing!', true);

        } else {
            window.showActionPopupWithType && window.showActionPopupWithType('Unexpected Response', ['Unexpected server response.'], 'error');
            console.error('Unexpected response', result);
        }

      } catch (err) {
        let serverData = err._serverData || null;
        const messages = [];

        if (serverData && serverData.errors) {
          for (const field of Object.keys(serverData.errors)) {
            (serverData.errors[field] || []).forEach(o => {
              messages.push(o.message || JSON.stringify(o));
            });
          }
        } else {
          try {
            const parsed = JSON.parse(err.message);
            if (parsed && parsed.errors) {
              for (const f of Object.keys(parsed.errors)) (parsed.errors[f] || []).forEach(o => messages.push(o.message || JSON.stringify(o)));
            } else {
              messages.push(err.message || 'Server error');
            }
          } catch (_) {
            messages.push(err.message || 'Network or server error');
          }
        }

        window.showActionPopupWithType && window.showActionPopupWithType('Error', messages.length ? messages : ['Something went wrong.'], 'error');
        console.error('Add item error:', err);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.classList.remove('btn-spinner');
          btn.innerHTML = origText;
        }
      }
    });
  }

  if (addItemForm) {
    attachHandlers(addItemForm);
  } else if (modal) {
    const mo = new MutationObserver((mutations, observer) => {
      const f = document.getElementById('addItemForm') || modal.querySelector('form');
      if (f) {
        addItemForm = f;
        attachHandlers(f);
        observer.disconnect();
      }
    });
    mo.observe(modal, { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 5000);
  }

  window.safeResetAddItemForm = safeResetForm;

  // debug
  console.log('ADD-MODAL: ready, modal?', !!modal, 'form?', !!addItemForm, 'showMessagePopup?', !!window.showMessagePopup, 'showAddItemPopup?', !!window.showAddItemPopup);
});
