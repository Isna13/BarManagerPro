import React, { useState, useEffect } from 'react';
import { Search, Plus, Package, Calendar, CheckCircle, Clock, Trash2, ShoppingCart, Eye, X } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import ConfirmDialog from '../components/ConfirmDialog';
import SearchableSelect from '../components/common/SearchableSelect';

interface Supplier {
  id: string;
  name: string;
  code: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  cost_unit: number;
  cost_box: number;
  units_per_box: number;
}

interface PurchaseItem {
  productId: string;
  productName?: string;
  sku?: string;
  qtyUnits: number;
  unitCost: number;
  subtotal: number;
  total: number;
  batchNumber?: string;
  expiryDate?: string;
}

interface Purchase {
  id: string;
  purchase_number: string;
  supplier_id: string;
  supplier_name: string;
  status: string;
  total: number;
  payment_status: string;
  created_at: string;
  received_at?: string;
}

interface PurchaseDetail extends Purchase {
  items: Array<{
    id: string;
    product_id: string;
    product_name: string;
    product_sku: string;
    qty_units: number;
    unit_cost: number;
    total: number;
    batch_number?: string;
    expiry_date?: string;
  }>;
  supplier: {
    name: string;
    code: string;
    phone?: string;
    email?: string;
  };
  notes?: string;
  payment_method?: string;
}

const Purchases: React.FC = () => {
  const toast = useToast();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [currentPurchaseId, setCurrentPurchaseId] = useState<string | null>(null);
  const [purchaseDetails, setPurchaseDetails] = useState<PurchaseDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    supplierId: '',
    paymentMethod: 'cash',
    paymentStatus: 'pending',
    notes: '',
  });

  // Purchase items state
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [itemForm, setItemForm] = useState({
    productId: '',
    qtyUnits: '',
    unitCost: '',
    batchNumber: '',
    expiryDate: '',
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'warning' | 'info';
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    loadPurchases();
    loadSuppliers();
    loadProducts();
  }, []);

  const loadPurchases = async () => {
    try {
      const data = await window.electronAPI.purchases.list({ branchId: 'main-branch' });
      setPurchases(data);
    } catch (error) {
      console.error('Erro ao carregar compras:', error);
      toast.error('Erro ao carregar compras');
    }
  };

  const loadSuppliers = async () => {
    try {
      const data = await window.electronAPI.suppliers.list();
      setSuppliers(data);
    } catch (error) {
      console.error('Erro ao carregar fornecedores:', error);
    }
  };

  const loadProducts = async () => {
    try {
      const data = await window.electronAPI.products.list({});
      setProducts(data);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    }
  };

  const openModal = () => {
    setFormData({
      supplierId: '',
      paymentMethod: 'cash',
      paymentStatus: 'pending',
      notes: '',
    });
    setItems([]);
    setItemForm({
      productId: '',
      qtyUnits: '',
      unitCost: '',
      batchNumber: '',
      expiryDate: '',
    });
    setCurrentPurchaseId(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setCurrentPurchaseId(null);
    setItems([]);
  };

  const addItem = () => {
    if (!itemForm.productId || !itemForm.qtyUnits || !itemForm.unitCost) {
      toast.warning('Preencha produto, quantidade e custo por caixa');
      return;
    }

    const product = products.find(p => p.id === itemForm.productId);
    if (!product) return;

    const qtyBoxes = parseInt(itemForm.qtyUnits); // Quantidade de CAIXAS
    const unitsPerBox = product.units_per_box || 1;
    const qtyUnits = qtyBoxes * unitsPerBox; // Converter caixas para unidades totais
    
    const unitCost = Math.round(parseFloat(itemForm.unitCost) * 100); // Converter para centavos
    const subtotal = qtyBoxes * unitCost; // Custo total = caixas * custo_por_caixa
    const total = subtotal;

    const newItem: PurchaseItem = {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      qtyUnits, // Enviar total de unidades para o backend
      unitCost,
      subtotal,
      total,
      batchNumber: itemForm.batchNumber || undefined,
      expiryDate: itemForm.expiryDate || undefined,
    };

    setItems([...items, newItem]);
    setItemForm({
      productId: '',
      qtyUnits: '',
      unitCost: '',
      batchNumber: '',
      expiryDate: '',
    });
    toast.success('Item adicionado à compra');
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
    toast.info('Item removido');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.supplierId) {
      toast.warning('Selecione um fornecedor');
      return;
    }

    if (items.length === 0) {
      toast.warning('Adicione pelo menos um item à compra');
      return;
    }

    setLoading(true);

    try {
      // Criar compra
      const purchase = await window.electronAPI.purchases.create({
        branchId: 'main-branch',
        supplierId: formData.supplierId,
        status: 'pending',
        paymentMethod: formData.paymentMethod,
        paymentStatus: formData.paymentStatus,
        notes: formData.notes,
      });

      // Adicionar itens
      for (const item of items) {
        await window.electronAPI.purchases.addItem(purchase.id, {
          productId: item.productId,
          qtyUnits: item.qtyUnits,
          unitCost: item.unitCost,
          subtotal: item.subtotal,
          taxAmount: 0,
          total: item.total,
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate,
        });
      }

      toast.success(`Compra ${purchase.purchaseNumber} criada com sucesso!`);
      closeModal();
      loadPurchases();
    } catch (error: any) {
      console.error('Erro ao criar compra:', error);
      toast.error(error.message || 'Erro ao criar compra');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (purchaseId: string) => {
    setLoadingDetails(true);
    setShowDetailsModal(false);
    setPurchaseDetails(null);
    
    try {
      console.log('Buscando detalhes da compra:', purchaseId);
      const details = await window.electronAPI.purchases.getById(purchaseId);
      console.log('Detalhes recebidos:', details);
      
      if (!details) {
        toast.error('Compra não encontrada');
        return;
      }
      
      setPurchaseDetails(details);
      setShowDetailsModal(true);
    } catch (error: any) {
      console.error('Erro ao carregar detalhes:', error);
      toast.error('Erro ao carregar detalhes da compra');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleComplete = (purchase: Purchase) => {
    setConfirmDialog({
      show: true,
      title: 'Confirmar Recebimento',
      message: `Confirma o recebimento da compra ${purchase.purchase_number}? O estoque será atualizado automaticamente.`,
      type: 'info',
      onConfirm: async () => {
        try {
          await window.electronAPI.purchases.complete(purchase.id, 'Usuario');
          toast.success('Compra recebida! Estoque atualizado.');
          loadPurchases();
        } catch (error: any) {
          console.error('Erro ao completar compra:', error);
          toast.error(error.message || 'Erro ao completar compra');
        } finally {
          setConfirmDialog({ ...confirmDialog, show: false });
        }
      },
    });
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.total, 0);
  };

  const filteredPurchases = purchases.filter(p =>
    p.purchase_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    const labels = {
      pending: 'Pendente',
      completed: 'Recebida',
      cancelled: 'Cancelada',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Compras</h1>
        <p className="text-gray-600">Gerencie as compras de produtos dos fornecedores</p>
      </div>

      {/* Search and Actions */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por número ou fornecedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={openModal}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all shadow-md hover:shadow-lg whitespace-nowrap"
          >
            <Plus size={20} />
            Nova Compra
          </button>
        </div>
      </div>

      {/* Purchases Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Número
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fornecedor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
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
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Package className="mx-auto text-gray-400 mb-4" size={64} />
                    <p className="text-gray-500">Nenhuma compra encontrada</p>
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((purchase) => (
                  <tr key={purchase.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <ShoppingCart className="text-gray-400 mr-2" size={18} />
                        <span className="font-medium text-gray-900">{purchase.purchase_number}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                      {purchase.supplier_name || 'Sem fornecedor'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="mr-2" size={16} />
                        {formatDate(purchase.created_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-bold text-gray-900">
                        {(purchase.total / 100).toFixed(2)} FCFA
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(purchase.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewDetails(purchase.id)}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                          disabled={loadingDetails}
                        >
                          <Eye size={16} />
                          Ver
                        </button>
                        {purchase.status === 'pending' && (
                          <button
                            onClick={() => handleComplete(purchase)}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                          >
                            <CheckCircle size={16} />
                            Receber
                          </button>
                        )}
                        {purchase.status === 'completed' && purchase.received_at && (
                          <div className="flex items-center text-sm text-gray-500">
                            <Clock size={16} className="mr-1" />
                            {formatDate(purchase.received_at)}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nova Compra */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-green-600 to-green-700 text-white p-6 rounded-t-lg">
              <h2 className="text-2xl font-bold">Nova Compra</h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              {/* Dados da Compra */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4">Informações da Compra</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Fornecedor *</label>
                    <SearchableSelect
                      options={[
                        { value: '', label: 'Selecione o fornecedor' },
                        ...suppliers.map((supplier) => ({
                          value: supplier.id,
                          label: supplier.name,
                          subtitle: supplier.code,
                        })),
                      ]}
                      value={formData.supplierId}
                      onChange={(value) => setFormData({ ...formData, supplierId: value })}
                      placeholder="Selecione o fornecedor"
                      searchPlaceholder="Buscar fornecedor..."
                      emptyText="Nenhum fornecedor encontrado"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Método de Pagamento</label>
                    <SearchableSelect
                      options={[
                        { value: 'cash', label: 'Dinheiro' },
                        { value: 'transfer', label: 'Transferência' },
                        { value: 'check', label: 'Cheque' },
                        { value: 'credit', label: 'A Prazo' },
                      ]}
                      value={formData.paymentMethod}
                      onChange={(value) => setFormData({ ...formData, paymentMethod: value })}
                      placeholder="Selecione o método"
                      searchPlaceholder="Buscar método..."
                      emptyText="Nenhum método encontrado"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">Observações</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 resize-none"
                      placeholder="Informações adicionais sobre a compra..."
                    />
                  </div>
                </div>
              </div>

              {/* Adicionar Item */}
              <div className="mb-6 border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Adicionar Item</h3>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">Produto</label>
                    <SearchableSelect
                      options={[
                        { value: '', label: 'Selecione' },
                        ...products.map((product) => ({
                          value: product.id,
                          label: product.name,
                          subtitle: product.sku,
                        })),
                      ]}
                      value={itemForm.productId}
                      onChange={(value) => {
                        const product = products.find(p => p.id === value);
                        setItemForm({
                          ...itemForm,
                          productId: value,
                          unitCost: product ? ((product.cost_box || product.cost_unit) / 100).toFixed(2) : '',
                        });
                      }}
                      placeholder="Selecione um produto"
                      searchPlaceholder="Buscar produto..."
                      emptyText="Nenhum produto encontrado"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Qtd. Caixas</label>
                    <input
                      type="number"
                      value={itemForm.qtyUnits}
                      onChange={(e) => setItemForm({ ...itemForm, qtyUnits: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="0"
                      min="1"
                    />
                    {itemForm.productId && itemForm.qtyUnits && (() => {
                      const prod = products.find(p => p.id === itemForm.productId);
                      const boxes = parseInt(itemForm.qtyUnits) || 0;
                      const units = boxes * (prod?.units_per_box || 1);
                      return units > 0 ? (
                        <span className="text-xs text-gray-500 mt-1 block">
                          = {units} unidades
                        </span>
                      ) : null;
                    })()}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Custo Caixa (FCFA)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={itemForm.unitCost}
                      onChange={(e) => setItemForm({ ...itemForm, unitCost: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Lote</label>
                    <input
                      type="text"
                      value={itemForm.batchNumber}
                      onChange={(e) => setItemForm({ ...itemForm, batchNumber: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="Opcional"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Validade</label>
                    <input
                      type="date"
                      value={itemForm.expiryDate}
                      onChange={(e) => setItemForm({ ...itemForm, expiryDate: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addItem}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus size={16} className="inline mr-2" />
                  Adicionar Item
                </button>
              </div>

              {/* Lista de Itens */}
              {items.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-4">Itens da Compra</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Produto</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Caixas</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Unidades</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Custo Caixa</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Total</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {items.map((item, index) => {
                          const product = products.find(p => p.id === item.productId);
                          const unitsPerBox = product?.units_per_box || 1;
                          const boxes = Math.floor(item.qtyUnits / unitsPerBox);
                          return (
                            <tr key={index}>
                              <td className="px-4 py-2 text-sm">{item.productName}</td>
                              <td className="px-4 py-2 text-sm">{boxes}</td>
                              <td className="px-4 py-2 text-sm text-gray-500">{item.qtyUnits}</td>
                              <td className="px-4 py-2 text-sm">{(item.unitCost / 100).toFixed(0)} FCFA</td>
                              <td className="px-4 py-2 text-sm font-bold">{(item.total / 100).toFixed(0)} FCFA</td>
                              <td className="px-4 py-2">
                                <button
                                  type="button"
                                  onClick={() => removeItem(index)}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan={3} className="px-4 py-3 text-right font-bold">Total Geral:</td>
                          <td className="px-4 py-3 font-bold text-lg text-green-600">
                            {(calculateTotal() / 100).toFixed(2)} FCFA
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Actions */}
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
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-50"
                  disabled={loading || items.length === 0}
                >
                  {loading ? 'Salvando...' : 'Criar Compra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalhes da Compra - Loading */}
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

      {/* Modal Detalhes da Compra */}
      {showDetailsModal && purchaseDetails && !loadingDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Detalhes da Compra</h2>
                <p className="text-blue-100 text-sm mt-1">{purchaseDetails.purchase_number}</p>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-white hover:bg-blue-800 rounded-full p-2 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              {/* Informações da Compra */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-700 mb-3">Informações Gerais</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Fornecedor:</span>
                      <span className="font-medium">{purchaseDetails.supplier.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Código:</span>
                      <span className="font-medium">{purchaseDetails.supplier.code}</span>
                    </div>
                    {purchaseDetails.supplier.phone && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Telefone:</span>
                        <span className="font-medium">{purchaseDetails.supplier.phone}</span>
                      </div>
                    )}
                    {purchaseDetails.supplier.email && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Email:</span>
                        <span className="font-medium">{purchaseDetails.supplier.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-700 mb-3">Status e Pagamento</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      {getStatusBadge(purchaseDetails.status)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Método de Pagamento:</span>
                      <span className="font-medium">
                        {purchaseDetails.payment_method === 'cash' ? 'Dinheiro' :
                         purchaseDetails.payment_method === 'transfer' ? 'Transferência' :
                         purchaseDetails.payment_method === 'check' ? 'Cheque' :
                         purchaseDetails.payment_method === 'credit' ? 'A Prazo' : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Data da Compra:</span>
                      <span className="font-medium">{formatDate(purchaseDetails.created_at)}</span>
                    </div>
                    {purchaseDetails.received_at && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Data de Recebimento:</span>
                        <span className="font-medium">{formatDate(purchaseDetails.received_at)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Observações */}
              {purchaseDetails.notes && (
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-6">
                  <h3 className="font-semibold text-gray-700 mb-2">Observações</h3>
                  <p className="text-gray-700">{purchaseDetails.notes}</p>
                </div>
              )}

              {/* Itens da Compra */}
              <div>
                <h3 className="font-semibold text-gray-700 mb-3">Itens da Compra</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Produto</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">SKU</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Qtd</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Custo Caixa</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Lote</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Validade</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {purchaseDetails.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 text-sm">{item.product_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{item.product_sku}</td>
                          <td className="px-4 py-3 text-sm font-medium">{item.qty_units}</td>
                          <td className="px-4 py-3 text-sm">{(item.unit_cost / 100).toFixed(2)} FCFA</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{item.batch_number || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {item.expiry_date ? formatDate(item.expiry_date) : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-right">
                            {(item.total / 100).toFixed(2)} FCFA
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={6} className="px-4 py-3 text-right font-bold text-gray-700">
                          Total Geral:
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-lg text-blue-600">
                          {(purchaseDetails.total / 100).toFixed(2)} FCFA
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Botão Fechar */}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Fechar
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
          type={confirmDialog.type}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog({ ...confirmDialog, show: false })}
        />
      )}
    </div>
  );
};

export default Purchases;
