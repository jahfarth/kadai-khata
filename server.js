// Kadai Khata server: static files plus a tiny JSON API. Node built-ins only, no keys needed.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { parseEntry, parseBalanceQuery } = require('./parser');
const store = require('./store');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 20000) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
  });
}

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/summary') {
    const { entries } = store.load();
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    return send(res, 200, {
      today: store.totals(entries, startOfDay.getTime()),
      latest: entries.slice(-5).reverse(),
      ledger: store.balances(entries),
    });
  }
  if (req.method === 'POST' && url.pathname === '/api/parse') {
    const { transcript } = await readBody(req);
    const balanceFor = parseBalanceQuery(transcript || '');
    if (balanceFor) {
      const b = store.balanceFor(balanceFor);
      return send(res, 200, { kind: 'balance', customer: balanceFor, owed: b ? b.owed : 0, known: Boolean(b) });
    }
    return send(res, 200, { kind: 'entry', ...parseEntry(transcript) });
  }
  if (req.method === 'POST' && url.pathname === '/api/entries') {
    const body = await readBody(req);
    if (!body.customer || !(Number(body.amount) > 0) || !['sale', 'credit', 'payment'].includes(body.type)) {
      return send(res, 400, { error: 'customer, amount and type are required' });
    }
    return send(res, 201, store.addEntry(body));
  }
  if (req.method === 'DELETE' && url.pathname.startsWith('/api/entries/')) {
    store.removeEntry(url.pathname.split('/').pop());
    return send(res, 200, { ok: true });
  }
  return send(res, 404, { error: 'not found' });
}

const SHARED = new Set(['/parser.js', '/ledger.js']); // same code the server uses, served to the browser

function handleStatic(req, res, url) {
  if (SHARED.has(url.pathname)) return fs.readFile(path.join(__dirname, url.pathname), (err, buf) => (err ? send(res, 404, 'not found', 'text/plain') : send(res, 200, buf, 'text/javascript')));
  let rel = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC)) return send(res, 403, 'forbidden', 'text/plain');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'not found', 'text/plain');
    send(res, 200, buf, TYPES[path.extname(file)] || 'application/octet-stream');
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    return handleStatic(req, res, url);
  } catch (e) {
    return send(res, 400, { error: String(e.message || e) });
  }
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`Kadai Khata running on http://localhost:${PORT}`));
}
module.exports = server;
