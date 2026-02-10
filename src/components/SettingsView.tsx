import React, { useState, useEffect, useCallback } from 'react';
import { 
  Settings, 
  Plug, 
  Power, 
  AlertTriangle, 
  Database,
  Monitor,
  Volume2,
  Play,
  Save,
  RotateCcw,
  Check,
  Clock,
  Zap,
  Battery,
  ZapOff,
  BatteryWarning,
  AlertOctagon,
  Info,
  FolderOpen,
  FolderX,
  Music,
  Square
} from 'lucide-react';
import { AppSettings, AlertConfig, defaultAppSettings } from '../types/settings';
import type { SoundInfo } from '../types/desktop';

type TabType = 'general' | 'alerts' | 'sounds' | 'shutdown' | 'history' | 'about';

// Toggle Switch Component
const Toggle: React.FC<{ 
  checked: boolean; 
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}> = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    onClick={() => !disabled && onChange(!checked)}
    disabled={disabled}
    className={`
      relative w-11 h-6 rounded-full transition-colors duration-150
      ${checked ? 'bg-cyan-500' : 'bg-dark-600'}
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
    `}
  >
    <div 
      className={`
        absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm
        transition-transform duration-150
        ${checked ? 'translate-x-6' : 'translate-x-1'}
      `}
    />
  </button>
);

// Number Input Component
const NumberInput: React.FC<{
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
  className?: string;
  disabled?: boolean;
}> = ({ value, onChange, min = 0, max = 9999, suffix, className = '', disabled }) => (
  <div className={`flex items-center gap-2 ${className}`}>
    <input
      type="number"
      value={value}
      onChange={(e) => {
        const v = parseInt(e.target.value) || 0;
        onChange(Math.max(min, Math.min(max, v)));
      }}
      min={min}
      max={max}
      disabled={disabled}
      className="w-20 px-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-white text-sm
                 focus:outline-none focus:border-cyan-500/50 disabled:opacity-50"
    />
    {suffix && <span className="text-white/50 text-sm">{suffix}</span>}
  </div>
);

export const SettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [availableSounds, setAvailableSounds] = useState<SoundInfo[]>([]);
  const [loadingSounds, setLoadingSounds] = useState(false);
  const [playingSoundType, setPlayingSoundType] = useState<string | null>(null);

  const refreshAvailableSounds = useCallback(async () => {
    if (!window.desktopAPI?.getAvailableSounds) return;
    setLoadingSounds(true);
    try {
      const sounds = await window.desktopAPI.getAvailableSounds();
      setAvailableSounds(sounds ?? []);
    } catch (error) {
      console.error('Error loading available sounds:', error);
      setAvailableSounds([]);
    } finally {
      setLoadingSounds(false);
    }
  }, []);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        if (window.desktopAPI?.getSettings) {
          const savedSettings = await window.desktopAPI.getSettings();
          if (savedSettings) {
            setSettings({ ...defaultAppSettings, ...savedSettings } as AppSettings);
          }
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
    refreshAvailableSounds();
  }, [refreshAvailableSounds]);

  const updateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const toggleMonitorOnlyMode = useCallback((enabled: boolean) => {
    setSettings((prev) => {
      if (!enabled) {
        return {
          ...prev,
          monitorOnlyMode: false,
        };
      }

      return {
        ...prev,
        monitorOnlyMode: true,
        enableNotifications: false,
        alerts: {
          acFault: { ...prev.alerts.acFault, playSound: false, showPopup: false },
          batteryLow: { ...prev.alerts.batteryLow, playSound: false, showPopup: false },
          batteryCritical: { ...prev.alerts.batteryCritical, playSound: false, showPopup: false },
        },
        shutdownPC: {
          ...prev.shutdownPC,
          onAcFault: { ...prev.shutdownPC.onAcFault, enabled: false },
          onBatteryLow: { ...prev.shutdownPC.onBatteryLow, enabled: false },
          onBatteryCritical: { ...prev.shutdownPC.onBatteryCritical, enabled: false },
          autoSaveFiles: false,
          shutdownCommand: '',
        },
        upsControl: {
          ...prev.upsControl,
          shutdownUpsAfterPC: false,
        },
        saveHistory: false,
      };
    });
    setSaved(false);
  }, []);

  const saveSettings = useCallback(async () => {
    try {
      if (window.desktopAPI?.saveSettings) {
        await window.desktopAPI.saveSettings(settings);
        // Update history interval in the backend
        if (window.desktopAPI?.updateHistoryInterval) {
          await window.desktopAPI.updateHistoryInterval(settings.historyInterval);
        }
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }, [settings]);

  const resetSettings = useCallback(() => {
    setSettings(defaultAppSettings);
    setSaved(false);
  }, []);

  const tabs = [
    { id: 'general' as TabType, label: 'General', icon: Monitor },
    { id: 'alerts' as TabType, label: 'Alertas', icon: Volume2 },
    { id: 'sounds' as TabType, label: 'Sonidos', icon: Music },
    { id: 'shutdown' as TabType, label: 'Apagado', icon: Power },
    { id: 'history' as TabType, label: 'Historial', icon: Database },
    { id: 'about' as TabType, label: 'Acerca de', icon: Plug },
  ];

  // Helper para actualizar alertas anidadas
  const updateAlert = (alertType: keyof typeof settings.alerts, field: keyof AlertConfig, value: boolean | number) => {
    setSettings(prev => ({
      ...prev,
      alerts: {
        ...prev.alerts,
        [alertType]: {
          ...prev.alerts[alertType],
          [field]: value
        }
      }
    }));
    setSaved(false);
  };

  const selectSoundsFolder = useCallback(async () => {
    if (!window.desktopAPI?.selectFile) return;
    try {
      const selectedPath = await window.desktopAPI.selectFile();
      if (!selectedPath) return;
      updateSetting('customSoundsPath', selectedPath);
      if (window.desktopAPI?.setCustomSoundsPath) {
        await window.desktopAPI.setCustomSoundsPath(selectedPath);
      }
      await refreshAvailableSounds();
    } catch (error) {
      console.error('Error selecting sounds folder:', error);
    }
  }, [refreshAvailableSounds, updateSetting]);

  const clearSoundsFolder = useCallback(async () => {
    updateSetting('customSoundsPath', null);
    try {
      if (window.desktopAPI?.setCustomSoundsPath) {
        await window.desktopAPI.setCustomSoundsPath(null);
      }
      await refreshAvailableSounds();
    } catch (error) {
      console.error('Error clearing sounds folder:', error);
    }
  }, [refreshAvailableSounds, updateSetting]);

  const previewSound = useCallback(async (type: 'acFault' | 'batteryLow' | 'critical') => {
    if (!window.desktopAPI?.playSound) return;
    setPlayingSoundType(type);
    try {
      await window.desktopAPI.playSound(type, 1);
    } catch (error) {
      console.error('Error previewing sound:', error);
    } finally {
      setTimeout(() => setPlayingSoundType((current) => (current === type ? null : current)), 1200);
    }
  }, []);

  const stopPreview = useCallback(async () => {
    setPlayingSoundType(null);
    try {
      if (window.desktopAPI?.stopSound) {
        await window.desktopAPI.stopSound();
      }
    } catch (error) {
      console.error('Error stopping preview sound:', error);
    }
  }, []);

  const renderTabContent = () => {
    const monitorOnlyClass = settings.monitorOnlyMode ? 'opacity-55 pointer-events-none select-none' : '';

    switch (activeTab) {
      case 'general':
        return (
          <div className="space-y-6">
            <div className="glass-card p-5 border border-emerald-500/25 bg-emerald-500/8">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Monitor className="w-4 h-4 text-emerald-400" />
                Modo Solo Monitor
              </h3>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm text-white">Activar modo solo monitor</p>
                  <p className="text-xs text-white/40">
                    Desactiva automaticamente alertas, apagado y guardado de historial.
                  </p>
                </div>
                <Toggle
                  checked={settings.monitorOnlyMode}
                  onChange={toggleMonitorOnlyMode}
                />
              </div>
            </div>

            {/* Startup Section */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Play className="w-4 h-4 text-cyan-400" />
                Inicio
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm text-white">Iniciar con Windows</p>
                    <p className="text-xs text-white/40">Disponible en proxima version (autostart nativo).</p>
                  </div>
                  <Toggle 
                    checked={settings.startWithWindows} 
                    onChange={(v) => updateSetting('startWithWindows', v)}
                    disabled
                    />
                </div>
                
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm text-white">Iniciar minimizado</p>
                    <p className="text-xs text-white/40">Abrir en la bandeja del sistema</p>
                  </div>
                  <Toggle 
                    checked={settings.startMinimized} 
                    onChange={(v) => updateSetting('startMinimized', v)} 
                  />
                </div>
              </div>
            </div>

            {/* Polling Section */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                Monitoreo
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm text-white">Notificaciones del sistema</p>
                    <p className="text-xs text-white/40">Mostrar avisos de Windows para eventos del UPS</p>
                  </div>
                  <Toggle
                    checked={settings.enableNotifications}
                    onChange={(v) => updateSetting('enableNotifications', v)}
                    disabled={settings.monitorOnlyMode}
                  />
                </div>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm text-white">Intervalo de consulta</p>
                    <p className="text-xs text-white/40">Frecuencia de actualizacion de datos del UPS</p>
                  </div>
                  <NumberInput
                    value={settings.pollingInterval}
                    onChange={(v) => updateSetting('pollingInterval', v)}
                    min={500}
                    max={10000}
                    suffix="ms"
                  />
                </div>
              </div>
            </div>

            {/* Battery Thresholds */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Battery className="w-4 h-4 text-purple-400" />
                Umbrales de Batería
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm text-white">Batería baja</p>
                    <p className="text-xs text-white/40">Nivel para mostrar advertencia</p>
                  </div>
                  <NumberInput
                    value={settings.lowBatteryThreshold}
                    onChange={(v) => updateSetting('lowBatteryThreshold', v)}
                    min={5}
                    max={50}
                    suffix="%"
                  />
                </div>
                
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm text-white">Batería crítica</p>
                    <p className="text-xs text-white/40">Nivel para acción de emergencia</p>
                  </div>
                  <NumberInput
                    value={settings.criticalBatteryThreshold}
                    onChange={(v) => updateSetting('criticalBatteryThreshold', v)}
                    min={5}
                    max={30}
                    suffix="%"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'alerts':
        return (
          <div className={`space-y-6 ${monitorOnlyClass}`}>
            {/* Explicación */}
            <div className="glass-card p-4 border border-cyan-500/20 bg-cyan-500/5">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-white/70">
                  <p className="mb-2">Configura qué alertas quieres recibir para cada tipo de evento:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs text-white/50">
                    <li><strong className="text-white/70">Sonido:</strong> Reproduce un sonido de alerta</li>
                    <li><strong className="text-white/70">Popup:</strong> Muestra una ventana emergente (incluso sobre juegos)</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Fallo de Energía (AC Fault) */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <ZapOff className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Fallo de Energía Eléctrica</h3>
                  <p className="text-xs text-white/40">Se fue la luz, el UPS está funcionando con batería</p>
                </div>
              </div>
              
              <div className="space-y-3 ml-13">
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-white/70">Reproducir sonido</span>
                  <div className="flex items-center gap-3">
                    <Toggle 
                      checked={settings.alerts.acFault.playSound}
                      onChange={(v) => updateAlert('acFault', 'playSound', v)}
                    />
                    {settings.alerts.acFault.playSound && (
                      <NumberInput
                        value={settings.alerts.acFault.soundRepeats}
                        onChange={(v) => updateAlert('acFault', 'soundRepeats', v)}
                        min={1}
                        max={20}
                        suffix="veces"
                      />
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-white/70">Mostrar popup urgente</span>
                  <Toggle 
                    checked={settings.alerts.acFault.showPopup}
                    onChange={(v) => updateAlert('acFault', 'showPopup', v)}
                  />
                </div>
              </div>
            </div>

            {/* Batería Baja */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <BatteryWarning className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Batería Baja</h3>
                  <p className="text-xs text-white/40">La batería bajó del {settings.lowBatteryThreshold}%</p>
                </div>
              </div>
              
              <div className="space-y-3 ml-13">
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-white/70">Reproducir sonido</span>
                  <div className="flex items-center gap-3">
                    <Toggle 
                      checked={settings.alerts.batteryLow.playSound}
                      onChange={(v) => updateAlert('batteryLow', 'playSound', v)}
                    />
                    {settings.alerts.batteryLow.playSound && (
                      <NumberInput
                        value={settings.alerts.batteryLow.soundRepeats}
                        onChange={(v) => updateAlert('batteryLow', 'soundRepeats', v)}
                        min={1}
                        max={20}
                        suffix="veces"
                      />
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-white/70">Mostrar popup urgente</span>
                  <Toggle 
                    checked={settings.alerts.batteryLow.showPopup}
                    onChange={(v) => updateAlert('batteryLow', 'showPopup', v)}
                  />
                </div>
              </div>
            </div>

            {/* Batería Crítica */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-rose-500/20 flex items-center justify-center">
                  <AlertOctagon className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Batería Crítica</h3>
                  <p className="text-xs text-white/40">La batería bajó del {settings.criticalBatteryThreshold}% - Emergencia</p>
                </div>
              </div>
              
              <div className="space-y-3 ml-13">
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-white/70">Reproducir sonido</span>
                  <div className="flex items-center gap-3">
                    <Toggle 
                      checked={settings.alerts.batteryCritical.playSound}
                      onChange={(v) => updateAlert('batteryCritical', 'playSound', v)}
                    />
                    {settings.alerts.batteryCritical.playSound && (
                      <NumberInput
                        value={settings.alerts.batteryCritical.soundRepeats}
                        onChange={(v) => updateAlert('batteryCritical', 'soundRepeats', v)}
                        min={1}
                        max={30}
                        suffix="veces"
                      />
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-white/70">Mostrar popup urgente</span>
                  <Toggle 
                    checked={settings.alerts.batteryCritical.showPopup}
                    onChange={(v) => updateAlert('batteryCritical', 'showPopup', v)}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'sounds':
        return (
          <div className={`space-y-6 ${monitorOnlyClass}`}>
            <div className="glass-card p-4 border border-cyan-500/20 bg-cyan-500/5">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-white/70">
                  <p className="mb-1">Gestion de sonidos del sistema.</p>
                  <p className="text-xs text-white/50">
                    Puedes usar una carpeta personalizada. Si usas archivos custom, manten estos nombres:
                    <code className="mx-1 text-cyan-300">alert-ac-fault.wav</code>,
                    <code className="mx-1 text-cyan-300">alert-battery-low.wav</code> y
                    <code className="mx-1 text-cyan-300">alert-critical.wav</code>.
                  </p>
                </div>
              </div>
            </div>

            <div className="glass-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-emerald-400" />
                Carpeta de sonidos
              </h3>

              <div className="rounded-lg bg-dark-700/50 border border-white/10 p-3">
                <p className="text-xs text-white/40 mb-1">Ruta actual</p>
                <p className="text-sm text-white break-all">{settings.customSoundsPath ?? 'Predeterminada (assets/sounds)'}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={selectSoundsFolder}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white text-sm transition-colors"
                >
                  <FolderOpen className="w-4 h-4" />
                  Seleccionar carpeta
                </button>
                <button
                  onClick={clearSoundsFolder}
                  disabled={!settings.customSoundsPath}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white text-sm transition-colors"
                >
                  <FolderX className="w-4 h-4" />
                  Limpiar ruta
                </button>
                <button
                  onClick={refreshAvailableSounds}
                  className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
                >
                  Actualizar lista
                </button>
              </div>
            </div>

            <div className="glass-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Music className="w-4 h-4 text-purple-400" />
                  Prueba de sonidos
                </h3>
                {playingSoundType && (
                  <button
                    onClick={stopPreview}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs transition-colors"
                  >
                    <Square className="w-3 h-3" />
                    Detener
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  onClick={() => previewSound('acFault')}
                  className="px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-sm transition-colors"
                >
                  Probar fallo AC
                </button>
                <button
                  onClick={() => previewSound('batteryLow')}
                  className="px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-sm transition-colors"
                >
                  Probar bateria baja
                </button>
                <button
                  onClick={() => previewSound('critical')}
                  className="px-3 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-sm transition-colors"
                >
                  Probar critico
                </button>
              </div>
            </div>

            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Sonidos detectados</h3>
              {loadingSounds ? (
                <p className="text-sm text-white/40">Cargando sonidos...</p>
              ) : availableSounds.length === 0 ? (
                <p className="text-sm text-white/40">No se detectaron archivos .wav o .mp3 en rutas disponibles.</p>
              ) : (
                <div className="space-y-2">
                  {availableSounds.map((sound) => (
                    <div key={sound.path} className="flex items-center justify-between p-3 rounded-lg bg-dark-700/50 border border-white/5">
                      <div>
                        <p className="text-sm text-white">{sound.name}</p>
                        <p className="text-xs text-white/40">{sound.location ?? (sound.custom ? 'Custom' : 'AppData')}</p>
                      </div>
                      <code className="text-xs text-cyan-300 break-all text-right max-w-[60%]">{sound.path}</code>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 'shutdown':
        return (
          <div className={`space-y-6 ${monitorOnlyClass}`}>
            {/* Explicación de Apagado */}
            <div className="glass-card p-4 border border-amber-500/20 bg-amber-500/5">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-white/70">
                  <p className="font-medium text-white mb-1">¿Qué hace cada opción?</p>
                  <ul className="space-y-1 text-xs text-white/50">
                    <li>• <strong className="text-amber-400">Apagar PC:</strong> Guarda archivos y apaga Windows de forma segura</li>
                    <li>• <strong className="text-cyan-400">Apagar UPS:</strong> Corta la energía del UPS (solo después de apagar PC)</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Cuándo apagar el PC */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Power className="w-4 h-4 text-red-400" />
                Cuándo Apagar el PC
              </h3>
              
              <div className="space-y-4">
                {/* Por fallo de AC */}
                <div className="p-4 rounded-lg bg-dark-700/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={settings.shutdownPC.onAcFault.enabled}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          shutdownPC: {
                            ...prev.shutdownPC,
                            onAcFault: { ...prev.shutdownPC.onAcFault, enabled: e.target.checked }
                          }
                        }))}
                        className="w-4 h-4 rounded border-white/20 bg-dark-700 text-cyan-500"
                      />
                      <div>
                        <p className="text-sm text-white">Si se va la luz (fallo AC)</p>
                        <p className="text-xs text-white/40">El UPS está funcionando con batería</p>
                      </div>
                    </div>
                  </div>
                  {settings.shutdownPC.onAcFault.enabled && (
                    <div className="flex items-center justify-between pl-7 pt-2 border-t border-white/5">
                      <span className="text-xs text-white/50">Esperar antes de apagar:</span>
                      <NumberInput
                        value={settings.shutdownPC.onAcFault.delayMinutes}
                        onChange={(v) => setSettings(prev => ({
                          ...prev,
                          shutdownPC: {
                            ...prev.shutdownPC,
                            onAcFault: { ...prev.shutdownPC.onAcFault, delayMinutes: v }
                          }
                        }))}
                        min={1}
                        max={60}
                        suffix="min"
                      />
                    </div>
                  )}
                </div>

                {/* Por batería baja */}
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={settings.shutdownPC.onBatteryLow.enabled}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        shutdownPC: {
                          ...prev.shutdownPC,
                          onBatteryLow: { enabled: e.target.checked }
                        }
                      }))}
                      className="w-4 h-4 rounded border-white/20 bg-dark-700 text-cyan-500"
                    />
                    <div>
                      <p className="text-sm text-white">Si la batería baja del {settings.lowBatteryThreshold}%</p>
                      <p className="text-xs text-white/40">Apagar inmediatamente</p>
                    </div>
                  </div>
                </div>

                {/* Por batería crítica */}
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={settings.shutdownPC.onBatteryCritical.enabled}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        shutdownPC: {
                          ...prev.shutdownPC,
                          onBatteryCritical: { enabled: e.target.checked }
                        }
                      }))}
                      className="w-4 h-4 rounded border-white/20 bg-dark-700 text-cyan-500"
                    />
                    <div>
                      <p className="text-sm text-white">Si la batería baja del {settings.criticalBatteryThreshold}%</p>
                      <p className="text-xs text-red-400/70">Apagar de emergencia (recomendado)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Opciones de apagado */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Save className="w-4 h-4 text-emerald-400" />
                Opciones de Apagado
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm text-white">Guardar archivos automáticamente</p>
                    <p className="text-xs text-white/40">Intenta guardar documentos antes de apagar</p>
                  </div>
                  <Toggle 
                    checked={settings.shutdownPC.autoSaveFiles}
                    onChange={(v) => setSettings(prev => ({
                      ...prev,
                      shutdownPC: { ...prev.shutdownPC, autoSaveFiles: v }
                    }))}
                  />
                </div>

                <div>
                  <p className="text-sm text-white mb-2">Accion principal al finalizar el temporizador</p>
                  <p className="text-xs text-white/40 mb-3">Define si el sistema se apaga o se suspende</p>
                  <select
                    value={settings.shutdownPC.action}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      shutdownPC: {
                        ...prev.shutdownPC,
                        action: (e.target.value === 'sleep' ? 'sleep' : 'shutdown')
                      }
                    }))}
                    className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-white text-sm
                               focus:outline-none focus:border-cyan-500/50"
                  >
                    <option value="shutdown">Apagar el sistema</option>
                    <option value="sleep">Suspender el sistema</option>
                  </select>
                </div>

                <div>
                  <p className="text-sm text-white mb-2">Comando personalizado (opcional)</p>
                  <p className="text-xs text-white/40 mb-3">Script a ejecutar antes del apagado</p>
                  <input
                    type="text"
                    value={settings.shutdownPC.shutdownCommand}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      shutdownPC: { ...prev.shutdownPC, shutdownCommand: e.target.value }
                    }))}
                    placeholder="C:\\ruta\\al\\script.bat"
                    className="w-full px-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-white text-sm
                               placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>
            </div>

            {/* Control del UPS */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                Control del UPS
              </h3>
              <p className="text-xs text-amber-300/80 mb-4">
                Esta funcion depende del firmware del UPS y en esta version se mantiene deshabilitada para evitar configuraciones engañosas.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm text-white">Apagar UPS después de apagar el PC</p>
                    <p className="text-xs text-white/40">Corta la energía del UPS para ahorrar batería</p>
                  </div>
                  <Toggle 
                    checked={settings.upsControl.shutdownUpsAfterPC}
                    onChange={(v) => setSettings(prev => ({
                      ...prev,
                      upsControl: { ...prev.upsControl, shutdownUpsAfterPC: v }
                    }))}
                    disabled
                  />
                </div>

                {settings.upsControl.shutdownUpsAfterPC && (
                  <div className="flex items-center justify-between py-2 pl-4 border-l-2 border-cyan-500/30">
                    <div>
                      <p className="text-sm text-white/70">Esperar antes de apagar UPS</p>
                      <p className="text-xs text-white/40">Tiempo para que el PC se apague completamente</p>
                    </div>
                    <NumberInput
                      value={settings.upsControl.upsShutdownDelay}
                      onChange={(v) => setSettings(prev => ({
                        ...prev,
                        upsControl: { ...prev.upsControl, upsShutdownDelay: v }
                      }))}
                      min={1}
                      max={10}
                      suffix="min"
                      disabled
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'history':
        return (
          <div className={`space-y-6 ${monitorOnlyClass}`}>
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Database className="w-4 h-4 text-purple-400" />
                Datos Históricos
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm text-white">Guardar historial del UPS</p>
                    <p className="text-xs text-white/40">Almacenar datos para análisis posterior</p>
                  </div>
                  <Toggle 
                    checked={settings.saveHistory} 
                    onChange={(v) => updateSetting('saveHistory', v)} 
                  />
                </div>
                
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm text-white">Intervalo de guardado</p>
                    <p className="text-xs text-white/40">Frecuencia de registro de datos</p>
                  </div>
                  <NumberInput
                    value={settings.historyInterval}
                    onChange={(v) => updateSetting('historyInterval', v)}
                    min={60}
                    max={3600}
                    suffix="seg"
                    disabled={!settings.saveHistory}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'about':
        return (
          <div className="space-y-6">
            {/* Device Info */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Plug className="w-4 h-4 text-emerald-400" />
                Dispositivo UPS
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-sm text-white/50">Fabricante</span>
                  <span className="text-sm text-white font-medium">RICHCOMM</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-sm text-white/50">Modelo</span>
                  <span className="text-sm text-white font-medium">UPS USB Mon V2.0</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-sm text-white/50">Capacidad</span>
                  <span className="text-sm text-white font-medium">2000VA / 1200W</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-sm text-white/50">Vendor ID</span>
                  <code className="text-sm font-mono text-cyan-400">0x0925</code>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-sm text-white/50">Product ID</span>
                  <code className="text-sm font-mono text-cyan-400">0x1234</code>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-white/50">Protocolo</span>
                  <span className="text-sm text-purple-400 font-medium">Megatec Q1</span>
                </div>
              </div>
            </div>

            {/* App Info */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Monitor className="w-4 h-4 text-amber-400" />
                Aplicación
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-sm text-white/50">Versión</span>
                  <span className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-semibold">
                    v1.0.1
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-sm text-white/50">Tauri</span>
                  <span className="text-sm text-white">40.1.0</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-sm text-white/50">React</span>
                  <span className="text-sm text-white">19.0.0</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-white/50">TypeScript</span>
                  <span className="text-sm text-white">5.x</span>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-8 py-5 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-cyan-400" />
          <div>
            <h1 className="text-xl font-bold text-white">Configuración</h1>
            <p className="text-white/40 text-xs mt-0.5">Ajustes de la aplicación y el UPS</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={resetSettings}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white/50 
                       hover:text-white hover:bg-white/5 transition-colors text-sm"
          >
            <RotateCcw className="w-4 h-4" />
            Restablecer
          </button>
          <button
            onClick={saveSettings}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                       ${saved 
                         ? 'bg-emerald-500/20 text-emerald-400' 
                         : 'bg-cyan-500 hover:bg-cyan-400 text-white'}`}
          >
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Guardado' : 'Guardar'}
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Tabs */}
        <nav className="w-48 p-4 border-r border-white/5 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                           transition-colors ${activeTab === tab.id
                             ? 'bg-white/10 text-white'
                             : 'text-white/50 hover:text-white hover:bg-white/5'}`}
              >
                <Icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-cyan-400' : ''}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
};






