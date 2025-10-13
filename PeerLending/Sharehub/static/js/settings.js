// script.js

// Default user settings data (simulates server state)
const DEFAULT_SETTINGS = {
    first_name: 'Frances Anne',
    last_name: 'Riconalla',
    email: 'frances@cit.edu',
    phone: '+63 912 345 6789',
    college: 'Engineering',
    year_level: '3rd Year',
    email_notifications: true,
    due_date_reminders: true,
    profile_visibility: true,
    contact_info: true
};

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
    
    // Load settings from localStorage or use defaults
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
    
    // Populate form fields with loaded settings
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
    
    // Bind all event listeners
    bindEvents() {
        // Tab switching
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        // Form field changes
        document.querySelectorAll('[data-field]').forEach(field => {
            const eventType = field.type === 'checkbox' ? 'change' : 'input';
            field.addEventListener(eventType, () => this.onFieldChange());
        });
        
        // Password validation
        document.getElementById('newPassword').addEventListener('input', () => this.validatePassword());
        document.getElementById('confirmPassword').addEventListener('input', () => this.validatePasswordMatch());
        
        // Email validation
        document.getElementById('email').addEventListener('blur', () => this.validateEmail());
        
        // Save and cancel buttons
        document.getElementById('saveBtn').addEventListener('click', () => this.saveSettings());
        document.getElementById('cancelBtn').addEventListener('click', () => this.cancelChanges());
        
        // Keyboard shortcuts
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
    
    // Switch between settings tabs
    switchTab(tabName) {
        // Update sidebar
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.classList.toggle('active', item.dataset.tab === tabName);
        });
        
        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });
        
        this.currentTab = tabName;
    }
    
    // Handle field changes
    onFieldChange() {
        this.hasChanges = this.checkForChanges();
        this.updateSaveButtonState();
    }
    
    // Check if current form values differ from original
    checkForChanges() {
        return Object.keys(this.originalSettings).some(key => {
            const field = document.querySelector(`[data-field="${key}"]`);
            if (!field) return false;
            
            const currentValue = field.type === 'checkbox' ? field.checked : field.value;
            return currentValue !== this.originalSettings[key];
        });
    }
    
    // Enable/disable save button based on changes and validation
    updateSaveButtonState() {
        const saveBtn = document.getElementById('saveBtn');
        const hasValidation = this.validateAllFields();
        saveBtn.disabled = !this.hasChanges || !hasValidation;
    }
    
    // Validate all form fields
    validateAllFields() {
        const emailValid = this.validateEmail();
        const passwordValid = this.validatePasswordFields();
        return emailValid && passwordValid;
    }
    
    // Email validation
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
    
    // Password strength validation
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
    
    // Password match validation
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
    
    // Validate password fields as a group
    validatePasswordFields() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        // If any password field has content, validate all
        if (currentPassword || newPassword || confirmPassword) {
            if (!currentPassword) {
                document.getElementById('current-password-error').textContent = 
                    'Current password required for password change';
            } else {
                document.getElementById('current-password-error').textContent = '';
            }
            
            return this.validatePassword() && this.validatePasswordMatch() && currentPassword;
        }
        
        // Clear all password errors if no password change attempted
        document.getElementById('current-password-error').textContent = '';
        document.getElementById('new-password-error').textContent = '';
        document.getElementById('confirm-password-error').textContent = '';
        
        return true;
    }
    
    // Save settings to localStorage and show success
    async saveSettings() {
        if (!this.validateAllFields()) return;
        
        const saveBtn = document.getElementById('saveBtn');
        const originalText = saveBtn.textContent;
        
        // Show loading state
        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;
        
        try {
            // Collect current form data
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
            
            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Save to localStorage (temporary)
            localStorage.setItem('shareHub_userSettings', JSON.stringify(newSettings));
            
            // Handle password change if attempted
            const newPassword = document.getElementById('newPassword').value;
            if (newPassword) {
                // TODO: Call Supabase auth to change password
                // const { error } = await supabase.auth.updateUser({
                //   password: newPassword
                // });
                // if (error) throw error;
                
                // Clear password fields after successful change
                document.getElementById('currentPassword').value = '';
                document.getElementById('newPassword').value = '';
                document.getElementById('confirmPassword').value = '';
            }
            
            // Update original settings and reset change tracking
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
    
    // Cancel changes and revert to original
    cancelChanges() {
        // Revert all form fields to original values
        this.updateUI();
        
        // Clear password fields
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        
        // Clear validation messages
        document.querySelectorAll('.validation-message').forEach(msg => {
            msg.textContent = '';
        });
        
        this.hasChanges = false;
        this.updateSaveButtonState();
    }
    
    // Show success toast notification
    showSuccessToast() {
        const toast = document.getElementById('toast');
        toast.classList.add('show');
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
        
        // Make toast focusable for accessibility
        toast.setAttribute('tabindex', '0');
        toast.focus();
        
        setTimeout(() => {
            toast.removeAttribute('tabindex');
        }, 3000);
    }
    
    // Show error toast (if needed)
    showErrorToast(message) {
        const toast = document.getElementById('toast');
        const messageElement = toast.querySelector('.toast-message');
        const originalMessage = messageElement.textContent;
        
        // Update toast for error
        toast.style.background = 'var(--error)';
        messageElement.textContent = message;
        
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
            // Reset to original state
            setTimeout(() => {
                toast.style.background = 'var(--success)';
                messageElement.textContent = originalMessage;
            }, 300);
        }, 4000);
    }
}

// Initialize settings manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SettingsManager();
});

// Additional utility functions for future enhancements
const SettingsUtils = {
    // Export settings as JSON (for backup/migration)
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
    
    // Import settings from JSON file
    importSettings(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const settings = JSON.parse(e.target.result);
                localStorage.setItem('shareHub_userSettings', JSON.stringify(settings));
                location.reload(); // Reload to apply imported settings
            } catch (error) {
                console.error('Invalid settings file:', error);
            }
        };
        reader.readAsText(file);
    }
};
