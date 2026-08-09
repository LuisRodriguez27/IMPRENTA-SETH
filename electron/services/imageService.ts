import '../env';
import * as fs from 'fs-extra';
import * as path from 'path';
import type { BrowserWindow } from 'electron';

interface SelectResult { success: boolean; paths: string[]; canceled: boolean; }

/** Extensiones permitidas: el protocolo `imagenes://` sólo sirve archivos de imagen. */
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.avif', '.tif', '.tiff', '.ico'];

const URL_PREFIX = 'imagenes://local/';

/**
 * Las imágenes NO se copian ni se suben a ningún lado: el cliente elige el archivo
 * desde donde ya lo tiene en su PC (Descargas, Documentos, un USB, etc.) y en la
 * base de datos se guarda esa misma ruta absoluta. Así no se generan duplicados
 * y el archivo original siempre es el único que existe.
 */
class ImageService {
  /**
   * Carpeta usada únicamente para resolver rutas relativas antiguas (imágenes que
   * se habían copiado al NAS o a la carpeta local en versiones anteriores).
   */
  getLegacyBasePath(): string {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('electron');

    const configured = process.env.IMAGES_PATH ? process.env.IMAGES_PATH.trim() : null;
    if (configured) return path.normalize(configured);

    try {
      return app.isPackaged
        ? path.normalize(path.join(app.getPath('userData'), 'images'))
        : path.normalize(path.join(process.cwd(), 'images'));
    } catch (_e) {
      return path.normalize(path.join(process.cwd(), 'images'));
    }
  }

  isAllowedImage(filePath: string): boolean {
    return ALLOWED_EXTENSIONS.includes(path.extname(filePath).toLowerCase());
  }

  /**
   * Abre el explorador de archivos del sistema para que el cliente escoja una o
   * varias imágenes. Devuelve las rutas absolutas tal cual están en su PC.
   */
  async selectImages(parentWindow?: BrowserWindow | null): Promise<SelectResult> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { dialog } = require('electron');

    const options = {
      title: 'Seleccionar imágenes',
      buttonLabel: 'Usar imagen',
      properties: ['openFile', 'multiSelections', 'dontAddToRecent'] as const,
      filters: [
        { name: 'Imágenes', extensions: ALLOWED_EXTENSIONS.map((e) => e.replace('.', '')) }
      ]
    };

    const result = parentWindow
      ? await dialog.showOpenDialog(parentWindow, options)
      : await dialog.showOpenDialog(options);

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { success: false, paths: [], canceled: true };
    }

    const paths: string[] = [];
    for (const filePath of result.filePaths) {
      const normalized = path.normalize(filePath);
      if (!this.isAllowedImage(normalized)) {
        throw new Error(`El archivo "${path.basename(normalized)}" no es una imagen válida.`);
      }
      if (!(await fs.pathExists(normalized))) {
        throw new Error(`No se encontró el archivo "${path.basename(normalized)}".`);
      }
      if (!paths.includes(normalized)) paths.push(normalized);
    }

    return { success: true, paths, canceled: false };
  }

  /** Comprueba si el archivo original sigue existiendo en la ruta guardada. */
  async imageExists(storedPath: string): Promise<boolean> {
    try {
      return await fs.pathExists(this.resolveImagePath(storedPath));
    } catch (_e) {
      return false;
    }
  }

  /**
   * Convierte lo que está guardado en la BD en una ruta absoluta del disco.
   * Acepta rutas absolutas (formato actual) y nombres relativos antiguos, que se
   * resuelven contra la carpeta heredada sin permitir salir de ella.
   */
  resolveImagePath(storedPath: string): string {
    if (!storedPath || !storedPath.trim()) throw new Error('Ruta de imagen vacía.');

    const cleaned = storedPath.trim();
    let absolutePath: string;

    if (path.isAbsolute(cleaned)) {
      absolutePath = path.normalize(cleaned);
    } else {
      const base = path.normalize(this.getLegacyBasePath());
      absolutePath = path.normalize(path.join(base, cleaned));
      if (absolutePath !== base && !absolutePath.startsWith(base + path.sep)) {
        throw new Error('Intento de salto de directorio bloqueado.');
      }
    }

    if (!this.isAllowedImage(absolutePath)) {
      throw new Error('El archivo solicitado no es una imagen permitida.');
    }

    return absolutePath;
  }

  /** Extrae la ruta guardada desde una URL `imagenes://local/<ruta codificada>`. */
  parseImageUrl(url: string): string {
    let raw = url.replace(/^imagenes:\/\/(local\/)?/i, '');
    const queryIndex = raw.search(/[?#]/);
    if (queryIndex !== -1) raw = raw.slice(0, queryIndex);
    return decodeURIComponent(raw);
  }

  /** Construye la URL del protocolo a partir de la ruta guardada. */
  buildImageUrl(storedPath: string): string {
    return `${URL_PREFIX}${encodeURIComponent(storedPath)}`;
  }
}

export default new ImageService();
