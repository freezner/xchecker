import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
}

export function Button({ variant = 'primary', loading, children, disabled, ...props }: ButtonProps) {
  const base = 'btn';
  const cls = `${base} btn-${variant}`;

  return (
    <button className={cls} disabled={disabled || loading} {...props}>
      {loading ? '처리 중...' : children}
    </button>
  );
}
