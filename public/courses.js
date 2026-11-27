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
      .finally(() => { LIB.loading = null; if (LIB.open) fillToc(LIB.open); });
    return LIB.loading;
  }

  /* ---------- shelves ---------- */
  const SUBJECT_CLASS = { maths: 's-maths', stats: 's-stats', physics: 's-physics', science: 's-science' };
  const SHELF_MARK = { school: 'NSC', y1: 'Year 1', y2: 'Year 2', y3: 'Year 3', y4: 'Hons' };
  function spineHTML(bk, shelf) {
    const st = state(bk), x = hashOf(bk.id);
    const hk = bk.live ? 1 : (0.9 + (x % 9) / 100).toFixed(2);
    const wk = (bk.live ? 1.12 : 0.92 + ((x >> 4) % 4) * 0.06).toFixed(2);
    const cls = ['book', SUBJECT_CLASS[bk.subject] || 's-maths', 'v' + (1 + ((x >> 8) % 4))];
    if (bk.id === 'gr12-caps') cls.push('b-caps');
    if (bk.id === 'algebra') cls.push('b-algebra');
    if (st === 'soon') cls.push('is-soon');
    if (st === 'current' || st === 'enrolled') cls.push('is-enrolled');
    if (st === 'current') cls.push('is-current');
    if (bk.title.length > 26) cls.push('long');
    const label = `${bk.title}. ${shelf.name}. ${st === 'soon' ? 'Coming soon' : st === 'current' ? 'Enrolled, studying now' : st === 'enrolled' ? 'Enrolled' : 'Open for enrolment'}.`;
    return `<li><button type="button" class="${cls.join(' ')}" style="--h:${(226 * hk).toFixed(0)}px;--w:${(54 * wk).toFixed(0)}px" data-book="${h(bk.id)}" aria-label="${h(label)}" aria-haspopup="dialog">
      <span class="band t" aria-hidden="true"></span><span class="tt" aria-hidden="true">${h(bk.title)}</span>
      ${st === 'soon' ? '<span class="soon" aria-hidden="true">Soon</span>' : ''}${bk.id === 'gr12-caps' ? '<span class="seal" aria-hidden="true">研</span>' : '<span class="band b" aria-hidden="true"></span>'}
      <span class="mk" aria-hidden="true">${h(bk.short || SHELF_MARK[shelf.id] || '')}</span></button></li>`;
  }
  function shelfHTML(shelf) {
    const live = shelf.books.filter(b => b.live).length, soon = shelf.books.length - live;
    const ct = [live ? `${live} open` : '', soon ? `${soon} coming soon` : ''].filter(Boolean).join(' · ');
    return `<section class="shelf" aria-labelledby="shelf-${shelf.id}">
      <div class="shelf-h"><h2 id="shelf-${shelf.id}">${h(shelf.name)}</h2><span class="sub">${h(shelf.sub)}</span><span class="ct">${ct}</span></div>
      <div class="shelf-cab"><div class="shelf-scroll"><ul class="shelf-row" data-shelf="${shelf.id}">${shelf.books.map(b => spineHTML(b, shelf)).join('')}
        <li class="bookend" aria-hidden="true"><span>研</span></li></ul></div></div></section>`;
  }
  function coursesHTML() {
    loadToc();
    const cur = CourseCatalog.find(COURSE);
    const enrolled = enrolledIds().map(id => CourseCatalog.find(id)).filter(Boolean);
    const sw = k => `<i style="--c:var(--sp-${k}-1)"></i>`;
    return `<div class="library">
      <header class="lib-head"><div class="eyebrow">Library</div><h1>Courses</h1>
        <p class="lib-lead">Every course is a book. Pull one off the shelf to see its contents, then enrol. Shelves run from school foundations to honours.</p>
        <div class="lib-now">${cur ? `<span>Studying <b>${h(cur.title)}</b></span>` : ''}${enrolled.length > 1 ? `<span>${enrolled.length} courses enrolled</span>` : ''}<button class="btn ghost sm" type="button" data-act="home">Open course map</button></div>
        <ul class="lib-legend" aria-label="Spine colours"><li>${sw('maths')}Mathematics</li><li>${sw('stats')}Statistics</li><li>${sw('phys')}Physics</li><li><i class="rib"></i>Enrolled</li></ul>
      </header>
      ${CourseCatalog.SHELVES.map(shelfHTML).join('')}
      <p class="bk-note" style="margin-top:28px">University shelves are planned from the Mathematics, Statistics and Physics degrees at Oxford, MIT, Stanford, Harvard, UNISA and Wits, merged so each subject appears once.</p>
    </div>`;
  }
  function refreshSpines() {
    for (const el of qsa('.book[data-book]')) {
      const bk = CourseCatalog.find(el.dataset.book); if (!bk) continue;
      const st = state(bk);
      el.classList.toggle('is-enrolled', st === 'current' || st === 'enrolled');
      el.classList.toggle('is-current', st === 'current');
    }
    const now = qs('.lib-now b'); const cur = CourseCatalog.find(COURSE); if (now && cur) now.textContent = cur.title;
  }

  /* ---------- the open book ---------- */
  const ART = {
    maths: '<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="60" cy="60" r="44"/><path d="M60 16 L98 82 L22 82 Z"/><path d="M8 104 L112 16" stroke-dasharray="3 4"/><circle cx="60" cy="60" r="2" fill="currentColor"/></svg>',
    stats: '<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 96 C 32 96 38 26 60 26 C 82 26 88 96 112 96"/><path d="M8 100 H112"/><g stroke-width="1"><path d="M30 100 V84 M42 100 V58 M54 100 V34 M66 100 V34 M78 100 V58 M90 100 V84"/></g></svg>',
    physics: '<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="1.4"><ellipse cx="60" cy="60" rx="50" ry="18"/><ellipse cx="60" cy="60" rx="50" ry="18" transform="rotate(60 60 60)"/><ellipse cx="60" cy="60" rx="50" ry="18" transform="rotate(120 60 60)"/><circle cx="60" cy="60" r="5" fill="currentColor"/></svg>',
    science: '<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M40 8 C 40 38 80 38 80 60 C 80 82 40 82 40 112"/><path d="M80 8 C 80 38 40 38 40 60 C 40 82 80 82 80 112"/><g stroke-width="1"><path d="M46 20 H74 M56 32 H64 M46 48 H74 M46 72 H74 M56 88 H64 M46 100 H74"/></g></svg>',
  };
  function metaHTML(bk, shelf) {
    const st = state(bk);
    const pill = st === 'current' ? '<span class="bk-pill now">Studying now</span>' : st === 'enrolled' ? '<span class="bk-pill on">Enrolled</span>' : st === 'soon' ? '<span class="bk-pill">Coming soon</span>' : '<span class="bk-pill">Open for enrolment</span>';
    const toc = bk.live && LIB.toc && LIB.toc[bk.id];
    const count = bk.live ? (toc ? `${toc.units.length} units · ${toc.topicCount} topics` : '') : `${bk.toc.length} planned topics`;
    const src = bk.live ? '' : `<p class="bk-src">Draws on <b>${bk.sources.map(s => h(CourseCatalog.SOURCES[s].name)).join('</b>, <b>')}</b></p>`;
    const blurb = bk.blurb || (toc && toc.description) || '';
    return `<div class="bk-meta"><div class="eyebrow">${h(shelf.name)} · ${h(CourseCatalog.SUBJECTS[bk.subject])}</div>
      <h2 ${'id="bkTitle" tabindex="-1"'}>${h(bk.title)}</h2>${pill}${blurb ? `<p>${h(blurb.length > 220 ? blurb.slice(0, 217) + '…' : blurb)}</p>` : ''}
      ${count ? `<p class="bk-src">${h(count)}</p>` : ''}${src}</div>`;
  }
  function actionsHTML(bk, justEnrolled) {
    const st = state(bk), others = enrolledIds().filter(x => x !== bk.id).length;
    if (st === 'soon') return `<div class="bk-actions"><button class="btn primary" type="button" disabled aria-disabled="true">Coming soon</button><button class="btn ghost" type="button" data-bk="close">Close</button><p class="bk-note" style="flex-basis:100%">We're still writing this one. The contents are the plan.</p></div>`;
    if (st === 'open') return `<div class="bk-actions"><button class="btn primary" type="button" data-bk="enroll">Enroll</button><button class="btn ghost" type="button" data-bk="close">Not now</button><p class="bk-note" style="flex-basis:100%">Enrolling makes this your current course. Your progress on shared topics carries over.</p></div>`;
    if (st === 'enrolled') return `<div class="bk-actions"><button class="btn primary" type="button" data-bk="switch">Study this course</button><button class="btn ghost" type="button" data-bk="leave">Leave course</button></div>`;
    return `<div class="bk-actions"><button class="btn primary" type="button" data-bk="start">${justEnrolled ? 'Start learning' : 'Open course map'}</button>${others ? '<button class="btn ghost" type="button" data-bk="leave">Leave course</button>' : '<button class="btn ghost" type="button" data-bk="close">Close</button>'}${justEnrolled ? '<p class="bk-note" style="flex-basis:100%">Enrolled. This is now your current course.</p>' : ''}</div>`;
  }
  function tocHTML(bk) {
    if (!bk.live) return `<ol class="toc flat">${bk.toc.map(t => `<li><div class="ch"><span>${h(t)}</span></div></li>`).join('')}</ol>`;
    const toc = LIB.toc && LIB.toc[bk.id];
    if (!toc) return `<div class="toc-load">${LIB.toc ? 'Contents unavailable offline.' : 'Turning to the contents…'}</div>`;
    return `<ol class="toc">${toc.units.map(u => `<li><div class="ch"><span>${h(u.name)}</span><span class="n">${u.topics.length} topic${u.topics.length === 1 ? '' : 's'}</span></div>
      <ul class="tops">${u.topics.map(t => `<li${t.core ? ' class="core"' : ''}>${h(t.name)}</li>`).join('')}</ul></li>`).join('')}</ol>`;
  }
  function fillToc(o) { const host = qs('#bkToc'); if (host) host.innerHTML = tocHTML(o.bk); qsa('.bk-meta-host').forEach(el => { el.innerHTML = metaHTML(o.bk, o.shelf); }); }
  function fillActions(o, justEnrolled) { qsa('.bk-actions-host').forEach(el => { el.innerHTML = actionsHTML(o.bk, justEnrolled); }); qsa('.bk-meta-host').forEach(el => { el.innerHTML = metaHTML(o.bk, o.shelf); }); }

  function dialogHTML(bk, shelf) {
    const soon = !bk.live;
    return `<div class="bk-scrim" data-bk="close"></div>
      <button class="btn sm bk-close" type="button" data-bk="close" aria-label="Close book">Close ✕</button>
      <div class="bk-stage"><div class="bk3d" id="bk3d">
        <div class="bk-back"></div>
        <div class="bk-spine"><span class="tt">${h(bk.title)}</span></div>
        <div class="bk-pages"><div class="bk-page">
          <div class="bk-meta-host">${metaHTML(bk, shelf)}</div>
          <div class="toc-h"><h3>Contents</h3><span>${soon ? 'Planned' : 'Topics'}</span></div>
          <div id="bkToc" style="display:contents">${tocHTML(bk)}</div>
          <div class="bk-actions-host">${actionsHTML(bk)}</div>
        </div></div>
        <div class="bk-cover">
          <div class="bk-front" aria-hidden="true"><div class="eyebrow">${h(shelf.name)}</div><h3>${h(bk.title)}</h3>
            ${soon ? '<span class="sticker">Coming soon</span>' : ''}<div class="art">${ART[bk.subject] || ART.maths}</div>
            <div class="foot"><span>Togisumasu</span><span>研</span></div></div>
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
    const cs = getComputedStyle(spine); b3.style.setProperty('--c', cs.getPropertyValue('--c')); b3.style.setProperty('--ink', cs.getPropertyValue('--ink'));
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
      await run(b3, [{ transform: closedAt(g) }, { transform: IDLE }], { duration: 640, easing: 'cubic-bezier(.22,.8,.18,1)' });
      const coverFrames = g.single
        ? [{ transform: 'translateZ(1px) rotateY(0deg)', opacity: 1 }, { transform: 'translateZ(1px) rotateY(-120deg)', opacity: 1, offset: 0.6 }, { transform: 'translateZ(1px) rotateY(-180deg)', opacity: 0 }]
        : [{ transform: 'translateZ(1px) rotateY(0deg)' }, { transform: 'translateZ(1px) rotateY(-180deg)' }];
      await Promise.all([
        run(cover, coverFrames, { duration: 820, easing: 'cubic-bezier(.5,.05,.2,1)' }),
        run(b3, [{ transform: IDLE }, { transform: spreadAt(g) }], { duration: 820, easing: 'cubic-bezier(.5,.05,.2,1)' }),
      ]);
    }
    if (g.single) b3.classList.add('settled');
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
      const coverFrames = o.g.single
        ? [{ transform: 'translateZ(1px) rotateY(-180deg)', opacity: 0 }, { transform: 'translateZ(1px) rotateY(-120deg)', opacity: 1, offset: 0.4 }, { transform: 'translateZ(1px) rotateY(0deg)', opacity: 1 }]
        : [{ transform: 'translateZ(1px) rotateY(-180deg)' }, { transform: 'translateZ(1px) rotateY(0deg)' }];
      stopAnims();
      await Promise.all([
        run(cover, coverFrames, { duration: 560, easing: 'cubic-bezier(.4,0,.2,1)' }),
        run(b3, [{ transform: spreadAt(o.g) }, { transform: IDLE }], { duration: 560, easing: 'cubic-bezier(.4,0,.2,1)' }),
      ]);
      dlg.classList.remove('is-open');
      await run(b3, [{ transform: IDLE }, { transform: closedAt(g) }], { duration: 520, easing: 'cubic-bezier(.6,0,.4,1)' });
    }
    stopAnims();
    if (spine) spine.classList.remove('is-out');
    dlg.close ? dlg.close() : dlg.removeAttribute('open');
    dlg.innerHTML = '';
    LIB.open = null; LIB.busy = false;
    if (location.hash.startsWith('#courses/')) { try { history.replaceState(null, '', location.pathname + location.search + '#courses'); } catch (e) {} }
    if (after === 'go') go({ name: 'home' });
    else if (spine && document.body.contains(spine)) spine.focus({ preventScroll: true });
  }

  /* ---------- events ---------- */
  document.addEventListener('click', e => {
    const spine = e.target.closest('.book[data-book]');
    if (spine) { e.preventDefault(); openBook(spine); return; }
    const act = e.target.closest('[data-bk]');
    if (!act || !LIB.open) return;
    const o = LIB.open, a = act.dataset.bk;
    if (a === 'close') { closeBook(); return; }
    if (a === 'start') { closeBook('go'); return; }
    if (a === 'enroll' || a === 'switch' || a === 'leave') {
      act.disabled = true;
      const p = a === 'enroll' ? enroll(o.bk.id) : a === 'switch' ? switchTo(o.bk.id) : leave(o.bk.id);
      p.then(() => { fillActions(o, a === 'enroll'); dedupeIds(qs('#bookDlg'), o.g.single); refreshSpines();
        const first = qsa('.bk-actions .btn:not([tabindex="-1"])', qs('#bookDlg'))[0]; if (first) first.focus(); })
        .catch(() => { act.disabled = false; });
    }
  });
  document.addEventListener('cancel', e => { if (e.target.id === 'bookDlg') { e.preventDefault(); closeBook(); } }, true);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && LIB.open) { e.preventDefault(); closeBook(); return; }
    const b = e.target.closest && e.target.closest('.book[data-book]'); if (!b) return;
    const row = b.closest('.shelf-row'), books = qsa('.book', row), i = books.indexOf(b);
    let next = null;
    if (e.key === 'ArrowRight') next = books[i + 1];
    else if (e.key === 'ArrowLeft') next = books[i - 1];
    else if (e.key === 'Home') next = books[0];
    else if (e.key === 'End') next = books[books.length - 1];
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const rows = qsa('.shelf-row'), r = rows[rows.indexOf(row) + (e.key === 'ArrowDown' ? 1 : -1)];
      if (r) { const bs = qsa('.book', r); next = bs[Math.min(i, bs.length - 1)]; }
    }
    if (next) { e.preventDefault(); next.focus(); next.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }); }
  });

  window.Courses = { coursesHTML, enrolledIds, openBook, closeBook, loadToc, state, openById(id) { const s = qs(`.book[data-book="${CSS.escape(id)}"]`); if (s) openBook(s); } };
})();
