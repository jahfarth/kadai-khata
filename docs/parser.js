// Turns a spoken sentence into a ledger entry draft.
// Works on plain text from any speech recogniser, so it is testable without a microphone.

const WORD_NUMBERS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  // common Hindi number words, romanised
  ek: 1, do: 2, teen: 3, char: 4, paanch: 5, panch: 5, das: 10, bees: 20, pachas: 50, sau: 100,
};

const CREDIT_WORDS = ['credit', 'udhaar', 'udhar', 'on account', 'owes', 'owe', 'borrowed', 'baaki', 'khata'];
const PAYMENT_WORDS = ['paid', 'pay', 'payment', 'gave back', 'returned', 'settled', 'received', 'diya', 'cleared'];
const SALE_WORDS = ['sold', 'sale', 'bought', 'cash', 'took'];
const STOP_WORDS = new Set(['rupees', 'rupee', 'rs', 'rs.', 'inr', 'on', 'for', 'of', 'the', 'a', 'an', 'to', 'in', 'and', 'took',
  'credit', 'udhaar', 'udhar', 'paid', 'pay', 'gave', 'bought', 'sold', 'cash', 'received', 'owes', 'back', 'was', 'is', 'ka', 'ki', 'ke', 'ne']);

function wordsToNumber(tokens) {
  let total = 0;
  let current = 0;
  let found = false;
  for (const t of tokens) {
    const v = WORD_NUMBERS[t];
    if (v === undefined) continue;
    found = true;
    if (v === 100) current = (current || 1) * 100;
    else current += v;
  }
  total += current;
  return found ? total : null;
}

function extractAmount(text) {
  const digits = text.match(/(?:rs\.?|₹)?\s*(\d+(?:[.,]\d+)?)\s*(?:rupees?|rs\.?|₹|inr)?/i);
  if (digits) {
    const n = Number(digits[1].replace(',', ''));
    if (Number.isFinite(n) && n > 0) return n;
  }
  const tokens = text.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  const n = wordsToNumber(tokens);
  return n && n > 0 ? n : null;
}

function detectType(lower) {
  const has = (list) => list.some((w) => lower.includes(w));
  if (has(PAYMENT_WORDS) && !has(['on credit', 'udhaar', 'udhar'])) return 'payment';
  if (has(CREDIT_WORDS)) return 'credit';
  if (has(SALE_WORDS)) return 'sale';
  return null;
}

function extractCustomer(text) {
  const cleaned = text.replace(/[.,!?]/g, ' ');
  const words = cleaned.split(/\s+/).filter(Boolean);
  // Customer name: first capitalised word that is not the first word of a plain sentence start of a command
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (/^[A-Z][a-z]+$/.test(w) && !STOP_WORDS.has(w.toLowerCase())) return w;
  }
  // Fallback for lower-case recogniser output: word before "took", "paid", "owes", "ka"
  const lower = words.map((w) => w.toLowerCase());
  for (let i = 1; i < lower.length; i++) {
    if (['took', 'paid', 'owes', 'ne', 'gave'].includes(lower[i]) && !STOP_WORDS.has(lower[i - 1]) && !/^\d/.test(lower[i - 1])) {
      return lower[i - 1][0].toUpperCase() + lower[i - 1].slice(1);
    }
  }
  return null;
}

function extractItem(text, customer) {
  const lower = text.toLowerCase().replace(/[.,!?]/g, ' ');
  const tokens = lower.split(/\s+/).filter(Boolean);
  const customerLower = customer ? customer.toLowerCase() : '';
  const items = tokens.filter((t) => !STOP_WORDS.has(t) && t !== customerLower && !/^\d/.test(t) && !(t in WORD_NUMBERS));
  const item = items.join(' ').trim();
  return item || null;
}

// Balance question, e.g. "Ravi's balance" or "Ravi ka hisab"
function parseBalanceQuery(text) {
  const m = text.match(/([A-Za-z]+?)(?:'s|s'|\s+ka)?\s+(?:balance|hisab|hisaab|baaki)/i);
  if (m) return m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
  return null;
}

function parseEntry(text) {
  const clean = String(text || '').trim();
  if (!clean) return { ok: false, reason: 'empty' };
  const lower = clean.toLowerCase();
  const customer = extractCustomer(clean);
  const amount = extractAmount(clean);
  const type = detectType(lower);
  const item = extractItem(clean, customer);
  const missing = [];
  if (!customer) missing.push('customer');
  if (!amount) missing.push('amount');
  if (!type) missing.push('type');
  return { ok: missing.length === 0, transcript: clean, customer, amount, type, item, missing };
}

function parseConfirmation(text) {
  const lower = String(text || '').toLowerCase();
  if (/\b(yes|yeah|yep|save|confirm|ok|okay|haan|ha|sari|shari)\b/.test(lower)) return 'yes';
  if (/\b(no|nope|cancel|discard|delete|nahi|venda)\b/.test(lower)) return 'no';
  const fix = lower.match(/(?:amount|rupees)\s+(\d+)/);
  if (fix) return { amount: Number(fix[1]) };
  return null;
}

const parserExports = { parseEntry, parseBalanceQuery, parseConfirmation, extractAmount, detectType };
// Same file runs in Node (server, tests) and in the browser (static demo).
if (typeof module !== 'undefined' && module.exports) module.exports = parserExports;
else globalThis.KhataParser = parserExports;
