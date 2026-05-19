import { create } from 'zustand';
import { User, userApi } from '../api/user';

interface AuthState {
  user: User | null;
  loading: boolean;
  fetchMe: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  fetchMe: async () => {
    set({ loading: true });
    try {
      const user = await userApi.me();
      set({ user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },

  setUser: (user) => set({ user }),
}));
