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
        ['email','password1','confirm_password','first_name','last_name'].forEach(id => {
            const val = document.getElementById(id).value.trim();
            if(!val) missing.push(id);
        });
        if(missing.length) {
            showPopup("Please fill out required fields!", missing);
            return;
        }

        if(document.getElementById('password1').value !== document.getElementById('confirm_password').value) {
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
                showPopup("Error", ["Email is already registered."]);
            }

        } catch(err) {
            showPopup("Error", ["Email is already registered."]);
            console.error(err);
        }
    });

    // ---- department/course logic (REPLACED) ----
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
        // Remove any existing dept options except the placeholder (value === "")
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
        // If server preselected a value (e.g. after validation error), keep it selected
        const preselected = deptSelect.getAttribute('data-selected') || deptSelect.value;
        if (preselected) {
            deptSelect.value = preselected;
        }
        updateCourses();
        // If server preselected course, try to restore it
        const preCourse = courseSelect.getAttribute('data-selected') || courseSelect.value;
        if (preCourse) {
            // set after updating courses
            setTimeout(() => { courseSelect.value = preCourse; }, 0);
        }

        deptSelect.addEventListener('change', updateCourses);
    }
    // ---- end department/course logic ----

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
