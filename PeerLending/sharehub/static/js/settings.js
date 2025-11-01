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
  saveBtn.textContent = 'Saving…';
  saveBtn.disabled = true;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("You must be logged in to save settings.");
      return;
    }

    const payload = {
      user_id: user.id,
      email_notifications: document.getElementById('emailNotifications').checked,
      sms_notifications: document.getElementById('smsNotifications').checked,
      in_app_notifications: document.getElementById('inAppNotifications').checked,
      due_date_reminders: document.getElementById('dueDateReminders').checked,
      show_email: document.getElementById('showEmail').checked,
      public_profile: document.getElementById('publicProfile').checked,
      allow_item_sharing: document.getElementById('itemSharing').checked,
      profile_visibility: document.getElementById('profileVisibility').checked,
      contact_info: document.getElementById('contactInfo').checked,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('user_settings')
      .upsert(payload, { onConflict: 'user_id' })
      .select();

    console.log('saveSettings upsert result:', data, error);

    if (error) {
      console.error("Error saving settings:", error);
      this.showErrorToast("Failed to save settings.");
    } else {
      // update originalSettings to the new values
      Object.keys(payload).forEach(key => {
        if (key in this.originalSettings) {
          this.originalSettings[key] = payload[key];
        }
      });
      this.hasChanges = false;
      this.showSuccessToast();
      this.updateSaveButtonState();
    }
  } catch (err) {   
    console.error('Save error:', err);
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

// === PRIVACY SETTINGS HANDLER ===


ddocument.addEventListener("DOMContentLoaded", () => {
  const saveBtn = document.getElementById("saveBtn");
  const cancelBtn = document.getElementById("cancelBtn");
  const toast = document.getElementById("toast");

  // Initialize Supabase client
  const { createClient } = window.supabase;
  const supabaseUrl = "https://YOUR_PROJECT_ID.supabase.co";
  const supabaseKey = "YOUR_ANON_PUBLIC_KEY";
  const supabaseClient = createClient(supabaseUrl, supabaseKey);

  async function loadSettings() {
    const user = (await supabaseClient.auth.getUser()).data.user;
    if (!user) return;

    const { data } = await supabaseClient
      .from("user_settings")
      .select("*")
      .eq("id", user.id)
      .single();

    if (data) {
      document.getElementById("show_email").checked = data.show_email;
      document.getElementById("show_profile").checked = data.show_profile;
      document.getElementById("allow_sharing").checked = data.allow_sharing;
    }
  }

  async function saveSettings() {
    const user = (await supabaseClient.auth.getUser()).data.user;
    if (!user) return;

    const show_email = document.getElementById("show_email").checked;
    const show_profile = document.getElementById("show_profile").checked;
    const allow_sharing = document.getElementById("allow_sharing").checked;
    

    await supabaseClient.from("user_settings").upsert({
      id: user.id,
      show_email,
      show_profile,
      allow_sharing,
      updated_at: new Date().toISOString(),
    });

    showToast("Settings saved successfully!");
  }

  saveBtn.addEventListener("click", saveSettings);
  cancelBtn.addEventListener("click", () => location.reload());
  loadSettings();

  function showToast(message) {
    const messageEl = toast.querySelector(".toast-message");
    messageEl.textContent = message;
    document.body.classList.add("blur-active");
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
      document.body.classList.remove("blur-active");
    }, 2500); 
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn("No user logged in.");
    return;
  }
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error("Error loading settings:", error);
  }
  if (data) {
    // populate toggles
    document.getElementById('emailNotifications').checked = data.email_notifications;
    document.getElementById('smsNotifications').checked = data.sms_notifications;
    document.getElementById('inAppNotifications').checked = data.in_app_notifications;
    document.getElementById('dueDateReminders').checked = data.due_date_reminders;

    document.getElementById('showEmail').checked = data.show_email;
    document.getElementById('publicProfile').checked = data.public_profile;
    document.getElementById('itemSharing').checked = data.allow_item_sharing;
    document.getElementById('profileVisibility').checked = data.profile_visibility;
    document.getElementById('contactInfo').checked = data.contact_info;
  }

  document.querySelectorAll('input[type="checkbox"]').forEach(toggle => {
    toggle.addEventListener('change', () => {
      saveBtn.disabled = false;
    });
  });
});

  

  const settingsData = {
    user_id: user.id,
    email_notifications: document.getElementById('emailNotifications').checked,
    sms_notifications: document.getElementById('smsNotifications').checked,
    in_app_notifications: document.getElementById('inAppNotifications').checked,
    due_date_reminders: document.getElementById('dueDateReminders').checked,
    show_email: document.getElementById('showEmail').checked,
    public_profile: document.getElementById('publicProfile').checked,
    allow_item_sharing: document.getElementById('itemSharing').checked,
    profile_visibility: document.getElementById('profileVisibility').checked,
    contact_info: document.getElementById('contactInfo').checked,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('user_settings')
    .upsert(settingsData, { onConflict: 'user_id' })
    .select();

  if (error) {
    console.error("Error saving settings:", error);
    alert("Failed to save settings.");
  } else {
    // show toast / feedback
    const toast = document.getElementById("toast");
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2000);
    saveBtn.disabled = true;
  }


