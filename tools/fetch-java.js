// Baixa o JRE (Temurin) correspondente para runtime/java{major}, que é embutido no instalador.
const fs = require('fs'), path = require('path'), https = require('https'), os = require('os');
const extract = require('extract-zip');

const cfgPath = path.join(__dirname, '..', 'config.json');
let major = 21;
if (fs.existsSync(cfgPath)) {
  try {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    const parts = String(cfg.mcVersion || '').split('.').map(Number);
    const minor = parts[1] || 0;
    const patch = parts[2] || 0;
    if (minor >= 21 || (minor === 20 && patch >= 5)) major = 21;
    else if (minor >= 17) major = 17;
    else major = 8;
  } catch {}
}

const dir = path.join(__dirname, '..', 'runtime', `java${major}`);
const has = (d) => fs.existsSync(d) && fs.readdirSync(d, { recursive: true }).some((f) => /javaw\.exe$/i.test(String(f)));
if (has(dir)) { console.log(`runtime/java${major} já existe`); process.exit(0); }
const get = (url, cb) => https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (r) => (r.statusCode >= 300 && r.headers.location ? get(new URL(r.headers.location, url).href, cb) : cb(r)));
const zip = path.join(os.tmpdir(), `jre${major}.zip`);
console.log(`Baixando JRE ${major}...`);
get(`https://api.adoptium.net/v3/binary/latest/${major}/ga/windows/x64/jre/hotspot/normal/eclipse`, (r) => {
  r.pipe(fs.createWriteStream(zip)).on('finish', async () => { fs.mkdirSync(dir, { recursive: true }); await extract(zip, { dir }); fs.rmSync(zip); console.log('OK'); });
});
