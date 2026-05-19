import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { logout } from '../api/auth';

export function Layout({ children, fullWidth }: { children: React.ReactNode; fullWidth?: boolean }) {
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    setUser(null);
    navigate('/login');
  };

  return (
    <div className="app">
      <header className="header">
        <Link to="/" className="logo">xchecker</Link>
        <nav>
          <Link to="/">토픽 목록</Link>
          <Link to="/settings">설정</Link>
          {user && (
            <button onClick={handleLogout} className="btn-link">
              로그아웃 ({user.display_name})
            </button>
          )}
        </nav>
      </header>
      <main className={fullWidth ? "main main-full" : "main"}>{children}</main>
    </div>
  );
}
