// Monta o modpack e gera os arquivos do GitHub Release.
// Uso: node tools/make-pack.js <pasta-com-mods-config-bin> [versao]
// Saída em release/: DeathAwaits-modpack.zip + manifest.json (suba os dois no Release)
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { execFileSync } = require('child_process');

const src = path.resolve(process.argv[2] || '..');
const version = process.argv[3] || new Date().toISOString().slice(0, 10).replace(/-/g, '.');
const config = require('../config.json');
const NAME = 'DeathAwaits';
const out = path.join(__dirname, '..', 'release');
const stage = path.join(out, 'pack');

const copy = (from, to) => { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.cpSync(from, to, { recursive: true }); };
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });

for (const d of ['mods', 'config', 'coremods', 'resourcepacks', 'craftingdead']) {
  if (fs.existsSync(path.join(src, d))) copy(path.join(src, d), path.join(stage, d));
}

// Forge 1.6.4: bin/modpack.jar é o Forge universal, bin/version.json o perfil de lançamento
const forgeJar = path.join(src, 'bin', 'modpack.jar');
const verJson = path.join(src, 'bin', 'version.json');
const vanilla = path.join(src, 'bin', '1.6.4.json');
if (fs.existsSync(forgeJar) && fs.existsSync(verJson)) {
  const j = JSON.parse(fs.readFileSync(verJson, 'utf8'));
  const v = fs.existsSync(vanilla) ? JSON.parse(fs.readFileSync(vanilla, 'utf8')) : {};
  const forge = j.libraries.find((l) => /minecraftforge:minecraftforge:/.test(l.name));
  const [g, a, ver] = forge.name.split(':');
  copy(forgeJar, path.join(stage, 'libraries', ...g.split('.'), a, ver, `${a}-${ver}.jar`));
  forge.url = undefined; // arquivo já vai no pacote
  for (const l of j.libraries) if (!l.url && !l.natives && l !== forge) l.url = 'https://libraries.minecraft.net/'; // MCLC só baixa libs com url
  const merged = { ...j, id: NAME, assets: v.assets || 'legacy', assetIndex: v.assetIndex, downloads: v.downloads, type: 'release' };
  fs.mkdirSync(path.join(stage, 'versions', NAME), { recursive: true });
  fs.writeFileSync(path.join(stage, 'versions', NAME, `${NAME}.json`), JSON.stringify(merged, null, 2));
}

// lista de arquivos verificáveis (integridade): mods, coremods, versions, libraries
const verified = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    const rel = path.relative(stage, p).split(path.sep).join('/');
    if (['mods', 'coremods', 'versions', 'libraries'].includes(rel.split('/')[0]))
      verified.push({ path: rel, sha1: crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex'), size: fs.statSync(p).size });
  }
})(stage);

const zip = path.join(out, `${NAME}-modpack.zip`);
const tar = process.platform === 'win32' ? path.join(process.env.SystemRoot, 'System32', 'tar.exe') : 'tar';
execFileSync(tar, ['-a', '-c', '-f', zip, ...fs.readdirSync(stage)], { cwd: stage }); // bsdtar gera .zip pela extensão
fs.rmSync(stage, { recursive: true, force: true });

const sha1 = crypto.createHash('sha1').update(fs.readFileSync(zip)).digest('hex');
const base = config.manifestUrl.replace(/manifest\.json$/, '');
const manifest = { version, mcVersion: config.mcVersion, customVersion: NAME, zipUrl: base + path.basename(zip), zipSha1: sha1, zipSize: fs.statSync(zip).size, files: verified, delete: [] };
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`OK  ${path.basename(zip)}  ${(manifest.zipSize / 1048576).toFixed(1)} MB  sha1=${sha1}\nSuba release/${path.basename(zip)} e release/manifest.json no GitHub Release.`);
