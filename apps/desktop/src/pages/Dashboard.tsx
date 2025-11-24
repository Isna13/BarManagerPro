import { useEffect, useState } from 'react';
import { TrendingUp, Package, Users, DollarSign, AlertTriangle } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({
    todaySales: 0,
    todayRevenue: 0,
    lowStockCount: 0,
    activeCustomers: 0,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // @ts-ignore
      const today = new Date().toISOString().split('T')[0];
      
      // @ts-ignore
      const sales = await window.api.db.query(`
        SELECT COUNT(*) as count, SUM(totalAmount) as revenue 
        FROM Sale 
        WHERE DATE(createdAt) = '${today}'
      `);

      // @ts-ignore
      const lowStock = await window.api.db.query(`
        SELECT COUNT(*) as count 
        FROM Inventory 
        WHERE quantity <= lowStockThreshold
      `);

      setStats({
        todaySales: sales[0]?.count || 0,
        todayRevenue: sales[0]?.revenue || 0,
        lowStockCount: lowStock[0]?.count || 0,
        activeCustomers: 0,
      });
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
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
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={TrendingUp}
          title="Vendas Hoje"
          value={stats.todaySales}
          color="bg-blue-500"
        />
        <StatCard
          icon={DollarSign}
          title="Receita Hoje"
          value={`${stats.todayRevenue.toFixed(2)} Kz`}
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

      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-bold mb-4">Alertas</h2>
        {stats.lowStockCount > 0 && (
          <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded p-4">
            <AlertTriangle className="text-orange-600" />
            <div>
              <p className="font-semibold text-orange-900">Estoque Baixo</p>
              <p className="text-sm text-orange-700">{stats.lowStockCount} produtos precisam de reabastecimento</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Visão Rápida</h2>
        <p className="text-gray-600">Sistema BarManager Pro funcionando corretamente.</p>
        <p className="text-sm text-gray-500 mt-2">Última sincronização: Agora</p>
      </div>
    </div>
  );
}
