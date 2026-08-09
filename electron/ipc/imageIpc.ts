import { ipcMain, BrowserWindow } from 'electron';
import imageService from '../services/imageService';

export function registerImageIpc(): void {
  // Abre el explorador del sistema y devuelve las rutas originales elegidas
  ipcMain.handle('images:select', async (event) =>
    await imageService.selectImages(BrowserWindow.fromWebContents(event.sender)));

  // Verifica que el archivo original siga existiendo en la ruta guardada
  ipcMain.handle('images:exists', async (_event, storedPath: string) =>
    await imageService.imageExists(storedPath));
}
