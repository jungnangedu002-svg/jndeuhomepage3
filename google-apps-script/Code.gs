/**
 * 단과반 수강 신청 접수 (Google Apps Script)
 *
 * 하는 일
 *  1) 사이트에서 보낸 신청서를 이 스프레드시트의 "신청목록" 시트에 한 줄씩 저장
 *  2) 담당자 메일(TO)로 신청 알림 메일 발송
 *
 * 설정 방법은 저장소의 GOOGLE-SETUP.md 를 보세요.
 */

const TO = 'jungnang2019@daum.net';   // 신청 알림을 받을 메일 주소
const SHEET_NAME = '신청목록';
const HEADERS = ['접수 일시', '프로그램', '신청 구분', '신청자', '전화번호', '개인정보 동의'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const p = (e && e.parameter) || {};

    // 자동 등록 프로그램(스팸) 걸러내기: 사람에게는 보이지 않는 칸이 채워져 있으면 무시
    if (p.botcheck) return json({ ok: true });

    const name = String(p.name || '').trim().slice(0, 30);
    const phone = String(p.phone || '').trim().slice(0, 13);
    const program = String(p.program || '').trim().slice(0, 60);
    const type = String(p.type || '').trim().slice(0, 30);
    const agree = String(p.agree || '').trim();

    if (!name) return json({ ok: false, message: '신청자 이름이 없습니다.' });
    if (!/^01[016789]-?\d{3,4}-?\d{4}$/.test(phone)) return json({ ok: false, message: '전화번호 형식이 올바르지 않습니다.' });
    if (agree !== '동의함') return json({ ok: false, message: '개인정보 수집·이용 동의가 필요합니다.' });

    const now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');

    // 1) 시트에 저장 (전화번호 앞의 0이 사라지지 않도록 글자로 저장)
    getSheet().appendRow([now, program, type, name, "'" + phone, agree]);

    // 2) 알림 메일
    const rows = [['프로그램', program], ['신청 구분', type], ['신청자', name], ['전화번호', phone], ['개인정보 동의', agree], ['접수 일시', now]];
    const html =
      '<p>단과반 신청이 새로 접수되었습니다.</p>' +
      '<table cellpadding="8" style="border-collapse:collapse;border:1px solid #ddd;font-size:14px">' +
      rows.map(function (r) {
        return '<tr><th align="left" style="background:#f6f3ea;border:1px solid #ddd">' + esc(r[0]) + '</th>' +
               '<td style="border:1px solid #ddd">' + esc(r[1]) + '</td></tr>';
      }).join('') +
      '</table>' +
      '<p style="color:#777;font-size:12px">신청 목록 전체는 구글 스프레드시트 "' + SHEET_NAME + '" 시트에서 볼 수 있습니다.</p>';

    MailApp.sendEmail({
      to: TO,
      subject: '[단과반 ' + type.replace(/ \(.*\)$/, '') + '] ' + program + ' - ' + name,
      htmlBody: html,
      name: '단과반 신청 페이지'
    });

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, message: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// 브라우저로 웹 앱 주소를 열었을 때 보이는 확인용 화면
function doGet() {
  return ContentService.createTextOutput('단과반 신청 접수 주소입니다. 정상 작동 중입니다.');
}

// 처음 설정할 때 한 번 실행: 권한 승인 + 시트 만들기 + 테스트 메일 발송
function testSetup() {
  getSheet();
  MailApp.sendEmail(TO, '[단과반] 메일 연결 테스트', '구글 시트와 메일 연결이 정상입니다. 이제 사이트에서 신청을 받을 수 있습니다.');
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#f6f3ea');
  }
  return sh;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
