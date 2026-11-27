// Run with: node test.js
const assert = require('assert');
const { parseEntry, parseBalanceQuery, parseConfirmation } = require('./parser');

let e = parseEntry('Ravi took rice, 200 rupees on credit');
assert.strictEqual(e.customer, 'Ravi'); assert.strictEqual(e.amount, 200); assert.strictEqual(e.type, 'credit'); assert.strictEqual(e.item, 'rice');
e = parseEntry('Ravi paid 100');
assert.strictEqual(e.type, 'payment'); assert.strictEqual(e.amount, 100); assert.strictEqual(e.customer, 'Ravi');
e = parseEntry('Sold sugar to Anil for fifty rupees');
assert.strictEqual(e.type, 'sale'); assert.strictEqual(e.amount, 50); assert.strictEqual(e.customer, 'Anil');
e = parseEntry('Ravi took rice on credit');
assert.strictEqual(e.ok, false); assert.deepStrictEqual(e.missing, ['amount']);
assert.strictEqual(parseEntry('').ok, false);
assert.strictEqual(parseBalanceQuery("Ravi's balance"), 'Ravi');
assert.strictEqual(parseBalanceQuery('Ravi ka hisab'), 'Ravi');
assert.strictEqual(parseConfirmation('yes save it'), 'yes');
assert.strictEqual(parseConfirmation('no cancel'), 'no');
assert.deepStrictEqual(parseConfirmation('amount 250'), { amount: 250 });
console.log('parser tests passed');

// Shared ledger maths
const ledger = require('./ledger');
const sample = [
  ledger.makeEntry({ customer: 'Ravi', amount: 200, type: 'credit', item: 'rice' }),
  ledger.makeEntry({ customer: 'Ravi', amount: 50, type: 'payment' }),
  ledger.makeEntry({ customer: 'Anil', amount: 30, type: 'sale' }),
];
assert.strictEqual(ledger.balanceFor(sample, 'ravi').owed, 150);
assert.deepStrictEqual(ledger.totals(sample), { sales: 30, credit: 200, payments: 50 });
assert.strictEqual(ledger.balanceFor(sample, 'Nobody'), null);
console.log('ledger tests passed');
