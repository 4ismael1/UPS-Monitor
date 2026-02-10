import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open } from '@tauri-apps/plugin-dialog';
import type { DesktopAPI, EventFilter, SoundConfig, UrgentAlertPayload } from '../types/desktop';
import type { AppSettings } from '../types/settings';

type UnlistenEntry = {
  channel: string;
  fn: UnlistenFn;
};

const channelListeners = new Map<string, Set<UnlistenFn>>();

function registerUnlisten(channel: string, fn: UnlistenFn) {
  if (!channelListeners.has(channel)) {
    channelListeners.set(channel, new Set());
  }
  channelListeners.get(channel)?.add(fn);
}

function removeRegisteredUnlisten(channel: string, fn: UnlistenFn) {
  const set = channelListeners.get(channel);
  if (!set) return;
  set.delete(fn);
  if (set.size === 0) {
    channelListeners.delete(channel);
  }
}

function removeAllListeners(channel: string) {
  const set = channelListeners.get(channel);
  if (!set) return;
  for (const fn of set) {
    try {
      fn();
    } catch {
      // Ignore listener cleanup errors.
    }
  }
  channelListeners.delete(channel);
}

async function invokeSafe<T>(command: string, args?: Record<string, unknown>, fallback?: T): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    if (typeof fallback !== 'undefined') {
      return fallback;
    }
    throw error;
  }
}

function onEvent<T = void>(channel: string, callback: (payload: T) => void): () => void {
  let entry: UnlistenEntry | null = null;
  let disposed = false;

  void listen<T>(channel, (event) => {
    callback(event.payload);
  }).then((unlisten) => {
    if (disposed) {
      unlisten();
      return;
    }
    entry = { channel, fn: unlisten };
    registerUnlisten(channel, unlisten);
  }).catch((error) => {
    console.error(`Failed to subscribe to channel "${channel}":`, error);
  });

  return () => {
    disposed = true;
    if (!entry) return;
    entry.fn();
    removeRegisteredUnlisten(entry.channel, entry.fn);
    entry = null;
  };
}

async function withCurrentWindow(action: (windowRef: ReturnType<typeof getCurrentWindow>) => Promise<void>) {
  try {
    const windowRef = getCurrentWindow();
    await action(windowRef);
  } catch (error) {
    console.error('Window operation failed:', error);
  }
}

const tauriDesktopBridge: DesktopAPI = {
  getSettings: () => invokeSafe<AppSettings>('get_settings'),
  saveSettings: (settings) => invokeSafe<boolean>('save_settings', { newSettings: settings }, false),

  getUPSStatus: () => invokeSafe('get_ups_status', undefined, null),
  getUPSInfo: () => invokeSafe('get_ups_info', undefined, null),

  cancelShutdown: () => invokeSafe<boolean>('cancel_shutdown', undefined, false),
  triggerShutdown: (minutes) => invokeSafe<boolean>('trigger_shutdown', { minutes }, false),
  simulateShutdownFlow: (minutes = 5, autoCancelMs = 1200) =>
    invokeSafe('simulate_shutdown_flow', { minutes, autoCancelMs }),
  getBatteryTime: () => invokeSafe<number | null>('get_battery_time', undefined, null),

  testNotification: () => invokeSafe<boolean>('test_notification', undefined, true),
  mainWindowReady: () => invokeSafe<boolean>('main_window_ready', undefined, false),

  minimizeWindow: async () => {
    const ok = await invokeSafe<boolean>('minimize_main_window', undefined, false);
    if (!ok) {
      await withCurrentWindow(async (windowRef) => {
        await windowRef.setSkipTaskbar(true);
        await windowRef.hide();
      });
    }
  },
  maximizeWindow: async () => {
    const ok = await invokeSafe<boolean>('toggle_maximize_main_window', undefined, false);
    if (!ok) {
      await withCurrentWindow((windowRef) => windowRef.toggleMaximize());
    }
  },
  closeWindow: async () => {
    const ok = await invokeSafe<boolean>('close_main_window', undefined, false);
    if (!ok) {
      await withCurrentWindow((windowRef) => windowRef.close());
    }
  },

  selectFile: async () => {
    const result = await open({
      directory: true,
      multiple: false,
      title: 'Seleccionar carpeta de sonidos',
    });

    if (Array.isArray(result)) {
      return result[0] ?? null;
    }

    return result ?? null;
  },

  getEvents: (filter?: EventFilter) => invokeSafe('get_events', { filter }, []),
  deleteEvents: (ids) => invokeSafe('delete_events', { ids }, []),
  getDataHistory: (filter?: EventFilter) => invokeSafe('get_data_history', { filter }, []),
  deleteDataHistory: (ids) => invokeSafe('delete_data_history', { ids }, []),
  updateHistoryInterval: (seconds) => invokeSafe<boolean>('update_history_interval', { seconds }, true),

  playSound: (type, repeats) => invokeSafe<boolean>('play_sound', { soundType: type, repeats }, true),
  stopSound: () => invokeSafe<boolean>('stop_sound', undefined, true),
  testUrgentAlert: (title, message, type) =>
    invokeSafe<boolean>('test_urgent_alert', { title, message, alertType: type }, true),
  getAvailableSounds: () => invokeSafe('get_available_sounds', undefined, []),
  getSoundConfig: () => invokeSafe<SoundConfig | null>('get_sound_config', undefined, null),
  setSoundConfig: (config) => invokeSafe<boolean>('set_sound_config', { config }, true),
  setCustomSoundsPath: (path) => invokeSafe<boolean>('set_custom_sounds_path', { soundPath: path }, true),

  onUPSData: (callback) => onEvent('ups-data', callback),
  onUPSConnected: (callback) => onEvent('ups-connected', callback),
  onUPSDisconnected: (callback) => onEvent('ups-disconnected', callback),
  onUPSError: (callback) => onEvent<string>('ups-error', callback),
  onShutdownScheduled: (callback) => onEvent('shutdown-scheduled', callback),
  onShutdownCancelled: (callback) => onEvent('shutdown-cancelled', callback),
  onShowStatus: (callback) => onEvent('show-status', callback),
  onUrgentAlert: (callback) => onEvent<UrgentAlertPayload>('urgent-alert', callback),

  removeAllListeners,
};

window.desktopAPI = tauriDesktopBridge;

export default tauriDesktopBridge;


