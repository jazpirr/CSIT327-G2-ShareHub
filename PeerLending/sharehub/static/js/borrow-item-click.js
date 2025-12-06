// borrowed-item-click.js
document.addEventListener('DOMContentLoaded', function() {
  const borrowedItems = document.querySelectorAll('.borrowed-item');
  
  borrowedItems.forEach(item => {
    item.style.cursor = 'pointer';
    
    item.addEventListener('click', function(e) {
      if (!e.target.closest('.item-action-btn')) {
        const itemId = this.dataset.itemId;
        const itemTitle = this.dataset.itemTitle;
        
        // Redirect to return item page with item ID
        window.location.href = `/return-item/${itemId}/`;
        
        // Or show a modal if you prefer that approach
        // showReturnItemModal(this.dataset);
      }
    });
    
    // Add status tag based on due date
    const returnDate = new Date(this.dataset.returnDate);
    const today = new Date();
    const daysDiff = Math.ceil((returnDate - today) / (1000 * 60 * 60 * 24));
    
    let status = 'on-time';
    let statusText = 'On Time';
    
    if (daysDiff < 0) {
      status = 'late';
      statusText = 'Late';
    } else if (daysDiff <= 2) {
      status = 'due-soon';
      statusText = 'Due Soon';
    }
    
    // Create status tag
    const statusTag = document.createElement('div');
    statusTag.className = `borrowed-item-status ${status}`;
    statusTag.textContent = statusText;
    this.appendChild(statusTag);
  });
});