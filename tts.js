// 음성 안내: 브라우저에 들어 있는 음성 합성(Web Speech API)으로 화면 내용을 읽어 줍니다.
// - 아래쪽 "음성 안내 듣기" 버튼: 페이지 전체를 처음부터 읽기
// - 각 제목 옆 "듣기" 버튼: 그 부분만 읽기
// - 신청 창의 "읽어주기" 버튼: 신청서와 개인정보 동의 내용을 읽기
(function () {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return; // 지원하지 않는 브라우저는 버튼을 숨김

  var synth = window.speechSynthesis;
  var RATES = [{ v: 1, t: '보통' }, { v: 0.8, t: '느리게' }, { v: 1.25, t: '빠르게' }];
  var rateIdx = 0;
  try { rateIdx = Math.max(0, Math.min(2, parseInt(localStorage.getItem('tts-rate') || '0', 10) || 0)); } catch (e) {}

  var bar = document.getElementById('tts-bar');
  var playBtn = document.getElementById('tts-play');
  var controls = document.getElementById('tts-controls');
  var pauseBtn = document.getElementById('tts-pause');
  var stopBtn = document.getElementById('tts-stop');
  var rateBtn = document.getElementById('tts-rate');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var voice = null;
  function pickVoice() {
    var vs = synth.getVoices();
    voice = vs.filter(function (v) { return /^ko/i.test(v.lang) && v.localService; })[0] ||
            vs.filter(function (v) { return /^ko/i.test(v.lang); })[0] || null;
  }
  pickVoice();
  if (typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', pickVoice);
  else synth.onvoiceschanged = pickVoice;

  // ── 읽을 내용 만들기 ───────────────────────────────────────
  function normalize(t) {
    return String(t)
      .replace(/\s+/g, ' ')
      .replace(/(\d{1,2}):(\d{2})\s*~\s*(\d{1,2}):(\d{2})/g, function (m, a, b, c, d) {
        return a + '시' + (b !== '00' ? ' ' + b + '분' : '') + '부터 ' + c + '시' + (d !== '00' ? ' ' + d + '분' : '') + '까지';
      })
      .replace(/(\d{1,2}):00/g, '$1시')
      .replace(/(\d{1,2}):(\d{2})/g, '$1시 $2분')
      .replace(/([월화수목금토일])\s*~\s*([월화수목금토일])(?!요일)/g, '$1요일부터 $2요일까지')
      .replace(/([월화수목금토일])요일\s*~\s*([월화수목금토일])요일/g, '$1요일부터 $2요일까지')
      .replace(/~/g, '부터 ')
      .replace(/K-POP/gi, '케이팝')
      .replace(/\s*\*\s*$/, ', 필수 입력')
      .replace(/\s[·•]\s/g, ', ')
      .replace(/[·•]/g, ' ')
      .replace(/[→↑×✓]/g, '')
      .replace(/\(\s*[A-Za-z][A-Za-z\s]*\)/g, '')
      .replace(/\s*\(([^)]*)\)/g, ', $1,')
      .replace(/\s*,\s*,/g, ',')
      .replace(/\s+([,.])/g, '$1')
      .replace(/,\s*\./g, '.')
      .replace(/\.{2,}/g, '.')
      .replace(/\s+/g, ' ')
      .replace(/^[,\s]+|[,\s]+$/g, '')
      .trim();
  }

  // 줄바꿈(<br>)을 띄어쓰기로 바꿔서 단어가 붙어 읽히지 않게 함
  function textOf(el) {
    var t = (typeof el.innerText === 'string' && el.innerText) ? el.innerText : el.textContent;
    return t.replace(/\n+/g, ' ').replace(/([.!?])(?=\S)/g, '$1 ');
  }

  function visible(el) {
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function timetableText(table) {
    var days = Array.prototype.map.call(table.querySelectorAll('thead th'), function (th) { return th.textContent.trim(); }).slice(1);
    var out = ['단과반 시간표입니다.'];
    Array.prototype.forEach.call(table.querySelectorAll('tbody tr'), function (tr) {
      var time = tr.querySelector('th').textContent.replace(/\s+/g, '').replace(/^(\d+:\d+)(~?)(\d+:\d+)$/, '$1~$3');
      var cells = tr.querySelectorAll('td');
      if (cells.length === 1) {
        out.push(time + ', ' + days[0] + '요일부터 ' + days[days.length - 1] + '요일까지 매일 ' + cells[0].textContent.trim() + '.');
      } else {
        var parts = Array.prototype.map.call(cells, function (td, i) { return days[i] + '요일 ' + td.textContent.trim(); });
        out.push(time + ', ' + parts.join(', ') + '.');
      }
    });
    return out.join(' ');
  }

  function statusCardText(card) {
    var day = card.querySelector('.day').textContent.trim();
    var name = card.querySelector('h3').textContent.trim();
    var nums = card.querySelector('.count').textContent.match(/\d+/g) || [];
    var badge = card.querySelector('.badge').textContent.trim();
    return day + '요일 ' + name + '. 정원 ' + (nums[1] || '') + '명 중 ' + (nums[0] || '') + '명이 신청했어요. ' + badge + '.';
  }

  var SKIP = '[aria-hidden="true"], .sr-only, .tts-bar, .listen, .cta, .apply-close, .apply-actions, .hero-art, .photo-slot, .btn, input, script, style, [hidden]';
  var BLOCK = /^(H1|H2|H3|H4|P|LI|LEGEND|TR)$/;

  function collect(root) {
    var items = [];
    (function walk(el) {
      Array.prototype.forEach.call(el.children, function (c) {
        if (c.matches(SKIP) || !visible(c)) return;
        var text = '';
        if (c.matches('table.timetable')) text = timetableText(c);
        else if (c.matches('.status-card')) text = statusCardText(c);
        else if (c.matches('.field > span, .check > span')) text = textOf(c);
        else if (c.tagName === 'TR') text = Array.prototype.map.call(c.children, function (x) { return textOf(x).trim(); }).join(': ') + '.';
        else if (BLOCK.test(c.tagName)) text = textOf(c);
        else { walk(c); return; }
        text = normalize(text);
        if (text) items.push({ el: c, text: text });
      });
    })(root);
    return items;
  }

  // 긴 문장은 나눠서 읽기 (일부 브라우저는 긴 문장을 중간에 끊음)
  function chunks(text) {
    var out = [];
    text.split(/(?<=[.!?])\s+/).forEach(function (s) {
      while (s.length > 140) {
        var cut = s.lastIndexOf(',', 140);
        if (cut < 40) cut = s.lastIndexOf(' ', 140);
        if (cut < 40) cut = 140;
        out.push(s.slice(0, cut + 1)); s = s.slice(cut + 1).trim();
      }
      if (s) out.push(s);
    });
    return out;
  }

  // ── 재생 상태 ─────────────────────────────────────────────
  var queue = [], qi = 0, ci = 0, state = 'idle', current = null, owner = null, token = 0;

  function mark(el) {
    document.querySelectorAll('.tts-reading').forEach(function (x) { x.classList.remove('tts-reading'); });
    if (!el) return;
    el.classList.add('tts-reading');
    var r = el.getBoundingClientRect();
    if (r.top < 80 || r.bottom > window.innerHeight - 90) el.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  function speakNext(myToken) {
    if (myToken !== token || state !== 'playing') return;
    if (qi >= queue.length) { stop(); return; }
    var item = queue[qi];
    var parts = item.parts || (item.parts = chunks(item.text));
    if (ci === 0) mark(item.el);
    if (ci >= parts.length) { qi++; ci = 0; speakNext(myToken); return; }
    var u = new SpeechSynthesisUtterance(parts[ci]);
    u.lang = 'ko-KR';
    if (voice) u.voice = voice;
    u.rate = RATES[rateIdx].v;
    u.onend = function () { if (myToken !== token) return; ci++; speakNext(myToken); };
    u.onerror = function (e) { if (myToken !== token || e.error === 'interrupted' || e.error === 'canceled') return; ci++; speakNext(myToken); };
    current = u; // 일부 브라우저에서 읽는 도중 사라지지 않도록 붙잡아 둠
    synth.speak(u);
  }

  function start(root, who) {
    stop();
    queue = collect(root);
    if (!queue.length) return;
    qi = 0; ci = 0; owner = who || null; state = 'playing'; token++;
    synth.cancel();
    updateUI();
    speakNext(token);
  }

  function pause() {
    if (state !== 'playing') return;
    state = 'paused'; token++; synth.cancel(); updateUI();
  }
  function resume() {
    if (state !== 'paused') return;
    state = 'playing'; token++; updateUI(); speakNext(token);
  }
  function stop() {
    token++; state = 'idle'; synth.cancel(); queue = []; mark(null);
    var o = owner; owner = null; updateUI(o);
  }

  // ── 화면 버튼 ─────────────────────────────────────────────
  function setLabel(btn, label, aria) {
    var l = btn.querySelector('.tts-label');
    if (l) l.textContent = label; else btn.textContent = label;
    if (aria) btn.setAttribute('aria-label', aria); else btn.removeAttribute('aria-label');
  }

  function updateUI(prevOwner) {
    var active = state !== 'idle';
    var pageOwned = active && (!owner || owner === playBtn);
    controls.hidden = !active;
    bar.classList.toggle('is-active', active);
    setLabel(playBtn, pageOwned ? '처음부터 다시 듣기' : '음성 안내 듣기');
    pauseBtn.textContent = state === 'paused' ? '계속 듣기' : '일시정지';
    rateBtn.textContent = '속도 ' + RATES[rateIdx].t;
    rateBtn.setAttribute('aria-label', '속도 ' + RATES[rateIdx].t + ', 누르면 말하기 속도가 바뀝니다');
    document.querySelectorAll('[data-tts-target]').forEach(function (b) {
      var on = active && owner === b;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      setLabel(b, on ? '멈춤' : b.dataset.idleText, on ? b.dataset.name + ' 읽기 멈춤' : b.dataset.name + ' 듣기');
    });
  }

  playBtn.addEventListener('click', function () { start(document.querySelector('main'), playBtn); });
  pauseBtn.addEventListener('click', function () { state === 'paused' ? resume() : pause(); });
  stopBtn.addEventListener('click', stop);
  rateBtn.addEventListener('click', function () {
    rateIdx = (rateIdx + 1) % RATES.length;
    try { localStorage.setItem('tts-rate', String(rateIdx)); } catch (e) {}
    if (state === 'playing') { token++; synth.cancel(); ci = ci; updateUI(); speakNext(token); }
    else updateUI();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && state !== 'idle' && !document.querySelector('dialog[open]')) stop(); });

  // 제목 옆 "듣기" 버튼 만들기
  function addListen(heading, root, name, idleText, extraClass) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'listen' + (extraClass ? ' ' + extraClass : '');
    b.dataset.ttsTarget = '';
    b.dataset.name = name;
    b.dataset.idleText = idleText || '듣기';
    b.innerHTML = '<span aria-hidden="true">🔊</span> <span class="tts-label"></span>';
    b.addEventListener('click', function () {
      if (state !== 'idle' && owner === b) stop(); else start(root, b);
    });
    heading.insertAdjacentElement('afterend', b);
    return b;
  }

  document.querySelectorAll('main > section').forEach(function (sec) {
    var h = sec.querySelector('h1, h2');
    if (h) addListen(h, sec, h.textContent.replace(/\s+/g, ' ').trim());
  });
  document.querySelectorAll('.program').forEach(function (card) {
    var h = card.querySelector('h3');
    if (h) addListen(h, card.querySelector('.program-body') || card, h.textContent.trim() + ' 소개', '듣기', 'listen-sm');
  });

  // 신청 창 "읽어주기"
  var dialog = document.getElementById('apply-dialog');
  if (dialog) {
    var head = dialog.querySelector('.apply-head > div');
    var formEl = document.getElementById('apply-form');
    if (head && formEl) addListen(head, formEl, '신청서', '읽어주기', 'listen-dialog');
    dialog.addEventListener('close', function () { if (owner && dialog.contains(owner)) stop(); });
  }

  // 페이지를 떠나거나 다른 탭으로 가면 멈춤
  window.addEventListener('pagehide', function () { synth.cancel(); });

  bar.hidden = false;
  updateUI();
})();
