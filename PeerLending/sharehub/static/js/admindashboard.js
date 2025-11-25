// admindashboard.js (copy-paste)
document.addEventListener('DOMContentLoaded', function () {
  initializeCharts();
  initializeInteractiveElements();
  initializeResponsiveBehavior();
  requestAnimationFrame(animateElements);
});

function initializeCharts() {
  try {
    // Borrowing chart: prefer BORROWING_CHART from template, fallback to dummy data
    const bc = (typeof BORROWING_CHART !== 'undefined') ? BORROWING_CHART : { labels: ['Total Lent','Currently Borrowed'], values: [0,0] };
    const borrowingCanvas = document.getElementById('borrowingChart');
    if (borrowingCanvas) {
      new Chart(borrowingCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: bc.labels,
          datasets: [{
            label: 'Count',
            data: bc.values,
            backgroundColor: bc.values.map((v,i) => i === 0 ? 'rgba(123,30,30,0.85)' : 'rgba(246,199,0,0.95)'),
            borderRadius: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true } }
        }
      });
    }
  } catch (e) { console.error('Borrowing chart error', e); }

  try {
    const rc = (typeof RETURN_CHART !== 'undefined') ? RETURN_CHART : { labels: ['On Time','Late','Missing/Lost'], values: [100,0,0] };
    const returnCanvas = document.getElementById('returnChart');
    if (returnCanvas) {
      new Chart(returnCanvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: rc.labels,
          datasets:[{
            data: rc.values,
            backgroundColor:['rgba(39,174,96,0.9)','rgba(246,199,0,0.9)','rgba(255,84,89,0.9)'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } }
        }
      });
    }
  } catch (e) { console.error('Return chart error', e); }
}

function initializeInteractiveElements() {
  const actionButtons = document.querySelectorAll('.action-btn');
  actionButtons.forEach(btn => {
    btn.addEventListener('click', function () {
      actionButtons.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected','false'); b.tabIndex = -1; });
      this.classList.add('active'); this.setAttribute('aria-selected','true'); this.tabIndex = 0;
      // use per-button data-url if present, otherwise ADMIN_URLS mapping
      const btnUrl = this.dataset.url || (typeof ADMIN_URLS !== 'undefined' ? ADMIN_URLS[this.dataset.action] : null);
      if (btnUrl) {
        // use location.assign so it respects your app routing and login flow
        window.location.assign(btnUrl);
      } else {
        // fallback: handle action names client-side
        handleButtonAction(this.dataset.action);
      }
    });
  });

  // enhance logout button (no-op if form submit will do)
  const logoutBtn = document.querySelector('.logout-btn');
  if (logoutBtn) {
    // It's a form submit already; we keep it native so CSRF works.
  }

  // table header sorting visual only
  document.querySelectorAll('.borrowed-items-table th').forEach(th => {
    th.addEventListener('click', function () {
      th.classList.toggle('sorted-asc');
    });
  });

  // populate table if server provided BORROWED_ITEMS
  try {
    const borrowedItems = (typeof BORROWED_ITEMS !== 'undefined') ? BORROWED_ITEMS : [];
    const tbody = document.querySelector('.borrowed-items-table tbody');
    if (tbody && borrowedItems.length) {
      tbody.innerHTML = '';
      borrowedItems.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(row.item_name || '')}</td>
          <td>${escapeHtml(row.item_owner || '')}</td>
          <td>${escapeHtml(row.borrower || '')}</td>
          <td>
            <div class="due-date">
              <span class="date">${escapeHtml(row.due_date || '')}</span>
              ${row.overdue_text ? `<span class="overdue-text">${escapeHtml(row.overdue_text)}</span>` : (row.remaining_text ? `<span class="remaining-text">${escapeHtml(row.remaining_text)}</span>` : '')}
            </div>
          </td>
          <td><span class="status-badge ${escapeHtml(row.status_class || '')}">${escapeHtml(row.status_label || '')}</span></td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (e) {
    console.error('Populate table error', e);
  }
}

function handleButtonAction(action) {
  switch (action) {
    case 'overview': /* nothing — you're already on overview */ break;
    case 'approve-requests': /* fallback: */ window.location.href = (typeof ADMIN_URLS !== 'undefined' ? ADMIN_URLS.approveRequests : '/admin/approve-requests'); break;
    case 'manage-users': window.location.href = (typeof ADMIN_URLS !== 'undefined' ? ADMIN_URLS.manageUsers : '/admin/manage-users'); break;
    case 'view-reports': window.location.href = (typeof ADMIN_URLS !== 'undefined' ? ADMIN_URLS.viewReports : '/admin/reports'); break;
    default: break;
  }
}

function animateElements() {
  document.querySelectorAll('.summary-card').forEach((card, i) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(8px)';
    setTimeout(() => {
      card.style.transition = 'all 400ms cubic-bezier(.2,.8,.2,1)';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, 80 * i);
  });

  document.querySelectorAll('.action-btn').forEach((btn, i) => {
    btn.style.opacity = '0';
    btn.style.transform = 'translateY(6px)';
    setTimeout(() => { btn.style.transition = 'all 300ms ease'; btn.style.opacity = '1'; btn.style.transform = 'translateY(0)'; }, 300 + i * 60);
  });
}

function initializeResponsiveBehavior() {
  const mediaQuery = window.matchMedia('(max-width: 900px)');
  const adjust = (mq) => {
    document.body.classList.toggle('mobile-view', mq.matches);
    document.querySelectorAll('.chart-wrapper').forEach(w => { w.style.height = mq.matches ? '250px' : '300px'; });
  };
  if (mediaQuery.addEventListener) mediaQuery.addEventListener('change', () => adjust(mediaQuery));
  else if (mediaQuery.addListener) mediaQuery.addListener(adjust);
  adjust(mediaQuery);
}

/* small utility to avoid XSS when injecting data into innerHTML */
function escapeHtml(str){
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}
