/**
 * WA AIDA CRM — backend on Google Sheets (Apps Script Web App)
 *
 * ── SETUP (5 minutes) ─────────────────────────────────────────────
 * 1. Create a Google Sheet (or reuse one). The script auto-creates a
 *    tab called "Leads" with the right headers on first run.
 * 2. In the Sheet: Extensions → Apps Script → delete the placeholder
 *    code → paste this whole file → Save (💾).
 * 3. Deploy → New deployment → type: Web app →
 *      · Execute as:  Me
 *      · Who has access:  Anyone  (or "Anyone with a Google account")
 *    → Deploy → copy the URL ending in /exec.
 * 4. In the WA AIDA CRM app: Settings (⚙) → paste the /exec URL →
 *    Save & connect.
 * 5. OPTIONAL SECURITY: set a Script property (Project Settings (⚙)
 *    → Script properties → Add property) key WA_AIDA_TOKEN with a
 *    long random value, then enter the same value in the app
 *    Settings (⚙) → Security token. The sheet data then stays locked
 *    to the app (tracked links still open for clients).
 *    locked to the app (tracked links still open for clients).
 *
 * ── WHY GET ONLY ──────────────────────────────────────────────────
 * Browsers calling Apps Script with POST hit a 302 redirect that the
 * browser silently converts to GET, losing the body. So every action
 * is a GET with query params — small payloads, zero CORS friction.
 *
 * ── SHEET SCHEMA (row 1 = headers) ────────────────────────────────
 * id | name | phone | source | product | stage | value | intent | notes | created
 *   stage values: new | contacted | qualified | proposal | won | lost
 *   source values: fb-ads | manual | csv | whatsapp
 *
 * ── FACEBOOK LEAD ADS (optional) ─────────────────────────────────
 * doGet also answers Meta's webhook verification (hub.challenge);
 * doPost ingests leadgen events, fetches details from the Graph API
 * and appends them with source = fb-ads. Set FB_PAGE_TOKEN below,
 * then follow CONNECT-FB.md.
 */

var SHEET_NAME = 'Leads';
var LINKS_SHEET = 'Links';
var LINK_HEADERS = ['id', 'leadId', 'url', 'channel', 'created', 'opens'];
var PROPOSAL_SHEET = 'Proposals';
var PROPOSAL_HEADERS = ['id', 'leadId', 'title', 'amount', 'services', 'message', 'validity', 'status', 'created', 'openedAt', 'acceptedAt', 'opens'];
var HEADERS = ['id', 'name', 'phone', 'source', 'product', 'stage', 'value', 'intent', 'notes', 'created', 'activity'];
var STAGES = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];

// ── SECURITY TOKEN (optional) ─────────────────────────────────────
// Set your secret via the Apps Script UI — NO code editing needed:
//   Project Settings (⚙) → Script properties → Add property →
//     key:   WA_AIDA_TOKEN
//     value: <a long random string you choose>
// The backend then requires ?token=*** on every action EXCEPT the
// public tracking endpoints (open / ping, so the links you send to
// clients keep working). Enter the SAME value in the app:
// Settings (⚙) → Security token → Save & connect.
// Leave the property unset (or empty) to keep everything open — the
// current behaviour.
var TOKEN = (function () {
  try { return PropertiesService.getScriptProperties().getProperty('WA_AIDA_TOKEN') || ''; }
  catch (e) { return ''; }
})();

// ── FACEBOOK LEAD ADS WEBHOOK ────────────────────────────────────
// See CONNECT-FB.md for the full setup.
//   FB_VERIFY_TOKEN is pre-set to 'waaida-ph-2026' — paste that
//   EXACT value into Meta's webhook settings when verifying.
//   FB_PAGE_TOKEN: your Facebook Page access token (long-lived),
//   used to fetch lead details from the Graph API.
var FB_VERIFY_TOKEN = 'waaida-ph-2026';  // pre-set — do not change
var FB_PAGE_TOKEN = '';  // paste your Page token here

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
  } else {
    ensureHeaders_(sh);
  }
  return sh;
}

function ensureHeaders_(sh) {
  var lastCol = Math.max(1, sh.getLastColumn());
  var first = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < HEADERS.length; i++) {
    if (first.indexOf(HEADERS[i]) < 0) {
      sh.getRange(1, i + 1).setValue(HEADERS[i]);
      first.push(HEADERS[i]);
    }
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    // Facebook webhook verification: GET ...?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
    if (p['hub.mode'] === 'subscribe') {
      if (p['hub.verify_token'] === FB_VERIFY_TOKEN) {
        return ContentService.createTextOutput(p['hub.challenge'] || '');
      }
      return ContentService.createTextOutput('verify_token_mismatch');
    }
    var action = p.action || 'list';
    // Optional token gate: when TOKEN is set (see top of file), every
    // action except the public tracking endpoints requires ?token=TOKEN.
    if (TOKEN && ['open', 'ping', 'proposal_get', 'proposal_open', 'proposal_ping', 'proposal_accept'].indexOf(action) < 0 && p.token !== TOKEN) {
      return json_({ error: 'unauthorized' });
    }
    var sh = sheet_();
    if (action === 'list') return json_(list_(sh));
    if (action === 'meta') return json_(meta_(sh));
    if (action === 'add') return json_(add_(sh, p));
    if (action === 'stage') return json_(stage_(sh, p));
    if (action === 'note') return json_(note_(sh, p));
    if (action === 'value') return json_(value_(sh, p));
    if (action === 'delete') return json_(del_(sh, p));
    if (action === 'link') return json_(linkCreate_(sh, p));
    if (action === 'links') return json_(linkList_(sh, p));
    if (action === 'linkdel') return json_(linkDel_(sh, p));
    if (action === 'ping') return json_(linkPing_(sh, p));
    if (action === 'actlog') return json_(actLog_(sh, p));
    if (action === 'proposal_create') return json_(proposalCreate_(sh, p));
    if (action === 'proposal_list') return json_(proposalList_(sh, p));
    if (action === 'proposal_del') return json_(proposalDel_(sh, p));
    if (action === 'proposal_get') return json_(proposalGet_(sh, p));
    if (action === 'proposal_open') return json_(proposalOpen_(sh, p));
    if (action === 'proposal_ping') return json_(proposalPing_(sh, p));
    if (action === 'proposal_accept') return json_(proposalAccept_(sh, p));
    if (action === 'wa_send') return json_(waSend_(sh, p));
    if (action === 'fu_save') return json_(fuSave_(sh, p));
    if (action === 'fu_del') return json_(fuDel_(sh, p));
    if (action === 'fu_list') return json_(fuList_(sh, p));
    if (action === 'tpl_save') return json_(tplSave_(sh, p));
    if (action === 'tpl_del') return json_(tplDel_(sh, p));
    if (action === 'tpl_list') return json_(tplList_(sh, p));
    if (action === 'tpl_use') return json_(tplUse_(sh, p));
    if (action === 'open') return openPage_(sh, p);
    return json_({ error: 'unknown action: ' + action });
  } catch (err) {
    return json_({ error: String(err) });
  }
}

// Facebook sends lead events as POST with a JSON body.
// (Server-to-server POST works with Apps Script — the same pattern as
//  Telegram bots; the browser POST-redirect caveat does not apply here.)
function doPost(e) {
  try {
    var sh = sheet_();
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var changes = (body.entry || []).reduce(function (a, en) { return a.concat(en.changes || []); }, []);
    var results = [];
    for (var i = 0; i < changes.length; i++) {
      var v = changes[i].value || {};
      if (v.leadgen_id) results.push(handleLeadgen_(sh, v));
    }
    return json_({ ok: true, processed: results.length });
  } catch (err) {
    return json_({ error: String(err) });
  }
}

/* ── Follow-up reminders (V19) ─────────────────────────────────────
 * The app schedules follow-ups; they are synced here into a Reminders
 * tab so a daily email digest can fire even when no device is open.
 * sendFollowupReminders() is meant for a time-driven trigger the owner
 * adds once in Apps Script (Triggers → Add → Day timer).
 * ─────────────────────────────────────────────────────────────────── */
var REMINDER_SHEET = 'Reminders';
var REMINDER_HEADERS = ['id', 'leadId', 'name', 'phone', 'what', 'when', 'done', 'reminded', 'created'];

function reminders_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var rsh = ss.getSheetByName(REMINDER_SHEET);
  if (!rsh) {
    rsh = ss.insertSheet(REMINDER_SHEET);
    rsh.appendRow(REMINDER_HEADERS);
  } else {
    var lastCol = Math.max(1, rsh.getLastColumn());
    var first = rsh.getRange(1, 1, 1, lastCol).getValues()[0];
    for (var i = 0; i < REMINDER_HEADERS.length; i++) {
      if (first.indexOf(REMINDER_HEADERS[i]) < 0) rsh.getRange(1, i + 1).setValue(REMINDER_HEADERS[i]);
    }
  }
  return rsh;
}

function fuSave_(sh, p) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var rsh = reminders_();
    var id = String(p.id || ('F' + Date.now()));
    var values = rsh.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0]) === id) {
        rsh.getRange(i + 1, 2, 1, 7).setValues([[String(p.leadId || ''), p.name || '', String(p.phone || ''), p.what || '', Number(p.when) || 0, values[i][6] || '', values[i][7] || '']]);
        return { ok: true, id: id, updated: true };
      }
    }
    rsh.appendRow([id, String(p.leadId || ''), p.name || '', String(p.phone || ''), p.what || '', Number(p.when) || 0, '', '', new Date().toISOString()]);
    return { ok: true, id: id };
  } finally {
    lock.releaseLock();
  }
}

function fuDel_(sh, p) {
  var rsh = reminders_();
  var values = rsh.getDataRange().getValues();
  for (var i = values.length - 1; i >= 1; i--) {
    if (p.id && String(values[i][0]) === String(p.id)) {
      rsh.deleteRow(i + 1);
      return { ok: true, deleted: 1 };
    }
  }
  return { ok: true, deleted: 0 };
}

function fuList_(sh, p) {
  var rsh = reminders_();
  var values = rsh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < values.length; i++) {
    if (!values[i][0]) continue;
    out.push({ id: values[i][0], leadId: values[i][1], name: values[i][2], phone: values[i][3], what: values[i][4], when: values[i][5], done: values[i][6], reminded: values[i][7] });
  }
  return out;
}

/* ── Editable message templates (V19.2) ───────────────────────────
 * The app keeps defaults in code; user edits are upserted here so they
 * survive cache clears and reach other devices via tpl_list.
 * ─────────────────────────────────────────────────────────────────── */
var TEMPLATE_SHEET = 'Templates';
var TEMPLATE_HEADERS = ['id', 'name', 'body', 'updated', 'uses'];

function templates_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tsh = ss.getSheetByName(TEMPLATE_SHEET);
  if (!tsh) {
    tsh = ss.insertSheet(TEMPLATE_SHEET);
    tsh.appendRow(TEMPLATE_HEADERS);
  } else {
    var lastCol = Math.max(1, tsh.getLastColumn());
    var first = tsh.getRange(1, 1, 1, lastCol).getValues()[0];
    for (var i = 0; i < TEMPLATE_HEADERS.length; i++) {
      if (first.indexOf(TEMPLATE_HEADERS[i]) < 0) tsh.getRange(1, i + 1).setValue(TEMPLATE_HEADERS[i]);
    }
  }
  return tsh;
}

function tplSave_(sh, p) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var tsh = templates_();
    var id = String(p.id || '');
    if (!id) return { error: 'missing id' };
    var values = tsh.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0]) === id) {
        tsh.getRange(i + 1, 2, 1, 3).setValues([[p.name || '', p.body || '', new Date().toISOString()]]);
        return { ok: true, id: id, updated: true };
      }
    }
    tsh.appendRow([id, p.name || '', p.body || '', new Date().toISOString(), 0]);
    return { ok: true, id: id };
  } finally {
    lock.releaseLock();
  }
}

// usage counter: server keeps the durable total; client sends its local
// count as base so a device with history never loses it
function tplUse_(sh, p) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var tsh = templates_();
    var id = String(p.id || '');
    if (!id) return { error: 'missing id' };
    var base = Number(p.base) || 0;
    var values = tsh.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0]) === id) {
        var uses = Math.max(Number(values[i][4]) || 0, base) + 1;
        tsh.getRange(i + 1, 5).setValue(uses);
        return { ok: true, id: id, uses: uses };
      }
    }
    tsh.appendRow([id, '', '', new Date().toISOString(), base + 1]);
    return { ok: true, id: id, uses: base + 1 };
  } finally {
    lock.releaseLock();
  }
}

function tplDel_(sh, p) {
  var tsh = templates_();
  var values = tsh.getDataRange().getValues();
  for (var i = values.length - 1; i >= 1; i--) {
    if (p.id && String(values[i][0]) === String(p.id)) {
      tsh.deleteRow(i + 1);
      return { ok: true, deleted: 1 };
    }
  }
  return { ok: true, deleted: 0 };
}

function tplList_(sh) {
  var tsh = templates_();
  var values = tsh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < values.length; i++) {
    if (!values[i][0]) continue;
    out.push({ id: values[i][0], name: values[i][1], body: values[i][2], updated: values[i][3], uses: Number(values[i][4]) || 0 });
  }
  return out;
}

// Daily digest — attach to a time-driven trigger (Day timer).
// Emails the owner every follow-up due within 24h, plus overdue ones
// (up to 7 days old) that were never marked done. Marks each reminded.
function sendFollowupReminders() {
  try {
    var rsh = reminders_();
    var values = rsh.getDataRange().getValues();
    var now = Date.now();
    var due = [];
    for (var i = 1; i < values.length; i++) {
      var id = values[i][0];
      if (!id) continue;
      var when = Number(values[i][5]) || 0;
      if (!when) continue;
      if (String(values[i][6] || '')) continue; // done
      if (String(values[i][7] || '')) continue; // already reminded
      var dueSoon = when > now && when - now <= 24 * 3600 * 1000;
      var overdue = when <= now && now - when <= 7 * 24 * 3600 * 1000;
      if (dueSoon || overdue) due.push({ row: i + 1, name: values[i][2], phone: values[i][3], what: values[i][4], when: when });
    }
    if (!due.length) return { ok: true, sent: 0 };
    due.sort(function (a, b) { return a.when - b.when; });
    var owner = PropertiesService.getScriptProperties().getProperty('WA_AIDA_OWNER_EMAIL') || Session.getEffectiveUser().getEmail();
    var tz = Session.getScriptTimeZone();
    var lines = due.map(function (d) {
      var dt = Utilities.formatDate(new Date(d.when), tz, 'EEE, MMM d h:mm a');
      return '\u2022 ' + d.name + (d.phone ? ' (' + d.phone + ')' : '') + ' \u2014 ' + d.what + ' \u2014 due ' + dt;
    });
    var subject = 'WA AIDA: ' + due.length + ' follow-up' + (due.length > 1 ? 's' : '') + ' due';
    var body = 'Follow-ups due in the next 24 hours (or overdue):\n\n' + lines.join('\n') + '\n\nOpen your WA AIDA app \u2192 Follow-up tab to act on these.\n\n\u2014 WA AIDA CRM';
    MailApp.sendEmail(owner, subject, body);
    for (var k = 0; k < due.length; k++) rsh.getRange(due[k].row, 8).setValue(new Date().toISOString());
    return { ok: true, sent: due.length };
  } catch (err) {
    return { error: String(err) };
  }
}

// Fetch lead details from the Graph API and append to the sheet.
function handleLeadgen_(sh, v) {
  var fields = [];
  if (FB_PAGE_TOKEN) {
    try {
      var res = UrlFetchApp.fetch('https://graph.facebook.com/v19.0/' + v.leadgen_id + '?access_token=' + FB_PAGE_TOKEN, { muteHttpExceptions: true });
      var data = JSON.parse(res.getContentText());
      if (data.field_data) fields = data.field_data;
    } catch (err) { /* fall through with empty fields */ }
  }
  function field(name) {
    for (var i = 0; i < fields.length; i++) {
      if (fields[i].name === name && fields[i].values && fields[i].values.length) return fields[i].values[0];
    }
    return '';
  }
  var name = field('full_name') || 'FB Lead';
  var phone = field('phone_number') || '';
  var product = field('product') || field('interest') || field('business_type') || field('what_are_you_interested_in') || 'FB Lead Ad';
  var email = field('email') || '';
  var raw = [];
  fields.forEach(function (f) { raw.push(f.name + ': ' + (f.values || []).join(', ')); });

  // Dedupe: same normalized phone OR same name already in the sheet?
  var norm = String(phone).replace(/[^0-9]/g, '');
  var existing = rows_(sh);
  for (var j = 0; j < existing.length; j++) {
    var eNorm = String(existing[j].phone || '').replace(/[^0-9]/g, '');
    if ((norm && eNorm === norm) || (String(existing[j].name || '').toLowerCase() === String(name).toLowerCase())) {
      return { skipped: 'duplicate', id: existing[j].id };
    }
  }

  var id = nextId_(sh);
  sh.appendRow([id, name, phone, 'fb-ads', product, 'new', 0, 70, (email ? 'Email: ' + email + ' | ' : '') + raw.join(' | '), new Date(), JSON.stringify([{ t: 'created', ts: new Date().toISOString(), label: 'Lead captured' }])]);
  return { ok: true, id: id };
}

function rows_(sh) {
  var values = sh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    var row = {};
    for (var j = 0; j < HEADERS.length; j++) row[HEADERS[j]] = r[j];
    if (!row.name) continue;
    row._row = i + 1;
    out.push(row);
  }
  return out;
}

function nextId_(sh) {
  var ids = rows_(sh).map(function (r) { return Number(r.id) || 0; });
  return (ids.length ? Math.max.apply(null, ids) : 0) + 1;
}

function proposals_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(PROPOSAL_SHEET);
  if (!sh) {
    sh = ss.insertSheet(PROPOSAL_SHEET);
    sh.appendRow(PROPOSAL_HEADERS);
  }
  var lastCol = Math.max(1, sh.getLastColumn());
  var first = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < PROPOSAL_HEADERS.length; i++) {
    if (first.indexOf(PROPOSAL_HEADERS[i]) < 0) sh.getRange(1, i + 1).setValue(PROPOSAL_HEADERS[i]);
  }
  return sh;
}

function findProposalRow_(psh, id) {
  var values = psh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] && String(values[i][0]) === String(id)) return { row: i + 1, r: values[i] };
  }
  return { row: -1, r: null };
}

function proposalRecord_(psh, rowIdx, kind) {
  var cur = [];
  try { cur = JSON.parse(psh.getRange(rowIdx, 12).getValue() || '[]') || []; } catch (e) {}
  var now = new Date().toISOString();
  var last = cur.length ? new Date(cur[cur.length - 1].ts).getTime() : 0;
  if (Date.now() - last < 10000) return;
  cur.push({ ts: now, kind: kind });
  psh.getRange(rowIdx, 12).setValue(JSON.stringify(cur));
}

function findRow_(sh, id) {
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) return i + 1;
  }
  return -1;
}

function list_(sh) {
  return rows_(sh);
}

function meta_(sh) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return { ok: true, sheetUrl: ss.getUrl(), sheetName: ss.getName() + ' / ' + SHEET_NAME, count: rows_(sh).length };
}

function add_(sh, p) {
  var id = nextId_(sh);
  sh.appendRow([
    id,
    p.name || 'Unnamed',
    p.phone || '',
    p.source || 'manual',
    p.product || 'Other',
    p.stage || 'new',
    Number(String(p.value || '0').replace(/[^0-9]/g, '')) || 0,
    Number(p.intent) || 50,
    p.notes || '',
    new Date(),
    JSON.stringify([{ t: 'created', ts: new Date().toISOString(), label: 'Lead captured' }])
  ]);
  return { ok: true, id: id };
}

function stage_(sh, p) {
  var r = findRow_(sh, p.id);
  if (r < 0) return { error: 'lead not found' };
  var s = STAGES.indexOf(p.stage) >= 0 ? p.stage : 'new';
  sh.getRange(r, 6).setValue(s);   // column 6 = stage
  actAppend_(sh, r, { t: 'stage', ts: new Date().toISOString(), label: 'Moved to ' + STAGE_LABELS[s] });
  return { ok: true };
}

function note_(sh, p) {
  var r = findRow_(sh, p.id);
  if (r < 0) return { error: 'lead not found' };
  sh.getRange(r, 9).setValue(p.notes || '');  // column 9 = notes
  actAppend_(sh, r, { t: 'note', ts: new Date().toISOString(), label: 'Note added' });
  return { ok: true };
}

function actAppend_(sh, r, entry) {
  var cur = [];
  try { cur = JSON.parse(sh.getRange(r, 11).getValue() || '[]') || []; } catch (e) {}
  cur.push(entry);
  sh.getRange(r, 11).setValue(JSON.stringify(cur));
}

// Set a lead's deal value (col 7) + log it in activity
function value_(sh, p) {
  var r = findRow_(sh, p.id);
  if (r < 0) r = findRowByRow_(sh, p.id);
  if (r < 0) return { error: 'lead not found' };
  var v = Number(String(p.value || '0').replace(/[^0-9]/g, '')) || 0;
  sh.getRange(r, 7).setValue(v);
  actAppend_(sh, r, { t: 'stage', ts: new Date().toISOString(), label: 'Deal value set to \u20B1' + v });
  return { ok: true, value: v };
}

var STAGE_LABELS = { new: 'New', contacted: 'Contacted', qualified: 'Qualified', proposal: 'Proposal', won: 'Won', lost: 'Lost' };

function del_(sh, p) {
  var r = findRow_(sh, p.id);
  if (r < 0) r = findRowByRow_(sh, p.id);
  if (r < 0) return { error: 'lead not found' };
  var leadId = String(p.id);
  sh.deleteRow(r);
  // cascade: remove this lead's tracked links, proposals and reminders
  var lsh = links_();
  var lv = lsh.getDataRange().getValues();
  for (var i = lv.length - 1; i >= 1; i--) {
    if (String(lv[i][1]) === leadId) lsh.deleteRow(i + 1);
  }
  var psh = proposals_();
  var pv = psh.getDataRange().getValues();
  for (var j = pv.length - 1; j >= 1; j--) {
    if (String(pv[j][1]) === leadId) psh.deleteRow(j + 1);
  }
  var rsh = reminders_();
  var rv = rsh.getDataRange().getValues();
  for (var k = rv.length - 1; k >= 1; k--) {
    if (String(rv[k][1]) === leadId) rsh.deleteRow(k + 1);
  }
  return { ok: true };
}

function findRowByRow_(sh, id) {
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(i + 1) === String(id)) return i + 1;
  }
  return -1;
}

// ── LINK TRACKING (Privyr-style) ─────────────────────────────────
// 'link' creates a trackable link; 'open' serves a branded splash page
// that records the hit and redirects; 'ping' records heartbeats while
// the page is visible; 'links' lists links per lead; 'linkdel' cleans up.
function links_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(LINKS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(LINKS_SHEET);
    sh.appendRow(LINK_HEADERS);
  }
  var lastCol = Math.max(1, sh.getLastColumn());
  var first = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < LINK_HEADERS.length; i++) {
    if (first.indexOf(LINK_HEADERS[i]) < 0) sh.getRange(1, i + 1).setValue(LINK_HEADERS[i]);
  }
  return sh;
}

function findLinkRow_(sh, id) {
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) return i + 1;
  }
  return -1;
}

function linkCreate_(sh, p) {
  var id = 'L' + Date.now();
  links_().appendRow([id, String(p.leadId || ''), p.url || '', p.channel || 'whatsapp', new Date().toISOString(), '[]']);
  return { ok: true, id: id, trackUrl: ScriptApp.getService().getUrl() + '?action=open&id=' + id };
}

function linkList_(sh, p) {
  var lsh = links_();
  var values = lsh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    if (!r[0]) continue;
    if (p.leadId && String(r[1]) !== String(p.leadId)) continue;
    out.push({ id: r[0], leadId: r[1], url: r[2], channel: r[3], created: r[4], opens: r[5] || '[]' });
  }
  return out;
}

function linkDel_(sh, p) {
  var lsh = links_();
  var values = lsh.getDataRange().getValues();
  var del = [];
  for (var i = 1; i < values.length; i++) {
    if (p.id && String(values[i][0]) === String(p.id)) del.push(i + 1);
    else if (p.leadId && String(values[i][1]) === String(p.leadId)) del.push(i + 1);
  }
  for (var j = del.length - 1; j >= 0; j--) lsh.deleteRow(del[j]);
  return { ok: true, deleted: del.length };
}

function linkRecord_(lsh, rowIdx, kind) {
  var cur = [];
  try { cur = JSON.parse(lsh.getRange(rowIdx, 6).getValue() || '[]') || []; } catch (e) {}
  var now = new Date().toISOString();
  var last = cur.length ? new Date(cur[cur.length - 1].ts).getTime() : 0;
  if (Date.now() - last < 10000) return; // dedupe: same session within 10s
  cur.push({ ts: now, kind: kind });
  lsh.getRange(rowIdx, 6).setValue(JSON.stringify(cur));
}

function linkPing_(sh, p) {
  var r = findLinkRow_(links_(), p.id);
  if (r < 0) return { ok: false };
  linkRecord_(links_(), r, 'ping');
  return { ok: true };
}

function proposalCreate_(sh, p) {
  var id = 'P' + Date.now();
  proposals_().appendRow([
    id,
    String(p.leadId || ''),
    p.title || 'Proposal',
    Number(String(p.amount || '0').replace(/[^0-9]/g, '')) || 0,
    p.services || '',
    p.message || '',
    p.validity || '',
    'created',
    new Date().toISOString(),
    '', '', '[]'
  ]);
  var r = findRow_(sh, p.leadId);
  if (r > 0) actAppend_(sh, r, { t: 'proposal', ts: new Date().toISOString(), label: 'Proposal created: ' + (p.title || '') });
  return { ok: true, id: id };
}

function proposalList_(sh, p) {
  var psh = proposals_();
  var values = psh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    if (!r[0]) continue;
    if (p.leadId && String(r[1]) !== String(p.leadId)) continue;
    out.push({ id: r[0], leadId: r[1], title: r[2], amount: r[3], services: r[4], message: r[5], validity: r[6], status: r[7], created: r[8], openedAt: r[9] || '', acceptedAt: r[10] || '', opens: r[11] || '[]' });
  }
  return out;
}

function proposalDel_(sh, p) {
  var psh = proposals_();
  var values = psh.getDataRange().getValues();
  var del = [];
  for (var i = 1; i < values.length; i++) {
    if (p.id && String(values[i][0]) === String(p.id)) del.push(i + 1);
    else if (p.leadId && String(values[i][1]) === String(p.leadId)) del.push(i + 1);
  }
  for (var j = del.length - 1; j >= 0; j--) psh.deleteRow(del[j]);
  return { ok: true, deleted: del.length };
}

function proposalGet_(sh, p) {
  var f = findProposalRow_(proposals_(), p.id);
  if (f.row < 0) return { error: 'proposal not found' };
  var r = f.r;
  var leadName = '';
  var lr = findRow_(sh, r[1]);
  if (lr > 0) leadName = sh.getRange(lr, 2).getValue() || '';
  return { ok: true, id: r[0], leadName: leadName, title: r[2], amount: r[3], services: r[4], message: r[5], validity: r[6], status: r[7], created: r[8], openedAt: r[9] || '', acceptedAt: r[10] || '' };
}

function proposalOpen_(sh, p) {
  var psh = proposals_();
  var f = findProposalRow_(psh, p.id);
  if (f.row < 0) return { ok: false };
  if (!f.r[9]) psh.getRange(f.row, 10).setValue(new Date().toISOString());
  proposalRecord_(psh, f.row, 'open');
  return { ok: true };
}

function proposalPing_(sh, p) {
  var psh = proposals_();
  var f = findProposalRow_(psh, p.id);
  if (f.row < 0) return { ok: false };
  proposalRecord_(psh, f.row, 'ping');
  return { ok: true };
}

function proposalAccept_(sh, p) {
  var psh = proposals_();
  var f = findProposalRow_(psh, p.id);
  if (f.row < 0) return { ok: false, error: 'proposal not found' };
  var was = f.r[7];
  psh.getRange(f.row, 8).setValue('accepted');
  psh.getRange(f.row, 11).setValue(new Date().toISOString());
  var lr = findRow_(sh, f.r[1]);
  if (lr > 0) {
    sh.getRange(lr, 6).setValue('won');
    actAppend_(sh, lr, { t: 'stage', ts: new Date().toISOString(), label: 'Proposal accepted — moved to Won' });
  }
  if (was !== 'accepted') {
    try {
      var ownerEmail = (function () {
        try { return PropertiesService.getScriptProperties().getProperty('WA_AIDA_OWNER_EMAIL') || Session.getEffectiveUser().getEmail() || Session.getActiveUser().getEmail(); } catch (e2) { return ''; }
      })();
      if (ownerEmail) {
        MailApp.sendEmail(ownerEmail, 'Proposal accepted: ' + (f.r[2] || ''),
          'Your client accepted the proposal "' + (f.r[2] || '') + '" (' + f.r[0] + ').\nAmount: ₱' + (f.r[3] || 0) + '.\nAccepted at: ' + new Date().toISOString());
      }
    } catch (e3) { /* email is best-effort */ }
  }
  return { ok: true, id: p.id, firstAccept: was !== 'accepted' };
}

// WhatsApp Cloud API (optional) — set Script property WA_WABA_TOKEN.
function waSend_(sh, p) {
  var token = (function () { try { return PropertiesService.getScriptProperties().getProperty('WA_WABA_TOKEN') || ''; } catch (e) { return ''; } })();
  if (!token) return { ok: false, error: 'WA_WABA_TOKEN not set — see CONNECT-WHATSAPP.md' };
  var to = String(p.phone || '').replace(/[^0-9]/g, '');
  if (!to) return { ok: false, error: 'phone missing' };
  var phoneId = (function () { try { return PropertiesService.getScriptProperties().getProperty('WA_WABA_PHONE') || ''; } catch (e) { return ''; } })();
  var payload = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'text',
    text: { body: String(p.text || '') }
  };
  try {
    var res = UrlFetchApp.fetch('https://graph.facebook.com/v19.0/' + (phoneId || 'me') + '/messages', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    var out = JSON.parse(res.getContentText());
    return { ok: !out.error, messages: out.messages || [], error: (out.error && out.error.message) || '' };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function openPage_(sh, p) {
  var lsh = links_();
  var r = findLinkRow_(lsh, p.id);
  var url = '';
  if (r > 0) {
    url = lsh.getRange(r, 3).getValue() || '';
    linkRecord_(lsh, r, 'open');
  }
  var html = splashHtml_(p.id, url);
  // HtmlService (not ContentService): the /macros echo redirect serves
  // ContentService output as text/plain, which makes browsers show the
  // splash as raw source. HtmlService serves proper text/html pages.
  return HtmlService.createHtmlOutput(html).setTitle('WA AIDA');
}

function splashHtml_(id, url) {
  var dest = String(url || '').replace(/"/g, '%22');
  var base = ScriptApp.getService().getUrl();
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WA AIDA</title><style>body{margin:0;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#fdf8f3;color:#16213e;display:flex;min-height:100vh;align-items:center;justify-content:center}.card{text-align:center;padding:40px 28px;max-width:360px}.logo{font-weight:800;font-size:18px;letter-spacing:.3px}.logo b{color:#1b5e20}.dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#25d366;margin-right:6px;vertical-align:1px;animation:p 1.2s infinite}@keyframes p{50%{opacity:.25}}.msg{color:#5b6478;font-size:14px;margin-top:14px;line-height:1.5}.go{margin-top:18px;color:#1b5e20;font-size:13px;text-decoration:underline;cursor:pointer;background:none;border:0;font:inherit}</style></head><body><div class="card" id="card"><div class="logo"><span class="dot"></span>WA <b>AIDA</b></div><div class="msg">Opening…</div><button class="go" id="go">Open directly instead</button></div><script>var id=' + JSON.stringify(id) + ';var base=' + JSON.stringify(base) + ';var dest=' + JSON.stringify(dest) + ';function ping(){try{fetch(base+"?action=ping&id="+id+"&t="+Date.now(),{mode:"no-cors"})}catch(e){}}var iv=setInterval(function(){if(document.visibilityState==="visible")ping()},5000);ping();document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible")ping()});function go(){location.replace(dest)}document.getElementById("go").addEventListener("click",go);if(!dest){document.querySelector(".msg").textContent="This link is no longer available.";return}var f=document.createElement("iframe");f.style.cssText="position:fixed;inset:0;width:100%;height:100%;border:0;z-index:1";f.src=dest;var loaded=false;f.onload=function(){loaded=true;document.getElementById("card").style.display="none"};document.body.appendChild(f);setTimeout(function(){if(!loaded)go()},4500);window.addEventListener("pagehide",ping)</script></body></html>';
}

function actLog_(sh, p) {
  var r = findRow_(sh, p.id);
  if (r < 0) return { error: 'lead not found' };
  actAppend_(sh, r, { t: 'link', ts: new Date().toISOString(), label: p.label || 'Activity' });
  return { ok: true };
}
