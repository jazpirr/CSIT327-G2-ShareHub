document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('signupForm');
    const popup = document.getElementById('errorPopup');
    const overlay = document.getElementById('errorOverlay');
    const popupHeader = document.getElementById('popupHeader');
    const popupBody = document.getElementById('popupBody');

    function showPopup(header, messages, redirectUrl = null) {
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

        window.closePopup = function() {
            popup.classList.remove('show');
            overlay.classList.remove('show');
            setTimeout(() => {
                popup.style.display = "none";
                if (redirectUrl) window.location.href = redirectUrl;
            }, 400);
        }
    }

    function showServerErrors(errors) {
        const messages = [];
        for (const field in errors) {
            errors[field].forEach(errObj => messages.push(errObj.message));
        }
        showPopup("Please fix the following errors:", messages);
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const missing = [];
        ['email','password1','password2','first_name','last_name'].forEach(id => {
            const val = document.getElementById(id).value.trim();
            if(!val) missing.push(id);
        });
        if(missing.length) {
            showPopup("Please fill out required fields!", missing);
            return;
        }

        if(document.getElementById('password1').value !== document.getElementById('password2').value) {
            showPopup("Password Error", ["Passwords do not match!"]);
            return;
        }

        const formData = new FormData(form);

        try {
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
            const response = await fetch(form.action, {
                method: 'POST',
                headers: {
                    'X-Requested-With':'XMLHttpRequest',
                    'X-CSRFToken': csrfToken
                },
                body: formData
            });

            const data = await response.json();

            if(response.ok && data.success){
                showPopup("Success!", ["You have been successfully registered. Please check your email to confirm your account."], data.redirect_url);
                form.reset();
                return;
            }

            if(data.errors) {
                showServerErrors(data.errors);
            } else {
                showPopup("Error", ["Unexpected error occurred."]);
            }

        } catch(err) {
            showPopup("Error", ["Unexpected error occurred."]);
            console.error(err);
        }
    });
});
