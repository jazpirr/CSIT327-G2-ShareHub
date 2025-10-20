document.addEventListener('DOMContentLoaded', function() {
    const openModalBtn = document.querySelector('.add-item-btn');
    const modal = document.getElementById('addItemModal');
    const cancelBtn = document.getElementById('cancelAddItem');
    const addItemForm = document.getElementById('addItemForm');
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('itemImage');
    const uploadIcon = uploadArea.querySelector('.upload-icon');
    const uploadText = uploadArea.querySelector('.upload-text');
    const uploadSubtext = uploadArea.querySelector('.upload-subtext');

    let selectedFile = null;

    openModalBtn.addEventListener('click', function() {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    });

    function closeModal() { 
        modal.classList.remove('active');
        document.body.style.overflow = '';
        resetForm();
    }

    cancelBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeModal();
        }
    });

    uploadArea.addEventListener('click', function() {
        fileInput.click();
    });

    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadArea.style.borderColor = '#7a0019';
        uploadArea.style.background = 'rgba(122, 0, 25, 0.05)';
    });

    uploadArea.addEventListener('dragleave', function() {
        uploadArea.style.borderColor = '#ddd';
        uploadArea.style.background = '';
    });

    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadArea.style.borderColor = '#ddd';
        uploadArea.style.background = '';
        
        if (e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    function handleFileSelect(file) {
        const validTypes = ['image/jpeg', 'image/png'];
        if (!validTypes.includes(file.type)) {
            alert('Please select a valid image file (PNG or JPG)');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            alert('File size must be less than 10MB');
            return;
        }

        selectedFile = file;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const existingPreview = uploadArea.querySelector('.image-preview');
            if (existingPreview) {
                existingPreview.remove();
            }

            uploadIcon.style.display = 'none';
            uploadText.textContent = 'Image Selected';
            uploadSubtext.textContent = file.name;

            const previewContainer = document.createElement('div');
            previewContainer.className = 'image-preview';
            
            const img = document.createElement('img');
            img.src = e.target.result;
            img.alt = 'Selected item image';
            
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'remove-image';
            removeBtn.textContent = 'Remove Image';
            removeBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                resetFileInput();
            });

            previewContainer.appendChild(img);
            previewContainer.appendChild(removeBtn);
            uploadArea.appendChild(previewContainer);
        };
        reader.readAsDataURL(file);
    }

    function resetFileInput() {
        selectedFile = null;
        fileInput.value = '';
        
        const preview = uploadArea.querySelector('.image-preview');
        if (preview) {
            preview.remove();
        }
        
        uploadIcon.style.display = 'block';
        uploadText.textContent = 'Click to upload image';
        uploadSubtext.textContent = 'PNG, JPG up to 10MB';
    }

    addItemForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const itemName = document.getElementById('itemName').value.trim();
        const category = document.getElementById('itemCategory').value;
        const condition = document.getElementById('itemCondition').value;
        const description = document.getElementById('itemDescription').value.trim();

        if (!itemName || !category || !condition || !description) {
            alert('Please fill in all required fields');
            return;
        }

        const formData = {
            itemName,
            category,
            condition,
            description,
            availability: document.querySelector('input[name="availability"]:checked').value,
            image: selectedFile
        };

        console.log('Form data:', formData);
        
        // Simulate API call
        simulateAddItem(formData);
    });

    function simulateAddItem(formData) {
        const submitBtn = addItemForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Adding...';
        submitBtn.disabled = true;

        setTimeout(() => {
            alert('Item added successfully!');
            closeModal();
            
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }, 1500);
    }

    function resetForm() {
        addItemForm.reset();
        resetFileInput();
    }
});