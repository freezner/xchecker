import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, id, ...props }: InputProps) {
  return (
    <div className="field">
      {label && <label htmlFor={id}>{label}</label>}
      <input id={id} className={`input${error ? ' input-error' : ''}`} {...props} />
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
