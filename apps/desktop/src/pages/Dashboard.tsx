import { useEffect, useState } from 'react';
import { TrendingUp, Package, Users, DollarSign, AlertTriangle, Lock, Wallet } from 'lucide-react';

export default function Dashboard() {
  const [currentCashBox, setCurrentCashBox] = useState<any>(null);
  const [checkingCashBox, setCheckingCashBox] = useState(true);
  const [stats, setStats] = useState({
    todaySales: 0,
    todayRevenue: 0,
    lowStockCount: 0,
    activeCustomers: 0,
  });

  useEffect(() => {
    checkCashBoxStatus();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(checkCashBoxStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkCashBoxStatus = async () => {
    try {
      setCheckingCashBox(true);
      // @ts-ignore
      const cashBox = await window.electronAPI?.cashBox?.getCurrent?.();
      setCurrentCashBox(cashBox || null);
      
      // Se houver caixa aberta, carregar dados
      if (cashBox) {
        await loadDashboardData(cashBox);
      } else {
        // Caixa fechada: zerar dashboard
        setStats({
          todaySales: 0,
          todayRevenue: 0,
          lowStockCount: 0,
          activeCustomers: 0,
        });
      }
    } catch (error) {
      console.error('Erro ao verificar status da caixa:', error);
      setCurrentCashBox(null);
      setStats({
        todaySales: 0,
        todayRevenue: 0,
        lowStockCount: 0,
        activeCustomers: 0,
      });
    } finally {
      setCheckingCashBox(false);
    }
  };

  const loadDashboardData = async (cashBox: any) => {
    try {
      // @ts-ignore
      const inventory = await window.electronAPI?.inventory?.list?.() || [];
      const lowStock = inventory.filter((item: any) => item.qty_units <= 10);
      
      // PRIORIDADE: Usar valores sincronizados do caixa (consistente com aba Caixa)
      // Esses valores vêm do servidor e são calculados corretamente a partir da tabela payments
      if (cashBox && (cashBox.total_sales > 0 || cashBox.total_cash > 0)) {
        console.log('📊 Dashboard: Usando valores sincronizados do caixa');
        console.log('   total_sales:', cashBox.total_sales, '→', (cashBox.total_sales / 100).toFixed(2), 'FCFA');
        
        // Buscar quantidade de vendas para exibição
        // @ts-ignore
        const allSales = await window.electronAPI?.sales?.list?.({}) || [];
        const cashBoxOpenedAt = new Date(cashBox.opened_at);
        const cashBoxClosedAt = cashBox.closed_at ? new Date(cashBox.closed_at) : null;
        
        const currentSales = allSales.filter((sale: any) => {
          const saleDate = new Date(sale.created_at);
          if (saleDate < cashBoxOpenedAt) return false;
          if (cashBoxClosedAt && saleDate > cashBoxClosedAt) return false;
          return true;
        });
        
        // Contar clientes únicos
        const uniqueCustomerIds = new Set(
          currentSales
            .filter((sale: any) => sale.customer_id)
            .map((sale: any) => sale.customer_id)
        );
        
        setStats({
          todaySales: currentSales.length,
          todayRevenue: cashBox.total_sales, // Valor sincronizado do servidor (em centavos)
          lowStockCount: lowStock.length,
          activeCustomers: uniqueCustomerIds.size,
        });
        return;
      }
      
      // FALLBACK: Calcular localmente (modo offline ou caixa sem valores sincronizados)
      console.log('📊 Dashboard: Calculando valores localmente (fallback)');
      
      // @ts-ignore
      const allSales = await window.electronAPI?.sales?.list?.({}) || [];
      
      // Filtrar vendas pela caixa atual
      const cashBoxOpenedAt = new Date(cashBox.opened_at);
      const cashBoxClosedAt = cashBox.closed_at ? new Date(cashBox.closed_at) : null;
      
      const currentSales = allSales.filter((sale: any) => {
        const saleDate = new Date(sale.created_at);
        if (saleDate < cashBoxOpenedAt) return false;
        if (cashBoxClosedAt && saleDate > cashBoxClosedAt) return false;
        return true;
      });

      const todayRevenue = currentSales.reduce((sum: number, sale: any) => sum + (sale.total || 0), 0);

      const uniqueCustomerIds = new Set(
        currentSales
          .filter((sale: any) => sale.customer_id)
          .map((sale: any) => sale.customer_id)
      );

      setStats({
        todaySales: currentSales.length,
        todayRevenue: todayRevenue,
        lowStockCount: lowStock.length,
        activeCustomers: uniqueCustomerIds.size,
      });
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
      setStats({
        todaySales: 0,
        todayRevenue: 0,
        lowStockCount: 0,
        activeCustomers: 0,
      });
    }
  };

  const StatCard = ({ icon: Icon, title, value, color }: any) => (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm">{title}</p>
          <p className="text-2xl font-bold mt-2">{value}</p>
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon size={24} className="text-white" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        
        {/* Indicador de Status da Caixa */}
        {checkingCashBox ? (
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent"></div>
            <span className="text-sm text-gray-600">Verificando caixa...</span>
          </div>
        ) : currentCashBox ? (
          <div className="flex items-center gap-2 px-4 py-2 bg-green-100 rounded-lg">
            <Wallet className="text-green-600" size={20} />
            <div>
              <p className="text-sm font-semibold text-green-800">Caixa Aberta</p>
              <p className="text-xs text-green-600">
                {currentCashBox.opened_at && !isNaN(new Date(currentCashBox.opened_at).getTime()) 
                  ? new Date(currentCashBox.opened_at).toLocaleString('pt-BR')
                  : '--/--/---- --:--'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-100 rounded-lg">
            <Lock className="text-red-600" size={20} />
            <span className="text-sm font-semibold text-red-800">Caixa Fechada</span>
          </div>
        )}
      </div>

      {/* Alerta de Caixa Fechado */}
      {!checkingCashBox && !currentCashBox && (
        <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-6 rounded-lg mb-6 shadow-lg">
          <div className="flex items-center gap-4">
            <Lock size={32} />
            <div className="flex-1">
              <p className="font-bold text-xl">⚠️ CAIXA FECHADO</p>
              <p className="text-sm mt-1">Abra o caixa para visualizar dados em tempo real e realizar vendas</p>
            </div>
            <a
              href="/cashbox"
              className="px-6 py-3 bg-white text-red-600 rounded-lg font-bold hover:bg-red-50 transition-colors shadow-md"
            >
              Abrir Caixa
            </a>
          </div>
        </div>
      )}

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={TrendingUp}
          title="Vendas (Caixa Atual)"
          value={currentCashBox ? stats.todaySales : '—'}
          color="bg-blue-500"
        />
        <StatCard
          icon={DollarSign}
          title="Receita (Caixa Atual)"
          value={currentCashBox ? `${(stats.todayRevenue / 100).toFixed(0)} FCFA` : '—'}
          color="bg-green-500"
        />
        <StatCard
          icon={Package}
          title="Estoque Baixo"
          value={stats.lowStockCount}
          color="bg-orange-500"
        />
        <StatCard
          icon={Users}
          title="Clientes Ativos"
          value={stats.activeCustomers}
          color="bg-purple-500"
        />
      </div>

      {/* Alertas */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-bold mb-4">Alertas</h2>
        
        {!currentCashBox && !checkingCashBox && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded p-4 mb-3">
            <Lock className="text-red-600" size={24} />
            <div>
              <p className="font-semibold text-red-900">Caixa Fechado</p>
              <p className="text-sm text-red-700">Nenhuma venda pode ser realizada no momento</p>
            </div>
          </div>
        )}
        
        {stats.lowStockCount > 0 && (
          <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded p-4">
            <AlertTriangle className="text-orange-600" size={24} />
            <div>
              <p className="font-semibold text-orange-900">Estoque Baixo</p>
              <p className="text-sm text-orange-700">{stats.lowStockCount} produtos precisam de reabastecimento</p>
            </div>
          </div>
        )}
        
        {currentCashBox && stats.lowStockCount === 0 && (
          <p className="text-gray-500 text-center py-2">Nenhum alerta no momento</p>
        )}
      </div>

      {/* Visão Rápida */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Visão Rápida</h2>
        
        {currentCashBox ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded">
              <span className="text-sm text-gray-700">Status do Sistema</span>
              <span className="text-sm font-semibold text-green-700">Operacional</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded">
              <span className="text-sm text-gray-700">Caixa Atual</span>
              <span className="text-sm font-semibold text-blue-700">
                {currentCashBox.opened_at && !isNaN(new Date(currentCashBox.opened_at).getTime())
                  ? `Aberto há ${Math.floor((Date.now() - new Date(currentCashBox.opened_at).getTime()) / 60000)} minutos`
                  : 'Aberto'}
              </span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded">
              <span className="text-sm text-gray-700">Operador</span>
              <span className="text-sm font-semibold text-purple-700">{currentCashBox.opened_by}</span>
            </div>
            
            <p className="text-sm text-gray-500 mt-4 pt-4 border-t">
              <strong>Nota:</strong> Os dados exibidos correspondem exclusivamente à caixa em curso. 
              Ao fechar a caixa, o dashboard será zerado automaticamente.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-gray-600">Sistema BarManager Pro funcionando corretamente.</p>
            <p className="text-sm text-orange-600 font-semibold">
              ⚠️ Caixa fechado - Dashboard zerado
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Abra uma nova caixa para começar a visualizar dados em tempo real.
            </p>
          </div>
        )}
        
        <p className="text-sm text-gray-400 mt-4">Última atualização: Agora</p>
      </div>
    </div>
  );
}
