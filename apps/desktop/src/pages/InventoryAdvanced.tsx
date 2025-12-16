import React, { useState, useEffect } from 'react';
import { 
  Search, AlertTriangle, Package, TrendingUp, TrendingDown, Edit, DollarSign, 
  BarChart3, Box, Archive, AlertCircle, Activity, Calendar, FileText, Plus, Minus,
  XCircle, Settings, RefreshCw, CheckCircle, Filter, ArrowUpDown, Eye, X
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import SearchableSelect from '../components/common/SearchableSelect';

interface InventoryItem {
  id: string;
  product_id: string;
  branch_id: string;
  product_name: string;
  product_sku: string;
  qty_units: number;
  closed_boxes: number;
  open_box_units: number;
  low_stock_alert: number;
  units_per_box: number;
  dose_enabled: boolean;
  doses_per_bottle: number;
  total_bottles: number;
  consumption_avg_7d: number;
  consumption_avg_15d: number;
  consumption_avg_30d: number;
  days_until_stockout: number | null;
  suggested_reorder: number;
  batch_number?: string;
  expiry_date?: string;
  updated_at: string;
  // Campos de valorização
  cost_price?: number;
  sale_price?: number;
}

interface StockMovement {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  movement_type: string;
  quantity: number;
  quantity_before: number;
  quantity_after: number;
  closed_boxes_before: number;
  closed_boxes_after: number;
  open_box_before: number;
  open_box_after: number;
  box_opened_automatically: boolean;
  reason: string;
  responsible: string;
  terminal: string;
  created_at: string;
  notes?: string;
}

type TabType = 'inventory' | 'movements' | 'dashboard' | 'valuation';

const InventoryAdvanced: React.FC = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('inventory');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [filterOutOfStock, setFilterOutOfStock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sortField, setSortField] = useState<string>('product_name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Modais
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showLossModal, setShowLossModal] = useState(false);
  const [showBreakageModal, setShowBreakageModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [showMovementDetailsModal, setShowMovementDetailsModal] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null);

  // Filtros de Movimentação
  const [movementSearchTerm, setMovementSearchTerm] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('all');
  const [movementDateFilter, setMovementDateFilter] = useState<string>('all');

  // Formulários
  const [adjustmentForm, setAdjustmentForm] = useState({
    quantity: '',
    reason: '',
    responsible: 'admin',
    notes: '',
  });

  useEffect(() => {
    loadInventory();
    if (activeTab === 'movements') {
      loadMovements();
    }
    
    // Listener para atualizar inventário após sincronização
    // @ts-ignore
    const unsubscribeSyncComplete = window.electronAPI?.sync?.onSyncComplete?.((data: any) => {
      console.log('📦 Sync completed, reloading inventory...', data);
      loadInventory();
      if (activeTab === 'movements') {
        loadMovements();
      }
    });
    
    return () => {
      if (unsubscribeSyncComplete) {
        unsubscribeSyncComplete();
      }
    };
  }, [activeTab]);

  const loadInventory = async () => {
    setLoading(true);
    try {
      // @ts-ignore
      const data = await window.electronAPI?.inventory?.list?.({ branchId: 'main-branch' });
      setInventory(Array.isArray(data) ? data : []);
      
      // Calcular consumo e previsões para cada produto
      for (const item of data) {
        await calculateForecast(item.product_id);
      }
      
      // Recarregar após cálculos
      // @ts-ignore
      const updatedData = await window.electronAPI?.inventory?.list?.({ branchId: 'main-branch' });
      setInventory(Array.isArray(updatedData) ? updatedData : []);
    } catch (error: any) {
      console.error('Erro ao carregar estoque:', error);
      toast.error(error.message || 'Erro ao carregar estoque');
      setInventory([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMovements = async () => {
    try {
      // @ts-ignore
      const data = await window.electronAPI?.inventory?.getMovements?.({ branchId: 'main-branch' });
      setMovements(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Erro ao carregar movimentações:', error);
      toast.error('Erro ao carregar movimentações');
      setMovements([]);
    }
  };

  const calculateForecast = async (productId: string) => {
    try {
      // @ts-ignore
      await window.electronAPI?.inventory?.calculateConsumption?.(productId, 'main-branch');
    } catch (error) {
      console.error('Erro ao calcular previsão:', error);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortedInventory = () => {
    let filtered = [...inventory];

    // Aplicar filtros
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.product_sku.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterLowStock) {
      filtered = filtered.filter(item => item.qty_units <= item.low_stock_alert && item.qty_units > 0);
    }

    if (filterOutOfStock) {
      filtered = filtered.filter(item => item.qty_units === 0);
    }

    // Aplicar ordenação
    filtered.sort((a, b) => {
      let aVal: any = a[sortField as keyof InventoryItem];
      let bVal: any = b[sortField as keyof InventoryItem];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return filtered;
  };

  // Filtrar movimentações
  const filteredMovements = movements.filter((mov) => {
    // Filtro de busca
    if (movementSearchTerm) {
      const searchLower = movementSearchTerm.toLowerCase();
      const matchesSearch = 
        mov.product_name.toLowerCase().includes(searchLower) ||
        mov.product_sku.toLowerCase().includes(searchLower) ||
        mov.responsible.toLowerCase().includes(searchLower) ||
        mov.reason.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Filtro por tipo
    if (movementTypeFilter !== 'all' && mov.movement_type !== movementTypeFilter) {
      return false;
    }

    // Filtro por data
    if (movementDateFilter !== 'all') {
      const movDate = new Date(mov.created_at);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - movDate.getTime()) / (1000 * 60 * 60 * 24));

      switch (movementDateFilter) {
        case 'today':
          if (daysDiff > 0) return false;
          break;
        case 'week':
          if (daysDiff > 7) return false;
          break;
        case 'month':
          if (daysDiff > 30) return false;
          break;
        case 'quarter':
          if (daysDiff > 90) return false;
          break;
      }
    }

    return true;
  });

  const openAdjustModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setAdjustmentForm({ quantity: '', reason: '', responsible: 'admin', notes: '' });
    setShowAdjustModal(true);
  };

  const openLossModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setAdjustmentForm({ quantity: '', reason: '', responsible: 'admin', notes: '' });
    setShowLossModal(true);
  };

  const openBreakageModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setAdjustmentForm({ quantity: '', reason: '', responsible: 'admin', notes: '' });
    setShowBreakageModal(true);
  };

  const handleAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    const quantity = parseInt(adjustmentForm.quantity);
    if (isNaN(quantity) || quantity === 0) {
      toast.warning('Quantidade inválida');
      return;
    }

    setLoading(true);
    try {
      // @ts-ignore
      await window.electronAPI?.inventory?.manualAdjustment?.(
        selectedItem.product_id,
        'main-branch',
        quantity,
        adjustmentForm.reason,
        adjustmentForm.responsible,
        adjustmentForm.notes
      );

      toast.success('Ajuste realizado com sucesso!');
      setShowAdjustModal(false);
      loadInventory();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao realizar ajuste');
    } finally {
      setLoading(false);
    }
  };

  const handleLoss = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    const quantity = parseInt(adjustmentForm.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      toast.warning('Quantidade deve ser positiva');
      return;
    }

    setLoading(true);
    try {
      // @ts-ignore
      await window.electronAPI?.inventory?.registerLoss?.(
        selectedItem.product_id,
        'main-branch',
        quantity,
        adjustmentForm.reason,
        adjustmentForm.responsible,
        adjustmentForm.notes
      );

      toast.success('Perda registrada com sucesso!');
      setShowLossModal(false);
      loadInventory();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao registrar perda');
    } finally {
      setLoading(false);
    }
  };

  const handleBreakage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    const quantity = parseInt(adjustmentForm.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      toast.warning('Quantidade deve ser positiva');
      return;
    }

    setLoading(true);
    try {
      // @ts-ignore
      await window.electronAPI?.inventory?.registerBreakage?.(
        selectedItem.product_id,
        'main-branch',
        quantity,
        adjustmentForm.reason,
        adjustmentForm.responsible,
        adjustmentForm.notes
      );

      toast.success('Quebra registrada com sucesso!');
      setShowBreakageModal(false);
      loadInventory();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao registrar quebra');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (item: InventoryItem) => {
    if (item.qty_units === 0) return 'bg-red-50 border-red-200';
    if (item.qty_units <= item.low_stock_alert) return 'bg-yellow-50 border-yellow-200';
    return 'bg-white border-gray-200';
  };

  const getStatusBadge = (item: InventoryItem) => {
    if (item.qty_units === 0) {
      return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">Sem Estoque</span>;
    }
    if (item.qty_units <= item.low_stock_alert) {
      return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">Estoque Baixo</span>;
    }
    return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">Normal</span>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (value: number) => {
    // Formatar para FCFA (Franco CFA) - moeda da Guiné-Bissau
    const amount = value / 100; // Converter de centavos
    return `${amount.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })} FCFA`;
  };

  const getMovementTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      sale: '🛒 Venda',
      sale_muntu: '🎁 Venda Muntu',
      purchase: '📦 Compra',
      box_opening: '📂 Abertura Caixa',
      loss: '❌ Perda',
      breakage: '💔 Quebra',
      adjustment: '⚙️ Ajuste',
    };
    return types[type] || type;
  };

  const sortedInventory = getSortedInventory();
  const filteredInventory = sortedInventory; // Alias para compatibilidade

  // Estatísticas do dashboard
  const stats = {
    totalProducts: inventory.length,
    lowStock: inventory.filter(i => i.qty_units <= i.low_stock_alert && i.qty_units > 0).length,
    outOfStock: inventory.filter(i => i.qty_units === 0).length,
    totalBottles: inventory.reduce((sum, i) => sum + i.total_bottles, 0),
    totalClosedBoxes: inventory.reduce((sum, i) => sum + i.closed_boxes, 0),
    totalOpenBoxUnits: inventory.reduce((sum, i) => sum + i.open_box_units, 0),
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Gestão Avançada de Estoque</h1>
        <p className="text-gray-600">Sistema inteligente com abertura automática de caixas e previsões</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex space-x-8">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'inventory'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Package className="inline mr-2" size={18} />
            Estoque Detalhado
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'dashboard'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <BarChart3 className="inline mr-2" size={18} />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'movements'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Activity className="inline mr-2" size={18} />
            Movimentações
          </button>
          <button
            onClick={() => setActiveTab('valuation')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'valuation'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <DollarSign className="inline mr-2" size={18} />
            Valorização
          </button>
        </div>
      </div>

      {/* Tab: Estoque Detalhado */}
      {activeTab === 'inventory' && (
        <>
          {/* Filtros */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative flex-1 w-full md:max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Buscar por produto ou SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterLowStock}
                    onChange={(e) => setFilterLowStock(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Estoque baixo</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterOutOfStock}
                    onChange={(e) => setFilterOutOfStock(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Sem estoque</span>
                </label>

                <button
                  onClick={loadInventory}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <RefreshCw size={16} />
                  Atualizar
                </button>
              </div>
            </div>
          </div>

          {/* Tabela de Estoque */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('product_name')}
                    >
                      <div className="flex items-center gap-2">
                        Produto
                        <ArrowUpDown size={14} />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      <div className="flex items-center justify-center gap-1">
                        <Box size={14} />
                        Caixas Fechadas
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      <div className="flex items-center justify-center gap-1">
                        <Archive size={14} />
                        Caixa Aberta
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('total_bottles')}
                    >
                      <div className="flex items-center justify-center gap-2">
                        Total Garrafas
                        <ArrowUpDown size={14} />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Consumo Médio
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Dias p/ Esgotamento
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Reposição Sugerida
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <RefreshCw className="animate-spin text-blue-600" size={24} />
                          <span className="text-gray-600">Carregando estoque...</span>
                        </div>
                      </td>
                    </tr>
                  ) : sortedInventory.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                        Nenhum produto encontrado
                      </td>
                    </tr>
                  ) : (
                    sortedInventory.map((item) => (
                      <tr key={item.id} className={`hover:bg-gray-50 transition-colors border-l-4 ${getStatusColor(item)}`}>
                        <td className="px-4 py-4">
                          <div>
                            <div className="font-semibold text-gray-900">{item.product_name}</div>
                            <div className="text-xs text-gray-500">{item.product_sku}</div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Box className="text-blue-600" size={18} />
                            <span className="text-lg font-bold text-blue-600">{item.closed_boxes}</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            ({item.closed_boxes * item.units_per_box} unidades)
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Archive className="text-orange-600" size={18} />
                            <span className="text-lg font-bold text-orange-600">{item.open_box_units}</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            de {item.units_per_box}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`text-2xl font-bold ${
                            item.qty_units === 0 ? 'text-red-600' :
                            item.qty_units <= item.low_stock_alert ? 'text-yellow-600' :
                            'text-green-600'
                          }`}>
                            {item.total_bottles}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="text-sm">
                            <div className="text-gray-700">7d: <span className="font-semibold">{item.consumption_avg_7d?.toFixed(1) || 0}</span>/dia</div>
                            <div className="text-gray-700">15d: <span className="font-semibold">{item.consumption_avg_15d?.toFixed(1) || 0}</span>/dia</div>
                            <div className="text-gray-700">30d: <span className="font-semibold">{item.consumption_avg_30d?.toFixed(1) || 0}</span>/dia</div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          {item.days_until_stockout ? (
                            <div className={`text-lg font-bold ${
                              item.days_until_stockout <= 3 ? 'text-red-600' :
                              item.days_until_stockout <= 7 ? 'text-yellow-600' :
                              'text-green-600'
                            }`}>
                              {item.days_until_stockout} dias
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {item.suggested_reorder > 0 ? (
                            <div className="text-blue-600 font-bold">{item.suggested_reorder} unidades</div>
                          ) : (
                            <span className="text-green-600 text-sm">✓ OK</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {getStatusBadge(item)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openAdjustModal(item)}
                              className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                              title="Ajustar"
                            >
                              <Settings size={16} />
                            </button>
                            <button
                              onClick={() => openLossModal(item)}
                              className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                              title="Registrar Perda"
                            >
                              <XCircle size={16} />
                            </button>
                            <button
                              onClick={() => openBreakageModal(item)}
                              className="p-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors"
                              title="Registrar Quebra"
                            >
                              <AlertCircle size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Tab: Dashboard */}
      {activeTab === 'dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-blue-500">
            <div className="flex items-center gap-3 mb-2">
              <Box className="text-blue-600" size={32} />
              <h3 className="font-semibold text-gray-700">Caixas Fechadas</h3>
            </div>
            <p className="text-4xl font-bold text-blue-600">{stats.totalClosedBoxes}</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-orange-500">
            <div className="flex items-center gap-3 mb-2">
              <Archive className="text-orange-600" size={32} />
              <h3 className="font-semibold text-gray-700">Unidades em Caixa Aberta</h3>
            </div>
            <p className="text-4xl font-bold text-orange-600">{stats.totalOpenBoxUnits}</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-green-500">
            <div className="flex items-center gap-3 mb-2">
              <Package className="text-green-600" size={32} />
              <h3 className="font-semibold text-gray-700">Total em Garrafas</h3>
            </div>
            <p className="text-4xl font-bold text-green-600">{stats.totalBottles}</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-yellow-500">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="text-yellow-600" size={32} />
              <h3 className="font-semibold text-gray-700">Estoque Baixo</h3>
            </div>
            <p className="text-4xl font-bold text-yellow-600">{stats.lowStock}</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-red-500">
            <div className="flex items-center gap-3 mb-2">
              <TrendingDown className="text-red-600" size={32} />
              <h3 className="font-semibold text-gray-700">Sem Estoque</h3>
            </div>
            <p className="text-4xl font-bold text-red-600">{stats.outOfStock}</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-purple-500">
            <div className="flex items-center gap-3 mb-2">
              <Activity className="text-purple-600" size={32} />
              <h3 className="font-semibold text-gray-700">Total de Produtos</h3>
            </div>
            <p className="text-4xl font-bold text-purple-600">{stats.totalProducts}</p>
          </div>
        </div>
      )}

      {/* Tab: Movimentações */}
      {activeTab === 'movements' && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-800">Histórico de Movimentações</h2>
            <p className="text-sm text-gray-600 mt-1">Log completo de abertura de caixas, vendas, perdas e ajustes</p>

            {/* Filtros e Busca */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Campo de Busca */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Buscar por produto, responsável..."
                  value={movementSearchTerm}
                  onChange={(e) => setMovementSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Filtro por Tipo */}
              <select
                value={movementTypeFilter}
                onChange={(e) => setMovementTypeFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Todos os Tipos</option>
                <option value="sale">Venda</option>
                <option value="purchase">Compra</option>
                <option value="adjustment">Ajuste</option>
                <option value="loss">Perda</option>
                <option value="breakage">Quebra</option>
                <option value="return">Devolução</option>
              </select>

              {/* Filtro por Período */}
              <select
                value={movementDateFilter}
                onChange={(e) => setMovementDateFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Todos os Períodos</option>
                <option value="today">Hoje</option>
                <option value="week">Últimos 7 dias</option>
                <option value="month">Último mês</option>
                <option value="quarter">Últimos 3 meses</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data/Hora</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Quantidade</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Caixas Abertas?</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motivo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Responsável</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      {movements.length === 0 ? 'Nenhuma movimentação registrada' : 'Nenhuma movimentação encontrada com os filtros aplicados'}
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map((mov) => (
                    <tr key={mov.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{formatDate(mov.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold">{mov.product_name}</div>
                        <div className="text-xs text-gray-500">{mov.product_sku}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm">{getMovementTypeLabel(mov.movement_type)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold ${mov.quantity < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {mov.quantity > 0 ? '+' : ''}{mov.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {mov.box_opened_automatically ? (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                            ✓ Sim
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">{mov.reason}</td>
                      <td className="px-4 py-3 text-sm">{mov.responsible}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => {
                            setSelectedMovement(mov);
                            setShowMovementDetailsModal(true);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm"
                        >
                          <Eye className="w-4 h-4" />
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Valorização */}
      {activeTab === 'valuation' && (
        <div className="space-y-6">
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Valor Total em Custo */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <DollarSign className="w-10 h-10 opacity-80" />
                <div className="text-right">
                  <div className="text-sm opacity-90">Valor Total (Custo)</div>
                  <div className="text-3xl font-bold">
                    {formatCurrency(inventory.reduce((sum, item) => {
                      const costPrice = item.cost_price || 0;
                      return sum + (item.qty_units * costPrice);
                    }, 0))}
                  </div>
                </div>
              </div>
              <div className="text-xs opacity-75">
                Baseado no custo médio de aquisição
              </div>
            </div>

            {/* Valor Total em Venda */}
            <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <TrendingUp className="w-10 h-10 opacity-80" />
                <div className="text-right">
                  <div className="text-sm opacity-90">Valor Potencial (Venda)</div>
                  <div className="text-3xl font-bold">
                    {formatCurrency(inventory.reduce((sum, item) => {
                      const salePrice = item.sale_price || 0;
                      return sum + (item.qty_units * salePrice);
                    }, 0))}
                  </div>
                </div>
              </div>
              <div className="text-xs opacity-75">
                Valor se vender todo o estoque
              </div>
            </div>

            {/* Margem Potencial */}
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <BarChart3 className="w-10 h-10 opacity-80" />
                <div className="text-right">
                  <div className="text-sm opacity-90">Margem Potencial</div>
                  <div className="text-3xl font-bold">
                    {formatCurrency(
                      inventory.reduce((sum, item) => {
                        const costPrice = item.cost_price || 0;
                        const salePrice = item.sale_price || 0;
                        return sum + (item.qty_units * (salePrice - costPrice));
                      }, 0)
                    )}
                  </div>
                </div>
              </div>
              <div className="text-xs opacity-75">
                Lucro bruto potencial
              </div>
            </div>
          </div>

          {/* Tabela Detalhada */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-green-600" />
                Valorização por Produto
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Produto</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Quantidade</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Custo Unit.</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Venda Unit.</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Valor Custo</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Valor Venda</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Margem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredInventory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
                        <p>Nenhum produto no estoque</p>
                      </td>
                    </tr>
                  ) : (
                    filteredInventory.map((item) => {
                      const costPrice = item.cost_price || 0;
                      const salePrice = item.sale_price || 0;
                      const totalCost = item.qty_units * costPrice;
                      const totalSale = item.qty_units * salePrice;
                      const margin = totalSale - totalCost;
                      const marginPercent = totalCost > 0 ? ((margin / totalCost) * 100) : 0;

                      return (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div>
                              <div className="font-medium text-gray-900">{item.product_name}</div>
                              <div className="text-sm text-gray-500">{item.product_sku}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="font-semibold text-gray-900">{item.qty_units}</div>
                            <div className="text-xs text-gray-500">
                              {item.closed_boxes} cx + {item.open_box_units} un
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right text-gray-900">
                            {formatCurrency(costPrice)}
                          </td>
                          <td className="px-6 py-4 text-right text-gray-900">
                            {formatCurrency(salePrice)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-semibold text-blue-600">
                              {formatCurrency(totalCost)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-semibold text-green-600">
                              {formatCurrency(totalSale)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="font-semibold text-purple-600">
                              {formatCurrency(margin)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {marginPercent.toFixed(1)}%
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                  <tr className="font-bold">
                    <td className="px-6 py-4" colSpan={4}>TOTAIS</td>
                    <td className="px-6 py-4 text-right text-blue-700">
                      {formatCurrency(inventory.reduce((sum, item) => sum + (item.qty_units * (item.cost_price || 0)), 0))}
                    </td>
                    <td className="px-6 py-4 text-right text-green-700">
                      {formatCurrency(inventory.reduce((sum, item) => sum + (item.qty_units * (item.sale_price || 0)), 0))}
                    </td>
                    <td className="px-6 py-4 text-right text-purple-700">
                      {formatCurrency(
                        inventory.reduce((sum, item) => {
                          const costPrice = item.cost_price || 0;
                          const salePrice = item.sale_price || 0;
                          return sum + (item.qty_units * (salePrice - costPrice));
                        }, 0)
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ajuste Manual */}
      {showAdjustModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg">
              <h2 className="text-2xl font-bold">Ajuste Manual de Estoque</h2>
            </div>
            <form onSubmit={handleAdjustment} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Produto</label>
                <input
                  type="text"
                  value={selectedItem.product_name}
                  disabled
                  className="w-full px-3 py-2 border rounded-lg bg-gray-100"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Quantidade Atual</label>
                <div className="text-2xl font-bold text-blue-600">{selectedItem.total_bottles} garrafas</div>
                <div className="text-sm text-gray-600">
                  {selectedItem.closed_boxes} caixas fechadas + {selectedItem.open_box_units} avulsas
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Ajuste (positivo ou negativo) *</label>
                <input
                  type="number"
                  value={adjustmentForm.quantity}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, quantity: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Ex: 10 ou -5"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Motivo *</label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'Selecione' },
                    { value: 'Contagem de inventário', label: 'Contagem de inventário' },
                    { value: 'Correção de erro', label: 'Correção de erro' },
                    { value: 'Transferência', label: 'Transferência' },
                    { value: 'Outro', label: 'Outro' },
                  ]}
                  value={adjustmentForm.reason}
                  onChange={(value) => setAdjustmentForm({ ...adjustmentForm, reason: value })}
                  placeholder="Selecione o motivo"
                  searchPlaceholder="Buscar motivo..."
                  emptyText="Nenhum motivo encontrado"
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Observações</label>
                <textarea
                  value={adjustmentForm.notes}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  disabled={loading}
                >
                  {loading ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Registrar Perda */}
      {showLossModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6 rounded-t-lg">
              <h2 className="text-2xl font-bold">Registrar Perda</h2>
            </div>
            <form onSubmit={handleLoss} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Produto</label>
                <input
                  type="text"
                  value={selectedItem.product_name}
                  disabled
                  className="w-full px-3 py-2 border rounded-lg bg-gray-100"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Quantidade Perdida *</label>
                <input
                  type="number"
                  min="1"
                  value={adjustmentForm.quantity}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, quantity: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Motivo *</label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'Selecione' },
                    { value: 'Roubo', label: 'Roubo' },
                    { value: 'Extravio', label: 'Extravio' },
                    { value: 'Vencido', label: 'Vencido' },
                    { value: 'Outro', label: 'Outro' },
                  ]}
                  value={adjustmentForm.reason}
                  onChange={(value) => setAdjustmentForm({ ...adjustmentForm, reason: value })}
                  placeholder="Selecione o motivo"
                  searchPlaceholder="Buscar motivo..."
                  emptyText="Nenhum motivo encontrado"
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Observações</label>
                <textarea
                  value={adjustmentForm.notes}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowLossModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  disabled={loading}
                >
                  {loading ? 'Salvando...' : 'Registrar Perda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Registrar Quebra */}
      {showBreakageModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white p-6 rounded-t-lg">
              <h2 className="text-2xl font-bold">Registrar Quebra</h2>
            </div>
            <form onSubmit={handleBreakage} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Produto</label>
                <input
                  type="text"
                  value={selectedItem.product_name}
                  disabled
                  className="w-full px-3 py-2 border rounded-lg bg-gray-100"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Quantidade Quebrada *</label>
                <input
                  type="number"
                  min="1"
                  value={adjustmentForm.quantity}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, quantity: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Motivo *</label>
                <select
                  value={adjustmentForm.reason}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">Selecione</option>
                  <option value="Queda">Queda</option>
                  <option value="Manuseio incorreto">Manuseio incorreto</option>
                  <option value="Transporte">Transporte</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Observações</label>
                <textarea
                  value={adjustmentForm.notes}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowBreakageModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                  disabled={loading}
                >
                  {loading ? 'Salvando...' : 'Registrar Quebra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Detalhes da Movimentação */}
      {showMovementDetailsModal && selectedMovement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg flex justify-between items-center">
              <h2 className="text-2xl font-bold">Detalhes da Movimentação</h2>
              <button
                onClick={() => setShowMovementDetailsModal(false)}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Informações do Produto */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  Produto
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Nome</label>
                    <p className="text-base font-semibold text-gray-800">{selectedMovement.product_name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">SKU</label>
                    <p className="text-base text-gray-800">{selectedMovement.product_sku}</p>
                  </div>
                </div>
              </div>

              {/* Informações da Movimentação */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-600" />
                  Movimentação
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Tipo</label>
                    <p className="text-base font-semibold text-gray-800">{getMovementTypeLabel(selectedMovement.movement_type)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Data/Hora</label>
                    <p className="text-base text-gray-800">{formatDate(selectedMovement.created_at)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Quantidade</label>
                    <p className={`text-xl font-bold ${selectedMovement.quantity < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {selectedMovement.quantity > 0 ? '+' : ''}{selectedMovement.quantity} unidades
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Terminal</label>
                    <p className="text-base text-gray-800">{selectedMovement.terminal || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Estoque Antes/Depois */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  Estoque
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <label className="text-sm font-medium text-gray-600 block mb-1">Antes</label>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <p className="text-lg font-bold text-gray-800">{selectedMovement.quantity_before}</p>
                      <p className="text-xs text-gray-500">unidades</p>
                    </div>
                  </div>
                  <div className="text-center flex items-center justify-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      selectedMovement.quantity < 0 ? 'bg-red-100' : 'bg-green-100'
                    }`}>
                      {selectedMovement.quantity < 0 ? (
                        <Minus className="w-6 h-6 text-red-600" />
                      ) : (
                        <Plus className="w-6 h-6 text-green-600" />
                      )}
                    </div>
                  </div>
                  <div className="text-center">
                    <label className="text-sm font-medium text-gray-600 block mb-1">Depois</label>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <p className="text-lg font-bold text-gray-800">{selectedMovement.quantity_after}</p>
                      <p className="text-xs text-gray-500">unidades</p>
                    </div>
                  </div>
                </div>

                {/* Informações de Caixas */}
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Caixas Fechadas (Antes → Depois)</label>
                    <p className="text-base text-gray-800">
                      {selectedMovement.closed_boxes_before} → {selectedMovement.closed_boxes_after}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Caixa Aberta (Antes → Depois)</label>
                    <p className="text-base text-gray-800">
                      {selectedMovement.open_box_before} → {selectedMovement.open_box_after}
                    </p>
                  </div>
                </div>

                {selectedMovement.box_opened_automatically && (
                  <div className="mt-3 flex items-center gap-2 text-blue-700 bg-blue-50 p-3 rounded-lg">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm font-medium">Caixa aberta automaticamente pelo sistema</span>
                  </div>
                )}
              </div>

              {/* Responsável e Motivo */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Informações Adicionais
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Responsável</label>
                    <p className="text-base text-gray-800">{selectedMovement.responsible}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Motivo</label>
                    <p className="text-base text-gray-800">{selectedMovement.reason}</p>
                  </div>
                  {selectedMovement.notes && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Observações</label>
                      <p className="text-base text-gray-800">{selectedMovement.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowMovementDetailsModal(false)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryAdvanced;
