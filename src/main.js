const { app, BrowserWindow, ipcMain, shell, dialog, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const extract = require('extract-zip');
const { Client, Authenticator } = require('minecraft-launcher-core');

process.on('uncaughtException', (err) => console.error('[UncaughtException]', err));
process.on('unhandledRejection', (err) => console.error('[UnhandledRejection]', err));

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
if (process.env.DA_MANIFEST_URL) config.manifestUrl = process.env.DA_MANIFEST_URL;

let win, tray;
let launching = false;
let playing = false;

app.name = 'incompletos-launcher';
app.setAppUserModelId('com.incompletos.launcher');
const userData = app.getPath('userData');
const gameDir = path.join(userData, 'game');
const settingsFile = path.join(userData, 'settings.json');
const manifestCache = path.join(userData, 'manifest.json');
const curseManifestCache = path.join(userData, 'curse-manifest.json');
const logFile = path.join(userData, 'logs', 'latest.log');
const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
const icoPath = path.join(__dirname, '..', 'assets', 'icon.ico');
const appIcon = () => nativeImage.createFromPath(fs.existsSync(icoPath) ? icoPath : iconPath);

const loadSettings = () => { try { return JSON.parse(fs.readFileSync(settingsFile, 'utf8')); } catch { return {}; } };
const saveSettings = (s) => { fs.mkdirSync(userData, { recursive: true }); fs.writeFileSync(settingsFile, JSON.stringify(s, null, 2)); };
const send = (ch, data) => win && !win.isDestroyed() && win.webContents.send(ch, data);
const status = (text, pct) => send('status', { text, pct });

// ---------- janela / bandeja ----------
function createWindow() {
  console.log('[Main] Creating window...');
  win = new BrowserWindow({
    width: 990, height: 640, minWidth: 900, minHeight: 600,
    frame: false, backgroundColor: '#0d0d0f', icon: appIcon(),
    show: true,
    center: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.setMenu(null);
  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.on('did-finish-load', () => console.log('[Main] Window loaded index.html'));
  win.webContents.on('did-fail-load', (e, code, desc) => console.error('[Main] Fail load:', code, desc));
  win.show();
  win.focus();
}
function showWindow() {
  if (!win || win.isDestroyed()) return;
  win.show(); if (win.isMinimized()) win.restore(); win.focus();
}
function createTray() {
  tray = new Tray(appIcon().resize({ width: 16, height: 16 }));
  tray.setToolTip('Incompletos Launcher');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir launcher', click: showWindow },
    { label: 'Sair', click: () => app.exit(0) }
  ]));
  tray.on('click', showWindow);
}

const gotLock = app.requestSingleInstanceLock();
console.log('[Main] gotLock:', gotLock);
if (!gotLock) {
  console.log('[Main] Quitting because single instance lock not obtained');
  app.quit();
}
app.on('second-instance', () => {
  console.log('[Main] Second instance detected, showing window');
  showWindow();
});
app.whenReady().then(() => {
  console.log('[Main] App ready');
  createWindow();
  createTray();
  checkLauncherUpdate();
});
app.on('window-all-closed', () => {
  console.log('[Main] Window all closed');
  app.quit();
});

// ---------- atualização do launcher ----------
function checkLauncherUpdate() {
  if (!app.isPackaged) return;
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.on('update-available', () => status('Atualizando o launcher...', 0));
    autoUpdater.on('update-downloaded', () => autoUpdater.quitAndInstall(true, true));
    autoUpdater.on('error', () => {});
    autoUpdater.checkForUpdates().catch(() => {});
  } catch {}
}

ipcMain.on('win', (_, a) => {
  if (!win) return;
  if (a === 'min') win.minimize();
  if (a === 'max') win.isMaximized() ? win.unmaximize() : win.maximize();
  if (a === 'close') win.close();
});
ipcMain.on('open-link', (_, url) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); });

// ---------- rede ----------
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) IncompletosLauncher/1.0';

function get(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0)
        return resolve(get(new URL(res.headers.location, url).toString(), redirects - 1));
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode + ' para ' + url)); }
      resolve(res);
    }).on('error', reject);
  });
}
async function getJson(url) {
  const res = await get(url);
  let body = '';
  for await (const c of res) body += c;
  return JSON.parse(body);
}
function postJson(url, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(u, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': USER_AGENT
      }
    }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode + ' para ' + url)); }
      let resp = '';
      res.on('data', (c) => resp += c);
      res.on('end', () => {
        try { resolve(JSON.parse(resp)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
async function download(url, dest, onProgress) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const res = await get(url);
  const total = +res.headers['content-length'] || 0;
  let done = 0;
  const tmp = dest + '.part';
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(tmp);
    res.on('data', (c) => { done += c.length; if (onProgress && total) onProgress(done / total, done, total); });
    res.pipe(out);
    out.on('finish', resolve);
    out.on('error', reject);
    res.on('error', reject);
  });
  fs.renameSync(tmp, dest);
}
const hashFile = (file, algo = 'sha1') => new Promise((resolve) => {
  const h = crypto.createHash(algo);
  fs.createReadStream(file).on('data', (d) => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', () => resolve(null));
});
const MB = (b) => (b / 1048576).toFixed(1);

// ---------- Java ----------
function javaMajorFor(mc) {
  const parts = String(mc || '').split('.').map(Number);
  const minor = parts[1] || 0;
  const patch = parts[2] || 0;
  if (minor >= 21 || (minor === 20 && patch >= 5)) return 21;
  if (minor >= 17) return 17;
  return 8;
}
function findJava(dir, depth = 6) {
  if (!fs.existsSync(dir) || depth < 0) return null;
  let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { const r = findJava(p, depth - 1); if (r) return r; }
    else if (e.name.toLowerCase() === 'javaw.exe') return p;
  }
  return null;
}
function javaVersionOf(javaw) {
  try {
    const exe = path.join(path.dirname(javaw), 'java.exe');
    const r = spawnSync(fs.existsSync(exe) ? exe : javaw, ['-version'], { encoding: 'utf8', timeout: 6000, windowsHide: true });
    const out = (r.stderr || '') + (r.stdout || '');
    const m = /version "(\d+)(?:\.(\d+))?/.exec(out);
    if (!m) return null;
    return { major: m[1] === '1' ? +m[2] : +m[1], is64: /64-Bit/i.test(out), vendor: /Temurin|Adoptium/i.test(out) ? 'Temurin' : /Zulu/i.test(out) ? 'Zulu' : /Corretto/i.test(out) ? 'Corretto' : /OpenJDK/i.test(out) ? 'OpenJDK' : 'Java' };
  } catch { return null; }
}
function scanJava() {
  const roots = new Set();
  const pf = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.ProgramW6432].filter(Boolean);
  for (const base of pf) for (const v of ['Java', 'Eclipse Adoptium', 'Microsoft', 'Zulu', 'Amazon Corretto', 'BellSoft', 'Semeru', 'AdoptOpenJDK', 'OpenJDK', 'Temurin'])
    roots.add(path.join(base, v));
  roots.add(path.join(os.homedir(), '.jdks'));
  const found = new Map();
  const add = (javaw, source) => { const k = path.resolve(javaw).toLowerCase(); if (!found.has(k) && fs.existsSync(javaw)) found.set(k, { path: javaw, source }); };
  for (const r of roots) {
    if (!fs.existsSync(r)) continue;
    let sub; try { sub = fs.readdirSync(r, { withFileTypes: true }); } catch { continue; }
    for (const d of sub) if (d.isDirectory()) { const j = findJava(path.join(r, d.name), 3); if (j) add(j, 'Instalado no PC'); }
  }
  if (process.env.JAVA_HOME) add(path.join(process.env.JAVA_HOME, 'bin', 'javaw.exe'), 'JAVA_HOME');
  try {
    const w = spawnSync('where', ['javaw'], { encoding: 'utf8', windowsHide: true });
    (w.stdout || '').split(/\r?\n/).filter(Boolean).forEach((p) => add(p.trim(), 'PATH'));
  } catch {}
  for (const base of [path.join(process.resourcesPath || '', 'runtime'), path.join(__dirname, '..', 'runtime'), path.join(userData, 'runtime')]) {
    if (!fs.existsSync(base)) continue;
    for (const d of fs.readdirSync(base, { withFileTypes: true })) if (d.isDirectory()) { const j = findJava(path.join(base, d.name)); if (j) add(j, 'Embutido no launcher'); }
  }
  const list = [];
  for (const j of found.values()) { const v = javaVersionOf(j.path); if (v) list.push({ ...j, ...v }); }
  return list.sort((a, b) => a.major - b.major);
}
const javaCache = { list: null };
function javaList(refresh) { if (refresh || !javaCache.list) javaCache.list = scanJava(); return javaCache.list; }

async function ensureJava(mc) {
  const custom = loadSettings().javaPath;
  if (custom && fs.existsSync(custom)) return custom;
  const major = javaMajorFor(mc);
  const bundled = findJava(path.join(process.resourcesPath || '', 'runtime', 'java' + major)) || findJava(path.join(__dirname, '..', 'runtime', 'java' + major));
  if (bundled) return bundled;
  const dir = path.join(userData, 'runtime', 'java' + major);
  const have = findJava(dir);
  if (have) return have;

  // Se já tiver uma versão compatível instalada no PC, aproveita
  const onSystem = javaList().find((j) => j.major === major && j.is64);
  if (onSystem) return onSystem.path;

  status(`Baixando Java ${major} (só na primeira vez)...`, 0);
  const zip = path.join(userData, 'java.zip');
  await download(config.javaDownloadUrl.replace('{v}', major), zip, (p, d, t) => status(`Baixando Java ${major} — ${MB(d)} / ${MB(t)} MB`, p * 100));
  status('Instalando Java...', 100);
  fs.mkdirSync(dir, { recursive: true });
  await extract(zip, { dir });
  fs.rmSync(zip, { force: true });
  javaCache.list = null;
  const j = findJava(dir);
  if (!j) throw new Error('Falha ao instalar o Java');
  return j;
}

// ---------- Minecraft embutido ----------
function seedMinecraft() {
  fs.mkdirSync(gameDir, { recursive: true });
  const seed = path.join(process.resourcesPath || '', 'minecraft');
  const marker = path.join(gameDir, '.seeded');
  if (fs.existsSync(seed) && !fs.existsSync(marker)) {
    status('Preparando Minecraft...', 0);
    fs.cpSync(seed, gameDir, { recursive: true });
    fs.writeFileSync(marker, '1');
  }
}

// ---------- Forge Installer ----------
async function ensureForge(mcVer, forgeVer, javawPath) {
  const versionId = `${mcVer}-forge-${forgeVer}`;
  const versionJson = path.join(gameDir, 'versions', versionId, `${versionId}.json`);
  const slimJar = path.join(gameDir, 'libraries', 'net', 'minecraft', 'client', `${mcVer}-20230612.114412`, `client-${mcVer}-20230612.114412-slim.jar`);
  if (fs.existsSync(versionJson) && fs.existsSync(slimJar)) return versionId;

  status(`Baixando instalador do Forge ${forgeVer}...`, 0);
  const installerJar = path.join(userData, `forge-${mcVer}-${forgeVer}-installer.jar`);
  const url = `https://maven.minecraftforge.net/net/minecraftforge/forge/${mcVer}-${forgeVer}/forge-${mcVer}-${forgeVer}-installer.jar`;
  await download(url, installerJar, (p, d, t) => status(`Baixando Forge ${forgeVer} — ${MB(d)} / ${MB(t)} MB`, p * 100));

  status(`Instalando Forge ${forgeVer} (primeira vez, aguarde)...`, 50);
  const profilesPath = path.join(gameDir, 'launcher_profiles.json');
  if (!fs.existsSync(profilesPath)) {
    fs.mkdirSync(gameDir, { recursive: true });
    fs.writeFileSync(profilesPath, JSON.stringify({ profiles: {} }));
  }

  const javaExe = path.join(path.dirname(javawPath), 'java.exe');
  const bin = fs.existsSync(javaExe) ? javaExe : javawPath;
  const r = spawnSync(bin, ['-jar', installerJar, '--installClient', gameDir], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 300000
  });

  try { fs.rmSync(installerJar, { force: true }); } catch {}

  if (!fs.existsSync(versionJson)) {
    const out = (r.stderr || '') + (r.stdout || '');
    throw new Error('Falha ao instalar o Forge: ' + out.slice(-300));
  }

  status(`Forge ${forgeVer} instalado com sucesso!`, 100);
  return versionId;
}

// ---------- CurseForge Modpack Sync ----------
let manifest = null;
let curseManifest = null;

function getForgeCdnUrl(fileId, fileName) {
  const s = String(fileId);
  return `https://edge.forgecdn.net/files/${s.slice(0, 4)}/${s.slice(4)}/${encodeURIComponent(fileName)}`;
}

async function syncCurseModpack(shareCode) {
  status('Buscando dados do Modpack no CurseForge...', 0);
  const zipDest = path.join(userData, 'curse-profile.zip');
  const tempDir = path.join(userData, 'curse-temp');

  try {
    await download(`https://api.curseforge.com/v1/shared-profile/${shareCode}`, zipDest);
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir, { recursive: true });
    await extract(zipDest, { dir: tempDir });
  } catch (err) {
    if (fs.existsSync(curseManifestCache)) {
      status('Não foi possível conectar ao CurseForge; usando cache local.', 0);
      curseManifest = JSON.parse(fs.readFileSync(curseManifestCache, 'utf8'));
      manifest = curseManifest;
      return;
    }
    throw new Error('Falha ao obter modpack do CurseForge: ' + err.message);
  } finally {
    try { fs.rmSync(zipDest, { force: true }); } catch {}
  }

  const mfPath = path.join(tempDir, 'manifest.json');
  if (!fs.existsSync(mfPath)) throw new Error('O pacote do CurseForge não contém manifest.json');
  curseManifest = JSON.parse(fs.readFileSync(mfPath, 'utf8'));
  manifest = curseManifest;
  fs.writeFileSync(curseManifestCache, JSON.stringify(curseManifest, null, 2));

  // 1. Copiar overrides (configs, shaders, etc.)
  const overrides = path.join(tempDir, curseManifest.overrides || 'overrides');
  if (fs.existsSync(overrides)) {
    status('Aplicando configurações do modpack...', 10);
    fs.cpSync(overrides, gameDir, { recursive: true });
  }
  fs.rmSync(tempDir, { recursive: true, force: true });

  const files = curseManifest.files || [];
  if (!files.length) return;

  // 2. Consultar informações completas dos arquivos via curse.tools
  status('Verificando lista de mods e arquivos...', 20);
  const fileIds = files.map((f) => f.fileID);
  const modIds = [...new Set(files.map((f) => f.projectID))];

  const filesRes = await postJson('https://api.curse.tools/v1/mods/files', { fileIds });
  const modsRes = await postJson('https://api.curse.tools/v1/mods', { modIds });

  const categoryMap = new Map();
  for (const m of (modsRes.data || [])) {
    if (m.classId === 6552) categoryMap.set(m.id, 'shaderpacks');
    else if (m.classId === 12) categoryMap.set(m.id, 'resourcepacks');
    else categoryMap.set(m.id, 'mods');
  }

  // 3. Baixar arquivos que faltam ou estão corrompidos
  const toDownload = filesRes.data || [];
  let i = 0;
  for (const f of toDownload) {
    i++;
    const subFolder = categoryMap.get(f.modId) || (f.fileName.endsWith('.jar') ? 'mods' : 'resourcepacks');
    const dest = path.join(gameDir, subFolder, f.fileName);

    const sha1 = (f.hashes || []).find((h) => h.algo === 1)?.value;
    let upToDate = false;
    if (fs.existsSync(dest)) {
      if (sha1) {
        const hash = await hashFile(dest, 'sha1');
        if (hash && hash.toLowerCase() === sha1.toLowerCase()) upToDate = true;
      } else if (fs.statSync(dest).size === f.fileLength) {
        upToDate = true;
      }
    }

    if (upToDate) continue;

    const pct = (i / toDownload.length) * 100;
    status(`Baixando (${i}/${toDownload.length}): ${f.fileName}`, pct);
    const dlUrl = f.downloadUrl || getForgeCdnUrl(f.id, f.fileName);
    await download(dlUrl, dest);
  }

  saveSettings({ ...loadSettings(), packVersion: curseManifest.name || 'curse-pack' });
}

// ---------- Modpack tradicional (GitHub) ----------
const VERIFIED_DIRS = ['mods', 'coremods', 'versions', 'libraries'];

async function loadManifest() {
  if (config.curseShareCode) return true;
  try {
    manifest = await getJson(config.manifestUrl);
    fs.mkdirSync(userData, { recursive: true });
    fs.writeFileSync(manifestCache, JSON.stringify(manifest));
    return true;
  } catch {
    try { manifest = JSON.parse(fs.readFileSync(manifestCache, 'utf8')); } catch { manifest = null; }
    return false;
  }
}

async function verifyPack(report) {
  if (config.curseShareCode && curseManifest) {
    const files = curseManifest.files || [];
    const bad = [];
    return { total: files.length, bad };
  }
  const files = ((manifest && manifest.files) || []).filter((f) => f.sha1 && VERIFIED_DIRS.includes(f.path.split('/')[0]));
  const bad = [];
  let i = 0;
  for (const f of files) {
    i++;
    if (report) status(`Verificando arquivos (${i}/${files.length})`, (i / files.length) * 100);
    const p = path.join(gameDir, f.path);
    if (!fs.existsSync(p) || (await hashFile(p)) !== f.sha1) bad.push(f.path);
  }
  return { total: files.length, bad };
}

async function syncModpack() {
  if (config.curseShareCode) {
    await syncCurseModpack(config.curseShareCode);
    return;
  }
  const online = await loadManifest();
  if (!manifest) return;
  if (!online) { status('Sem conexão com o servidor de atualização; usando arquivos locais.', 0); return; }
  const files = (manifest.files || []).filter((f) => f.url);
  let i = 0;
  for (const f of files) {
    i++;
    const dest = path.join(gameDir, f.path);
    if (!path.resolve(dest).startsWith(path.resolve(gameDir))) continue;
    if (fs.existsSync(dest) && (!f.sha1 || (await hashFile(dest)) === f.sha1)) continue;
    status(`Atualizando modpack (${i}/${files.length}): ${f.path}`, (i / files.length) * 100);
    await download(f.url, dest);
  }
}

// ---------- integridade do launcher ----------
async function checkLauncherIntegrity() {
  const f = path.join(__dirname, 'integrity.json');
  if (!app.isPackaged || !fs.existsSync(f)) return { ok: true, skipped: true, bad: [] };
  const list = JSON.parse(fs.readFileSync(f, 'utf8'));
  const bad = [];
  for (const [rel, hash] of Object.entries(list)) {
    const p = path.join(__dirname, '..', rel);
    if (!fs.existsSync(p) || crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') !== hash) bad.push(rel);
  }
  return { ok: bad.length === 0, bad, total: Object.keys(list).length };
}

// ---------- diagnóstico ----------
const GB = (b) => (b / 1073741824).toFixed(1) + ' GB';
function ramInfo() {
  const totalMb = Math.floor(os.totalmem() / 1048576);
  const recMb = totalMb >= 8192 ? Math.min(8192, Math.max(4096, Math.floor(totalMb * 0.5 / 256) * 256)) : Math.max(3072, Math.floor(totalMb * 0.6 / 256) * 256);
  return { totalMb, freeMb: Math.floor(os.freemem() / 1048576), minMb: 2048, goodMb: 4096, recMb, maxMb: Math.max(2048, Math.floor(totalMb * 0.8 / 256) * 256) };
}
const ramMbFor = () => loadSettings().ramMb || ramInfo().recMb;
function mcVersion() {
  return (manifest && manifest.minecraft && manifest.minecraft.version) || (manifest && manifest.mcVersion) || config.mcVersion;
}
function diagnose() {
  const rows = [];
  const r = ramInfo();
  const x64 = process.arch === 'x64' && os.platform() === 'win32';
  rows.push({ id: 'os', label: 'Sistema', ok: x64, fatal: !x64, value: `${os.type()} ${os.release()} (${process.arch})`, hint: x64 ? 'Compatível' : 'Precisa de Windows 64 bits' });
  rows.push({ id: 'ram', label: 'Memória RAM', ok: r.totalMb >= 4096, warn: r.totalMb < 6144, fatal: r.totalMb < 2048, value: `${GB(r.totalMb * 1048576)} total • ${GB(r.freeMb * 1048576)} livre`, hint: r.totalMb >= 8192 ? 'Ótimo para jogar com mods' : r.totalMb >= 4096 ? 'Suficiente, mas feche outros programas' : 'Pouca memória — o jogo pode travar' });
  try {
    fs.mkdirSync(gameDir, { recursive: true });
    const sf = fs.statfsSync(gameDir); const free = sf.bavail * sf.bsize;
    rows.push({ id: 'disk', label: 'Espaço em disco', ok: free > 3 * 1073741824, warn: free < 5 * 1073741824, fatal: free < 1.5 * 1073741824, value: `${GB(free)} livres`, hint: free > 3 * 1073741824 ? 'Espaço de sobra' : 'Libere espaço (precisa de ~2 GB)' });
  } catch { rows.push({ id: 'disk', label: 'Espaço em disco', ok: true, value: 'não verificado' }); }
  const major = javaMajorFor(mcVersion());
  const cust = loadSettings().javaPath;
  const have = javaList().filter((j) => j.major === major);
  rows.push({ id: 'java', label: 'Java', ok: true, warn: !cust && !have.length, value: cust ? 'Personalizado' : have.length ? `Java ${major} pronto` : `Java ${major} será baixado`, hint: `Recomendado para Minecraft ${mcVersion()}: Java ${major}` });
  return rows;
}

// ---------- Microsoft Login ----------
let msAuth = null, msAuthAt = 0;
const authLog = (m) => {
  try { fs.mkdirSync(path.dirname(logFile), { recursive: true }); fs.appendFileSync(path.join(path.dirname(logFile), 'auth.log'), `[${new Date().toISOString()}] ${m}${os.EOL}`); } catch {}
};
const MS_ERR = {
  'error.auth.xsts.userNotFound': 'Essa conta Microsoft não tem um perfil Xbox. Entre em xbox.com com ela, crie o perfil e tente de novo.',
  'error.auth.xsts.bannedCountry': 'O Xbox Live não está disponível no país desta conta Microsoft.',
  'error.auth.xsts.child': 'Esta é uma conta de menor de idade. Um adulto precisa adicioná-la a um grupo Família da Microsoft.',
  'error.auth.xsts': 'Não foi possível obter a autorização do Xbox Live. Tente novamente.',
  'error.auth.xboxLive': 'Falha ao entrar no Xbox Live. Tente novamente em instantes.',
  'error.auth.minecraft.profile': 'Esta conta Microsoft não possui o Minecraft Java Edition. Use a conta pirata ou entre com a conta proprietária do jogo.',
  'error.auth.minecraft.entitlements': 'Não foi possível verificar se a conta possui o Minecraft.',
  'error.auth.minecraft.login': 'A Mojang recusou o login. Tente novamente em alguns minutos.',
  'error.auth.microsoft': 'Falha ao entrar na conta Microsoft. Tente novamente.'
};
function msError(e) {
  if (e && e.friendly) return e;
  const code = typeof e === 'string' ? e : (e && (e.ts || e.name)) || '';
  const status = e && e.response && e.response.status;
  authLog(`erro: ${code || '(sem código)'}${status ? ' HTTP ' + status : ''} ${e && e.message ? e.message : ''}`);
  const out = new Error('');
  out.friendly = true;
  if (code === 'error.gui.closed') { out.message = 'Login cancelado.'; out.cancelled = true; return out; }
  const key = Object.keys(MS_ERR).sort((x, y) => y.length - x.length).find((k) => code.startsWith(k));
  let msg = key ? MS_ERR[key] : null;
  if (!msg && /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ECONNRESET|EAI_AGAIN|fetch failed|network/i.test(String((e && (e.code || e.message)) || e))) msg = 'Sem conexão com a internet ou com os servidores da Microsoft.';
  out.message = msg || `Não foi possível entrar na conta Microsoft${code ? ' (' + code + (status ? ', HTTP ' + status : '') + ')' : ''}.`;
  return out;
}
async function mcFrom(xbox) {
  const mc = await xbox.getMinecraft();
  if (!mc.profile || mc.profile.demo || !mc.profile.name) throw 'error.auth.minecraft.profile';
  return mc;
}
async function microsoftLogin() {
  try {
    const { Auth } = require('msmc');
    authLog('login iniciado');
    const auth = new Auth('select_account');
    auth.on('load', (code) => authLog('etapa: ' + code));
    const xbox = await auth.launch('electron', {
      width: 500, height: 650, resizable: false, title: 'Entrar com a Microsoft', icon: appIcon(),
      parent: win && !win.isDestroyed() && win.isVisible() ? win : undefined, modal: !!(win && win.isVisible()), autoHideMenuBar: true,
      webPreferences: { partition: 'ms-login-' + Date.now() }
    });
    const mc = await mcFrom(xbox);
    saveSettings({ ...loadSettings(), ms: { refresh: xbox.save(), name: mc.profile.name } });
    msAuth = mc.mclc(); msAuthAt = Date.now();
    authLog('login ok: ' + mc.profile.name);
    return mc.profile.name;
  } catch (e) { throw msError(e); }
}
async function microsoftRestore() {
  const s = loadSettings();
  if (!s.ms || !s.ms.refresh) throw msError('error.auth.microsoft');
  try {
    const { Auth } = require('msmc');
    const xbox = await new Auth('select_account').refresh(s.ms.refresh);
    const mc = await mcFrom(xbox);
    saveSettings({ ...loadSettings(), ms: { refresh: xbox.save(), name: mc.profile.name } });
    msAuth = mc.mclc(); msAuthAt = Date.now();
    authLog('sessão renovada: ' + mc.profile.name);
    return msAuth;
  } catch (e) { throw msError(e); }
}
async function microsoftSession() {
  if (msAuth && Date.now() - msAuthAt < 20 * 60 * 1000) return msAuth;
  try { return await microsoftRestore(); }
  catch (e) {
    if (e.cancelled) throw e;
    authLog('renovação falhou, pedindo login: ' + e.message);
    status('Sua sessão Microsoft expirou. Entre novamente...', 0);
    await microsoftLogin();
    return msAuth;
  }
}

// ---------- IPC ----------
ipcMain.handle('init', () => ({ config, settings: loadSettings(), version: app.getVersion() }));
ipcMain.handle('ms-login', async () => { try { return { ok: true, name: await microsoftLogin() }; } catch (e) { return { ok: false, error: e.message, cancelled: !!e.cancelled }; } });
ipcMain.handle('ms-logout', () => { const s = loadSettings(); delete s.ms; saveSettings(s); msAuth = null; msAuthAt = 0; return true; });
ipcMain.handle('save-settings', (_, patch) => { const s = { ...loadSettings(), ...patch }; for (const k of Object.keys(s)) if (s[k] === null) delete s[k]; saveSettings(s); return true; });
ipcMain.handle('reset-settings', () => { const s = loadSettings(); saveSettings({ nick: s.nick, ms: s.ms, packVersion: s.packVersion, setupDone: true }); return true; });
ipcMain.handle('diag', () => diagnose());
ipcMain.handle('sys', () => ({ ...ramInfo(), gameDir, logFile, javaMajor: javaMajorFor(mcVersion()), mc: mcVersion() }));
ipcMain.handle('java-list', (_, refresh) => javaList(!!refresh));
ipcMain.handle('open-folder', (_, what) => shell.openPath(what === 'logs' ? path.dirname(logFile) : gameDir));
ipcMain.handle('pick-java', async () => {
  const r = await dialog.showOpenDialog(win, { filters: [{ name: 'Java', extensions: ['exe'] }], properties: ['openFile'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('repair', () => { fs.rmSync(path.join(gameDir, '.seeded'), { force: true }); saveSettings({ ...loadSettings(), packVersion: null }); return true; });
ipcMain.handle('verify-launcher', () => checkLauncherIntegrity());
ipcMain.handle('verify-pack', async () => {
  try {
    await loadManifest();
    if (!manifest) return { ok: false, error: 'Modpack ainda não instalado' };
    const r = await verifyPack(true);
    return { ok: r.bad.length === 0, total: r.total, bad: r.bad };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
});
ipcMain.handle('ping', () => new Promise((resolve) => {
  const host = config.server.host;
  const port = config.server.port;
  if (!host) return resolve({ online: false });
  const sock = net.connect({ host, port });
  sock.setTimeout(3000);
  const fin = (r) => { sock.destroy(); resolve(r); };
  sock.on('connect', () => {
    // Protocol ping Minecraft modern
    sock.write(Buffer.from([0xfe, 0x01]));
  });
  sock.on('data', (d) => fin({ online: true }));
  sock.on('timeout', () => fin({ online: false }));
  sock.on('error', () => fin({ online: false }));
}));

ipcMain.handle('releases', async () => {
  return { list: [] };
});

// primeiro download: Java + modpack + Forge
ipcMain.handle('prepare', async () => {
  if (launching) return { ok: false, error: 'Aguarde...' };
  launching = true;
  try {
    const bad = diagnose().find((r) => r.fatal);
    if (bad) throw new Error(`${bad.label}: ${bad.value}`);
    seedMinecraft();
    status('Verificando modpack...', 0);
    await syncModpack();
    const mcVer = mcVersion();
    const javaPath = await ensureJava(mcVer);

    const forgeVer = config.forgeVersion || ((manifest && manifest.minecraft && manifest.minecraft.modLoaders) ? manifest.minecraft.modLoaders[0].id.replace(/^forge-/, '') : null);
    if (forgeVer) {
      await ensureForge(mcVer, forgeVer, javaPath);
    }

    status('Tudo pronto!', 100);
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
  finally { launching = false; }
});

// ---------- jogar ----------
ipcMain.handle('play', async (_, { mode, nick }) => {
  if (launching || playing) return { ok: false, error: 'Já está iniciando' };
  launching = true;
  try {
    let authorization;
    if (mode === 'microsoft') {
      status('Autenticando na Microsoft...', 0);
      authorization = await microsoftSession();
    } else {
      if (!/^\w{3,16}$/.test(nick || '')) throw new Error('Nickname inválido (3-16 letras, números ou _)');
      authorization = await Authenticator.getAuth(nick);
      saveSettings({ ...loadSettings(), nick });
    }
    const bad = diagnose().find((r) => r.fatal);
    if (bad) throw new Error(`${bad.label}: ${bad.value} — requisito mínimo não atendido`);
    seedMinecraft();
    await syncModpack();

    const mcVer = mcVersion();
    const javaPath = await ensureJava(mcVer);

    let customVersion = null;
    const forgeVer = config.forgeVersion || ((manifest && manifest.minecraft && manifest.minecraft.modLoaders) ? manifest.minecraft.modLoaders[0].id.replace(/^forge-/, '') : null);
    if (forgeVer) {
      customVersion = await ensureForge(mcVer, forgeVer, javaPath);
    } else if (manifest && manifest.customVersion) {
      customVersion = manifest.customVersion;
    }

    const st = loadSettings();
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    const log = fs.createWriteStream(logFile);

    const version = { number: mcVer, type: 'release' };
    if (customVersion) version.custom = customVersion;

    const launcher = new Client();
    launcher.on('progress', (e) => status(`Baixando Minecraft (${e.type}) — ${e.task}/${e.total}`, (e.task / e.total) * 100));
    launcher.on('package-extract', () => status('Extraindo arquivos...', 100));
    launcher.on('debug', (m) => log.write(`[launcher] ${m}\n`));
    launcher.on('data', (m) => log.write(`${m}\n`));
    launcher.on('close', (code) => {
      playing = false; launching = false; log.end();
      send('closed', code);
      showWindow();
    });

    const forgeJvmArgs = [];
    if (customVersion) {
      const vJsonPath = path.join(gameDir, 'versions', customVersion, `${customVersion}.json`);
      if (fs.existsSync(vJsonPath)) {
        try {
          const vJson = JSON.parse(fs.readFileSync(vJsonPath, 'utf8'));
          const libDir = path.join(gameDir, 'libraries');
          const cpSep = ';';
          const jvmRaw = (vJson.arguments && vJson.arguments.jvm) || [];
          for (const arg of jvmRaw) {
            if (typeof arg === 'string') {
              forgeJvmArgs.push(arg
                .replace(/\$\{library_directory\}/g, libDir)
                .replace(/\$\{classpath_separator\}/g, cpSep)
                .replace(/\$\{version_name\}/g, customVersion)
              );
            }
          }
        } catch (e) {
          console.error('Erro ao ler JVM args do Forge:', e);
        }
      }
    }

    const opts = {
      authorization, root: gameDir, javaPath, version,
      memory: { min: config.ram.min, max: ramMbFor() + 'M' },
      customArgs: forgeJvmArgs
    };
    if (st.fullscreen) opts.window = { fullscreen: true };
    else if (st.width && st.height) opts.window = { width: String(st.width), height: String(st.height) };
    if (st.jvmArgs && st.jvmArgs.trim()) opts.customArgs = opts.customArgs.concat(st.jvmArgs.trim().split(/\s+/));

    status('Iniciando o jogo...', 100);
    const proc = await launcher.launch(opts);
    if (!proc) throw new Error('Não foi possível iniciar o Minecraft');
    playing = true;
    send('started');
    const after = st.afterLaunch || 'hide';
    setTimeout(() => {
      if (!playing || !win || win.isDestroyed()) return;
      if (after === 'hide') win.hide();
      else if (after === 'minimize') win.minimize();
    }, 2500);
    return { ok: true };
  } catch (e) {
    launching = false;
    return { ok: false, error: String(e.message || e) };
  }
});
