document.addEventListener('DOMContentLoaded', function () {
  initializeCharts();
  initializeInteractiveElements();
  initializeResponsiveBehavior();
  requestAnimationFrame(animateElements);
});

function initializeCharts() {
  // Borrowing Overview bar chart
  const borrowingCtx = document.getElementById('borrowingChart');
  if (borrowingCtx) {
    new Chart(borrowingCtx, {
      type: 'bar',
      data: {
        labels: ['Total Lent', 'Currently Borrowed'],
        datasets: [{
          label: 'Items',
          data: [87, 72],
          backgroundColor: ['#7B1E1E', '#F6C700'],
          borderRadius: 8,
          maxBarThickness: 80
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            cornerRadius: 6
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.03)' },
            ticks: { color: '#6b6b6b' }
          },
          x: { ticks: { color: '#6b6b6b' }, grid: { display: false } }
        }
      }
    });
  }

  // Return Performance doughnut chart
  const returnCtx = document.getElementById('returnChart');
  if (returnCtx) {
    new Chart(returnCtx, {
      type: 'doughnut',
      data: {
        labels: ['On Time', 'Late', 'Missing/Lost'],
        datasets: [{
          data: [85, 12, 3],
          backgroundColor: ['#27AE60', '#F6C700', '#FF5459'],
          borderColor: '#fff',
          cutout: '50%'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12 } },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            titleColor: '#fff',
            bodyColor: '#fff'
          }
        }
      }
    });
  }
}

function initializeInteractiveElements() {
  const actionButtons = document.querySelectorAll('.action-btn');
  actionButtons.forEach(btn => {
    btn.addEventListener('click', function () {
      actionButtons.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); b.tabIndex = -1; });
      this.classList.add('active'); this.setAttribute('aria-selected', 'true'); this.tabIndex = 0;
      handleButtonAction(this.dataset.action);
    });
  });

  const logoutBtn = document.querySelector('.logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function (e) {
      // default behaviour is to submit the logout form; keep as-is
    });
  }

  // simple header sort placeholder
  document.querySelectorAll('.borrowed-items-table th').forEach(th => {
    th.addEventListener('click', function () {
      th.classList.toggle('sorted-asc');
      // Sorting is visual only in this static file. Replace with real sort logic if needed.
    });
  });
}

function handleButtonAction(action) {
  switch (action) {
    case 'overview':
      // nothing - already on overview
      break;
    case 'approve-requests':
      window.location.href = '/admin/approve-requests';
      break;
    case 'manage-users':
      window.location.href = '/admin/manage-users';
      break;
    case 'view-reports':
      window.location.href = '/admin/reports';
      break;
  }
}

function animateElements() {
  // subtle entrance
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
  mediaQuery.addListener(adjust);
  adjust(mediaQuery);
}