// Baixa o JRE 17 (Temurin) para runtime/java17, que é embutido no instalador. Roda antes do build se a pasta não existir.
const fs = require('fs'), path = require('path'), https = require('https'), os = require('os');
const extract = require('extract-zip');
const dir = path.join(__dirname, '..', 'runtime', 'java17');
const has = (d) => fs.existsSync(d) && fs.readdirSync(d, { recursive: true }).some((f) => /javaw\.exe$/i.test(String(f)));
if (has(dir)) { console.log('runtime/java17 já existe'); process.exit(0); }
const get = (url, cb) => https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (r) => (r.statusCode >= 300 && r.headers.location ? get(new URL(r.headers.location, url).href, cb) : cb(r)));
const zip = path.join(os.tmpdir(), 'jre17.zip');
console.log('Baixando JRE 17...');
get('https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jre/hotspot/normal/eclipse', (r) => {
  r.pipe(fs.createWriteStream(zip)).on('finish', async () => { fs.mkdirSync(dir, { recursive: true }); await extract(zip, { dir }); fs.rmSync(zip); console.log('OK'); });
});
