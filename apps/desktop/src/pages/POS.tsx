import { useState, useEffect } from 'react';
import { Search, Plus, Minus, Trash2, DollarSign, CreditCard, Banknote } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sellingPrice: number;
  sellingPriceBox: number;
  unitsPerBox: number;
  category: string;
}

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  isMuntu: boolean;
}

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'cash' | 'card' | 'mobile'>('cash');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      // @ts-ignore - Electron API
      const result = await window.api.db.query('SELECT * FROM Product WHERE isActive = 1 LIMIT 50');
      setProducts(result);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    }
  };

  const addToCart = (product: Product, isMuntu: boolean = false) => {
    const existingItem = cart.find(
      item => item.productId === product.id && item.isMuntu === isMuntu
    );

    if (existingItem) {
      updateQuantity(existingItem.productId, existingItem.quantity + 1, isMuntu);
    } else {
      const unitPrice = isMuntu ? product.sellingPriceBox / product.unitsPerBox : product.sellingPrice;
      const newItem: CartItem = {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice,
        subtotal: unitPrice,
        isMuntu,
      };
      setCart([...cart, newItem]);
    }
  };

  const updateQuantity = (productId: string, newQuantity: number, isMuntu: boolean) => {
    if (newQuantity <= 0) {
      removeFromCart(productId, isMuntu);
      return;
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
        const regularPrice = product.sellingPrice * item.quantity;
        return sum + (regularPrice - item.subtotal);
      }, 0);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert('Carrinho vazio!');
      return;
    }

    try {
      const saleData = {
        items: cart.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
        })),
        paymentMethod: selectedPaymentMethod,
      };

      // @ts-ignore
      const result = await window.api.sales.create(saleData);
      
      if (result.success) {
        alert('Venda finalizada com sucesso!');
        setCart([]);
      } else {
        alert('Erro ao finalizar venda: ' + result.error);
      }
    } catch (error) {
      console.error('Erro ao finalizar venda:', error);
      alert('Erro ao finalizar venda');
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Produtos */}
      <div className="flex-1 p-6 overflow-y-auto">
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
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="bg-white p-4 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
            >
              <h3 className="font-semibold mb-2 truncate">{product.name}</h3>
              <p className="text-sm text-gray-500 mb-3">{product.category}</p>
              
              <div className="space-y-2">
                <button
                  onClick={() => addToCart(product, false)}
                  className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors"
                >
                  Unitário: {product.sellingPrice.toFixed(2)} Kz
                </button>
                
                <button
                  onClick={() => addToCart(product, true)}
                  className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <span>Muntu: {(product.sellingPriceBox / product.unitsPerBox).toFixed(2)} Kz</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Carrinho */}
      <div className="w-96 bg-white shadow-lg p-6 flex flex-col">
        <h2 className="text-2xl font-bold mb-6">Carrinho</h2>

        <div className="flex-1 overflow-y-auto mb-6 space-y-3">
          {cart.map((item, index) => (
            <div key={`${item.productId}-${item.isMuntu}-${index}`} className="bg-gray-50 p-3 rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <h4 className="font-semibold">{item.productName}</h4>
                  <p className="text-sm text-gray-500">
                    {item.isMuntu && <span className="text-green-600 font-medium">Muntu • </span>}
                    {item.unitPrice.toFixed(2)} Kz
                  </p>
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
                    onClick={() => updateQuantity(item.productId, item.quantity - 1, item.isMuntu)}
                    className="bg-gray-200 hover:bg-gray-300 p-1 rounded"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-12 text-center font-semibold">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.productId, item.quantity + 1, item.isMuntu)}
                    className="bg-gray-200 hover:bg-gray-300 p-1 rounded"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <span className="font-bold">{item.subtotal.toFixed(2)} Kz</span>
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
              💰 Economia Muntu: <span className="font-bold">{calculateSavings().toFixed(2)} Kz</span>
            </p>
          </div>
        )}

        {/* Método de Pagamento */}
        <div className="mb-4">
          <p className="text-sm font-semibold mb-2">Método de Pagamento:</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setSelectedPaymentMethod('cash')}
              className={`p-3 rounded border-2 flex flex-col items-center gap-1 transition-colors ${
                selectedPaymentMethod === 'cash'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Banknote size={24} />
              <span className="text-xs">Dinheiro</span>
            </button>
            <button
              onClick={() => setSelectedPaymentMethod('card')}
              className={`p-3 rounded border-2 flex flex-col items-center gap-1 transition-colors ${
                selectedPaymentMethod === 'card'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <CreditCard size={24} />
              <span className="text-xs">Cartão</span>
            </button>
            <button
              onClick={() => setSelectedPaymentMethod('mobile')}
              className={`p-3 rounded border-2 flex flex-col items-center gap-1 transition-colors ${
                selectedPaymentMethod === 'mobile'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <DollarSign size={24} />
              <span className="text-xs">Mobile</span>
            </button>
          </div>
        </div>

        {/* Total */}
        <div className="border-t pt-4 mb-4">
          <div className="flex justify-between items-center text-2xl font-bold">
            <span>Total:</span>
            <span>{calculateTotal().toFixed(2)} Kz</span>
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
    </div>
  );
}
