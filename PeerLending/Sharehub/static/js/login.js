document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
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

    form.addEventListener('submit', (event) => {
        const missing = [];
        const email = document.getElementById('id_email').value.trim();
        const password = document.getElementById('id_password').value.trim();

        if (!email) missing.push("Email");
        if (!password) missing.push("Password");

        if (missing.length > 0) {
            event.preventDefault();
            showPopup("Please fill out required fields!", missing);
        }
    });

    window.showServerErrors = function(errors) {
        const messages = [];

        for (const field in errors) {
            errors[field].forEach(errObj => {
                messages.push(errObj.message);
            });
        }

        if (messages.length > 0) {
            showPopup("Login Failed!", messages);
        }
    }

    window.closePopup = function() {
        popup.classList.remove('show');
        overlay.classList.remove('show');
        setTimeout(() => popup.style.display = "none", 400);
    }
});
