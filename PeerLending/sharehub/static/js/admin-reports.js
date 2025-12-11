(function () {
    const UPDATE_URL = "{% url 'admin_update_report_status' %}";

    function getCookie(name) {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop().split(';').shift();
      return null;
    }

    function showNotification(message, type = 'info') {
      const notification = document.createElement('div');
      notification.className = `notification ${type}`;
      notification.innerHTML = `
      <span>${message}</span>
      <button class="close-notification">&times;</button>
    `;

      document.body.appendChild(notification);

      setTimeout(() => notification.classList.add('show'), 100);

      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
      }, 5000);

      notification.querySelector('.close-notification').addEventListener('click', () => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
      });
    }

    function recalcCounts() {
      let open = 0, progress = 0, resolved = 0;
      document.querySelectorAll('.report-card').forEach(card => {
        const status = card.getAttribute('data-status');
        if (status === 'open') open++;
        else if (status === 'in_progress' || status === 'in progress') progress++;
        else if (status === 'resolved') resolved++;
      });

      document.getElementById('open-count').textContent = open;
      document.getElementById('progress-count').textContent = progress;
      document.getElementById('resolved-count').textContent = resolved;
    }

    async function postJson(url, body) {
      const csrftoken = getCookie('csrftoken');
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
          body: JSON.stringify(body),
          credentials: 'same-origin'
        });
        const data = await resp.json();
        return { ok: resp.ok, data };
      } catch (e) {
        console.error('Network error', e);
        return { ok: false, data: null, error: e };
      }
    }

    function updateReportStatus(card, newStatus) {
      const safeStatus = String(newStatus).replace(/\s+/g, '_').toLowerCase();
      card.setAttribute('data-status', safeStatus);

      const statusBadge = card.querySelector('.status-badge');
      const progressBtn = card.querySelector('.progress-btn');
      const resolveBtn = card.querySelector('.resolve-btn');

      // Update status badge
      statusBadge.className = `status-badge ${safeStatus}`;
      if (safeStatus === 'in_progress') {
        statusBadge.innerHTML = '<i class="fas fa-spinner"></i> In Progress';
      } else if (safeStatus === 'resolved') {
        statusBadge.innerHTML = '<i class="fas fa-check-circle"></i> Resolved';
      } else {
        statusBadge.innerHTML = '<i class="fas fa-exclamation-circle"></i> Open';
      }

      // Update buttons
      if (safeStatus === 'open') {
        if (progressBtn) progressBtn.style.display = 'flex';
        if (resolveBtn) resolveBtn.style.display = 'none';
      } else if (safeStatus === 'in_progress') {
        if (progressBtn) progressBtn.style.display = 'none';
        if (resolveBtn) resolveBtn.style.display = 'flex';
      } else {
        if (progressBtn) progressBtn.style.display = 'none';
        if (resolveBtn) resolveBtn.style.display = 'none';
      }

      // Add success animation
      card.style.animation = 'pulseSuccess 0.6s ease';
      setTimeout(() => card.style.animation = '', 600);
    }

    // Event listeners
    document.addEventListener('DOMContentLoaded', function () {
      // Status update buttons
      document.addEventListener('click', async function (ev) {
        const btn = ev.target.closest('.progress-btn, .resolve-btn');
        if (!btn) return;

        ev.preventDefault();
        const reportId = btn.getAttribute('data-report-id');
        const action = btn.getAttribute('data-action');
        const card = btn.closest('.report-card');

        if (!reportId || !action) return;

        // Show loading state
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

        const resp = await postJson(UPDATE_URL, { report_id: reportId, status: action });

        if (!resp.ok || !resp.data) {
          showNotification('Network error while updating status', 'error');
          btn.disabled = false;
          btn.innerHTML = action === 'in_progress' ?
            '<i class="fas fa-spinner"></i> Start Progress' :
            '<i class="fas fa-check-circle"></i> Mark Resolved';
          return;
        }

        if (resp.data.success) {
          updateReportStatus(card, action);
          recalcCounts();
          showNotification('Report status updated successfully', 'success');
        } else {
          showNotification('Failed to update report: ' + (resp.data.message || resp.data.error || 'Unknown error'), 'error');
          btn.disabled = false;
          btn.innerHTML = action === 'in_progress' ?
            '<i class="fas fa-spinner"></i> Start Progress' :
            '<i class="fas fa-check-circle"></i> Mark Resolved';
        }
      });

      // Filter functionality
      const statusFilter = document.getElementById('status-filter');
      const typeFilter = document.getElementById('type-filter');

      if (statusFilter && typeFilter) {
        const applyFilters = () => {
          const statusValue = statusFilter.value;
          const typeValue = typeFilter.value;

          document.querySelectorAll('.report-card').forEach(card => {
            const cardStatus = card.getAttribute('data-status');
            const cardType = card.querySelector('.type-badge').className.includes('item-type') ? 'item' :
              card.querySelector('.type-badge').className.includes('request-type') ? 'request' : 'other';

            const statusMatch = statusValue === 'all' || cardStatus === statusValue;
            const typeMatch = typeValue === 'all' || cardType === typeValue;

            card.style.display = statusMatch && typeMatch ? 'block' : 'none';
          });
        };

        statusFilter.addEventListener('change', applyFilters);
        typeFilter.addEventListener('change', applyFilters);
      }

      // Modal functionality
      const modal = document.getElementById('report-details-modal');
      const closeModal = () => {
        modal.classList.add('hidden');
      };

      document.querySelectorAll('.modal-close, .close-modal').forEach(btn => {
        btn.addEventListener('click', closeModal);
      });

      document.querySelector('.modal-backdrop').addEventListener('click', closeModal);

      // Add hover effects
      document.querySelectorAll('.report-card').forEach(card => {
        card.addEventListener('mouseenter', function () {
          this.style.transform = 'translateY(-4px)';
        });

        card.addEventListener('mouseleave', function () {
          this.style.transform = 'translateY(0)';
        });
      });

      // Initialize counts
      recalcCounts();

      // Debug: check what report IDs look like
      const reports = JSON.parse(document.getElementById('reports-data').textContent || '[]');
      console.log("Reports from template:", reports);
      console.log("First report ID:", reports[0]?.report_id, "Type:", typeof reports[0]?.report_id);
      
      if (reports.length > 0) {
        const testId = reports[0]?.report_id || 'test123';
        const testUrl = window.ADMIN_REPORT_DETAILS_URL + testId + '/';
        console.log("Test URL would be:", testUrl);
      }
    });
  })();