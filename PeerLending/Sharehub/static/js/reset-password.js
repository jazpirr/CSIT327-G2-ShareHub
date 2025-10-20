(async () => {
  const msgEl = document.getElementById('resetMessage');
  const form = document.getElementById('resetForm');

  function setMsg(text, type = '') {
    if (!msgEl) return;
    msgEl.textContent = text || '';
    msgEl.className = `msg ${type}`;
  }

  const url = (window.SUPABASE_URL || '').trim();
  const anon = (window.SUPABASE_ANON_KEY || '').trim();

  if (!url || !anon) {
    setMsg('Configuration missing. Please contact support.', 'error');
    return;
  }

  const supabase = window.supabase.createClient(url, anon);

  try {
    await supabase.auth.exchangeCodeForSession(window.location.href);
  } catch (e) {
    // If it fails, the user can still try; we’ll error when updating if no session.
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMsg('');

    const pass1 = document.getElementById('newPassword')?.value || '';
    const pass2 = document.getElementById('confirmPassword')?.value || '';

    if (pass1.length < 8) {
      setMsg('Password must be at least 8 characters.', 'error');
      return;
    }
    if (pass1 !== pass2) {
      setMsg('Passwords do not match.', 'error');
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        setMsg('Your reset link is invalid or expired. Please request a new one.', 'error');
        return;
      }

      const { data, error } = await supabase.auth.updateUser({ password: pass1 });
      if (error) {
        setMsg(error.message || 'Failed to update password.', 'error');
        return;
      }

      setMsg('Password updated! You can now log in with your new password.', 'success');

      setTimeout(() => {
        window.location.href = (window.LOGIN_URL || "/login/");
        }, 1200);
    } catch (err) {
      setMsg('Something went wrong. Please try again.', 'error');
    }
  });

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
})();
