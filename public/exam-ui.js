/* ===== exam UI: picker, start screen, paper accordion, review and results =====
   Loaded before the app script; uses its globals at call time (go, view, Store, API,
   esc, typeset, plainTex). Attempt state and maths live in exam.js (window.Exam). */
'use strict';
(function () {
  const E = window.Exam;
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const HEARTBEAT_MS = 15000;
  const S = { list: null, papers: {}, paper: null, attempt: null, clock: null, beat: 0, said: new Set(), open: new Set(), saveT: null, io: null };

  /* ---------- helpers ---------- */
  const h = s => esc(s == null ? '' : s);
  const marksTxt = n => `${n} mark${n === 1 ? '' : 's'}`;
  const dateTxt = t => { try { return new Date(t).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } };
  const paperId = () => view && view.id;
  const ICON_FLAG = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 17.5V3.2M5 3.6c3.2-1.6 5.2 1.4 9.6-.2v7.2c-4.4 1.6-6.4-1.4-9.6.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_CHEV = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 7.8 10 12.3l4.5-4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function commit(a, { now = false } = {}) {
    S.attempt = a;
    clearTimeout(S.saveT);
    const write = () => { Store.data = a ? E.saveCurrent(Store.data, a.paperId, a) : Store.data; Store.save(); };
    if (now) write(); else S.saveT = setTimeout(write, 450);
  }
  function flush() { if (S.saveT) { clearTimeout(S.saveT); S.saveT = null; if (S.attempt) { Store.data = E.saveCurrent(Store.data, S.attempt.paperId, S.attempt); Store.save(); } } }

  async function loadPaper(id) {
    if (S.papers[id]) return S.papers[id];
    const r = await API.req('GET', '/api/exams/' + encodeURIComponent(id));
    S.papers[id] = r.exam;
    return r.exam;
  }

  /* ---------- picker ---------- */
  async function openList() {
    try { S.list = (await API.req('GET', '/api/exams')).exams || []; } catch (e) { S.list = S.list || []; }
    go({ name: 'exams' });
  }
  function statusHTML(p) {
    const cur = E.current(Store.data, p.id);
    if (cur) {
      if (cur.status === 'review') return cur.timeUp ? '<span class="xstat due">Time’s up · submit to see marks</span>' : '<span class="xstat due">Ready to submit</span>';
      return `<span class="xstat live"><i aria-hidden="true"></i>In progress · ${E.formatClock(E.remainingMs(E.recover(cur), Date.now()))} left</span>`;
    }
    const last = E.lastSummary(Store.data, p.id);
    if (last) return `<span class="xstat">Last: <b class="tnum">${last.earned}/${last.auto}</b> auto-marked${last.auto ? ` · ${Math.round(last.earned / last.auto * 100)}%` : ''} · ${dateTxt(last.at)}</span>`;
    return '<span class="xstat muted">Not attempted</span>';
  }
  function listHTML() {
    const list = S.list || [];
    const years = [...new Set(list.map(p => p.year))].sort((a, b) => b - a);
    const card = p => `<article class="xcard washi-paper">
        <div class="eyebrow">Paper ${p.paper}</div>
        <h3><button type="button" class="xcard-btn" data-exam-open="${h(p.id)}">${h(p.title)}</button></h3>
        <p class="xcard-topics">${p.topics.map(h).join('<span aria-hidden="true"> · </span>')}</p>
        <p class="xcard-meta tnum">${Math.round(p.durationMinutes / 60 * 10) / 10} hours · ${p.totalMarks} marks · ${p.questionCount} questions</p>
        ${statusHTML(p)}
      </article>`;
    return `<section class="xlib">
      <div class="crumb"><button class="btn ghost sm" type="button" data-act="home">← Course map</button></div>
      <header class="xlib-head"><div class="eyebrow">Mock exams</div><h1>NSC past papers</h1>
        <p class="lead">Full November papers from 2022 on, timed like the real thing. They never appear in quizzes, so they stay fresh for exam practice. Your answers and time are saved as you go.</p></header>
      ${years.length ? years.map(y => `<section class="xyear" aria-labelledby="xy-${y}"><h2 id="xy-${y}">${y}</h2><div class="xcards">${list.filter(p => p.year === y).sort((a, b) => a.paper - b.paper).map(card).join('')}</div></section>`).join('') : '<p class="gnote">No exam papers are loaded yet.</p>'}
    </section>`;
  }

  /* ---------- mount ---------- */
  async function mount() {
    const host = qs('#examHost'); if (!host) return;
    flush();
    const id = paperId();
    let paper;
    host.innerHTML = '<div class="boot">Opening the paper…</div>';
    try { paper = await loadPaper(id); } catch (e) { host.innerHTML = `<p class="warn">Could not open this paper. ${h(e.message)}</p>`; return; }
    if (!qs('#examHost') || paperId() !== id) return;
    S.paper = paper;
    let a = E.recover(E.current(Store.data, id));
    let phase = view.phase || 'start';
    if (a && a.status === 'active' && E.remainingMs(a, Date.now()) <= 0) a = E.tick({ ...a, resumedAt: Date.now() }, Date.now());
    if (phase === 'paper' && !a) phase = 'start';
    if (phase === 'paper' && a && a.status === 'review') { if (a.timeUp) phase = 'review'; else a = E.backToPaper(a, Date.now()); }
    if (phase === 'review' && a && a.status === 'active') a = E.toReview(a, Date.now());
    if (phase === 'review' && !a) phase = 'start';
    if (phase === 'results' && !E.slot(Store.data, id).last) phase = 'start';
    if (phase !== 'paper' && a && a.resumedAt != null) a = E.pause(a, Date.now());
    if (phase === 'paper' && a) a = E.resume(a, Date.now());
    view.phase = phase;
    S.attempt = a;
    if (a) commit(a, { now: true });
    focusMode(phase === 'paper' || phase === 'review');
    if (phase === 'start') host.innerHTML = startHTML(paper, a);
    else if (phase === 'paper') host.innerHTML = paperHTML(paper, a);
    else if (phase === 'review') host.innerHTML = reviewHTML(paper, a);
    else host.innerHTML = resultsHTML(paper, E.slot(Store.data, id).last);
    bind(host, phase);
    typeset(host);
    if (phase === 'paper') startClock(); else stopClock();
    const head = qs('[data-focus-first]', host); if (head) head.focus({ preventScroll: true });
  }
  function focusMode(on) { document.body.classList.toggle('exam-focus', !!on); }

  /* ---------- start screen ---------- */
  function startHTML(paper, a) {
    const last = E.slot(Store.data, paper.id).last;
    const left = a ? E.remainingMs(a, Date.now()) : 0;
    const resume = a ? (a.status === 'review'
      ? `<button class="btn primary" type="button" data-exam-go="review">${a.timeUp ? 'Submit for marking' : 'Continue to review'}</button>`
      : `<button class="btn primary" type="button" data-exam-go="paper">Resume · <span class="tnum">${E.formatClock(left)}</span> left</button>`) : '';
    return `<div class="crumb"><button class="btn ghost sm" type="button" data-exam-nav="list">← Mock exams</button></div>
    <section class="xstart">
      <div class="xstart-main">
        <div class="eyebrow">Mock exam · Paper ${paper.paper}</div>
        <h1 tabindex="-1" data-focus-first>${h(paper.title)}</h1>
        <ul class="xfacts tnum"><li><b>${Math.round(paper.durationMinutes / 60 * 10) / 10}</b> hours</li><li><b>${paper.totalMarks}</b> marks</li><li><b>${paper.groups.length}</b> questions</li><li><b>${paper.questions.length}</b> parts</li></ul>
        ${a ? `<p class="xresume-note">${a.status === 'review' ? (a.timeUp ? 'Time ran out on this attempt. Your answers are saved and locked.' : 'You finished answering. Check your flagged and blank parts, then submit.') : `You have an attempt in progress, saved ${dateTxt(a.seenAt)}. The clock was paused when you left.`}</p>` : ''}
        <ul class="xrules">
          <li>The clock starts when you press Start and pauses whenever you leave the paper. It turns amber at 30 minutes and red at 10.</li>
          <li>Questions open one at a time. Answer in any order and flag parts to come back to.</li>
          <li>Before you submit you get a review of every blank and flagged part. When time runs out, your answers are saved and review opens.</li>
          <li>Short answers are auto-marked against the memo, all or nothing per part. Sketches, proofs and explanations show the memo answer for you to compare.</li>
        </ul>
        <div class="row xstart-acts">
          ${resume || '<button class="btn primary" type="button" data-exam-act="begin">Start the exam</button>'}
          ${a ? '<span class="xconfirm" data-confirm-zone><button class="btn ghost" type="button" data-exam-act="restart-ask">Start over</button></span>' : ''}
          ${last ? '<button class="btn ghost" type="button" data-exam-go="results">View last result</button>' : ''}
        </div>
      </div>
      <aside class="xstart-toc washi-paper" aria-labelledby="xtocT">
        <h2 id="xtocT">In this paper</h2>
        <ol>${paper.groups.map(g => `<li><span class="n tnum">${h(g.number)}</span><span class="t">${h(g.heading)}</span><span class="m tnum">${g.marks}</span></li>`).join('')}</ol>
        <p class="xtoc-total tnum"><span>Total</span><span>${paper.totalMarks}</span></p>
      </aside>
    </section>`;
  }

  /* ---------- the paper ---------- */
  function chipHTML(g, a, big) {
    const p = E.groupProgress(g, a);
    const state = p.answered === 0 ? 'empty' : p.answered === p.total ? 'done' : 'partial';
    const label = `Question ${g.number}: ${p.answered} of ${p.total} answered${p.flagged ? `, ${p.flagged} flagged` : ''}`;
    return `<button type="button" class="xchip${big ? ' big' : ''}" data-goto="${h(g.number)}" data-state="${state}" style="--p:${Math.round(p.answered / p.total * 100)}" aria-label="${h(label)}" title="${h(label)}"><span class="tnum">${h(g.number)}</span>${p.flagged ? '<i class="xchip-flag" aria-hidden="true"></i>' : ''}</button>`;
  }
  function countTxt(c) { return `<b>${c.answered}</b>/${c.total} answered${c.flagged ? ` · <b>${c.flagged}</b> flagged` : ''}`; }
  function barHTML(paper, a, { review = false } = {}) {
    const c = E.counts(paper, a);
    const left = E.remainingMs(a, Date.now());
    return `<div class="xbar" id="xBar">
      <div class="xbar-in">
        <button class="btn ghost sm xbar-leave" type="button" data-exam-act="leave" aria-label="Leave the exam"><span aria-hidden="true">←</span><span class="lbl">Leave</span></button>
        <div class="xbar-title"><b>${h(paper.title)}</b><span class="tnum">${paper.totalMarks} marks · ${paper.groups.length} questions</span></div>
        <div class="xtimer" id="xTimer" data-phase="${a.timeUp ? 'over' : E.phase(left)}" role="timer" aria-label="Time left"><span class="xtimer-k">${a.timeUp ? 'Time' : review ? 'Paused' : 'Time left'}</span><span class="xtimer-v tnum" id="xClock">${E.formatClock(left)}</span></div>
        <div class="xbar-count tnum" id="xCount" aria-live="off">${countTxt(c)}</div>
        <button class="btn sm xbar-qs" type="button" data-exam-act="sheet" aria-haspopup="dialog" aria-controls="xSheet">Questions <span class="tnum xbar-qs-n">${c.answered}/${c.total}</span></button>
        ${review ? '' : '<button class="btn primary sm xbar-fin" type="button" data-exam-go="review"><span class="xfin-l">Review &amp; finish</span><span class="xfin-s">Finish</span></button>'}
      </div>
      <nav class="xnav" aria-label="Jump to a question">${paper.groups.map(g => chipHTML(g, a)).join('')}</nav>
    </div>
    <div class="sr-only" aria-live="polite" id="xLive"></div>
    ${sheetHTML(paper, a, review)}${leaveHTML()}`;
  }
  function sheetHTML(paper, a, review) {
    return `<dialog class="xsheet" id="xSheet" aria-labelledby="xSheetT">
      <div class="xsheet-grab" aria-hidden="true"></div>
      <div class="xsheet-head"><h2 id="xSheetT">Questions</h2><span class="tnum" id="xSheetCount">${countTxt(E.counts(paper, a))}</span><button class="btn ghost sm" type="button" data-sheet-close>Close</button></div>
      <div class="xsheet-grid">${paper.groups.map(g => chipHTML(g, a, true)).join('')}</div>
      <ul class="xlegend" aria-label="Key"><li><i class="k empty"></i>Not started</li><li><i class="k partial"></i>Started</li><li><i class="k done"></i>All answered</li><li><i class="k flag"></i>Flagged</li></ul>
      ${review ? '' : '<button class="btn primary xsheet-fin" type="button" data-exam-go="review">Review &amp; finish</button>'}
    </dialog>`;
  }
  function leaveHTML() {
    return `<dialog class="xdlg" id="xLeave" aria-labelledby="xLeaveT" aria-describedby="xLeaveD">
      <h2 id="xLeaveT">Leave the exam?</h2>
      <p id="xLeaveD">Your answers are saved and the clock pauses at <b class="tnum" id="xLeaveClock"></b>. Pick it up again from Mock exams.</p>
      <div class="row"><button class="btn primary" type="button" data-leave="stay" autofocus>Keep going</button><button class="btn ghost" type="button" data-leave="go">Leave exam</button></div>
    </dialog>`;
  }

  function answerHTML(q, a, readOnly) {
    const val = a ? a.answers[q.id] : undefined;
    const hintId = `xh-${q.id}`;
    if (q.geom) {
      const chain = Array.isArray(val) ? val : [];
      return `<div class="geom xgeom" data-geom="${h(q.id)}">${readOnly ? '' : `<div class="row"><label>Statement <select data-geom-stmt>${q.geom.statements.map(s => `<option value="${h(s.id)}">${h(plainTex(s.text))}</option>`).join('')}</select></label><label>Reason <select data-geom-reason>${q.geom.reasons.map(s => `<option value="${h(s.id)}">${h(plainTex(s.text))}</option>`).join('')}</select></label><button class="btn sm" type="button" data-geom-add>Add step</button></div>`}
        <ol class="steps" data-geom-list>${geomList(q, chain, readOnly)}</ol></div>`;
    }
    return `<label class="sr-only" for="xa-${h(q.id)}">Your answer to ${h(q.number)}</label>
      <textarea class="xin" id="xa-${h(q.id)}" data-answer="${h(q.id)}" rows="2" spellcheck="false" autocomplete="off"${q.hint ? ` aria-describedby="${hintId}"` : ''}${readOnly ? ' readonly' : ''} placeholder="${readOnly ? 'No answer' : 'Your answer'}">${h(typeof val === 'string' ? val : '')}</textarea>
      ${q.hint ? `<p class="xhint" id="${hintId}">${h(q.hint)}</p>` : ''}`;
  }
  function geomList(q, chain, readOnly) {
    return chain.map((step, i) => {
      const st = q.geom.statements.find(s => s.id === step.statement), rs = q.geom.reasons.find(s => s.id === step.reason);
      return `<li>${h(plainTex(st ? st.text : step.statement))} <span class="muted">because</span> ${h(plainTex(rs ? rs.text : step.reason))}${readOnly ? '' : ` <button class="btn ghost sm" type="button" data-geom-del="${i}" aria-label="Remove step ${i + 1}">Remove</button>`}</li>`;
    }).join('') || `<li class="gnote">${readOnly ? 'No steps.' : 'No steps yet.'}</li>`;
  }

  function resultHTML(q, r) {
    if (!r) return '';
    const notes = (r.memoNotes || q.memoNotes || []).length ? `<p class="gnote">Memo note: ${(r.memoNotes || q.memoNotes).map(n => h(n.where) + ': ' + h(n.text)).join(' ')}</p>` : '';
    const verdict = !r.checkable ? '<span class="xv memo">Compare with the memo</span>' : r.ok ? `<span class="xv ok">Correct · ${marksTxt(q.marks)}</span>` : '<span class="xv no">Not the memo answer</span>';
    return `<div class="xres">${verdict}<div class="xmemo"><span class="k">Memo answer</span> <span class="v">${r.answer || '<em>See the official memo</em>'}</span></div>${notes}</div>`;
  }

  function groupHTML(g, paper, a, mode, marked) {
    const byId = S.byId || (S.byId = {});
    paper.questions.forEach(q => { byId[q.id] = q; });
    const readOnly = mode !== 'paper';
    const open = S.open.has(g.number);
    const p = a ? E.groupProgress(g, a) : { answered: 0, total: g.parts.length, flagged: 0 };
    const rq = marked ? marked.byQuestion.find(x => x.number === g.number) : null;
    const resById = marked ? marked.byId : null;
    const meta = rq
      ? `<span class="xq-marks tnum">${g.marks} marks</span><span class="xq-prog tnum">${rq.auto ? `<b>${rq.earned}</b>/${rq.auto} auto-marked` : 'Memo-checked'}${rq.review ? ` · ${rq.review} to compare` : ''}</span>`
      : `<span class="xq-marks tnum">${marksTxt(g.marks)}</span><span class="xq-prog tnum" data-gprog>${p.answered} of ${p.total} answered</span><span class="xq-flag" data-gflag${p.flagged ? '' : ' hidden'}>${ICON_FLAG}<span class="tnum">${p.flagged}</span><span class="sr-only"> flagged</span></span>`;
    const pct = rq ? (rq.pct == null ? 0 : rq.pct) : Math.round(p.answered / p.total * 100);
    const blocks = g.blocks.map(b => {
      if (b.kind === 'stem') return `<div class="xs d${b.depth}"><div class="xp-no tnum">${h(b.number)}</div><div class="xs-q">${b.html}</div></div>`;
      const q = byId[b.id];
      const r = resById ? resById[q.id] : null;
      const flagged = a && a.flags[q.id];
      const side = r ? `<span class="xp-m tnum ${r.checkable ? (r.ok ? 'ok' : 'no') : 'memo'}" aria-label="${r.checkable ? (r.ok ? q.marks : 0) + ' of ' + q.marks + ' marks' : q.marks + ' marks, compare with the memo'}">${r.checkable ? `${r.ok ? q.marks : 0}/${q.marks}` : `(${q.marks})`}</span>`
        : `<span class="xp-m tnum" aria-label="${marksTxt(q.marks)}">(${q.marks})</span>`;
      const flag = mode === 'results' ? '' : `<button type="button" class="xp-flag" data-flag="${h(q.id)}" aria-pressed="${flagged ? 'true' : 'false'}" aria-label="Flag ${h(q.number)} for review" title="Flag for review">${ICON_FLAG}</button>`;
      return `<div class="xp d${q.depth}${flagged ? ' is-flagged' : ''}" id="xp-${h(q.id)}" data-part="${h(q.id)}">
        <div class="xp-no tnum">${h(q.number)}</div>
        <div class="xp-main"><div class="xp-q">${q.html}</div>${answerHTML(q, a, readOnly || mode === 'results')}${resultHTML(q, r)}</div>
        <div class="xp-side">${side}${flag}</div>
      </div>`;
    }).join('');
    return `<section class="xq${open ? ' is-open' : ''}" id="xq-${h(g.number)}" data-group="${h(g.number)}">
      <h2 class="xq-h"><button type="button" class="xq-head" id="xqh-${h(g.number)}" aria-expanded="${open}" aria-controls="xqp-${h(g.number)}">
        <span class="xq-no"><span class="xq-k">Question</span> <span class="xq-n tnum">${h(g.number)}</span></span>
        <span class="xq-sub">${h(g.heading)}</span>
        <span class="xq-meta">${meta}</span>
        <span class="xq-ring${rq ? ' res' : ''}" style="--p:${pct}" aria-hidden="true"></span>
        <span class="xq-chev" aria-hidden="true">${ICON_CHEV}</span>
      </button></h2>
      <div class="xq-panel" id="xqp-${h(g.number)}" role="region" aria-labelledby="xqh-${h(g.number)}"${open ? '' : ' inert'}>
        <div class="xq-clip"><div class="xq-body washi-paper">${g.stem ? `<div class="xq-stem">${g.stem}</div>` : ''}${blocks}</div></div>
      </div>
    </section>`;
  }
  function toolsHTML() {
    return `<div class="xtools"><p class="gnote">Open a question to see its parts. Marks are in the margin; flag anything you want to revisit.</p>
      <div class="row"><button class="btn ghost sm" type="button" data-exam-act="expand">Expand all</button><button class="btn ghost sm" type="button" data-exam-act="collapse">Collapse all</button></div></div>`;
  }
  function paperHTML(paper, a) {
    return `${barHTML(paper, a)}
      <h1 class="sr-only" tabindex="-1" data-focus-first>${h(paper.title)}</h1>
      ${toolsHTML()}
      <div class="xacc" id="xAcc">${paper.groups.map(g => groupHTML(g, paper, a, 'paper')).join('')}</div>
      <div class="xend"><p class="gnote">That’s the whole paper.</p><button class="btn primary" type="button" data-exam-go="review">Review &amp; finish</button></div>`;
  }

  /* ---------- review ---------- */
  function reviewHTML(paper, a) {
    const r = E.reviewList(paper, a), c = E.counts(paper, a);
    const names = paper.topicNames || {};
    // Grouped by top-level question, so a long list of blanks still reads as "which questions do I still owe?"
    const grouped = list => {
      const rows = [];
      for (const x of list) {
        const last = rows[rows.length - 1];
        if (last && last.group === x.group) last.items.push(x); else rows.push({ group: x.group, items: [x] });
      }
      return `<ul class="xrl">${rows.map(row => {
        const g = paper.groups.find(gr => gr.number === row.group) || { heading: '' };
        const m = row.items.reduce((sum, x) => sum + (x.marks || 0), 0);
        return `<li class="xrg"><div class="xrg-h"><b>Question ${h(row.group)}</b><span class="xrg-t">${h(g.heading)}</span><span class="xrg-m tnum">${marksTxt(m)}</span></div>
          <div class="xrg-parts">${row.items.map(x => `<button type="button" class="xpill${x.flagged ? ' is-flag' : ''}" data-review-go="${h(x.id)}"${a.timeUp ? ' disabled' : ''} aria-label="Part ${h(x.number)}, ${marksTxt(x.marks)}${x.flagged ? ', flagged' : ''}${a.timeUp ? '' : '. Go to it'}"><span class="tnum">${h(x.number)}</span><span class="xpill-m tnum" aria-hidden="true">${x.marks}</span>${x.flagged ? `<span class="xpill-f" aria-hidden="true">${ICON_FLAG}</span>` : ''}</button>`).join('')}</div></li>`;
      }).join('')}</ul>`;
    };
    const blankMarks = r.unanswered.reduce((s, x) => s + (x.marks || 0), 0);
    return `${barHTML(paper, a, { review: true })}
    <section class="xreview">
      ${a.timeUp ? `<div class="xbanner" role="alert"><b>Time’s up.</b> Your answers were saved when the clock reached 0:00 and can’t be changed now. Submit to see your marks.</div>` : ''}
      <div class="eyebrow">Review</div>
      <h1 tabindex="-1" data-focus-first>Check before you submit</h1>
      <div class="xsum tnum">
        <div><b>${c.answered}</b><span>of ${c.total} answered</span></div>
        <div class="${c.unanswered ? 'warn-tile' : ''}"><b>${c.unanswered}</b><span>blank · ${blankMarks} marks</span></div>
        <div><b>${c.flagged}</b><span>flagged</span></div>
      </div>
      ${r.unanswered.length ? `<h2>Blank <span class="tnum">(${r.unanswered.length})</span></h2>${grouped(r.unanswered)}` : '<p class="xall">Every part has an answer.</p>'}
      ${r.flagged.length ? `<h2>Flagged <span class="tnum">(${r.flagged.length})</span></h2>${grouped(r.flagged)}` : ''}
      ${r.done.length ? `<details class="xdone"><summary>Answered <span class="tnum">(${r.done.length})</span></summary>${grouped(r.done)}</details>` : ''}
      <div class="row xreview-acts" data-confirm-zone>
        ${a.timeUp ? '' : '<button class="btn" type="button" data-exam-go="paper">Back to the paper</button>'}
        <button class="btn primary" type="button" data-exam-act="${c.unanswered && !a.timeUp ? 'submit-ask' : 'submit'}">Submit for marking</button>
      </div>
      <p class="gnote" id="xSubmitNote" role="status"></p>
    </section>`;
  }

  /* ---------- results ---------- */
  function resultsHTML(paper, last) {
    const res = last.summaryFull || E.results(paper, last.marked);
    const t = res.total;
    const byId = {}; (last.marked || []).forEach(r => { byId[r.id] = r; });
    const marked = { ...res, byId };
    const used = Math.max(0, Math.min(last.durationMs, last.elapsedMs || 0));
    const topicRows = res.byTopic.map(tp => `<li><span class="xt-n">${h(tp.short)}</span>
        <span class="xt-bar" aria-hidden="true"><i style="--w:${tp.auto ? Math.round(tp.earned / tp.auto * 100) : 0}%"></i></span>
        <span class="xt-v tnum">${tp.auto ? `<b>${tp.earned}</b>/${tp.auto}` : '—'}</span>
        <span class="xt-r tnum">${tp.review ? `+${tp.review} to compare` : ''}</span></li>`).join('');
    return `<div class="crumb"><button class="btn ghost sm" type="button" data-exam-nav="list">← Mock exams</button></div>
    <section class="xres-top">
      <div class="xscore washi-paper">
        <div class="eyebrow">Result · ${h(paper.title)}</div>
        <h1 tabindex="-1" data-focus-first><span class="big tnum">${t.earned}</span><span class="of tnum">/ ${t.auto}</span></h1>
        <p class="xscore-k">auto-marked marks${t.pct != null ? ` · <b class="tnum">${t.pct}%</b>` : ''}</p>
        <p class="gnote">${t.review} of the paper’s ${t.marks} marks are sketches, proofs or explanations. Their memo answers are below for you to compare.</p>
        <p class="gnote tnum">Finished ${dateTxt(last.finishedAt)} · ${E.formatClock(used)} used of ${E.formatClock(last.durationMs)}${last.timeUp ? ' · time ran out' : ''}</p>
      </div>
      <div class="xtopics panel"><h2>By topic</h2><ul class="xtl">${topicRows}</ul></div>
    </section>
    <div class="xres-head"><h2>By question</h2>${toolsHTML().replace('<p class="gnote">Open a question to see its parts. Marks are in the margin; flag anything you want to revisit.</p>', '<p class="gnote">Open a question to see each part’s mark and the memo answer.</p>')}</div>
    <div class="xacc" id="xAcc">${paper.groups.map(g => groupHTML(g, paper, last, 'results', marked)).join('')}</div>
    <div class="row xres-acts"><button class="btn primary" type="button" data-exam-act="retake">Retake this paper</button><button class="btn ghost" type="button" data-exam-nav="list">Back to Mock exams</button></div>`;
  }

  /* ---------- live updates ---------- */
  function refreshCounts() {
    const paper = S.paper, a = S.attempt; if (!paper || !a) return;
    const c = E.counts(paper, a);
    const set = (sel, html) => { const el = qs(sel); if (el) el.innerHTML = html; };
    set('#xCount', countTxt(c)); set('#xSheetCount', countTxt(c));
    const n = qs('.xbar-qs-n'); if (n) n.textContent = `${c.answered}/${c.total}`;
    for (const g of paper.groups) {
      const p = E.groupProgress(g, a);
      const sec = qs(`#xq-${CSS.escape(g.number)}`);
      if (sec) {
        const prog = qs('[data-gprog]', sec); if (prog) prog.textContent = `${p.answered} of ${p.total} answered`;
        const fl = qs('[data-gflag]', sec); if (fl) { fl.hidden = !p.flagged; const num = qs('.tnum', fl); if (num) num.textContent = p.flagged; }
        const ring = qs('.xq-ring', sec); if (ring) ring.style.setProperty('--p', Math.round(p.answered / p.total * 100));
      }
      qsa(`.xchip[data-goto="${CSS.escape(g.number)}"]`).forEach(chip => { chip.outerHTML = chipHTML(g, a, chip.classList.contains('big')); });
    }
    markCurrent();
  }

  function setOpen(sec, open, { animate = true } = {}) {
    const num = sec.dataset.group, btn = qs('.xq-head', sec), panel = qs('.xq-panel', sec);
    if (open) S.open.add(num); else S.open.delete(num);
    if (!animate || reduceMotion()) sec.classList.add('no-anim');
    sec.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
    if (open) panel.removeAttribute('inert'); else panel.setAttribute('inert', '');
    if (sec.classList.contains('no-anim')) requestAnimationFrame(() => requestAnimationFrame(() => sec.classList.remove('no-anim')));
  }
  function goto(num, partId) {
    const sec = qs(`#xq-${CSS.escape(num)}`); if (!sec) return;
    setOpen(sec, true);
    const target = partId ? qs(`#xp-${CSS.escape(partId)}`) : sec;
    const behavior = reduceMotion() ? 'auto' : 'smooth';
    setTimeout(() => {
      (target || sec).scrollIntoView({ behavior, block: 'start' });
      const f = partId ? qs(`#xp-${CSS.escape(partId)} .xin, #xp-${CSS.escape(partId)} select`) : qs('.xq-head', sec);
      if (f) f.focus({ preventScroll: true });
    }, reduceMotion() ? 0 : 60);
  }
  function markCurrent() {
    const cur = S.current;
    qsa('.xnav .xchip').forEach(c => { if (c.dataset.goto === cur) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current'); });
  }
  function watchCurrent() {
    if (S.io) S.io.disconnect();
    if (!('IntersectionObserver' in window)) return;
    const seen = new Map();
    S.io = new IntersectionObserver(entries => {
      for (const e of entries) seen.set(e.target.dataset.group, e.isIntersecting ? e.boundingClientRect.top : null);
      const live = [...seen.entries()].filter(([, top]) => top != null).sort((x, y) => Math.abs(x[1]) - Math.abs(y[1]));
      if (live.length) { S.current = live[0][0]; markCurrent(); }
    }, { rootMargin: '-35% 0px -55% 0px' });
    qsa('.xq').forEach(sec => S.io.observe(sec));
  }
  function measureBar() {
    const bar = qs('#xBar');
    document.documentElement.style.setProperty('--xbar-h', (bar ? Math.ceil(bar.getBoundingClientRect().height) : 0) + 'px');
  }

  /* ---------- clock ---------- */
  function startClock() {
    stopClock({ keep: true });
    S.beat = Date.now();
    const step = () => {
      const a = S.attempt; if (!a || view.name !== 'exam' || view.phase !== 'paper') return;
      const now = Date.now();
      const next = E.tick(a, now);
      if (next.status === 'review') { S.attempt = next; commit(next, { now: true }); Store.push(); go({ ...view, phase: 'review' }); return; }
      const left = E.remainingMs(a, now), ph = E.phase(left);
      const clock = qs('#xClock'), timer = qs('#xTimer');
      if (clock) clock.textContent = E.formatClock(left);
      if (timer && timer.dataset.phase !== ph) timer.dataset.phase = ph;
      const mins = Math.ceil(left / 60000);
      for (const m of [30, 10, 5, 1]) if (mins === m && !S.said.has(m)) { S.said.add(m); const live = qs('#xLive'); if (live) live.textContent = `${m} minute${m === 1 ? '' : 's'} left.`; }
      if (now - S.beat >= HEARTBEAT_MS) { S.beat = now; commit(E.heartbeat(S.attempt, now), { now: true }); }
    };
    step();
    S.clock = setInterval(step, 1000);
  }
  function stopClock({ keep = false } = {}) {
    if (S.clock) { clearInterval(S.clock); S.clock = null; }
    if (!keep) S.said.clear();
  }
  // Called by the app whenever it renders another view.
  function stop() {
    stopClock();
    if (S.io) { S.io.disconnect(); S.io = null; }
    focusMode(false);
    if (S.attempt && S.attempt.resumedAt != null) { flush(); commit(E.pause(S.attempt, Date.now()), { now: true }); }
    else flush();
  }

  /* ---------- events ---------- */
  function bind(host, phase) {
    S.byId = null;
    if (phase === 'paper' || phase === 'review') { measureBar(); requestAnimationFrame(measureBar); }
    if (phase === 'paper') watchCurrent();
  }
  function begin() {
    const paper = S.paper;
    S.open.clear();
    const a = E.newAttempt(paper, Date.now());
    commit(a, { now: true });
    go({ name: 'exam', id: paper.id, phase: 'paper' });
  }
  async function submit() {
    const paper = S.paper; let a = S.attempt; if (!paper || !a) return;
    const note = qs('#xSubmitNote'); const btns = qsa('.xreview-acts button'); btns.forEach(b => { b.disabled = true; });
    if (note) note.textContent = 'Marking against the memo…';
    flush();
    try {
      const r = await API.req('POST', '/api/exams/' + encodeURIComponent(paper.id) + '/mark', { answers: a.answers });
      const res = E.results(paper, r.results);
      const done = E.finish(a, r.results, { earned: res.total.earned, auto: res.total.auto, review: res.total.review, marks: res.total.marks }, Date.now());
      Store.data = E.recordFinished(Store.data, paper.id, done); Store.save(); Store.push();
      S.attempt = null; S.open.clear();
      go({ name: 'exam', id: paper.id, phase: 'results' });
    } catch (e) {
      if (note) note.textContent = `Could not mark the paper: ${e.message}. Your answers are still saved; try again.`;
      btns.forEach(b => { b.disabled = false; });
    }
  }
  function leaveNow() {
    const dlg = qs('#xLeave'); if (dlg && dlg.open) dlg.close();
    stop(); Store.push();
    openList();
  }

  document.addEventListener('click', e => {
    const open = e.target.closest('[data-exam-open]');
    if (open) { S.open.clear(); go({ name: 'exam', id: open.dataset.examOpen, phase: 'start' }); return; }
    const nav = e.target.closest('[data-exam-nav]');
    if (nav) { openList(); return; }
    if (!qs('#examHost')) return;
    const head = e.target.closest('.xq-head');
    if (head) { const sec = head.closest('.xq'); setOpen(sec, !sec.classList.contains('is-open')); return; }
    const chip = e.target.closest('[data-goto]');
    if (chip) {
      const sheet = qs('#xSheet'); if (sheet && sheet.open) sheet.close();
      if (view.phase === 'review') { if (S.attempt && S.attempt.timeUp) return; S.pending = { group: chip.dataset.goto }; go({ ...view, phase: 'paper' }); return; }
      goto(chip.dataset.goto); return;
    }
    const rgo = e.target.closest('[data-review-go]');
    if (rgo) { const q = S.paper.questions.find(x => x.id === rgo.dataset.reviewGo); S.pending = { group: q.group, part: q.id }; go({ ...view, phase: 'paper' }); return; }
    const flag = e.target.closest('[data-flag]');
    if (flag && S.attempt) {
      const id = flag.dataset.flag; const a = E.toggleFlag(S.attempt, id); commit(a);
      const on = !!a.flags[id]; flag.setAttribute('aria-pressed', String(on)); flag.closest('.xp').classList.toggle('is-flagged', on);
      const live = qs('#xLive'); if (live) live.textContent = on ? 'Flagged for review.' : 'Flag removed.';
      if (view.phase === 'review') mountSoon(); else refreshCounts();
      return;
    }
    const go_ = e.target.closest('[data-exam-go]');
    if (go_) {
      const ph = go_.dataset.examGo; const sheet = qs('#xSheet'); if (sheet && sheet.open) sheet.close();
      if (ph === 'review' && S.attempt && S.attempt.status === 'active') { flush(); commit(E.toReview(S.attempt, Date.now()), { now: true }); }
      go({ name: 'exam', id: paperId(), phase: ph }); return;
    }
    const geomAdd = e.target.closest('[data-geom-add]');
    if (geomAdd && S.attempt) {
      const box = geomAdd.closest('[data-geom]'), id = box.dataset.geom, q = S.paper.questions.find(x => x.id === id);
      const chain = Array.isArray(S.attempt.answers[id]) ? S.attempt.answers[id].slice() : [];
      if (chain.length >= 12) return;
      chain.push({ statement: qs('[data-geom-stmt]', box).value, reason: qs('[data-geom-reason]', box).value });
      commit(E.setAnswer(S.attempt, id, chain)); qs('[data-geom-list]', box).innerHTML = geomList(q, chain, false); refreshCounts(); return;
    }
    const geomDel = e.target.closest('[data-geom-del]');
    if (geomDel && S.attempt) {
      const box = geomDel.closest('[data-geom]'), id = box.dataset.geom, q = S.paper.questions.find(x => x.id === id);
      const chain = (S.attempt.answers[id] || []).slice(); chain.splice(+geomDel.dataset.geomDel, 1);
      commit(E.setAnswer(S.attempt, id, chain)); qs('[data-geom-list]', box).innerHTML = geomList(q, chain, false); refreshCounts(); return;
    }
    if (e.target.closest('[data-sheet-close]')) { qs('#xSheet').close(); return; }
    const leave = e.target.closest('[data-leave]');
    if (leave) { if (leave.dataset.leave === 'go') leaveNow(); else qs('#xLeave').close(); return; }
    const act = e.target.closest('[data-exam-act]');
    if (!act) return;
    const k = act.dataset.examAct;
    if (k === 'begin') begin();
    else if (k === 'leave') { const d = qs('#xLeave'); const c = qs('#xLeaveClock'); if (c && S.attempt) c.textContent = E.formatClock(E.remainingMs(S.attempt, Date.now())); if (d && d.showModal) d.showModal(); else leaveNow(); }
    else if (k === 'sheet') { const d = qs('#xSheet'); if (d) d.showModal(); }
    else if (k === 'expand' || k === 'collapse') qsa('.xq').forEach(sec => setOpen(sec, k === 'expand', { animate: false }));
    else if (k === 'restart-ask') act.closest('[data-confirm-zone]').innerHTML = '<span class="xconfirm-q">Erase this attempt?</span><button class="btn sm" type="button" data-exam-act="restart">Erase and start over</button><button class="btn ghost sm" type="button" data-exam-act="restart-no">Keep it</button>';
    else if (k === 'restart-no') mountSoon();
    else if (k === 'restart') { Store.data = E.discardCurrent(Store.data, paperId()); Store.save(); S.attempt = null; begin(); }
    else if (k === 'retake') { Store.data = E.discardCurrent(Store.data, paperId()); Store.save(); S.attempt = null; go({ name: 'exam', id: paperId(), phase: 'start' }); }
    else if (k === 'submit-ask') {
      const c = E.counts(S.paper, S.attempt);
      act.closest('[data-confirm-zone]').innerHTML = `<span class="xconfirm-q"><b class="tnum">${c.unanswered}</b> part${c.unanswered === 1 ? ' is' : 's are'} still blank. Submit anyway?</span><button class="btn primary" type="button" data-exam-act="submit">Submit anyway</button><button class="btn" type="button" data-exam-go="paper">Back to the paper</button>`;
      qs('[data-exam-act="submit"]').focus();
    }
    else if (k === 'submit') submit();
  });
  function mountSoon() { const y = window.scrollY; mount().then(() => window.scrollTo(0, y)); }

  document.addEventListener('input', e => {
    const el = e.target.closest('[data-answer]'); if (!el || !S.attempt || !qs('#examHost')) return;
    S.attempt = E.setAnswer(S.attempt, el.dataset.answer, el.value);
    commit(S.attempt); refreshCounts();
  });

  // Accordion keyboard pattern: arrows, Home and End move between question headers.
  document.addEventListener('keydown', e => {
    const head = e.target.closest && e.target.closest('.xq-head'); if (!head) return;
    const heads = qsa('.xq-head'), i = heads.indexOf(head);
    let j = null;
    if (e.key === 'ArrowDown') j = Math.min(heads.length - 1, i + 1);
    else if (e.key === 'ArrowUp') j = Math.max(0, i - 1);
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = heads.length - 1;
    if (j == null) return;
    e.preventDefault(); heads[j].focus();
  });

  // Leaving the page pauses the clock and saves straight away.
  window.addEventListener('pagehide', () => {
    if (!S.attempt || S.attempt.resumedAt == null) { flush(); return; }
    S.attempt = E.pause(S.attempt, Date.now());
    Store.data = E.saveCurrent(Store.data, S.attempt.paperId, S.attempt); Store.save(); Store.push(true);
  });
  window.addEventListener('pageshow', e => { if (e.persisted && view && view.name === 'exam' && view.phase === 'paper') mount(); });
  window.addEventListener('resize', () => { if (qs('#xBar')) measureBar(); });

  // Opening a question from review happens after the paper renders.
  const afterMount = mount;
  async function mountWithPending() {
    await afterMount();
    if (S.pending && view.phase === 'paper') { const p = S.pending; S.pending = null; goto(p.group, p.part); }
  }

  window.ExamUI = { openList, listHTML, mount: mountWithPending, stop, _state: S };
})();
