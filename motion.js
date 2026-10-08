/*
  Motion kit — smooth scroll (Lenis), scroll scenes (GSAP ScrollTrigger),
  reveals, split headings, counters, marquee, horizontal scenes, sticky stacks,
  magnetic buttons, cursor, tilt, open-now status (Astana time), WhatsApp forms.
  Without the CDN scripts or with "reduce motion" the page stays fully usable.
*/
(() => {
  'use strict';
  const doc = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const motion = doc.classList.contains('motion') && !reduce;
  const G = window.gsap;
  const ST = window.ScrollTrigger;
  const hasG = !!(G && ST) && motion;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const safe = (fn) => { try { fn(); } catch (e) { console.error(e); } };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  window.__motionReady = true;
  if (hasG) G.registerPlugin(ST);

  let refreshT = 0;
  const M = (window.Motion = {
    reduce, fine, motion, hasG, lenis: null, $, $$, safe, clamp,
    onLoad: [], onScroll: [],
    refresh() { clearTimeout(refreshT); refreshT = setTimeout(() => { if (hasG) ST.refresh(); }, 160); },
  });

  /* ---------- Preloader ---------- */
  const finishLoad = () => {
    if (doc.classList.contains('is-loaded')) return;
    doc.classList.add('is-loaded');
    $$('[data-hold] [data-reveal], [data-hold] [data-split], [data-hold][data-reveal], [data-hold][data-split], [data-hold] [data-stagger]').forEach((el) => el.classList.add('is-in'));
    M.onLoad.forEach((f) => safe(f));
    document.dispatchEvent(new CustomEvent('motion:loaded'));
    setTimeout(() => { const pl = $('.pl'); if (pl) pl.remove(); }, 1800);
    M.refresh();
  };
  M.ready = (fn) => { if (doc.classList.contains('is-loaded')) safe(fn); else M.onLoad.push(fn); };
  safe(() => {
    const pl = $('.pl');
    if (!pl || !motion) { requestAnimationFrame(finishLoad); return; }
    const num = $('.pl-num', pl);
    const min = +(pl.dataset.min || 1400);
    const t0 = performance.now();
    let ready = false;
    let shown = 0;
    const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
    Promise.race([fonts, new Promise((r) => setTimeout(r, 2600))]).then(() => { ready = true; });
    const tick = (now) => {
      const target = Math.min((now - t0) / min, ready ? 1 : 0.9);
      shown += (target - shown) * 0.14;
      if (target === 1 && shown > 0.985) shown = 1;
      pl.style.setProperty('--p', shown.toFixed(4));
      if (num) num.textContent = String(Math.round(shown * 100)).padStart(2, '0');
      if (shown < 1) requestAnimationFrame(tick);
      else setTimeout(finishLoad, 180);
    };
    requestAnimationFrame(tick);
  });

  /* ---------- Smooth scroll ---------- */
  safe(() => {
    if (!motion || !window.Lenis) return;
    const lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 1 });
    M.lenis = lenis;
    if (hasG) {
      lenis.on('scroll', ST.update);
      G.ticker.add((t) => lenis.raf(t * 1000));
      G.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  });
  M.lock = (on) => {
    if (M.lenis) { on ? M.lenis.stop() : M.lenis.start(); }
    doc.classList.toggle('is-locked', !!on);
  };
  M.scrollTo = (target, offset = 0) => {
    if (M.lenis) { M.lenis.scrollTo(target, { offset, duration: 1.5 }); return; }
    const behavior = reduce ? 'auto' : 'smooth';
    if (target === 0) window.scrollTo({ top: 0, behavior });
    else window.scrollTo({ top: target.getBoundingClientRect().top + scrollY + offset, behavior });
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id === '#') return;
    const target = id === '#top' ? 0 : document.getElementById(decodeURIComponent(id.slice(1)));
    if (target == null) return;
    e.preventDefault();
    if (M.menu) M.menu(false);
    M.scrollTo(target, 0);
    history.replaceState(null, '', id === '#top' ? location.pathname : id);
  });

  /* ---------- Header, progress, bottom bar, active nav ---------- */
  safe(() => {
    const hdr = $('.hdr');
    const prog = $('.progress i');
    const mbar = $('.mbar');
    const links = $$('.nav a[href^="#"]').map((a) => [a, document.getElementById(a.getAttribute('href').slice(1))]).filter((x) => x[1]);
    let lastY = scrollY;
    let ticking = false;
    const update = () => {
      ticking = false;
      const y = scrollY;
      if (hdr) {
        hdr.classList.toggle('is-scrolled', y > 24);
        if (y < 160 || y < lastY - 6) hdr.classList.remove('is-hidden');
        else if (y > lastY + 6 && !doc.classList.contains('menu-open')) hdr.classList.add('is-hidden');
      }
      if (mbar) mbar.classList.toggle('is-on', y > innerHeight * 0.55 && !doc.classList.contains('menu-open'));
      lastY = y;
      if (prog) {
        const max = doc.scrollHeight - innerHeight;
        prog.style.transform = 'scaleX(' + (max > 0 ? (y / max).toFixed(4) : 0) + ')';
      }
      const mid = innerHeight * 0.4;
      links.forEach(([a, s]) => { const r = s.getBoundingClientRect(); a.classList.toggle('is-active', r.top <= mid && r.bottom > mid); });
      M.onScroll.forEach((f) => safe(() => f(y)));
    };
    M.update = update;
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    addEventListener('resize', () => requestAnimationFrame(update));
    update();
  });

  /* ---------- Mobile menu ---------- */
  safe(() => {
    const btn = $('.burger');
    const nav = $('.mnav');
    if (!btn || !nav) return;
    $$('.mnav-links a', nav).forEach((a, k) => a.style.setProperty('--k', k));
    const set = (open) => {
      doc.classList.toggle('menu-open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
      if (open) nav.removeAttribute('inert'); else nav.setAttribute('inert', '');
      M.lock(open);
      if (M.update) M.update();
    };
    M.menu = set;
    nav.setAttribute('inert', '');
    btn.addEventListener('click', () => set(!doc.classList.contains('menu-open')));
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && doc.classList.contains('menu-open')) { set(false); btn.focus(); } });
    addEventListener('resize', () => { if (innerWidth > 1024 && doc.classList.contains('menu-open')) set(false); });
  });

  /* ---------- Split headings into masked words ---------- */
  const split = (el) => {
    let i = 0;
    const walk = (node) => Array.from(node.childNodes).forEach((n) => {
      if (n.nodeType === 1) { if (n.tagName !== 'BR' && !n.hasAttribute('data-nosplit')) walk(n); return; }
      if (n.nodeType !== 3) return;
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.append(' '); return; }
        const w = document.createElement('span');
        w.className = 'sw';
        const s = document.createElement('span');
        s.className = 'si';
        s.textContent = part;
        s.style.setProperty('--i', i++);
        w.append(s);
        frag.append(w);
      });
      n.replaceWith(frag);
    });
    walk(el);
    el.classList.add('is-split');
  };
  if (motion) $$('[data-split]').forEach((el) => safe(() => split(el)));
  M.split = split;

  /* ---------- Scramble text ---------- */
  const GLYPHS = '#%&*+=?/<>[]{}01АБВГДЖЗКЛМНПРСТФХЦЧШЭЮЯ';
  M.scramble = (el, dur = 900) => {
    const final = el.dataset.text || el.textContent;
    el.dataset.text = final;
    if (!motion) { el.textContent = final; return; }
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const n = Math.floor(p * final.length);
      let s = final.slice(0, n);
      for (let i = n; i < final.length; i++) s += /\s/.test(final[i]) ? final[i] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      el.textContent = s;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  /* ---------- Reveal on view ---------- */
  safe(() => {
    $$('[data-stagger]').forEach((p) => Array.from(p.children).forEach((c, k) => c.style.setProperty('--si', k)));
    const els = $$('[data-reveal], [data-split], [data-draw], [data-stagger], [data-scramble]');
    const done = (el) => {
      const n = el.hasAttribute('data-stagger') ? el.children.length : 1;
      setTimeout(() => el.classList.add('is-done'), 1500 + n * 90);
      if (el.hasAttribute('data-scramble')) M.scramble(el, +(el.dataset.scramble || 900));
    };
    if (!motion || !('IntersectionObserver' in window)) { els.forEach((e) => { e.classList.add('is-in', 'is-done'); }); return; }
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      done(en.target);
      io.unobserve(en.target);
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0 });
    els.forEach((el) => {
      if (el.closest('[data-hold]')) { M.ready(() => done(el)); return; }
      io.observe(el);
    });
    M.observe = (el) => io.observe(el);
  });

  /* ---------- Counters ---------- */
  const fmt = (v, dec) => v.toLocaleString('ru-RU', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  M.count = (el) => {
    const to = parseFloat(el.dataset.count);
    const dec = +(el.dataset.dec || 0);
    const dur = +(el.dataset.dur || 1900);
    if (!motion) { el.textContent = fmt(to, dec); return; }
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      el.textContent = fmt(to * e, dec);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  safe(() => {
    const els = $$('[data-count]');
    if (!motion || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((en) => en.forEach((x) => {
      if (!x.isIntersecting) return;
      M.count(x.target);
      io.unobserve(x.target);
    }), { threshold: 0.4 });
    els.forEach((el) => {
      el.textContent = fmt(0, +(el.dataset.dec || 0));
      if (el.closest('[data-hold]')) M.ready(() => setTimeout(() => M.count(el), 500));
      else io.observe(el);
    });
  });

  /* ---------- Marquee (speeds up with scroll velocity) ---------- */
  safe(() => {
    $$('[data-marquee]').forEach((mq) => {
      const track = $('.mq-track', mq);
      if (!track) return;
      const items = Array.from(track.children);
      let guard = 0;
      while (track.scrollWidth < Math.max(mq.clientWidth, innerWidth) * 1.2 && guard++ < 10) items.forEach((n) => { const c = n.cloneNode(true); c.setAttribute('aria-hidden', 'true'); track.append(c); });
      Array.from(track.children).forEach((n) => { const c = n.cloneNode(true); c.setAttribute('aria-hidden', 'true'); track.append(c); });
      if (!motion) return;
      let half = track.scrollWidth / 2;
      addEventListener('resize', () => { half = track.scrollWidth / 2; });
      const base = parseFloat(mq.dataset.marquee) || 40;
      const dir = mq.dataset.dir === 'right' ? 1 : -1;
      let x = dir === 1 ? -half : 0;
      let boost = 0;
      let sdir = 1;
      let visible = true;
      new IntersectionObserver((en) => { visible = en[0].isIntersecting; }).observe(mq);
      let last = performance.now();
      const tick = () => {
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (visible) {
          const v = M.lenis ? M.lenis.velocity : 0;
          boost += (Math.min(Math.abs(v) * 7, 520) - boost) * 0.08;
          if (Math.abs(v) > 0.4 && mq.dataset.react !== 'off') sdir = v > 0 ? 1 : -1;
          x += dir * sdir * (base + boost) * dt;
          if (x <= -half) x += half;
          if (x > 0) x -= half;
          track.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  });

  /* ---------- Horizontal scenes (sticky + translate, native touch) ---------- */
  safe(() => {
    if (!motion) return;
    $$('[data-hscroll]').forEach((sec) => {
      const track = $('.hs-track', sec);
      const sticky = $('.hs-sticky', sec);
      if (!track || !sticky) return;
      if (sec.dataset.hsMin && innerWidth < +sec.dataset.hsMin) return;
      sec.classList.add('hs-on');
      let dist = 0;
      let travel = 0;
      let w = innerWidth;
      const speed = parseFloat(sec.dataset.hscroll) || 1;
      const measure = () => {
        dist = Math.max(0, track.scrollWidth - sticky.clientWidth);
        travel = dist / speed;
        sec.style.height = Math.round(sticky.offsetHeight + travel) + 'px';
      };
      const update = () => {
        const r = sec.getBoundingClientRect();
        const p = travel > 0 ? clamp(-r.top / travel, 0, 1) : 0;
        track.style.transform = 'translate3d(' + (-p * dist).toFixed(1) + 'px,0,0)';
        sec.style.setProperty('--hp', p.toFixed(4));
      };
      measure();
      update();
      M.onScroll.push(update);
      if ('ResizeObserver' in window) new ResizeObserver(() => { measure(); update(); M.refresh(); }).observe(track);
      addEventListener('resize', () => { if (innerWidth !== w) { w = innerWidth; measure(); update(); M.refresh(); } });
    });
  });

  /* ---------- GSAP scroll scenes ---------- */
  if (hasG) safe(() => {
    // parallax
    $$('[data-speed]').forEach((el) => {
      const s = parseFloat(el.dataset.speed) || 0.15;
      G.fromTo(el, { y: () => -s * innerHeight * 0.5 }, { y: () => s * innerHeight * 0.5, ease: 'none', scrollTrigger: { trigger: el.closest('[data-speed-scope]') || el, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true } });
    });
    // image zoom-out inside a frame
    $$('[data-zoom]').forEach((el) => {
      const z = parseFloat(el.dataset.zoom) || 1.25;
      G.fromTo(el, { scale: z }, { scale: 1, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    // frame expands while scrolling in
    $$('[data-clip]').forEach((el) => {
      const r = el.dataset.clip || '28px';
      G.fromTo(el, { clipPath: 'inset(12% 9% 12% 9% round ' + r + ')' }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none', scrollTrigger: { trigger: el, start: 'top 95%', end: 'top 15%', scrub: true } });
    });
    // big type slides sideways with scroll
    $$('[data-slide]').forEach((el) => {
      const d = parseFloat(el.dataset.slide) || 12;
      G.fromTo(el, { xPercent: d }, { xPercent: -d, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    // rotate with scroll
    $$('[data-spin]').forEach((el) => {
      const d = parseFloat(el.dataset.spin) || 180;
      G.to(el, { rotate: d, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    // paragraph lights up word by word while read
    $$('[data-read]').forEach((el) => {
      if (!el.classList.contains('is-split')) split(el);
      const words = $$('.si', el);
      el.classList.add('read-on');
      G.to(words, { opacity: 1, stagger: 0.1, ease: 'none', scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 45%', scrub: true } });
    });
    // sticky stack: earlier cards shrink back as the next one arrives
    $$('[data-stack]').forEach((wrap) => {
      const cards = Array.from(wrap.children);
      cards.forEach((c, i) => {
        if (i === cards.length - 1) return;
        G.fromTo(c, { scale: 1, filter: 'brightness(1)' }, { scale: 0.92, filter: 'brightness(0.8)', ease: 'none', immediateRender: false, scrollTrigger: { trigger: cards[i + 1], start: 'top 75%', end: 'top 25%', scrub: true } });
      });
    });
    // section background/ink switch: active section paints the page, default otherwise
    const bgSecs = $$('[data-bg]');
    if (bgSecs.length) {
      const cs = getComputedStyle(doc);
      const def = { bg: cs.getPropertyValue('--bg').trim(), fg: cs.getPropertyValue('--fg').trim() };
      const act = [];
      const apply = () => {
        const sec = act[act.length - 1];
        G.to(doc, { '--page-bg': sec ? sec.dataset.bg : def.bg, '--page-fg': sec ? (sec.dataset.fg || def.fg) : def.fg, duration: 0.8, ease: 'power2.out', overwrite: 'auto' });
      };
      bgSecs.forEach((sec) => ST.create({ trigger: sec, start: 'top 62%', end: 'bottom 38%', onToggle: (self) => {
        const i = act.indexOf(sec);
        if (self.isActive && i < 0) act.push(sec);
        if (!self.isActive && i >= 0) act.splice(i, 1);
        apply();
      } }));
    }
  });
  $$('[data-stack]').forEach((wrap) => Array.from(wrap.children).forEach((c, i) => c.style.setProperty('--k', i)));

  /* ---------- Pointer effects ---------- */
  if (fine && motion) safe(() => {
    $$('[data-magnetic]').forEach((el) => {
      const s = parseFloat(el.dataset.magnetic) || 0.3;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * s).toFixed(1) + 'px,' + ((e.clientY - r.top - r.height / 2) * s).toFixed(1) + 'px)';
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
    $$('[data-tilt]').forEach((el) => {
      const max = parseFloat(el.dataset.tilt) || 8;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = 'perspective(900px) rotateX(' + (-py * max).toFixed(2) + 'deg) rotateY(' + (px * max).toFixed(2) + 'deg)';
        el.style.setProperty('--gx', ((px + 0.5) * 100).toFixed(1) + '%');
        el.style.setProperty('--gy', ((py + 0.5) * 100).toFixed(1) + '%');
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
    const c = $('.cursor');
    if (!c) return;
    const dot = $('.cursor-dot', c);
    const ring = $('.cursor-ring', c);
    const label = $('.cursor-label', c);
    let mx = -100;
    let my = -100;
    let rx = -100;
    let ry = -100;
    addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; c.classList.add('is-on'); }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => c.classList.remove('is-on'));
    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest('[data-cursor], a, button, label, select, input, textarea, summary');
      const txt = t && t.dataset ? t.dataset.cursor : '';
      c.classList.toggle('is-label', !!txt);
      c.classList.toggle('is-link', !!t && !txt);
      if (label) label.textContent = txt || '';
    });
    const loop = () => {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
      ring.style.transform = 'translate3d(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px,0)';
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });

  /* ---------- Open now (Astana, UTC+5) ---------- */
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const RU = { Mon: 'в понедельник', Tue: 'во вторник', Wed: 'в среду', Thu: 'в четверг', Fri: 'в пятницу', Sat: 'в субботу', Sun: 'в воскресенье' };
  const toMin = (s) => { const p = s.split(':'); return +p[0] * 60 + +p[1]; };
  const hm = (m) => { if (m === 1440) return '24:00'; m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  M.astanaNow = () => { const d = new Date(Date.now() + 5 * 3600e3); return { day: d.getUTCDay(), min: d.getUTCHours() * 60 + d.getUTCMinutes(), date: d.toISOString().slice(0, 10) }; };
  M.openState = (hours) => {
    if (hours === '24/7') return { open: true, always: true };
    const now = M.astanaNow();
    const ranges = (d) => (hours[DAYS[((d % 7) + 7) % 7]] || []).map((r) => { const s = toMin(r[0]); let e = toMin(r[1]); if (e <= s) e += 1440; return [s, e]; });
    for (const [s, e] of ranges(now.day)) if (now.min >= s && now.min < e) return { open: true, until: e };
    for (const [s, e] of ranges(now.day - 1)) if (e > 1440 && now.min < e - 1440) return { open: true, until: e - 1440 };
    for (let k = 0; k < 8; k++) for (const [s] of ranges(now.day + k)) if (k > 0 || s > now.min) return { open: false, next: s, inDays: k, key: DAYS[(now.day + k) % 7] };
    return { open: false };
  };
  M.openText = (st) => {
    if (st.always) return 'Открыто круглосуточно';
    if (st.open) return 'Открыто до ' + hm(st.until > 1440 ? st.until - 1440 : st.until);
    if (st.next == null) return 'Закрыто';
    return 'Закрыто · откроется ' + (st.inDays === 0 ? 'сегодня' : st.inDays === 1 ? 'завтра' : RU[st.key]) + ' в ' + hm(st.next);
  };
  safe(() => {
    const els = $$('[data-hours]');
    if (!els.length) return;
    const paint = () => els.forEach((el) => {
      let h = el.dataset.hours;
      if (h !== '24/7') { try { h = JSON.parse(h); } catch (e) { return; } }
      const st = M.openState(h);
      el.classList.toggle('is-open', !!st.open);
      el.classList.toggle('is-closed', !st.open);
      const t = $('[data-hours-text]', el) || el;
      t.textContent = M.openText(st);
    });
    paint();
    setInterval(paint, 60000);
  });

  /* ---------- Accordions with smooth height ---------- */
  safe(() => {
    $$('details[data-acc]').forEach((d) => {
      const sum = $('summary', d);
      const body = sum && sum.nextElementSibling;
      if (!sum || !body) return;
      sum.addEventListener('click', (e) => {
        if (!motion || !body.animate) return;
        e.preventDefault();
        if (d.open) {
          const h = body.offsetHeight;
          const a = body.animate([{ height: h + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 320, easing: 'cubic-bezier(.4,0,.2,1)' });
          a.onfinish = () => { d.open = false; M.refresh(); };
        } else {
          d.open = true;
          const h = body.offsetHeight;
          body.animate([{ height: '0px', opacity: 0 }, { height: h + 'px', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = () => M.refresh();
        }
      });
    });
  });

  /* ---------- Tabs ---------- */
  safe(() => {
    $$('[data-tabs]').forEach((wrap) => {
      const tabs = $$('[data-tab]', wrap);
      const panels = $$('[data-panel]', wrap);
      const show = (id) => {
        const go = () => {
          tabs.forEach((t) => { const on = t.dataset.tab === id; t.classList.toggle('is-active', on); t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
          panels.forEach((p) => { p.hidden = p.dataset.panel !== id; });
          M.refresh();
        };
        if (document.startViewTransition && motion) document.startViewTransition(go); else go();
      };
      tabs.forEach((t, i) => {
        t.addEventListener('click', () => show(t.dataset.tab));
        t.addEventListener('keydown', (e) => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
          n.focus();
          show(n.dataset.tab);
        });
      });
    });
  });

  /* ---------- WhatsApp forms, toast, small helpers ---------- */
  M.toast = (msg) => {
    let t = $('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(M._tt);
    M._tt = setTimeout(() => t.classList.remove('is-on'), 3400);
  };
  M.wa = (num, text) => { window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(text), '_blank', 'noopener'); };
  M.formText = (f) => {
    const lines = [];
    $$('[data-label]', f).forEach((el) => {
      let v = '';
      if (el.type === 'radio' || el.type === 'checkbox') { if (!el.checked) return; v = el.value; }
      else v = (el.value || '').trim();
      if (!v) return;
      if (el.type === 'date') { const d = new Date(v + 'T12:00:00'); if (!isNaN(d)) v = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' }); }
      lines.push(el.dataset.label + ': ' + v);
    });
    return lines;
  };
  safe(() => {
    const today = M.astanaNow().date;
    $$('input[type=date][data-min-today]').forEach((i) => { i.min = today; });
    $$('form[data-wa]').forEach((f) => f.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!f.reportValidity()) return;
      const lines = [f.dataset.waTitle || 'Здравствуйте!'].concat(M.formText(f));
      if (typeof f.waExtra === 'function') { const x = f.waExtra(); if (x) lines.push(x); }
      if (f.dataset.waTail) lines.push(f.dataset.waTail);
      M.wa(f.dataset.wa, lines.join('\n'));
      M.toast('Открываем WhatsApp — сообщение уже набрано');
    }));
    $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
    $$('img').forEach((img) => {
      if (img.complete) img.classList.add('is-loaded');
      else img.addEventListener('load', () => { img.classList.add('is-loaded'); M.refresh(); }, { once: true });
    });
    if (document.fonts) document.fonts.ready.then(() => M.refresh());
    addEventListener('load', () => M.refresh());
  });
})();
