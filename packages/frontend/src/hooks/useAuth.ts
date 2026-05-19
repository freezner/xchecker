import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export function useAuth(requireAuth = true) {
  const { user, loading, fetchMe } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchMe();
  }, []);

  useEffect(() => {
    if (!loading && requireAuth && !user) {
      navigate('/login');
    }
  }, [user, loading, requireAuth]);

  return { user, loading };
}
