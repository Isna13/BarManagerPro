import { Outlet, Link } from 'react-router-dom';
import { Home, ShoppingCart, Package, Users, FileText, Settings, LogOut } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export default function DashboardLayout() {
  const { user, logout } = useAuthStore();

  const menuItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/pos', icon: ShoppingCart, label: 'PDV' },
    { path: '/sales', icon: FileText, label: 'Vendas' },
    { path: '/inventory', icon: Package, label: 'Inventário' },
    { path: '/customers', icon: Users, label: 'Clientes' },
    { path: '/reports', icon: FileText, label: 'Relatórios' },
    { path: '/settings', icon: Settings, label: 'Configurações' },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-xl font-bold">BarManager Pro</h1>
          <p className="text-sm text-gray-400">{user?.fullName}</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-800 transition"
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <button
            onClick={logout}
            className="flex items-center space-x-3 px-4 py-3 w-full rounded-lg hover:bg-gray-800 transition"
          >
            <LogOut size={20} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
