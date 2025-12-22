import { useState, useEffect } from 'react';
import { 
  Database, CheckCircle, AlertCircle, Settings as SettingsIcon, 
  ShoppingCart, Table, Package, Printer, Shield, HardDrive, 
  Activity, Building, DollarSign, Globe, Calendar, Image,
  Clock, FileText, Lock, History, Trash2, ChevronDown, ChevronUp,
  Cloud, RefreshCw, Upload, Wifi, WifiOff, Download, Users,
  CreditCard, Boxes, FileBox, Monitor, AlertTriangle, Laptop, 
  CheckSquare, XCircle
} from 'lucide-react';

// Interface para status detalhado de sync
interface SyncEntityStatus {
  name: string;
  icon: any;
  localCount: number;
  serverCount: number;
  pendingSync: number;
  lastSync: string | null;
  status: 'synced' | 'pending' | 'error' | 'unknown';
}

// Interface para conflitos
interface SyncConflict {
  id: string;
  entity: string;
  entity_id: string;
  local_data: string;
  server_data: string;
  local_timestamp: string;
  server_timestamp: string;
  created_at: string;
}

// Interface para dispositivos
interface ConnectedDevice {
  device_id: string;
  device_name: string;
  last_heartbeat: string;
  last_sync: string;
  connection_status: 'online' | 'away' | 'offline';
}

export default function SettingsPage() {
  const [migrationStatus, setMigrationStatus] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detailedSyncStatus, setDetailedSyncStatus] = useState<SyncEntityStatus[]>([]);
  const [deviceId, setDeviceId] = useState<string>('');
  const [lastFullSync, setLastFullSync] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [connectedDevices, setConnectedDevices] = useState<ConnectedDevice[]>([]);
  
  // Estados para Backup
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupStatus, setBackupStatus] = useState<{ type: 'success' | 'error' | 'info' | null; message: string }>({ type: null, message: '' });
  const [backupHistory, setBackupHistory] = useState<any[]>([]);
  const [backupPath, setBackupPath] = useState<string>('');
  
  // Estados para Reset de Dados
  const [resetLoading, setResetLoading] = useState(false);
  const [resetStatus, setResetStatus] = useState<{ type: 'success' | 'error' | 'info' | null; message: string }>({ type: null, message: '' });
  const [localDataCounts, setLocalDataCounts] = useState<Record<string, number>>({});
  const [serverDataCounts, setServerDataCounts] = useState<Record<string, number>>({});
  const [showResetConfirmModal, setShowResetConfirmModal] = useState<'local' | 'server' | 'mobile' | null>(null);
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    database: true,
    sync: true,
    syncDetails: false,
    conflicts: false,
    devices: false,
    general: false,
    pdv: false,
    tables: false,
    inventory: false,
    printing: false,
    users: false,
    backup: false,
    resetData: false,
    advanced: false
  });

  // Carregar status detalhado ao montar
  useEffect(() => {
    loadDetailedSyncStatus();
    loadBackupHistory();
    loadBackupPath();
  }, []);

  const loadBackupHistory = async () => {
    try {
      // @ts-ignore
      const history = await window.electronAPI?.backup?.history?.(10);
      if (Array.isArray(history)) {
        setBackupHistory(history);
      }
    } catch (error) {
      console.error('Erro ao carregar histórico de backups:', error);
    }
  };

  const loadBackupPath = async () => {
    try {
      // @ts-ignore
      const settings = await window.electronAPI?.settings?.get?.('backupPath');
      if (settings) {
        setBackupPath(settings);
      }
    } catch (error) {
      console.error('Erro ao carregar caminho de backup:', error);
    }
  };

  const handleCreateBackup = async () => {
    try {
      setBackupLoading(true);
      setBackupStatus({ type: 'info', message: 'Criando backup...' });
      
      // @ts-ignore
      const result = await window.electronAPI?.backup?.create?.({
        backupDir: backupPath || undefined,
        backupType: 'manual',
      });
      
      if (result?.success) {
        setBackupStatus({ 
          type: 'success', 
          message: `Backup criado com sucesso! Arquivo: ${result.fileName} (${formatFileSize(result.fileSize)})` 
        });
        await loadBackupHistory();
      } else {
        setBackupStatus({ 
          type: 'error', 
          message: result?.error || 'Erro ao criar backup' 
        });
      }
    } catch (error: any) {
      setBackupStatus({ 
        type: 'error', 
        message: error.message || 'Erro ao criar backup' 
      });
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestoreBackup = async () => {
    try {
      // @ts-ignore
      const fileResult = await window.electronAPI?.backup?.selectFile?.();
      
      if (!fileResult?.success || fileResult?.canceled) {
        return;
      }
      
      const confirmed = confirm(
        '⚠️ ATENÇÃO!\n\n' +
        'A restauração substituirá TODOS os dados atuais do sistema.\n\n' +
        'Certifique-se de que:\n' +
        '• Você tem um backup do estado atual\n' +
        '• Nenhum outro usuário está usando o sistema\n\n' +
        'O aplicativo será reiniciado após a restauração.\n\n' +
        'Deseja continuar?'
      );
      
      if (!confirmed) {
        return;
      }
      
      setBackupLoading(true);
      setBackupStatus({ type: 'info', message: 'Restaurando backup...' });
      
      // @ts-ignore
      const result = await window.electronAPI?.backup?.restore?.(fileResult.filePath);
      
      if (result?.success) {
        setBackupStatus({ 
          type: 'success', 
          message: 'Backup restaurado com sucesso! O aplicativo será reiniciado...' 
        });
        
        // Aguardar e recarregar a página
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setBackupStatus({ 
          type: 'error', 
          message: result?.error || 'Erro ao restaurar backup' 
        });
      }
    } catch (error: any) {
      setBackupStatus({ 
        type: 'error', 
        message: error.message || 'Erro ao restaurar backup' 
      });
    } finally {
      setBackupLoading(false);
    }
  };

  const handleSelectBackupDirectory = async () => {
    try {
      // @ts-ignore
      const result = await window.electronAPI?.backup?.selectDirectory?.();
      
      if (result?.success && result.directory) {
        setBackupPath(result.directory);
        // @ts-ignore
        await window.electronAPI?.settings?.set?.('backupPath', result.directory);
      }
    } catch (error) {
      console.error('Erro ao selecionar pasta:', error);
    }
  };

  const handleDeleteBackup = async (backupId: string, fileName: string) => {
    const confirmed = confirm(`Deseja excluir o backup "${fileName}"?\n\nEsta ação não pode ser desfeita.`);
    if (!confirmed) return;
    
    try {
      // @ts-ignore
      const result = await window.electronAPI?.backup?.delete?.(backupId, true);
      
      if (result?.success) {
        await loadBackupHistory();
        setBackupStatus({ type: 'success', message: 'Backup excluído com sucesso!' });
      } else {
        setBackupStatus({ type: 'error', message: result?.error || 'Erro ao excluir backup' });
      }
    } catch (error: any) {
      setBackupStatus({ type: 'error', message: error.message || 'Erro ao excluir backup' });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatBackupDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const loadDetailedSyncStatus = async () => {
    try {
      // @ts-ignore
      const status = await window.electronAPI?.sync?.getDetailedStatus?.();
      if (status?.success) {
        setDetailedSyncStatus(status.data?.entities || []);
        setLastFullSync(status.data?.lastFullSync || null);
      }
      
      // @ts-ignore
      const deviceResult = await window.electronAPI?.sync?.getDeviceId?.();
      if (deviceResult?.success) {
        setDeviceId(deviceResult.deviceId || '');
      }
      
      // Carregar conflitos
      await loadConflicts();
      
      // Carregar dispositivos conectados
      await loadConnectedDevices();
    } catch (error) {
      console.error('Erro ao carregar status de sync:', error);
    }
  };

  const loadConflicts = async () => {
    try {
      // @ts-ignore
      const result = await window.electronAPI?.sync?.getConflicts?.();
      if (result?.success) {
        setConflicts(result.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar conflitos:', error);
    }
  };

  const loadConnectedDevices = async () => {
    try {
      // @ts-ignore
      const result = await window.electronAPI?.sync?.getAllDevices?.();
      if (result?.success) {
        setConnectedDevices(result.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar dispositivos:', error);
    }
  };

  const handleResolveConflict = async (conflictId: string, resolution: 'keep_local' | 'keep_server') => {
    try {
      // @ts-ignore
      const result = await window.electronAPI?.sync?.resolveConflict?.(conflictId, resolution);
      if (result?.success) {
        await loadConflicts(); // Recarregar lista
      }
    } catch (error) {
      console.error('Erro ao resolver conflito:', error);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleFixUnitCost = async () => {
    try {
      setLoading(true);
      setMigrationStatus(null);
      // @ts-ignore
      const result = await window.electronAPI?.database?.fixUnitCost?.();
      setMigrationStatus(result);
    } catch (error: any) {
      setMigrationStatus({ 
        success: false, 
        error: error.message || 'Erro ao executar migração' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFullSync = async () => {
    try {
      setSyncLoading(true);
      setSyncStatus({ status: 'running', message: 'Iniciando sincronização completa...' });
      
      // @ts-ignore
      const result = await window.electronAPI?.sync?.pushFullInitialSync?.();
      
      if (result?.success) {
        setSyncStatus({
          status: 'success',
          message: 'Sincronização concluída com sucesso!',
          summary: result.summary
        });
        loadDetailedSyncStatus(); // Recarregar status
      } else {
        setSyncStatus({
          status: 'error',
          message: 'Erro durante a sincronização',
          summary: result?.summary
        });
      }
    } catch (error: any) {
      setSyncStatus({
        status: 'error',
        message: error.message || 'Erro ao sincronizar dados'
      });
    } finally {
      setSyncLoading(false);
    }
  };

  const handlePullFromServer = async () => {
    try {
      setSyncLoading(true);
      setSyncStatus({ status: 'running', message: 'Baixando dados do servidor...' });
      
      // @ts-ignore
      const result = await window.electronAPI?.sync?.fullPullFromServer?.();
      
      if (result?.success) {
        setSyncStatus({
          status: 'success',
          message: 'Download concluído com sucesso!',
          summary: result.stats
        });
        loadDetailedSyncStatus(); // Recarregar status
      } else {
        setSyncStatus({
          status: 'error',
          message: 'Erro ao baixar dados do servidor'
        });
      }
    } catch (error: any) {
      setSyncStatus({
        status: 'error',
        message: error.message || 'Erro ao baixar dados'
      });
    } finally {
      setSyncLoading(false);
    }
  };

  const handleCheckConnection = async () => {
    try {
      // @ts-ignore
      const isConnected = await window.electronAPI?.sync?.checkConnection?.();
      setSyncStatus({
        status: isConnected ? 'connected' : 'disconnected',
        message: isConnected ? 'Conectado ao servidor Railway' : 'Sem conexão com o servidor'
      });
    } catch (error) {
      setSyncStatus({
        status: 'disconnected',
        message: 'Não foi possível verificar conexão'
      });
    }
  };

  // ============================================
  // FUNÇÕES DE RESET DE DADOS
  // ============================================

  const loadLocalDataCounts = async () => {
    try {
      // @ts-ignore
      const counts = await window.electronAPI?.admin?.getLocalDataCounts?.();
      if (counts) {
        setLocalDataCounts(counts);
      }
    } catch (error) {
      console.error('Erro ao carregar contagem local:', error);
    }
  };

  const loadServerDataCounts = async () => {
    try {
      // @ts-ignore
      const counts = await window.electronAPI?.admin?.getServerDataCounts?.();
      if (counts && !counts.error) {
        setServerDataCounts(counts);
      }
    } catch (error) {
      console.error('Erro ao carregar contagem do servidor:', error);
    }
  };

  const handleResetLocalData = async () => {
    if (resetConfirmInput !== 'CONFIRMAR_RESET_LOCAL') {
      setResetStatus({ type: 'error', message: 'Digite o código de confirmação corretamente' });
      return;
    }

    try {
      setResetLoading(true);
      setResetStatus({ type: 'info', message: 'Zerando dados locais...' });

      // @ts-ignore
      const currentUser = await window.electronAPI?.auth?.getCurrentUser?.();
      const userId = currentUser?.id || 'unknown';

      // @ts-ignore
      const result = await window.electronAPI?.admin?.resetLocalData?.(userId, 'CONFIRMAR_RESET_LOCAL');

      if (result?.success) {
        const successMsg = `✅ Dados locais zerados com sucesso!\nBackup salvo em: ${result.backupPath || 'N/A'}`;
        setResetStatus({ type: 'success', message: successMsg });
        setShowResetConfirmModal(null);
        setResetConfirmInput('');
        loadLocalDataCounts();
        // Alert visual para garantir que o usuário veja
        setTimeout(() => alert(successMsg), 100);
      } else {
        const errorMsg = result?.error || 'Erro ao zerar dados';
        setResetStatus({ type: 'error', message: errorMsg });
        alert(`❌ Erro: ${errorMsg}`);
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Erro ao zerar dados locais';
      setResetStatus({ type: 'error', message: errorMsg });
      alert(`❌ Erro: ${errorMsg}`);
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetServerData = async () => {
    if (resetConfirmInput !== 'CONFIRMAR_RESET_DADOS') {
      setResetStatus({ type: 'error', message: 'Digite o código de confirmação corretamente' });
      return;
    }

    try {
      setResetLoading(true);
      setResetStatus({ type: 'info', message: 'Zerando dados do servidor...' });

      // @ts-ignore
      const result = await window.electronAPI?.admin?.resetServerData?.('CONFIRMAR_RESET_DADOS');

      if (result?.success) {
        const successMsg = '✅ Dados do servidor Railway zerados com sucesso!';
        setResetStatus({ type: 'success', message: successMsg });
        setShowResetConfirmModal(null);
        setResetConfirmInput('');
        loadServerDataCounts();
        setTimeout(() => alert(successMsg), 100);
      } else {
        const errorMsg = result?.error || 'Erro ao zerar dados do servidor';
        setResetStatus({ type: 'error', message: errorMsg });
        alert(`❌ Erro: ${errorMsg}`);
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Erro ao zerar dados do servidor';
      setResetStatus({ type: 'error', message: errorMsg });
      alert(`❌ Erro: ${errorMsg}`);
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetMobileData = async () => {
    if (resetConfirmInput !== 'CONFIRMAR_RESET_MOBILE') {
      setResetStatus({ type: 'error', message: 'Digite o código de confirmação corretamente' });
      return;
    }

    try {
      setResetLoading(true);
      setResetStatus({ type: 'info', message: 'Enviando comando de reset para o mobile...' });

      // @ts-ignore
      const result = await window.electronAPI?.admin?.resetMobileData?.('all', 'CONFIRMAR_RESET_MOBILE');

      if (result?.success) {
        const successMsg = `✅ ${result.message || 'Comando de reset enviado ao mobile!'}`;
        setResetStatus({ type: 'success', message: successMsg });
        setShowResetConfirmModal(null);
        setResetConfirmInput('');
        setTimeout(() => alert(successMsg), 100);
      } else {
        const errorMsg = result?.message || 'Erro ao enviar comando';
        setResetStatus({ type: 'error', message: errorMsg });
        alert(`❌ Erro: ${errorMsg}`);
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Erro ao resetar mobile';
      setResetStatus({ type: 'error', message: errorMsg });
      alert(`❌ Erro: ${errorMsg}`);
    } finally {
      setResetLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('pt-BR').format(num);
  };

  const ConfigCard = ({ 
    title, 
    icon: Icon, 
    children, 
    sectionKey 
  }: { 
    title: string; 
    icon: any; 
    children: React.ReactNode; 
    sectionKey: string;
  }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md">
      <button
        onClick={() => toggleSection(sectionKey)}
        className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 rounded-lg">
            <Icon className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
        {expandedSections[sectionKey] ? (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </button>
      
      {expandedSections[sectionKey] && (
        <div className="p-6 pt-0 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header Fixo */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <SettingsIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Configurações do Sistema</h1>
              <p className="text-sm text-gray-600">Gerencie todas as configurações e ajustes do BarManager Pro</p>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 gap-6">
          
          {/* 1. Manutenção do Banco de Dados */}
          <ConfigCard title="Manutenção do Banco de Dados" icon={Database} sectionKey="database">
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Corrigir Custos de Produtos em Vendas Antigas</h3>
                <p className="text-sm text-blue-800 mb-3">
                  Esta operação atualiza o custo unitário (unit_cost) em todos os itens de vendas que estão com valor zero ou nulo, 
                  utilizando o custo atual do produto (cost_unit). Isso é necessário para calcular corretamente os lucros e valores de reposição.
                </p>
                
                <button
                  onClick={handleFixUnitCost}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Executando Migração...
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4" />
                      Executar Migração
                    </>
                  )}
                </button>
              </div>
              
              {/* Resultado da Migração */}
              {migrationStatus && (
                <div className={`p-4 rounded-lg ${migrationStatus.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-start gap-3">
                    {migrationStatus.success ? (
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    
                    <div className="flex-1">
                      <h4 className={`font-semibold ${migrationStatus.success ? 'text-green-800' : 'text-red-800'}`}>
                        {migrationStatus.success ? 'Migração Concluída com Sucesso!' : 'Erro na Migração'}
                      </h4>
                      
                      {migrationStatus.success && (
                        <div className="mt-2 text-sm space-y-1">
                          <p className="text-gray-700">• Registros com custo zero/nulo antes: <strong>{migrationStatus.recordsBefore}</strong></p>
                          <p className="text-gray-700">• Registros atualizados: <strong>{migrationStatus.recordsUpdated}</strong></p>
                          <p className="text-gray-700">• Registros com custo zero/nulo após: <strong>{migrationStatus.recordsAfter}</strong></p>
                          
                          {migrationStatus.recordsUpdated > 0 && (
                            <p className="mt-2 text-green-700 font-medium">
                              ✅ Os cálculos de lucro e reposição agora estão corretos!
                            </p>
                          )}
                          
                          {migrationStatus.recordsUpdated === 0 && (
                            <p className="mt-2 text-blue-700 font-medium">
                              ℹ️ Nenhum registro precisava ser atualizado.
                            </p>
                          )}
                        </div>
                      )}
                      
                      {!migrationStatus.success && (
                        <p className="mt-1 text-sm text-red-700">{migrationStatus.error}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-semibold mb-1">⚠️ Aviso Importante</p>
                    <p>Esta migração só precisa ser executada <strong>uma vez</strong> após atualizar o sistema.</p>
                    <p className="mt-1">Vendas futuras já serão criadas com o custo correto automaticamente.</p>
                  </div>
                </div>
              </div>
            </div>
          </ConfigCard>

          {/* 2. Sincronização com Railway (Cloud) */}
          <ConfigCard title="Sincronização com Nuvem (Railway)" icon={Cloud} sectionKey="sync">
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Sincronização Inicial Completa</h3>
                <p className="text-sm text-blue-800 mb-3">
                  Esta operação envia <strong>TODOS</strong> os dados do banco local (categorias, produtos, clientes, fornecedores) 
                  para o servidor Railway. Use quando o banco na nuvem estiver vazio ou para recriar os dados.
                </p>
                
                <div className="flex gap-3">
                  <button
                    onClick={handleFullSync}
                    disabled={syncLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                  >
                    {syncLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Sincronizando...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Enviar Todos os Dados
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleCheckConnection}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2 transition-colors"
                  >
                    <Wifi className="w-4 h-4" />
                    Verificar Conexão
                  </button>
                </div>
              </div>

              {/* Status da Sincronização */}
              {syncStatus && (
                <div className={`p-4 rounded-lg ${
                  syncStatus.status === 'success' || syncStatus.status === 'connected' 
                    ? 'bg-green-50 border border-green-200' 
                    : syncStatus.status === 'error' || syncStatus.status === 'disconnected'
                    ? 'bg-red-50 border border-red-200'
                    : 'bg-blue-50 border border-blue-200'
                }`}>
                  <div className="flex items-start gap-3">
                    {syncStatus.status === 'success' || syncStatus.status === 'connected' ? (
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : syncStatus.status === 'running' ? (
                      <RefreshCw className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5 animate-spin" />
                    ) : syncStatus.status === 'disconnected' ? (
                      <WifiOff className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    
                    <div className="flex-1">
                      <h4 className={`font-semibold ${
                        syncStatus.status === 'success' || syncStatus.status === 'connected'
                          ? 'text-green-800' 
                          : syncStatus.status === 'running'
                          ? 'text-blue-800'
                          : 'text-red-800'
                      }`}>
                        {syncStatus.message}
                      </h4>
                      
                      {syncStatus.summary && (
                        <div className="mt-2 text-sm space-y-1">
                          {Object.entries(syncStatus.summary).map(([entity, stats]: [string, any]) => (
                            <p key={entity} className="text-gray-700">
                              • <strong>{entity}</strong>: {stats.sent} enviados, {stats.errors} erros
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-semibold mb-1">⚠️ Importante</p>
                    <p>A sincronização automática já ocorre a cada 30 segundos para novos dados.</p>
                    <p className="mt-1">Use "Enviar Todos os Dados" apenas para <strong>sincronização inicial</strong> ou para restaurar dados.</p>
                  </div>
                </div>
              </div>

              {/* Botão de Download do Servidor */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 mb-2">Baixar Dados do Servidor</h3>
                <p className="text-sm text-green-800 mb-3">
                  Baixa todos os dados do servidor Railway para este dispositivo. 
                  Use quando conectar um novo PC ou após reinstalar o sistema.
                </p>
                <button
                  onClick={handlePullFromServer}
                  disabled={syncLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                >
                  {syncLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Baixando...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Baixar do Servidor
                    </>
                  )}
                </button>
              </div>

              {/* Informações do Dispositivo */}
              {deviceId && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <Monitor className="w-4 h-4" />
                    Informações do Dispositivo
                  </h3>
                  <div className="text-sm text-gray-700 space-y-1">
                    <p><strong>ID do Dispositivo:</strong> {deviceId}</p>
                    {lastFullSync && (
                      <p><strong>Última Sincronização Completa:</strong> {new Date(lastFullSync).toLocaleString('pt-BR')}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </ConfigCard>

          {/* 2.5 Detalhes de Sincronização por Entidade */}
          <ConfigCard title="Status Detalhado por Módulo" icon={Activity} sectionKey="syncDetails">
            <div className="space-y-3">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-600">Status de sincronização de cada módulo do sistema.</p>
                <button
                  onClick={loadDetailedSyncStatus}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Atualizar
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { name: 'Produtos', icon: Package, key: 'products' },
                  { name: 'Categorias', icon: FileBox, key: 'categories' },
                  { name: 'Clientes', icon: Users, key: 'customers' },
                  { name: 'Fornecedores', icon: Building, key: 'suppliers' },
                  { name: 'Vendas', icon: ShoppingCart, key: 'sales' },
                  { name: 'Caixa', icon: CreditCard, key: 'cash_boxes' },
                  { name: 'Estoque', icon: Boxes, key: 'inventory' },
                  { name: 'Dívidas', icon: FileText, key: 'debts' },
                  { name: 'Mesas', icon: Table, key: 'tables' },
                  { name: 'Compras', icon: Download, key: 'purchases' },
                ].map((entity) => {
                  const status = detailedSyncStatus.find(s => s.name === entity.key);
                  const Icon = entity.icon;
                  return (
                    <div 
                      key={entity.key}
                      className={`p-3 rounded-lg border ${
                        status?.status === 'synced' ? 'bg-green-50 border-green-200' :
                        status?.status === 'pending' ? 'bg-yellow-50 border-yellow-200' :
                        status?.status === 'error' ? 'bg-red-50 border-red-200' :
                        'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={`w-4 h-4 ${
                          status?.status === 'synced' ? 'text-green-600' :
                          status?.status === 'pending' ? 'text-yellow-600' :
                          status?.status === 'error' ? 'text-red-600' :
                          'text-gray-600'
                        }`} />
                        <span className="font-medium text-sm">{entity.name}</span>
                        {status?.status === 'synced' && <CheckCircle className="w-3 h-3 text-green-600 ml-auto" />}
                        {status?.status === 'pending' && <Clock className="w-3 h-3 text-yellow-600 ml-auto" />}
                        {status?.status === 'error' && <AlertCircle className="w-3 h-3 text-red-600 ml-auto" />}
                      </div>
                      <div className="text-xs text-gray-600 space-y-0.5">
                        <p>Local: {status?.localCount ?? '-'}</p>
                        <p>Pendentes: {status?.pendingSync ?? 0}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </ConfigCard>

          {/* 2.6 Conflitos de Sincronização (FASE 3) */}
          <ConfigCard title="Conflitos de Sincronização" icon={AlertTriangle} sectionKey="conflicts">
            <div className="space-y-3">
              <p className="text-sm text-gray-600 mb-4">
                Conflitos ocorrem quando o mesmo registro é alterado em diferentes dispositivos.
              </p>
              
              {conflicts.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  <p>Nenhum conflito pendente</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {conflicts.map((conflict) => (
                    <div 
                      key={conflict.id}
                      className="p-3 rounded-lg border border-orange-200 bg-orange-50"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-medium text-sm">{conflict.entity}</span>
                          <span className="text-xs text-gray-500 ml-2">ID: {conflict.entity_id.substring(0, 8)}...</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(conflict.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 mb-2">
                        <p>Local: {new Date(conflict.local_timestamp).toLocaleString('pt-BR')}</p>
                        <p>Servidor: {new Date(conflict.server_timestamp).toLocaleString('pt-BR')}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleResolveConflict(conflict.id, 'keep_local')}
                          className="flex-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center justify-center gap-1"
                        >
                          <Laptop className="w-3 h-3" />
                          Manter Local
                        </button>
                        <button
                          onClick={() => handleResolveConflict(conflict.id, 'keep_server')}
                          className="flex-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 flex items-center justify-center gap-1"
                        >
                          <Cloud className="w-3 h-3" />
                          Usar Servidor
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ConfigCard>

          {/* 2.7 Dispositivos Conectados (FASE 3) */}
          <ConfigCard title="Dispositivos Conectados" icon={Laptop} sectionKey="devices">
            <div className="space-y-3">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-600">Dispositivos que acessaram o sistema recentemente.</p>
                <button
                  onClick={loadConnectedDevices}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Atualizar
                </button>
              </div>
              
              <div className="bg-blue-50 p-3 rounded-lg mb-4">
                <p className="text-sm text-blue-700">
                  <Monitor className="w-4 h-4 inline mr-1" />
                  Este dispositivo: <span className="font-mono font-medium">{deviceId || 'N/A'}</span>
                </p>
              </div>
              
              {connectedDevices.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <Laptop className="w-8 h-8 mx-auto mb-2" />
                  <p>Nenhum dispositivo registrado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {connectedDevices.map((device) => (
                    <div 
                      key={device.device_id}
                      className={`p-3 rounded-lg border ${
                        device.connection_status === 'online' ? 'bg-green-50 border-green-200' :
                        device.connection_status === 'away' ? 'bg-yellow-50 border-yellow-200' :
                        'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            device.connection_status === 'online' ? 'bg-green-500' :
                            device.connection_status === 'away' ? 'bg-yellow-500' :
                            'bg-gray-400'
                          }`} />
                          <span className="font-medium text-sm">{device.device_name || 'Dispositivo'}</span>
                          {device.device_id === deviceId && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Este</span>
                          )}
                        </div>
                        <span className={`text-xs ${
                          device.connection_status === 'online' ? 'text-green-600' :
                          device.connection_status === 'away' ? 'text-yellow-600' :
                          'text-gray-500'
                        }`}>
                          {device.connection_status === 'online' ? 'Online' :
                           device.connection_status === 'away' ? 'Ausente' : 'Offline'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        <span className="font-mono">{device.device_id.substring(0, 12)}...</span>
                        <span className="ml-2">Último sync: {device.last_sync ? new Date(device.last_sync).toLocaleString('pt-BR') : 'Nunca'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ConfigCard>

          {/* 3. Configurações Gerais */}
          <ConfigCard title="Configurações Gerais do Sistema" icon={SettingsIcon} sectionKey="general">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Building className="w-4 h-4 inline mr-2" />
                  Nome do Estabelecimento
                </label>
                <input
                  type="text"
                  placeholder="BarManager Pro"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <DollarSign className="w-4 h-4 inline mr-2" />
                  Moeda Padrão
                </label>
                <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option value="FCFA">FCFA - Franco CFA</option>
                  <option value="USD">USD - Dólar</option>
                  <option value="EUR">EUR - Euro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-2" />
                  Formato de Data
                </label>
                <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Globe className="w-4 h-4 inline mr-2" />
                  Idioma
                </label>
                <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option value="pt-BR">Português (Brasil)</option>
                  <option value="pt-PT">Português (Portugal)</option>
                  <option value="en">English</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Image className="w-4 h-4 inline mr-2" />
                  Logo da Empresa
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors cursor-pointer">
                  <Image className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">Clique para fazer upload do logo</p>
                  <p className="text-xs text-gray-500 mt-1">PNG, JPG até 2MB</p>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" />
                  <span className="text-sm text-gray-700">Permitir vendas com estoque negativo</span>
                </label>
              </div>
            </div>
          </ConfigCard>

          {/* 3. Configurações do PDV */}
          <ConfigCard title="Configurações do PDV" icon={ShoppingCart} sectionKey="pdv">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Modo de Operação</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                    <input type="radio" name="pdv-mode" value="simple" className="mr-3" />
                    <span className="text-sm font-medium">PDV Simples</span>
                  </label>
                  <label className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                    <input type="radio" name="pdv-mode" value="tables" className="mr-3" defaultChecked />
                    <span className="text-sm font-medium">PDV com Mesas</span>
                  </label>
                  <label className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                    <input type="radio" name="pdv-mode" value="commands" className="mr-3" />
                    <span className="text-sm font-medium">PDV com Comandas</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Limite Mínimo de Caixa</label>
                  <input
                    type="number"
                    placeholder="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" defaultChecked />
                  <span className="text-sm text-gray-700">Abertura automática do caixa ao iniciar o dia</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" defaultChecked />
                  <span className="text-sm text-gray-700">Permitir desconto manual no PDV</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" />
                  <span className="text-sm text-gray-700">Ativar taxa de serviço automática</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" />
                  <span className="text-sm text-gray-700">Ativar gorjetas</span>
                </label>
              </div>
            </div>
          </ConfigCard>

          {/* 4. Configurações de Mesas */}
          <ConfigCard title="Configurações de Mesas e Atendimento" icon={Table} sectionKey="tables">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Número de Mesas</label>
                  <input
                    type="number"
                    placeholder="10"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Capacidade Padrão por Mesa</label>
                  <input
                    type="number"
                    placeholder="4"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Timeout de Mesa (minutos)</label>
                  <input
                    type="number"
                    placeholder="120"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" defaultChecked />
                  <span className="text-sm text-gray-700">Permitir contas separadas por cliente</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" defaultChecked />
                  <span className="text-sm text-gray-700">Permitir adicionar clientes não cadastrados</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" />
                  <span className="text-sm text-gray-700">Habilitar transferência de pedidos entre mesas</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" />
                  <span className="text-sm text-gray-700">Liberar mesa automaticamente após timeout</span>
                </label>
              </div>
            </div>
          </ConfigCard>

          {/* 5. Configurações de Estoque */}
          <ConfigCard title="Configurações de Estoque e Produtos" icon={Package} sectionKey="inventory">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Política de Cálculo de Custo</label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="average">Custo Médio</option>
                    <option value="standard">Custo Padrão</option>
                    <option value="batch">Custo por Lote</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Prazo de Alerta de Vencimento (dias)</label>
                  <input
                    type="number"
                    placeholder="30"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" defaultChecked />
                  <span className="text-sm text-gray-700">Notificar quando atingir estoque mínimo</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" defaultChecked />
                  <span className="text-sm text-gray-700">Bloquear vendas de produtos inativos</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" />
                  <span className="text-sm text-gray-700">Alerta de produtos próximos ao vencimento</span>
                </label>
              </div>
            </div>
          </ConfigCard>

          {/* 6. Configurações de Impressão */}
          <ConfigCard title="Configurações de Impressão" icon={Printer} sectionKey="printing">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Impressora Padrão</label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option>Selecione uma impressora</option>
                    <option>Impressora Térmica</option>
                    <option>Impressora Principal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Modelo de Impressão</label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option>Resumo</option>
                    <option>Detalhado</option>
                    <option>PDV</option>
                    <option>Cozinha</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" />
                  <span className="text-sm text-gray-700">Impressão automática ao fechar venda</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" />
                  <span className="text-sm text-gray-700">Gerar segunda via automaticamente</span>
                </label>
              </div>
            </div>
          </ConfigCard>

          {/* 7. Usuários e Permissões */}
          <ConfigCard title="Configurações de Usuários e Permissões" icon={Shield} sectionKey="users">
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Lock className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-900">Controle de Acesso</h3>
                </div>
                <p className="text-sm text-blue-800 mb-3">
                  Gerencie permissões específicas para cada função crítica do sistema.
                </p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" />
                    <span className="text-sm text-gray-700">Permitir exclusão de vendas (apenas admin)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" />
                    <span className="text-sm text-gray-700">Permitir reabertura de caixa (apenas admin)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" />
                    <span className="text-sm text-gray-700">Permitir alteração manual de estoque (gerente+)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" />
                    <span className="text-sm text-gray-700">Permitir aplicar descontos (gerente+)</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Gerenciar Usuários
                </button>
                <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Ver Auditoria
                </button>
              </div>
            </div>
          </ConfigCard>

          {/* 8. Backup e Restauração */}
          <ConfigCard title="Backup e Restauração" icon={HardDrive} sectionKey="backup">
            <div className="space-y-6">
              {/* Status Message */}
              {backupStatus.type && (
                <div className={`p-4 rounded-lg border ${
                  backupStatus.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
                  backupStatus.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
                  'bg-blue-50 border-blue-200 text-blue-800'
                }`}>
                  <div className="flex items-center gap-2">
                    {backupStatus.type === 'success' && <CheckCircle className="w-5 h-5" />}
                    {backupStatus.type === 'error' && <AlertCircle className="w-5 h-5" />}
                    {backupStatus.type === 'info' && <RefreshCw className="w-5 h-5 animate-spin" />}
                    <span className="text-sm font-medium">{backupStatus.message}</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                  onClick={handleCreateBackup}
                  disabled={backupLoading}
                  className="p-4 bg-green-50 border-2 border-green-200 rounded-lg hover:bg-green-100 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <HardDrive className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-green-900">
                      {backupLoading ? 'Criando...' : 'Gerar Backup Completo'}
                    </span>
                  </div>
                  <p className="text-sm text-green-700">Criar cópia de segurança do banco de dados</p>
                </button>

                <button 
                  onClick={handleRestoreBackup}
                  disabled={backupLoading}
                  className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Upload className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-blue-900">
                      {backupLoading ? 'Restaurando...' : 'Restaurar Backup'}
                    </span>
                  </div>
                  <p className="text-sm text-blue-700">Recuperar dados de um arquivo de backup</p>
                </button>
              </div>

              {/* Backup Path */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pasta de Backup</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={backupPath || 'Documentos/BarManager-Backups (padrão)'}
                    readOnly
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                  />
                  <button 
                    onClick={handleSelectBackupDirectory}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Alterar
                  </button>
                </div>
              </div>

              {/* Backup History */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-semibold text-gray-900">Histórico de Backups</h4>
                  <button 
                    onClick={loadBackupHistory}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    <RefreshCw className="w-4 h-4 inline mr-1" />
                    Atualizar
                  </button>
                </div>
                
                {backupHistory.length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhum backup encontrado</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {backupHistory.map((backup) => (
                      <div 
                        key={backup.id}
                        className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {backup.status === 'completed' ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-red-500" />
                            )}
                            <span className="text-sm font-medium text-gray-900">
                              {backup.file_name}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              backup.backup_type === 'manual' 
                                ? 'bg-blue-100 text-blue-700' 
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {backup.backup_type === 'manual' ? 'Manual' : 'Automático'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {formatBackupDate(backup.created_at)} • {formatFileSize(backup.file_size)}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteBackup(backup.id, backup.file_name)}
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                          title="Excluir backup"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Info Box */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-amber-900 mb-1">Importante</h4>
                    <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
                      <li>Faça backups regulares para evitar perda de dados</li>
                      <li>Mantenha os arquivos de backup em local seguro</li>
                      <li>A restauração substituirá todos os dados atuais</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </ConfigCard>

          {/* 9. Reset de Dados (Admin) */}
          <ConfigCard title="Reset de Dados (Administração)" icon={Trash2} sectionKey="resetData">
            <div className="space-y-6">
              {/* Aviso de perigo */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-red-900 mb-1">⚠️ ZONA DE PERIGO</h4>
                    <p className="text-sm text-red-800">
                      As operações abaixo são <strong>irreversíveis</strong> e apagarão dados permanentemente.
                      Usuários e permissões serão preservados. Faça backup antes de continuar.
                    </p>
                  </div>
                </div>
              </div>

              {/* Status do Reset */}
              {resetStatus.type && (
                <div className={`p-4 rounded-lg border ${
                  resetStatus.type === 'success' ? 'bg-green-50 border-green-200' :
                  resetStatus.type === 'error' ? 'bg-red-50 border-red-200' :
                  'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex items-center gap-2">
                    {resetStatus.type === 'success' ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : resetStatus.type === 'error' ? (
                      <XCircle className="w-5 h-5 text-red-600" />
                    ) : (
                      <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                    )}
                    <span className={`font-medium ${
                      resetStatus.type === 'success' ? 'text-green-800' :
                      resetStatus.type === 'error' ? 'text-red-800' :
                      'text-blue-800'
                    }`}>
                      {resetStatus.message}
                    </span>
                  </div>
                </div>
              )}

              {/* Botões de Carregar Contagens */}
              <div className="flex gap-3">
                <button
                  onClick={loadLocalDataCounts}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
                >
                  <Database className="w-4 h-4" />
                  Carregar Dados Locais
                </button>
                <button
                  onClick={loadServerDataCounts}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
                >
                  <Cloud className="w-4 h-4" />
                  Carregar Dados do Servidor
                </button>
              </div>

              {/* Grid de Opções de Reset */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Reset Local */}
                <div className="p-4 bg-orange-50 border-2 border-orange-300 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <Database className="w-6 h-6 text-orange-600" />
                    <h3 className="font-semibold text-orange-900">Zerar Dados Locais</h3>
                  </div>
                  <p className="text-sm text-orange-800 mb-3">
                    Apaga todos os dados do banco local do Electron (vendas, produtos, clientes, etc.)
                  </p>
                  
                  {Object.keys(localDataCounts).length > 0 && (
                    <div className="mb-3 p-2 bg-orange-100 rounded text-xs text-orange-800">
                      <strong>Registros a serem deletados:</strong>
                      <div className="grid grid-cols-2 gap-1 mt-1">
                        {Object.entries(localDataCounts)
                          .filter(([key]) => !key.startsWith('_'))
                          .slice(0, 8)
                          .map(([key, count]) => (
                            <span key={key}>{key}: {formatNumber(count as number)}</span>
                          ))}
                      </div>
                      <div className="mt-1 text-green-700">
                        ✓ Usuários preservados: {formatNumber(localDataCounts['_preserved_users'] || 0)}
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={() => setShowResetConfirmModal('local')}
                    disabled={resetLoading}
                    className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400 transition-colors"
                  >
                    Zerar Banco Local
                  </button>
                </div>

                {/* Reset Servidor */}
                <div className="p-4 bg-red-50 border-2 border-red-300 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <Cloud className="w-6 h-6 text-red-600" />
                    <h3 className="font-semibold text-red-900">Zerar Servidor Railway</h3>
                  </div>
                  <p className="text-sm text-red-800 mb-3">
                    Apaga todos os dados do servidor Railway (afeta TODOS os dispositivos conectados)
                  </p>
                  
                  {Object.keys(serverDataCounts).length > 0 && !serverDataCounts.error && (
                    <div className="mb-3 p-2 bg-red-100 rounded text-xs text-red-800">
                      <strong>Registros no servidor:</strong>
                      <div className="grid grid-cols-2 gap-1 mt-1">
                        {Object.entries(serverDataCounts)
                          .filter(([key]) => !key.startsWith('_'))
                          .slice(0, 8)
                          .map(([key, count]) => (
                            <span key={key}>{key}: {formatNumber(count as number)}</span>
                          ))}
                      </div>
                      <div className="mt-1 text-green-700">
                        ✓ Usuários preservados: {formatNumber(serverDataCounts['_preserved_users'] || 0)}
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={() => setShowResetConfirmModal('server')}
                    disabled={resetLoading}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors"
                  >
                    Zerar Servidor
                  </button>
                </div>

                {/* Reset Mobile */}
                <div className="p-4 bg-purple-50 border-2 border-purple-300 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <Monitor className="w-6 h-6 text-purple-600" />
                    <h3 className="font-semibold text-purple-900">Zerar App Mobile</h3>
                  </div>
                  <p className="text-sm text-purple-800 mb-3">
                    Envia comando para o app Vendas-Mobile limpar seus dados locais
                  </p>
                  <p className="text-xs text-purple-600 mb-3">
                    O mobile deve estar conectado ao mesmo servidor
                  </p>
                  
                  <button
                    onClick={() => setShowResetConfirmModal('mobile')}
                    disabled={resetLoading}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors"
                  >
                    Zerar Mobile
                  </button>
                </div>
              </div>

              {/* Dados Preservados */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex gap-2">
                  <Shield className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-green-900 mb-1">Dados Preservados</h4>
                    <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
                      <li>Usuários e credenciais de login</li>
                      <li>Filiais (branches)</li>
                      <li>Permissões e roles</li>
                      <li>Configurações do sistema</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </ConfigCard>

          {/* Modal de Confirmação de Reset */}
          {showResetConfirmModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-red-100 rounded-full">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Confirmar Reset de Dados
                    </h3>
                    <p className="text-sm text-gray-500">
                      {showResetConfirmModal === 'local' && 'Banco de dados local'}
                      {showResetConfirmModal === 'server' && 'Servidor Railway'}
                      {showResetConfirmModal === 'mobile' && 'App Vendas-Mobile'}
                    </p>
                  </div>
                </div>

                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">
                    Esta ação é <strong>IRREVERSÍVEL</strong>. Todos os dados serão apagados permanentemente.
                    Usuários e permissões serão mantidos.
                  </p>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Digite o código de confirmação:
                  </label>
                  <input
                    type="text"
                    value={resetConfirmInput}
                    onChange={(e) => setResetConfirmInput(e.target.value.toUpperCase())}
                    placeholder={
                      showResetConfirmModal === 'local' ? 'CONFIRMAR_RESET_LOCAL' :
                      showResetConfirmModal === 'server' ? 'CONFIRMAR_RESET_DADOS' :
                      'CONFIRMAR_RESET_MOBILE'
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 font-mono text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Código: <code className="bg-gray-100 px-1 rounded">
                      {showResetConfirmModal === 'local' ? 'CONFIRMAR_RESET_LOCAL' :
                       showResetConfirmModal === 'server' ? 'CONFIRMAR_RESET_DADOS' :
                       'CONFIRMAR_RESET_MOBILE'}
                    </code>
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowResetConfirmModal(null);
                      setResetConfirmInput('');
                    }}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      if (showResetConfirmModal === 'local') handleResetLocalData();
                      else if (showResetConfirmModal === 'server') handleResetServerData();
                      else if (showResetConfirmModal === 'mobile') handleResetMobileData();
                    }}
                    disabled={resetLoading || (
                      (showResetConfirmModal === 'local' && resetConfirmInput !== 'CONFIRMAR_RESET_LOCAL') ||
                      (showResetConfirmModal === 'server' && resetConfirmInput !== 'CONFIRMAR_RESET_DADOS') ||
                      (showResetConfirmModal === 'mobile' && resetConfirmInput !== 'CONFIRMAR_RESET_MOBILE')
                    )}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {resetLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Confirmar Reset
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 10. Ajustes Avançados */}
          <ConfigCard title="Ajustes Avançados e Logs" icon={Activity} sectionKey="advanced">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors text-left">
                  <div className="flex items-center gap-3 mb-2">
                    <FileText className="w-5 h-5 text-yellow-600" />
                    <span className="font-semibold text-yellow-900">Visualizar Logs</span>
                  </div>
                  <p className="text-sm text-yellow-700">Ver registros do sistema</p>
                </button>

                <button className="p-4 bg-purple-50 border-2 border-purple-200 rounded-lg hover:bg-purple-100 transition-colors text-left">
                  <div className="flex items-center gap-3 mb-2">
                    <Trash2 className="w-5 h-5 text-purple-600" />
                    <span className="font-semibold text-purple-900">Limpar Cache</span>
                  </div>
                  <p className="text-sm text-purple-700">Otimizar desempenho</p>
                </button>

                <button className="p-4 bg-indigo-50 border-2 border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors text-left">
                  <div className="flex items-center gap-3 mb-2">
                    <Database className="w-5 h-5 text-indigo-600" />
                    <span className="font-semibold text-indigo-900">Reindexar Banco</span>
                  </div>
                  <p className="text-sm text-indigo-700">Otimizar consultas</p>
                </button>

                <button className="p-4 bg-gray-50 border-2 border-gray-200 rounded-lg hover:bg-gray-100 transition-colors text-left">
                  <div className="flex items-center gap-3 mb-2">
                    <Activity className="w-5 h-5 text-gray-600" />
                    <span className="font-semibold text-gray-900">Desempenho</span>
                  </div>
                  <p className="text-sm text-gray-700">Ver estatísticas</p>
                </button>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-red-900 mb-1">⚠️ Zona de Perigo</h4>
                    <p className="text-sm text-red-800 mb-3">
                      As operações abaixo podem afetar o funcionamento do sistema. Use com cautela.
                    </p>
                    <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm">
                      Reset Seguro do Sistema
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </ConfigCard>

        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>BarManager Pro v1.0.0 • Todas as configurações são salvas automaticamente</p>
        </div>
      </div>
    </div>
  );
}
