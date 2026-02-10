import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsView } from '../src/components/SettingsView';
import { defaultAppSettings } from '../src/types/settings';

describe('SettingsView', () => {
  it('persists shutdown action selected by user', async () => {
    const saveSettings = vi.fn().mockResolvedValue(true);
    const updateHistoryInterval = vi.fn().mockResolvedValue(true);

    (window as any).desktopAPI = {
      getSettings: vi.fn().mockResolvedValue(defaultAppSettings),
      saveSettings,
      updateHistoryInterval,
    };

    render(<SettingsView />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /configur/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Apagado' }));
    const actionSelect = screen.getByRole('combobox');
    await userEvent.selectOptions(actionSelect, 'sleep');

    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(saveSettings).toHaveBeenCalledTimes(1);
    });

    const savedPayload = saveSettings.mock.calls[0][0];
    expect(savedPayload.shutdownPC.action).toBe('sleep');
    expect(updateHistoryInterval).toHaveBeenCalledWith(defaultAppSettings.historyInterval);
  });

  it('configures custom sounds path from sounds tab', async () => {
    const saveSettings = vi.fn().mockResolvedValue(true);
    const updateHistoryInterval = vi.fn().mockResolvedValue(true);
    const setCustomSoundsPath = vi.fn().mockResolvedValue(true);
    const getAvailableSounds = vi.fn().mockResolvedValue([]);
    const selectFile = vi.fn().mockResolvedValue('C:\\Sounds\\UPS');

    (window as any).desktopAPI = {
      getSettings: vi.fn().mockResolvedValue(defaultAppSettings),
      saveSettings,
      updateHistoryInterval,
      setCustomSoundsPath,
      getAvailableSounds,
      selectFile,
      playSound: vi.fn().mockResolvedValue(true),
      stopSound: vi.fn().mockResolvedValue(true),
    };

    render(<SettingsView />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /configur/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Sonidos' }));
    await userEvent.click(screen.getByRole('button', { name: /seleccionar carpeta/i }));

    await waitFor(() => {
      expect(setCustomSoundsPath).toHaveBeenCalledWith('C:\\Sounds\\UPS');
    });

    expect(screen.getByText('C:\\Sounds\\UPS')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(saveSettings).toHaveBeenCalledTimes(1);
    });

    const savedPayload = saveSettings.mock.calls[0][0];
    expect(savedPayload.customSoundsPath).toBe('C:\\Sounds\\UPS');
    expect(getAvailableSounds).toHaveBeenCalled();
  });

  it('enables monitor-only mode and applies automatic safe preset', async () => {
    const saveSettings = vi.fn().mockResolvedValue(true);
    const updateHistoryInterval = vi.fn().mockResolvedValue(true);

    (window as any).desktopAPI = {
      getSettings: vi.fn().mockResolvedValue(defaultAppSettings),
      saveSettings,
      updateHistoryInterval,
    };

    render(<SettingsView />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /configur/i })).toBeInTheDocument();
    });

    const monitorCard = screen.getAllByText(/modo solo monitor/i)[0].closest('.glass-card') as HTMLElement;
    const monitorToggle = within(monitorCard).getByRole('button');
    await userEvent.click(monitorToggle);

    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(saveSettings).toHaveBeenCalledTimes(1);
    });

    const savedPayload = saveSettings.mock.calls[0][0];
    expect(savedPayload.monitorOnlyMode).toBe(true);
    expect(savedPayload.enableNotifications).toBe(false);
    expect(savedPayload.saveHistory).toBe(false);
    expect(savedPayload.shutdownPC.onAcFault.enabled).toBe(false);
    expect(savedPayload.shutdownPC.onBatteryLow.enabled).toBe(false);
    expect(savedPayload.shutdownPC.onBatteryCritical.enabled).toBe(false);
    expect(savedPayload.alerts.acFault.playSound).toBe(false);
    expect(savedPayload.alerts.batteryLow.showPopup).toBe(false);
    expect(savedPayload.alerts.batteryCritical.playSound).toBe(false);
  });
});


