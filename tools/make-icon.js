// Gera assets/icon.png (512x512) e assets/icon.ico (16..256) a partir de assets/icon-source.png
const { app, nativeImage } = require('electron');
const fs = require('fs'), path = require('path');

app.whenReady().then(async () => {
  const dir = path.join(__dirname, '..', 'assets');
  const sourcePath = path.join(dir, 'icon-source.png');
  const img = nativeImage.createFromPath(sourcePath);
  console.log('Source image dimensions:', img.getSize());

  // 1. Gera icon.png em 512x512 com interpolação de alta qualidade
  const img512 = img.resize({ width: 512, height: 512, quality: 'best' });
  fs.writeFileSync(path.join(dir, 'icon.png'), img512.toPNG());
  console.log('Generated icon.png (512x512)');

  // 2. Gera icon.ico contendo [16, 24, 32, 48, 64, 128, 256]
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngs = sizes.map((s) => img.resize({ width: s, height: s, quality: 'best' }).toPNG());

  const head = Buffer.alloc(6);
  head.writeUInt16LE(1, 2); // type 1 = icon
  head.writeUInt16LE(sizes.length, 4); // count of images

  let offset = 6 + 16 * sizes.length;
  const entries = sizes.map((s, i) => {
    const e = Buffer.alloc(16);
    e[0] = s === 256 ? 0 : s; // 0 represents 256
    e[1] = s === 256 ? 0 : s;
    e.writeUInt16LE(1, 4);   // planes
    e.writeUInt16LE(32, 6);  // bpp = 32
    e.writeUInt32LE(pngs[i].length, 8); // image size
    e.writeUInt32LE(offset, 12);        // image offset
    offset += pngs[i].length;
    return e;
  });

  const icoBuf = Buffer.concat([head, ...entries, ...pngs]);
  fs.writeFileSync(path.join(dir, 'icon.ico'), icoBuf);
  console.log('Generated icon.ico with sizes [16, 24, 32, 48, 64, 128, 256], total size:', icoBuf.length, 'bytes');

  app.quit();
});
