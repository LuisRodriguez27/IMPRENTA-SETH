// Comprueba que el binario nativo empaquetado sea de Windows.
// Uso: pnpm run verify:native  (desde la raíz, después de compilar)
//
// better-sqlite3 es un módulo nativo: hay UN solo archivo .node y gana el
// último proceso que lo escribe. Compilando desde Linux es fácil terminar con
// el binario de Linux dentro del instalador de Windows; el paquete se genera
// sin errores y revienta hasta que alguien lo instala, con un mensaje que no
// menciona la causa ("Error al acceder a la base de datos local").
//
// Un ejecutable de Windows empieza con la firma "MZ" (0x4d 0x5a); uno de Linux
// empieza con "\x7fELF".
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd(); // ejecutar desde la raíz del proyecto

const TARGET = path.join(
  ROOT,
  'dist/win-unpacked/resources/app.asar.unpacked/node_modules',
  'better-sqlite3/build/Release/better_sqlite3.node'
);

if (!fs.existsSync(TARGET)) {
  console.error('✖ No se encontró el binario empaquetado:');
  console.error('  ' + TARGET);
  console.error('  Compila primero (pnpm run dist:win:linux o dist:win).');
  process.exit(1);
}

const head = fs.readFileSync(TARGET).subarray(0, 4);
const hex = [...head].map((b) => b.toString(16).padStart(2, '0')).join(' ');

const isWindows = head[0] === 0x4d && head[1] === 0x5a;        // MZ
const isLinux = head[0] === 0x7f && head.toString('latin1', 1, 4) === 'ELF';

if (isWindows) {
  console.log(`✔ Binario de Windows correcto (${hex} = MZ). El instalador sirve.`);
  process.exit(0);
}

console.error(`✖ El binario NO es de Windows (${hex}).`);
if (isLinux) {
  console.error('  Es un binario de Linux (ELF). El instalador fallará al abrirse.');
  console.error('  Reconstruye con: pnpm run dist:win:linux');
}
process.exit(1);
