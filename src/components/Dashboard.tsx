import React from 'react';
import { Zap, BatteryCharging, TrendingDown, Gauge, Plug, Activity, Thermometer, Battery, WifiOff } from 'lucide-react';
import { UPSData } from '../types/ups';
import { VoltageChart } from './VoltageChart';

interface DashboardProps {
  data: UPSData;
  isDisconnected?: boolean;
  voltageHistory: Array<{
    time: string;
    timestamp: number;
    input: number;
    output: number;
  }>;
}

// Especificaciones del UPS
const UPS_VA = 2000;
const UPS_WATTS = 1200;

export const Dashboard: React.FC<DashboardProps> = ({
  data,
  isDisconnected = false,
  voltageHistory,
}) => {
  const isOnBattery = data.status?.utilityFail || false;
  const loadPercent = data.loadPercent || 0;
  
  // Cálculos de potencia
  const consumptionWatts = Math.round((loadPercent / 100) * UPS_WATTS);
  const consumptionVA = Math.round((loadPercent / 100) * UPS_VA);
  const availableWatts = UPS_WATTS - consumptionWatts;
  
  // Cálculos de voltaje
  const inputVoltage = data.inputVoltage || 0;
  const outputVoltage = data.outputVoltage || 0;

  // Clase para elementos deshabilitados
  const disabledClass = isDisconnected ? 'opacity-40 pointer-events-none' : '';
  
  return (
    <div className={`flex-1 flex flex-col overflow-hidden ${disabledClass}`}>
      {/* Header */}
      <header className="px-8 py-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-white/40 text-sm mt-1">UPS {UPS_VA}VA / {UPS_WATTS}W</p>
          </div>
          <div className={`
            px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2
            ${isDisconnected
              ? 'bg-gray-500/15 text-gray-400 border border-gray-500/20'
              : isOnBattery 
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' 
                : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
            }
          `}>
            {isDisconnected ? (
              <WifiOff className="w-4 h-4" />
            ) : isOnBattery ? (
              <BatteryCharging className="w-4 h-4" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            {isDisconnected ? 'Desconectado' : isOnBattery ? 'Modo Batería' : 'Red Eléctrica'}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
          
          {/* FILA 1: Entrada, Salida, Carga - 3 columnas iguales */}
          <div className="grid grid-cols-3 gap-4">
            {/* Voltaje Entrada */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/15 flex items-center justify-center">
                    <TrendingDown className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-white/50 text-sm">Entrada AC</p>
                    <p className="text-xs text-white/30">Línea eléctrica</p>
                  </div>
                </div>
                <div className={`px-2 py-1 rounded-lg text-xs font-medium ${
                  inputVoltage > 100 && inputVoltage < 140
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-red-500/15 text-red-400'
                }`}>
                  {inputVoltage > 100 && inputVoltage < 140 ? 'Normal' : 'Alerta'}
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold text-white tabular-nums">
                  {inputVoltage.toFixed(1)}
                </span>
                <span className="text-xl text-white/40">V</span>
              </div>
              <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-white/30">Nominal</p>
                  <p className="text-sm text-white/70">120V</p>
                </div>
                <div>
                  <p className="text-xs text-white/30">Frecuencia</p>
                  <p className="text-sm text-white/70">{(data.frequency || 0).toFixed(1)} Hz</p>
                </div>
              </div>
            </div>

            {/* Voltaje Salida */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                    <Plug className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-white/50 text-sm">Salida AC</p>
                    <p className="text-xs text-white/30">A equipos</p>
                  </div>
                </div>
                <div className="px-2 py-1 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400">
                  Estable
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold text-white tabular-nums">
                  {outputVoltage.toFixed(1)}
                </span>
                <span className="text-xl text-white/40">V</span>
              </div>
              <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-white/30">Regulación</p>
                  <p className="text-sm text-white/70">{inputVoltage > 0 ? (((inputVoltage - outputVoltage) / inputVoltage) * 100).toFixed(1) : 0}%</p>
                </div>
                <div>
                  <p className="text-xs text-white/30">Diferencia</p>
                  <p className="text-sm text-white/70">{(inputVoltage - outputVoltage).toFixed(1)}V</p>
                </div>
              </div>
            </div>

            {/* Consumo en Watts */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    loadPercent > 80 ? 'bg-red-500/15' :
                    loadPercent > 50 ? 'bg-amber-500/15' :
                    'bg-purple-500/15'
                  }`}>
                    <Gauge className={`w-6 h-6 ${
                      loadPercent > 80 ? 'text-red-400' :
                      loadPercent > 50 ? 'text-amber-400' :
                      'text-purple-400'
                    }`} />
                  </div>
                  <div>
                    <p className="text-white/50 text-sm">Consumo</p>
                    <p className="text-xs text-white/30">{loadPercent}% de carga</p>
                  </div>
                </div>
                <div className={`px-2 py-1 rounded-lg text-xs font-medium ${
                  loadPercent > 80 ? 'bg-red-500/15 text-red-400' :
                  loadPercent > 50 ? 'bg-amber-500/15 text-amber-400' :
                  'bg-emerald-500/15 text-emerald-400'
                }`}>
                  {loadPercent > 80 ? 'Alta' : loadPercent > 50 ? 'Media' : 'Normal'}
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold text-white tabular-nums">
                  {consumptionWatts}
                </span>
                <span className="text-xl text-white/40">W</span>
              </div>
              <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-white/30">Capacidad</p>
                  <p className="text-sm text-white/70">{UPS_WATTS} W</p>
                </div>
                <div>
                  <p className="text-xs text-white/30">Disponible</p>
                  <p className="text-sm text-emerald-400">{availableWatts} W</p>
                </div>
              </div>
            </div>
          </div>

          {/* FILA 2: Gráfico completo */}
          <VoltageChart data={data} history={voltageHistory} />

          {/* FILA 3: Batería compacta + Info adicional + Estado */}
          <div className="grid grid-cols-12 gap-4 items-stretch">
            
            {/* Batería - Compacta horizontal */}
            <div className="col-span-5 glass-card p-5 h-full">
              <div className="flex items-center gap-6">
                {/* Gauge pequeño */}
                <div className="relative w-28 h-28 flex-shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      className="text-dark-600"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 42}
                      strokeDashoffset={2 * Math.PI * 42 * (1 - (data.batteryPercent || 0) / 100)}
                      style={{
                        stroke: (data.batteryPercent || 0) >= 60 ? '#10b981' : (data.batteryPercent || 0) >= 30 ? '#f59e0b' : '#ef4444'
                      }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-white">{data.batteryPercent || 0}</span>
                    <span className="text-xs text-white/50">%</span>
                  </div>
                </div>

                {/* Info batería */}
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-lg font-semibold text-white">Batería</p>
                    <p className="text-xs text-white/40">{!isOnBattery ? 'Cargando' : 'Descargando'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-white/30">Voltaje</p>
                      <p className="text-sm font-medium text-white">{(data.batteryVoltage || 0).toFixed(2)} V</p>
                    </div>
                    <div>
                      <p className="text-xs text-white/30">Autonomía</p>
                      <p className="text-sm font-medium text-emerald-400">{data.estimatedRuntime || 0} min</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Métricas en fila */}
            <div className="col-span-4 grid grid-cols-2 gap-3 auto-rows-fr">
              <div className="glass-card p-4 flex items-center gap-3 min-h-[96px]">
                <div className="w-10 h-10 rounded-lg bg-purple-500/15 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-white/40">Frecuencia</p>
                  <p className="text-lg font-semibold text-white">{(data.frequency || 0).toFixed(1)} <span className="text-xs text-white/40">Hz</span></p>
                </div>
              </div>
              
              <div className="glass-card p-4 flex items-center gap-3 min-h-[96px]">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${(data.temperature || 0) > 40 ? 'bg-red-500/15' : 'bg-emerald-500/15'}`}>
                  <Thermometer className={`w-5 h-5 ${(data.temperature || 0) > 40 ? 'text-red-400' : 'text-emerald-400'}`} />
                </div>
                <div>
                  <p className="text-xs text-white/40">Temperatura</p>
                  <p className="text-lg font-semibold text-white">{data.temperature || 0} <span className="text-xs text-white/40">°C</span></p>
                </div>
              </div>

              <div className="glass-card p-4 flex items-center gap-3 min-h-[96px]">
                <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center">
                  <Battery className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-white/40">V. Batería</p>
                  <p className="text-lg font-semibold text-white">{(data.batteryVoltage || 0).toFixed(1)} <span className="text-xs text-white/40">V</span></p>
                </div>
              </div>

              <div className="glass-card p-4 flex items-center gap-3 min-h-[96px]">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/15 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-xs text-white/40">Pot. Aparente</p>
                  <p className="text-lg font-semibold text-white">{consumptionVA} <span className="text-xs text-white/40">VA</span></p>
                </div>
              </div>
            </div>

            {/* Estado del sistema - Compacto */}
            <div className="col-span-3 glass-card p-4 h-full">
              <p className="text-sm font-semibold text-white mb-3">Estado</p>
              <div className="space-y-2">
                {[
                  { label: 'Red', ok: !data.status?.utilityFail },
                  { label: 'Batería', ok: !data.status?.batteryLow },
                  { label: 'UPS', ok: !data.status?.upsFailed },
                  { label: 'Bypass', ok: !data.status?.bypassActive, warning: true },
                  { label: 'Alarma', ok: !data.status?.beeperOn, warning: true },
                ].map((item, i) => (
                  <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
                    item.ok 
                      ? 'bg-dark-700/50 text-white/50' 
                      : item.warning 
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-red-500/15 text-red-400'
                  }`}>
                    <span>{item.label}</span>
                    <span className={`w-2 h-2 rounded-full ${item.ok ? 'bg-emerald-400' : item.warning ? 'bg-amber-400' : 'bg-red-400'}`}></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
