/**
 * YouTube 投稿スケジュール GAS Web App
 *
 * セットアップ手順:
 * 1. 対象スプレッドシートを開く → 拡張機能 → Apps Script
 * 2. このファイルの内容を貼り付け
 * 3. プロジェクトの設定 → スクリプトプロパティに以下を登録
 *    - SHARED_SECRET : 長いランダム文字列 (Vercel/ローカルの GAS_SHARED_SECRET と同じ値)
 *    - SHEET_NAME    : 対象シート名 (例: "スケジュール")
 * 4. デプロイ → 新しいデプロイ → 種類: ウェブアプリ
 *    - 次のユーザーとして実行: 自分
 *    - アクセスできるユーザー: 全員
 * 5. 発行された URL を .env.local / Vercel 環境変数の GAS_WEB_APP_URL に設定
 *
 * 注意: デプロイ URL を固定したい場合は「デプロイの管理 → 編集 → 新バージョン」で更新する。
 * 「新しいデプロイ」を選ぶと URL が変わる。
 */

const HEADERS = [
  '撮影',
  '撮影予定日',
  '納品日',
  '配信日',
  '編集担当者',
  'サムネ内容',
  'タイトル',
  '内容',
  '素材',
  'id',
  'updatedAt',
];

const COL = {
  shoot: 1,
  shootDate: 2,
  deliveryDate: 3,
  publishDate: 4,
  editor: 5,
  thumbnail: 6,
  title: 7,
  content: 8,
  materialUrl: 9,
  id: 10,
  updatedAt: 11,
};

const TZ = 'Asia/Tokyo';

function doGet(e) {
  return withAuth_(e, handleList_);
}

function doPost(e) {
  return withAuth_(e, handleMutate_);
}

function withAuth_(e, fn) {
  try {
    const expected = PropertiesService.getScriptProperties().getProperty('SHARED_SECRET');
    const got = readSecret_(e);
    if (!expected || got !== expected) {
      return json_({ error: 'unauthorized' }, 401);
    }
    return fn(e);
  } catch (err) {
    return json_({ error: String(err && err.stack ? err.stack : err) }, 500);
  }
}

function readSecret_(e) {
  if (e && e.parameter && e.parameter.secret) return e.parameter.secret;
  if (e && e.postData && e.postData.contents) {
    try {
      const body = JSON.parse(e.postData.contents);
      return body.secret;
    } catch (_) {
      return null;
    }
  }
  return null;
}

function getSheet_() {
  const name = PropertiesService.getScriptProperties().getProperty('SHEET_NAME');
  if (!name) throw new Error('SHEET_NAME スクリプトプロパティが未設定です');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('シートが見つかりません: ' + name);
  ensureHeaders_(sheet);
  return sheet;
}

function ensureHeaders_(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), HEADERS.length);
  const current = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  let needsWrite = false;
  for (let i = 0; i < HEADERS.length; i++) {
    if (current[i] !== HEADERS[i]) {
      needsWrite = true;
      break;
    }
  }
  if (needsWrite) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
}

function handleList_(_e) {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return json_({ rows: [] }, 200);

  const range = sheet.getRange(2, 1, lastRow - 1, HEADERS.length);
  const values = range.getValues();
  const backgrounds = range.getBackgrounds();

  const rows = [];
  const idsToFill = [];

  for (let i = 0; i < values.length; i++) {
    const r = values[i];
    let id = String(r[COL.id - 1] || '');
    if (!id) {
      id = Utilities.getUuid();
      idsToFill.push({ row: i + 2, id });
    }
    let updatedAt = r[COL.updatedAt - 1];
    if (updatedAt instanceof Date) {
      updatedAt = updatedAt.toISOString();
    } else {
      updatedAt = String(updatedAt || '');
    }

    rows.push({
      id,
      shoot: formatCell_(r[COL.shoot - 1]),
      shootDate: formatCell_(r[COL.shootDate - 1]),
      deliveryDate: formatCell_(r[COL.deliveryDate - 1]),
      publishDate: formatCell_(r[COL.publishDate - 1]),
      editor: formatCell_(r[COL.editor - 1]),
      thumbnail: formatCell_(r[COL.thumbnail - 1]),
      title: formatCell_(r[COL.title - 1]),
      content: formatCell_(r[COL.content - 1]),
      materialUrl: formatCell_(r[COL.materialUrl - 1]),
      updatedAt,
      todo: hasRedCell_(backgrounds[i]),
    });
  }

  idsToFill.forEach((x) => {
    sheet.getRange(x.row, COL.id).setValue(x.id);
  });

  return json_({ rows }, 200);
}

function formatCell_(v) {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return String(v);
}

function hasRedCell_(bgRow) {
  if (!bgRow) return false;
  for (let i = 0; i < bgRow.length; i++) {
    const c = String(bgRow[i] || '').toLowerCase();
    if (c === '#ff0000' || c === '#f00' || c === '#ff3333' || c === '#ea4335' || c === '#cc0000' || c === '#ff4d4f') {
      return true;
    }
    if (/^#?(ff|f)[0-3][0-3][0-3][0-3]$/i.test(c)) return true;
  }
  return false;
}

function handleMutate_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return json_({ error: 'empty body' }, 400);
  }
  const body = JSON.parse(e.postData.contents);
  switch (body.action) {
    case 'create':
      return json_({ row: createRow_(body.row || {}) }, 200);
    case 'update':
      return updateRow_(body.row || {});
    case 'delete':
      return json_({ ok: deleteRow_(body.id) }, 200);
    default:
      return json_({ error: 'unknown action: ' + body.action }, 400);
  }
}

function createRow_(row) {
  const sheet = getSheet_();
  const id = Utilities.getUuid();
  const updatedAt = new Date().toISOString();
  const values = [
    row.shoot || '',
    row.shootDate || '',
    row.deliveryDate || '',
    row.publishDate || '',
    row.editor || '',
    row.thumbnail || '',
    row.title || '',
    row.content || '',
    row.materialUrl || '',
    id,
    updatedAt,
  ];
  sheet.appendRow(values);
  return Object.assign({}, row, { id, updatedAt, todo: false });
}

function updateRow_(row) {
  if (!row.id) return json_({ error: 'id is required' }, 400);
  const sheet = getSheet_();
  const rowIndex = findRowById_(sheet, row.id);
  if (rowIndex === -1) return json_({ error: 'row not found' }, 404);

  const currentUpdatedAt = sheet.getRange(rowIndex, COL.updatedAt).getValue();
  const currentIso = currentUpdatedAt instanceof Date
    ? currentUpdatedAt.toISOString()
    : String(currentUpdatedAt || '');
  if (row.updatedAt && currentIso && row.updatedAt !== currentIso) {
    return json_({ error: 'conflict', currentUpdatedAt: currentIso }, 409);
  }

  const updatedAt = new Date().toISOString();
  sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([[
    row.shoot || '',
    row.shootDate || '',
    row.deliveryDate || '',
    row.publishDate || '',
    row.editor || '',
    row.thumbnail || '',
    row.title || '',
    row.content || '',
    row.materialUrl || '',
    row.id,
    updatedAt,
  ]]);
  return json_({ row: Object.assign({}, row, { updatedAt }) }, 200);
}

function deleteRow_(id) {
  if (!id) throw new Error('id is required');
  const sheet = getSheet_();
  const rowIndex = findRowById_(sheet, id);
  if (rowIndex === -1) return false;
  sheet.deleteRow(rowIndex);
  return true;
}

function findRowById_(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sheet.getRange(2, COL.id, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

function json_(obj, status) {
  const payload = Object.assign({}, obj, { status: status || 200 });
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
