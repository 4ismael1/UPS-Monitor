import React, { Suspense, lazy, useState, useEffect, useCallback, useRef } from 'react';
import { UPSData, TabId, PowerMode } from './types/ups';
import { Sidebar } from './components/Sidebar';
import { AlertTriangle, Minus, X } from 'lucide-react';
import { ViewErrorBoundary } from './components/ViewErrorBoundary';
import type { DesktopAPI, UrgentAlertPayload } from './types/desktop';
import './styles/global.css';

const Dashboard = lazy(() => import('./components/Dashboard').then((m) => ({ default: m.Dashboard })));
const CurveView = lazy(() => import('./components/CurveView').then((m) => ({ default: m.CurveView })));
const DetailsView = lazy(() => import('./components/DetailsView').then((m) => ({ default: m.DetailsView })));
const HistoryView = lazy(() => import('./components/HistoryView').then((m) => ({ default: m.HistoryView })));
const TestView = lazy(() => import('./components/TestView').then((m) => ({ default: m.TestView })));
const SettingsView = lazy(() => import('./components/SettingsView').then((m) => ({ default: m.SettingsView })));

export interface CurveDataPoint {
  time: string;
  timestamp: number;
  inputVoltage: number;
  outputVoltage: number;
  batteryPercent: number;
  loadPercent: number;
}

const MAX_CURVE_POINTS = 120;
const MAX_DASHBOARD_POINTS = 60;

interface DashboardVoltagePoint {
  time: string;
  timestamp: number;
  input: number;
  output: number;
}

interface ActiveUrgentAlert extends UrgentAlertPayload {
  id: string;
}

const emptyUPSData: UPSData = {
  type: 'STATUS',
  inputVoltage: 0,
  faultVoltage: 0,
  outputVoltage: 0,
  frequency: 0,
  loadPercent: 0,
  batteryVoltage: 0,
  batteryPercent: 0,
  estimatedRuntime: 0,
  temperature: 0,
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
  timestamp: new Date().toISOString(),
};

const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<TabId>('dashboard');
  const [upsData, setUpsData] = useState<UPSData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [urgentAlerts, setUrgentAlerts] = useState<ActiveUrgentAlert[]>([]);

  const [curveHistory, setCurveHistory] = useState<CurveDataPoint[]>([]);
  const [dashboardHistory, setDashboardHistory] = useState<DashboardVoltagePoint[]>([]);
  const [curvePaused, setCurvePaused] = useState(false);
  const lastCurveTimestamp = useRef<string>('');
  const lastDashboardTimestamp = useRef<string>('');

  const getPowerMode = useCallback((): PowerMode => {
    if (!isConnected) return 'offline';
    if (upsData?.status?.utilityFail) return 'battery';
    return 'online';
  }, [isConnected, upsData]);

  useEffect(() => {
    if (!upsData || curvePaused) return;
    if (upsData.timestamp === lastCurveTimestamp.current) return;

    lastCurveTimestamp.current = upsData.timestamp;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    setCurveHistory((prev) => {
      const newPoint: CurveDataPoint = {
        time: timeStr,
        timestamp: now.getTime(),
        inputVoltage: upsData.inputVoltage || 0,
        outputVoltage: upsData.outputVoltage || 0,
        batteryPercent: upsData.batteryPercent || 0,
        loadPercent: upsData.loadPercent || 0,
      };

      return [...prev, newPoint].slice(-MAX_CURVE_POINTS);
    });
  }, [upsData?.timestamp, curvePaused, upsData]);

  useEffect(() => {
    if (!upsData) return;
    if (upsData.timestamp === lastDashboardTimestamp.current) return;

    lastDashboardTimestamp.current = upsData.timestamp;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    setDashboardHistory((prev) => {
      const nextPoint: DashboardVoltagePoint = {
        time: timeStr,
        timestamp: now.getTime(),
        input: upsData.inputVoltage || 0,
        output: upsData.outputVoltage || 0,
      };
      return [...prev, nextPoint].slice(-MAX_DASHBOARD_POINTS);
    });
  }, [upsData?.timestamp, upsData]);

  useEffect(() => {
    const desktopAPI = window.desktopAPI as DesktopAPI | undefined;
    if (!desktopAPI) {
      setError('Esta aplicacion debe ejecutarse en Tauri');
      setLoading(false);
      return;
    }

    void desktopAPI.mainWindowReady?.();

    const unsubscribers: Array<() => void> = [];

    unsubscribers.push(desktopAPI.onUPSData((data) => {
      setUpsData(data);
      setIsConnected(true);
      setError(null);
      setLoading(false);
    }));

    unsubscribers.push(desktopAPI.onUPSConnected(() => {
      setIsConnected(true);
      setError(null);
      setLoading(false);
    }));

    unsubscribers.push(desktopAPI.onUPSError((errorMsg) => {
      setError(errorMsg);
      setLoading(false);
    }));

    unsubscribers.push(desktopAPI.onUPSDisconnected(() => {
      setIsConnected(false);
      setUpsData(null);
      setError('UPS desconectado');
      setLoading(false);
    }));

    unsubscribers.push(desktopAPI.onShowStatus(() => {
      setCurrentTab('dashboard');
    }));

    unsubscribers.push(
      desktopAPI.onUrgentAlert((payload) => {
        const alertId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const safePayload: ActiveUrgentAlert = {
          id: alertId,
          title: payload?.title || 'Alerta UPS',
          message: payload?.message || 'Se detecto un evento del UPS.',
          alertType: payload?.alertType || 'warning',
          createdAt: payload?.createdAt || new Date().toISOString(),
        };

        setUrgentAlerts((prev) => [safePayload, ...prev].slice(0, 3));
        window.setTimeout(() => {
          setUrgentAlerts((prev) => prev.filter((item) => item.id !== alertId));
        }, 8000);
      }),
    );

    const loadingFailsafeTimer = window.setTimeout(() => {
      setLoading(false);
    }, 650);

    const fetchInitialData = async () => {
      try {
        const status = await desktopAPI.getUPSStatus();
        if (status) {
          setUpsData(status);
          setIsConnected(true);
          setError(null);
        } else {
          setIsConnected(false);
          setUpsData(null);
          setError('UPS desconectado');
        }
      } catch {
        setIsConnected(false);
        setUpsData(null);
        setError('UPS desconectado');
      } finally {
        setLoading(false);
      }
    };

    void fetchInitialData();

    return () => {
      window.clearTimeout(loadingFailsafeTimer);
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  const renderLazyFallback = () => (
    <div className="flex-1 flex flex-col items-center justify-center gap-4">
      <div className="relative">
        <div className="w-12 h-12 border-4 border-dark-500 rounded-full" />
        <div className="absolute inset-0 w-12 h-12 border-4 border-accent-cyan border-t-transparent rounded-full animate-spin" />
      </div>
      <p className="text-white/60 text-sm">Cargando vista...</p>
    </div>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-dark-500 rounded-full" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-accent-cyan border-t-transparent rounded-full animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-white/80 font-medium">Conectando con el UPS</p>
            <p className="text-white/40 text-sm mt-1">Buscando dispositivo...</p>
          </div>
        </div>
      );
    }

    const displayData = upsData || emptyUPSData;

    let content: React.ReactNode;
    switch (currentTab) {
      case 'dashboard':
        content = (
          <Dashboard
            data={displayData}
            isDisconnected={!isConnected}
            voltageHistory={dashboardHistory}
          />
        );
        break;
      case 'curve':
        content = (
          <CurveView
            data={displayData}
            history={curveHistory}
            isPaused={curvePaused || !isConnected}
            onPauseChange={setCurvePaused}
            onClear={() => setCurveHistory([])}
          />
        );
        break;
      case 'details':
        content = <DetailsView data={displayData} isDisconnected={!isConnected} />;
        break;
      case 'history':
        content = <HistoryView />;
        break;
      case 'test':
        content = <TestView data={displayData} isDisconnected={!isConnected} />;
        break;
      case 'settings':
        content = <SettingsView />;
        break;
      default:
        content = (
          <Dashboard
            data={displayData}
            isDisconnected={!isConnected}
            voltageHistory={dashboardHistory}
          />
        );
        break;
    }

    return (
      <ViewErrorBoundary onRecover={() => setCurrentTab('dashboard')}>
        <Suspense fallback={renderLazyFallback()}>{content}</Suspense>
      </ViewErrorBoundary>
    );
  };

  return (
    <div className="app-window h-screen w-screen text-white overflow-hidden">
      <div className="app-frame flex h-full flex-col overflow-hidden">
        <div
          className="titlebar h-9 flex items-center justify-center px-3 select-none"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <span className="titlebar-label">UPS Monitor</span>
          <div className="win-controls" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <button
              onClick={() => window.desktopAPI?.minimizeWindow?.()}
              className="win-btn"
              aria-label="Minimizar"
            >
              <Minus className="h-3 w-3" />
            </button>
            <button
              onClick={() => window.desktopAPI?.closeWindow?.()}
              className="win-btn win-btn-close"
              aria-label="Cerrar"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>

        {error && (
          <div className="px-4 py-2 text-xs bg-amber-500/15 text-amber-300 border-b border-amber-500/25">
            {error}
          </div>
        )}

        {urgentAlerts.length > 0 && (
          <div className="pointer-events-none absolute right-4 top-12 z-50 flex max-w-md flex-col gap-2">
            {urgentAlerts.map((alert) => {
              const isCritical = alert.alertType === 'critical';
              const isBattery = alert.alertType === 'battery';
              const borderClass = isCritical
                ? 'border-red-400/45 bg-red-500/12'
                : isBattery
                  ? 'border-amber-400/45 bg-amber-500/12'
                  : 'border-cyan-400/45 bg-cyan-500/12';
              return (
                <div
                  key={alert.id}
                  className={`rounded-xl border px-4 py-3 shadow-xl backdrop-blur-sm ${borderClass}`}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-white/90" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white">{alert.title}</p>
                      <p className="mt-1 text-xs text-white/80">{alert.message}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            currentTab={currentTab}
            onTabChange={setCurrentTab}
            isConnected={isConnected}
            powerMode={getPowerMode()}
          />
          <main className="main-surface flex-1 flex flex-col overflow-hidden">
            {renderContent()}
          </main>
        </div>
      </div>
    </div>
  );
};

export default App;
