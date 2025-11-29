import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, ShoppingCart, Package, Users, FileText, Settings, LogOut, Tag, Truck, ShoppingBag, Wallet, History, Receipt, Table, Shield } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import OnlineStatusIndicator from '../common/OnlineStatusIndicator';

export default function DashboardLayout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();

  // Agrupamento de menus por seção
  const menuSections = [
    {
      title: 'Operações',
      items: [
        { path: '/', icon: Home, label: 'Dashboard' },
        { path: '/pos', icon: ShoppingCart, label: 'PDV' },
        { path: '/tables', icon: Table, label: 'Mesas' },
        { path: '/sales', icon: FileText, label: 'Vendas' },
      ]
    },
    {
      title: 'Gestão',
      items: [
        { path: '/products', icon: Tag, label: 'Produtos' },
        { path: '/suppliers', icon: Truck, label: 'Fornecedores' },
        { path: '/purchases', icon: ShoppingBag, label: 'Compras' },
        { path: '/inventory', icon: Package, label: 'Estoque' },
        { path: '/customers', icon: Users, label: 'Clientes' },
        { path: '/debts', icon: Receipt, label: 'Dívidas (Vales)' },
        { path: '/cashbox', icon: Wallet, label: 'Caixa' },
        { path: '/cashbox-history', icon: History, label: 'Histórico de Caixas' },
      ]
    },
    {
      title: 'Administração',
      items: [
        { path: '/reports', icon: FileText, label: 'Relatórios' },
        { path: '/users', icon: Shield, label: 'Usuários' },
      ]
    }
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar com melhorias modernas */}
      <aside className="sidebar-modern">
        {/* Header fixo */}
        <div className="sidebar-header">
          <h1 className="sidebar-title">BarManager Pro</h1>
          <p className="sidebar-user">{user?.fullName}</p>
          
          {/* Indicador de Status Online/Offline */}
          <div className="mt-3">
            <OnlineStatusIndicator />
          </div>
        </div>

        {/* Navegação com scroll */}
        <nav className="sidebar-nav">
          {menuSections.map((section, sectionIndex) => (
            <div key={section.title} className="sidebar-section">
              <div className="sidebar-section-title">{section.title}</div>
              <div className="sidebar-section-items">
                {section.items.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`sidebar-item ${isActive(item.path) ? 'sidebar-item-active' : ''}`}
                  >
                    <item.icon className="sidebar-icon" size={20} />
                    <span className="sidebar-label">{item.label}</span>
                  </Link>
                ))}
              </div>
              {sectionIndex < menuSections.length - 1 && (
                <div className="sidebar-divider"></div>
              )}
            </div>
          ))}
        </nav>

        {/* Footer fixo com Configurações e Sair */}
        <div className="sidebar-footer">
          <Link
            to="/settings"
            className={`sidebar-item ${isActive('/settings') ? 'sidebar-item-active' : ''}`}
          >
            <Settings className="sidebar-icon" size={20} />
            <span className="sidebar-label">Configurações</span>
          </Link>
          <button
            onClick={logout}
            className="sidebar-item sidebar-logout"
          >
            <LogOut className="sidebar-icon" size={20} />
            <span className="sidebar-label">Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* Estilos CSS modernos */}
      <style>{`
        /* Sidebar principal */
        .sidebar-modern {
          width: 260px;
          background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
          color: white;
          display: flex;
          flex-direction: column;
          height: 100vh;
          position: relative;
          transition: width 0.3s ease;
          box-shadow: 2px 0 10px rgba(0, 0, 0, 0.3);
        }

        /* Header fixo */
        .sidebar-header {
          padding: 1.5rem 1.25rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          flex-shrink: 0;
        }

        .sidebar-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: white;
          margin-bottom: 0.25rem;
          transition: opacity 0.3s ease;
        }

        .sidebar-user {
          font-size: 0.875rem;
          color: #94a3b8;
          transition: opacity 0.3s ease;
        }

        /* Navegação com scroll */
        .sidebar-nav {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 1rem 0.75rem;
          scrollbar-width: thin;
          scrollbar-color: rgba(148, 163, 184, 0.3) transparent;
        }

        /* Scroll estilizado para Webkit (Chrome, Safari, Edge) */
        .sidebar-nav::-webkit-scrollbar {
          width: 6px;
        }

        .sidebar-nav::-webkit-scrollbar-track {
          background: transparent;
        }

        .sidebar-nav::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.3);
          border-radius: 3px;
          transition: background 0.2s;
        }

        .sidebar-nav::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.5);
        }

        /* Seções do menu */
        .sidebar-section {
          margin-bottom: 1rem;
        }

        .sidebar-section-title {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #64748b;
          padding: 0.5rem 0.75rem;
          margin-bottom: 0.25rem;
          transition: opacity 0.3s ease;
        }

        .sidebar-section-items {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .sidebar-divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.1);
          margin: 1rem 0.75rem;
        }

        /* Item de menu */
        .sidebar-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
          color: #cbd5e1;
          font-size: 0.9375rem;
          font-weight: 500;
          position: relative;
          overflow: hidden;
        }

        .sidebar-item::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          width: 3px;
          background: #3b82f6;
          transform: scaleY(0);
          transition: transform 0.2s ease;
        }

        .sidebar-item:hover {
          background: rgba(59, 130, 246, 0.1);
          color: white;
        }

        .sidebar-item:hover::before {
          transform: scaleY(1);
        }

        .sidebar-item-active {
          background: rgba(59, 130, 246, 0.15);
          color: white;
        }

        .sidebar-item-active::before {
          transform: scaleY(1);
        }

        .sidebar-icon {
          flex-shrink: 0;
          transition: transform 0.2s ease;
        }

        .sidebar-item:hover .sidebar-icon {
          transform: scale(1.1);
        }

        .sidebar-label {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: opacity 0.3s ease;
        }

        .sidebar-logout {
          border: none;
          width: 100%;
          background: transparent;
          justify-content: flex-start;
        }

        .sidebar-logout:hover {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }

        /* Footer fixo */
        .sidebar-footer {
          padding: 1rem 0.75rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          background: linear-gradient(180deg, transparent 0%, rgba(15, 23, 42, 0.5) 100%);
        }

        /* Responsividade - Apenas ícones em telas menores */
        @media (max-width: 1199px) {
          .sidebar-modern {
            width: 70px;
          }

          .sidebar-title,
          .sidebar-user,
          .sidebar-label,
          .sidebar-section-title {
            opacity: 0;
            width: 0;
            overflow: hidden;
          }

          .sidebar-item {
            justify-content: center;
            padding: 0.75rem;
          }

          .sidebar-item::before {
            display: none;
          }

          .sidebar-icon {
            margin: 0;
          }

          .sidebar-section-title {
            height: 0;
            padding: 0;
            margin: 0;
          }

          .sidebar-divider {
            margin: 0.75rem 0.5rem;
          }
        }

        /* Tablets e telas médias */
        @media (min-width: 768px) and (max-width: 1199px) {
          .sidebar-modern:hover {
            width: 260px;
          }

          .sidebar-modern:hover .sidebar-title,
          .sidebar-modern:hover .sidebar-user,
          .sidebar-modern:hover .sidebar-label,
          .sidebar-modern:hover .sidebar-section-title {
            opacity: 1;
            width: auto;
          }

          .sidebar-modern:hover .sidebar-item {
            justify-content: flex-start;
            padding: 0.75rem 1rem;
          }

          .sidebar-modern:hover .sidebar-section-title {
            height: auto;
            padding: 0.5rem 0.75rem;
            margin-bottom: 0.25rem;
          }
        }

        /* Animações suaves */
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .sidebar-item {
          animation: slideIn 0.3s ease;
        }

        /* Ajustes para altura dinâmica */
        .sidebar-modern,
        .sidebar-nav {
          max-height: 100vh;
        }

        /* Garantir que o footer nunca desapareça */
        .sidebar-footer {
          position: sticky;
          bottom: 0;
          z-index: 10;
        }
      `}</style>
    </div>
  );
}
