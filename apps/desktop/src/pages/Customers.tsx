import { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, Eye, User, ShoppingBag, CreditCard, TrendingUp, Calendar } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import ConfirmDialog from '../components/ConfirmDialog';

interface Customer {
  id: string;
  code: string;
  name: string;
  phone: string;
  email: string;
  credit_limit: number;
  current_debt: number;
  is_blocked: boolean;
  loyalty_points: number;
}

interface CustomerStats {
  total_orders: number;
  total_spent: number;
  avg_order_value: number;
  lastPurchaseDate: string | null;
  topProducts: Array<{
    product_name: string;
    total_quantity: number;
    total_spent: number;
  }>;
}

interface PurchaseHistory {
  id: string;
  sale_number: string;
  created_at: string;
  total: number;
  status: string;
  payment_method: string;
  items_count: number;
}

export default function CustomersPage() {
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerStats, setCustomerStats] = useState<CustomerStats | null>(null);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistory[]>([]);
  const [editMode, setEditMode] = useState(false);
  
  // Controle de modal de confirmação
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmDialogConfig, setConfirmDialogConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'warning' | 'info';
  }>({ title: '', message: '', onConfirm: () => {} });
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    creditLimit: 0,
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      // @ts-ignore
      const result = await window.electronAPI?.customers?.list?.({ search });
      if (result && Array.isArray(result)) {
        setCustomers(result);
      }
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      toast?.error('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      loadCustomers();
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [search]);

  const handleOpenModal = (customer?: Customer) => {
    if (customer) {
      setEditMode(true);
      setSelectedCustomer(customer);
      setFormData({
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        creditLimit: customer.credit_limit / 100, // Converter de centavos
      });
    } else {
      setEditMode(false);
      setSelectedCustomer(null);
      setFormData({
        name: '',
        phone: '',
        email: '',
        creditLimit: 0,
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedCustomer(null);
    setEditMode(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const data = {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        creditLimit: Math.round(formData.creditLimit * 100), // Converter para centavos
      };

      if (editMode && selectedCustomer) {
        // @ts-ignore
        await window.electronAPI?.customers?.update?.(selectedCustomer.id, data);
        toast?.success('Cliente atualizado com sucesso!');
      } else {
        // @ts-ignore
        await window.electronAPI?.customers?.create?.(data);
        toast?.success('Cliente cadastrado com sucesso!');
      }

      handleCloseModal();
      loadCustomers();
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
      toast?.error('Erro ao salvar cliente');
    }
  };

  const handleDelete = async (customer: Customer) => {
    setConfirmDialogConfig({
      title: 'Bloquear Cliente',
      message: `Deseja realmente bloquear o cliente ${customer.name}? Esta ação pode ser revertida posteriormente.`,
      type: 'danger',
      onConfirm: async () => {
        setShowConfirmDialog(false);
        try {
          // @ts-ignore
          await window.electronAPI?.customers?.delete?.(customer.id);
          toast?.success('Cliente bloqueado com sucesso!');
          loadCustomers();
        } catch (error) {
          console.error('Erro ao bloquear cliente:', error);
          toast?.error('Erro ao bloquear cliente');
        }
      }
    });
    setShowConfirmDialog(true);
  };

  const handleViewDetails = async (customer: Customer) => {
    try {
      setSelectedCustomer(customer);
      setShowDetailModal(true);
      
      // Carregar estatísticas
      // @ts-ignore
      const stats = await window.electronAPI?.customers?.getStats?.(customer.id);
      setCustomerStats(stats);
      
      // Carregar histórico de compras (últimas 10)
      // @ts-ignore
      const history = await window.electronAPI?.customers?.getPurchaseHistory?.(customer.id, { limit: 10 });
      setPurchaseHistory(history || []);
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
      toast?.error('Erro ao carregar detalhes do cliente');
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredCustomers = customers;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="w-8 h-8" />
          Clientes
        </h1>
        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Novo Cliente
        </button>
      </div>

      {/* Busca */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone, email ou código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando...</div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Nenhum cliente encontrado
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Telefone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pontos</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Limite Crédito</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {customer.code}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {customer.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {customer.phone || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {customer.email || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-green-600">
                    {customer.loyalty_points || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatCurrency(customer.credit_limit)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {customer.is_blocked ? (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                        Bloqueado
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        Ativo
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleViewDetails(customer)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Ver Detalhes"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleOpenModal(customer)}
                        className="text-green-600 hover:text-green-900"
                        title="Editar"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(customer)}
                        className="text-red-600 hover:text-red-900"
                        title="Bloquear"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de Cadastro/Edição */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">
                {editMode ? 'Editar Cliente' : 'Novo Cliente'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Limite de Crédito (FCFA)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={formData.creditLimit}
                    onChange={(e) => setFormData({ ...formData, creditLimit: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editMode ? 'Atualizar' : 'Cadastrar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes */}
      {showDetailModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <User className="w-7 h-7" />
                    {selectedCustomer.name}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">Código: {selectedCustomer.code}</p>
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

              {/* Informações de Contato */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-800 mb-3">Informações de Contato</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-600">Telefone:</span>
                    <p className="font-medium">{selectedCustomer.phone || 'Não informado'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Email:</span>
                    <p className="font-medium">{selectedCustomer.email || 'Não informado'}</p>
                  </div>
                </div>
              </div>

              {/* Estatísticas */}
              {customerStats && (
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <ShoppingBag className="w-5 h-5 text-blue-600" />
                      <span className="text-sm text-blue-600 font-semibold">Total Pedidos</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-900">{customerStats.total_orders}</p>
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <CreditCard className="w-5 h-5 text-green-600" />
                      <span className="text-sm text-green-600 font-semibold">Total Gasto</span>
                    </div>
                    <p className="text-2xl font-bold text-green-900">{formatCurrency(customerStats.total_spent)}</p>
                  </div>

                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-5 h-5 text-purple-600" />
                      <span className="text-sm text-purple-600 font-semibold">Ticket Médio</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-900">{formatCurrency(customerStats.avg_order_value)}</p>
                  </div>

                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-5 h-5 text-orange-600" />
                      <span className="text-sm text-orange-600 font-semibold">Última Compra</span>
                    </div>
                    <p className="text-lg font-bold text-orange-900">
                      {customerStats.lastPurchaseDate ? formatDate(customerStats.lastPurchaseDate) : 'Nunca'}
                    </p>
                  </div>
                </div>
              )}

              {/* Top Produtos */}
              {customerStats && customerStats.topProducts.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-800 mb-3">Produtos Mais Comprados</h3>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Produto</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Quantidade</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Total Gasto</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {customerStats.topProducts.map((product, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2 text-sm">{product.product_name}</td>
                            <td className="px-4 py-2 text-sm text-right">{product.total_quantity}</td>
                            <td className="px-4 py-2 text-sm text-right font-semibold text-green-600">
                              {formatCurrency(product.total_spent)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Histórico de Compras */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-3">Últimas Compras</h3>
                {purchaseHistory.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Nenhuma compra registrada</p>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Número</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Data</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Itens</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Pagamento</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Total</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {purchaseHistory.map((purchase) => (
                          <tr key={purchase.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm font-medium">{purchase.sale_number}</td>
                            <td className="px-4 py-2 text-sm">{formatDateTime(purchase.created_at)}</td>
                            <td className="px-4 py-2 text-sm text-center">{purchase.items_count}</td>
                            <td className="px-4 py-2 text-center">
                              {purchase.payment_method ? (
                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                  {(() => {
                                    const method = purchase.payment_method.toLowerCase();
                                    return method === 'cash' ? 'Dinheiro' : 
                                           method === 'orange' || method === 'orange_money' ? 'Orange Money' :
                                           method === 'teletaku' ? 'TeleTaku' :
                                           method === 'vale' ? 'Vale' : purchase.payment_method;
                                  })()}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-sm text-right font-semibold text-green-600">
                              {formatCurrency(purchase.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação */}
      {showConfirmDialog && (
        <ConfirmDialog
          title={confirmDialogConfig.title}
          message={confirmDialogConfig.message}
          confirmText="Confirmar"
          cancelText="Cancelar"
          type={confirmDialogConfig.type}
          onConfirm={confirmDialogConfig.onConfirm}
          onCancel={() => setShowConfirmDialog(false)}
        />
      )}
    </div>
  );
}
