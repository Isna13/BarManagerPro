import React, { useState, useEffect } from 'react';
import { DollarSign, Lock, Unlock, TrendingUp, CreditCard, Smartphone, AlertCircle, Calendar, Clock, User, History, Receipt } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import ConfirmDialog from '../components/ConfirmDialog';

interface CashBox {
  id: string;
  box_number: string;
  branch_id: string;
  opened_by: string;
  closed_by?: string;
  status: 'open' | 'closed';
  opening_cash: number;
  total_sales: number;
  total_cash: number;
  total_card: number;
  total_mobile_money: number;
  total_debt: number;
  closing_cash?: number;
  difference?: number;
  notes?: string;
  opened_at: string;
  closed_at?: string;
}

interface Sale {
  id: string;
  sale_number: string;
  total: number;
  payment_method: string;
  created_at: string;
}

const CashBox: React.FC = () => {
  const toast = useToast();
  const [currentCashBox, setCurrentCashBox] = useState<CashBox | null>(null);
  const navigate = useNavigate();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    loadCurrentCashBox();
  }, []);

  useEffect(() => {
    if (currentCashBox) {
      loadSales();
    }
  }, [currentCashBox]);

  const loadCurrentCashBox = async () => {
    try {
      // @ts-ignore
      const cashBox = await window.electronAPI?.cashBox?.getCurrent?.();
      setCurrentCashBox(cashBox || null);
    } catch (error) {
      console.error('Erro ao carregar caixa:', error);
    }
  };

  const loadSales = async () => {
    if (!currentCashBox) return;
    
    try {
      // @ts-ignore
      const allSales = await window.electronAPI?.sales?.list?.({});
      
      // Filtrar vendas do período do caixa aberto
      const cashBoxSales = allSales.filter((sale: any) => {
        const saleDate = new Date(sale.created_at);
        const openedDate = new Date(currentCashBox.opened_at);
        return saleDate >= openedDate;
      });
      
      setSales(cashBoxSales);
    } catch (error) {
      console.error('Erro ao carregar vendas:', error);
    }
  };

  const handleOpenCashBox = async () => {
    const openingAmount = parseFloat(openingCash) || 0;
    
    if (openingAmount < 0) {
      toast.warning('O valor inicial não pode ser negativo');
      return;
    }

    setLoading(true);
    try {
      const boxNumber = `CX-${new Date().getTime()}`;
      
      // @ts-ignore
      await window.electronAPI?.cashBox?.open?.({
        boxNumber,
        branchId: 'main-branch',
        openedBy: 'offline-admin',
        openingCash: Math.round(openingAmount * 100), // Converter para centavos
      });

      toast.success('Caixa aberto com sucesso!');
      setShowOpenModal(false);
      setOpeningCash('');
      await loadCurrentCashBox();
    } catch (error: any) {
      console.error('Erro ao abrir caixa:', error);
      toast.error('Erro ao abrir caixa: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseCashBox = async () => {
    if (!currentCashBox) return;

    const closingAmount = parseFloat(closingCash);
    
    if (isNaN(closingAmount) || closingAmount < 0) {
      toast.warning('Informe o valor final do caixa');
      return;
    }

    const expectedAmount = calculateExpectedCash();
    const difference = closingAmount - expectedAmount;

    setLoading(true);
    try {
      // @ts-ignore
      await window.electronAPI?.cashBox?.close?.(currentCashBox.id, {
        closingCash: Math.round(closingAmount * 100),
        difference: Math.round(difference * 100),
        closedBy: 'offline-admin',
        notes: closingNotes,
      });

      toast.success(`Caixa fechado! ${difference !== 0 ? `Diferença: ${difference.toFixed(2)} FCFA` : 'Sem diferenças'}`);
      setShowCloseModal(false);
      setClosingCash('');
      setClosingNotes('');
      setCurrentCashBox(null);
      setSales([]);
    } catch (error: any) {
      console.error('Erro ao fechar caixa:', error);
      toast.error('Erro ao fechar caixa: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Calcula os totais do caixa.
   * PRIORIDADE: Usar valores sincronizados do servidor (armazenados no caixa)
   * FALLBACK: Calcular localmente a partir das vendas (quando offline ou dados não sincronizados)
   */
  const calculateTotals = () => {
    // PRIORIDADE 1: Usar valores sincronizados do servidor (armazenados no currentCashBox)
    // Esses valores foram calculados pelo servidor a partir da tabela de payments
    if (currentCashBox && (currentCashBox.total_sales > 0 || currentCashBox.total_cash > 0)) {
      const totalSales = (currentCashBox.total_sales || 0) / 100;
      const totalCash = (currentCashBox.total_cash || 0) / 100;
      const totalCard = (currentCashBox.total_card || 0) / 100;
      const totalMobile = (currentCashBox.total_mobile_money || 0) / 100;
      const totalDebt = (currentCashBox.total_debt || 0) / 100;
      
      console.log('📊 Usando totais SINCRONIZADOS do servidor:', { totalSales, totalCash, totalCard, totalMobile, totalDebt });
      return { totalCash, totalCard, totalMobile, totalDebt, totalSales };
    }
    
    // FALLBACK: Calcular localmente a partir das vendas (modo offline)
    console.log('📊 Calculando totais LOCALMENTE a partir das vendas (fallback)');
    let totalCash = 0;
    let totalCard = 0;
    let totalMobile = 0;
    let totalDebt = 0;
    let totalSales = 0;

    sales.forEach(sale => {
      const amount = sale.total / 100;
      totalSales += amount;

      // Normalizar método para minúsculas para compatibilidade
      const method = (sale.payment_method || '').toLowerCase();

      if (method === 'cash') {
        totalCash += amount;
      } else if (method === 'mixed' || method === 'card') {
        totalCard += amount;
      } else if (method === 'orange' || method === 'orange_money' || method === 'teletaku' || method === 'mobile' || method === 'mobile_money') {
        totalMobile += amount;
      } else if (method === 'debt' || method === 'vale') {
        totalDebt += amount;
      }
    });

    return { totalCash, totalCard, totalMobile, totalDebt, totalSales };
  };

  const calculateExpectedCash = () => {
    const { totalCash } = calculateTotals();
    const opening = currentCashBox ? currentCashBox.opening_cash / 100 : 0;
    // O esperado em caixa é o valor inicial + pagamentos em dinheiro
    return opening + totalCash;
  };

  // Força recálculo quando currentCashBox muda
  useEffect(() => {
    if (currentCashBox) {
      // Trigger re-render quando os valores do caixa mudam
      console.log('📦 Caixa atualizado:', {
        id: currentCashBox.id,
        totalSales: currentCashBox.total_sales,
        totalCash: currentCashBox.total_cash,
        totalMobile: currentCashBox.total_mobile_money,
        totalDebt: currentCashBox.total_debt
      });
    }
  }, [currentCashBox]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totals = calculateTotals();
  const expectedCash = calculateExpectedCash();

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Gestão de Caixa</h1>
        
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/cashbox-history')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all"
          >
            <History size={20} />
            <span className="font-semibold">Ver Histórico</span>
          </button>
          
          {!currentCashBox ? (
          <button
            onClick={() => setShowOpenModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all shadow-lg hover:shadow-xl"
          >
            <Unlock size={20} />
            <span className="font-semibold">Abrir Caixa</span>
          </button>
        ) : (
          <button
            onClick={() => setShowCloseModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all shadow-lg hover:shadow-xl"
          >
            <Lock size={20} />
            <span className="font-semibold">Fechar Caixa</span>
          </button>
          )}
        </div>
      </div>

      {/* Status do Caixa */}
      {!currentCashBox ? (
        <div className="bg-gradient-to-r from-orange-50 to-orange-100 border-2 border-orange-300 rounded-xl p-8 text-center">
          <AlertCircle size={48} className="mx-auto text-orange-600 mb-4" />
          <h2 className="text-2xl font-bold text-orange-900 mb-2">Caixa Fechado</h2>
          <p className="text-orange-700 mb-4">Abra o caixa para começar a registrar vendas</p>
          <button
            onClick={() => setShowOpenModal(true)}
            className="px-8 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-semibold"
          >
            Abrir Caixa Agora
          </button>
        </div>
      ) : (
        <>
          {/* Informações do Caixa Aberto */}
          <div className="bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-300 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-600 rounded-full">
                  <Unlock size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-green-900">Caixa Aberto</h2>
                  <p className="text-green-700">{currentCashBox.box_number}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-green-700">Abertura</p>
                <p className="font-bold text-green-900">{formatDate(currentCashBox.opened_at)}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="bg-white rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Valor Inicial</p>
                <p className="text-xl font-bold text-gray-900">
                  {(currentCashBox.opening_cash / 100).toFixed(2)} FCFA
                </p>
              </div>
              <div className="bg-white rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Total de Vendas</p>
                <p className="text-xl font-bold text-blue-600">
                  {sales.length} venda{sales.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="bg-white rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Faturamento Total</p>
                <p className="text-xl font-bold text-green-600">
                  {totals.totalSales.toFixed(2)} FCFA
                </p>
              </div>
            </div>
          </div>

          {/* Cards de Totais por Método de Pagamento */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-white p-6 rounded-xl border-2 border-gray-200 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign size={24} className="text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-700">Dinheiro</h3>
              </div>
              <p className="text-2xl font-bold text-green-600">{totals.totalCash.toFixed(2)} FCFA</p>
              <p className="text-sm text-gray-500 mt-1">Esperado: {expectedCash.toFixed(2)} FCFA</p>
            </div>

            <div className="bg-white p-6 rounded-xl border-2 border-gray-200 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Smartphone size={24} className="text-purple-600" />
                </div>
                <h3 className="font-semibold text-gray-700">Orange & TeleTaku</h3>
              </div>
              <p className="text-2xl font-bold text-purple-600">{totals.totalMobile.toFixed(2)} FCFA</p>
              <p className="text-xs text-gray-500 mt-1">Mobile Money</p>
            </div>

            <div className="bg-white p-6 rounded-xl border-2 border-gray-200 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <CreditCard size={24} className="text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-700">Misto</h3>
              </div>
              <p className="text-2xl font-bold text-blue-600">{totals.totalCard.toFixed(2)} FCFA</p>
              <p className="text-xs text-gray-500 mt-1">Pagamento Combinado</p>
            </div>

            <div className="bg-white p-6 rounded-xl border-2 border-gray-200 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Receipt size={24} className="text-yellow-600" />
                </div>
                <h3 className="font-semibold text-gray-700">Vale</h3>
              </div>
              <p className="text-2xl font-bold text-yellow-600">{totals.totalDebt.toFixed(2)} FCFA</p>
              <p className="text-xs text-gray-500 mt-1">Crédito Concedido</p>
            </div>

            <div className="bg-white p-6 rounded-xl border-2 border-gray-200 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <TrendingUp size={24} className="text-orange-600" />
                </div>
                <h3 className="font-semibold text-gray-700">Total Geral</h3>
              </div>
              <p className="text-2xl font-bold text-orange-600">{totals.totalSales.toFixed(2)} FCFA</p>
            </div>
          </div>

          {/* Tabela de Vendas */}
          <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold">Vendas do Período</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Número</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Data/Hora</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Método</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sales.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                        Nenhuma venda registrada ainda
                      </td>
                    </tr>
                  ) : (
                    sales.map((sale) => {
                      const method = (sale.payment_method || '').toLowerCase();
                      return (
                      <tr key={sale.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{sale.sale_number}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{formatDate(sale.created_at)}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            method === 'cash' ? 'bg-green-100 text-green-700' :
                            method === 'orange' || method === 'orange_money' ? 'bg-orange-100 text-orange-700' :
                            method === 'teletaku' ? 'bg-purple-100 text-purple-700' :
                            method === 'mixed' ? 'bg-blue-100 text-blue-700' :
                            method === 'vale' || method === 'debt' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {method === 'cash' ? '💵 Dinheiro (FCFA)' :
                             method === 'orange' || method === 'orange_money' ? '🍊 Orange Money' :
                             method === 'teletaku' ? '📱 TeleTaku' :
                             method === 'mixed' ? '💳 Misto' :
                             method === 'vale' || method === 'debt' ? '📝 Vale' : 'Outro'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-right text-gray-900">
                          {(sale.total / 100).toFixed(2)} FCFA
                        </td>
                      </tr>
                    )})
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal Abrir Caixa */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6 rounded-t-xl">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <Unlock size={28} />
                Abrir Caixa
              </h2>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Valor Inicial em Caixa (FCFA)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg"
                  placeholder="0.00"
                  autoFocus
                />
                <p className="text-sm text-gray-500 mt-2">
                  Informe o valor em dinheiro que está no caixa no momento da abertura
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowOpenModal(false);
                    setOpeningCash('');
                  }}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleOpenCashBox}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Abrindo...' : 'Abrir Caixa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Fechar Caixa */}
      {showCloseModal && currentCashBox && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
            <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6 rounded-t-xl">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <Lock size={28} />
                Fechar Caixa
              </h2>
            </div>
            
            <div className="p-6">
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-bold text-gray-800 mb-3">Resumo do Caixa</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Valor Inicial:</p>
                    <p className="font-bold text-lg">{(currentCashBox.opening_cash / 100).toFixed(2)} FCFA</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Total de Vendas:</p>
                    <p className="font-bold text-lg text-green-600">{totals.totalSales.toFixed(2)} FCFA</p>
                  </div>
                  <div>
                    <p className="text-gray-600">💵 Dinheiro:</p>
                    <p className="font-semibold text-md">{totals.totalCash.toFixed(2)} FCFA</p>
                  </div>
                  <div>
                    <p className="text-gray-600">💳 Cartão:</p>
                    <p className="font-semibold text-md">{totals.totalCard.toFixed(2)} FCFA</p>
                  </div>
                  <div>
                    <p className="text-gray-600">📱 Mobile Money:</p>
                    <p className="font-semibold text-md">{totals.totalMobile.toFixed(2)} FCFA</p>
                  </div>
                  <div>
                    <p className="text-gray-600">📋 Fiado:</p>
                    <p className="font-semibold text-md">{totals.totalDebt.toFixed(2)} FCFA</p>
                  </div>
                  <div className="col-span-2 pt-2 border-t">
                    <p className="text-gray-600">Dinheiro Esperado em Caixa:</p>
                    <p className="font-bold text-2xl text-blue-600">{expectedCash.toFixed(2)} FCFA</p>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Valor Final em Caixa (FCFA) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={closingCash}
                  onChange={(e) => setClosingCash(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-lg"
                  placeholder="0.00"
                  autoFocus
                />
              </div>

              {closingCash && (
                <div className={`p-4 rounded-lg mb-4 ${
                  parseFloat(closingCash) === expectedCash
                    ? 'bg-green-50 border-2 border-green-300'
                    : parseFloat(closingCash) > expectedCash
                    ? 'bg-blue-50 border-2 border-blue-300'
                    : 'bg-red-50 border-2 border-red-300'
                }`}>
                  <p className="font-semibold">
                    Diferença: {(parseFloat(closingCash) - expectedCash).toFixed(2)} FCFA
                  </p>
                  {parseFloat(closingCash) === expectedCash && (
                    <p className="text-sm text-green-700">✓ Caixa confere!</p>
                  )}
                  {parseFloat(closingCash) > expectedCash && (
                    <p className="text-sm text-blue-700">↑ Sobra no caixa</p>
                  )}
                  {parseFloat(closingCash) < expectedCash && (
                    <p className="text-sm text-red-700">↓ Falta no caixa</p>
                  )}
                </div>
              )}

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Observações (opcional)
                </label>
                <textarea
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Justificativa de diferenças, ocorrências, etc."
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCloseModal(false);
                    setClosingCash('');
                    setClosingNotes('');
                  }}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCloseCashBox}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold disabled:opacity-50"
                  disabled={loading || !closingCash}
                >
                  {loading ? 'Fechando...' : 'Fechar Caixa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog.show && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog({ ...confirmDialog, show: false })}
        />
      )}
    </div>
  );
};

export default CashBox;
