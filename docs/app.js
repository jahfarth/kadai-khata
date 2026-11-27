// Kadai Khata front end. Voice uses the browser's own speech recognition (Web Speech API).
// Nothing here needs a key. If the browser has no speech recognition, typing still works
// and the page says so plainly.
const $ = (id) => document.getElementById(id);
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
// Only English (India) is offered: it is the only language the parser has been tested with.
// Other languages are not listed so the page does not imply support it has not shown.
const LANGS = [['en-IN', 'English (India)']];

let draft = null;
let mode = 'entry'; // 'entry' while listening for a new entry, 'confirm' while waiting for yes/no/fix

function setStatus(text) { $('status').textContent = text; }

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = $('lang').value;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

function money(n) { return '₹' + Number(n).toLocaleString('en-IN'); }
const TYPE_LABEL = { credit: 'credit', payment: 'payment received', sale: 'cash sale' };

// Two backends behind the same calls. With the Node server, entries are stored in its JSON file.
// On a static host (GitHub Pages) there is no server, so the same parser and ledger code runs in
// the browser and entries are kept in this browser's localStorage only (per device, not shared).
const STORE_KEY = 'kadai-khata-ledger-v1';
let backend = 'server';

function localEntries() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { return []; }
}

async function localApi(path, options) {
  const body = options && options.body ? JSON.parse(options.body) : {};
  const entries = localEntries();
  if (path === '/api/summary') {
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    return { today: KhataLedger.totals(entries, startOfDay.getTime()), latest: entries.slice(-5).reverse(), ledger: KhataLedger.balances(entries) };
  }
  if (path === '/api/parse') {
    const who = KhataParser.parseBalanceQuery(body.transcript || '');
    if (who) {
      const b = KhataLedger.balanceFor(entries, who);
      return { kind: 'balance', customer: who, owed: b ? b.owed : 0, known: Boolean(b) };
    }
    return { kind: 'entry', ...KhataParser.parseEntry(body.transcript) };
  }
  if (path === '/api/entries') {
    if (!body.customer || !(Number(body.amount) > 0) || !['sale', 'credit', 'payment'].includes(body.type)) {
      return { error: 'customer, amount and type are required' };
    }
    const entry = KhataLedger.makeEntry(body);
    entries.push(entry);
    localStorage.setItem(STORE_KEY, JSON.stringify(entries));
    return entry;
  }
  return { error: 'not found' };
}

async function api(path, options) {
  if (backend === 'local') return localApi(path, options);
  const res = await fetch(path, options && { ...options, headers: { 'Content-Type': 'application/json' } });
  return res.json();
}

async function detectBackend() {
  try {
    const r = await fetch('/api/summary');
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) return;
  } catch { /* no server */ }
  backend = 'local';
  $('storage-note').textContent = 'Demo mode: entries are saved only in this browser on this device.';
}

async function refresh() {
  const s = await api('/api/summary');
  $('t-sales').textContent = money(s.today.sales);
  $('t-credit').textContent = money(s.today.credit);
  $('t-pay').textContent = money(s.today.payments);
  $('latest').innerHTML = s.latest.length
    ? s.latest.map((e) => `<li><span>${esc(e.customer)} · ${TYPE_LABEL[e.type]}${e.item ? ' · ' + esc(e.item) : ''}</span><b>${money(e.amount)}</b></li>`).join('')
    : '<li>No entries yet</li>';
  $('ledger').innerHTML = s.ledger.length
    ? s.ledger.map((b) => `<li><span>${esc(b.customer)}</span><span class="owed ${b.owed > 0 ? 'pos' : ''}">${money(b.owed)}</span></li>`).join('')
    : '<li>No customers yet</li>';
}

function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function showDraft(d) {
  draft = d;
  $('confirm').hidden = false;
  $('c-heard').textContent = d.transcript || '';
  $('c-customer').value = d.customer || '';
  $('c-type').value = d.type || 'credit';
  $('c-amount').value = d.amount || '';
  $('c-item').value = d.item || '';
}

function hideDraft() { draft = null; $('confirm').hidden = true; mode = 'entry'; }

function readBackText() {
  const c = $('c-customer').value, a = $('c-amount').value, t = $('c-type').value;
  return `${c}, ${TYPE_LABEL[t]}, ${a} rupees. Save?`;
}

async function handleTranscript(text) {
  if (mode === 'confirm') return handleConfirmation(text);
  setStatus(`Heard: "${text}"`);
  const r = await api('/api/parse', { method: 'POST', body: JSON.stringify({ transcript: text }) });
  if (r.kind === 'balance') {
    const msg = r.known ? `${r.customer} owes ${r.owed} rupees.` : `I do not have a customer called ${r.customer}.`;
    setStatus(msg); speak(msg); return;
  }
  if (!r.transcript) { setStatus('I could not hear that, please try again.'); speak('I could not hear that, please try again'); return; }
  showDraft(r);
  if (r.missing && r.missing.length) {
    const ask = r.missing[0] === 'amount' ? 'How much?' : r.missing[0] === 'customer' ? 'Which customer?' : 'Was it credit, a payment, or a sale?';
    setStatus(`${ask} Fill it in or say it again.`); speak(ask); mode = 'entry';
    return;
  }
  mode = 'confirm';
  const q = readBackText();
  setStatus(q + ' Say yes or no.'); speak(q);
}

async function handleConfirmation(text) {
  const result = await api('/api/parse', { method: 'POST', body: JSON.stringify({ transcript: text }) });
  const lower = text.toLowerCase();
  if (/\b(yes|yeah|save|confirm|okay|ok|haan|sari)\b/.test(lower)) return save();
  if (/\b(no|cancel|discard|nahi)\b/.test(lower)) { hideDraft(); setStatus('Discarded.'); return; }
  const fix = lower.match(/(?:amount|rupees)\s+(\d+)/);
  if (fix) { $('c-amount').value = fix[1]; const q = readBackText(); setStatus(q); speak(q); return; }
  setStatus('Say yes to save, no to discard, or "amount 250" to fix the amount.');
  void result;
}

async function save() {
  const body = {
    customer: $('c-customer').value.trim(), type: $('c-type').value, amount: Number($('c-amount').value),
    item: $('c-item').value.trim(), transcript: draft ? draft.transcript : '',
  };
  if (!body.customer || !(body.amount > 0)) { setStatus('Customer and amount are needed before saving.'); return; }
  const r = await api('/api/entries', { method: 'POST', body: JSON.stringify(body) });
  if (r.error) { setStatus(r.error); return; }
  hideDraft(); setStatus('Saved.'); speak('Saved'); refresh();
}

function setupLanguages() {
    $('lang').innerHTML = LANGS.map(([code, name]) => `<option value="${code}">${name}</option>`).join('');
  if (!SR) $('support').textContent = 'This browser has no speech recognition. Typing works. Try Chrome on Android or desktop for voice.';
  else $('support').textContent = 'Voice uses your browser recognizer. If a language does not work, it will say so here.';
}

function startListening() {
  if (!SR) { setStatus('Speech recognition is not available in this browser. Type the entry instead.'); return; }
  const rec = new SR();
  rec.lang = $('lang').value;
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  $('mic').classList.add('listening');
  $('mic').textContent = 'Listening...';
  rec.onresult = (ev) => { const t = ev.results[0][0].transcript; handleTranscript(t); };
  rec.onerror = (ev) => {
    const msg = ev.error === 'language-not-supported' ? 'This language is not supported by your browser recognizer.'
      : ev.error === 'no-speech' ? 'I could not hear that, please try again.'
      : ev.error === 'not-allowed' ? 'Microphone permission was denied.'
      : `Speech error: ${ev.error}. You can type instead.`;
    setStatus(msg);
  };
  rec.onend = () => { $('mic').classList.remove('listening'); $('mic').textContent = 'Tap and speak'; };
  rec.start();
}

$('mic').addEventListener('click', startListening);
$('typed').addEventListener('submit', (e) => { e.preventDefault(); const v = $('typed-text').value.trim(); if (v) { handleTranscript(v); $('typed-text').value = ''; } });
$('c-save').addEventListener('click', save);
$('c-cancel').addEventListener('click', () => { hideDraft(); setStatus('Discarded.'); });
setupLanguages();
detectBackend().then(refresh);
