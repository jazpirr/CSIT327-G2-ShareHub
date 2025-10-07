document.addEventListener('DOMContentLoaded', () => { 
    const form = document.getElementById('loginForm');
    const popup = document.getElementById('errorPopup');
    const overlay = document.getElementById('errorOverlay');
    const popupHeader = document.getElementById('popupHeader');
    const popupBody = document.getElementById('popupBody');
    const forgotLink = document.querySelector('.forgot-link');

    function showPopup(header, messages) {
        popupHeader.textContent = header;
        popupBody.innerHTML = "";
        if (Array.isArray(messages)) {
            messages.forEach(msg => {
                const div = document.createElement('div');
                div.textContent = msg;
                popupBody.appendChild(div);
            });
        } else {
            popupBody.innerHTML = messages;
        }
        overlay.classList.add('show');
        popup.style.display = "flex";
        setTimeout(() => popup.classList.add('show'), 10);
    }

    window.closePopup = function() {
        popup.classList.remove('show');
        overlay.classList.remove('show');
        setTimeout(() => popup.style.display = "none", 400);
    };

    form.addEventListener('submit', function(event) {
        const missing = [];
        const requiredFields = [
            {id: 'id_email', name: 'Email'},
            {id: 'id_password', name: 'Password'}
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
            errors[field].forEach(errObj => {
                let msg = errObj.message;
                if (msg.toLowerCase().includes("email not confirmed")) {
                    msg = "Your email is not verified. Please check your inbox and confirm your email before logging in.";
                }
                messages.push(msg);
            });
        }

        showPopup("Login Error", messages);
    };

    if (forgotLink) {
        forgotLink.addEventListener('click', (e) => {
            e.preventDefault();

            const bodyHTML = `
                <p>Enter your email to receive a reset link:</p>
                <input type="email" id="forgotEmail" placeholder="Enter your email" required style="width:100%;margin-top:8px;padding:6px;">
                <button id="sendResetBtn" class="submit-btn" style="margin-top:10px;">Send Reset Link</button>
            `;

            showPopup("Reset Password", bodyHTML);
            
            setTimeout(() => {
                const sendBtn = document.getElementById('sendResetBtn');
                if (sendBtn) {
                    sendBtn.addEventListener('click', async () => {
                        const email = document.getElementById('forgotEmail').value.trim();
                        if (!email) {
                            alert('Please enter your email.');
                            return;
                        }

                        const { error } = await supabase.auth.resetPasswordForEmail(email, {
                            redirectTo: 'https://yourdomain.com/reset-password' // change this
                        });

                        if (error) {
                            alert(error.message);
                        } else {
                            alert('Password reset link sent! Check your inbox.');
                            window.closePopup();
                        }
                    });
                }
            }, 100);
        });
    }
});
