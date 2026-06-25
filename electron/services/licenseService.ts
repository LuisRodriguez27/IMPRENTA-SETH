import '../env';
import { machineIdSync } from 'node-machine-id';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { app, net } from 'electron';
import { createClient } from '@supabase/supabase-js';
import db from '../db';
import authService from './authService';

// Interfaces for license status
export interface LicenseStatus {
  success: boolean;
  status: 'demo' | 'activo' | 'suspended' | 'blocked' | 'expired' | 'limit_exceeded' | 'invalid_config' | 'validation_required' | 'no_license';
  clientCode: string;
  daysRemaining?: number;
  message?: string;
  hardwareId: string;
  deviceName: string;
}

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const clientCode = process.env.CLIENT_LICENSE_CODE || 'SETH-CLI-DEFAULT';

// Initialize Supabase client
const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Helper to log out user and return failed license status
async function handleLicenseFailure(response: LicenseStatus): Promise<LicenseStatus> {
  try {
    await authService.logout();
  } catch (e) {
    console.error('Error logging out during license failure:', e);
  }
  return response;
}

// Retrieve unique hardware ID
function getHardwareId(): string {
  try {
    return machineIdSync();
  } catch (error) {
    console.error('Error obtaining machine ID via node-machine-id, generating fallback UUID:', error);
    try {
      const userDataPath = app.getPath('userData');
      const licenseFilePath = path.join(userDataPath, '.hwid');
      if (fs.existsSync(licenseFilePath)) {
        return fs.readFileSync(licenseFilePath, 'utf8').trim();
      }
      const { v4: uuidv4 } = require('uuid');
      const newId = uuidv4();
      fs.writeFileSync(licenseFilePath, newId, 'utf8');
      return newId;
    } catch (e) {
      console.error('Failed to create fallback file-based HWID, using fallback OS variables:', e);
      return `${os.platform()}-${os.arch()}-${os.release()}-${os.hostname()}`;
    }
  }
}

// Check internet connection
export async function isOnline(): Promise<boolean> {
  if (!supabaseUrl) return false;
  return new Promise((resolve) => {
    try {
      const urlToCheck = new URL(supabaseUrl).hostname;
      const request = net.request({
        method: 'GET',
        protocol: 'https:',
        hostname: urlToCheck,
        port: 443,
        path: '/'
      });
      request.on('response', () => {
        resolve(true);
      });
      request.on('error', () => {
        resolve(false);
      });
      request.end();
    } catch (e) {
      resolve(false);
    }
  });
}

// Local cache functions
async function saveLocalLicense(clientCode: string, status: string, isSuspended: boolean) {
  const existing = await db.getOne('SELECT id FROM local_licenses WHERE client_code = $1', [clientCode]);
  const now = new Date().toISOString();
  if (existing) {
    await db.execute(
      'UPDATE local_licenses SET status = $1, is_suspended = $2, last_online_validation = $3 WHERE client_code = $4',
      [status, isSuspended ? 1 : 0, now, clientCode]
    );
  } else {
    await db.execute(
      'INSERT INTO local_licenses (client_code, status, is_suspended, last_online_validation) VALUES ($1, $2, $3, $4)',
      [clientCode, status, isSuspended ? 1 : 0, now]
    );
  }
}

async function saveLocalDevice(hwId: string, devName: string, isBlocked: boolean) {
  const existing = await db.getOne('SELECT id FROM local_devices WHERE hardware_id = $1', [hwId]);
  if (existing) {
    await db.execute(
      'UPDATE local_devices SET device_name = $1, is_blocked = $2 WHERE hardware_id = $3',
      [devName, isBlocked ? 1 : 0, hwId]
    );
  } else {
    await db.execute(
      'INSERT INTO local_devices (hardware_id, device_name, is_blocked) VALUES ($1, $2, $3)',
      [hwId, devName, isBlocked ? 1 : 0]
    );
  }
}

class LicenseService {
  /**
   * Validate license status online (against Supabase) or offline (local sqlite cache)
   */
  async checkLicense(): Promise<LicenseStatus> {
    const hardwareId = getHardwareId();
    const deviceName = process.env.DEVICE_NAME || os.hostname() || 'PC-Seth';
    
    // Check if configuration is missing
    if (!supabaseUrl || !supabaseKey || !clientCode) {
      console.warn('Licensing credentials not found in env. Falling back to local cache or running in mock-active mode.');
      // If config is missing, check if local cache already has something. If not, default to active for compatibility.
      const localLic = await db.getOne<{ status: string }>('SELECT status FROM local_licenses LIMIT 1');
      if (localLic) {
        return {
          success: true,
          status: localLic.status as any,
          clientCode: clientCode || 'SETH-CLI-MOCK',
          hardwareId,
          deviceName,
          message: 'Licencia validada localmente (modo sin configuración Supabase)'
        };
      }
      return {
        success: true,
        status: 'activo',
        clientCode: 'SETH-CLI-MOCK',
        hardwareId,
        deviceName,
        message: 'Aplicación activa por defecto (sin configuración Supabase)'
      };
    }

    const online = await isOnline();

    if (online && supabase) {
      try {
        console.log(`Validating license online for client: ${clientCode}, device: ${deviceName}`);
        
        // Call the secure RPC function instead of querying tables directly
        const { data, error } = await supabase.rpc('registrar_o_validar_dispositivo', {
          p_hardware_id: hardwareId,
          p_client_code: clientCode,
          p_device_name: deviceName
        });

        if (error || !data || data.length === 0) {
          console.error('RPC validation failed or returned no data:', error);
          throw new Error(error?.message || 'Error al validar dispositivo por RPC');
        }

        const result = data[0] as { resultado: string; client_status: string; first_boot: string };

        if (result.resultado === 'client_not_found') {
          return await handleLicenseFailure({
            success: false,
            status: 'invalid_config',
            clientCode,
            hardwareId,
            deviceName,
            message: 'Código de activación inválido o cliente no registrado en el servidor de licencias.'
          });
        }

        if (result.resultado === 'suspended') {
          await saveLocalLicense(clientCode, result.client_status || 'demo', true);
          return await handleLicenseFailure({
            success: false,
            status: 'suspended',
            clientCode,
            hardwareId,
            deviceName,
            message: 'El cliente ha sido suspendido. Por favor, contacte al proveedor de software.'
          });
        }

        if (result.resultado === 'blocked') {
          await saveLocalDevice(hardwareId, deviceName, true);
          return await handleLicenseFailure({
            success: false,
            status: 'blocked',
            clientCode,
            hardwareId,
            deviceName,
            message: 'Esta computadora ha sido bloqueada. Por favor, contacte a soporte.'
          });
        }

        if (result.resultado === 'limit_exceeded') {
          return await handleLicenseFailure({
            success: false,
            status: 'limit_exceeded',
            clientCode,
            hardwareId,
            deviceName,
            message: 'Límite de dispositivos excedido. Contacte a soporte para añadir más cupos.'
          });
        }

        if (result.resultado === 'authorized') {
          if (result.client_status === 'demo') {
            const firstBootDate = new Date(result.first_boot);
            const timeDiff = new Date().getTime() - firstBootDate.getTime();
            const daysDiff = timeDiff / (1000 * 3600 * 24);
            const daysRemaining = Math.max(0, 2 - daysDiff);

            if (daysDiff > 2) {
              await saveLocalLicense(clientCode, 'demo', false);
              await saveLocalDevice(hardwareId, deviceName, false);
              return await handleLicenseFailure({
                success: false,
                status: 'expired',
                clientCode,
                hardwareId,
                deviceName,
                daysRemaining: 0,
                message: 'Su periodo de prueba de 2 días ha expirado. Por favor, adquiera la licencia completa.'
              });
            }

            await saveLocalLicense(clientCode, 'demo', false);
            await saveLocalDevice(hardwareId, deviceName, false);
            return {
              success: true,
              status: 'demo',
              clientCode,
              hardwareId,
              deviceName,
              daysRemaining: Math.ceil(daysRemaining),
              message: `Licencia de prueba activa. Días restantes: ${Math.ceil(daysRemaining)}`
            };
          }

          // Active customer
          await saveLocalLicense(clientCode, 'activo', false);
          await saveLocalDevice(hardwareId, deviceName, false);
          return {
            success: true,
            status: 'activo',
            clientCode,
            hardwareId,
            deviceName,
            message: 'Licencia activa y validada.'
          };
        }

        throw new Error(`Resultado desconocido de la validación: ${result.resultado}`);

      } catch (err) {
        console.error('Online license verification failed, falling back to offline validation:', err);
        return await this.checkOfflineLicense(hardwareId, deviceName);
      }
    } else {
      // Offline mode
      console.log('App is offline. Checking license using local cache database.');
      return await this.checkOfflineLicense(hardwareId, deviceName);
    }
  }

  /**
   * Helper to validate license using local SQLite/Postgres cache
   */
  private async checkOfflineLicense(hardwareId: string, deviceName: string): Promise<LicenseStatus> {
    try {
      const localLic = await db.getOne<{
        client_code: string;
        status: string;
        is_suspended: boolean;
        last_online_validation: string;
        created_at: string;
      }>('SELECT * FROM local_licenses WHERE client_code = $1', [clientCode]);

      if (!localLic) {
        return await handleLicenseFailure({
          success: false,
          status: 'no_license',
          clientCode,
          hardwareId,
          deviceName,
          message: 'No se encontró una licencia local activa. Por favor, conéctese a internet para validar el sistema por primera vez.'
        });
      }

      if (localLic.is_suspended) {
        return await handleLicenseFailure({
          success: false,
          status: 'suspended',
          clientCode,
          hardwareId,
          deviceName,
          message: 'El cliente ha sido suspendido. Por favor, contacte al proveedor de software.'
        });
      }

      // Check device in cache
      const localDev = await db.getOne<{
        hardware_id: string;
        device_name: string;
        is_blocked: boolean;
        created_at: string;
      }>('SELECT * FROM local_devices WHERE hardware_id = $1', [hardwareId]);

      if (!localDev) {
        return await handleLicenseFailure({
          success: false,
          status: 'blocked',
          clientCode,
          hardwareId,
          deviceName,
          message: 'Esta computadora no está registrada localmente en la red de la oficina. Se requiere conexión a internet para darla de alta.'
        });
      }

      if (localDev.is_blocked) {
        return await handleLicenseFailure({
          success: false,
          status: 'blocked',
          clientCode,
          hardwareId,
          deviceName,
          message: 'Esta computadora ha sido bloqueada. Por favor, contacte a soporte.'
        });
      }

      // If license status is demo, calculate demo expiration (2 days)
      if (localLic.status === 'demo') {
        const licenseCreatedDate = new Date(localLic.created_at);
        const timeDiff = new Date().getTime() - licenseCreatedDate.getTime();
        const daysDiff = timeDiff / (1000 * 3600 * 24);
        const daysRemaining = Math.max(0, 2 - daysDiff);

        if (daysDiff > 2) {
          return await handleLicenseFailure({
            success: false,
            status: 'expired',
            clientCode,
            hardwareId,
            deviceName,
            daysRemaining: 0,
            message: 'Su periodo de prueba de 2 días ha expirado.'
          });
        }

        return {
          success: true,
          status: 'demo',
          clientCode,
          hardwareId,
          deviceName,
          daysRemaining: Math.ceil(daysRemaining),
          message: `Licencia de prueba (offline). Días restantes: ${Math.ceil(daysRemaining)}`
        };
      }

      // Active state offline validation: check 5 days rule
      if (localLic.status === 'activo') {
        const lastValDate = new Date(localLic.last_online_validation);
        const timeDiff = new Date().getTime() - lastValDate.getTime();
        const daysDiff = timeDiff / (1000 * 3600 * 24);

        if (daysDiff > 5) {
          return await handleLicenseFailure({
            success: false,
            status: 'validation_required',
            clientCode,
            hardwareId,
            deviceName,
            message: 'Se requiere conexión a internet para verificar la licencia (límite de 5 días offline alcanzado).'
          });
        }

        return {
          success: true,
          status: 'activo',
          clientCode,
          hardwareId,
          deviceName,
          message: `Licencia activa (modo offline). Última sincronización hace ${Math.floor(daysDiff)} días.`
        };
      }

      return await handleLicenseFailure({
        success: false,
        status: 'no_license',
        clientCode,
        hardwareId,
        deviceName,
        message: 'Estado de licencia desconocido.'
      });

    } catch (e) {
      console.error('Error querying local license cache:', e);
      return await handleLicenseFailure({
        success: false,
        status: 'no_license',
        clientCode,
        hardwareId,
        deviceName,
        message: 'Error al acceder a la base de datos local de licencias.'
      });
    }
  }
}

export default new LicenseService();
