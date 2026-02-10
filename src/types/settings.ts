export interface AlertConfig {
  playSound: boolean;
  showPopup: boolean;
  soundRepeats: number;
}

export interface AppSettings {
  startWithWindows: boolean;
  startMinimized: boolean;
  monitorOnlyMode: boolean;
  pollingInterval: number;
  enableNotifications: boolean;
  alerts: {
    acFault: AlertConfig;
    batteryLow: AlertConfig;
    batteryCritical: AlertConfig;
  };
  shutdownPC: {
    onAcFault: { enabled: boolean; delayMinutes: number };
    onBatteryLow: { enabled: boolean };
    onBatteryCritical: { enabled: boolean };
    autoSaveFiles: boolean;
    shutdownCommand: string;
    action: 'shutdown' | 'sleep';
  };
  upsControl: {
    shutdownUpsAfterPC: boolean;
    upsShutdownDelay: number;
  };
  saveHistory: boolean;
  historyInterval: number;
  lowBatteryThreshold: number;
  criticalBatteryThreshold: number;
  customSoundsPath: string | null;
}

export const defaultAppSettings: AppSettings = {
  startWithWindows: false,
  startMinimized: false,
  monitorOnlyMode: false,
  pollingInterval: 1000,
  enableNotifications: true,
  alerts: {
    acFault: { playSound: true, showPopup: true, soundRepeats: 3 },
    batteryLow: { playSound: true, showPopup: true, soundRepeats: 5 },
    batteryCritical: { playSound: true, showPopup: true, soundRepeats: 10 },
  },
  shutdownPC: {
    onAcFault: { enabled: true, delayMinutes: 18 },
    onBatteryLow: { enabled: false },
    onBatteryCritical: { enabled: true },
    autoSaveFiles: true,
    shutdownCommand: '',
    action: 'shutdown',
  },
  upsControl: {
    shutdownUpsAfterPC: true,
    upsShutdownDelay: 2,
  },
  saveHistory: true,
  historyInterval: 300,
  lowBatteryThreshold: 20,
  criticalBatteryThreshold: 10,
  customSoundsPath: null,
};
