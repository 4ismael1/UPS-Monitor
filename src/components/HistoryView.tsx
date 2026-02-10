import React, { useState, useEffect, useCallback } from 'react';
import { 
  History, 
  AlertTriangle, 
  Database, 
  Calendar,
  Trash2,
  RefreshCw,
  Filter,
  Activity,
  Clock
} from 'lucide-react';

interface EventRecord {
  id: number;
  time: string;
  classification: string;
  name: string;
  remarks: string;
}

interface DataRecord {
  id: number;
  time: string;
  inputVoltage: number;
  outputVoltage: number;
  frequency: number;
  loadPercent: number;
  batteryVoltage: number;
  batteryPercent: number;
  temperature: number;
}

type TabType = 'events' | 'data';
const HISTORY_PREFS_KEY = 'ups.history.preferences.v1';

export const HistoryView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('events');
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [dataHistory, setDataHistory] = useState<DataRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  
  // Filters
  const [eventFilter, setEventFilter] = useState('All Events');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const normalizedDateFrom = dateFrom && dateTo && dateFrom > dateTo ? dateTo : dateFrom;
  const normalizedDateTo = dateFrom && dateTo && dateFrom > dateTo ? dateFrom : dateTo;
  const hasInvertedRange = !!dateFrom && !!dateTo && dateFrom > dateTo;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_PREFS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        activeTab?: TabType;
        eventFilter?: string;
        dateFrom?: string;
        dateTo?: string;
      };

      if (parsed.activeTab === 'events' || parsed.activeTab === 'data') {
        setActiveTab(parsed.activeTab);
      }
      if (typeof parsed.eventFilter === 'string') {
        setEventFilter(parsed.eventFilter);
      }
      if (typeof parsed.dateFrom === 'string') {
        setDateFrom(parsed.dateFrom);
      }
      if (typeof parsed.dateTo === 'string') {
        setDateTo(parsed.dateTo);
      }
    } catch (error) {
      console.error('Error restoring history filters:', error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        HISTORY_PREFS_KEY,
        JSON.stringify({
          activeTab,
          eventFilter,
          dateFrom,
          dateTo,
        }),
      );
    } catch (error) {
      console.error('Error saving history filters:', error);
    }
  }, [activeTab, eventFilter, dateFrom, dateTo]);

  const loadEvents = useCallback(async () => {
    if (!window.desktopAPI?.getEvents) return;
    setLoading(true);
    try {
      const filter: Record<string, string> = {};
      if (eventFilter !== 'All Events') filter.classification = eventFilter;
      if (normalizedDateFrom) filter.dateFrom = normalizedDateFrom;
      if (normalizedDateTo) filter.dateTo = normalizedDateTo;
      
      const result = await window.desktopAPI.getEvents(filter);
      setEvents(result || []);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  }, [eventFilter, normalizedDateFrom, normalizedDateTo]);

  const loadDataHistory = useCallback(async () => {
    if (!window.desktopAPI?.getDataHistory) return;
    setLoading(true);
    try {
      const filter: Record<string, string> = {};
      if (normalizedDateFrom) filter.dateFrom = normalizedDateFrom;
      if (normalizedDateTo) filter.dateTo = normalizedDateTo;
      
      const result = await window.desktopAPI.getDataHistory(filter);
      setDataHistory(result || []);
    } catch (error) {
      console.error('Error loading data history:', error);
    } finally {
      setLoading(false);
    }
  }, [normalizedDateFrom, normalizedDateTo]);

  useEffect(() => {
    if (activeTab === 'events') {
      loadEvents();
    } else {
      loadDataHistory();
    }
  }, [activeTab, loadEvents, loadDataHistory]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (activeTab === 'events') {
        void loadEvents();
      } else {
        void loadDataHistory();
      }
    }, 15000);

    return () => window.clearInterval(interval);
  }, [activeTab, loadEvents, loadDataHistory]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const validIds = new Set(
        activeTab === 'events' ? events.map((item) => item.id) : dataHistory.map((item) => item.id),
      );
      return prev.filter((id) => validIds.has(id));
    });
  }, [activeTab, events, dataHistory]);

  const handleDelete = async () => {
    if (selectedIds.length === 0) return;
    
    try {
      if (activeTab === 'events') {
        await window.desktopAPI?.deleteEvents(selectedIds);
        loadEvents();
      } else {
        await window.desktopAPI?.deleteDataHistory(selectedIds);
        loadDataHistory();
      }
      setSelectedIds([]);
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const handleDeleteAll = async () => {
    try {
      if (activeTab === 'events') {
        await window.desktopAPI?.deleteEvents([]);
        loadEvents();
      } else {
        await window.desktopAPI?.deleteDataHistory([]);
        loadDataHistory();
      }
      setSelectedIds([]);
    } catch (error) {
      console.error('Error deleting all:', error);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id) 
        : [...prev, id]
    );
  };

  const selectAll = () => {
    if (activeTab === 'events') {
      setSelectedIds(events.map(e => e.id));
    } else {
      setSelectedIds(dataHistory.map(d => d.id));
    }
  };

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getClassificationStyle = (classification: string) => {
    if (classification === 'Critical Event') {
      return 'bg-red-500/20 text-red-400';
    }
    return 'bg-emerald-500/20 text-emerald-400';
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-8 py-5 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <History className="w-6 h-6 text-cyan-400" />
            <div>
              <h1 className="text-xl font-bold text-white">Historial</h1>
              <p className="text-white/40 text-xs mt-0.5">Eventos y datos del UPS</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={activeTab === 'events' ? loadEvents : loadDataHistory}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-white/50 
                         hover:text-white hover:bg-white/5 transition-colors text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="px-8 pt-4 flex gap-2">
        <button
          onClick={() => { setActiveTab('events'); setSelectedIds([]); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
                     ${activeTab === 'events' 
                       ? 'bg-white/10 text-white' 
                       : 'text-white/50 hover:text-white hover:bg-white/5'}`}
        >
          <AlertTriangle className={`w-4 h-4 ${activeTab === 'events' ? 'text-amber-400' : ''}`} />
          Eventos
          {events.length > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full bg-white/10 text-xs">
              {events.length}
            </span>
          )}
        </button>
        <button
          onClick={() => { setActiveTab('data'); setSelectedIds([]); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
                     ${activeTab === 'data' 
                       ? 'bg-white/10 text-white' 
                       : 'text-white/50 hover:text-white hover:bg-white/5'}`}
        >
          <Database className={`w-4 h-4 ${activeTab === 'data' ? 'text-purple-400' : ''}`} />
          Datos
          {dataHistory.length > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full bg-white/10 text-xs">
              {dataHistory.length}
            </span>
          )}
        </button>
      </div>

      {/* Filters */}
      <div className="px-8 py-4 flex items-center gap-4 border-b border-white/5">
        {activeTab === 'events' && (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-white/40" />
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="bg-dark-700 border border-white/10 rounded-lg px-3 py-2 text-sm text-white
                         focus:outline-none focus:border-cyan-500/50"
            >
              <option value="All Events">Todos los eventos</option>
              <option value="General Event">Eventos generales</option>
              <option value="Critical Event">Eventos críticos</option>
            </select>
          </div>
        )}
        
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-white/40" />
          <span className="text-sm text-white/40">Desde:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-dark-700 border border-white/10 rounded-lg px-3 py-2 text-sm text-white
                       focus:outline-none focus:border-cyan-500/50"
          />
          <span className="text-sm text-white/40">Hasta:</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-dark-700 border border-white/10 rounded-lg px-3 py-2 text-sm text-white
                       focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        <div className="flex-1" />

        {hasInvertedRange && (
          <span className="text-xs text-amber-300/90">
            Rango invertido detectado, se corrige automaticamente.
          </span>
        )}

        {selectedIds.length > 0 && (
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/20 text-red-400
                       hover:bg-red-500/30 transition-colors text-sm"
          >
            <Trash2 className="w-4 h-4" />
            Eliminar ({selectedIds.length})
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-6">
        {activeTab === 'events' ? (
          <div className="h-full flex flex-col">
            {/* Events Table */}
            <div className="glass-card flex-1 overflow-hidden flex flex-col">
              {/* Table Header */}
              <div className="grid grid-cols-[40px_180px_140px_1fr_1fr] gap-4 px-4 py-3 border-b border-white/10 bg-dark-700/50">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === events.length && events.length > 0}
                    onChange={() => selectedIds.length === events.length ? setSelectedIds([]) : selectAll()}
                    className="w-4 h-4 rounded border-white/20 bg-dark-700 text-cyan-500"
                  />
                </div>
                <div className="text-xs font-semibold text-white/50 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Fecha/Hora
                </div>
                <div className="text-xs font-semibold text-white/50 uppercase tracking-wider">Clasificación</div>
                <div className="text-xs font-semibold text-white/50 uppercase tracking-wider">Nombre</div>
                <div className="text-xs font-semibold text-white/50 uppercase tracking-wider">Observaciones</div>
              </div>
              
              {/* Table Body */}
              <div className="flex-1 overflow-y-auto">
                {events.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-white/40">
                    <AlertTriangle className="w-12 h-12 mb-3 opacity-50" />
                    <p>No hay eventos registrados</p>
                  </div>
                ) : (
                  events.map((event) => (
                    <div
                      key={event.id}
                      className={`grid grid-cols-[40px_180px_140px_1fr_1fr] gap-4 px-4 py-3 border-b border-white/5 
                                 hover:bg-white/5 transition-colors cursor-pointer
                                 ${selectedIds.includes(event.id) ? 'bg-cyan-500/10' : ''}`}
                      onClick={() => toggleSelect(event.id)}
                    >
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(event.id)}
                          onChange={() => toggleSelect(event.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded border-white/20 bg-dark-700 text-cyan-500"
                        />
                      </div>
                      <div className="text-sm text-white/70">{formatDateTime(event.time)}</div>
                      <div>
                        <span className={`px-2 py-1 rounded-md text-xs font-medium ${getClassificationStyle(event.classification)}`}>
                          {event.classification === 'Critical Event' ? 'Crítico' : 'General'}
                        </span>
                      </div>
                      <div className="text-sm text-white">{event.name}</div>
                      <div className="text-sm text-white/50">{event.remarks}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {/* Data Table */}
            <div className="glass-card flex-1 overflow-hidden flex flex-col">
              {/* Table Header */}
              <div className="grid grid-cols-[40px_160px_100px_100px_80px_100px_80px] gap-4 px-4 py-3 border-b border-white/10 bg-dark-700/50">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === dataHistory.length && dataHistory.length > 0}
                    onChange={() => selectedIds.length === dataHistory.length ? setSelectedIds([]) : selectAll()}
                    className="w-4 h-4 rounded border-white/20 bg-dark-700 text-cyan-500"
                  />
                </div>
                <div className="text-xs font-semibold text-white/50 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Fecha/Hora
                </div>
                <div className="text-xs font-semibold text-white/50 uppercase tracking-wider">Entrada V</div>
                <div className="text-xs font-semibold text-white/50 uppercase tracking-wider">Salida V</div>
                <div className="text-xs font-semibold text-white/50 uppercase tracking-wider">Hz</div>
                <div className="text-xs font-semibold text-white/50 uppercase tracking-wider">Carga %</div>
                <div className="text-xs font-semibold text-white/50 uppercase tracking-wider">Bat %</div>
              </div>
              
              {/* Table Body */}
              <div className="flex-1 overflow-y-auto">
                {dataHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-white/40">
                    <Database className="w-12 h-12 mb-3 opacity-50" />
                    <p>No hay datos registrados</p>
                    <p className="text-xs mt-1">Los datos se guardan según el intervalo configurado</p>
                  </div>
                ) : (
                  dataHistory.map((record) => (
                    <div
                      key={record.id}
                      className={`grid grid-cols-[40px_160px_100px_100px_80px_100px_80px] gap-4 px-4 py-3 border-b border-white/5 
                                 hover:bg-white/5 transition-colors cursor-pointer
                                 ${selectedIds.includes(record.id) ? 'bg-cyan-500/10' : ''}`}
                      onClick={() => toggleSelect(record.id)}
                    >
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(record.id)}
                          onChange={() => toggleSelect(record.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded border-white/20 bg-dark-700 text-cyan-500"
                        />
                      </div>
                      <div className="text-sm text-white/70">{formatDateTime(record.time)}</div>
                      <div className="text-sm text-cyan-400 font-mono">{record.inputVoltage.toFixed(1)}</div>
                      <div className="text-sm text-emerald-400 font-mono">{record.outputVoltage.toFixed(1)}</div>
                      <div className="text-sm text-white/70 font-mono">{record.frequency.toFixed(1)}</div>
                      <div className="text-sm text-amber-400 font-mono">{record.loadPercent.toFixed(0)}</div>
                      <div className="text-sm text-purple-400 font-mono">{record.batteryPercent.toFixed(0)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="px-8 py-3 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-sm text-white/40">
            <Activity className="w-4 h-4" />
            <span>
              {activeTab === 'events' 
                ? `${events.length} eventos` 
                : `${dataHistory.length} registros`}
            </span>
          </div>
          {selectedIds.length > 0 && (
            <span className="text-sm text-cyan-400">
              {selectedIds.length} seleccionado(s)
            </span>
          )}
        </div>
        <button
          onClick={handleDeleteAll}
          className="text-sm text-white/40 hover:text-red-400 transition-colors"
        >
          Eliminar todo
        </button>
      </div>
    </div>
  );
};


