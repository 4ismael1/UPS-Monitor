import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestView } from '../src/components/TestView';
import { UPSData } from '../src/types/ups';

const sampleUPSData: UPSData = {
  type: 'STATUS',
  inputVoltage: 120,
  faultVoltage: 0,
  outputVoltage: 120,
  loadPercent: 25,
  frequency: 60,
  batteryVoltage: 13.2,
  temperature: 30,
  batteryPercent: 88,
  estimatedRuntime: 42,
  timestamp: new Date().toISOString(),
  status: {
    raw: '00000000',
    utilityFail: false,
    batteryLow: false,
    bypassActive: false,
    upsFailed: false,
    upsIsStandby: false,
    testInProgress: false,
    shutdownActive: false,
    beeperOn: false,
  },
};

describe('TestView', () => {
  it('runs simulated shutdown flow through backend IPC', async () => {
    const simulateShutdownFlow = vi.fn().mockResolvedValue({
      scheduled: true,
      cancelled: true,
      minutes: 5,
      shutdownTime: new Date().toISOString(),
    });

    (window as any).desktopAPI = {
      getSettings: vi.fn().mockResolvedValue({
        alerts: {
          acFault: { playSound: true, showPopup: true, soundRepeats: 3 },
        },
        shutdownPC: { action: 'shutdown' },
        criticalBatteryThreshold: 10,
        customSoundsPath: null,
      }),
      onShutdownScheduled: vi.fn().mockImplementation(() => () => {}),
      onShutdownCancelled: vi.fn().mockImplementation(() => () => {}),
      simulateShutdownFlow,
      testNotification: vi.fn().mockResolvedValue(true),
      getAvailableSounds: vi.fn().mockResolvedValue([]),
      playSound: vi.fn().mockResolvedValue(true),
      stopSound: vi.fn().mockResolvedValue(true),
      testUrgentAlert: vi.fn().mockResolvedValue(true),
    };

    render(<TestView data={sampleUPSData} />);

    const flowLabel = await screen.findByText(/flujo de apagado simulado/i);
    const flowRow = flowLabel.closest('div')?.parentElement?.parentElement;
    expect(flowRow).toBeTruthy();
    await userEvent.click(within(flowRow as HTMLElement).getByRole('button', { name: /ejecutar/i }));

    await waitFor(() => {
      expect(simulateShutdownFlow).toHaveBeenCalledWith(5, 1200);
    });

    expect(screen.getByText(/simulado para 5 min/i)).toBeInTheDocument();
  });

  it('does not crash when settings payload is partial', async () => {
    (window as any).desktopAPI = {
      getSettings: vi.fn().mockResolvedValue({
        criticalBatteryThreshold: 12,
      }),
      onShutdownScheduled: vi.fn().mockImplementation(() => () => {}),
      onShutdownCancelled: vi.fn().mockImplementation(() => () => {}),
      simulateShutdownFlow: vi.fn().mockResolvedValue({
        scheduled: true,
        cancelled: true,
        minutes: 5,
        shutdownTime: new Date().toISOString(),
      }),
      testNotification: vi.fn().mockResolvedValue(true),
      getAvailableSounds: vi.fn().mockResolvedValue([]),
      playSound: vi.fn().mockResolvedValue(true),
      stopSound: vi.fn().mockResolvedValue(true),
      testUrgentAlert: vi.fn().mockResolvedValue(true),
    };

    render(<TestView data={sampleUPSData} />);

    expect(await screen.findByText(/panel de pruebas/i)).toBeInTheDocument();
    expect(await screen.findByText(/accion n\/a/i)).toBeInTheDocument();
  });
});


