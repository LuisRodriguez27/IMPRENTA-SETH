import { ipcMain } from 'electron';
import bootstrapService from '../services/bootstrapService';
import type { CreateFirstUserData } from '../services/bootstrapService';

export function registerBootstrapIpc(): void {
  ipcMain.handle('bootstrap:isRequired', async () => await bootstrapService.isRequired());
  ipcMain.handle('bootstrap:createFirstUser', async (_event, data: CreateFirstUserData) =>
    await bootstrapService.createFirstUser(data));
}
