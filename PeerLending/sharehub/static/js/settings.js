document.addEventListener('DOMContentLoaded', () => {
  const sidebarItems = document.querySelectorAll('.sidebar-item');
  const tabContents = document.querySelectorAll('.tab-content');

  sidebarItems.forEach(item => {
    item.addEventListener('click', function () {
      sidebarItems.forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');
      tabContents.forEach(tab => tab.classList.remove('active'));
      const tabName = this.getAttribute('data-tab');
      const tabToShow = document.getElementById(`${tabName}-tab`);
      if (tabToShow) tabToShow.classList.add('active');
    });
  });

  new SettingsManager();
});

class SettingsManager {
    constructor() {
        this.originalSettings = {};
        this.currentTab = 'account';
        this.hasChanges = false;
        try { window.settingsManager = this; } catch (e) { }
        try {
            this.init();
        } catch (e) {
            console.error('SettingsManager init error:', e);
        }
    }

    init() {
        console.log('SettingsManager: init start');
        this.loadSettings();
        this.bindEvents();
        this.updateUI();
        console.log('SettingsManager: init complete');
    }

    loadSettings() {
        this.originalSettings = {};
        try {
            document.querySelectorAll('[data-field]').forEach(field => {
                const key = field.getAttribute('data-field');
                if (field.type === 'checkbox') {
                    this.originalSettings[key] = field.checked;
                } else {
                    this.originalSettings[key] = field.value || '';
                }
            });
            console.log('Settings loaded:', this.originalSettings);
        } catch (e) {
            console.error('Error loading settings:', e);
        }
    }

    updateUI() {
        Object.entries(this.originalSettings).forEach(([key, value]) => {
            const field = document.querySelector(`[data-field="${key}"]`);
            if (field) {
                if (field.type === 'checkbox') {
                    field.checked = value;
                } else {
                    field.value = value || '';
                }
            }
        });
        this.updateSaveButtonState();
    }
    
    bindEvents() {
        document.querySelectorAll('[data-field]').forEach(field => {
            const eventType = field.type === 'checkbox' ? 'change' : 'input';
            field.addEventListener(eventType, () => this.onFieldChange());
        });

        const newPasswordEl = document.getElementById('newPassword');
        if (newPasswordEl) newPasswordEl.addEventListener('input', () => {
            this.validatePassword();
            this.onFieldChange();
        });

        const confirmPasswordEl = document.getElementById('confirmPassword');
        if (confirmPasswordEl) confirmPasswordEl.addEventListener('input', () => {
            this.validatePasswordMatch();
            this.onFieldChange();
        });

        const currentPasswordEl = document.getElementById('currentPassword');
        if (currentPasswordEl) currentPasswordEl.addEventListener('input', () => this.onFieldChange());

        const emailEl = document.getElementById('email');
        if (emailEl) {
            emailEl.addEventListener('blur', () => this.validateEmail());
            emailEl.addEventListener('input', () => this.onFieldChange());
        }

        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveSettings());

        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.cancelChanges());
    }

    onFieldChange() {
        this.hasChanges = this.checkForChanges();
        console.log('Field changed. Has changes:', this.hasChanges);
        this.updateSaveButtonState();
    }

    checkForChanges() {
        try {
            const currentPassword = document.getElementById('currentPassword')?.value || '';
            const newPassword = document.getElementById('newPassword')?.value || '';
            const confirmPassword = document.getElementById('confirmPassword')?.value || '';
            if (currentPassword || newPassword || confirmPassword) {
                console.log('Password change detected');
                return true;
            }
        } catch (e) {}

        const fields = document.querySelectorAll('[data-field]');
        for (let field of fields) {
            const key = field.getAttribute('data-field');
            const currentValue = field.type === 'checkbox' ? field.checked : field.value;
            const original = this.originalSettings[key] || '';
            if (String(currentValue) !== String(original)) {
                console.log(`Change in ${key}: "${original}" -> "${currentValue}"`);
                return true;
            }
        }
        return false;
    }

    updateSaveButtonState() {
        const saveBtn = document.getElementById('saveBtn');
        if (!saveBtn) return;
        const hasValidation = this.validateAllFields();
        saveBtn.disabled = !(this.hasChanges && hasValidation);
        console.log('Save button:', { changes: this.hasChanges, valid: hasValidation, disabled: saveBtn.disabled });
    }

    validateAllFields() {
        return this.validateEmail() && this.validatePasswordFields();
    }

    validateEmail() {
        const emailField = document.getElementById('email');
        const errorElement = document.getElementById('email-error');
        if (!emailField || !errorElement) return true;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailField.value && !emailRegex.test(emailField.value)) {
            errorElement.textContent = 'Please enter a valid email address';
            return false;
        }
        errorElement.textContent = '';
        return true;
    }

    validatePassword() {
        const passwordField = document.getElementById('newPassword');
        const errorElement = document.getElementById('new-password-error');
        if (!passwordField || !errorElement) return true;
        if (passwordField.value && passwordField.value.length < 8) {
            errorElement.textContent = 'Password must be at least 8 characters';
            return false;
        }
        errorElement.textContent = '';
        return true;
    }

    validatePasswordMatch() {
        const newPassword = document.getElementById('newPassword')?.value || '';
        const confirmPassword = document.getElementById('confirmPassword')?.value || '';
        const errorElement = document.getElementById('confirm-password-error');
        if (!errorElement) return true;
        if (confirmPassword && newPassword !== confirmPassword) {
            errorElement.textContent = 'Passwords do not match';
            return false;
        }
        errorElement.textContent = '';
        return true;
    }

    validatePasswordFields() {
        const currentPassword = document.getElementById('currentPassword')?.value || '';
        const newPassword = document.getElementById('newPassword')?.value || '';
        const confirmPassword = document.getElementById('confirmPassword')?.value || '';
        
        if (currentPassword || newPassword || confirmPassword) {
            const currentPwdError = document.getElementById('current-password-error');
            if (!currentPassword) {
                if (currentPwdError) currentPwdError.textContent = 'Current password required';
                return false;
            }
            if (currentPwdError) currentPwdError.textContent = '';
            return this.validatePassword() && this.validatePasswordMatch();
        }
        
        ['current-password-error', 'new-password-error', 'confirm-password-error'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '';
        });
        return true;
    }

    async saveSettings() {
        if (!this.validateAllFields()) return;
        const saveBtn = document.getElementById('saveBtn');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;

        try {
            const currentPassword = document.getElementById('currentPassword')?.value || '';
            const newEmail = document.getElementById('email')?.value || '';
            const newPassword = document.getElementById('newPassword')?.value || '';

            if (newEmail && newEmail !== this.originalSettings.email) {
                const res = await updateEmailRequest(currentPassword, newEmail);
                if (!res.ok) {
                    handleServerErrors(res.data || {});
                    saveBtn.textContent = originalText;
                    saveBtn.disabled = false;
                    return;
                }
            }

            if (newPassword) {
                const res2 = await updatePasswordRequest(currentPassword, newPassword);
                if (!res2.ok) {
                    handleServerErrors(res2.data || {});
                    saveBtn.textContent = originalText;
                    saveBtn.disabled = false;
                    return;
                }
                document.getElementById('currentPassword').value = '';
                document.getElementById('newPassword').value = '';
                document.getElementById('confirmPassword').value = '';
            }

            this.loadSettings();
            this.hasChanges = false;
            this.showSuccessToast();
            this.updateSaveButtonState();
        } catch (error) {
            console.error('Save error:', error);
            this.showErrorToast('Failed to save. Please try again.');
        } finally {
            saveBtn.textContent = originalText;
        }
    }

    cancelChanges() {
        this.updateUI();
        ['currentPassword', 'newPassword', 'confirmPassword'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        document.querySelectorAll('.validation-message').forEach(msg => msg.textContent = '');
        this.hasChanges = false;
        this.updateSaveButtonState();
    }

    showSuccessToast() {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    showErrorToast(message) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        const messageEl = toast.querySelector('.toast-message');
        if (!messageEl) return;
        const original = messageEl.textContent;
        toast.style.background = 'var(--error)';
        messageEl.textContent = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.style.background = 'var(--success)';
                messageEl.textContent = original;
            }, 300);
        }, 4000);
    }
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

async function postJson(url, payload) {
    const csrftoken = getCookie('csrftoken');
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrftoken || ''
        },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
}

async function updateEmailRequest(currentPassword, newEmail) {
    return await postJson('/settings/update_email/', {
        current_password: currentPassword,
        new_email: newEmail
    });
}

async function updatePasswordRequest(currentPassword, newPassword) {
    return await postJson('/settings/update_password/', {
        current_password: currentPassword,
        new_password: newPassword
    });
}

function handleServerErrors(payload) {
    if (!payload || !payload.errors) {
        const manager = window.settingsManager || null;
        const msg = (payload && payload.message) ? payload.message : 'Server error';
        if (manager) manager.showErrorToast(msg);
        return;
    }
    Object.entries(payload.errors).forEach(([field, errs]) => {
        const el = document.getElementById(`${field}-error`);
        if (el) el.textContent = errs.map(e => e.message).join('; ');
    });
}

window.updateEmailRequest = updateEmailRequest;
window.updatePasswordRequest = updatePasswordRequest;
