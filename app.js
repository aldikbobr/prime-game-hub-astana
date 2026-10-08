/* Prime Game Hub — radar + server list, min-ping finder, reaction test, review log, booking message */
(() => {
  'use strict';
  const M = window.Motion || { $: (s, r = document) => r.querySelector(s), $$: (s, r = document) => Array.from(r.querySelectorAll(s)), motion: false, fine: false, reduce: true, toast() {}, refresh() {}, formText: () => [] };
  const { $, $$ } = M;

  /* Hero: the floor grid leans after the pointer */
  const floor = $('.grid-floor');
  if (floor && M.fine && M.motion) {
    addEventListener('pointermove', (e) => {
      if (scrollY > innerHeight) return;
      const px = e.clientX / innerWidth - 0.5;
      floor.style.transform = 'perspective(420px) rotateX(62deg) rotateZ(' + (px * -6).toFixed(2) + 'deg) translateX(' + (px * -40).toFixed(1) + 'px)';
    }, { passive: true });
  }

  /* Radar ↔ server list, district filter */
  const rows = $$('.srv');
  const blips = $$('.blip');
  const blipFor = (k) => blips.find((b) => b.dataset.k === String(k));
  const rowFor = (k) => rows.find((r) => r.dataset.k === String(k));
  const hot = (k, on) => { const b = blipFor(k); if (b) b.classList.toggle('is-hot', on); const r = rowFor(k); if (r) r.classList.toggle('is-hot', on); };
  rows.forEach((r) => { r.addEventListener('pointerenter', () => hot(r.dataset.k, true)); r.addEventListener('pointerleave', () => hot(r.dataset.k, false)); });
  const chips = $$('.dchip');
  const setDistrict = (name) => {
    chips.forEach((c) => { const on = c.dataset.d === name; c.classList.toggle('is-on', on); c.setAttribute('aria-pressed', String(on)); });
    let i = 0;
    rows.forEach((r) => {
      const show = !name || r.dataset.district === name;
      r.classList.toggle('is-out', !show);
      r.classList.remove('is-flip');
      if (show) { void r.offsetWidth; r.style.setProperty('--i', i++); r.classList.add('is-flip'); }
      const b = blipFor(r.dataset.k); if (b) b.classList.toggle('is-dim', !show);
    });
    if (M.refresh) M.refresh();
  };
  chips.forEach((c) => { c.setAttribute('aria-pressed', String(c.classList.contains('is-on'))); c.addEventListener('click', () => setDistrict(c.dataset.d)); });
  blips.forEach((b) => {
    b.addEventListener('pointerenter', () => hot(b.dataset.k, true));
    b.addEventListener('pointerleave', () => hot(b.dataset.k, false));
    b.addEventListener('click', () => {
      const r = rowFor(b.dataset.k);
      if (!r) return;
      if (r.classList.contains('is-out')) setDistrict('');
      rows.forEach((x) => x.classList.remove('is-hot')); blips.forEach((x) => x.classList.remove('is-hot'));
      hot(b.dataset.k, true);
      if (M.scrollTo) M.scrollTo(r, -140);
    });
  });

  /* Minimum ping = nearest club */
  const near = $('#near-btn');
  if (near) {
    const rad = (d) => d * Math.PI / 180;
    const km = (a, b, c, d) => 12742 * Math.asin(Math.sqrt(Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2));
    near.addEventListener('click', () => {
      if (!navigator.geolocation) { M.toast('Браузер не умеет определять местоположение'); return; }
      near.classList.add('is-busy');
      navigator.geolocation.getCurrentPosition((pos) => {
        near.classList.remove('is-busy');
        const { latitude: la, longitude: lo } = pos.coords;
        setDistrict('');
        const list = rows.map((el) => ({ el, d: km(la, lo, +el.dataset.lat, +el.dataset.lon) }));
        list.forEach(({ el, d }) => {
          el.classList.remove('is-near');
          el.dataset.bars = d < 2 ? 4 : d < 5 ? 3 : d < 10 ? 2 : 1;
          $('.srv-dist', el).textContent = (d < 1 ? Math.round(d * 1000) + ' м' : d.toFixed(1).replace('.', ',') + ' км');
        });
        const sorted = list.slice().sort((a, b) => a.d - b.d);
        const box = $('#srv-list');
        sorted.forEach(({ el }) => box.append(el));
        const best = sorted[0];
        best.el.classList.add('is-near');
        hot(best.el.dataset.k, true);
        const radar = $('#radar');
        const x = (lo - 71.355) / 0.18 * 100, y = (51.178 - la) / 0.092 * 100;
        let me = $('.me', radar);
        if (x >= 0 && x <= 100 && y >= 0 && y <= 100) { if (!me) { me = document.createElement('span'); me.className = 'me'; radar.append(me); } me.style.left = x + '%'; me.style.top = y + '%'; }
        else if (me) me.remove();
        const name = $('h3', best.el).textContent;
        M.toast(best.d > 40 ? 'Вы далеко от Астаны — ближайший клуб: ' + name : 'Минимальный пинг — ' + name + ', ' + $('.srv-dist', best.el).textContent);
        const sel = $('#msg-club'); if (sel) sel.value = name;
        if (M.refresh) M.refresh();
        if (M.scrollTo) M.scrollTo(best.el, -160);
      }, () => {
        near.classList.remove('is-busy');
        M.toast('Геолокация недоступна — выберите район');
      }, { enableHighAccuracy: false, timeout: 9000, maximumAge: 600000 });
    });
  }

  /* Reaction test */
  const pad = $('#pad');
  if (pad) {
    const big = $('#pad-big'), small = $('#pad-small'), cells = $$('#tries i'), bestEl = $('#best');
    let state = 'idle', t0 = 0, timer = 0, res = [];
    const rank = (ms) => ms < 200 ? 'Global Elite' : ms < 250 ? 'Supreme' : ms < 320 ? 'Gold Nova' : 'Silver';
    let best = null;
    try { best = +localStorage.getItem('prime-best') || null; } catch (e) { best = null; }
    if (best && bestEl) bestEl.textContent = best + ' мс';
    const set = (s, b, sm) => { state = s; pad.dataset.state = s; big.textContent = b; small.textContent = sm; };
    const arm = () => {
      set('wait', 'ЖДИТЕ ЗЕЛЁНОГО…', 'Попытка ' + (res.length + 1) + ' из 5');
      clearTimeout(timer);
      timer = setTimeout(() => { t0 = performance.now(); set('go', 'ЖМИТЕ!', 'Попытка ' + (res.length + 1) + ' из 5'); }, 1200 + Math.random() * 2300);
    };
    const press = () => {
      if (state === 'idle' || state === 'done' || state === 'early') {
        if (state === 'done') { res = []; cells.forEach((c) => { c.textContent = ''; c.classList.remove('is-set'); }); }
        arm(); return;
      }
      if (state === 'wait') { clearTimeout(timer); set('early', 'РАНО! ФАЛЬСТАРТ', 'Нажмите, чтобы повторить попытку'); return; }
      if (state === 'go') {
        const ms = Math.round(performance.now() - t0);
        res.push(ms);
        const c = cells[res.length - 1]; if (c) { c.textContent = ms; c.classList.add('is-set'); }
        if (res.length >= 5) {
          const avg = Math.round(res.reduce((a, b) => a + b, 0) / res.length);
          if (!best || avg < best) { best = avg; try { localStorage.setItem('prime-best', String(avg)); } catch (e) { /* storage off */ } if (bestEl) bestEl.textContent = avg + ' мс'; }
          set('done', avg + ' мс · ' + rank(avg).toUpperCase(), 'Среднее за 5 попыток. Нажмите, чтобы сыграть ещё');
        } else {
          set('idle', ms + ' мс', 'Нажмите для попытки ' + (res.length + 1) + ' из 5');
        }
      }
    };
    pad.addEventListener('pointerdown', (e) => { e.preventDefault(); press(); });
    pad.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); press(); } });
  }

  /* Review log prints line by line */
  const log = $('#log');
  if (log && M.motion && 'IntersectionObserver' in window) {
    const items = $$('li', log);
    const io = new IntersectionObserver((en) => {
      if (!en[0].isIntersecting) return;
      items.forEach((li, i) => setTimeout(() => li.classList.add('is-shown'), 200 + i * 260));
      io.disconnect();
    }, { threshold: 0.2 });
    io.observe(log);
  }

  /* Booking message → clipboard → Prime App */
  const form = $('#msg-form');
  const sel = $('#msg-club');
  if (sel) {
    rows.forEach((r) => { const o = document.createElement('option'); o.textContent = $('h3', r).textContent; sel.append(o); });
    rows.forEach((r) => r.addEventListener('dblclick', () => { sel.value = $('h3', r).textContent; }));
  }
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const text = ['Здравствуйте! Хочу забронировать в Prime Game Hub.'].concat(M.formText ? M.formText(form) : []).join('\n');
      const done = () => { M.toast('Сообщение скопировано — вставьте его в Prime App'); setTimeout(() => window.open('https://t.me/primeapp_bot', '_blank', 'noopener'), 600); };
      const fallback = () => {
        const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.append(ta); ta.select();
        try { document.execCommand('copy'); } catch (err) { /* ignore */ }
        ta.remove(); done();
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    });
  }
})();
