// 단과반 수강 신청 창
// 제출 내용은 FormSubmit(https://formsubmit.co)을 통해 메일로 발송됩니다.
//
// FORM_ID: 처음에는 받는 메일 주소를 그대로 씁니다.
//   활성화를 마치면 FormSubmit이 보내주는 메일에 무작위 문자열(예: 3f9a1c...)이 있는데,
//   그 값으로 바꿔 넣으면 페이지 소스에 메일 주소가 드러나지 않아 스팸 메일을 줄일 수 있습니다.
(function () {
  var RECIPIENT = 'jungnang2019@daum.net';   // 안내 문구에 보여줄 받는 주소
  var FORM_ID = 'jungnang2019@daum.net';     // ← 활성화 후 무작위 문자열로 바꾸면 더 안전
  var ENDPOINT = 'https://formsubmit.co/ajax/' + FORM_ID;
  var TIMES = { '월': '14:00~16:00', '화': '14:00~16:00', '수': '14:00~16:00', '목': '14:00~16:00' };

  var dialog = document.getElementById('apply-dialog');
  var form = document.getElementById('apply-form');
  var done = document.getElementById('apply-done');
  var msg = document.getElementById('apply-msg');
  var submitBtn = document.getElementById('apply-submit');
  var nameEl = document.getElementById('f-name');
  var phoneEl = document.getElementById('f-phone');
  var agreeEl = document.getElementById('f-agree');
  var current = null;

  function open(btn) {
    current = {
      day: btn.dataset.day,
      program: btn.dataset.program,
      full: btn.dataset.full === 'true'
    };
    form.reset();
    form.hidden = false;
    done.hidden = true;
    msg.textContent = '';
    msg.className = 'form-msg';
    form.querySelectorAll('.invalid').forEach(function (el) { el.classList.remove('invalid'); });

    document.getElementById('apply-title').textContent = current.program + ' ' + (current.full ? '대기 신청' : '수강 신청');
    document.getElementById('apply-when').textContent = current.day + '요일 · ' + (TIMES[current.day] || '');
    document.getElementById('apply-full-notice').hidden = !current.full;
    document.getElementById('f-program').value = current.day + '요일 ' + current.program;
    document.getElementById('f-type').value = current.full ? '대기 신청 (정원 마감)' : '수강 신청';

    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    setTimeout(function () { nameEl.focus(); }, 30);
  }

  function close() {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  // 카드 안의 버튼 + 카드 아무 곳이나 눌러도 열리도록
  document.querySelectorAll('.status-card').forEach(function (card) {
    var btn = card.querySelector('[data-apply]');
    if (!btn) return;
    card.addEventListener('click', function (e) {
      if (e.target.closest('button') && e.target.closest('button') !== btn) return;
      open(btn);
    });
  });

  dialog.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]') || e.target === dialog) close();
  });

  // 전화번호 자동 하이픈
  phoneEl.addEventListener('input', function () {
    var d = phoneEl.value.replace(/\D/g, '').slice(0, 11);
    if (d.length > 7) phoneEl.value = d.slice(0, 3) + '-' + d.slice(3, d.length - 4) + '-' + d.slice(-4);
    else if (d.length > 3) phoneEl.value = d.slice(0, 3) + '-' + d.slice(3);
    else phoneEl.value = d;
  });

  function showError(text) {
    msg.textContent = text;
    msg.className = 'form-msg error';
  }

  function setInvalid(el, bad) {
    var wrap = el.closest('.field, .consent');
    if (wrap) wrap.classList.toggle('invalid', bad);
    el.setAttribute('aria-invalid', bad ? 'true' : 'false');
    return bad;
  }

  function validate() {
    var bad = false;
    bad = setInvalid(nameEl, nameEl.value.trim().length < 1) || bad;
    bad = setInvalid(phoneEl, !/^01[016789]-?\d{3,4}-?\d{4}$/.test(phoneEl.value.trim())) || bad;
    bad = setInvalid(agreeEl, !agreeEl.checked) || bad;
    var first = form.querySelector('.invalid input');
    if (first) first.focus();
    return !bad;
  }

  // 고치는 즉시 오류 표시 지우기
  [nameEl, phoneEl, agreeEl].forEach(function (el) {
    el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', function () {
      var wrap = el.closest('.field, .consent');
      if (wrap && wrap.classList.contains('invalid')) {
        if (el === nameEl) setInvalid(el, el.value.trim().length < 1);
        else if (el === phoneEl) setInvalid(el, !/^01[016789]-?\d{3,4}-?\d{4}$/.test(el.value.trim()));
        else setInvalid(el, !el.checked);
      }
    });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) return;

    var data = new FormData(form);
    data.set('신청자', nameEl.value.trim());
    data.set('신청 일시', new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));
    data.set('_subject', '[단과반 ' + (current.full ? '대기 신청' : '수강 신청') + '] ' + current.day + '요일 ' + current.program + ' - ' + nameEl.value.trim());
    data.set('_template', 'table');
    data.set('_captcha', 'false');

    submitBtn.disabled = true;
    submitBtn.textContent = '보내는 중…';
    msg.textContent = '';

    // 내 컴퓨터에서 파일을 바로 연 경우(file://)에는 FormSubmit이 전송을 거부함
    if (location.protocol === 'file:') {
      showError('지금은 컴퓨터에 있는 파일을 바로 열어서 메일이 가지 않아요. 인터넷에 배포된 사이트 주소(https://…)에서 다시 시험해 주세요.');
      submitBtn.disabled = false;
      submitBtn.textContent = '제출하기';
      return;
    }

    fetch(ENDPOINT, { method: 'POST', headers: { 'Accept': 'application/json' }, body: data })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (j) { return { ok: res.ok, status: res.status, body: j }; });
      })
      .then(function (r) {
        var serverMsg = String((r.body && r.body.message) || '');
        if (!r.ok || String(r.body.success) === 'false') {
          var err = new Error(serverMsg || ('HTTP ' + r.status));
          err.server = true;
          throw err;
        }
        form.hidden = true;
        done.hidden = false;
        var t = document.getElementById('apply-done-text');
        var tel = document.createElement('span');
        tel.style.whiteSpace = 'nowrap';
        tel.textContent = phoneEl.value;
        t.textContent = current.day + '요일 ' + current.program + (current.full ? ' 대기 신청' : ' 신청') + '이 접수되었어요. 확인 후 ';
        t.appendChild(tel);
        t.appendChild(document.createTextNode('(으)로 연락드릴게요.'));
      })
      .catch(function (err) {
        var m = String(err && err.message || '');
        if (/activat/i.test(m)) {
          showError('아직 메일 받기가 활성화되지 않았어요. ' + RECIPIENT + ' 메일함(스팸함 포함)에 온 FormSubmit의 "Activate Form" 메일에서 버튼을 눌러 주세요. 활성화한 뒤 다시 제출하면 접수됩니다.');
        } else if (/web server|html file/i.test(m)) {
          showError('컴퓨터에 있는 파일을 바로 열어서 메일이 가지 않아요. 배포된 사이트 주소(https://…)에서 다시 시험해 주세요.');
        } else if (err && err.server) {
          showError('신청서를 보내지 못했어요. 잠시 후 다시 시도해 주세요. (메일 서비스 응답: ' + m + ')');
        } else {
          // 응답을 전혀 받지 못함: FormSubmit 서버 장애, 인터넷 연결 문제, 광고 차단 기능 등
          showError('메일 서비스(FormSubmit)가 지금 응답하지 않아요. 잠시 후 다시 시도해 주세요. 계속 안 되면 광고 차단 기능을 끄고 시도하거나 담당자에게 전화로 신청해 주세요.');
        }
        if (window.console) console.warn('[신청 전송 실패]', err);
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = '제출하기';
      });
  });
})();
