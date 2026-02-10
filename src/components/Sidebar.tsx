import React, { useState, useCallback, useMemo } from 'react';
import {
  LayoutDashboard,
  FileText,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Power,
  BatteryWarning,
  WifiOff,
  Activity,
  FlaskConical,
} from 'lucide-react';
import { TabId } from '../types/ups';

interface SidebarProps {
  currentTab: TabId;
  onTabChange: (tab: TabId) => void;
  isConnected: boolean;
  powerMode: 'online' | 'battery' | 'offline';
}

const navItems = [
  { id: 'dashboard' as TabId, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'curve' as TabId, label: 'Curvas', icon: Activity },
  { id: 'details' as TabId, label: 'Detalles', icon: FileText },
  { id: 'history' as TabId, label: 'Historial', icon: BarChart3 },
  { id: 'test' as TabId, label: 'Pruebas', icon: FlaskConical },
  { id: 'settings' as TabId, label: 'Ajustes', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  isConnected,
  powerMode,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  const status = useMemo(() => {
    if (!isConnected) {
      return {
        color: 'bg-red-500',
        text: 'Desconectado',
        glow: '',
        Icon: WifiOff,
      };
    }
    if (powerMode === 'battery') {
      return {
        color: 'bg-amber-500',
        text: 'En Bateria',
        glow: 'shadow-amber-500/20 shadow-lg',
        Icon: BatteryWarning,
      };
    }
    return {
      color: 'bg-emerald-500',
      text: 'En Linea',
      glow: 'shadow-emerald-500/20 shadow-lg',
      Icon: Power,
    };
  }, [isConnected, powerMode]);

  const StatusIcon = status.Icon;

  return (
    <aside
      className="sidebar-shell h-full flex flex-col"
      style={{
        width: collapsed ? 78 : 200,
        transition: 'width 150ms cubic-bezier(0.4, 0, 0.2, 1)',
        willChange: 'width',
        contain: 'layout style',
      }}
    >
      <nav className="flex-1 p-3 pt-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              title={collapsed ? item.label : undefined}
              className={[
                'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium border transition-colors',
                collapsed ? 'justify-center' : '',
                currentTab === item.id
                  ? 'bg-white/14 border-white/24 text-white shadow-lg'
                  : 'bg-transparent border-transparent text-white/55 hover:text-white hover:bg-white/8 hover:border-white/12',
              ].join(' ')}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${currentTab === item.id ? 'text-sky-300' : ''}`} />
              <span
                className="whitespace-nowrap overflow-hidden"
                style={{
                  width: collapsed ? 0 : 'auto',
                  opacity: collapsed ? 0 : 1,
                  transition: 'opacity 100ms ease-out',
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="px-3 pb-2">
        <button
          onClick={toggleCollapsed}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-white/40 hover:text-white hover:bg-white/8 transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span className="text-xs">Contraer</span>
            </>
          )}
        </button>
      </div>

      <div className="p-3 border-t border-white/10">
        <div className={`p-3 rounded-xl bg-white/[0.06] border border-white/10 ${status.glow} ${collapsed ? 'flex justify-center' : ''}`}>
          <div className={`flex items-center ${collapsed ? '' : 'gap-3'}`}>
            <div className="relative flex-shrink-0">
              <StatusIcon
                className={`w-5 h-5 ${
                  !isConnected ? 'text-red-400' : powerMode === 'battery' ? 'text-amber-400' : 'text-emerald-400'
                }`}
              />
              {isConnected && (
                <div className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${status.color}`} />
              )}
            </div>
            <div
              className="overflow-hidden whitespace-nowrap"
              style={{
                width: collapsed ? 0 : 'auto',
                opacity: collapsed ? 0 : 1,
                transition: 'opacity 100ms ease-out',
              }}
            >
              <p className="text-xs font-medium text-white">{status.text}</p>
              <p className="text-[10px] text-white/45">{isConnected ? 'Conectado' : 'Sin conexion'}</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
