import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { ToastProvider } from './contexts/ToastContext';
import LoginPage from './pages/Login';
import DashboardLayout from './components/layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import SalesPage from './pages/Sales';
import POSPage from './pages/POS';
import ProductsPage from './pages/Products';
import SuppliersPage from './pages/Suppliers';
import PurchasesPage from './pages/Purchases';
import InventoryPage from './pages/Inventory';
import InventoryAdvancedPage from './pages/InventoryAdvanced';
import CustomersPage from './pages/Customers';
import DebtsPage from './pages/Debts';
import ReportsPage from './pages/Reports';
import SettingsPage from './pages/Settings';
import UsersPage from './pages/Users';
import CashBoxPage from './pages/CashBox';
import CashBoxHistoryPage from './pages/CashBoxHistory';
import TablesPage from './pages/Tables';

function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <ToastProvider>
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      
      <Route
        path="/"
        element={
          isAuthenticated ? (
            <DashboardLayout />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="pos" element={<POSPage />} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />
        <Route path="purchases" element={<PurchasesPage />} />
        <Route path="inventory" element={<InventoryAdvancedPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="debts" element={<DebtsPage />} />
        <Route path="tables" element={<TablesPage />} />
        <Route path="cashbox" element={<CashBoxPage />} />
        <Route path="cashbox-history" element={<CashBoxHistoryPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
    </ToastProvider>
  );
}

export default App;
