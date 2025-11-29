import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  branchId?: string;
  permissions: string[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (credentials) => {
        try {
          console.log('🔐 Tentando login com:', credentials.email);
          const result = await window.electronAPI.auth.login(credentials);
          
          console.log('📦 Login result recebido:', JSON.stringify(result, null, 2));
          
          // Suporta tanto formato online (result.success) quanto offline (result.user direto)
          if (result.success && result.data) {
            const token = result.data.accessToken;
            
            // Verificar se é realmente online ou offline
            if (token === 'offline-token') {
              console.log('⚠️ Formato online detectado MAS token é offline-token');
              console.log('📴 Login realizado em modo OFFLINE (backend indisponível)');
            } else {
              console.log('✅ Formato online detectado com token válido');
              console.log('🌐 Login realizado em modo ONLINE');
            }
            
            set({
              user: result.data.user,
              token: token,
              isAuthenticated: true,
            });
            
            // Salvar token no Electron store para uso em relatórios
            await window.electronAPI.settings.set({ key: 'token', value: token });
          } else if (result.user) {
            console.log('✅ Formato offline detectado');
            const token = result.accessToken;
            
            set({
              user: result.user,
              token: token,
              isAuthenticated: true,
            });
            
            // Salvar token no Electron store para uso em relatórios
            await window.electronAPI.settings.set({ key: 'token', value: token });
          } else {
            console.error('❌ Formato de resposta inválido:', result);
            throw new Error(result.error || 'Formato de resposta inválido');
          }
          
          console.log('✅ Estado de autenticação atualizado, iniciando sync...');
          // Iniciar sincronização
          await window.electronAPI.sync.start();
          console.log('✅ Login completo!');
        } catch (error: any) {
          console.error('❌ Erro no login:', error);
          throw error;
        }
      },

      logout: async () => {
        await window.electronAPI.auth.logout();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },

      setUser: (user) => set({ user }),
    }),
    {
      name: 'barmanager-auth',
    }
  )
);
