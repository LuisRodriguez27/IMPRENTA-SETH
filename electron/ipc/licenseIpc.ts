import { ipcMain, BrowserWindow } from 'electron';
import * as log from 'electron-log';
import licenseService from '../services/licenseService';

// Revalidación periódica. Sin esto, un equipo que deja la app abierta durante
// semanas no vuelve a consultar Supabase, y marcarlo como is_blocked o
// is_suspended no surte efecto hasta que alguien la reinicie.
//
// Vive en el proceso principal, no en el renderer: Chromium estrangula los
// timers de las ventanas sin foco u ocluidas. Medido en pruebas, un
// setInterval del renderer con periodo corto se degradaba a un disparo por
// minuto. Los timers de Node no pasan por ese ciclo de vida.
const REVALIDATION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 h
// Se compara el reloj de pared en cada tick en vez de programar un temporizador
// de 24 h: los timers no avanzan mientras Windows está suspendido, así que uno
// largo se desfasa tanto como haya dormido la máquina.
const REVALIDATION_TICK_MS = 30 * 60 * 1000;

let lastCheckAt = 0;
let checkInFlight = false;

async function runLicenseCheck() {
  checkInFlight = true;
  try {
    return await licenseService.checkLicense();
  } finally {
    lastCheckAt = Date.now();
    checkInFlight = false;
  }
}

export function registerLicenseIpc(): void {
  ipcMain.handle('license:check', async () => {
    // Arranque de la app y botón "Reintentar": el renderer espera la respuesta.
    return await runLicenseCheck();
  });
}

export function startLicenseRevalidation(): void {
  setInterval(async () => {
    if (checkInFlight) return;
    if (Date.now() - lastCheckAt < REVALIDATION_INTERVAL_MS) return;

    try {
      const status = await runLicenseCheck();
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('license:status', status);
      }
    } catch (e) {
      // Una revalidación fallida no debe tumbar el proceso principal; el
      // siguiente ciclo lo reintenta.
      log.error('Error en la revalidación periódica de licencia:', e);
    }
  }, REVALIDATION_TICK_MS);
}
