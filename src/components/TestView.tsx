import React, { useEffect, useState } from 'react';
import {
  FlaskConical,
  Bell,
  Power,
  BatteryWarning,
  Zap,
  ZapOff,
  Volume2,
  AlertTriangle,
  Clock,
  Play,
  CheckCircle,
  XCircle,
  Megaphone,
  AlertOctagon,
  Square,
  Settings2,
  FolderOpen,
} from 'lucide-react';
import { UPSData } from '../types/ups';
import type { AppSettings } from '../types/settings';

interface TestViewProps {
  data: UPSData;
  isDisconnected?: boolean;
}

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
}

interface ShutdownEventState {
  scheduledCount: number;
  cancelledCount: number;
  lastScheduledAt: string | null;
}

export const TestView: React.FC<TestViewProps> = ({ data, isDisconnected = false }) => {
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [isPlayingSound, setIsPlayingSound] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [shutdownEvents, setShutdownEvents] = useState<ShutdownEventState>({
    scheduledCount: 0,
    cancelledCount: 0,
    lastScheduledAt: null,
  });

  const disabledClass = isDisconnected ? 'opacity-70' : '';

  const updateTest = (name: string, status: TestResult['status'], message?: string) => {
    setTestResults((prev) => ({
      ...prev,
      [name]: { name, status, message },
    }));
  };

  const runTest = async (testName: string, testFn: () => Promise<string>) => {
    updateTest(testName, 'running');
    try {
      const message = await testFn();
      updateTest(testName, 'success', message || 'Completado');
    } catch (err) {
      updateTest(testName, 'error', err instanceof Error ? err.message : String(err));
    }
  };

  const loadSettingsSummary = async () => {
    if (!window.desktopAPI?.getSettings) return;
    try {
      const next = await window.desktopAPI.getSettings();
      setSettings(next);
    } catch (error) {
      console.error('Error loading settings summary:', error);
    }
  };

  useEffect(() => {
    loadSettingsSummary();

    const unsubscribers: Array<() => void> = [];
    if (window.desktopAPI?.onShutdownScheduled) {
      unsubscribers.push(
        window.desktopAPI.onShutdownScheduled((payload) => {
          setShutdownEvents((prev) => ({
            scheduledCount: prev.scheduledCount + 1,
            cancelledCount: prev.cancelledCount,
            lastScheduledAt: payload?.shutdownTime ?? new Date().toISOString(),
          }));
        }),
      );
    }
    if (window.desktopAPI?.onShutdownCancelled) {
      unsubscribers.push(
        window.desktopAPI.onShutdownCancelled(() => {
          setShutdownEvents((prev) => ({
            ...prev,
            cancelledCount: prev.cancelledCount + 1,
          }));
        }),
      );
    }

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  const testNotification = async () => {
    await runTest('notification', async () => {
      if (!window.desktopAPI?.testNotification) {
        throw new Error('testNotification no disponible');
      }
      const ok = await window.desktopAPI.testNotification();
      if (!ok) throw new Error('El backend no confirmo la notificacion');
      return 'Notificacion enviada';
    });
  };

  const testConfigRead = async () => {
    await runTest('config-read', async () => {
      if (!window.desktopAPI?.getSettings) {
        throw new Error('getSettings no disponible');
      }
      const current = await window.desktopAPI.getSettings();
      setSettings(current);
      if (!current?.alerts || !current?.shutdownPC) {
        throw new Error('Configuracion incompleta');
      }
      return `Configuracion cargada: intervalo ${current.pollingInterval}ms`;
    });
  };

  const testShutdownSchedule = async () => {
    await runTest('shutdown', async () => {
      if (!window.desktopAPI?.simulateShutdownFlow) {
        throw new Error('simulateShutdownFlow no disponible');
      }
      const response = await window.desktopAPI.simulateShutdownFlow(5, 1200);
      if (!response.scheduled || !response.cancelled) {
        throw new Error('La simulacion no completo el flujo esperado');
      }
      return `Simulado para ${response.minutes} min y cancelado automaticamente`;
    });
  };

  const testSoundInventory = async () => {
    await runTest('sound-inventory', async () => {
      if (!window.desktopAPI?.getAvailableSounds) {
        throw new Error('getAvailableSounds no disponible');
      }
      const sounds = await window.desktopAPI.getAvailableSounds();
      return `Sonidos detectados: ${sounds.length}`;
    });
  };

  const testSound = async (id: string, type: 'acFault' | 'batteryLow' | 'critical') => {
    setIsPlayingSound(true);
    await runTest(id, async () => {
      if (!window.desktopAPI?.playSound) {
        throw new Error('playSound no disponible');
      }
      const ok = await window.desktopAPI.playSound(type, 2);
      if (!ok) throw new Error('No fue posible iniciar reproduccion');
      return 'Sonido reproducido';
    });
    setTimeout(() => setIsPlayingSound(false), 5000);
  };

  const testSoundAcFault = async () => testSound('sound-ac', 'acFault');
  const testSoundBatteryLow = async () => testSound('sound-battery', 'batteryLow');
  const testSoundCritical = async () => testSound('sound-critical', 'critical');

  const stopAllSounds = async () => {
    setIsPlayingSound(false);
    if (window.desktopAPI?.stopSound) {
      await window.desktopAPI.stopSound();
    }
  };

  const testUrgentAlertWarning = async () => {
    await runTest('alert-warning', async () => {
      if (!window.desktopAPI?.testUrgentAlert) {
        throw new Error('testUrgentAlert no disponible');
      }
      await window.desktopAPI.testUrgentAlert(
        'Fallo de energia',
        'Se detecto un corte de energia. El UPS opera en bateria.',
        'warning',
      );
      return 'Popup de advertencia mostrado';
    });
  };

  const testUrgentAlertCritical = async () => {
    await runTest('alert-critical', async () => {
      if (!window.desktopAPI?.testUrgentAlert) {
        throw new Error('testUrgentAlert no disponible');
      }
      await window.desktopAPI.testUrgentAlert(
        'Bateria critica',
        'Nivel critico alcanzado. Guarda tu trabajo inmediatamente.',
        'critical',
      );
      return 'Popup critico mostrado';
    });
  };

  const testUrgentAlertBattery = async () => {
    await runTest('alert-battery', async () => {
      if (!window.desktopAPI?.testUrgentAlert) {
        throw new Error('testUrgentAlert no disponible');
      }
      await window.desktopAPI.testUrgentAlert(
        'Bateria baja',
        'Nivel bajo detectado, verifica alimentacion AC.',
        'battery',
      );
      return 'Popup de bateria mostrado';
    });
  };

  const getStatusIcon = (status?: TestResult['status']) => {
    switch (status) {
      case 'running':
        return <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return <div className="w-4 h-4 rounded-full bg-white/10" />;
    }
  };

  const basicTests = [
    {
      id: 'notification',
      name: 'Notificacion del sistema',
      description: 'Envia una notificacion de Windows',
      icon: Bell,
      action: testNotification,
      color: 'cyan',
    },
    {
      id: 'shutdown',
      name: 'Flujo de apagado simulado',
      description: 'Programa y cancela sin ejecutar shutdown real',
      icon: Power,
      action: testShutdownSchedule,
      color: 'slate',
    },
    {
      id: 'config-read',
      name: 'Lectura de configuracion',
      description: 'Valida que frontend pueda leer ajustes actuales',
      icon: Settings2,
      action: testConfigRead,
      color: 'purple',
    },
    {
      id: 'sound-inventory',
      name: 'Inventario de sonidos',
      description: 'Consulta sonidos disponibles en backend',
      icon: FolderOpen,
      action: testSoundInventory,
      color: 'emerald',
    },
  ];

  const soundTests = [
    {
      id: 'sound-ac',
      name: 'Sonido: fallo AC',
      description: 'Reproduce alerta de fallo de energia',
      icon: ZapOff,
      action: testSoundAcFault,
      color: 'red',
    },
    {
      id: 'sound-battery',
      name: 'Sonido: bateria baja',
      description: 'Reproduce alerta de bateria baja',
      icon: BatteryWarning,
      action: testSoundBatteryLow,
      color: 'amber',
    },
    {
      id: 'sound-critical',
      name: 'Sonido: critico',
      description: 'Reproduce alerta critica',
      icon: AlertOctagon,
      action: testSoundCritical,
      color: 'rose',
    },
  ];

  const alertTests = [
    {
      id: 'alert-warning',
      name: 'Alerta: advertencia',
      description: 'Muestra popup de advertencia',
      icon: AlertTriangle,
      action: testUrgentAlertWarning,
      color: 'amber',
    },
    {
      id: 'alert-battery',
      name: 'Alerta: bateria',
      description: 'Muestra popup de bateria baja',
      icon: BatteryWarning,
      action: testUrgentAlertBattery,
      color: 'orange',
    },
    {
      id: 'alert-critical',
      name: 'Alerta: critica',
      description: 'Muestra popup de emergencia',
      icon: AlertOctagon,
      action: testUrgentAlertCritical,
      color: 'red',
    },
  ];

  const colorVariants: Record<string, string> = {
    cyan: 'bg-cyan-500/20 text-cyan-400',
    slate: 'bg-slate-500/20 text-slate-400',
    red: 'bg-red-500/20 text-red-400',
    amber: 'bg-amber-500/20 text-amber-400',
    orange: 'bg-orange-500/20 text-orange-400',
    rose: 'bg-rose-500/20 text-rose-400',
    purple: 'bg-purple-500/20 text-purple-400',
    emerald: 'bg-emerald-500/20 text-emerald-400',
  };

  const renderTestSection = (title: string, tests: typeof basicTests, titleIcon: React.ReactNode) => (
    <div className="glass-card p-5">
      <h2 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
        {titleIcon}
        {title}
      </h2>
      <div className="space-y-3">
        {tests.map((test) => {
          const Icon = test.icon;
          const result = testResults[test.id];

          return (
            <div key={test.id} className="flex items-center justify-between p-4 bg-dark-800/50 rounded-lg">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorVariants[test.color]}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-white font-medium">{test.name}</p>
                  <p className="text-white/40 text-sm">{test.description}</p>
                  {result?.message && (
                    <p className={`text-xs mt-1 ${result.status === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {result.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getStatusIcon(result?.status)}
                <button
                  onClick={test.action}
                  disabled={result?.status === 'running'}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-lg text-sm text-white transition-colors"
                >
                  Ejecutar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={`flex-1 flex flex-col overflow-hidden ${disabledClass}`}>
      <header className="px-8 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <FlaskConical className="w-6 h-6 text-purple-400" />
          <div>
            <h1 className="text-xl font-bold text-white">Panel de Pruebas</h1>
            <p className="text-white/40 text-xs mt-0.5">Validaciones funcionales del sistema</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            Estado actual del UPS
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-dark-800/50 rounded-lg p-3">
              <p className="text-xs text-white/50">Entrada AC</p>
              <p className="text-lg font-mono text-white">{data.inputVoltage?.toFixed(1)} V</p>
              <p className={`text-xs ${data.status?.utilityFail ? 'text-red-400' : 'text-emerald-400'}`}>
                {data.status?.utilityFail ? 'FALLO' : 'Normal'}
              </p>
            </div>
            <div className="bg-dark-800/50 rounded-lg p-3">
              <p className="text-xs text-white/50">Bateria</p>
              <p className="text-lg font-mono text-white">{data.batteryPercent?.toFixed(0)}%</p>
              <p className={`text-xs ${data.status?.batteryLow ? 'text-red-400' : 'text-emerald-400'}`}>
                {data.status?.batteryLow ? 'BAJA' : 'Normal'}
              </p>
            </div>
            <div className="bg-dark-800/50 rounded-lg p-3">
              <p className="text-xs text-white/50">Carga</p>
              <p className="text-lg font-mono text-white">{data.loadPercent?.toFixed(0)}%</p>
              <p className={`text-xs ${data.loadPercent > 80 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {data.loadPercent > 100 ? 'SOBRECARGA' : data.loadPercent > 80 ? 'Alta' : 'Normal'}
              </p>
            </div>
            <div className="bg-dark-800/50 rounded-lg p-3">
              <p className="text-xs text-white/50">Modo</p>
              <p className="text-lg font-mono text-white">{data.status?.utilityFail ? 'Bateria' : 'AC'}</p>
              <p className={`text-xs ${data.status?.utilityFail ? 'text-amber-400' : 'text-emerald-400'}`}>
                {data.status?.utilityFail ? 'Respaldo' : 'Linea'}
              </p>
            </div>
          </div>
        </div>

        {renderTestSection('Pruebas funcionales', basicTests, <Play className="w-4 h-4 text-emerald-400" />)}

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white/70 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-cyan-400" />
              Pruebas de sonido
            </h2>
            {isPlayingSound && (
              <button
                onClick={stopAllSounds}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition-colors"
              >
                <Square className="w-3 h-3" />
                Detener
              </button>
            )}
          </div>
          <div className="space-y-3">
            {soundTests.map((test) => {
              const Icon = test.icon;
              const result = testResults[test.id];

              return (
                <div key={test.id} className="flex items-center justify-between p-4 bg-dark-800/50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorVariants[test.color]}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-white font-medium">{test.name}</p>
                      <p className="text-white/40 text-sm">{test.description}</p>
                      {result?.message && (
                        <p className={`text-xs mt-1 ${result.status === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {result.message}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result?.status)}
                    <button
                      onClick={test.action}
                      disabled={result?.status === 'running' || isPlayingSound}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-lg text-sm text-white transition-colors"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-rose-400" />
            Alertas urgentes (popups)
          </h2>
          <div className="space-y-3">
            {alertTests.map((test) => {
              const Icon = test.icon;
              const result = testResults[test.id];

              return (
                <div key={test.id} className="flex items-center justify-between p-4 bg-dark-800/50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorVariants[test.color]}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-white font-medium">{test.name}</p>
                      <p className="text-white/40 text-sm">{test.description}</p>
                      {result?.message && (
                        <p className={`text-xs mt-1 ${result.status === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {result.message}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result?.status)}
                    <button
                      onClick={test.action}
                      disabled={result?.status === 'running'}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-lg text-sm text-white transition-colors"
                    >
                      Mostrar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            Estado de flujo de apagado y configuracion
          </h2>
          <div className="bg-dark-800/50 rounded-lg p-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-white/50">Eventos shutdown-scheduled:</span>
              <span className="text-white font-mono">{shutdownEvents.scheduledCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Eventos shutdown-cancelled:</span>
              <span className="text-white font-mono">{shutdownEvents.cancelledCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Ultimo shutdown programado:</span>
              <span className="text-white/80 text-xs">
                {shutdownEvents.lastScheduledAt
                  ? new Date(shutdownEvents.lastScheduledAt).toLocaleString('es-ES')
                  : 'N/A'}
              </span>
            </div>
            <div className="pt-2 border-t border-white/10 space-y-1">
              <p className="text-white/50">Resumen de ajustes:</p>
              <p className="text-white/80 text-xs">
                AC fault: {settings?.alerts?.acFault?.playSound ? 'sonido ON' : 'sonido OFF'} | popup{' '}
                {settings?.alerts?.acFault?.showPopup ? 'ON' : 'OFF'}
              </p>
              <p className="text-white/80 text-xs">
                Bateria critica: umbral {settings?.criticalBatteryThreshold ?? 'N/A'}% | accion{' '}
                {settings?.shutdownPC?.action ?? 'N/A'}
              </p>
              <p className="text-white/80 text-xs">
                Ruta sonidos custom: {settings?.customSoundsPath ?? 'predeterminada'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


