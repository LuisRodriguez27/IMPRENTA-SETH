/**
 * Las imágenes de productos no se copian a ninguna carpeta del programa: en la
 * base de datos se guarda la ruta original del archivo en la PC del cliente
 * (por ejemplo `C:\Users\seth\Downloads\logo.png`).
 *
 * Para mostrarlas se usa el protocolo `imagenes://local/<ruta codificada>`, que
 * el proceso principal resuelve y sirve desde el disco.
 */
export function getImageSrc(storedPath: string): string {
  return `imagenes://local/${encodeURIComponent(storedPath)}`;
}

/** Nombre de archivo, para mostrarlo en la interfaz sin la ruta completa. */
export function getImageFileName(storedPath: string): string {
  const parts = storedPath.split(/[\\/]/);
  return parts[parts.length - 1] || storedPath;
}
