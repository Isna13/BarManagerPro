import React, { useState, useEffect } from 'react';
import { Search, Eye, Calendar, DollarSign, Package, User, X, Filter } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

interface Sale {
  id: string;
  sale_number: string;
  branch_id: string;
  cashier_id: string;
  customer_id?: string;
  type: string;
  status: string;
  subtotal: number;
  tax_total: number;
  total: number;
  muntu_savings: number;
  payment_method: string;
  opened_at: string;
  closed_at?: string;
  created_at: string;
}

interface SaleItem {
  id: string;
  product_id: string;
  product_name: string;
  qty_units: number;
  is_muntu: boolean;
  unit_price: number;
  unit_cost: number;
  subtotal: number;
  tax_amount: number;
  total: number;
  muntu_savings: number;
}

interface SaleDetail extends Sale {
  items: SaleItem[];
  payments: any[];
}

export default function SalesPage() {
  const toast = useToast();
  const [sales, setSales] = useState<Sale[]>([]);
  const [filteredSales, setFilteredSales] = useState<Sale[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleDetail | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Filtros
  const [dateFilter, setDateFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadSales();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [sales, searchTerm, dateFilter, paymentFilter]);

  const loadSales = async () => {
    setLoading(true);
    try {
      // @ts-ignore
      const result = await window.electronAPI?.sales?.list?.({});
      if (result && Array.isArray(result)) {
        setSales(result);
      }
    } catch (error) {
      console.error('Erro ao carregar vendas:', error);
      toast.error('Erro ao carregar vendas');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...sales];

    // Filtro de busca (número da venda)
    if (searchTerm) {
      filtered = filtered.filter(sale =>
        sale.sale_number.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro de data
    if (dateFilter) {
      const filterDate = new Date(dateFilter).toDateString();
      filtered = filtered.filter(sale => {
        const saleDate = new Date(sale.created_at).toDateString();
        return saleDate === filterDate;
      });
    }

    // Filtro de método de pagamento
    if (paymentFilter !== 'all') {
      filtered = filtered.filter(sale => sale.payment_method === paymentFilter);
    }

    setFilteredSales(filtered);
  };

  const handleViewDetails = async (saleId: string) => {
    setLoadingDetails(true);
    setShowDetailsModal(false);
    setSelectedSale(null);

    try {
      // @ts-ignore
      const details = await window.electronAPI?.sales?.getById?.(saleId);
      
      if (!details) {
        toast.error('Venda não encontrada');
        return;
      }

      setSelectedSale(details);
      setShowDetailsModal(true);
    } catch (error: any) {
      console.error('Erro ao carregar detalhes:', error);
      toast.error('Erro ao carregar detalhes da venda');
    } finally {
      setLoadingDetails(false);
    }
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
    // Formatar valores numéricos (sem símbolo de moeda)
    // O sufixo "FCFA" é adicionado manualmente no JSX
    return (value / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const getPaymentMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      cash: '💵 Dinheiro',
      orange: '🍊 Orange Money',
      teletaku: '📱 TeleTaku',
      mobile_money: '📱 Mobile Money',
      mixed: '💳 Misto',
      card: '💳 Misto',
      vale: '📝 Vale',
      debt: '📝 Vale',
    };
    return methods[method] || method;
  };

  const getPaymentMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      cash: 'bg-green-100 text-green-700',
      orange: 'bg-orange-100 text-orange-700',
      teletaku: 'bg-purple-100 text-purple-700',
      mobile_money: 'bg-purple-100 text-purple-700',
      mixed: 'bg-blue-100 text-blue-700',
      card: 'bg-blue-100 text-blue-700',
      vale: 'bg-yellow-100 text-yellow-700',
      debt: 'bg-yellow-100 text-yellow-700',
    };
    return colors[method] || 'bg-gray-100 text-gray-700';
  };

  const calculateTotals = () => {
    const total = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
    const savings = filteredSales.reduce((sum, sale) => sum + (sale.muntu_savings || 0), 0);
    return { total, savings, count: filteredSales.length };
  };

  const totals = calculateTotals();

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Histórico de Vendas</h1>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            showFilters
              ? 'bg-blue-600 text-white'
              : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-blue-300'
          }`}
        >
          <Filter size={20} />
          Filtros
        </button>
      </div>

      {/* Filtros */}
      {showFilters && (
        <div className="bg-white p-4 rounded-xl border-2 border-gray-200 shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Buscar por número
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Ex: SALE-123..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Data
              </label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Método de Pagamento
              </label>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="all">Todos</option>
                <option value="cash">Dinheiro (FCFA)</option>
                <option value="orange">Orange Money</option>
                <option value="teletaku">TeleTaku</option>
                <option value="mixed">Misto</option>
              </select>
            </div>
          </div>

          {(searchTerm || dateFilter || paymentFilter !== 'all') && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setSearchTerm('');
                  setDateFilter('');
                  setPaymentFilter('all');
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 underline"
              >
                Limpar filtros
              </button>
            </div>
          )}
        </div>
      )}

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-6 rounded-xl border-2 border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package size={24} className="text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-700">Total de Vendas</h3>
          </div>
          <p className="text-3xl font-bold text-blue-600">{totals.count}</p>
        </div>

        <div className="bg-white p-6 rounded-xl border-2 border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign size={24} className="text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-700">Faturamento Total</h3>
          </div>
          <p className="text-3xl font-bold text-green-600">{formatCurrency(totals.total)} FCFA</p>
        </div>

        <div className="bg-white p-6 rounded-xl border-2 border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-100 rounded-lg">
              <DollarSign size={24} className="text-orange-600" />
            </div>
            <h3 className="font-semibold text-gray-700">Economia Muntu</h3>
          </div>
          <p className="text-3xl font-bold text-orange-600">{formatCurrency(totals.savings)} FCFA</p>
        </div>
      </div>

      {/* Tabela de Vendas */}
      <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Número</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Data/Hora</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Método</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Total</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Economia</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <span className="text-gray-600">Carregando vendas...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    {sales.length === 0 ? 'Nenhuma venda registrada' : 'Nenhuma venda encontrada com os filtros aplicados'}
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">{sale.sale_number}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDate(sale.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getPaymentMethodColor(sale.payment_method)}`}>
                        {getPaymentMethodLabel(sale.payment_method)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold text-gray-900">{formatCurrency(sale.total)} FCFA</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {sale.muntu_savings > 0 ? (
                        <span className="text-green-600 font-semibold">{formatCurrency(sale.muntu_savings)} FCFA</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleViewDetails(sale.id)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        <Eye size={16} />
                        Ver Detalhes
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Loading */}
      {loadingDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-8">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="text-lg">Carregando detalhes...</span>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalhes da Venda */}
      {showDetailsModal && selectedSale && !loadingDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-xl flex justify-between items-center z-10">
              <div>
                <h2 className="text-2xl font-bold">Detalhes da Venda</h2>
                <p className="text-blue-100 text-sm mt-1">{selectedSale.sale_number}</p>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-white hover:bg-blue-800 rounded-full p-2 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              {/* Informações Gerais */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Calendar size={20} />
                    Informações da Venda
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Data/Hora:</span>
                      <span className="font-medium">{formatDate(selectedSale.created_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tipo:</span>
                      <span className="font-medium">
                        {selectedSale.type === 'counter' ? 'Balcão' : 'Mesa'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        selectedSale.status === 'closed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {selectedSale.status === 'closed' ? 'Finalizada' : 'Aberta'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <DollarSign size={20} />
                    Pagamento
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Método:</span>
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getPaymentMethodColor(selectedSale.payment_method)}`}>
                        {getPaymentMethodLabel(selectedSale.payment_method)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-medium">{formatCurrency(selectedSale.subtotal)} FCFA</span>
                    </div>
                    {selectedSale.muntu_savings > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Economia Muntu:</span>
                        <span className="font-semibold text-green-600">{formatCurrency(selectedSale.muntu_savings)} FCFA</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Itens da Venda */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Package size={20} />
                  Itens da Venda
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Produto</th>
                        <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Qtd</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Preço Unit.</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Subtotal</th>
                        <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Tipo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedSale.items.map((item) => (
                        <tr key={item.id} className={item.is_muntu ? 'bg-green-50' : ''}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.product_name}</td>
                          <td className="px-4 py-3 text-sm text-center font-semibold">{item.qty_units}</td>
                          <td className="px-4 py-3 text-sm text-right">{formatCurrency(item.unit_price)} FCFA</td>
                          <td className="px-4 py-3 text-sm text-right font-bold">{formatCurrency(item.subtotal)} FCFA</td>
                          <td className="px-4 py-3 text-center">
                            {item.is_muntu ? (
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                                🎁 Muntu
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                                Normal
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-right font-bold text-gray-700">
                          Total:
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-xl text-blue-600">
                          {formatCurrency(selectedSale.total)} FCFA
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Botão Fechar */}
              <div className="flex justify-end">
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
