/* Courses page: shelves of books (one shelf per level), a 3D "pull out and open" animation,
   and enrolment. Loaded before the app script; it uses the app's globals (go, Store, COURSE,
   loadCatalog, API, view, G) only at call time.
   Enrolment lives in the progress document (Store.data.enrolled), so it syncs through the
   existing PUT /api/progress with no new tables. The current course is still COURSE. */
(function () {
  'use strict';
  const LIB = { toc: null, loading: null, open: null, anims: [], busy: false };
  const h = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const qs = (s, el) => (el || document).querySelector(s);
  const qsa = (s, el) => [...(el || document).querySelectorAll(s)];
  function hashOf(s) { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; }

  /* ---------- enrolment ---------- */
  function enrolledIds() {
    const e = typeof Store !== 'undefined' && Store.data && Store.data.enrolled;
    const list = Array.isArray(e) ? e.filter(id => typeof id === 'string') : [];
    if (!list.includes(COURSE)) list.unshift(COURSE);   // the course you're studying is always enrolled
    return list;
  }
  function saveEnrolled(list) { Store.data = { ...Store.data, enrolled: [...new Set(list)] }; Store.save(); }
  async function switchTo(id) {
    if (id === COURSE) return;
    await loadCatalog(id);
    if (typeof G !== 'undefined') { G.sel = null; G.unit = null; }
  }
  async function enroll(id) { saveEnrolled([...enrolledIds(), id]); await switchTo(id); }
  async function leave(id) {
    const rest = enrolledIds().filter(x => x !== id);
    if (!rest.length) return;
    if (id === COURSE) await switchTo(rest[0]);
    saveEnrolled(rest.filter(x => x !== COURSE).length ? rest : [COURSE]);
  }
  function state(bk) {
    if (!bk.live) return 'soon';
    if (bk.id === COURSE) return 'current';
    return enrolledIds().includes(bk.id) ? 'enrolled' : 'open';
  }

  /* ---------- table of contents for the real courses ---------- */
  function loadToc() {
    if (LIB.toc || LIB.loading) return LIB.loading;
    LIB.loading = API.req('GET', '/api/courses?toc=1')
      .then(r => { LIB.toc = Object.fromEntries((r.courses || []).map(c => [c.id, c])); })
      .catch(() => { LIB.toc = {}; })
      .finally(() => { LIB.loading = null; if (LIB.open) fillToc(LIB.open); if (qs('.case[data-shelf]')) refreshSpines(); });
    return LIB.loading;
  }

  /* ---------- progress and finish dates (Pace, shared with the home page) ---------- */
  function catalogFor(id) {
    if (id === COURSE && typeof catView === 'function' && typeof SK !== 'undefined' && SK.length) return catView();
    const toc = LIB.toc && LIB.toc[id];
    return toc ? Pace.asCatalog(toc) : null;
  }
  function progressOf(bk) {
    if (!bk.live || typeof Pace === 'undefined') return null;
    const cat = catalogFor(bk.id); if (!cat) return null;
    const left = Pace.remaining(Store.data, cat);
    const eta = typeof courseEta === 'function' ? courseEta(bk.id, cat) : Pace.estimate(Store.data, cat);
    return { cat, left, eta, pct: left.total ? left.mastered / left.total : 0 };
  }
  const pctText = p => Math.round(p * 100) + '%';

  /* ---------- how a book looks: its cloth, size and spine style, fixed by its id ---------- */
  const CLOTH = {
    maths: ['#24345F', '#1F4D73', '#3A3D84', '#2D2A4F', '#41528F', '#9AA9D4'],
    stats: ['#1D6556', '#2E7A63', '#3C6B48', '#245247', '#86B8A4'],
    physics: ['#7A2D29', '#8E3E24', '#6A2B45', '#5A2A22', '#CF8E6E'],
    science: ['#8A6A22', '#5C6A2E', '#6E5420', '#C9A757'],
  };
  const SUBJECT_ORDER = ['maths', 'stats', 'physics', 'science'];
  const STYLES = ['bands', 'label', 'stamp', 'plain'];
  const GLYPH = { maths: '∑', stats: 'σ', physics: 'ψ', science: '✳' };
  function luminance(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; })
      .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
  }
  const LOOKS = new Map();
  function lookOf(bk) {
    if (LOOKS.has(bk.id)) return LOOKS.get(bk.id);
    const x = hashOf(bk.id), r = n => ((x >>> n) & 255) / 255;
    const shades = CLOTH[bk.subject] || CLOTH.maths;
    const pick = r(0);
    // mostly the deep cloths, the pale one now and then for rhythm
    let c = pick > 0.86 ? shades[shades.length - 1] : shades[Math.floor(r(12) * (shades.length - 1))];
    let style = STYLES[(x >>> 3) % STYLES.length];
    const planned = (bk.toc || []).length;
    let w = bk.live ? 62 : Math.round(38 + Math.sqrt(planned || 8) * 3.3 + r(5) * 7);
    let h = bk.live ? 232 : Math.round(192 + r(9) * 42);
    if (bk.id === 'gr12-caps') { c = '#EEE2C6'; style = 'caps'; w = 68; h = 238; }
    if (bk.id === 'algebra') { c = '#1A1A1A'; style = 'bands'; w = 60; h = 226; }
    // long titles on a cream label need a taller, slightly wider spine or they clip
    if (style === 'label' && (bk.title || '').length >= 24) { w = Math.max(w, 54); h = Math.max(h, 240); }
    const light = luminance(c) > 0.3;
    const look = { c, fg: light ? '#2A2118' : '#F4EBD8', light, style, w, h };
    LOOKS.set(bk.id, look);
    return look;
  }
  const SHELF_MARK = { school: 'NSC', y1: 'Year 1', y2: 'Year 2', y3: 'Year 3', y4: 'Hons' };
  // The visible spine. Used on the shelf (inside the button) and as the spine face of the open book.
  function spineFace(bk, shelf, look) {
    const st = state(bk), mark = bk.short || SHELF_MARK[shelf.id] || '';
    const pr = progressOf(bk);
    const bits = [];
    if (look.style === 'bands') bits.push('<span class="band t"></span><span class="band b"></span>');
    if (look.style === 'stamp') bits.push(`<span class="stampg">${GLYPH[bk.subject] || '∑'}</span>`);
    if (look.style === 'plain') bits.push(`<span class="glyph">${GLYPH[bk.subject] || '∑'}</span>`);
    if (look.style === 'caps') bits.push('<span class="band t"></span><span class="seal">研</span>');
    return `<span class="cloth" aria-hidden="true">${bits.join('')}<span class="tt${look.style === 'label' ? ' is-label' : ''}">${h(bk.title)}</span>
      ${st === 'soon' ? '<span class="soon">Soon</span>' : ''}<span class="mk">${h(mark)}</span>${pr && pr.pct > 0 ? `<span class="pr" style="--p:${pr.pct.toFixed(3)}"></span>` : ''}</span>`;
  }
  function bookLabel(bk, shelf) {
    const st = state(bk);
    return `${bk.title}. ${shelf.name}. ${st === 'soon' ? 'Coming soon' : st === 'current' ? 'Enrolled, studying now' : st === 'enrolled' ? 'Enrolled' : 'Open for enrolment'}.`;
  }
  function spineHTML(bk, shelf, i) {
    const st = state(bk), look = lookOf(bk);
    const cls = ['book', 'st-' + look.style];
    if (look.light) cls.push('is-light');
    if (st === 'soon') cls.push('is-soon');
    if (st === 'current' || st === 'enrolled') cls.push('is-enrolled');
    if (st === 'current') cls.push('is-current');
    if (bk.title.length >= 24) cls.push('long');
    return `<div class="slot" data-slot="${h(bk.id)}" style="--i:${i}"><div class="slot-y"><div class="slot-in">
      <button type="button" class="${cls.join(' ')}" style="--w:${look.w}px;--h:${look.h}px;--c:${look.c};--fg:${look.fg}" data-book="${h(bk.id)}" aria-label="${h(bookLabel(bk, shelf))}" aria-haspopup="dialog">${spineFace(bk, shelf, look)}</button>
    </div></div></div>`;
  }

  /* ---------- filters ---------- */
  const FILTERS = [['all', 'All'], ['maths', 'Mathematics'], ['stats', 'Statistics'], ['physics', 'Physics'], ['science', 'Science'], ['open', 'Open now']];
  if (!LIB.filter) LIB.filter = 'all';
  const passes = (bk, f) => f === 'all' || (f === 'open' ? bk.live : bk.subject === f);
  function chipsHTML() {
    const all = CourseCatalog.allBooks ? CourseCatalog.allBooks() : CourseCatalog.SHELVES.flatMap(s => s.books);
    return `<div class="lib-chips" role="group" aria-label="Show books">${FILTERS.map(([k, l]) => {
      const n = all.filter(b => passes(b, k)).length;
      return n ? `<button type="button" class="lchip" data-filter="${k}" aria-pressed="${LIB.filter === k}">${h(l)}<span class="n">${n}</span></button>` : '';
    }).join('')}</div>`;
  }

  /* ---------- shelves ---------- */
  // Within a level, books stand in runs by subject (maths, statistics, physics, science), catalogue order inside a run.
  function shelfBooks(shelf) {
    return shelf.books.map((b, i) => ({ b, i })).sort((x, y) => (SUBJECT_ORDER.indexOf(x.b.subject) - SUBJECT_ORDER.indexOf(y.b.subject)) || x.i - y.i).map(x => x.b);
  }
  function shelfHTML(shelf, si) {
    const live = shelf.books.filter(b => b.live).length, soon = shelf.books.length - live;
    const ct = [live ? `${live} open` : '', soon ? `${soon} coming soon` : ''].filter(Boolean).join(' · ');
    return `<section class="shelf" data-shelf-sec="${shelf.id}" aria-labelledby="shelf-${shelf.id}">
      <div class="shelf-h"><h2 id="shelf-${shelf.id}">${h(shelf.name)}</h2><span class="sub">${h(shelf.sub)}</span><span class="ct">${ct}</span></div>
      <div class="case is-entering" data-shelf="${shelf.id}" role="list">${shelfBooks(shelf).map((b, i) => spineHTML(b, shelf, i)).join('')}</div></section>`;
  }
  function coursesHTML() {
    loadToc();
    const cur = CourseCatalog.find(COURSE);
    const enrolled = enrolledIds().map(id => CourseCatalog.find(id)).filter(Boolean);
    return `<div class="library">
      <header class="lib-head"><div class="eyebrow">Library</div><h1>Courses</h1>
        <p class="lib-lead">Every course is a book. Pull one off the shelf to see its contents, then enrol. Shelves run from school foundations to honours.</p>
        <div class="lib-now">${cur ? `<span>Studying <b>${h(cur.title)}</b></span>` : ''}${enrolled.length > 1 ? `<span>${enrolled.length} courses enrolled</span>` : ''}<button class="btn ghost sm" type="button" data-act="home">Open course map</button></div>
        ${chipsHTML()}
      </header>
      ${CourseCatalog.SHELVES.map(shelfHTML).join('')}
      <p class="bk-note lib-hint">Hover or focus a spine for details. Arrow keys walk the shelves.</p>
      <p class="bk-note" style="margin-top:18px">University shelves are planned from the Mathematics, Statistics and Physics degrees at Oxford, MIT, Stanford, Harvard, UNISA and Wits, merged so each subject appears once.</p>
    </div>`;
  }

  /* ---------- placing the books: ShelfLayout, re-run on resize and on a filter ---------- */
  const PLANT = '<svg viewBox="0 0 80 112" width="64" height="90" aria-hidden="true"><g class="leaves"><path d="M40 74C37 52 25 38 9 35c4 18 15 31 31 39z" fill="#5E8A57"/><path d="M40 74c3-22 13-40 31-45-2 21-13 37-31 45z" fill="#4A7244"/><path d="M40 76C35 50 39 24 51 6c7 23 1 48-11 70z" fill="#6E9A63"/></g><path d="M19 74h42l-5 37H24z" fill="#B9694A"/><path d="M16 70h48v8H16z" fill="#CC7B57"/></svg>';
  function layoutCase(cs, animate) {
    const shelf = CourseCatalog.SHELVES.find(s => s.id === cs.dataset.shelf); if (!shelf) return;
    const width = cs.clientWidth; if (!width) return;
    const small = width < 560, k = small ? 0.84 : 1;
    const books = shelfBooks(shelf);
    const shown = books.filter(b => passes(b, LIB.filter));
    const sec = cs.closest('.shelf'); if (sec) sec.classList.toggle('is-empty', !shown.length);
    const L = ShelfLayout.layout(shown.map(b => { const lk = lookOf(b); return { id: b.id, w: Math.round(lk.w * k), h: Math.round(lk.h * k), group: b.subject, label: CourseCatalog.SUBJECTS[b.subject] }; }),
      width, { area: Math.round(252 * k), pad: small ? 12 : 22, groupGap: small ? 22 : 30 });
    cs.style.height = (L.height || 0) + 'px';
    cs.style.setProperty('--k', k);
    qsa(':scope > .plank, :scope > .plabel, :scope > .prop', cs).forEach(el => el.remove());
    cs.insertAdjacentHTML('afterbegin', L.planks.map((y, r) => `<div class="plank" aria-hidden="true" style="top:${y}px;--r:${r}"></div>`).join('') +
      L.labels.map(l => `<div class="plabel" aria-hidden="true" style="transform:translate(${l.x}px,${l.y}px)">${h(l.label)}<span class="n">${l.count}</span></div>`).join(''));
    if (L.rows) {
      const lastY = L.planks[L.rows - 1], endX = L.ends[L.rows - 1];
      if (L.free >= 120 && shelf.id === 'school') cs.insertAdjacentHTML('beforeend', `<div class="prop plant" style="transform:translate(${L.width - (small ? 76 : 92)}px,${lastY - 90}px)">${PLANT}</div>`);
      else if (L.free >= 44) cs.insertAdjacentHTML('beforeend', `<div class="prop bookend" aria-hidden="true" style="transform:translate(${endX + 12}px,${lastY - 52}px)"><span>研</span></div>`);
    }
    const rows = [];
    for (const b of books) {
      const slot = qs(`.slot[data-slot="${CSS.escape(b.id)}"]`, cs); if (!slot) continue;
      const p = L.pos[b.id], btn = qs('.book', slot);
      const was = slot.dataset.x != null;
      if (!was || !animate) slot.classList.add('jump');
      if (p) {
        slot.style.transform = `translateX(${p.x}px)`; qs('.slot-y', slot).style.transform = `translateY(${p.y}px)`;
        slot.dataset.x = p.x; slot.dataset.row = p.row;
        slot.removeAttribute('data-out'); btn.tabIndex = 0; btn.removeAttribute('aria-hidden');
        btn.style.setProperty('--w', Math.round(lookOf(b).w * k) + 'px'); btn.style.setProperty('--h', Math.round(lookOf(b).h * k) + 'px');
        (rows[p.row] = rows[p.row] || []).push({ el: btn, cx: p.x + lookOf(b).w * k / 2 });
      } else { slot.dataset.out = ''; btn.tabIndex = -1; btn.setAttribute('aria-hidden', 'true'); }
      if (slot.classList.contains('jump')) requestAnimationFrame(() => requestAnimationFrame(() => slot.classList.remove('jump')));
    }
    cs._rows = rows.filter(Boolean);
  }
  function layoutAll(animate) { qsa('.case[data-shelf]').forEach(cs => layoutCase(cs, animate)); }
  let RO = null;
  function mount() {
    if (typeof ResizeObserver !== 'undefined') {
      if (RO) RO.disconnect();
      RO = new ResizeObserver(entries => { for (const e of entries) layoutCase(e.target, false); });
      qsa('.case[data-shelf]').forEach(cs => RO.observe(cs));
    }
    layoutAll(false);
    const cases = qsa('.case.is-entering');
    if (reduced()) cases.forEach(c => c.classList.remove('is-entering'));
    else setTimeout(() => cases.forEach(c => c.classList.remove('is-entering')), 1700);
    if (!LIB.toc) loadToc();
  }
  function setFilter(f) {
    if (!FILTERS.some(([k]) => k === f)) f = 'all';
    LIB.filter = f;
    qsa('.lchip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === f)));
    hideTip();
    layoutAll(!reduced());
  }
  function refreshSpines() {
    for (const el of qsa('.book[data-book]')) {
      const bk = CourseCatalog.find(el.dataset.book); if (!bk) continue;
      const st = state(bk);
      const shelf = CourseCatalog.SHELVES.find(s => s.books.some(b => b.id === bk.id));
      el.classList.toggle('is-enrolled', st === 'current' || st === 'enrolled');
      el.classList.toggle('is-current', st === 'current');
      el.setAttribute('aria-label', bookLabel(bk, shelf));
      if (bk.live) el.innerHTML = spineFace(bk, shelf, lookOf(bk));
    }
    const now = qs('.lib-now b'); const cur = CourseCatalog.find(COURSE); if (now && cur) now.textContent = cur.title;
  }

  /* ---------- the tooltip over a spine ---------- */
  function tipFor(bk) {
    const st = state(bk);
    const status = st === 'soon' ? 'Coming soon' : st === 'current' ? 'Studying now' : st === 'enrolled' ? 'Enrolled' : 'Open for enrolment';
    const pr = progressOf(bk);
    let more = '';
    if (pr) more = pr.eta.done ? ' · all mastered' : ` · ${pctText(pr.pct)} · finish ${pr.eta.paceText || pr.eta.goalText}`;
    else if (!bk.live) more = ` · ${(bk.toc || []).length} planned topics`;
    return `<b>${h(bk.title)}</b><small>${h(status + more)}</small>`;
  }
  function tipEl() { let t = qs('#shelfTip'); if (!t) { t = document.createElement('div'); t.id = 'shelfTip'; t.className = 'shelf-tip'; t.setAttribute('role', 'presentation'); document.body.appendChild(t); } return t; }
  function showTip(btn) {
    if (LIB.open) return;
    const bk = CourseCatalog.find(btn.dataset.book); if (!bk) return;
    const t = tipEl(); t.innerHTML = tipFor(bk);
    const r = btn.getBoundingClientRect();
    t.classList.add('on');
    const tw = t.offsetWidth, th = t.offsetHeight;
    const x = Math.max(8, Math.min(innerWidth - tw - 8, r.left + r.width / 2 - tw / 2));
    const y = Math.max(8, r.top - th - 22);
    t.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
  }
  function hideTip() { const t = qs('#shelfTip'); if (t) t.classList.remove('on'); }

  /* ---------- covers, drawn in code ----------
     The two live courses get their own drawings. Every planned book gets a two-ink plate:
     a pale ink ground with a halftone, and a figure in the deep ink whose shape comes from
     the book's id, so no two plates are alike. */
  const f1 = n => Math.round(n * 10) / 10;
  function curvePath(fn, n) { let d = ''; for (let i = 0; i <= n; i++) { const [x, y] = fn(i / n); d += (i ? 'L' : 'M') + f1(x) + ' ' + f1(y); } return d; }
  function plateFigure(bk) {
    const x = hashOf(bk.id), a = 2 + (x % 5), b = 3 + ((x >>> 4) % 4), ph = ((x >>> 8) % 360) * Math.PI / 180;
    const cx = 60, cy = 60;
    if (bk.subject === 'stats') {
      const bars = Array.from({ length: 9 }, (_, i) => { const z = (i - 4) / 2; const hh = 70 * Math.exp(-z * z / 2) * (0.75 + (((x >>> i) & 7) / 28)); return `<rect x="${14 + i * 10.4}" y="${f1(98 - hh)}" width="8" height="${f1(hh)}"/>`; }).join('');
      return `<g fill="var(--ink2)" opacity=".55">${bars}</g><path d="${curvePath(t => [10 + t * 100, 98 - 74 * Math.exp(-(((t - 0.5) * 6) ** 2) / 2)], 60)}" fill="none" stroke="var(--ink1)" stroke-width="2"/><path d="M8 99H112" stroke="var(--ink1)" stroke-width="1.4"/>`;
    }
    if (bk.subject === 'physics') {
      const waves = [0, 1, 2].map(k => `<path d="${curvePath(t => [8 + t * 104, 60 + Math.sin(t * Math.PI * (a + k) + ph + k) * (26 - k * 7)], 80)}" fill="none" stroke="var(--ink1)" stroke-width="${2 - k * 0.5}" opacity="${1 - k * 0.25}"/>`).join('');
      return `<circle cx="${cx}" cy="${cy}" r="40" fill="var(--ink2)" opacity=".35"/>${waves}`;
    }
    if (bk.subject === 'science') {
      const s1 = curvePath(t => [cx + Math.sin(t * Math.PI * b + ph) * 26, 10 + t * 100], 80), s2 = curvePath(t => [cx - Math.sin(t * Math.PI * b + ph) * 26, 10 + t * 100], 80);
      const rungs = Array.from({ length: 12 }, (_, i) => { const t = (i + 0.5) / 12, dx = Math.sin(t * Math.PI * b + ph) * 26; return `<path d="M${f1(cx - dx)} ${f1(10 + t * 100)}H${f1(cx + dx)}"/>`; }).join('');
      return `<g stroke="var(--ink2)" stroke-width="1.6">${rungs}</g><path d="${s1}" fill="none" stroke="var(--ink1)" stroke-width="2"/><path d="${s2}" fill="none" stroke="var(--ink1)" stroke-width="2"/>`;
    }
    // maths: a rose or a Lissajous figure, picked and shaped by the id
    const rose = (x >>> 12) & 1;
    const d = rose
      ? curvePath(t => { const th = t * Math.PI * 2 * (a % 2 ? 1 : 2); const r = 44 * Math.cos(a * th + ph * 0); return [cx + r * Math.cos(th), cy + r * Math.sin(th)]; }, 360)
      : curvePath(t => [cx + 44 * Math.sin(a * t * Math.PI * 2 + ph), cy + 44 * Math.sin(b * t * Math.PI * 2)], 360);
    return `<circle cx="${cx}" cy="${cy}" r="47" fill="var(--ink2)" opacity=".35"/><path d="${d}" fill="none" stroke="var(--ink1)" stroke-width="1.6" stroke-linejoin="round"/>`;
  }
  function plateSVG(bk) {
    const id = 'ht' + (hashOf(bk.id) % 99991);
    return `<svg class="plate-svg" viewBox="0 0 120 120" role="presentation"><defs><pattern id="${id}" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r=".9" fill="var(--ink2)" opacity=".55"/></pattern></defs>
      <rect width="120" height="120" fill="var(--ink0)"/><rect width="120" height="120" fill="url(#${id})"/>${plateFigure(bk)}</svg>`;
  }
  const COVER_ART = {
    // Grade 12: a cyclic quadrilateral with a tangent and its equal angles, and a parabola behind it.
    'gr12-caps': `<svg class="cover-art" viewBox="0 0 160 160" fill="none" role="presentation">
      <path d="${curvePath(t => [10 + t * 140, 150 - 520 * (t - 0.5) ** 2 - 8], 60)}" stroke="#A33A2B" stroke-width="1.2" stroke-dasharray="3 4" opacity=".7"/>
      <circle cx="80" cy="78" r="48" stroke="#2A2118" stroke-width="1.6"/>
      <path d="M80 30 L122 98 L62 124 L36 62 Z" stroke="#2A2118" stroke-width="1.4"/>
      <path d="M22 30 L138 30" stroke="#A33A2B" stroke-width="1.6"/>
      <path d="M92 30 A12 12 0 0 1 86 40" stroke="#A33A2B" stroke-width="1.4"/><path d="M72 120 A12 12 0 0 1 66 112" stroke="#A33A2B" stroke-width="1.4"/>
      <g fill="#2A2118"><circle cx="80" cy="30" r="2.4"/><circle cx="122" cy="98" r="2.4"/><circle cx="62" cy="124" r="2.4"/><circle cx="36" cy="62" r="2.4"/><circle cx="80" cy="78" r="1.6"/></g>
      <g font-family="Georgia,serif" font-size="9" fill="#2A2118" font-style="italic"><text x="76" y="24">A</text><text x="127" y="102">B</text><text x="56" y="138">C</text><text x="24" y="60">D</text></g></svg>`,
    // Algebra & Trigonometry: the unit circle unrolled into a sine wave.
    algebra: `<svg class="cover-art" viewBox="0 0 160 160" fill="none" role="presentation">
      <circle cx="46" cy="80" r="30" stroke="#E2C27A" stroke-width="1.5"/><path d="M8 80H156M46 40V120" stroke="#E2C27A" stroke-width=".8" opacity=".5"/>
      <path d="M46 80 L67.2 58.8" stroke="#F4EBD8" stroke-width="1.5"/><path d="M58 80 A12 12 0 0 0 54.5 71.5" stroke="#F4EBD8" stroke-width="1.2"/>
      <path d="${curvePath(t => [76 + t * 80, 80 - 30 * Math.sin(t * Math.PI * 2)], 60)}" stroke="#E2C27A" stroke-width="1.6"/>
      <path d="M67.2 58.8 H88" stroke="#F4EBD8" stroke-width=".8" stroke-dasharray="2 3"/><circle cx="67.2" cy="58.8" r="2.4" fill="#F4EBD8"/>
      <text x="60" y="76" font-family="Georgia,serif" font-size="9" font-style="italic" fill="#F4EBD8">θ</text></svg>`,
  };
  function coverHTML(bk, shelf, look) {
    const soon = !bk.live;
    const inks = `--ink0:color-mix(in oklab, ${look.c} 16%, #F4ECDA);--ink1:color-mix(in oklab, ${look.c} 88%, #000);--ink2:color-mix(in oklab, ${look.c} 55%, #F4ECDA)`;
    const art = COVER_ART[bk.id] || `<div class="plate" style="${inks}">${plateSVG(bk)}</div>`;
    return `<div class="bk-front${COVER_ART[bk.id] ? ' has-art' : ' has-plate'}" aria-hidden="true"><span class="hinge"></span><div class="eyebrow">${h(shelf.name)}</div><h3>${h(bk.title)}</h3>
      ${soon ? '<span class="sticker">Coming soon</span>' : ''}<div class="art">${art}</div>
      <div class="foot"><span>Togisumasu</span><span>研</span></div></div>`;
  }

  /* ---------- the open book: left page ---------- */
  function etaHTML(bk) {
    const pr = progressOf(bk);
    if (!pr) return bk.live ? '<div class="bk-prog is-loading"><p class="bk-src">Working out your progress…</p></div>' : '';
    const { left, eta } = pr, goal = eta.goal;
    const line1 = eta.done ? 'Every topic is mastered. Reviews keep it sharp.'
      : `Finish <b>${h(eta.goalText)}</b> at your goal of ${goal} XP a day.`;
    const line2 = eta.done ? '' : eta.pace.source === 'log'
      ? `At your pace (${Math.round(eta.pace.xpPerDay)} XP a day): <b class="${eta.paceDays > eta.goalDays ? 'slow' : 'fast'}">${h(eta.paceText)}</b>.`
      : `Your own pace shows after ${Pace.PACE.minActiveDays} active days.`;
    return `<div class="bk-prog"><div class="meter" role="img" aria-label="${left.mastered} of ${left.total} topics mastered"><i style="width:${(pr.pct * 100).toFixed(1)}%"></i></div>
      <p class="bk-pct"><b>${pctText(pr.pct)}</b> · ${left.mastered} of ${left.total} topics mastered${left.held ? ` · ${left.held} waiting on a prerequisite` : ''}</p>
      <p class="bk-eta">${line1}${line2 ? '<br>' + line2 : ''}</p><p class="bk-goalnote">About ${eta.remainingXp} XP to go. Change your daily goal in Settings.</p></div>`;
  }
  function metaHTML(bk, shelf) {
    const st = state(bk);
    const pill = st === 'current' ? '<span class="bk-pill now">Studying now</span>' : st === 'enrolled' ? '<span class="bk-pill on">Enrolled</span>' : st === 'soon' ? '<span class="bk-pill">Coming soon</span>' : '<span class="bk-pill">Open for enrolment</span>';
    const toc = bk.live && LIB.toc && LIB.toc[bk.id];
    const count = bk.live ? (toc ? `${toc.units.length} units · ${toc.topicCount} topics` : '') : `${bk.toc.length} planned topics`;
    const src = bk.live ? '' : `<p class="bk-src">Draws on <b>${bk.sources.map(s => h(CourseCatalog.SOURCES[s].name)).join('</b>, <b>')}</b></p>`;
    const blurb = bk.blurb || (toc && toc.description) || '';
    return `<div class="bk-meta"><div class="eyebrow">${h(shelf.name)} · ${h(CourseCatalog.SUBJECTS[bk.subject])}</div>
      <h2 ${'id="bkTitle" tabindex="-1"'}>${h(bk.title)}</h2>${pill}${blurb ? `<p>${h(blurb.length > 220 ? blurb.slice(0, 217) + '…' : blurb)}</p>` : ''}
      ${count ? `<p class="bk-src">${h(count)}</p>` : ''}${src}${etaHTML(bk)}</div>`;
  }
  function actionsHTML(bk, justEnrolled) {
    const st = state(bk), others = enrolledIds().filter(x => x !== bk.id).length;
    if (st === 'soon') return `<div class="bk-actions"><button class="btn primary" type="button" disabled aria-disabled="true">Coming soon</button><button class="btn ghost" type="button" data-bk="close">Close</button><p class="bk-note" style="flex-basis:100%">We're still writing this one. The contents are the plan.</p></div>`;
    if (st === 'open') return `<div class="bk-actions"><button class="btn primary" type="button" data-bk="enroll">Enroll</button><button class="btn ghost" type="button" data-bk="close">Not now</button><p class="bk-note" style="flex-basis:100%">Enrolling makes this your current course. Your progress on shared topics carries over.</p></div>`;
    if (st === 'enrolled') return `<div class="bk-actions"><button class="btn primary" type="button" data-bk="switch">Study this course</button><button class="btn ghost" type="button" data-bk="leave">Leave course</button></div>`;
    return `<div class="bk-actions"><button class="btn primary" type="button" data-bk="start">${justEnrolled ? 'Start learning' : 'Open course map'}</button>${others ? '<button class="btn ghost" type="button" data-bk="leave">Leave course</button>' : '<button class="btn ghost" type="button" data-bk="close">Close</button>'}${justEnrolled ? '<p class="bk-note" style="flex-basis:100%">Enrolled. This is now your current course.</p>' : ''}</div>`;
  }
  /* ---------- the open book: right page ---------- */
  const SQ_LABEL = { mastered: 'Mastered', partial: 'Started', held: 'Needs a prerequisite', todo: 'Not started' };
  function squaresFor(bk) {
    const cat = catalogFor(bk.id); if (!cat) return null;
    const nextId = bk.id === COURSE && typeof recommended === 'function' ? ((recommended() || {}).id || null) : null;
    return Pace.topicStates(Store.data, cat, nextId);
  }
  function tocHTML(bk) {
    if (!bk.live) return `<ol class="toc flat">${bk.toc.map(t => `<li><div class="ch"><span>${h(t)}</span></div></li>`).join('')}</ol>`;
    const toc = LIB.toc && LIB.toc[bk.id];
    if (!toc) return `<div class="toc-load">${LIB.toc ? 'Contents unavailable offline.' : 'Turning to the contents…'}</div>`;
    const states = new Map((squaresFor(bk) || []).map(s => [s.id, s]));
    const open = state(bk) === 'open';
    const legend = `<div class="sq-legend" aria-hidden="true"><span><i class="sq mastered"></i>Mastered</span><span><i class="sq partial"></i>Started</span><span><i class="sq next"></i>Next</span><span><i class="sq held"></i>Needs a prerequisite</span></div>`;
    return legend + `<ol class="toc">${toc.units.map(u => {
      const ss = u.topics.map(t => states.get(t.id) || { id: t.id, name: t.name, state: 'todo' });
      const done = ss.filter(s => s.state === 'mastered').length;
      const sq = ss.map(s => `<i class="sq ${s.state}${s.next ? ' next' : ''}" title="${h(s.name || '')}: ${s.next ? 'up next' : SQ_LABEL[s.state].toLowerCase()}"></i>`).join('');
      return `<li><div class="ch"><span>${h(u.name)}</span><span class="n">${done}/${u.topics.length}</span></div>
        <div class="sqs" role="img" aria-label="${h(u.name)}: ${done} of ${u.topics.length} topics mastered">${sq}</div>
        <details class="tops-d"${open ? ' open' : ''}><summary>${u.topics.length} topic${u.topics.length === 1 ? '' : 's'}</summary>
        <ul class="tops">${ss.map((s, i) => `<li class="${u.topics[i].core ? 'core ' : ''}s-${s.state}${s.next ? ' s-next' : ''}">${h(u.topics[i].name)}</li>`).join('')}</ul></details></li>`;
    }).join('')}</ol>`;
  }
  function fillToc(o) { const host = qs('#bkToc'); if (host) host.innerHTML = tocHTML(o.bk); qsa('.bk-meta-host').forEach(el => { el.innerHTML = metaHTML(o.bk, o.shelf); }); dedupeIds(qs('#bookDlg'), o.g && o.g.single); }
  function fillActions(o, justEnrolled) { qsa('.bk-actions-host').forEach(el => { el.innerHTML = actionsHTML(o.bk, justEnrolled); }); qsa('.bk-meta-host').forEach(el => { el.innerHTML = metaHTML(o.bk, o.shelf); }); }

  function dialogHTML(bk, shelf) {
    const soon = !bk.live, look = lookOf(bk);
    return `<div class="bk-scrim" data-bk="close"></div>
      <button class="btn sm bk-close" type="button" data-bk="close" aria-label="Close book">Close ✕</button>
      <div class="bk-stage"><div class="bk3d" id="bk3d">
        <div class="bk-back"></div>
        <div class="bk-edge fore" aria-hidden="true"></div><div class="bk-edge top" aria-hidden="true"></div><div class="bk-edge bot" aria-hidden="true"></div>
        <div class="bk-spine" aria-hidden="true"><div class="book face st-${look.style}${look.light ? ' is-light' : ''}" style="--w:${look.w}px;--h:${look.h}px;--c:${look.c};--fg:${look.fg}">${spineFace(bk, shelf, look)}</div></div>
        <div class="bk-pages"><div class="bk-page">
          <div class="bk-meta-host">${metaHTML(bk, shelf)}</div>
          <div class="toc-h"><h3>Contents</h3><span>${soon ? 'Planned' : 'Topics'}</span></div>
          <div id="bkToc" class="toc-host">${tocHTML(bk)}</div>
          <div class="bk-actions-host">${actionsHTML(bk)}</div>
        </div></div>
        <div class="bk-cover">
          ${coverHTML(bk, shelf, look)}
          <div class="bk-inside"><div class="bk-meta-host">${metaHTML(bk, shelf)}</div><div class="bk-actions-host">${actionsHTML(bk)}</div></div>
        </div>
      </div></div>`;
  }
  // The single-page (phone) layout and the spread both render meta + actions twice; only one copy is visible.
  // Keep ids unique: the hidden copy loses its id.
  function dedupeIds(dlg, single) {
    const metas = qsa('.bk-meta-host', dlg);
    const hidden = single ? metas[1] : metas[0];
    const t = hidden && qs('#bkTitle', hidden); if (t) { t.removeAttribute('id'); t.removeAttribute('tabindex'); }
    qsa(single ? '.bk-inside button' : '.bk-page .bk-actions button', dlg).forEach(b => b.setAttribute('tabindex', '-1'));
    const inside = qs('.bk-inside', dlg); if (inside) inside.setAttribute('aria-hidden', single ? 'true' : 'false');
  }

  function geometry(spine) {
    const vw = innerWidth, vh = innerHeight, single = vw < 760;
    const W = Math.round(single ? Math.min(vw * 0.9, 440) : Math.min(420, (vw - 96) / 2));
    const H = Math.round(Math.max(380, Math.min(single ? vh * 0.84 : 580, vh - 88)));
    const r = spine.getBoundingClientRect();
    const s = Math.max(0.2, r.height / H);
    const D = Math.round(Math.max(22, Math.min(70, r.width / s)));
    const x0 = vw / 2 - W / 2, y0 = vh / 2;
    return { single, W, H, D, s, tx: r.left + r.width / 2 - x0, ty: r.top + r.height / 2 - y0 };
  }
  // Timing (ms) and paper-like easing: a quick lift that settles softly, and a page turn that
  // starts slowly (the paper lifts), speeds through the middle and lands without a bounce.
  const T = { total: 1100, turnEnd: 520, coverAt: 440, coverClose: 480 };
  const EASE = {
    lift: 'cubic-bezier(.22,.9,.28,1)',
    page: 'cubic-bezier(.62,.04,.24,1)',
    pageBack: 'cubic-bezier(.5,0,.3,1)',
    home: 'cubic-bezier(.55,.06,.35,1)',
  };
  function coverOpenFrames(single) {
    return single
      ? [{ transform: 'translateZ(1px) rotateY(0deg)', opacity: 1 }, { transform: 'translateZ(1px) rotateY(-120deg)', opacity: 1, offset: 0.6 }, { transform: 'translateZ(1px) rotateY(-180deg)', opacity: 0 }]
      : [{ transform: 'translateZ(1px) rotateY(0deg)' }, { transform: 'translateZ(1px) rotateY(-180deg)' }];
  }
  const closedAt = g => `translate(${g.tx}px,${g.ty}px) scale(${g.s}) rotateY(90deg)`;
  const IDLE = 'translate(0px,0px) scale(1) rotateY(0deg)';
  const spreadAt = g => `translate(${g.single ? 0 : g.W / 2}px,0px) scale(1) rotateY(0deg)`;
  function stopAnims() { for (const a of LIB.anims) { try { a.commitStyles && a.commitStyles(); } catch (e) {} a.cancel(); } LIB.anims = []; }
  const run = (el, frames, opts) => { const a = el.animate(frames, { fill: 'forwards', ...opts }); LIB.anims.push(a); return a.finished; };

  async function openBook(spine) {
    if (LIB.busy || LIB.open) return;
    const bk = CourseCatalog.find(spine.dataset.book); if (!bk) return;
    const shelf = CourseCatalog.SHELVES.find(s => s.books.some(b => b.id === bk.id));
    const dlg = qs('#bookDlg'); if (!dlg) return;
    LIB.busy = true;
    const g = geometry(spine);
    dlg.innerHTML = dialogHTML(bk, shelf);
    const b3 = qs('#bk3d', dlg), cover = qs('.bk-cover', dlg);
    b3.classList.toggle('single', g.single);
    b3.style.cssText = `--W:${g.W}px;--H:${g.H}px;--D:${g.D}px;transform-origin:0 50% ${-g.D / 2}px;`;
    // binding colours come from the spine on the shelf
    const look = lookOf(bk); b3.style.setProperty('--c', look.c); b3.style.setProperty('--ink', look.fg);
    const face = qs('.bk-spine .face', dlg); if (face) face.style.transform = `scale(${(g.H / look.h).toFixed(4)})`;
    hideTip();
    if (!reduced()) dlg.classList.add('will-reveal');
    dedupeIds(dlg, g.single);
    LIB.open = { bk, shelf, spine, g };
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    try { history.replaceState(null, '', location.pathname + location.search + '#courses/' + bk.id); } catch (e) {}
    if (reduced()) {
      cover.style.transform = 'translateZ(1px) rotateY(-180deg)'; if (g.single) cover.style.opacity = '0';
      b3.style.transform = spreadAt(g); dlg.classList.add('is-open'); spine.classList.add('is-out');
      await run(b3, [{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
    } else {
      b3.style.transform = closedAt(g);
      requestAnimationFrame(() => { spine.classList.add('is-out'); dlg.classList.add('is-open'); });
      // One continuous ~1.1 s move: the book lifts off the shelf and turns to its cover, and the cover
      // starts to peel open just before the book settles, like a page being lifted.
      await Promise.all([
        run(b3, [
          { transform: closedAt(g), easing: EASE.lift },
          { transform: IDLE, offset: T.turnEnd / T.total, easing: EASE.page },
          { transform: spreadAt(g) },
        ], { duration: T.total }),
        run(cover, coverOpenFrames(g.single), { duration: T.total - T.coverAt, delay: T.coverAt, easing: EASE.page, fill: 'both' }),
      ]);
    }
    if (g.single) b3.classList.add('settled');
    dlg.classList.add('is-settled');
    LIB.busy = false;
    const t = qs('#bkTitle', dlg); if (t) t.focus({ preventScroll: true });
  }

  async function closeBook(after) {
    const o = LIB.open; const dlg = qs('#bookDlg');
    if (!o || LIB.busy) return;
    LIB.busy = true;
    const b3 = qs('#bk3d', dlg), cover = qs('.bk-cover', dlg);
    b3.classList.remove('settled');
    const spine = qs(`.book[data-book="${CSS.escape(o.bk.id)}"]`) || o.spine;
    if (reduced() || after === 'go' || !spine || !document.body.contains(spine)) {
      dlg.classList.remove('is-open');
      await run(b3, [{ opacity: 1 }, { opacity: 0 }], { duration: reduced() ? 120 : 200 });
    } else {
      const g = { ...o.g, ...(() => { const n = geometry(spine); return { tx: n.tx, ty: n.ty, s: n.s }; })() };
      stopAnims();
      // The same move in reverse: the cover closes, then the book turns back to its spine and slides home.
      const scrim = setTimeout(() => dlg.classList.remove('is-open'), T.coverClose);
      await Promise.all([
        run(cover, coverOpenFrames(o.g.single).slice().reverse().map(f => ({ ...f, offset: f.offset == null ? undefined : 1 - f.offset })), { duration: T.coverClose, easing: EASE.pageBack }),
        run(b3, [
          { transform: spreadAt(o.g), easing: EASE.pageBack },
          { transform: IDLE, offset: T.coverClose / T.total, easing: EASE.home },
          { transform: closedAt(g) },
        ], { duration: T.total }),
      ]);
      clearTimeout(scrim); dlg.classList.remove('is-open');
    }
    stopAnims();
    if (spine) spine.classList.remove('is-out');
    dlg.close ? dlg.close() : dlg.removeAttribute('open');
    dlg.innerHTML = ''; dlg.classList.remove('will-reveal', 'is-settled');
    LIB.open = null; LIB.busy = false;
    if (location.hash.startsWith('#courses/')) { try { history.replaceState(null, '', location.pathname + location.search + '#courses'); } catch (e) {} }
    if (after === 'go') go({ name: 'home' });
    else if (spine && document.body.contains(spine)) spine.focus({ preventScroll: true });
  }

  /* ---------- events ---------- */
  document.addEventListener('click', e => {
    const chip = e.target.closest && e.target.closest('.lchip[data-filter]');
    if (chip) { setFilter(chip.dataset.filter); return; }
    const spine = e.target.closest('.book[data-book]');
    if (spine && !spine.classList.contains('face')) { e.preventDefault(); hideTip(); openBook(spine); return; }
    const act = e.target.closest('[data-bk]');
    if (!act || !LIB.open) return;
    const o = LIB.open, a = act.dataset.bk;
    if (a === 'close') { closeBook(); return; }
    if (a === 'start') { closeBook('go'); return; }
    if (a === 'enroll' || a === 'switch' || a === 'leave') {
      act.disabled = true;
      const p = a === 'enroll' ? enroll(o.bk.id) : a === 'switch' ? switchTo(o.bk.id) : leave(o.bk.id);
      p.then(() => { fillActions(o, a === 'enroll'); fillToc(o); dedupeIds(qs('#bookDlg'), o.g.single); refreshSpines();
        const first = qsa('.bk-actions .btn:not([tabindex="-1"])', qs('#bookDlg'))[0]; if (first) first.focus(); })
        .catch(() => { act.disabled = false; });
    }
  });
  const hoverable = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
  document.addEventListener('pointerover', e => { const b = e.target.closest && e.target.closest('.case .book[data-book]'); if (b && hoverable()) showTip(b); });
  document.addEventListener('pointerout', e => { const b = e.target.closest && e.target.closest('.case .book[data-book]'); if (b && !b.contains(e.relatedTarget)) hideTip(); });
  document.addEventListener('focusin', e => { const b = e.target.closest && e.target.closest('.case .book[data-book]'); if (b && b.matches(':focus-visible')) showTip(b); else hideTip(); });
  addEventListener('scroll', hideTip, { passive: true });
  document.addEventListener('cancel', e => { if (e.target.id === 'bookDlg') { e.preventDefault(); closeBook(); } }, true);

  // Arrow keys walk the shelves: left and right along the books in reading order, up and down to the
  // nearest book on the plank above or below (across levels too). Home and End jump within a level.
  function planks() {
    const out = [];
    qsa('.case[data-shelf]').forEach((cs, si) => (cs._rows || []).forEach(r => out.push({ si, books: r.slice().sort((a, b) => a.cx - b.cx) })));
    return out;
  }
  function neighbour(b, key) {
    const P = planks(); let pi = -1, bi = -1;
    P.forEach((p, i) => { const j = p.books.findIndex(x => x.el === b); if (j >= 0) { pi = i; bi = j; } });
    if (pi < 0) return null;
    const flat = P.flatMap(p => p.books), here = P[pi].books[bi], fi = flat.indexOf(here);
    if (key === 'ArrowRight') return (flat[fi + 1] || {}).el;
    if (key === 'ArrowLeft') return (flat[fi - 1] || {}).el;
    const same = P.filter(p => p.si === P[pi].si).flatMap(p => p.books);
    if (key === 'Home') return (same[0] || {}).el;
    if (key === 'End') return (same[same.length - 1] || {}).el;
    const p2 = P[pi + (key === 'ArrowDown' ? 1 : -1)]; if (!p2) return null;
    return p2.books.reduce((best, x) => (!best || Math.abs(x.cx - here.cx) < Math.abs(best.cx - here.cx) ? x : best), null).el;
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && LIB.open) { e.preventDefault(); closeBook(); return; }
    const b = e.target.closest && e.target.closest('.case .book[data-book]'); if (!b) return;
    if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
    const next = neighbour(b, e.key);
    if (next) { e.preventDefault(); next.focus({ preventScroll: true }); next.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }); }
  });

  window.Courses = { coursesHTML, mount, setFilter, enrolledIds, openBook, closeBook, loadToc, state, lookOf, refreshSpines,
    openById(id) { const s = qs(`.book[data-book="${CSS.escape(id)}"]`); if (s) openBook(s); } };
})();
