// confirmation_logout.js
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.querySelector('.logout-btn');
  if (!btn) return;

  btn.addEventListener('click', (e) => {
    e.preventDefault();  // stop form's default submission for now

    alert('You have successfully logout');

    // After alert, submit the form
    const form = document.getElementById('logoutForm');
    if (form) {
      form.submit();
    }
  });
});
