document.addEventListener('DOMContentLoaded', function () {
  const openModalBtn = document.querySelector('.add-item-btn');
  const modal = document.getElementById('addItemModal');            // overlay modal
  const cancelBtn = document.getElementById('cancelAddItem');
  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('itemImage');

  // re-declare these so other parts of the file that still reference them won't error
  const actionOverlay = document.getElementById('actionOverlay') || document.getElementById('errorOverlay');
  const actionPopup   = document.getElementById('actionPopup')   || document.getElementById('errorPopup');

  let addItemForm = document.getElementById('addItemForm') || (modal ? modal.querySelector('form') : null);

  function _showOverlay() {
    if (!actionOverlay) return;
    actionOverlay.classList.add('show');
  }
  function _hideOverlay() {
    if (!actionOverlay) return;
    actionOverlay.classList.remove('show');
  }

  // ------ Popup integration (use the shared popup.js API when available) ------

  function _joinMessages(messages) {
    if (!messages && messages !== 0) return '';
    if (Array.isArray(messages)) return messages.join('\n');
    return String(messages);
  }

  function showActionPopup(headerText, messages) {
    const msg = _joinMessages(messages);
    // prefer the shared popup API
    if (window.showMessagePopup) {
      // auto-close success messages after 2.5s; errors stay until user closes
      const autoClose = headerText && String(headerText).toLowerCase().includes('success') ? 2500 : 0;
      window.showMessagePopup(headerText || 'Message', msg, { autoCloseMs: autoClose });
      return;
    }
    // fallback to alert if shared popup isn't loaded for any reason
    alert((headerText ? headerText + '\n\n' : '') + msg);
  }

  function closeActionPopup() {
    // try to use the popup close button if it exists (popup.js wired it)
    const closeBtn = document.querySelector('#errorPopup .close-btn, #actionPopup .close-btn, .close-btn');
    if (closeBtn) {
      try { closeBtn.click(); return; } catch (e) {}
    }

    // fallback: hide known popup nodes manually
    const popup = document.getElementById('errorPopup') || document.getElementById('actionPopup');
    const overlay = document.getElementById('errorOverlay') || document.getElementById('actionOverlay');
    if (popup) {
      popup.classList.remove('show');
      popup.style.display = 'none';
      popup.style.pointerEvents = 'none';
    }
    if (overlay) {
      overlay.classList.remove('show');
      overlay.style.pointerEvents = 'none';
    }
  }

  function showActionPopupWithType(headerText, messages, type) {
    // popup.js handles any header styling; just forward text
    showActionPopup(headerText, messages);
  }


  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (actionPopup && actionPopup.classList.contains('show')) closeActionPopup();
      if (modal && modal.classList.contains('active')) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        safeResetForm();
      }
    }
  });

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
    openModalBtn.addEventListener('click', function () {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', function () {
      if (modal) modal.classList.remove('active');
      document.body.style.overflow = '';
      safeResetForm();
    });
  }

  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) {
        modal.classList.remove('active');
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
      showActionPopupWithType('Invalid file', ['Please select PNG or JPG image.'], 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showActionPopupWithType('File too large', ['Image must be smaller than 10MB.'], 'error');
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

  // ===== SUCCESS/ERROR POPUP FUNCTIONS =====
function showAddItemPopup(message, isSuccess = true) {
    const overlay = document.getElementById('addItemOverlay');
    const popup = document.getElementById('addItemPopup');
    const title = document.getElementById('addItemPopupTitle');
    const msgBody = document.getElementById('addItemPopupMessage');
    const closeBtn = document.getElementById('addItemCloseBtn');
    
    if (!overlay || !popup) return;
    
    // Set title and message
    title.textContent = isSuccess ? 'Success!' : 'Error!';
    msgBody.textContent = message;
    
    // Toggle error/success styling
    if (isSuccess) {
        popup.classList.remove('error');
        popup.classList.add('success');
    } else {
        popup.classList.add('error');
        popup.classList.remove('success');
    }
    
    // Show popup
    overlay.classList.add('show');
    
    // Close button handler
    closeBtn.onclick = () => {
        overlay.classList.remove('show');
        
        // If success, reload or redirect
        if (isSuccess) {
            setTimeout(() => {
                window.location.reload();
            }, 300);
        }
    };
    
    // Auto-close success messages after 3 seconds
    if (isSuccess) {
        setTimeout(() => {
            if (overlay.classList.contains('show')) {
                overlay.classList.remove('show');
                setTimeout(() => {
                    window.location.reload();
                }, 300);
            }
        }, 3000);
    }
}

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

      // ===== CUSTOM VALIDATION WITH CUSTOM POPUP =====
      if (!itemName) {
          showAddItemPopup('Please fill in the Item Name field.', false);
          return;
      }
      if (!category || category === 'Select Category') {
          showAddItemPopup('Please select a Category.', false);
          return;
      }
      if (!condition || condition === 'Select Condition') {
          showAddItemPopup('Please select a Condition.', false);
          return;
      }
      if (!description) {
          showAddItemPopup('Please fill in the Description field.', false);
          return;
      }
      if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
          showAddItemPopup('Please upload an image of the item.', false);
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
            document.body.style.overflow = '';
        }

        safeResetForm();
        
        // ===== NEW: Show custom confirmation popup =====
        showAddItemPopup('Your item has been added successfully and is now available for borrowing!', true);

    } else {
        showActionPopupWithType('Unexpected Response', ['Unexpected server response.'], 'error');
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

        showActionPopupWithType('Error', messages.length ? messages : ['Something went wrong.'], 'error');
        console.error('Add item error:', err);
      } finally {
        // restore btn
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

 //debug
  console.log('ADD-MODAL: ready, modal?', !!modal, 'form?', !!addItemForm, 'popup?', !!actionPopup, 'overlay?', !!actionOverlay);
});
