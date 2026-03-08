import { useState } from 'react';

interface SecretFieldProps {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

export function SecretField({ label, value, placeholder, onChange }: SecretFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <div className="secret-field">
        <input
          aria-label={label}
          type={isVisible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="secret-field__toggle"
          aria-label={isVisible ? `隐藏 ${label}` : `显示 ${label}`}
          onClick={() => setIsVisible((current) => !current)}
        >
          {isVisible ? '隐藏' : '显示'}
        </button>
      </div>
    </label>
  );
}
