import React from 'react';
import { cn } from '../utils/utils.js';

export const Input = React.forwardRef(({
  label,
  error,
  helperText,
  isNumeric = false,
  as = 'input', // 'input' | 'select'
  children,
  className = '',
  id,
  ...props
}, ref) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const Component = as;

  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-[#16233B] tracking-wide">
          {label}
        </label>
      )}

      <Component
        ref={ref}
        id={inputId}
        className={cn(
          'w-full bg-white border border-[#D8D3C7] rounded-[6px] px-4 py-2.5 text-sm text-[#16233B] placeholder-[#5B6B79] transition-all',
          'focus:outline-none focus:border-[#B9812E] focus:ring-[3px] focus:ring-[#B9812E]/15',
          'disabled:bg-[#F6F5F1] disabled:text-[#5B6B79] disabled:cursor-not-allowed',
          isNumeric && 'font-mono text-right',
          error && 'border-[#B3432E] focus:border-[#B3432E] focus:ring-[#B3432E]/15',
          className
        )}
        {...props}
      >
        {children}
      </Component>

      {error ? (
        <p className="text-xs text-[#B3432E] font-medium mt-0.5">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-[#5B6B79] mt-0.5">{helperText}</p>
      ) : null}
    </div>
  );
});

Input.displayName = 'Input';