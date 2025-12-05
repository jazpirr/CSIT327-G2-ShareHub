// login.js - COMPLETE AND FIXED
document.addEventListener('DOMContentLoaded', () => { 
    const form = document.getElementById('loginForm');
    const popup = document.getElementById('errorPopup');
    const overlay = document.getElementById('errorOverlay');
    const forgotLink = document.querySelector('.btn-link');
    
    // Function to show popup
    function showPopup(header, messages) {
        const popupHeader = popup.querySelector('.popup-header span');
        const popupBody = popup.querySelector('.popup-body');
        
        if (popupHeader) popupHeader.textContent = header;
        
        popupBody.innerHTML = "";
        if (Array.isArray(messages)) {
            messages.forEach(msg => {
                const div = document.createElement('div');
                div.textContent = msg;
                div.style.padding = '6px 0';
                div.style.borderBottom = '1px solid #f0f0f0';
                popupBody.appendChild(div);
            });
        } else {
            popupBody.innerHTML = messages;
        }
        
        overlay.classList.add('show');
        popup.classList.add('show');
    }
    
    // Function to close popup
    window.closePopup = function() {
        popup.classList.remove('show');
        overlay.classList.remove('show');
    };
    
    // Close button event
    const closeBtn = popup.querySelector('.close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closePopup);
    }
    
    // Close when clicking overlay
    overlay.addEventListener('click', closePopup);
    
    // Get CSRF token
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    }
    
    // Form validation
    if (form) {
        form.addEventListener('submit', function(event) {
            const missing = [];
            const requiredFields = [
                {id: 'id_email', name: 'Email'},
                {id: 'id_password', name: 'Password'}
            ];
            
            requiredFields.forEach(f => {
                const el = document.getElementById(f.id);
                if (!el || !el.value.trim()) missing.push(f.name);
            });
            
            if (missing.length > 0) {
                event.preventDefault();
                showPopup("Please fill out required fields!", missing);
            }
        });
    }
    
    // Show server errors
    window.showServerErrors = function(errors) {
        const messages = [];
        for (const field in errors) {
            errors[field].forEach(errObj => {
                let msg = errObj.message || String(errObj);
                if (typeof msg === 'string' && msg.toLowerCase().includes("email not confirmed")) {
                    msg = "Your email is not verified. Please check your inbox and confirm your email before logging in.";
                }
                messages.push(msg);
            });
        }
        showPopup("Login Error", messages);
    };
    
    // Forgot password functionality
    if (forgotLink) {
        forgotLink.addEventListener('click', (e) => {
            e.preventDefault();
            
            const bodyHTML = `
                <p style="margin-bottom: 12px; color: var(--text-medium);">Enter your email to receive a reset link:</p>
                <input type="email" id="forgotEmail" class="form-input" placeholder="Enter your @cit.edu email" required 
                       style="width:100%; margin-bottom: 15px;">
                <button id="sendResetBtn" class="btn-primary" style="width:100%;">Send Reset Link</button>
            `;
            
            showPopup("Reset Password", bodyHTML);
            
            setTimeout(() => {
                const sendBtn = document.getElementById('sendResetBtn');
                const emailInput = document.getElementById('forgotEmail');
                
                if (!sendBtn || !emailInput) return;
                
                sendBtn.addEventListener('click', async () => {
                    const email = emailInput.value.trim();
                    if (!email) {
                        showPopup("Reset Password", ["Please enter your email."]);
                        return;
                    }
                    
                    const url = window.FORGOT_PASSWORD_URL;
                    if (!url) {
                        showPopup("Reset Password", ["Missing forgot password URL."]);
                        return;
                    }
                    
                    try {
                        const res = await fetch(url, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "X-CSRFToken": getCookie('csrftoken'),
                            },
                            body: JSON.stringify({ email })
                        });
                        
                        const data = await res.json();
                        
                        if (res.ok && data?.success) {
                            showPopup("Check your inbox", [
                                "If that email exists, we sent a password reset link."
                            ]);
                        } else {
                            const msgs = [];
                            if (data?.errors) {
                                Object.values(data.errors).forEach(arr => (arr || []).forEach(o => msgs.push(o.message || String(o))));
                            }
                            showPopup("Reset Password", msgs.length ? msgs : ["Something went wrong. Please try again."]);
                        }
                    } catch (err) {
                        showPopup("Reset Password", ["Network error. Please try again."]);
                    }
                });
                
                // Allow Enter key to submit
                emailInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        sendBtn.click();
                    }
                });
                
            }, 50);
        });
    }
    
    // Password toggle functionality
    document.querySelectorAll('.password-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-target');
            const input = document.getElementById(id);
            const icon = btn.querySelector('i');
            if (!input || !icon) return;
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
                btn.setAttribute('aria-label', 'Hide password');
                btn.title = 'Hide password';
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
                btn.setAttribute('aria-label', 'Show password');
                btn.title = 'Show password';
            }
        });
    });
});