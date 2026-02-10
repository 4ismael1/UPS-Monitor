// Datos del UPS que vienen del backend
export interface UPSData {
  type: string;
  inputVoltage: number;
  faultVoltage: number;
  outputVoltage: number;
  loadPercent: number;
  frequency: number;
  batteryVoltage: number;
  temperature: number;
  batteryPercent: number;
  estimatedRuntime: number;
  timestamp: string;
  status: {
    raw: string;
    utilityFail: boolean;
    batteryLow: boolean;
    bypassActive: boolean;
    upsFailed: boolean;
    upsIsStandby: boolean;
    testInProgress: boolean;
    shutdownActive: boolean;
    beeperOn: boolean;
  };
}

export interface UPSState {
  connected: boolean;
  data: UPSData | null;
  error: string | null;
  loading: boolean;
}

export type PowerMode = 'online' | 'battery' | 'offline';

export type TabId = 'dashboard' | 'curve' | 'details' | 'history' | 'test' | 'settings';

export interface NavItem {
  id: TabId;
  label: string;
  icon: string;
}
