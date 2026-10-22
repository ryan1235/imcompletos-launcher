// Grava ícone e metadados no .exe (o electron-builder pula esta etapa quando o winCodeSign não extrai no Windows)
const path = require('path');
const rcedit = require('rcedit');

exports.default = async function (ctx) {
  if (ctx.electronPlatformName !== 'win32') return;
  const info = ctx.packager.appInfo;
  const exe = path.join(ctx.appOutDir, `${info.productFilename}.exe`);
  await rcedit(exe, {
    icon: path.join(ctx.packager.projectDir, 'assets', 'icon.ico'),
    'version-string': { ProductName: info.productName, FileDescription: info.productName, CompanyName: 'Incompletos', InternalName: info.productName, OriginalFilename: `${info.productFilename}.exe` },
    'file-version': info.version,
    'product-version': info.version
  });
};
