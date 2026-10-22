// Gera assets/icon.png (512) e assets/icon.ico (16..256) a partir de assets/icon.svg: npx electron tools/make-icon.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path');
app.whenReady().then(async () => {
  const w = new BrowserWindow({ width: 512, height: 512, show: false, useContentSize: true, frame: false, transparent: true });
  await w.loadFile(path.join(__dirname, '..', 'assets', 'icon.svg'));
  const img = await w.webContents.capturePage();
  const dir = path.join(__dirname, '..', 'assets');
  fs.writeFileSync(path.join(dir, 'icon.png'), img.resize({ width: 512, height: 512, quality: 'best' }).toPNG());
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngs = sizes.map((s) => img.resize({ width: s, height: s, quality: 'best' }).toPNG());
  const head = Buffer.alloc(6); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
  let offset = 6 + 16 * sizes.length;
  const entries = sizes.map((s, i) => {
    const e = Buffer.alloc(16);
    e[0] = s === 256 ? 0 : s; e[1] = s === 256 ? 0 : s; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(pngs[i].length, 8); e.writeUInt32LE(offset, 12); offset += pngs[i].length; return e;
  });
  fs.writeFileSync(path.join(dir, 'icon.ico'), Buffer.concat([head, ...entries, ...pngs]));
  app.quit();
});
