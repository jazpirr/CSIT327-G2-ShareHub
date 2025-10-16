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
        this.init();
    }
    init() {
        this.loadSettings();
        this.bindEvents();
        this.updateUI();
    }

    loadSettings() {
        const savedSettings = localStorage.getItem('shareHub_userSettings');
        this.originalSettings = savedSettings ? 
            JSON.parse(savedSettings) : 
            { ...DEFAULT_SETTINGS };
        // TODO: Replace with Supabase API call
        // const { data, error } = await supabase
        //   .from('user_settings')
        //   .select('*')
        //   .eq('user_id', currentUser.id)
        //   .single();
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
        // Internal SettingsManager tab switching (not needed for main bug, but keep for class logic)
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.addEventListener('click', (e) => this.switchTab(e.currentTarget.dataset.tab));
        });
        document.querySelectorAll('[data-field]').forEach(field => {
            const eventType = field.type === 'checkbox' ? 'change' : 'input';
            field.addEventListener(eventType, () => this.onFieldChange());
        });
        document.getElementById('newPassword').addEventListener('input', () => this.validatePassword());
        document.getElementById('confirmPassword').addEventListener('input', () => this.validatePasswordMatch());
        document.getElementById('email').addEventListener('blur', () => this.validateEmail());
        document.getElementById('saveBtn').addEventListener('click', () => this.saveSettings());
        document.getElementById('cancelBtn').addEventListener('click', () => this.cancelChanges());
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                if (!document.getElementById('saveBtn').disabled) {
                    this.saveSettings();
                }
            }
            if (e.key === 'Escape') {
                this.cancelChanges();
            }
        });
    }

    switchTab(tabName) {
        // This preserves internal tracking, but DOM switching is done by the universal logic above
        this.currentTab = tabName;
    }

    onFieldChange() {
        this.hasChanges = this.checkForChanges();
        this.updateSaveButtonState();
    }

    checkForChanges() {
        return Object.keys(this.originalSettings).some(key => {
            const field = document.querySelector(`[data-field="${key}"]`);
            if (!field) return false;
            const currentValue = field.type === 'checkbox' ? field.checked : field.value;
            return currentValue !== this.originalSettings[key];
        });
    }

    updateSaveButtonState() {
        const saveBtn = document.getElementById('saveBtn');
        const hasValidation = this.validateAllFields();
        saveBtn.disabled = !this.hasChanges || !hasValidation;
    }

    validateAllFields() {
        const emailValid = this.validateEmail();
        const passwordValid = this.validatePasswordFields();
        return emailValid && passwordValid;
    }

    validateEmail() {
        const emailField = document.getElementById('email');
        const errorElement = document.getElementById('email-error');
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailField.value && !emailRegex.test(emailField.value)) {
            errorElement.textContent = 'Please enter a valid email address';
            return false;
        } else {
            errorElement.textContent = '';
            return true;
        }
    }

    validatePassword() {
        const passwordField = document.getElementById('newPassword');
        const errorElement = document.getElementById('new-password-error');
        if (passwordField.value && passwordField.value.length < 8) {
            errorElement.textContent = 'Password must be at least 8 characters long';
            return false;
        } else {
            errorElement.textContent = '';
            return true;
        }
    }

    validatePasswordMatch() {
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const errorElement = document.getElementById('confirm-password-error');
        if (confirmPassword && newPassword !== confirmPassword) {
            errorElement.textContent = 'Passwords do not match';
            return false;
        } else {
            errorElement.textContent = '';
            return true;
        }
    }

    validatePasswordFields() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        if (currentPassword || newPassword || confirmPassword) {
            if (!currentPassword) {
                document.getElementById('current-password-error').textContent =
                    'Current password required for password change';
            } else {
                document.getElementById('current-password-error').textContent = '';
            }
            return this.validatePassword() && this.validatePasswordMatch() && currentPassword;
        }
        document.getElementById('current-password-error').textContent = '';
        document.getElementById('new-password-error').textContent = '';
        document.getElementById('confirm-password-error').textContent = '';
        return true;
    }

    async saveSettings() {
        if (!this.validateAllFields()) return;
        const saveBtn = document.getElementById('saveBtn');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;
        try {
            const newSettings = {};
            Object.keys(this.originalSettings).forEach(key => {
                const field = document.querySelector(`[data-field="${key}"]`);
                if (field) {
                    newSettings[key] = field.type === 'checkbox' ? field.checked : field.value;
                }
            });
            // TODO: Save to Supabase instead of localStorage
            // const { error } = await supabase
            //   .from('user_settings')
            //   .upsert(newSettings)
            //   .eq('user_id', currentUser.id);
            // if (error) throw error;
            await new Promise(resolve => setTimeout(resolve, 500));
            localStorage.setItem('shareHub_userSettings', JSON.stringify(newSettings));
            const newPassword = document.getElementById('newPassword').value;
            if (newPassword) {
                // TODO: Call Supabase auth to change password
                // const { error } = await supabase.auth.updateUser({
                //   password: newPassword
                // });
                // if (error) throw error;
                document.getElementById('currentPassword').value = '';
                document.getElementById('newPassword').value = '';
                document.getElementById('confirmPassword').value = '';
            }
            this.originalSettings = { ...newSettings };
            this.hasChanges = false;
            this.showSuccessToast();
            this.updateSaveButtonState();
        } catch (error) {
            console.error('Save error:', error);
            this.showErrorToast('Failed to save settings. Please try again.');
        } finally {
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
        }
    }

    cancelChanges() {
        this.updateUI();
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        document.querySelectorAll('.validation-message').forEach(msg => {
            msg.textContent = '';
        });
        this.hasChanges = false;
        this.updateSaveButtonState();
    }

    showSuccessToast() {
        const toast = document.getElementById('toast');
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
        toast.setAttribute('tabindex', '0');
        toast.focus();
        setTimeout(() => {
            toast.removeAttribute('tabindex');
        }, 3000);
    }

    showErrorToast(message) {
        const toast = document.getElementById('toast');
        const messageElement = toast.querySelector('.toast-message');
        const originalMessage = messageElement.textContent;
        toast.style.background = 'var(--error)';
        messageElement.textContent = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.style.background = 'var(--success)';
                messageElement.textContent = originalMessage;
            }, 300);
        }, 4000);
    }
}

const SettingsUtils = {
    exportSettings() {
        const settings = localStorage.getItem('shareHub_userSettings');
        if (settings) {
            const blob = new Blob([settings], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'sharehub-settings.json';
            a.click();
            URL.revokeObjectURL(url);
        }
    },
    importSettings(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const settings = JSON.parse(e.target.result);
                localStorage.setItem('shareHub_userSettings', JSON.stringify(settings));
                location.reload();
            } catch (error) {
                console.error('Invalid settings file:', error);
            }
        };
        reader.readAsText(file);
    }
};
