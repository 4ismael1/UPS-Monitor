import React from 'react';
import { Zap, Battery, AlertCircle, Radio, FileText } from 'lucide-react';
import { UPSData } from '../types/ups';

interface DetailsViewProps {
  data: UPSData;
  isDisconnected?: boolean;
}

interface DetailRowProps {
  label: string;
  value: string | number;
  unit?: string;
  highlight?: boolean;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value, unit, highlight }) => (
  <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
    <span className="text-sm text-white/50">{label}</span>
    <span className={`text-sm font-medium ${highlight ? 'text-cyan-400' : 'text-white'}`}>
      {value}{unit && <span className="text-white/40 ml-1">{unit}</span>}
    </span>
  </div>
);

export const DetailsView: React.FC<DetailsViewProps> = ({ data, isDisconnected = false }) => {
  const disabledClass = isDisconnected ? 'opacity-40' : '';
  
  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'medium'
    });
  };

  return (
    <div className={`flex-1 flex flex-col overflow-hidden ${disabledClass}`}>
      <header className="px-8 py-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-cyan-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Detalles Técnicos</h1>
            <p className="text-white/40 text-sm mt-1">Información completa del UPS</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Parámetros Eléctricos */}
          <div className="glass-card p-6 animate-fade-in">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyan-400" />
              Parámetros Eléctricos
            </h3>
            <div>
              <DetailRow label="Voltaje de Entrada" value={(data.inputVoltage || 0).toFixed(1)} unit="V" highlight />
              <DetailRow label="Voltaje de Falla" value={(data.faultVoltage || 0).toFixed(1)} unit="V" />
              <DetailRow label="Voltaje de Salida" value={(data.outputVoltage || 0).toFixed(1)} unit="V" highlight />
              <DetailRow label="Frecuencia" value={(data.frequency || 0).toFixed(1)} unit="Hz" />
              <DetailRow label="Carga" value={data.loadPercent || 0} unit="%" />
            </div>
          </div>

          {/* Estado de Batería */}
          <div className="glass-card p-6 animate-fade-in animate-delay-100">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Battery className="w-5 h-5 text-emerald-400" />
              Estado de Batería
            </h3>
            <div>
              <DetailRow label="Voltaje" value={(data.batteryVoltage || 0).toFixed(2)} unit="V" highlight />
              <DetailRow label="Capacidad" value={data.batteryPercent || 0} unit="%" highlight />
              <DetailRow label="Temperatura" value={(data.temperature || 0).toFixed(1)} unit="°C" />
              {data.estimatedRuntime !== undefined && (
                <DetailRow label="Autonomía Est." value={data.estimatedRuntime} unit="min" />
              )}
            </div>
          </div>

          {/* Flags de Estado */}
          <div className="glass-card p-6 animate-fade-in animate-delay-200">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              Flags de Estado
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Fallo de Red', value: data.status?.utilityFail, danger: true },
                { label: 'Batería Baja', value: data.status?.batteryLow, danger: true },
                { label: 'Bypass', value: data.status?.bypassActive, warning: true },
                { label: 'UPS Fallido', value: data.status?.upsFailed, danger: true },
                { label: 'Standby', value: data.status?.upsIsStandby },
                { label: 'Test', value: data.status?.testInProgress },
                { label: 'Apagado', value: data.status?.shutdownActive, danger: true },
                { label: 'Alarma', value: data.status?.beeperOn, warning: true },
              ].map((item, index) => (
                <div 
                  key={index}
                  className={`
                    p-3 rounded-xl text-center text-xs font-medium
                    ${item.value 
                      ? item.danger 
                        ? 'bg-red-500/15 text-red-400' 
                        : item.warning 
                          ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-cyan-500/15 text-cyan-400'
                      : 'bg-dark-700/50 text-white/30'
                    }
                  `}
                >
                  {item.label}: {item.value ? 'SÍ' : 'NO'}
                </div>
              ))}
            </div>
          </div>

          {/* Datos Crudos */}
          <div className="glass-card p-6 animate-fade-in animate-delay-300">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Radio className="w-5 h-5 text-purple-400" />
              Datos Crudos
            </h3>
            <div>
              <DetailRow label="Status RAW" value={data.status?.raw || 'N/A'} />
              <DetailRow label="Última Actualización" value={data.timestamp ? formatDate(data.timestamp) : 'N/A'} />
              <DetailRow label="Tipo de Respuesta" value={data.type || 'STATUS'} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
