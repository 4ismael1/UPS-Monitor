import React from 'react';
import { 
  Zap, 
  Battery, 
  Shield, 
  GitBranch, 
  Moon, 
  TestTube, 
  Bell, 
  CheckCircle2,
  XCircle,
  AlertTriangle
} from 'lucide-react';

interface StatusGridProps {
  status?: {
    raw?: string;
    utilityFail?: boolean;
    batteryLow?: boolean;
    bypassActive?: boolean;
    upsFailed?: boolean;
    upsIsStandby?: boolean;
    testInProgress?: boolean;
    shutdownActive?: boolean;
    beeperOn?: boolean;
  };
}

interface StatusItemProps {
  label: string;
  active: boolean;
  type: 'success' | 'warning' | 'danger' | 'info';
  icon: React.ReactNode;
}

const StatusItem: React.FC<StatusItemProps> = ({ label, active, type, icon }) => {
  const colors = {
    success: active ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 'bg-dark-700/50 text-white/30 border-white/5',
    warning: active ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' : 'bg-dark-700/50 text-white/30 border-white/5',
    danger: active ? 'bg-red-500/15 text-red-400 border-red-500/20' : 'bg-dark-700/50 text-white/30 border-white/5',
    info: active ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20' : 'bg-dark-700/50 text-white/30 border-white/5',
  };

  return (
    <div className={`
      p-3 rounded-xl border transition-all duration-300
      ${colors[type]}
    `}>
      <div className="flex items-center gap-3">
        <div className="w-5 h-5">
          {icon}
        </div>
        <span className="text-xs font-medium flex-1">{label}</span>
        {active ? (
          type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : type === 'danger' ? (
            <XCircle className="w-4 h-4 text-red-400" />
          ) : type === 'warning' ? (
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          )
        ) : (
          <div className="w-4 h-4 rounded-full border border-white/20" />
        )}
      </div>
    </div>
  );
};

export const StatusGrid: React.FC<StatusGridProps> = ({ status }) => {
  const s = status || {};

  return (
    <div className="glass-card p-6 h-full">
      <h3 className="text-lg font-semibold text-white mb-4">Estado del Sistema</h3>
      
      <div className="space-y-2">
        <StatusItem
          label="Red Eléctrica"
          active={!s.utilityFail}
          type={s.utilityFail ? 'danger' : 'success'}
          icon={<Zap className="w-5 h-5" />}
        />
        <StatusItem
          label="Batería"
          active={!s.batteryLow}
          type={s.batteryLow ? 'danger' : 'success'}
          icon={<Battery className="w-5 h-5" />}
        />
        <StatusItem
          label="UPS Normal"
          active={!s.upsFailed}
          type={s.upsFailed ? 'danger' : 'success'}
          icon={<Shield className="w-5 h-5" />}
        />
        <StatusItem
          label="Bypass"
          active={s.bypassActive || false}
          type="warning"
          icon={<GitBranch className="w-5 h-5" />}
        />
        <StatusItem
          label="Standby"
          active={s.upsIsStandby || false}
          type="info"
          icon={<Moon className="w-5 h-5" />}
        />
        <StatusItem
          label="Test"
          active={s.testInProgress || false}
          type="info"
          icon={<TestTube className="w-5 h-5" />}
        />
        <StatusItem
          label="Alarma"
          active={s.beeperOn || false}
          type="warning"
          icon={<Bell className="w-5 h-5" />}
        />
      </div>

      {s.raw && (
        <div className="mt-4 p-3 rounded-xl bg-dark-700/50 border border-white/5">
          <p className="text-xs text-white/30 mb-1">Status RAW</p>
          <code className="text-xs text-cyan-400 font-mono">{s.raw}</code>
        </div>
      )}
    </div>
  );
};
