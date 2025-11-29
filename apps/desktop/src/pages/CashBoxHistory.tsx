import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CashBox {
  id: string;
  box_number: string;
  branch_id: string;
  opened_by: string;
  closed_by: string;
  status: string;
  opening_cash: number;
  total_sales: number;
  total_cash: number;
  total_card: number;
  total_mobile_money: number;
  total_debt: number;
  closing_cash: number;
  difference: number;
  notes?: string;
  opened_at: string;
  closed_at: string;
  total_transactions?: number;
  paid_transactions?: number;
}

interface Sale {
  id: string;
  sale_number: string;
  total: number;
  payment_method: string;
  created_at: string;
}

interface ProductSale {
  productId: string;
  productName: string;
  qtySold: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

interface ProfitMetrics {
  totalRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  profitMargin: number;
  salesItems: ProductSale[];
}

interface CashBoxDetail extends CashBox {
  sales: Sale[];
  profitMetrics?: ProfitMetrics;
}

const CashBoxHistory: React.FC = () => {
  const [cashBoxes, setCashBoxes] = useState<CashBox[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCashBox, setSelectedCashBox] = useState<CashBoxDetail | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async (filters?: any) => {
    setLoading(true);
    try {
      const history = await window.electronAPI?.cashBox?.getHistory?.(filters);
      setCashBoxes(history || []);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    const filters: any = {};
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    loadHistory(filters);
  };

  const handleViewDetails = async (cashBoxId: string) => {
    try {
      const details = await window.electronAPI?.cashBox?.getById?.(cashBoxId);
      if (details) {
        setSelectedCashBox(details);
        setShowDetailModal(true);
      }
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
    }
  };

  const formatCurrency = (value: number) => {
    // Formatar para FCFA (Franco CFA) - moeda da Guiné-Bissau
    const amount = value / 100; // Converter de centavos
    return `${amount.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })} FCFA`;
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">Carregando histórico...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Histórico de Caixas</h1>
        
        {/* Filtros */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Inicial
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Final
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <button
              onClick={handleFilter}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Filtrar
            </button>
            <button
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                loadHistory();
              }}
              className="px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
            >
              Limpar
            </button>
          </div>
        </div>

        {/* Tabela de Caixas */}
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full table-auto divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                  Nº Caixa
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                  Abertura
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                  Fechamento
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                  Valor Inicial
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                  Total Vendas
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                  💵 Dinheiro
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                  💳 Cartão
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                  📱 Mobile
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                  Diferença
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                  Transações
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase whitespace-nowrap sticky right-0 bg-gray-50">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {cashBoxes.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                    Nenhum caixa fechado encontrado
                  </td>
                </tr>
              ) : (
                cashBoxes.map((cashBox) => (
                  <tr key={cashBox.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {cashBox.box_number}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(cashBox.opened_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(cashBox.closed_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(cashBox.opening_cash)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      {formatCurrency(cashBox.total_sales)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(cashBox.total_cash)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(cashBox.total_card)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(cashBox.total_mobile_money)}
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-medium ${
                      cashBox.difference >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(cashBox.difference)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900">
                      {cashBox.total_transactions || 0}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center text-sm sticky right-0 bg-white">
                      <button
                        onClick={() => handleViewDetails(cashBox.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                      >
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

      {/* Modal de Detalhes */}
      {showDetailModal && selectedCashBox && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    Detalhes do Caixa {selectedCashBox.box_number}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Abertura: {formatDateTime(selectedCashBox.opened_at)} | 
                    Fechamento: {formatDateTime(selectedCashBox.closed_at)}
                  </p>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Aviso sobre vendas sem método de pagamento */}
              {selectedCashBox.sales && selectedCashBox.sales.some((s: any) => !s.payment_method) && (
                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                  <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-yellow-800">Compatibilidade com dados antigos</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      Este caixa contém {selectedCashBox.sales.filter((s: any) => !s.payment_method).length} venda(s) sem método de pagamento registrado. 
                      Todos os produtos dessas vendas estão incluídos nos cálculos abaixo.
                    </p>
                  </div>
                </div>
              )}

              {/* Lista de Produtos Vendidos */}
              {selectedCashBox.profitMetrics && selectedCashBox.profitMetrics.salesItems.length > 0 ? (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">
                    Produtos Vendidos ({selectedCashBox.profitMetrics.salesItems.length})
                  </h3>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Produto
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Quantidade Vendida
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Total em Dinheiro (Venda)
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Valor de Reposição (Custo)
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Lucro Bruto
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedCashBox.profitMetrics.salesItems.map((item) => (
                          <tr key={item.productId} className={`hover:bg-gray-50 ${item.cost === 0 ? 'bg-yellow-50' : ''}`}>
                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                              {item.productName}
                              {item.cost === 0 && (
                                <span className="ml-2 text-xs text-yellow-600 font-normal">
                                  (custo não registrado)
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {item.qtySold} {item.qtySold === 1 ? 'unidade' : 'unidades'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-blue-600 font-semibold">
                              {formatCurrency(item.revenue)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-orange-600 font-semibold">
                              {formatCurrency(item.cost)}
                              {item.cost === 0 && (
                                <span className="ml-1 text-xs text-yellow-600">⚠️</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-green-600 font-bold">
                              {formatCurrency(item.profit)}
                            </td>
                          </tr>
                        ))}
                        {/* Aviso sobre produtos com custo zero */}
                        {selectedCashBox.profitMetrics.salesItems.some((item: any) => item.cost === 0) && (
                          <tr className="bg-yellow-50">
                            <td colSpan={5} className="px-4 py-2 text-xs text-yellow-700">
                              <span className="font-semibold">⚠️ Atenção:</span> Alguns produtos têm custo zero. 
                              Acesse <strong>Configurações → Manutenção do Banco de Dados</strong> para corrigir custos históricos.
                            </td>
                          </tr>
                        )}
                        {/* Linha de Totais */}
                        <tr className="bg-gray-100 font-bold">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            TOTAIS
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                            {selectedCashBox.profitMetrics.salesItems.reduce((sum, item) => sum + item.qtySold, 0)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-blue-700 font-bold">
                            {formatCurrency(selectedCashBox.profitMetrics.totalRevenue)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-orange-700 font-bold">
                            {formatCurrency(selectedCashBox.profitMetrics.totalCOGS)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-green-700 font-bold">
                            {formatCurrency(selectedCashBox.profitMetrics.grossProfit)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {/* Resumo Financeiro Principal */}
              {selectedCashBox.profitMetrics ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-6 rounded-lg border-2 border-blue-200">
                      <div className="text-sm text-blue-600 font-semibold uppercase tracking-wide">Valor da Venda Total</div>
                      <div className="text-3xl font-bold text-blue-900 mt-2">
                        {formatCurrency(selectedCashBox.profitMetrics.totalRevenue)}
                      </div>
                    </div>
                    <div className="bg-orange-50 p-6 rounded-lg border-2 border-orange-200">
                      <div className="text-sm text-orange-600 font-semibold uppercase tracking-wide">Valor da Reposição</div>
                      <div className="text-3xl font-bold text-orange-900 mt-2">
                        {formatCurrency(selectedCashBox.profitMetrics.totalCOGS)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-green-50 p-6 rounded-lg border-2 border-green-200">
                      <div className="text-sm text-green-600 font-semibold uppercase tracking-wide">Lucro Bruto</div>
                      <div className="text-3xl font-bold text-green-900 mt-2">
                        {formatCurrency(selectedCashBox.profitMetrics.grossProfit)}
                      </div>
                    </div>
                    <div className="bg-yellow-50 p-6 rounded-lg border-2 border-yellow-200">
                      <div className="text-sm text-yellow-600 font-semibold uppercase tracking-wide flex items-center gap-2">
                        <span>Vales (Crédito)</span>
                      </div>
                      <div className="text-3xl font-bold text-yellow-900 mt-2">
                        {formatCurrency(selectedCashBox.total_debt || 0)}
                      </div>
                      <div className="text-xs text-yellow-600 mt-1">
                        A receber dos clientes
                      </div>
                    </div>
                    <div className="bg-purple-50 p-6 rounded-lg border-2 border-purple-200">
                      <div className="text-sm text-purple-600 font-semibold uppercase tracking-wide">Lucro Líquido</div>
                      <div className="text-3xl font-bold text-purple-900 mt-2">
                        {formatCurrency(selectedCashBox.profitMetrics.grossProfit - (selectedCashBox.total_debt || 0))}
                      </div>
                      <div className="text-xs text-purple-600 mt-1">
                        Margem: {(((selectedCashBox.profitMetrics.grossProfit - (selectedCashBox.total_debt || 0)) / selectedCashBox.profitMetrics.totalRevenue) * 100).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 p-6 rounded-lg">
                  <p className="text-gray-600 text-center">Carregando métricas de lucro...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashBoxHistory;
