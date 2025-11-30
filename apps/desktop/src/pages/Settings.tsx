import { useState } from 'react';
import { 
  Database, CheckCircle, AlertCircle, Settings as SettingsIcon, 
  ShoppingCart, Table, Package, Printer, Shield, HardDrive, 
  Activity, Building, DollarSign, Globe, Calendar, Image,
  Clock, FileText, Lock, History, Trash2, ChevronDown, ChevronUp,
  Cloud, RefreshCw, Upload, Wifi, WifiOff
} from 'lucide-react';

export default function SettingsPage() {
  const [migrationStatus, setMigrationStatus] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    database: true,
    sync: true,
    general: false,
    pdv: false,
    tables: false,
    inventory: false,
    printing: false,
    users: false,
    backup: false,
    advanced: false
  });

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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button className="p-4 bg-green-50 border-2 border-green-200 rounded-lg hover:bg-green-100 transition-colors text-left">
                  <div className="flex items-center gap-3 mb-2">
                    <HardDrive className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-green-900">Gerar Backup Completo</span>
                  </div>
                  <p className="text-sm text-green-700">Criar cópia de segurança agora</p>
                </button>

                <button className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-left">
                  <div className="flex items-center gap-3 mb-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-blue-900">Restaurar Backup</span>
                  </div>
                  <p className="text-sm text-blue-700">Recuperar dados de backup</p>
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pasta de Backup</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value="C:\BarManager\Backups"
                    readOnly
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                  <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
                    Alterar
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" defaultChecked />
                  <span className="text-sm text-gray-700">Backup automático diário às 02:00</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" />
                  <span className="text-sm text-gray-700">Manter últimos 7 backups</span>
                </label>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Histórico de Backups</h4>
                <p className="text-sm text-gray-600">Último backup: Hoje às 02:00</p>
                <p className="text-sm text-gray-600">Tamanho: 45.2 MB</p>
              </div>
            </div>
          </ConfigCard>

          {/* 9. Ajustes Avançados */}
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
