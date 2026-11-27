// Builds docs/ for GitHub Pages: the public/ files plus the shared parser and ledger code.
// docs/ is generated; do not edit it by hand. Run: node build-pages.js
const fs = require('fs');
const path = require('path');
const out = path.join(__dirname, 'docs');
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(path.join(__dirname, 'public'))) fs.copyFileSync(path.join(__dirname, 'public', f), path.join(out, f));
for (const f of ['parser.js', 'ledger.js']) fs.copyFileSync(path.join(__dirname, f), path.join(out, f));
console.log('docs/ built:', fs.readdirSync(out).join(', '));
