import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Package, Tag, X } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import ConfirmDialog from '../components/ConfirmDialog';
import SearchableSelect from '../components/common/SearchableSelect';

interface Category {
  id: string;
  name: string;
  description: string;
}

interface Supplier {
  id: string;
  name: string;
  code: string;
}

interface Product {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  categoryId?: string;
  category?: Category;
  priceUnit: number; // em centavos
  priceBox?: number; // em centavos
  costUnit: number; // em centavos
  unitsPerBox?: number;
  isMuntuEligible: boolean;
  isActive: boolean;
  lowStockAlert: number;
}

export default function Products() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'product' | 'category'; id: string } | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    sku: '',
    barcode: '',
    name: '',
    categoryId: '',
    supplierId: '',
    priceUnit: '',
    priceBox: '',
    costUnit: '',
    costBox: '',
    unitsPerBox: '',
    isMuntuEligible: false,
    muntuQuantity: '',
    muntuPrice: '',
    lowStockAlert: '10',
  });

  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    loadProducts();
    loadCategories();
    loadSuppliers();
  }, []);

  const loadProducts = async () => {
    try {
      const data = await window.electronAPI.products.list({ isActive: true });
      // Converter preços de centavos para FCFA para exibição
      const productsWithPrices = data.map((p: any) => ({
        ...p,
        displayPriceUnit: p.price_unit / 100,
        displayPriceBox: p.price_box ? p.price_box / 100 : null,
        displayCostUnit: p.cost_unit / 100,
      }));
      setProducts(productsWithPrices);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      toast.error('Erro ao carregar produtos');
    }
  };

  const loadCategories = async () => {
    try {
      const data = await window.electronAPI.categories.list({});
      setCategories(data);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
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

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações
    if (!formData.name || !formData.sku || !formData.priceUnit || !formData.costUnit) {
      toast.warning('Preencha todos os campos obrigatórios!');
      return;
    }

    if (!formData.costBox || !formData.unitsPerBox) {
      toast.warning('Preencha o Custo por Caixa e Unidades por Caixa para calcular o custo unitário!');
      return;
    }

    const priceUnit = Math.round(parseFloat(formData.priceUnit) * 100);
    const costUnit = Math.round(parseFloat(formData.costUnit) * 100);
    const costBox = formData.costBox ? Math.round(parseFloat(formData.costBox) * 100) : null;
    const priceBox = formData.priceBox ? Math.round(parseFloat(formData.priceBox) * 100) : null;
    const muntuPrice = formData.muntuPrice ? Math.round(parseFloat(formData.muntuPrice) * 100) : null;
    const muntuQuantity = formData.muntuQuantity ? parseInt(formData.muntuQuantity) : null;

    if (costUnit >= priceUnit) {
      toast.warning('O custo não pode ser maior ou igual ao preço de venda!');
      return;
    }

    if (formData.isMuntuEligible && (!muntuQuantity || !muntuPrice)) {
      toast.warning('Para produtos Muntu, defina a quantidade e o preço promocional!');
      return;
    }

    const productData = {
      sku: formData.sku,
      barcode: formData.barcode || null,
      name: formData.name,
      categoryId: formData.categoryId || null,
      supplierId: formData.supplierId || null,
      priceUnit,
      priceBox,
      costBox,
      costUnit,
      unitsPerBox: formData.unitsPerBox ? parseInt(formData.unitsPerBox) : null,
      isMuntuEligible: formData.isMuntuEligible,
      muntuQuantity,
      muntuPrice,
      lowStockAlert: parseInt(formData.lowStockAlert),
      isActive: true,
    };

    try {
      if (editingProduct) {
        await window.electronAPI.products.update(editingProduct.id, productData);
        toast.success('Produto atualizado com sucesso!');
      } else {
        await window.electronAPI.products.create(productData);
        toast.success('Produto cadastrado com sucesso!');
      }

      setShowProductModal(false);
      resetForm();
      loadProducts();
    } catch (error: any) {
      console.error('Erro ao salvar produto:', error);
      toast.error(`Erro ao salvar produto: ${error.message || 'Erro desconhecido'}`);
    }
  };

  const handleEditProduct = (product: any) => {
    setEditingProduct(product);
    const costBox = product.cost_box ? (product.cost_box / 100).toFixed(2) : '';
    setFormData({
      sku: product.sku,
      barcode: product.barcode || '',
      name: product.name,
      categoryId: product.category_id || '',
      supplierId: product.supplier_id || '',
      priceUnit: (product.price_unit / 100).toFixed(2),
      priceBox: product.price_box ? (product.price_box / 100).toFixed(2) : '',
      costUnit: (product.cost_unit / 100).toFixed(2),
      costBox,
      unitsPerBox: product.units_per_box?.toString() || '',
      isMuntuEligible: product.is_muntu_eligible,
      muntuQuantity: product.muntu_quantity?.toString() || '',
      muntuPrice: product.muntu_price ? (product.muntu_price / 100).toFixed(2) : '',
      lowStockAlert: product.low_stock_alert.toString(),
    });
    setShowProductModal(true);
  };

  const handleDeleteProduct = (id: string) => {
    setConfirmDelete({ type: 'product', id });
  };

  const confirmDeleteProduct = async () => {
    if (!confirmDelete) return;

    try {
      await window.electronAPI.products.update(confirmDelete.id, { isActive: false });
      toast.success('Produto desativado!');
      loadProducts();
    } catch (error) {
      console.error('Erro ao desativar produto:', error);
      toast.error('Erro ao desativar produto');
    } finally {
      setConfirmDelete(null);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!categoryFormData.name) {
      toast.warning('Digite o nome da categoria!');
      return;
    }

    try {
      if (editingCategory) {
        await window.electronAPI.categories.update(editingCategory.id, categoryFormData);
        toast.success('Categoria atualizada com sucesso!');
      } else {
        await window.electronAPI.categories.create(categoryFormData);
        toast.success('Categoria criada com sucesso!');
      }

      setShowCategoryModal(false);
      resetCategoryForm();
      loadCategories();
    } catch (error) {
      console.error('Erro ao salvar categoria:', error);
      toast.error('Erro ao salvar categoria');
    }
  };

  const handleDeleteCategory = (id: string) => {
    setConfirmDelete({ type: 'category', id });
  };

  const confirmDeleteCategory = async () => {
    if (!confirmDelete) return;

    try {
      await window.electronAPI.categories.delete(confirmDelete.id);
      toast.success('Categoria deletada!');
      loadCategories();
    } catch (error) {
      console.error('Erro ao deletar categoria:', error);
      toast.error('Erro ao deletar categoria');
    } finally {
      setConfirmDelete(null);
    }
  };

  const resetForm = () => {
    setFormData({
      sku: '',
      barcode: '',
      name: '',
      categoryId: '',
      supplierId: '',
      priceUnit: '',
      priceBox: '',
      costUnit: '',
      costBox: '',
      unitsPerBox: '',
      isMuntuEligible: false,
      muntuQuantity: '',
      muntuPrice: '',
      lowStockAlert: '10',
    });
    setEditingProduct(null);
  };

  const resetCategoryForm = () => {
    setCategoryFormData({ name: '', description: '' });
    setEditingCategory(null);
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.barcode?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory =
      selectedCategory === 'all' || product.categoryId === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Produtos</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCategoryModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            <Tag className="w-4 h-4" />
            Categorias
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowProductModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Novo Produto
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-6 flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nome, SKU ou código de barras..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2 border rounded"
        >
          <option value="all">Todas as Categorias</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Lista de Produtos */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Preço Unit.</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Preço Caixa</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Muntu</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p>Nenhum produto cadastrado</p>
                  <p className="text-sm">Clique em "Novo Produto" para começar</p>
                </td>
              </tr>
            ) : (
              filteredProducts.map((product: any) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono">{product.sku}</td>
                  <td className="px-4 py-3 text-sm font-medium">{product.name}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                      {categories.find((c) => c.id === product.category_id)?.name || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium">
                    {product.displayPriceUnit.toFixed(2)} FCFA
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    {product.displayPriceBox ? `${product.displayPriceBox.toFixed(2)} FCFA` : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {product.is_muntu_eligible ? (
                      <span className="text-green-600 font-semibold">✓</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => handleEditProduct(product)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Desativar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Produto */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">
                  {editingProduct ? 'Editar Produto' : 'Novo Produto'}
                </h2>
                <button
                  onClick={() => {
                    setShowProductModal(false);
                    resetForm();
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSaveProduct} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Código SKU *
                    </label>
                    <input
                      type="text"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border rounded"
                      placeholder="Ex: BEB-001"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Código único de identificação do produto</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Código de Barras (EAN)
                    </label>
                    <input
                      type="text"
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      className="w-full px-3 py-2 border rounded"
                      placeholder="Ex: 7891234567890"
                    />
                    <p className="text-xs text-gray-500 mt-1">Código de barras para leitura por scanner</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Nome do Produto *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    placeholder="Ex: Cerveja Cuca 330ml"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Nome completo e descritivo do produto</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Categoria</label>
                  <SearchableSelect
                    options={[
                      { value: '', label: 'Sem categoria' },
                      ...categories.map((cat) => ({
                        value: cat.id,
                        label: cat.name,
                      })),
                    ]}
                    value={formData.categoryId}
                    onChange={(value) => setFormData({ ...formData, categoryId: value })}
                    placeholder="Selecione uma categoria"
                    searchPlaceholder="Buscar categoria..."
                    emptyText="Nenhuma categoria encontrada"
                  />
                  <p className="text-xs text-gray-500 mt-1">Classifique o produto para melhor organização</p>
                </div>

                {/* Fornecedor */}
                <div>
                  <label className="block text-sm font-medium mb-1">Fornecedor</label>
                  <SearchableSelect
                    options={[
                      { value: '', label: 'Sem fornecedor' },
                      ...suppliers.map((supplier) => ({
                        value: supplier.id,
                        label: supplier.name,
                        subtitle: supplier.code,
                      })),
                    ]}
                    value={formData.supplierId}
                    onChange={(value) => setFormData({ ...formData, supplierId: value })}
                    placeholder="Selecione um fornecedor"
                    searchPlaceholder="Buscar fornecedor..."
                    emptyText="Nenhum fornecedor encontrado"
                  />
                  <p className="text-xs text-gray-500 mt-1">Selecione o fornecedor deste produto</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Preço de Venda Unitário (FCFA) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.priceUnit}
                      onChange={(e) => {
                        const newPriceUnit = e.target.value;
                        const priceBox = formData.unitsPerBox && newPriceUnit
                          ? (parseFloat(newPriceUnit) * parseInt(formData.unitsPerBox)).toFixed(2)
                          : '';
                        setFormData({ ...formData, priceUnit: newPriceUnit, priceBox });
                      }}
                      className="w-full px-3 py-2 border rounded"
                      placeholder="Ex: 150.00"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Preço que será cobrado ao cliente por unidade</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Custo por Caixa (FCFA) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.costBox}
                      onChange={(e) => {
                        const newCostBox = e.target.value;
                        const costUnit = formData.unitsPerBox && newCostBox
                          ? (parseFloat(newCostBox) / parseInt(formData.unitsPerBox)).toFixed(2)
                          : '';
                        setFormData({ ...formData, costBox: newCostBox, costUnit });
                      }}
                      className="w-full px-3 py-2 border rounded"
                      placeholder="Ex: 1440.00"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Quanto você paga ao fornecedor por caixa completa</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Unidades por Caixa *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.unitsPerBox}
                      onChange={(e) => {
                        const newUnitsPerBox = e.target.value;
                        const costUnit = formData.costBox && newUnitsPerBox
                          ? (parseFloat(formData.costBox) / parseInt(newUnitsPerBox)).toFixed(2)
                          : '';
                        const priceBox = formData.priceUnit && newUnitsPerBox
                          ? (parseFloat(formData.priceUnit) * parseInt(newUnitsPerBox)).toFixed(2)
                          : '';
                        setFormData({ ...formData, unitsPerBox: newUnitsPerBox, costUnit, priceBox });
                      }}
                      className="w-full px-3 py-2 border rounded"
                      placeholder="Ex: 12"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Quantas unidades vêm em uma caixa</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Custo Unitário (FCFA)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.costUnit}
                      className="w-full px-3 py-2 border rounded bg-gray-100 cursor-not-allowed"
                      placeholder="Calculado automaticamente"
                      disabled
                      readOnly
                    />
                    <p className="text-xs text-gray-500 mt-1">💡 Calculado: Custo por Caixa ÷ Unidades por Caixa</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Preço por Caixa (FCFA)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.priceBox}
                      className="w-full px-3 py-2 border rounded bg-gray-100 cursor-not-allowed"
                      placeholder="Calculado automaticamente"
                      disabled
                      readOnly
                    />
                    <p className="text-xs text-gray-500 mt-1">💡 Calculado: Preço Unitário × Unidades por Caixa</p>
                  </div>
                  <div></div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Alerta de Estoque Baixo
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.lowStockAlert}
                      onChange={(e) => setFormData({ ...formData, lowStockAlert: e.target.value })}
                      className="w-full px-3 py-2 border rounded"
                      placeholder="Ex: 10"
                    />
                    <p className="text-xs text-gray-500 mt-1">Sistema alerta quando o estoque atingir esta quantidade</p>
                  </div>
                  <div className="flex flex-col justify-center">
                    <label className="flex items-center gap-2 cursor-pointer p-3 border rounded hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.isMuntuEligible}
                        onChange={(e) =>
                          setFormData({ ...formData, isMuntuEligible: e.target.checked })
                        }
                        className="w-4 h-4"
                      />
                      <div>
                        <span className="text-sm font-medium block">Produto Muntu</span>
                        <span className="text-xs text-gray-500">Habilitar venda promocional em pack</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Campos Muntu - aparecem apenas se elegível */}
                {formData.isMuntuEligible && (
                  <div className="border-t pt-4 mt-4 bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">📦</span>
                      <div>
                        <h3 className="text-sm font-semibold text-blue-800">Configuração de Venda Muntu</h3>
                        <p className="text-xs text-blue-600">Defina o preço promocional para compra em quantidade</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700">
                          Quantidade de Unidades no Pack *
                        </label>
                        <input
                          type="number"
                          min="2"
                          value={formData.muntuQuantity}
                          onChange={(e) => setFormData({ ...formData, muntuQuantity: e.target.value })}
                          className="w-full px-3 py-2 border rounded bg-white"
                          placeholder="Ex: 6"
                        />
                        <p className="text-xs text-gray-600 mt-1">
                          Quantas unidades o cliente deve levar para obter o preço Muntu
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700">
                          Preço Total do Pack Muntu (FCFA) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.muntuPrice}
                          onChange={(e) => setFormData({ ...formData, muntuPrice: e.target.value })}
                          className="w-full px-3 py-2 border rounded bg-white"
                          placeholder="Ex: 800.00"
                        />
                        <p className="text-xs text-gray-600 mt-1">
                          Valor promocional que o cliente pagará pelo pack completo
                        </p>
                      </div>
                    </div>
                    {formData.muntuQuantity && formData.muntuPrice && formData.priceUnit && (
                      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-green-800">💰 Economia para o cliente:</span>
                          <span className="text-lg font-bold text-green-600">
                            {(
                              parseFloat(formData.priceUnit) -
                              parseFloat(formData.muntuPrice) / parseInt(formData.muntuQuantity)
                            ).toFixed(2)}{' '}
                            FCFA por unidade
                          </span>
                        </div>
                        <p className="text-xs text-green-700 mt-1">
                          Cliente economiza ao comprar {formData.muntuQuantity} unidades por {parseFloat(formData.muntuPrice).toFixed(2)} FCFA
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowProductModal(false);
                      resetForm();
                    }}
                    className="px-4 py-2 border rounded hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    {editingProduct ? 'Atualizar' : 'Cadastrar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Categorias */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Gerenciar Categorias</h2>
                <button
                  onClick={() => {
                    setShowCategoryModal(false);
                    resetCategoryForm();
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Form Nova Categoria */}
              <form onSubmit={handleSaveCategory} className="mb-6 p-4 bg-gray-50 rounded">
                <h3 className="font-medium mb-3">
                  {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Nome *</label>
                    <input
                      type="text"
                      value={categoryFormData.name}
                      onChange={(e) =>
                        setCategoryFormData({ ...categoryFormData, name: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Descrição</label>
                    <textarea
                      value={categoryFormData.description}
                      onChange={(e) =>
                        setCategoryFormData({ ...categoryFormData, description: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded"
                      rows={2}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    {editingCategory && (
                      <button
                        type="button"
                        onClick={resetCategoryForm}
                        className="px-4 py-2 border rounded hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      {editingCategory ? 'Atualizar' : 'Adicionar'}
                    </button>
                  </div>
                </div>
              </form>

              {/* Lista de Categorias */}
              <div className="space-y-2">
                <h3 className="font-medium mb-2">Categorias Existentes</h3>
                {categories.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Nenhuma categoria cadastrada</p>
                ) : (
                  categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between p-3 border rounded hover:bg-gray-50"
                    >
                      <div>
                        <p className="font-medium">{cat.name}</p>
                        {cat.description && (
                          <p className="text-sm text-gray-500">{cat.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingCategory(cat);
                            setCategoryFormData({
                              name: cat.name,
                              description: cat.description || '',
                            });
                          }}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Deletar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Diálogo de Confirmação */}
      {confirmDelete && (
        <ConfirmDialog
          title={confirmDelete.type === 'product' ? 'Desativar Produto' : 'Deletar Categoria'}
          message={
            confirmDelete.type === 'product'
              ? 'Tem certeza que deseja desativar este produto? Ele não aparecerá mais na listagem.'
              : 'Tem certeza que deseja deletar esta categoria? Esta ação não pode ser desfeita.'
          }
          confirmText={confirmDelete.type === 'product' ? 'Desativar' : 'Deletar'}
          cancelText="Cancelar"
          type="danger"
          onConfirm={confirmDelete.type === 'product' ? confirmDeleteProduct : confirmDeleteCategory}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
