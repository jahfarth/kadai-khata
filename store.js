// Small JSON file store. No database, no keys.
const fs = require('fs');
const path = require('path');
const ledger = require('./ledger');

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

function addEntry(fields) {
  const db = load();
  const entry = ledger.makeEntry(fields);
  db.entries.push(entry);
  save(db);
  return entry;
}

function balanceFor(customer) {
  return ledger.balanceFor(load().entries, customer);
}

function removeEntry(id) {
  const db = load();
  db.entries = db.entries.filter((e) => e.id !== id);
  save(db);
}

module.exports = { load, addEntry, balances: ledger.balances, totals: ledger.totals, balanceFor, removeEntry };
