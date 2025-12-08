// static/js/borrow-dropdown.js - FIXED VERSION
// static/js/borrow-dropdown.js
document.addEventListener('DOMContentLoaded', function() {
  // Handle 3-dots click
  document.addEventListener('click', function(e) {
    // Toggle dropdown
    if (e.target.closest('.report-dots')) {
      e.stopPropagation(); // This prevents the event from bubbling up
      
      const btn = e.target.closest('.report-dots');
      const dropdown = btn.nextElementSibling;
      
      // Close other dropdowns
      document.querySelectorAll('.report-dropdown.active').forEach(d => {
        if (d !== dropdown) d.classList.remove('active');
      });
      
      // Toggle current
      dropdown.classList.toggle('active');
    } 
    // Close dropdowns when clicking elsewhere
    else if (!e.target.closest('.report-dropdown')) {
      document.querySelectorAll('.report-dropdown.active').forEach(d => {
        d.classList.remove('active');
      });
    }
    
    // Report button click (this will trigger report_issue.js)
    if (e.target.closest('.report-issue-btn')) {
      e.stopPropagation(); // Prevent bubbling
      
      const btn = e.target.closest('.report-issue-btn');
      const itemId = btn.dataset.itemId;
      
      // Close dropdown
      btn.closest('.report-dropdown').classList.remove('active');
      
      // The report_issue.js will handle opening the modal
      console.log('Report button clicked for item:', itemId);
    }
  });
  
  // Close on escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.report-dropdown.active').forEach(d => {
        d.classList.remove('active');
      });
    }
  });
});