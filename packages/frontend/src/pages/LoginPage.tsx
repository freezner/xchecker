import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { register, login } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export function LoginPage() {
  const navigate = useNavigate();
  const { fetchMe } = useAuthStore();
  const [displayName, setDisplayName] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'register') {
        await register(displayName);
      } else {
        await login();
      }
      await fetchMe();
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>xchecker</h1>

        <div className="auth-tabs" role="tablist" aria-label="인증 방식">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={mode === 'login' ? 'active' : ''}
            onClick={() => setMode('login')}
          >
            로그인
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={mode === 'register' ? 'active' : ''}
            onClick={() => setMode('register')}
          >
            회원가입
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'register' && (
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="표시될 이름"
              required
            />
          )}
          {error && <p className="error">{error}</p>}
          <Button type="submit" loading={loading} className="auth-submit">
            {mode === 'login' ? 'Passkey로 로그인' : 'Passkey로 회원가입'}
          </Button>
        </form>

        <p className="hint">비밀번호 없이 생체인증(Passkey)으로 안전하게 로그인합니다.</p>
      </div>
    </div>
  );
}
