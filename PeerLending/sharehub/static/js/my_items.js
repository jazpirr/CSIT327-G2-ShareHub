// Helpers
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let c of cookies) {
      const cookie = c.trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}
const csrftoken = getCookie('csrftoken');

function updateStatCount(elId, delta) {
  const el = document.getElementById(elId);
  if (!el) return;
  const current = parseInt(el.textContent) || 0;
  el.textContent = Math.max(0, current + delta);
}

function findCardByRequest(reqEl) {
  return reqEl.closest('.item-card-enhanced');
}

// Filter functionality
document.addEventListener('DOMContentLoaded', function() {
  const filterButtons = document.querySelectorAll('.filter-toggle-btn');
  const itemCards = document.querySelectorAll('.item-card-enhanced');

  filterButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      const filter = this.dataset.filter;
      
      // Update active button
      filterButtons.forEach(b => b.classList.remove('active'));
      this.classList.add('active');

      // Filter items
      itemCards.forEach(card => {
        const raw = card.getAttribute('data-status') || '';
        const status = String(raw).replace(/\s+/g, ' ').trim().toLowerCase();

        if (filter === 'all') {
          card.style.display = 'block';
        } else if (filter === status) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  // Initialize pending count from DOM
  try {
    const badges = document.querySelectorAll('.requests-count-badge');
    let totalPending = 0;
    badges.forEach(b => { totalPending += parseInt(b.textContent) || 0; });
    const pendingStat = document.getElementById('pendingCount');
    if (pendingStat && (!pendingStat.textContent || parseInt(pendingStat.textContent) !== totalPending)) {
      pendingStat.textContent = totalPending;
    }
  } catch (e) {
    console.error('Error normalizing pending stat', e);
  }
});

// Respond to request (approve/deny)
async function respondRequest(requestId, action, elButton) {
  // This should match your Django URL pattern
  const url = "/api/respond-request/"; // Update this to match your actual URL
  
  try {
    elButton.disabled = true;
    const originalHTML = elButton.innerHTML;
    elButton.innerHTML = action === 'approve' ? 'Approving...' : 'Denying...';

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrftoken,
        'Accept': 'application/json',
      },
      body: JSON.stringify({ request_id: requestId, action: action })
    });

    const data = await resp.json();

    if (resp.ok && data.success) {
      const reqEl = document.getElementById('req-' + requestId);
      if (reqEl) {
        reqEl.style.transition = 'all 0.25s ease';
        reqEl.style.opacity = '0';
        reqEl.style.transform = 'translateX(20px)';
        setTimeout(() => {
          const card = findCardByRequest(reqEl);
          const itemId = reqEl.dataset.itemId || (card && card.dataset.itemId);
          
          if (card) {
            const perCardBadge = card.querySelector('.requests-count-badge');
            if (perCardBadge) {
              const current = parseInt(perCardBadge.textContent) || 0;
              const updated = Math.max(0, current - 1);
              if (updated > 0) {
                perCardBadge.textContent = updated;
              } else {
                perCardBadge.remove();
              }
            }
            
            const requestsBadge = card.querySelector('.requests-badge');
            if (requestsBadge) {
              const cur = parseInt(requestsBadge.textContent) || 0;
              const newv = Math.max(0, cur - 1);
              if (newv > 0) {
                requestsBadge.textContent = newv;
              } else {
                const requestsSection = card.querySelector('.requests-section-enhanced');
                if (requestsSection) {
                  requestsSection.innerHTML = `
                    <div class="no-requests-state">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M8 15h8M9 9h.01M15 9h.01"/>
                      </svg>
                      <p>No pending requests</p>
                    </div>
                  `;
                }
              }
            }
          }

          updateStatCount('pendingCount', -1);

          if (action === 'approve' && card) {
            const prevStatus = (card.dataset.status || '').toLowerCase();
            if (prevStatus === 'available') {
              updateStatCount('availableCount', -1);
            }
            card.dataset.status = 'borrowed';
            const statusBadge = card.querySelector('.status-badge-floating');
            if (statusBadge) {
              statusBadge.classList.remove('available','returned');
              statusBadge.classList.add('borrowed');
              statusBadge.innerHTML = `
                <svg viewBox="0 0 8 8" fill="currentColor">
                  <circle cx="4" cy="4" r="4"/>
                </svg>
                Borrowed
              `;
            }
          }

          reqEl.remove();
        }, 260);
      } else {
        window.location.reload();
      }
    } else {
      const msg = (data && data.errors) ? JSON.stringify(data.errors) : (data.message || 'Action failed');
      if (typeof showMessagePopup === 'function') {
        showMessagePopup('Action failed', msg, { type: 'error', autoCloseMs: 5000 });
      } else {
        alert('Failed: ' + msg);
      }
      elButton.disabled = false;
      elButton.innerHTML = originalHTML;
    }
  } catch (err) {
    console.error(err);
    if (typeof showMessagePopup === 'function') {
      showMessagePopup('Network error', 'Network error while processing action.', { type: 'error', autoCloseMs: 5000 });
    } else {
      alert('Network error');
    }
    elButton.disabled = false;
    elButton.innerHTML = action === 'approve' ? 'Approve' : 'Deny';
  }
}

// Delegate click for approve / deny buttons
document.addEventListener('click', function(e) {
  const approveBtn = e.target.closest('.btn-approve-new');
  const denyBtn = e.target.closest('.btn-deny-new');

  if (approveBtn) {
    const requestId = approveBtn.dataset.requestId;
    respondRequest(requestId, 'approve', approveBtn);
  } else if (denyBtn) {
    const requestId = denyBtn.dataset.requestId;
    respondRequest(requestId, 'deny', denyBtn);
  }
});

// Delete item functionality
async function deleteItem(itemId, btnEl) {
  let confirmed = false;
  if (typeof showConfirmPopup === 'function') {
    try {
      confirmed = await showConfirmPopup('Delete this item?', 'This action cannot be undone.', 'Delete', 'Cancel');
    } catch (e) {
      confirmed = false;
    }
  } else {
    confirmed = confirm('Delete this item? This action cannot be undone.');
  }
  if (!confirmed) return;

  try {
    btnEl.disabled = true;
    const original = btnEl.innerHTML;
    btnEl.innerHTML = "Deleting...";

    // This should match your Django URL pattern
    const deleteUrl = `/items/delete/${itemId}/`; // Update this to match your actual URL

    const resp = await fetch(deleteUrl, {
      method: 'POST',
      headers: {
        'X-CSRFToken': csrftoken,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      credentials: 'same-origin',
      body: JSON.stringify({})
    });

    const data = await resp.json().catch(() => ({}));
    if (resp.ok && data.success) {
      const card = document.querySelector(`.item-card-enhanced[data-item-id="${itemId}"]`);
      if (card) {
        card.style.transition = 'all 0.25s ease';
        card.style.opacity = '0';
        card.style.transform = 'translateY(8px)';
        setTimeout(() => card.remove(), 260);
      } else {
        window.location.reload();
      }

      updateStatCount('totalItems', -1);
      if (data.decrement_available) updateStatCount('availableCount', -1);
      if (data.decrement_pending) updateStatCount('pendingCount', -data.decrement_pending);

      if (typeof showMessagePopup === 'function') {
        showMessagePopup('Deleted', 'Item deleted successfully.', { type: 'success', autoCloseMs: 2400 });
      }
    } else {
      const msg = (data && (data.message || data.error)) ? (data.message || data.error) : 'Delete failed';
      if (typeof showMessagePopup === 'function') {
        showMessagePopup('Delete failed', msg, { type: 'error', autoCloseMs: 5000 });
      } else {
        alert('Delete failed: ' + msg);
      }
      btnEl.disabled = false;
      btnEl.innerHTML = original;
    }
  } catch (err) {
    console.error(err);
    if (typeof showMessagePopup === 'function') {
      showMessagePopup('Network error', 'Network error while deleting item', { type: 'error', autoCloseMs: 5000 });
    } else {
      alert('Network error while deleting item');
    }
    btnEl.disabled = false;
    btnEl.innerHTML = original;
  }
}

// Delegate clicks to delete buttons
document.addEventListener('click', function(e) {
  const delBtn = e.target.closest('.btn-delete-item');
  if (!delBtn) return;
  const itemId = delBtn.dataset.itemId;
  deleteItem(itemId, delBtn);
});

// View Return History functionality
document.addEventListener('click', function(e) {
  const historyBtn = e.target.closest('.view-history-btn');
  if (!historyBtn) return;
  
  const itemId = historyBtn.dataset.itemId;
  showReturnHistory(itemId);
});

async function showReturnHistory(itemId) {
  try {
    // This should match your Django URL pattern for fetching return history
    const url = `/api/return-history/${itemId}/`; // Update this to match your actual URL
    
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      credentials: 'same-origin'
    });

    const data = await resp.json();
    
    if (resp.ok && data.success) {
      displayReturnHistoryModal(data.history, data.item_title);
    } else {
      if (typeof showMessagePopup === 'function') {
        showMessagePopup('Error', data.message || 'Failed to load return history', { type: 'error', autoCloseMs: 3000 });
      } else {
        alert('Failed to load return history');
      }
    }
  } catch (err) {
    console.error(err);
    if (typeof showMessagePopup === 'function') {
      showMessagePopup('Network error', 'Failed to fetch return history', { type: 'error', autoCloseMs: 3000 });
    } else {
      alert('Network error');
    }
  }
}

function displayReturnHistoryModal(history, itemTitle) {
  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'history-modal-overlay';
  overlay.innerHTML = `
    <div class="history-modal">
      <div class="history-modal-header">
        <h2>Return History: ${escapeHtml(itemTitle)}</h2>
        <button class="history-modal-close" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="history-modal-body">
        ${history.length > 0 ? history.map(record => `
          <div class="history-record">
            <div class="history-record-header">
              <div class="history-record-borrower">
                <div class="history-avatar">${escapeHtml(record.borrower_name.charAt(0).toUpperCase())}</div>
                <div class="history-borrower-info">
                  <div class="history-borrower-name">${escapeHtml(record.borrower_name)}</div>
                  <div class="history-status ${record.status}">${escapeHtml(record.status_display)}</div>
                </div>
              </div>
            </div>
            <div class="history-record-timeline">
              <div class="history-timeline-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <div>
                  <div class="history-label">Borrowed</div>
                  <div class="history-date">${escapeHtml(record.borrowed_date)}</div>
                </div>
              </div>
              ${record.returned_date ? `
                <div class="history-timeline-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polyline points="9 11 12 14 22 4"/>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                  <div>
                    <div class="history-label">Returned</div>
                    <div class="history-date">${escapeHtml(record.returned_date)}</div>
                  </div>
                </div>
              ` : ''}
            </div>
            ${record.issue_reported ? `
              <div class="history-issue-tag">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                Issue Reported
              </div>
            ` : ''}
          </div>
        `).join('') : '<div class="history-empty">No return history available</div>'}
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Add styles if not already present
  if (!document.getElementById('history-modal-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'history-modal-styles';
    styleEl.textContent = `
      .history-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
        animation: fadeIn 0.2s ease;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      .history-modal {
        background: white;
        border-radius: 16px;
        max-width: 700px;
        width: 100%;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s ease;
      }
      
      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      
      .history-modal-header {
        padding: 24px 32px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .history-modal-header h2 {
        margin: 0;
        font-size: 1.5rem;
        color: #5a0000;
      }
      
      .history-modal-close {
        background: none;
        border: none;
        cursor: pointer;
        padding: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        transition: all 0.2s ease;
      }
      
      .history-modal-close:hover {
        background: rgba(90, 0, 0, 0.1);
      }
      
      .history-modal-close svg {
        width: 24px;
        height: 24px;
        stroke-width: 2;
        color: #666;
      }
      
      .history-modal-body {
        padding: 24px 32px;
        overflow-y: auto;
        flex: 1;
      }
      
      .history-record {
        background: rgba(0, 0, 0, 0.02);
        border: 1px solid rgba(0, 0, 0, 0.08);
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 16px;
      }
      
      .history-record:last-child {
        margin-bottom: 0;
      }
      
      .history-record-header {
        margin-bottom: 16px;
      }
      
      .history-record-borrower {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      
      .history-avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: linear-gradient(135deg, #5a0000, #3a0000);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 20px;
      }
      
      .history-borrower-name {
        font-weight: 600;
        color: #1a1a1a;
        font-size: 1.1rem;
      }
      
      .history-status {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        margin-top: 4px;
      }
      
      .history-status.approved {
        background: rgba(255, 189, 0, 0.2);
        color: #cc9600;
      }
      
      .history-status.returned {
        background: rgba(96, 125, 139, 0.2);
        color: #607d8b;
      }
      
      .history-record-timeline {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-left: 12px;
        padding-left: 24px;
        border-left: 2px solid rgba(90, 0, 0, 0.15);
      }
      
      .history-timeline-item {
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }
      
      .history-timeline-item svg {
        width: 20px;
        height: 20px;
        stroke-width: 2;
        color: #5a0000;
        flex-shrink: 0;
        margin-top: 2px;
      }
      
      .history-label {
        font-size: 0.85rem;
        font-weight: 600;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .history-date {
        font-size: 0.95rem;
        color: #1a1a1a;
        margin-top: 2px;
      }
      
      .history-issue-tag {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        background: rgba(220, 53, 69, 0.1);
        border: 1px solid rgba(220, 53, 69, 0.3);
        border-radius: 8px;
        color: #dc3545;
        font-size: 0.85rem;
        font-weight: 600;
        margin-top: 12px;
      }
      
      .history-issue-tag svg {
        width: 16px;
        height: 16px;
        stroke-width: 2;
      }
      
      .history-empty {
        text-align: center;
        padding: 48px 24px;
        color: #999;
        font-size: 1rem;
      }
    `;
    document.head.appendChild(styleEl);
  }
  
  // Close modal handlers
  const closeBtn = overlay.querySelector('.history-modal-close');
  closeBtn.addEventListener('click', () => overlay.remove());
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  
  document.addEventListener('keydown', function closeOnEsc(e) {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', closeOnEsc);
    }
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}