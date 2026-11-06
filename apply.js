// 단과반 수강 신청 창
// 제출 내용은 Web3Forms(https://web3forms.com)를 통해 메일로 발송됩니다.
// 받는 메일 주소는 Web3Forms에서 액세스 키를 만들 때 입력한 주소(jungnang2019@daum.net)입니다.
// 액세스 키는 공개되어도 괜찮은 값이라 이 파일에 그대로 넣어도 됩니다.
(function () {
  var WEB3FORMS_ACCESS_KEY = '';   // ← 여기에 Web3Forms 액세스 키를 넣으세요 (예: 'a1b2c3d4-....')
  var ENDPOINT = 'https://api.web3forms.com/submit';
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

    if (!WEB3FORMS_ACCESS_KEY) {
      showError('메일 전송 설정이 아직 끝나지 않았어요. 담당자에게 문의해 주세요. (Web3Forms 액세스 키 필요)');
      return;
    }

    var title = (current.full ? '대기 신청' : '수강 신청');
    var payload = {
      access_key: WEB3FORMS_ACCESS_KEY,
      subject: '[단과반 ' + title + '] ' + current.day + '요일 ' + current.program + ' - ' + nameEl.value.trim(),
      from_name: '단과반 신청 페이지',
      botcheck: form.querySelector('.hp').value ? true : '',
      '프로그램': current.day + '요일 ' + current.program + ' (' + (TIMES[current.day] || '') + ')',
      '신청 구분': current.full ? '대기 신청 (정원 마감)' : '수강 신청',
      '신청자': nameEl.value.trim(),
      '전화번호': phoneEl.value.trim(),
      '개인정보 수집·이용 동의': agreeEl.checked ? '동의함' : '동의 안 함',
      '신청 일시': new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    };

    submitBtn.disabled = true;
    submitBtn.textContent = '보내는 중…';
    msg.textContent = '';

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (j) { return { ok: res.ok, status: res.status, body: j }; });
      })
      .then(function (r) {
        if (!r.ok || r.body.success !== true) {
          var err = new Error(String(r.body.message || ('HTTP ' + r.status)));
          err.server = true;
          throw err;
        }
        form.hidden = true;
        done.hidden = false;
        var t = document.getElementById('apply-done-text');
        var tel = document.createElement('span');
        tel.style.whiteSpace = 'nowrap';
        tel.textContent = phoneEl.value;
        t.textContent = current.day + '요일 ' + current.program + ' ' + title.replace('수강 ', '') + '이 접수되었어요. 확인 후 ';
        t.appendChild(tel);
        t.appendChild(document.createTextNode('(으)로 연락드릴게요.'));
      })
      .catch(function (err) {
        if (window.console) console.warn('[신청 전송 실패]', err);
        if (err && err.server) {
          showError('신청서를 보내지 못했어요. 잠시 후 다시 시도해 주세요. (메일 서비스 응답: ' + err.message + ')');
        } else {
          showError('메일 서비스에 연결하지 못했어요. 잠시 후 다시 시도해 주세요. 계속 안 되면 광고 차단 기능을 끄고 시도해 주세요.');
        }
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = '제출하기';
      });
  });
})();
