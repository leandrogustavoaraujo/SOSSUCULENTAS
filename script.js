const offerDate = document.getElementById('offer-date');
if (offerDate) {
  offerDate.textContent = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
}

document.querySelectorAll('[data-checkout-value]').forEach((checkoutLink) => {
  checkoutLink.addEventListener('click', () => {
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'InitiateCheckout', {
        value: Number(checkoutLink.dataset.checkoutValue),
        currency: 'USD'
      });
    }
  });
});

document.querySelectorAll('.faq-item button').forEach((button) => {
  button.addEventListener('click', () => {
    const item = button.closest('.faq-item');
    const wasOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item').forEach((other) => {
      other.classList.remove('open');
      other.querySelector('button').setAttribute('aria-expanded', 'false');
      other.querySelector('button b').textContent = '+';
    });
    if (!wasOpen) {
      item.classList.add('open');
      button.setAttribute('aria-expanded', 'true');
      button.querySelector('b').textContent = '−';
    }
  });
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.08 });

document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const enableInfiniteCarousel = (carousel) => {
  const originalCards = Array.from(carousel.children);
  originalCards.forEach((card) => {
    const copy = card.cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    carousel.append(copy);
  });

  let paused = false;
  let lastFrame = 0;

  const moveCarousel = (timestamp) => {
    if (!lastFrame) lastFrame = timestamp;
    const elapsed = timestamp - lastFrame;
    lastFrame = timestamp;

    if (!paused && carousel.scrollWidth > carousel.clientWidth) {
      carousel.scrollLeft += elapsed * 0.025;
      const loopPoint = carousel.scrollWidth / 2;
      if (carousel.scrollLeft >= loopPoint) carousel.scrollLeft -= loopPoint;
    }
    window.requestAnimationFrame(moveCarousel);
  };

  ['mouseenter', 'pointerdown', 'touchstart'].forEach((eventName) => {
    carousel.addEventListener(eventName, () => { paused = true; }, { passive: true });
  });
  ['mouseleave', 'pointerup', 'pointercancel', 'touchend'].forEach((eventName) => {
    carousel.addEventListener(eventName, () => { paused = false; }, { passive: true });
  });

  window.requestAnimationFrame(moveCarousel);
};

if (!reducedMotion) {
  document.querySelectorAll('.product-scroll, .essentials-scroll, .mechanism-carousel').forEach(enableInfiniteCarousel);
}
