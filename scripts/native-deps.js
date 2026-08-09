// Descarga el binario nativo de better-sqlite3 para una plataforma concreta.
//
//   pnpm run deps:win     -> binario de Windows (para compilar el instalador)
//   pnpm run deps:local   -> binario de esta máquina (para volver a pnpm dev)
//
// Existe porque `electron-builder install-app-deps` no siempre reemplaza el
// .node: termina sin error y deja el que ya estaba, en cualquiera de las dos
// direcciones. Si quedó el de Linux, el instalador de Windows sale roto sin
// ninguna señal; si quedó el de Windows, `pnpm dev` no arranca en Linux.
// Esto pide el precompilado exacto y no depende de que algo lo detecte.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.cwd(); // ejecutar desde la raíz del proyecto

function arg(name, fallback) {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
}

const platform = arg('platform', process.platform);
const arch = arg('arch', process.arch);

// pnpm no coloca los paquetes en node_modules/<nombre> sino en su store, con
// node_modules/<nombre> como enlace. Se acepta cualquiera de los dos.
function findPackageDir() {
  const direct = path.join(ROOT, 'node_modules/better-sqlite3');
  // realpath a propósito: resolver prebuild-install desde el enlace no
  // encuentra las dependencias hermanas dentro del store de pnpm.
  if (fs.existsSync(path.join(direct, 'package.json'))) return fs.realpathSync(direct);

  const store = path.join(ROOT, 'node_modules/.pnpm');
  if (!fs.existsSync(store)) return null;
  const entry = fs.readdirSync(store).find((d) => d.startsWith('better-sqlite3@'));
  if (!entry) return null;

  const viaStore = path.join(store, entry, 'node_modules/better-sqlite3');
  return fs.existsSync(path.join(viaStore, 'package.json')) ? viaStore : null;
}

// La versión de Electron define el ABI del binario; tienen que coincidir.
function electronVersion() {
  const installed = path.join(ROOT, 'node_modules/electron/package.json');
  if (fs.existsSync(installed)) {
    return JSON.parse(fs.readFileSync(installed, 'utf8')).version;
  }
  const root = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const declared = (root.devDependencies || {}).electron || (root.dependencies || {}).electron;
  return declared ? declared.replace(/^[\^~]/, '') : null;
}

const pkgDir = findPackageDir();
if (!pkgDir) {
  console.error('✖ No se encontró el paquete better-sqlite3. ¿Corriste pnpm install?');
  process.exit(1);
}

const target = electronVersion();
if (!target) {
  console.error('✖ No se pudo determinar la versión de Electron.');
  process.exit(1);
}

let prebuildBin;
try {
  prebuildBin = require.resolve('prebuild-install/bin.js', { paths: [pkgDir] });
} catch {
  console.error('✖ No se encontró prebuild-install (dependencia de better-sqlite3).');
  process.exit(1);
}

console.log(`Descargando better-sqlite3 para ${platform}-${arch} (Electron ${target})...`);

try {
  execFileSync(
    process.execPath,
    [
      prebuildBin,
      '--runtime=electron',
      `--target=${target}`,
      `--platform=${platform}`,
      `--arch=${arch}`,
      '--force'
    ],
    { cwd: pkgDir, stdio: 'inherit' }
  );
} catch (e) {
  console.error('');
  console.error(`✖ Falló la descarga del binario para ${platform}-${arch}.`);
  console.error(`  Revisa que exista un prebuild para Electron ${target} en:`);
  console.error('  https://github.com/WiseLibs/better-sqlite3/releases');
  process.exit(1);
}

console.log('');
if (platform === 'win32') {
  console.log('Listo. Verifica con: pnpm run verify:native');
} else {
  console.log('Listo. Ya puedes correr: pnpm dev');
}
