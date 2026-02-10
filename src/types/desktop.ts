import type { UPSData } from './ups';
import type { AppSettings } from './settings';

export interface SoundConfig {
  repeatConfig: {
    acFault: number;
    batteryLow: number;
    critical: number;
    default: number;
  };
  repeatDelay: number;
  customSoundsPath: string | null;
  sounds: {
    acFault: string;
    batteryLow: string;
    critical: string;
  };
}

export interface SoundInfo {
  name: string;
  path: string;
  custom: boolean;
  location?: string;
}

export interface EventFilter {
  classification?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface HistoryEvent {
  id: number;
  time: string;
  classification: string;
  name: string;
  remarks: string;
}

export interface DataHistoryEntry {
  id: number;
  time: string;
  inputVoltage: number;
  outputVoltage: number;
  frequency: number;
  loadPercent: number;
  batteryVoltage: number;
  batteryPercent: number;
  temperature: number;
}

export interface ShutdownSimulationResult {
  scheduled: boolean;
  cancelled: boolean;
  minutes: number;
  shutdownTime: string;
}

export interface UrgentAlertPayload {
  title: string;
  message: string;
  alertType: string;
  createdAt: string;
}

export interface DesktopAPI {
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<boolean>;

  getUPSStatus: () => Promise<UPSData | null>;
  getUPSInfo: () => Promise<Record<string, unknown> | null>;

  cancelShutdown: () => Promise<boolean>;
  triggerShutdown: (minutes: number) => Promise<boolean>;
  simulateShutdownFlow: (minutes?: number, autoCancelMs?: number) => Promise<ShutdownSimulationResult>;
  getBatteryTime: () => Promise<number | null>;

  testNotification: () => Promise<boolean>;
  mainWindowReady: () => Promise<boolean>;

  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;

  selectFile: () => Promise<string | null>;

  getEvents: (filter?: EventFilter) => Promise<HistoryEvent[]>;
  deleteEvents: (ids: number[]) => Promise<HistoryEvent[]>;
  getDataHistory: (filter?: EventFilter) => Promise<DataHistoryEntry[]>;
  deleteDataHistory: (ids: number[]) => Promise<DataHistoryEntry[]>;
  updateHistoryInterval: (seconds: number) => Promise<boolean>;

  playSound: (type: string, repeats?: number) => Promise<boolean>;
  stopSound: () => Promise<boolean>;
  testUrgentAlert: (title: string, message: string, type: string) => Promise<boolean>;
  getAvailableSounds: () => Promise<SoundInfo[]>;
  getSoundConfig: () => Promise<SoundConfig | null>;
  setSoundConfig: (config: Partial<SoundConfig>) => Promise<boolean>;
  setCustomSoundsPath: (path: string | null) => Promise<boolean>;

  onUPSData: (callback: (data: UPSData) => void) => () => void;
  onUPSConnected: (callback: () => void) => () => void;
  onUPSDisconnected: (callback: () => void) => () => void;
  onUPSError: (callback: (error: string) => void) => () => void;
  onShutdownScheduled: (callback: (data: { minutes: number; shutdownTime: string }) => void) => () => void;
  onShutdownCancelled: (callback: () => void) => () => void;
  onShowStatus: (callback: () => void) => () => void;
  onUrgentAlert: (callback: (payload: UrgentAlertPayload) => void) => () => void;

  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    desktopAPI?: DesktopAPI;
  }
}

export {};


