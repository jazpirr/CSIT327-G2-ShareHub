document.addEventListener('click', function(e){
  if (e.target && e.target.id === 'showOverdueList') {
    const el = document.getElementById('overdueList');
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
  }
});