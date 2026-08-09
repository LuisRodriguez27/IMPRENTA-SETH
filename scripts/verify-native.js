// Comprueba que el binario nativo sea de Windows, en los DOS puntos donde
// puede romperse. Uso: pnpm run verify:native  (desde la raíz del proyecto)
//
// better-sqlite3 es un módulo nativo: hay UN solo archivo .node por ubicación
// y gana el último proceso que lo escribe. Compilando desde Linux es fácil
// terminar con el binario de Linux dentro del instalador de Windows; el paquete
// se genera sin errores y revienta hasta que alguien lo instala, con un mensaje
// que no menciona la causa ("Error al acceder a la base de datos local").
//
// Se revisan dos ubicaciones para saber DÓNDE falló:
//   1. node_modules  -> lo que dejó `electron-builder install-app-deps`
//   2. dist/win-unpacked -> lo que realmente quedó empaquetado
//
// Un ejecutable de Windows empieza con la firma "MZ" (0x4d 0x5a); uno de Linux
// empieza con "\x7fELF".
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd(); // ejecutar desde la raíz del proyecto

// pnpm deja node_modules/better-sqlite3 como enlace al store en .pnpm;
// readFileSync sigue el enlace, pero si no existe se busca en el store.
function resolveInNodeModules() {
  const direct = path.join(
    ROOT, 'node_modules/better-sqlite3/build/Release/better_sqlite3.node'
  );
  if (fs.existsSync(direct)) return direct;

  const store = path.join(ROOT, 'node_modules/.pnpm');
  if (!fs.existsSync(store)) return null;
  const pkg = fs.readdirSync(store).find((d) => d.startsWith('better-sqlite3@'));
  if (!pkg) return null;

  const viaStore = path.join(
    store, pkg, 'node_modules/better-sqlite3/build/Release/better_sqlite3.node'
  );
  return fs.existsSync(viaStore) ? viaStore : null;
}

const TARGETS = [
  { label: 'node_modules      (lo que dejó deps:win)', file: resolveInNodeModules() },
  {
    label: 'dist/win-unpacked (lo que quedó empaquetado)',
    file: path.join(
      ROOT,
      'dist/win-unpacked/resources/app.asar.unpacked/node_modules',
      'better-sqlite3/build/Release/better_sqlite3.node'
    )
  }
];

function inspect(file) {
  if (!file || !fs.existsSync(file)) return { missing: true };
  const head = fs.readFileSync(file).subarray(0, 4);
  return {
    hex: [...head].map((b) => b.toString(16).padStart(2, '0')).join(' '),
    windows: head[0] === 0x4d && head[1] === 0x5a,
    linux: head[0] === 0x7f && head.toString('latin1', 1, 4) === 'ELF'
  };
}

let failed = false;
const results = [];

for (const t of TARGETS) {
  const r = inspect(t.file);
  results.push({ label: t.label, ...r });

  if (r.missing) {
    console.log(`•  ${t.label}\n   (no existe todavía)`);
    continue;
  }
  if (r.windows) {
    console.log(`✔  ${t.label}\n   ${r.hex} = MZ, binario de Windows`);
  } else {
    failed = true;
    const tipo = r.linux ? 'ELF, binario de LINUX' : 'formato desconocido';
    console.log(`✖  ${t.label}\n   ${r.hex} = ${tipo}`);
  }
}

if (!failed) {
  console.log('\nTodo correcto. El instalador sirve.');
  process.exit(0);
}

// Diagnóstico según DÓNDE falló, que es lo que dice qué comando corregir.
const [nm, dist] = results;
console.log('');
if (nm.missing || !nm.windows) {
  console.log('El fallo está en node_modules: ahí sigue el binario de Linux.');
  console.log('Descarga el precompilado de Windows con:');
  console.log('');
  console.log('  pnpm run deps:win');
} else if (nm.windows && !dist.windows) {
  console.log('node_modules está bien pero el paquete no: algo reconstruyó el');
  console.log('módulo durante el empaquetado. Verifica que el build incluya');
  console.log('-c.npmRebuild=false (lo trae `pnpm run dist:win:linux`).');
}
process.exit(1);
