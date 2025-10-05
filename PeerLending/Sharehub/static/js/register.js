document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('signupForm');
    const popup = document.getElementById('errorPopup');
    const overlay = document.getElementById('errorOverlay');
    const popupHeader = document.getElementById('popupHeader');
    const popupBody = document.getElementById('popupBody');

    function showPopup(header, messages) {
        popupHeader.textContent = header;
        popupBody.innerHTML = "";
        messages.forEach(msg => {
            const div = document.createElement('div');
            div.textContent = msg;
            popupBody.appendChild(div);
        });
        overlay.classList.add('show');
        popup.style.display = "flex";
        setTimeout(() => popup.classList.add('show'), 10);
    }

    form.addEventListener('submit', function(event) {
        const missing = [];
        const requiredFields = [
            {id: 'email', name: 'Email'},
            {id: 'password1', name: 'Password'},
            {id: 'password2', name: 'Confirm Password'},
            {id: 'first_name', name: 'First Name'},
            {id: 'last_name', name: 'Last Name'}
        ];

        requiredFields.forEach(f => {
            const el = document.getElementById(f.id);
            if (!el.value.trim()) missing.push(f.name);
        });

        if (missing.length > 0) {
            event.preventDefault();
            showPopup("Please fill out required fields!", missing);
            return;
        }
    });

    window.showServerErrors = function(errors) {
        const messages = [];
        for (const field in errors) {
            errors[field].forEach(errObj => messages.push(errObj.message));
        }
        showPopup("Please fix the following errors:", messages);
    }

    window.closePopup = function() {
        popup.classList.remove('show');
        overlay.classList.remove('show');
        setTimeout(() => popup.style.display = "none", 400);
    }
});
