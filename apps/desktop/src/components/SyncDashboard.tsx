import { useState, useEffect, useCallback } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  Cloud,
  RefreshCw,
  Smartphone,
  XCircle,
  Zap,
  BarChart3,
  Inbox,
  HardDrive,
} from 'lucide-react';

interface DashboardStats {
  overview: {
    totalPending: number;
    totalFailed: number;
    totalSynced24h: number;
    activeDevices: number;
    unresolvedConflicts: number;
    healthScore: number;
    healthStatus: 'healthy' | 'warning' | 'critical';
  };
  breakdown: {
    pendingByEntity: Record<string, number>;
    failedByEntity: Record<string, number>;
  };
  performance: {
    avgSyncTimeSeconds: number;
  };
  timestamp: string;
}

interface SyncAlert {
  type: 'warning' | 'error' | 'info';
  message: string;
  count?: number;
  entityType?: string;
}

interface SyncHistoryItem {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  status: string;
  retryCount: number;
  deviceId?: string;
  createdAt: string;
  updatedAt: string;
}

interface DeadLetterItem {
  id: number;
  originalId: number;
  entityType: string;
  entityId: string;
  action: string;
  error: string;
  retryCount: number;
  movedAt: string;
}

interface DeadLetterStats {
  total: number;
  byEntityType: Record<string, number>;
  oldestItem?: string;
}

export default function SyncDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [alerts, setAlerts] = useState<SyncAlert[]>([]);
  const [history, setHistory] = useState<SyncHistoryItem[]>([]);
  const [dlqStats, setDlqStats] = useState<DeadLetterStats | null>(null);
  const [dlqItems, setDlqItems] = useState<DeadLetterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'dlq'>('overview');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // @ts-ignore - API exposta dinamicamente pelo preload
      const api = window.electronAPI?.sync as any;
      
      // Buscar dados via APIs disponíveis
      const promises: Promise<any>[] = [];
      
      // Dashboard stats do servidor
      if (api?.getDashboardStats) {
        promises.push(api.getDashboardStats());
      } else {
        promises.push(Promise.resolve({ success: false }));
      }
      
      // Alerts do servidor
      if (api?.getDashboardAlerts) {
        promises.push(api.getDashboardAlerts());
      } else {
        promises.push(Promise.resolve({ success: false }));
      }
      
      // History do servidor
      if (api?.getDashboardHistory) {
        promises.push(api.getDashboardHistory(20));
      } else {
        promises.push(Promise.resolve({ success: false }));
      }
      
      // Dead Letter Queue local
      if (api?.getDeadLetterStats) {
        promises.push(api.getDeadLetterStats());
      } else {
        promises.push(Promise.resolve(null));
      }
      
      if (api?.getDeadLetterItems) {
        promises.push(api.getDeadLetterItems(10));
      } else {
        promises.push(Promise.resolve([]));
      }

      const [dashboardStats, alertsData, historyData, localDlqStats, localDlqItems] =
        await Promise.all(promises);

      if (dashboardStats?.success && dashboardStats?.data) {
        setStats(dashboardStats.data);
      }
      if (alertsData?.success && alertsData?.data?.alerts) {
        setAlerts(alertsData.data.alerts);
      }
      if (historyData?.success && historyData?.data?.items) {
        setHistory(historyData.data.items);
      }
      if (localDlqStats) {
        setDlqStats(localDlqStats);
      }
      if (localDlqItems && Array.isArray(localDlqItems)) {
        setDlqItems(localDlqItems);
      }
    } catch (err: any) {
      console.error('Erro ao carregar dashboard de sync:', err);
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Auto-refresh a cada 30 segundos
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRetryDlqItem = async (itemId: number) => {
    try {
      // @ts-ignore - API exposta dinamicamente pelo preload
      const api = window.electronAPI?.sync as any;
      if (api?.retryDeadLetterItem) {
        await api.retryDeadLetterItem(itemId);
        await fetchData();
      }
    } catch (err: any) {
      console.error('Erro ao reprocessar item:', err);
    }
  };

  const handleDiscardDlqItem = async (itemId: number) => {
    if (!confirm('Tem certeza que deseja descartar este item? Esta ação não pode ser desfeita.')) {
      return;
    }
    try {
      // @ts-ignore - API exposta dinamicamente pelo preload
      const api = window.electronAPI?.sync as any;
      if (api?.discardDeadLetterItem) {
        await api.discardDeadLetterItem(itemId);
        await fetchData();
      }
    } catch (err: any) {
      console.error('Erro ao descartar item:', err);
    }
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'warning':
        return 'text-yellow-600 bg-yellow-100';
      case 'critical':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-yellow-600" />;
      case 'critical':
        return <XCircle className="w-6 h-6 text-red-600" />;
      default:
        return <HardDrive className="w-6 h-6 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'synced':
      case 'acknowledged':
        return 'text-green-600 bg-green-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      case 'error':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Carregando dashboard...</span>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
        <button
          onClick={fetchData}
          className="mt-2 px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header com tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              activeTab === 'overview'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <BarChart3 className="w-4 h-4 inline mr-1" />
            Visão Geral
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Clock className="w-4 h-4 inline mr-1" />
            Histórico
          </button>
          <button
            onClick={() => setActiveTab('dlq')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              activeTab === 'dlq'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Inbox className="w-4 h-4 inline mr-1" />
            Dead Letter ({dlqStats?.total || 0})
          </button>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Tab: Visão Geral */}
      {activeTab === 'overview' && stats && (
        <div className="space-y-4">
          {/* Health Score Card */}
          <div
            className={`p-4 rounded-lg border-2 ${
              stats.overview.healthStatus === 'healthy'
                ? 'border-green-300 bg-green-50'
                : stats.overview.healthStatus === 'warning'
                ? 'border-yellow-300 bg-yellow-50'
                : 'border-red-300 bg-red-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getHealthIcon(stats.overview.healthStatus)}
                <div>
                  <h3 className="font-semibold text-lg">Saúde do Sistema de Sync</h3>
                  <p className="text-sm text-gray-600">
                    {stats.overview.healthStatus === 'healthy'
                      ? 'Todos os sistemas operando normalmente'
                      : stats.overview.healthStatus === 'warning'
                      ? 'Atenção necessária - verifique os alertas'
                      : 'Problemas críticos detectados'}
                  </p>
                </div>
              </div>
              <div
                className={`text-4xl font-bold ${
                  stats.overview.healthStatus === 'healthy'
                    ? 'text-green-600'
                    : stats.overview.healthStatus === 'warning'
                    ? 'text-yellow-600'
                    : 'text-red-600'
                }`}
              >
                {stats.overview.healthScore}%
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 bg-white rounded-lg border shadow-sm">
              <div className="flex items-center gap-2 text-yellow-600 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">Pendentes</span>
              </div>
              <p className="text-2xl font-bold">{stats.overview.totalPending}</p>
            </div>
            <div className="p-4 bg-white rounded-lg border shadow-sm">
              <div className="flex items-center gap-2 text-red-600 mb-1">
                <XCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Com Erro</span>
              </div>
              <p className="text-2xl font-bold">{stats.overview.totalFailed}</p>
            </div>
            <div className="p-4 bg-white rounded-lg border shadow-sm">
              <div className="flex items-center gap-2 text-green-600 mb-1">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Sync 24h</span>
              </div>
              <p className="text-2xl font-bold">{stats.overview.totalSynced24h}</p>
            </div>
            <div className="p-4 bg-white rounded-lg border shadow-sm">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <Smartphone className="w-4 h-4" />
                <span className="text-sm font-medium">Dispositivos</span>
              </div>
              <p className="text-2xl font-bold">{stats.overview.activeDevices}</p>
            </div>
          </div>

          {/* Breakdown by Entity */}
          {Object.keys(stats.breakdown.pendingByEntity).length > 0 && (
            <div className="p-4 bg-white rounded-lg border shadow-sm">
              <h4 className="font-medium text-sm text-gray-700 mb-3">Pendentes por Tipo</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.breakdown.pendingByEntity).map(([entity, count]) => (
                  <span
                    key={entity}
                    className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm"
                  >
                    {entity}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="p-4 bg-white rounded-lg border shadow-sm">
              <h4 className="font-medium text-sm text-gray-700 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                Alertas Ativos ({alerts.length})
              </h4>
              <div className="space-y-2">
                {alerts.map((alert, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg text-sm ${
                      alert.type === 'error'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : alert.type === 'warning'
                        ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}
                  >
                    {alert.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Performance */}
          <div className="p-4 bg-white rounded-lg border shadow-sm">
            <h4 className="font-medium text-sm text-gray-700 mb-2 flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-500" />
              Performance
            </h4>
            <p className="text-sm text-gray-600">
              Tempo médio de sincronização:{' '}
              <span className="font-semibold">
                {stats.performance.avgSyncTimeSeconds}s
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Tab: Histórico */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="p-4 border-b">
            <h4 className="font-medium">Histórico de Sincronização</h4>
            <p className="text-sm text-gray-500">Últimas 20 operações de sync</p>
          </div>
          <div className="divide-y max-h-96 overflow-auto">
            {history.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Cloud className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Nenhum registro de sincronização</p>
              </div>
            ) : (
              history.map((item) => (
                <div key={item.id} className="p-3 flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(
                      item.status
                    )}`}
                  >
                    {item.status}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {item.action} - {item.entityType}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      ID: {item.entityId.substring(0, 8)}...
                    </p>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <p>{new Date(item.updatedAt).toLocaleTimeString('pt-BR')}</p>
                    {item.retryCount > 0 && (
                      <p className="text-orange-600">{item.retryCount} tentativas</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab: Dead Letter Queue */}
      {activeTab === 'dlq' && (
        <div className="space-y-4">
          {/* DLQ Stats */}
          {dlqStats && (
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <h4 className="font-medium text-orange-800 mb-2 flex items-center gap-2">
                <Inbox className="w-4 h-4" />
                Dead Letter Queue - Itens Locais
              </h4>
              <p className="text-sm text-orange-700 mb-2">
                Total de itens que falharam após múltiplas tentativas:{' '}
                <span className="font-bold">{dlqStats.total}</span>
              </p>
              {Object.keys(dlqStats.byEntityType).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(dlqStats.byEntityType).map(([entity, count]) => (
                    <span
                      key={entity}
                      className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs"
                    >
                      {entity}: {count}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* DLQ Items */}
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="p-4 border-b">
              <h4 className="font-medium">Itens na Dead Letter Queue</h4>
              <p className="text-sm text-gray-500">
                Itens que falharam e precisam de atenção manual
              </p>
            </div>
            <div className="divide-y max-h-96 overflow-auto">
              {dlqItems.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  <p>Nenhum item na Dead Letter Queue</p>
                </div>
              ) : (
                dlqItems.map((item) => (
                  <div key={item.id} className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="text-sm font-medium">
                          {item.action} - {item.entityType}
                        </span>
                        <p className="text-xs text-gray-500">
                          ID: {item.entityId.substring(0, 12)}...
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRetryDlqItem(item.id)}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          Reprocessar
                        </button>
                        <button
                          onClick={() => handleDiscardDlqItem(item.id)}
                          className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          Descartar
                        </button>
                      </div>
                    </div>
                    <div className="text-xs bg-red-50 p-2 rounded text-red-700 border border-red-200">
                      <strong>Erro:</strong> {item.error}
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{item.retryCount} tentativas</span>
                      <span>Movido: {new Date(item.movedAt).toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
