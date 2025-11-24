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
        const result = await window.electronAPI.auth.login(credentials);
        
        if (result.success) {
          set({
            user: result.data.user,
            token: result.data.accessToken,
            isAuthenticated: true,
          });
          
          // Iniciar sincronização
          await window.electronAPI.sync.start();
        } else {
          throw new Error(result.error);
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
