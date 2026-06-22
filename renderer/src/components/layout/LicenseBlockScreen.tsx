import { useState } from 'react';
import { ShieldAlert, RefreshCw, Copy, Check, Lock, AlertCircle, WifiOff } from 'lucide-react';

interface LicenseBlockScreenProps {
  status: 'suspended' | 'blocked' | 'expired' | 'limit_exceeded' | 'invalid_config' | 'validation_required' | 'no_license';
  clientCode: string;
  hardwareId: string;
  deviceName: string;
  message?: string;
  daysRemaining?: number;
  onRetry: () => Promise<void>;
}

export default function LicenseBlockScreen({
  status,
  clientCode,
  hardwareId,
  deviceName,
  message,
  onRetry
}: LicenseBlockScreenProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetry();
    } catch (e) {
      console.error(e);
    } finally {
      // Small timeout to give visual feedback
      setTimeout(() => setIsRetrying(false), 800);
    }
  };

  const handleCopyHwid = () => {
    navigator.clipboard.writeText(hardwareId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Get visual tokens and descriptions based on the license error status
  const getStatusDetails = () => {
    switch (status) {
      case 'suspended':
        return {
          icon: <AlertCircle className="w-16 h-16 text-red-500 animate-pulse" />,
          title: 'Cliente Suspendido',
          description: message || 'El acceso al sistema ha sido suspendido por administración.',
          advice: 'Por favor, comuníquese con el departamento administrativo o soporte técnico para regularizar su estado de cuenta.',
        };
      case 'blocked':
        return {
          icon: <Lock className="w-16 h-16 text-red-600 animate-bounce" />,
          title: 'Computadora Bloqueada',
          description: message || 'Este equipo específico ha sido inhabilitado para usar la aplicación.',
          advice: 'Póngase en contacto con el administrador de su empresa o con soporte técnico para revisar el estado de este dispositivo.',
        };
      case 'expired':
        return {
          icon: <ShieldAlert className="w-16 h-16 text-amber-500" />,
          title: 'Periodo de Prueba Expirado',
          description: message || 'Su periodo de demostración de 2 días ha concluido.',
          advice: 'Para continuar usando el sistema y registrar transacciones sin límite, solicite la activación de su licencia.',
        };
      case 'limit_exceeded':
        return {
          icon: <ShieldAlert className="w-16 h-16 text-rose-500" />,
          title: 'Límite de Equipos Superado',
          description: message || 'Ha alcanzado el número máximo de computadoras permitidas.',
          advice: 'Su licencia actual no permite añadir más equipos. Si desea expandir su negocio, solicite un incremento de computadoras.',
        };
      case 'validation_required':
        return {
          icon: <WifiOff className="w-16 h-16 text-blue-500" />,
          title: 'Verificación de Licencia Requerida',
          description: message || 'Límite de 5 días de uso offline alcanzado.',
          advice: 'Para continuar operando de forma segura, se requiere conectar el equipo a internet al menos una vez para sincronizar la licencia.',
        };
      case 'no_license':
        return {
          icon: <WifiOff className="w-16 h-16 text-indigo-500" />,
          title: 'Registro de Licencia Requerido',
          description: message || 'No se detectó un registro de activación local.',
          advice: 'Es necesario conectar este equipo a internet la primera vez para registrarlo con su código de cliente en la nube.',
        };
      case 'invalid_config':
      default:
        return {
          icon: <AlertCircle className="w-16 h-16 text-red-400" />,
          title: 'Configuración de Licencia Inválida',
          description: message || 'Error de configuración interna del software.',
          advice: 'El código de activación no coincide con los registros centrales. Comuníquese con soporte técnico inmediatamente.',
        };
    }
  };

  const details = getStatusDetails();

  return (
    <div className="min-h-screen flex items-center justify-center bg-radial from-slate-900 to-slate-950 text-slate-100 p-6 selection:bg-indigo-500 selection:text-white font-sans">
      <div className="relative max-w-xl w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-8 md:p-10 shadow-2xl overflow-hidden transition-all duration-300">
        
        {/* Glow effect */}
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

        {/* Content */}
        <div className="flex flex-col items-center text-center">
          <div className="p-4 bg-slate-800/40 border border-slate-700/50 rounded-full mb-6 shadow-inner">
            {details.icon}
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent mb-3">
            {details.title}
          </h1>

          <p className="text-base text-slate-300 mb-4 max-w-md font-medium">
            {details.description}
          </p>

          <div className="w-full bg-slate-950/50 rounded-xl p-4 border border-slate-800/60 mb-6 text-left space-y-3.5 text-xs text-slate-400">
            <h2 className="font-semibold text-slate-300 uppercase tracking-wider text-[10px] border-b border-slate-800 pb-2">
              Detalles del Dispositivo
            </h2>
            <div className="flex justify-between items-center">
              <span>Código Cliente:</span>
              <span className="font-mono text-slate-200 font-semibold bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/50">
                {clientCode}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Nombre Equipo:</span>
              <span className="font-semibold text-slate-200">{deviceName}</span>
            </div>
            <div className="flex flex-col space-y-1.5 pt-1">
              <div className="flex justify-between items-center">
                <span>ID Hardware (UUID):</span>
                <button
                  onClick={handleCopyHwid}
                  className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                  title="Copiar ID de Hardware"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
              <div className="font-mono bg-slate-950 px-3 py-2 rounded text-slate-300 text-[10px] break-all select-all border border-slate-850">
                {hardwareId}
              </div>
            </div>
          </div>

          <div className="text-sm text-slate-400 bg-slate-800/20 border border-indigo-500/10 rounded-xl p-4 mb-8 text-left leading-relaxed">
            <span className="font-semibold text-indigo-400 block mb-1">Instrucciones:</span>
            {details.advice}
          </div>

          <div className="flex flex-col sm:flex-row gap-3.5 w-full">
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-[0.98] disabled:opacity-50 text-white font-semibold py-3 px-5 rounded-xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-500/30 transition-all duration-200 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Verificando...' : 'Reintentar Verificación'}
            </button>
          </div>
        </div>

        {/* Brand footer */}
        <div className="mt-8 text-center text-[10px] text-slate-655 tracking-widest uppercase">
          SETH • Sistema de Control de Licencias
        </div>
      </div>
    </div>
  );
}
