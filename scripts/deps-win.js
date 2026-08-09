// Descarga el binario nativo de better-sqlite3 para Windows.
// Uso: pnpm run deps:win  (desde la raíz del proyecto)
//
// Existe porque `electron-builder install-app-deps --platform=win32` no siempre
// reemplaza el .node cuando se compila desde Linux: termina sin error y deja el
// binario de Linux que dejó el postinstall, así que el instalador sale roto sin
// ninguna señal. Esto va directo al grano y pide el precompilado exacto.
//
// Para volver a desarrollar en Linux: pnpm run deps:local
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.cwd(); // ejecutar desde la raíz del proyecto

// pnpm no coloca los paquetes en node_modules/<nombre> sino en el store .pnpm,
// con node_modules/<nombre> como enlace. Se acepta cualquiera de los dos.
function findPackageDir() {
  const direct = path.join(ROOT, 'node_modules/better-sqlite3');
  // realpath a propósito: con pnpm esto es un enlace al store, y resolver
  // prebuild-install desde el enlace no encuentra las dependencias hermanas.
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
  if (!declared) return null;
  return declared.replace(/^[\^~]/, '');
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

// Se invoca el bin por ruta en vez de con npx: pnpm guarda las dependencias en
// su store virtual y npx no las resuelve desde el directorio del paquete.
let prebuildBin;
try {
  prebuildBin = require.resolve('prebuild-install/bin.js', { paths: [pkgDir] });
} catch {
  console.error('✖ No se encontró prebuild-install (dependencia de better-sqlite3).');
  process.exit(1);
}

const args = [
  prebuildBin,
  '--runtime=electron',
  `--target=${target}`,
  '--platform=win32',
  '--arch=x64',
  '--force'
];

console.log(`Descargando better-sqlite3 para Windows x64 (Electron ${target})...`);

try {
  execFileSync(process.execPath, args, { cwd: pkgDir, stdio: 'inherit' });
} catch (e) {
  console.error('');
  console.error('✖ Falló la descarga del binario precompilado.');
  console.error('  Revisa que exista un prebuild para Electron ' + target + ' en:');
  console.error('  https://github.com/WiseLibs/better-sqlite3/releases');
  process.exit(1);
}

console.log('');
console.log('Listo. Verifica con: pnpm run verify:native');
