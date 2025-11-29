import React, { useState, useEffect } from 'react';
import { Search, AlertTriangle, Package, TrendingUp, TrendingDown, Edit, DollarSign, BarChart3 } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

interface InventoryItem {
  id: string;
  product_id: string;
  branch_id: string;
  product_name: string;
  product_sku: string;
  qty_units: number;
  low_stock_alert: number;
  batch_number?: string;
  expiry_date?: string;
  updated_at: string;
}

interface ProductWithValues extends InventoryItem {
  cost_unit: number;
  cost_box: number;
  price_unit: number;
  price_box: number;
  units_per_box: number;
}

const Inventory: React.FC = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'list' | 'valuation'>('list');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [productsWithValues, setProductsWithValues] = useState<ProductWithValues[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isLoadingPage, setIsLoadingPage] = useState(true);

  const [adjustmentForm, setAdjustmentForm] = useState({
    productId: '',
    productName: '',
    currentQty: 0,
    quantity: '',
    reason: '',
  });

  useEffect(() => {
    loadInventory();
    if (activeTab === 'valuation') {
      loadProductsWithValues();
    }
  }, [activeTab]);

  const loadProductsWithValues = async () => {
    try {
      const products = await window.electronAPI.products.list({});
      const inventoryData = await window.electronAPI.inventory.list({ branchId: 'main-branch' });
      
      // Combinar dados de produtos com estoque
      const combined = inventoryData.map((inv: any) => {
        const product = products.find((p: any) => p.id === inv.product_id);
        return {
          ...inv,
          cost_unit: product?.cost_unit || 0,
          cost_box: product?.cost_box || 0,
          price_unit: product?.price_unit || 0,
          price_box: product?.price_box || 0,
          units_per_box: product?.units_per_box || 1,
        };
      });
      
      setProductsWithValues(combined);
    } catch (error) {
      console.error('Erro ao carregar produtos com valores:', error);
      toast.error('Erro ao carregar valorização do estoque');
    }
  };

  const loadInventory = async () => {
    setIsLoadingPage(true);
    try {
      if (!window.electronAPI || !window.electronAPI.inventory) {
        throw new Error('API do Electron não está disponível');
      }
      const data = await window.electronAPI.inventory.list({ branchId: 'main-branch' });
      console.log('Inventory data:', data);
      setInventory(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Erro ao carregar estoque:', error);
      toast.error(error.message || 'Erro ao carregar estoque');
      setInventory([]);
    } finally {
      setIsLoadingPage(false);
    }
  };

  const openAdjustmentModal = (item: InventoryItem) => {
    setAdjustmentForm({
      productId: item.product_id,
      productName: item.product_name,
      currentQty: item.qty_units,
      quantity: '',
      reason: '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setAdjustmentForm({
      productId: '',
      productName: '',
      currentQty: 0,
      quantity: '',
      reason: '',
    });
  };

  const handleAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!adjustmentForm.quantity || !adjustmentForm.reason) {
      toast.warning('Preencha a quantidade e o motivo do ajuste');
      return;
    }

    const quantity = parseInt(adjustmentForm.quantity);
    if (quantity === 0) {
      toast.warning('A quantidade deve ser diferente de zero');
      return;
    }

    setLoading(true);

    try {
      await window.electronAPI.inventory.update(
        adjustmentForm.productId,
        'main-branch',
        quantity,
        adjustmentForm.reason
      );

      toast.success(`Estoque ajustado com sucesso! ${quantity > 0 ? 'Adicionado' : 'Removido'} ${Math.abs(quantity)} unidades`);
      closeModal();
      loadInventory();
    } catch (error: any) {
      console.error('Erro ao ajustar estoque:', error);
      toast.error(error.message || 'Erro ao ajustar estoque');
    } finally {
      setLoading(false);
    }
  };

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = 
      (item.product_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.product_sku || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesLowStock = !filterLowStock || (item.qty_units <= item.low_stock_alert);

    return matchesSearch && matchesLowStock;
  });

  const lowStockCount = inventory.filter(item => item.qty_units <= item.low_stock_alert).length;
  const outOfStockCount = inventory.filter(item => item.qty_units === 0).length;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const isLowStock = (qty: number, alert: number) => qty <= alert && qty > 0;
  const isOutOfStock = (qty: number) => qty === 0;

  // Calcular valores totais
  const calculateValuation = () => {
    let totalCost = 0;
    let totalSaleValue = 0;

    productsWithValues.forEach(item => {
      const costValue = (item.cost_box || item.cost_unit) * item.qty_units;
      const saleValue = (item.price_box || item.price_unit) * item.qty_units;
      totalCost += costValue;
      totalSaleValue += saleValue;
    });

    const estimatedProfit = totalSaleValue - totalCost;

    return { totalCost, totalSaleValue, estimatedProfit };
  };

  const valuation = calculateValuation();

  if (isLoadingPage) {
    return (
      <div className="p-6 flex items-center justify-center h-screen">
        <div className="text-center">
          <Package className="mx-auto text-gray-400 mb-4 animate-pulse" size={64} />
          <p className="text-gray-600">Carregando estoque...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Estoque</h1>
        <p className="text-gray-600">Monitore e gerencie o estoque de produtos</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex space-x-8">
          <button
            onClick={() => setActiveTab('list')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'list'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Package className="inline mr-2" size={18} />
            Lista de Estoque
          </button>
          <button
            onClick={() => setActiveTab('valuation')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'valuation'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <DollarSign className="inline mr-2" size={18} />
            Valorização do Estoque
          </button>
        </div>
      </div>

      {/* Tab: Lista de Estoque */}
      {activeTab === 'list' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total de Produtos</p>
              <p className="text-3xl font-bold text-gray-800">{inventory.length}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Package className="text-blue-600" size={32} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Estoque Baixo</p>
              <p className="text-3xl font-bold text-yellow-600">{lowStockCount}</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-lg">
              <AlertTriangle className="text-yellow-600" size={32} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Sem Estoque</p>
              <p className="text-3xl font-bold text-red-600">{outOfStockCount}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg">
              <TrendingDown className="text-red-600" size={32} />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
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

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filterLowStock}
              onChange={(e) => setFilterLowStock(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Apenas estoque baixo</span>
          </label>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Produto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantidade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Alerta
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lote
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Validade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <Package className="mx-auto text-gray-400 mb-4" size={64} />
                    <p className="text-gray-500">Nenhum produto encontrado</p>
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item) => (
                  <tr 
                    key={item.id} 
                    className={`hover:bg-gray-50 ${isOutOfStock(item.qty_units) ? 'bg-red-50' : isLowStock(item.qty_units, item.low_stock_alert) ? 'bg-yellow-50' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <Package className="text-gray-400 mr-2" size={18} />
                        <span className="font-medium text-gray-900">{item.product_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {item.product_sku}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-lg font-bold ${
                        isOutOfStock(item.qty_units) ? 'text-red-600' : 
                        isLowStock(item.qty_units, item.low_stock_alert) ? 'text-yellow-600' : 
                        'text-green-600'
                      }`}>
                        {item.qty_units}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      ≤ {item.low_stock_alert}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {item.batch_number || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {item.expiry_date ? formatDate(item.expiry_date) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isOutOfStock(item.qty_units) ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Sem Estoque
                        </span>
                      ) : isLowStock(item.qty_units, item.low_stock_alert) ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Estoque Baixo
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Normal
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => openAdjustmentModal(item)}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                      >
                        <Edit size={16} />
                        Ajustar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Ajuste de Estoque */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg">
              <h2 className="text-2xl font-bold">Ajustar Estoque</h2>
            </div>

            <form onSubmit={handleAdjustment} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Produto</label>
                <input
                  type="text"
                  value={adjustmentForm.productName}
                  disabled
                  className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-700"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Quantidade Atual</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={adjustmentForm.currentQty}
                    disabled
                    className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-700 font-bold text-lg"
                  />
                  <span className="text-sm text-gray-600">unidades</span>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Ajuste de Quantidade *</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={adjustmentForm.quantity}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, quantity: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: 10 (adicionar) ou -5 (remover)"
                    required
                  />
                  <div className="flex flex-col items-center">
                    <TrendingUp className="text-green-600" size={20} />
                    <TrendingDown className="text-red-600" size={20} />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Use valores positivos para adicionar e negativos para remover
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Motivo do Ajuste *</label>
                <select
                  value={adjustmentForm.reason}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 mb-2"
                  required
                >
                  <option value="">Selecione o motivo</option>
                  <option value="inventory_count">Contagem de inventário</option>
                  <option value="damage">Produto danificado</option>
                  <option value="loss">Perda/Roubo</option>
                  <option value="return">Devolução</option>
                  <option value="correction">Correção de erro</option>
                  <option value="other">Outro</option>
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Salvando...' : 'Confirmar Ajuste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      )}

      {/* Tab: Valorização do Estoque */}
      {activeTab === 'valuation' && (
        <>
          {/* Cards de Resumo Financeiro */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-orange-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Custo Total do Estoque</p>
                  <p className="text-3xl font-bold text-orange-600">
                    {(valuation.totalCost / 100).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">FCFA</p>
                </div>
                <div className="bg-orange-100 p-3 rounded-lg">
                  <BarChart3 className="text-orange-600" size={32} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Valor de Venda</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {(valuation.totalSaleValue / 100).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">FCFA</p>
                </div>
                <div className="bg-blue-100 p-3 rounded-lg">
                  <DollarSign className="text-blue-600" size={32} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Lucro Estimado</p>
                  <p className="text-3xl font-bold text-green-600">
                    {(valuation.estimatedProfit / 100).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">FCFA</p>
                </div>
                <div className="bg-green-100 p-3 rounded-lg">
                  <TrendingUp className="text-green-600" size={32} />
                </div>
              </div>
            </div>
          </div>

          {/* Margem de Lucro */}
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg shadow-sm p-6 mb-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm mb-1">Margem de Lucro Média</p>
                <p className="text-4xl font-bold">
                  {valuation.totalCost > 0 
                    ? ((valuation.estimatedProfit / valuation.totalCost) * 100).toFixed(2)
                    : '0.00'}%
                </p>
              </div>
              <BarChart3 size={48} className="text-purple-200" />
            </div>
          </div>

          {/* Tabela Detalhada de Produtos */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">Detalhamento por Produto</h2>
              <p className="text-sm text-gray-600 mt-1">Análise individual de custos, preços e lucros</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Produto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      SKU
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Qtd em Estoque
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Custo Unit.
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Custo Total
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Preço Unit.
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Valor de Venda
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Lucro Est.
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Margem
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {productsWithValues.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center">
                        <Package className="mx-auto text-gray-400 mb-4" size={64} />
                        <p className="text-gray-500">Nenhum produto no estoque</p>
                      </td>
                    </tr>
                  ) : (
                    productsWithValues.map((item) => {
                      const costUnit = item.cost_box || item.cost_unit;
                      const priceUnit = item.price_box || item.price_unit;
                      const costTotal = costUnit * item.qty_units;
                      const saleTotal = priceUnit * item.qty_units;
                      const profit = saleTotal - costTotal;
                      const margin = costTotal > 0 ? ((profit / costTotal) * 100) : 0;

                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <Package className="text-gray-400 mr-2" size={18} />
                              <span className="font-medium text-gray-900">{item.product_name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {item.product_sku}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="font-bold text-gray-900">{item.qty_units}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            {(costUnit / 100).toFixed(2)} FCFA
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-orange-600">
                            {(costTotal / 100).toFixed(2)} FCFA
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            {(priceUnit / 100).toFixed(2)} FCFA
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-blue-600">
                            {(saleTotal / 100).toFixed(2)} FCFA
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right font-bold">
                            <span className={profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {(profit / 100).toFixed(2)} FCFA
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              margin >= 50 ? 'bg-green-100 text-green-800' :
                              margin >= 25 ? 'bg-blue-100 text-blue-800' :
                              margin >= 0 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {margin.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Inventory;
