import { ipcMain } from 'electron';
import licenseService from '../services/licenseService';

export function registerLicenseIpc(): void {
  ipcMain.handle('license:check', async () => {
    return await licenseService.checkLicense();
  });
}
