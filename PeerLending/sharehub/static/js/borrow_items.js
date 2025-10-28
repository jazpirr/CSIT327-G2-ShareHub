document.addEventListener('DOMContentLoaded', function() {
    const requestButtons = document.querySelectorAll('.request-btn');
    const borrowModal = document.getElementById('borrowModal');
    const cancelBorrowBtn = document.getElementById('cancelBorrow');
    const borrowForm = document.getElementById('borrowForm');
    const modalItemName = document.getElementById('modalItemName');
    const modalOwnerName = document.getElementById('modalOwnerName');
 
    let currentItem = null;
 
    requestButtons.forEach(button => {
        button.addEventListener('click', function() {
            const item = this.getAttribute('data-item');
            const owner = this.getAttribute('data-owner');
           
            currentItem = {
                name: item,
                owner: owner,
                element: this
            };
           
            modalItemName.textContent = item;
            modalOwnerName.textContent = owner;
           
            openBorrowModal();
        });
    });
 
    function openBorrowModal() {
        borrowModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
 
    function closeBorrowModal() {
        borrowModal.classList.remove('active');
        document.body.style.overflow = '';
        resetBorrowForm();
    }
 
    cancelBorrowBtn.addEventListener('click', closeBorrowModal);
 
    borrowModal.addEventListener('click', function(e) {
        if (e.target === borrowModal) {
            closeBorrowModal();
        }
    });
 
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && borrowModal.classList.contains('active')) {
            closeBorrowModal();
        }
    });
 
    borrowForm.addEventListener('submit', function(e) {
        e.preventDefault();
       
        const duration = document.getElementById('borrowDuration').value;
       
        if (!duration) {
            alert('Please select a borrow duration');
            return;
        }
 
        submitBorrowRequest(currentItem, duration);
    });
 
    function submitBorrowRequest(item, duration) {
        const submitBtn = borrowForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
       
        submitBtn.textContent = 'Sending...';
        submitBtn.disabled = true;
 
        setTimeout(() => {
            alert(`Borrow request sent successfully for ${item.name}!`);
           
            if (item.element) {
                item.element.textContent = 'Request Sent';
                item.element.disabled = true;
                item.element.style.background = '#999';
            }
           
            closeBorrowModal();
           
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
           
           
        }, 1500);
    }
 
    function resetBorrowForm() {
        borrowForm.reset();
     
        document.getElementById('borrowDuration').value = '7';
    }
 
    const searchInput = document.querySelector('.search-bar input');
    const itemCards = document.querySelectorAll('.item-card');
 
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
       
        itemCards.forEach(card => {
            const itemName = card.querySelector('h3').textContent.toLowerCase();
            const ownerName = card.querySelector('.item-details p:first-child').textContent.toLowerCase();
            const description = card.querySelector('.item-description').textContent.toLowerCase();
           
            const matches = itemName.includes(searchTerm) ||
                          ownerName.includes(searchTerm) ||
                          description.includes(searchTerm);
           
            card.style.display = matches ? 'block' : 'none';
        });
    });

    function updateRequestsSection(item, duration) {
        console.log(`Request created: ${item.name} from ${item.owner} for ${duration} days`);
    }
});