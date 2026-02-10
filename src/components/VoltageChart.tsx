import React from 'react';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { UPSData } from '../types/ups';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine, CartesianGrid } from 'recharts';

interface VoltageChartProps {
  data: UPSData;
  history: Array<{
    time: string;
    timestamp: number;
    input: number;
    output: number;
  }>;
}

export const VoltageChart: React.FC<VoltageChartProps> = ({ data, history }) => {
  // Calcular estadísticas
  const inputValues = history.map(h => h.input);
  const avgInput = inputValues.length > 0 ? inputValues.reduce((a, b) => a + b, 0) / inputValues.length : 0;
  const minInput = inputValues.length > 0 ? Math.min(...inputValues) : 0;
  const maxInput = inputValues.length > 0 ? Math.max(...inputValues) : 0;
  const inputVariation = maxInput - minInput;
  
  // Tendencia
  const lastInput = inputValues.length > 1 ? inputValues[inputValues.length - 1] : 0;
  const prevInput = inputValues.length > 1 ? inputValues[inputValues.length - 2] : 0;
  const trend = lastInput - prevInput;

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center">
            <Activity className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Voltaje en Tiempo Real</h3>
            <p className="text-xs text-white/40">Últimos 60 segundos • Entrada y Salida</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-cyan-400"></div>
            <span className="text-xs text-white/50">Entrada</span>
            <span className="text-sm font-semibold text-cyan-400">{(data.inputVoltage || 0).toFixed(1)}V</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
            <span className="text-xs text-white/50">Salida</span>
            <span className="text-sm font-semibold text-emerald-400">{(data.outputVoltage || 0).toFixed(1)}V</span>
          </div>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={history} 
            margin={{ top: 10, right: 10, bottom: 10, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis 
              dataKey="time" 
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis 
              domain={[50, 150]}
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
              width={40}
              tickCount={6}
              tickFormatter={(value) => `${value}V`}
            />
            <ReferenceLine y={120} stroke="rgba(34, 197, 94, 0.3)" strokeDasharray="5 5" label={{ value: '120V', fill: 'rgba(255,255,255,0.3)', fontSize: 10, position: 'right' }} />
            <ReferenceLine y={100} stroke="rgba(239, 68, 68, 0.3)" strokeDasharray="5 5" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(18, 18, 26, 0.95)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                fontSize: '12px'
              }}
              labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
              formatter={(value?: number, name?: string) => {
                const safeValue = Number(value ?? 0);
                return [`${safeValue.toFixed(1)} V`, name === 'input' ? 'Entrada' : 'Salida'];
              }}
            />
            <Line
              type="linear"
              dataKey="input"
              stroke="#22d3ee"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="linear"
              dataKey="output"
              stroke="#34d399"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Estadísticas del gráfico */}
      <div className="grid grid-cols-5 gap-4 mt-4 pt-4 border-t border-white/5">
        <div className="text-center">
          <p className="text-xs text-white/30 mb-1">Promedio</p>
          <p className="text-sm font-semibold text-cyan-400">{avgInput.toFixed(1)} V</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-white/30 mb-1">Mínimo</p>
          <p className="text-sm font-semibold text-white/70">{minInput.toFixed(1)} V</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-white/30 mb-1">Máximo</p>
          <p className="text-sm font-semibold text-white/70">{maxInput.toFixed(1)} V</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-white/30 mb-1">Variación</p>
          <p className={`text-sm font-semibold ${inputVariation > 5 ? 'text-amber-400' : 'text-emerald-400'}`}>
            ±{(inputVariation / 2).toFixed(1)} V
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-white/30 mb-1">Tendencia</p>
          <div className="flex items-center justify-center gap-1">
            {trend > 0.5 ? (
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            ) : trend < -0.5 ? (
              <TrendingDown className="w-4 h-4 text-red-400" />
            ) : (
              <Minus className="w-4 h-4 text-white/50" />
            )}
            <span className={`text-sm font-semibold ${
              trend > 0.5 ? 'text-emerald-400' : trend < -0.5 ? 'text-red-400' : 'text-white/50'
            }`}>
              {trend > 0 ? '+' : ''}{trend.toFixed(1)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
