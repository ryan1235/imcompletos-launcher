// Gera manifest.json do modpack.
// Uso: node tools/make-manifest.js <pasta-do-modpack> <url-base> [mcVersion] [customVersion]
// Ex.: node tools/make-manifest.js ../ https://meusite.com/modpack 1.6.4
// Inclui mods/, config/, versions/ e bin/ (ignora saves, logs, options.txt etc.).
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const [root, base, mcVersion = '1.6.4', customVersion] = process.argv.slice(2);
if (!root || !base) { console.log('Uso: node tools/make-manifest.js <pasta> <url-base> [mcVersion] [customVersion]'); process.exit(1); }
const INCLUDE = ['mods', 'config', 'versions', 'coremods', 'resourcepacks'];
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else {
      const rel = path.relative(root, p).split(path.sep).join('/');
      if (!INCLUDE.includes(rel.split('/')[0])) continue;
      const sha1 = crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex');
      files.push({ path: rel, url: `${base}/${rel.split('/').map(encodeURIComponent).join('/')}`, sha1, size: fs.statSync(p).size });
    }
  }
})(path.resolve(root));
const out = { version: Date.now(), mcVersion, ...(customVersion && { customVersion }), files, delete: [] };
fs.writeFileSync('manifest.json', JSON.stringify(out, null, 2));
console.log(`manifest.json gerado com ${files.length} arquivos. Suba os arquivos em ${base}/ mantendo as pastas.`);
