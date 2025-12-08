document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('signupForm');

  // friendly label map
  const LABELS = {
    email: "Email",
    password1: "Password",
    confirm_password: "Confirm password",
    password2: "Confirm password",
    first_name: "First name",
    last_name: "Last name",
    birthday: "Birthday",
    phone_number: "Phone number",
    college_dept: "Department",
    course: "Course",
    year_level: "Year level",
    general: ""
  };

  function idsToFriendly(ids) {
    return ids.map(id => LABELS[id] || id.replace(/_/g, ' '));
  }

  function combineServerErrors(errors) {
    const msgs = [];
    for (const field in errors) {
      errors[field].forEach(errObj => {
        const prefix = LABELS[field] ? `${LABELS[field]}: ` : "";
        const text = errObj.message || String(errObj);
        msgs.push(prefix + text);
      });
    }
    return msgs;
  }

  async function showErrorsOrConfirm(errors) {
    // Combine messages
    const msgs = combineServerErrors(errors);
    // Detect duplicate-email case: server returns error for "email" with that text
    const emailErrors = errors.email || [];
    const duplicate = emailErrors.some(e => /already registered/i.test(e.message || ''));

    if (duplicate) {
      // use confirm popup so the user can go to login/reset
      const proceed = await window.showConfirmPopup(
        "Email already registered",
        "That email is already registered. Would you like to go to the login page to sign in or reset your password?",
        "Login",
        "Cancel"
      );
      if (proceed) {
        window.location.href = "/login";
      } else {
        // if cancelled, show the error summary briefly (non-auto close)
        window.showMessagePopup("Registration error", msgs.join("\n"), { type: "error", autoCloseMs: 4000 });
      }
    } else {
      // normal case: show combined messages using message popup
      window.showMessagePopup("Please fix the following errors", msgs.join("\n"), { type: "error", autoCloseMs: 4000 });
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // ensure year_level is included in client-side check
    const requiredIds = ['email','password1','confirm_password','first_name','last_name','year_level'];
    const missing = [];

    requiredIds.forEach(id => {
      const el = document.getElementById(id);
      const val = el ? (el.value || '').toString().trim() : '';
      if (!val) missing.push(id);
    });

    if (missing.length) {
      const friendly = idsToFriendly(missing);
      window.showMessagePopup("Please fill out required fields!", friendly.join(", "), { type: "warning", autoCloseMs: 3500 });
      return;
    }

    if (document.getElementById('password1').value !== document.getElementById('confirm_password').value) {
      window.showMessagePopup("Password Error", "Passwords do not match!", { type: "error", autoCloseMs: 3500 });
      return;
    }

    const formData = new FormData(form);
    try {
      const csrfEl = document.querySelector('[name=csrfmiddlewaretoken]');
      const csrfToken = csrfEl ? csrfEl.value : null;
      const response = await fetch(form.action, {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          ...(csrfToken ? {'X-CSRFToken': csrfToken} : {})
        },
        body: formData
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        // show non-auto-closing success popup
        window.showMessagePopup(
          "Success!",
          "You have been successfully registered. Please check your email to verify your account.",
          { type: "success", autoCloseMs: 0 } // 0 = don't auto-close
        );

        // redirect after user closes the popup (close button or clicking overlay)
        const popup = document.getElementById('errorPopup');
        const overlay = document.getElementById('errorOverlay');
        const closeBtn = popup ? popup.querySelector('.close-btn') : null;

        // handler that redirects once and cleans up listeners
        const doRedirect = () => {
          cleanup();
          if (data.redirect_url) window.location.href = data.redirect_url;
        };

        const onCloseClick = (e) => {
          e && e.stopPropagation && e.stopPropagation();
          doRedirect();
        };

        const cleanup = () => {
          if (closeBtn) closeBtn.removeEventListener('click', onCloseClick);
          if (overlay) overlay.removeEventListener('click', onCloseClick);
        };

        if (closeBtn) closeBtn.addEventListener('click', onCloseClick, { once: true });
        if (overlay) overlay.addEventListener('click', onCloseClick, { once: true });

        // also guard against programmatic hide via MutationObserver:
        if (popup && window.MutationObserver) {
          const obs = new MutationObserver((mutationsList) => {
            for (const m of mutationsList) {
              if (m.type === 'attributes' && m.attributeName === 'class') {
                const hasShow = popup.classList.contains('show');
                if (!hasShow) {
                  obs.disconnect();
                  doRedirect();
                }
              }
            }
          });
          obs.observe(popup, { attributes: true });
        }

        // reset form for cleanliness
        form.reset();
        return;
      }

      if (data.errors) {
        await showErrorsOrConfirm(data.errors);
      } else {
        // fallback generic message
        window.showMessagePopup("Error", "Registration failed. Email may already be registered.", { type: "error", autoCloseMs: 4000 });
      }

    } catch (err) {
      console.error(err);
      window.showMessagePopup("Error", "Registration failed. Please try again later.", { type: "error", autoCloseMs: 4000 });
    }
  });

  // department/course logic left unchanged (keeps your existing behavior)
  const departmentCourses = {
    "CCS": ["BSIT", "BSCS"],
    "CNAHS": ["BSN", "BSP", "BSMT"],
    "CEA": ["BSCE", "BSArch","BSChE","BSCpE","BSEE","BSECE","BSIE","BSME with Computational Science", "BSME with Mechatronics", "BSMinE"],
    "CASE": ["AB Comm", "AB Eng", "BEED","BSED","BMA","BS Bio","BS Math","BS Psych"],
    "CMBA": ["BSA", "BSBA","BSAIS","BSMA","BSHM","BSTM","BSOA","AOA","BPA"],
    "CCJ": ["BS Crim"]
  };

  const deptSelect = document.getElementById('college_dept');
  const courseSelect = document.getElementById('course');

  function populateDepartments() {
    if (!deptSelect) return;
    const placeholder = deptSelect.querySelector('option[value=""]');
    deptSelect.innerHTML = '';
    if (placeholder) {
      deptSelect.appendChild(placeholder);
    } else {
      const ph = document.createElement('option');
      ph.value = "";
      ph.text = "Select department";
      deptSelect.appendChild(ph);
    }
    Object.keys(departmentCourses).forEach(deptCode => {
      const option = document.createElement('option');
      option.value = deptCode;
      option.text = deptCode;
      deptSelect.appendChild(option);
    });
  }

  function updateCourses() {
    if (!courseSelect) return;
    const selectedDept = deptSelect ? deptSelect.value : '';
    courseSelect.innerHTML = '<option value="">Select course</option>';
    if (selectedDept && departmentCourses[selectedDept]) {
      departmentCourses[selectedDept].forEach(course => {
        const option = document.createElement('option');
        option.value = course;
        option.text = course;
        courseSelect.appendChild(option);
      });
    }
  }

  if (deptSelect) {
    populateDepartments();
    const preselected = deptSelect.getAttribute('data-selected') || deptSelect.value;
    if (preselected) deptSelect.value = preselected;
    updateCourses();
    const preCourse = courseSelect.getAttribute('data-selected') || courseSelect.value;
    if (preCourse) setTimeout(() => { courseSelect.value = preCourse; }, 0);
    deptSelect.addEventListener('change', updateCourses);
  }

  // password toggle behavior (unchanged)
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

  // Show server-injected errors on page load (if template injected serverErrors)
  try {
    const serverErrorsEl = document.getElementById('serverErrors');
    if (serverErrorsEl) {
      const serverErrors = JSON.parse(serverErrorsEl.textContent || '{}');
      if (Object.keys(serverErrors).length) {
        showErrorsOrConfirm(serverErrors);
      }
    }
  } catch (e) {
    // ignore
  }
});
