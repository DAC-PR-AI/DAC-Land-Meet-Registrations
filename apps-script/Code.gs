/**
 * DAC Developers – Event RSVP backend (Google Apps Script)
 * -------------------------------------------------------------------------
 * Bind this script to a Google Sheet (Extensions → Apps Script).
 *
 * Script Properties (Project Settings → Script Properties):
 *   APPS_SCRIPT_SECRET  – long random string; must equal the Vercel env var
 *   SITE_URL            – e.g. https://dac-invite.vercel.app (no trailing slash)
 *
 * First time: run setup() once from the editor to create the sheet and
 * grant permissions (Sheets + Gmail). Then Deploy → New deployment →
 * Web app → Execute as: Me, Who has access: Anyone.
 * -------------------------------------------------------------------------
 */

var EVENT = {
  shortName: 'DAC Land Acquisition Meet',
  title: 'An Exclusive Invitation for Landowners, Mediators & Property Consultants',
  subtitle: 'Land Acquisition Opportunities with DAC Developers',
  dateLabel: 'Thursday, 29 October 2026',
  timeLabel: '6:00 PM onwards',
  venueName: 'Ramada Plaza by Wyndham',
  venueAddress: '36, Sardar Patel Rd, Little Mount, Guindy, Chennai – 600015',
  mapsUrl: 'https://maps.google.com/?q=Ramada+Plaza+by+Wyndham+Guindy+Chennai',
  phoneDisplay: '+91 89259 24488',
  phoneTel: '+918925924488',
  email: 'land@dacdevelopers.com',
  tagline: "Land In Your Hand! Let's Make it Grand!",
  orgTagline: 'DREAM · ASCEND · CONQUER',
  emailSubject: 'Your Entry Pass – DAC Land Acquisition Meet | 29 Oct 2026, 6 PM'
};

var TZ = 'Asia/Kolkata';
var SHEET_NAME = 'Registrations';
var PASS_PREFIX = 'DAC-LE-';
var HEADERS = [
  'Timestamp', 'Participant Type', 'Pass ID', 'Name', 'Mobile', 'Email', 'Firm',
  'No. of Persons', 'Interested In', 'Land Location', 'Land Size', 'Consent',
  'Email Status', 'WhatsApp Send Link', 'Checked-In', 'Check-in Time',
  'Pass Key' // private key in the pass URL so passes can't be guessed by ID
];
var COL = {}; // header -> 1-based column number
HEADERS.forEach(function (h, i) { COL[h] = i + 1; });

/* ============================ ROUTER ============================ */

function doPost(e) {
  var out;
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var secret = PropertiesService.getScriptProperties().getProperty('APPS_SCRIPT_SECRET');
    if (!secret || body.secret !== secret) {
      out = { ok: false, error: 'Unauthorized', code: 'AUTH' };
    } else {
      switch (body.action) {
        case 'register': out = register_(body); break;
        case 'getPass':  out = getPass_(body); break;
        case 'lookup':   out = lookup_(body); break;
        case 'checkin':  out = checkin_(body); break;
        case 'stats':    out = stats_(); break;
        default:         out = { ok: false, error: 'Unknown action', code: 'BAD_ACTION' };
      }
    }
  } catch (err) {
    console.error(err);
    out = { ok: false, error: String((err && err.message) || err), code: 'SERVER' };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/** Health check: open the Web App URL in a browser → {"ok":true,...} */
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, service: 'DAC RSVP', time: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Run ONCE from the editor: creates the sheet and triggers the permission prompt. */
function setup() {
  var sh = getSheet_();
  SpreadsheetApp.getActiveSpreadsheet().setSpreadsheetTimeZone(TZ);
  Logger.log('Sheet ready: ' + sh.getName() + ' | Emails left today: ' + MailApp.getRemainingDailyQuota());
  var p = PropertiesService.getScriptProperties();
  if (!p.getProperty('APPS_SCRIPT_SECRET')) Logger.log('WARNING: set Script Property APPS_SCRIPT_SECRET');
  if (!p.getProperty('SITE_URL')) Logger.log('WARNING: set Script Property SITE_URL');
}

/* ============================ ACTIONS ============================ */

function register_(b) {
  var mobile = normMobile_(b.mobile);
  var name = clean_(b.name, 80);
  var email = clean_(b.email, 120).toLowerCase();
  if (!/^[6-9]\d{9}$/.test(mobile)) return { ok: false, error: 'Invalid mobile number', code: 'VALIDATION' };
  if (name.length < 2) return { ok: false, error: 'Invalid name', code: 'VALIDATION' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: 'Invalid email', code: 'VALIDATION' };
  var persons = Math.min(3, Math.max(1, parseInt(b.persons, 10) || 1));

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
  } catch (e) {
    return { ok: false, error: 'Server busy, please retry', code: 'BUSY' };
  }

  var sh, rowNum, pass;
  try {
    sh = getSheet_();
    var rows = readAll_(sh);

    // Duplicate mobile → return existing pass, no new row
    for (var i = 0; i < rows.length; i++) {
      if (normMobile_(rows[i].v['Mobile']) === mobile) {
        var existingKey = String(rows[i].v['Pass Key'] || '');
        if (!existingKey) {
          existingKey = newKey_();
          sh.getRange(rows[i].row, COL['Pass Key']).setValue(existingKey);
        }
        return { ok: true, duplicate: true, passId: String(rows[i].v['Pass ID']), key: existingKey };
      }
    }

    var passId = PASS_PREFIX + ('000' + nextSeq_(rows)).slice(-4);
    var key = newKey_();
    pass = {
      passId: passId, key: key, name: name, mobile: mobile, email: email,
      participantType: clean_(b.participantType, 40),
      firm: clean_(b.firm, 100),
      persons: persons
    };
    var passUrl = passUrl_(passId, key);
    var waLink = 'https://wa.me/91' + mobile + '?text=' + encodeURIComponent(waMessage_(pass, passUrl));

    var values = [];
    values[COL['Timestamp'] - 1] = new Date();
    values[COL['Participant Type'] - 1] = safe_(pass.participantType);
    values[COL['Pass ID'] - 1] = passId;
    values[COL['Name'] - 1] = safe_(name);
    values[COL['Mobile'] - 1] = mobile;
    values[COL['Email'] - 1] = safe_(email);
    values[COL['Firm'] - 1] = safe_(pass.firm);
    values[COL['No. of Persons'] - 1] = persons;
    values[COL['Interested In'] - 1] = safe_(listStr_(b.interestedIn));
    values[COL['Land Location'] - 1] = safe_(listStr_(b.landLocation));
    values[COL['Land Size'] - 1] = safe_(clean_(b.landSize, 60));
    values[COL['Consent'] - 1] = b.consent === true ? 'Yes' : 'No';
    values[COL['Email Status'] - 1] = 'Pending';
    values[COL['WhatsApp Send Link'] - 1] = '';
    values[COL['Checked-In'] - 1] = 'No';
    values[COL['Check-in Time'] - 1] = '';
    values[COL['Pass Key'] - 1] = key;

    rowNum = sh.getLastRow() + 1;
    sh.getRange(rowNum, COL['Mobile']).setNumberFormat('@'); // keep as text
    sh.getRange(rowNum, 1, 1, HEADERS.length).setValues([values]);
    sh.getRange(rowNum, COL['Timestamp']).setNumberFormat('dd-mmm-yyyy hh:mm AM/PM');
    sh.getRange(rowNum, COL['WhatsApp Send Link']).setFormula('=HYPERLINK("' + waLink + '","Send Pass")');
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  // Email outside the lock — registration succeeds even if email fails.
  var status = sendPassEmail_(pass);
  try { sh.getRange(rowNum, COL['Email Status']).setValue(status); } catch (e) { console.error(e); }

  return { ok: true, duplicate: false, passId: pass.passId, key: pass.key, emailStatus: status };
}

function getPass_(b) {
  var id = normPassId_(b.passId);
  var key = String(b.key || '');
  var rows = readAll_(getSheet_());
  for (var i = 0; i < rows.length; i++) {
    var v = rows[i].v;
    if (String(v['Pass ID']).toUpperCase() === id) {
      if (!key || String(v['Pass Key']) !== key) break; // wrong key → treat as not found
      return { ok: true, pass: toPass_(v, true) };
    }
  }
  return { ok: false, error: 'Pass not found', code: 'NOT_FOUND' };
}

function lookup_(b) {
  var r = findRow_(readAll_(getSheet_()), b.query);
  return r ? { ok: true, found: true, pass: toPass_(r.v, false) } : { ok: true, found: false };
}

function checkin_(b) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) { return { ok: false, error: 'Server busy, please retry', code: 'BUSY' }; }
  try {
    var sh = getSheet_();
    var r = findRow_(readAll_(sh), b.passId);
    if (!r) return { ok: true, found: false };
    if (String(r.v['Checked-In']).toLowerCase() === 'yes') {
      return { ok: true, found: true, alreadyCheckedIn: true, checkinTime: fmtTime_(r.v['Check-in Time']), pass: toPass_(r.v, false) };
    }
    var now = new Date();
    sh.getRange(r.row, COL['Checked-In'], 1, 2).setValues([['Yes', now]]);
    sh.getRange(r.row, COL['Check-in Time']).setNumberFormat('dd-mmm-yyyy hh:mm AM/PM');
    SpreadsheetApp.flush();
    r.v['Checked-In'] = 'Yes';
    r.v['Check-in Time'] = now;
    return { ok: true, found: true, alreadyCheckedIn: false, checkinTime: fmtTime_(now), pass: toPass_(r.v, false) };
  } finally {
    lock.releaseLock();
  }
}

function stats_() {
  var rows = readAll_(getSheet_());
  var s = { registrations: 0, persons: 0, checkedIn: 0, checkedInPersons: 0 };
  rows.forEach(function (r) {
    if (!r.v['Pass ID']) return;
    var n = parseInt(r.v['No. of Persons'], 10) || 1;
    s.registrations++;
    s.persons += n;
    if (String(r.v['Checked-In']).toLowerCase() === 'yes') { s.checkedIn++; s.checkedInPersons += n; }
  });
  return { ok: true, stats: s };
}

/* ============================ SHEET HELPERS ============================ */

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  var lastCol = sh.getLastColumn();
  if (sh.getLastRow() === 0 || lastCol === 0) {
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
      .setFontWeight('bold').setBackground('#0E1B3D').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
    sh.getRange(1, COL['Mobile'], sh.getMaxRows(), 1).setNumberFormat('@');
  } else if (lastCol < HEADERS.length) {
    // Older sheet missing trailing columns (e.g. Pass Key) → add them
    sh.getRange(1, lastCol + 1, 1, HEADERS.length - lastCol).setValues([HEADERS.slice(lastCol)])
      .setFontWeight('bold').setBackground('#0E1B3D').setFontColor('#FFFFFF');
  }
  return sh;
}

function readAll_(sh) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  var data = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
  var out = [];
  for (var i = 0; i < data.length; i++) {
    var v = {};
    for (var c = 0; c < HEADERS.length; c++) v[HEADERS[c]] = data[i][c];
    out.push({ row: i + 2, v: v });
  }
  return out;
}

/** Accepts a mobile number, a full Pass ID, or just the number part (e.g. "12" → DAC-LE-0012). */
function findRow_(rows, query) {
  var q = String(query || '').trim();
  if (!q) return null;
  var digits = q.replace(/\D/g, '');
  var isMobile = digits.length >= 10 && !/^DAC/i.test(q);
  var target = isMobile ? normMobile_(q) : normPassId_(q);
  for (var i = 0; i < rows.length; i++) {
    var v = rows[i].v;
    if (isMobile ? normMobile_(v['Mobile']) === target : String(v['Pass ID']).toUpperCase() === target) return rows[i];
  }
  return null;
}

function nextSeq_(rows) {
  var props = PropertiesService.getScriptProperties();
  var max = parseInt(props.getProperty('PASS_SEQ'), 10) || 0;
  rows.forEach(function (r) {
    var m = String(r.v['Pass ID']).match(/(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  var next = max + 1;
  props.setProperty('PASS_SEQ', String(next)); // never reuses an ID, even if rows are deleted
  return next;
}

function toPass_(v, includeKey) {
  var p = {
    passId: String(v['Pass ID']),
    name: String(v['Name']).replace(/^'/, ''),
    participantType: String(v['Participant Type']).replace(/^'/, ''),
    firm: String(v['Firm'] || '').replace(/^'/, ''),
    persons: parseInt(v['No. of Persons'], 10) || 1,
    mobile: normMobile_(v['Mobile']),
    email: String(v['Email'] || '').replace(/^'/, ''),
    checkedIn: String(v['Checked-In']).toLowerCase() === 'yes',
    checkinTime: fmtTime_(v['Check-in Time'])
  };
  if (includeKey) p.key = String(v['Pass Key']);
  return p;
}

/* ============================ UTILITIES ============================ */

function normMobile_(v) {
  var d = String(v == null ? '' : v).replace(/\D/g, '');
  return d.length > 10 ? d.slice(-10) : d;
}

function normPassId_(v) {
  var q = String(v || '').trim().toUpperCase();
  if (/^\d{1,6}$/.test(q)) return PASS_PREFIX + ('000' + parseInt(q, 10)).slice(-4);
  var m = q.match(/^DAC-?LE-?(\d+)$/);
  if (m) return PASS_PREFIX + ('000' + parseInt(m[1], 10)).slice(-4);
  return q;
}

function clean_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function listStr_(arr) {
  return Array.isArray(arr) ? arr.map(function (x) { return clean_(x, 40); }).filter(String).join(', ') : '';
}

/** Prevent formula injection: text starting with = + - @ is stored as plain text. */
function safe_(s) {
  s = String(s == null ? '' : s);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function newKey_() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 10);
}

function fmtTime_(v) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'dd MMM yyyy, hh:mm a');
  return String(v);
}

function siteUrl_() {
  return String(PropertiesService.getScriptProperties().getProperty('SITE_URL') || '').replace(/\/+$/, '');
}

function passUrl_(passId, key) {
  return siteUrl_() + '/pass/' + encodeURIComponent(passId) + '?k=' + encodeURIComponent(key);
}

function waMessage_(p, passUrl) {
  return [
    'Hello ' + p.name + ',',
    '',
    'Your Entry Pass for the *' + EVENT.shortName + '* is confirmed.',
    '',
    '*Pass ID:* ' + p.passId,
    '*Admit:* ' + p.persons,
    '*Date:* ' + EVENT.dateLabel + ', ' + EVENT.timeLabel,
    '*Venue:* ' + EVENT.venueName + ', ' + EVENT.venueAddress,
    '*Directions:* ' + EVENT.mapsUrl,
    '',
    '*View your pass:* ' + passUrl,
    '',
    'Please show this pass at the entry.',
    '– DAC Developers | ' + EVENT.phoneDisplay
  ].join('\n');
}

function esc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ============================ EMAIL ============================ */

function sendPassEmail_(p) {
  try {
    if (MailApp.getRemainingDailyQuota() < 1) return 'Not sent: daily email quota exceeded';
    var passUrl = passUrl_(p.passId, p.key);
    MailApp.sendEmail({
      to: p.email,
      subject: EVENT.emailSubject,
      htmlBody: emailHtml_(p, passUrl),
      body: emailText_(p, passUrl),
      name: 'DAC Developers',
      replyTo: EVENT.email
    });
    return 'Sent';
  } catch (err) {
    console.error(err);
    return 'Error: ' + String((err && err.message) || err).slice(0, 200);
  }
}

function emailText_(p, passUrl) {
  return [
    'Dear ' + p.name + ',',
    '',
    'Thank you for registering. Your Entry Pass is confirmed.',
    '',
    'ENTRY PASS – ' + EVENT.shortName,
    'Pass ID: ' + p.passId,
    'Name: ' + p.name,
    'Participant: ' + p.participantType,
    p.firm ? 'Firm: ' + p.firm : null,
    'Admit: ' + p.persons + (p.persons > 1 ? ' persons' : ' person'),
    '',
    'Date: ' + EVENT.dateLabel,
    'Time: ' + EVENT.timeLabel,
    'Venue: ' + EVENT.venueName + ', ' + EVENT.venueAddress,
    'Directions: ' + EVENT.mapsUrl,
    '',
    'View your pass (with QR code): ' + passUrl,
    '',
    'Valid only for registered guests. Please show this pass at the entry.',
    '',
    'For assistance: ' + EVENT.phoneDisplay + ' | ' + EVENT.email,
    'DAC Developers – ' + EVENT.orgTagline
  ].filter(function (x) { return x !== null; }).join('\n');
}

function emailHtml_(p, passUrl) {
  var qr = 'https://quickchart.io/qr?size=300&margin=1&dark=0E1B3D&text=' + encodeURIComponent(p.passId);
  var row = function (label, value) {
    return '<tr><td style="padding:6px 0;font:13px Arial,sans-serif;color:#6B7280;width:38%;vertical-align:top;">' + label +
      '</td><td style="padding:6px 0;font:bold 15px Arial,sans-serif;color:#0E1B3D;">' + value + '</td></tr>';
  };
  var btn = function (href, text, bg) {
    return '<a href="' + esc_(href) + '" style="display:inline-block;background:' + bg + ';color:#FFFFFF;text-decoration:none;font:bold 15px Arial,sans-serif;padding:14px 22px;border-radius:10px;margin:6px 4px;">' + text + '</a>';
  };

  return '' +
  '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"></head>' +
  '<body style="margin:0;padding:0;background:#F3EFE9;">' +
  '<div style="display:none;max-height:0;overflow:hidden;">Your Entry Pass ' + esc_(p.passId) + ' – ' + EVENT.dateLabel + ', 6 PM at ' + EVENT.venueName + '</div>' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3EFE9;"><tr><td align="center" style="padding:24px 12px;">' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:18px;overflow:hidden;border:1px solid #D4A94F;">' +

  // Header
  '<tr><td style="background:#0E1B3D;padding:26px 24px 22px;text-align:center;">' +
    '<div style="font:bold 30px Georgia,serif;color:#FFFFFF;letter-spacing:6px;">DAC</div>' +
    '<div style="font:11px Arial,sans-serif;color:#D4A94F;letter-spacing:3px;margin-top:4px;">' + EVENT.orgTagline + '</div>' +
    '<div style="height:1px;background:#D4A94F;opacity:.5;margin:18px auto;width:60%;"></div>' +
    '<div style="font:bold 13px Arial,sans-serif;color:#E8641E;letter-spacing:4px;">ENTRY PASS</div>' +
    '<div style="font:20px Georgia,serif;color:#FFFFFF;margin-top:8px;line-height:1.35;">' + EVENT.subtitle + '</div>' +
  '</td></tr>' +
  '<tr><td style="height:5px;background:#E8641E;line-height:5px;font-size:0;">&nbsp;</td></tr>' +

  // Greeting
  '<tr><td style="padding:24px 24px 8px;font:15px Arial,sans-serif;color:#374151;line-height:1.6;">' +
    'Dear <b>' + esc_(p.name) + '</b>,<br>Thank you for registering. Your Entry Pass is confirmed. Please show the QR code below at the entry.' +
  '</td></tr>' +

  // QR
  '<tr><td align="center" style="padding:12px 24px;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" style="border:2px dashed #D4A94F;border-radius:14px;"><tr><td align="center" style="padding:14px;">' +
      '<img src="' + qr + '" width="200" height="200" alt="QR code ' + esc_(p.passId) + '" style="display:block;border:0;">' +
      '<div style="font:bold 20px \'Courier New\',monospace;color:#0E1B3D;letter-spacing:2px;margin-top:8px;">' + esc_(p.passId) + '</div>' +
    '</td></tr></table>' +
  '</td></tr>' +

  // Details
  '<tr><td style="padding:8px 28px 4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
    row('Name', esc_(p.name)) +
    row('Participant', esc_(p.participantType)) +
    (p.firm ? row('Firm', esc_(p.firm)) : '') +
    row('Admit', p.persons + (p.persons > 1 ? ' Persons' : ' Person')) +
  '</table></td></tr>' +
  '<tr><td style="padding:8px 28px;"><div style="height:1px;background:#EADBB8;"></div></td></tr>' +
  '<tr><td style="padding:4px 28px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
    row('Date', EVENT.dateLabel) +
    row('Time', EVENT.timeLabel) +
    row('Venue', EVENT.venueName + '<br><span style="font-weight:normal;font-size:13px;color:#4B5563;">' + EVENT.venueAddress + '</span>') +
  '</table></td></tr>' +

  // Buttons
  '<tr><td align="center" style="padding:14px 18px 6px;">' +
    btn(passUrl, 'View Pass', '#2B3A8F') + btn(EVENT.mapsUrl, 'Get Directions', '#E8641E') +
  '</td></tr>' +

  '<tr><td style="padding:14px 28px 4px;font:italic 15px Georgia,serif;color:#2B3A8F;text-align:center;">' + EVENT.tagline + '</td></tr>' +
  '<tr><td style="padding:8px 28px 20px;font:12px Arial,sans-serif;color:#6B7280;text-align:center;line-height:1.6;">' +
    'Valid only for registered guests. Please show this pass at the entry.' +
  '</td></tr>' +

  // Footer
  '<tr><td style="background:#0E1B3D;padding:18px 24px;text-align:center;font:13px Arial,sans-serif;color:#E5E7EB;line-height:1.8;">' +
    'For assistance: <a href="tel:' + EVENT.phoneTel + '" style="color:#FFFFFF;font-weight:bold;text-decoration:none;">' + EVENT.phoneDisplay + '</a><br>' +
    '<a href="mailto:' + EVENT.email + '" style="color:#D4A94F;text-decoration:none;">' + EVENT.email + '</a><br>' +
    '<span style="color:#9CA3AF;font-size:11px;">© DAC Developers Pvt Ltd</span>' +
  '</td></tr>' +

  '</table></td></tr></table></body></html>';
}
