import { create } from 'zustand';
import type { User } from '@/types';
import { loginApi } from '@/api/auth';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('auth_token'),
  user: null,
  isAuthenticated: !!localStorage.getItem('auth_token'),

  setToken: (token) => {
    localStorage.setItem('auth_token', token);
    set({ token, isAuthenticated: true });
  },

  login: async (username: string, password: string) => {
    const res = await loginApi({ username, password });
    const { access_token } = res.data.data;
    localStorage.setItem('auth_token', access_token);
    set({ token: access_token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    set({ token: null, user: null, isAuthenticated: false });
  },
}));
