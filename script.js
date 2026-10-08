(() => {
  'use strict';

  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

  const lightbox = document.getElementById('lightbox');
  if (lightbox) {
    const img = lightbox.querySelector('img');
    const closeBtn = lightbox.querySelector('.lightbox-close');
    let opener = null;
    const close = () => {
      if (lightbox.hidden) return;
      lightbox.hidden = true;
      lightbox.classList.remove('is-open');
      img.removeAttribute('src');
      document.body.style.overflow = '';
      if (opener) opener.focus();
    };
    document.addEventListener('click', e => {
      const trigger = e.target.closest('[data-full]');
      if (trigger) {
        opener = trigger;
        const inner = trigger.querySelector('img');
        img.src = trigger.dataset.full;
        img.alt = inner ? inner.alt : '';
        lightbox.hidden = false;
        lightbox.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        closeBtn.focus();
      } else if (e.target === lightbox || e.target === img) {
        close();
      }
    });
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  }

})();

(function () {
  const flight = document.querySelector('.contact-flight');
  if (!flight) return;
  const card = flight.querySelector('.contact-flight-card');
  const section = flight.closest('section');
  const svgs = flight.querySelectorAll('.flight-trail');
  const paths = flight.querySelectorAll('.flight-path');
  const maskAll = flight.querySelector('.flight-mask-all');
  const maskCard = flight.querySelector('.flight-mask-card');
  const plane = flight.querySelector('.hero-plane-img');
  // Tail of plane.svg (39.2, 92.7 of 150x100) and its native heading.
  const TAIL_X = 39.2 / 150, TAIL_Y = 92.7 / 100;
  const NATIVE_DEG = Math.atan2(1.1 - 92.7, 149.4 - 39.2) * 180 / Math.PI;

  function layout() {
    const f = flight.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    const s = section.getBoundingClientRect();
    const W = f.width, H = f.height;
    const L = c.left - f.left, T = c.top - f.top, R = c.right - f.left, B = c.bottom - f.top;
    const w = R - L, h = B - T;
    const x0 = s.left - f.left - 30;
    const E = { x: R + 90, y: T - 54 };
    const c2 = { x: R + 14, y: T - 4 };

    const d = [
      `M ${x0} ${T - 64}`,
      `C ${L - 150} ${T - 70}, ${L - 40} ${B - 60}, ${L + 40} ${B + 6}`,
      `C ${L + 120} ${B + 72}, ${R - w * 0.22} ${B + 70}, ${R - 64} ${B - 12}`,
      `C ${R - 34} ${T + h * 0.3}, ${c2.x} ${c2.y}, ${E.x} ${E.y}`
    ].join(' ');

    svgs.forEach(svg => svg.setAttribute('viewBox', `0 0 ${W} ${H}`));
    paths.forEach(p => p.setAttribute('d', d));

    const r = parseFloat(getComputedStyle(card).borderTopLeftRadius) || 0;
    maskAll.setAttribute('x', x0 - 50); maskAll.setAttribute('y', -200);
    maskAll.setAttribute('width', W - x0 + 400); maskAll.setAttribute('height', H + 400);
    maskCard.setAttribute('x', L + w * 0.5); maskCard.setAttribute('y', T);
    maskCard.setAttribute('width', w * 0.5); maskCard.setAttribute('height', h);
    maskCard.setAttribute('rx', r);

    if (plane && plane.offsetWidth) {
      const pw = plane.offsetWidth, ph = plane.offsetHeight;
      const heading = Math.atan2(E.y - c2.y, E.x - c2.x) * 180 / Math.PI;
      plane.style.left = `${E.x - pw * TAIL_X}px`;
      plane.style.top = `${E.y - ph * TAIL_Y}px`;
      plane.style.transform = `rotate(${(heading - NATIVE_DEG).toFixed(2)}deg)`;
    }
  }

  layout();
  if (plane && !plane.complete) plane.addEventListener('load', layout, { once: true });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(layout).observe(flight);
  else window.addEventListener('resize', layout, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
})();

(function () {
  const demos = document.querySelectorAll('[data-demo]');
  if (!demos.length) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wide = window.matchMedia('(min-width: 821px)');

  demos.forEach(demo => {
    const video = demo.querySelector('video');
    const steps = Array.from(demo.querySelectorAll('[data-start]'));
    let current = -1;
    let inView = false;
    let raf = null;

    const range = i => {
      const s = parseFloat(steps[i].dataset.start) || 0;
      const e = parseFloat(steps[i].dataset.end);
      return { s, e: Number.isFinite(e) ? e : (video.duration || s + 8) };
    };

    const seek = t => { try { video.currentTime = t; } catch (e) {} };

    const play = () => {
      if (reduced || !inView) return;
      const p = video.play();
      if (p && p.catch) p.catch(() => {});
    };

    const setStep = (i, jump) => {
      if (i !== current) {
        steps.forEach((b, j) => {
          if (j === i) b.setAttribute('aria-current', 'step');
          else b.removeAttribute('aria-current');
          b.style.setProperty('--p', 0);
        });
        current = i;
      }
      if (jump) seek(range(i).s);
      play();
    };

    const tick = () => {
      raf = null;
      if (current < 0) return;
      const { s, e } = range(current);
      const t = video.currentTime;
      if (t >= e - 0.04) {
        if (wide.matches) seek(s);
        else setStep((current + 1) % steps.length, true);
      } else {
        steps[current].style.setProperty('--p', Math.max(0, Math.min(1, (t - s) / (e - s))).toFixed(3));
      }
      if (!video.paused) raf = requestAnimationFrame(tick);
    };

    video.addEventListener('play', () => { if (!raf) raf = requestAnimationFrame(tick); });
    video.addEventListener('ended', () => {
      if (wide.matches) setStep(current, true);
      else setStep(0, true);
    });

    steps.forEach((b, i) => b.addEventListener('click', () => setStep(i, true)));

    if (reduced) video.controls = true;

    new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      if (inView) { if (current < 0) setStep(0, false); else play(); }
      else video.pause();
    }, { threshold: 0.2 }).observe(video);

    const stepIO = new IntersectionObserver(entries => {
      if (!wide.matches) return;
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const i = steps.indexOf(entry.target);
        if (i !== current) setStep(i, true);
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach(b => stepIO.observe(b));
  });
})();
