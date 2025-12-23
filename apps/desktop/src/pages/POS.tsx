import { useState, useEffect } from 'react';
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, User, Lock, Smartphone, FileText, AlertTriangle, DollarSign } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import SearchableSelect from '../components/common/SearchableSelect';

interface Product {
  id: string;
  name: string;
  sku: string;
  categoryId: string;
  categoryName: string;
  priceUnit: number;
  priceBox: number | null;
  unitsPerBox: number;
  isMuntuEligible: boolean;
  muntuQuantity: number | null;
  muntuPrice: number | null;
  stockQty: number;
  costUnit: number; // Custo unitário do produto
}

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  isMuntu: boolean;
}

export default function POS() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'cash' | 'orange' | 'teletaku' | 'vale' | 'mixed'>('cash');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [currentCashBox, setCurrentCashBox] = useState<any>(null);
  const [checkingCashBox, setCheckingCashBox] = useState(true);
  const [showValeConfirmModal, setShowValeConfirmModal] = useState(false);
  const [valeConfirmData, setValeConfirmData] = useState<any>(null);

  useEffect(() => {
    loadProducts();
    loadCustomers();
    checkCashBox();
  }, []);

  const checkCashBox = async () => {
    try {
      // @ts-ignore
      const cashBox = await window.electronAPI?.cashBox?.getCurrent?.();
      setCurrentCashBox(cashBox || null);
    } catch (error) {
      console.error('Erro ao verificar caixa:', error);
    } finally {
      setCheckingCashBox(false);
    }
  };

  const loadCustomers = async () => {
    try {
      // @ts-ignore
      const result = await window.electronAPI?.customers?.list?.({});
      if (result && Array.isArray(result)) {
        setCustomers(result);
      }
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  const loadProducts = async () => {
    try {
      // @ts-ignore - Electron API
      const productsResult = await window.electronAPI?.products?.list?.({ isActive: true });
      // @ts-ignore - Electron API
      const categoriesResult = await window.electronAPI?.categories?.list?.({});
      // @ts-ignore - Electron API - Buscar estoque
      const inventoryResult = await window.electronAPI?.inventory?.list?.({ branchId: 'main-branch' });
      
      if (productsResult && Array.isArray(productsResult)) {
        const categoriesMap = new Map();
        if (categoriesResult && Array.isArray(categoriesResult)) {
          categoriesResult.forEach((cat: any) => categoriesMap.set(cat.id, cat.name));
        }

        // Criar mapa de estoque
        const inventoryMap = new Map();
        if (inventoryResult && Array.isArray(inventoryResult)) {
          inventoryResult.forEach((inv: any) => inventoryMap.set(inv.product_id, inv.qty_units || 0));
        }

        setProducts(productsResult.map((p: any) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          categoryId: p.category_id,
          categoryName: p.category_id ? categoriesMap.get(p.category_id) || 'Sem categoria' : 'Sem categoria',
          priceUnit: p.price_unit / 100, // Converter de centavos para FCFA
          priceBox: p.price_box ? p.price_box / 100 : null,
          unitsPerBox: p.units_per_box || 1,
          isMuntuEligible: p.is_muntu_eligible,
          muntuQuantity: p.muntu_quantity,
          costUnit: p.cost_unit || 0, // Custo unitário (em centavos)
          muntuPrice: p.muntu_price ? p.muntu_price / 100 : null,
          stockQty: inventoryMap.get(p.id) || 0,
        })));
      }
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    }
  };

  const addToCart = (product: Product, isMuntu: boolean = false) => {
    // Verificar se há estoque disponível
    if (product.stockQty <= 0) {
      toast.error(`${product.name} está sem estoque!`);
      return;
    }

    const existingItem = cart.find(
      item => item.productId === product.id && item.isMuntu === isMuntu
    );

    if (isMuntu && product.muntuPrice && product.muntuQuantity) {
      // Para Muntu, adicionar o pack completo de uma vez
      const quantityToAdd = product.muntuQuantity;
      const currentQtyInCart = existingItem ? existingItem.quantity : 0;
      const newTotalQty = currentQtyInCart + quantityToAdd;

      // Verificar se há estoque suficiente
      if (newTotalQty > product.stockQty) {
        toast.warning(`Estoque insuficiente! Disponível: ${product.stockQty} unidades`);
        return;
      }

      const pricePerUnit = product.muntuPrice / product.muntuQuantity;
      
      if (existingItem) {
        updateQuantity(existingItem.productId, newTotalQty, isMuntu);
      } else {
        const newItem: CartItem = {
          productId: product.id,
          productName: product.name,
          quantity: quantityToAdd,
          unitPrice: pricePerUnit,
          subtotal: product.muntuPrice,
          isMuntu,
        };
        setCart([...cart, newItem]);
      }
    } else {
      // Para venda unitária normal
      const currentQtyInCart = existingItem ? existingItem.quantity : 0;
      const newTotalQty = currentQtyInCart + 1;

      // Verificar se há estoque suficiente
      if (newTotalQty > product.stockQty) {
        toast.warning(`Estoque insuficiente! Disponível: ${product.stockQty} unidades`);
        return;
      }

      if (existingItem) {
        updateQuantity(existingItem.productId, newTotalQty, isMuntu);
      } else {
        const newItem: CartItem = {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPrice: product.priceUnit,
          subtotal: product.priceUnit,
          isMuntu,
        };
        setCart([...cart, newItem]);
      }
    }
  };

  const updateQuantity = (productId: string, newQuantity: number, isMuntu: boolean) => {
    if (newQuantity <= 0) {
      removeFromCart(productId, isMuntu);
      return;
    }

    // Verificar estoque disponível
    const product = products.find(p => p.id === productId);
    if (product && newQuantity > product.stockQty) {
      toast.warning(`Estoque insuficiente! Disponível: ${product.stockQty} unidades`);
      return;
    }

    // Para itens Muntu, garantir que a quantidade é múltiplo do pack
    if (isMuntu) {
      if (product && product.muntuQuantity) {
        const remainder = newQuantity % product.muntuQuantity;
        if (remainder !== 0) {
          // Arredondar para o múltiplo mais próximo
          newQuantity = newQuantity - remainder;
          if (newQuantity <= 0) {
            removeFromCart(productId, isMuntu);
            return;
          }
        }
      }
    }

    setCart(cart.map(item => {
      if (item.productId === productId && item.isMuntu === isMuntu) {
        return {
          ...item,
          quantity: newQuantity,
          subtotal: item.unitPrice * newQuantity,
        };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string, isMuntu: boolean) => {
    setCart(cart.filter(item => !(item.productId === productId && item.isMuntu === isMuntu)));
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + item.subtotal, 0);
  };

  const calculateSavings = () => {
    return cart
      .filter(item => item.isMuntu)
      .reduce((sum, item) => {
        const product = products.find(p => p.id === item.productId);
        if (!product) return sum;
        const regularPrice = product.priceUnit * item.quantity;
        return sum + (regularPrice - item.subtotal);
      }, 0);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.warning('Carrinho vazio!');
      return;
    }

    // Verificar se o caixa está aberto
    if (!currentCashBox) {
      toast.error('❌ Caixa não está aberto! Abra o caixa antes de realizar vendas.');
      return;
    }

    // Validação de Vale: verificar se cliente foi selecionado
    if (selectedPaymentMethod === 'vale' && !selectedCustomer) {
      toast.error('Selecione um cliente para usar pagamento com Vale');
      return;
    }

    try {
      const total = calculateTotal();
      const savings = calculateSavings();
      const totalCents = Math.round(total * 100);

      // Verificar limite de crédito se for Vale
      if (selectedPaymentMethod === 'vale' && selectedCustomer) {
        // @ts-ignore
        const customer = await window.electronAPI?.customers?.getById?.(selectedCustomer.id);
        
        if (!customer) {
          toast.error('Cliente não encontrado');
          return;
        }

        const creditLimit = customer.credit_limit || 0;
        const currentDebt = customer.current_debt || 0;
        const availableCredit = creditLimit - currentDebt;

        if (totalCents > availableCredit) {
          const availableFCFA = (availableCredit / 100).toFixed(2);
          const neededFCFA = (totalCents / 100).toFixed(2);
          toast.error(
            `⚠️ Crédito insuficiente!\n\nDisponível: ${availableFCFA} FCFA\nNecessário: ${neededFCFA} FCFA\n\nLimite: ${(creditLimit / 100).toFixed(2)} FCFA\nDívida atual: ${(currentDebt / 100).toFixed(2)} FCFA`,
            8000
          );
          return;
        }

        // Mostrar modal de confirmação de Vale
        setValeConfirmData({
          customer,
          total,
          totalCents,
          availableCredit,
          savings
        });
        setShowValeConfirmModal(true);
        return; // Aguardar confirmação do modal
      }
      
      // Se não for Vale, processar diretamente
      await processSale();
    } catch (error) {
      console.error('Erro ao finalizar venda:', error);
      toast.error('Erro ao finalizar venda: ' + (error as Error).message);
    }
  };

  const processSale = async () => {
    try {
      const total = calculateTotal();
      const savings = calculateSavings();
      const totalCents = Math.round(total * 100);
      
      console.log('🛒 DEBUG processSale - selectedPaymentMethod:', selectedPaymentMethod);
      
      // Gerar número da venda
      const saleNumber = `SALE-${Date.now()}`;
      
      const saleData = {
        saleNumber,
        branchId: 'main-branch', // ID da filial (offline)
        cashierId: 'offline-admin', // ID do caixa
        customerId: selectedCustomer?.id || null, // Cliente selecionado
        type: 'counter', // Tipo de venda
      };

      // @ts-ignore - Criar a venda
      const sale = await window.electronAPI?.sales?.create?.(saleData);
      
      if (!sale) {
        toast.error('Erro ao criar venda');
        return;
      }

      // Adicionar cada item da venda
      for (const item of cart) {
        // Buscar o custo do produto
        const product = products.find(p => p.id === item.productId);
        const unitCost = product?.costUnit || 0;
        
        const itemData = {
          productId: item.productId,
          branchId: 'main-branch',
          qtyUnits: item.quantity,
          isMuntu: item.isMuntu,
          unitPrice: Math.round(item.unitPrice * 100), // Centavos
          unitCost: unitCost, // Custo unitário do produto (já está em centavos)
          subtotal: Math.round(item.subtotal * 100),
          taxAmount: 0,
          total: Math.round(item.subtotal * 100),
          muntuSavings: item.isMuntu ? Math.round((item.unitPrice * item.quantity - item.subtotal) * 100) : 0,
          cashierId: 'offline-admin',
        };
        
        // @ts-ignore
        await window.electronAPI?.sales?.addItem?.(sale.id, itemData);
      }

      // Se for Vale, criar dívida
      if (selectedPaymentMethod === 'vale' && selectedCustomer) {
        try {
          // @ts-ignore
          await window.electronAPI?.debts?.create?.({
            customerId: selectedCustomer.id,
            saleId: sale.id,
            branchId: 'main-branch',
            amount: totalCents,
            notes: `Vale referente à venda ${saleNumber}`,
            createdBy: 'offline-admin'
          });

          toast.success(`✅ Vale criado com sucesso para ${selectedCustomer.name}`, 4000);
        } catch (debtError) {
          console.error('Erro ao criar dívida:', debtError);
          toast.error('Erro ao criar Vale: ' + (debtError as Error).message);
          return;
        }
      }

      // Registrar pagamento
      const paymentData = {
        method: selectedPaymentMethod, // cash, orange, teletaku, vale, mixed
        amount: totalCents, // Total em centavos
        status: 'completed',
        notes: `Venda ${saleNumber}`,
      };
      
      // @ts-ignore
      await window.electronAPI?.sales?.addPayment?.(sale.id, paymentData);

      // Adicionar pontos de fidelidade se houver cliente selecionado
      if (selectedCustomer) {
        try {
          // @ts-ignore
          const loyaltyResult = await window.electronAPI?.loyalty?.addPoints?.(
            selectedCustomer.id,
            totalCents,
            sale.id
          );
          
          if (loyaltyResult && loyaltyResult.pointsAdded > 0) {
            toast.success(
              `🎉 ${loyaltyResult.pointsAdded} ponto${loyaltyResult.pointsAdded > 1 ? 's' : ''} adicionado${loyaltyResult.pointsAdded > 1 ? 's' : ''}! Total: ${loyaltyResult.totalPoints} pontos`,
              4000
            );
          }
        } catch (error) {
          console.error('Erro ao adicionar pontos de fidelidade:', error);
          // Não bloqueia a venda se falhar
        }
      }

      // 🔴 REMOVIDO: Chamada duplicada de updateCashBoxTotals
      // O addSalePayment() já atualiza os totais do caixa automaticamente (linha 1204 do manager.ts)
      // Esta chamada explícita causava DUPLICAÇÃO dos valores (34.400 ao invés de 17.200)
      // if (currentCashBox) { ... cashBox.updateTotals ... }
      
      const paymentMethodLabel = selectedPaymentMethod === 'vale' ? 'Vale (Crédito)' : selectedPaymentMethod;
      const message = `Venda #${saleNumber} finalizada!\n\nTotal: ${total.toFixed(2)} FCFA\nMétodo: ${paymentMethodLabel}${savings > 0 ? `\nEconomia Muntu: ${savings.toFixed(2)} FCFA` : ''}${selectedCustomer ? `\nCliente: ${selectedCustomer.name}` : ''}`;
      toast.success(message, 6000);
      
      // Limpar carrinho
      setCart([]);
      setSelectedPaymentMethod('cash');
      setSelectedCustomer(null);
      
      // Recarregar produtos para atualizar estoque
      await loadProducts();
      
    } catch (error) {
      console.error('Erro ao processar venda:', error);
      toast.error('Erro ao processar venda: ' + (error as Error).message);
    }
  };

  const handleValeConfirm = async () => {
    setShowValeConfirmModal(false);
    setValeConfirmData(null);
    await processSale();
  };

  const handleValeCancel = () => {
    setShowValeConfirmModal(false);
    setValeConfirmData(null);
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Produtos */}
      <div className="flex-1 p-6 overflow-y-auto">
        {/* Alerta de Caixa Fechado */}
        {!checkingCashBox && !currentCashBox && (
          <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-4 rounded-lg mb-4 shadow-lg">
            <div className="flex items-center gap-3">
              <Lock size={24} />
              <div className="flex-1">
                <p className="font-bold text-lg">⚠️ CAIXA FECHADO</p>
                <p className="text-sm">Abra o caixa antes de realizar vendas</p>
              </div>
              <a
                href="/cashbox"
                className="px-4 py-2 bg-white text-red-600 rounded-lg font-semibold hover:bg-red-50 transition-colors"
              >
                Abrir Caixa
              </a>
            </div>
          </div>
        )}

        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-4">Ponto de Venda</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar produtos..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map((product) => {
            const outOfStock = product.stockQty <= 0;
            const lowStock = product.stockQty > 0 && product.stockQty <= 10;
            
            return (
              <div
                key={product.id}
                className={`bg-white p-4 rounded-xl border shadow-sm transition-all ${
                  outOfStock 
                    ? 'border-red-300 bg-gray-50 opacity-60' 
                    : lowStock
                    ? 'border-orange-300 hover:shadow-md hover:border-orange-400'
                    : 'border-gray-200 hover:shadow-md hover:border-blue-300'
                }`}
              >
                <div className="mb-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className={`font-semibold mb-1 truncate ${outOfStock ? 'text-gray-500' : 'text-gray-900'}`}>
                      {product.name}
                    </h3>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                      outOfStock 
                        ? 'bg-red-100 text-red-700' 
                        : lowStock
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {product.stockQty} un
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{product.categoryName}</p>
                  {outOfStock && (
                    <p className="text-xs font-semibold text-red-600 mt-1">SEM ESTOQUE</p>
                  )}
                  {lowStock && (
                    <p className="text-xs font-semibold text-orange-600 mt-1">ESTOQUE BAIXO</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <button
                    onClick={() => !outOfStock && addToCart(product, false)}
                    disabled={outOfStock}
                    className={`w-full py-2.5 px-3 rounded-lg transition-all shadow-sm font-medium text-sm ${
                      outOfStock
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 hover:shadow'
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-xs opacity-90">Unitário</span>
                      <span className="text-base font-bold">{product.priceUnit.toFixed(2)} FCFA</span>
                    </div>
                  </button>
                  
                  {product.isMuntuEligible && product.muntuPrice && product.muntuQuantity && (
                    <button
                      onClick={() => !outOfStock && addToCart(product, true)}
                      disabled={outOfStock}
                      className={`w-full py-2.5 px-3 rounded-lg transition-all shadow-sm font-medium text-sm ${
                        outOfStock
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800 hover:shadow'
                      }`}
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-xs opacity-90">Muntu Pack ({product.muntuQuantity} unid.)</span>
                        <span className="text-base font-bold">{product.muntuPrice.toFixed(2)} FCFA</span>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Carrinho */}
      <div className="w-96 bg-white shadow-lg p-6 flex flex-col">
        <h2 className="text-2xl font-bold mb-6">Carrinho</h2>

        <div className="flex-1 overflow-y-auto mb-6 space-y-3">
          {cart.map((item, index) => (
            <div key={`${item.productId}-${item.isMuntu}-${index}`} className={`p-3 rounded-lg ${item.isMuntu ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <h4 className="font-semibold">{item.productName}</h4>
                  {item.isMuntu ? (
                    <div className="text-sm">
                      <p className="text-green-700 font-medium">🎁 Pack Muntu</p>
                      <p className="text-gray-600">
                        {(() => {
                          const product = products.find(p => p.id === item.productId);
                          const packCount = product?.muntuQuantity ? item.quantity / product.muntuQuantity : 1;
                          return `${packCount} pack${packCount > 1 ? 's' : ''} × ${item.unitPrice.toFixed(2)} FCFA/unid`;
                        })()}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      {item.unitPrice.toFixed(2)} FCFA/unid
                    </p>
                  )}
                </div>
                <button
                  onClick={() => removeFromCart(item.productId, item.isMuntu)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const product = products.find(p => p.id === item.productId);
                      const decrement = item.isMuntu && product?.muntuQuantity ? product.muntuQuantity : 1;
                      updateQuantity(item.productId, item.quantity - decrement, item.isMuntu);
                    }}
                    className="bg-gray-200 hover:bg-gray-300 p-1 rounded"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-12 text-center font-semibold">{item.quantity}</span>
                  <button
                    onClick={() => {
                      const product = products.find(p => p.id === item.productId);
                      const increment = item.isMuntu && product?.muntuQuantity ? product.muntuQuantity : 1;
                      updateQuantity(item.productId, item.quantity + increment, item.isMuntu);
                    }}
                    className="bg-gray-200 hover:bg-gray-300 p-1 rounded"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <span className="font-bold">{item.subtotal.toFixed(2)} FCFA</span>
              </div>
            </div>
          ))}

          {cart.length === 0 && (
            <p className="text-center text-gray-400 py-8">Carrinho vazio</p>
          )}
        </div>

        {/* Economia Muntu */}
        {calculateSavings() > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-green-800">
              💰 Economia Muntu: <span className="font-bold">{calculateSavings().toFixed(2)} FCFA</span>
            </p>
          </div>
        )}

        {/* Seleção de Cliente */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <User size={16} className="text-gray-600" />
            <p className="text-sm font-semibold">Cliente (opcional):</p>
          </div>
          <SearchableSelect
            options={[
              { value: '', label: '🛒 Venda sem cliente' },
              ...customers.map((customer) => ({
                value: customer.id,
                label: `👤 ${customer.name}`,
                subtitle: customer.phone || undefined,
              })),
            ]}
            value={selectedCustomer?.id || ''}
            onChange={(value) => {
              const customer = customers.find(c => c.id === value);
              setSelectedCustomer(customer || null);
            }}
            placeholder="🛒 Selecione um cliente"
            searchPlaceholder="Buscar cliente..."
            emptyText="Nenhum cliente encontrado"
          />
        </div>

        {/* Método de Pagamento */}
        <div className="mb-4">
          <p className="text-sm font-semibold mb-2">Método de Pagamento:</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSelectedPaymentMethod('cash')}
              className={`p-3 rounded border-2 flex flex-col items-center gap-1 transition-colors ${
                selectedPaymentMethod === 'cash'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Banknote size={24} />
              <span className="text-xs font-medium">Dinheiro (FCFA)</span>
            </button>
            <button
              onClick={() => setSelectedPaymentMethod('orange')}
              className={`p-3 rounded border-2 flex flex-col items-center gap-1 transition-colors ${
                selectedPaymentMethod === 'orange'
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Smartphone size={24} className={selectedPaymentMethod === 'orange' ? 'text-orange-600' : ''} />
              <span className="text-xs font-medium">Orange Money</span>
            </button>
            <button
              onClick={() => setSelectedPaymentMethod('teletaku')}
              className={`p-3 rounded border-2 flex flex-col items-center gap-1 transition-colors ${
                selectedPaymentMethod === 'teletaku'
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Smartphone size={24} className={selectedPaymentMethod === 'teletaku' ? 'text-purple-600' : ''} />
              <span className="text-xs font-medium">TeleTaku</span>
            </button>
            <button
              onClick={() => setSelectedPaymentMethod('vale')}
              disabled={!selectedCustomer}
              className={`p-3 rounded border-2 flex flex-col items-center gap-1 transition-colors ${
                selectedPaymentMethod === 'vale'
                  ? 'border-yellow-500 bg-yellow-50'
                  : selectedCustomer
                  ? 'border-gray-200 hover:border-gray-300'
                  : 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-50'
              }`}
              title={!selectedCustomer ? 'Selecione um cliente para usar Vale' : ''}
            >
              <FileText size={24} className={selectedPaymentMethod === 'vale' ? 'text-yellow-600' : 'text-gray-400'} />
              <span className="text-xs font-medium">Vale (Crédito)</span>
            </button>
            <button
              onClick={() => setSelectedPaymentMethod('mixed')}
              className={`p-3 rounded border-2 flex flex-col items-center gap-1 transition-colors ${
                selectedPaymentMethod === 'mixed'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <CreditCard size={24} className={selectedPaymentMethod === 'mixed' ? 'text-green-600' : ''} />
              <span className="text-xs font-medium">Misto</span>
            </button>
          </div>
        </div>

        {/* Total */}
        <div className="border-t pt-4 mb-4">
          <div className="flex justify-between items-center text-2xl font-bold">
            <span>Total:</span>
            <span>{calculateTotal().toFixed(2)} FCFA</span>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="space-y-2">
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="w-full bg-green-600 text-white py-4 rounded-lg font-bold text-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Finalizar Venda
          </button>
          <button
            onClick={() => setCart([])}
            disabled={cart.length === 0}
            className="w-full bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Limpar Carrinho
          </button>
        </div>
      </div>

      {/* Modal de Confirmação de Vale */}
      {showValeConfirmModal && valeConfirmData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full animate-fade-in">
            <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 p-6 rounded-t-lg">
              <div className="flex items-center gap-3 text-white">
                <FileText size={32} />
                <div>
                  <h2 className="text-2xl font-bold">Confirmar Vale</h2>
                  <p className="text-sm text-yellow-100">Verifique os detalhes antes de prosseguir</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Informações do Cliente */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <User size={18} className="text-blue-600" />
                  <h3 className="font-bold text-blue-900">Cliente</h3>
                </div>
                <p className="text-lg font-semibold text-gray-800">{valeConfirmData.customer.full_name}</p>
                <p className="text-sm text-gray-600">{valeConfirmData.customer.code}</p>
              </div>

              {/* Valor da Venda */}
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign size={18} className="text-green-600" />
                  <h3 className="font-bold text-green-900">Valor do Vale</h3>
                </div>
                <p className="text-2xl font-bold text-green-700">
                  {valeConfirmData.total.toFixed(2)} FCFA
                </p>
                {valeConfirmData.savings > 0 && (
                  <p className="text-sm text-green-600 mt-1">
                    Economia Muntu: {valeConfirmData.savings.toFixed(2)} FCFA
                  </p>
                )}
              </div>

              {/* Crédito Disponível */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-600 mb-1">Crédito Disponível</p>
                  <p className="text-lg font-bold text-gray-800">
                    {(valeConfirmData.availableCredit / 100).toFixed(2)} FCFA
                  </p>
                </div>
                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                  <p className="text-xs text-gray-600 mb-1">Restante Após</p>
                  <p className="text-lg font-bold text-yellow-700">
                    {((valeConfirmData.availableCredit - valeConfirmData.totalCents) / 100).toFixed(2)} FCFA
                  </p>
                </div>
              </div>

              {/* Mensagem de Aviso */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle size={18} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-yellow-800">
                  Esta operação criará uma dívida registrada no sistema. O cliente deverá quitar o valor posteriormente.
                </p>
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="p-6 bg-gray-50 rounded-b-lg flex gap-3">
              <button
                onClick={handleValeCancel}
                className="flex-1 px-4 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleValeConfirm}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition-colors font-bold shadow-md"
              >
                Confirmar Vale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
