/* ClassPulse question import: Word (.docx), CSV and plain text -> question objects.
 * No libraries: a .docx is a zip file, so we read it with the browser's own DecompressionStream. */
(function (root) {
  'use strict';
  var Q_RE = /^(?:q(?:uestion)?\s*\d*|\d+)\s*[.):\-]\s*(.+)$/i;
  var OPT_RE = /^\(?([A-Fa-f])\s*[.):\-]\s*(.+)$/;
  var ANS_RE = /^(?:ans(?:wer)?|correct(?:\s*answer)?)\s*[:=\-]\s*(.+)$/i;
  var EXP_RE = /^(?:explanation|reason|why)\s*[:\-]\s*(.+)$/i;
  var LET = 'ABCDEF';

  /* ---- text -> questions ---- */
  function parse(text) {
    var lines = String(text || '').replace(/\r/g, '').split('\n').map(function (l) { return l.trim(); });
    var out = [], cur = null, inExp = false, m;
    function start(t) { cur = { text: t, options: [], answer: '', explain: '', star: -1 }; out.push(cur); inExp = false; }
    lines.forEach(function (l) {
      if (!l) { if (cur && cur.options.length >= 2) cur = null; return; }
      if ((m = l.match(EXP_RE)) && cur) { cur.explain = m[1]; inExp = true; return; }
      if ((m = l.match(ANS_RE)) && cur) { cur.answer = m[1].trim(); inExp = false; return; }
      if ((m = l.match(OPT_RE)) && cur && !inExp) {
        var t = m[2].trim();
        if (/\*$/.test(t)) { t = t.replace(/\s*\*$/, ''); cur.star = cur.options.length; }
        cur.options.push(t); return;
      }
      if ((m = l.match(Q_RE)) && !(cur && inExp && !/^(?:q|\d)/i.test(l))) { start(m[1].trim()); return; }
      if (cur && inExp) { cur.explain += ' ' + l; return; }
      if (cur && !cur.answer && cur.options.length === 0) { cur.text += ' ' + l; return; }
      if (cur && cur.options.length && !cur.answer) { cur.options[cur.options.length - 1] += ' ' + l; return; }
      start(l);
    });
    return out.map(finish).filter(Boolean);
  }
  function finish(c) {
    var o = c.options.slice(0, 6), correct = null, warn = [];
    if (!c.text) return null;
    if (c.star >= 0 && c.star < o.length) correct = c.star;
    if (c.answer && correct === null) {
      var a = c.answer.replace(/[.)]$/, '').trim(), L = a.length === 1 ? LET.indexOf(a.toUpperCase()) : -1;
      if (L >= 0 && L < o.length) correct = L;
      else { var k = o.findIndex(function (x) { return x.toLowerCase() === a.toLowerCase(); }); if (k >= 0) correct = k; }
      if (correct === null) warn.push('Answer "' + c.answer + '" does not match an option');
    }
    var type;
    if (o.length === 0) type = 'text';
    else if (o.length === 1) { warn.push('Only 1 option, needs at least 2'); return { text: c.text, type: 'mcq', options: o, correct: null, explain: c.explain, warn: warn, bad: true }; }
    else if (o.length === 2 && /^true$/i.test(o[0]) && /^false$/i.test(o[1])) { type = 'tf'; o = ['True', 'False']; }
    else type = correct === null ? 'poll' : 'mcq';
    if (o.length && correct === null && type !== 'poll') warn.push('No answer given');
    if (type === 'poll') warn.push('No answer marked: will run as a poll (no points)');
    return { text: c.text.slice(0, 300), type: type, options: o.map(function (x) { return x.slice(0, 100); }), correct: correct, explain: c.explain.slice(0, 400), warn: warn, bad: false };
  }

  /* ---- CSV -> text block (header: question, A..F or option A.., answer, explanation) ---- */
  function csvRows(t) {
    var rows = [], row = [], f = '', q = false, i, c;
    t = String(t).replace(/^﻿/, '');
    for (i = 0; i < t.length; i++) {
      c = t[i];
      if (q) { if (c === '"' && t[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
      else if (c === '"') q = true;
      else if (c === ',' || c === ';' || c === '\t') { row.push(f); f = ''; }
      else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
      else if (c !== '\r') f += c;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return x.trim(); }); });
  }
  function looksCsv(name, text) {
    var first = (String(text).split('\n')[0] || '').toLowerCase();
    return /\.csv$/i.test(name || '') || (/^\s*"?question/.test(first) && /[,;\t]/.test(first));
  }
  function csvToText(text) {
    var rows = csvRows(text); if (!rows.length) return '';
    var h = rows[0].map(function (x) { return x.trim().toLowerCase(); });
    var qi = h.findIndex(function (x) { return /^q/.test(x); }), ai = h.findIndex(function (x) { return /^(ans|correct)/.test(x); }), ei = h.findIndex(function (x) { return /^(expl|reason)/.test(x); });
    var oi = []; h.forEach(function (x, i) { var m = x.match(/^(?:option\s*)?([a-f])$/); if (m) oi.push(i); });
    if (qi < 0) return text;
    return rows.slice(1).map(function (r, n) {
      var s = (n + 1) + '. ' + (r[qi] || '').trim();
      oi.forEach(function (i, k) { if ((r[i] || '').trim()) s += '\n' + LET[k] + ') ' + r[i].trim(); });
      if (ai >= 0 && (r[ai] || '').trim()) s += '\nAnswer: ' + r[ai].trim();
      if (ei >= 0 && (r[ei] || '').trim()) s += '\nExplanation: ' + r[ei].trim();
      return s;
    }).join('\n\n');
  }

  /* ---- .docx -> text ---- */
  async function docxToText(file) {
    var buf = new Uint8Array(await file.arrayBuffer()), dv = new DataView(buf.buffer), dec = new TextDecoder();
    var e = buf.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('This is not a Word (.docx) file');
    var n = dv.getUint16(e + 10, true), p = dv.getUint32(e + 16, true), hit = null, i;
    for (i = 0; i < n; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      var method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
      if (dec.decode(buf.subarray(p + 46, p + 46 + nl)) === 'word/document.xml') { hit = { method: method, csize: csize, lho: lho }; break; }
      p += 46 + nl + xl + cl;
    }
    if (!hit) throw new Error('Could not find the text inside this Word file');
    var lnl = dv.getUint16(hit.lho + 26, true), lxl = dv.getUint16(hit.lho + 28, true), start = hit.lho + 30 + lnl + lxl, data = buf.subarray(start, start + hit.csize), xml;
    if (hit.method === 0) xml = dec.decode(data);
    else if (hit.method === 8) {
      if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot open .docx. Paste the text instead, or use Chrome.');
      xml = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    } else throw new Error('Unsupported Word file');
    return xmlToText(xml);
  }
  function xmlToText(xml) {
    var W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main', doc = new DOMParser().parseFromString(xml, 'application/xml');
    var ps = doc.getElementsByTagNameNS(W, 'p'), lines = [], k = 0, prevList = false;
    Array.prototype.forEach.call(ps, function (p) {
      var t = '', walker = p.getElementsByTagNameNS('*', '*');
      Array.prototype.forEach.call(walker, function (n) {
        if (n.localName === 't') t += n.textContent; else if (n.localName === 'tab') t += ' '; else if (n.localName === 'br') t += ' ';
      });
      t = t.trim();
      var ps0 = p.getElementsByTagNameNS(W, 'pStyle')[0], sty = ps0 ? (ps0.getAttributeNS(W, 'val') || '') : '';
      var li = p.getElementsByTagNameNS(W, 'numPr').length > 0 || /list|bullet|number/i.test(sty);
      if (!t) { lines.push(''); prevList = false; k = 0; return; }
      if (li && !Q_RE.test(t) && !OPT_RE.test(t) && !ANS_RE.test(t) && !EXP_RE.test(t)) { t = LET[Math.min(k, 5)] + ') ' + t; k++; }
      else if (!li) k = 0;
      prevList = li; lines.push(t);
    });
    return lines.join('\n');
  }

  root.CPImport = { parse: parse, csvToText: csvToText, looksCsv: looksCsv, docxToText: docxToText, xmlToText: xmlToText };
  if (typeof module !== 'undefined') module.exports = root.CPImport;
})(typeof window !== 'undefined' ? window : globalThis);
