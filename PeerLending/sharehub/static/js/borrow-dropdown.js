
document.addEventListener('DOMContentLoaded', function() {
  // Close all dropdowns function
  function closeAllDropdowns() {
    document.querySelectorAll('.report-dropdown.active').forEach(d => {
      d.classList.remove('active');
    });
  }
  
  // Handle 3-dots click
  document.addEventListener('click', function(e) {
    // Check if any modal is open
    const openModals = document.querySelectorAll('.modal-overlay[style*="display: flex"], .modal-overlay.active');
    if (openModals.length > 0) {
      // Don't open dropdowns when modal is open
      closeAllDropdowns();
      return;
    }
    
    // Toggle dropdown
    if (e.target.closest('.report-dots')) {
      e.stopPropagation(); // This prevents the event from bubbling up
      
      const btn = e.target.closest('.report-dots');
      const dropdown = btn.nextElementSibling;
      
      // Close other dropdowns
      closeAllDropdowns();
      
      // Toggle current
      dropdown.classList.toggle('active');
    } 
    // Close dropdowns when clicking elsewhere
    else if (!e.target.closest('.report-dropdown')) {
      closeAllDropdowns();
    }
    
    // Report button click
    if (e.target.closest('.report-issue-btn')) {
      e.stopPropagation(); // Prevent bubbling
      
      const btn = e.target.closest('.report-issue-btn');
      const itemId = btn.dataset.itemId;
      
      // Close dropdown
      btn.closest('.report-dropdown').classList.remove('active');
      
      console.log('Report button clicked for item:', itemId);
    }
  });
  
  // Close on escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeAllDropdowns();
    }
  });
  
  // Close dropdowns when window is resized or scrolled
  window.addEventListener('resize', closeAllDropdowns);
  window.addEventListener('scroll', closeAllDropdowns);
});
