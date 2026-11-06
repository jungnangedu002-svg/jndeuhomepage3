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

// ── 요금·한도 알림 설정 ──────────────────────────────────────────
// 구글 무료 계정은 하루에 보낼 수 있는 메일 수가 정해져 있습니다(약 100통).
// 남은 수가 이 숫자 이하가 되면 하루 한 번 경고 메일을 보냅니다.
const WARN_REMAINING_MAIL = 20;
// 한 달 신청 건수가 이 숫자를 넘으면 매일 점검 때 알려 줍니다. (평소보다 많이 들어오는지 확인용)
const WARN_MONTHLY_SUBMISSIONS = 200;

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

    // 오늘 보낼 수 있는 메일이 남아 있을 때만 발송 (한도가 다 차도 신청은 시트에 저장됨)
    if (MailApp.getRemainingDailyQuota() > 1) {
      MailApp.sendEmail({
        to: TO,
        subject: '[단과반 ' + type.replace(/ \(.*\)$/, '') + '] ' + program + ' - ' + name,
        htmlBody: html,
        name: '단과반 신청 페이지'
      });
    }
    warnIfMailQuotaLow();

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

// ── 요금·한도 알림 ─────────────────────────────────────────────

// 메일 한도가 얼마 남지 않으면 하루 한 번만 경고 메일 보내기
function warnIfMailQuotaLow() {
  const left = MailApp.getRemainingDailyQuota();
  if (left > WARN_REMAINING_MAIL) return;
  const props = PropertiesService.getScriptProperties();
  const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  if (props.getProperty('quotaWarned') === today) return;
  props.setProperty('quotaWarned', today);
  if (left < 1) return; // 남은 메일이 없으면 경고 메일도 못 보냄 (신청은 시트에 계속 저장)
  MailApp.sendEmail({
    to: TO,
    name: '단과반 신청 페이지',
    subject: '[단과반] 오늘 메일 발송 한도가 얼마 남지 않았어요 (' + left + '통 남음)',
    htmlBody:
      '<p>구글 무료 계정의 <b>하루 메일 발송 한도</b>가 거의 찼습니다. 오늘 남은 메일: <b>' + left + '통</b></p>' +
      '<ul><li>돈이 청구되는 것은 아닙니다. 한도가 차면 그날은 알림 메일만 멈추고, <b>신청은 구글 시트에 계속 저장</b>됩니다.</li>' +
      '<li>한도는 다음 날 다시 채워집니다.</li>' +
      '<li>평소보다 신청이 너무 많다면 자동 등록(스팸)일 수 있으니 시트를 확인해 주세요.</li></ul>'
  });
}

// 매일 아침 점검: 메일 한도와 이번 달 신청 건수 확인 (문제가 있을 때만 메일)
function dailyCheck() {
  warnIfMailQuotaLow();
  const sh = getSheet();
  const month = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM');
  const n = Math.max(sh.getLastRow() - 1, 0);
  let count = 0;
  if (n > 0) {
    sh.getRange(2, 1, n, 1).getDisplayValues().forEach(function (r) { if (String(r[0]).indexOf(month) === 0) count++; });
  }
  if (count > WARN_MONTHLY_SUBMISSIONS) {
    MailApp.sendEmail(TO, '[단과반] 이번 달 신청이 평소보다 많아요 (' + count + '건)',
      '이번 달 신청이 ' + count + '건 들어왔습니다. 자동 등록(스팸)이 아닌지 구글 시트를 확인해 주세요.\n' +
      '돈이 청구되는 것은 아니며, 메일 한도가 차면 그날은 알림 메일만 멈추고 신청은 시트에 저장됩니다.');
  }
}

// 매달 1일: 요금 안전 점검표 메일
function monthlyReminder() {
  const html =
    '<h3>단과반 사이트 · 이번 달 요금 안전 점검</h3>' +
    '<p>지금 쓰는 서비스는 모두 <b>무료</b>이고, <b>카드(결제 수단)를 등록하지 않으면 요금이 청구되지 않습니다.</b> ' +
    '무료 한도를 넘으면 요금이 나가는 것이 아니라 기능이 잠시 멈춥니다.</p>' +
    '<p>아래 항목만 한 번씩 확인해 주세요. (5분)</p>' +
    '<ol>' +
    '<li><b>Vercel</b> · <a href="https://vercel.com/account/billing">vercel.com/account/billing</a><br>' +
    '요금제가 <b>Hobby</b>(무료)인지, 결제 수단이 <b>등록되어 있지 않은지</b> 확인. ' +
    '"Upgrade to Pro", "Start Trial" 버튼은 누르지 않기.<br>' +
    '사용량은 프로젝트의 <b>Usage</b> 메뉴에서 볼 수 있습니다. (Hobby는 한도를 넘어도 요금이 나가지 않고 일시 제한됩니다)</li>' +
    '<li><b>GitHub</b> · <a href="https://github.com/settings/billing">github.com/settings/billing</a><br>' +
    '요금제가 <b>Free</b>인지 확인. 결제 수단을 등록하지 않기.</li>' +
    '<li><b>구글</b> · <a href="https://one.google.com/">one.google.com</a><br>' +
    'Google One 유료 저장공간을 신청하지 않았는지 확인. (신청 목록은 용량을 거의 쓰지 않습니다)<br>' +
    'Apps Script 메일 발송은 무료이며, 하루 한도를 넘으면 그날만 알림 메일이 멈춥니다.</li>' +
    '<li><b>도메인</b> · 따로 주소(도메인)를 사지 않았다면 해당 없음. ' +
    '샀다면 자동 연장(자동 결제) 여부를 확인.</li>' +
    '</ol>' +
    '<p style="color:#777;font-size:12px">이 메일은 매달 1일 자동으로 발송됩니다. 멈추려면 Apps Script의 "트리거" 메뉴에서 monthlyReminder를 삭제하세요.</p>';
  MailApp.sendEmail({ to: TO, name: '단과반 신청 페이지', subject: '[단과반] 이번 달 요금 안전 점검 (무료 유지 확인)', htmlBody: html });
}

// 처음 한 번 실행: 매일 점검 + 매달 점검 메일 자동 예약 (여러 번 실행해도 중복되지 않음)
function setupAlerts() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    const f = t.getHandlerFunction();
    if (f === 'dailyCheck' || f === 'monthlyReminder') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailyCheck').timeBased().everyDays(1).atHour(9).inTimezone('Asia/Seoul').create();
  ScriptApp.newTrigger('monthlyReminder').timeBased().onMonthDay(1).atHour(10).inTimezone('Asia/Seoul').create();
  monthlyReminder(); // 설정 확인용으로 점검표 메일을 지금 한 번 보냄
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
