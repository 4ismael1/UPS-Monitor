import React, { useState } from 'react';
import { 
  Activity, 
  Zap, 
  Battery, 
  Gauge,
  Pause,
  Play,
  RotateCcw,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { UPSData } from '../types/ups';
import { CurveDataPoint } from '../App';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  ResponsiveContainer, 
  Tooltip, 
  CartesianGrid,
  ReferenceLine
} from 'recharts';

interface CurveViewProps {
  data: UPSData;
  history: CurveDataPoint[];
  isPaused: boolean;
  onPauseChange: (paused: boolean) => void;
  onClear: () => void;
}

const MAX_POINTS = 120;

export const CurveView: React.FC<CurveViewProps> = ({ 
  data, 
  history, 
  isPaused, 
  onPauseChange, 
  onClear 
}) => {
  const [yAxisMax, setYAxisMax] = useState(240);
  const [showGrid, setShowGrid] = useState(true);
  const [visibleLines, setVisibleLines] = useState({
    inputVoltage: true,
    outputVoltage: true,
    batteryPercent: true,
    loadPercent: true
  });

  const toggleLine = (key: keyof typeof visibleLines) => {
    setVisibleLines(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const zoomIn = () => {
    setYAxisMax(prev => Math.max(100, prev - 20));
  };

  const zoomOut = () => {
    setYAxisMax(prev => Math.min(300, prev + 20));
  };

  const lines = [
    { 
      key: 'inputVoltage', 
      name: 'Entrada (V)', 
      color: '#00BFFF', 
      icon: Zap,
      value: data.inputVoltage?.toFixed(1) || '0',
      unit: 'V'
    },
    { 
      key: 'outputVoltage', 
      name: 'Salida (V)', 
      color: '#FF4444', 
      icon: Zap,
      value: data.outputVoltage?.toFixed(1) || '0',
      unit: 'V'
    },
    { 
      key: 'batteryPercent', 
      name: 'Batería (%)', 
      color: '#FFD700', 
      icon: Battery,
      value: data.batteryPercent?.toFixed(0) || '0',
      unit: '%'
    },
    { 
      key: 'loadPercent', 
      name: 'Carga (%)', 
      color: '#00FF7F', 
      icon: Gauge,
      value: data.loadPercent?.toFixed(0) || '0',
      unit: '%'
    },
  ];

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;
    
    return (
      <div className="bg-dark-800/95 border border-white/10 rounded-lg p-3 shadow-xl">
        <p className="text-white/50 text-xs mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-white/70">{entry.name}:</span>
            <span className="font-mono text-white" style={{ color: entry.color }}>
              {entry.value?.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-8 py-5 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-cyan-400" />
            <div>
              <h1 className="text-xl font-bold text-white">Curvas</h1>
              <p className="text-white/40 text-xs mt-0.5">Monitoreo en tiempo real</p>
            </div>
          </div>
          
          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`px-3 py-2 rounded-lg text-sm transition-colors
                         ${showGrid ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
            >
              Cuadrícula
            </button>
            <div className="w-px h-6 bg-white/10 mx-1" />
            <button
              onClick={zoomOut}
              className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors"
              title="Alejar"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={zoomIn}
              className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors"
              title="Acercar"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="w-px h-6 bg-white/10 mx-1" />
            <button
              onClick={onClear}
              className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors"
              title="Limpiar"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => onPauseChange(!isPaused)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                         ${isPaused 
                           ? 'bg-amber-500/20 text-amber-400' 
                           : 'bg-emerald-500/20 text-emerald-400'}`}
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {isPaused ? 'Reanudar' : 'Pausar'}
            </button>
          </div>
        </div>
      </header>

      {/* Chart Area */}
      <div className="flex-1 p-6 flex flex-col gap-4">
        {/* Main Chart */}
        <div className="flex-1 glass-card p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={history} 
              margin={{ top: 10, right: 30, bottom: 10, left: 10 }}
            >
              {showGrid && (
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke="rgba(255,255,255,0.05)" 
                  vertical={true}
                  horizontal={true}
                />
              )}
              <XAxis 
                dataKey="time" 
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                interval="preserveStartEnd"
                minTickGap={50}
              />
              <YAxis 
                domain={[0, yAxisMax]}
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                width={45}
                tickCount={13}
              />
              
              {/* Reference lines */}
              <ReferenceLine y={120} stroke="rgba(255,255,255,0.1)" strokeDasharray="5 5" />
              <ReferenceLine y={100} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
              
              <Tooltip content={<CustomTooltip />} />
              
              {visibleLines.inputVoltage && (
                <Line
                  type="linear"
                  dataKey="inputVoltage"
                  name="Entrada (V)"
                  stroke="#00BFFF"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              )}
              {visibleLines.outputVoltage && (
                <Line
                  type="linear"
                  dataKey="outputVoltage"
                  name="Salida (V)"
                  stroke="#FF4444"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              )}
              {visibleLines.batteryPercent && (
                <Line
                  type="linear"
                  dataKey="batteryPercent"
                  name="Batería (%)"
                  stroke="#FFD700"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              )}
              {visibleLines.loadPercent && (
                <Line
                  type="linear"
                  dataKey="loadPercent"
                  name="Carga (%)"
                  stroke="#00FF7F"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Legend / Current Values */}
        <div className="grid grid-cols-4 gap-4">
          {lines.map((line) => {
            const isVisible = visibleLines[line.key as keyof typeof visibleLines];
            
            return (
              <button
                key={line.key}
                onClick={() => toggleLine(line.key as keyof typeof visibleLines)}
                className={`glass-card p-4 transition-all ${
                  isVisible ? 'opacity-100' : 'opacity-40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: isVisible ? line.color : 'rgba(255,255,255,0.2)' }}
                  />
                  <div className="flex-1 text-left">
                    <p className="text-xs text-white/50">{line.name}</p>
                    <p 
                      className="text-2xl font-bold font-mono"
                      style={{ color: isVisible ? line.color : 'rgba(255,255,255,0.3)' }}
                    >
                      {line.value}
                      <span className="text-sm ml-1 font-normal text-white/40">{line.unit}</span>
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Stats Bar */}
        <div className="flex items-center justify-between text-sm text-white/40 px-2">
          <div className="flex items-center gap-6">
            <span>Puntos: <span className="text-white font-mono">{history.length}</span> / {MAX_POINTS}</span>
            <span>Intervalo: <span className="text-white font-mono">1s</span></span>
            <span>Máx Y: <span className="text-white font-mono">{yAxisMax}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            <span>{isPaused ? 'Pausado' : 'Grabando'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
