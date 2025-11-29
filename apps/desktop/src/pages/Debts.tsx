import { useState, useEffect } from 'react';
import { Search, FileText, DollarSign, AlertCircle, CheckCircle, XCircle, Calendar, User, Plus } from 'lucide-react';
import { formatCurrency } from '../utils/currency';
import { useToast } from '../contexts/ToastContext';

interface Debt {
  id: string;
  debt_number: string;
  customer_id: string;
  customer_name: string;
  customer_code: string;
  customer_phone: string | null;
  sale_id: string | null;
  sale_number: string | null;
  branch_id: string;
  original_amount: number;
  paid_amount: number;
  balance: number;
  status: 'pending' | 'partial' | 'paid' | 'cancelled';
  due_date: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface DebtPayment {
  id: string;
  debt_id: string;
  amount: number;
  method: string;
  reference: string | null;
  notes: string | null;
  received_by: string;
  created_at: string;
}

interface DebtWithPayments extends Debt {
  payments: DebtPayment[];
  credit_limit: number;
  current_debt: number;
}

interface SaleItem {
  id: string;
  product_name: string;
  qty_units: number;
  unit_price: number;
  total: number;
}

interface SaleDetails {
  sale_number: string;
  total: number;
  items: SaleItem[];
  created_at: string;
}

interface CustomerDebts {
  customer_id: string;
  customer_name: string;
  customer_code: string;
  customer_phone: string | null;
  credit_limit: number;
  current_debt: number;
  total_debts: number;
  pending_debts: number;
  total_original: number;
  total_paid: number;
  total_balance: number;
  debts: Debt[];
}

export default function Debts() {
  const toast = useToast();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [groupedDebts, setGroupedDebts] = useState<CustomerDebts[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCustomerDebts, setSelectedCustomerDebts] = useState<CustomerDebts | null>(null);
  const [selectedDebtDetails, setSelectedDebtDetails] = useState<any[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedDebtForPayment, setSelectedDebtForPayment] = useState<DebtWithPayments | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  useEffect(() => {
    loadDebts();
  }, [statusFilter]);

  const loadDebts = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      
      if (statusFilter !== 'all') {
        filters.status = statusFilter;
      }

      // @ts-ignore
      const data = await window.electronAPI?.debts?.list?.(filters);
      setDebts(data || []);
      
      // Agrupar dívidas por cliente
      const grouped = groupDebtsByCustomer(data || []);
      setGroupedDebts(grouped);
    } catch (error) {
      console.error('Erro ao carregar dívidas:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupDebtsByCustomer = (debts: Debt[]): CustomerDebts[] => {
    const customerMap = new Map<string, CustomerDebts>();

    debts.forEach(debt => {
      const customerId = debt.customer_id;
      
      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          customer_id: customerId,
          customer_name: debt.customer_name,
          customer_code: debt.customer_code,
          customer_phone: debt.customer_phone,
          credit_limit: 0,
          current_debt: 0,
          total_debts: 0,
          pending_debts: 0,
          total_original: 0,
          total_paid: 0,
          total_balance: 0,
          debts: []
        });
      }

      const customerData = customerMap.get(customerId)!;
      customerData.debts.push(debt);
      customerData.total_debts++;
      customerData.total_original += debt.original_amount;
      customerData.total_paid += debt.paid_amount;
      customerData.total_balance += debt.balance;
      
      if (debt.status === 'pending' || debt.status === 'partial') {
        customerData.pending_debts++;
      }
    });

    return Array.from(customerMap.values()).sort((a, b) => 
      b.total_balance - a.total_balance
    );
  };

  const handleCustomerClick = async (customerDebts: CustomerDebts) => {
    try {
      setSelectedCustomerDebts(customerDebts);
      
      // Buscar detalhes de cada dívida incluindo dados da venda
      const detailsPromises = customerDebts.debts.map(async (debt) => {
        // @ts-ignore
        const debtDetails = await window.electronAPI?.debts?.getById?.(debt.id);
        
        // Se houver venda associada, buscar itens da venda
        let saleDetails = null;
        if (debt.sale_id) {
          try {
            // @ts-ignore
            const sale = await window.electronAPI?.sales?.getById?.(debt.sale_id);
            if (sale) {
              saleDetails = {
                sale_number: sale.sale_number,
                total: sale.total,
                items: sale.items || [],
                created_at: sale.created_at
              };
            }
          } catch (error) {
            console.error('Erro ao buscar detalhes da venda:', error);
          }
        }
        
        return {
          ...debtDetails,
          saleDetails
        };
      });
      
      const details = await Promise.all(detailsPromises);
      setSelectedDebtDetails(details);
    } catch (error) {
      console.error('Erro ao carregar detalhes das dívidas:', error);
    }
  };

  const handlePayDebt = async () => {
    if (!selectedDebtForPayment || !paymentAmount) {
      toast.warning('⚠️ Preencha o valor do pagamento');
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('❌ Valor inválido');
      return;
    }

    const amountCents = Math.round(amount * 100);
    const balanceCents = selectedDebtForPayment.balance;

    if (amountCents > balanceCents) {
      toast.error(`❌ Valor maior que o saldo da dívida (${formatCurrency(balanceCents)})`);
      return;
    }

    try {
      // @ts-ignore
      await window.electronAPI?.debts?.pay?.({
        debtId: selectedDebtForPayment.id,
        amount: amountCents,
        method: paymentMethod,
        reference: paymentReference || null,
        notes: paymentNotes || null,
        receivedBy: 'offline-admin'
      });

      toast.success(`✅ Pagamento de ${formatCurrency(amountCents)} registrado com sucesso!`, 5000);
      
      // Recarregar
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentReference('');
      setPaymentNotes('');
      setSelectedDebtForPayment(null);
      await loadDebts();
      
      // Recarregar detalhes do cliente se modal estiver aberto
      if (selectedCustomerDebts) {
        const updatedCustomer = groupedDebts.find(c => c.customer_id === selectedCustomerDebts.customer_id);
        if (updatedCustomer) {
          await handleCustomerClick(updatedCustomer);
        }
      }
    } catch (error) {
      console.error('Erro ao registrar pagamento:', error);
      toast.error('❌ Erro ao registrar pagamento: ' + (error as Error).message);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { label: 'Pendente', color: 'bg-red-100 text-red-700', icon: AlertCircle },
      partial: { label: 'Parcial', color: 'bg-yellow-100 text-yellow-700', icon: DollarSign },
      paid: { label: 'Pago', color: 'bg-green-100 text-green-700', icon: CheckCircle },
      cancelled: { label: 'Cancelado', color: 'bg-gray-100 text-gray-700', icon: XCircle },
    };
    const config = badges[status as keyof typeof badges] || badges.pending;
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${config.color}`}>
        <Icon size={14} />
        {config.label}
      </span>
    );
  };

  const filteredGroupedDebts = groupedDebts.filter(g =>
    g.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    g.customer_code.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    totalCustomers: groupedDebts.length,
    total: debts.length,
    pending: debts.filter(d => d.status === 'pending').length,
    partial: debts.filter(d => d.status === 'partial').length,
    paid: debts.filter(d => d.status === 'paid').length,
    totalAmount: debts.reduce((sum, d) => sum + d.original_amount, 0),
    totalBalance: debts.filter(d => d.status !== 'paid' && d.status !== 'cancelled').reduce((sum, d) => sum + d.balance, 0),
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <FileText size={32} />
            Gestão de Dívidas (Vales)
          </h1>
          <p className="text-gray-600 mt-1">Controle de crédito e quitação de dívidas</p>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total de Dívidas</p>
                <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
              </div>
              <FileText size={32} className="text-blue-500" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pendentes</p>
                <p className="text-2xl font-bold text-red-600">{stats.pending}</p>
              </div>
              <AlertCircle size={32} className="text-red-500" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Valor Total</p>
                <p className="text-2xl font-bold text-gray-800">{formatCurrency(stats.totalAmount)}</p>
              </div>
              <DollarSign size={32} className="text-green-500" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Saldo a Receber</p>
                <p className="text-2xl font-bold text-orange-600">{formatCurrency(stats.totalBalance)}</p>
              </div>
              <DollarSign size={32} className="text-orange-500" />
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Buscar por cliente, código ou número da dívida..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  statusFilter === 'pending'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Pendentes
              </button>
              <button
                onClick={() => setStatusFilter('partial')}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  statusFilter === 'partial'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Parciais
              </button>
              <button
                onClick={() => setStatusFilter('paid')}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  statusFilter === 'paid'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Pagos
              </button>
            </div>
          </div>
        </div>

        {/* Tabela de Clientes com Dívidas (Agrupado) */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Carregando dívidas...</div>
          ) : filteredGroupedDebts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <FileText size={48} className="mx-auto mb-2 text-gray-300" />
              <p>Nenhuma dívida encontrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Cliente</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Qtd Vales</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Pendentes</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Total Emprestado</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Total Pago</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Saldo Devedor</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredGroupedDebts.map((customerDebts) => (
                    <tr key={customerDebts.customer_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User size={20} className="text-gray-400" />
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{customerDebts.customer_name}</p>
                            <p className="text-xs text-gray-500">{customerDebts.customer_code}</p>
                            {customerDebts.customer_phone && (
                              <p className="text-xs text-gray-400">{customerDebts.customer_phone}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                          {customerDebts.total_debts}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {customerDebts.pending_debts > 0 ? (
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-700 font-bold text-sm">
                            {customerDebts.pending_debts}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-right text-gray-800">
                        {formatCurrency(customerDebts.total_original)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-right text-green-600">
                        {formatCurrency(customerDebts.total_paid)}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-right text-red-600">
                        {formatCurrency(customerDebts.total_balance)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleCustomerClick(customerDebts)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
                        >
                          Ver Detalhes
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Detalhes do Cliente */}
      {selectedCustomerDebts && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b bg-gradient-to-r from-blue-500 to-blue-600">
              <div className="flex items-start justify-between">
                <div className="text-white">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <User size={28} />
                    {selectedCustomerDebts.customer_name}
                  </h2>
                  <p className="text-blue-100 mt-1">
                    {selectedCustomerDebts.customer_code} • {selectedCustomerDebts.total_debts} vale(s) registrado(s)
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedCustomerDebts(null);
                    setSelectedDebtDetails([]);
                  }}
                  className="text-white hover:text-blue-100"
                >
                  <XCircle size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Resumo Geral do Cliente */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Total Emprestado</p>
                  <p className="text-xl font-bold text-gray-800">{formatCurrency(selectedCustomerDebts.total_original)}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Total Pago</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(selectedCustomerDebts.total_paid)}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Saldo Devedor</p>
                  <p className="text-xl font-bold text-red-600">{formatCurrency(selectedCustomerDebts.total_balance)}</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Vales Pendentes</p>
                  <p className="text-xl font-bold text-blue-600">{selectedCustomerDebts.pending_debts}</p>
                </div>
              </div>

              {/* Lista de Todos os Vales do Cliente */}
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <FileText size={22} />
                  Todos os Vales ({selectedCustomerDebts.total_debts})
                </h3>

                <div className="space-y-4">
                  {selectedDebtDetails.map((debt, index) => (
                    <div key={debt.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Header do Vale */}
                      <div className="bg-gray-50 p-4 border-b">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <span className="text-lg font-bold text-gray-700">#{index + 1}</span>
                            <div>
                              <p className="font-semibold text-gray-800">
                                Débito: <span className="text-blue-600">{debt.debt_number}</span>
                              </p>
                              {debt.sale_number && (
                                <p className="text-sm text-gray-600">
                                  Venda: <span className="text-green-600">{debt.sale_number}</span>
                                </p>
                              )}
                              <p className="text-xs text-gray-500">
                                {new Date(debt.created_at).toLocaleString('pt-BR')}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            {getStatusBadge(debt.status)}
                            <p className="text-sm font-semibold text-gray-800 mt-2">
                              {formatCurrency(debt.original_amount)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Detalhes da Venda */}
                      {debt.saleDetails && (
                        <div className="p-4 bg-white">
                          <h4 className="font-semibold text-gray-700 mb-3 text-sm">Produtos da Venda:</h4>
                          <div className="space-y-2">
                            {debt.saleDetails.items.map((item: any) => (
                              <div key={item.id} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                                <div className="flex-1">
                                  <p className="font-medium text-gray-800">{item.product_name}</p>
                                  <p className="text-xs text-gray-500">
                                    {item.qty_units} un × {formatCurrency(item.unit_price)}
                                  </p>
                                </div>
                                <p className="font-semibold text-gray-800">
                                  {formatCurrency(item.total)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Resumo do Vale */}
                      <div className="p-4 bg-gray-50 border-t">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600">Valor Original:</p>
                            <p className="font-bold text-gray-800">{formatCurrency(debt.original_amount)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Pago:</p>
                            <p className="font-bold text-green-600">{formatCurrency(debt.paid_amount)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Saldo:</p>
                            <p className="font-bold text-red-600">{formatCurrency(debt.balance)}</p>
                          </div>
                        </div>

                        {/* Histórico de Pagamentos deste Vale */}
                        {debt.payments && debt.payments.length > 0 && (
                          <div className="mt-4 pt-4 border-t">
                            <p className="text-xs font-semibold text-gray-700 mb-2">Pagamentos deste vale:</p>
                            <div className="space-y-1">
                              {debt.payments.map((payment: any) => (
                                <div key={payment.id} className="flex items-center justify-between text-xs bg-white p-2 rounded">
                                  <span className="text-gray-600">
                                    {new Date(payment.created_at).toLocaleDateString('pt-BR')} - {payment.method}
                                  </span>
                                  <span className="font-semibold text-green-600">{formatCurrency(payment.amount)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Botão de Pagamento */}
                        {debt.balance > 0 && debt.status !== 'cancelled' && (
                          <div className="mt-4 pt-4 border-t">
                            <button
                              onClick={() => {
                                setSelectedDebtForPayment(debt);
                                setShowPaymentModal(true);
                              }}
                              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold flex items-center justify-center gap-2"
                            >
                              <Plus size={18} />
                              Registrar Pagamento deste Vale
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Pagamento */}
      {showPaymentModal && selectedDebtForPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <DollarSign size={24} />
                Registrar Pagamento
              </h2>
              <p className="text-sm text-gray-600 mt-1">Vale: {selectedDebtForPayment.debt_number}</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Saldo Devedor</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(selectedDebtForPayment.balance)}</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Valor do Pagamento (FCFA)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Método de Pagamento
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="cash">Dinheiro</option>
                  <option value="orange">Orange Money</option>
                  <option value="teletaku">TeleTaku</option>
                  <option value="transfer">Transferência</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Referência (Opcional)
                </label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Ex: Número da transação"
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Observações (Opcional)
                </label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Notas adicionais..."
                  rows={3}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setPaymentAmount('');
                    setPaymentReference('');
                    setPaymentNotes('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
                >
                  Cancelar
                </button>
                <button
                  onClick={handlePayDebt}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
                >
                  Confirmar Pagamento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
