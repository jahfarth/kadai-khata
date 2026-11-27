// Ledger maths shared by the Node server and the browser-only demo.
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

function balanceFor(entries, customer) {
  const name = String(customer || '').toLowerCase();
  return balances(entries).find((b) => b.customer.toLowerCase() === name) || null;
}

function makeEntry({ customer, amount, type, item, transcript }) {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    at: new Date().toISOString(),
    customer, amount: Number(amount), type, item: item || '', transcript: transcript || '',
  };
}

const ledgerExports = { balances, totals, balanceFor, makeEntry };
if (typeof module !== 'undefined' && module.exports) module.exports = ledgerExports;
else globalThis.KhataLedger = ledgerExports;
