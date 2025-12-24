import { useEffect, useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import ConfirmDialog from '../components/ConfirmDialog';
import SearchableSelect from '../components/common/SearchableSelect';
import { 
  Table, Plus, Users, ShoppingCart, CreditCard, 
  X, Check, ArrowRightLeft, Split, Trash2, Clock,
  DollarSign, User, Package, Receipt, Search, AlertTriangle, Grid
} from 'lucide-react';

const { electronAPI } = window as any;

interface TableOverview {
  id: string;
  number: string;
  seats: number;
  area: string;
  status: 'available' | 'open' | 'awaiting_payment' | 'closed';
  sessionId: string | null;
  customerCount: number;
  orderCount: number;
  totalAmount: number;
  paidAmount: number;
  openedAt: string | null;
}

interface TableSession {
  id: string;
  table_id: string;
  table_number: string;
  table_seats: number;
  session_number: string;
  status: string;
  opened_by: string;
  opened_at: string;
  total_amount: number;
  paid_amount: number;
  customers: TableCustomer[];
}

interface TableCustomer {
  id: string;
  customer_name: string;
  customer_id: string | null;
  subtotal: number;
  total: number;
  paid_amount: number;
  payment_status: string;
  orders: TableOrder[];
}

interface TableOrder {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  qty_units: number;
  is_muntu: boolean;
  unit_price: number;
  subtotal: number;
  total: number;
  status: string;
  notes: string;
  ordered_at: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  priceUnit: number;
  priceBox: number | null;
  unitsPerBox: number;
  isMuntuEligible: boolean;
  muntuQuantity: number | null;
  muntuPrice: number | null;
  stockQty: number;
  costUnit: number;
}

interface RegisteredCustomer {
  id: string;
  name: string;
  phone: string;
  loyalty_points: number;
}

interface OrderCartItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  costUnit: number;
  subtotal: number;
  isMuntu: boolean;
}

export default function TablesPage() {
  const toast = useToast();
  const [tables, setTables] = useState<TableOverview[]>([]);
  const [selectedSession, setSelectedSession] = useState<TableSession | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [registeredCustomers, setRegisteredCustomers] = useState<RegisteredCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentCashBox, setCurrentCashBox] = useState<any>(null);
  const [checkingCashBox, setCheckingCashBox] = useState(true);
  const [productsKey, setProductsKey] = useState(0); // Força re-render dos produtos
  
  // Modals
  const [showOpenTableModal, setShowOpenTableModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showAddOrderModal, setShowAddOrderModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showCreateTableModal, setShowCreateTableModal] = useState(false);
  const [showTransferItemModal, setShowTransferItemModal] = useState(false);
  const [showTransferTableModal, setShowTransferTableModal] = useState(false);
  const [showTransferCustomersModal, setShowTransferCustomersModal] = useState(false);
  const [showMergeTablesModal, setShowMergeTablesModal] = useState(false);
  const [showSplitTableModal, setShowSplitTableModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  
  // Transferência de clientes
  const [selectedCustomersToTransfer, setSelectedCustomersToTransfer] = useState<string[]>([]);
  
  // Unir mesas
  const [selectedTablesForMerge, setSelectedTablesForMerge] = useState<string[]>([]);
  
  // Separar mesa
  const [splitDistributions, setSplitDistributions] = useState<Array<{customerIds: string[], tableId: string}>>([]);
  
  // Transferência de itens
  const [transferOrder, setTransferOrder] = useState<TableOrder | null>(null);
  const [transferToCustomerId, setTransferToCustomerId] = useState<string>('');
  const [transferQty, setTransferQty] = useState<number>(0);
  
  // Histórico
  const [sessionHistory, setSessionHistory] = useState<any[]>([]);
  
  // Form para criar mesa
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newTableSeats, setNewTableSeats] = useState(4);
  const [newTableArea, setNewTableArea] = useState('');
  
  // Form states
  const [selectedTable, setSelectedTable] = useState<TableOverview | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<TableCustomer | null>(null);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [selectedRegisteredCustomer, setSelectedRegisteredCustomer] = useState<RegisteredCustomer | null>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'orange' | 'teletaku' | 'vale' | 'mixed'>('cash');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentType, setPaymentType] = useState<'customer' | 'session'>('customer');
  const [customersCreditInfo, setCustomersCreditInfo] = useState<Map<string, {creditLimit: number, currentDebt: number}>>(new Map());
  const [tablePendingDebts, setTablePendingDebts] = useState<Record<string, number>>({});
  const [allCustomerDebts, setAllCustomerDebts] = useState<Array<{
    customer_id: string;
    debt_id: string;
    balance: number;
    table_number: string | null;
    notes: string;
    created_at: string;
  }>>([]);
  
  // Carrinho de pedidos (múltiplos produtos)
  const [orderCart, setOrderCart] = useState<OrderCartItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  
  // Controle de modal de confirmação
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmDialogConfig, setConfirmDialogConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'warning' | 'info';
  }>({ title: '', message: '', onConfirm: () => {} });

  useEffect(() => {
    loadTables();
    loadProducts();
    loadRegisteredCustomers();
    checkCashBox();
    
    // Auto-refresh a cada 10 segundos
    const interval = setInterval(loadTables, 10000);
    return () => clearInterval(interval);
  }, []);

  const checkCashBox = async () => {
    try {
      const cashBox = await electronAPI?.cashBox?.getCurrent?.();
      setCurrentCashBox(cashBox || null);
    } catch (error) {
      console.error('Erro ao verificar caixa:', error);
    } finally {
      setCheckingCashBox(false);
    }
  };

  const loadTables = async () => {
    try {
      const branchId = localStorage.getItem('branchId') || 'main-branch';
      const data = await electronAPI.tables.getOverview(branchId);
      setTables(data);
    } catch (error: any) {
      toast?.error('Erro ao carregar mesas: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const branchId = localStorage.getItem('branchId') || 'main-branch';
      console.log('[Tables] Carregando produtos com branchId:', branchId);
      const productsResult = await electronAPI.products.list({ isActive: true });
      const inventoryResult = await electronAPI?.inventory?.list?.({ branchId });
      
      console.log('[Tables] Inventário recebido:', inventoryResult?.slice(0, 3));
      
      if (productsResult && Array.isArray(productsResult)) {
        const inventoryMap = new Map();
        if (inventoryResult && Array.isArray(inventoryResult)) {
          // Somar qty_units de todos os registros do mesmo produto (pode haver múltiplos lotes)
          inventoryResult.forEach((inv: any) => {
            const currentQty = inventoryMap.get(inv.product_id) || 0;
            inventoryMap.set(inv.product_id, currentQty + (inv.qty_units || 0));
          });
        }
        
        console.log('[Tables] Mapa de inventário:', Array.from(inventoryMap.entries()).slice(0, 3));

        const updatedProducts = productsResult.filter((p: any) => p.is_active).map((p: any) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          priceUnit: (p.price_unit || 0) / 100,
          priceBox: p.price_box ? p.price_box / 100 : null,
          unitsPerBox: p.units_per_box || 1,
          isMuntuEligible: p.is_muntu_eligible || false,
          muntuQuantity: p.muntu_quantity || null,
          muntuPrice: p.muntu_price ? p.muntu_price / 100 : null,
          stockQty: inventoryMap.get(p.id) || 0,
          costUnit: p.cost_unit || 0,
        }));
        
        console.log('[Tables] Primeiro produto atualizado:', updatedProducts[0]?.name, 'Stock:', updatedProducts[0]?.stockQty);
        
        // Forçar nova referência do array para garantir re-render
        setProducts([...updatedProducts]);
        setProductsKey(prev => prev + 1);
      }
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    }
  };

  const loadRegisteredCustomers = async () => {
    try {
      const result = await electronAPI?.customers?.list?.({});
      if (result && Array.isArray(result)) {
        setRegisteredCustomers(result);
      }
    } catch (error) {
      console.error('Erro ao carregar clientes cadastrados:', error);
    }
  };

  const handleCreateTable = async () => {
    if (!currentCashBox) {
      toast?.error('É necessário abrir a caixa antes de criar mesas');
      return;
    }
    
    if (!newTableNumber.trim()) {
      toast?.error('Número da mesa é obrigatório');
      return;
    }
    
    try {
      const branchId = localStorage.getItem('branchId') || 'main-branch';
      await electronAPI.tables.create({
        branchId,
        number: newTableNumber,
        seats: newTableSeats,
        area: newTableArea || undefined,
      });
      
      toast?.success(`Mesa ${newTableNumber} criada com sucesso!`);
      setNewTableNumber('');
      setNewTableSeats(4);
      setNewTableArea('');
      setShowCreateTableModal(false);
      loadTables();
    } catch (error: any) {
      toast?.error('Erro ao criar mesa: ' + error.message);
    }
  };

  // Função helper para carregar crédito de um cliente específico
  const loadCustomerCredit = async (customerId: string) => {
    try {
      const customerData = await electronAPI.customers.getById(customerId);
      if (customerData) {
        setCustomersCreditInfo(prev => {
          const newMap = new Map(prev);
          newMap.set(customerId, {
            creditLimit: customerData.credit_limit || 0,
            currentDebt: customerData.current_debt || 0
          });
          return newMap;
        });
        return true;
      }
      return false;
    } catch (err) {
      console.error(`Erro ao buscar crédito do cliente ${customerId}:`, err);
      return false;
    }
  };

  const loadSession = async (sessionId: string) => {
    try {
      const data = await electronAPI.tableSessions.getById(sessionId);
      setSelectedSession(data);
      
      // Buscar informações de crédito dos clientes cadastrados
      if (data && data.customers) {
        const creditMap = new Map();
        for (const customer of data.customers) {
          if (customer.customer_id) {
            try {
              const customerData = await electronAPI.customers.getById(customer.customer_id);
              if (customerData) {
                creditMap.set(customer.customer_id, {
                  creditLimit: customerData.credit_limit || 0,
                  currentDebt: customerData.current_debt || 0
                });
              }
            } catch (err) {
              console.error(`Erro ao buscar crédito do cliente ${customer.customer_id}:`, err);
            }
          }
        }
        setCustomersCreditInfo(creditMap);
        
        // Buscar vales pendentes desta mesa específica (para compatibilidade)
        try {
          const pendingDebts = await electronAPI.debts.getTablePendingDebts(data.table_number);
          setTablePendingDebts(pendingDebts || {});
        } catch (err) {
          console.error('Erro ao buscar vales pendentes da mesa:', err);
          setTablePendingDebts({});
        }

        // Buscar TODOS os vales pendentes dos clientes cadastrados (de todas as mesas)
        const customerIds = data.customers
          .filter(c => c.customer_id)
          .map(c => c.customer_id!);
        
        if (customerIds.length > 0) {
          try {
            const allDebts = await electronAPI.debts.getCustomersPendingDebts(customerIds);
            setAllCustomerDebts(allDebts || []);
          } catch (err) {
            console.error('Erro ao buscar todos os vales pendentes:', err);
            setAllCustomerDebts([]);
          }
        } else {
          setAllCustomerDebts([]);
        }
      }
    } catch (error: any) {
      toast?.error('Erro ao carregar sessão: ' + error.message);
    }
  };

  const handleOpenTable = async (table: TableOverview) => {
    if (!currentCashBox) {
      toast?.error('É necessário abrir a caixa antes de abrir mesas');
      setShowOpenTableModal(false);
      return;
    }
    
    try {
      const userId = localStorage.getItem('userId') || 'default-user';
      const branchId = localStorage.getItem('branchId') || 'main-branch';
      
      const session = await electronAPI.tableSessions.open({
        tableId: table.id,
        branchId,
        openedBy: userId,
      });
      
      toast?.success(`Mesa ${table.number} aberta com sucesso!`);
      loadTables();
      loadSession(session.id);
      setShowOpenTableModal(false);
    } catch (error: any) {
      toast?.error('Erro ao abrir mesa: ' + error.message);
    }
  };

  const handleAddCustomer = async () => {
    if (!selectedSession) return;
    
    const customerName = selectedRegisteredCustomer?.name || newCustomerName.trim();
    const customerId = selectedRegisteredCustomer?.id || null;
    
    if (!customerName) {
      toast?.error('Informe o nome do cliente ou selecione um cliente cadastrado');
      return;
    }
    
    try {
      const userId = localStorage.getItem('userId') || 'default-user';
      
      await electronAPI.tableCustomers.add({
        sessionId: selectedSession.id,
        customerName: customerName,
        customerId: customerId,
        addedBy: userId,
      });
      
      toast?.success(`Cliente "${customerName}" adicionado!`);
      setNewCustomerName('');
      setSelectedRegisteredCustomer(null);
      setCustomerSearchQuery('');
      setShowAddCustomerModal(false);
      loadSession(selectedSession.id);
    } catch (error: any) {
      toast?.error('Erro ao adicionar cliente: ' + error.message);
    }
  };

  // Adicionar produto ao carrinho de pedidos
  const addToOrderCart = (product: Product, isMuntu: boolean = false) => {
    if (product.stockQty <= 0) {
      toast?.error(`${product.name} está sem estoque!`);
      return;
    }

    const existingItem = orderCart.find(
      item => item.productId === product.id && item.isMuntu === isMuntu
    );

    if (isMuntu && product.muntuPrice && product.muntuQuantity) {
      // Para Muntu, adicionar o pack completo de uma vez
      const quantityToAdd = product.muntuQuantity;
      const currentQtyInCart = existingItem ? existingItem.quantity : 0;
      const newTotalQty = currentQtyInCart + quantityToAdd;

      // Verificar se há estoque suficiente
      if (newTotalQty > product.stockQty) {
        toast?.error(`Estoque insuficiente! Disponível: ${product.stockQty} unidades`);
        return;
      }

      const pricePerUnit = product.muntuPrice / product.muntuQuantity;
      
      if (existingItem) {
        setOrderCart(orderCart.map(item =>
          item.productId === product.id && item.isMuntu === isMuntu
            ? { ...item, quantity: newTotalQty, subtotal: pricePerUnit * newTotalQty }
            : item
        ));
      } else {
        setOrderCart([...orderCart, {
          productId: product.id,
          productName: product.name,
          quantity: quantityToAdd,
          unitPrice: pricePerUnit,
          costUnit: product.costUnit,
          subtotal: product.muntuPrice,
          isMuntu,
        }]);
      }
    } else {
      // Para venda unitária normal
      const currentQtyInCart = existingItem ? existingItem.quantity : 0;
      const newTotalQty = currentQtyInCart + 1;

      // Verificar se há estoque suficiente
      if (newTotalQty > product.stockQty) {
        toast?.error(`Estoque insuficiente! Disponível: ${product.stockQty} unidades`);
        return;
      }

      if (existingItem) {
        setOrderCart(orderCart.map(item =>
          item.productId === product.id && item.isMuntu === isMuntu
            ? { ...item, quantity: newTotalQty, subtotal: newTotalQty * product.priceUnit }
            : item
        ));
      } else {
        setOrderCart([...orderCart, {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPrice: product.priceUnit,
          costUnit: product.costUnit,
          subtotal: product.priceUnit,
          isMuntu,
        }]);
      }
    }
  };

  const updateOrderCartQty = (productId: string, isMuntu: boolean, newQty: number) => {
    if (newQty <= 0) {
      removeFromOrderCart(productId, isMuntu);
      return;
    }
    
    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (product && newQty > product.stockQty) {
      toast?.error(`Estoque insuficiente! Disponível: ${product.stockQty} unidades`);
      return;
    }

    // Para itens Muntu, garantir que a quantidade é múltiplo do pack
    if (isMuntu && product.muntuQuantity) {
      const remainder = newQty % product.muntuQuantity;
      if (remainder !== 0) {
        newQty = newQty - remainder;
        if (newQty <= 0) {
          removeFromOrderCart(productId, isMuntu);
          return;
        }
      }
    }
    
    setOrderCart(orderCart.map(item =>
      item.productId === productId && item.isMuntu === isMuntu
        ? { ...item, quantity: newQty, subtotal: newQty * item.unitPrice }
        : item
    ));
  };

  const removeFromOrderCart = (productId: string, isMuntu: boolean) => {
    setOrderCart(orderCart.filter(item => !(item.productId === productId && item.isMuntu === isMuntu)));
  };

  const getOrderCartTotal = () => {
    return orderCart.reduce((sum, item) => sum + item.subtotal, 0);
  };

  const handleAddOrders = async () => {
    if (!selectedSession || !selectedCustomer || orderCart.length === 0) return;
    
    try {
      const userId = localStorage.getItem('userId') || 'default-user';
      
      for (const item of orderCart) {
        console.log('[Tables] Enviando pedido:', item);
        const result = await electronAPI.tableOrders.add({
          sessionId: selectedSession.id,
          tableCustomerId: selectedCustomer.id,
          productId: item.productId,
          qtyUnits: item.quantity,
          isMuntu: item.isMuntu,
          orderedBy: userId,
        });
        console.log('[Tables] Resultado do pedido:', result);
      }
      
      toast?.success(`${orderCart.length} pedido(s) adicionado(s) com sucesso!`);
      setOrderCart([]);
      setProductSearch('');
      setShowAddOrderModal(false);
      
      // Atualizar dados em paralelo para melhor performance
      await Promise.all([
        loadSession(selectedSession.id),
        loadTables(),
        loadProducts()
      ]);
    } catch (error: any) {
      toast?.error('Erro ao adicionar pedidos: ' + error.message);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    setConfirmDialogConfig({
      title: 'Cancelar Pedido',
      message: 'Tem certeza que deseja cancelar este pedido? O estoque será restaurado.',
      type: 'warning',
      onConfirm: async () => {
        setShowConfirmDialog(false);
        try {
          const userId = localStorage.getItem('userId') || 'default-user';
          
          await electronAPI.tableOrders.cancel({
            orderId,
            cancelledBy: userId,
          });
          
          toast?.success('Pedido cancelado e estoque restaurado!');
          
          // Atualizar dados em paralelo para refletir o estoque atualizado
          await Promise.all([
            loadSession(selectedSession!.id),
            loadTables(),
            loadProducts()
          ]);
        } catch (error: any) {
          toast?.error('Erro ao cancelar pedido: ' + error.message);
        }
      }
    });
    setShowConfirmDialog(true);
  };

  const handleProcessPayment = async () => {
    if (!selectedSession || !currentCashBox) {
      toast?.error('Caixa não está aberta!');
      return;
    }
    
    // Validação: cliente deve estar selecionado para pagamento individual
    if (paymentType === 'customer' && !selectedCustomer) {
      toast?.error('Selecione um cliente para pagamento individual');
      return;
    }
    
    // Validação do método Vale
    if (paymentMethod === 'vale') {
      // Validação para Conta Individual
      if (paymentType === 'customer') {
        if (!selectedCustomer?.customer_id) {
          toast?.error('Vale só disponível para clientes cadastrados');
          return;
        }
        
        const creditInfo = customersCreditInfo.get(selectedCustomer.customer_id);
        if (!creditInfo) {
          toast?.error('Informações de crédito não carregadas. Aguarde e tente novamente.');
          return;
        }
        
        // currentDebt já inclui TODOS os vales (desta e de outras mesas)
        const availableCredit = creditInfo.creditLimit - creditInfo.currentDebt;
        const pendingAmount = selectedCustomer.total - selectedCustomer.paid_amount;
        
        if (pendingAmount > availableCredit) {
          toast?.error(`Limite de crédito insuficiente! Disponível: ${formatCurrency(availableCredit)}, Necessário: ${formatCurrency(pendingAmount)}`);
          return;
        }
      }
      
      // Validação para Conta Conjunta
      if (paymentType === 'session') {
        const registeredCustomers = selectedSession.customers.filter(c => c.customer_id);
        
        if (registeredCustomers.length === 0) {
          toast?.error('Vale requer pelo menos um cliente cadastrado na mesa');
          return;
        }
        
        let totalAvailableCredit = 0;
        let hasLoadingInfo = false;
        
        for (const customer of registeredCustomers) {
          const creditInfo = customersCreditInfo.get(customer.customer_id!);
          if (!creditInfo) {
            hasLoadingInfo = true;
            break;
          }
          
          // currentDebt já inclui TODOS os vales (desta e de outras mesas)
          totalAvailableCredit += (creditInfo.creditLimit - creditInfo.currentDebt);
        }
        
        if (hasLoadingInfo) {
          toast?.error('Informações de crédito não carregadas. Aguarde e tente novamente.');
          return;
        }
        
        const pendingAmount = selectedSession.total_amount - selectedSession.paid_amount;
        
        if (pendingAmount > totalAvailableCredit) {
          toast?.error(`Limite de crédito conjunto insuficiente! Disponível: ${formatCurrency(totalAvailableCredit)}, Necessário: ${formatCurrency(pendingAmount)}`);
          return;
        }
      }
    }
    
    try {
      const userId = localStorage.getItem('userId') || 'default-user';
      const branchId = localStorage.getItem('branchId') || 'main-branch';
      const amountCents = Math.round(paymentAmount * 100);
      
      if (paymentType === 'customer' && selectedCustomer) {
        // 🔴 CORREÇÃO CRÍTICA: Capturar saleId retornado para vincular à dívida
        const paymentResult = await electronAPI.tablePayments.processCustomer({
          sessionId: selectedSession.id,
          tableCustomerId: selectedCustomer.id,
          method: paymentMethod,
          amount: amountCents,
          processedBy: userId,
        });
        
        // ═══════════════════════════════════════════════════════════════════
        // 🚫 REMOVIDO: Criação de Debt aqui causava DUPLICAÇÃO!
        // 
        // CAUSA RAIZ DO BUG:
        // 1. processTableCustomerPayment() cria Sale com paymentMethod='VALE'
        // 2. Sale é sincronizada → Backend cria Debt automaticamente (ID_BACKEND)
        // 3. Este código criava Debt localmente (ID_LOCAL) com mesmo saleId
        // 4. Quando Electron baixava debts do servidor, recebia ID_BACKEND
        // 5. Como ID_BACKEND != ID_LOCAL, Electron criava NOVO registro
        // 6. RESULTADO: 2 debts aparecendo para a mesma venda
        //
        // SOLUÇÃO: O backend já cria o Debt automaticamente em sales.service.ts
        // quando sincroniza uma Sale com paymentMethod='VALE'. Não precisamos
        // (e não devemos!) criar aqui também.
        // ═══════════════════════════════════════════════════════════════════
        if (paymentMethod === 'vale' && selectedCustomer.customer_id) {
          console.log('💳 [VALE] Venda criada com paymentMethod=VALE - Debt será criado automaticamente pelo backend');
          console.log('   Cliente:', selectedCustomer.customer_id, selectedCustomer.customer_name);
          console.log('   Valor:', amountCents);
          console.log('   SaleId:', paymentResult?.saleId);
        }
        
        // 🔴 CORREÇÃO CRÍTICA: Adicionar pontos de fidelidade para cliente cadastrado
        // Mesma lógica do PDV - 1 ponto a cada 1.000 FCFA (100.000 centavos)
        // Vale não dá pontos (pagamento não efetivo)
        if (selectedCustomer.customer_id && paymentMethod !== 'vale' && amountCents >= 100000) {
          try {
            // @ts-ignore
            const loyaltyResult = await window.electronAPI?.loyalty?.addPoints?.(
              selectedCustomer.customer_id,
              amountCents,
              paymentResult?.saleId
            );
            
            if (loyaltyResult && loyaltyResult.pointsAdded > 0) {
              toast?.success(
                `🎉 +${loyaltyResult.pointsAdded} ponto${loyaltyResult.pointsAdded > 1 ? 's' : ''} de fidelidade para ${selectedCustomer.customer_name}! Total: ${loyaltyResult.totalPoints}`
              );
            }
          } catch (error) {
            console.error('Erro ao adicionar pontos de fidelidade:', error);
            // Não bloqueia o pagamento se falhar
          }
        }
        
        const successMsg = paymentMethod === 'vale' 
          ? `💳 Vale criado com sucesso para ${selectedCustomer.customer_name}! Valor: ${formatCurrency(amountCents)}. Verifique na aba "Gestão de Dívidas (Vales)".`
          : `Pagamento individual de ${formatCurrency(amountCents)} recebido!`;
        toast?.success(successMsg);
      } else if (paymentType === 'session') {
        // 🔴 CORREÇÃO CRÍTICA: Capturar saleId retornado para vincular às dívidas
        const sessionPaymentResult = await electronAPI.tablePayments.processSession({
          sessionId: selectedSession.id,
          method: paymentMethod,
          amount: amountCents,
          processedBy: userId,
        });
        
        // ═══════════════════════════════════════════════════════════════════
        // 🚫 REMOVIDO: Criação de Debts aqui causava DUPLICAÇÃO!
        // 
        // MESMA CORREÇÃO do pagamento individual - Ver comentário acima.
        // O backend já cria o Debt automaticamente quando sincroniza a Sale
        // com paymentMethod='VALE'. Criar aqui causava duplicação.
        //
        // Para vale conjunto, o backend ainda cria apenas UMA dívida
        // (vinculada à venda). Se precisar de distribuição proporcional
        // entre clientes, isso deve ser tratado de outra forma no futuro.
        // ═══════════════════════════════════════════════════════════════════
        if (paymentMethod === 'vale') {
          const registeredCustomers = selectedSession.customers.filter(c => c.customer_id);
          console.log('💳 [VALE CONJUNTO] Venda criada com paymentMethod=VALE');
          console.log('   Clientes cadastrados:', registeredCustomers.map(c => c.customer_name).join(', '));
          console.log('   Valor total:', amountCents);
          console.log('   SaleId:', sessionPaymentResult?.saleId);
          console.log('   Debt será criado automaticamente pelo backend');
          
          toast?.success(`💳 Vale criado! Valor: ${formatCurrency(amountCents)}. A dívida será registrada para o cliente principal da sessão.`);
        } else {
          // 🔴 CORREÇÃO CRÍTICA: Adicionar pontos de fidelidade para clientes cadastrados
          // Pagamento efetivo (não Vale) - distribuir pontos proporcionalmente
          const registeredCustomers = selectedSession.customers.filter(c => c.customer_id);
          
          if (registeredCustomers.length > 0 && amountCents >= 100000) {
            // Calcular total consumido por clientes cadastrados
            let totalRegistered = 0;
            for (const customer of registeredCustomers) {
              totalRegistered += customer.total || 0;
            }
            
            // Distribuir pontos proporcionalmente ao consumo de cada cliente
            for (const customer of registeredCustomers) {
              const customerTotal = customer.total || 0;
              // Proporcionalizar o valor pago pelo consumo do cliente
              const customerShare = totalRegistered > 0 
                ? Math.round((customerTotal / totalRegistered) * amountCents)
                : Math.round(amountCents / registeredCustomers.length);
              
              if (customerShare >= 100000) { // Mínimo 1.000 FCFA = 100.000 centavos
                try {
                  // @ts-ignore
                  const loyaltyResult = await window.electronAPI?.loyalty?.addPoints?.(
                    customer.customer_id,
                    customerShare,
                    sessionPaymentResult?.saleId
                  );
                  
                  if (loyaltyResult && loyaltyResult.pointsAdded > 0) {
                    toast?.success(
                      `🎉 +${loyaltyResult.pointsAdded} ponto${loyaltyResult.pointsAdded > 1 ? 's' : ''} para ${customer.customer_name}! Total: ${loyaltyResult.totalPoints}`
                    );
                  }
                } catch (error) {
                  console.error(`Erro ao adicionar pontos para ${customer.customer_name}:`, error);
                }
              }
            }
          }
          
          toast?.success(`✅ Pagamento conjunto de ${formatCurrency(amountCents)} recebido!`);
        }
      }
      
      setPaymentAmount(0);
      setShowPaymentModal(false);
      loadSession(selectedSession.id);
      loadTables();
    } catch (error: any) {
      toast?.error('Erro ao processar pagamento: ' + error.message);
    }
  };

  const handleCloseTable = async () => {
    if (!selectedSession) return;
    
    const pendingAmount = selectedSession.total_amount - selectedSession.paid_amount;
    if (pendingAmount > 0) {
      toast?.error(`Há ${formatCurrency(pendingAmount)} pendente de pagamento!`);
      return;
    }
    
    try {
      const userId = localStorage.getItem('userId') || 'default-user';
      
      await electronAPI.tableSessions.close({
        sessionId: selectedSession.id,
        closedBy: userId,
      });
      
      toast?.success('Mesa fechada com sucesso!');
      setSelectedSession(null);
      loadTables();
    } catch (error: any) {
      toast?.error('Erro ao fechar mesa: ' + error.message);
    }
  };

  // Transferir item entre clientes da mesma mesa
  const handleTransferItem = async () => {
    if (!transferOrder || !transferToCustomerId || !selectedSession) return;
    
    try {
      const userId = localStorage.getItem('userId') || 'default-user';
      const qtyToTransfer = transferQty || transferOrder.qty_units;
      
      await electronAPI.tableOrders.transfer({
        orderId: transferOrder.id,
        fromCustomerId: selectedCustomer?.id,
        toCustomerId: transferToCustomerId,
        qtyUnits: qtyToTransfer,
        transferredBy: userId,
      });
      
      toast?.success('Item transferido com sucesso!');
      setShowTransferItemModal(false);
      setTransferOrder(null);
      setTransferToCustomerId('');
      setTransferQty(0);
      loadSession(selectedSession.id);
    } catch (error: any) {
      toast?.error('Erro ao transferir item: ' + error.message);
    }
  };

  // Transferir mesa inteira para outra mesa
  const handleTransferTable = async (toTableId: string) => {
    if (!selectedSession) return;
    
    try {
      const userId = localStorage.getItem('userId') || 'default-user';
      
      await electronAPI.tableSessions.transfer({
        sessionId: selectedSession.id,
        toTableId,
        transferredBy: userId,
      });
      
      toast?.success('Mesa transferida com sucesso!');
      setShowTransferTableModal(false);
      setSelectedSession(null);
      loadTables();
    } catch (error: any) {
      toast?.error('Erro ao transferir mesa: ' + error.message);
    }
  };

  // Transferir clientes selecionados para outra mesa
  const handleTransferCustomers = async (toTableId: string) => {
    if (!selectedSession || selectedCustomersToTransfer.length === 0) return;
    
    try {
      const userId = localStorage.getItem('userId') || 'default-user';
      
      const result = await electronAPI.tableSessions.transferCustomers({
        sessionId: selectedSession.id,
        customerIds: selectedCustomersToTransfer,
        toTableId,
        transferredBy: userId,
      });
      
      toast?.success(result.message || 'Clientes transferidos com sucesso!');
      setShowTransferCustomersModal(false);
      setSelectedCustomersToTransfer([]);
      
      // Se a sessão original foi fechada (todos os clientes saíram), limpar seleção
      const remainingCustomers = selectedSession.customers.filter(
        c => !selectedCustomersToTransfer.includes(c.id)
      );
      
      if (remainingCustomers.length === 0) {
        setSelectedSession(null);
      } else {
        // Recarregar a sessão
        loadSession(selectedSession.id);
      }
      
      loadTables();
    } catch (error: any) {
      toast?.error('Erro ao transferir clientes: ' + error.message);
    }
  };

  // Unir mesas selecionadas
  const handleMergeTables = async (targetTableId: string) => {
    if (selectedTablesForMerge.length < 2) {
      toast?.error('Selecione pelo menos 2 mesas para unir');
      return;
    }
    
    try {
      const userId = localStorage.getItem('userId') || 'default-user';
      
      // Buscar os session IDs das mesas selecionadas
      const sessionIds = tables
        .filter(t => selectedTablesForMerge.includes(t.id) && t.sessionId)
        .map(t => t.sessionId)
        .filter(Boolean) as string[];
      
      if (sessionIds.length < 2) {
        toast?.error('As mesas selecionadas não têm sessões ativas');
        return;
      }
      
      const result = await electronAPI.tableSessions.merge({
        sessionIds,
        targetTableId,
        mergedBy: userId,
      });
      
      toast?.success(result.message || 'Mesas unidas com sucesso!');
      setShowMergeTablesModal(false);
      setSelectedTablesForMerge([]);
      setSelectedSession(null);
      loadTables();
    } catch (error: any) {
      toast?.error('Erro ao unir mesas: ' + error.message);
    }
  };

  // Toggle seleção de clientes para transferência
  const toggleCustomerSelection = (customerId: string) => {
    setSelectedCustomersToTransfer(prev => {
      if (prev.includes(customerId)) {
        return prev.filter(id => id !== customerId);
      } else {
        return [...prev, customerId];
      }
    });
  };

  // Toggle seleção de mesas para unir
  const toggleTableSelection = (tableId: string) => {
    setSelectedTablesForMerge(prev => {
      if (prev.includes(tableId)) {
        return prev.filter(id => id !== tableId);
      } else {
        return [...prev, tableId];
      }
    });
  };

  // Separar mesa unida
  const handleSplitTable = async () => {
    if (!selectedSession || splitDistributions.length === 0) return;
    
    try {
      const userId = localStorage.getItem('userId') || 'default-user';
      
      const result = await electronAPI.tableSessions.split({
        sessionId: selectedSession.id,
        distributions: splitDistributions,
        splitBy: userId,
      });
      
      toast?.success(result.message || 'Mesa separada com sucesso!');
      setShowSplitTableModal(false);
      setSplitDistributions([]);
      setSelectedSession(null);
      loadTables();
    } catch (error: any) {
      toast?.error('Erro ao separar mesa: ' + error.message);
    }
  };

  // Adicionar distribuição para separação
  const addSplitDistribution = (tableId: string, customerIds: string[]) => {
    setSplitDistributions(prev => {
      // Remover distribuição anterior para esta mesa se existir
      const filtered = prev.filter(d => d.tableId !== tableId);
      // Adicionar nova distribuição
      return [...filtered, { tableId, customerIds }];
    });
  };

  // Carregar histórico da sessão
  const loadSessionHistory = async (sessionId: string) => {
    try {
      const history = await electronAPI.tableSessions.getActions?.(sessionId) || [];
      setSessionHistory(history);
      setShowHistoryModal(true);
    } catch (error: any) {
      toast?.error('Erro ao carregar histórico: ' + error.message);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(value / 100);
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'open': return 'bg-blue-100 text-blue-800';
      case 'awaiting_payment': return 'bg-yellow-100 text-yellow-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'available': return 'Disponível';
      case 'open': return 'Ocupada';
      case 'awaiting_payment': return 'Aguardando Pagamento';
      case 'closed': return 'Fechada';
      default: return status;
    }
  };

  // Filtrar produtos pela busca
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(productSearch.toLowerCase())
  );

  // Filtrar clientes cadastrados pela busca
  const filteredRegisteredCustomers = registeredCustomers.filter(c =>
    c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
    (c.phone && c.phone.includes(customerSearchQuery))
  );

  if (loading || checkingCashBox) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando mesas...</p>
        </div>
      </div>
    );
  }

  // Tela de caixa fechada
  if (!currentCashBox) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center bg-white p-8 rounded-lg shadow-lg max-w-md">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Caixa Fechada</h2>
          <p className="text-gray-600 mb-4">
            É necessário abrir a caixa antes de utilizar o sistema de mesas.
          </p>
          <p className="text-sm text-gray-500">
            Acesse a aba "Caixa" para abrir uma nova sessão.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Table className="w-8 h-8" />
          Gestão de Mesas
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateTableModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nova Mesa
          </button>
          <button
            onClick={() => {
              setSelectedTablesForMerge([]);
              setShowMergeTablesModal(true);
            }}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
            title="Unir múltiplas mesas em uma"
          >
            <ArrowRightLeft className="w-4 h-4" />
            Unir Mesas
          </button>
          <button
            onClick={loadTables}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Atualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grid de Mesas */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {tables.map((table) => (
              <div
                key={table.id}
                onClick={() => {
                  if (table.status === 'available') {
                    setSelectedTable(table);
                    setShowOpenTableModal(true);
                  } else if (table.sessionId) {
                    loadSession(table.sessionId);
                  }
                }}
                className={`
                  relative p-6 rounded-lg border-2 cursor-pointer transition-all
                  ${table.status === 'available' 
                    ? 'border-green-300 bg-green-50 hover:bg-green-100' 
                    : 'border-blue-300 bg-blue-50 hover:bg-blue-100'}
                `}
              >
                {/* Número da Mesa */}
                <div className="text-center mb-3">
                  <div className="text-3xl font-bold text-gray-800">
                    {table.number}
                  </div>
                  {table.area && (
                    <div className="text-xs text-gray-500 mt-1">{table.area}</div>
                  )}
                </div>

                {/* Status */}
                <div className="flex justify-center mb-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(table.status)}`}>
                    {getStatusLabel(table.status)}
                  </span>
                </div>

                {/* Info quando ocupada */}
                {table.status !== 'available' && (
                  <div className="space-y-2 text-xs text-gray-600">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {table.customerCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <ShoppingCart className="w-3 h-3" />
                        {table.orderCount}
                      </span>
                    </div>
                    <div className="text-center font-bold text-blue-600">
                      {formatCurrency(table.totalAmount)}
                    </div>
                    {table.openedAt && (
                      <div className="text-center text-gray-400 text-xs">
                        {formatDateTime(table.openedAt)}
                      </div>
                    )}
                  </div>
                )}

                {/* Ícone de Mesa */}
                <div className="absolute top-2 right-2">
                  <Table className={`w-4 h-4 ${table.status === 'available' ? 'text-green-600' : 'text-blue-600'}`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detalhes da Sessão */}
        <div className="lg:col-span-1">
          {selectedSession ? (
            <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
              {/* Header da Sessão */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold">Mesa {selectedSession.table_number}</h2>
                  <p className="text-sm text-gray-500">{selectedSession.session_number}</p>
                </div>
                <button
                  onClick={() => setSelectedSession(null)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Totais */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Total:</span>
                  <span className="font-bold">{formatCurrency(selectedSession.total_amount)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Pago:</span>
                  <span className="font-bold text-green-600">{formatCurrency(selectedSession.paid_amount)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-600">Pendente:</span>
                  <span className="font-bold text-red-600">
                    {formatCurrency(selectedSession.total_amount - selectedSession.paid_amount)}
                  </span>
                </div>
              </div>

              {/* Ações Principais */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  onClick={() => setShowAddCustomerModal(true)}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Cliente
                </button>
                <button
                  onClick={async () => {
                    setPaymentType('session');
                    setPaymentAmount((selectedSession.total_amount - selectedSession.paid_amount) / 100);
                    
                    // Recarregar informações de crédito de todos os clientes cadastrados
                    const registeredCustomers = selectedSession.customers.filter(c => c.customer_id);
                    for (const customer of registeredCustomers) {
                      await loadCustomerCredit(customer.customer_id!);
                    }
                    
                    setShowPaymentModal(true);
                  }}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                  disabled={selectedSession.total_amount <= selectedSession.paid_amount}
                >
                  <CreditCard className="w-4 h-4" />
                  Pagar Mesa
                </button>
              </div>

              {/* Lista de Clientes */}
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {selectedSession.customers.map((customer) => (
                  <div key={customer.id} className="border rounded-lg p-3">
                    {/* Header do Cliente */}
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="font-semibold">{customer.customer_name}</span>
                        {customer.customer_id && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-1 rounded">Cadastrado</span>
                        )}
                        {customer.customer_id && (() => {
                          const customerDebts = allCustomerDebts.filter(d => d.customer_id === customer.customer_id);
                          const totalDebts = customerDebts.reduce((sum, d) => sum + d.balance, 0);
                          const currentTableNumber = selectedSession?.table_number;
                          const debtsFromOtherTables = customerDebts.filter(d => d.table_number !== currentTableNumber);
                          
                          if (totalDebts === 0) return null;
                          
                          const title = customerDebts.map(d => {
                            const isOtherTable = d.table_number !== currentTableNumber;
                            return `Mesa ${d.table_number}: ${formatCurrency(d.balance)}${isOtherTable ? ' (outra mesa)' : ''}`;
                          }).join('\n');
                          
                          return (
                            <span 
                              className={`text-xs px-1 rounded ${debtsFromOtherTables.length > 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}
                              title={title}
                            >
                              💳 Vale {totalDebts > 0 ? formatCurrency(totalDebts) : 'pendente'}
                              {debtsFromOtherTables.length > 0 && ' ⚠️'}
                            </span>
                          );
                        })()}
                      </div>
                      <button
                        onClick={async () => {
                          setSelectedCustomer(customer);
                          setOrderCart([]);
                          setProductSearch('');
                          // Recarregar produtos para ter estoque atualizado
                          await loadProducts();
                          setShowAddOrderModal(true);
                        }}
                        className="p-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Totais do Cliente */}
                    <div className="text-sm mb-2">
                      <div className="flex justify-between text-gray-600">
                        <span>Total:</span>
                        <span className="font-semibold">{formatCurrency(customer.total)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Pago:</span>
                        <span className="font-semibold text-green-600">{formatCurrency(customer.paid_amount)}</span>
                      </div>
                    </div>

                    {/* Pedidos do Cliente */}
                    {customer.orders.length > 0 && (
                      <div className="space-y-1">
                        {/* Botão de limpar pedidos pagos */}
                        {customer.orders.some(o => o.status === 'paid') && (
                          <button
                            onClick={async () => {
                              try {
                                const result = await electronAPI.tablePayments.clearPaidOrders({
                                  sessionId: selectedSession?.id,
                                  tableCustomerId: customer.id,
                                  clearedBy: localStorage.getItem('userId') || 'default-user',
                                });
                                toast?.success(`✅ ${result.ordersCleared} pedidos pagos limpos!`);
                                if (selectedSession) {
                                  await loadSession(selectedSession.id);
                                }
                                await loadTables();
                              } catch (error: any) {
                                toast?.error(error.message || 'Erro ao limpar pedidos');
                              }
                            }}
                            className="w-full px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200 flex items-center justify-center gap-1 mb-2"
                          >
                            <Trash2 className="w-3 h-3" />
                            Limpar pedidos já pagos ({customer.orders.filter(o => o.status === 'paid').length})
                          </button>
                        )}
                        {customer.orders.map((order) => (
                          <div key={order.id} className={`flex justify-between items-center text-sm rounded p-2 ${
                            order.status === 'paid' 
                              ? 'bg-green-100 border border-green-300 opacity-60' 
                              : order.is_muntu 
                                ? 'bg-green-50 border border-green-200' 
                                : 'bg-gray-50'
                          }`}>
                            <div className="flex-1">
                              <div className="font-medium">
                                {order.product_name}
                                {order.is_muntu && <span className="ml-1 text-xs text-green-600">🎁 Muntu</span>}
                                {order.status === 'paid' && <span className="ml-1 text-xs text-green-700 font-semibold">✓ Pago</span>}
                              </div>
                              <div className="text-xs text-gray-500">
                                {order.qty_units}x {formatCurrency(order.unit_price)}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="font-semibold mr-2">{formatCurrency(order.total)}</span>
                              {order.status === 'pending' && selectedSession && selectedSession.customers.length > 1 && (
                                <button
                                  onClick={() => {
                                    setSelectedCustomer(customer);
                                    setTransferOrder(order);
                                    setTransferQty(order.qty_units);
                                    setTransferToCustomerId('');
                                    setShowTransferItemModal(true);
                                  }}
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                  title="Transferir para outro cliente"
                                >
                                  <ArrowRightLeft className="w-4 h-4" />
                                </button>
                              )}
                              {order.status === 'pending' && (
                                <button
                                  onClick={() => handleCancelOrder(order.id)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  title="Cancelar pedido"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Botão de Pagamento Individual */}
                    {customer.total > customer.paid_amount && (
                      <button
                        onClick={async () => {
                          setSelectedCustomer(customer);
                          setPaymentType('customer');
                          setPaymentAmount((customer.total - customer.paid_amount) / 100);
                          
                          // Se cliente cadastrado, recarregar informações de crédito
                          if (customer.customer_id) {
                            await loadCustomerCredit(customer.customer_id);
                          }
                          
                          setShowPaymentModal(true);
                        }}
                        className="w-full mt-2 px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200"
                      >
                        Pagar {formatCurrency(customer.total - customer.paid_amount)}
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Ações da Mesa */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setShowTransferTableModal(true)}
                  className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center justify-center gap-2"
                  title="Transferir mesa completa para outra mesa"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  Transferir Mesa
                </button>
                <button
                  onClick={() => {
                    setSelectedCustomersToTransfer([]);
                    setShowTransferCustomersModal(true);
                  }}
                  className="flex-1 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 flex items-center justify-center gap-2"
                  title="Transferir clientes selecionados para outra mesa"
                >
                  <Users className="w-4 h-4" />
                  Transferir Clientes
                </button>
                <button
                  onClick={() => loadSessionHistory(selectedSession.id)}
                  className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center justify-center gap-2"
                  title="Ver histórico de ações"
                >
                  <Clock className="w-4 h-4" />
                  Histórico
                </button>
                {selectedSession.customers && selectedSession.customers.length > 1 && (
                  <button
                    onClick={() => {
                      setSplitDistributions([]);
                      setShowSplitTableModal(true);
                    }}
                    className="flex-1 px-3 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 flex items-center justify-center gap-2"
                    title="Separar mesa em múltiplas mesas"
                  >
                    <Grid className="w-4 h-4" />
                    Separar Mesa
                  </button>
                )}
              </div>

              {/* Botão Fechar Mesa */}
              <button
                onClick={handleCloseTable}
                className="w-full mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Fechar Mesa
              </button>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-12 text-center text-gray-500">
              <Table className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Selecione uma mesa para ver os detalhes</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Abrir Mesa */}
      {showOpenTableModal && selectedTable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Abrir Mesa {selectedTable.number}</h3>
            <p className="text-gray-600 mb-6">
              Tem certeza que deseja abrir esta mesa?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowOpenTableModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleOpenTable(selectedTable)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Abrir Mesa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Adicionar Cliente */}
      {/* Modal: Adicionar Cliente */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Adicionar Cliente</h3>
            
            {/* Buscar cliente cadastrado */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Buscar Cliente Cadastrado
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={customerSearchQuery}
                  onChange={(e) => {
                    setCustomerSearchQuery(e.target.value);
                    setSelectedRegisteredCustomer(null);
                  }}
                  placeholder="Buscar por nome ou telefone..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              
              {/* Lista de clientes encontrados */}
              {customerSearchQuery && filteredRegisteredCustomers.length > 0 && (
                <div className="mt-2 max-h-32 overflow-y-auto border rounded-lg">
                  {filteredRegisteredCustomers.slice(0, 5).map((customer) => (
                    <div
                      key={customer.id}
                      onClick={() => {
                        setSelectedRegisteredCustomer(customer);
                        setCustomerSearchQuery(customer.name);
                        setNewCustomerName('');
                      }}
                      className={`p-2 cursor-pointer hover:bg-gray-100 ${
                        selectedRegisteredCustomer?.id === customer.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="font-medium">{customer.name}</div>
                      <div className="text-xs text-gray-500">{customer.phone || 'Sem telefone'}</div>
                    </div>
                  ))}
                </div>
              )}
              
              {selectedRegisteredCustomer && (
                <div className="mt-2 p-2 bg-blue-50 rounded-lg flex justify-between items-center">
                  <div>
                    <div className="font-medium text-blue-700">{selectedRegisteredCustomer.name}</div>
                    <div className="text-xs text-blue-600">{selectedRegisteredCustomer.loyalty_points} pontos</div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedRegisteredCustomer(null);
                      setCustomerSearchQuery('');
                    }}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            
            {/* Ou digitar nome */}
            {!selectedRegisteredCustomer && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ou digite o nome do cliente
                </label>
                <input
                  type="text"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="Nome do cliente (ex: Cliente 01, João, etc)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setNewCustomerName('');
                  setSelectedRegisteredCustomer(null);
                  setCustomerSearchQuery('');
                  setShowAddCustomerModal(false);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddCustomer}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                disabled={!newCustomerName.trim() && !selectedRegisteredCustomer}
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Adicionar Pedido (com carrinho) */}
      {showAddOrderModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <h3 className="text-xl font-bold mb-4">
              Novo Pedido - {selectedCustomer.customer_name}
            </h3>
            
            <div className="flex gap-4 flex-1 overflow-hidden">
              {/* Lista de Produtos */}
              <div className="flex-1 flex flex-col">
                <div className="mb-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Buscar produto..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div key={productsKey} className="grid grid-cols-2 gap-2 overflow-y-auto flex-1 pr-2">
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className="p-3 border rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all"
                    >
                      <div className="font-semibold text-sm">{product.name}</div>
                      <div className="text-xs text-gray-500">{product.sku}</div>
                      <div className="text-sm text-blue-600 font-semibold mt-1">
                        {product.priceUnit.toLocaleString()} FCFA / un
                      </div>
                      <div className="text-xs text-gray-500">
                        Estoque: {product.stockQty} un
                      </div>
                      <div className="flex gap-1 mt-2">
                        <button
                          onClick={() => addToOrderCart(product, false)}
                          disabled={product.stockQty <= 0}
                          className="flex-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:bg-gray-300"
                        >
                          <div className="flex flex-col items-center leading-tight">
                            <span>Unitário</span>
                            <span className="font-bold">{product.priceUnit.toLocaleString()} F</span>
                          </div>
                        </button>
                        {product.isMuntuEligible && product.muntuPrice && product.muntuQuantity && (
                          <button
                            onClick={() => addToOrderCart(product, true)}
                            disabled={product.stockQty <= 0}
                            className="flex-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:bg-gray-300"
                          >
                            <div className="flex flex-col items-center leading-tight">
                              <span>Muntu ({product.muntuQuantity})</span>
                              <span className="font-bold">{product.muntuPrice.toLocaleString()} F</span>
                            </div>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Carrinho de Pedidos */}
              <div className="w-72 bg-gray-50 rounded-lg p-4 flex flex-col">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" />
                  Carrinho ({orderCart.length})
                </h4>
                
                <div className="flex-1 overflow-y-auto space-y-2">
                  {orderCart.map((item) => {
                    const product = products.find(p => p.id === item.productId);
                    return (
                    <div key={`${item.productId}-${item.isMuntu}`} className={`bg-white rounded p-2 text-sm ${item.isMuntu ? 'border border-green-200 bg-green-50' : ''}`}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium">{item.productName}</div>
                          {item.isMuntu ? (
                            <div className="text-xs">
                              <span className="text-green-700 font-medium">🎁 Pack Muntu</span>
                              <p className="text-gray-500">
                                {product?.muntuQuantity ? `${item.quantity / product.muntuQuantity} pack × ${item.unitPrice.toLocaleString()} FCFA/un` : ''}
                              </p>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500">
                              {item.unitPrice.toLocaleString()} FCFA/un
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => removeFromOrderCart(item.productId, item.isMuntu)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              const decrement = item.isMuntu && product?.muntuQuantity ? product.muntuQuantity : 1;
                              updateOrderCartQty(item.productId, item.isMuntu, item.quantity - decrement);
                            }}
                            className="w-6 h-6 bg-gray-200 rounded flex items-center justify-center hover:bg-gray-300"
                          >
                            -
                          </button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <button
                            onClick={() => {
                              const increment = item.isMuntu && product?.muntuQuantity ? product.muntuQuantity : 1;
                              updateOrderCartQty(item.productId, item.isMuntu, item.quantity + increment);
                            }}
                            className="w-6 h-6 bg-gray-200 rounded flex items-center justify-center hover:bg-gray-300"
                          >
                            +
                          </button>
                        </div>
                        <span className="font-semibold">{item.subtotal.toLocaleString()} FCFA</span>
                      </div>
                    </div>
                  );
                  })}
                  
                  {orderCart.length === 0 && (
                    <div className="text-center text-gray-400 py-4">
                      Carrinho vazio
                    </div>
                  )}
                </div>
                
                {/* Total */}
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span className="text-blue-600">{getOrderCartTotal().toLocaleString()} FCFA</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-4 pt-4 border-t">
              <button
                onClick={() => {
                  setOrderCart([]);
                  setProductSearch('');
                  setShowAddOrderModal(false);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddOrders}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                disabled={orderCart.length === 0}
              >
                Adicionar {orderCart.length} Pedido(s)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Pagamento */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Processar Pagamento</h3>
            
            {/* Tipo de Pagamento */}
            {selectedSession && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Pagamento
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setPaymentType('customer');
                      // Se não houver cliente selecionado, seleciona o primeiro com saldo pendente
                      if (!selectedCustomer && selectedSession.customers.length > 0) {
                        const firstCustomerWithBalance = selectedSession.customers.find(c => c.total > c.paid_amount);
                        if (firstCustomerWithBalance) {
                          setSelectedCustomer(firstCustomerWithBalance);
                          setPaymentAmount((firstCustomerWithBalance.total - firstCustomerWithBalance.paid_amount) / 100);
                        }
                      } else if (selectedCustomer) {
                        setPaymentAmount((selectedCustomer.total - selectedCustomer.paid_amount) / 100);
                      }
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      paymentType === 'customer'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Conta Individual
                  </button>
                  <button
                    onClick={() => {
                      setPaymentType('session');
                      setPaymentAmount((selectedSession.total_amount - selectedSession.paid_amount) / 100);
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      paymentType === 'session'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Conta Conjunta
                  </button>
                </div>
              </div>
            )}
            
            {/* Seletor de Cliente para Pagamento Individual */}
            {paymentType === 'customer' && selectedSession && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selecione o Cliente
                </label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'Escolha um cliente...' },
                    ...selectedSession.customers
                      .filter(c => c.total > c.paid_amount)
                      .map(customer => ({
                        value: customer.id,
                        label: customer.customer_name,
                        subtitle: `Pendente: ${formatCurrency(customer.total - customer.paid_amount)}`,
                      })),
                  ]}
                  value={selectedCustomer?.id || ''}
                  onChange={(value) => {
                    const customer = selectedSession.customers.find(c => c.id === value);
                    if (customer) {
                      setSelectedCustomer(customer);
                      setPaymentAmount((customer.total - customer.paid_amount) / 100);
                    }
                  }}
                  placeholder="Escolha um cliente..."
                  searchPlaceholder="Buscar cliente..."
                  emptyText="Nenhum cliente com pendência encontrado"
                />
              </div>
            )}
            
            {paymentType === 'customer' && selectedCustomer && (
              <div className="mb-4 p-3 bg-blue-50 rounded">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  <div className="font-semibold">{selectedCustomer.customer_name}</div>
                  {selectedCustomer.customer_id && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Cadastrado</span>
                  )}
                </div>
                <div className="text-sm text-gray-600 mt-2">
                  <div className="flex justify-between">
                    <span>Total:</span>
                    <span className="font-semibold">{formatCurrency(selectedCustomer.total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pago:</span>
                    <span className="font-semibold text-green-600">{formatCurrency(selectedCustomer.paid_amount)}</span>
                  </div>
                  <div className="flex justify-between border-t mt-1 pt-1">
                    <span>Pendente:</span>
                    <span className="font-semibold text-red-600">{formatCurrency(selectedCustomer.total - selectedCustomer.paid_amount)}</span>
                  </div>
                </div>
              </div>
            )}
            
            {paymentType === 'session' && selectedSession && (
              <div className="mb-4 p-3 bg-green-50 rounded">
                <div className="font-semibold">Pagamento da Mesa Completa</div>
                <div className="text-sm text-gray-600 mt-2">
                  <div className="flex justify-between">
                    <span>Total:</span>
                    <span className="font-semibold">{formatCurrency(selectedSession.total_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pago:</span>
                    <span className="font-semibold text-green-600">{formatCurrency(selectedSession.paid_amount)}</span>
                  </div>
                  <div className="flex justify-between border-t mt-1 pt-1">
                    <span>Pendente:</span>
                    <span className="font-semibold text-red-600">{formatCurrency(selectedSession.total_amount - selectedSession.paid_amount)}</span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  ℹ️ Os pontos de fidelidade serão distribuídos entre todos os clientes cadastrados
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Método de Pagamento
              </label>
              <SearchableSelect
                options={[
                  { value: 'cash', label: 'Dinheiro' },
                  { value: 'orange', label: 'Orange Money' },
                  { value: 'teletaku', label: 'TeleTaku' },
                  { value: 'mixed', label: 'Misto' },
                  { value: 'vale', label: 'Vale' },
                ]}
                value={paymentMethod}
                onChange={(value) => setPaymentMethod(value as any)}
                placeholder="Selecione o método"
                searchPlaceholder="Buscar método..."
                emptyText="Nenhum método encontrado"
              />
              
              {/* Validação de Vale para Conta Individual */}
              {paymentMethod === 'vale' && paymentType === 'customer' && (() => {
                if (!selectedCustomer?.customer_id) {
                  return (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                      <p className="text-xs text-red-600">
                        ❌ Vale só disponível para clientes cadastrados
                      </p>
                    </div>
                  );
                }
                
                const creditInfo = customersCreditInfo.get(selectedCustomer.customer_id);
                if (!creditInfo) {
                  return (
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-xs text-yellow-600">⚠️ Carregando informações de crédito...</p>
                    </div>
                  );
                }
                
                // Buscar vales pendentes desta mesa para este cliente (apenas para exibição)
                const customerPendingDebts = tablePendingDebts[selectedCustomer.customer_id] || 0;
                
                // Crédito disponível = limite - dívida total (currentDebt já inclui TODOS os vales)
                const availableCredit = creditInfo.creditLimit - creditInfo.currentDebt;
                const pendingAmount = selectedCustomer.total - selectedCustomer.paid_amount;
                
                if (pendingAmount > availableCredit) {
                  // Buscar todos os vales deste cliente
                  const customerDebts = allCustomerDebts.filter(d => d.customer_id === selectedCustomer.customer_id);
                  const currentTableNumber = selectedSession?.table_number;
                  const debtsFromCurrentTable = customerDebts.filter(d => d.table_number === currentTableNumber);
                  const debtsFromOtherTables = customerDebts.filter(d => d.table_number !== currentTableNumber);

                  return (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                      <p className="text-xs text-red-600 font-semibold mb-1">
                        ❌ Limite de crédito insuficiente
                      </p>
                      <div className="text-xs text-gray-600 space-y-0.5">
                        <div>Valor necessário: {formatCurrency(pendingAmount)}</div>
                        <div>Crédito disponível: {formatCurrency(availableCredit)}</div>
                        <div className="border-t pt-0.5 mt-0.5">
                          <div>Limite total: {formatCurrency(creditInfo.creditLimit)}</div>
                          <div>Dívida total (vales): {formatCurrency(creditInfo.currentDebt)}</div>
                          
                          {/* Mostrar vales pendentes com detalhes */}
                          {customerDebts.length > 0 && (
                            <div className="mt-1 pt-1 border-t">
                              <div className="font-semibold text-orange-700 mb-0.5">
                                Vales pendentes ({customerDebts.length}):
                              </div>
                              
                              {/* Vales desta mesa */}
                              {debtsFromCurrentTable.length > 0 && (
                                <div className="ml-2 space-y-0.5">
                                  {debtsFromCurrentTable.map(debt => {
                                    const debtDate = new Date(debt.created_at);
                                    const formattedDate = `${debtDate.getDate().toString().padStart(2, '0')}/${(debtDate.getMonth() + 1).toString().padStart(2, '0')}/${debtDate.getFullYear()} ${debtDate.getHours().toString().padStart(2, '0')}:${debtDate.getMinutes().toString().padStart(2, '0')}`;
                                    return (
                                      <div key={debt.debt_id} className="text-orange-600">
                                        • Mesa {debt.table_number}: {formatCurrency(debt.balance)} | {formattedDate}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              
                              {/* Vales de outras mesas */}
                              {debtsFromOtherTables.length > 0 && (
                                <div className="ml-2 space-y-0.5">
                                  {debtsFromOtherTables.map(debt => {
                                    const debtDate = new Date(debt.created_at);
                                    const formattedDate = `${debtDate.getDate().toString().padStart(2, '0')}/${(debtDate.getMonth() + 1).toString().padStart(2, '0')}/${debtDate.getFullYear()} ${debtDate.getHours().toString().padStart(2, '0')}:${debtDate.getMinutes().toString().padStart(2, '0')}`;
                                    return (
                                      <div key={debt.debt_id} className="text-red-600">
                                        • Mesa {debt.table_number || '?'}: {formatCurrency(debt.balance)} (outra mesa) | {formattedDate}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }
                
                // Buscar todos os vales deste cliente
                const customerDebts = allCustomerDebts.filter(d => d.customer_id === selectedCustomer.customer_id);
                const currentTableNumber = selectedSession?.table_number;
                const debtsFromCurrentTable = customerDebts.filter(d => d.table_number === currentTableNumber);
                const debtsFromOtherTables = customerDebts.filter(d => d.table_number !== currentTableNumber);

                return (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                    <p className="text-xs text-green-600 font-semibold mb-1">
                      ✅ Crédito disponível suficiente
                    </p>
                    <div className="text-xs text-gray-600 space-y-0.5">
                      <div>Valor a ser debitado: {formatCurrency(pendingAmount)}</div>
                      <div>Crédito disponível: {formatCurrency(availableCredit)}</div>
                      <div>Saldo após pagamento: {formatCurrency(availableCredit - pendingAmount)}</div>
                      
                      {/* Mostrar vales pendentes com detalhes */}
                      {customerDebts.length > 0 && (
                        <div className="text-xs mt-1 pt-1 border-t">
                          <div className="font-semibold text-orange-700 mb-0.5">
                            ⚠️ Vales pendentes ({customerDebts.length}):
                          </div>
                          
                          {/* Vales desta mesa */}
                          {debtsFromCurrentTable.length > 0 && (
                            <div className="ml-2 space-y-0.5">
                              {debtsFromCurrentTable.map(debt => {
                                const debtDate = new Date(debt.created_at);
                                const formattedDate = `${debtDate.getDate().toString().padStart(2, '0')}/${(debtDate.getMonth() + 1).toString().padStart(2, '0')}/${debtDate.getFullYear()} ${debtDate.getHours().toString().padStart(2, '0')}:${debtDate.getMinutes().toString().padStart(2, '0')}`;
                                return (
                                  <div key={debt.debt_id} className="text-orange-600">
                                    • Mesa {debt.table_number}: {formatCurrency(debt.balance)} | {formattedDate}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          
                          {/* Vales de outras mesas */}
                          {debtsFromOtherTables.length > 0 && (
                            <div className="ml-2 space-y-0.5">
                              {debtsFromOtherTables.map(debt => {
                                const debtDate = new Date(debt.created_at);
                                const formattedDate = `${debtDate.getDate().toString().padStart(2, '0')}/${(debtDate.getMonth() + 1).toString().padStart(2, '0')}/${debtDate.getFullYear()} ${debtDate.getHours().toString().padStart(2, '0')}:${debtDate.getMinutes().toString().padStart(2, '0')}`;
                                return (
                                  <div key={debt.debt_id} className="text-red-600">
                                    • Mesa {debt.table_number || '?'}: {formatCurrency(debt.balance)} (outra mesa) | {formattedDate}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
              
              {/* Validação de Vale para Conta Conjunta */}
              {paymentMethod === 'vale' && paymentType === 'session' && selectedSession && (() => {
                const registeredCustomers = selectedSession.customers.filter(c => c.customer_id);
                
                if (registeredCustomers.length === 0) {
                  return (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                      <p className="text-xs text-red-600">
                        ❌ Nenhum cliente cadastrado na mesa. Vale requer pelo menos um cliente cadastrado.
                      </p>
                    </div>
                  );
                }
                
                let totalAvailableCredit = 0;
                let totalTableDebts = 0;
                let hasLoadingInfo = false;
                const creditDetails: Array<{name: string, available: number, limit: number, debt: number, tableDebts: number}> = [];
                
                for (const customer of registeredCustomers) {
                  const creditInfo = customersCreditInfo.get(customer.customer_id!);
                  if (!creditInfo) {
                    hasLoadingInfo = true;
                    continue;
                  }
                  
                  const customerTableDebts = tablePendingDebts[customer.customer_id!] || 0;
                  // currentDebt já inclui TODOS os vales (desta e de outras mesas)
                  const available = creditInfo.creditLimit - creditInfo.currentDebt;
                  
                  totalAvailableCredit += available;
                  totalTableDebts += customerTableDebts;
                  
                  creditDetails.push({
                    name: customer.customer_name,
                    available,
                    limit: creditInfo.creditLimit,
                    debt: creditInfo.currentDebt,
                    tableDebts: customerTableDebts
                  });
                }
                
                if (hasLoadingInfo) {
                  return (
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-xs text-yellow-600">⚠️ Carregando informações de crédito...</p>
                    </div>
                  );
                }
                
                const pendingAmount = selectedSession.total_amount - selectedSession.paid_amount;
                
                if (pendingAmount > totalAvailableCredit) {
                  return (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                      <p className="text-xs text-red-600 font-semibold mb-1">
                        ❌ Limite de crédito conjunto insuficiente
                      </p>
                      <div className="text-xs text-gray-600 space-y-1">
                        <div>Valor necessário: {formatCurrency(pendingAmount)}</div>
                        <div>Crédito disponível (soma): {formatCurrency(totalAvailableCredit)}</div>
                        {totalTableDebts > 0 && (
                          <div className="text-orange-600">Vales pendentes desta mesa (total): {formatCurrency(totalTableDebts)}</div>
                        )}
                        <div className="border-t pt-1 mt-1">
                          <div className="font-semibold mb-0.5">Clientes cadastrados:</div>
                          {creditDetails.map((detail, idx) => (
                            <div key={idx} className="ml-2">
                              • {detail.name}: {formatCurrency(detail.available)} disponível
                              {detail.tableDebts > 0 && (
                                <span className="text-orange-600"> (vales desta mesa: {formatCurrency(detail.tableDebts)})</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                }
                
                return (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                    <p className="text-xs text-green-600 font-semibold mb-1">
                      ✅ Crédito conjunto disponível suficiente
                    </p>
                    <div className="text-xs text-gray-600 space-y-1">
                      <div>Valor a ser debitado: {formatCurrency(pendingAmount)}</div>
                      <div>Crédito disponível (soma): {formatCurrency(totalAvailableCredit)}</div>
                      <div>Saldo após pagamento: {formatCurrency(totalAvailableCredit - pendingAmount)}</div>
                      {totalTableDebts > 0 && (
                        <div className="text-orange-600">
                          ℹ️ Vales pendentes desta mesa já considerados: {formatCurrency(totalTableDebts)}
                        </div>
                      )}
                      <div className="border-t pt-1 mt-1">
                        <div className="font-semibold mb-0.5">Distribuição entre {creditDetails.length} cliente(s):</div>
                        {creditDetails.map((detail, idx) => (
                          <div key={idx} className="ml-2">
                            • {detail.name}: {formatCurrency(detail.available)} disponível
                            {detail.tableDebts > 0 && (
                              <span className="text-xs text-orange-600"> (vales: {formatCurrency(detail.tableDebts)})</span>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="border-t pt-1 mt-1 text-blue-600">
                        ℹ️ A dívida será distribuída proporcionalmente aos limites de crédito
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valor (FCFA)
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setPaymentAmount(0);
                  setShowPaymentModal(false);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleProcessPayment}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                disabled={paymentAmount <= 0}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Criar Nova Mesa */}
      {showCreateTableModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Criar Nova Mesa</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número da Mesa *
                </label>
                <input
                  type="text"
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(e.target.value)}
                  placeholder="Ex: 01, 02, A1, VIP1..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número de Lugares
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={newTableSeats}
                  onChange={(e) => setNewTableSeats(parseInt(e.target.value) || 4)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Área (opcional)
                </label>
                <input
                  type="text"
                  value={newTableArea}
                  onChange={(e) => setNewTableArea(e.target.value)}
                  placeholder="Ex: Terraço, Interior, VIP..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setNewTableNumber('');
                  setNewTableSeats(4);
                  setNewTableArea('');
                  setShowCreateTableModal(false);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateTable}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                disabled={!newTableNumber.trim()}
              >
                Criar Mesa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Transferir Item entre Clientes */}
      {showTransferItemModal && transferOrder && selectedSession && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Transferir Item</h3>
            
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <div className="font-medium">{transferOrder.product_name}</div>
              <div className="text-sm text-gray-600">
                {transferOrder.qty_units}x {formatCurrency(transferOrder.unit_price)} = {formatCurrency(transferOrder.total)}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                De: <strong>{selectedCustomer.customer_name}</strong>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transferir para:
                </label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'Selecione o cliente...' },
                    ...selectedSession.customers
                      .filter(c => c.id !== selectedCustomer.id)
                      .map(c => ({
                        value: c.id,
                        label: c.customer_name,
                      })),
                  ]}
                  value={transferToCustomerId}
                  onChange={(value) => setTransferToCustomerId(value)}
                  placeholder="Selecione o cliente..."
                  searchPlaceholder="Buscar cliente..."
                  emptyText="Nenhum outro cliente encontrado"
                />
              </div>

              {transferOrder.qty_units > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantidade a transferir:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="1"
                      max={transferOrder.qty_units}
                      value={transferQty}
                      onChange={(e) => setTransferQty(parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <span className="font-semibold w-12 text-center">{transferQty}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {transferQty < transferOrder.qty_units 
                      ? `Dividir: ${transferQty} para destino, ${transferOrder.qty_units - transferQty} permanece`
                      : 'Transferir tudo'}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowTransferItemModal(false);
                  setTransferOrder(null);
                  setTransferToCustomerId('');
                  setTransferQty(0);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleTransferItem}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                disabled={!transferToCustomerId}
              >
                Transferir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Transferir Mesa */}
      {showTransferTableModal && selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Transferir Mesa {selectedSession.table_number}</h3>
            
            <p className="text-gray-600 mb-4">
              Todos os pedidos e clientes serão transferidos para a nova mesa.
              <strong className="text-orange-600"> O estoque NÃO será alterado.</strong>
            </p>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {tables
                .filter(t => t.status === 'available' && t.id !== selectedSession.table_id)
                .map(table => (
                  <button
                    key={table.id}
                    onClick={() => handleTransferTable(table.id)}
                    className="w-full p-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 flex justify-between items-center"
                  >
                    <div>
                      <span className="font-semibold">Mesa {table.number}</span>
                      {table.area && <span className="text-sm text-gray-500 ml-2">({table.area})</span>}
                    </div>
                    <div className="text-sm text-gray-500">{table.seats} lugares</div>
                  </button>
                ))}
              
              {tables.filter(t => t.status === 'available' && t.id !== selectedSession.table_id).length === 0 && (
                <div className="text-center text-gray-500 py-4">
                  Nenhuma mesa disponível para transferência
                </div>
              )}
            </div>

            <button
              onClick={() => setShowTransferTableModal(false)}
              className="w-full mt-4 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal: Histórico da Sessão */}
      {showHistoryModal && selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[80vh] flex flex-col">
            <h3 className="text-xl font-bold mb-4">Histórico - Mesa {selectedSession.table_number}</h3>
            
            <div className="flex-1 overflow-y-auto space-y-2">
              {sessionHistory.length > 0 ? (
                sessionHistory.map((action, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg text-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          action.action_type === 'open_table' ? 'bg-green-100 text-green-700' :
                          action.action_type === 'add_order' ? 'bg-blue-100 text-blue-700' :
                          action.action_type === 'cancel_order' ? 'bg-red-100 text-red-700' :
                          action.action_type === 'transfer_item' ? 'bg-purple-100 text-purple-700' :
                          action.action_type === 'payment' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {action.action_type === 'open_table' ? 'Abertura' :
                           action.action_type === 'add_customer' ? 'Novo Cliente' :
                           action.action_type === 'add_order' ? 'Pedido' :
                           action.action_type === 'cancel_order' ? 'Cancelado' :
                           action.action_type === 'transfer_item' ? 'Transferência' :
                           action.action_type === 'payment' ? 'Pagamento' :
                           action.action_type}
                        </span>
                        <p className="mt-1 text-gray-700">{action.description}</p>
                      </div>
                      <div className="text-xs text-gray-500 text-right">
                        <div>{formatDateTime(action.performed_at)}</div>
                        <div>{action.performed_by}</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-8">
                  Nenhum histórico disponível
                </div>
              )}
            </div>

            <button
              onClick={() => setShowHistoryModal(false)}
              className="w-full mt-4 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Modal: Transferir Clientes Específicos */}
      {showTransferCustomersModal && selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] flex flex-col">
            <h3 className="text-xl font-bold mb-4">Transferir Clientes da Mesa {selectedSession.table_number}</h3>
            
            <p className="text-gray-600 mb-4">
              Selecione os clientes que deseja transferir para outra mesa:
            </p>

            {/* Lista de clientes com checkboxes */}
            <div className="space-y-2 mb-4 overflow-y-auto max-h-48">
              {selectedSession.customers.map((customer) => (
                <label
                  key={customer.id}
                  className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedCustomersToTransfer.includes(customer.id)}
                    onChange={() => toggleCustomerSelection(customer.id)}
                    className="w-5 h-5"
                  />
                  <div className="flex-1">
                    <div className="font-semibold">{customer.customer_name}</div>
                    <div className="text-sm text-gray-600">
                      {customer.orders.length} pedido(s) • Total: {formatCurrency(customer.total)}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {selectedCustomersToTransfer.length > 0 && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-blue-800">
                    <strong>{selectedCustomersToTransfer.length} cliente(s) selecionado(s)</strong>
                  </p>
                </div>

                <p className="text-sm text-gray-600 mb-2 font-semibold">
                  Selecione a mesa de destino:
                </p>

                <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                  {tables
                    .filter(t => t.id !== selectedSession.table_id)
                    .map(table => (
                      <button
                        key={table.id}
                        onClick={() => handleTransferCustomers(table.id)}
                        className={`w-full p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-300 flex justify-between items-center ${
                          table.status === 'available' ? 'border-gray-200' : 'border-orange-200 bg-orange-50'
                        }`}
                      >
                        <div>
                          <span className="font-semibold">Mesa {table.number}</span>
                          {table.area && <span className="text-sm text-gray-500 ml-2">({table.area})</span>}
                          {table.status !== 'available' && (
                            <span className="ml-2 text-xs bg-orange-200 text-orange-700 px-2 py-0.5 rounded">
                              Ocupada - Unirá clientes
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">{table.seats} lugares</div>
                      </button>
                    ))}
                  
                  {tables.filter(t => t.id !== selectedSession.table_id).length === 0 && (
                    <div className="text-center text-gray-500 py-4">
                      Nenhuma mesa disponível para transferência
                    </div>
                  )}
                </div>
              </>
            )}

            {selectedCustomersToTransfer.length === 0 && (
              <div className="text-center text-gray-500 py-4 bg-gray-50 rounded-lg">
                Selecione pelo menos um cliente para transferir
              </div>
            )}

            <button
              onClick={() => {
                setShowTransferCustomersModal(false);
                setSelectedCustomersToTransfer([]);
              }}
              className="w-full mt-4 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal: Unir Mesas */}
      {showMergeTablesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] flex flex-col">
            <h3 className="text-xl font-bold mb-4">Unir Mesas</h3>
            
            <p className="text-gray-600 mb-4">
              Selecione as mesas que deseja unir (mínimo 2) e depois escolha a mesa de destino:
            </p>

            {/* Grid de mesas com checkboxes */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4 overflow-y-auto max-h-64">
              {tables
                .filter(t => t.status !== 'available' && t.sessionId)
                .map((table) => (
                  <label
                    key={table.id}
                    className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedTablesForMerge.includes(table.id)
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTablesForMerge.includes(table.id)}
                      onChange={() => toggleTableSelection(table.id)}
                      className="absolute top-2 right-2 w-5 h-5"
                    />
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-800 mb-1">
                        {table.number}
                      </div>
                      {table.area && (
                        <div className="text-xs text-gray-500 mb-2">{table.area}</div>
                      )}
                      <div className="text-xs text-gray-600">
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <Users className="w-3 h-3" />
                          {table.customerCount}
                          <ShoppingCart className="w-3 h-3 ml-2" />
                          {table.orderCount}
                        </div>
                        <div className="font-semibold text-blue-600">
                          {formatCurrency(table.totalAmount)}
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              
              {tables.filter(t => t.status !== 'available' && t.sessionId).length === 0 && (
                <div className="col-span-full text-center text-gray-500 py-8">
                  Nenhuma mesa ocupada disponível para unir
                </div>
              )}
            </div>

            {selectedTablesForMerge.length >= 2 && (
              <>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-purple-800 mb-2">
                    <strong>{selectedTablesForMerge.length} mesas selecionadas</strong>
                  </p>
                  <div className="text-xs text-purple-700">
                    {selectedTablesForMerge.map(tableId => {
                      const table = tables.find(t => t.id === tableId);
                      return table ? `Mesa ${table.number}` : '';
                    }).join(', ')}
                  </div>
                </div>

                <p className="text-sm text-gray-600 mb-2 font-semibold">
                  Escolha a mesa onde todos serão reunidos:
                </p>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-64 overflow-y-auto mb-4">
                  {/* Opção: Usar uma das mesas selecionadas */}
                  {selectedTablesForMerge.map(tableId => {
                    const table = tables.find(t => t.id === tableId);
                    if (!table) return null;
                    return (
                      <button
                        key={table.id}
                        onClick={() => handleMergeTables(table.id)}
                        className="p-4 border-2 border-purple-300 bg-purple-50 rounded-lg hover:bg-purple-100 transition-all"
                      >
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-700 mb-1">
                            {table.number}
                          </div>
                          <div className="text-xs text-purple-600">
                            Mesa existente
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  {/* Opção: Usar mesa livre */}
                  {tables
                    .filter(t => t.status === 'available' && !selectedTablesForMerge.includes(t.id))
                    .map(table => (
                      <button
                        key={table.id}
                        onClick={() => handleMergeTables(table.id)}
                        className="p-4 border-2 border-green-300 bg-green-50 rounded-lg hover:bg-green-100 transition-all"
                      >
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-700 mb-1">
                            {table.number}
                          </div>
                          <div className="text-xs text-green-600">
                            Mesa livre
                          </div>
                        </div>
                      </button>
                    ))}
                </div>
              </>
            )}

            {selectedTablesForMerge.length < 2 && (
              <div className="text-center text-gray-500 py-4 bg-gray-50 rounded-lg">
                Selecione pelo menos 2 mesas para unir
              </div>
            )}

            <button
              onClick={() => {
                setShowMergeTablesModal(false);
                setSelectedTablesForMerge([]);
              }}
              className="w-full mt-4 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal: Separar Mesa */}
      {showSplitTableModal && selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">
              Separar Mesa {tables.find(t => t.id === selectedSession.table_id)?.number}
            </h3>
            
            <p className="text-sm text-gray-600 mb-4">
              Distribua os {selectedSession.customers?.length || 0} clientes em diferentes mesas.
            </p>

            {/* Lista de Clientes para Distribuir */}
            <div className="space-y-3 mb-6">
              {selectedSession.customers?.map((customer, index) => (
                <div
                  key={customer.id}
                  className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold">
                        {customer.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold">{customer.name}</p>
                        <p className="text-xs text-gray-500">
                          {customer.order_count} pedidos • {formatCurrency(customer.total)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Seleção de Mesa de Destino */}
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">
                      Enviar para mesa:
                    </label>
                    <SearchableSelect
                      options={[
                        { value: '', label: 'Selecione uma mesa...' },
                        ...tables
                          .filter(t => 
                            t.status === 'available' || 
                            (t.status !== 'available' && t.id !== selectedSession.table_id)
                          )
                          .map(table => ({
                            value: table.id,
                            label: `Mesa ${table.number}`,
                            subtitle: `${table.area ? `${table.area} - ` : ''}${table.status === 'available' ? 'Livre' : 'Ocupada'}`,
                          })),
                      ]}
                      value={
                        splitDistributions.find(d => 
                          d.customerIds.includes(customer.id)
                        )?.tableId || ''
                      }
                      onChange={(value) => {
                        const tableId = value;
                        if (!tableId) return;

                        // Remover cliente de outras distribuições
                        const filtered = splitDistributions.filter(
                          d => !d.customerIds.includes(customer.id)
                        );

                        // Adicionar cliente à mesa selecionada
                        const existingDist = filtered.find(d => d.tableId === tableId);
                        if (existingDist) {
                          setSplitDistributions([
                            ...filtered.filter(d => d.tableId !== tableId),
                            {
                              tableId,
                              customerIds: [...existingDist.customerIds, customer.id]
                            }
                          ]);
                        } else {
                          setSplitDistributions([
                            ...filtered,
                            { tableId, customerIds: [customer.id] }
                          ]);
                        }
                      }}
                      placeholder="Selecione uma mesa..."
                      searchPlaceholder="Buscar mesa..."
                      emptyText="Nenhuma mesa disponível"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Resumo da Distribuição */}
            {splitDistributions.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                <p className="font-semibold text-orange-800 mb-2">Resumo da Separação:</p>
                {splitDistributions.map((dist, index) => {
                  const table = tables.find(t => t.id === dist.tableId);
                  const customers = selectedSession.customers?.filter(c => 
                    dist.customerIds.includes(c.id)
                  );
                  const total = customers?.reduce((sum, c) => sum + c.total, 0) || 0;
                  
                  return (
                    <div key={index} className="text-sm text-orange-700 mb-1">
                      <strong>Mesa {table?.number}:</strong> {customers?.length || 0} cliente(s) • {formatCurrency(total)}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Botões de Ação */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSplitTableModal(false);
                  setSplitDistributions([]);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSplitTable}
                disabled={
                  splitDistributions.length === 0 ||
                  splitDistributions.reduce((sum, d) => sum + d.customerIds.length, 0) !== 
                    (selectedSession.customers?.length || 0)
                }
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Confirmar Separação
              </button>
            </div>

            {splitDistributions.reduce((sum, d) => sum + d.customerIds.length, 0) !== 
              (selectedSession.customers?.length || 0) && (
              <p className="text-xs text-red-600 mt-2 text-center">
                Todos os clientes devem ser distribuídos antes de confirmar
              </p>
            )}
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
