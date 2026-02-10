import React from 'react';
import { Zap, Battery, Clock, Activity } from 'lucide-react';

interface BatteryGaugeProps {
  percentage: number;
  isCharging: boolean;
  voltage: number;
  runtime?: number;
}

export const BatteryGauge: React.FC<BatteryGaugeProps> = ({
  percentage,
  isCharging,
  voltage,
  runtime
}) => {
  const getColor = () => {
    if (percentage >= 60) return { main: 'emerald', text: 'text-emerald-400', hex: '#10b981' };
    if (percentage >= 30) return { main: 'amber', text: 'text-amber-400', hex: '#f59e0b' };
    return { main: 'red', text: 'text-red-400', hex: '#ef4444' };
  };

  const color = getColor();
  const circumference = 2 * Math.PI * 85;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className={`
      glass-card p-6 h-full flex flex-col items-center justify-center
      transition-all duration-500
    `}>
      {/* Circular Gauge */}
      <div className="relative w-48 h-48 mb-6">
        {/* Background circle */}
        <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
          <circle
            cx="100"
            cy="100"
            r="85"
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            className="text-dark-600"
          />
          <circle
            cx="100"
            cy="100"
            r="85"
            fill="none"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
            style={{
              stroke: color.hex
            }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-bold text-white tabular-nums">
            {percentage}
          </span>
          <span className="text-lg text-white/50">%</span>
          {isCharging && (
            <div className="flex items-center gap-1 mt-2 text-emerald-400">
              <Zap className="w-4 h-4" />
              <span className="text-xs font-medium">Cargando</span>
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="w-full space-y-3">
        <div className="flex items-center justify-between p-3 rounded-xl bg-dark-700/50">
          <div className="flex items-center gap-2">
            <Battery className="w-4 h-4 text-white/40" />
            <span className="text-sm text-white/50">Voltaje</span>
          </div>
          <span className="text-sm font-medium text-white">{voltage.toFixed(2)} V</span>
        </div>
        
        {runtime !== undefined && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-dark-700/50">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-white/40" />
              <span className="text-sm text-white/50">Autonomía</span>
            </div>
            <span className="text-sm font-medium text-white">{runtime} min</span>
          </div>
        )}

        <div className="flex items-center justify-between p-3 rounded-xl bg-dark-700/50">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-white/40" />
            <span className="text-sm text-white/50">Estado</span>
          </div>
          <span className={`text-sm font-medium ${color.text}`}>
            {percentage >= 60 ? 'Óptimo' : percentage >= 30 ? 'Medio' : 'Bajo'}
          </span>
        </div>
      </div>
    </div>
  );
};
