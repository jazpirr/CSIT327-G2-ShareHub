document.addEventListener('DOMContentLoaded', function () {
  initializeDashboard();
});

function initializeDashboard() {
  initializeCharts();
  initializeInteractiveElements();
  initializeAnimations();
  initializeResponsiveBehavior();
}

function initializeCharts() {
  // Borrowing Chart
  try {
    const borrowingData = window.BORROWING_CHART || { 
      labels: ['Total Lent', 'Currently Borrowed'], 
      values: [245, 45] 
    };
    
    const borrowingCtx = document.getElementById('borrowingChart');
    if (borrowingCtx) {
      new Chart(borrowingCtx, {
        type: 'bar',
        data: {
          labels: borrowingData.labels,
          datasets: [{
            label: 'Items',
            data: borrowingData.values,
            backgroundColor: [
              'rgba(123, 30, 30, 0.8)',
              'rgba(246, 199, 0, 0.8)'
            ],
            borderColor: [
              'rgba(123, 30, 30, 1)',
              'rgba(246, 199, 0, 1)'
            ],
            borderWidth: 1,
            borderRadius: 8,
            borderSkipped: false,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              backgroundColor: 'rgba(19, 52, 59, 0.9)',
              titleColor: '#FFFFFF',
              bodyColor: '#FFFFFF',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              borderWidth: 1,
              cornerRadius: 8,
              displayColors: true,
              callbacks: {
                label: function(context) {
                  return `${context.dataset.label}: ${context.parsed.y} items`;
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: 'rgba(19, 52, 59, 0.05)'
              },
              ticks: {
                color: 'rgba(19, 52, 59, 0.6)'
              }
            },
            x: {
              grid: {
                display: false
              },
              ticks: {
                color: 'rgba(19, 52, 59, 0.6)'
              }
            }
          },
          animation: {
            duration: 1000,
            easing: 'easeOutQuart'
          }
        }
      });
    }
  } catch (error) {
    console.error('Error initializing borrowing chart:', error);
  }

  // Return Performance Chart
  try {
    const returnData = window.RETURN_CHART || { 
      labels: ['On Time', 'Late', 'Missing/Lost'], 
      values: [75, 20, 5] 
    };
    
    const returnCtx = document.getElementById('returnChart');
    if (returnCtx) {
      new Chart(returnCtx, {
        type: 'doughnut',
        data: {
          labels: returnData.labels,
          datasets: [{
            data: returnData.values,
            backgroundColor: [
              'rgba(39, 174, 96, 0.8)',
              'rgba(246, 199, 0, 0.8)',
              'rgba(255, 84, 89, 0.8)'
            ],
            borderColor: [
              'rgba(39, 174, 96, 1)',
              'rgba(246, 199, 0, 1)',
              'rgba(255, 84, 89, 1)'
            ],
            borderWidth: 2,
            borderRadius: 4,
            spacing: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                padding: 20,
                usePointStyle: true,
                pointStyle: 'circle',
                color: 'rgba(19, 52, 59, 0.8)',
                font: {
                  size: 12,
                  weight: '500'
                }
              }
            },
            tooltip: {
              backgroundColor: 'rgba(19, 52, 59, 0.9)',
              titleColor: '#FFFFFF',
              bodyColor: '#FFFFFF',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              borderWidth: 1,
              cornerRadius: 8,
              callbacks: {
                label: function(context) {
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const percentage = Math.round((context.parsed / total) * 100);
                  return `${context.label}: ${context.parsed} (${percentage}%)`;
                }
              }
            }
          },
          animation: {
            animateScale: true,
            animateRotate: true,
            duration: 1000,
            easing: 'easeOutQuart'
          }
        }
      });
    }
  } catch (error) {
    console.error('Error initializing return chart:', error);
  }
}

function initializeInteractiveElements() {
  // Action cards hover effects
  const actionCards = document.querySelectorAll('.action-card');
  actionCards.forEach(card => {
    card.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-4px)';
    });
    
    card.addEventListener('mouseleave', function() {
      this.style.transform = 'translateY(0)';
    });
  });

  // Stat cards hover effects
  const statCards = document.querySelectorAll('.stat-card');
  statCards.forEach(card => {
    card.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-2px)';
    });
    
    card.addEventListener('mouseleave', function() {
      this.style.transform = 'translateY(0)';
    });
  });

  // Table row hover effects
  const tableRows = document.querySelectorAll('.table-row');
  tableRows.forEach(row => {
    row.addEventListener('mouseenter', function() {
      this.style.backgroundColor = 'rgba(123, 30, 30, 0.02)';
    });
    
    row.addEventListener('mouseleave', function() {
      this.style.backgroundColor = '';
    });
  });

  // Auto-update last updated time
  updateLastUpdatedTime();
  setInterval(updateLastUpdatedTime, 60000); // Update every minute
}

function initializeAnimations() {
  // Animate stats cards on load
  const statCards = document.querySelectorAll('.stat-card');
  statCards.forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    
    setTimeout(() => {
      card.style.transition = 'all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, 100 * index);
  });

  // Animate action cards
  const actionCards = document.querySelectorAll('.action-card');
  actionCards.forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateX(-20px)';
    
    setTimeout(() => {
      card.style.transition = 'all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      card.style.opacity = '1';
      card.style.transform = 'translateX(0)';
    }, 300 + (100 * index));
  });
}

function initializeResponsiveBehavior() {
  // Handle responsive table
  const handleTableResponsive = () => {
    const table = document.querySelector('.data-table');
    const wrapper = document.querySelector('.table-wrapper');
    
    if (window.innerWidth < 768 && table) {
      wrapper.style.overflowX = 'auto';
    } else if (table) {
      wrapper.style.overflowX = 'visible';
    }
  };

  // Adjust chart heights on resize
  const adjustChartHeights = () => {
    const chartContainers = document.querySelectorAll('.chart-container');
    chartContainers.forEach(container => {
      if (window.innerWidth < 768) {
        container.style.height = '250px';
      } else {
        container.style.height = '300px';
      }
    });
  };

  // Initial adjustments
  handleTableResponsive();
  adjustChartHeights();

  // Listen for resize events
  window.addEventListener('resize', () => {
    handleTableResponsive();
    adjustChartHeights();
  });
}

function updateLastUpdatedTime() {
  const now = new Date();
  const timeElement = document.querySelector('.last-updated');
  
  if (timeElement) {
    const timeString = now.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
    timeElement.innerHTML = `
      <span class="update-indicator"></span>
      Updated at ${timeString}
    `;
  }
}

// Utility function for safe HTML rendering
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Export for potential use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializeDashboard,
    escapeHtml
  };
}