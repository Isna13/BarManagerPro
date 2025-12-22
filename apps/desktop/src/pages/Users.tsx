import { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, Eye, User, Shield, Key, Building, CheckSquare, Square } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import ConfirmDialog from '../components/ConfirmDialog';
import SearchableSelect from '../components/common/SearchableSelect';

// Definição das abas disponíveis no sistema
const AVAILABLE_TABS = [
  { id: 'dashboard', label: 'Dashboard', path: '/' },
  { id: 'pos', label: 'PDV', path: '/pos' },
  { id: 'tables', label: 'Mesas', path: '/tables' },
  { id: 'sales', label: 'Vendas', path: '/sales' },
  { id: 'products', label: 'Produtos', path: '/products' },
  { id: 'suppliers', label: 'Fornecedores', path: '/suppliers' },
  { id: 'purchases', label: 'Compras', path: '/purchases' },
  { id: 'inventory', label: 'Estoque', path: '/inventory' },
  { id: 'customers', label: 'Clientes', path: '/customers' },
  { id: 'debts', label: 'Dívidas (Vales)', path: '/debts' },
  { id: 'cashbox', label: 'Caixa', path: '/cashbox' },
  { id: 'cashbox-history', label: 'Histórico de Caixas', path: '/cashbox-history' },
  { id: 'reports', label: 'Relatórios', path: '/reports' },
  { id: 'users', label: 'Usuários', path: '/users' },
  { id: 'settings', label: 'Configurações', path: '/settings' },
];

// Permissões padrão por cargo
const DEFAULT_PERMISSIONS_BY_ROLE: { [key: string]: string[] } = {
  admin: [], // null/vazio = todas as abas
  owner: [], // proprietário = todas as abas
  manager: ['dashboard', 'pos', 'tables', 'sales', 'products', 'suppliers', 'purchases', 'inventory', 'customers', 'debts', 'cashbox', 'cashbox-history', 'reports'],
  cashier: ['dashboard', 'pos', 'tables', 'sales', 'customers', 'debts', 'cashbox'],
  waiter: ['dashboard', 'pos', 'tables'],
};

interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'cashier' | 'waiter' | 'owner';
  branch_id: string | null;
  branch_name?: string;
  phone: string | null;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  allowed_tabs?: string | null;
}

interface Branch {
  id: string;
  name: string;
}

export default function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editMode, setEditMode] = useState(false);
  
  // Controle de modal de confirmação
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmDialogConfig, setConfirmDialogConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'warning' | 'info';
  }>({ title: '', message: '', onConfirm: () => {} });
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    full_name: '',
    role: 'cashier' as User['role'],
    branch_id: '',
    phone: '',
    password: '',
    confirmPassword: '',
    allowedTabs: [] as string[],
  });

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  const roles = [
    { value: 'admin', label: 'Administrador', color: 'bg-red-100 text-red-800' },
    { value: 'manager', label: 'Gerente', color: 'bg-blue-100 text-blue-800' },
    { value: 'cashier', label: 'Caixa', color: 'bg-green-100 text-green-800' },
    { value: 'waiter', label: 'Garçom', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'owner', label: 'Proprietário', color: 'bg-purple-100 text-purple-800' },
  ];

  useEffect(() => {
    loadUsers();
    loadBranches();
  }, []);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      loadUsers();
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [search, roleFilter, statusFilter]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      
      if (search) {
        filters.search = search;
      }
      
      if (roleFilter !== 'all') {
        filters.role = roleFilter;
      }
      
      if (statusFilter !== 'all') {
        filters.isActive = statusFilter === 'active';
      }
      
      // @ts-ignore
      const result = await window.electronAPI?.users?.list?.(filters);
      if (result && Array.isArray(result)) {
        setUsers(result);
      }
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast?.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const loadBranches = async () => {
    try {
      // @ts-ignore
      const result = await window.electronAPI?.branches?.list?.();
      if (result && Array.isArray(result)) {
        setBranches(result);
      }
    } catch (error) {
      console.error('Erro ao carregar filiais:', error);
    }
  };

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditMode(true);
      setSelectedUser(user);
      
      // Parse allowed_tabs from JSON string or use default permissions for role
      let allowedTabs: string[] = [];
      if (user.allowed_tabs) {
        try {
          allowedTabs = JSON.parse(user.allowed_tabs);
        } catch (e) {
          allowedTabs = DEFAULT_PERMISSIONS_BY_ROLE[user.role] || [];
        }
      } else {
        allowedTabs = DEFAULT_PERMISSIONS_BY_ROLE[user.role] || [];
      }
      
      setFormData({
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        branch_id: user.branch_id || '',
        phone: user.phone || '',
        password: '',
        confirmPassword: '',
        allowedTabs,
      });
    } else {
      setEditMode(false);
      setSelectedUser(null);
      setFormData({
        username: '',
        email: '',
        full_name: '',
        role: 'cashier',
        branch_id: '',
        phone: '',
        password: '',
        confirmPassword: '',
        allowedTabs: DEFAULT_PERMISSIONS_BY_ROLE['cashier'] || [],
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedUser(null);
    setEditMode(false);
  };

  const validateForm = (): boolean => {
    if (!formData.username.trim()) {
      toast?.error('Nome de usuário é obrigatório');
      return false;
    }

    if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) {
      toast?.error('Email válido é obrigatório');
      return false;
    }

    if (!formData.full_name.trim()) {
      toast?.error('Nome completo é obrigatório');
      return false;
    }

    if (!editMode) {
      if (!formData.password) {
        toast?.error('Senha é obrigatória');
        return false;
      }

      if (formData.password.length < 6) {
        toast?.error('Senha deve ter pelo menos 6 caracteres');
        return false;
      }

      if (formData.password !== formData.confirmPassword) {
        toast?.error('Senhas não conferem');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      // Para admin e owner, não salvar allowedTabs (acesso total)
      const shouldSaveAllowedTabs = !['admin', 'owner'].includes(formData.role);
      
      const userData: any = {
        username: formData.username.trim(),
        email: formData.email.trim().toLowerCase(),
        fullName: formData.full_name.trim(),
        role: formData.role,
        branchId: formData.branch_id || null,
        phone: formData.phone.trim() || null,
        allowedTabs: shouldSaveAllowedTabs ? formData.allowedTabs : null,
      };

      if (!editMode && formData.password) {
        // Hash da senha para novo usuário (feito no main process)
        // @ts-ignore
        userData.passwordHash = await window.electronAPI?.users?.hashPassword?.(formData.password);
        // Também enviar a senha original para sincronização com o backend
        // (o backend faz seu próprio hash)
        userData.password = formData.password;
      }

      if (editMode && selectedUser) {
        // @ts-ignore
        await window.electronAPI?.users?.update?.(selectedUser.id, userData);
        toast?.success('Usuário atualizado com sucesso!');
      } else {
        // @ts-ignore
        await window.electronAPI?.users?.create?.(userData);
        toast?.success('Usuário criado com sucesso!');
      }

      handleCloseModal();
      loadUsers();
    } catch (error: any) {
      console.error('Erro ao salvar usuário:', error);
      if (error.message?.includes('UNIQUE constraint')) {
        if (error.message.includes('username')) {
          toast?.error('Nome de usuário já está em uso');
        } else if (error.message.includes('email')) {
          toast?.error('Email já está em uso');
        } else {
          toast?.error('Nome de usuário ou email já está em uso');
        }
      } else {
        toast?.error('Erro ao salvar usuário');
      }
    }
  };

  const handleDelete = (user: User) => {
    setConfirmDialogConfig({
      title: 'Desativar Usuário',
      message: `Tem certeza que deseja desativar o usuário "${user.full_name}"? O usuário não poderá mais fazer login no sistema.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          // @ts-ignore
          await window.electronAPI?.users?.delete?.(user.id);
          toast?.success('Usuário desativado com sucesso!');
          loadUsers();
        } catch (error) {
          console.error('Erro ao desativar usuário:', error);
          toast?.error('Erro ao desativar usuário');
        } finally {
          setShowConfirmDialog(false);
        }
      },
    });
    setShowConfirmDialog(true);
  };

  const handleOpenPasswordModal = (user: User) => {
    setSelectedUser(user);
    setPasswordData({
      newPassword: '',
      confirmPassword: '',
    });
    setShowPasswordModal(true);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwordData.newPassword) {
      toast?.error('Nova senha é obrigatória');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast?.error('Senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast?.error('Senhas não conferem');
      return;
    }

    try {
      // Hash da nova senha (feito no main process)
      // @ts-ignore
      const passwordHash = await window.electronAPI?.users?.hashPassword?.(passwordData.newPassword);

      // @ts-ignore
      await window.electronAPI?.users?.resetPassword?.(selectedUser!.id, passwordHash);
      toast?.success('Senha redefinida com sucesso!');
      setShowPasswordModal(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Erro ao redefinir senha:', error);
      toast?.error('Erro ao redefinir senha');
    }
  };

  const handleViewDetails = async (user: User) => {
    setSelectedUser(user);
    setShowDetailModal(true);
  };

  const getRoleBadge = (role: string) => {
    const roleConfig = roles.find(r => r.value === role);
    return roleConfig ? (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleConfig.color}`}>
        {roleConfig.label}
      </span>
    ) : null;
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Ativo
      </span>
    ) : (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        Inativo
      </span>
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Nunca';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Funções para gerenciar permissões de abas
  const handleTabToggle = (tabId: string) => {
    setFormData(prev => {
      const newTabs = prev.allowedTabs.includes(tabId)
        ? prev.allowedTabs.filter(t => t !== tabId)
        : [...prev.allowedTabs, tabId];
      return { ...prev, allowedTabs: newTabs };
    });
  };

  const handleSelectAllTabs = () => {
    setFormData(prev => ({
      ...prev,
      allowedTabs: AVAILABLE_TABS.map(t => t.id),
    }));
  };

  const handleClearAllTabs = () => {
    setFormData(prev => ({
      ...prev,
      allowedTabs: [],
    }));
  };

  const handleRoleChange = (role: string) => {
    // Atualizar permissões padrão ao mudar o cargo
    const defaultTabs = DEFAULT_PERMISSIONS_BY_ROLE[role] || [];
    setFormData(prev => ({
      ...prev,
      role: role as User['role'],
      allowedTabs: defaultTabs,
    }));
  };

  const isAdminOrOwner = ['admin', 'owner'].includes(formData.role);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Gerenciamento de Usuários</h1>
          <p className="text-gray-600 mt-1">Cadastre e gerencie os usuários do sistema</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Novo Usuário
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nome, email ou username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Role Filter */}
          <SearchableSelect
            options={[
              { value: 'all', label: 'Todos os Cargos' },
              ...roles.map(role => ({
                value: role.value,
                label: role.label,
              })),
            ]}
            value={roleFilter}
            onChange={(value) => setRoleFilter(value)}
            placeholder="Filtrar por cargo"
            searchPlaceholder="Buscar cargo..."
            emptyText="Nenhum cargo encontrado"
          />

          {/* Status Filter */}
          <SearchableSelect
            options={[
              { value: 'all', label: 'Todos os Status' },
              { value: 'active', label: 'Ativos' },
              { value: 'inactive', label: 'Inativos' },
            ]}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value)}
            placeholder="Filtrar por status"
            searchPlaceholder="Buscar status..."
            emptyText="Nenhum status encontrado"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Carregando usuários...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center">
            <User className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">Nenhum usuário encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuário
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cargo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Filial
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Último Login
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                          <div className="text-sm text-gray-500">@{user.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getRoleBadge(user.role)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {user.branch_name || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(user.is_active)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatDate(user.last_login)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleViewDetails(user)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Ver Detalhes"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleOpenModal(user)}
                          className="text-yellow-600 hover:text-yellow-900"
                          title="Editar"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleOpenPasswordModal(user)}
                          className="text-green-600 hover:text-green-900"
                          title="Redefinir Senha"
                        >
                          <Key className="w-5 h-5" />
                        </button>
                        {user.is_active && (
                          <button
                            onClick={() => handleDelete(user)}
                            className="text-red-600 hover:text-red-900"
                            title="Desativar"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">
                {editMode ? 'Editar Usuário' : 'Novo Usuário'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Username */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome de Usuário *
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={editMode}
                    required
                  />
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Telefone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cargo *
                  </label>
                  <SearchableSelect
                    options={roles.map(role => ({
                      value: role.value,
                      label: role.label,
                    }))}
                    value={formData.role}
                    onChange={(value) => handleRoleChange(value)}
                    placeholder="Selecione o cargo"
                    searchPlaceholder="Buscar cargo..."
                    emptyText="Nenhum cargo encontrado"
                  />
                </div>

                {/* Branch */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Filial
                  </label>
                  <SearchableSelect
                    options={[
                      { value: '', label: 'Todas as Filiais' },
                      ...branches.map(branch => ({
                        value: branch.id,
                        label: branch.name,
                      })),
                    ]}
                    value={formData.branch_id}
                    onChange={(value) => setFormData({ ...formData, branch_id: value })}
                    placeholder="Selecione a filial"
                    searchPlaceholder="Buscar filial..."
                    emptyText="Nenhuma filial encontrada"
                  />
                </div>
              </div>

              {/* Permissões de Abas */}
              <div className="mt-6 border-t pt-4">
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    <Shield className="w-4 h-4 inline mr-2" />
                    Permissões de Acesso às Abas
                  </label>
                  {!isAdminOrOwner && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAllTabs}
                        className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        <CheckSquare className="w-3 h-3 inline mr-1" />
                        Selecionar Todas
                      </button>
                      <button
                        type="button"
                        onClick={handleClearAllTabs}
                        className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      >
                        <Square className="w-3 h-3 inline mr-1" />
                        Limpar
                      </button>
                    </div>
                  )}
                </div>

                {isAdminOrOwner ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <Shield className="w-4 h-4 inline mr-1" />
                      Administradores e Proprietários têm acesso a todas as abas automaticamente.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-gray-50 rounded-lg border">
                    {AVAILABLE_TABS.map(tab => (
                      <label
                        key={tab.id}
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-100 ${
                          formData.allowedTabs.includes(tab.id) ? 'bg-blue-50 border border-blue-200' : 'bg-white border border-gray-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formData.allowedTabs.includes(tab.id)}
                          onChange={() => handleTabToggle(tab.id)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{tab.label}</span>
                      </label>
                    ))}
                  </div>
                )}
                
                {!isAdminOrOwner && formData.allowedTabs.length === 0 && (
                  <p className="text-xs text-amber-600 mt-2">
                    ⚠️ Selecione pelo menos uma aba para o usuário ter acesso.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {/* Password (only for new users) */}
                {!editMode && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Senha *
                      </label>
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                        minLength={6}
                      />
                      <p className="text-xs text-gray-500 mt-1">Mínimo de 6 caracteres</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Confirmar Senha *
                      </label>
                      <input
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                        minLength={6}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editMode ? 'Atualizar' : 'Criar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">Detalhes do Usuário</h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-center mb-6">
                <div className="flex-shrink-0 h-20 w-20 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-10 h-10 text-blue-600" />
                </div>
                <div className="ml-6">
                  <h3 className="text-2xl font-bold text-gray-800">{selectedUser.full_name}</h3>
                  <p className="text-gray-600">@{selectedUser.username}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Email</label>
                  <p className="text-gray-900">{selectedUser.email}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Telefone</label>
                  <p className="text-gray-900">{selectedUser.phone || '-'}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Cargo</label>
                  <div>{getRoleBadge(selectedUser.role)}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Filial</label>
                  <p className="text-gray-900">{selectedUser.branch_name || 'Todas as Filiais'}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Status</label>
                  <div>{getStatusBadge(selectedUser.is_active)}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Último Login</label>
                  <p className="text-gray-900">{formatDate(selectedUser.last_login)}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Data de Criação</label>
                  <p className="text-gray-900">{formatDate(selectedUser.created_at)}</p>
                </div>
              </div>

              {/* Permissões de Abas */}
              <div className="mt-6 pt-4 border-t">
                <label className="block text-sm font-medium text-gray-500 mb-2">
                  <Shield className="w-4 h-4 inline mr-1" />
                  Permissões de Acesso
                </label>
                {['admin', 'owner'].includes(selectedUser.role) ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">Acesso total a todas as abas</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      let allowedTabs: string[] = [];
                      try {
                        allowedTabs = selectedUser.allowed_tabs ? JSON.parse(selectedUser.allowed_tabs) : [];
                      } catch (e) {
                        allowedTabs = DEFAULT_PERMISSIONS_BY_ROLE[selectedUser.role] || [];
                      }
                      
                      if (allowedTabs.length === 0) {
                        allowedTabs = DEFAULT_PERMISSIONS_BY_ROLE[selectedUser.role] || [];
                      }
                      
                      return allowedTabs.map(tabId => {
                        const tab = AVAILABLE_TABS.find(t => t.id === tabId);
                        return tab ? (
                          <span
                            key={tabId}
                            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full"
                          >
                            {tab.label}
                          </span>
                        ) : null;
                      });
                    })()}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Fechar
                </button>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    handleOpenModal(selectedUser);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  Editar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">Redefinir Senha</h2>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-6">
              <p className="text-gray-600 mb-4">
                Definir nova senha para <strong>{selectedUser.full_name}</strong>
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nova Senha *
                  </label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    minLength={6}
                  />
                  <p className="text-xs text-gray-500 mt-1">Mínimo de 6 caracteres</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirmar Nova Senha *
                  </label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Key className="w-4 h-4" />
                  Redefinir Senha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {showConfirmDialog && (
        <ConfirmDialog
          title={confirmDialogConfig.title}
          message={confirmDialogConfig.message}
          confirmText="Confirmar"
          cancelText="Cancelar"
          type={confirmDialogConfig.type || 'danger'}
          onConfirm={confirmDialogConfig.onConfirm}
          onCancel={() => setShowConfirmDialog(false)}
        />
      )}
    </div>
  );
}
