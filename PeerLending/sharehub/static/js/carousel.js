// carousel.js
(function() {
  const track = document.getElementById('carouselTrack');
  const prevBtn = document.getElementById('carouselPrev');
  const nextBtn = document.getElementById('carouselNext');
  const dotsContainer = document.getElementById('carouselDots');

  if (!track) return;

  // Keep original real content for rebuilding clones
  const originalHTML = track.innerHTML;
  let originalRealCount = track.querySelectorAll('.carousel-item').length;

  let itemsPerPage = 3;
  let cloneCount = 0;
  let currentIndex = 0; // index in cloned-items space
  let items = [];
  let totalItems = 0;
  let realCount = originalRealCount;

  // ensure hardware-accelerated transforms
  track.style.willChange = 'transform';

  function updateItemsPerPage() {
    const width = window.innerWidth;
    if (width <= 640) itemsPerPage = 1;
    else if (width <= 1024) itemsPerPage = 2;
    else itemsPerPage = 3;
  }

  function setupClonesAndState() {
    // reset to original real items
    track.innerHTML = originalHTML;
    const realItems = Array.from(track.querySelectorAll('.carousel-item'));
    realCount = realItems.length;

    track.addEventListener('click', function (e) {
      const itemEl = e.target.closest('.carousel-item');
      if (!itemEl) return;
      const idx = items.indexOf(itemEl);
      if (idx === -1) return;
      const centerOffset = Math.floor(itemsPerPage / 2);
      let targetIndex = idx - centerOffset;
      const approxBase = cloneCount;
      while (targetIndex < approxBase - realCount) targetIndex += realCount;
      while (targetIndex > approxBase + 2 * realCount) targetIndex -= realCount;
      currentIndex = targetIndex;
      updateCarousel();
    });

    // how many clones on each side — use itemsPerPage
    cloneCount = itemsPerPage;

    // create fragments
    const fragPre = document.createDocumentFragment();
    for (let i = realCount - cloneCount; i < realCount; i++) {
      const idx = ((i % realCount) + realCount) % realCount;
      const clone = realItems[idx].cloneNode(true);
      clone.classList.add('clone');
      fragPre.appendChild(clone);
    }
    const fragApp = document.createDocumentFragment();
    for (let i = 0; i < cloneCount; i++) {
      const clone = realItems[i].cloneNode(true);
      clone.classList.add('clone');
      fragApp.appendChild(clone);
    }

    // prepend and append clones
    track.prepend(fragPre);
    track.append(fragApp);

    // update references
    items = Array.from(track.querySelectorAll('.carousel-item'));
    totalItems = items.length;

    // initial index: first real item inside clones
    currentIndex = cloneCount;

    createDots();

    // snap to initial position without transition
    track.style.transition = 'none';
    updateCarousel();
    // force reflow and restore transition for animations
    void track.offsetWidth;
    track.style.transition = 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
  }

  function createDots() {
    dotsContainer.innerHTML = '';
    const pages = Math.max(1, realCount - itemsPerPage + 1);
    for (let i = 0; i < pages; i++) {
      const dot = document.createElement('button');
      dot.classList.add('carousel-dot');
      dot.setAttribute('aria-label', `Go to page ${i + 1}`);
      dot.addEventListener('click', () => goToIndex(cloneCount + i));
      dotsContainer.appendChild(dot);
    }
  }

  function computeCenterIndex() {
    const centerOffset = Math.floor(itemsPerPage / 2);
    let centerIndex = currentIndex + centerOffset;
    if (centerIndex < 0) centerIndex = 0;
    if (centerIndex >= totalItems) centerIndex = totalItems - 1;
    return centerIndex;
  }

  // compute transform in px and set it (rounded to avoid sub-pixel jitter)
  function updateCarousel() {
    if (!items[0]) return;
    const gap = parseFloat(getComputedStyle(track).gap) || 24;
    const container = track.parentElement; // .carousel-container
    const containerWidth = container.clientWidth;

    // recompute item widths in case responsive changes happened
    const itemElem = items[0];
    const itemWidth = itemElem.offsetWidth;

    // find center item index & element
    const centerIndex = computeCenterIndex();
    const centerItem = items[centerIndex];
    if (!centerItem) return;

    // left edge of center item relative to track
    const centerLeft = centerItem.offsetLeft;

    // desiredOffset so centerItem's center sits at container center:
    let desiredOffset = containerWidth / 2 - (centerItem.offsetWidth / 2) - centerLeft;

    // compute track total width to clamp (allow clones so we rarely hit blank)
    const trackRect = track.getBoundingClientRect();
    const trackWidthApprox = track.scrollWidth; // robust across clones

    // clamp: do not show blank area left or right
    const maxOffset = 0; // can't shift right past 0
    const minOffset = Math.min(0, containerWidth - trackWidthApprox);

    if (desiredOffset > maxOffset) desiredOffset = maxOffset;
    if (desiredOffset < minOffset) desiredOffset = minOffset;

    // Round to px to avoid jitter
    track.style.transform = `translateX(${Math.round(desiredOffset)}px)`;

    // update dots: map currentIndex (cloned) to real page index
    const realStartIndex = cloneCount;
    const realRelative = (currentIndex - realStartIndex + realCount) % realCount;
    const pages = Math.max(1, realCount - itemsPerPage + 1);
    const dotIndex = Math.max(0, Math.min(pages - 1, realRelative));
    const dots = Array.from(dotsContainer.querySelectorAll('.carousel-dot'));
    dots.forEach((dot, idx) => dot.classList.toggle('active', idx === dotIndex));

    // ensure buttons enabled
    prevBtn.disabled = false;
    nextBtn.disabled = false;

    // set center class after transform so CSS pop is applied
    requestAnimationFrame(setCenterItem);
  }

  function setCenterItem() {
    items.forEach(it => it.classList.remove('center'));
    const centerIndex = computeCenterIndex();
    const centerItem = items[centerIndex];
    if (centerItem) centerItem.classList.add('center');
  }

  // nav
  function goToIndex(idx) {
    currentIndex = idx;
    updateCarousel();
  }
  function nextSlide() { currentIndex += 1; updateCarousel(); }
  function prevSlide() { currentIndex -= 1; updateCarousel(); }

  // robust transitionend: only trigger on transform and when track is target
  function onTransitionEnd(e) {
    if (e.target !== track) return;
    if (e.propertyName && e.propertyName !== 'transform') return;
    // real items live in indices [cloneCount .. cloneCount + realCount - 1]
    const firstReal = cloneCount;
    const lastReal = cloneCount + realCount - 1;

    // if we've moved past the lastReal into appended clones
    if (currentIndex > lastReal) {
      const wrapped = firstReal + ((currentIndex - firstReal) % realCount + realCount) % realCount;
      track.style.transition = 'none';
      currentIndex = wrapped;
      updateCarousel();
      requestAnimationFrame(() => {
        void track.offsetWidth;
        track.style.transition = 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
      });
    }

    // if we've moved before the firstReal into prepended clones
    if (currentIndex < firstReal) {
      const wrapped = lastReal - ( (firstReal - currentIndex - 1) % realCount );
      track.style.transition = 'none';
      currentIndex = wrapped;
      updateCarousel();
      requestAnimationFrame(() => {
        void track.offsetWidth;
        track.style.transition = 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
      });
    }
  }

  // listeners
  prevBtn.addEventListener('click', prevSlide);
  nextBtn.addEventListener('click', nextSlide);
  track.addEventListener('transitionend', onTransitionEnd);

  // touch/swipe
  let touchStartX = 0;
  track.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; }, {passive:true});
  track.addEventListener('touchend', (e) => {
    const end = e.changedTouches[0].screenX;
    const threshold = 40;
    if (touchStartX - end > threshold) nextSlide();
    if (end - touchStartX > threshold) prevSlide();
  });

  // keyboard
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') prevSlide();
    if (e.key === 'ArrowRight') nextSlide();
  });

  // resize: rebuild clones if itemsPerPage changes (keeps loop stable)
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const prev = itemsPerPage;
      updateItemsPerPage();
      if (prev !== itemsPerPage) {
        setupClonesAndState();
      } else {
        updateCarousel();
      }
    }, 150);
  });

  // initial
  updateItemsPerPage();
  setupClonesAndState();

})();
