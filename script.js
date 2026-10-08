(() => {
  'use strict';
  if (typeof window === 'undefined' || !window.Lenis) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.__lenisActive) return;
  window.__lenisActive = true;

  const lenis = new window.Lenis({
    duration: 1.15,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });
  window.__lenis = lenis;

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);
})();

(() => {
  'use strict';
  document.documentElement.classList.add('js');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (window.__lenis && typeof ResizeObserver !== 'undefined') {
    let raf = null;
    new ResizeObserver(() => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => window.__lenis.resize());
    }).observe(document.body);
  }

  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

  const clocks = document.querySelectorAll('[data-clock]');
  if (clocks.length) {
    const fmt = new Intl.DateTimeFormat('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Toronto' });
    const tick = () => clocks.forEach(el => { el.textContent = fmt.format(new Date()); });
    tick();
    setInterval(tick, 15000);
  }

  const navToggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('nav');
  if (navToggle && nav) {
    const setNav = open => {
      document.body.classList.toggle('nav-open', open);
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    navToggle.addEventListener('click', () => setNav(!document.body.classList.contains('nav-open')));
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setNav(false)));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') setNav(false); });
  }

  document.addEventListener('click', e => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const offset = -(document.querySelector('.site-head')?.offsetHeight || 0) - 12;
    if (window.__lenis) window.__lenis.scrollTo(target, { offset, duration: 1 });
    else window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY + offset, behavior: reducedMotion ? 'auto' : 'smooth' });
    history.replaceState(null, '', link.getAttribute('href'));
  });

  const revealEls = document.querySelectorAll('.feature, .archive, .about-grid, .exp-row, .sheet .sheet-grid');
  if ('IntersectionObserver' in window && !reducedMotion) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
    revealEls.forEach(el => { el.setAttribute('data-reveal', ''); io.observe(el); });
  }

  const lightbox = document.getElementById('lightbox');
  if (lightbox) {
    const img = lightbox.querySelector('img');
    const closeBtn = lightbox.querySelector('.lightbox-close');
    let lastFocus = null;
    const open = (src, alt) => {
      lastFocus = document.activeElement;
      img.src = src;
      img.alt = alt || '';
      lightbox.classList.add('is-open');
      lightbox.setAttribute('aria-hidden', 'false');
      if (window.__lenis) window.__lenis.stop();
      document.body.style.overflow = 'hidden';
      closeBtn.focus();
    };
    const close = () => {
      if (!lightbox.classList.contains('is-open')) return;
      lightbox.classList.remove('is-open');
      lightbox.setAttribute('aria-hidden', 'true');
      if (window.__lenis) window.__lenis.start();
      document.body.style.overflow = '';
      if (lastFocus) lastFocus.focus();
    };
    document.addEventListener('click', e => {
      const trigger = e.target.closest('[data-lightbox]');
      if (trigger) {
        const inner = trigger.querySelector('img');
        open(trigger.dataset.lightbox, inner ? inner.alt : '');
        return;
      }
      if (e.target === lightbox) close();
    });
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  }

  const contactSection = document.querySelector('.contact-experience');
  if (contactSection) {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
    window.addEventListener('pageshow', e => {
      if (e.persisted) window.scrollTo(0, 0);
    });
    const video = contactSection.querySelector('.contact-video');
    const stage = contactSection.querySelector('.contact-stage');
    const stageEls = Array.from(contactSection.querySelectorAll('[data-stage-text]'));
    const cardEl = contactSection.querySelector('[data-stage-card]');
    const progressEl = contactSection.querySelector('[data-hud-progress]');
    const altEl = contactSection.querySelector('[data-hud-alt]');
    const headingEl = contactSection.querySelector('[data-hud-heading]');
    const timeEl = contactSection.querySelector('[data-hud-time]');

    const stageRanges = stageEls.map(el => ({
      el,
      from: parseFloat(el.dataset.stageFrom) || 0,
      to: parseFloat(el.dataset.stageTo) || 1,
    }));
    const cardRange = cardEl ? {
      from: parseFloat(cardEl.dataset.stageFrom) || 0.75,
      to: parseFloat(cardEl.dataset.stageTo) || 1,
    } : null;

    let targetTime = 0;
    let currentTime = 0;
    let duration = 0;
    let videoReady = false;
    let primed = false;
    let lastProgress = -1;
    let rafId = null;

    const formatTime = (t) => {
      const s = Math.max(0, Math.floor(t || 0));
      const mm = String(Math.floor(s / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      return mm + ':' + ss;
    };
    const formatInt = (n) => Math.round(n).toLocaleString('en-US');

    const computeProgress = () => {
      const rect = contactSection.getBoundingClientRect();
      const total = contactSection.offsetHeight - window.innerHeight;
      if (total <= 0) return 0;
      const scrolled = Math.max(0, Math.min(total, -rect.top));
      return scrolled / total;
    };

    const primeVideo = () => {
      if (primed || !video) return;
      primed = true;
      const play = video.play();
      if (play && typeof play.then === 'function') {
        play.then(() => {
          video.pause();
          try { video.currentTime = 0; } catch (e) {}
        }).catch(() => {
          try { video.currentTime = 0; } catch (e) {}
        });
      } else {
        try { video.pause(); video.currentTime = 0; } catch (e) {}
      }
    };

    const onMeta = () => {
      duration = video.duration || 0;
      videoReady = true;
      try { video.pause(); } catch (e) {}
      try { video.currentTime = 0; } catch (e) {}
      updateOverlays(computeProgress());
    };

    const updateOverlays = (progress) => {
      if (Math.abs(progress - lastProgress) < 0.0005) return;
      lastProgress = progress;
      contactSection.style.setProperty('--contact-progress', progress.toFixed(4));
      if (progressEl) progressEl.style.width = (progress * 100).toFixed(2) + '%';
      if (altEl) altEl.textContent = formatInt(progress * 31500);
      if (headingEl) {
        const heading = 88 + Math.sin(progress * Math.PI * 2.3) * 6 + progress * 2;
        headingEl.textContent = formatInt(((heading % 360) + 360) % 360).padStart(3, '0');
      }
      if (timeEl) timeEl.textContent = formatTime(progress * (duration || 6.04));

      stageRanges.forEach(({ el, from, to }) => {
        const active = progress >= from && progress <= to;
        el.classList.toggle('is-active', active);
      });
      if (cardEl && cardRange) {
        const active = progress >= cardRange.from;
        cardEl.classList.toggle('is-active', active);
      }
    };

    const tick = () => {
      rafId = null;
      const delta = targetTime - currentTime;
      const absDelta = Math.abs(delta);
      if (absDelta > 0.001) {
        currentTime += delta * 0.18;
        if (videoReady) {
          try { video.currentTime = Math.max(0, Math.min(duration || 0, currentTime)); } catch (e) {}
        }
        rafId = requestAnimationFrame(tick);
      } else {
        currentTime = targetTime;
      }
    };

    const onScroll = () => {
      const progress = computeProgress();
      updateOverlays(progress);
      if (duration > 0) {
        targetTime = progress * duration;
        if (rafId == null) rafId = requestAnimationFrame(tick);
      }
    };

    if (video) {
      video.muted = true;
      video.playsInline = true;
      if (video.readyState >= 1) {
        onMeta();
      } else {
        video.addEventListener('loadedmetadata', onMeta, { once: true });
      }
      const primeOnGesture = () => {
        primeVideo();
        window.removeEventListener('pointerdown', primeOnGesture);
        window.removeEventListener('keydown', primeOnGesture);
        window.removeEventListener('scroll', primeOnGesture);
      };
      window.addEventListener('pointerdown', primeOnGesture, { passive: true, once: true });
      window.addEventListener('keydown', primeOnGesture, { once: true });
      window.addEventListener('scroll', primeOnGesture, { passive: true, once: true });
      primeVideo();
    }

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    if (reducedMotion) {
      stageRanges.forEach(({ el }) => el.classList.add('is-active'));
      if (cardEl) cardEl.classList.add('is-active');
    }

    const stampTrigger = contactSection.querySelector('[data-stamp-trigger]');
    if (stampTrigger && cardEl) {
      stampTrigger.addEventListener('click', () => {
        if (cardEl.classList.contains('is-stamped')) return;
        cardEl.classList.add('is-stamped');
      });
    }
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
