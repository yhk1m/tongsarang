/**
 * Google Apps Script — 통사랑 오류 제보
 *
 * 사용법:
 * 1. Google Sheets에서 "확장 프로그램 > Apps Script" 열기
 * 2. 이 코드를 Code.gs에 붙여넣기
 * 3. 배포 > 새 배포 > 웹 앱 (누구나 접근 가능) 선택
 * 4. 배포 URL을 src/core/ReportAPI.js의 SHEETS_URL에 입력
 *
 * 시트 헤더 (1행):
 * timestamp | 소속 | 이름 | 직위 | 담당과목 | 과목 | 학년도 | 분류 | 번호 | 오류내용
 */

// eslint-disable-next-line no-unused-vars
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);

  sheet.appendRow([
    new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
    data['소속'] || '',
    data['이름'] || '',
    data['직위'] || '',
    data['담당과목'] || '',
    data['과목'] || '',
    data['학년도'] || '',
    data['분류'] || '',
    data['번호'] || '',
    data['오류내용'] || ''
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ result: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// eslint-disable-next-line no-unused-vars
function doGet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var rows = sheet.getDataRange().getValues();

  if (rows.length <= 1) {
    return ContentService
      .createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var headers = rows[0];
  var result = [];

  for (var i = 1; i < rows.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = rows[i][j];
    }
    result.push(obj);
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
