// Small JSON file store. No database, no keys.
const fs = require('fs');
const path = require('path');

const DATA_FILE = process.env.KHATA_DATA || path.join(__dirname, 'data', 'ledger.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { entries: [] };
  }
}

function save(db) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

function addEntry({ customer, amount, type, item, transcript }) {
  const db = load();
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    at: new Date().toISOString(),
    customer, amount: Number(amount), type, item: item || '', transcript: transcript || '',
  };
  db.entries.push(entry);
  save(db);
  return entry;
}

function balances(entries) {
  const map = {};
  for (const e of entries) {
    const key = e.customer;
    map[key] = map[key] || { customer: key, owed: 0, entries: 0 };
    if (e.type === 'credit') map[key].owed += e.amount;
    if (e.type === 'payment') map[key].owed -= e.amount;
    map[key].entries += 1;
  }
  return Object.values(map).sort((a, b) => b.owed - a.owed);
}

function totals(entries, sinceMs) {
  const t = { sales: 0, credit: 0, payments: 0 };
  for (const e of entries) {
    if (sinceMs && Date.parse(e.at) < sinceMs) continue;
    if (e.type === 'sale') t.sales += e.amount;
    if (e.type === 'credit') t.credit += e.amount;
    if (e.type === 'payment') t.payments += e.amount;
  }
  return t;
}

function balanceFor(customer) {
  const name = String(customer || '').toLowerCase();
  const found = balances(load().entries).find((b) => b.customer.toLowerCase() === name);
  return found || null;
}

function removeEntry(id) {
  const db = load();
  db.entries = db.entries.filter((e) => e.id !== id);
  save(db);
}

module.exports = { load, addEntry, balances, totals, balanceFor, removeEntry };
