import React from 'react';
import { 
  Zap, 
  Plug, 
  Gauge, 
  Activity, 
  Thermometer, 
  Battery,
  LucideIcon
} from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: number;
  unit: string;
  iconType: 'zap' | 'plug' | 'gauge' | 'activity' | 'thermometer' | 'battery';
  color: 'cyan' | 'green' | 'amber' | 'red' | 'purple';
  status?: 'normal' | 'warning' | 'critical';
  decimals?: number;
  subtitle?: string;
}

const iconMap: Record<string, LucideIcon> = {
  zap: Zap,
  plug: Plug,
  gauge: Gauge,
  activity: Activity,
  thermometer: Thermometer,
  battery: Battery,
};

const colorConfig = {
  cyan: {
    bg: 'from-cyan-500/20 to-cyan-500/5',
    border: 'border-cyan-500/20',
    icon: 'bg-cyan-500/15 text-cyan-400',
    glow: 'bg-cyan-500',
  },
  green: {
    bg: 'from-emerald-500/20 to-emerald-500/5',
    border: 'border-emerald-500/20',
    icon: 'bg-emerald-500/15 text-emerald-400',
    glow: 'bg-emerald-500',
  },
  amber: {
    bg: 'from-amber-500/20 to-amber-500/5',
    border: 'border-amber-500/20',
    icon: 'bg-amber-500/15 text-amber-400',
    glow: 'bg-amber-500',
  },
  red: {
    bg: 'from-red-500/20 to-red-500/5',
    border: 'border-red-500/20',
    icon: 'bg-red-500/15 text-red-400',
    glow: 'bg-red-500',
  },
  purple: {
    bg: 'from-purple-500/20 to-purple-500/5',
    border: 'border-purple-500/20',
    icon: 'bg-purple-500/15 text-purple-400',
    glow: 'bg-purple-500',
  },
};

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  iconType,
  color,
  status = 'normal',
  decimals = 0,
  subtitle,
}) => {
  const Icon = iconMap[iconType];
  const colors = colorConfig[color];
  const formattedValue = decimals > 0 ? value.toFixed(decimals) : Math.round(value);

  return (
    <div className={`
      relative overflow-hidden rounded-2xl p-5
      bg-gradient-to-br ${colors.bg}
      border ${colors.border}
      transition-colors duration-200
      group
    `}>
      <div className={`absolute -top-10 -right-10 w-24 h-24 rounded-full opacity-10 ${colors.glow}`}></div>

      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-medium text-white/50 uppercase tracking-wider">{title}</span>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors.icon}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-white tabular-nums">{formattedValue}</span>
          <span className="text-sm text-white/40">{unit}</span>
        </div>

        {subtitle && (
          <p className="text-xs text-white/40 mt-1">{subtitle}</p>
        )}

        {status && (
          <div className="mt-3 flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${
              status === 'normal' ? 'bg-emerald-500' :
              status === 'warning' ? 'bg-amber-500' :
              'bg-red-500'
            }`}></div>
            <span className="text-[10px] text-white/40">
              {status === 'normal' ? 'Normal' : status === 'warning' ? 'Atención' : 'Crítico'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
