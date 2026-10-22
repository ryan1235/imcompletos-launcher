// Gera src/integrity.json (SHA-256 dos arquivos do launcher). Roda automaticamente antes do build.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..');
const files = fs.readdirSync(path.join(root, 'src')).filter((f) => /\.(js|html|css)$/.test(f)).map((f) => 'src/' + f).concat(['config.json']);
const out = {};
for (const f of files) out[f] = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, f))).digest('hex');
fs.writeFileSync(path.join(root, 'src', 'integrity.json'), JSON.stringify(out, null, 2));
console.log('integrity.json:', files.length, 'arquivos');
