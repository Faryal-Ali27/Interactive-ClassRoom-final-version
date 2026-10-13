(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var icon = window.icon, icoHtml = window.icoHtml;
  var RX = { like: ['thumbs-up', 'Like'], love: ['heart', 'Love'], idea: ['lightbulb', 'Idea'], smile: ['smile', 'Happy'], wow: ['zap', 'Wow'] };

  function rankRow(r, i) {
    var d = document.createElement('div'); d.className = 'lb';
    var w = document.createElement('span'); w.className = 'who';
    var k = document.createElement('span'); k.className = 'rank r' + (i + 1); k.textContent = i + 1;
    w.appendChild(k); w.appendChild(document.createTextNode(r.name)); d.appendChild(w);
    var b = document.createElement('b'); b.textContent = r.pts; d.appendChild(b);
    return d;
  }
  var el = function (t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x !== undefined) e.textContent = x; return e; };

  /* ---- persistent identity (survives refresh / closing the tab) ---- */
  var LS = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  var sid = LS.get('cp-sid') || Math.random().toString(36).slice(2, 12);
  LS.set('cp-sid', sid);
  var code = '', last = null, deadline = 0, builtKey = '', timer = null, busy = false, fails = 0, joined = false;
  var params = new URLSearchParams(location.search);
  $('codeIn').value = params.get('code') || LS.get('cp-code') || '';
  $('nameIn').value = LS.get('cp-name') || '';
  var pend = { n: -1, i: null }, seenReply = {};
  try { seenReply = JSON.parse(LS.get('cp-rep') || '{}') || {}; } catch (e) { seenReply = {}; }
  function roomFromLink(on) {
    var has = on && /^\d{4,6}$/.test($('codeIn').value);
    $('codeIn').hidden = has; $('roomBanner').hidden = !has;
    $('joinH').textContent = has ? 'Enter your name to join' : 'Join your class';
    if (has) {
      $('roomBanner').textContent = 'Room ' + $('codeIn').value + ' ';
      var a = document.createElement('a'); a.href = '#'; a.textContent = 'Use a different code';
      a.onclick = function (e) { e.preventDefault(); roomFromLink(false); $('codeIn').focus(); };
      $('roomBanner').appendChild(a); $('nameIn').focus();
    }
  }
  roomFromLink(!!params.get('code'));

  function api(p, b) {
    return fetch('/api/' + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ code: code, sid: sid }, b || {})) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (r.status === 410) poll(); return j; }); })
      .then(function (j) { poll(); return j; })
      .catch(function () { toast('Offline — try again'); });
  }
  function toast(m) {
    var t = $('toast'); t.textContent = m; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }
  function showJoin(msg) {
    joined = false; clearInterval(timer); timer = null;
    $('join').hidden = false; $('room').hidden = true; $('me').hidden = true;
    $('err').textContent = msg || ''; $('joinBtn').disabled = false;
    if (/Room not found/.test(msg || '')) roomFromLink(false);
  }

  /* ---- join: room code + name only ---- */
  function join(silent) {
    code = $('codeIn').value.trim();
    var nm = $('nameIn').value.trim();
    if (!code || !nm) { if (!silent) $('err').textContent = 'Enter the room code and your name.'; return; }
    $('err').textContent = ''; $('joinBtn').disabled = true;
    fetch('/api/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: code, sid: sid, name: nm }) })
      .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
      .then(function (r) {
        if (r.s === 200) {
          LS.set('cp-code', code); LS.set('cp-name', nm); joined = true;
          $('join').hidden = true; $('room').hidden = false; $('joinBtn').disabled = false;
          $('sessInfo').textContent = [r.j.title, r.j.cls].filter(Boolean).join(' · ');
          poll(); clearInterval(timer); timer = setInterval(poll, 1000);
        } else {
          if (r.s === 404) LS.del('cp-code');
          showJoin(r.s === 404 ? 'Room not found. Check the code and try again.' : (r.j.error || 'Could not join'));
        }
      })
      .catch(function () {
        $('joinBtn').disabled = false;
        if (LS.get('cp-last') && silent) { renderCached(); poll(); clearInterval(timer); timer = setInterval(poll, 1000); }
        else $('err').textContent = 'No connection. Please try again.';
      });
  }

  /* ---- live updates (short polling; works on serverless hosts) ---- */
  function poll() {
    if (!code || busy) return; busy = true;
    fetch('/api/state?role=student&code=' + encodeURIComponent(code) + '&sid=' + sid, { cache: 'no-store' })
      .then(function (r) {
        if (r.status === 404) { busy = false; return rejoin(); }
        return r.json().then(function (v) { fails = 0; $('conn').hidden = true; last = v; LS.set('cp-last', JSON.stringify({ code: code, v: v })); render(v); });
      })
      .catch(function () { if (++fails >= 2) $('conn').hidden = false; })
      .then(function () { busy = false; });
  }
  function rejoin() { // session or my record missing: try once to join again with the saved name
    var nm = LS.get('cp-name');
    if (!nm) return showJoin('Please join again.');
    fetch('/api/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: code, sid: sid, name: nm }) })
      .then(function (r) { if (r.status === 200) { poll(); } else { LS.del('cp-code'); LS.del('cp-last'); showJoin(r.status === 410 ? 'This session has ended.' : 'Room not found. Check the code and try again.'); } })
      .catch(function () {});
  }
  function renderCached() {
    try { var c = JSON.parse(LS.get('cp-last') || 'null'); if (c && c.code === code) { $('join').hidden = true; $('room').hidden = false; render(c.v); } } catch (e) {}
  }

  function buildQuestion(v) {
    var q = v.q, c = $('choices'); c.innerHTML = '';
    if (q.type === 'cloud' || q.type === 'text') {
      if (q.open) {
        var inp = el(q.type === 'text' ? 'textarea' : 'input');
        inp.id = 'ans'; inp.maxLength = q.type === 'text' ? 200 : 30;
        inp.placeholder = q.type === 'text' ? 'Type your answer…' : 'One word or short phrase';
        if (q.type === 'text') inp.rows = 3;
        if (typeof v.mine === 'string') {
          inp.value = v.mine; inp.disabled = true; c.appendChild(inp);
          c.appendChild(el('p', 'lock-note', '🔒 Your answer is locked.'));
        } else {
          var b = el('button', 'full', 'Submit answer');
          b.onclick = function () { if (!inp.value.trim()) { toast('Type your answer first'); return; } b.disabled = true; api('answer', { text: inp.value }); };
          c.appendChild(inp); c.appendChild(b);
          c.appendChild(el('p', 'lock-note', 'You can only answer once.'));
        }
      } else if (q.type === 'cloud') {
        var w = el('div', 'cloud');
        (v.res || []).forEach(function (r, i) {
          var s = el('span', '', r[0]);
          s.style.fontSize = (16 + r[1] * 8) + 'px';
          s.style.color = 'var(--c' + (i % 5 + 1) + ')';
          w.appendChild(s);
        });
        c.appendChild(w);
      }
      return;
    }
    if (q.type === 'rating') {
      var d = el('div', 'stars');
      var lockedR = v.mine !== null, chR = lockedR ? v.mine : (pend.n === v.n ? pend.i : null);
      q.options.forEach(function (o, i) {
        var b = el('button', chR === i ? (lockedR ? 'sel' : 'sel') : '');
        b.appendChild(icon('star', 20));
        b.appendChild(document.createTextNode(' ' + (i + 1)));
        b.disabled = !q.open || lockedR;
        b.setAttribute('aria-label', (i + 1) + ' stars');
        b.onclick = function () { pend = { n: v.n, i: i }; buildQuestion(last); };
        d.appendChild(b);
      });
      c.appendChild(d);
      if (q.open && !lockedR) {
        var sbR = el('button', 'full', 'Lock in my rating'); sbR.disabled = chR === null;
        sbR.onclick = function () { if (pend.n === v.n && pend.i !== null) { sbR.disabled = true; api('answer', { choice: pend.i }); } };
        c.appendChild(sbR); c.appendChild(el('p', 'lock-note', 'You can only answer once.'));
      } else if (q.open) c.appendChild(el('p', 'lock-note', '🔒 Your answer is locked.'));
      return;
    }
    var tot = (v.res || []).reduce(function (a, x) { return a + x; }, 0) || 1;
    var locked = v.mine !== null, chosen = locked ? v.mine : (pend.n === v.n ? pend.i : null);
    q.options.forEach(function (o, i) {
      var b = el('button', 'choice'); b.appendChild(el('span', '', o));
      if (q.open) {
        if (chosen === i) b.classList.add(locked ? 'sel' : 'pick');
        if (locked) { b.disabled = true; b.style.opacity = 1; }
        else b.onclick = function () { pend = { n: v.n, i: i }; buildQuestion(last); };
      } else {
        b.disabled = true; b.style.opacity = 1;
        b.appendChild(el('span', '', Math.round(v.res[i] / tot * 100) + '%'));
        if (v.correct === i) b.classList.add('right');
        else if (v.mine === i && v.correct !== null) b.classList.add('wrong');
        else if (v.mine === i) b.classList.add('sel');
      }
      c.appendChild(b);
    });
    if (q.open && !locked) {
      var sb = el('button', 'full', 'Lock in my answer'); sb.disabled = chosen === null;
      sb.onclick = function () { if (pend.n === v.n && pend.i !== null) { sb.disabled = true; api('answer', { choice: pend.i }); } };
      c.appendChild(sb); c.appendChild(el('p', 'lock-note', 'Pick one, then lock it in. You can only answer once.'));
    } else if (q.open) c.appendChild(el('p', 'lock-note', '🔒 Your answer is locked. Wait for the time to finish.'));
  }

  var celebrated = {}, knownBadges = null;
  function funLayer(v) {
    var lvl = FX.level(v.myPts), sr = $('statrow'); sr.innerHTML = '';
    var add = function (t, c) { var s2 = el('span', c || '', t); sr.appendChild(s2); return s2; };
    add(lvl.e + ' ' + lvl.n);
    var ptsEl = add('⭐ ' + v.myPts + ' pts');
    if (v.streak >= 2) add('🔥 ' + v.streak + ' in a row', 'hot');
    if (v.rank) add('#' + v.rank + ' of ' + v.players);
    sr.hidden = false;
    if (celebrated.pts !== undefined && v.myPts > celebrated.pts) ptsEl.classList.add('pop-in');
    celebrated.pts = v.myPts;
    // me card (Scores tab)
    var mc = $('meCard'); mc.hidden = false; mc.innerHTML = '';
    var av = el('div', 'big-ava', FX.ava(v.name)); mc.appendChild(av);
    var box = el('div'); box.appendChild(el('b', '', (v.name || 'You') + '  ' + lvl.e + ' ' + lvl.n));
    box.appendChild(el('small', '', v.myPts + ' pts' + (v.rank ? ' · rank #' + v.rank + ' of ' + v.players : ' · answer a quiz question to get on the board')));
    var chips = el('div', 'chips');
    (v.badges || []).forEach(function (b) { chips.appendChild(el('span', '', (FX.BADGE[b[0]] || '🏅') + ' ' + b[1])); });
    if (!(v.badges || []).length) chips.appendChild(el('span', '', '🔒 Badges unlock as you play'));
    box.appendChild(chips); mc.appendChild(box);
    // new badge toast
    var ids = (v.badges || []).map(function (b) { return b[0]; });
    if (knownBadges === null) { try { knownBadges = JSON.parse(LS.get('cp-badges:' + code) || 'null'); } catch (e) { knownBadges = null; } }
    if (knownBadges === null) { knownBadges = ids; LS.set('cp-badges:' + code, JSON.stringify(ids)); }
    else {
      var fresh = (v.badges || []).filter(function (b) { return knownBadges.indexOf(b[0]) < 0 && b[0] !== 'rocket'; });
      if (fresh.length) { toast('New badge: ' + (FX.BADGE[fresh[0][0]] || '🏅') + ' ' + fresh[0][1] + '!'); }
      knownBadges = ids; LS.set('cp-badges:' + code, JSON.stringify(ids));
    }
    // result moment: once per closed graded question that I answered (or missed)
    var q = v.q;
    if (q && !q.open && v.correct !== null && v.correct !== undefined && celebrated['n' + v.n] === undefined) {
      var seen = LS.get('cp-fx:' + code + ':' + v.n);
      celebrated['n' + v.n] = 1;
      if (!seen) {
        LS.set('cp-fx:' + code + ':' + v.n, '1');
        if (v.mine === v.correct) {
          FX.confetti(v.streak >= 3 ? 190 : 120);
          FX.pop('+' + v.lastPts + ' pts', FX.win() + (v.streak >= 2 ? '  🔥 ' + v.streak + ' in a row' : ''), 'win');
        } else if (v.mine !== null) {
          $('qcard').classList.remove('shake'); void $('qcard').offsetWidth; $('qcard').classList.add('shake');
          FX.pop('+' + v.lastPts + ' pts', 'for trying 💪  ' + FX.lose(), 'lose');
        }
      }
    }
  }

  function render(v) {
    var q = v.q;
    funLayer(v);
    $('me').hidden = !v.name; $('me').textContent = v.name || '';
    $('wait').hidden = !!q && !v.ended; $('qcard').hidden = !q || v.ended;
    $('wt').textContent = v.ended ? 'Session ended' : "You're in!";
    $('wp').textContent = v.ended ? 'Your teacher has closed this session. Thanks for taking part!' : 'Waiting for your teacher to send a question…';
    $('sessInfo').textContent = [v.title, v.cls, v.start ? v.start + (v.end ? '–' + v.end : '') : ''].filter(Boolean).join(' · ');
    $('myPts').textContent = v.myPts ? 'Your points: ' + v.myPts : '';
    deadline = v.left !== null ? Date.now() + v.left : 0;

    // Confused button
    $('cbtn').innerHTML = icoHtml('help-circle', 18) + (v.confusedMe ? ' Confused — tap to undo' : " I'm confused");
    $('cbtn').className = 'confused-btn' + (v.confusedMe ? ' on' : '');

    // Pace buttons
    Array.prototype.forEach.call(document.querySelectorAll('#pace button'), function (b) {
      b.classList.toggle('on', b.dataset.v === v.paceMe);
    });

    if (q) {
      $('qt').textContent = q.text;
      $('st').textContent = q.open ? 'OPEN' : 'CLOSED';
      $('st').className = 'pill ' + (q.open ? 'live' : 'closed');
      var textual = q.type === 'cloud' || q.type === 'text';
      var key = v.n + '|' + q.open + '|' + q.type + '|' + (v.mine !== null);
      if (!textual || key !== builtKey) { buildQuestion(v); builtKey = key; }

      var fb = '';
      if (q.open) {
        fb = v.mine !== null
          ? 'Answer locked in ✓'
          : (textual ? '' : 'Tap an option, then lock in your answer');
      } else {
        fb = v.correct === null
          ? 'Closed. Thanks for taking part!'
          : v.mine === null ? 'You did not answer this one. No stress, the next one is yours.'
          : v.mine === v.correct ? '✓ Correct! +' + v.lastPts + ' pts' + (v.streak >= 2 ? ' · 🔥 ' + v.streak + ' in a row' : '')
          : 'Not quite 😅 The correct answer is highlighted. +' + v.lastPts + ' pts for trying. You got this next time!';
      }
      var fbEl = $('fb');
      fbEl.hidden = !fb; fbEl.textContent = fb;
      var ex = $('ex'); ex.innerHTML = '';
      if (!q.open && q.explain) { ex.appendChild(el('b', '', 'Why: ')); ex.appendChild(document.createTextNode(q.explain)); }
      ex.hidden = !(!q.open && q.explain);
    }

    // Q&A list (Ask tab)
    var ql = $('qalist'); ql.innerHTML = '';
    v.qa.forEach(function (x) {
      var d = el('div', 'qa card' + (x.done ? ' done' : '')); d.style.marginBottom = '8px';
      d.appendChild(el('span', 't', x.text + (x.done ? '  ✓ answered' : '') + (x.ok ? '' : '  (waiting for review)')));
      if (x.reply) {
        var rp = el('div', 'reply'); rp.appendChild(el('b', '', 'Teacher: ')); rp.appendChild(document.createTextNode(x.reply)); d.appendChild(rp);
        if (!seenReply[x.id + ':' + x.reply.length]) { seenReply[x.id + ':' + x.reply.length] = 1; LS.set('cp-rep', JSON.stringify(seenReply)); if (x.own) { toast('Your teacher replied to your question'); d.classList.add('newreply'); } }
      }
      var b = el('button', 'ghost sm' + (x.mine ? ' on' : ''));
      b.appendChild(icon('chevron-up', 14)); b.appendChild(document.createTextNode(' ' + x.votes));
      b.onclick = function () { api('vote', { id: x.id }); }; d.appendChild(b); ql.appendChild(d);
    });

    // Leaderboard
    var lb = $('lb'); lb.innerHTML = '';
    FX.board(lb, v.board, 'Scores appear after quiz questions close.');
  }

  /* ---- Wiring ---- */
  $('joinBtn').onclick = join;
  $('codeIn').onkeydown = $('nameIn').onkeydown = function (e) { if (e.key === 'Enter') join(); };
  $('askBtn').onclick = function () {
    var t = $('ask').value.trim(); if (!t) return;
    api('ask', { text: t }); $('ask').value = ''; toast('Question sent!');
  };
  $('cbtn').onclick = function () { if (last) api('confused', { on: !last.confusedMe }); };
  Array.prototype.forEach.call(document.querySelectorAll('#pace button'), function (b) {
    b.onclick = function () { api('pace', { value: b.dataset.v }); };
  });

  // Build reaction buttons
  Object.keys(RX).forEach(function (k) {
    var b = el('button', 'ghost');
    b.appendChild(icon(RX[k][0], 22));
    var lbl = el('span', 'label', RX[k][1]); b.appendChild(lbl);
    b.title = RX[k][1]; b.setAttribute('aria-label', RX[k][1]);
    b.onclick = function () { api('react', { emoji: k }); toast(RX[k][1] + ' sent!'); };
    $('reacts').appendChild(b);
  });

  // Bottom nav switching
  Array.prototype.forEach.call(document.querySelectorAll('#nav button'), function (b) {
    b.onclick = function () {
      Array.prototype.forEach.call(document.querySelectorAll('#nav button'), function (x) { x.classList.toggle('on', x === b); });
      ['q', 'f', 'a', 'l'].forEach(function (p) { $('p-' + p).hidden = p !== b.dataset.p; });
    };
  });

  // Timer
  setInterval(function () {
    $('timer').innerHTML = deadline && last && last.q && last.q.open
      ? icoHtml('clock', 16) + ' ' + Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) + 's'
      : '';
  }, 250);

  $('leaveBtn').onclick = function () {
    LS.del('cp-code'); LS.del('cp-last'); code = ''; last = null; showJoin('');
    $('codeIn').value = '';
  };
  document.addEventListener('visibilitychange', function () { if (!document.hidden && joined) poll(); });
  window.addEventListener('online', function () { if (joined) poll(); });

  // Auto-resume: a refresh or reopened tab goes straight back into the same class
  if ($('codeIn').value && $('nameIn').value && !params.get('code')) { code = $('codeIn').value; renderCached(); join(true); }
})();
