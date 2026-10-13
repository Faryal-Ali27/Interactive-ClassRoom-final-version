/* ClassPulse fun layer: confetti, pop-ups, avatars, levels and the leaderboard podium. Pure JS, no libraries. */
(function (root) {
  'use strict';
  var reduce = function () { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  var AVA = ['🦊', '🐼', '🐯', '🦁', '🐸', '🐵', '🦄', '🐙', '🐧', '🦉', '🐬', '🦋', '🐢', '🐨', '🦖', '🐝'];
  function ava(name) { var h = 0, s = String(name || '?'); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return AVA[h % AVA.length]; }
  function level(pts) {
    pts = pts || 0;
    if (pts >= 1000) return { n: 'Legend', e: '👑' };
    if (pts >= 500) return { n: 'Brainiac', e: '🧠' };
    if (pts >= 150) return { n: 'Rising star', e: '⭐' };
    return { n: 'Newbie', e: '🌱' };
  }
  var BADGE = { rocket: '🚀', fire: '🔥', bolt: '⚡', target: '🎯', star: '⭐', crown: '👑' };
  var W = ['Big brain energy', 'Nailed it', 'That was clean', 'Main character move', 'W answer', 'You ate that', 'Locked in and correct', 'Genius mode on'];
  var L = ['Not this time, but you showed up', 'Close one. The next one is yours', 'Plot twist: now you know it', 'Mistakes are free XP', 'Shake it off, next question', 'Learning in progress'];
  var M = ['You missed that one. Catch the next!', 'Time ran out. Be quick on the next one'];
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  var cv = null, parts = [], raf = 0;
  function confetti(n) {
    if (reduce()) return;
    if (!cv) { cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true'); cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:90'; document.body.appendChild(cv); }
    cv.width = innerWidth; cv.height = innerHeight;
    var cols = ['#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6', '#facc15'];
    for (var i = 0; i < (n || 110); i++) parts.push({ x: innerWidth / 2 + (Math.random() - .5) * 120, y: innerHeight * 0.55, vx: (Math.random() - .5) * 14, vy: -8 - Math.random() * 10, g: .32, r: 4 + Math.random() * 5, c: cols[i % cols.length], a: Math.random() * 6, va: (Math.random() - .5) * .4, life: 90 + Math.random() * 50 });
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick() {
    var g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height);
    parts = parts.filter(function (p) { return p.life > 0 && p.y < cv.height + 20; });
    parts.forEach(function (p) {
      p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vx *= .99; p.a += p.va; p.life--;
      g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.c; g.globalAlpha = Math.min(1, p.life / 30); g.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); g.restore();
    });
    if (parts.length) raf = requestAnimationFrame(tick); else { raf = 0; g.clearRect(0, 0, cv.width, cv.height); }
  }
  var popT = 0;
  function pop(big, small, kind) {
    var d = document.getElementById('fxPop');
    if (!d) { d = document.createElement('div'); d.id = 'fxPop'; d.setAttribute('role', 'status'); d.setAttribute('aria-live', 'polite'); document.body.appendChild(d); }
    d.className = 'fx-pop ' + (kind || ''); d.innerHTML = '';
    var a = document.createElement('div'); a.className = 'fx-big'; a.textContent = big; var b = document.createElement('div'); b.className = 'fx-small'; b.textContent = small || '';
    d.appendChild(a); d.appendChild(b); void d.offsetWidth; d.classList.add('show');
    clearTimeout(popT); popT = setTimeout(function () { d.classList.remove('show'); }, 2300);
  }
  function countUp(node, to, ms) {
    if (reduce()) { node.textContent = to; return; }
    var t0 = performance.now(), from = +node.textContent || 0;
    (function f(t) { var k = Math.min(1, (t - t0) / (ms || 700)); node.textContent = Math.round(from + (to - from) * k); if (k < 1) requestAnimationFrame(f); })(t0);
  }

  /* leaderboard: podium for the top 3, list for the rest; the signed-in student's row is highlighted */
  function board(box, rows, empty) {
    box.innerHTML = '';
    if (!rows || !rows.length) { var p = document.createElement('p'); p.className = 'mute'; p.textContent = empty || 'Scores appear after the first quiz question closes.'; box.appendChild(p); return; }
    var top = rows.slice(0, 3), order = top.length === 3 ? [1, 0, 2] : top.map(function (_, i) { return i; });
    var pod = document.createElement('div'); pod.className = 'podium';
    order.forEach(function (i) {
      var r = top[i], c = document.createElement('div'); c.className = 'pod p' + (i + 1) + (r.mine ? ' mine' : '');
      var m = document.createElement('div'); m.className = 'pod-medal'; m.textContent = ['🥇', '🥈', '🥉'][i];
      var a = document.createElement('div'); a.className = 'pod-ava'; a.textContent = ava(r.name);
      var n = document.createElement('div'); n.className = 'pod-name'; n.textContent = r.name + (r.mine ? ' (you)' : '');
      var s = document.createElement('div'); s.className = 'pod-pts'; s.textContent = r.pts + ' pts' + (r.streak >= 2 ? '  🔥' + r.streak : '');
      var bar = document.createElement('div'); bar.className = 'pod-bar'; bar.style.height = [86, 62, 46][i] + 'px';
      c.appendChild(m); c.appendChild(a); c.appendChild(n); c.appendChild(s); c.appendChild(bar); pod.appendChild(c);
    });
    box.appendChild(pod);
    rows.slice(3).forEach(function (r, k) {
      var d = document.createElement('div'); d.className = 'lb' + (r.mine ? ' mine' : '');
      var w = document.createElement('span'); w.className = 'who';
      var rk = document.createElement('span'); rk.className = 'rank'; rk.textContent = k + 4; w.appendChild(rk);
      w.appendChild(document.createTextNode(ava(r.name) + ' ' + r.name + (r.mine ? ' (you)' : '') + (r.streak >= 2 ? '  🔥' + r.streak : '')));
      var b = document.createElement('b'); b.textContent = r.pts; d.appendChild(w); d.appendChild(b); box.appendChild(d);
    });
  }
  root.FX = { confetti: confetti, pop: pop, countUp: countUp, ava: ava, level: level, board: board, BADGE: BADGE, win: function () { return pick(W); }, lose: function () { return pick(L); }, miss: function () { return pick(M); } };
})(window);
